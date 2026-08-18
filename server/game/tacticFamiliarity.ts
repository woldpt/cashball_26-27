// ── Memória Táctica (habituação rápida) ──────────────────────────────────────
// Abordagem diferente da antiga contagem de jogos:
//   - A habituação é da FORMAÇÃO (o "shape"), o estilo é um modificador menor.
//   - Score contínuo 0..100 por formação e por estilo: ganha ao usar, decai
//     gradualmente ao não usar (nunca apaga registos).
//   - Rápida: 5 jogos seguidos com a mesma táctica = score 100 = 5 estrelas.
//   - Decay célere: -20/jogo → perde ~1 estrela por jogo sem usar.
//   - Resultados (V/E/D) modulam ligeiramente ganho/decay.
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

function starsFor(score: number): number {
  return Math.min(5, Math.floor(score / 20));
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
 * Síncrono, sem base de dados.
 */
export function getTacticBonus(
  game: ActiveGame,
  teamId: number,
  tactic: any,
): number {
  const formation = String(tactic?.formation || "");
  if (!formation) return 0;
  const fam = game.tacticFamiliarity?.[teamId];
  const score = combinedScore(fam, formation, normaliseStyleKey(tactic?.style));
  return Math.round((MAX_BONUS * (score / MAX_SCORE)) * 1000) / 1000;
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
  return {
    formation,
    style,
    score: round1(score),
    stars: starsFor(score),
    bonus: getTacticBonus(game, teamId, tactic),
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
  const formations = [
    "4-4-2", "4-3-3", "3-5-2", "5-3-2", "4-5-1", "3-4-3", "4-2-4", "5-4-1",
  ];
  const entries: Array<{
    formation: string;
    style: string;
    score: number;
    stars: number;
    bonus: number;
  }> = [];
  for (const formation of formations) {
    for (const style of STYLES) {
      const score = combinedScore(fam, formation, style);
      entries.push({
        formation,
        style,
        score: round1(score),
        stars: starsFor(score),
        bonus: Math.round((MAX_BONUS * (score / MAX_SCORE)) * 1000) / 1000,
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
