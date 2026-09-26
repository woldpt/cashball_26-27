/**
 * seedEcon — fonte única da economia da seed (JS puro).
 *
 * Canonicaliza as fórmulas e tabelas antes duplicadas entre `db/seed.js` e
 * `gameConstants.ts` (`fairWeeklyWage`, `recalcPlayerValue`, `FANBASE_*`).
 * `gameConstants.ts` re-exporta daqui; a seed faz `require` direto.
 * Puro (sem requires) para não criar ciclos de importação.
 *
 * Se alterares este ficheiro, o `base.db` re-seeda sozinho: está incluído no
 * `fixtures_hash` (seed.js) e no `templateHash()` (ensureSeeded.js).
 */

// Orçamento inicial por divisão (1ª Liga → distritais).
/** @type {Record<number, number>} */
const BUDGET_BY_DIVISION = {
  1: 2500000,
  2: 2000000,
  3: 1500000,
  4: 1000000,
  5: 500000,
};

// Massa adepta inicial por divisão (procura típica; raramente limita de
// arranque, limita a expansão).
/** @type {Record<number, number>} */
const FANBASE_BY_DIVISION = {
  1: 35000,
  2: 15000,
  3: 10000,
  4: 7000,
  5: 4000,
};

// Intervalo de skill aleatório por divisão (clubes com `skillRange` próprio
// no fixture sobrepõem-se a isto).
/** @type {Record<number, [number, number]>} */
const SKILL_RANGE_BY_DIVISION = {
  1: [36, 50],
  2: [26, 35],
  3: [16, 25],
  4: [5, 15],
  5: [5, 15],
};

// Variação salarial da seed em torno do salário justo (±15%). O gameManager
// usa `1 + WAGE_SEED_SPREAD` como teto do rebalance one-shot — nunca mexer
// num lado sem o outro.
const WAGE_SEED_SPREAD = 0.15;

/**
 * Valor de mercado base, derivado do skill (não-linear): skill² × 500 +
 * skill × 2000 + piso fixo de €30.000 (ajuda as equipas pequenas).
 * @param {number} skill skill 1–50
 * @returns {number} valor em €
 */
function recalcPlayerValue(skill) {
  const s = Math.max(1, Math.round(skill || 0));
  return Math.round(s * s * 500 + s * 2000 + 30000);
}

/**
 * Salário semanal justo, derivado do skill (sub-linear: os fracos ganham
 * muito menos, mantendo as folhas das divisões baixas viáveis).
 * Âncoras: skill 10 → ~1000€/sem, skill 50 → ~8000€/sem.
 * @param {number} skill skill 1–50
 * @returns {number} salário semanal em €
 */
function fairWeeklyWage(skill) {
  const s = Math.max(1, Math.round(skill || 0));
  return Math.round(Math.pow(s, 1.292) * 51);
}

/**
 * Gerador pseudoaleatório determinístico (mulberry32).
 * @param {number} a semente como inteiro sem sinal
 * @returns {() => number} função como Math.random()
 */
function mulberry32(a) {
  let t = a >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let z = Math.imul(t ^ (t >>> 15), t | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Reduz uma string a inteiro sem sinal (para SEED textual).
 * @param {string} str
 * @returns {number}
 */
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Devolve o RNG da seed: determinístico se `seed` vier definido (nº ou
 * string), `Math.random` caso contrário (comportamento histórico).
 * @param {string|number|undefined} seed ex.: process.env.SEED
 * @returns {{ rng: () => number, label: string }}
 */
function createRng(seed) {
  if (seed === undefined || seed === null || seed === "") {
    return { rng: Math.random, label: "aleatório" };
  }
  const n =
    typeof seed === "number" ? seed >>> 0 : hashSeed(String(seed));
  return { rng: mulberry32(n), label: `SEED=${seed}` };
}

module.exports = {
  BUDGET_BY_DIVISION,
  FANBASE_BY_DIVISION,
  SKILL_RANGE_BY_DIVISION,
  WAGE_SEED_SPREAD,
  recalcPlayerValue,
  fairWeeklyWage,
  createRng,
};
