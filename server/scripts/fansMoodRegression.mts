/**
 * Regression test — mood dos adeptos (`fans_mood`, escala 1–50).
 *
 * Modelo (`game/evolution.ts`): o mood decai semanalmente para a base de
 * fidelidade da divisão (`fansBaseByDivision`, 15% por evento) e depois leva o
 * delta do resultado COM contexto — margem, casa/fora, escalão do adversário
 * (façanha/vergonha/derrota esperada), dérbi (×2) e multiplicador da ronda da
 * Taça. Os deltas são arredondados e o resultado é clampado a 1..50.
 *
 * Nota: este teste estava a falhar desde a migração para a escala 1–50 (os
 * fixtures usavam mood 60/95 e o `MIN(50, …)` do decaimento esmagava-os para
 * 50, logo o 1.º assert nunca podia dar o valor esperado) — ver NOTES.md.
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
      res(err || !row ? undefined : row.fans_mood),
    ),
  );
}

async function main() {
  await exec(
    `CREATE TABLE teams (id INTEGER PRIMARY KEY, morale INTEGER DEFAULT 25, fans_mood INTEGER DEFAULT 30, division INTEGER DEFAULT 4);
     CREATE TABLE matches (id INTEGER PRIMARY KEY AUTOINCREMENT, season INTEGER, matchweek INTEGER, home_team_id INTEGER, away_team_id INTEGER, home_score INTEGER, away_score INTEGER);
     CREATE TABLE players (id INTEGER PRIMARY KEY, team_id INTEGER, position TEXT, skill INTEGER, potential INTEGER, form INTEGER, games_played INTEGER, last_appearance_matchweek INTEGER, joined_matchweek INTEGER, injury_until_matchweek INTEGER, suspension_until_matchweek INTEGER);
     CREATE TABLE team_staff (team_id INTEGER, role TEXT, level INTEGER);`,
  );
  // t1/t2: dérbi div 1 · t3 div 4 vs t4 div 5 · t5 quase no teto · t6 quase no
  // fundo · t7/t8: par idêntico (div 4) que NÃO joga — só decaimento, e t8 com
  // Director de Comunicação nível 5.
  await exec(
    `INSERT INTO teams (id, morale, fans_mood, division) VALUES
       (1, 25, 20, 1), (2, 25, 30, 1), (3, 25, 40, 4),
       (4, 25, 40, 5), (5, 25, 45, 1), (6, 25, 5, 1),
       (7, 25, 45, 4), (8, 25, 45, 4);
     INSERT INTO team_staff (team_id, role, level) VALUES (8, 'comunicacao', 5);`,
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

  // t1 (div 1): 20→21 (decaim.) + (5 vitória + 1 casa + 2 margem) × 2 (dérbi) = 21+16
  assertEq(await getMood(1), 37, "dérbi + goleada em casa sobe o mood");
  // t2: 30→30 + (−5 −2 margem) × 2 = 16
  assertEq(await getMood(2), 16, "goleada sofrida no dérbi afunda o mood");
  // t3 (div 4, perde em casa com um div 5): 40→37 + (−5 −2 casa −3 vergonha) = 27
  assertEq(await getMood(3), 27, "vergonha em casa (perder com divisão inferior)");
  // t4 (div 5, ganha fora a um div 4): 40→37 + (5 + 2 façanha) = 44
  assertEq(await getMood(4), 44, "façanha fora de casa (upset) eleva o mood");
  // t5: 45→43 + 1 (empate) = 44 · t6: 5→9 + 1 = 10
  assertEq(await getMood(5), 44, "empate com decaimento desde o teto");
  assertEq(await getMood(6), 10, "empate com recuperação desde o fundo");
  // Director de Comunicação (nível 5): trava o decaimento para a base (−40%).
  // Par idêntico (div 4, mood 45 → base 25): sem staff 45→42; com staff
  // 45 − 3×0.6 = 43.2 → 43. Nenhum dos dois joga, logo não há delta de resultado.
  assertEq(await getMood(7), 42, "sem comunicação o mood decai para a base");
  assertEq(await getMood(8), 43, "comunicação nível 5 segura o ânimo da bancada");

  // ── Evento 2: final da Taça (ronda 5) — t1 div 1 vs t4 div 5 ──────────
  await applyPostMatchQualityEvolution(
    db as never,
    [
      {
        homeTeamId: 1,
        awayTeamId: 4,
        finalHomeGoals: 1,
        finalAwayGoals: 0,
        round: 5,
      },
    ],
    15,
    1,
  );

  // t1: 37→36 (decaim.) + (5 + 1 casa) × 1.8 (final) = 36 + 11 = 47
  assertEq(await getMood(1), 47, "vencer a final da Taça dá o maior salto");
  // t4: 44→40 (decaim.) + (−5 + 3 derrota esperada) × 1.8 = 40 − 4 = 36
  assertEq(await getMood(4), 36, "perder a final com um grande não é drama");
  // Sem jogar, o decaimento continua (com o travão da comunicação em t8).
  assertEq(await getMood(7), 39, "sem jogo: 42 decai para 39");
  assertEq(await getMood(8), 41, "sem jogo: 43 decai para 41 (travado pela comunicação)");

  db.close();
  console.log("\nPASS — todos os casos de mood dos adeptos OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
