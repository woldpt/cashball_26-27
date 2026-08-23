export const DIVISION_NAMES: Record<number, string> = {
  1: "Primeira Liga",
  2: "Segunda Liga",
  3: "Liga 3",
  4: "Campeonato de Portugal",
  5: "Distritais",
};

export const MAX_ATTENDANCE_BY_DIVISION: Record<number, number> = {
  1: Infinity,
  2: 48500,
  3: 23800,
  4: 9200,
  5: 4800,
};

/**
 * Valor de mercado base, derivado do skill (não-linear).
 * A elite vale desproporcionalmente mais: skill² × 500.
 * O termo linear (skill × 2000) e o piso fixo (€30.000) garantem que os
 * jogadores fracos (skills 5–15, divisões 4–5) rendem dinheiro às equipas
 * pequenas quando vendidos — sem inflacionar demasiado os craques da 1ª Liga.
 * Mesma fórmula usada na seed (seed.js) e no backfill do gameManager.
 * O valor é recalculado sempre que o skill muda (treino, evolução, decaimento).
 */
export function recalcPlayerValue(skill: number): number {
  return Math.round(skill * skill * 500 + skill * 2000 + 30000);
}

/**
 * Salário semanal justo, derivado do skill (sub-linear).
 * Jogadores fracos (skill 5–15) ganham muito menos que os craques, mantendo
 * as folhas salariais das divisões baixas viáveis (a receita das equipas
 * pequenas escala com a divisão, não com o skill).
 * Âncoras: skill 10 → ~1000€/sem, skill 50 → ~8000€/sem.
 * Mesma fórmula usada na seed (seed.js) e no backfill do gameManager.
 */
export function fairWeeklyWage(skill: number): number {
  const s = Math.max(1, Math.round(skill || 0));
  return Math.round(Math.pow(s, 1.292) * 51);
}

/**
 * Salário de assinatura para um novo contrato (compra / leilão / transferência NPC).
 * Base `fairWeeklyWage(skill)` (mesma curva da seed) com fatores de
 * resistência/forma/star. NUNCA é usado para recalcular salários de jogadores
 * em contrato — o salário só muda na compra ou na renegociação.
 */
export function signingWage(player: {
  skill?: number;
  resistance?: number;
  form?: number;
  is_star?: number;
  wage?: number;
}): number {
  const resFactor = 0.9 + ((player.resistance || 3) / 5) * 0.2;
  const formFactor = (player.form || 90) / 90;
  const starFactor = player.is_star ? 1.2 : 1;
  const adjustedSkillWage = Math.round(
    fairWeeklyWage(player.skill) * resFactor * formFactor * starFactor,
  );
  return Math.max(player.wage || 0, adjustedSkillWage);
}

export const CUP_ROUND_NAMES = [
  "",
  "16 avos de final",
  "Oitavos de final",
  "Quartos de final",
  "Meias-finais",
  "Final",
];

export const CUP_TEAMS_BY_ROUND: Record<number, number> = {
  1: 32,
  2: 16,
  3: 8,
  4: 4,
  5: 2,
};

export const SPONSOR_REVENUE_BY_DIVISION: Record<number, number> = {
  1: 2000000,
  2: 1500000,
  3: 1000000,
  4: 500000,
  5: 250000,
};

/**
 * Incremento mínimo entre lances num leilão (servidor e cliente devem usar o mesmo valor).
 * Aplica-se a qualquer leilão, incluindo os que começam a €0.
 */
export const AUCTION_BID_STEP = 10000;

/**
 * Duração de um contrato em matchweeks (1 época = 14 jornadas de liga).
 * Um jogador contratado/renovado na Jornada X só pode ser transferido a
 * partir da Jornada X da época seguinte.
 */
export const CONTRACT_LENGTH_MATCHWEEKS = 14;

/**
 * Época absoluta (1-based) derivada de (season, matchweek).
 * O matchweek é season-relative (1..14) e reseta no fim de época; durante a
 * final da Taça pode transitoriamente valer 15 — clampamos a 14 para manter
 * o epoch monótono.
 */
export function contractEpoch(season: number, matchweek: number): number {
  return (Math.max(1, season) - 1) * CONTRACT_LENGTH_MATCHWEEKS + Math.min(14, Math.max(1, matchweek));
}

/**
 * Nomes fictícios dos "Agentes do Jogador" — humor leve, mas determinísticos
 * por jogador (o agente é sempre o mesmo para o mesmo id).
 */
export const AGENT_NAMES = [
  "Careca da Cunha",
  "Primo do Presidente",
  "Senhor Percentagem",
  "Dona Gertrudes, a Agente",
  "Tio dos Relvados",
  "Bruno Comissão",
  "Artur Luvas",
  "Sofia Caneta",
];

export function getAgentName(playerId: number): string {
  const idx = Math.abs(Math.floor(playerId ?? 0)) % AGENT_NAMES.length;
  return AGENT_NAMES[idx];
}

/**
 * Typed calendar entry — either a league matchweek or a cup round.
 * calendarIndex is the position in SEASON_CALENDAR (0-based, 0..18).
 */
export type CalendarEntry =
  | { type: "league"; matchweek: number; calendarIndex: number }
  | { type: "cup"; round: number; roundName: string; teamsIn: number; calendarIndex: number };

/**
 * The single source of truth for season structure.
 * Each entry is one "game week" — the game plays exactly one event per entry.
 * League and cup NEVER run simultaneously.
 * 19 entries total: 14 league matchweeks + 5 cup rounds.
 */
export const SEASON_CALENDAR: CalendarEntry[] = [
  { type: "league", matchweek: 1,  calendarIndex: 0  },
  { type: "league", matchweek: 2,  calendarIndex: 1  },
  { type: "league", matchweek: 3,  calendarIndex: 2  },
  { type: "cup",    round: 1, roundName: "16 avos de final", teamsIn: 32, calendarIndex: 3  },
  { type: "league", matchweek: 4,  calendarIndex: 4  },
  { type: "league", matchweek: 5,  calendarIndex: 5  },
  { type: "league", matchweek: 6,  calendarIndex: 6  },
  { type: "cup",    round: 2, roundName: "Oitavos de final", teamsIn: 16, calendarIndex: 7  },
  { type: "league", matchweek: 7,  calendarIndex: 8  },
  { type: "league", matchweek: 8,  calendarIndex: 9  },
  { type: "league", matchweek: 9,  calendarIndex: 10 },
  { type: "cup",    round: 3, roundName: "Quartos de final", teamsIn: 8,  calendarIndex: 11 },
  { type: "league", matchweek: 10, calendarIndex: 12 },
  { type: "league", matchweek: 11, calendarIndex: 13 },
  { type: "cup",    round: 4, roundName: "Meias-finais",     teamsIn: 4,  calendarIndex: 14 },
  { type: "league", matchweek: 12, calendarIndex: 15 },
  { type: "league", matchweek: 13, calendarIndex: 16 },
  { type: "league", matchweek: 14, calendarIndex: 17 },
  { type: "cup",    round: 5, roundName: "Final",            teamsIn: 2,  calendarIndex: 18 },
];
