import type { ActiveGame, PlayerSession } from "./types";

interface TrainingHandlersDeps {
  io: any;
}

export function createTrainingHandlers(deps: TrainingHandlersDeps) {
  const { io } = deps;

  function setTrainingFocus(game: ActiveGame, playerId: string, trainingFocus: string) {
    const player = game.playersByName[playerId];
    if (!player) return;

    game.db.run(
      "INSERT OR REPLACE INTO team_training (team_id, matchweek, training_focus) VALUES (?, ?, ?)",
      [player.teamId, game.matchweek, trainingFocus],
      (err: any) => {
        if (err) {
          console.error(`[${game.roomCode}] Error saving training focus:`, err);
          return;
        }

        io.to(game.roomCode).emit("trainingFocusUpdated", {
          teamId: player.teamId,
          trainingFocus,
          matchweek: game.matchweek,
        });
      },
    );
  }

  function getTrainingFocus(game: ActiveGame, teamId: number): Promise<string | null> {
    return new Promise((resolve) => {
      game.db.get(
        "SELECT training_focus FROM team_training WHERE team_id = ? AND matchweek = ? ORDER BY matchweek DESC LIMIT 1",
        [teamId, game.matchweek],
        (err: any, row: any) => {
          if (err || !row) {
            resolve(null);
            return;
          }
          resolve(row.training_focus);
        },
      );
    });
  }

  function getTrainingHistory(game: ActiveGame, teamId: number, matchweek: number): Promise<any[]> {
    return new Promise((resolve) => {
      game.db.all(
        `SELECT
          p.id as player_id,
          p.name as player_name,
          p.position,
          tph.attribute,
          tph.old_value,
          tph.new_value
         FROM training_player_history tph
         JOIN players p ON p.id = tph.player_id
         WHERE tph.team_id = ? AND tph.matchweek = ?
         ORDER BY p.position, p.name`,
        [teamId, matchweek],
        (err: any, rows: any[]) => {
          if (err || !rows) {
            resolve([]);
            return;
          }
          resolve(rows);
        },
      );
    });
  }

  return {
    setTrainingFocus,
    getTrainingFocus,
    getTrainingHistory,
  };
}
