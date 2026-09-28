import * as fs from "fs";
import type { ActiveGame } from "./types";

export type EmptyRoomPurgeResult =
  | "deleted"
  | "has_members"
  | "waiting_for_disconnect"
  | "failed"
  | "invalid";

interface RoomCleanupDeps {
  activeGames: Record<string, ActiveGame>;
  getRoomCoachesStrict: (roomCode: string) => Promise<string[]>;
  deleteRoomAccess: (roomCode: string) => Promise<void>;
  roomDbPath: (roomCode: string) => string;
  purgeGame: (roomCode: string) => boolean;
}

export function createRoomCleanupHelpers(deps: RoomCleanupDeps) {
  const inFlight = new Map<string, Promise<EmptyRoomPurgeResult>>();

  async function purgeEmptyRoom(roomCode: string): Promise<EmptyRoomPurgeResult> {
    const code = String(roomCode || "").toUpperCase();
    if (!/^[A-Z0-9]{4,8}$/.test(code)) return "invalid";

    while (inFlight.has(code)) await inFlight.get(code);
    const operation = purgeEmptyRoomOnce(code);
    inFlight.set(code, operation);
    try {
      return await operation;
    } finally {
      if (inFlight.get(code) === operation) inFlight.delete(code);
    }
  }

  async function purgeEmptyRoomOnce(code: string): Promise<EmptyRoomPurgeResult> {
    try {
      const game = deps.activeGames[code];
      const coaches = await deps.getRoomCoachesStrict(code);
      const kicked = new Set(
        [...(game?.kickedCoaches ?? [])].map((name) => name.toLowerCase()),
      );
      if (coaches.some((name) => !kicked.has(name.toLowerCase()))) {
        return "has_members";
      }
      if (
        game &&
        (Object.keys(game.socketToName || {}).length > 0 ||
          Object.values(game.playersByName || {}).some((player) => !!player.socketId))
      ) {
        return "waiting_for_disconnect";
      }

      // Invalidate timers/waiters before deleting a save that may be loaded in memory.
      deps.purgeGame(code);
      const dbFile = deps.roomDbPath(code);
      for (const suffix of ["-wal", "-shm", "-journal", ""]) {
        const file = dbFile + suffix;
        if (fs.existsSync(file)) fs.unlinkSync(file);
      }
      await deps.deleteRoomAccess(code);
      console.warn(`[roomCleanup] 🗑 Sala ${code} eliminada: sem treinadores com acesso válido.`);
      return "deleted";
    } catch (err: any) {
      console.error(`[roomCleanup] ${code}: purge failed:`, err?.message || err);
      return "failed";
    }
  }

  return { purgeEmptyRoom };
}
