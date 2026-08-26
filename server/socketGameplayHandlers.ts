import type { ActiveGame, PlayerSession } from "./types";
import { withJuniorGRs, ensureFullBench } from "./game/engine";
import { getTacticFamiliarity, getAllTacticFamiliarity } from "./game/tacticFamiliarity";

interface GameplayHandlerDeps {
  io: any;
  getGameBySocket: (socketId: string) => ActiveGame | null;
  getPlayerBySocket: (
    game: ActiveGame,
    socketId: string,
  ) => PlayerSession | null;
  getPlayerList: (game: ActiveGame) => PlayerSession[];
  unbindSocket: (game: ActiveGame, socketId: string) => void;
  checkAllReady: (game: ActiveGame) => void | Promise<void>;
  emitAwaitingCoaches: (game: ActiveGame) => void;
  emitPresence: (game: ActiveGame) => void;
  saveGameState: (game: ActiveGame) => void;
  handleAcceptJobOffer: (game: ActiveGame, coachName: string) => Promise<void>;
  handleDeclineJobOffer: (game: ActiveGame, coachName: string) => void;
  emitGlobalPlayerUpdate?: () => void;
}

export function registerGameplaySocketHandlers(
  socket: any,
  deps: GameplayHandlerDeps,
) {
  const {
    io,
    getGameBySocket,
    getPlayerBySocket,
    getPlayerList,
    unbindSocket,
    checkAllReady,
    emitAwaitingCoaches,
    emitPresence,
    saveGameState,
    handleAcceptJobOffer,
    handleDeclineJobOffer,
    emitGlobalPlayerUpdate,
  } = deps;

  const VALID_FORMATIONS = new Set([
    "4-4-2", "4-3-3", "3-5-2", "5-3-2", "4-5-1", "3-4-3", "4-2-4", "5-4-1",
  ]);
  const VALID_STYLES = new Set(["Balanced", "Defensive", "Offensive"]);

  socket.on("setTactic", (tactic) => {
    if (
      !tactic ||
      typeof tactic !== "object" ||
      typeof tactic.formation !== "string" ||
      typeof tactic.style !== "string" ||
      !VALID_FORMATIONS.has(tactic.formation) ||
      !VALID_STYLES.has(tactic.style)
    )
      return;
    const game = getGameBySocket(socket.id);
    const playerState = getPlayerBySocket(game, socket.id);
    if (game && playerState) {
      playerState.tactic = tactic;
    }
  });

  socket.on("requestTacticFamiliarity", (teamId) => {
    const game = getGameBySocket(socket.id);
    if (!game) return;
    const playerState = getPlayerBySocket(game, socket.id);
    if (!game || !playerState || !playerState.teamId) return;
    const tactic = playerState.tactic;
    if (!tactic?.formation) return;

    const familiarity = getTacticFamiliarity(game, playerState.teamId, tactic);
    socket.emit("tacticFamiliarity", {
      ...familiarity,
      teamId,
    });
  });

  // Devolve a familiaridade de todas as combinações formação+estilo de uma vez
  socket.on("requestAllTacticFamiliarity", () => {
    const game = getGameBySocket(socket.id);
    if (!game) return;
    const playerState = getPlayerBySocket(game, socket.id);
    if (!playerState?.teamId) return;

    const entries = getAllTacticFamiliarity(game, playerState.teamId);
    socket.emit("allTacticFamiliarity", entries);
  });

  socket.on("setReady", (ready) => {
    const game = getGameBySocket(socket.id);
    if (!game) return;
    const playerState = getPlayerBySocket(game, socket.id);
    if (!playerState) return;
    if (!playerState.teamId) return;
    playerState.ready = ready;
    console.log(
      `[${game.roomCode}] 👤 ${playerState.name} setReady=${ready} | phase=${game.gamePhase}`,
    );
    emitPresence(game);
    checkAllReady(game);
  });

  socket.on("requestTeamSquad", (teamId) => {
    const game = getGameBySocket(socket.id);
    if (!game) return;

    game.db.all(
      "SELECT * FROM players WHERE team_id = ? ORDER BY CASE position WHEN 'GR' THEN 1 WHEN 'DEF' THEN 2 WHEN 'MED' THEN 3 WHEN 'ATA' THEN 4 ELSE 5 END, skill DESC, name",
      [teamId],
      (err, squad) => {
        const base = err ? [] : squad || [];
        socket.emit("teamSquadData", {
          teamId,
          squad: ensureFullBench(
            withJuniorGRs(base, teamId, game.matchweek || 1),
            teamId,
            game.matchweek || 1,
          ),
        });
      },
    );
  });

  socket.on("request_substitution", () => {
    const game = getGameBySocket(socket.id);
    if (!game) return;
    const playerState = getPlayerBySocket(game, socket.id);
    if (!playerState || !playerState.teamId) return;

    if (!game.pendingSubstitutions) {
      game.pendingSubstitutions = new Set();
    }
    game.pendingSubstitutions.add(playerState.teamId);
    console.log(
      `[${game.roomCode}] 🔁 ${playerState.name} requested substitution for team ${playerState.teamId}`,
    );
    // Notificar todos os jogadores humanos que este treinador está a fazer substituições
    io.to(game.roomCode).emit("substitutionPauseStarted", {
      teamId: playerState.teamId,
      coachName: playerState.name,
    });
  });

  socket.on("resolveMatchAction", ({ actionId, teamId, playerId, choice }) => {
    const game = getGameBySocket(socket.id);
    if (!game) return;

    if (!game.pendingMatchAction) {
      // Já foi resolvido (timer ou desconexão auto-resolveu) — desbloquear cliente preso
      socket.emit("matchActionResolved", { source: "auto" });
      return;
    }

    const pendingAction: any = game.pendingMatchAction;
    if (pendingAction.actionId !== actionId) return;
    if (pendingAction.teamId !== teamId) return;

    const pending: any = pendingAction;
    clearTimeout(pending.timer);
    game.pendingMatchAction = null;

    const finalChoice = choice !== undefined ? choice : playerId;

    if (finalChoice === null || finalChoice === undefined) {
      pending.finalize(pending.fallback ? pending.fallback() : null, "auto");
    } else {
      pending.finalize(finalChoice, "human");
    }
  });

  // Expulsar um coach da sala (apenas Admin no lobby)
  socket.on("kickCoach", ({ targetName }: { targetName: string }) => {
    const game = getGameBySocket(socket.id);
    if (!game) return;
    if (game.gamePhase !== "lobby") return;

    const requesterName = game.socketToName[socket.id];
    if (!requesterName || requesterName !== game.roomCreator) return;
    if (!targetName || targetName === requesterName) return;

    const target = game.playersByName[targetName];
    if (!target && !game.lockedCoaches.has(targetName)) return;

    // Notificar o coach expulso antes de remover (se estiver online)
    const targetSocketId = target?.socketId;
    if (targetSocketId) {
      io.to(targetSocketId).emit("kicked", {
        reason: "Foste removido da sala pelo Admin.",
      });
    }

    // Remover coach da sala (sessão runtime + presença exigida)
    if (target) {
      delete game.playersByName[targetName];
    }
    game.lockedCoaches.delete(targetName);

    // Ban permanente: o coach expulso não pode reentrar na sala
    game.kickedCoaches.add(targetName);

    // Libertar a equipa no DB e apagar o registo do manager (também cobre
    // coaches offline/abandonados que já não têm sessão runtime).
    game.db.run(
      "UPDATE teams SET manager_id = NULL WHERE manager_id = (SELECT id FROM managers WHERE name = ?)",
      [targetName],
      () => {},
    );
    game.db.run(
      "DELETE FROM managers WHERE name = ?",
      [targetName],
      () => {},
    );

    saveGameState(game);
    emitPresence(game);
    emitGlobalPlayerUpdate?.();

    // Se o expulso era o único bloqueio (estava offline), a semana pode avançar.
    if (game.gamePhase === "lobby") {
      checkAllReady(game);
    }

    console.log(
      `[${game.roomCode}] 🚫 Admin ${requesterName} expulsou ${targetName} (online=${!!targetSocketId})`,
    );
  });

  socket.on("disconnect", () => {
    const game = getGameBySocket(socket.id);
    if (!game) return;

    const playerState = getPlayerBySocket(game, socket.id);
    console.log(
      `[${game.roomCode}] 🔌 Disconnect: ${playerState?.name ?? "unknown"} (socket=${socket.id}) | phase=${game.gamePhase}`,
    );

    if (!playerState) {
      unbindSocket(game, socket.id);
      emitPresence(game);
      return;
    }

    if (playerState) {
      // In lobby: reset ready state so a refreshing coach must re-confirm their tactic.
      // This prevents a disconnect from triggering an auto-advance into the match.
      if (game.gamePhase === "lobby") {
        playerState.ready = false;
      }

      // NOTA: o coach NÃO é removido de lockedCoaches ao desconectar.
      // Salas com 2+ coaches humanos ficam bloqueadas no início da semana
      // até TODOS estarem online (a remoção só acontece em leaveRoom/kick/despedimento).

      // Discard any pending contract counter-offer for this coach's team
      if (game.pendingRenewalCounterOffers) {
        for (const [pid, offer] of Object.entries(
          game.pendingRenewalCounterOffers as Record<string, any>,
        )) {
          if (offer.teamId === playerState.teamId) {
            delete (game.pendingRenewalCounterOffers as any)[pid];
          }
        }
      }

      // If the disconnected socket owned the pending match action, auto-resolve it
      const pendingAction: any = game.pendingMatchAction;
      if (pendingAction && pendingAction.teamId === playerState.teamId) {
        clearTimeout(pendingAction.timer);
        game.pendingMatchAction = null;
        const fallbackValue = pendingAction.fallback
          ? pendingAction.fallback()
          : null;
        try {
          pendingAction.finalize(fallbackValue, "auto");
        } catch (err) {
          console.error(
            "[disconnect] Error finalizing pending match action:",
            err,
          );
        }
      }

      // Emit coach disconnected notification to the room
      const disconnectingName = playerState.name;
      const disconnectingTeamId = playerState.teamId;
      if (disconnectingTeamId) {
        io.to(game.roomCode).emit("coachDisconnected", {
          coachName: disconnectingName,
          teamId: disconnectingTeamId,
        });
      }
    }

    unbindSocket(game, socket.id);
    emitPresence(game);
    emitGlobalPlayerUpdate?.();

    // Clear phase timer to prevent stale timeouts after disconnect/reconnect
    if (game.phaseTimer) {
      clearTimeout(game.phaseTimer);
      game.phaseTimer = null;
    }

    // Let remaining ready coaches proceed if all are now ready.
    // Skip in lobby, match running, and match_finalizing: a disconnect must
    // never auto-start the match or interfere with ongoing simulation.
    const isMatchRunning =
      game.gamePhase === "match_first_half" ||
      game.gamePhase === "match_second_half" ||
      game.gamePhase === "match_extra_time";
    const isFinalizing = game.gamePhase === "match_finalizing";
    if (!isMatchRunning && !isFinalizing && game.gamePhase !== "lobby") {
      checkAllReady(game);
    }
  });

  socket.on("acceptJobOffer", async () => {
    const game = getGameBySocket(socket.id);
    if (!game) return;
    const name = game.socketToName[socket.id];
    if (!name) return;
    await handleAcceptJobOffer(game, name);
  });

  socket.on("declineJobOffer", () => {
    const game = getGameBySocket(socket.id);
    if (!game) return;
    const name = game.socketToName[socket.id];
    if (!name) return;
    handleDeclineJobOffer(game, name);
  });
}
