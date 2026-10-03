import type { MatchFixture } from "../types";
import { dbRunAsync, dbAllAsync, type Db } from "./dbAsync";
import type { Rng } from "./matchCalculations";
import { clampSkill } from "./matchCalculations";
import { recalcPlayerValue, MATCH_TUNING, MORALE_NEUTRAL, STAFF_FANS_DECAY_REDUCTION_PER_LEVEL } from "../gameConstants";

export async function applyPostMatchQualityEvolution(
  db: Db,
  fixtures: MatchFixture[],
  currentMatchweek: number,
  season: number,
  calendarIndex: number = 1,
  rng: Rng = Math.random,
) {
  // Helpers de módulo ligados a esta conexão (ver topo do ficheiro).
  const dbRun = (sql: string, params: any[] = []) =>
    dbRunAsync(db, sql, params);
  const dbAll = <T = any>(sql: string, params: any[] = []) =>
    dbAllAsync<T>(db, sql, params);

  // Nunca rejeitar: os chamadores encadeiam .then() sem .catch() e a evolução
  // é secundária face ao resultado já comitado. Erros logam e seguem.
  try {
    const teamResults = new Map<number, string>();
    for (const match of fixtures || []) {
      const homeResult =
        match.finalHomeGoals > match.finalAwayGoals
          ? "W"
          : match.finalHomeGoals < match.finalAwayGoals
            ? "L"
            : "D";
      const awayResult =
        match.finalAwayGoals > match.finalHomeGoals
          ? "W"
          : match.finalAwayGoals < match.finalHomeGoals
            ? "L"
            : "D";
      teamResults.set(match.homeTeamId, homeResult);
      teamResults.set(match.awayTeamId, awayResult);
    }

    // ── Moral por equipa ───────────────────────────────────────────────
    // Decaimento semanal para o neutro 25 (uma vez por evento do calendário)
    // para a moral refletir a forma recente em vez de histórico acumulado.
    // Depois o delta do resultado — tudo com await (antes era fire-and-forget
    // com race entre o decaimento global e os updates por equipa).
    await dbRun(
      `UPDATE teams SET morale = MAX(1, MIN(50, CAST(morale + (25 - morale) * ${MATCH_TUNING.moraleDecayRate} AS INTEGER)))`,
    );

    const moraleUpdates: Array<{ teamId: number; delta: number }> = [];
    for (const [teamId, result] of teamResults.entries()) {
      let delta;
      if (result === "W") delta = MATCH_TUNING.moraleWinDelta;
      else if (result === "L") delta = MATCH_TUNING.moraleLossDelta;
      else delta = MATCH_TUNING.moraleDrawDelta;
      moraleUpdates.push({ teamId, delta });
    }

    if (moraleUpdates.length > 0) {
      const rows = await dbAll<{ id: number; morale: number | null }>(
        "SELECT id, morale FROM teams WHERE id IN (" +
          moraleUpdates.map(() => "?").join(",") +
          ")",
        moraleUpdates.map((u) => u.teamId),
      );
      const current = new Map<number, number>(
        rows.map((row) => [row.id, row.morale ?? 25]),
      );
      // Batch único em vez de SELECT + N UPDATEs.
      const cases: string[] = [];
      const params: any[] = [];
      const ids: number[] = [];
      for (const { teamId, delta } of moraleUpdates) {
        if (!current.has(teamId)) continue;
        const newMorale = Math.max(
          1,
          Math.min(50, (current.get(teamId) ?? 25) + delta),
        );
        cases.push("WHEN ? THEN ?");
        params.push(teamId, newMorale);
        ids.push(teamId);
      }
      if (ids.length > 0) {
        const ph = ids.map(() => "?").join(",");
        await dbRun(
          `UPDATE teams SET morale = CASE id ${cases.join(" ")} END WHERE id IN (${ph})`,
          [...params, ...ids],
        );
      }
    }

    // ── Mood dos adeptos (fans_mood) ───────────────────────────────────
    // Memória emocional da bancada — distinta da moral do plantel. Determinada
    // pelo resultado COM contexto (margem, casa/fora, escalão, dérbi, Taça),
    // espelhando a lógica do moodVariant do cliente. Decai para a base de
    // fidelidade da divisão; a assistência deriva daqui (coreHelpers).
    // Bloco isolado em try/catch: DBs antigas sem a coluna não podem partir
    // a evolução pós-jogo (a migração em gameManager.ts trata o caso geral).
    try {
      const fanTeamIds = [...teamResults.keys()];
      if (fanTeamIds.length > 0) {
        const divRows = await dbAll<{ id: number; division: number | null }>(
          "SELECT id, division FROM teams WHERE id IN (" +
            fanTeamIds.map(() => "?").join(",") +
            ")",
          fanTeamIds,
        );
        const divisions = new Map<number, number>(
          divRows.map((r) => [r.id, r.division ?? 4]),
        );
        const T = MATCH_TUNING;
        const baseCase = Object.entries(T.fansBaseByDivision)
          .map(([div, base]) => `WHEN ${Number(div)} THEN ${Number(base)}`)
          .join(" ");
        // Director de Comunicação: trava o decaimento (-8%/nível). A tabela
        // `team_staff` não existe nas DBs mínimas dos testes de regressão, por
        // isso é referida no SQL só quando existe (senão o UPDATE rebentava).
        const hasStaffTable = await dbAll<{ n: number }>(
          "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'team_staff'",
        )
          .then((rows) => (rows[0]?.n ?? 0) > 0)
          .catch(() => false);
        const staffDecaySql = hasStaffTable
          ? ` * (1 - ${STAFF_FANS_DECAY_REDUCTION_PER_LEVEL} * COALESCE((SELECT level FROM team_staff WHERE team_id = teams.id AND role = 'comunicacao'), 0))`
          : "";
        await dbRun(
          `UPDATE teams SET fans_mood = MAX(1, MIN(50, CAST(fans_mood + ((CASE division ${baseCase} ELSE 25 END) - fans_mood) * ${T.fansMoodDecayRate}${staffDecaySql} AS INTEGER)))`,
        );
        const fanCases: string[] = [];
        const fanParams: any[] = [];
        const fanIds: number[] = [];
        const fanCurrent = await dbAll<{ id: number; fans_mood: number | null }>(
          "SELECT id, fans_mood FROM teams WHERE id IN (" +
            fanTeamIds.map(() => "?").join(",") +
            ")",
          fanTeamIds,
        );
        const fanMoodNow = new Map<number, number>(
          fanCurrent.map((r) => [r.id, r.fans_mood ?? T.fansMoodDefault]),
        );
        for (const match of fixtures || []) {
          const margin = Math.abs(match.finalHomeGoals - match.finalAwayGoals);
          const cupRound =
            typeof (match as any).round === "number"
              ? (match as any).round
              : null;
          const sides = [
            { teamId: match.homeTeamId, oppId: match.awayTeamId, isHome: true },
            { teamId: match.awayTeamId, oppId: match.homeTeamId, isHome: false },
          ];
          for (const side of sides) {
            const result = teamResults.get(side.teamId);
            if (!result || !fanMoodNow.has(side.teamId)) continue;
            let d =
              result === "W"
                ? T.fansWinDelta
                : result === "L"
                  ? T.fansLossDelta
                  : T.fansDrawDelta;
            if (result !== "D") {
              if (side.isHome)
                d += result === "W" ? T.fansHomeWinBonus : T.fansHomeLossMalus;
              const marginFx =
                Math.min(Math.max(margin - 1, 0), 3) * T.fansMarginPerGoal;
              d += result === "W" ? marginFx : -marginFx;
              const myDiv = divisions.get(side.teamId);
              const oppDiv = divisions.get(side.oppId);
              if (myDiv != null && oppDiv != null && oppDiv !== myDiv) {
                if (result === "W" && oppDiv < myDiv) d += T.fansUpsetBonus;
                else if (result === "L" && oppDiv > myDiv) d += T.fansShameMalus;
                else if (result === "L" && oppDiv < myDiv)
                  d += T.fansExpectedLossSoftener;
              }
              if (myDiv != null && myDiv === oppDiv)
                d *= T.fansDerbyMultiplier;
              if (cupRound != null)
                d *= T.fansCupRoundMultiplier[cupRound] ?? 1;
            }
            const next = Math.max(
              1,
              Math.min(50, (fanMoodNow.get(side.teamId) ?? T.fansMoodDefault) + Math.round(d)),
            );
            fanMoodNow.set(side.teamId, next);
            fanCases.push("WHEN ? THEN ?");
            fanParams.push(side.teamId, next);
            fanIds.push(side.teamId);
          }
        }
        if (fanIds.length > 0) {
          const ph = fanIds.map(() => "?").join(",");
          await dbRun(
            `UPDATE teams SET fans_mood = CASE id ${fanCases.join(" ")} END WHERE id IN (${ph})`,
            [...fanParams, ...fanIds],
          );
        }
      }
    } catch (fansErr) {
      console.error("[engine] evolution: fans_mood update skipped:", (fansErr as Error)?.message ?? fansErr);
    }

    // ── Sequências de derrotas (para a pressão de decaimento) ──────────
    const teamLossStreak = new Map<number, number>();
    const lastTeamResult = new Map<number, string>();
    try {
      const seasonMatches = await dbAll<any>(
        "SELECT home_team_id AS home, away_team_id AS away, home_score, away_score FROM matches WHERE season = ? ORDER BY matchweek, id",
        [season],
      );
      for (const m of seasonMatches) {
        const homeRes = m.home_score > m.away_score ? "W" : m.home_score < m.away_score ? "L" : "D";
        const awayRes = m.away_score > m.home_score ? "W" : m.away_score < m.home_score ? "L" : "D";
        for (const [tid, res] of [
          [m.home, homeRes],
          [m.away, awayRes],
        ] as Array<[number, string]>) {
          if (res === "L") {
            teamLossStreak.set(
              tid,
              (lastTeamResult.get(tid) === "L" ? teamLossStreak.get(tid) || 0 : 0) + 1,
            );
          } else {
            teamLossStreak.set(tid, 0);
          }
          lastTeamResult.set(tid, res);
        }
      }
    } catch (streakErr) {
      console.error("[engine] evolution: failed to load season matches:", streakErr);
    }

    const players = await dbAll<any>(
      "SELECT id, team_id, position, skill, potential, form, games_played, last_appearance_matchweek, joined_matchweek, injury_until_matchweek, suspension_until_matchweek FROM players WHERE team_id IS NOT NULL ORDER BY team_id, id",
    );
    if (!players || players.length === 0) {
      return;
    }

    // ── Build individual performance maps from fixture events ─────────
    const playerGoals = new Map<number, number>();
    const playerOwnGoals = new Map<number, number>();
    const playerRedCards = new Map<number, boolean>();
    const teamCleanSheetWin = new Map<number, boolean>();
    // Players that appeared in any lineup (starters + bench) and those
    // who actually started — used to weigh minutes and detect rust.
    const appearedIds = new Set<number>();
    const starterIds = new Set<number>();

    for (const match of fixtures || []) {
      // Track clean sheet wins: team won and opponent scored 0
      if (
        match.finalHomeGoals > match.finalAwayGoals &&
        match.finalAwayGoals === 0
      ) {
        teamCleanSheetWin.set(match.homeTeamId, true);
      }
      if (
        match.finalAwayGoals > match.finalHomeGoals &&
        match.finalHomeGoals === 0
      ) {
        teamCleanSheetWin.set(match.awayTeamId, true);
      }

      // Lineups: starters (is_starter) + bench; subbed-in players are part
      // of the final squad snapshot, so they count as appeared (not started).
      for (const lineup of [match.homeLineup, match.awayLineup] as any[]) {
        for (const p of lineup || []) {
          if (typeof p?.id !== "number" || p.id <= 0) continue;
          appearedIds.add(p.id);
          if (p.is_starter) starterIds.add(p.id);
        }
      }

      // Parse events for goals and red cards
      const events = match.events || [];
      for (const evt of events) {
        if (!evt.playerId) continue;
        if (evt.type === "goal" || evt.type === "penalty_goal") {
          playerGoals.set(
            evt.playerId,
            (playerGoals.get(evt.playerId) || 0) + 1,
          );
        }
        if (evt.type === "own_goal") {
          playerOwnGoals.set(
            evt.playerId,
            (playerOwnGoals.get(evt.playerId) || 0) + 1,
          );
        }
        if (evt.type === "red" || evt.type === "gk_red_card") {
          playerRedCards.set(evt.playerId, true);
        }
      }
    }

    const teamGroups = new Map();
    for (const player of players) {
      if (!teamGroups.has(player.team_id))
        teamGroups.set(player.team_id, []);
      teamGroups.get(player.team_id).push(player);
    }

    const updates = [];
    for (const player of players) {
      if ((player.injury_until_matchweek || 0) >= currentMatchweek)
        continue;
      if ((player.suspension_until_matchweek || 0) >= currentMatchweek)
        continue;

      const group = teamGroups.get(player.team_id) || [];
      const avgSkill =
        group.reduce((sum, p) => sum + (p.skill || 0), 0) /
        Math.max(1, group.length);
      const diff = avgSkill - (player.skill || 0);
      const teamResult = teamResults.get(player.team_id) || "D";

      const potential =
        player.potential != null ? Math.min(50, player.potential) : 50;
      // Cabeçote até ao teto de potencial (talent ceiling)
      const room = potential - (player.skill || 0);

      const appeared = appearedIds.has(player.id);
      const started = starterIds.has(player.id);
      // 90 min ≈ full effect, só banco/entrou ≈ metade, não jogou ≈ 0
      const minutesFactor = started ? 1 : appeared ? 0.5 : 0;
      const lastAppearance = player.last_appearance_matchweek || 0;
      const playedPrev = lastAppearance > 0 && lastAppearance === calendarIndex - 1;

      let delta = 0;

      // Acima do teto de potencial: deriva suave de retorno à média,
      // compensável por performance forte (golos / clean sheet)
      if (room < 0 && rng() < MATCH_TUNING.evoAboveCeilingRoll) {
        delta -= 1;
      }

      if (!appeared) {
        // ── Inatividade / "enferrujar" ─────────────────────────────
        // Quem não joga há 3+ eventos do calendário tem risco crescente
        // de perder qualidade, mesmo abaixo do potencial. Contratações
        // recentes têm um período de graça antes de sofrerem rust.
        const justJoined =
          (player.joined_matchweek || 0) >= calendarIndex - 3;
        const idleForAWhile =
          lastAppearance === 0 ? !justJoined : lastAppearance < calendarIndex - 3;
        if (idleForAWhile && rng() < MATCH_TUNING.evoRustRoll) {
          delta -= 1;
        }
        if (delta !== 0) {
          updates.push({
            id: player.id,
            skill: clampSkill((player.skill || 0) + delta),
          });
        }
        continue;
      }

      // Convivência: jogadores abaixo da média do plantel evoluem ao
      // conviver com colegas mais talentosos (spec: "evoluem se
      // conviverem com jogadores mais talentosos").
      // Só aplica enquanto houver cabeçote até ao potencial.
      if (
        room > 0 &&
        diff >= 1 &&
        rng() <
          Math.min(
            MATCH_TUNING.evoCohabitMax,
            MATCH_TUNING.evoCohabitBase + diff / MATCH_TUNING.evoCohabitDivisor,
          ) * minutesFactor
      ) {
        delta += 1;
      }

      // Vitória reforça evolução para jogadores abaixo da média
      if (
        room > 0 &&
        teamResult === "W" &&
        diff >= 0 &&
        rng() <
          Math.min(
            MATCH_TUNING.evoWinMax,
            MATCH_TUNING.evoWinBase + diff / MATCH_TUNING.evoWinDivisor,
          ) * minutesFactor
      ) {
        delta += 1;
      }

      // Maus resultados: jogadores perdem qualidade se houver derrotas
      // (spec: "perdem qualidade se houver muitos maus resultados seguidos")
      // Jogadores acima da média do plantel são mais afectados
      if (teamResult === "L") {
        const lossPressure = Math.min(
          MATCH_TUNING.evoLossMax,
          MATCH_TUNING.evoLossBase +
            Math.max(0, -diff) / MATCH_TUNING.evoLossDivisor,
        );
        if (rng() < lossPressure) delta -= 1;
        // Derrotas consecutivas aumentam a pressão de decaimento
        const streak = teamLossStreak.get(player.team_id) || 0;
        if (
          streak >= 2 &&
          rng() <
            Math.min(
              MATCH_TUNING.evoStreakMax,
              MATCH_TUNING.evoStreakBase +
                MATCH_TUNING.evoStreakSlope * (streak - 1),
            )
        ) {
          delta -= 1;
        }
      }

      // Empate contra equipa mais forte — pequena hipótese de evolução
      if (
        room > 0 &&
        teamResult === "D" &&
        diff >= MATCH_TUNING.evoDrawDiff &&
        rng() < MATCH_TUNING.evoDrawChance * minutesFactor
      ) {
        delta += 1;
      }

      // ── Performance individual pós-jogo ──────────────────────────
      const goals = playerGoals.get(player.id) || 0;

      // Marcou 2+ golos: 25% de chance de +1 skill
      if (goals >= 2 && rng() < MATCH_TUNING.evoBraceChance) {
        delta += 1;
      }
      // Marcou 1 golo: 10% de chance de +1 skill
      else if (goals === 1 && rng() < MATCH_TUNING.evoGoalChance) {
        delta += 1;
      }

      // GR com clean sheet em vitória: 15% de chance de +1 skill
      if (
        player.position === "GR" &&
        teamResult === "W" &&
        teamCleanSheetWin.has(player.team_id) &&
        rng() < MATCH_TUNING.evoCleanSheetChance
      ) {
        delta += 1;
      }

      // Cartão vermelho: 20% de chance de -1 skill
      if (playerRedCards.has(player.id) && rng() < MATCH_TUNING.evoRedChance) {
        delta -= 1;
      }

      // Momentum: presença consecutiva impulsiona a evolução
      if (
        playedPrev &&
        room > 0 &&
        rng() < MATCH_TUNING.evoMomentumChance * minutesFactor
      ) {
        delta += 1;
      }
      // Estagnação por excesso de jogos sem descanso
      if (
        playedPrev &&
        (player.games_played || 0) >= 6 &&
        rng() < MATCH_TUNING.evoStagnationChance
      ) {
        delta -= 1;
      }

      if (delta !== 0) {
        updates.push({
          id: player.id,
          skill: clampSkill((player.skill || 0) + delta),
        });
      }
    }

    // Limpar prev_skill de semanas anteriores; só os que mudam esta semana ficam marcados.
    await dbRun(
      "UPDATE players SET prev_skill = NULL WHERE team_id IS NOT NULL",
    );
    if (updates.length > 0) {
      // Batch único (CASE) em vez de N UPDATEs com contador `remaining`.
      // ATENÇÃO: os placeholders do SQL vêm agrupados por CASE (todos os de
      // skill, depois todos os de value) — os params TÊM de seguir a mesma
      // ordem. Intercalar por jogador (id, skill, id, value) liga os pares
      // WHEN/THEN ao atributo errado a partir do 2.º e corrompe skill (NULL)
      // e value (= skill). Ver bug skill 6→0 na J1.
      const skillCases: string[] = [];
      const valueCases: string[] = [];
      const skillParams: any[] = [];
      const valueParams: any[] = [];
      const ids: number[] = [];
      for (const update of updates) {
        skillCases.push("WHEN ? THEN ?");
        valueCases.push("WHEN ? THEN ?");
        skillParams.push(update.id, update.skill);
        valueParams.push(update.id, recalcPlayerValue(update.skill));
        ids.push(update.id);
      }
      const ph = ids.map(() => "?").join(",");
      await dbRun(
        `UPDATE players SET prev_skill = skill, skill = CASE id ${skillCases.join(" ")} END, value = CASE id ${valueCases.join(" ")} END WHERE id IN (${ph})`,
        [...skillParams, ...valueParams, ...ids],
      );
    }
    // ── Moral individual ─────────────────────────────────────────────
    // Decaimento para o neutro 25 + deltas por evento (resultado,
    // titularidade, golos, auto-golos, vermelhos). Batch único como a
    // moral de equipa acima. Lesionados/suspensos não mexem (não é
    // descontentamento, é indisponibilidade).
    // Bloco isolado em try/catch: DBs antigas sem a coluna não podem
    // partir a evolução pós-jogo (a migração em gameManager.ts trata o
    // caso geral) — o mesmo precedente do bloco fans_mood acima.
    try {
      const moraleRows = await dbAll<{ id: number; morale: number | null }>(
        "SELECT id, morale FROM players WHERE team_id IS NOT NULL",
      );
      const moraleNow = new Map<number, number>(
        (moraleRows || []).map((r) => [r.id, r.morale ?? MORALE_NEUTRAL]),
      );
      const moraleCases: string[] = [];
      const moraleParams: any[] = [];
      const moraleIds: number[] = [];
      for (const player of players) {
        if (!moraleNow.has(player.id)) continue;
        if ((player.injury_until_matchweek || 0) >= currentMatchweek)
          continue;
        if ((player.suspension_until_matchweek || 0) >= currentMatchweek)
          continue;
        const m = moraleNow.get(player.id) ?? MORALE_NEUTRAL;
        let nm = m + (MORALE_NEUTRAL - m) * MATCH_TUNING.moraleDecayRate;
        const teamResult = teamResults.get(player.team_id) || "D";
        if (teamResult === "W") nm += MATCH_TUNING.moralePlayerWinDelta;
        else if (teamResult === "L") nm += MATCH_TUNING.moralePlayerLossDelta;
        else nm += MATCH_TUNING.moralePlayerDrawDelta;
        if (starterIds.has(player.id))
          nm += MATCH_TUNING.moralePlayerStarterBonus;
        else if (!appearedIds.has(player.id))
          nm += MATCH_TUNING.moralePlayerBenchMalus;
        nm +=
          (playerGoals.get(player.id) || 0) *
          MATCH_TUNING.moralePlayerGoalBonus;
        nm +=
          (playerOwnGoals.get(player.id) || 0) *
          MATCH_TUNING.moralePlayerOwnGoalMalus;
        if (playerRedCards.has(player.id))
          nm += MATCH_TUNING.moralePlayerRedMalus;
        nm = Math.max(1, Math.min(50, Math.round(nm)));
        if (nm !== m) {
          moraleCases.push("WHEN ? THEN ?");
          moraleParams.push(player.id, nm);
          moraleIds.push(player.id);
        }
      }
      if (moraleIds.length > 0) {
        const ph = moraleIds.map(() => "?").join(",");
        await dbRun(
          `UPDATE players SET morale = CASE id ${moraleCases.join(" ")} END WHERE id IN (${ph})`,
          [...moraleParams, ...moraleIds],
        );
      }
    } catch (moraleErr) {
      console.error("[engine] player morale skipped:", moraleErr);
    }
    // Snapshot do skill de todos os jogadores para continuidade.
    await dbRun(
      "INSERT OR REPLACE INTO player_skill_snapshots (player_id, matchweek, season, skill) SELECT id, ?, ?, skill FROM players WHERE team_id IS NOT NULL AND skill IS NOT NULL",
      [currentMatchweek, season],
    );
  } catch (err) {
    console.error("[engine] evolution failed:", err);
  }
}

