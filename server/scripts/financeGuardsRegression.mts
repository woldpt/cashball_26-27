/**
 * Regression — guardas financeiras (plano 2026-10-09-guardas-financas.md).
 *
 *   F1 — leilão restaurado depois de pago não volta a mexer em saldos
 *   F2 — chooseSponsor 2× em paralelo credita o adiantamento uma vez
 *   F3 — buyPlayer recusa jogador em leilão
 *   F4 — 2 buyPlayer em paralelo acima do saldo: o saldo nunca fica < 0
 *   F5 — fireStaff 2× em paralelo paga uma só indemnização
 *   F6 — compra NPC: movimento certo; jogador já vendido não mexe em saldos
 *   F7 — NPC acima do limiar com o plantel cheio investe em infraestruturas;
 *        abaixo do limiar não gasta
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
const { createContractHelpers } = require("../contractHelpers");
const { NPC_INVEST_BUDGET_THRESHOLD, NPC_ACADEMY_COST } = require("../gameConstants");
const { staffSeverance } = require("../gameConstants");
const { createWeeklyFlowHelpers } = require("../weeklyFlowHelpers");
const { registerFinanceSocketHandlers } = require("../socketFinanceHandlers");

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

test("F7 — patrocínio perfil B: a notícia não regista a época inteira como receita", async () => {
  const db = await openDb();
  await seedTeams(db, { 1: 1000 });
  const offer = { sponsorId: "x1", name: "Marca X", profile: "B", upfront: 0, weekly: 100, secondHalf: 0, total: 2500 };
  await runExec(db, "UPDATE teams SET sponsor_pending = 1, sponsor_offers = ? WHERE id = 1", [JSON.stringify([offer])]);
  const game = makeGame(db);
  const h = fakeSocket(registerSessionSocketHandlers, game, 1);
  await h.chooseSponsor({ teamId: 1, sponsorId: "x1" });
  await drain(game);
  assert.equal(await budgetOf(db, 1), 1000, "perfil B não credita nada no dia 1");
  const sum = await runGet(db, "SELECT COALESCE(SUM(amount), 0) AS s FROM club_news WHERE team_id = 1 AND type = 'sponsor'");
  assert.equal(sum.s, 0, "soma das notícias = dinheiro realmente creditado");
});

/** Helpers semanais com todas as dependências a no-op (só a renda é exercitada). */
const weeklyHelpers = () =>
  createWeeklyFlowHelpers(new Proxy({}, { get: () => () => {} }));

test("F8 — patrocínio por escolher sem treinador humano é escolhido na renda semanal", async () => {
  const db = await openDb();
  await seedTeams(db, { 1: 1000, 2: 1000 });
  await runExec(db, "INSERT INTO managers (id, name, is_human) VALUES (7, 'Humano', 1)");
  await runExec(db, "UPDATE teams SET manager_id = 7 WHERE id = 2");
  await runExec(db, "UPDATE teams SET sponsor_pending = 1, sponsor_season = 1, sponsor_offers = '[]' WHERE id IN (1, 2)");
  const game = makeGame(db);
  assert.equal(await weeklyHelpers().applyWeeklyFinancesOnce(game), true);
  const orphan = await runGet(db, "SELECT sponsor_pending, sponsor_id, sponsor_season FROM teams WHERE id = 1");
  assert.equal(orphan.sponsor_pending, 0, "clube sem humano deixou de estar pendente");
  assert.ok(orphan.sponsor_id, "tem patrocinador");
  assert.equal(orphan.sponsor_season, 1);
  const human = await runGet(db, "SELECT sponsor_pending, sponsor_id FROM teams WHERE id = 2");
  assert.equal(human.sponsor_pending, 1, "clube com humano continua à espera da escolha");
  assert.equal(human.sponsor_id, null);
});

test("F9 — empréstimo pedido durante a transação de outro fluxo sobrevive ao ROLLBACK dela", async () => {
  const db = await openDb();
  await seedTeams(db, { 1: 1000 });
  const game = makeGame(db);
  const h = fakeSocket(registerFinanceSocketHandlers, game, 1, { isMatchInProgress: () => false });
  // Outro fluxo (ex. fecho de leilão) com transação aberta que acaba em ROLLBACK.
  const other = runRoomTask(game.roomCode, async () => {
    await runExec(db, "BEGIN");
    await new Promise((r) => setTimeout(r, 30));
    await runExec(db, "ROLLBACK");
  });
  await new Promise((r) => setTimeout(r, 5));
  await Promise.all([other, h.takeLoan()]);
  await drain(game);
  const t = await runGet(db, "SELECT budget, loan_amount FROM teams WHERE id = 1");
  assert.equal(t.loan_amount, 500000, "dívida registada");
  assert.equal(t.budget, 501000, "dinheiro creditado");
});

test("F10 — fecho de leilão: dono mudou não paga; venda garantida sem lances vai a um NPC", async () => {
  const db = await openDb();
  await seedTeams(db, { 1: 1000, 2: 1000, 3: 5000 });
  await runExec(
    db,
    "INSERT INTO players (id, name, position, skill, value, wage, team_id, transfer_status, transfer_price) VALUES (10, 'Leiloado', 'MED', 50, 100, 10, 3, 'auction', 50)",
  );
  const game = makeGame(db);
  const helpers = createAuctionHelpers({
    io: ioStub,
    isMatchInProgress: () => false,
    getSeasonEndMatchweek: () => 30,
    scheduleNpcAuctionBids: () => {},
    scheduleNpcCounterBid: () => {},
    saveGameState: () => {},
  });
  // O vendedor registado (1) já não é o dono (3): não há venda nem movimento de saldos.
  game.auctions[10] = { playerId: 10, sellerTeamId: 1, startingPrice: 50, status: "open", bids: { 2: { amount: 300 } } };
  helpers.finalizeAuction(game, 10);
  await drain(game);
  assert.equal(await budgetOf(db, 1), 1000);
  assert.equal(await budgetOf(db, 2), 1000);
  assert.equal((await runGet(db, "SELECT team_id FROM players WHERE id = 10")).team_id, 3);

  // Venda garantida sem lances: o NPC mais rico (equipa 2, a 3 é a vendedora) paga o preço-base.
  await runExec(db, "UPDATE players SET transfer_status = 'auction' WHERE id = 10");
  game.auctions[10] = { playerId: 10, sellerTeamId: 3, startingPrice: 50, status: "open", bids: {}, guaranteed: true };
  helpers.finalizeAuction(game, 10);
  await drain(game);
  const buyer = (await runGet(db, "SELECT team_id FROM players WHERE id = 10")).team_id;
  assert.ok(buyer === 1 || buyer === 2, "um NPC comprou");
  assert.equal(await budgetOf(db, buyer), 950, "comprador paga o preço-base");
  assert.equal(await budgetOf(db, 3), 5050, "vendedor recebe o preço-base");
});

test("F11 — renda semanal chamada 2× em paralelo cobra uma só vez", async () => {
  const db = await openDb();
  await seedTeams(db, { 1: 1000 });
  const game = makeGame(db);
  const w = weeklyHelpers();
  const [a, b] = await Promise.all([w.applyWeeklyFinancesOnce(game), w.applyWeeklyFinancesOnce(game)]);
  assert.equal(a && b, true);
  // Referência: uma única cobrança numa sala igual.
  const refDb = await openDb();
  await seedTeams(refDb, { 1: 1000 });
  await weeklyHelpers().applyWeeklyFinancesOnce(makeGame(refDb));
  assert.equal(await budgetOf(db, 1), await budgetOf(refDb, 1), "cobrado uma só vez");
  assert.notEqual(await budgetOf(db, 1), 1000, "e cobrado de facto");
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
  // Orçamento do NPC (2) folgado: a compra conta o preço mais os ordenados
  // até ao fim da época, e tem de caber em metade do orçamento.
  await seedTeams(db, { 1: 1000, 2: 1_000_000, 3: 1000 });
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
  assert.equal(await budgetOf(db, 2), 1_000_000 - 100, "NPC paga uma vez");
  assert.equal(await budgetOf(db, 1), 1100, "vendedor recebe uma vez");
  assert.equal(await budgetOf(db, 3), 1000, "equipa 3 intacta");
});

test("F7 — NPC rico com o plantel cheio investe o excedente; abaixo do limiar não gasta", async () => {
  const db = await openDb();
  const rich = NPC_INVEST_BUDGET_THRESHOLD + 2 * NPC_ACADEMY_COST;
  const modest = NPC_INVEST_BUDGET_THRESHOLD - 1;
  await seedTeams(db, { 1: rich, 2: modest });
  // Estádio à medida dos adeptos (sem obra) e plantel cheio (sem academia).
  await runExec(db, "UPDATE teams SET stadium_capacity = 50000, fanbase = 40000");
  for (const teamId of [1, 2]) {
    for (let i = 0; i < 26; i++) {
      await runExec(
        db,
        "INSERT INTO players (name, position, skill, value, wage, team_id) VALUES (?, 'MED', 30, 100, 10, ?)",
        [`J${teamId}-${i}`, teamId],
      );
    }
  }
  const realAll = (_db: any, sql: string, p: any[] = []) =>
    new Promise<any[]>((res, rej) => db.all(sql, p, (e: any, r: any) => (e ? rej(e) : res(r))));
  const game = makeGame(db);
  const contracts = createContractHelpers({
    io: ioStub,
    runAll: realAll,
    runGet,
    startAuction: () => {},
    getSeasonEndMatchweek: () => 30,
  });
  await contracts.processNpcInvestment(game);
  await drain(game);
  assert.equal(await budgetOf(db, 1), rich - NPC_ACADEMY_COST, "rico: um investimento por semana");
  assert.equal(await budgetOf(db, 2), modest, "abaixo do limiar: intacto");
  assert.equal(
    (await runGet(db, "SELECT COUNT(*) AS n FROM players WHERE team_id = 1")).n,
    26,
    "plantel cheio: sem prospeto novo",
  );
});
