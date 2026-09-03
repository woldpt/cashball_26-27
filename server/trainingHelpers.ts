import type { ActiveGame } from "./types";
import {
  recalcPlayerValue,
  FORM_NEUTRAL,
  FORM_MIN,
  FORM_MAX,
  RES_NEUTRAL,
  RES_MIN,
  RES_MAX,
} from "./gameConstants";

/**
 * Training bonuses application.
 *
 * Bonuses (only for players that appeared in a fixture lineup):
 *  - Position focus (GR/Defesas/Médios/Avançados): skill gain with diminishing
 *    returns — the closer to potential the slower, high form boosts learning,
 *    and each skill point costs more progress as skill rises (ceil(skill/10)).
 *  - Forma:        +6 form (direct, INTEGER column tolerates this)
 *  - Resistência:  +4.9 resistance (accumulator, 1.0 = 1 ponto)
 *
 * Physical dynamics (per calendar event, whole squad, junior GRs excluded):
 *  - Not training Forma:
 *      · played  → gradient decay (the lower the form, the slower the drop)
 *      · rested  → +2 recovery (rotation keeps the squad fresh)
 *  - Not training Resistência (deliberately slower than the training gain so
 *    neglect takes longer to noticeably harm stamina):
 *      · played  → -1.84 resistance progress
 *      · rested  → -0.61 resistance progress
 *
 * Skill and resistance use accumulator columns (training_skill_progress,
 * training_resistance_progress) because the underlying columns are INTEGER —
 * adding 1.0/4.9 directly would be silently truncated by SQLite.
 *
 * Market value is recalculated whenever skill changes (skill² × 500). Wages
 * are NEVER touched here — they only change on a new contract (buy/renewal).
 *
 * Rust/age-free decline of unused players is handled in the post-match
 * evolution (engine.ts applyPostMatchQualityEvolution), not here.
 */
export function createTrainingHelpers(_deps: { io: any }) {
  async function applyTrainingBonuses(
    game: ActiveGame,
    fixtures: any[],
    completedCalendarIndex: number,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      game.db.all(
        "SELECT team_id, training_focus FROM team_training WHERE matchweek = ? AND applied = 0",
        [completedCalendarIndex],
        async (err: any, trainings: any[]) => {
          if (err) {
            console.error(`[${game.roomCode}] training: failed to load team_training:`, err);
            resolve();
            return;
          }

          const trainingByTeam = new Map<number, string>(
            (trainings || []).map((t) => [t.team_id, t.training_focus]),
          );

          // Carry-forward: for teams with prior training history but no row for the
          // current matchweek, copy their most recent focus. This makes the focus
          // recurrent without requiring the client to re-open the training UI.
          await carryForwardMissingFocus(game, completedCalendarIndex, trainingByTeam);

          const teamIds = Array.from(trainingByTeam.keys());
          if (teamIds.length === 0) {
            resolve();
            return;
          }

          // Collect ids of players that appeared in a fixture (positive ids only,
          // junior GRs use negative ids) — these receive the training bonus.
          const playedPlayerIds = new Set<number>();
          for (const fixture of fixtures || []) {
            const home = Array.isArray(fixture.homeLineup) ? fixture.homeLineup : [];
            const away = Array.isArray(fixture.awayLineup) ? fixture.awayLineup : [];
            for (const p of home) if (typeof p?.id === "number" && p.id > 0) playedPlayerIds.add(p.id);
            for (const p of away) if (typeof p?.id === "number" && p.id > 0) playedPlayerIds.add(p.id);
          }

          // Load the ENTIRE squad of the teams with a focus: bonuses only reach
          // players that played, but the decay of untrained attributes (form /
          // resistance) affects the whole squad.
          const teamPlaceholders = teamIds.map(() => "?").join(",");
          game.db.all(
            `SELECT id, team_id, position, skill, form, resistance, potential,
                    training_skill_progress AS skill_progress,
                    training_resistance_progress AS resistance_progress
             FROM players
             WHERE team_id IN (${teamPlaceholders})`,
            teamIds,
            (err2: any, players: any[]) => {
              if (err2) {
                console.error(`[${game.roomCode}] training: failed to load players:`, err2);
                resolve();
                return;
              }
              if (!players || players.length === 0) {
                markApplied(game, teamIds, completedCalendarIndex, resolve);
                return;
              }

              type PlayerUpdate = {
                playerId: number;
                fields: Record<string, number>;
                history: Array<{
                  attribute: string;
                  oldValue: number;
                  newValue: number;
                  delta: number;
                  focus: string;
                }>;
                teamId: number;
              };
              const updates: PlayerUpdate[] = [];

              for (const player of players) {
                const focus = trainingByTeam.get(player.team_id);
                if (!focus) continue;

                const upd: PlayerUpdate = {
                  playerId: player.id,
                  fields: {},
                  history: [],
                  teamId: player.team_id,
                };

                const played = playedPlayerIds.has(player.id);

                // ── Training bonus (only players that appeared in a fixture) ──
                if (played) {
                  if (focus === "Forma") {
                    const oldForm = player.form ?? FORM_NEUTRAL;
                    const newForm = Math.min(FORM_MAX, oldForm + 6);
                    if (newForm !== oldForm) {
                      upd.fields.form = newForm;
                      upd.history.push({
                        attribute: "form",
                        oldValue: oldForm,
                        newValue: newForm,
                        delta: newForm - oldForm,
                        focus,
                      });
                    }
                  } else if (focus === "Resistência") {
                    const oldRes = player.resistance ?? RES_NEUTRAL;
                    const oldProg = player.resistance_progress ?? 0;
                    let newProg = oldProg + 4.9;
                    let newRes = oldRes;
                    while (newProg >= 1.0 && newRes < RES_MAX) {
                      newRes += 1;
                      newProg -= 1.0;
                    }
                    if (newRes >= RES_MAX) newProg = 0; // cap progress at the ceiling
                    upd.fields.training_resistance_progress = Math.round(newProg * 100) / 100;
                    if (newRes !== oldRes) upd.fields.resistance = newRes;
                    upd.history.push({
                      attribute: "resistance",
                      oldValue: oldRes,
                      newValue: newRes,
                      delta: 4.9,
                      focus,
                    });
                  } else {
                    // Position focus
                    const targetPos =
                      focus === "GR" ? "GR" :
                      focus === "Defesas" ? "DEF" :
                      focus === "Médios" ? "MED" :
                      focus === "Avançados" ? "ATA" : null;
                    if (targetPos && player.position === targetPos) {
                      const skillCap =
                        player.potential != null
                          ? Math.min(50, player.potential)
                          : 50;
                      const oldSkill = player.skill ?? 0;
                      const oldProg = player.skill_progress ?? 0;

                      // Retornos decrescentes: perto do teto de potencial a
                      // evolução abranda; forma baixa penaliza a assimilação.
                      const room = Math.max(0, skillCap - oldSkill);
                      const potentialFactor =
                        0.5 + 0.5 * (room / Math.max(1, skillCap));
                      const formFactor = Math.min(
                        1.15,
                        Math.max(0.5, 0.5 + 0.5 * ((player.form ?? FORM_NEUTRAL) / FORM_NEUTRAL)),
                      );
                      const gain = 2.5 * potentialFactor * formFactor;
                      // Quanto maior o skill, mais progresso é preciso por ponto.
                      const progressNeeded = Math.max(1, Math.ceil(oldSkill / 10));

                      let newProg = oldProg + gain;
                      let newSkill = oldSkill;
                      while (newProg >= progressNeeded && newSkill < skillCap) {
                        newSkill += 1;
                        newProg -= progressNeeded;
                      }
                      if (newSkill >= skillCap) newProg = 0;
                      upd.fields.training_skill_progress =
                        Math.round(newProg * 100) / 100;
                      if (newSkill !== oldSkill) {
                        upd.fields.skill = newSkill;
                        upd.fields.value = recalcPlayerValue(newSkill);
                      }
                      upd.history.push({
                        attribute: "skill",
                        oldValue: oldSkill,
                        newValue: newSkill,
                        delta: Math.round(gain * 100) / 100,
                        focus,
                      });
                    }
                  }
                }

                // ── Decay: untrained attributes worsen over time (whole squad) ──
                // Junior GRs (negative ids) are excluded.
                if (player.id > 0) {
                  if (focus !== "Forma") {
                    const oldForm = player.form ?? FORM_NEUTRAL;
                    if (!played) {
                      // Descanso: quem não jogou e não treina Forma recupera
                      // suavemente em vez de decair (rotação mantém o plantel fresco)
                      const newForm = Math.min(FORM_MAX, oldForm + 2);
                      if (newForm !== oldForm) {
                        upd.fields.form = newForm;
                        upd.history.push({
                          attribute: "form",
                          oldValue: oldForm,
                          newValue: newForm,
                          delta: newForm - oldForm,
                          focus,
                        });
                      }
                    } else {
                      // Decaimento com gradiente: quanto mais baixa a forma,
                      // menos decai (efeito piso no 1)
                      const decay = Math.max(1, Math.round((oldForm - FORM_MIN) * 0.08));
                      const newForm = Math.max(FORM_MIN, oldForm - decay);
                      if (newForm !== oldForm) {
                        upd.fields.form = newForm;
                        upd.history.push({
                          attribute: "form",
                          oldValue: oldForm,
                          newValue: newForm,
                          delta: newForm - oldForm,
                          focus,
                        });
                      }
                    }
                  }

                  if (focus !== "Resistência") {
                    const oldRes = player.resistance ?? RES_NEUTRAL;
                    const oldProg = player.resistance_progress ?? 0;
                    // Quem jogou desgasta mais; quem descansa perde menos.
                    // Decaimento propositadamente lento para a resistência não
                    // minguar depressa sem treino.
                    const resLoss = played ? -1.84 : -0.61;
                    let newProg = oldProg + resLoss;
                    let newRes = oldRes;
                    while (newProg < 0 && newRes > RES_MIN) {
                      newRes -= 1;
                      newProg += 1.0;
                    }
                    if (newRes <= RES_MIN && newProg < 0) newProg = 0; // clamp at floor
                    newProg = Math.round(newProg * 100) / 100;
                    upd.fields.training_resistance_progress = newProg;
                    if (newRes !== oldRes) upd.fields.resistance = newRes;
                    upd.history.push({
                      attribute: "resistance",
                      oldValue: oldRes,
                      newValue: newRes,
                      delta: resLoss,
                      focus,
                    });
                  }
                }

                if (Object.keys(upd.fields).length > 0 || upd.history.length > 0) {
                  updates.push(upd);
                }
              }

              if (updates.length === 0) {
                markApplied(game, teamIds, completedCalendarIndex, resolve);
                return;
              }

              const totalOps =
                updates.reduce(
                  (acc, u) => acc + (Object.keys(u.fields).length > 0 ? 1 : 0) + u.history.length,
                  0,
                );
              if (totalOps === 0) {
                markApplied(game, teamIds, completedCalendarIndex, resolve);
                return;
              }
              let remaining = totalOps;
              const finish = () => {
                remaining -= 1;
                if (remaining === 0) {
                  markApplied(game, teamIds, completedCalendarIndex, resolve);
                }
              };

              game.db.serialize(() => {
                for (const upd of updates) {
                  const keys = Object.keys(upd.fields);
                  if (keys.length > 0) {
                    const setClauses = keys.map((k) => `${k} = ?`).join(", ");
                    const values = keys.map((k) => upd.fields[k]);
                    values.push(upd.playerId);
                    game.db.run(
                      `UPDATE players SET ${setClauses} WHERE id = ?`,
                      values,
                      (uErr: any) => {
                        if (uErr) console.error(`[${game.roomCode}] training: update player ${upd.playerId}:`, uErr);
                        // Record skill snapshot when skill changed via training
                        if (upd.fields.skill != null) {
                          game.db.run(
                            `INSERT OR REPLACE INTO player_skill_snapshots (player_id, matchweek, season, skill) VALUES (?, ?, ?, ?)`,
                            [upd.playerId, completedCalendarIndex, game.season || 1, upd.fields.skill],
                          );
                        }
                        finish();
                      },
                    );
                  }
                  for (const h of upd.history) {
                    game.db.run(
                      `INSERT INTO training_player_history
                         (player_id, team_id, matchweek, attribute, old_value, new_value, delta, focus)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                      [
                        upd.playerId,
                        upd.teamId,
                        completedCalendarIndex,
                        h.attribute,
                        h.oldValue,
                        h.newValue,
                        h.delta,
                        h.focus,
                      ],
                      (hErr: any) => {
                        if (hErr) console.error(`[${game.roomCode}] training: insert history for player ${upd.playerId}:`, hErr);
                        finish();
                      },
                    );
                  }
                }
              });
            },
          );
        },
      );
    });
  }

  function carryForwardMissingFocus(
    game: ActiveGame,
    completedCalendarIndex: number,
    trainingByTeam: Map<number, string>,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      game.db.all(
        "SELECT DISTINCT team_id FROM team_training WHERE matchweek < ?",
        [completedCalendarIndex],
        (err: any, rows: any[]) => {
          if (err) {
            console.error(`[${game.roomCode}] training: failed to list teams for carry-forward:`, err);
            resolve();
            return;
          }
          const missing = (rows || [])
            .map((r) => r.team_id)
            .filter((tid: number) => !trainingByTeam.has(tid));
          if (missing.length === 0) {
            resolve();
            return;
          }
          let pending = missing.length;
          const finishOne = () => {
            pending -= 1;
            if (pending === 0) resolve();
          };
          for (const tid of missing) {
            game.db.get(
              "SELECT training_focus FROM team_training WHERE team_id = ? AND matchweek < ? ORDER BY matchweek DESC LIMIT 1",
              [tid, completedCalendarIndex],
              (e2: any, prev: any) => {
                if (e2 || !prev) {
                  if (e2) console.error(`[${game.roomCode}] training: lookup prev focus team ${tid}:`, e2);
                  finishOne();
                  return;
                }
                game.db.run(
                  "INSERT OR IGNORE INTO team_training (team_id, matchweek, training_focus, applied) VALUES (?, ?, ?, 0)",
                  [tid, completedCalendarIndex, prev.training_focus],
                  (e3: any) => {
                    if (e3) {
                      console.error(`[${game.roomCode}] training: carry-forward insert team ${tid}:`, e3);
                    } else {
                      trainingByTeam.set(tid, prev.training_focus);
                    }
                    finishOne();
                  },
                );
              },
            );
          }
        },
      );
    });
  }

  function markApplied(
    game: ActiveGame,
    teamIds: number[],
    completedCalendarIndex: number,
    done: () => void,
  ) {
    if (!teamIds || teamIds.length === 0) {
      done();
      return;
    }
    const placeholders = teamIds.map(() => "?").join(",");
    game.db.run(
      `UPDATE team_training SET applied = 1
       WHERE matchweek = ? AND team_id IN (${placeholders})`,
      [completedCalendarIndex, ...teamIds],
      (err: any) => {
        if (err) console.error(`[${game.roomCode}] training: failed to mark applied:`, err);
        done();
      },
    );
  }

  /**
   * Limpa o estado de treino da época concluída.
   *
   * `team_training.matchweek` e `training_player_history.matchweek` guardam o
   * `game.calendarIndex`, que é 0-based POR ÉPOCA (`applySeasonEnd` faz
   * `game.calendarIndex = 0`). Sem limpeza, as linhas da época anterior
   * colidem com a nova época (mesmo `(team_id, matchweek)`): o relatório do
   * treino misturava épocas, o `getTrainingFocus` podia devolver um foco
   * velho, e o carry-forward do primeiro evento da época não encontrava
   * referência. Após a limpeza, a nova época começa igual à época 1.
   */
  function clearSeasonTrainingState(game: ActiveGame): Promise<void> {
    const tables = ["team_training", "training_player_history"];
    const ops = tables.map(
      (table) =>
        new Promise<void>((resolve) => {
          game.db.run(`DELETE FROM ${table}`, (err: any) => {
            if (err) {
              console.error(
                `[${game.roomCode}] training: cleanup ${table} failed:`,
                err,
              );
            }
            resolve();
          });
        }),
    );
    return Promise.all(ops).then(() => undefined);
  }

  return { applyTrainingBonuses, clearSeasonTrainingState };
}
