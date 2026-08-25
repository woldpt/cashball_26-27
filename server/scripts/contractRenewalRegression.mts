/**
 * Regression test — renovação de contratos com modal de decisão obrigatório
 * + limite de 1 proposta de negociação por treinador por semana.
 *
 * Guardas:
 *   1. Jogadores de equipas humanas NUNCA vão a leilão automaticamente no fim
 *      do contrato — ficam pendentes até o treinador decidir no modal.
 *   2. Pedido emitido com treinador offline fica persistido (pending=1) e é
 *      re-emitido depois (resendPendingContractRequests).
 *   3. No máximo 1 proposta NOVA por treinador por semana (renovações +
 *      renegociações partilham o mesmo orçamento).
 *   4. Re-emissão de pedidos pendentes não consome o orçamento semanal.
 *
 * Run: cd server && npm run test:contractrenewal
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const sqlite3 = require("sqlite3") as any;
const { createContractHelpers } = require("../contractHelpers.ts") as {
  createContractHelpers: (deps: any) => any;
};
const { getSeasonEndMatchweek } = require("../coreHelpers.ts") as {
  getSeasonEndMatchweek: (mw: number) => number;
};

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`ok  - ${msg}`);
}

const SCHEMA = `
CREATE TABLE players (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  position TEXT,
  skill INTEGER DEFAULT 70,
  wage INTEGER DEFAULT 5000,
  value INTEGER DEFAULT 500000,
  resistance INTEGER DEFAULT 3,
  form INTEGER DEFAULT 90,
  is_star INTEGER DEFAULT 0,
  team_id INTEGER,
  transfer_status TEXT DEFAULT 'none',
  transfer_price INTEGER DEFAULT 0,
  contract_start_epoch INTEGER DEFAULT 0,
  contract_request_pending INTEGER DEFAULT 0,
  contract_requested_wage INTEGER DEFAULT 0,
  contract_until_matchweek INTEGER DEFAULT 0,
  joined_matchweek INTEGER DEFAULT 0,
  transfer_cooldown_until_matchweek INTEGER DEFAULT 0
);
CREATE TABLE teams (
  id INTEGER PRIMARY KEY,
  name TEXT,
  budget INTEGER DEFAULT 1000000
);
CREATE TABLE managers (
  id INTEGER PRIMARY KEY,
  name TEXT,
  reputation INTEGER
);
`;

type Emit = { socketId: string; event: string; payload: any };

interface Harness {
  db: any;
  emitted: Emit[];
  auctioned: number[];
  helpers: any;
  game: any;
  insertPlayer: (p: Record<string, any>) => Promise<void>;
  runGet: (sql: string, params?: any[]) => Promise<any>;
}

function makeHarness(
  playersByName: Record<string, any> = {},
  matchweek = 15,
): Harness {
  const db = new sqlite3.Database(":memory:");
  db.exec(SCHEMA);

  const emitted: Emit[] = [];
  const auctioned: number[] = [];

  const runAll = (d: any, sql: string, params: any[] = []) =>
    new Promise<any[]>((resolve, reject) =>
      d.all(sql, params, (err: any, rows: any[]) =>
        err ? reject(err) : resolve(rows),
      ),
    );
  const runGet = (d: any, sql: string, params: any[] = []) =>
    new Promise<any>((resolve, reject) =>
      d.get(sql, params, (err: any, row: any) =>
        err ? reject(err) : resolve(row),
      ),
    );

  const helpers = createContractHelpers({
    io: {
      to: (socketId: string) => ({
        emit: (event: string, payload: any) => {
          emitted.push({ socketId, event, payload });
        },
      }),
    },
    runAll,
    runGet,
    startAuction: (_game: any, player: any, _price: number, cb?: any) => {
      auctioned.push(player.id);
      cb?.();
    },
    getSeasonEndMatchweek,
  });

  const game = {
    db,
    playersByName,
    roomCode: "TEST",
    season: 1,
    matchweek,
    calendarIndex: matchweek - 1,
  };

  const insertPlayer = (p: Record<string, any>) =>
    new Promise<void>((resolve, reject) =>
      db.run(
        `INSERT INTO players (
          id, name, position, skill, wage, value, team_id, transfer_status,
          contract_start_epoch, contract_request_pending, contract_requested_wage
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'none', ?, ?, ?)`,
        [
          p.id,
          p.name ?? `P${p.id}`,
          p.position ?? "DEF",
          p.skill ?? 70,
          p.wage ?? 5000,
          p.value ?? 500000,
          p.team_id ?? 1,
          p.contract_start_epoch ?? 0,
          p.contract_request_pending ?? 0,
          p.contract_requested_wage ?? 0,
        ],
        (err: any) => (err ? reject(err) : resolve()),
      ),
    );

  return {
    db,
    emitted,
    auctioned,
    helpers,
    game,
    insertPlayer,
    runGet: (sql: string, params: any[] = []) => runGet(db, sql, params),
  };
}

const ONLINE = {
  name: "Coach",
  teamId: 1,
  roomCode: "TEST",
  ready: false,
  tactic: { formation: "4-4-2", style: "Balanced" },
  socketId: "s1",
};
const OFFLINE = { ...ONLINE, socketId: null };

// ── T1: humano expirado, sem pedido, treinador online → modal, sem leilão ──
{
  const h = makeHarness({ Coach: ONLINE });
  // contrato start=1 expira em 1+14=15 <= now(15)
  await h.insertPlayer({ id: 1, team_id: 1, contract_start_epoch: 1 });

  await h.helpers.processContractExpiries(h.game, new Set<number>());

  assert(h.auctioned.length === 0, "T1: sem leilão automático");
  const req = h.emitted.find((e) => e.event === "contractRequest");
  assert(!!req && req.payload.playerId === 1, "T1: contractRequest emitido");
  const row = await h.runGet(
    "SELECT contract_request_pending AS p, contract_requested_wage AS w FROM players WHERE id = 1",
  );
  assert(row.p === 1 && row.w > 0, "T1: pedido persistido (pending=1, requested_wage>0)");
}

// ── T2: humano expirado, pedido já pendente → nada de novo, sem leilão ────
{
  const h = makeHarness({ Coach: ONLINE });
  await h.insertPlayer({
    id: 2,
    team_id: 1,
    contract_start_epoch: 1,
    contract_request_pending: 1,
    contract_requested_wage: 6000,
  });

  await h.helpers.processContractExpiries(h.game, new Set<number>());

  assert(h.auctioned.length === 0, "T2: sem leilão automático");
  assert(
    !h.emitted.some((e) => e.event === "contractRequest"),
    "T2: sem novo pedido (já pendente)",
  );
}

// ── T3: humano expirado, treinador OFFLINE → pedido persistido, sem leilão ─
{
  const h = makeHarness({ Coach: OFFLINE });
  await h.insertPlayer({ id: 3, team_id: 1, contract_start_epoch: 1 });

  await h.helpers.processContractExpiries(h.game, new Set<number>());

  assert(h.auctioned.length === 0, "T3: sem leilão para treinador offline");
  assert(
    !h.emitted.some((e) => e.event === "contractRequest"),
    "T3: sem emissão (offline)",
  );
  const row = await h.runGet(
    "SELECT contract_request_pending AS p FROM players WHERE id = 3",
  );
  assert(row.p === 1, "T3: pedido persistido para re-emissão futura");
}

// ── T4: cap — 2 a expirar na mesma semana, mesma equipa → só 1 proposta ───
{
  // matchweek=12: contrato start=1 entra na janela das últimas 3 jornadas
  // (12 <= 1+11 e 12 < 1+14) sem estar expirado (12 < 15).
  const h = makeHarness({ Coach: ONLINE }, 12);
  await h.insertPlayer({ id: 4, team_id: 1, contract_start_epoch: 1 });
  await h.insertPlayer({ id: 5, team_id: 1, contract_start_epoch: 1 });

  await h.helpers.processContractExpiries(h.game, new Set<number>());

  const reqs = h.emitted.filter((e) => e.event === "contractRequest");
  assert(reqs.length === 1, "T4: apenas 1 proposta para o mesmo treinador");
  assert(h.auctioned.length === 0, "T4: sem leilão");
}

// ── T5: cap partilhado — renovação expirada ocupa o slot; renegociação adiada
{
  const origRandom = Math.random;
  Math.random = () => 0;
  try {
    const h = makeHarness({ Coach: ONLINE });
    // A: contrato expirado (start=1 → expira em 15 <= now 15) → renovação
    await h.insertPlayer({ id: 6, team_id: 1, contract_start_epoch: 1, wage: 5000, skill: 70 });
    // B: contrato em vigor (start=15 → expira em 29) + salário ínfimo → candidato
    // a renegociação de agente
    await h.insertPlayer({ id: 7, team_id: 1, contract_start_epoch: 15, wage: 100, skill: 70 });

    const weekly = new Set<number>();
    await h.helpers.processContractExpiries(h.game, weekly);
    await h.helpers.processAgentRenegotiations(h.game, weekly);

    const reqs = h.emitted.filter((e) => e.event === "contractRequest");
    assert(reqs.length === 1, "T5: apenas 1 proposta na semana (renovação + renegociação partilham o orçamento)");
    assert(reqs[0].payload.playerId === 6, "T5: a proposta é a renovação do expirado");
    assert(h.auctioned.length === 0, "T5: sem leilão");
  } finally {
    Math.random = origRandom;
  }
}

// ── T6: resendPendingContractRequests re-emite pendentes (sem consumir cap) ─
{
  const h = makeHarness({ Coach: ONLINE });
  // Renegociação pendente (contrato longe do fim: start=15, now=15)
  await h.insertPlayer({
    id: 8,
    team_id: 1,
    contract_start_epoch: 15,
    contract_request_pending: 1,
    contract_requested_wage: 8000,
    wage: 5000,
  });
  // Renovação pendente (contrato já expirado: start=1)
  await h.insertPlayer({
    id: 9,
    team_id: 1,
    contract_start_epoch: 1,
    contract_request_pending: 1,
    contract_requested_wage: 7000,
    wage: 5000,
  });
  // Pendente de treinador offline — não deve ser emitido
  const h2 = makeHarness({ Coach: OFFLINE });
  await h2.insertPlayer({
    id: 10,
    team_id: 1,
    contract_start_epoch: 15,
    contract_request_pending: 1,
    contract_requested_wage: 9000,
    wage: 5000,
  });

  await h.helpers.resendPendingContractRequests(h.game);
  await h2.helpers.resendPendingContractRequests(h2.game);

  const req8 = h.emitted.find((e) => e.event === "contractRequest" && e.payload.playerId === 8);
  const req9 = h.emitted.find((e) => e.event === "contractRequest" && e.payload.playerId === 9);
  assert(!!req8, "T6: renegociação pendente re-emitida");
  assert(req8.payload.requestedWage === 8000, "T6: requested_wage preservado");
  assert(req8.payload.isRenegotiation === true, "T6: pendente longe do fim → inferida como renegociação");
  assert(!!req9, "T6: renovação pendente re-emitida");
  assert(req9.payload.isRenegotiation === false, "T6: pendente expirada → inferida como renovação");
  assert(
    !h2.emitted.some((e) => e.event === "contractRequest"),
    "T6: sem re-emissão para treinador offline",
  );
  assert(h.auctioned.length === 0 && h2.auctioned.length === 0, "T6: sem leilão");
}

console.log("\n✅ contractRenewalRegression: all checks passed");
