import type { MatchFixture } from "../types";
import { type Db } from "./dbAsync";
import { recalcPlayerValue } from "../gameConstants";

// ── Deltas pós-jogo (fix #2: flush transacional) ─────────────────────────────
// Durante a simulação, golos/cartões/lesões/presenças NÃO escrevem na DB.
// São acumulados por fixture e descarregados de uma vez por
// queueMatchDeltaWrites(), dentro da transação atómica do apito final
// (finalizeLeagueEvent / finalizeCupRound), junto às classificações e ao
// marker 'finalized'. Assim um crash a meio do jogo nunca deixa contadores
// de jogadores a meio sem o resultado correspondente.
export type MatchInjuryDelta = {
  newSkill: number;
  injuryUntil: number;
  oldSkill: number;
  count: number;
  matchweek: number;
  season: number;
};

export type MatchDeltas = {
  calendarIndex: number;
  appearances: Set<number>;
  goals: Map<number, number>;
  /** Golos por clube: teamId → (playerId → golos). Alimenta `player_season_goals`. */
  goalsByTeam: Map<number, Map<number, number>>;
  reds: Map<number, number>; // playerId -> suspensionUntil
  yellows: Map<number, MatchYellowDelta>; // playerId -> amarelos do jogo + castigo
  injuries: Map<number, MatchInjuryDelta>;
};

/** Amarelo do jogo; `banUntil != null` quando ESTE amarelo fecha os 3 acumulados. */
export type MatchYellowDelta = { count: number; banUntil: number | null };

export function getMatchDeltas(fixture: MatchFixture): MatchDeltas {
  if (!fixture._deltas) {
    fixture._deltas = {
      calendarIndex: 0,
      appearances: new Set<number>(),
      goals: new Map<number, number>(),
      goalsByTeam: new Map<number, Map<number, number>>(),
      reds: new Map<number, number>(),
      yellows: new Map<number, MatchYellowDelta>(),
      injuries: new Map<number, MatchInjuryDelta>(),
    };
  }
  return fixture._deltas;
}

export function recordMatchGoal(
  fixture: MatchFixture,
  playerId: number,
  teamId?: number | null,
) {
  if (typeof playerId !== "number" || playerId <= 0) return; // juniores (IDs negativos) não têm linha na DB
  const d = getMatchDeltas(fixture);
  d.goals.set(playerId, (d.goals.get(playerId) ?? 0) + 1);
  if (teamId == null) return;
  const byTeam = d.goalsByTeam.get(teamId) ?? new Map<number, number>();
  byTeam.set(playerId, (byTeam.get(playerId) ?? 0) + 1);
  d.goalsByTeam.set(teamId, byTeam);
}

export function recordMatchRed(
  fixture: MatchFixture,
  playerId: number,
  suspensionUntil: number,
) {
  if (typeof playerId !== "number" || playerId <= 0) return;
  const d = getMatchDeltas(fixture);
  const prev = d.reds.get(playerId);
  d.reds.set(playerId, prev != null ? Math.max(prev, suspensionUntil) : suspensionUntil);
}

/**
 * Amarelo acumulado por jogos (regra FIFA): 3 amarelos em jogos oficiais —
 * o amigável não gera cartões — castigo de 1 jogo e a contagem zera no
 * flush (o vermelho do mesmo jogo limpa-a e o MAX absorve o overlap). A
 * decisão do castigo fica aqui, em memória no momento do cartão: as rows
 * do squad trazem o `yellow_cards` da DB e a decisão é determinística em
 * replay — o flush atómico do apito final aplica-a com o resultado.
 */
export function recordMatchYellow(
  fixture: MatchFixture,
  playerId: number,
  banUntil: number | null,
) {
  if (typeof playerId !== "number" || playerId <= 0) return; // juniores (IDs negativos) não têm linha na DB
  const d = getMatchDeltas(fixture);
  const prev = d.yellows.get(playerId);
  d.yellows.set(playerId, {
    count: (prev?.count ?? 0) + 1,
    banUntil: prev?.banUntil ?? banUntil, // o castigo marca-se uma só vez
  });
}

export function recordMatchInjury(
  fixture: MatchFixture,
  playerId: number,
  injury: Omit<MatchInjuryDelta, "count">,
) {
  if (typeof playerId !== "number" || playerId <= 0) return;
  const d = getMatchDeltas(fixture);
  const prev = d.injuries.get(playerId);
  d.injuries.set(playerId, {
    ...injury,
    // Segunda lesão do mesmo jogador no mesmo jogo: acumula o contador,
    // mantém o skill/injuryUntil mais recentes.
    count: (prev?.count ?? 0) + 1,
  });
}

export function recordMatchAppearances(
  fixture: MatchFixture,
  playerIds: number[],
  calendarIndex: number,
) {
  const d = getMatchDeltas(fixture);
  d.calendarIndex = calendarIndex;
  for (const id of playerIds) {
    if (typeof id === "number" && id > 0) d.appearances.add(id);
  }
}

/**
 * Descarrega os deltas acumulados de todos os fixtures para a DB.
 * NÃO gere transação — emite os UPDATEs/INSERTs ordenados na conexão dada,
 * para o chamador os embrulhar na sua transação atómica do apito final.
 * Os `fixture._deltas` só são libertados quando TODOS os writes confirmam
 * (antes limpavam-se ao enfileirar — uma morte entre o enqueue e o COMMIT
 * perdia golos/vermelhos/lesões sem hipótese de replay). A flag
 * `_deltasQueued` impede duplo enqueue enquanto o flush está em curso.
 */
export function queueMatchDeltaWrites(db: Db, fixtures: MatchFixture[]): void {
  for (const fixture of fixtures || []) {
    const d: MatchDeltas | undefined = fixture?._deltas;
    if (!d || fixture._deltasQueued) continue;
    fixture._deltasQueued = true;

    let pending = 0;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      fixture._deltas = undefined;
      fixture._deltasQueued = false;
    };
    // Todos os db.run são emitidos de forma síncrona abaixo; cada callback
    // decrementa — quando chegam todos, os deltas podem ser libertados.
    // O callback corre mesmo em erro do sqlite: reporta e conta na mesma,
    // para o flush completar em vez de pendurar a flag para sempre.
    const trackedRun = (sql: string, params: any[]) => {
      pending++;
      db.run(sql, params, (err: unknown) => {
        if (err)
          console.error(
            `[engine] delta write falhou (${sql.slice(0, 60)}…):`,
            err,
          );
        pending--;
        if (pending === 0) finish();
      });
    };

    try {

      if (d.appearances.size > 0 && d.calendarIndex > 0) {
        const ids = [...d.appearances];
        const ph = ids.map(() => "?").join(",");
        trackedRun(
          // Guard anti-replay: igual ao incremento imediato anterior — um flush
          // repetido do mesmo slot nunca conta presenças a dobrar.
          `UPDATE players SET games_played = games_played + 1, last_appearance_matchweek = MAX(last_appearance_matchweek, ?) WHERE id IN (${ph}) AND COALESCE(last_appearance_matchweek, 0) < ?`,
          [d.calendarIndex, d.calendarIndex, ...ids],
        );
      }
      for (const [id, count] of d.goals) {
        trackedRun(
          "UPDATE players SET goals = goals + ?, career_goals = career_goals + ? WHERE id = ?",
          [count, count, id],
        );
      }
      // Atribuição por clube (mesma transação): quem perde o goleador numa
      // transferência a meio da época não perde os golos que ele já marcou.
      for (const [teamId, byPlayer] of d.goalsByTeam) {
        for (const [playerId, count] of byPlayer) {
          trackedRun(
            "INSERT INTO player_season_goals (player_id, team_id, goals) VALUES (?, ?, ?) ON CONFLICT(player_id, team_id) DO UPDATE SET goals = goals + excluded.goals",
            [playerId, teamId, count],
          );
        }
      }
      // Amarelos ANTES dos vermelhos: no mesmo jogo o vermelho corre depois
      // e a sua limpeza da contagem (regra de casa) ganha.
      for (const [id, y] of d.yellows) {
        if (y.banUntil != null) {
          // 3º amarelo acumulado (FIFA): castigo de 1 jogo, contagem zera;
          // MAX preserva um vermelho anterior mais longo.
          trackedRun(
            "UPDATE players SET yellow_cards = 0, suspension_games = suspension_games + 1, suspension_until_matchweek = MAX(suspension_until_matchweek, ?) WHERE id = ?",
            [y.banUntil, id],
          );
        } else {
          trackedRun(
            "UPDATE players SET yellow_cards = yellow_cards + ? WHERE id = ?",
            [y.count, id],
          );
        }
      }
      for (const [id, until] of d.reds) {
        // O vermelho limpa a contagem de amarelos (regra de casa); o CASE
        // absorve o castigo do 3º amarelo do mesmo jogo (fica o mais longo).
        trackedRun(
          "UPDATE players SET red_cards = red_cards + 1, career_reds = career_reds + 1, yellow_cards = 0, suspension_games = suspension_games + 2, suspension_until_matchweek = CASE WHEN suspension_until_matchweek > ? THEN suspension_until_matchweek ELSE ? END WHERE id = ?",
          [until, until, id],
        );
      }
      for (const [id, inj] of d.injuries) {
        trackedRun(
          "UPDATE players SET injuries = injuries + ?, career_injuries = career_injuries + ?, prev_skill = skill, skill = ?, value = ?, injury_until_matchweek = CASE WHEN injury_until_matchweek > ? THEN injury_until_matchweek ELSE ? END WHERE id = ?",
          [inj.count, inj.count, inj.newSkill, recalcPlayerValue(inj.newSkill), inj.injuryUntil, inj.injuryUntil, id],
        );
        trackedRun(
          "INSERT OR REPLACE INTO player_skill_snapshots (player_id, matchweek, season, skill) VALUES (?, ?, ?, ?)",
          [id, inj.matchweek, inj.season, inj.oldSkill],
        );
      }
      // Fixture sem writes (deltas vazios): sem callbacks, libertar já.
      if (pending === 0) finish();
    } catch (err) {
      // Throw síncrono a meio da emissão (ex.: DB fechada): repor a flag
      // para a próxima tentativa não ser ignorada — os deltas ficam retidos.
      console.error("[engine] flush de deltas interrompido:", err);
      fixture._deltasQueued = false;
    }
  }
}
