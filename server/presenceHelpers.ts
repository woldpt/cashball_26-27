import type { ActiveGame } from "./types";
import { isSeatPresent } from "./roomStateHelpers";

/**
 * Coaches offline = membros persistentes da sala (roomMembers, espelho de
 * room_managers) que não estão presentes agora.
 *
 * A presença vem do assento (`roomStateHelpers.isSeatPresent`): socket ligado
 * OU lease dentro da grace. Um flape de rede de poucos segundos não faz o
 * treinador aparecer como offline, e o assento (equipa/ready/tática) nunca
 * desaparece só porque o socket caiu.
 */
export function getOfflineCoaches(game: ActiveGame): string[] {
  const members = game.roomMembers ? [...game.roomMembers] : [];
  // Coaches expulso (kickedCoaches) ficam em room_managers mas não podem
  // reentrar — não devem aparecer como offline.
  const kicked = game.kickedCoaches;
  return members.filter(
    (name) => !isSeatPresent(game, name) && !(kicked && kicked.has(name)),
  );
}

export function emitAwaitingCoaches(game: ActiveGame, io: any) {
  io.to(game.roomCode).emit("awaitingCoaches", getOfflineCoaches(game));
}
