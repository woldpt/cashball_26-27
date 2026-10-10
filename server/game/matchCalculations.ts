// ── Match calculation utilities extracted from engine.ts ──────────────────────

import { pickBestPlayer, withJuniorGRs, ensureFullBench, isPlayerAvailable, getEffectiveSkill } from "./playerUtils";
import { MAX_BENCH_SIZE, FORM_NEUTRAL, MORALE_NEUTRAL, MATCH_TUNING, CUP_FINAL_ROUND } from "../gameConstants";
import type { Captain } from "../types";

type PlayerRow = any;

/** Batedor automático: o melhor jogador de campo (o GR só se não houver mais ninguém). */
export function selectPenaltyTaker(squad: PlayerRow[] = []) {
  const outfield = squad.filter((p) => p.position !== "GR");
  return pickBestPlayer(outfield.length ? outfield : squad) || null;
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
  if (minute > 90) return MATCH_TUNING.extraTimeChanceMult; // prolongamento
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
  // fmix32 (murmur3): um xorshift de 1 ronda sobre seeds pequenas dava
  // sempre roll ≈ 0.07 → sempre sol.
  let h =
    ((season ?? 1) * 1000 +
      (matchweek ?? 1) * 31 +
      (teamAId ?? 0) +
      (teamBId ?? 0)) >>>
    0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  const weatherRoll = (h >>> 0) / 0x100000000;
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
 * A final da Taça é a ronda CUP_FINAL_ROUND (ver gameConstants).
 */
export function isCupFinalRound(round: unknown): boolean {
  return round === CUP_FINAL_ROUND;
}

export function normaliseStyle(style: unknown) {
  const raw = String(style || "Balanced")
    .trim()
    .toUpperCase();
  if (raw === "DEFENSIVO" || raw === "DEFENSIVE") return "DEFENSIVO";
  if (raw === "OFENSIVO" || raw === "OFFENSIVE") return "OFENSIVO";
  return "EQUILIBRADO";
}

/** Pressão da tática: ALTA / MEDIA / BAIXA (omissa ou inválida → MEDIA). */
export function normalisePressure(pressure: unknown): string {
  const raw = String(pressure || "").trim().toUpperCase();
  return raw === "ALTA" || raw === "BAIXA" ? raw : "MEDIA";
}

export function getAggressivenessValue(player: PlayerRow) {
  if (typeof player?.aggressiveness === "number") {
    const v = Math.round(player.aggressiveness);
    // Valores 1–5 são da escala antiga (pré-migração v4) — ×10.
    return v <= 5 ? Math.min(50, v * 10) : Math.max(1, Math.min(50, v));
  }

  const AGG_TIER_VALUES = {
    Acólito: 10,
    Tranquilo: 20,
    Zen: 30,
    Lenhador: 40,
    Triturador: 50,
    // Aliases legados (nomes anteriores) — salas antigas podem ter strings
    Santinho: 10,
    Escuteiro: 20,
    Cordeirinho: 10,
    Cavalheiro: 20,
    "Fair Play": 30,
    Caneleiro: 40,
    Caceteiro: 50,
  };

  return AGG_TIER_VALUES[player?.aggressiveness] ?? 30;
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

/**
 * Quota de posições (GR/DEF/MED/ATA) para completar o XI a partir da
 * formação ("3-5-2" → 1/3/5/2). Formação omissa ou inválida → 4-4-2.
 * (audit: o ensureStartingXI usava quota fixa 4-4-2 para todas as táticas.)
 */
export function quotaFromFormation(
  formation: unknown,
): { GR: number; DEF: number; MED: number; ATA: number } {
  const fallback = { GR: 1, DEF: 4, MED: 4, ATA: 2 };
  const parts = String(formation || "")
    .split("-")
    .map((n) => Number(n));
  if (
    parts.length !== 3 ||
    !parts.every((n) => Number.isInteger(n) && n >= 0) ||
    parts[0] + parts[1] + parts[2] !== 10
  ) {
    return fallback;
  }
  return { GR: 1, DEF: parts[0], MED: parts[1], ATA: parts[2] };
}

/** Valor de jogo de um jogador: qualidade × forma, na escala do motor (0,75–1,35). */
export function matchValue(p: PlayerRow): number {
  const form = Math.max(0.75, Math.min(1.35, (p?.form ?? FORM_NEUTRAL) / FORM_NEUTRAL));
  return (p?.skill || 0) * form;
}

/**
 * Onze e banco de um NPC: para cada formação escolhem-se os melhores
 * disponíveis por posição (pelo valor de jogo) e ganha a formação cujo onze
 * soma mais. Suplentes não contam para a escolha da formação.
 */
export function pickAiLineup(
  rows: PlayerRow[],
  matchweek: number = 1,
): { formation: string; starters: PlayerRow[]; bench: PlayerRow[] } {
  const available = rows
    .filter((p) => isPlayerAvailable(p, matchweek))
    .sort((a, b) => matchValue(b) - matchValue(a));
  const byPos = (pos: string) => available.filter((p) => p.position === pos);
  const pool = { GR: byPos("GR"), DEF: byPos("DEF"), MED: byPos("MED"), ATA: byPos("ATA") };

  let best = { score: -Infinity, formation: "4-4-2", starters: [] as PlayerRow[] };
  for (const formation of FORMATIONS) {
    const w = FORMATION_WEIGHTS[formation];
    const starters = [
      ...pool.GR.slice(0, w.GR),
      ...pool.DEF.slice(0, w.DEF),
      ...pool.MED.slice(0, w.MED),
      ...pool.ATA.slice(0, w.ATA),
    ];
    const score = starters.reduce((sum, p) => sum + matchValue(p), 0);
    if (score > best.score) best = { score, formation, starters };
  }

  // Banco: máx MAX_BENCH_SIZE (1 GR suplente + restantes de campo)
  const starterIds = new Set(best.starters.map((p) => p.id));
  const rest = available.filter((p) => !starterIds.has(p.id));
  const grBench = rest.filter((p) => p.position === "GR").slice(0, 1);
  const fieldBench = rest
    .filter((p) => p.position !== "GR")
    .slice(0, MAX_BENCH_SIZE - grBench.length);
  return { formation: best.formation, starters: best.starters, bench: [...grBench, ...fieldBench] };
}

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
        const self = pickAiLineup(selfRows, matchweek);
        const opp = pickAiLineup(rows.filter((p) => p.team_id === opponentId), matchweek);

        // Estilo: onze contra onze (não plantel contra plantel).
        const avgSelf = average(self.starters.map(matchValue));
        const avgOpp = average(opp.starters.map(matchValue));
        const ratio = avgOpp > 0 ? avgSelf / avgOpp : 1;
        const style = ratio >= 1.10 ? "OFENSIVO" : ratio <= 0.90 ? "DEFENSIVO" : "EQUILIBRADO";

        const positions: Record<number, string> = {};
        for (const p of self.starters) positions[p.id] = "Titular";
        for (const p of self.bench) positions[p.id] = "Suplente";
        // Restantes jogadores não aparecem no mapa (tratados como excluídos)

        resolve({ formation: self.formation, style, positions });
      },
    );
  });
}

// ── Força da equipa (extraído do closure getPower do engine) ─────────────────
// Tabelas a nível de módulo: antes eram recriadas a cada chamada de
// simulateMatchSegment (e o STYLE duplicado a cada minuto de jogo).
// Distâncias ao neutro alargadas ~1.4x (2026-09: as formações separam-se
// pouco — 4-2-4 vs 5-4-1 diferiam ~1.5pp por chance). O produto
// ataque×defesa de cada formação é preservado (≈0.87–1.02, como antes),
// por isso o total de golos da liga não se move — só os extremos.
export const FORMATION_ATTACK_FACTORS: Record<string, number> = {
  "4-2-4": 1.22,
  "3-4-3": 1.17,
  "4-3-3": 1.12,
  "3-5-2": 1.07,
  "4-4-2": 1.0,
  "4-5-1": 0.86,
  "5-3-2": 0.78,
  "5-4-1": 0.71,
};

export const FORMATION_DEFENSE_FACTORS: Record<string, number> = {
  "5-4-1": 1.41,
  "5-3-2": 1.31,
  "4-5-1": 1.15,
  "4-4-2": 1.0,
  "3-5-2": 0.93,
  "4-3-3": 0.87,
  "3-4-3": 0.81,
  "4-2-4": 0.71,
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

/** Inclinação de posse por estilo: OFENSIVO tem a bola, DEFENSIVO cede-a (o custo de fechar atrás). */
export const STYLE_POSSESSION_FACTORS: Record<string, number> = {
  DEFENSIVO: -1,
  EQUILIBRADO: 0,
  OFENSIVO: 1,
};

export type SidePower = {
  attack: number;
  defense: number;
  style: string;
  squad: PlayerRow[];
  midStrength: number;
  /** Formação jogada de facto (ver effectiveFormation). */
  formation: string;
  /** Jogadores a menos em campo (0 com 11). */
  missing: number;
  /** Pressão (ALTA/MEDIA/BAIXA). */
  pressure: string;
  /** Jogadores por linha em campo (duelo de formações). */
  lines: { DEF: number; MED: number; ATA: number };
  /** Inclinação de posse própria: médios em campo + pressão. */
  possessionTilt: number;
};

/**
 * Força ofensiva/defensiva de um onze. Função pura (sem cache): o engine
 * decide quando recalcular via dirty-flag no fixture. O estilo entra UMA
 * única vez — ataque com o fator ofensivo próprio, defesa com o fator
 * defensivo próprio (ver fix da dupla contagem no engine).
 */
/**
 * Fator ambiente da casa a partir da ocupação (0..1, null = desconhecida).
 * Estádio a abarrotar empurra a equipa (+4% ataque, +2% defesa); casa
 * vazia encolhe (−3% ataque). Fora de [morgue, vulcão] é neutro 1.0.
 * Puro e testável — o engine resolve a ocupação da fixture para aqui.
 */
export function crowdFactorForOccupancy(
  occupancy: number | null | undefined,
): number {
  if (occupancy == null) return 1;
  if (occupancy >= MATCH_TUNING.crowdBonusOccupancy)
    return 1 + MATCH_TUNING.crowdBonusAttack;
  if (occupancy < MATCH_TUNING.crowdPenaltyOccupancy)
    return 1 + MATCH_TUNING.crowdPenaltyAttack;
  return 1;
}

// Abaixo disto o onze está incompleto (testes, chamadas parciais): fica a
// formação declarada e não se conta inferioridade numérica.
const MIN_FIELD_FOR_SHAPE = 7;

/**
 * Formação jogada DE FACTO: contada no onze em campo (DEF-MED-ATA), não a
 * declarada — declarar 5-4-1 e jogar com 5 avançados já não dá a defesa do
 * 5-4-1. Fora da tabela (2-3-5, ou com 10 em campo) → a formação conhecida
 * mais próxima; em empate, a declarada, depois a de nº de avançados mais parecido.
 */
export function effectiveFormation(squad: PlayerRow[], declared: string): string {
  const n = { DEF: 0, MED: 0, ATA: 0 };
  for (const p of squad) if (p.position in n) n[p.position]++;
  if (n.DEF + n.MED + n.ATA < MIN_FIELD_FOR_SHAPE) return declared;
  const key = `${n.DEF}-${n.MED}-${n.ATA}`;
  if (FORMATION_ATTACK_FACTORS[key] != null) return key;
  const rank = (f: string) => {
    const [d, m, a] = f.split("-").map(Number);
    return [
      Math.abs(d - n.DEF) + Math.abs(m - n.MED) + Math.abs(a - n.ATA),
      f === declared ? 0 : 1,
      Math.abs(a - n.ATA),
    ];
  };
  return [...FORMATIONS].sort((x, y) => {
    const [rx, ry] = [rank(x), rank(y)];
    return rx[0] - ry[0] || rx[1] - ry[1] || rx[2] - ry[2];
  })[0];
}

/** Multiplicador das oportunidades de um lado pela inferioridade numérica (dos dois lados). */
export function shortHandedChanceMult(ownMissing = 0, oppMissing = 0): number {
  return (
    MATCH_TUNING.shortHandedOwnChanceMult ** ownMissing *
    MATCH_TUNING.shortHandedOppChanceMult ** oppMissing
  );
}

/**
 * Liderança de um jogador, 1–5 braçadeiras: idade (pico 29–33), experiência
 * (jogos de carreira), estatuto (qualidade face à média do onze) e a moral do
 * próprio — um capitão descontente perde voz. Sem coluna na BD: calcula-se.
 */
export function leadershipOf(p: PlayerRow, xiAvgSkill: number): number {
  const age = p.age ?? 0;
  const ageScore = age <= 20 ? 0 : age <= 23 ? 0.5 : age <= 26 ? 1 : age <= 28 ? 1.5 : age <= 33 ? 2 : 1.5;
  const experience = 1.5 * Math.min((p.career_games ?? 0) / MATCH_TUNING.captainFullExperienceGames, 1);
  const skill = p.skill ?? 0;
  const margin = MATCH_TUNING.captainStatusMargin;
  const status = skill >= xiAvgSkill + margin ? 1 : skill >= xiAvgSkill ? 0.5 : 0;
  const morale = p.morale ?? MORALE_NEUTRAL;
  const mood =
    morale < MATCH_TUNING.captainLowMorale ? -1 : morale > MATCH_TUNING.captainHighMorale ? 0.5 : 0;
  return Math.max(1, Math.min(5, Math.round(ageScore + experience + status + mood)));
}

/**
 * Capitão em campo: o escolhido se estiver no onze; senão o de maior
 * liderança (empate → mais jogos de carreira → menor id). Sem sorteio.
 */
export function pickCaptain(squad: PlayerRow[], chosenId?: number | null): Captain | null {
  if (!squad.length) return null;
  const avg = average(squad.map((p) => p.skill ?? 0));
  const ranked = squad
    .map((p) => ({ p, lead: leadershipOf(p, avg) }))
    .sort(
      (a, b) =>
        b.lead - a.lead ||
        (b.p.career_games ?? 0) - (a.p.career_games ?? 0) ||
        a.p.id - b.p.id,
    );
  const pick = ranked.find((r) => r.p.id === chosenId) ?? ranked[0];
  return { id: pick.p.id, name: pick.p.name, lead: pick.lead };
}

/**
 * Minutos de ímpeto depois de um golo: o melhor líder de quem sofreu
 * encurta-os, o pior alonga-os; capitães iguais → o valor base.
 */
export function captainMomentumMinutes(concededLead = 0, scorerLead = 0): number {
  const minutes =
    MATCH_TUNING.momentumMinutes -
    MATCH_TUNING.captainMomentumMinutesPerStar * (concededLead - scorerLead);
  return Math.max(MATCH_TUNING.captainMomentumMin, Math.min(MATCH_TUNING.captainMomentumMax, minutes));
}

export function computeSidePower(
  squad: PlayerRow[],
  tactic: { formation?: string; style?: string; pressure?: string } | null,
  morale = 50,
  familiarityBonus = 0,
  crowdFactor = 1,
): SidePower {
  const declared = String(tactic?.formation || "4-4-2");
  const formation = effectiveFormation(squad, declared);
  // A familiaridade é da formação treinada: só conta se for a que se joga.
  if (formation !== declared) familiarityBonus = 0;
  const style = normaliseStyle(tactic?.style);
  const pressure = normalisePressure(tactic?.pressure);
  const press = MATCH_TUNING.pressure[pressure];
  const lines = { DEF: 0, MED: 0, ATA: 0 };
  for (const p of squad) if (p.position in lines) lines[p.position]++;
  // Jogadores a menos (expulsão, lesão sem troca). Onze incompleto → 0.
  const missing = squad.length >= MIN_FIELD_FOR_SHAPE + 1 ? Math.max(0, 11 - squad.length) : 0;

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

  // Moral de equipa (1–50, neutro 25): desvia o ataque ±10% e a defesa ±5%
  // em torno de 25. Deliberadamente pequeno — a forma ajusta, não decide.
  const moraleAttackFactor = 1 + (morale - 25) * MATCH_TUNING.moraleAttackPerPoint;
  const moraleDefenseFactor = 1 + (morale - 25) * MATCH_TUNING.moraleDefensePerPoint;

  const avgForm = average(squad.map((p) => p.form ?? FORM_NEUTRAL));
  // Forma (1–50, neutro 32): de 0.75 (em baixo de forma) a 1.35 (no auge).
  // Antes 0.85–1.15 — a forma máxima notava-se a mal (~+4pp de vitórias).
  const formFactor = Math.max(0.75, Math.min(1.35, avgForm / FORM_NEUTRAL));

  // Moral individual (1–50, neutro 25): a média do plantel desvia
  // ataque e defesa ±5%. Pesa menos que a forma — ajusta, não decide.
  const avgMorale = average(squad.map((p) => p.morale ?? MORALE_NEUTRAL));
  const playerMoraleFactor =
    1 + (avgMorale - MORALE_NEUTRAL) * MATCH_TUNING.moralePlayerPerPoint;

  // Hatrick-style: o ataque é o dos avançados (médios contam só via posse,
  // ver computePossession). A defesa mantém a parede DEF+GR — médias, para o
  // nº de jogadores não pesar na resolução da chance.
  const attackBase = avgForwardQuality;
  const defenseBase = avgDefenderQuality * 0.6 + avgKeeperQuality * 0.4;

  const familiarityAttackFactor = 1 + familiarityBonus;
  const familiarityDefenseFactor = 1 + familiarityBonus * 0.5;

  // Ambiente da bancada (só equipa da casa recebe ≠ 1): o ataque sente tudo,
  // a defesa metade — a festa empurra para a frente, não organiza atrás.
  const crowdAttackFactor = crowdFactor;
  const crowdDefenseFactor = 1 + (crowdFactor - 1) / 2;

  return {
    attack:
      attackBase *
      formationAttack *
      moraleAttackFactor *
      playerMoraleFactor *
      STYLE_ATTACK_FACTORS[style] *
      formFactor *
      familiarityAttackFactor *
      crowdAttackFactor *
      press.attack,
    defense:
      defenseBase *
      formationDefense *
      moraleDefenseFactor *
      playerMoraleFactor *
      STYLE_DEFENSE_FACTORS[style] *
      formFactor *
      familiarityDefenseFactor *
      crowdDefenseFactor *
      MATCH_TUNING.shortHandedDefenseMult ** missing *
      press.defense,
    style,
    squad,
    midStrength: avgMidfielderQuality,
    formation,
    missing,
    pressure,
    lines,
    possessionTilt: lines.MED * MATCH_TUNING.duelPossePerMed + press.posse,
  };
}

/**
 * Posse da equipa A (0.30–0.70) a partir dos médios + estilo — hatrick-style.
 * Médios melhores → mais posse (diferença em % da média dos dois, para pesar
 * o mesmo em todas as divisões); OFENSIVO tem a bola, DEFENSIVO cede-a.
 * `extraA/extraB`: inclinações extra de cada lado (SidePower.possessionTilt:
 * superioridade no meio-campo + pressão) — só a diferença conta.
 */
export function computePossession(
  midA: number,
  midB: number,
  styleA: string,
  styleB: string,
  extraA = 0,
  extraB = 0,
): number {
  const tiltA = STYLE_POSSESSION_FACTORS[normaliseStyle(styleA)] ?? 0;
  const tiltB = STYLE_POSSESSION_FACTORS[normaliseStyle(styleB)] ?? 0;
  const midAvg = (midA + midB) / 2;
  const raw =
    0.5 +
    (midAvg > 0 ? ((midA - midB) / midAvg) * MATCH_TUNING.posseRelative : 0) +
    (tiltA - tiltB) * MATCH_TUNING.posseStyleDefensiva +
    (extraA - extraB);
  return Math.max(0.3, Math.min(0.7, raw));
}

/**
 * Duelo na finalização: avançados de quem ataca contra os defesas de quem
 * defende. Sobra de 2 defesas = neutro; menos sobra facilita, mais complica.
 */
export function duelConversionMult(attackers: number, defenders: number): number {
  const spare = defenders - attackers;
  const mult = 1 + MATCH_TUNING.duelConvPerPlayer * (MATCH_TUNING.duelSpareNeutral - spare);
  return Math.max(MATCH_TUNING.duelConvMin, Math.min(MATCH_TUNING.duelConvMax, mult));
}

/**
 * Contra-ataque: só quem joga DEFENSIVO o tem, e só contra quem se expõe —
 * estilo OFENSIVO e/ou pressão ALTA do adversário (somam).
 */
export function counterAttackConvMult(
  attackingStyle: unknown,
  defendingStyle: unknown,
  defendingPressure: unknown,
): number {
  if (normaliseStyle(attackingStyle) !== "DEFENSIVO") return 1;
  return (
    1 +
    (normaliseStyle(defendingStyle) === "OFENSIVO" ? MATCH_TUNING.counterVsOffensive : 0) +
    (normalisePressure(defendingPressure) === "ALTA" ? MATCH_TUNING.counterVsHighPress : 0)
  );
}

/**
 * Probabilidade de uma chance (criada pelo nº de posse) ser golo.
 * ATA (médio dos avançados, já com modificadores) contra a "parede"
 * DEF+GR — média vs média, logo o nº de jogadores não pesa.
 */
export function computeChanceGoalProbability(attack: number, defense: number): number {
  const a = attack || 1;
  const d = defense || 1;
  const p = MATCH_TUNING.chanceGoalBase * (a / (a + MATCH_TUNING.chanceDefWeight * d));
  return Math.max(MATCH_TUNING.chanceGoalMin, Math.min(MATCH_TUNING.chanceGoalMax, p));
}

/**
 * Probabilidade de golo em jogo corrido num minuto, para um lado.
 * Modelo antigo (contínuo por minuto) — mantido para a calibração
 * (scripts/engineCalibration.mts) e para regressões.
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
