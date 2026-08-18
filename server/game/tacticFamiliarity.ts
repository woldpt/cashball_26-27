// ── Memória Táctica (habituação rápida e concentrada) ────────────────────────
// Abordagem diferente da antiga contagem de jogos:
//   - A habituação é da FORMAÇÃO (o "shape"), o estilo é um modificador menor.
//   - Score contínuo 0..100 por formação e por estilo: ganha ao usar, decai
//     gradualmente ao não usar (nunca apaga registos).
//   - Rápida: 5 jogos seguidos com a mesma táctica = score 100 = 5 estrelas.
//   - Decay célere: -20/jogo → perde ~1 estrela por jogo sem usar.
//   - Resultados (V/E/D) modulam ligeiramente ganho/decay.
//   - CONCENTRADA: as estrelas partilham um pool máximo de 5, alocado por score
//     relativo entre formações. Uma táctica dominante fica com 5 estrelas e
//     todas as outras com 0 — o bónus da engine segue essa concentração.
// Estado vive em memória no ActiveGame (game.tacticFamiliarity) e é persistido
// via saveGameState — a engine já não lê a base de dados durante a simulação.

import type { ActiveGame } from "../types";

// ── Constantes de tuning ─────────────────────────────────────────────────────
const MAX_SCORE = 100;
const FORMATION_GAIN = 20; // por jogo usado (5 jogos → 5 estrelas)
const STYLE_GAIN = 20;
const DECAY = 20; // por jogo não usado (célere)
const MAX_BONUS = 0.05; // +5% ataque / +2.5% defesa no pico
const FORMATION_WEIGHT = 0.7; // habituação é primariamente da formação
const STYLE_WEIGHT = 0.3;
const MAX_STARS = 5; // pool máximo de estrelas partilhado entre todas as tácticas

const ALL_FORMATIONS = [
  "4-4-2", "4-3-3", "3-5-2", "5-3-2", "4-5-1", "3-4-3", "4-2-4", "5-4-1",
];

// Moduladores de resultado (V = vitória, E = empate, D = derrota)
const RESULT_GAIN_MOD = { V: 1.5, E: 1.0, D: 0.7 };
const RESULT_DECAY_MOD = { V: 0.7, E: 1.0, D: 1.3 };

export const STYLES = ["EQUILIBRADO", "OFENSIVO", "DEFENSIVO"] as const;
export type StyleKey = (typeof STYLES)[number];

type TeamFamiliarity = {
  formations: Record<string, number>;
  styles: Record<string, number>;
};

const clamp = (v: number) => Math.max(0, Math.min(MAX_SCORE, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

function normaliseStyleKey(style: unknown): StyleKey {
  const raw = String(style || "EQUILIBRADO").trim().toUpperCase();
  if (raw === "OFENSIVO" || raw === "OFFENSIVE") return "OFENSIVO";
  if (raw === "DEFENSIVO" || raw === "DEFENSIVE") return "DEFENSIVO";
  return "EQUILIBRADO";
}

function ensureTeam(game: ActiveGame, teamId: number): TeamFamiliarity {
  if (!game.tacticFamiliarity) game.tacticFamiliarity = {};
  if (!game.tacticFamiliarity[teamId]) {
    game.tacticFamiliarity[teamId] = { formations: {}, styles: {} };
  }
  return game.tacticFamiliarity[teamId];
}

/**
 * Soma ponderada formação+estilo (0..100) para uma táctica concreta.
 */
function combinedScore(
  fam: TeamFamiliarity | undefined,
  formation: string,
  style: StyleKey,
): number {
  if (!fam) return 0;
  const f = fam.formations[formation] ?? 0;
  const s = fam.styles[style] ?? 0;
  return FORMATION_WEIGHT * f + STYLE_WEIGHT * s;
}

/**
 * Score de habituação de cada formação.
 * Usa apenas o score da FORMAÇÃO — o estilo é global por equipa e vazaria a
 * mesma componente 0.3 para todas as formações, diluindo a concentração.
 */
function getFormationScores(
  game: ActiveGame,
  teamId: number,
): Record<string, number> {
  const fam = game.tacticFamiliarity?.[teamId];
  const scores: Record<string, number> = {};
  for (const formation of ALL_FORMATIONS) {
    scores[formation] = fam?.formations?.[formation] ?? 0;
  }
  return scores;
}

/**
 * Aloca o pool de estrelas (máx 5) entre as formações, proporcional ao score.
 * Pool = min(5, floor(totalScore/20)) → 5 jogos seguidos atingem o máximo.
 * Uma táctica dominante fica com 5 estrelas e todas as outras com 0.
 */
function allocateFormationStars(
  game: ActiveGame,
  teamId: number,
): Record<string, number> {
  const allocated: Record<string, number> = {};
  for (const f of ALL_FORMATIONS) allocated[f] = 0;

  const scores = getFormationScores(game, teamId);
  const total = ALL_FORMATIONS.reduce((acc, f) => acc + scores[f], 0);
  if (total <= 0) return allocated;

  const pool = Math.min(MAX_STARS, Math.floor(total / 20));
  if (pool <= 0) return allocated;

  // Base = parte inteira da quota; sobras distribuem-se por maior resto
  const entries = ALL_FORMATIONS.filter((f) => scores[f] > 0).map((f) => {
    const quota = (pool * scores[f]) / total;
    return { f, base: Math.floor(quota), rem: quota - Math.floor(quota) };
  });

  let remaining = pool;
  for (const e of entries) {
    allocated[e.f] = e.base;
    remaining -= e.base;
  }
  entries.sort((a, b) => b.rem - a.rem);
  for (const e of entries) {
    if (remaining <= 0) break;
    allocated[e.f] += 1;
    remaining -= 1;
  }
  return allocated;
}

function bonusForStars(stars: number): number {
  return Math.round((MAX_BONUS * (stars / MAX_STARS)) * 1000) / 1000;
}

/**
 * Inicializa o estado de familiaridade no objecto de jogo.
 */
export function initTacticFamiliarity(game: ActiveGame): void {
  game.tacticFamiliarity = game.tacticFamiliarity || {};
}

/**
 * Atualiza a memória táctica de uma equipa após um jogo (liga ou Taça).
 * - A formação/estilo usado ganham score (modulado pelo resultado).
 * - Todas as outras formações/estilos decaem (modulado pelo resultado).
 * Síncrono; apenas altera o estado em memória do jogo.
 */
export function updateTacticFamiliarity(
  game: ActiveGame,
  teamId: number,
  tactic: any,
  _matchweek: number,
  result: string,
): void {
  const formation = String(tactic?.formation || "");
  const style = normaliseStyleKey(tactic?.style);
  if (!formation) return;

  const fam = ensureTeam(game, teamId);
  const gainMod = RESULT_GAIN_MOD[result] ?? 1.0;
  const decayMod = RESULT_DECAY_MOD[result] ?? 1.0;

  // Ganho para a táctica usada
  fam.formations[formation] = clamp(
    (fam.formations[formation] ?? 0) + FORMATION_GAIN * gainMod,
  );
  fam.styles[style] = clamp((fam.styles[style] ?? 0) + STYLE_GAIN * gainMod);

  // Decay para as restantes
  for (const key of Object.keys(fam.formations)) {
    if (key === formation) continue;
    fam.formations[key] = clamp((fam.formations[key] ?? 0) - DECAY * decayMod);
  }
  for (const key of Object.keys(fam.styles)) {
    if (key === style) continue;
    fam.styles[key] = clamp((fam.styles[key] ?? 0) - DECAY * decayMod);
  }
}

/**
 * Bónus de familiaridade (0..MAX_BONUS) para uma táctica — usado pela engine.
 * Segue a concentração: só as formações com estrelas alocadas têm bónus.
 * Síncrono, sem base de dados.
 */
export function getTacticBonus(
  game: ActiveGame,
  teamId: number,
  tactic: any,
): number {
  const formation = String(tactic?.formation || "");
  if (!formation) return 0;
  const stars = allocateFormationStars(game, teamId)[formation] ?? 0;
  return bonusForStars(stars);
}

/**
 * Familiaridade da táctica actual do coach (para o socket "tacticFamiliarity").
 */
export function getTacticFamiliarity(
  game: ActiveGame,
  teamId: number,
  tactic: any,
) {
  const formation = String(tactic?.formation || "");
  const style = normaliseStyleKey(tactic?.style);
  const fam = game.tacticFamiliarity?.[teamId];
  const score = combinedScore(fam, formation, style);
  const stars = allocateFormationStars(game, teamId)[formation] ?? 0;
  return {
    formation,
    style,
    score: round1(score),
    stars,
    bonus: bonusForStars(stars),
  };
}

/**
 * Familiaridade de todas as combinações formação+estilo (socket "allTacticFamiliarity").
 */
export function getAllTacticFamiliarity(
  game: ActiveGame,
  teamId: number,
): Array<{ formation: string; style: string; score: number; stars: number; bonus: number }> {
  const fam = game.tacticFamiliarity?.[teamId];
  const starsMap = allocateFormationStars(game, teamId);
  const entries: Array<{
    formation: string;
    style: string;
    score: number;
    stars: number;
    bonus: number;
  }> = [];
  for (const formation of ALL_FORMATIONS) {
    const stars = starsMap[formation] ?? 0;
    for (const style of STYLES) {
      const score = combinedScore(fam, formation, style);
      entries.push({
        formation,
        style,
        score: round1(score),
        stars,
        bonus: bonusForStars(stars),
      });
    }
  }
  return entries;
}

/**
 * Migração one-shot: converte contagens da antiga player_tactic_history
 * em scores do novo modelo (formação = total de jogos da formação ×20,
 * estilo = total de jogos do estilo ×20), cap 100.
 */
export function migrateTacticFamiliarityFromHistory(
  game: ActiveGame,
  history: Array<{ team_id: number; formation: string; style: string; cnt: number }>,
): void {
  if (!history?.length) return;
  const byTeam: Record<number, TeamFamiliarity> = {};
  for (const row of history) {
    if (!byTeam[row.team_id]) byTeam[row.team_id] = { formations: {}, styles: {} };
    byTeam[row.team_id].formations[row.formation] =
      (byTeam[row.team_id].formations[row.formation] ?? 0) + row.cnt;
    const styleKey = normaliseStyleKey(row.style);
    byTeam[row.team_id].styles[styleKey] =
      (byTeam[row.team_id].styles[styleKey] ?? 0) + row.cnt;
  }
  for (const [teamId, fam] of Object.entries(byTeam)) {
    for (const key of Object.keys(fam.formations)) {
      fam.formations[key] = clamp(fam.formations[key] * FORMATION_GAIN);
    }
    for (const key of Object.keys(fam.styles)) {
      fam.styles[key] = clamp(fam.styles[key] * STYLE_GAIN);
    }
  }
  game.tacticFamiliarity = Object.fromEntries(
    Object.entries(byTeam).map(([teamId, fam]) => [Number(teamId), fam]),
  );
}
