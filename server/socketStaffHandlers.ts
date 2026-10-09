/**
 * socketStaffHandlers.ts — funcionários do clube (pedido de estado, contratar,
 * despedir).
 *
 * O estado vai por **ack** (não por broadcast): os funcionários são de uma
 * equipa só e só o seu treinador os muda, por isso não há razão para acordar
 * a sala. O que sai para a sala é o `teamsData` (o orçamento mudou e todos o
 * veem na classificação/hub).
 */
import type { ActiveGame, PlayerSession } from "./types";
import { getTeamsWithCoachNames } from "./coreHelpers";
import { buildStaffState, hireStaff, fireStaff } from "./staffHelpers";

interface StaffHandlerDeps {
  io: any;
  getGameBySocket: (socketId: string) => ActiveGame | null;
  getPlayerBySocket: (game: ActiveGame, socketId: string) => PlayerSession | null;
  isMatchInProgress: (game: ActiveGame) => boolean;
}

/** Códigos → mensagem para o treinador (o cliente mostra no toast). */
const ERROR_MESSAGES: Record<string, string> = {
  invalid_role: "Papel de funcionário inválido.",
  invalid_level: "Nível inválido (1 a 5).",
  role_taken: "Já tens um funcionário nesse papel — despede-o primeiro.",
  no_slots: "Sem lugares livres na equipa técnica (3 no total).",
  no_budget: "Sem fundo de maneio para pagar (assinatura ou indemnização).",
  not_found: "Esse funcionário já não está no clube.",
  db: "Erro ao processar a operação. Tenta outra vez.",
};

export function registerStaffSocketHandlers(socket: any, deps: StaffHandlerDeps) {
  const { io, getGameBySocket, getPlayerBySocket, isMatchInProgress } = deps;

  function guardMatchPaused(game: ActiveGame): boolean {
    if (isMatchInProgress(game)) {
      socket.emit(
        "systemMessage",
        "Não é possível mexer na equipa técnica durante uma partida.",
      );
      return true;
    }
    return false;
  }

  /** Broadcast do orçamento atualizado (mesmo caminho das finanças). */
  function emitTeams(game: ActiveGame) {
    getTeamsWithCoachNames(game.db)
      .then((teams) => io.to(game.roomCode).emit("teamsData", teams))
      .catch(() => {});
  }

  socket.on("requestStaff", async (done?: (state: any) => void) => {
    const game = getGameBySocket(socket.id);
    if (!game) return done?.(null);
    const playerState = getPlayerBySocket(game, socket.id);
    if (!playerState) return done?.(null);
    const state = await buildStaffState(game, playerState.teamId);
    done?.(state);
  });

  socket.on(
    "hireStaff",
    async (payload: { role?: string; level?: number }, done?: (res: any) => void) => {
      const game = getGameBySocket(socket.id);
      if (!game) return done?.({ ok: false, error: "db" });
      const playerState = getPlayerBySocket(game, socket.id);
      if (!playerState) return done?.({ ok: false, error: "db" });
      if (guardMatchPaused(game)) return done?.({ ok: false, error: "paused" });

      const role = String(payload?.role ?? "");
      const level = Number(payload?.level);
      const result = await hireStaff(game, playerState.teamId, role, level);
      if (!result.ok) {
        socket.emit("systemMessage", ERROR_MESSAGES[result.error] || ERROR_MESSAGES.db);
        return done?.({ ok: false, error: result.error });
      }
      emitTeams(game);
      const state = await buildStaffState(game, playerState.teamId);
      done?.({ ok: true, cost: result.cost, state });
    },
  );

  socket.on(
    "fireStaff",
    async (payload: { role?: string }, done?: (res: any) => void) => {
      const game = getGameBySocket(socket.id);
      if (!game) return done?.({ ok: false, error: "db" });
      const playerState = getPlayerBySocket(game, socket.id);
      if (!playerState) return done?.({ ok: false, error: "db" });
      if (guardMatchPaused(game)) return done?.({ ok: false, error: "paused" });

      const result = await fireStaff(game, playerState.teamId, String(payload?.role ?? ""));
      if (!result.ok) {
        socket.emit("systemMessage", ERROR_MESSAGES[result.error] || ERROR_MESSAGES.db);
        return done?.({ ok: false, error: result.error });
      }
      emitTeams(game);
      const state = await buildStaffState(game, playerState.teamId);
      done?.({ ok: true, severance: result.severance, state });
    },
  );
}
