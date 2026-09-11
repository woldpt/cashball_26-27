/**
 * Calibração do motor de jogo — jogos sintéticos com semente fixa.
 *
 * Uso:
 *   npx tsx scripts/engineCalibration.mts old        # baseline (modelo antigo)
 *   npx tsx scripts/engineCalibration.mts new        # modelo chances (posse→chances)
 *   npx tsx scripts/engineCalibration.mts both
 *
 * Compara: golos/jogo, % 0-0, bandas de 10', e sensibilidade a diferença
 * de qualidade (casa 27.5 vs fora 22.5 de média).
 * Sol só, moral 50, sem clima/ego/eventos especiais — isola o modelo de golo.
 *
 * Nota: o modelo "old" reconstrói o ataque antigo (0.4×MED + 0.6×ATA) a
 * partir do plantel, porque a computeSidePower já devolve ataque só de ATA.
 * Com os modificadores do plantel sintético todos = 1, é idêntico ao
 * valor que o engine antigo produziria.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  computeSidePower,
  computeOpenPlayGoalProbability,
  getGoalTimeMultiplier,
  computePossession,
  computeChanceGoalProbability,
  average,
} = require("../game/matchCalculations.ts");
const { MATCH_TUNING } = require("../gameConstants.ts");

// ── RNG determinístico (mulberry32) ─────────────────────────────────
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type P = { position: string; skill: number; form?: number };

// 4-4-2 sintético: 1 GR, 4 DEF, 4 MED, 2 ATA.
function makeSquad(rng: () => number, base: number, spread: number): P[] {
  const skill = () =>
    Math.max(5, Math.min(50, Math.round(base + (rng() - 0.5) * 2 * spread)));
  const squad: P[] = [];
  for (const pos of ["GR", "DEF", "DEF", "DEF", "DEF", "MED", "MED", "MED", "MED", "ATA", "ATA"]) {
    squad.push({ position: pos, skill: skill() });
  }
  return squad;
}

const TACTIC = { formation: "4-4-2", style: "EQUILIBRADO" };

interface Stats {
  matches: number;
  totalGoals: number;
  zeroZero: number;
  homeGoals: number;
  awayGoals: number;
  bands: number[]; // 9 bandas de 10'
  chancesHome: number;
  chancesAway: number;
}

function newStats(): Stats {
  return { matches: 0, totalGoals: 0, zeroZero: 0, homeGoals: 0, awayGoals: 0, bands: [0, 0, 0, 0, 0, 0, 0, 0, 0], chancesHome: 0, chancesAway: 0 };
}

/** Modelo antigo: probabilidade contínua por minuto (engine pré-mudança). */
function simMatchOld(home: P[], away: P[], rng: () => number) {
  const H = computeSidePower(home as any, TACTIC, 50, 0, 1);
  const A = computeSidePower(away as any, TACTIC, 50, 0, 1);
  // Ataque antigo = (0.4×MED + 0.6×ATA) — modificadores = 1 no plantel sintético.
  const attackOld = (squad: P[], fwdShare: boolean) => {
    const mid = average(squad.filter((p) => p.position === "MED").map((p) => p.skill));
    const fwd = average(squad.filter((p) => p.position === "ATA").map((p) => p.skill));
    return 0.4 * mid + 0.6 * fwd;
  };
  let gh = 0, ga = 0;
  const minutes: number[] = [];
  const totalMid = H.midStrength + A.midStrength;
  const possH = totalMid > 0 ? H.midStrength / totalMid : 0.5;
  for (let m = 1; m <= 90; m++) {
    let scoredThisMin = false;
    for (const side of ["home", "away"] as const) {
      if (scoredThisMin) continue;
      const attack = side === "home" ? attackOld(home, true) : attackOld(away, true);
      const defense = side === "home" ? A.defense : H.defense;
      const pf = side === "home" ? 0.9 + possH * 0.2 : 0.9 + (1 - possH) * 0.2;
      const p = computeOpenPlayGoalProbability({
        attack,
        defense,
        minute: m,
        isHome: side === "home",
        isFinal: false,
        weather: "sol",
        possessionFactor: pf,
        egoFactor: 1,
      });
      if (rng() < p) {
        if (side === "home") gh++; else ga++;
        minutes.push(m);
        scoredThisMin = true;
      }
    }
  }
  return { gh, ga, minutes, ch: { h: 0, a: 0 } };
}

/** Modelo novo: posse (médios) → nº de chances → resolução ATA vs DEF+GR. */
function simMatchNew(home: P[], away: P[], rng: () => number) {
  const H = computeSidePower(home as any, TACTIC, 50, 0, 1);
  const A = computeSidePower(away as any, TACTIC, 50, 0, 1);
  const possH = computePossession(H.midStrength, A.midStrength, "EQUILIBRADO", "EQUILIBRADO");
  const nH = MATCH_TUNING.chancesTotal * possH;
  const nA = MATCH_TUNING.chancesTotal * (1 - possH);
  let gh = 0, ga = 0, chH = 0, chA = 0;
  const minutes: number[] = [];
  for (let m = 1; m <= 90; m++) {
    let scoredThisMin = false;
    for (const side of ["home", "away"] as const) {
      if (scoredThisMin) continue;
      const nSide = side === "home" ? nH : nA;
      const attack = side === "home" ? H.attack : A.attack;
      const defense = side === "home" ? A.defense : H.defense;
      const rate = (nSide * getGoalTimeMultiplier(m)) / 90;
      if (rng() >= rate) continue;
      if (side === "home") chH++; else chA++;
      let p = computeChanceGoalProbability(attack, defense);
      p *= side === "home" ? MATCH_TUNING.homeGoalFactor : MATCH_TUNING.awayGoalFactor;
      if (rng() < p) {
        if (side === "home") gh++; else ga++;
        minutes.push(m);
        scoredThisMin = true;
      }
    }
  }
  return { gh, ga, minutes, ch: { h: chH, a: chA } };
}

function run(model: "old" | "new") {
  const N_EVEN = 20000;
  const N_UNEVEN = 20000;
  const SEED = 20260101;

  const even = newStats();
  const uneven = newStats();
  let strongWin = 0, strongGD = 0;

  for (let i = 0; i < N_EVEN; i++) {
    const rng = mulberry32(SEED + i * 7919);
    const home = makeSquad(rng, 22.5, 6);
    const away = makeSquad(rng, 22.5, 6);
    const r = model === "old" ? simMatchOld(home, away, rng) : simMatchNew(home, away, rng);
    even.matches++;
    even.totalGoals += r.gh + r.ga;
    if (r.gh === 0 && r.ga === 0) even.zeroZero++;
    even.homeGoals += r.gh;
    even.awayGoals += r.ga;
    even.chancesHome += r.ch.h;
    even.chancesAway += r.ch.a;
    for (const m of r.minutes) even.bands[Math.min(8, Math.floor((m - 1) / 10))]++;
  }

  for (let i = 0; i < N_UNEVEN; i++) {
    const rng = mulberry32(SEED + 999983 + i * 7919);
    const home = makeSquad(rng, 27.5, 6);
    const away = makeSquad(rng, 22.5, 6);
    const r = model === "old" ? simMatchOld(home, away, rng) : simMatchNew(home, away, rng);
    uneven.matches++;
    uneven.totalGoals += r.gh + r.ga;
    if (r.gh === 0 && r.ga === 0) uneven.zeroZero++;
    uneven.homeGoals += r.gh;
    uneven.awayGoals += r.ga;
    if (r.gh > r.ga) strongWin++;
    strongGD += r.gh - r.ga;
  }

  const f = (x: number, d = 3) => x.toFixed(d);
  const label = model === "old" ? "MODELO ATUAL (contínuo/minuto)" : "MODELO NOVO (posse→chances)";
  console.log(`\n═══ ${label} ═══`);
  console.log(`jogos equilibrados (${N_EVEN}):`);
  console.log(`  golos/jogo:      ${f(even.totalGoals / even.matches)}`);
  console.log(`  golos casa/fora: ${f(even.homeGoals / even.matches)} / ${f(even.awayGoals / even.matches)}`);
  console.log(`  % 0-0:           ${f((even.zeroZero / even.matches) * 100, 1)}%`);
  console.log(`  golos/banda:     ${even.bands.map((b) => f(b / even.matches, 3)).join("  ")}`);
  if (model === "new") {
    console.log(`  chances/jogo:    casa ${f(even.chancesHome / N_EVEN, 1)} · fora ${f(even.chancesAway / N_EVEN, 1)}`);
  }
  console.log(`jogos desequilibrados (${N_UNEVEN}, casa +5 pts):`);
  console.log(`  golos/jogo:      ${f(uneven.totalGoals / uneven.matches)}`);
  console.log(`  golos casa/fora: ${f(uneven.homeGoals / uneven.matches)} / ${f(uneven.awayGoals / uneven.matches)}`);
  console.log(`  % vitória casa:  ${f((strongWin / N_UNEVEN) * 100, 1)}%`);
  console.log(`  GD médio:        ${f(strongGD / N_UNEVEN, 2)}`);
}

const arg = process.argv[2] ?? "both";
if (arg === "old" || arg === "both") run("old");
if (arg === "new" || arg === "both") run("new");
