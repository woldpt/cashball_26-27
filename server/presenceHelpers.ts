import type { ActiveGame } from "./types";

/**
 * Coaches offline = membros persistentes da sala (roomMembers, espelho de
 * room_managers) menos os coaches actualmente ligados (playersByName com
 * socketId).
 *
 * Usar roomMembers (e não playersByName) como base é o que faz a lista de
 * offline sobreviver a restarts do servidor / loads frescos do jogo —
 * playersByName é in-memory e só contém coaches que já ligaram desde o
 * último load.
 */
export function getOfflineCoaches(game: ActiveGame): string[] {
  const members = game.roomMembers ? [...game.roomMembers] : [];
  const online = new Set(
    Object.values(game.playersByName)
      .filter((p) => p.socketId !== null)
      .map((p) => p.name),
  );
  // Coaches expulso (kickedCoaches) ficam em room_managers mas não podem
  // reentrar — não devem aparecer como offline.
  const kicked = game.kickedCoaches;
  return members.filter(
    (name) => !online.has(name) && !(kicked && kicked.has(name)),
  );
}

export function emitAwaitingCoaches(game: ActiveGame, io: any) {
  io.to(game.roomCode).emit("awaitingCoaches", getOfflineCoaches(game));
}
