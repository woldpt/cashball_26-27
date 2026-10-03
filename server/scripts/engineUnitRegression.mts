/**
 * Unit — engine de jogo (funções puras, sem DB nem sockets).
 *
 * Corre com node:test sob tsx — sem época simulada, sem sqlite:
 *
 *   U1 — normalizeMatchChoice: número, {playerOut,playerIn}, {playerId}, null
 *   U2 — generateFixturesForDivision: circle method — cada jornada cada equipa
 *        joga 1×, cada par defronta-se 2× (casa/fora trocados), sem auto-jogos
 *   U3 — simulatePenaltyShootout: termina sempre com vencedor, chutes
 *        estritamente alternados casa/fora, determinismo com seed
 *   U4 — computeSidePower: DEFENSIVO defende mais, OFENSIVO ataca mais
 *   U4b — crowdFactorForOccupancy + computeSidePower(…, crowd): vulcão/morgue/neutro
 *   U5 — sanidade do fix da dupla contagem do estilo: a mesma força ofensiva
 *        tem MENOR probabilidade de golo contra defesa DEFENSIVA do que
 *        contra defesa OFENSIVA (antes era ao contrário)
 *   U6 — pickShootoutTaker: ordem por skill, sem repetir; ao esgotar,
 *        reinicia a volta mas marca o escolhido (sem repetições seguidas)
 *   U7 — pending actions: várias janelas coexistem por actionId; take é
 *        idempotente; list filtra por equipa
 *   U8 — queueMatchDeltaWrites: deltas retidos até os writes confirmarem;
 *        segundo enqueue enquanto decorre é ignorado
 *   U9 — isCupFinalRound: só a ronda 5 é final
 *   U10 — createMinuteBarrier: N fixtures avançam em lockstep (um tick por
 *        minuto); abort liberta quem espera
 *   U11 — adoptLiveTactic: setTactic a meio do jogo adota formação/estilo
 *        (bump de power), funde labels mas impõe a verdade de jogo
 *        (XI=Titular, indisponíveis removidos); sem coach ou sem mudança → null
 *   U11d — estilo muda sem formação: anuncia a formação vigente, nunca null
 *   U12 — queueMatchDeltaWrites: throw síncrono repõe a flag (deltas retidos);
 *        erro no callback é reportado mas o flush completa
 *   U13 — quotaFromFormation deriva o XI da tática (fallback 4-4-2)
 *   U14 — queueMatchDeltaWrites (amarelos FIFA): acumula sem castigo, o 3º
 *        acumulado castiga 1 jogo e zera a contagem, o vermelho corre
 *        depois e limpa-a; MAX/CASE preservam o castigo mais longo
 *   U15 — resolveOpenPlayGoal: mesma seed → mesmos eventos lógicos + flag
 *   U16 — resolveNearMiss com golo no minuto → zero eventos
 *   U17 — amigável: gates bloqueiam cartões/lesões em 90 min × 3 seeds
 *   U18 — processMatchMinute determinístico (ordem RNG estável)
 *
 * Run: cd server && npm run test:engine-unit
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  resolveOpenPlayGoal,
  resolveNearMiss,
  resolveCards,
  resolveInjuries,
  processMatchMinute,
  normalizeMatchChoice,
  generateFixturesForDivision,
  simulatePenaltyShootout,
  pickShootoutTaker,
  getPendingMatchActions,
  peekPendingMatchAction,
  takePendingMatchAction,
  listTeamMatchActions,
  queueMatchDeltaWrites,
  createMinuteBarrier,
  adoptLiveTactic,
  getPowerVersion,
} = require("../game/engine.ts");
const {
  computeSidePower,
  crowdFactorForOccupancy,
  computeOpenPlayGoalProbability,
  createSeededRng,
  isCupFinalRound,
} = require("../game/matchCalculations.ts");

// ── U1 ──────────────────────────────────────────────────────────────────────
test("U1 — normalizeMatchChoice cobre as formas do contrato", () => {
  assert.deepEqual(normalizeMatchChoice(9), { playerOut: null, playerIn: 9 });
  assert.deepEqual(normalizeMatchChoice({ playerOut: 3, playerIn: 7 }), {
    playerOut: 3,
    playerIn: 7,
  });
  assert.deepEqual(normalizeMatchChoice({ playerId: 11 }), {
    playerOut: null,
    playerIn: 11,
  });
  assert.deepEqual(normalizeMatchChoice(null), {
    playerOut: null,
    playerIn: null,
  });
  assert.deepEqual(normalizeMatchChoice(undefined), {
    playerOut: null,
    playerIn: null,
  });
});

// ── U2 ──────────────────────────────────────────────────────────────────────
test("U2 — circle method: 6 equipas, 10 jornadas, equilíbrio casa/fora", async () => {
  const seeds = [1, 2, 3, 4, 5, 6];
  const pairCount = new Map<string, { homeFirst: number; homeSecond: number }>();
  for (let mw = 1; mw <= 10; mw++) {
    const fixtures = await generateFixturesForDivision(null, 1, mw, seeds);
    assert.equal(fixtures.length, 3);
    const seen = new Set<number>();
    for (const f of fixtures) {
      assert.notEqual(f.homeTeamId, f.awayTeamId, `auto-jogo na jornada ${mw}`);
      assert.ok(!seen.has(f.homeTeamId), `equipa repetida na jornada ${mw}`);
      assert.ok(!seen.has(f.awayTeamId), `equipa repetida na jornada ${mw}`);
      seen.add(f.homeTeamId);
      seen.add(f.awayTeamId);
      const key = [Math.min(f.homeTeamId, f.awayTeamId), Math.max(f.homeTeamId, f.awayTeamId)].join("-");
      const entry = pairCount.get(key) ?? { homeFirst: 0, homeSecond: 0 };
      if (f.homeTeamId < f.awayTeamId) entry.homeFirst++;
      else entry.homeSecond++;
      pairCount.set(key, entry);
    }
    assert.equal(seen.size, 6);
  }
  // 15 pares × 2 voltas, com casa/fora trocados
  assert.equal(pairCount.size, 15);
  for (const [key, entry] of pairCount) {
    assert.deepEqual(entry, { homeFirst: 1, homeSecond: 1 }, `par ${key}`);
  }
});

// ── helpers U3–U5 ───────────────────────────────────────────────────────────
function makeSquad(skill: number, tag: string) {
  const positions = ["GR", "DEF", "DEF", "DEF", "DEF", "MED", "MED", "MED", "MED", "ATA", "ATA"];
  return positions.map((position, i) => ({
    id: 1000 + i + (tag === "away" ? 100 : 0),
    name: `${tag}-${position}-${i}`,
    position,
    skill,
  }));
}

// ── U3 ──────────────────────────────────────────────────────────────────────
test("U3 — shootout alternado, decidido e determinístico", () => {
  const home = makeSquad(30, "home");
  const away = makeSquad(30, "away");
  let sawSuddenDeath = false;
  for (let seed = 1; seed <= 200; seed++) {
    const rng = createSeededRng(seed);
    const { homeGoals, awayGoals, kicks } = simulatePenaltyShootout(home, away, rng);
    assert.notEqual(homeGoals, awayGoals, `shootout sem vencedor (seed ${seed})`);
    // Alternância estrita casa/fora a partir da casa
    kicks.forEach((k: any, i: number) => {
      assert.equal(k.team, i % 2 === 0 ? "home" : "away", `ordem quebrada (seed ${seed}, chute ${i})`);
    });
    const regulation = kicks.filter((k: any) => !k.suddenDeath);
    assert.ok(regulation.length <= 10, `mais de 10 chutes regulamentares (seed ${seed})`);
    if (kicks.some((k: any) => k.suddenDeath)) {
      sawSuddenDeath = true;
      // Na morte súbita, nº par de chutes com decisão no par
      assert.equal(kicks.length % 2, 0);
    }
  }
  assert.ok(sawSuddenDeath, "200 seeds sem nenhuma morte súbita — suspeito");
  // Determinismo: mesma seed, mesmo resultado
  const a = simulatePenaltyShootout(home, away, createSeededRng(42));
  const b = simulatePenaltyShootout(home, away, createSeededRng(42));
  assert.deepEqual(a, b);
});

// ── U4 ──────────────────────────────────────────────────────────────────────
test("U4 — estilo: DEFENSIVO defende mais, OFENSIVO ataca mais", () => {
  const squad = makeSquad(30, "x");
  const def = computeSidePower(squad, { formation: "4-4-2", style: "DEFENSIVO" }, 50, 0);
  const eql = computeSidePower(squad, { formation: "4-4-2", style: "EQUILIBRADO" }, 50, 0);
  const atk = computeSidePower(squad, { formation: "4-4-2", style: "OFENSIVO" }, 50, 0);
  assert.ok(def.defense > eql.defense && eql.defense > atk.defense, "defesa devia ordenar DEF > EQL > OFE");
  assert.ok(atk.attack > eql.attack && eql.attack > def.attack, "ataque devia ordenar OFE > EQL > DEF");
});

// ── U4b ─────────────────────────────────────────────────────────────────────
test("U4b — ambiente: vulcão empurra, morgue encolhe, neutro não mexe", () => {
  const squad = makeSquad(30, "x");
  const tactic = { formation: "4-4-2", style: "EQUILIBRADO" };
  const neutral = computeSidePower(squad, tactic, 50, 0);
  const volcano = computeSidePower(squad, tactic, 50, 0, crowdFactorForOccupancy(0.95));
  const morgue = computeSidePower(squad, tactic, 50, 0, crowdFactorForOccupancy(0.3));
  const unknown = computeSidePower(squad, tactic, 50, 0, crowdFactorForOccupancy(null));
  assert.equal(crowdFactorForOccupancy(null), 1, "sem ocupação → neutro");
  assert.equal(crowdFactorForOccupancy(0.7), 1, "meio-termo → neutro");
  assert.ok(volcano.attack > neutral.attack, "vulcão ataca mais");
  assert.ok(volcano.defense > neutral.defense, "vulcão defende ligeiramente melhor");
  assert.ok(morgue.attack < neutral.attack, "morgue ataca menos");
  assert.deepEqual(unknown, neutral, "ocupação desconhecida não altera nada");
});

// ── U5 ──────────────────────────────────────────────────────────────────────
test("U5 — defensivas sofrem menos (fix dupla contagem do estilo)", () => {
  const squad = makeSquad(30, "x");
  const attack = computeSidePower(squad, { formation: "4-4-2", style: "EQUILIBRADO" }, 50, 0).attack;
  const defDefense = computeSidePower(squad, { formation: "5-3-2", style: "DEFENSIVO" }, 50, 0).defense;
  const atkDefense = computeSidePower(squad, { formation: "4-2-4", style: "OFENSIVO" }, 50, 0).defense;
  const base = { attack, minute: 30, isHome: true, isFinal: false, possessionFactor: 1, egoFactor: 1 };
  const pVsDef = computeOpenPlayGoalProbability({ ...base, defense: defDefense });
  const pVsAtk = computeOpenPlayGoalProbability({ ...base, defense: atkDefense });
  assert.ok(pVsDef < pVsAtk, `defensiva (${pVsDef}) devia sofrer menos que ofensiva (${pVsAtk})`);
});

// ── U6 ──────────────────────────────────────────────────────────────────────
test("U6 — pickShootoutTaker roda por skill sem repetições seguidas", () => {
  const squad = [
    { id: 1, name: "fraco", skill: 10 },
    { id: 2, name: "craque", skill: 40 },
    { id: 3, name: "médio", skill: 25 },
  ];
  const used = new Set();
  const picks = [];
  for (let i = 0; i < 6; i++) picks.push(pickShootoutTaker(squad, used).id);
  // Duas voltas completas por ordem de skill, sem ninguém repetir em sequência
  assert.deepEqual(picks, [2, 3, 1, 2, 3, 1]);
});

// ── U7 ──────────────────────────────────────────────────────────────────────
test("U7 — pending actions coexistem por actionId", () => {
  const game = {};
  const map = getPendingMatchActions(game);
  assert.ok(map instanceof Map && map.size === 0);
  // get cria on-demand e devolve sempre o mesmo mapa
  assert.equal(getPendingMatchActions(game), map);
  map.set("a1", { actionId: "a1", type: "penalty", teamId: 7, timer: undefined });
  map.set("a2", { actionId: "a2", type: "user_substitution", teamId: 9, timer: undefined });
  // peek não consome; take consome e é idempotente
  assert.equal(peekPendingMatchAction(game, "a1").teamId, 7);
  assert.equal(map.size, 2);
  assert.equal(takePendingMatchAction(game, "a1").actionId, "a1");
  assert.equal(takePendingMatchAction(game, "a1"), undefined);
  assert.equal(map.size, 1);
  // list filtra por equipa
  assert.deepEqual(listTeamMatchActions(game, 9).map((a) => a.actionId), ["a2"]);
  assert.deepEqual(listTeamMatchActions(game, 7), []);
  // jogo sem mapa não rebenta
  assert.equal(takePendingMatchAction({}, "x"), undefined);
  assert.deepEqual(listTeamMatchActions({}, 1), []);
});

// ── U8 ──────────────────────────────────────────────────────────────────────
test("U8 — queueMatchDeltaWrites retém deltas até confirmar", async () => {
  const calls = [];
  const callbacks = [];
  const db = {
    run: (sql, params, cb) => {
      calls.push(sql.split(" ").slice(0, 2).join(" "));
      callbacks.push(cb);
    },
  };
  const fixture = {
    _deltas: {
      calendarIndex: 3,
      appearances: new Set([11, 22]),
      goals: new Map([[11, 2]]),
      goalsByTeam: new Map(),
      reds: new Map(),
      yellows: new Map(),
      injuries: new Map(),
    },
  };
  queueMatchDeltaWrites(db, [fixture]);
  assert.equal(calls.length, 2); // appearances + goals
  // Writes emitidos mas ainda sem callback: deltas RETIDOS
  assert.ok(fixture._deltas, "deltas limpos antes dos writes confirmarem");
  // Segundo enqueue enquanto decorre: ignorado (sem writes novos)
  queueMatchDeltaWrites(db, [fixture]);
  assert.equal(calls.length, 2);
  // Confirmar todos → liberta
  while (callbacks.length > 0) callbacks.shift()();
  await new Promise((r) => setImmediate(r));
  assert.equal(fixture._deltas, undefined);
  assert.equal(fixture._deltasQueued, false);
});

// ── U9 ──────────────────────────────────────────────────────────────────────
test("U9 — isCupFinalRound: só a ronda 5", () => {
  assert.equal(isCupFinalRound(5), true);
  assert.equal(isCupFinalRound(4), false);
  assert.equal(isCupFinalRound(undefined), false);
});

// ── U10 ─────────────────────────────────────────────────────────────────────
test("U10 — createMinuteBarrier sincroniza N fixtures por minuto", async () => {
  const ticks = [];
  const barrier = createMinuteBarrier(3, async (m) => {
    ticks.push(m);
  });
  const seen = [];
  await Promise.all(
    [0, 1, 2].map(async (fi) => {
      for (const m of [1, 2, 3]) {
        seen.push(`f${fi}m${m}`);
        await barrier.wait(m);
      }
    }),
  );
  // Um tick por minuto, por ordem; toda a gente simulou os 3 minutos
  assert.deepEqual(ticks, [1, 2, 3]);
  assert.equal(seen.length, 9);
});

test("U10b — abort liberta quem espera e desliga a barreira", async () => {
  const barrier = createMinuteBarrier(2, async () => {});
  let released = false;
  const p = barrier.wait(1).then(() => {
    released = true;
  });
  await new Promise((r) => setImmediate(r));
  assert.equal(released, false);
  barrier.abort();
  await p;
  assert.equal(released, true);
  await barrier.wait(2); // pós-abort resolve de imediato
});

// ── U11 ─────────────────────────────────────────────────────────────────────
function mkTacticGame(tactic: any, teamId = 1) {
  return { playersByName: { Coach: { teamId, tactic } } };
}

test("U11 — adoptLiveTactic adota formação+mentalidade e impõe verdade de jogo", () => {
  const v1 = {
    formation: "4-4-2",
    style: "Equilibrado",
    positions: { 11: "Titular", 12: "Titular" },
  };
  const fixture: any = {
    homeTeamId: 1,
    awayTeamId: 2,
    events: [{ type: "injury", team: "home", playerId: 50 }],
    _t1: v1,
    _subbedOut: new Set([99]),
  };
  // setTactic substitui o objeto (labels do cliente vêm obsoletas: 11 ainda em
  // campo marcado Suplente, 50 lesionado ainda Titular, 99 já substituído)
  const game = mkTacticGame({
    formation: "3-5-2",
    style: "Ofensivo",
    positions: { 11: "Suplente", 50: "Titular", 99: "Suplente" },
  });
  const before = getPowerVersion(fixture, "home");
  const change = adoptLiveTactic(game, fixture, "home", v1, new Set([11, 12]));
  assert.deepEqual(change, { formation: "3-5-2", style: "OFENSIVO" });
  assert.equal(v1.formation, "3-5-2");
  assert.equal(v1.style, "Ofensivo");
  assert.equal(getPowerVersion(fixture, "home"), before + 1);
  // Verdade de jogo: XI é Titular; lesionado e substituído saem dos labels
  assert.equal(v1.positions[11], "Titular");
  assert.equal(v1.positions[12], "Titular");
  assert.ok(!("50" in v1.positions), "lesionado removido dos labels");
  assert.ok(!("99" in v1.positions), "substituído removido dos labels");
});

test("U11b — só mentalidade também conta como mudança tática", () => {
  const v1 = { formation: "4-4-2", style: "Equilibrado", positions: {} };
  const fixture: any = { homeTeamId: 1, awayTeamId: 2, events: [], _t1: v1 };
  const game = mkTacticGame({ formation: "4-4-2", style: "Defensivo" });
  const before = getPowerVersion(fixture, "home");
  const change = adoptLiveTactic(game, fixture, "home", v1, new Set());
  assert.deepEqual(change, { formation: "4-4-2", style: "DEFENSIVO" });
  assert.equal(getPowerVersion(fixture, "home"), before + 1);
});

test("U11c — sem mudança (mesma ref) ou sem coach → null, sem bump", () => {
  const v1 = { formation: "4-4-2", style: "Equilibrado", positions: {} };
  const fixture: any = { homeTeamId: 1, awayTeamId: 2, events: [], _t1: v1 };
  const before = getPowerVersion(fixture, "home");
  // mesma referência: setTactic não aconteceu
  assert.equal(
    adoptLiveTactic(mkTacticGame(v1), fixture, "home", v1, new Set()),
    null,
  );
  // equipa NPC (sem coach)
  assert.equal(
    adoptLiveTactic({ playersByName: {} }, fixture, "home", v1, new Set()),
    null,
  );
  assert.equal(getPowerVersion(fixture, "home"), before);
});

test("U11d — estilo muda sem formação: anuncia a formação vigente, nunca null", () => {
  const v1 = { formation: "4-4-2", style: "Equilibrado", positions: {} };
  const fixture: any = { homeTeamId: 1, awayTeamId: 2, events: [], _t1: v1 };
  const game = mkTacticGame({ style: "Defensivo" });
  const change = adoptLiveTactic(game, fixture, "home", v1, new Set());
  assert.deepEqual(change, { formation: "4-4-2", style: "DEFENSIVO" });
});

test("U12 — queueMatchDeltaWrites: throw síncrono repõe a flag, deltas retidos", () => {
  const throwingDb = {
    run() {
      throw new Error("db fechada");
    },
  };
  const fixture: any = {
    _deltas: {
      calendarIndex: 3,
      appearances: new Set([1]),
      goals: new Map([[7, 2]]),
      goalsByTeam: new Map(),
      reds: new Map(),
      yellows: new Map(),
      injuries: new Map(),
    },
  };
  queueMatchDeltaWrites(throwingDb as any, [fixture]);
  assert.equal(fixture._deltasQueued, false);
  assert.ok(fixture._deltas, "deltas retidos para retry");
});

test("U12b — erro no callback do sqlite é reportado mas o flush completa", () => {
  const cbs: Array<(err: unknown) => void> = [];
  const errDb = {
    run(_sql: string, _params: unknown[], cb: (err: unknown) => void) {
      cbs.push(cb);
    },
  };
  const fixture: any = {
    _deltas: {
      calendarIndex: 3,
      appearances: new Set(),
      goals: new Map([[7, 1]]),
      goalsByTeam: new Map(),
      reds: new Map(),
      yellows: new Map(),
      injuries: new Map(),
    },
  };
  queueMatchDeltaWrites(errDb as any, [fixture]);
  assert.ok(cbs.length > 0);
  for (const cb of cbs) cb(new Error("boom"));
  assert.equal(fixture._deltas, undefined);
  assert.equal(fixture._deltasQueued, false);
});

test("U12c — golos por clube: o flush atribui o golo ao clube do jogador", () => {
  // A atribuição (`player_season_goals`) é o que decide o prémio de Melhor
  // Marcador: sem ela, vender o goleador na última jornada dava-lhe o troféu.
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const cbs: Array<(err: unknown) => void> = [];
  const db = {
    run(sql: string, params: unknown[], cb: (err: unknown) => void) {
      calls.push({ sql: sql.replace(/\s+/g, " "), params });
      cbs.push(cb);
    },
  };
  const fixture: any = {
    _deltas: {
      calendarIndex: 4,
      appearances: new Set(),
      goals: new Map([[7, 2]]),
      goalsByTeam: new Map([[2, new Map([[7, 2]])]]),
      reds: new Map(),
      yellows: new Map(),
      injuries: new Map(),
    },
  };
  queueMatchDeltaWrites(db as any, [fixture]);
  const attr = calls.find((c) => c.sql.includes("player_season_goals"));
  assert.ok(attr, "flush escreve a atribuição por clube");
  assert.match(attr!.sql, /ON CONFLICT\(player_id, team_id\) DO UPDATE SET goals = goals \+ excluded.goals/);
  assert.deepEqual(attr!.params, [7, 2, 2]);
  for (const cb of cbs) cb(null);
  assert.equal(fixture._deltas, undefined);
});

test("U13 — quotaFromFormation deriva o XI da tática (fallback 4-4-2)", () => {
  const { quotaFromFormation } = require("../game/matchCalculations.ts");
  assert.deepEqual(quotaFromFormation("3-5-2"), {
    GR: 1,
    DEF: 3,
    MED: 5,
    ATA: 2,
  });
  assert.deepEqual(quotaFromFormation("5-4-1"), {
    GR: 1,
    DEF: 5,
    MED: 4,
    ATA: 1,
  });
  assert.deepEqual(quotaFromFormation("4-4-2"), {
    GR: 1,
    DEF: 4,
    MED: 4,
    ATA: 2,
  });
  assert.deepEqual(quotaFromFormation(null), {
    GR: 1,
    DEF: 4,
    MED: 4,
    ATA: 2,
  });
  assert.deepEqual(quotaFromFormation("4-4-3"), {
    GR: 1,
    DEF: 4,
    MED: 4,
    ATA: 2,
  });
  assert.deepEqual(quotaFromFormation("bananas"), {
    GR: 1,
    DEF: 4,
    MED: 4,
    ATA: 2,
  });
});

// ── U14 ──────────────────────────────────────────────────────────────────
test("U14 — amarelos FIFA: 3º acumulado castiga 1 jogo; vermelho limpa a contagem", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const cbs: Array<(err: unknown) => void> = [];
  const db = {
    run(sql: string, params: unknown[], cb: (err: unknown) => void) {
      calls.push({ sql: sql.replace(/\s+/g, " "), params });
      cbs.push(cb);
    },
  };
  const fixture: any = {
    _deltas: {
      calendarIndex: 5,
      appearances: new Set(),
      goals: new Map(),
      goalsByTeam: new Map(),
      // 77 apanhou 3º amarelo (castigo até à slot 6) E vermelho no mesmo jogo
      // (até à 8): o vermelho corre depois, limpa a contagem e o CASE fica
      // com o castigo mais longo (8).
      reds: new Map([[77, 8]]),
      yellows: new Map([
        [11, { count: 1, banUntil: null }], // 1º/2º amarelo: só acumula
        [77, { count: 1, banUntil: 6 }], // 3º amarelo: castigo de 1 jogo
      ]),
      injuries: new Map(),
    },
  };
  queueMatchDeltaWrites(db as any, [fixture]);
  // Acumulação sem castigo: incremento simples, sem tocar em suspensões
  assert.match(calls[0].sql, /yellow_cards = yellow_cards \+ \?/);
  assert.ok(!calls[0].sql.includes("suspension"), "sem castigo ao acumular");
  assert.deepEqual(calls[0].params, [1, 11]);
  // 3º amarelo: contagem zera, +1 jogo de castigo, MAX preserva o mais longo
  assert.match(
    calls[1].sql,
    /yellow_cards = 0, suspension_games = suspension_games \+ 1, suspension_until_matchweek = MAX\(suspension_until_matchweek, \?\)/,
  );
  assert.deepEqual(calls[1].params, [6, 77]);
  // Vermelho DEPOIS do amarelo do mesmo jogador: limpa a contagem
  assert.ok(calls[2].sql.includes("yellow_cards = 0"), "vermelho limpa amarelos");
  assert.match(calls[2].sql, /red_cards = red_cards \+ 1, career_reds = career_reds \+ 1, yellow_cards = 0, suspension_games = suspension_games \+ 2/);
  assert.deepEqual(calls[2].params, [8, 8, 77]);
  for (const cb of cbs) cb(null);
  await new Promise((r) => setImmediate(r));
  assert.equal(fixture._deltas, undefined);
});

// ── U15–U18: passos do minuto (partição F9) ────────────────────────────────
// Tick mínimo NPC-only (sem humanos → fallbacks imediatos, sem janelas).
function minuteTick(seed, over = {}) {
  const mk = (id, pos, skill) => ({
    id, name: "J" + id, position: pos, skill, form: 32, morale: 25,
    aggressiveness: 30, resistance: 26, is_star: 0,
  });
  const squadOf = (base) => [
    mk(base + 1, "GR", 30), mk(base + 2, "DEF", 28), mk(base + 3, "DEF", 27),
    mk(base + 4, "MED", 30), mk(base + 5, "MED", 29), mk(base + 6, "ATA", 32),
    mk(base + 7, "ATA", 28), mk(base + 8, "DEF", 26), mk(base + 9, "MED", 27),
    mk(base + 10, "ATA", 29), mk(base + 11, "DEF", 25),
  ];
  const homeSquad = squadOf(0);
  const awaySquad = squadOf(100);
  const tactic = { formation: "4-4-2", style: "EQUILIBRADO", positions: {} };
  const powers = {
    home: computeSidePower(homeSquad, tactic, 25, 0, 1),
    away: computeSidePower(awaySquad, tactic, 25, 0, 1),
  };
  const ids = (s) => new Set(s.map((p) => p.id));
  const fixture = {
    homeTeamId: 1, awayTeamId: 2,
    homeTeam: { name: "Casa" }, awayTeam: { name: "Fora" },
    finalHomeGoals: 0, finalAwayGoals: 0, events: [],
    season: 1, matchweek: 1, round: 1,
    _homeChances: 15, _awayChances: 15, _yellowCards: {},
    ...(over.fixture || {}),
  };
  const game = {
    roomCode: "U", playersByName: {}, pendingSubstitutions: new Map(),
    currentEvent: { type: "league", ...((over.event) || {}) },
  };
  const io = { to: () => ({ emit: () => {} }) };
  const tick = {
    fixture, game, io, minute: over.minute ?? 10,
    homeTactic: tactic, awayTactic: tactic, homeSquad, awaySquad,
    homeFullRoster: [...homeSquad], awayFullRoster: [...awaySquad],
    homeLineupIds: ids(homeSquad), awayLineupIds: ids(awaySquad),
    currentMatchweek: 1, rng: createSeededRng(seed),
    fam: { home: 0, away: 0 }, powers,
    refreshPower: (s) => powers[s],
  };
  const shared = {
    currentHome: powers.home, currentAway: powers.away, goalScored: false,
    isCupExtraTime: false, isFriendly: false, isLastLeagueMinute: false,
    ...(over.shared || {}),
  };
  return { tick, shared, fixture };
}
// Lógica do evento (o texto varia com Math.random não-seeded, por desenho).
const logicOf = (events) => events.map((e) => [e.minute, e.type, e.team, e.playerName]);

test("U15 — resolveOpenPlayGoal determinístico com seed", () => {
  const run = () => {
    const { tick, shared, fixture } = minuteTick(7);
    resolveOpenPlayGoal(tick, shared, "home");
    resolveOpenPlayGoal(tick, shared, "away");
    return { events: logicOf(fixture.events), scored: shared.goalScored };
  };
  assert.deepEqual(run(), run());
});

test("U16 — resolveNearMiss nunca com golo no minuto", () => {
  // Seed 7 dispara o roll à primeira (sem flag dá ≥1 evento) — o gate é exercido.
  const { tick, shared, fixture } = minuteTick(7);
  shared.goalScored = true;
  resolveNearMiss(tick, shared);
  assert.equal(fixture.events.length, 0);
});

test("U17 — amigável: zero cartões e zero lesões em 90 minutos", async () => {
  for (const seed of [1, 2, 3]) {
    const { tick, shared, fixture } = minuteTick(seed, { shared: { isFriendly: true } });
    for (let m = 1; m <= 90; m++) {
      tick.minute = m;
      await resolveCards(tick, shared);
      await resolveInjuries(tick, shared);
    }
    const bad = fixture.events.filter((e) =>
      ["red", "yellow", "injury"].includes(e.type),
    );
    assert.equal(bad.length, 0, `seed ${seed}: ${JSON.stringify(logicOf(bad))}`);
  }
});

test("U18 — processMatchMinute determinístico (ordem RNG estável)", async () => {
  const run = async () => {
    const { tick, fixture } = minuteTick(99, { minute: 30 });
    await processMatchMinute(tick);
    return { events: logicOf(fixture.events), goals: [fixture.finalHomeGoals, fixture.finalAwayGoals] };
  };
  assert.deepEqual(await run(), await run());
});
