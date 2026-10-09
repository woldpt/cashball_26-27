/**
 * Regression — guardas financeiras (plano 2026-10-09-guardas-financas.md).
 *
 *   F1 — leilão restaurado depois de pago não volta a mexer em saldos
 *   F2 — chooseSponsor 2× em paralelo credita o adiantamento uma vez
 *   F3 — buyPlayer recusa jogador em leilão
 *   F4 — 2 buyPlayer em paralelo acima do saldo: o saldo nunca fica < 0
 *   F5 — fireStaff 2× em paralelo paga uma só indemnização
 *   F6 — compra NPC: movimento certo; jogador já vendido não mexe em saldos
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
const { registerSessionSocketHandlers } = require("../socketSessionHandlers");
const { registerTransferSocketHandlers } = require("../socketTransferHandlers");
const { fireStaff } = require("../staffHelpers");
const { createNpcTransferHelpers } = require("../npcTransferHelpers");
const { staffSeverance } = require("../gameConstants");

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

/** Regista os handlers de um módulo num socket falso e devolve-os por nome. */
function fakeSocket(register: (socket: any, deps: any) => void, game: any, teamId: number, extra: any = {}) {
  const handlers: Record<string, (...a: any[]) => any> = {};
  const socket = { id: "s1", on: (ev: string, fn: any) => (handlers[ev] = fn), emit: () => {}, join: () => {} };
  register(socket, {
    io: ioStub,
    getGameBySocket: () => game,
    getPlayerBySocket: () => ({ name: "Treinador", teamId, socketId: "s1" }),
    runAll: (db: any, sql: string, p: any[] = []) =>
      new Promise((res, rej) => db.all(sql, p, (e: any, r: any) => (e ? rej(e) : res(r)))),
    runGet,
    ...extra,
  });
  return handlers;
}

test("F2 — chooseSponsor 2× em paralelo credita o adiantamento uma vez", async () => {
  const db = await openDb();
  await seedTeams(db, { 1: 1000 });
  const offer = { sponsorId: "x1", name: "Marca X", profile: "A", upfront: 500, weekly: 0, secondHalf: 0, total: 500 };
  await runExec(db, "UPDATE teams SET sponsor_pending = 1, sponsor_offers = ? WHERE id = 1", [JSON.stringify([offer])]);
  const game = makeGame(db);
  const h = fakeSocket(registerSessionSocketHandlers, game, 1);
  await Promise.all([
    h.chooseSponsor({ teamId: 1, sponsorId: "x1" }),
    h.chooseSponsor({ teamId: 1, sponsorId: "x1" }),
  ]);
  await drain(game);
  assert.equal(await budgetOf(db, 1), 1500, "adiantamento creditado uma só vez");
  const news = await runGet(db, "SELECT COUNT(*) AS n FROM club_news WHERE team_id = 1 AND type = 'sponsor'");
  assert.equal(news.n, 1, "uma só notícia de patrocinador");
});

const transferDeps = {
  isMatchInProgress: () => false,
  getSeasonEndMatchweek: () => 30,
  refreshMarket: () => {},
  emitSquadForPlayer: () => {},
};

test("F3 — buyPlayer recusa jogador em leilão", async () => {
  const db = await openDb();
  await seedTeams(db, { 1: 1000, 2: 1000 });
  await runExec(
    db,
    "INSERT INTO players (id, name, position, skill, value, wage, team_id, transfer_status, transfer_price) VALUES (10, 'Leiloado', 'MED', 50, 100, 10, 1, 'auction', 50)",
  );
  const game = makeGame(db);
  const h = fakeSocket(registerTransferSocketHandlers, game, 2, transferDeps);
  await h.buyPlayer(10);
  await drain(game);
  assert.equal(await budgetOf(db, 1), 1000);
  assert.equal(await budgetOf(db, 2), 1000);
  const p = await runGet(db, "SELECT team_id, transfer_status FROM players WHERE id = 10");
  assert.equal(p.team_id, 1);
  assert.equal(p.transfer_status, "auction");
});

test("F4 — 2 buyPlayer em paralelo acima do saldo: o saldo nunca fica < 0", async () => {
  const db = await openDb();
  await seedTeams(db, { 1: 1000, 2: 1000 });
  for (const id of [10, 11]) {
    await runExec(
      db,
      "INSERT INTO players (id, name, position, skill, value, wage, team_id, transfer_status, transfer_price) VALUES (?, 'Listado', 'MED', 50, 800, 10, 1, 'fixed', 800)",
      [id],
    );
  }
  const game = makeGame(db);
  const h = fakeSocket(registerTransferSocketHandlers, game, 2, transferDeps);
  await Promise.all([h.buyPlayer(10), h.buyPlayer(11)]);
  await drain(game);
  assert.equal(await budgetOf(db, 2), 200, "só uma compra paga");
  assert.equal(await budgetOf(db, 1), 1800, "vendedor recebe uma vez");
  const n = await runGet(db, "SELECT COUNT(*) AS n FROM players WHERE team_id = 2");
  assert.equal(n.n, 1, "comprador fica só com um jogador");
});

test("F5 — fireStaff 2× em paralelo paga uma só indemnização", async () => {
  const db = await openDb();
  await seedTeams(db, { 1: 1_000_000 });
  await runExec(
    db,
    "INSERT INTO team_staff (team_id, role, level, name, salary_weekly, hired_slot) VALUES (1, 'assistant', 2, 'Aux', 1000, 0)",
  );
  const game = makeGame(db);
  const [a, b] = await Promise.all([fireStaff(game, 1, "assistant"), fireStaff(game, 1, "assistant")]);
  assert.equal([a, b].filter((r: any) => r.ok).length, 1, "só um despedimento conta");
  assert.equal(await budgetOf(db, 1), 1_000_000 - staffSeverance(2));
});

test("F6 — compra NPC: movimento certo; jogador já vendido não mexe em saldos", async () => {
  const db = await openDb();
  await seedTeams(db, { 1: 1000, 2: 100_000, 3: 1000 });
  await runExec(
    db,
    "INSERT INTO players (id, name, position, skill, value, wage, team_id, transfer_status, transfer_price) VALUES (10, 'Listado', 'MED', 50, 100, 10, 1, 'fixed', 100)",
  );
  // Já vendido à equipa 3 (e relistado por ela), mas a foto do mercado ainda
  // o mostra listado na 1: não pode ser comprado a crédito do clube errado.
  await runExec(
    db,
    "INSERT INTO players (id, name, position, skill, value, wage, team_id, transfer_status, transfer_price) VALUES (11, 'Vendido', 'MED', 60, 100, 10, 3, 'fixed', 100)",
  );
  const realAll = (sql: string, p: any[] = []) =>
    new Promise<any[]>((res, rej) => db.all(sql, p, (e: any, r: any) => (e ? rej(e) : res(r))));
  const runAllStub = async (_db: any, sql: string, p: any[] = []) => {
    const rows = await realAll(sql, p);
    if (sql.includes("transfer_status = 'fixed'") && sql.includes("ORDER BY skill DESC")) {
      return rows.map((r) => (r.id === 11 ? { ...r, team_id: 1 } : r));
    }
    return rows;
  };
  const game = makeGame(db);
  game.playersByName = { H: { name: "H", teamId: 1 }, H3: { name: "H3", teamId: 3 } };
  const npc = createNpcTransferHelpers({ runAll: runAllStub, getSeasonEndMatchweek: () => 30, io: ioStub });
  const rnd = Math.random;
  Math.random = () => 0;
  try {
    await npc.processNpcTransferActivity(game, () => {});
  } finally {
    Math.random = rnd;
  }
  await drain(game);
  assert.equal((await runGet(db, "SELECT team_id FROM players WHERE id = 11")).team_id, 3, "vendido fica onde está");
  assert.equal((await runGet(db, "SELECT team_id FROM players WHERE id = 10")).team_id, 2, "listado muda para o NPC");
  assert.equal(await budgetOf(db, 2), 100_000 - 100, "NPC paga uma vez");
  assert.equal(await budgetOf(db, 1), 1100, "vendedor recebe uma vez");
  assert.equal(await budgetOf(db, 3), 1000, "equipa 3 intacta");
});
