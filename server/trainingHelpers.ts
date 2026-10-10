import type { ActiveGame } from "./types";
import { fetchStaffLevels } from "./staffHelpers";
import {
  recalcPlayerValue,
  STAFF_TRAINING_PER_LEVEL,
  STAFF_RESISTANCE_PER_LEVEL,
  STAFF_RES_DECAY_REDUCTION_PER_LEVEL,
  STAFF_RESTED_FORM_PER_2_LEVELS,
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
 *    Human-coached teams gain faster (base 8 vs 5 for NPCs) so training can
 *    be a farming source; the potential ceiling still caps everyone.
 *  - Forma:        +6 form (direct, INTEGER column tolerates this)
 *  - Resistência:  +4.9 resistance (accumulator, 1.0 = 1 ponto)
 *
 * Funcionários (contratação em `staffHelpers`, secção «Funcionários» do Clube):
 *  - Treinador Auxiliar: multiplica o progresso de skill (+8%/nível).
 *  - Preparador Físico: forma de quem descansa (+1 a cada 2 níveis),
 *    resistência treinada (+0.5/nível) e decaimento de resistência -8%/nível.
 *
 * Physical dynamics (per calendar event, whole squad, junior GRs excluded):
 *  - Rested players always recover +2 form (even when training Forma — only
 *    starters get the +6); starters that don't train Forma decay with a
 *    gradient (the lower the form, the slower the drop).
 *  - Not training Resistência (deliberately slower than the training gain so
 *    neglect takes longer to noticeably harm stamina — losses halved):
 *      · played  → -0.92 resistance progress
 *      · rested  → -0.30 resistance progress
 *
 * Decay runs for every human team, even one that never picked a focus (no
 * bonus without a focus, but no immunity either). History rows are only
 * written on real level changes, with delta in whole points.
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
export async function applyTrainingBonuses(
  game: ActiveGame,
  fixtures: any[],
  completedCalendarIndex: number,
): Promise<void> {
  // NPCs treinam sozinhos (foco automático) — sem isto só os humanos
  // evoluíam e o fosso de skill alargava época após época.
  try {
    await ensureNpcTrainingFocus(game, completedCalendarIndex);
  } catch (e) {
    console.error(`[${game.roomCode}] training: npc focus failed:`, e);
  }
  try {
    await applyWeakPlayerCatchUp(game);
  } catch (e) {
    console.error(`[${game.roomCode}] training: catch-up failed:`, e);
  }
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

        // Equipas humanas treinam o skill mais depressa (viveirismo); os NPCs
        // mantêm o ritmo base — a vantagem é de quem gere, não da liga toda.
        const humanTeamIds = new Set<number>(
          Object.values(game.playersByName || {})
            .map((p: any) => p?.teamId)
            .filter((id: any) => id != null),
        );

        // Decay sem imunidade: o plantel carregado é a união das equipas com
        // foco + todas as humanas — quem nunca escolheu foco não ganha bónus
        // mas decai na mesma. Só as equipas com linha contam para markApplied.
        const teamIds = Array.from(trainingByTeam.keys());
        const squadTeamIds = Array.from(new Set([...teamIds, ...humanTeamIds]));
        if (squadTeamIds.length === 0) {
          resolve();
          return;
        }

        // Funcionários das equipas em âmbito (Treinador Auxiliar / Preparador
        // Físico). Ausência de linha = papel não contratado (nível 0).
        const staffByTeam = await fetchStaffLevels(game, squadTeamIds);

        // Collect ids of players that appeared in a fixture (positive ids only,
        // junior GRs use negative ids) — these receive the training bonus.
        const playedPlayerIds = new Set<number>();
        for (const fixture of fixtures || []) {
          const home = Array.isArray(fixture.homeLineup) ? fixture.homeLineup : [];
          const away = Array.isArray(fixture.awayLineup) ? fixture.awayLineup : [];
          for (const p of home) if (typeof p?.id === "number" && p.id > 0) playedPlayerIds.add(p.id);
          for (const p of away) if (typeof p?.id === "number" && p.id > 0) playedPlayerIds.add(p.id);
        }

        // Load the ENTIRE squad of the teams in scope: bonuses only reach
        // players that played (and only with a matching focus), but the
        // decay of untrained attributes (form / resistance) affects the
        // whole squad, focused or not.
        const teamPlaceholders = squadTeamIds.map(() => "?").join(",");
        game.db.all(
          `SELECT id, team_id, position, skill, form, resistance, potential,
                  training_skill_progress AS skill_progress,
                  training_resistance_progress AS resistance_progress
           FROM players
           WHERE team_id IN (${teamPlaceholders})`,
          squadTeamIds,
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
              // Sem foco não há bónus, mas há decay (sem imunidade para quem
              // nunca treinou); o rótulo do histórico cai para "Nenhum".
              const focus = trainingByTeam.get(player.team_id) ?? "Nenhum";
              // Equipa técnica da equipa do jogador (0 = papel por preencher).
              const staff = staffByTeam.get(player.team_id) || {};
              const auxLevel = Number(staff.auxiliar) || 0;
              const fisicoLevel = Number(staff.fisico) || 0;
              const restedFormBonus =
                Math.floor(fisicoLevel / 2) * STAFF_RESTED_FORM_PER_2_LEVELS;

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
                  let newProg =
                    oldProg + 4.9 + STAFF_RESISTANCE_PER_LEVEL * fisicoLevel;
                  let newRes = oldRes;
                  while (newProg >= 1.0 && newRes < RES_MAX) {
                    newRes += 1;
                    newProg -= 1.0;
                  }
                  if (newRes >= RES_MAX) newProg = 0; // cap progress at the ceiling
                  upd.fields.training_resistance_progress = Math.round(newProg * 100) / 100;
                  if (newRes !== oldRes) {
                    upd.fields.resistance = newRes;
                    upd.history.push({
                      attribute: "resistance",
                      oldValue: oldRes,
                      newValue: newRes,
                      delta: newRes - oldRes,
                      focus,
                    });
                  }
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
                    const gainBase = humanTeamIds.has(player.team_id) ? 8 : 5;
                    // Treinador Auxiliar: +8% de progresso por nível.
                    const gain =
                      gainBase *
                      (1 + STAFF_TRAINING_PER_LEVEL * auxLevel) *
                      potentialFactor *
                      formFactor;
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
                    if (newSkill !== oldSkill) {
                      upd.history.push({
                        attribute: "skill",
                        oldValue: oldSkill,
                        newValue: newSkill,
                        delta: newSkill - oldSkill,
                        focus,
                      });
                    }
                  }
                }
              }

              // ── Decay: untrained attributes worsen over time (whole squad) ──
              // Junior GRs (negative ids) are excluded.
              if (player.id > 0) {
                if (!played) {
                  // Descanso: quem não jogou recupera suavemente mesmo a
                  // treinar Forma (o +6 é só dos titulares) — rotação mantém
                  // o plantel fresco. O Preparador Físico acelera esta
                  // recuperação (+1 por cada 2 níveis).
                  const oldForm = player.form ?? FORM_NEUTRAL;
                  const newForm = Math.min(
                    FORM_MAX,
                    oldForm + 2 + restedFormBonus,
                  );
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
                } else if (focus !== "Forma") {
                  // Decaimento com gradiente: quanto mais baixa a forma,
                  // menos decai (efeito piso no 1)
                  const oldForm = player.form ?? FORM_NEUTRAL;
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

                if (focus !== "Resistência") {
                  const oldRes = player.resistance ?? RES_NEUTRAL;
                  const oldProg = player.resistance_progress ?? 0;
                  // Quem jogou desgasta mais; quem descansa perde menos.
                  // Decaimento propositadamente lento para a resistência não
                  // minguar depressa sem treino (perdas a metade do ganho).
                  // O Preparador Físico trava o decaimento (-8%/nível).
                  const resLoss =
                    (played ? -0.92 : -0.3) *
                    (1 - STAFF_RES_DECAY_REDUCTION_PER_LEVEL * fisicoLevel);
                  let newProg = oldProg + resLoss;
                  let newRes = oldRes;
                  while (newProg < 0 && newRes > RES_MIN) {
                    newRes -= 1;
                    newProg += 1.0;
                  }
                  if (newRes <= RES_MIN && newProg < 0) newProg = 0; // clamp at floor
                  newProg = Math.round(newProg * 100) / 100;
                  upd.fields.training_resistance_progress = newProg;
                  if (newRes !== oldRes) {
                    upd.fields.resistance = newRes;
                    upd.history.push({
                      attribute: "resistance",
                      oldValue: oldRes,
                      newValue: newRes,
                      delta: newRes - oldRes,
                      focus,
                    });
                  }
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
                          [upd.playerId, completedCalendarIndex + 1, game.season || 1, upd.fields.skill],
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
 * Foco automático dos NPCs: a linha mais fraca do plantel treina — exceto
 * quando o grupo está quebrado fisicamente (resistência média < 24) ou em
 * baixo de forma (< 30), aí recupera como um treinador sensato faria.
 * Sem isto os NPCs nunca treinavam (só humanos tinham linhas em
 * team_training) e apodreciam fisicamente com o decaimento.
 */
/** Abaixo desta fração da média do plantel o jogador entra em recuperação. */
const CATCH_UP_RATIO = 0.7;
/** Fração do fosso até ao alvo recuperada por semana (mín. +1). */
const CATCH_UP_RATE = 0.25;

/** Ganho semanal de recuperação: fecha CATCH_UP_RATE do fosso, mínimo +1. */
export function catchUpGain(skill: number, teamAvg: number): number {
  const target = Math.floor(teamAvg * CATCH_UP_RATIO);
  if (skill >= target) return 0;
  return Math.max(1, Math.round((target - skill) * CATCH_UP_RATE));
}

/**
 * Recuperação de fracos: jogadores muito abaixo da média do plantel
 * (ex. skill 1-3 numa equipa de 20) sobem depressa em direção à média,
 * todas as semanas, independentemente do foco de treino. Sobe o potencial
 * se for preciso para não ficarem presos no teto.
 */
async function applyWeakPlayerCatchUp(game: ActiveGame): Promise<void> {
  const rows: any[] = await new Promise((resolve, reject) =>
    game.db.all(
      `SELECT p.id, p.skill, p.potential, t.avg_skill
       FROM players p
       JOIN (SELECT team_id, AVG(skill) AS avg_skill FROM players
             WHERE team_id IS NOT NULL AND id > 0 GROUP BY team_id) t
         ON t.team_id = p.team_id
       WHERE p.id > 0 AND p.skill < t.avg_skill * ?`,
      [CATCH_UP_RATIO],
      (err: any, r: any[]) => (err ? reject(err) : resolve(r || [])),
    ),
  );
  for (const r of rows) {
    const gain = catchUpGain(r.skill || 0, r.avg_skill);
    if (!gain) continue;
    const skill = Math.min(50, (r.skill || 0) + gain);
    const potential = Math.max(r.potential ?? 0, skill);
    await new Promise<void>((resolve) =>
      game.db.run(
        "UPDATE players SET skill = ?, potential = ?, value = ? WHERE id = ?",
        [skill, potential, recalcPlayerValue(skill), r.id],
        () => resolve(),
      ),
    );
  }
}

export async function ensureNpcTrainingFocus(
  game: ActiveGame,
  completedCalendarIndex: number,
): Promise<void> {
  const humanTeamIds = new Set<number>(
    Object.values(game.playersByName || {})
      .map((p: any) => p?.teamId)
      .filter((id: any) => id != null),
  );
  const all = (id: string) =>
    new Promise<any[]>((resolve) => {
      game.db.all(id, (err: any, rows: any[]) => resolve(err ? [] : rows || []));
    });
  const teamIds = (await all("SELECT id, division FROM teams"))
    // A 5.ª divisão também treina: sem isto só perdia qualidade (12 → 5,5 em
    // seis épocas) e quem subia chegava à 4.ª três vezes mais fraco.
    .filter((t) => !humanTeamIds.has(t.id))
    .map((t) => t.id);
  if (teamIds.length === 0) return;
  const placeholders = teamIds.map(() => "?").join(",");
  const existing = await new Promise<any[]>((resolve) => {
    game.db.all(
      `SELECT team_id FROM team_training WHERE matchweek = ? AND team_id IN (${placeholders})`,
      [completedCalendarIndex, ...teamIds],
      (err: any, rows: any[]) => resolve(err ? [] : rows || []),
    );
  });
  const hasFocus = new Set(existing.map((r) => r.team_id));
  const FOCUS_BY_POS: Record<string, string> = { GR: "GR", DEF: "Defesas", MED: "Médios", ATA: "Avançados" };
  for (const teamId of teamIds) {
    if (hasFocus.has(teamId)) continue;
    const squad = await new Promise<any[]>((resolve) => {
      game.db.all(
        "SELECT position, skill, resistance, form FROM players WHERE team_id = ? AND id > 0",
        [teamId],
        (err: any, rows: any[]) => resolve(err ? [] : rows || []),
      );
    });
    if (squad.length === 0) continue;
    const avg = (xs: number[]) => xs.reduce((s, v) => s + (v || 0), 0) / xs.length;
    let focus: string | null = null;
    if (avg(squad.map((p) => p.resistance)) < 24) focus = "Resistência";
    else if (avg(squad.map((p) => p.form)) < 30) focus = "Forma";
    else {
      const byPos: Record<string, number[]> = {};
      for (const p of squad) (byPos[p.position] ||= []).push(p.skill || 0);
      let weakest: string | null = null;
      for (const pos of Object.keys(FOCUS_BY_POS)) {
        if (!byPos[pos]?.length) { weakest = pos; break; }
        if (weakest == null || avg(byPos[pos]) < avg(byPos[weakest])) weakest = pos;
      }
      focus = (weakest && FOCUS_BY_POS[weakest]) || "Médios";
    }
    await new Promise<void>((resolve) => {
      game.db.run(
        "INSERT OR IGNORE INTO team_training (team_id, matchweek, training_focus, applied) VALUES (?, ?, ?, 0)",
        [teamId, completedCalendarIndex, focus],
        () => resolve(),
      );
    });
  }
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
export function clearSeasonTrainingState(game: ActiveGame): Promise<void> {
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

