import type { ActiveGame, PlayerSession } from "./types";

interface CupHandlerDeps {
  io: any;
  getGameBySocket: (socketId: string) => ActiveGame | null;
  getPlayerBySocket: (game: ActiveGame, socketId: string) => PlayerSession | null;
  getPlayerList: (game: ActiveGame) => PlayerSession[];
  saveGameState: (game: ActiveGame) => void;
  checkAllReady: (game: ActiveGame) => Promise<void>;
}

export function registerCupSocketHandlers(socket: any, deps: CupHandlerDeps) {
  const { getGameBySocket } = deps;

  // ── ET animation done ───────────────────────────────────────────────────────
  socket.on("cupExtraTimeDone", () => {
    const game = getGameBySocket(socket.id);
    if (!game || !game._cupETAnimHandler) return;
    game._cupETAnimHandler(socket.id);
  });

  // ── Legacy compat shims (no-ops) ────────────────────────────────────────────
  // Cup now uses the same lobby → setReady flow as league.
  // These events are kept so old clients don't throw errors, but do nothing.
  socket.on("cupDrawAcknowledged", () => {});
  socket.on("cupKickOff", () => {});
  socket.on("cupHalfTimeReady", () => {});
  
  // ── 90-min animation done ─────────────────────────────────────────────────────
  socket.on("cupSecondHalfDone", () => {
    const game = getGameBySocket(socket.id);
    if (!game || !game._cupSecondHalfAnimHandler) return;
    game._cupSecondHalfAnimHandler(socket.id);
  });
  
  socket.on("leagueAnimDone", () => {});
}
