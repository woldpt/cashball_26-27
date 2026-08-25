/**
 * Regression test — assistências devem refletir a FORMA da equipa.
 *
 * Root cause: `calculateMatchAttendance` (coreHelpers.ts) fazia um blend 50/50
 * entre `formAttendance` (baseada nos últimos 5 jogos) e `avg_attendance`
 * (média histórica, indicador atrasado persistido no fim da época). Como a
 * média histórica pesa metade, uma equipa em excelente forma (5 vitórias
 * seguidas → formAttendance = 100% da capacidade) ficava arrastada para baixo:
 * ex. prevAvg 40% → apenas 70% de ocupação, mesmo com forma perfeita.
 *
 * Fix: `prevAvg` passou a funcionar como PISO de reputação (`Math.max`),
 * nunca como travão. Forma boa enche o estádio; a reputação só garante
 * assistência mínima a equipas em má fase.
 *
 * Run: cd server && npm run test:attendance
 */
import { createRequire } from "node:module";
import sqlite3 from "sqlite3";

const require = createRequire(import.meta.url);
const { calculateMatchAttendance } = require("../coreHelpers.ts") as {
  calculateMatchAttendance: typeof import("../coreHelpers").calculateMatchAttendance;
};

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`ok  - ${msg}`);
}

const CAP = 10000;

async function setupDb(overrides: {
  avgAttendance?: number;
  results?: Array<{ home: number; away: number }>;
}) {
  const db = new sqlite3.Database(":memory:");
  const run = (sql: string, params: any[] = []) =>
    new Promise<void>((resolve, reject) => {
      db.run(sql, params, (err) => (err ? reject(err) : resolve()));
    });
  const get = (sql: string, params: any[] = []) =>
    new Promise<any>((resolve, reject) => {
      db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    });

  await run(
    "CREATE TABLE teams (id INTEGER PRIMARY KEY, stadium_capacity INTEGER, division INTEGER, avg_attendance INTEGER)",
  );
  await run(
    "CREATE TABLE matches (id INTEGER PRIMARY KEY AUTOINCREMENT, matchweek INTEGER, home_team_id INTEGER, away_team_id INTEGER, home_score INTEGER, away_score INTEGER, played INTEGER)",
  );
  await run(
    "CREATE TABLE players (id INTEGER PRIMARY KEY, team_id INTEGER, skill INTEGER)",
  );

  await run("INSERT INTO teams (id, stadium_capacity, division, avg_attendance) VALUES (1, ?, 1, ?)", [
    CAP,
    overrides.avgAttendance ?? null,
  ]);
  await run("INSERT INTO teams (id, stadium_capacity, division, avg_attendance) VALUES (2, ?, 1, NULL)", [
    CAP,
  ]);

  const results = overrides.results ?? [];
  // result.home > result.away → vitória da equipa 1 (casa)
  for (const r of results) {
    await run(
      "INSERT INTO matches (matchweek, home_team_id, away_team_id, home_score, away_score, played) VALUES (?, 1, 2, ?, ?, 1)",
      [1, r.home, r.away],
    );
  }

  // Adversário de skill 50 → multiplicador máximo (+20%)
  await run("INSERT INTO players (id, team_id, skill) VALUES (10, 2, 50)");
  await run("INSERT INTO players (id, team_id, skill) VALUES (11, 2, 50)");

  return { db, get };
}

async function main() {
  // ── 1. Forma perfeita (5 vitórias) + histórico fraco → estádio CHEIO ─────
  // Antes do fix: (4000 + 10000)/2 = 7000 → 70% (bug reportado)
  {
    const { db } = await setupDb({
      avgAttendance: 4000, // 40% da capacidade (histórico fraco)
      results: [
        { home: 3, away: 0 },
        { home: 2, away: 1 },
        { home: 4, away: 2 },
        { home: 1, away: 0 },
        { home: 3, away: 1 },
      ],
    });
    const attendance = await calculateMatchAttendance(db, 1, 2);
    assert(
      attendance >= CAP * 0.95,
      `5 vitórias seguidas + histórico fraco → estádio cheio (obtido ${attendance}/${CAP})`,
    );
    db.close();
  }

  // ── 2. Má forma (5 derrotas) + grande reputação → piso de reputação ──────
  {
    const { db } = await setupDb({
      avgAttendance: 8000, // 80% (clube grande)
      results: [
        { home: 0, away: 2 },
        { home: 1, away: 3 },
        { home: 0, away: 1 },
        { home: 2, away: 4 },
        { home: 0, away: 5 },
      ],
    });
    const attendance = await calculateMatchAttendance(db, 1, 2);
    assert(
      attendance >= 7500,
      `5 derrotas + reputação alta → público não colapsa abaixo do histórico (obtido ${attendance})`,
    );
    db.close();
  }

  // ── 3. Sem histórico (primeira época) → assistência = forma pura ─────────
  {
    const { db } = await setupDb({
      avgAttendance: null,
      results: [
        { home: 3, away: 0 },
        { home: 2, away: 1 },
        { home: 0, away: 0 },
        { home: 1, away: 1 },
        { home: 0, away: 2 },
      ],
    });
    const attendance = await calculateMatchAttendance(db, 1, 2);
    // formPoints = (1 + 1 + 0.4 + 0.4 + 0)/5 = 0.56 → 0.3 + 0.56*0.7 = 0.692
    const base = Math.floor(CAP * 0.692);
    const expected = Math.min(CAP, Math.round(base * 1.2)); // +20% adversário skill 50
    assert(
      attendance === expected,
      `sem histórico → assistência puramente baseada na forma (obtido ${attendance}, esperado ${expected})`,
    );
    db.close();
  }

  // ── 4. Limite de divisão mantém-se (divisão 5 → cap 4800) ────────────────
  {
    const db = new sqlite3.Database(":memory:");
    const run = (sql: string, params: any[] = []) =>
      new Promise<void>((resolve, reject) => {
        db.run(sql, params, (err) => (err ? reject(err) : resolve()));
      });
    await run(
      "CREATE TABLE teams (id INTEGER PRIMARY KEY, stadium_capacity INTEGER, division INTEGER, avg_attendance INTEGER)",
    );
    await run(
      "CREATE TABLE matches (id INTEGER PRIMARY KEY AUTOINCREMENT, matchweek INTEGER, home_team_id INTEGER, away_team_id INTEGER, home_score INTEGER, away_score INTEGER, played INTEGER)",
    );
    await run(
      "CREATE TABLE players (id INTEGER PRIMARY KEY, team_id INTEGER, skill INTEGER)",
    );
    await run(
      "INSERT INTO teams (id, stadium_capacity, division, avg_attendance) VALUES (1, 10000, 5, NULL)",
    );
    await run(
      "INSERT INTO teams (id, stadium_capacity, division, avg_attendance) VALUES (2, 10000, 5, NULL)",
    );
    await run("INSERT INTO players (id, team_id, skill) VALUES (10, 2, 50)");
    for (let i = 0; i < 5; i++) {
      await run(
        "INSERT INTO matches (matchweek, home_team_id, away_team_id, home_score, away_score, played) VALUES (?, 1, 2, 3, 0, 1)",
        [i + 1],
      );
    }
    const attendance = await calculateMatchAttendance(db, 1, 2);
    assert(
      attendance === 4800,
      `forma perfeita respeita limite da divisão 5 (4800) — obtido ${attendance}`,
    );
    db.close();
  }

  console.log("\nTodos os testes passaram ✔");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
