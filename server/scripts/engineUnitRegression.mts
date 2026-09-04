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
 *   U5 — sanidade do fix da dupla contagem do estilo: a mesma força ofensiva
 *        tem MENOR probabilidade de golo contra defesa DEFENSIVA do que
 *        contra defesa OFENSIVA (antes era ao contrário)
 *
 * Run: cd server && npm run test:engine-unit
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  normalizeMatchChoice,
  generateFixturesForDivision,
  simulatePenaltyShootout,
} = require("../game/engine.ts");
const {
  computeSidePower,
  computeOpenPlayGoalProbability,
  createSeededRng,
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
