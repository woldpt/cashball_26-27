// ── Match calculation utilities extracted from engine.ts ──────────────────────

import { pickBestPlayer, withJuniorGRs, ensureFullBench, isPlayerAvailable, getEffectiveSkill } from "./playerUtils";
import { MAX_BENCH_SIZE, FORM_NEUTRAL, MATCH_TUNING } from "../gameConstants";

type PlayerRow = any;

export function selectPenaltyTaker(squad: PlayerRow[] = []) {
  return pickBestPlayer(squad) || null;
}

export function clampSkill(value: number) {
  return Math.max(1, Math.min(50, Math.round(value)));
}

// Per-minute goal probability multiplier based on real football time distribution.
// Weights are normalised so the average across 90 min = 1.0 (total goals unchanged).
export function getGoalTimeMultiplier(minute: number): number {
  if (minute <= 10) return 0.66; // 00'–10' ~7-8%
  if (minute <= 20) return 0.83; // 11'–20' ~9-10%
  if (minute <= 30) return 0.94; // 21'–30' ~11%
  if (minute <= 40) return 1.02; // 31'–40' ~12%
  if (minute <= 45) return 1.11; // 41'–HT  ~13%
  if (minute <= 55) return 0.85; // 46'–55' ~10%
  if (minute <= 65) return 0.94; // 56'–65' ~11%
  if (minute <= 75) return 1.11; // 66'–75' ~13%
  if (minute <= 85) return 1.28; // 76'–85' ~15%
  return 1.62; // 86'–FT  ~18-20%
}

const WEATHER_EMOJIS: Record<string, string> = {
  sol: "☀️",
  chuva: "🌧️",
  chuva_forte: "⛈️",
  vento: "💨",
  frio: "🥶",
  nevoeiro: "🌫️",
  neve: "❄️",
};

/**
 * Clima determinístico de um jogo — ÚNICA fonte de verdade (fix #4).
 * A mesma semente (época, jornada, equipas) é usada pela previsão do
 * briefing (matchSummaryHelpers) e pela simulação (engine), por isso o
 * clima anunciado é sempre o jogado. A soma comuta: a ordem casa/fora
 * não altera o resultado.
 */
export function getWeatherForFixture(
  season: number,
  matchweek: number,
  teamAId: number,
  teamBId: number,
): { condition: string; emoji: string } {
  let ws =
    ((season ?? 1) * 1000 +
      (matchweek ?? 1) * 31 +
      (teamAId ?? 0) +
      (teamBId ?? 0)) >>>
      0 || 1;
  ws ^= ws << 13;
  ws ^= ws >>> 17;
  ws ^= ws << 5;
  const weatherRoll = (ws >>> 0) / 0xffffffff;
  let condition: string;
  if (weatherRoll < 0.35) condition = "sol";
  else if (weatherRoll < 0.65) condition = "chuva";
  else if (weatherRoll < 0.8) condition = "vento";
  else if (weatherRoll < 0.88) condition = "chuva_forte";
  else if (weatherRoll < 0.95) condition = "frio";
  else if (weatherRoll < 0.98) condition = "nevoeiro";
  else condition = "neve";
  return { condition, emoji: WEATHER_EMOJIS[condition] };
}

export function getWeatherGoalMultiplier(condition: string | undefined): number {
  switch (condition) {
    case "neve":
      return 0.8;
    case "nevoeiro":
      return 0.85;
    case "frio":
      return 0.9;
    case "sol":
      return 1.0;
    case "vento":
      return 1.05;
    case "chuva":
      return 1.08;
    case "chuva_forte":
      return 1.15;
    default:
      return 1.0;
  }
}

/**
 * A final da Taça é a ronda 5 (ver CUP_ROUND_NAMES em gameConstants).
 * Helper único — antes o literal `round === 5` estava espalhado pela engine.
 */
export function isCupFinalRound(round: unknown): boolean {
  return round === 5;
}

export function normaliseStyle(style: unknown) {
  const raw = String(style || "Balanced")
    .trim()
    .toUpperCase();
  if (raw === "DEFENSIVO" || raw === "DEFENSIVE") return "DEFENSIVO";
  if (raw === "OFENSIVO" || raw === "OFFENSIVE") return "OFENSIVO";
  return "EQUILIBRADO";
}

export function getAggressivenessValue(player: PlayerRow) {
  if (typeof player?.aggressiveness === "number") {
    return Math.max(1, Math.min(5, Math.round(player.aggressiveness)));
  }

  const AGG_TIER_VALUES = {
    Acólito: 1,
    Tranquilo: 2,
    Zen: 3,
    Lenhador: 4,
    Triturador: 5,
    // Aliases legados (nomes anteriores) — salas antigas podem ter strings
    Santinho: 1,
    Escuteiro: 2,
    Cordeirinho: 1,
    Cavalheiro: 2,
    "Fair Play": 3,
    Caneleiro: 4,
    Caceteiro: 5,
  };

  return AGG_TIER_VALUES[player?.aggressiveness] ?? 3;
}

export function average(values: number[] = []) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// ── RNG injetável (fix #9) ───────────────────────────────────────────────────
// A simulação usa `context.rng ?? Math.random`: em produção comporta-se como
// antes; testes/replays injetam createSeededRng(hashSeed(...)) para resultados
// determinísticos. Só os rolls com impacto no RESULTADO passam pelo rng —
// variantes de fraseado (commentary) e ids únicos ficam em Math.random.
export type Rng = () => number;

// mulberry32 — PRNG pequena e rápida, suficiente para a simulação.
export function createSeededRng(seed: number): Rng {
  let a = seed >>> 0 || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a para derivar sementes numéricas de (roomCode, calendarIndex, ...).
export function hashSeed(...parts: Array<string | number>): number {
  const s = parts.join("|");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const FORMATIONS = ["4-4-2", "4-3-3", "3-5-2", "5-3-2", "4-5-1", "3-4-3", "4-2-4", "5-4-1"];

const FORMATION_WEIGHTS: Record<string, { GR: number; DEF: number; MED: number; ATA: number }> = {
  "4-4-2": { GR: 1, DEF: 4, MED: 4, ATA: 2 },
  "4-3-3": { GR: 1, DEF: 4, MED: 3, ATA: 3 },
  "3-5-2": { GR: 1, DEF: 3, MED: 5, ATA: 2 },
  "5-3-2": { GR: 1, DEF: 5, MED: 3, ATA: 2 },
  "4-5-1": { GR: 1, DEF: 4, MED: 5, ATA: 1 },
  "3-4-3": { GR: 1, DEF: 3, MED: 4, ATA: 3 },
  "4-2-4": { GR: 1, DEF: 4, MED: 2, ATA: 4 },
  "5-4-1": { GR: 1, DEF: 5, MED: 4, ATA: 1 },
};

export async function generateAITactic(
  db: any,
  teamId: number,
  opponentId: number,
  matchweek: number = 1,
): Promise<{ formation: string; style: string; positions: Record<number, string> }> {
  return new Promise<{ formation: string; style: string; positions: Record<number, string> }>((resolve) => {
    db.all(
      "SELECT * FROM players WHERE team_id IN (?, ?) AND team_id IS NOT NULL",
      [teamId, opponentId],
      (err: any, rows: PlayerRow[] | undefined) => {
        if (!rows || rows.length === 0) {
          return resolve({ formation: "4-4-2", style: "EQUILIBRADO", positions: {} });
        }

        const selfRows = ensureFullBench(
          withJuniorGRs(
            rows.filter((p) => p.team_id === teamId),
            teamId,
            matchweek,
          ),
          teamId,
          matchweek,
        );
        const oppRows = rows.filter((p) => p.team_id === opponentId);

        const avgSelf = average(selfRows.map((p) => p.skill || 0));
        const avgOpp = average(oppRows.map((p) => p.skill || 0));

        const bestFormation = FORMATIONS.reduce((best, form) => {
          const w = FORMATION_WEIGHTS[form];
          const score =
            (average(selfRows.filter((p) => p.position === "GR").map((p) => p.skill || 0)) * w.GR +
            average(selfRows.filter((p) => p.position === "DEF").map((p) => p.skill || 0)) * w.DEF +
            average(selfRows.filter((p) => p.position === "MED").map((p) => p.skill || 0)) * w.MED +
            average(selfRows.filter((p) => p.position === "ATA").map((p) => p.skill || 0)) * w.ATA) /
            (w.GR + w.DEF + w.MED + w.ATA);
          return score > best.score ? { score, form } : best;
        }, { score: -Infinity, form: "4-4-2" }).form;

        const ratio = avgOpp > 0 ? avgSelf / avgOpp : 1;
        const style = ratio >= 1.10 ? "OFENSIVO" : ratio <= 0.90 ? "DEFENSIVO" : "EQUILIBRADO";

        // Seleccionar os 11 melhores jogadores por formação e marcar como Titular
        const w = FORMATION_WEIGHTS[bestFormation];
        const pickBest = (pool: PlayerRow[], n: number): PlayerRow[] =>
          [...pool]
            .filter((p) => isPlayerAvailable(p, matchweek))
            .sort((a, b) => (b.skill || 0) - (a.skill || 0))
            .slice(0, n);

        const grs = pickBest(selfRows.filter((p) => p.position === "GR"), w.GR);
        const defs = pickBest(selfRows.filter((p) => p.position === "DEF"), w.DEF);
        const meds = pickBest(selfRows.filter((p) => p.position === "MED"), w.MED);
        const atas = pickBest(selfRows.filter((p) => p.position === "ATA"), w.ATA);
        const starters = [...grs, ...defs, ...meds, ...atas];
        const starterIds = new Set(starters.map((p) => p.id));

        const positions: Record<number, string> = {};
        for (const p of starters) {
          positions[p.id] = "Titular";
        }

        // Banco: máx MAX_BENCH_SIZE (1 GR suplente + restantes de campo)
        const nonStarters = selfRows.filter(
          (p) => !starterIds.has(p.id) && isPlayerAvailable(p, matchweek),
        );
        const grBench = nonStarters
          .filter((p) => p.position === "GR")
          .sort((a, b) => (b.skill || 0) - (a.skill || 0))
          .slice(0, 1);
        const fieldBench = nonStarters
          .filter((p) => p.position !== "GR")
          .sort((a, b) => (b.skill || 0) - (a.skill || 0))
          .slice(0, MAX_BENCH_SIZE - grBench.length);
        for (const p of [...grBench, ...fieldBench]) {
          positions[p.id] = "Suplente";
        }
        // Restantes jogadores não aparecem no mapa (tratados como excluídos)

        resolve({ formation: bestFormation, style, positions });
      },
    );
  });
}

// ── Força da equipa (extraído do closure getPower do engine) ─────────────────
// Tabelas a nível de módulo: antes eram recriadas a cada chamada de
// simulateMatchSegment (e o STYLE duplicado a cada minuto de jogo).
export const FORMATION_ATTACK_FACTORS: Record<string, number> = {
  "4-2-4": 1.15,
  "3-4-3": 1.12,
  "4-3-3": 1.08,
  "3-5-2": 1.05,
  "4-4-2": 1.0,
  "4-5-1": 0.9,
  "5-3-2": 0.85,
  "5-4-1": 0.8,
};

export const FORMATION_DEFENSE_FACTORS: Record<string, number> = {
  "5-4-1": 1.25,
  "5-3-2": 1.2,
  "4-5-1": 1.1,
  "4-4-2": 1.0,
  "3-5-2": 0.95,
  "4-3-3": 0.9,
  "3-4-3": 0.85,
  "4-2-4": 0.75,
};

export const STYLE_ATTACK_FACTORS: Record<string, number> = {
  DEFENSIVO: 0.85,
  EQUILIBRADO: 1.0,
  OFENSIVO: 1.15,
};

export const STYLE_DEFENSE_FACTORS: Record<string, number> = {
  DEFENSIVO: 1.15,
  EQUILIBRADO: 1.0,
  OFENSIVO: 0.85,
};

export type SidePower = {
  attack: number;
  defense: number;
  style: string;
  squad: PlayerRow[];
  midStrength: number;
};

/**
 * Força ofensiva/defensiva de um onze. Função pura (sem cache): o engine
 * decide quando recalcular via dirty-flag no fixture. O estilo entra UMA
 * única vez — ataque com o fator ofensivo próprio, defesa com o fator
 * defensivo próprio (ver fix da dupla contagem no engine).
 */
export function computeSidePower(
  squad: PlayerRow[],
  tactic: { formation?: string; style?: string } | null,
  morale = 50,
  familiarityBonus = 0,
): SidePower {
  const formation = String(tactic?.formation || "4-4-2");
  const style = normaliseStyle(tactic?.style);

  const midfielders = squad.filter((p) => p.position === "MED");
  const forwards = squad.filter((p) => p.position === "ATA");
  const defenders = squad.filter((p) => p.position === "DEF");
  const keepers = squad.filter((p) => p.position === "GR");

  const avgMidfielderQuality = average(midfielders.map((p) => getEffectiveSkill(p) || 0));
  const avgForwardQuality = average(forwards.map((p) => getEffectiveSkill(p) || 0));
  const avgDefenderQuality = average(defenders.map((p) => getEffectiveSkill(p) || 0));
  const avgKeeperQuality = average(keepers.map((p) => getEffectiveSkill(p) || 0));

  const formationAttack = FORMATION_ATTACK_FACTORS[formation] ?? 1.0;
  const formationDefense = FORMATION_DEFENSE_FACTORS[formation] ?? 1.0;

  // Moral (0-100): desvia o ataque ±10% e a defesa ±5% em torno de 50.
  // Deliberadamente pequeno — a forma ajusta, não decide.
  const moraleAttackFactor = 1 + (morale - 50) * MATCH_TUNING.moraleAttackPerPoint;
  const moraleDefenseFactor = 1 + (morale - 50) * MATCH_TUNING.moraleDefensePerPoint;

  const avgForm = average(squad.map((p) => p.form ?? FORM_NEUTRAL));
  const formFactor = Math.max(0.85, Math.min(1.15, avgForm / FORM_NEUTRAL));

  const attackBase = avgMidfielderQuality * 0.4 + avgForwardQuality * 0.6;
  const defenseBase = avgDefenderQuality * 0.6 + avgKeeperQuality * 0.4;

  const familiarityAttackFactor = 1 + familiarityBonus;
  const familiarityDefenseFactor = 1 + familiarityBonus * 0.5;

  return {
    attack:
      attackBase *
      formationAttack *
      moraleAttackFactor *
      STYLE_ATTACK_FACTORS[style] *
      formFactor *
      familiarityAttackFactor,
    defense:
      defenseBase *
      formationDefense *
      moraleDefenseFactor *
      STYLE_DEFENSE_FACTORS[style] *
      formFactor *
      familiarityDefenseFactor,
    style,
    squad,
    midStrength: avgMidfielderQuality,
  };
}

/**
 * Probabilidade de golo em jogo corrido num minuto, para um lado.
 * Pura e testável: recebe as forças já calculadas e os fatores externos.
 */
export function computeOpenPlayGoalProbability({
  attack,
  defense,
  minute,
  isHome,
  isFinal,
  weather,
  possessionFactor = 1,
  egoFactor = 1,
}: {
  attack: number;
  defense: number;
  minute: number;
  isHome: boolean;
  isFinal: boolean;
  weather?: string;
  possessionFactor?: number;
  egoFactor?: number;
}): number {
  const ratio = (attack || 1) / ((attack || 1) + (defense || 1) * 2);
  let probGoal = ratio * MATCH_TUNING.goalBaseRate * getGoalTimeMultiplier(minute);
  if (!isFinal) {
    probGoal *= isHome ? MATCH_TUNING.homeGoalFactor : MATCH_TUNING.awayGoalFactor;
  }
  probGoal *= getWeatherGoalMultiplier(weather);
  probGoal *= possessionFactor;
  probGoal *= egoFactor;
  return probGoal;
}
