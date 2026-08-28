/**
 * Regression test — contratos: o agente só negoceia APÓS o fim do lock do
 * contrato (jogador desbloqueado para transferência), com atraso aleatório;
 * + limite de 1 proposta de negociação por treinador por semana.
 *
 * Guardas:
 *   1. JNUNCA durante o lock — nem nas "últimas 3 jornadas" (regressão
 *      original): expirados ou não, contrato em vigor = zero pedidos, mesmo
 *      com o RNG a favor.
 *   2. Nunca "logo após o unlock": a própria semana do fim do lock não conta,
 *      nem com o RNG a favor. Depois, atraso aleatório: a semana em que o
 *      rolamento falha não emite; semanas mais tarde pode emitir — sem estado
 *      extra.
 *   3. Jogadores de equipas humanas NUNCA vão a leilão automaticamente no fim
 *      do contrato — ficam pendentes até o treinador decidir no modal.
 *   4. Pedido emitido com treinador offline fica persistido (pending=1).
 *   5. No máximo 1 proposta NOVA por treinador por semana (renovações +
 *      renegociações partilham o mesmo orçamento, pós-lock).
 *   6. Renegociação de subavaliados: só após o lock; persiste com
 *      contract_request_is_renegotiation=1.
 *   7. NPCs mantêm processamento determinístico (renovar/leiloar) sem RNG.
 *   8. Re-emissão de pendentes usa o tipo persistido (não inferência).
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
  contract_request_is_renegotiation INTEGER DEFAULT 0,
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

// now = contractEpoch(season, matchweek) = (season-1)*14 + clamp(mw,1,14).
// Default season=2, mw=1 → now=15: um contrato com start=1 expira em 15 ≤ 15.
function makeHarness(
  playersByName: Record<string, any> = {},
  season = 2,
  matchweek = 1,
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
    season,
    matchweek,
    calendarIndex: 0,
  };

  const insertPlayer = (p: Record<string, any>) =>
    new Promise<void>((resolve, reject) =>
      db.run(
        `INSERT INTO players (
          id, name, position, skill, wage, value, team_id, transfer_status,
          contract_start_epoch, contract_request_pending, contract_requested_wage,
          contract_request_is_renegotiation
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'none', ?, ?, ?, ?)`,
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
          p.contract_request_is_renegotiation ?? 0,
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
    runGet: (sql: string, params?: any[]) => runGet(db, sql, params),
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

// RNG helper — o processo é estocástico; os testes fixam Math.random.
// Uso: const restore = pinRandom(0.05); try { ... } finally { restore(); }
const pinRandom = (value: number) => {
  const orig = Math.random;
  Math.random = () => value;
  return () => {
    Math.random = orig;
  };
};

// ── T1: humano expirado, sem pedido, treinador online → modal, sem leilão ──
{
  const restore = pinRandom(0.05); // rolamento passa (< 0.25)
  try {
    // season 2, mw 2 → now=16: semana seguinte à expiração (15) do start=1
    const h = makeHarness({ Coach: ONLINE }, 2, 2);
    // contrato start=1 expirou em 1+14=15; now=16 passa a janela mínima
    await h.insertPlayer({ id: 1, team_id: 1, contract_start_epoch: 1 });

    await h.helpers.processContractExpiries(h.game, new Set<number>());

    assert(h.auctioned.length === 0, "T1: sem leilão automático");
    const req = h.emitted.find((e) => e.event === "contractRequest");
    assert(!!req && req.payload.playerId === 1, "T1: contractRequest emitido");
    assert(req.payload.isRenegotiation === false, "T1: marcada como renovação");
    const row = await h.runGet(
      "SELECT contract_request_pending AS p, contract_requested_wage AS w, contract_request_is_renegotiation AS r FROM players WHERE id = 1",
    );
    assert(row.p === 1 && row.w > 0 && row.r === 0, "T1: pedido persistido (pending=1, wage>0, renegociação=0)");
  } finally {
    restore();
  }
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
  const restore = pinRandom(0.05);
  try {
    const h = makeHarness({ Coach: OFFLINE }, 2, 2); // now=16
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
  } finally {
    restore();
  }
}

// ── T4: REGRESSÃO — contrato em vigor (mesmo nas últimas 3 jornadas) = ZERO
// pedidos, mesmo com o RNG a favor. Era aqui que o agente "ligava cedo". ────
{
  const restore = pinRandom(0.05);
  try {
    const h = makeHarness({ Coach: ONLINE });
    // start=4 → expira em 18; now=15 está dentro da ANTIGA janela das últimas
    // 3 jornadas (4+11 <= 15 < 4+14) mas o lock continua ativo. Subavaliado
    // de propósito para que a renegociação também tentaria disparar.
    await h.insertPlayer({
      id: 4,
      team_id: 1,
      contract_start_epoch: 4,
      wage: 100,
      skill: 70,
    });

    const weekly = new Set<number>();
    await h.helpers.processContractExpiries(h.game, weekly);
    await h.helpers.processAgentRenegotiations(h.game, weekly);

    assert(
      !h.emitted.some((e) => e.event === "contractRequest"),
      "T4: NENHUM pedido com contrato em vigor (nem nas últimas 3 jornadas)",
    );
    const row = await h.runGet(
      "SELECT contract_request_pending AS p FROM players WHERE id = 4",
    );
    assert(row.p === 0, "T4: nada persistido");
    assert(h.auctioned.length === 0, "T4: sem leilão");
  } finally {
    restore();
  }
}

// ── T5: nunca logo após o unlock + atraso aleatório ───────────────────────
{
  // Expiração em now=15 (season 2, mw 1) → a própria semana não conta.
  let restore = pinRandom(0.05); // rolamento favorável — mesmo assim nada
  try {
    const h = makeHarness({ Coach: ONLINE });
    // Subavaliado de propósito para que a renegociação também fosse
    // candidata — e, mesmo assim, nada na semana do fim do lock.
    await h.insertPlayer({ id: 5, team_id: 1, contract_start_epoch: 1, wage: 100, skill: 70 });

    const weekly = new Set<number>();
    await h.helpers.processContractExpiries(h.game, weekly);
    await h.helpers.processAgentRenegotiations(h.game, weekly);

    assert(
      !h.emitted.some((e) => e.event === "contractRequest"),
      "T5: semana do fim do lock → nenhuma chamada (nem com o RNG a favor)",
    );
    const row0 = await h.runGet(
      "SELECT contract_request_pending AS p FROM players WHERE id = 5",
    );
    assert(row0.p === 0, "T5: sem pedido persistido na semana do fim");

    // Semana seguinte (now=16) com rolamento desfavorável → silêncio.
    restore();
    h.game.matchweek = 2;
    restore = pinRandom(0.99);
    await h.helpers.processContractExpiries(h.game, new Set<number>());
    const row1 = await h.runGet(
      "SELECT contract_request_pending AS p FROM players WHERE id = 5",
    );
    assert(row1.p === 0, "T5: semana que 'falha' no rolamento também não emite");

    // Semana seguinte (now=17) com rolamento favorável → a chamada acontece.
    restore();
    h.game.matchweek = 3;
    restore = pinRandom(0.05);
    await h.helpers.processContractExpiries(h.game, new Set<number>());
    const req = h.emitted.find((e) => e.event === "contractRequest");
    assert(
      !!req && req.payload.playerId === 5,
      "T5: chamada aleatória semanas depois do unlock",
    );
    assert(req.payload.isRenegotiation === false, "T5: chamada de renovação (pós-lock)");
  } finally {
    restore();
  }
}

// ── T6: cap partilhado pós-lock — 2 expirados na mesma equipa → 1 proposta ─
{
  const restore = pinRandom(0.05);
  try {
    const h = makeHarness({ Coach: ONLINE }, 2, 2); // now=16 (pós-janela mínima)
    await h.insertPlayer({ id: 6, team_id: 1, contract_start_epoch: 1 });
    // B: expirado E subavaliado — candidato tanto a renovação como à
    // renegociação; o orçamento garante que só há 1 proposta na semana.
    await h.insertPlayer({ id: 7, team_id: 1, contract_start_epoch: 1, wage: 100, skill: 70 });

    const weekly = new Set<number>();
    await h.helpers.processContractExpiries(h.game, weekly);
    await h.helpers.processAgentRenegotiations(h.game, weekly);

    const reqs = h.emitted.filter((e) => e.event === "contractRequest");
    assert(reqs.length === 1, "T6: apenas 1 proposta na semana (renovação + renegociação partilham o orçamento)");
    assert(h.auctioned.length === 0, "T6: sem leilão");
  } finally {
    restore();
  }
}

// ── T7: renegociação pós-lock de subavaliado → pedido com flag renegociação
{
  const restore = pinRandom(0.05); // passa o gate de 12% (0.05 <= 0.12)
  try {
    const h = makeHarness({ Coach: ONLINE }, 2, 2); // now=16 (pós-janela mínima)
    // Expired + subavaliado → candidato a renegociação (slot livre).
    await h.insertPlayer({ id: 8, team_id: 1, contract_start_epoch: 1, wage: 100, skill: 70 });

    const weekly = new Set<number>();
    await h.helpers.processAgentRenegotiations(h.game, weekly);

    const req = h.emitted.find((e) => e.event === "contractRequest");
    assert(!!req && req.payload.playerId === 8, "T7: renegociação pós-lock emitida");
    assert(req.payload.isRenegotiation === true, "T7: marcada como renegociação");
    const row = await h.runGet(
      "SELECT contract_request_pending AS p, contract_request_is_renegotiation AS r FROM players WHERE id = 8",
    );
    assert(row.p === 1 && row.r === 1, "T7: pendente persistido como renegociação");
    assert(h.auctioned.length === 0, "T7: sem leilão");
  } finally {
    restore();
  }
}

// ── T8: NPC — processamento determinístico (leilão) mesmo com RNG a falhar ─
{
  const restore = pinRandom(0.99); // prova que o caminho NPC não depende do rolamento
  try {
    const h = makeHarness({}); // sem sessões → team_id=2 é NPC
    await h.insertPlayer({ id: 9, team_id: 2, contract_start_epoch: 1 });
    // Segundo jogador expirado na mesma equipa NPC: o shuffle dos candidatos
    // fica exercitado e ambos devem ser processados de forma determinística.
    await h.insertPlayer({ id: 10, team_id: 2, contract_start_epoch: 1 });

    await h.helpers.processContractExpiries(h.game, new Set<number>());

    assert(
      [...h.auctioned].sort((a, b) => a - b).join(",") === "9,10",
      "T8: NPCs expirados vão a leilão no posto (ambos, sem depender do RNG)",
    );
    const row = await h.runGet(
      "SELECT COUNT(*) AS c FROM players WHERE id IN (9, 10) AND contract_request_pending != 0",
    );
    assert(row.c === 0, "T8: estado de pedido limpo nos dois jogadores");
  } finally {
    restore();
  }
}

// ── T9: re-emissão usa o tipo persistido (não inferência por proximidade) ──
{
  const h = makeHarness({ Coach: ONLINE });
  // Renegociação pendente (pós-lock, como agora é sempre)
  await h.insertPlayer({
    id: 10,
    team_id: 1,
    contract_start_epoch: 1,
    contract_request_pending: 1,
    contract_requested_wage: 8000,
    contract_request_is_renegotiation: 1,
    wage: 5000,
  });
  // Renovação pendente (pós-lock)
  await h.insertPlayer({
    id: 11,
    team_id: 1,
    contract_start_epoch: 1,
    contract_request_pending: 1,
    contract_requested_wage: 7000,
    contract_request_is_renegotiation: 0,
    wage: 5000,
  });
  // Pendente de treinador offline — não deve ser emitido
  const h2 = makeHarness({ Coach: OFFLINE });
  await h2.insertPlayer({
    id: 12,
    team_id: 1,
    contract_start_epoch: 1,
    contract_request_pending: 1,
    contract_requested_wage: 9000,
    wage: 5000,
  });

  await h.helpers.resendPendingContractRequests(h.game);
  await h2.helpers.resendPendingContractRequests(h2.game);

  const req10 = h.emitted.find((e) => e.event === "contractRequest" && e.payload.playerId === 10);
  const req11 = h.emitted.find((e) => e.event === "contractRequest" && e.payload.playerId === 11);
  assert(!!req10, "T9: renegociação pendente re-emitida");
  assert(req10.payload.requestedWage === 8000, "T9: requested_wage preservado");
  assert(req10.payload.isRenegotiation === true, "T9: tipo persistido (renegociação) respeitado na re-emissão");
  assert(!!req11, "T9: renovação pendente re-emitida");
  assert(req11.payload.isRenegotiation === false, "T9: tipo persistido (renovação) respeitado na re-emissão");
  assert(
    !h2.emitted.some((e) => e.event === "contractRequest"),
    "T9: sem re-emissão para treinador offline",
  );
  assert(h.auctioned.length === 0 && h2.auctioned.length === 0, "T9: sem leilão");
}

console.log("\n✅ contractRenewalRegression: all checks passed");
