import type { ActiveGame, CoachMarketEvent } from "./types";
import {
  getAllTeamForms,
  getStandingsRows,
  logClubNews,
  getTeamsWithCoachNames,
} from "./coreHelpers";
import { withJuniorGRs, ensureFullBench } from "./game/engine";

type Db = any;
type AnyRow = Record<string, any>;

type RunAll = <T extends AnyRow = AnyRow>(
  db: Db,
  sql: string,
  params?: any[],
) => Promise<T[]>;
type RunGet = <T extends AnyRow = AnyRow>(
  db: Db,
  sql: string,
  params?: any[],
) => Promise<T | undefined>;

interface CoachDismissalDeps {
  io: any;
  runAll: RunAll;
  runGet: RunGet;
  saveGameState: (game: ActiveGame) => void;
  getRoomCoaches: (
    roomCode: string,
    excludeName?: string,
  ) => Promise<string[]>;
  getCoachAvatars: (names: string[]) => Promise<Record<string, number>>;
}

export function createCoachDismissalHelpers(deps: CoachDismissalDeps) {
  const { io, runAll, runGet, saveGameState, getRoomCoaches, getCoachAvatars } =
    deps;

  // ── Internal helpers ───────────────────────────────────────────────────────

  /**
   * Regista um evento do mercado de treinadores para o resumo semanal
   * (modal "Mercado de Treinadores" emitido após cada jornada).
   */
  function recordMarketEvent(game: ActiveGame, event: CoachMarketEvent): void {
    if (!Array.isArray(game.coachMarketEvents)) game.coachMarketEvents = [];
    game.coachMarketEvents.push(event);
  }

  /** Re-emite teamsData (nomes de treinadores) para toda a sala. */
  function broadcastTeamsData(game: ActiveGame): void {
    getTeamsWithCoachNames(game.db)
      .then((allTeamsData) =>
        io.to(game.roomCode).emit("teamsData", allTeamsData),
      )
      .catch(() => {});
  }

  // ── Probability tables ─────────────────────────────────────────────────────
  const DISMISSAL_BY_LOSSES: Record<number, number> = {
    3: 0.1,
    4: 0.35,
    5: 0.7,
  };
  const DISMISSAL_BY_BUDGET: Record<number, number> = {
    3: 0.4,
    4: 0.7,
  };
  const DISMISSAL_BY_BUDGET_MAX = 0.95; // streak >= 5
  const INVITE_BY_WINS: Record<number, number> = {
    3: 0.05,
    4: 0.15,
    5: 0.35,
  };

  // Jogos mínimos à frente do clube antes de o treinador poder ser despedido
  // por forma/orçamento (evita despedir por resultados herdados do antecessor).
  const GRACE_MATCHES = 5;

  // Alvo da realocação: apenas os últimos N classificados de cada divisão em
  // consideração (mesma divisão ou inferior, nunca Distritais). Um treinador
  // despedido assume um clube em dificuldade, não o topo da tabela.
  const REASSIGN_BOTTOM_PLACES = 4;

  // ── Internal helpers ───────────────────────────────────────────────────────

  async function dismissHumanCoach(
    game: ActiveGame,
    coachName: string,
    reason: "results" | "budget" | "relegation",
    teamName: string,
    oldTeamId: number,
    division: number,
    detail: string,
    colors?: { colorPrimary?: string; colorSecondary?: string },
    opts?: { force?: boolean },
  ): Promise<void> {
    const player = game.playersByName[coachName];
    if (!player) return;

    // Máximo 1 despedimento por época: se já foi despedido esta época, ignora
    // qualquer novo gatilho (evita despedimentos em cascata). O despedimento
    // por despromoção (force) é obrigatório e ignora este limite.
    if (!opts?.force && game.dismissalsThisSeason.has(coachName)) return;

    const socketId = player.socketId;

    // Registar despedimento na época corrente. O force de despromoção não
    // consome o limite da nova época: é um evento estrutural de fim de época,
    // não um despedimento por desempenho.
    if (!opts?.force) game.dismissalsThisSeason.add(coachName);
    player.teamId = null;
    player.ready = false;
    game.dismissedCoachSince[coachName] = {
      matchweek: game.matchweek,
      division,
      reason,
      teamName,
      detail,
    };
    delete game.pendingJobOffers[coachName];
    game.lockedCoaches.delete(coachName);

    // Free the old team in the DB
    game.db.run("UPDATE teams SET manager_id = NULL WHERE id = ?", [oldTeamId]);

    recordMarketEvent(game, {
      type: "dismissal",
      coachName,
      teamName,
      division,
      reason,
      detail,
      isHuman: true,
      colorPrimary: colors?.colorPrimary,
      colorSecondary: colors?.colorSecondary,
    });

    // Notify coach
    if (socketId) {
      io.to(socketId).emit("coachDismissed", { reason, teamName, detail });
      io.to(socketId).emit("systemMessage", {
        text: `Foste despedido de ${teamName} ${detail}.`,
        broadcast: false,
      });
    }

    // Broadcast to room
    const reasonText =
      reason === "budget"
        ? " por insolvência financeira."
        : reason === "relegation"
          ? " por despromoção do Campeonato de Portugal."
          : " após má série de resultados.";
    io.to(game.roomCode).emit("systemMessage", {
      text: `${coachName} foi despedido de ${teamName}${reasonText}`,
      broadcast: true,
    });

    await autoAssignDismissedCoach(game, coachName, oldTeamId);
  }

  /**
   * Contrata um treinador NPC desempregado (ou cria um novo) para um clube NPC
   * cujo treinador acabou de ser despedido. Exclui o treinador recém-despedido
   * do pool para evitar que seja recontratado pelo mesmo clube na mesma semana.
   */
  async function hireNpcManager(
    game: ActiveGame,
    team: AnyRow,
    excludeName?: string,
  ): Promise<string | null> {
    const pool = await runAll<AnyRow>(
      game.db,
      "SELECT m.id, m.name FROM managers m WHERE (m.is_human IS NULL OR m.is_human = 0) AND m.id NOT IN (SELECT manager_id FROM teams WHERE manager_id IS NOT NULL) AND m.name != ? COLLATE NOCASE",
      [excludeName || ""],
    );

    let manager: AnyRow | undefined =
      pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : undefined;

    if (!manager) {
      // Pool vazio — criar um novo treinador NPC (nome único garantido)
      let insertedId: number | null = null;
      let name = "";
      for (let attempt = 0; attempt < 5 && insertedId === null; attempt += 1) {
        name = `Treinador ${Math.floor(10000 + Math.random() * 89999)}`;
        insertedId = await new Promise<number | null>((resolve) => {
          game.db.run(
            "INSERT INTO managers (name, reputation) VALUES (?, 50)",
            [name],
            function (this: any, err: any) {
              resolve(err ? null : this.lastID);
            },
          );
        });
      }
      if (insertedId === null) return null;
      manager = { id: insertedId, name };
    }

    game.db.run("UPDATE teams SET manager_id = ? WHERE id = ?", [
      manager.id,
      team.id,
    ]);

    // Novo treinador NPC: reinicia a carência (não despedir por resultados do antecessor).
    game.npcMatchesManaged[team.id] = 0;

    logClubNews(
      game,
      "manager_hired",
      `${team.name} contratou ${manager.name}`,
      team.id,
      { description: "Novo treinador" },
      io,
    );

    recordMarketEvent(game, {
      type: "hiring",
      coachName: manager.name,
      teamName: team.name,
      division: team.division,
      isHuman: false,
      colorPrimary: team.color_primary ?? undefined,
      colorSecondary: team.color_secondary ?? undefined,
    });

    io.to(game.roomCode).emit("systemMessage", {
      text: `${team.name} contratou ${manager.name}.`,
      broadcast: true,
    });

    broadcastTeamsData(game);
    return manager.name;
  }

  async function dismissNpcManager(
    game: ActiveGame,
    team: AnyRow,
  ): Promise<void> {
    // Obter o nome do treinador antes de anular o vínculo
    const mgr = await runGet<{ name: string }>(
      game.db,
      "SELECT m.name FROM managers m JOIN teams t ON t.manager_id = m.id WHERE t.id = ?",
      [team.id],
    );
    const coachName = mgr?.name ?? "Treinador";

    game.db.run("UPDATE teams SET manager_id = NULL WHERE id = ?", [team.id]);
    logClubNews(
      game,
      "manager_dismissed",
      `${team.name} despediu o treinador`,
      team.id,
      { description: "Despedimento após má série de resultados" },
      io,
    );

    recordMarketEvent(game, {
      type: "dismissal",
      coachName,
      teamName: team.name,
      division: team.division,
      isHuman: false,
      colorPrimary: team.color_primary ?? undefined,
      colorSecondary: team.color_secondary ?? undefined,
    });

    io.to(game.roomCode).emit("systemMessage", {
      text: `${team.name} despediu o seu treinador.`,
      broadcast: true,
    });

    // Contratar um substituto NPC
    await hireNpcManager(game, team, coachName);
  }

  async function offerJobToCoach(
    game: ActiveGame,
    coachName: string,
    fromTeamId: number,
    toTeam: AnyRow,
    fromTeam: AnyRow,
  ): Promise<void> {
    const player = game.playersByName[coachName];
    if (!player || !player.socketId) return;

    game.pendingJobOffers[coachName] = {
      fromTeamId,
      toTeamId: toTeam.id,
    };

    // Query squad for toTeam
    const squad = await runAll<AnyRow>(game.db,
      "SELECT * FROM players WHERE team_id = ? ORDER BY position, skill DESC, name",
      [toTeam.id],
    );
    const fullSquad = withJuniorGRs(squad, toTeam.id, game.matchweek);

    // Compute division ranking position
    const divisionTeams = await runAll<AnyRow>(game.db,
      "SELECT * FROM teams WHERE division = ?",
      [toTeam.division],
    );
    const sorted = divisionTeams.sort((a: AnyRow, b: AnyRow) => {
      const agd = (a.goals_for || 0) - (a.goals_against || 0);
      const bgd = (b.goals_for || 0) - (b.goals_against || 0);
      return (
        (b.points || 0) - (a.points || 0) ||
        bgd - agd ||
        (b.goals_for || 0) - (a.goals_for || 0) ||
        String(a.name || "").localeCompare(String(b.name || ""))
      );
    });
    const divisionPosition = sorted.findIndex((t: AnyRow) => t.id === toTeam.id) + 1;

    io.to(player.socketId).emit("jobOffer", {
      fromTeam: {
        id: fromTeam.id,
        name: fromTeam.name,
        division: fromTeam.division,
      },
      toTeam: {
        id: toTeam.id,
        name: toTeam.name,
        division: toTeam.division,
        points: toTeam.points,
        wins: toTeam.wins,
        draws: toTeam.draws,
        losses: toTeam.losses,
        goals_for: toTeam.goals_for,
        goals_against: toTeam.goals_against,
      },
      toTeamDivisionPosition: divisionPosition,
      toTeamSquad: fullSquad,
    });
  }

  async function autoAssignDismissedCoach(
    game: ActiveGame,
    coachName: string,
    oldTeamId: number,
  ): Promise<void> {
    const player = game.playersByName[coachName];
    if (!player) return;

    const dismissalInfo = game.dismissedCoachSince[coachName];
    const fromDivision = dismissalInfo?.division ?? 4;

    // Teams currently held by active human coaches
    const takenTeamIds = Object.values(game.playersByName)
      .map((p) => p.teamId)
      .filter((id): id is number => id !== null && id !== undefined);
    const takenSet = new Set(takenTeamIds);

    // Alvo: mesma divisão do despedimento, depois progressivamente inferiores
    // (número maior) até div 4 — nunca Distritais. Dentro de cada divisão,
    // apenas os últimos REASSIGN_BOTTOM_PLACES classificados (mesma ordenação
    // da tabela classificativa visível aos jogadores).
    const allCandidates: AnyRow[] =
      fromDivision <= 4
        ? await runAll<AnyRow>(
            game.db,
            "SELECT id, name, division, budget, color_primary, color_secondary, " +
              "points, wins, draws, losses, goals_for, goals_against, " +
              "stadium_capacity, stadium_name FROM teams WHERE division BETWEEN ? AND 4",
            [fromDivision],
          )
        : [];

    let team: AnyRow | undefined;
    for (let div = fromDivision; div <= 4 && !team; div++) {
      const divisionTeams = allCandidates.filter((t) => t.division === div);
      if (divisionTeams.length === 0) continue;
      const bottomPlaces = getStandingsRows(divisionTeams).slice(
        -REASSIGN_BOTTOM_PLACES,
      );
      const candidates = bottomPlaces.filter(
        (t) => t.id !== oldTeamId && !takenSet.has(t.id),
      );
      if (candidates.length > 0) {
        team = candidates[Math.floor(Math.random() * candidates.length)];
        break;
      }
    }

    // Fallback: os últimos N lugares de TODAS as divisões elegíveis estão
    // ocupados por outros humanos — relaxar para qualquer clube disponível na
    // mesma ordem de divisões, para nunca ficar o treinador sem clube.
    if (!team) {
      for (let div = fromDivision; div <= 4 && !team; div++) {
        const pool = allCandidates.filter(
          (t) => t.division === div && t.id !== oldTeamId && !takenSet.has(t.id),
        );
        if (pool.length > 0) {
          console.warn(
            `[${game.roomCode}] autoAssignDismissedCoach: bottom-${REASSIGN_BOTTOM_PLACES} places unavailable for ${coachName}; assigning any available club in div ${div}`,
          );
          team = pool[Math.floor(Math.random() * pool.length)];
        }
      }
    }

    if (!team) {
      console.warn(
        `[${game.roomCode}] autoAssignDismissedCoach: no available NPC team found for ${coachName} (dismissed from div ${fromDivision})`,
      );
      return;
    }

    const mgr = await runGet<{ id: number }>(
      game.db,
      "SELECT id FROM managers WHERE name = ?",
      [coachName],
    );
    if (!mgr) {
      console.warn(
        `[${game.roomCode}] autoAssignDismissedCoach: manager record not found for ${coachName}`,
      );
      return;
    }

    // Assign in DB and state
    game.db.run("UPDATE teams SET manager_id = ? WHERE id = ?", [
      mgr.id,
      team.id,
    ]);
    player.teamId = team.id;
    delete game.dismissedCoachSince[coachName];

    // Reiniciar carência, streak de orçamento e aviso da direcção: o treinador
    // herda um clube novo, não deve ser avaliado pelos resultados/contas do antecessor.
    game.coachMatchesManaged[coachName] = 0;
    game.negativeBudgetStreak[team.id] = 0;
    game.boardBudgetWarned[team.id] = 0;

    // Notify coach
    if (player.socketId) {
      getRoomCoaches(game.roomCode, coachName)
        .catch((): string[] => [])
        .then(async (coaches) => {
          const coachAvatars = await getCoachAvatars(coaches).catch(() => ({}));
          io.to(player.socketId as string).emit("teamAssigned", {
            teamName: team.name,
            teamId: team.id,
            division: team.division,
            budget: team.budget ?? 0,
            points: team.points ?? 0,
            wins: team.wins ?? 0,
            draws: team.draws ?? 0,
            losses: team.losses ?? 0,
            goalsFor: team.goals_for ?? 0,
            goalsAgainst: team.goals_against ?? 0,
            colorPrimary: team.color_primary ?? "#888888",
            colorSecondary: team.color_secondary ?? "#ffffff",
            stadiumCapacity: team.stadium_capacity ?? 0,
            stadiumName: team.stadium_name ?? "",
            coaches,
            coachAvatars,
            isNew: true,
          });
        });

      game.db.all(
        "SELECT * FROM players WHERE team_id = ?",
        [team.id],
        (err: any, squad: any[]) => {
          if (!err && player.socketId) {
            io.to(player.socketId as string).emit(
              "mySquad",
              ensureFullBench(
                withJuniorGRs(squad || [], team.id, game.matchweek || 1),
                team.id,
                game.matchweek || 1,
              ),
            );
          }
        },
      );
    }

    recordMarketEvent(game, {
      type: "hiring",
      coachName,
      teamName: team.name,
      division: team.division,
      isHuman: true,
      colorPrimary: team.color_primary ?? undefined,
      colorSecondary: team.color_secondary ?? undefined,
    });

    io.to(game.roomCode).emit("systemMessage", {
      text: `${coachName} foi atribuído a ${team.name}.`,
      broadcast: true,
    });

    broadcastTeamsData(game);
  }

  // ── RELEGATION (fim de época) ─────────────────────────────────────────────

  /**
   * Despedimento obrigatório de treinadores humanos cujos clubes acabaram nos
   * dois últimos lugares do Campeonato de Portugal (divisão 4) e foram
   * despromovidos para os Distritais (divisão 5, pool interno invisível).
   *
   * Diferenças face ao despedimento por forma/orçamento:
   *  - 100% garantido (sem rolagem de probabilidade);
   *  - ignora a carência (GRACE_MATCHES) e o limite de 1 despedimento/época;
   *  - não consome o limite de despedimentos da NOVA época (evento de fim de
   *    época, não um despedimento por desempenho).
   *
   * O coach é realocado automaticamente para outro clube NPC do Campeonato
   * de Portugal: a divisão de origem passada a `dismissHumanCoach` é sempre 4
   * (a equipa de origem já está na div 5 na DB quando isto é chamado).
   *
   * Chamado no fim de época com os IDs das equipas despromovidas da div 4.
   */
  const processRelegatedHumanCoaches = async (
    game: ActiveGame,
    relegatedTeamIds: number[],
  ): Promise<void> => {
    for (const teamId of relegatedTeamIds) {
      const team = await runGet<AnyRow>(
        game.db,
        `SELECT t.id, t.name, t.division, t.color_primary, t.color_secondary,
                m.name AS coach_name, m.is_human AS coach_is_human
         FROM teams t
         LEFT JOIN managers m ON t.manager_id = m.id
         WHERE t.id = ?`,
        [teamId],
      );
      if (!team || !team.coach_name) continue;
      if (!team.coach_is_human) continue; // só treinadores humanos

      await dismissHumanCoach(
        game,
        team.coach_name,
        "relegation",
        team.name,
        teamId,
        4, // divisão de origem (a equipa já está na div 5 na DB)
        "por despromoção do Campeonato de Portugal",
        {
          colorPrimary: team.color_primary,
          colorSecondary: team.color_secondary,
        },
        { force: true },
      );
    }

    // O caminho de fim de época não passa por processCoachEvents (que
    // normalmente emite e limpa o resumo) — emitir aqui para o modal "Mercado
    // de Treinadores" mostrar os despedimentos/contratações da despromoção.
    if (game.coachMarketEvents && game.coachMarketEvents.length > 0) {
      io.to(game.roomCode).emit("coachMarketReport", {
        matchweek: game.matchweek,
        events: game.coachMarketEvents,
      });
      game.coachMarketEvents = [];
    }
  };

  // ── MAIN FUNCTION ─────────────────────────────────────────────────────────

  const processCoachEvents = async (game: ActiveGame): Promise<void> => {
    // Resumo semanal do mercado de treinadores (limpo após emissão do report)
    game.coachMarketEvents = [];

    // 1. Carregar equipas e forms
    const allTeams = await runAll<AnyRow>(game.db, "SELECT * FROM teams");
    const forms: Record<number, string> = await getAllTeamForms(
      game.db,
      game.season,
    );

    // 2. Equipas humanas activas
    const humanTeamIds = new Set<number>(
      Object.values(game.playersByName)
        .map((p) => p.teamId)
        .filter((id): id is number => id !== null && id !== undefined),
    );

    // 2b. Incrementar a tenure (jogos dirigidos) de cada coach humano ativo.
    for (const player of Object.values(game.playersByName)) {
      if (player.teamId === null || player.teamId === undefined) continue;
      game.coachMatchesManaged[player.name] =
        (game.coachMatchesManaged[player.name] ?? 0) + 1;
    }

    // 3. Loop coaches humanos activos — budget e forma
    for (const player of Object.values(game.playersByName)) {
      if (player.teamId === null || player.teamId === undefined) continue;

      const coachName = player.name;
      const teamId = player.teamId;
      const team = allTeams.find((t) => t.id === teamId);
      if (!team) continue;

      // Carência: só avalia forma/orçamento após GRACE_MATCHES jogos no clube.
      if ((game.coachMatchesManaged[coachName] ?? 0) < GRACE_MATCHES) continue;

      // 4a. Budget check
      const budget = team.budget ?? 0;
      if (budget < 0) {
        game.negativeBudgetStreak[teamId] =
          (game.negativeBudgetStreak[teamId] ?? 0) + 1;
        const streak = game.negativeBudgetStreak[teamId];

        // Aviso da direcção antes do despedimento por insolvência.
        const warned = game.boardBudgetWarned[teamId] ?? 0;
        if (warned < 1 && streak >= 1) {
          game.boardBudgetWarned[teamId] = 1;
          if (player.socketId) {
            io.to(player.socketId).emit("systemMessage", {
              text: "⚠️ A Direcção alerta: orçamento negativo — risco de bancarrota se a tendência continuar.",
              broadcast: false,
            });
          }
        } else if (warned < 3 && streak >= 3) {
          game.boardBudgetWarned[teamId] = 3;
          if (player.socketId) {
            io.to(player.socketId).emit("systemMessage", {
              text: "⚠️ ÚLTIMO AVISO: a Direcção admite despedimento por insolvência se o orçamento continuar negativo.",
              broadcast: false,
            });
          }
        }

        let dismissalChance = 0;
        if (streak >= 5) {
          dismissalChance = DISMISSAL_BY_BUDGET_MAX;
        } else if (streak >= 3) {
          dismissalChance = DISMISSAL_BY_BUDGET[streak] ?? 0;
        }
        if (dismissalChance > 0 && Math.random() < dismissalChance) {
          await dismissHumanCoach(
            game,
            coachName,
            "budget",
            team.name,
            teamId,
            team.division,
            `após ${streak} semanas consecutivas com orçamento negativo`,
            {
              colorPrimary: team.color_primary,
              colorSecondary: team.color_secondary,
            },
          );
          continue; // already dismissed
        }
      } else {
        game.negativeBudgetStreak[teamId] = 0;
        game.boardBudgetWarned[teamId] = 0;
      }

      // Guard: might have been dismissed by budget check above
      const currentPlayer = game.playersByName[coachName];
      if (!currentPlayer || currentPlayer.teamId === null) continue;

      // 4b. Forma check
      const form = forms[teamId] ?? "";
      const results = form.split("").slice(0, 5);
      const lossCount = results.filter((r) => r === "D").length;
      const formDismissalChance = DISMISSAL_BY_LOSSES[lossCount] ?? 0;
      if (formDismissalChance > 0 && Math.random() < formDismissalChance) {
        await dismissHumanCoach(
          game,
          coachName,
          "results",
          team.name,
          teamId,
          team.division,
          lossCount === 5
            ? "após 5 derrotas consecutivas"
            : `após ${lossCount} derrotas nos últimos 5 jogos`,
          {
            colorPrimary: team.color_primary,
            colorSecondary: team.color_secondary,
          },
        );
      }
    }

    // 4. Loop equipas NPC — forma (limiar de 5 derrotas sem aleatoriedade)
    // Re-consultar equipas com o estado do treinador: um humano que acabou de
    // ser auto-atribuído a um clube NPC (após despedimento) não pode ser
    // despedido no mesmo ciclo, e clubes órfãos (sem treinador) são ignorados.
    const npcTeams = await runAll<AnyRow>(
      game.db,
      "SELECT t.*, m.is_human AS coach_is_human FROM teams t LEFT JOIN managers m ON t.manager_id = m.id",
    );
    for (const team of npcTeams) {
      if (team.coach_is_human !== 0) continue; // só treinadores NPC (skip humanos/órfãos)
      if (team.division === 5) continue; // pool interno, invisível

      // Carência: só avalia forma após GRACE_MATCHES jogos do treinador atual.
      game.npcMatchesManaged[team.id] =
        (game.npcMatchesManaged[team.id] ?? 0) + 1;
      if ((game.npcMatchesManaged[team.id] ?? 0) < GRACE_MATCHES) continue;

      const form = forms[team.id] ?? "";
      const results = form.split("").slice(0, 5);
      const lossCount = results.filter((r) => r === "D").length;
      if (lossCount < 5) continue;
      await dismissNpcManager(game, team);
    }

    // 5. Loop coaches humanos activos sobreviventes — verificar convites
    // Track NPC teams already offered (this cycle + stale offers from prior weeks)
    // to prevent the same NPC club from being offered to two different coaches.
    const offeredTeamIds = new Set<number>(
      Object.values(game.pendingJobOffers).map((o) => o.toTeamId),
    );
    for (const player of Object.values(game.playersByName)) {
      if (player.teamId === null || player.teamId === undefined) continue;

      const coachName = player.name;
      const teamId = player.teamId;
      const team = allTeams.find((t) => t.id === teamId);
      if (!team) continue;
      if (team.division <= 1) continue; // já na primeira divisão
      if (game.pendingJobOffers[coachName]) continue; // já tem oferta

      const form = forms[teamId] ?? "";
      const results = form.split("").slice(0, 5);
      const winCount = results.filter((r) => r === "V").length;
      const inviteChance = INVITE_BY_WINS[winCount] ?? 0;
      if (inviteChance <= 0 || Math.random() >= inviteChance) continue;

      // Equipa NPC na divisão superior (excluir equipas já oferecidas a outro coach)
      const targetDivision = team.division - 1;
      const npcCandidates = allTeams.filter(
        (t) =>
          t.division === targetDivision &&
          !humanTeamIds.has(t.id) &&
          !offeredTeamIds.has(t.id),
      );
      if (npcCandidates.length === 0) continue;

      // Preferir equipas em má forma (< 2 vitórias nos últimos 5 jogos)
      const struggling = npcCandidates.filter((t) => {
        const f = forms[t.id] ?? "";
        const wins = f.split("").slice(0, 5).filter((r: string) => r === "V").length;
        return wins < 2;
      });
      const pool = struggling.length > 0 ? struggling : npcCandidates;
      const toTeam = pool[Math.floor(Math.random() * pool.length)];
      offeredTeamIds.add(toTeam.id);
      await offerJobToCoach(game, coachName, teamId, toTeam, team);
    }

    // 6. Persistir estado
    saveGameState(game);
  };

  // ── ACCEPT / DECLINE JOB OFFER ────────────────────────────────────────────

  const handleAcceptJobOffer = async (
    game: ActiveGame,
    coachName: string,
  ): Promise<void> => {
    const offer = game.pendingJobOffers[coachName];
    if (!offer) return;

    const player = game.playersByName[coachName];
    if (!player) return;

    const { fromTeamId, toTeamId } = offer;

    // Guard: verificar se o clube de destino ainda está disponível
    // (defesa contra race conditions onde dois coaches aceitam o mesmo convite)
    const existingCoach = Object.values(game.playersByName).find(
      (p) => p.teamId === toTeamId && p.name !== coachName,
    );
    if (existingCoach) {
      delete game.pendingJobOffers[coachName];
      if (player.socketId) {
        io.to(player.socketId).emit("systemMessage", {
          text: "Este clube já foi atribuído a outro treinador. O convite expirou.",
          broadcast: false,
        });
      }
      saveGameState(game);
      return;
    }

    const mgr = await runGet<{ id: number }>(
      game.db,
      "SELECT id FROM managers WHERE name = ?",
      [coachName],
    );
    if (!mgr) return;

    // Update DB
    game.db.run("UPDATE teams SET manager_id = ? WHERE id = ?", [
      mgr.id,
      toTeamId,
    ]);
    game.db.run("UPDATE teams SET manager_id = NULL WHERE id = ?", [
      fromTeamId,
    ]);

    // Update in-memory state
    player.teamId = toTeamId;
    delete game.pendingJobOffers[coachName];

    // Novo clube: reiniciar carência, streak de orçamento e aviso da direcção.
    game.coachMatchesManaged[coachName] = 0;
    game.negativeBudgetStreak[toTeamId] = 0;
    game.boardBudgetWarned[toTeamId] = 0;

    // Fetch new team details
    const team = await runGet<AnyRow>(
      game.db,
      "SELECT id, name, division, budget, points, wins, draws, losses, " +
        "goals_for, goals_against, color_primary, color_secondary, " +
        "stadium_capacity, stadium_name FROM teams WHERE id = ?",
      [toTeamId],
    );
    if (!team) return;

    if (player.socketId) {
      getRoomCoaches(game.roomCode, coachName)
        .catch((): string[] => [])
        .then(async (coaches) => {
          const coachAvatars = await getCoachAvatars(coaches).catch(() => ({}));
          io.to(player.socketId as string).emit("teamAssigned", {
            teamName: team.name,
            teamId: team.id,
            division: team.division,
            budget: team.budget ?? 0,
            points: team.points ?? 0,
            wins: team.wins ?? 0,
            draws: team.draws ?? 0,
            losses: team.losses ?? 0,
            goalsFor: team.goals_for ?? 0,
            goalsAgainst: team.goals_against ?? 0,
            colorPrimary: team.color_primary ?? "#888888",
            colorSecondary: team.color_secondary ?? "#ffffff",
            stadiumCapacity: team.stadium_capacity ?? 0,
            stadiumName: team.stadium_name ?? "",
            coaches,
            coachAvatars,
            isNew: false,
          });
        });

      game.db.all(
        "SELECT * FROM players WHERE team_id = ?",
        [toTeamId],
        (err: any, squad: any[]) => {
          if (!err && player.socketId) {
            io.to(player.socketId as string).emit(
              "mySquad",
              ensureFullBench(
                withJuniorGRs(squad || [], toTeamId, game.matchweek || 1),
                toTeamId,
                game.matchweek || 1,
              ),
            );
          }
        },
      );
    }

    io.to(game.roomCode).emit("systemMessage", {
      text: `${coachName} aceitou o convite de ${team.name}.`,
      broadcast: true,
    });

    // Broadcast updated teams
    getTeamsWithCoachNames(game.db)
      .then((teams) => io.to(game.roomCode).emit("teamsData", teams))
      .catch(() => {});

    saveGameState(game);
  };

  const handleDeclineJobOffer = (game: ActiveGame, coachName: string): void => {
    delete game.pendingJobOffers[coachName];
  };

  return {
    processCoachEvents,
    processRelegatedHumanCoaches,
    handleAcceptJobOffer,
    handleDeclineJobOffer,
  };
}
