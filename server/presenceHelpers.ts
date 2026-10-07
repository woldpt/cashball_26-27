import type { ActiveGame } from "./types";
import { isSeatPresent } from "./roomStateHelpers";

/** Uma linha do roster da sala: todos os registados, online ou não. */
export interface RoomRosterEntry {
  name: string;
  teamId: number | null;
  online: boolean;
  submitted: boolean;
}

/**
 * Roster completo da sala: todos os membros persistentes (roomMembers,
 * espelho de room_managers), online ou offline, com equipa e último estado.
 *
 * A presença vem do assento (`roomStateHelpers.isSeatPresent`): socket ligado
 * OU lease dentro da grace. Um flape de rede de poucos segundos não faz o
 * treinador desaparecer da lista — continua visível como online — e o assento
 * (equipa/ready/tática) nunca desaparece só porque o socket caiu.
 *
 * Coaches expulsos (kickedCoaches) ficam em room_managers mas não podem
 * reentrar — nunca aparecem no roster.
 */
export function getRoomRoster(game: ActiveGame): RoomRosterEntry[] {
  const members = game.roomMembers ? [...game.roomMembers] : [];
  const kicked = game.kickedCoaches;
  // Índices insensíveis a maiúsculas: roomMembers vem da auth-DB global,
  // playersByName/seats da DB da sala — a capitalização pode divergir.
  const byLower = new Map<string, string>();
  for (const name of Object.keys(game.playersByName || {})) {
    if (!byLower.has(name.toLowerCase())) byLower.set(name.toLowerCase(), name);
  }
  for (const name of Object.keys(game.seats || {})) {
    if (!byLower.has(name.toLowerCase())) byLower.set(name.toLowerCase(), name);
  }
  const roster: RoomRosterEntry[] = [];
  for (const name of members) {
    if (kicked && kicked.has(name)) continue;
    const key = byLower.get(name.toLowerCase());
    const player = key ? game.playersByName[key] : undefined;
    const seat = key ? game.seats[key] : undefined;
    roster.push({
      name,
      teamId: player?.teamId ?? seat?.teamId ?? null,
      online: isSeatPresent(game, key ?? name),
      submitted: player?.ready ?? seat?.intent.ready ?? false,
    });
  }
  // Online primeiro, depois ordem alfabética — lista estável.
  roster.sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
  return roster;
}

/**
 * Coaches offline = membros persistentes da sala (roomMembers, espelho de
 * room_managers) que não estão presentes agora. Derivado do roster para que
 * a definição de "presente" (inclui a grace de rede) seja sempre a mesma.
 */
export function getOfflineCoaches(game: ActiveGame): string[] {
  return getRoomRoster(game)
    .filter((entry) => !entry.online)
    .map((entry) => entry.name);
}

export function emitAwaitingCoaches(game: ActiveGame, io: any) {
  io.to(game.roomCode).emit("awaitingCoaches", getOfflineCoaches(game));
}

/**
 * Depois de `unreadyTeam`: refresca a presença da sala e avisa quem perdeu o
 * Pronto (um jogador do plantel saiu, o 11 confirmado pode já não valer).
 */
export function notifyUnreadied(game: ActiveGame, io: any, names: string[]) {
  if (names.length === 0) return;
  // require tardio: o gameManager importa este módulo.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("./gameManager").emitPresence(game, io);
  for (const name of names) {
    const socketId = game.playersByName[name]?.socketId;
    if (socketId) {
      io.to(socketId).emit(
        "systemMessage",
        "Um jogador do teu plantel saiu — confirma o Pronto outra vez.",
      );
    }
  }
}
