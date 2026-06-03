/**
 * socketAdminHandlers.ts — Admin-only user management socket events.
 *
 * Guards every handler with an admin check (ADMIN_COACH_NAME env var, default "fabio").
 * Provides: list users, change password, rename user (cascading), manage room access,
 * delete user.
 */

import type { ActiveGame } from "./types";
import type { Server, Socket } from "socket.io";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminHandlerDeps {
  io: Server;
  getGameBySocket: (socketId: string) => ActiveGame | null;
  activeGames: Record<string, ActiveGame>;
  adminListUsers: () => Promise<{ ok: boolean; users?: any[]; error?: string }>;
  adminChangePassword: (name: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  adminRenameManager: (oldName: string, newName: string, activeGames?: Record<string, ActiveGame>) => Promise<{ ok: boolean; error?: string; warnings?: string[] }>;
  adminAddRoomAccess: (managerName: string, roomCode: string) => Promise<{ ok: boolean; error?: string }>;
  adminRemoveRoomAccess: (managerName: string, roomCode: string) => Promise<{ ok: boolean; error?: string }>;
  deleteManager: (name: string) => Promise<{ ok: boolean; error?: string }>;
  saveGameState?: (game: ActiveGame) => void;
}

// ── Admin Guard ───────────────────────────────────────────────────────────────

function isAdmin(name: string | undefined): boolean {
  const adminName = process.env.ADMIN_COACH_NAME || "fabio";
  return (
    typeof name === "string" &&
    name.toLowerCase() === adminName.toLowerCase()
  );
}

// ── Registration ──────────────────────────────────────────────────────────────

export function registerAdminSocketHandlers(
  socket: Socket,
  deps: AdminHandlerDeps,
): void {
  const {
    io,
    getGameBySocket,
    activeGames,
    adminListUsers,
    adminChangePassword,
    adminRenameManager,
    adminAddRoomAccess,
    adminRemoveRoomAccess,
    deleteManager,
    saveGameState,
  } = deps;

  // Helper to get the coach name from the socket
  function getCoachName(): string | undefined {
    const game = getGameBySocket(socket.id);
    if (!game) return undefined;
    return game.socketToName[socket.id];
  }

  // Helper to check admin + respond if not
  function guardAdmin(callback?: (response: any) => void): string | null {
    const name = getCoachName();
    if (!isAdmin(name)) {
      if (callback) {
        callback({ ok: false, error: "Acesso negado. Apenas o administrador pode usar esta função." });
      }
      return null;
    }
    return name!;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // adminListUsers
  // ═══════════════════════════════════════════════════════════════════════════
  socket.on("adminListUsers", async (callback?: (response: any) => void) => {
    if (!guardAdmin(callback)) return;
    const result = await adminListUsers();
    if (callback) callback(result);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // adminChangePassword  { name, newPassword }
  // ═══════════════════════════════════════════════════════════════════════════
  socket.on(
    "adminChangePassword",
    async (
      data: { name: string; newPassword: string },
      callback?: (response: any) => void,
    ) => {
      if (!guardAdmin(callback)) return;
      if (!data || !data.name || !data.newPassword) {
        if (callback) callback({ ok: false, error: "Dados inválidos." });
        return;
      }
      const result = await adminChangePassword(data.name, data.newPassword);
      if (callback) callback(result);
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // adminRenameUser  { oldName, newName }
  // ═══════════════════════════════════════════════════════════════════════════
  socket.on(
    "adminRenameUser",
    async (
      data: { oldName: string; newName: string },
      callback?: (response: any) => void,
    ) => {
      const adminName = guardAdmin(callback);
      if (!adminName) return;

      if (!data || !data.oldName || !data.newName) {
        if (callback) callback({ ok: false, error: "Dados inválidos." });
        return;
      }

      // Mitigation: prevent admin from renaming themselves
      if (data.oldName.toLowerCase() === adminName.toLowerCase()) {
        if (callback) {
          callback({
            ok: false,
            error: "Não podes renomear a tua própria conta de administrador. Cria outra conta admin primeiro.",
          });
        }
        return;
      }

      const result = await adminRenameManager(data.oldName, data.newName, activeGames);

      // If rename succeeded, save game state for any affected rooms
      if (result.ok && saveGameState) {
        for (const roomCode of Object.keys(activeGames)) {
          const game = activeGames[roomCode];
          if (game && game.playersByName && game.playersByName[data.newName]) {
            try {
              saveGameState(game);
            } catch (_) {}
          }
        }
      }

      // Emit a refresh signal to all connected clients so the admin panel refreshes
      io.emit("adminUsersUpdated");

      if (callback) callback(result);
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // adminUpdateRoomAccess  { name, roomCode, action: "add" | "remove" }
  // ═══════════════════════════════════════════════════════════════════════════
  socket.on(
    "adminUpdateRoomAccess",
    async (
      data: { name: string; roomCode: string; action: "add" | "remove" },
      callback?: (response: any) => void,
    ) => {
      if (!guardAdmin(callback)) return;

      if (!data || !data.name || !data.roomCode || !data.action) {
        if (callback) callback({ ok: false, error: "Dados inválidos." });
        return;
      }

      let result;
      if (data.action === "add") {
        result = await adminAddRoomAccess(data.name, data.roomCode);
      } else {
        result = await adminRemoveRoomAccess(data.name, data.roomCode);
      }

      io.emit("adminUsersUpdated");
      if (callback) callback(result);
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // adminDeleteUser  { name }
  // ═══════════════════════════════════════════════════════════════════════════
  socket.on(
    "adminDeleteUser",
    async (
      data: { name: string },
      callback?: (response: any) => void,
    ) => {
      const adminName = guardAdmin(callback);
      if (!adminName) return;

      if (!data || !data.name) {
        if (callback) callback({ ok: false, error: "Dados inválidos." });
        return;
      }

      // Mitigation: prevent admin from deleting themselves
      if (data.name.toLowerCase() === adminName.toLowerCase()) {
        if (callback) {
          callback({
            ok: false,
            error: "Não podes apagar a tua própria conta de administrador.",
          });
        }
        return;
      }

      const result = await deleteManager(data.name);
      io.emit("adminUsersUpdated");
      if (callback) callback(result);
    },
  );
}
