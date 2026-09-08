/**
 * Regression test — mood dos adeptos (fans_mood) pós-jogo.
 *
 * Regras em causa (engine.ts, bloco fans_mood em applyPostMatchQualityEvolution):
 *  - Decaimento semanal para a base de fidelidade da divisão (65/60/55/50/45)
 *    aplicado a TODAS as equipas, ANTES dos deltas.
 *  - Delta por resultado com contexto: V +9 / E +2 / D -9, +1 V em casa,
 *    -3 D em casa, ±2 por golo de margem além do 1º (teto ±6), +4 upset
 *    (vencer escalão superior), -5 vergonha (perder com escalão inferior),
 *    +5 derrota esperada (amortece), ×2 em dérbi (mesma divisão),
 *    × ronda da Taça (1 → 1.8 na final). Clamp [0, 100].
 *
 * Run: cd server && npm run test:fansmood
 */
import sqlite3 from "sqlite3";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { applyPostMatchQualityEvolution } = require("../game/engine.ts") as {
  applyPostMatchQualityEvolution: (
    db: unknown,
    fixtures: any[],
    currentMatchweek: number,
    season: number,
    calendarIndex?: number,
  ) => Promise<void>;
};

function assertEq(actual: number | undefined, expected: number, msg: string) {
  if (!actual && actual !== 0) {
    console.error(`FAIL: ${msg} — sem valor`);
    process.exit(1);
  }
  if (actual !== expected) {
    console.error(`FAIL: ${msg} — esperado ${expected}, obtido ${actual}`);
    process.exit(1);
  }
  console.log(`ok  - ${msg} (${actual})`);
}

const db = new sqlite3.Database(":memory:");

function exec(sql: string): Promise<void> {
  return new Promise((res, rej) =>
    db.exec(sql, (err) => (err ? rej(err) : res())),
  );
}

async function getMood(teamId: number): Promise<number | undefined> {
  return new Promise((res) =>
    db.get("SELECT fans_mood FROM teams WHERE id = ?", [teamId], (err, row) =>
      res(err || !row ? undefined : (row as any).fans_mood),
    ),
  );
}

async function main() {
  await exec(
    `CREATE TABLE teams (id INTEGER PRIMARY KEY, morale INTEGER DEFAULT 50, fans_mood INTEGER DEFAULT 60, division INTEGER DEFAULT 4);
     CREATE TABLE matches (id INTEGER PRIMARY KEY AUTOINCREMENT, season INTEGER, matchweek INTEGER, home_team_id INTEGER, away_team_id INTEGER, home_score INTEGER, away_score INTEGER);
     CREATE TABLE players (id INTEGER PRIMARY KEY, team_id INTEGER, position TEXT, skill INTEGER, potential INTEGER, form INTEGER, games_played INTEGER, last_appearance_matchweek INTEGER, joined_matchweek INTEGER, injury_until_matchweek INTEGER, suspension_until_matchweek INTEGER);`,
  );
  // t1/t2: dérbi div 1, neutros · t3 div 4 vs t4 div 5 · t5 quase no teto · t6 quase no fundo
  await exec(
    `INSERT INTO teams (id, morale, fans_mood, division) VALUES
       (1, 50, 60, 1), (2, 50, 60, 1), (3, 50, 60, 4),
       (4, 50, 60, 5), (5, 50, 95, 1), (6, 50, 5, 1);`,
  );

  // ── Evento 1: liga ────────────────────────────────────────────────────
  await applyPostMatchQualityEvolution(
    db as never,
    [
      { homeTeamId: 1, awayTeamId: 2, finalHomeGoals: 3, finalAwayGoals: 0 },
      { homeTeamId: 3, awayTeamId: 4, finalHomeGoals: 0, finalAwayGoals: 1 },
      { homeTeamId: 5, awayTeamId: 6, finalHomeGoals: 1, finalAwayGoals: 1 },
    ],
    1,
    1,
  );

  // t1: decaimento 60→60 (base div1 65: 60.75→60) + (9+1+4)×2 = 88
  assertEq(await getMood(1), 88, "dérbi + goleada em casa dispara o mood");
  // t2: 60→60 + (−9−4)×2 = 34
  assertEq(await getMood(2), 34, "goleada sofrida no dérbi afunda o mood");
  // t3: decaimento 60→58 (base div4 50) + (−9−3−5) = 41
  assertEq(await getMood(3), 41, "vergonha em casa (perder com div inferior)");
  // t4: decaimento 60→57 (base div5 45) + (9+4) = 70
  assertEq(await getMood(4), 70, "façanha fora de casa (upset) eleva o mood");
  // t5: 95→90 + 2 = 92 · t6: 5→14 + 2 = 16
  assertEq(await getMood(5), 92, "empate com decaimento desde o teto");
  assertEq(await getMood(6), 16, "empate com recuperação desde o fundo");

  // ── Evento 2: final da Taça (ronda 5) — t1 div 1 vs t4 div 5 ──────────
  await applyPostMatchQualityEvolution(
    db as never,
    [
      {
        homeTeamId: 1,
        awayTeamId: 4,
        finalHomeGoals: 2,
        finalAwayGoals: 0,
        round: 5,
      },
    ],
    15,
    1,
  );

  // t1: 88→84 + (9+1+2)×1.8 = 84+22 → 100 (clamp)
  assertEq(await getMood(1), 100, "vencer a final esgota o teto do mood");
  // t4: 70→66 + (−9+5−2)×1.8 = 66−11 = 55 (derrota esperada dói menos)
  assertEq(await getMood(4), 55, "perder a final com um grande não é drama");

  console.log("\nTodos os testes passaram ✔");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
