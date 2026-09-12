// Reproduz o payload REAL de getGlobalNews (socketNewsHandlers.ts) numa BD com
// um jogo de Taça jogado + cup_upset + moms, e imprime o JSON exato.
import Database from "better-sqlite3";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { findRoomDbFile, savesDirFor } = require("./db/roomPaths.js");
const savesDir = savesDirFor(join("db"));
const cuprePath =
  findRoomDbFile(savesDir, "CUPRE") ??
  findRoomDbFile(join("db"), "CUPRE") ??
  join(savesDir, "game_CUPRE.db");
if (!existsSync(cuprePath)) {
  console.error(`Sala CUPRE não encontrada (${cuprePath}).`);
  process.exit(1);
}
const db = new Database(cuprePath);
const season = 1;
const year = 2026;

// ── Setup: jogo de Taça jogado (ronda 4), mome, notícia cup_upset ─────────
// Torna o script idempotente: limpa dados de teste pré-existentes.
db.exec(`DELETE FROM cup_matches; DELETE FROM match_moms;
        DELETE FROM club_news; DELETE FROM matches;`);
// Equipas: 1=Sporting, 2=Porto, 3=Benfica, 4=Sp.Braga (todas divisão 1)
// Vamos usar um jogo entre 1 e 4 (o meu = 1).
// Precisamos de um "me" humano. game_state não diz team_id; escolher 1.
const meTeam = 1;
const oppTeam = 4;

// Jogo de Liga jogado NA MESMA jornada (semana em que também houve Taça).
// O meu clube (1) joga a Liga contra 2, e a Taça contra 4.
db.prepare(
  `INSERT INTO matches (season,matchweek,home_team_id,away_team_id,home_score,away_score,attendance,played)
   VALUES (?,?,?,?,?,?,?,1)`,
).run(season, 12, meTeam, 2, 3, 1, 30000);

// cup_matches: um jogo jogado na ronda 4
db.prepare(
  `INSERT INTO cup_matches (season,round,home_team_id,away_team_id,home_score,away_score,winner_team_id,played,attendance)
   VALUES (?,?,?,?,?,?,?,1,?)`,
).run(season, 4, meTeam, oppTeam, 2, 1, meTeam, 42000);

// match_moms (ronda 4, Taça): um MOM por equipa
db.prepare(
  `INSERT INTO match_moms (season,competition,matchweek,round,team_id,player_id,player_name,score)
   VALUES (?,?,NULL,?,?,?,?,?)`,
).run(season, "Cup", 4, meTeam, 11, "Viktor Gyökeres", 60);
db.prepare(
  `INSERT INTO match_moms (season,competition,matchweek,round,team_id,player_id,player_name,score)
   VALUES (?,?,NULL,?,?,?,?,?)`,
).run(season, "Cup", 4, oppTeam, 22, "Bruno X", 32);

// cup_upset news (descreve o tomba-gigantes — aqui 1 vence 4, mas ambos div1
// não é upset; colocamos como cup_upset na mesma para testar o parser).
db.prepare(
  `INSERT INTO club_news (team_id,type,title,description,related_team_id,related_team_name,matchweek,year)
   VALUES (?,?,?,?,?,?,NULL,?)`,
).run(
  meTeam,
  "cup_upset",
  "Tomba-gigantes: Sporting elimina Sp. Braga",
  "Quartos de final · Primeira Liga vence Primeira Liga · 2–1",
  oppTeam,
  "Sp. Braga",
  year,
);

// ── getGlobalNews SQL (idêntico ao handler) ──────────────────────────────
const fail = (e) => { console.error("FAIL:", e?.message); process.exit(1); };

const clubRows = db.prepare(
  `SELECT cn.id, cn.type, 'club' AS source, cn.title, cn.description,
          cn.player_id, cn.player_name,
          cn.related_team_id, cn.related_team_name,
          cn.amount, cn.matchweek, cn.year, cn.created_at,
          t.name AS team_name, t.division
   FROM club_news cn LEFT JOIN teams t ON t.id = cn.team_id
   WHERE cn.year = ?`,
).all(year);

let transferRows = [];
if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='transfer_history'").get()) {
transferRows = db.prepare(
  `SELECT th.id, th.source AS type, 'transfer' AS source,
          th.player_name || ' · ' || th.seller_team_name || ' → ' || th.buyer_team_name AS title,
          th.position AS description,
          th.player_id, th.player_name,
          th.buyer_team_id AS related_team_id, th.buyer_team_name AS related_team_name,
          th.amount, th.matchweek, th.year, th.created_at,
          th.buyer_team_name AS team_name, NULL AS division
   FROM transfer_history th WHERE th.year = ?`,
).all(year);
}

const newsRows = [...clubRows, ...transferRows].sort(
  (a, b) => (b.matchweek || 0) - (a.matchweek || 0) ||
    String(b.created_at || "").localeCompare(String(a.created_at || "")) ||
    (b.id || 0) - (a.id || 0),
);

const momRows = db.prepare(
  `SELECT mm.competition, mm.matchweek, mm.round, mm.team_id,
          mm.player_id, mm.player_name, mm.score
   FROM match_moms mm WHERE mm.season = ?`,
).all(season);

const momsByKey = {};
for (const m of momRows) {
  const key = `${m.competition}|${m.matchweek ?? ""}|${m.round ?? ""}|${m.team_id}`;
  momsByKey[key] = { playerId: m.player_id, playerName: m.player_name, score: m.score };
}

const leagueRows = db.prepare(
  `SELECT 'League' AS competition, m.matchweek, NULL AS round,
          m.home_team_id, m.away_team_id, m.home_score, m.away_score,
          m.attendance, th.stadium_capacity AS home_capacity,
          th.name AS home_name, ta.name AS away_name,
          th.division AS home_division, ta.division AS away_division
   FROM matches m
   JOIN teams th ON th.id = m.home_team_id
   JOIN teams ta ON ta.id = m.away_team_id
   WHERE m.season = ? AND m.played = 1`,
).all(season);

const cupRows = db.prepare(
  `SELECT 'Cup' AS competition, NULL AS matchweek, cm.round,
          cm.home_team_id, cm.away_team_id, cm.home_score, cm.away_score,
          cm.attendance, th.stadium_capacity AS home_capacity,
          th.name AS home_name, ta.name AS away_name,
          th.division AS home_division, ta.division AS away_division
   FROM cup_matches cm
   JOIN teams th ON th.id = cm.home_team_id
   JOIN teams ta ON ta.id = cm.away_team_id
   WHERE cm.season = ? AND cm.played = 1`,
).all(season);

const mkResults = (rows) => rows.map((r) => {
  const homeKey = `${r.competition}|${r.matchweek ?? ""}|${r.round ?? ""}|${r.home_team_id}`;
  const awayKey = `${r.competition}|${r.matchweek ?? ""}|${r.round ?? ""}|${r.away_team_id}`;
  return {
    competition: r.competition,
    matchweek: r.matchweek ?? null,
    round: r.round ?? null,
    homeTeamId: r.home_team_id,
    awayTeamId: r.away_team_id,
    homeName: r.home_name,
    awayName: r.away_name,
    homeDivision: r.home_division,
    awayDivision: r.away_division,
    homeScore: r.home_score,
    awayScore: r.away_score,
    attendance: r.attendance ?? null,
    homeCapacity: r.home_capacity ?? null,
    momHome: momsByKey[homeKey] ?? null,
    momAway: momsByKey[awayKey] ?? null,
  };
});

const payload = {
  news: newsRows.slice(0, 200),
  results: mkResults([...leagueRows, ...cupRows]),
  year,
  season,
};

// teams para o cliente (o GameContext manda os da BD, com coach_* etc.)
const teams = db.prepare(
  `SELECT id,name,division,points,wins,draws,losses,goals_for,goals_against,stadium_capacity FROM teams ORDER BY id`,
).all();

// players (coaches) para humanTeamIds
const players = teams.slice(0, 3).map((t) => ({ id: t.id, name: `Mister ${t.name}`, teamId: t.id }));

writeFileSync("journal-fixture.json", JSON.stringify({
  globalNews: payload,
  teams,
  me: { teamId: meTeam },
  seasonYear: year,
  topScorers: [],
  teamForms: {},
  players,
}, null, 2));

console.log("═════ PAYLOAD (getGlobalNews results) ═════");
console.log(JSON.stringify(payload.results, null, 2));
console.log("news:", JSON.stringify(payload.news, null, 2));
