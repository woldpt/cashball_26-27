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
 *   U19 — médico (funcionário): corta a probabilidade de lesão, encurta as
 *        semanas e poupa skill nas lesões graves (rng constante: resistência 1)
 *   U21 — formação de facto: conta-se no onze em campo, não na declarada
 *   U22 — com 10: defesa mais curta e menos oportunidades
 *   U23 — penálti: lado pelo domínio, GR nunca é o batedor automático, xG
 *   U24 — cartões: o mais agressivo leva mais, o GR raramente
 *   U25 — lesão: o cansado lesiona-se mais, e é o mesmo do teste de resistência
 *   U26 — golo possível no minuto a seguir a um golo; lances com xG
 *   U27 — posse recalculada: estilo, jogador a menos e ímpeto mexem nela
 *   U28 — NPC muda de estilo pelo resultado; equipa humana nunca é tocada
 *   U29 — NPC troca o cansado (avançado se perde), guarda troca p/ lesões,
 *        não troca para pior
 *   U30 — duelo de formações: médios a mais dão posse; avançados contra a
 *        sobra de defesas mexem na finalização
 *   U31 — pressão alta: mais posse e cartões, defesa mais exposta, cansa mais
 *   U32 — conversa ao intervalo: certa sobe a moral, errada desce; uma vez
 *   U33 — ordens do treinador: aplicadas ao minuto e resultado certos, só
 *        a equipas humanas, com evento para o cliente alinhar
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
  applyMinuteFatigue,
} = require("../game/engine.ts");
const {
  computeSidePower,
  crowdFactorForOccupancy,
  computeOpenPlayGoalProbability,
  createSeededRng,
  isCupFinalRound,
  effectiveFormation,
  shortHandedChanceMult,
  selectPenaltyTaker,
  duelConversionMult,
} = require("../game/matchCalculations.ts");
const {
  resolvePenaltyKick,
  refreshPossession,
  resolveNpcManagement,
  resolveCoachOrders,
  applyHalftimeTalk,
} = require("../game/engine.ts");

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
      assert.equal(k.team, i % 2 === 0 ? "home" : "away", `ordem quebrada (seed ${seed}, remate ${i})`);
    });
    const regulation = kicks.filter((k: any) => !k.suddenDeath);
    assert.ok(regulation.length <= 10, `mais de 10 remates regulamentares (seed ${seed})`);
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
test("U9 — isCupFinalRound: só a ronda 6", () => {
  assert.equal(isCupFinalRound(6), true);
  assert.equal(isCupFinalRound(5), false);
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
  assert.deepEqual(change, { formation: "3-5-2", style: "OFENSIVO", pressure: "MEDIA" });
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
  assert.deepEqual(change, { formation: "4-4-2", style: "DEFENSIVO", pressure: "MEDIA" });
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
  assert.deepEqual(change, { formation: "4-4-2", style: "DEFENSIVO", pressure: "MEDIA" });
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

// ── U19: funcionários (médico) na via das lesões ───────────────────────────
// Com resistência 1 o teste de resistência nunca salva o jogador
// (`skip = (1-1)*0.00653 = 0`), por isso um rng CONSTANTE decide tudo:
// o gate da lesão, o jogador escolhido, a gravidade e as semanas.
function medicTick(constant: number, medicLevel: number) {
  const { tick, shared, fixture } = minuteTick(1);
  const squad = tick.homeSquad.map((p) => ({ ...p, resistance: 1 }));
  tick.homeSquad = squad;
  tick.homeFullRoster = [...squad];
  tick.homeLineupIds = new Set(squad.map((p) => p.id));
  tick.powers.home = computeSidePower(squad, tick.homeTactic, 25, 0, 1);
  tick.rng = () => constant;
  fixture._injuryLoadMult = { home: 1, away: 1 };
  fixture._staffInjury = { home: medicLevel, away: medicLevel };
  return { tick, shared, fixture };
}

test("U19 — médico corta a probabilidade de lesão (gate entre as duas taxas)", async () => {
  // Taxa base por lado = 0.0015 (0.003/min a dividir pelos 2 lados). Com médico
  // nível 5 → 0.00105. O gate 0.0013 cai entre as duas: lesiona sem médico,
  // não lesiona com ele.
  const run = async (medicLevel: number) => {
    const { tick, shared, fixture } = medicTick(0.0013, medicLevel);
    for (let m = 1; m <= 10; m++) {
      tick.minute = m;
      fixture._minute = m;
      await resolveInjuries(tick, shared);
    }
    return fixture.events.filter((e) => e.type === "injury").length;
  };
  const withoutMedic = await run(0);
  const withMedic = await run(5);
  assert.ok(withoutMedic > 0, `sem médico lesiona (${withoutMedic} lesões em 10 min)`);
  assert.equal(withMedic, 0, "com médico nível 5 não lesiona no mesmo gate");
});

test("U19b — médico encurta a lesão grave e poupa skill", async () => {
  // Gate 0.0001 < gravidade 0.1 → lesão GRAVE. Semanas = 3 + floor(0.0001*6) = 3;
  // perda = 2 + floor(0.0001*4) = 2. O jogador escolhido é o índice 0 (GR, skill 30).
  const run = async (medicLevel: number) => {
    const { tick, shared, fixture } = medicTick(0.0001, medicLevel);
    tick.minute = 1;
    fixture._minute = 1;
    await resolveInjuries(tick, shared);
    const delta = fixture._deltas?.injuries?.get(1);
    return { delta, events: fixture.events.filter((e) => e.type === "injury") };
  };
  const without = await run(0);
  assert.equal(without.delta?.oldSkill, 30, "lesão grave sem médico parte do skill 30");
  assert.equal(without.delta?.injuryUntil, 4, "sem médico: 3 semanas (jornada 1 + 3)");
  assert.equal(without.delta?.newSkill, 28, "sem médico perde 2 de skill");
  assert.equal(without.events[0]?.severity, "grave", "lesão classificada como grave");

  const withMedic = await run(5);
  assert.equal(withMedic.delta?.injuryUntil, 2, "médico nível 5: 3 semanas → 1 (nunca abaixo de 1)");
  assert.equal(withMedic.delta?.newSkill, 30, "médico nível 5 poupa a perda de skill");
});

// ── U20: clima → fadiga (escudo: resistência) ─────────────────────────────
test("U20 — clima adverso cansa mais e a resistência é o escudo", async () => {
  const seed = 424242;
  const mkPlayer = (id: number, teamId: number, res: number) => ({
    id,
    teamId,
    position: "DF",
    role: "DF",
    skill: 70,
    resistance: res,
    _matchSkill: 70,
    _fatigueLoss: 0,
  });
  const mkSquad = (base: number, teamId: number, res: number) =>
    Array.from({ length: 11 }, (_, i) => mkPlayer(base + i, teamId, res));

  // 90 minutos de applyMinuteFatigue com seed fixa → fadiga total (memória).
  const runMatch = (weather: string, res: number) => {
    const rng = createSeededRng(seed);
    const homeSquad = mkSquad(1000, 1, res);
    const awaySquad = mkSquad(2000, 2, res);
    const fixture = { _weather: weather, _fatigueSnapshots: {}, _minutesPlayed: 0, _lastFatigueTick: 0 };
    const homeLineupIds = new Set(homeSquad.map((p) => p.id));
    const awayLineupIds = new Set(awaySquad.map((p) => p.id));
    for (let m = 1; m <= 90; m++) {
      applyMinuteFatigue({
        fixture,
        minute: m,
        homeSquad,
        awaySquad,
        homeLineupIds,
        awayLineupIds,
        rng,
      });
    }
    // A fadiga vive em fixture._fatigueLoss[side][id] (memória), não no player.
    const fl = (fixture._fatigueLoss ?? { home: {}, away: {} }) as Record<
      string,
      Record<number, number>
    >;
    const sum = (m: Record<number, number>) =>
      Object.values(m ?? {}).reduce((s, v) => s + v, 0);
    return sum(fl.home) + sum(fl.away);
  };

  // (1) Clima adverso cansa mais que sol (mesma resistência).
  const sol = runMatch("sol", 26);
  const neve = runMatch("neve", 26);
  assert(neve > sol, `neve (${neve}) deve > sol (${sol})`);

  // (2) Em clima mau, resistência baixa cansa mais que resistência alta.
  const resBaixa = runMatch("neve", 1);
  const resAlta = runMatch("neve", 50);
  assert(resBaixa > resAlta, `res baixa (${resBaixa}) deve > res alta (${resAlta})`);
});

// ── U21–U26: Fase 1 do roadmap tático (irrealismos) ─────────────────────────
test("U21 — a formação conta-se no onze em campo, não na declarada", () => {
  const squad = makeSquad(30, "x"); // onze real 4-4-2
  const t = (formation) => ({ formation, style: "EQUILIBRADO" });
  const declared541 = computeSidePower(squad, t("5-4-1"), 50, 0);
  const real442 = computeSidePower(squad, t("4-4-2"), 50, 0);
  assert.equal(declared541.formation, "4-4-2");
  assert.equal(declared541.defense, real442.defense, "declarar 5-4-1 não dá a defesa do 5-4-1");
  // Familiaridade só conta para a formação que se joga.
  assert.equal(computeSidePower(squad, t("5-4-1"), 50, 0.05).attack, real442.attack);
  assert.ok(computeSidePower(squad, t("4-4-2"), 50, 0.05).attack > real442.attack);
  // Fora da tabela: 2-3-5 → a mais próxima com nº de avançados parecido.
  const shape = (d, m, a) => [
    { position: "GR" },
    ...Array(d).fill({ position: "DEF" }),
    ...Array(m).fill({ position: "MED" }),
    ...Array(a).fill({ position: "ATA" }),
  ];
  assert.equal(effectiveFormation(shape(2, 3, 5), "5-4-1"), "4-2-4");
  // Com 10 (3-4-2): mantém a declarada se for uma das mais próximas.
  assert.equal(effectiveFormation(shape(3, 4, 2), "4-4-2"), "4-4-2");
  assert.equal(effectiveFormation(shape(3, 4, 2), "3-5-2"), "3-5-2");
});

test("U22 — com 10 defende pior e cria menos", () => {
  const squad = makeSquad(30, "x");
  const t = { formation: "4-4-2", style: "EQUILIBRADO" };
  const p11 = computeSidePower(squad, t, 50, 0);
  const p10 = computeSidePower(squad.filter((p) => p.position !== "MED" || p.id !== 1005), t, 50, 0);
  assert.equal(p11.missing, 0);
  assert.equal(p10.missing, 1);
  assert.ok(p10.defense < p11.defense, "a média não muda, mas falta um jogador");
  assert.ok(shortHandedChanceMult(1, 0) < 1, "menos oportunidades próprias");
  assert.ok(shortHandedChanceMult(0, 1) > 1, "mais oportunidades contra 10");
});

test("U23 — penálti: quem domina sofre mais faltas; batedor nunca o GR; xG", async () => {
  const { tick, shared, fixture } = minuteTick(1, { fixture: { _homeChances: 25, _awayChances: 5 } });
  const seq = [0, 0.5]; // dispara o penálti; 0.5 → casa (5/6 do domínio), antes 50/50 → fora
  tick.rng = () => (seq.length ? seq.shift() : 0.5);
  await resolvePenaltyKick(tick, shared);
  const pen = fixture.events.find((e) => e.type === "penalty_goal" || e.type === "penalty_miss");
  assert.equal(pen?.team, "home");
  assert.ok(pen.xg > 0.5 && pen.xg < 1, `xG do penálti (${pen.xg})`);
  const squad = [
    { id: 1, position: "GR", skill: 50 },
    { id: 2, position: "ATA", skill: 20 },
    { id: 3, position: "MED", skill: 25 },
  ];
  assert.equal(selectPenaltyTaker(squad).id, 3);
});

test("U24 — cartões: o mais agressivo leva mais, o GR raramente", async () => {
  const counts = new Map();
  for (let seed = 1; seed <= 40; seed++) {
    const { tick, shared, fixture } = minuteTick(seed);
    for (const p of tick.homeSquad) p.aggressiveness = p.id === 6 ? 50 : 10;
    tick.powers.home = computeSidePower(tick.homeSquad, tick.homeTactic, 25, 0, 1);
    for (let m = 1; m <= 89; m++) {
      tick.minute = m;
      await resolveCards(tick, shared);
    }
    for (const e of fixture.events) {
      if (e.team === "home" && (e.type === "yellow" || e.type === "red"))
        counts.set(e.playerId, (counts.get(e.playerId) ?? 0) + 1);
    }
  }
  const total = [...counts.values()].reduce((s, n) => s + n, 0);
  assert.ok(total > 20, `amostra (${total})`);
  assert.ok((counts.get(6) ?? 0) / total > 0.2, `agressivo: ${counts.get(6)}/${total} (uniforme ≈ 9%)`);
  assert.ok((counts.get(1) ?? 0) / total < 0.05, `GR: ${counts.get(1) ?? 0}/${total}`);
});

test("U25 — lesão: o cansado lesiona-se mais, e é quem falhou a resistência", async () => {
  const { tick, shared, fixture } = minuteTick(1);
  for (const p of tick.homeSquad) p.resistance = 1; // resistência nunca salva
  fixture._minute = 10;
  fixture._fatigueLoss = { home: { 6: 20 }, away: {} }; // id 6: peso 7, resto 1 (total 17)
  // gate 0 → lesão na casa; 0.68 → id 6 (0.68×17 cai na fatia dele). Antes: o
  // teste de resistência era para squad[7] e a lesão sorteava outro (0.95 → id 11).
  const seq = [0, 0.68];
  tick.rng = () => (seq.length ? seq.shift() : 0.95);
  await resolveInjuries(tick, shared);
  const inj = fixture.events.find((e) => e.type === "injury");
  assert.equal(inj?.playerId, 6);
});

test("U26 — golo possível no minuto a seguir a um golo; lances com xG", () => {
  const { tick, shared, fixture } = minuteTick(1, { minute: 10, fixture: { _lastGoalMinute: 9 } });
  tick.rng = () => 0; // oportunidade e golo garantidos (antes: minuto bloqueado)
  resolveOpenPlayGoal(tick, shared, "home");
  const shot = fixture.events.find((e) => e.xg != null);
  assert.ok(shot, "houve lance no minuto a seguir ao golo");
  assert.ok(shot.xg > 0 && shot.xg < 1, `xG (${shot.xg})`);
});

// ── U27–U29: Fase 2 do roadmap tático (o jogo reage) ────────────────────────
test("U27 — posse recalculada: estilo, jogador a menos e ímpeto mexem nela", () => {
  const { tick, fixture } = minuteTick(1);
  const t = tick.homeTactic;
  const eq = computeSidePower(tick.homeSquad, t, 25, 0, 1);
  const away = tick.powers.away;
  refreshPossession(fixture, eq, away, 30);
  const base = fixture._homePossession;
  refreshPossession(fixture, computeSidePower(tick.homeSquad, { ...t, style: "OFENSIVO" }, 25, 0, 1), away, 30);
  assert.ok(fixture._homePossession > base, `ofensivo tem mais bola (${fixture._homePossession} vs ${base})`);
  refreshPossession(fixture, computeSidePower(tick.homeSquad.slice(0, 10), t, 25, 0, 1), away, 30);
  assert.ok(fixture._homePossession <= base - 5, `com 10 perde a bola (${fixture._homePossession} vs ${base})`);
  fixture._momentum = { side: "away", from: 28 };
  refreshPossession(fixture, eq, away, 30);
  assert.ok(fixture._homePossession < base, "o adversário marcou há 2' e está por cima");
  refreshPossession(fixture, eq, away, 40);
  assert.equal(fixture._homePossession, base, "o ímpeto passa ao fim de uns minutos");
  assert.equal(fixture._homePossession + fixture._awayPossession, 100);
});

test("U28 — NPC muda de estilo pelo resultado; equipa humana nunca é tocada", () => {
  const run = (players = {}) => {
    const { tick, fixture } = minuteTick(1, { minute: 70, fixture: { finalHomeGoals: 0, finalAwayGoals: 1 } });
    tick.awayTactic = { ...tick.homeTactic };
    tick.game.playersByName = players;
    resolveNpcManagement(tick);
    return { tick, fixture };
  };
  const npc = run();
  assert.equal(npc.tick.homeTactic.style, "OFENSIVO", "a perder aos 70' → ofensivo");
  assert.equal(npc.tick.awayTactic.style, "DEFENSIVO", "a ganhar aos 70' → defensivo");
  assert.equal(npc.fixture.events.filter((e) => e.type === "tactic_change").length, 2);
  const human = run({ Ana: { teamId: 1 } });
  assert.equal(human.tick.homeTactic.style, "EQUILIBRADO", "o servidor não decide pelo humano");
  assert.equal(human.tick.awayTactic.style, "DEFENSIVO");
});

test("U29 — NPC troca o cansado, guarda uma troca para lesões e não troca para pior", () => {
  const withBench = (over, benchPlayer) => {
    const r = minuteTick(1, over);
    r.tick.homeFullRoster.push(benchPlayer);
    r.tick.homeTactic = { ...r.tick.homeTactic, positions: { [benchPlayer.id]: "Suplente" } };
    r.fixture._fatigueLoss = { home: { 3: 4 }, away: {} }; // DEF id 3 rebentado
    return r;
  };
  const striker = { id: 50, name: "Ponta", position: "ATA", skill: 20, form: 32, morale: 25 };
  // A perder aos 60': sai o defesa cansado, entra o avançado.
  const losing = withBench({ minute: 60, fixture: { finalHomeGoals: 0, finalAwayGoals: 1 } }, striker);
  resolveNpcManagement(losing.tick);
  assert.ok(!losing.tick.homeLineupIds.has(3) && losing.tick.homeLineupIds.has(50));
  assert.equal(losing.fixture.events.filter((e) => e.type === "substitution" && e.team === "home").length, 1);
  // Só resta 1 troca (reserva para lesões): não mexe.
  const reserve = withBench({ minute: 60, fixture: { finalHomeGoals: 0, finalAwayGoals: 1, _subCountByTeam: { 1: 2 } } }, striker);
  resolveNpcManagement(reserve.tick);
  assert.ok(reserve.tick.homeLineupIds.has(3), "guarda a última troca");
  // Empate: troca direta só se quem entra não for pior (defesa 5 < cansado 27).
  const weak = withBench({ minute: 60 }, { id: 51, name: "Fraco", position: "DEF", skill: 5, form: 32, morale: 25 });
  resolveNpcManagement(weak.tick);
  assert.ok(weak.tick.homeLineupIds.has(3) && !weak.tick.homeLineupIds.has(51));
});

// ── U30–U33: Fase 3 do roadmap tático (camada tática) ───────────────────────
const shapeSquad = (d, m, a, skill = 30) => {
  let id = 500;
  const mk = (position) => ({ id: id++, name: "S" + id, position, skill, form: 32, morale: 25 });
  return [mk("GR"), ...Array.from({ length: d }, () => mk("DEF")), ...Array.from({ length: m }, () => mk("MED")), ...Array.from({ length: a }, () => mk("ATA"))];
};

test("U30 — duelo de formações: meio-campo e sobra de defesas contam", () => {
  const t = (formation) => ({ formation, style: "EQUILIBRADO" });
  const five = computeSidePower(shapeSquad(4, 5, 1), t("4-5-1"), 25, 0, 1);
  const three = computeSidePower(shapeSquad(4, 3, 3), t("4-3-3"), 25, 0, 1);
  assert.deepEqual(five.lines, { DEF: 4, MED: 5, ATA: 1 });
  const fixture: any = { events: [] };
  refreshPossession(fixture, five, three, 10);
  assert.ok(fixture._homePossession > 50, `5 médios contra 3 têm mais bola (${fixture._homePossession})`);
  assert.equal(duelConversionMult(2, 4), 1, "4-4-2 contra 4 defesas: neutro");
  assert.ok(duelConversionMult(3, 3) > 1, "3 avançados contra 3 defesas: sem sobra atrás");
  assert.ok(duelConversionMult(1, 5) < 1, "1 avançado contra 5 defesas: afogado");
});

test("U31 — pressão alta: mais bola e faltas, defesa exposta, cansa mais", async () => {
  const squad = makeSquad(30, "x");
  const t = (pressure) => ({ formation: "4-4-2", style: "EQUILIBRADO", pressure });
  const alta = computeSidePower(squad, t("ALTA"), 25, 0, 1);
  const media = computeSidePower(squad, t(undefined), 25, 0, 1);
  const baixa = computeSidePower(squad, t("BAIXA"), 25, 0, 1);
  assert.equal(media.pressure, "MEDIA");
  assert.ok(alta.possessionTilt > media.possessionTilt && media.possessionTilt > baixa.possessionTilt);
  assert.ok(alta.defense < media.defense && baixa.defense > media.defense);
  // Cansaço: 90' com a mesma semente, pressão alta vs bloco baixo.
  const fatigueOf = (pressure) => {
    const { tick, fixture } = minuteTick(77);
    tick.powers.home = computeSidePower(tick.homeSquad, t(pressure), 25, 0, 1);
    for (let m = 1; m <= 90; m++) {
      tick.minute = m;
      applyMinuteFatigue(tick);
    }
    return Object.values(fixture._fatigueLoss?.home ?? {}).reduce((a: number, b: any) => a + b, 0);
  };
  assert.ok(fatigueOf("ALTA") > fatigueOf("BAIXA"), "pressão alta cansa mais");
  // Cartões: mesma semente, pressão alta faz mais faltas.
  const cardsOf = async (pressure) => {
    let n = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const { tick, shared, fixture } = minuteTick(seed);
      shared.currentHome = tick.powers.home = computeSidePower(tick.homeSquad, t(pressure), 25, 0, 1);
      for (let m = 1; m <= 89; m++) {
        tick.minute = m;
        await resolveCards(tick, shared);
      }
      n += fixture.events.filter((e) => e.team === "home" && (e.type === "yellow" || e.type === "red")).length;
    }
    return n;
  };
  assert.ok((await cardsOf("ALTA")) > (await cardsOf("BAIXA")), "pressão alta vê mais cartões");
});

test("U32 — conversa ao intervalo: certa sobe a moral, errada desce, uma vez", () => {
  const run = (talk, home, away) => {
    const fixture: any = { finalHomeGoals: home, finalAwayGoals: away, events: [], _homeMorale: 25, _awayMorale: 25, homeTeam: { name: "Casa" } };
    applyHalftimeTalk(fixture, { formation: "4-4-2", style: "Balanced", talk }, null);
    return fixture;
  };
  assert.ok(run("EXIGIR", 0, 1)._homeMorale > 25, "exigir a perder puxa pela equipa");
  assert.ok(run("ELOGIAR", 0, 1)._homeMorale < 25, "elogiar a perder relaxa");
  assert.ok(run("ELOGIAR", 1, 0)._homeMorale > 25, "elogiar a ganhar motiva");
  const calm = run("ACALMAR", 0, 0);
  assert.equal(calm._talkCalm?.home, true);
  assert.equal(calm.events.length, 1);
  applyHalftimeTalk(calm, { formation: "4-4-2", style: "Balanced", talk: "ACALMAR" }, null);
  assert.equal(calm.events.length, 1, "só uma vez por jogo");
  assert.equal(run(undefined, 0, 1)._homeMorale, 25, "sem conversa, nada muda");
});

test("U33 — ordens do treinador: minuto e resultado certos, só humanos", () => {
  const order = { minute: 70, when: "LOSING", style: "Offensive", pressure: "ALTA" };
  const run = (homeGoals, awayGoals, minute = 70) => {
    const { tick, fixture } = minuteTick(1, { minute, fixture: { finalHomeGoals: homeGoals, finalAwayGoals: awayGoals } });
    const live = { formation: "4-4-2", style: "Balanced", positions: {}, orders: [order] };
    tick.homeTactic = live;
    tick.awayTactic = { formation: "4-4-2", style: "Balanced", positions: {}, orders: [{ ...order, when: "WINNING" }] };
    tick.game.playersByName = { Ana: { teamId: 1, tactic: live } };
    resolveCoachOrders(tick);
    return { tick, fixture, live };
  };
  const hit = run(0, 1);
  assert.equal(hit.live.style, "Offensive");
  assert.equal(hit.live.pressure, "ALTA");
  const ev = hit.fixture.events.find((e) => e.order);
  assert.ok(ev && ev.teamId === 1 && ev.style === "Offensive" && ev.pressure === "ALTA", "evento para o cliente alinhar");
  assert.equal(hit.tick.awayTactic.style, "Balanced", "equipa sem treinador humano não segue ordens");
  assert.equal(run(1, 1).live.style, "Balanced", "empatado: a ordem era para quando perde");
  assert.equal(run(0, 1, 69).live.style, "Balanced", "fora do minuto não mexe");
});

// ── U34–U36: capitães (liderança relativa, nos maus momentos) ───────────────
const { leadershipOf, pickCaptain, captainMomentumMinutes } = require("../game/matchCalculations.ts");
const { startMomentum, assignCaptain, passArmband } = require("../game/engine.ts");

test("U34 — liderança: idade, experiência, estatuto e moral; escolha sem sorteio", () => {
  const vet = { id: 1, name: "Vet", age: 30, career_games: 60, skill: 40, morale: 25 };
  const kid = { id: 2, name: "Miúdo", age: 18, career_games: 0, skill: 40, morale: 25 };
  assert.equal(leadershipOf(vet, 30), 5, "veterano experiente e dos melhores");
  assert.equal(leadershipOf(kid, 30), 1, "miúdo sem jogos");
  assert.ok(leadershipOf({ ...vet, morale: 5 }, 30) < leadershipOf(vet, 30), "capitão descontente perde voz");
  assert.ok(leadershipOf({ ...vet, career_games: 0 }, 30) < leadershipOf(vet, 30), "sem jogos, menos liderança");
  assert.ok(leadershipOf({ ...vet, skill: 20 }, 30) < leadershipOf(vet, 30), "suplente crónico lidera menos");
  assert.equal(pickCaptain([kid, vet]).id, 1, "automático: o maior líder");
  assert.equal(pickCaptain([kid, vet], 2).id, 2, "a escolha do treinador manda");
  assert.equal(pickCaptain([kid, vet], 99).id, 1, "escolhido fora do onze → automático");
  assert.equal(pickCaptain([{ ...vet, id: 9 }, { ...vet, id: 4 }]).id, 4, "empate total → menor id");
  assert.equal(pickCaptain([]), null);
});

test("U35 — capitães iguais não mexem no ímpeto; o melhor líder de quem sofre encurta-o", () => {
  assert.equal(captainMomentumMinutes(3, 3), 8, "iguais: base");
  assert.equal(captainMomentumMinutes(), 8, "sem capitães: base");
  assert.equal(captainMomentumMinutes(5, 3), 4, "quem sofreu lidera melhor: encurta");
  assert.equal(captainMomentumMinutes(2, 4), 12, "quem sofreu lidera pior: alonga");
  assert.equal(captainMomentumMinutes(5, 1), 3, "limite mínimo");
  assert.equal(captainMomentumMinutes(1, 5), 13, "limite máximo");
});

test("U36 — braçadeira: escolha no arranque, passa quando o capitão sai, ímpeto usa-a", () => {
  const p = (id, age, extra = {}) => ({ id, name: `J${id}`, age, career_games: 30, skill: 30, morale: 25, position: "MED", ...extra });
  const home = [p(1, 30), p(2, 26), p(3, 19)];
  const away = [p(11, 19, { career_games: 0 }), p(12, 18, { career_games: 0 })];
  const fixture: any = {
    events: [],
    _minute: 60,
    homeTeam: { name: "Casa" },
    awayTeam: { name: "Fora" },
    homeLineup: home.map((x) => ({ id: x.id, is_starter: true })),
    awayLineup: away.map((x) => ({ id: x.id, is_starter: true })),
  };
  assignCaptain(fixture, "home", home, { formation: "4-4-2", style: "Balanced", captainId: 3 }, 1);
  assignCaptain(fixture, "away", away, null, 1);
  assert.equal(fixture._captain.home.id, 3, "escolha do treinador");
  assert.equal(fixture.homeLineup.find((x) => x.id === 3).is_captain, true, "o cliente vê o C");
  assert.equal(fixture.events.length, 0, "primeiro capitão não é notícia");

  // Dois miúdos de braçadeira: capitães iguais → o ímpeto de sempre.
  assert.deepEqual([fixture._captain.home.lead, fixture._captain.away.lead], [1, 1]);
  assert.equal(startMomentum(fixture, "away", 10), 8);

  home.splice(2, 1); // o capitão sai de campo
  passArmband(fixture, "home", home, 3);
  assert.equal(fixture._captain.home.id, 1, "passa ao maior líder em campo");
  assert.equal(fixture.events.at(-1).minute, 60);
  assert.match(fixture.events.at(-1).text, /J1 é o novo capitão do Casa/);
  passArmband(fixture, "home", home, 2);
  assert.equal(fixture.events.length, 1, "sai outro jogador: nada muda");

  // Agora a casa tem um líder a sério: sofre golo e o ímpeto do adversário encurta.
  assert.ok(startMomentum(fixture, "away", 70) < 8, "bom capitão segura a equipa");
  assert.ok(startMomentum(fixture, "home", 80) > 8, "quem tem pior líder sofre mais tempo");
  assert.equal(fixture._momentum.minutes, startMomentum(fixture, "home", 80));

  // Intervalo: sem escolha válida, mantém quem tem a braçadeira.
  assignCaptain(fixture, "home", home, { formation: "4-4-2", style: "Balanced", captainId: 3 }, 46);
  assert.equal(fixture._captain.home.id, 1);
});
