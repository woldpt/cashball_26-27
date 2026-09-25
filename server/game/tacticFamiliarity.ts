// ── Memória Táctica (estrelas por jogo — regra fixa) ────────────────────────
// Regra fixa: cada jogo atribui uma estrela à formação utilizada, dividida em
// 50% para a escolha da 1.ª parte + 50% para a escolha da 2.ª parte. A partir
// do 5º jogo há sempre 5 estrelas distribuídas pelas últimas 5 formações usadas
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
  // Entrada por jogo: string legada (1 estrela inteira, antes do split) ou
  // par 1.ª/2.ª parte (0.5 + 0.5 estrelas). Janela rolante dos últimos 5 jogos.
  history: Array<string | { first: string; second: string }>;
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
 * Estrelas por formação (0..5, passos de 0.5) — soma ponderada na janela dos
 * últimos 5 jogos: entrada legada = 1 estrela; par 1.ª/2.ª parte = 0.5 + 0.5.
 */
function getFormationStars(
  game: ActiveGame,
  teamId: number,
): Record<string, number> {
  const stars: Record<string, number> = {};
  for (const formation of ALL_FORMATIONS) stars[formation] = 0;
  const fam = game.tacticFamiliarity?.[teamId];
  for (const entry of fam?.history ?? []) {
    if (typeof entry === "string") {
      if (stars[entry] != null) stars[entry] += 1;
    } else {
      if (stars[entry.first] != null) stars[entry.first] += 0.5;
      if (stars[entry.second] != null) stars[entry.second] += 0.5;
    }
  }
  return stars;
}

function bonusForStars(stars: number): number {
  return Math.round((MAX_BONUS * (stars / MAX_STARS)) * 1000) / 1000;
}

/**
 * Regista as formações usadas num jogo (liga, Taça ou amigável): 0.5 estrelas
 * para a escolha da 1.ª parte + 0.5 para a da 2.ª parte, mantendo a janela
 * dos últimos 5 jogos. Sem 2.ª parte distinta (mesma formação), equivale à
 * estrela inteira de antes. Síncrono; apenas altera o estado em memória.
 */
export function updateTacticFamiliarity(
  game: ActiveGame,
  teamId: number,
  firstTactic: any,
  secondTactic: any,
  _matchweek: number,
  _result: string,
): void {
  const first = String(firstTactic?.formation || secondTactic?.formation || "");
  const second = String(secondTactic?.formation || firstTactic?.formation || "");
  if (!first) return;

  const fam = ensureTeam(game, teamId);
  fam.history.unshift({ first, second });
  if (fam.history.length > MAX_STARS) fam.history.length = MAX_STARS;
}

/**
 * Familiaridade dividida 50/50 entre a escolha da 1.ª parte e a da 2.ª parte
 * (só leitura — a fórmula do bónus se mantém). Sem 2.ª parte distinta, usa a
 * 1.ª nas duas metades. Síncrono, sem base de dados.
 */
export function getSplitFamiliarity(
  game: ActiveGame,
  teamId: number,
  firstTactic: any,
  secondTactic?: any,
) {
  const first = String(firstTactic?.formation || secondTactic?.formation || "");
  const second = String(secondTactic?.formation || firstTactic?.formation || "");
  const starsMap = getFormationStars(game, teamId);
  const firstStars = starsMap[first] ?? 0;
  const secondStars = starsMap[second] ?? 0;
  // ponytail: média direta, sem pesos configuráveis — o 50/50 é regra fixa
  const stars = (firstStars + secondStars) / 2;
  return {
    first: { formation: first, stars: firstStars, score: round1(firstStars * 20) },
    second: { formation: second, stars: secondStars, score: round1(secondStars * 20) },
    stars,
    score: round1(stars * 20),
    bonus: bonusForStars(stars),
  };
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
