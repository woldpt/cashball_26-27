import type { ActiveGame } from "./types";

interface TrainingHelpersDeps {
  io: any;
}

type PositionMap = "GR" | "DEF" | "MED" | "ATA";

const POSITION_ABBREVIATIONS: Record<string, PositionMap> = {
  GR: "GR",
  DEF: "DEF",
  Defesa: "DEF",
  MED: "MED",
  Médio: "MED",
  ATA: "ATA",
  Avançado: "ATA",
};

export function createTrainingHelpers(deps: TrainingHelpersDeps) {
  const { io } = deps;

  async function applyTrainingBonuses(
    game: ActiveGame,
    fixtures: any[],
    matchweek: number,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      // Get all teams with their training focus for this matchweek
      game.db.all(
        "SELECT team_id, training_focus FROM team_training WHERE matchweek = ?",
        [matchweek],
        (err: any, trainings: any[]) => {
          if (err || !trainings || trainings.length === 0) {
            resolve();
            return;
          }

          const trainingByTeam = new Map(
            trainings.map((t) => [t.team_id, t.training_focus]),
          );

          // Get all players who played in the fixtures
          const playerIds = new Set<number>();
          for (const fixture of fixtures || []) {
            const homeLineup = fixture.homeLineup
              ? JSON.parse(typeof fixture.homeLineup === "string" ? fixture.homeLineup : JSON.stringify(fixture.homeLineup))
              : [];
            const awayLineup = fixture.awayLineup
              ? JSON.parse(typeof fixture.awayLineup === "string" ? fixture.awayLineup : JSON.stringify(fixture.awayLineup))
              : [];

            homeLineup.forEach((p: any) => playerIds.add(p.id));
            awayLineup.forEach((p: any) => playerIds.add(p.id));
          }

          if (playerIds.size === 0) {
            resolve();
            return;
          }

          // Get player details
          game.db.all(
            `SELECT id, team_id, position, skill, form, resistance FROM players WHERE id IN (${Array(playerIds.size)
              .fill("?")
              .join(",")})`,
            Array.from(playerIds),
            (err: any, players: any[]) => {
              if (err || !players) {
                resolve();
                return;
              }

              const updates: any[] = [];
              const histories: any[] = [];

              for (const player of players) {
                const trainingFocus = trainingByTeam.get(player.team_id);
                if (!trainingFocus) continue;

                const posAbr = POSITION_ABBREVIATIONS[player.position] || null;

                // Determine if this player gets a bonus
                const getsBonus =
                  (trainingFocus === "Forma" && player.form !== undefined) ||
                  (trainingFocus === "Resistência" && player.resistance !== undefined) ||
                  (trainingFocus === "GR" && posAbr === "GR") ||
                  (trainingFocus === "Defesas" && posAbr === "DEF") ||
                  (trainingFocus === "Médios" && posAbr === "MED") ||
                  (trainingFocus === "Avançados" && posAbr === "ATA");

                if (!getsBonus) continue;

                if (trainingFocus === "Forma" && player.form !== undefined) {
                  const newForm = Math.min(100, player.form + 10);
                  updates.push({
                    playerId: player.id,
                    field: "form",
                    oldValue: player.form,
                    newValue: newForm,
                  });
                  histories.push({
                    playerId: player.id,
                    teamId: player.team_id,
                    matchweek,
                    attribute: "form",
                    oldValue: player.form,
                    newValue: newForm,
                  });
                } else if (trainingFocus === "Resistência" && player.resistance !== undefined) {
                  const newResistance = Math.min(5, player.resistance + 0.2);
                  updates.push({
                    playerId: player.id,
                    field: "resistance",
                    oldValue: player.resistance,
                    newValue: newResistance,
                  });
                  histories.push({
                    playerId: player.id,
                    teamId: player.team_id,
                    matchweek,
                    attribute: "resistance",
                    oldValue: player.resistance,
                    newValue: newResistance,
                  });
                } else if (posAbr && ["GR", "DEF", "MED", "ATA"].includes(trainingFocus)) {
                  const newSkill = Math.min(99, player.skill + 0.5);
                  updates.push({
                    playerId: player.id,
                    field: "skill",
                    oldValue: player.skill,
                    newValue: newSkill,
                  });
                  histories.push({
                    playerId: player.id,
                    teamId: player.team_id,
                    matchweek,
                    attribute: "skill",
                    oldValue: player.skill,
                    newValue: newSkill,
                  });
                }
              }

              if (updates.length === 0) {
                resolve();
                return;
              }

              // Apply updates
              let remaining = updates.length + histories.length;
              game.db.serialize(() => {
                updates.forEach((upd) => {
                  game.db.run(
                    `UPDATE players SET ${upd.field} = ? WHERE id = ?`,
                    [upd.newValue, upd.playerId],
                    () => {
                      remaining -= 1;
                      if (remaining === 0) resolve();
                    },
                  );
                });

                histories.forEach((hist) => {
                  game.db.run(
                    "INSERT INTO training_player_history (player_id, team_id, matchweek, attribute, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)",
                    [hist.playerId, hist.teamId, hist.matchweek, hist.attribute, hist.oldValue, hist.newValue],
                    () => {
                      remaining -= 1;
                      if (remaining === 0) resolve();
                    },
                  );
                });
              });
            },
          );
        },
      );
    });
  }

  return {
    applyTrainingBonuses,
  };
}
