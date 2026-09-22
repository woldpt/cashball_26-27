/**
 * Regression — data das notícias do Jornal = semana do calendário (`slot`).
 *
 * O bug: as notícias eram datadas pelo `matchweek`, que NÃO é uma data — só
 * anda nas jornadas da liga e é incrementado no fim da jornada, por isso a
 * semana de Taça que se segue herda o número da jornada seguinte (a Taça dos
 * 16 avos e a jornada 4 partilhavam "S4") e a final da Taça ficava em "S15",
 * fora das 14 jornadas. A semana verdadeira é `game.calendarIndex + 1` (1..20).
 *
 *   N1 — slotForLeagueMatchweek = posição no SEASON_CALENDAR (jornada → semana)
 *   N2 — logClubNews grava a semana do calendário, não o matchweek
 *   N3 — logClubNewsOnce desduplica por semana: Taça (S5) e jornada (S6) são
 *        semanas distintas mesmo com o mesmo matchweek
 *   N4 — linhas anteriores à coluna (slot NULL) continuam a desduplicar pelo
 *        matchweek (compatibilidade)
 *   N5 — recordTransfer grava a semana em transfer_history
 *
 * Run: cd server && npm run test:newsslot
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sqlite3 = require("sqlite3").verbose();
const { SEASON_CALENDAR, slotForLeagueMatchweek } = require("../gameConstants.ts");
const { logClubNews, logClubNewsOnce, recordTransfer } = require("../coreHelpers.ts");

const CLUB_NEWS_DDL = `CREATE TABLE club_news (
  id INTEGER PRIMARY KEY AUTOINCREMENT, team_id INTEGER NOT NULL,
  type TEXT NOT NULL, title TEXT NOT NULL, description TEXT,
  player_id INTEGER, player_name TEXT, related_team_id INTEGER,
  related_team_name TEXT, amount INTEGER, matchweek INTEGER, slot INTEGER,
  year INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`;

const TRANSFER_DDL = `CREATE TABLE transfer_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT, player_id INTEGER,
  player_name TEXT NOT NULL, position TEXT, skill INTEGER,
  is_star INTEGER DEFAULT 0, photo TEXT, seller_team_id INTEGER,
  seller_team_name TEXT, buyer_team_id INTEGER, buyer_team_name TEXT,
  amount INTEGER NOT NULL, source TEXT NOT NULL, matchweek INTEGER,
  slot INTEGER, year INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`;

function openDb(): Promise<any> {
  return new Promise((resolve) => {
    const db = new sqlite3.Database(":memory:", () =>
      db.run(CLUB_NEWS_DDL, () => db.run(TRANSFER_DDL, () => resolve(db))),
    );
  });
}

const run = (db: any, sql: string, params: any[] = []) =>
  new Promise<void>((resolve, reject) =>
    db.run(sql, params, (err: any) => (err ? reject(err) : resolve())),
  );

const all = (db: any, sql: string, params: any[] = []) =>
  new Promise<any[]>((resolve, reject) =>
    db.all(sql, params, (err: any, rows: any[]) => (err ? reject(err) : resolve(rows))),
  );

/** Sala com o relógio na semana de Taça dos 16 avos (slot 5, matchweek 4). */
function makeGame(db: any, overrides: any = {}) {
  return {
    roomCode: "TEST01",
    db,
    season: 2,
    year: 2030,
    matchweek: 4,
    calendarIndex: 4,
    ...overrides,
  };
}

const defer = (db: any) => new Promise((r) => setTimeout(r, 30));

test("N1 — jornada da liga → semana do calendário (SEASON_CALENDAR)", () => {
  const league = SEASON_CALENDAR.filter((e: any) => e.type === "league");
  for (const entry of league) {
    assert.equal(
      slotForLeagueMatchweek(entry.matchweek),
      entry.calendarIndex + 1,
      `jornada ${entry.matchweek} → semana ${entry.calendarIndex + 1}`,
    );
  }
  const slots = league.map((e: any) => slotForLeagueMatchweek(e.matchweek));
  assert.equal(new Set(slots).size, slots.length, "sem semanas repetidas");
});

test("N2 — logClubNews grava a semana do calendário (Taça = S5)", async () => {
  const db = await openDb();
  logClubNews(makeGame(db), "board_warning", "Aviso da direção", 7, {});
  await defer(db);
  const [row] = await all(db, "SELECT matchweek, slot, year FROM club_news");
  assert.deepEqual(
    { matchweek: row.matchweek, slot: row.slot, year: row.year },
    { matchweek: 4, slot: 5, year: 2030 },
    "a semana da Taça é 5, não a jornada 4",
  );
});

test("N3 — logClubNewsOnce: Taça (S5) e jornada (S6) são semanas distintas", async () => {
  const db = await openDb();
  logClubNewsOnce(makeGame(db), "board_warning", "Aviso", 7, {});
  await defer(db);
  // Semana seguinte, jornada 4: o matchweek ainda é 4 (só avança no fim).
  logClubNewsOnce(makeGame(db, { calendarIndex: 5 }), "board_warning", "Aviso", 7, {});
  await defer(db);
  logClubNewsOnce(makeGame(db, { calendarIndex: 5 }), "board_warning", "Aviso", 7, {});
  await defer(db);
  const rows = await all(db, "SELECT slot FROM club_news ORDER BY slot");
  assert.deepEqual(rows.map((r) => r.slot), [5, 6], "uma linha por semana");
});

test("N4 — linhas antigas (slot NULL) desduplicam pelo matchweek", async () => {
  const db = await openDb();
  await run(
    db,
    "INSERT INTO club_news (team_id, type, title, matchweek, year) VALUES (7, 'board_warning', 'Aviso antigo', 4, 2030)",
  );
  logClubNewsOnce(makeGame(db), "board_warning", "Aviso", 7, {});
  await defer(db);
  const rows = await all(db, "SELECT slot FROM club_news");
  assert.equal(rows.length, 1, "a linha antiga da mesma semana continua a cobrir");
});

test("N5 — recordTransfer grava a semana em transfer_history", async () => {
  const db = await openDb();
  recordTransfer(
    makeGame(db, { calendarIndex: 5, matchweek: 4 }),
    {
      playerId: 1,
      playerName: "Zé",
      sellerTeamId: null,
      sellerTeamName: "Clube A",
      buyerTeamId: null,
      buyerTeamName: "Clube B",
      amount: 1000,
      source: "hire",
    },
  );
  await defer(db);
  const [row] = await all(db, "SELECT matchweek, slot FROM transfer_history");
  assert.deepEqual(
    { matchweek: row.matchweek, slot: row.slot },
    { matchweek: 4, slot: 6 },
    "negócio da jornada 4 datado na semana 6",
  );
});
