/**
 * Regression — guardas financeiras (plano 2026-10-09-guardas-financas.md).
 *
 *   F1 — leilão restaurado depois de pago não volta a mexer em saldos
 *
 * BD em memória com o schema real (db/schema.sql).
 * Run: cd server && npm run test:finance-guards
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sqlite3 = require("sqlite3").verbose();
const { runRoomTask, runExec, runGet } = require("../coreHelpers");
const { createAuctionHelpers } = require("../auctionHelpers");

const SCHEMA = fs.readFileSync(
  path.join(path.dirname(new URL(import.meta.url).pathname), "../db/schema.sql"),
  "utf8",
);

async function openDb() {
  const db = new sqlite3.Database(":memory:");
  await new Promise<void>((res, rej) => db.exec(SCHEMA, (e: any) => (e ? rej(e) : res())));
  return db;
}

const ioStub = { to: () => ({ emit: () => {} }), emit: () => {} };
let roomSeq = 0;

function makeGame(db: any) {
  return {
    roomCode: `FG${++roomSeq}`,
    db,
    io: ioStub,
    auctions: {} as Record<string, any>,
    auctionTimers: {} as Record<string, any>,
    playersByName: {},
    seats: {},
    matchweek: 3,
    calendarIndex: 3,
    season: 1,
    year: 2026,
    gamePhase: "lobby",
    globalMarket: [],
  } as any;
}

/** Espera que a fila da sala esvazie (tarefas fire-and-forget). */
const drain = (game: any) => runRoomTask(game.roomCode, async () => {});
const budgetOf = async (db: any, id: number) =>
  (await runGet(db, "SELECT budget FROM teams WHERE id = ?", [id])).budget;

async function seedTeams(db: any, budgets: Record<number, number>) {
  for (const [id, budget] of Object.entries(budgets)) {
    await runExec(db, "INSERT INTO teams (id, name, division, budget) VALUES (?, ?, 1, ?)", [
      Number(id),
      `Equipa ${id}`,
      budget,
    ]);
  }
}

test("F1 — leilão restaurado depois de pago não paga outra vez", async () => {
  const db = await openDb();
  await seedTeams(db, { 1: 1000, 2: 1000 });
  await runExec(
    db,
    "INSERT INTO players (id, name, position, skill, value, wage, team_id, transfer_status, transfer_price) VALUES (10, 'Leiloado', 'MED', 50, 100, 10, 1, 'auction', 50)",
  );
  const game = makeGame(db);
  let saves = 0;
  const helpers = createAuctionHelpers({
    io: ioStub,
    isMatchInProgress: () => false,
    getSeasonEndMatchweek: () => 30,
    scheduleNpcAuctionBids: () => {},
    scheduleNpcCounterBid: () => {},
    saveGameState: () => {
      saves += 1;
    },
  });
  const openAuction = () => {
    game.auctions[10] = {
      playerId: 10,
      sellerTeamId: 1,
      startingPrice: 50,
      status: "open",
      bids: { 2: { amount: 300 } },
    };
  };

  openAuction();
  helpers.finalizeAuction(game, 10);
  await drain(game);
  assert.equal(await budgetOf(db, 1), 1300, "vendedor recebe o lance");
  assert.equal(await budgetOf(db, 2), 700, "comprador paga o lance");
  assert.ok(saves > 0, "estado da sala gravado no fecho");
  assert.equal(game.auctions[10], undefined);

  // Reinício antes de gravar: o leilão volta a aparecer aberto.
  openAuction();
  helpers.finalizeAuction(game, 10);
  await drain(game);
  assert.equal(await budgetOf(db, 1), 1300, "vendedor não recebe 2×");
  assert.equal(await budgetOf(db, 2), 700, "comprador não paga 2×");
  const p = await runGet(db, "SELECT team_id FROM players WHERE id = 10");
  assert.equal(p.team_id, 2);
});
