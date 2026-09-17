import type { ActiveGame, PlayerSession } from "./types";
import { withJuniorGRs, ensureFullBench } from "./game/engine";
import {
  peekPendingMatchAction,
  takePendingMatchAction,
  listTeamMatchActions,
} from "./game/engine";
import { MAX_BENCH_SIZE, SIM_SPEED_PRESETS } from "./gameConstants";
import type { SimSpeedKey } from "./gameConstants";
import { getTacticFamiliarity, getAllTacticFamiliarity } from "./game/tacticFamiliarity";
import {
  checkLineupReady,
  isLobbyStarter,
  upcomingMatchweek,
} from "./game/lineupReady";
import {
  emitPresencePause,
  isSeatPresent,
  releaseSeat,
  setSeatIntent,
  waitForPresence,
} from "./roomStateHelpers";

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

    // Enforce the bench limit (MAX_BENCH_SIZE substitutes). Tactics that name more than
    // MAX_BENCH_SIZE "Suplente" players are sanitized by demoting the extra
    // subs back to "Titular", keeping the starting XI full at 11.
    if (tactic.positions && typeof tactic.positions === "object") {
      const subIds = Object.keys(tactic.positions).filter(
        (id) => tactic.positions[id] === "Suplente",
      );
      if (subIds.length > MAX_BENCH_SIZE) {
        for (const id of subIds.slice(MAX_BENCH_SIZE)) {
          tactic.positions[id] = "Titular";
        }
      }
    }

    const game = getGameBySocket(socket.id);
    const playerState = getPlayerBySocket(game, socket.id);
    if (game && playerState) {
      playerState.tactic = tactic;
      // A tática vive no assento: sobrevive a disconnect/restart.
      setSeatIntent(game, playerState.name, {
        formation: tactic.formation,
        style: tactic.style,
        positions: tactic.positions || {},
      });
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
    // Barreira do 11 no pré-jogo: sem 11 + banco completo não há ready.
    // Fora do lobby (intervalo, prolongamento) passa sempre — a escalação
    // é a mesma. Espectadores sem jogo na ronda também passam.
    if (
      ready === true &&
      game.gamePhase === "lobby" &&
      isLobbyStarter((game as any).currentFixtures, playerState.teamId)
    ) {
      game.db.all(
        "SELECT * FROM players WHERE team_id = ?",
        [playerState.teamId],
        (err: any, rows: any[]) => {
          if (err) {
            console.error(
              `[${game.roomCode}] ⚠ setReady: squad read failed — fail-open`,
              err.message,
            );
          } else {
            // Caixa de entrada: renovações de contrato e convites de clubes
            // (bandeira vermelha no Jornal) bloqueiam o Pronto — é preciso
            // responder antes de seguir para o jogo. Vem do mesmo SELECT do
            // plantel: sem query extra.
            const pendingRenewals = (rows || []).filter(
              (r: any) => r.contract_request_pending === 1,
            );
            const pendingJob = (game as any).pendingJobOffers?.[playerState.name];
            if (pendingRenewals.length > 0 || pendingJob) {
              const reason =
                pendingRenewals.length > 0 && pendingJob
                  ? "Tens renovações e um convite por responder no Jornal."
                  : pendingRenewals.length > 0
                    ? "Tens pedidos de renovação por responder no Jornal."
                    : "Tens um convite de clube por responder no Jornal.";
              console.warn(
                `[${game.roomCode}] ⛔ ${playerState.name} ready recusado: inbox red flag`,
              );
              socket.emit("systemMessage", { text: `⛔ ${reason}` });
              return;
            }
            const check = checkLineupReady(
              (playerState.tactic as any)?.positions,
              rows || [],
              playerState.teamId as number,
              upcomingMatchweek(game),
            );
            if (!check.ok) {
              console.warn(
                `[${game.roomCode}] ⛔ ${playerState.name} ready recusado: ${check.reason}`,
              );
              socket.emit("systemMessage", { text: `⛔ ${check.reason}` });
              return;
            }
          }
          playerState.ready = true;
          setSeatIntent(game, playerState.name, { ready: true });
          console.log(
            `[${game.roomCode}] 👤 ${playerState.name} setReady=true | phase=${game.gamePhase}`,
          );
          emitPresence(game);
          checkAllReady(game);
        },
      );
      return;
    }
    playerState.ready = ready;
    setSeatIntent(game, playerState.name, { ready: !!ready });
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
      type: "user_substitution",
    });
  });

  socket.on("resolveMatchAction", ({ actionId, teamId, playerId, choice }) => {
    const game = getGameBySocket(socket.id);
    if (!game) return;

    const pendingAction: any = peekPendingMatchAction(game, actionId);
    if (!pendingAction) {
      // Já foi resolvido (timer ou desconexão auto-resolveu) — desbloquear cliente preso
      socket.emit("matchActionResolved", { source: "auto" });
      return;
    }
    if (pendingAction.teamId !== teamId) return;
    takePendingMatchAction(game, actionId);

    const pending: any = pendingAction;

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

    // Assento libertado: sem isto o assento ficava `member` e o
    // `computeAbsentees` congelava a sala para sempre após um kick.
    releaseSeat(game, targetName, "kicked");

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
    emitPresencePause(game, io);

    // Se o expulso era o único bloqueio (estava offline), a semana pode avançar.
    if (game.gamePhase === "lobby") {
      checkAllReady(game);
    }

    console.log(
      `[${game.roomCode}] 🚫 Admin ${requesterName} expulsou ${targetName} (online=${!!targetSocketId})`,
    );
  });

  // Ritmo da simulação (apenas Admin da sala; vale do próximo jogo em diante)
  socket.on("setSimSpeed", ({ speed }: { speed: SimSpeedKey }) => {
    const game = getGameBySocket(socket.id);
    if (!game) return;
    const requesterName = game.socketToName[socket.id];
    if (!requesterName || requesterName !== game.roomCreator) return;
    if (!speed || !(speed in SIM_SPEED_PRESETS)) return;
    game.msPerMinute = SIM_SPEED_PRESETS[speed];
    saveGameState(game);
    io.to(game.roomCode).emit("simSpeedUpdated", { speed, msPerMinute: game.msPerMinute });
    console.log(
      `[${game.roomCode}] ⚙️ Admin ${requesterName} definiu o ritmo: ${speed} (${game.msPerMinute}ms/min)`,
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
      // NOTA: o `ready`/tática NÃO são limpos aqui — vivem no assento durável
      // e um flape não os apaga. A ausência bloqueia via `computeAbsentees`
      // (a sala congela), por isso o reset antigo só criava divergência
      // entre o assento e a projeção.

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

      // NOTA: as pendingMatchActions deste treinador NÃO são resolvidas aqui.
      // Era isto que fazia a lesão/substituição dele ser decidida sozinha
      // enquanto o telemóvel estava sem rede. A janela fica bloqueada e a sala
      // congela (barreira por minuto + waitForMatchAction) até ele voltar ou o
      // assento ser libertado explicitamente (kick/despedida/adminReleaseRoom).
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

    // Presença mudou: emitir o estado de pausa (agora bloqueado) e congelar.
    emitPresencePause(game, io);

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
