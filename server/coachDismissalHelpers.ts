import type { ActiveGame, CoachMarketEvent } from "./types";
import type { Server as SocketServer, Socket } from "socket.io";
import {
  NPC_NEGATIVE_BUDGET_WARN_STREAK,
  NPC_NEGATIVE_BUDGET_CUT_STREAK,
  NPC_NEGATIVE_BUDGET_CUT_INTERVAL,
  npcStructuralBreakEvenFolha,
} from "./gameConstants";
import {
  getAllTeamForms,
  getStandingsRows,
  logClubNews,
  logClubNewsOnce,
  getTeamsWithCoachNames,
  currentSlot,
  runExec,
} from "./coreHelpers";
import { withJuniorGRs, ensureFullBench } from "./game/engine";
import { upcomingMatchweek } from "./game/lineupReady";
import { deleteSeat, setSeatTeamId } from "./roomStateHelpers";

/** Subconjunto da API sqlite3 usado neste helper (o projeto não tem @types/sqlite3). */
interface Db {
  run(
    sql: string,
    params?: any[],
    callback?: (this: any, err: Error | null) => void,
  ): unknown;
  all(
    sql: string,
    params?: any[],
    callback?: (err: Error | null, rows: any[]) => void,
  ): unknown;
  get(
    sql: string,
    params?: any[],
    callback?: (err: Error | null, row: any) => void,
  ): unknown;
}
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
  io: SocketServer;
  runAll: RunAll;
  runGet: RunGet;
  saveGameState: (game: ActiveGame) => void;
  getRoomCoaches: (
    roomCode: string,
    excludeName?: string,
  ) => Promise<string[]>;
  getCoachAvatars: (names: string[]) => Promise<Record<string, number>>;
  forceNpcWageCut: (
    game: ActiveGame,
    team: AnyRow,
  ) => Promise<number>;
}

export function createCoachDismissalHelpers(deps: CoachDismissalDeps) {
  const {
    io,
    runAll,
    runGet,
    saveGameState,
    getRoomCoaches,
    getCoachAvatars,
    forceNpcWageCut,
  } = deps;

  // ── Internal helpers ───────────────────────────────────────────────────────

  /** Cartão de um clube oferecido na troca pós-despedimento (só o que o modal mostra). */
  const toClubOption = (t: AnyRow) => ({
    teamId: t.id,
    teamName: t.name,
    division: t.division,
    budget: t.budget ?? 0,
    points: t.points ?? 0,
    wins: t.wins ?? 0,
    draws: t.draws ?? 0,
    losses: t.losses ?? 0,
    colorPrimary: t.color_primary ?? "#888888",
    colorSecondary: t.color_secondary ?? "#ffffff",
    crest: t.crest ?? null,
  });

  /**
   * Regista um evento do mercado de treinadores para o resumo semanal
   * (modal "Mercado de Treinadores" emitido após cada jornada).
   */
  async function recordMarketEvent(
    game: ActiveGame,
    event: CoachMarketEvent,
  ): Promise<void> {
    if (!Array.isArray(game.coachMarketEvents)) game.coachMarketEvents = [];

    // Foto real do treinador (zerozero) — procurada por nome para persistir no
    // evento mesmo quando o treinador fica desempregado após o despedimento
    // (nesse caso já não aparece em nenhuma equipa em `teams`).
    let coachPhoto: string | undefined;
    try {
      const mgr = await runGet<{ photo: string | null }>(
        game.db,
        "SELECT photo FROM managers WHERE name = ? COLLATE NOCASE",
        [event.coachName],
      );
      if (mgr?.photo) coachPhoto = mgr.photo;
    } catch {
      // falha silenciosa — o cliente usa o avatar procedural como fallback
    }

    game.coachMarketEvents.push({ ...event, coachPhoto });
  }

  /** Re-emite teamsData (nomes de treinadores) para toda a sala. */
  function broadcastTeamsData(game: ActiveGame): void {
    getTeamsWithCoachNames(game.db)
      .then((allTeamsData) =>
        io.to(game.roomCode).emit("teamsData", allTeamsData),
      )
      .catch(() => {});
  }

  /**
   * Emite teamAssigned + mySquad para um treinador (partilhado pelo
   * auto-assign pós-despedimento e pelo aceitar de convite).
   */
  async function emitTeamAssigned(
    game: ActiveGame,
    coachName: string,
    team: AnyRow,
    isNew: boolean,
    dismissalOptions?: AnyRow[],
  ): Promise<void> {
    const player = game.playersByName[coachName];
    if (!player?.socketId) return;
    const socketId: string = player.socketId;

    getRoomCoaches(game.roomCode, coachName)
      .catch((): string[] => [])
      .then(async (coaches) => {
        const coachAvatars = await getCoachAvatars(coaches).catch(() => ({}));
        io.to(socketId).emit("teamAssigned", {
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
          crest: team.crest ?? null,
          stadiumCapacity: team.stadium_capacity ?? 0,
          stadiumName: team.stadium_name ?? "",
          coaches,
          coachAvatars,
          isNew,
          ...(dismissalOptions && dismissalOptions.length > 0
            ? { dismissalOptions: dismissalOptions.map(toClubOption) }
            : {}),
        });
      });

    try {
      const squad = await runAll<AnyRow>(
        game.db,
        "SELECT * FROM players WHERE team_id = ?",
        [team.id],
      );
      io.to(socketId).emit(
        "mySquad",
        ensureFullBench(
          withJuniorGRs(squad, team.id, upcomingMatchweek(game)),
          team.id,
          upcomingMatchweek(game),
        ),
      );
    } catch (e) {
      console.warn(`[${game.roomCode}] mySquad failed:`, (e as Error)?.message);
    }
  }

  /**
   * Escrita esperada que nunca rebenta o fluxo: `unhandledRejection` desliga
   * o servidor, por isso a falha fica em warn em vez de propagar.
   */
  async function execQuiet(
    game: ActiveGame,
    sql: string,
    params: any[] = [],
  ): Promise<void> {
    try {
      await runExec(game.db, sql, params);
    } catch (e) {
      console.warn(
        `[${game.roomCode}] db write failed:`,
        (e as Error)?.message,
        sql,
      );
    }
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
    // Assento sem clube: deixa de ser obrigatório na ronda (a sala descongela
    // sem ele). Volta a ser criado quando aceitar um novo emprego.
    deleteSeat(game, coachName);
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
    await execQuiet(
      game,
      "UPDATE teams SET manager_id = NULL WHERE id = ?",
      [oldTeamId],
    );

    await recordMarketEvent(game, {
      type: "dismissal",
      coachName,
      teamId: oldTeamId,
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
      cm: true,
    });

    await autoAssignDismissedCoach(game, coachName, oldTeamId);
    await backfillVacatedClub(game, oldTeamId, coachName);
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

    await execQuiet(game, "UPDATE teams SET manager_id = ? WHERE id = ?", [
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

    await recordMarketEvent(game, {
      type: "hiring",
      coachName: manager.name,
      teamId: team.id,
      teamName: team.name,
      division: team.division,
      isHuman: false,
      colorPrimary: team.color_primary ?? undefined,
      colorSecondary: team.color_secondary ?? undefined,
    });

    io.to(game.roomCode).emit("systemMessage", {
      text: `${team.name} contratou ${manager.name}.`,
      broadcast: true,
      cm: true,
    });

    broadcastTeamsData(game);
    return manager.name;
  }

  /**
   * Clube que ficou sem treinador porque o humano saiu (despedido ou a aceitar
   * convite): entra um NPC. Distritais (div 5) são pool interno e ficam de fora.
   */
  async function backfillVacatedClub(
    game: ActiveGame,
    teamId: number,
    exceptName: string,
  ): Promise<void> {
    const team = await runGet<AnyRow>(
      game.db,
      "SELECT * FROM teams WHERE id = ? AND manager_id IS NULL",
      [teamId],
    );
    if (!team || team.division === 5) return;
    await hireNpcManager(game, team, exceptName);
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

    await execQuiet(
      game,
      "UPDATE teams SET manager_id = NULL WHERE id = ?",
      [team.id],
    );
    logClubNews(
      game,
      "manager_dismissed",
      `${team.name} despediu o treinador`,
      team.id,
      { description: "Despedimento após má série de resultados" },
      io,
    );

    await recordMarketEvent(game, {
      type: "dismissal",
      coachName,
      teamId: team.id,
      teamName: team.name,
      division: team.division,
      isHuman: false,
      colorPrimary: team.color_primary ?? undefined,
      colorSecondary: team.color_secondary ?? undefined,
    });

    io.to(game.roomCode).emit("systemMessage", {
      text: `${team.name} despediu o seu treinador.`,
      broadcast: true,
      cm: true,
    });

    // Contratar um substituto NPC
    await hireNpcManager(game, team, coachName);
  }

  async function buildJobOfferPayload(
    game: ActiveGame,
    fromTeam: AnyRow,
    toTeam: AnyRow,
  ) {
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

    return {
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
    };
  }

  async function offerJobToCoach(
    game: ActiveGame,
    coachName: string,
    fromTeamId: number,
    toTeam: AnyRow,
    fromTeam: AnyRow,
  ): Promise<void> {
    const player = game.playersByName[coachName];
    if (!player) return;

    game.pendingJobOffers[coachName] = {
      fromTeamId,
      toTeamId: toTeam.id,
    };

    const payload = await buildJobOfferPayload(game, fromTeam, toTeam);
    // Espelho no Jornal com data fixa (a semana do convite).
    try {
      logClubNewsOnce(
        game,
        "job_offer",
        `Convite: ${toTeam.name}`,
        fromTeam.id,
        {
          related_team_id: toTeam.id,
          related_team_name: toTeam.name,
          description: JSON.stringify({
            v: 1,
            fromTeamId: fromTeam.id,
            fromTeamName: fromTeam.name,
            position: payload.toTeamDivisionPosition ?? null,
            points: toTeam.points ?? null,
            wins: toTeam.wins ?? 0,
            draws: toTeam.draws ?? 0,
            losses: toTeam.losses ?? 0,
          }),
        },
        io,
      );
    } catch (e) {
      console.warn(`[${game.roomCode}] job_offer news failed:`, (e as Error)?.message);
    }
    // Sem socket (queda de rede): o pendente fica e o resendPendingJobOffer
    // entrega-o no rejoin.
    if (player.socketId) io.to(player.socketId).emit("jobOffer", payload);
  }

  /**
   * resendPendingJobOffer — o convite sobrevive ao refresh: o estado do
   * cliente morreu mas o pendente continua no servidor. Re-emite o mesmo
   * payload (mesmos ids → o «lido» do Jornal vale e não duplica).
   */
  async function resendPendingJobOffer(
    game: ActiveGame,
    toSocket: Socket,
    coachName: string,
  ): Promise<boolean> {
    const pending = game.pendingJobOffers[coachName];
    if (!pending) return false;
    const toTeam = await runGet<AnyRow>(
      game.db,
      "SELECT * FROM teams WHERE id = ?",
      [pending.toTeamId],
    );
    const fromTeam = await runGet<AnyRow>(
      game.db,
      "SELECT * FROM teams WHERE id = ?",
      [pending.fromTeamId],
    );
    if (!toTeam || !fromTeam) return false;
    toSocket.emit(
      "jobOffer",
      await buildJobOfferPayload(game, fromTeam, toTeam),
    );
    return true;
  }

  /**
   * resendBoardWarning — o aviso da direção sobrevive ao refresh enquanto o
   * orçamento continuar no vermelho. Se já recuperou, não volta (assunto
   * encerrado). Mesmos ids → o «lido» do Jornal vale e não duplica.
   */
  async function resendBoardWarning(
    game: ActiveGame,
    toSocket: Socket,
    teamId: number,
  ): Promise<boolean> {
    const level = game.boardBudgetWarned[teamId] ?? 0;
    if (level <= 0) return false;
    const team = await runGet<AnyRow>(
      game.db,
      "SELECT * FROM teams WHERE id = ?",
      [teamId],
    );
    if (!team || (team.budget ?? 0) >= 0) return false;
    toSocket.emit("boardBudgetWarning", {
      level,
      budget: team.budget,
      streak: game.negativeBudgetStreak[teamId] ?? 1,
      teamId: team.id,
      teamName: team.name,
      division: team.division,
      crest: team.crest ?? null,
      colorPrimary: team.color_primary,
      colorSecondary: team.color_secondary,
    });
    return true;
  }

  /**
   * Põe o treinador humano num clube: DB, assento durável, carência e streaks
   * a zero, notícias do clube limpas (era NPC). Não emite nada ao cliente.
   */
  async function assignCoachToTeam(
    game: ActiveGame,
    coachName: string,
    managerId: number,
    team: AnyRow,
  ): Promise<void> {
    const player = game.playersByName[coachName];
    if (!player) return;
    await execQuiet(game, "UPDATE teams SET manager_id = ? WHERE id = ?", [
      managerId,
      team.id,
    ]);
    player.teamId = team.id;
    // Recriar o assento (apagado no despedimento) com o novo clube: sem isto
    // a sala não congela na ausência dele e um restart perde-lhe a equipa.
    setSeatTeamId(game, coachName, team.id);

    // Reiniciar carência, streak de orçamento e aviso da direcção: o treinador
    // herda um clube novo, não deve ser avaliado pelos resultados/contas do antecessor.
    game.coachMatchesManaged[coachName] = 0;
    game.negativeBudgetStreak[team.id] = 0;
    game.boardBudgetWarned[team.id] = 0;

    // Era NPC: limpar as notícias acumuladas antes de entregar o clube —
    // sem isto o treinador herdava a caixa cheia como não lida.
    await clearInheritedNews(game, team.id);
  }

  /**
   * Era NPC: apaga as notícias do clube e grava um marco 'takeover' (oculto no
   * Jornal) — as transferências anteriores a ele deixam de aparecer na caixa.
   */
  async function clearInheritedNews(game: ActiveGame, teamId: number) {
    await execQuiet(game, "DELETE FROM club_news WHERE team_id = ?", [teamId]);
    await execQuiet(
      game,
      "INSERT INTO club_news (team_id, type, title, year) VALUES (?, 'takeover', '', ?)",
      [teamId, game.year || 0],
    );
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
            "SELECT * FROM teams WHERE division BETWEEN ? AND 4",
            [fromDivision],
          )
        : [];

    const shuffle = <T,>(arr: T[]): T[] =>
      arr
        .map((v) => [Math.random(), v] as const)
        .sort((a, b) => a[0] - b[0])
        .map(([, v]) => v);
    const free = (t: AnyRow) => t.id !== oldTeamId && !takenSet.has(t.id);

    // Ordem de preferência: por divisão, primeiro os últimos N classificados
    // (sorteados entre si). Quem sobra de cada divisão fica para o fim — assim
    // nunca falta clube quando os últimos lugares estão todos ocupados por
    // outros humanos.
    const preferred: AnyRow[] = [];
    const spare: AnyRow[] = [];
    for (let div = fromDivision; div <= 4; div++) {
      const divisionTeams = allCandidates.filter((t) => t.division === div);
      if (divisionTeams.length === 0) continue;
      const bottomIds = new Set(
        getStandingsRows(divisionTeams)
          .slice(-REASSIGN_BOTTOM_PLACES)
          .map((t) => t.id),
      );
      preferred.push(
        ...shuffle(divisionTeams.filter((t) => bottomIds.has(t.id) && free(t))),
      );
      spare.push(
        ...shuffle(divisionTeams.filter((t) => !bottomIds.has(t.id) && free(t))),
      );
    }
    const ordered = [...preferred, ...spare];
    const team: AnyRow | undefined = ordered[0];
    if (team && preferred.length === 0) {
      console.warn(
        `[${game.roomCode}] autoAssignDismissedCoach: bottom-${REASSIGN_BOTTOM_PLACES} places unavailable for ${coachName}; assigning any available club`,
      );
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

    await assignCoachToTeam(game, coachName, mgr.id, team);
    delete game.dismissedCoachSince[coachName];

    // Troca imediata: o treinador já tem o clube (nunca fica sem ele); o modal
    // oferece-lhe mais 2 como alternativa até confirmar ou o jogo recomeçar.
    const alternatives = ordered.slice(1, 3);
    if (alternatives.length > 0) {
      game.dismissalOptions[coachName] = [team, ...alternatives].map((t) => t.id);
    } else {
      delete game.dismissalOptions[coachName];
    }

    // Notify coach
    await emitTeamAssigned(game, coachName, team, true, alternatives);

    await recordMarketEvent(game, {
      type: "hiring",
      coachName,
      teamId: team.id,
      teamName: team.name,
      division: team.division,
      isHuman: true,
      colorPrimary: team.color_primary ?? undefined,
      colorSecondary: team.color_secondary ?? undefined,
    });

    io.to(game.roomCode).emit("systemMessage", {
      text: `${coachName} foi atribuído a ${team.name}.`,
      broadcast: true,
      cm: true,
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
    // A janela de troca pós-despedimento fecha com a jornada seguinte.
    game.dismissalOptions = {};

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

        // Aviso da direcção antes do despedimento por insolvência — emitido
        // como modal dedicado (boardBudgetWarning) em vez do antigo toast.
        const warned = game.boardBudgetWarned[teamId] ?? 0;
        const emitBoardWarning = (level: number) => {
          io.to(player.socketId).emit("boardBudgetWarning", {
            level,
            budget,
            streak,
            teamId,
            teamName: team.name,
            division: team.division,
            crest: team.crest ?? null,
            colorPrimary: team.color_primary,
            colorSecondary: team.color_secondary,
          });
          // Espelho no Jornal com data fixa (a semana do aviso).
          try {
            logClubNewsOnce(
              game,
              "board_warning",
              level === 3 ? "Último aviso da direção" : "Aviso da direção",
              team.id,
              {
                description: JSON.stringify({
                  v: 1,
                  level,
                  budget,
                  streak,
                }),
              },
              io,
            );
          } catch (e) {
            console.warn(`[${game.roomCode}] board_warning news failed:`, (e as Error)?.message);
          }
        };
        if (warned < 1 && streak >= 1) {
          game.boardBudgetWarned[teamId] = 1;
          if (player.socketId) emitBoardWarning(1);
        } else if (warned < 3 && streak >= 3) {
          game.boardBudgetWarned[teamId] = 3;
          if (player.socketId) emitBoardWarning(3);
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
    // Folha salarial de todas as equipas numa só query (evita um SUM por clube).
    const folhaByTeam = new Map<number, number>(
      (
        await runAll<{ team_id: number; w: number }>(
          game.db,
          "SELECT team_id, COALESCE(SUM(wage), 0) AS w FROM players GROUP BY team_id",
        )
      ).map((r) => [r.team_id, r.w]),
    );
    for (const team of npcTeams) {
      if (team.coach_is_human !== 0) continue; // só treinadores NPC (skip humanos/órfãos)
      if (team.division === 5) continue; // pool interno, invisível

      // Insolvência ESTRUTURAL (independe da carência do treinador): a folha
      // salarial excede o que a equipa ganha numa época inteira (break-even),
      // por isso o saldo não se recupera sozinho. Um saldo só negativamente
      // transitório (folha ≤ break-even, recuperável no patrocínio de fim de
      // época) NÃO conta — só corta quem perde dinheiro com garantia.
      const breakEven = npcStructuralBreakEvenFolha(team.division ?? 4);
      const folha = folhaByTeam.get(team.id) ?? 0;
      if ((team.budget ?? 0) < 0 && folha > breakEven) {
        game.npcNegativeBudgetStreak[team.id] =
          (game.npcNegativeBudgetStreak[team.id] ?? 0) + 1;
        const streak = game.npcNegativeBudgetStreak[team.id];
        if (streak === NPC_NEGATIVE_BUDGET_WARN_STREAK) {
          logClubNews(game, "cost_cut", "Aviso de restrições", team.id, {
            description: `A direção alerta: a folha salarial excede a receita e o orçamento está negativo há ${streak} semanas.`,
          });
        } else if (
          streak >= NPC_NEGATIVE_BUDGET_CUT_STREAK &&
          (streak - NPC_NEGATIVE_BUDGET_CUT_STREAK) %
            NPC_NEGATIVE_BUDGET_CUT_INTERVAL ===
            0
        ) {
          await forceNpcWageCut(game, team);
        }
      } else {
        game.npcNegativeBudgetStreak[team.id] = 0;
      }

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

  // Reserva síncrona de clubes em atribuição (antes do primeiro await): dois
  // treinadores a aceitar/trocar para o mesmo clube ao mesmo tempo não passam
  // ambos a guarda «clube sem humano» enquanto o outro ainda está a gravar.
  const teamClaims = (game: ActiveGame): Set<number> =>
    ((game as any)._teamClaims ??= new Set<number>());

  const handleAcceptJobOffer = async (
    game: ActiveGame,
    coachName: string,
  ): Promise<void> => {
    const toTeamId = game.pendingJobOffers[coachName]?.toTeamId;
    if (toTeamId == null) return acceptJobOfferNow(game, coachName);
    const claims = teamClaims(game);
    if (claims.has(toTeamId)) {
      delete game.pendingJobOffers[coachName];
      const socketId = game.playersByName[coachName]?.socketId;
      if (socketId) {
        io.to(socketId).emit("systemMessage", {
          text: "Este clube já foi atribuído a outro treinador. O convite expirou.",
          broadcast: false,
        });
      }
      saveGameState(game);
      return;
    }
    claims.add(toTeamId);
    try {
      await acceptJobOfferNow(game, coachName);
    } finally {
      claims.delete(toTeamId);
    }
  };

  const acceptJobOfferNow = async (
    game: ActiveGame,
    coachName: string,
  ): Promise<void> => {
    const offer = game.pendingJobOffers[coachName];
    if (!offer) {
      console.warn(`[${game.roomCode}] acceptJobOffer sem convite pendente: ${coachName}`);
      return;
    }

    const player = game.playersByName[coachName];
    if (!player) {
      console.warn(`[${game.roomCode}] acceptJobOffer sem sessão em memória: ${coachName}`);
      return;
    }

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
    if (!mgr) {
      console.warn(`[${game.roomCode}] acceptJobOffer sem registo em managers: ${coachName}`);
      return;
    }

    // Update DB
    await execQuiet(game, "UPDATE teams SET manager_id = ? WHERE id = ?", [
      mgr.id,
      toTeamId,
    ]);
    await execQuiet(
      game,
      "UPDATE teams SET manager_id = NULL WHERE id = ?",
      [fromTeamId],
    );

    await backfillVacatedClub(game, fromTeamId, coachName);

    // Update in-memory state
    player.teamId = toTeamId;
    // O assento é a fonte durável (loadSeats pós-restart): sem isto o treinador
    // ressuscitava no clube antigo e Jornal/briefing ficavam obsoletos ao refresh.
    setSeatTeamId(game, coachName, toTeamId);
    delete game.pendingJobOffers[coachName];

    // Novo clube: reiniciar carência, streak de orçamento e aviso da direcção.
    game.coachMatchesManaged[coachName] = 0;
    game.negativeBudgetStreak[toTeamId] = 0;
    game.boardBudgetWarned[toTeamId] = 0;

    // Fetch new team details
    const team = await runGet<AnyRow>(
      game.db,
      "SELECT id, name, division, budget, points, wins, draws, losses, " +
        "goals_for, goals_against, color_primary, color_secondary, crest, " +
        "stadium_capacity, stadium_name FROM teams WHERE id = ?",
      [toTeamId],
    );
    if (!team) return;

    // Era NPC: limpar as notícias acumuladas (o novo treinador herdava a
    // caixa cheia como não lida) antes das boas-vindas.
    await clearInheritedNews(game, toTeamId);

    // O clube novo recebe uma notícia de boas-vindas persistente. Fica ligada
    // ao novo team_id; o histórico da era NPC foi apagado acima.
    try {
      await runExec(
        game.db,
        `INSERT INTO club_news (team_id, type, title, description, matchweek, slot, year)
         VALUES (?, 'welcome', ?, ?, ?, ?, ?)`,
        [
          team.id,
          `👋 Novo treinador no ${team.name}`,
          `A direcção entrega o projecto a ${coachName}. O plantel aguarda novas ideias e a bancada quer resultados.`,
          game.matchweek,
          currentSlot(game),
          game.year,
        ],
      );
      io.to(game.roomCode).emit("globalNewsUpdated");
    } catch (e) {
      console.warn(
        `[${game.roomCode}] welcome news failed:`,
        (e as Error)?.message,
      );
    }

    await emitTeamAssigned(game, coachName, team, false);

    io.to(game.roomCode).emit("systemMessage", {
      text: `${coachName} aceitou o convite de ${team.name}.`,
      broadcast: true,
      cm: true,
    });

    // Broadcast updated teams
    getTeamsWithCoachNames(game.db)
      .then((teams) => io.to(game.roomCode).emit("teamsData", teams))
      .catch(() => {});

    saveGameState(game);
  };

  const handleDeclineJobOffer = (game: ActiveGame, coachName: string): void => {
    delete game.pendingJobOffers[coachName];
    saveGameState(game);
  };

  // ── TROCA IMEDIATA PÓS-DESPEDIMENTO ───────────────────────────────────────

  const MATCH_RUNNING_PHASES = new Set([
    "match_first_half",
    "match_halftime",
    "match_second_half",
    "match_et_gate",
    "match_extra_time",
    "match_finalizing",
  ]);

  /** «Assumir o comando»: fecha a janela de troca (o clube atual fica). */
  const handleConfirmDismissalClub = (game: ActiveGame, coachName: string): void => {
    delete game.dismissalOptions[coachName];
  };

  /**
   * Troca o clube atribuído no despedimento por uma das alternativas oferecidas.
   * O treinador nunca fica sem clube: o novo é atribuído e só depois o antigo
   * é devolvido a um treinador NPC. A janela é a mesma enquanto não confirmar
   * (o clube que largou volta a ser alternativa) e fecha com a jornada seguinte.
   */
  const handleSwapDismissalClub = async (
    game: ActiveGame,
    coachName: string,
    toTeamId: number,
  ): Promise<void> => {
    const player = game.playersByName[coachName];
    const options = game.dismissalOptions[coachName];
    if (!player || player.teamId == null || !options) return;
    if (!options.includes(toTeamId) || toTeamId === player.teamId) return;
    // A meio do jogo a equipa nova entraria na ronda sem tática nem 11 validados.
    if (MATCH_RUNNING_PHASES.has(game.gamePhase)) return;

    const fromTeamId = player.teamId;
    const claims = teamClaims(game);
    const taken =
      claims.has(toTeamId) ||
      Object.values(game.playersByName).some(
        (p) => p.name !== coachName && p.teamId === toTeamId,
      );
    if (!taken) claims.add(toTeamId);
    try {
      const [toTeam, fromTeam, mgr] = await Promise.all([
        runGet<AnyRow>(game.db, "SELECT * FROM teams WHERE id = ?", [toTeamId]),
        runGet<AnyRow>(game.db, "SELECT * FROM teams WHERE id = ?", [fromTeamId]),
        runGet<{ id: number }>(
          game.db,
          "SELECT id FROM managers WHERE name = ?",
          [coachName],
        ),
      ]);
      if (taken || !toTeam || !fromTeam || !mgr) {
        // Outro humano ficou com o clube entretanto: tira-o das alternativas.
        game.dismissalOptions[coachName] = options.filter((id) => id !== toTeamId);
        return;
      }

      await assignCoachToTeam(game, coachName, mgr.id, toTeam);
      // O clube largado volta a ter treinador NPC (e fica como alternativa).
      await execQuiet(
        game,
        "UPDATE teams SET manager_id = NULL WHERE id = ?",
        [fromTeamId],
      );
      await hireNpcManager(game, fromTeam, coachName);

      game.dismissalOptions[coachName] = options.map((id) =>
        id === toTeamId ? fromTeamId : id,
      );
      const alternatives = (
        await Promise.all(
          game.dismissalOptions[coachName]
            .filter((id) => id !== toTeamId)
            .map((id) => runGet<AnyRow>(game.db, "SELECT * FROM teams WHERE id = ?", [id])),
        )
      ).filter((t): t is AnyRow => !!t);

      await emitTeamAssigned(game, coachName, toTeam, true, alternatives);
      io.to(game.roomCode).emit("systemMessage", {
        text: `${coachName} passou de ${fromTeam.name} para ${toTeam.name}.`,
        broadcast: true,
        cm: true,
      });
      broadcastTeamsData(game);
      saveGameState(game);
    } finally {
      if (!taken) claims.delete(toTeamId);
    }
  };

  return {
    processCoachEvents,
    processRelegatedHumanCoaches,
    handleAcceptJobOffer,
    handleDeclineJobOffer,
    handleConfirmDismissalClub,
    handleSwapDismissalClub,
    resendPendingJobOffer,
    resendBoardWarning,
  };
}
