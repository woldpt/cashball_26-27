/**
 * Regression test — dinâmica da Moral da Equipa (applyPostMatchQualityEvolution).
 *
 * Regras em causa:
 *  - Delta por resultado: V +25, E +5, D -20 (clamped em [0, 100]).
 *  - Decaimento semanal rumo ao neutro 50 (m += (50 - m) * 0.1) aplicado a
 *    TODAS as equipas uma vez por evento de calendário, ANTES dos deltas —
 *    para a moral reflectir momento recente e não histórico acumulado entre
 *    épocas (efeito bola-de-neve em equipas fracas / saturação no teto 100).
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
    `CREATE TABLE teams (id INTEGER PRIMARY KEY, morale INTEGER DEFAULT 50);
     CREATE TABLE matches (id INTEGER PRIMARY KEY AUTOINCREMENT, season INTEGER, matchweek INTEGER, home_team_id INTEGER, away_team_id INTEGER, home_score INTEGER, away_score INTEGER);
     CREATE TABLE players (id INTEGER PRIMARY KEY, team_id INTEGER, position TEXT, skill INTEGER, potential INTEGER, form INTEGER, games_played INTEGER, last_appearance_matchweek INTEGER, joined_matchweek INTEGER, injury_until_matchweek INTEGER, suspension_until_matchweek INTEGER);`,
  );
  // t1..t4: neutro 50; t5: quase no teto; t6: quase no fundo; t7/t8 não jogam (só decaimento)
  await exec(
    `INSERT INTO teams (id, morale) VALUES
       (1, 50), (2, 50), (3, 50), (4, 50), (5, 90), (6, 10), (7, 80), (8, 20);`,
  );

  // ── Evento 1: deltas por resultado + decaimento ────────────────────────
  await applyPostMatchQualityEvolution(db as never, FIXTURES, 1, 1);

  assertEq(await getMorale(1), 75, "V: 50 +25 = 75");
  assertEq(await getMorale(2), 30, "D: 50 -20 = 30");
  assertEq(await getMorale(3), 55, "E: 50 +5 = 55");
  assertEq(await getMorale(4), 55, "E: 50 +5 = 55");
  assertEq(await getMorale(5), 100, "V com clamp: 90→86 (decaim.) +25 → 100");
  assertEq(await getMorale(6), 0, "D com clamp: 10→14 (decaim.) -20 → 0");
  assertEq(await getMorale(7), 77, "sem jogo: 80 decai para 77");
  assertEq(await getMorale(8), 23, "sem jogo: 20 decai para 23 (rumo a 50)");

  // ── Evento 2: decaimento continua entre jornadas (t1 agora só decai) ───
  await applyPostMatchQualityEvolution(
    db as never,
    [FIXTURES[1]],
    2,
    1,
  );

  assertEq(await getMorale(1), 72, "sem jogo: 75 decai para 72");
  assertEq(await getMorale(7), 74, "sem jogo: 77 decai para 74");
  assertEq(await getMorale(8), 25, "sem jogo: 23 decai para 25");
  assertEq(await getMorale(3), 59, "E: 55→54 (decaim.) +5 = 59");

  db.close();
  console.log("\nPASS — todos os casos de moral OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
