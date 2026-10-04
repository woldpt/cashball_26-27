/**
 * Regression test — dinâmica da Moral da Equipa (applyPostMatchQualityEvolution).
 *
 * Regras em causa (escala 1–50, neutro 25):
 *  - Delta por resultado: V +12, E +2, D -10 (clamped em [1, 50]).
 *  - Decaimento semanal rumo ao neutro 25 (m += (25 - m) * 0.1, CAST inteiro)
 *    aplicado a TODAS as equipas uma vez por evento de calendário, ANTES dos
 *    deltas — para a moral reflectir momento recente e não histórico acumulado
 *    entre épocas (efeito bola-de-neve em equipas fracas / saturação no teto).
 *
 * Nota: este teste estava a falhar desde a migração para a escala 1–50 (esperava
 * os deltas antigos de 25/−20/5 e o neutro 50, e o bloco dos adeptos rebentava
 * por falta da coluna `division`) — ver NOTES.md.
 *
 * Run: cd server && npm run test:morale
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
  if (actual !== expected) {
    console.error(`FAIL: ${msg} — esperado ${expected}, obtido ${actual}`);
    process.exit(1);
  }
  console.log(`ok  - ${msg} (${actual})`);
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`ok  - ${msg}`);
}

const db = new sqlite3.Database(":memory:");

function exec(sql: string): Promise<void> {
  return new Promise((res, rej) =>
    db.exec(sql, (err) => (err ? rej(err) : res())),
  );
}

async function getMorale(teamId: number): Promise<number | undefined> {
  return new Promise((res) =>
    db.get("SELECT morale FROM teams WHERE id = ?", [teamId], (err, row) =>
      res(err || !row ? undefined : row.morale),
    ),
  );
}

const FIXTURES = [
  { homeTeamId: 1, awayTeamId: 2, finalHomeGoals: 2, finalAwayGoals: 0 }, // t1 V, t2 D
  { homeTeamId: 3, awayTeamId: 4, finalHomeGoals: 1, finalAwayGoals: 1 }, // t3 E, t4 E
  { homeTeamId: 5, awayTeamId: 6, finalHomeGoals: 3, finalAwayGoals: 0 }, // t5 V (clamp topo), t6 D (clamp fundo)
];

async function main() {
  await exec(
    // `division`/`fans_mood` existem para o bloco dos adeptos do mesmo evento
    // correr a sério (sem a coluna, o UPDATE era saltado com um log de erro).
    `CREATE TABLE teams (id INTEGER PRIMARY KEY, morale INTEGER DEFAULT 25, fans_mood INTEGER DEFAULT 30, division INTEGER DEFAULT 1);
     CREATE TABLE matches (id INTEGER PRIMARY KEY AUTOINCREMENT, season INTEGER, matchweek INTEGER, home_team_id INTEGER, away_team_id INTEGER, home_score INTEGER, away_score INTEGER);
     CREATE TABLE players (id INTEGER PRIMARY KEY, team_id INTEGER, position TEXT, skill INTEGER, potential INTEGER, form INTEGER, games_played INTEGER, last_appearance_matchweek INTEGER, joined_matchweek INTEGER, injury_until_matchweek INTEGER, suspension_until_matchweek INTEGER);`,
  );
  // t1..t4: neutro 25 · t5: quase no teto · t6: quase no fundo · t7/t8 não jogam (só decaimento)
  await exec(
    `INSERT INTO teams (id, morale) VALUES
       (1, 25), (2, 25), (3, 25), (4, 25), (5, 45), (6, 5), (7, 40), (8, 10), (9, 20);`,
  );

  // ── Evento 1: deltas por resultado + decaimento ────────────────────────
  await applyPostMatchQualityEvolution(db as never, FIXTURES, 1, 1);

  assertEq(await getMorale(1), 37, "V: 25 (decai a 25) +12 = 37");
  assertEq(await getMorale(2), 15, "D: 25 -10 = 15");
  assertEq(await getMorale(3), 27, "E: 25 +2 = 27");
  assertEq(await getMorale(4), 27, "E: 25 +2 = 27");
  assertEq(await getMorale(5), 50, "V com clamp: 45→43 (decaim.) +12 → 50");
  assertEq(await getMorale(6), 1, "D com clamp: 5→7 (decaim.) -10 → 1");
  assertEq(await getMorale(7), 39, "sem jogo: 40 decai para 39 (38,5 arredonda)");
  assertEq(await getMorale(8), 12, "sem jogo: 10 decai para 12 (rumo a 25)");
  assertEq(await getMorale(9), 21, "sem jogo: 20 sobe para 21 (antes truncava e ficava preso)");

  // ── Evento 2: decaimento continua entre jornadas (t1 agora só decai) ───
  await applyPostMatchQualityEvolution(
    db as never,
    [FIXTURES[1]],
    2,
    1,
  );

  assertEq(await getMorale(1), 36, "sem jogo: 37 decai para 36");
  assertEq(await getMorale(7), 38, "sem jogo: 39 decai para 38");
  assertEq(await getMorale(8), 13, "sem jogo: 12 sobe para 13");
  assertEq(await getMorale(3), 29, "E: 27→27 (decaim.) +2 = 29");

  db.close();
  console.log("\nPASS — todos os casos de moral OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
