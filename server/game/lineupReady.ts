// ── Validação do 11 + banco antes de avançar ────────────────────────────────
// Fonte da verdade no servidor para "pode avançar para jogo". O botão do
// cliente já bloqueia (isLineupComplete), mas o setReady aceitava tudo e o
// engine fazia auto-pick silencioso — e o intervalo ficava vazio porque a
// vista lê só a tática local. Esta função espelha a regra do cliente:
// 11 titulares disponíveis (1 GR + 10 de campo) + banco completo (7 = valor
// de MAX_BENCH_SIZE, com 1 GR). O pool inclui juniores automáticos (tal como
// o mySquad do cliente), por isso a regra é sempre satisfazível.

import { MAX_BENCH_SIZE } from "../gameConstants";
import {
  ensureFullBench,
  isPlayerAvailable,
  withJuniorGRs,
} from "./playerUtils";

export interface LineupReadiness {
  ok: boolean;
  reason: string;
}

// Só valida quem tem jogo nesta ronda: espectadores (ex. eliminados da Taça)
// fazem ready sem escalação. Sem fixtures conhecidas, fail-open (não bloqueia).
export function isLobbyStarter(
  currentFixtures: any[] | null | undefined,
  teamId: number,
): boolean {
  if (!currentFixtures || currentFixtures.length === 0) return false;
  return currentFixtures.some(
    (f: any) =>
      Number(f.homeTeamId) === Number(teamId) ||
      Number(f.awayTeamId) === Number(teamId),
  );
}

// Mesma base do cliente (annotatedSquad): a disponibilidade conta para a
// jornada que aí vem, não para a que passou.
export function upcomingMatchweek(game: {
  calendarIndex?: number;
  matchweek?: number;
}): number {
  return (game.calendarIndex ?? (game.matchweek ?? 1) - 1) + 1;
}

export function checkLineupReady(
  positions: Record<string | number, string> | null | undefined,
  squadRows: any[],
  teamId: number,
  matchweek: number,
): LineupReadiness {
  const pool = ensureFullBench(
    withJuniorGRs(squadRows || [], teamId, matchweek),
    teamId,
    matchweek,
  );
  const available = pool.filter((p: any) => isPlayerAvailable(p, matchweek));
  const titulars = available.filter(
    (p: any) => positions?.[p.id] === "Titular",
  );
  const grTitulars = titulars.filter((p: any) => p.position === "GR").length;
  if (grTitulars !== 1 || titulars.length !== 11) {
    return {
      ok: false,
      reason:
        "Define o 11 antes de avançar: 1 GR + 10 titulares disponíveis.",
    };
  }
  const subs = available.filter((p: any) => positions?.[p.id] === "Suplente");
  const grSubs = subs.filter((p: any) => p.position === "GR").length;
  if (subs.length < MAX_BENCH_SIZE || grSubs < 1) {
    return {
      ok: false,
      reason: `Banco incompleto: marca ${MAX_BENCH_SIZE} suplentes (1 GR) antes de avançar.`,
    };
  }
  return { ok: true, reason: "" };
}
