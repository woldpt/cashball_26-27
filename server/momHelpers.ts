/**
 * Persistência do MOM ("Jogador do Jogo") por equipa/partida.
 *
 * Factory (padrão do projeto): `const mom = createMomHelpers({ db });`
 *
 * Gravado na finalização de cada partida:
 *  - Liga: dentro do callback do `INSERT INTO matches` (matchSummaryHelpers).
 *  - Taça: dentro da transação da finalização de ronda (cupFlowHelpers).
 *
 * Idempotente (DELETE + INSERT por chave única) — seguro contra replay de
 * crash-restart (applied_weeks / recoverFinalizedSlot).
 */
import type { ActiveGame } from "./types";
import { computeMoms, MomPlayer } from "./game/mom";

interface MomHelpersDeps {
  db: any;
}

export function createMomHelpers({ db }: MomHelpersDeps) {
  function persistMoms(
    game: ActiveGame,
    fixture: any,
    competition: "League" | "Cup",
    matchweek: number | null,
    round: number | null,
  ): void {
    const moms = computeMoms(
      fixture?.events || [],
      fixture?.homeLineup || [],
      fixture?.awayLineup || [],
    );
    const season = game.season || 1;
    const rows: Array<{ teamId: number; mom: MomPlayer | null }> = [
      { teamId: fixture?.homeTeamId ?? 0, mom: moms.home },
      { teamId: fixture?.awayTeamId ?? 0, mom: moms.away },
    ];
    for (const r of rows) {
      if (!r.mom || !r.teamId) continue;
      db.run(
        "DELETE FROM match_moms WHERE season = ? AND competition = ? AND matchweek IS ? AND round IS ? AND team_id = ?",
        [season, competition, matchweek, round, r.teamId],
      );
      db.run(
        "INSERT INTO match_moms (season, competition, matchweek, round, team_id, player_id, player_name, score) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          season,
          competition,
          matchweek,
          round,
          r.teamId,
          r.mom.playerId,
          r.mom.playerName,
          r.mom.score,
        ],
      );
    }
  }

  return { persistMoms };
}
