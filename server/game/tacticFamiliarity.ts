// ── Memória Táctica (estrelas por jogo — regra fixa) ────────────────────────
// Regra fixa: cada jogo atribui uma estrela à formação utilizada. A partir do
// 5º jogo há sempre 5 estrelas distribuídas pelas últimas 5 formações usadas
// (janela rolante; a formação repetida acumula). As estrelas transitam entre
// épocas e os NPCs também beneficiam delas.
//
// Estado vive em memória no ActiveGame (game.tacticFamiliarity) e é persistido
// via saveGameState — a engine não lê a base de dados durante a simulação.

import type { ActiveGame } from "../types";

// ── Constantes de tuning ─────────────────────────────────────────────────────
const MAX_STARS = 5; // janela rolante das últimas 5 formações utilizadas
const MAX_BONUS = 0.05; // +5% ataque / +2.5% defesa no pico

const ALL_FORMATIONS = [
  "4-4-2", "4-3-3", "3-5-2", "5-3-2", "4-5-1", "3-4-3", "4-2-4", "5-4-1",
];

export const STYLES = ["EQUILIBRADO", "OFENSIVO", "DEFENSIVO"] as const;
export type StyleKey = (typeof STYLES)[number];

type TeamFamiliarity = {
  history: string[]; // formação mais recente primeiro, max 5
};

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
    game.tacticFamiliarity[teamId] = { history: [] };
  }
  return game.tacticFamiliarity[teamId];
}

/**
 * Estrelas por formação (0..5) — conta de ocorrências na janela das últimas
 * 5 formações utilizadas.
 */
function getFormationStars(
  game: ActiveGame,
  teamId: number,
): Record<string, number> {
  const stars: Record<string, number> = {};
  for (const formation of ALL_FORMATIONS) stars[formation] = 0;
  const fam = game.tacticFamiliarity?.[teamId];
  for (const formation of fam?.history ?? []) {
    if (stars[formation] != null) stars[formation] += 1;
  }
  return stars;
}

function bonusForStars(stars: number): number {
  return Math.round((MAX_BONUS * (stars / MAX_STARS)) * 1000) / 1000;
}

/**
 * Regista a formação usada num jogo (liga ou Taça): +1 estrela para essa
 * formação, mantendo a janela das últimas 5 formações.
 * Síncrono; apenas altera o estado em memória do jogo.
 */
export function updateTacticFamiliarity(
  game: ActiveGame,
  teamId: number,
  tactic: any,
  _matchweek: number,
  _result: string,
): void {
  const formation = String(tactic?.formation || "");
  if (!formation) return;

  const fam = ensureTeam(game, teamId);
  fam.history.unshift(formation);
  if (fam.history.length > MAX_STARS) fam.history.length = MAX_STARS;
}

/**
 * Bónus de familiaridade (0..MAX_BONUS) para uma formação — usado pela engine.
 * Síncrono, sem base de dados.
 */
export function getTacticBonus(
  game: ActiveGame,
  teamId: number,
  tactic: any,
): number {
  const formation = String(tactic?.formation || "");
  if (!formation) return 0;
  const stars = getFormationStars(game, teamId)[formation] ?? 0;
  return bonusForStars(stars);
}

/**
 * Familiaridade da formação actual do coach (para o socket "tacticFamiliarity").
 */
export function getTacticFamiliarity(
  game: ActiveGame,
  teamId: number,
  tactic: any,
) {
  const formation = String(tactic?.formation || "");
  const style = normaliseStyleKey(tactic?.style);
  const stars = getFormationStars(game, teamId)[formation] ?? 0;
  return {
    formation,
    style,
    score: round1(stars * 20),
    stars,
    bonus: bonusForStars(stars),
  };
}

/**
 * Familiaridade de todas as combinações formação+estilo (socket "allTacticFamiliarity").
 * As estrelas são por formação (o estilo não influencia a janela).
 */
export function getAllTacticFamiliarity(
  game: ActiveGame,
  teamId: number,
): Array<{ formation: string; style: string; score: number; stars: number; bonus: number }> {
  const starsMap = getFormationStars(game, teamId);
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
      entries.push({
        formation,
        style,
        score: round1(stars * 20),
        stars,
        bonus: bonusForStars(stars),
      });
    }
  }
  return entries;
}

/**
 * Migração one-shot: reconstrói a janela das últimas 5 formações a partir das
 * linhas ordenadas de player_tactic_history (mais recentes primeiro).
 */
export function migrateTacticFamiliarityFromHistory(
  game: ActiveGame,
  history: Array<{ team_id: number; formation: string }>,
): void {
  if (!history?.length) return;
  if (!game.tacticFamiliarity) game.tacticFamiliarity = {};
  const byTeam: Record<number, string[]> = {};
  for (const row of history) {
    if (!row?.formation) continue;
    const list = byTeam[row.team_id] ?? (byTeam[row.team_id] = []);
    if (list.length < MAX_STARS) list.push(row.formation);
  }
  for (const [teamId, list] of Object.entries(byTeam)) {
    game.tacticFamiliarity[Number(teamId)] = { history: list };
  }
}
