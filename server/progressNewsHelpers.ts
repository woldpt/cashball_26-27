import { dbAllAsync, dbGetAsync } from "./game/dbAsync";
import { logClubNews, logClubNewsOnce, currentSlot } from "./coreHelpers";
import type { ActiveGame } from "./types";

// Notícias de evolução do Jornal: relatório semanal de treino (só `skill`),
// hat-tricks e marcos de golos de carreira. Corre depois do treino semanal;
// tudo idempotente (a finalização pode re-correr).

/** Golos de carreira que merecem notícia: múltiplos de 50. */
export const GOAL_MILESTONE_STEP = 50;
/** Golos num só jogo a partir dos quais há notícia de hat-trick. */
export const HATTRICK_GOALS = 3;

/** Maior limiar de golos de carreira já atingido (0 se ainda nenhum). */
export function goalMilestoneFor(careerGoals: number): number {
  return Math.floor(Math.max(0, careerGoals) / GOAL_MILESTONE_STEP) * GOAL_MILESTONE_STEP;
}

export interface HattrickRow {
  side: "home" | "away";
  playerId: number;
  playerName: string;
  goals: number;
}

/** Jogadores com 3+ golos no jogo (golos de penálti contam; auto-golos não). */
export function findHattricks(events: any[]): HattrickRow[] {
  const byKey = new Map<string, HattrickRow>();
  for (const e of Array.isArray(events) ? events : []) {
    if (e?.type !== "goal" && e?.type !== "penalty_goal") continue;
    if ((e.team !== "home" && e.team !== "away") || typeof e.playerId !== "number" || e.playerId <= 0) continue;
    const key = `${e.team}:${e.playerId}`;
    const row = byKey.get(key) ?? { side: e.team, playerId: e.playerId, playerName: e.playerName || "Jogador", goals: 0 };
    row.goals += 1;
    byKey.set(key, row);
  }
  return [...byKey.values()].filter((r) => r.goals >= HATTRICK_GOALS);
}

function humanTeamIds(game: ActiveGame): number[] {
  const ids = new Set<number>();
  for (const p of Object.values(game.playersByName || {}) as any[]) {
    if (p?.teamId != null) ids.add(p.teamId);
  }
  return [...ids];
}

/** Relatório semanal: quem subiu/desceu de `skill` face à semana anterior. */
async function logTrainingReports(game: ActiveGame, teamIds: number[], completedCalendarIndex: number) {
  if (completedCalendarIndex < 1 || teamIds.length === 0) return;
  const ph = teamIds.map(() => "?").join(",");
  const rows = await dbAllAsync<any>(
    game.db,
    `SELECT p.id, p.name, p.position, p.team_id, p.skill, s.skill AS prev_skill
       FROM players p
       JOIN player_skill_snapshots s ON s.player_id = p.id AND s.season = ? AND s.matchweek = ?
      WHERE p.team_id IN (${ph}) AND p.id > 0 AND p.skill != s.skill
      ORDER BY (p.skill - s.skill) DESC, p.name`,
    [game.season || 1, completedCalendarIndex, ...teamIds],
  );
  const byTeam = new Map<number, any[]>();
  for (const r of rows) byTeam.set(r.team_id, [...(byTeam.get(r.team_id) ?? []), r]);
  for (const [teamId, list] of byTeam) {
    logClubNewsOnce(game, "training_report", "Relatório de treino da semana", teamId, {
      description: JSON.stringify({
        v: 1,
        rows: list.map((r) => ({ id: r.id, name: r.name, position: r.position, from: r.prev_skill, to: r.skill })),
      }),
      slot: completedCalendarIndex + 1,
    });
  }
}

/** Hat-tricks do jogo + marcos de golos de carreira (equipas humanas). */
async function logGoalMilestones(game: ActiveGame, fixtures: any[], teamIds: number[]) {
  const slot = currentSlot(game);
  const isMine = (id: number) => teamIds.includes(id);
  for (const fx of fixtures || []) {
    for (const h of findHattricks(fx?.events)) {
      const teamId = h.side === "home" ? fx.homeTeamId : fx.awayTeamId;
      if (!isMine(teamId)) continue;
      const exists = await dbGetAsync<any>(
        game.db,
        `SELECT id FROM club_news WHERE type = 'milestone' AND player_id = ? AND year = ? AND slot = ? AND description LIKE '%"kind":"hattrick"%' LIMIT 1`,
        [h.playerId, game.year || 0, slot],
      );
      if (exists) continue;
      const opponentName = h.side === "home" ? fx.awayTeam?.name : fx.homeTeam?.name;
      logClubNews(game, "milestone", `🎩 Hat-trick de ${h.playerName}`, teamId, {
        player_id: h.playerId,
        player_name: h.playerName,
        description: JSON.stringify({ v: 1, kind: "hattrick", goals: h.goals, opponentName: opponentName ?? null }),
        slot,
      });
    }
  }
  if (teamIds.length === 0) return;
  const ph = teamIds.map(() => "?").join(",");
  const scorers = await dbAllAsync<any>(
    game.db,
    `SELECT id, name, team_id, career_goals FROM players WHERE team_id IN (${ph}) AND career_goals >= ?`,
    [...teamIds, GOAL_MILESTONE_STEP],
  );
  for (const p of scorers) {
    const threshold = goalMilestoneFor(p.career_goals);
    const exists = await dbGetAsync<any>(
      game.db,
      `SELECT id FROM club_news WHERE type = 'milestone' AND player_id = ? AND amount = ? LIMIT 1`,
      [p.id, threshold],
    );
    if (exists) continue;
    logClubNews(game, "milestone", `⚽ ${p.name} chega aos ${threshold} golos`, p.team_id, {
      player_id: p.id,
      player_name: p.name,
      amount: threshold,
      description: JSON.stringify({ v: 1, kind: "career_goals", goals: threshold }),
      slot,
    });
  }
}

/**
 * Chamado logo a seguir ao `applyTrainingBonuses`. Nunca rejeita: as
 * notícias são secundárias face ao resultado já comitado.
 */
export async function logProgressNews(game: ActiveGame, fixtures: any[], completedCalendarIndex: number): Promise<void> {
  try {
    const teamIds = humanTeamIds(game);
    await logTrainingReports(game, teamIds, completedCalendarIndex);
    await logGoalMilestones(game, fixtures, teamIds);
  } catch (err: any) {
    console.error(`[${game.roomCode}] progress news failed:`, err?.message ?? err);
  }
}
