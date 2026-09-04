/**
 * Escala unificada 1–50 para forma e resistência (migração v2).
 * Neutros são a imagem linear dos antigos: forma 100→32, resistência 3→26.
 */
export const FORM_NEUTRAL = 32;
export const FORM_MIN = 1;
export const FORM_MAX = 50;
/** Piso pós-jogo: 70 antigo → 13 (distinto do piso de treino FORM_MIN=1). */
export const FORM_MATCH_MIN = 13;
export const RES_NEUTRAL = 26;
export const RES_MIN = 1;
export const RES_MAX = 50;
/** Referência económica: preserva o fator médio antigo form/90 (100→1,11). */
export const ECON_FORM_REF = 100 / 90;

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
  // Preserva exatamente a função antiga 0.9+(res/5)*0.2 (res 1–5 → fator
  // 0.94–1.10) composta com o mapeamento linear 1–5 → 1–50.
  const resFactor =
    0.94 +
    (((player.resistance ?? RES_NEUTRAL) - RES_MIN) / (RES_MAX - RES_MIN)) *
      0.16;
  const formFactor = ((player.form ?? FORM_NEUTRAL) / FORM_NEUTRAL) * ECON_FORM_REF;
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
 * Amortização semanal do empréstimo bancário (pagamento de capital).
 * A cada semana de jogo (liga e taça), este valor é debitado do orçamento e
 * abatido ao principal (loan_amount), independentemente dos juros. Assim a
 * dívida visível diminui semana a semana até a zero.
 * 35K/sem → um empréstimo de 500K (1 LOAN_STEP) é liquidado em ~14 semanas.
 */
export const LOAN_WEEKLY_INSTALLMENT = 35000;

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
  "Manel Pica",
  "Tó Zé Marteleiro",
  "Quim Roscas",
  "Nuno do Balde",
  "Rui Canivete",
  "Miguel Rabugento",
  "Pedro Fofinha",
  "João Prego",
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

// ---------------------------------------------------------------------------
// Regras de substituições (aplica-se a todas as fases da partida: jogo normal,
// intervalo, taça e prolongamento).
//
// O contador é por equipa e vive dentro do fixture (`_subCountByTeam`), por isso
// persiste entre fases sem nunca ser resetado. Cartões vermelhos NÃO contam
// (expulsão tira um jogador de campo sem repor ninguém — regra oficial).
// ---------------------------------------------------------------------------
export const MAX_SUBSTITUTIONS = 3; // máximo de substituições por equipa/partida
export const MAX_BENCH_SIZE = 7; // máximo de suplentes no banco

// ---------------------------------------------------------------------------
// GR improvisado (jogador de campo na baliza) — futebol profissional.
// Quando o GR em campo sai (expulsão/lesão) sem outro GR disponível, um jogador
// de campo calça as luvas até ao fim do jogo com o piso de skill júnior.
// Tudo em memória: a posição real na DB nunca muda.
// ---------------------------------------------------------------------------
export const EMERGENCY_GK_SKILL = 5; // piso júnior (skill mínima na baliza)

/**
 * Número de substituições já feitas por uma equipa numa partida.
 * Conta substituições normais e lesões com reposição (mas NÃO expulsões).
 */
export function getSubCount(fixture: any, teamId: number): number {
  return fixture._subCountByTeam?.[teamId] ?? 0;
}

/** Incrementa o contador de substituições de uma equipa numa partida. */
export function incrementSubCount(fixture: any, teamId: number): void {
  fixture._subCountByTeam ??= {};
  fixture._subCountByTeam[teamId] = (fixture._subCountByTeam[teamId] ?? 0) + 1;
}

/** Verdadeiro enquanto a equipa tiver substituições por fazer. */
export function canMakeSubstitution(fixture: any, teamId: number): boolean {
  return getSubCount(fixture, teamId) < MAX_SUBSTITUTIONS;
}

/**
 * Quantas substituições ainda são possíveis para uma equipa (0 se esgotou).
 * Usado nos intervalos/alongamentos onde várias podem ser feitas de uma vez.
 */
export function remainingSubstitutions(fixture: any, teamId: number): number {
  return Math.max(0, MAX_SUBSTITUTIONS - getSubCount(fixture, teamId));
}

// ---------------------------------------------------------------------------
// Afinação do motor de jogo (fix #8 — fonte única).
// Todos os literais de probabilidade/intensidade da simulação vivem aqui,
// com a taxa-alvo em comentário. Para afinar o balanceamento (golos/jogo,
// lesões/época, cartões/jogo), mexer SÓ aqui — nunca nos call sites.
// ---------------------------------------------------------------------------
export const MATCH_TUNING = {
  // Golos em jogo corrido: taxa base por minuto por equipa (antes de
  // forma/tempo/clima/posse). Alvo: ~2.5–3.5 golos/jogo no total.
  goalBaseRate: 0.03,
  homeGoalFactor: 1.08, // vantagem casa (fora da final da Taça)
  awayGoalFactor: 0.92,
  ownGoalShare: 0.08, // ~8% das oportunidades de golo
  varDisallowedShare: 0.05, // 5% dos golos anulados pelo VAR
  // Conflito de egos: 3+ craques (MED/ATA) no XI reduzem a probabilidade.
  egoThreshold: 2,
  egoPenaltyPerExtra: 0.1,
  egoPenaltyMax: 0.3,
  // Craques decidem: probabilidade de o golo ser marcado como decisivo.
  decisivePerStar: 0.2,
  decisiveMax: 0.6,
  // Penáltis em jogo: ~0.2% por minuto (fora do min 90 da liga). Alvo base
  // 82% de conversão, skill (5–50) desvia ±6pp em torno da média (30).
  penaltyPerMinute: 0.002,
  penaltyBase: 0.82,
  penaltySkillMid: 30,
  penaltySkillDivisor: 250,
  penaltyMin: 0.74,
  penaltyMax: 0.92,
  // Repartição do falhanço (cumulativos): 60% defesa · 10% poste ·
  // 10% ao lado · 20% panenka.
  penaltyMissSave: 0.6,
  penaltyMissPost: 0.7,
  penaltyMissWide: 0.8,
  // Lances de perigo sem golo (só comentário): ~1–2 por jogo.
  nearMissPerMinute: 0.018,
  bigSaveShare: 0.45,
  // Cartões: ~1.5% por minuto por equipa, modulado pela agressividade média
  // (escala 1–5, âncora 3). Alvo: um vermelho direto é raro.
  cardBaseRate: 0.015,
  cardAggPerPoint: 0.1,
  secondYellowRedShare: 0.15,
  directRedShare: 0.005,
  // Lesões: ~0.3% por minuto (antes do multiplicador de clima). Alvo: poucas
  // por época; clima adverso agrava.
  injuryPerMinute: 0.003,
  injuryWeatherMult: {
    neve: 1.6,
    chuva_forte: 1.4,
    vento: 1.3,
    chuva: 1.2,
  } as Record<string, number>,
  // Resistência (escala 1–50): hipótese por ponto de evitar a lesão.
  injuryResistSkipPerPoint: 0.00653,
  // Gravidade: 10% graves (3–8 semanas + perda de skill), resto leves (1 semana).
  injurySevereShare: 0.1,
  injurySevereMinWeeks: 3,
  injurySevereExtraWeeks: 6,
  injurySevereLossBase: 2,
  injurySevereLossExtra: 4,
  // Fadiga: a cada intervalo de minutos jogados, -1 skill efetiva, com
  // escape por resistência (por ponto). Alvo: titulares cansados no fim.
  fatigueIntervalMinutes: 15,
  fatigueSkipPerResPoint: 0.00816,
  // Moral (0–100): desvia o ataque ±10% e a defesa ±5% em torno de 50.
  // Deliberadamente pequeno — a forma ajusta, não decide.
  moraleAttackPerPoint: 0.002,
  moraleDefensePerPoint: 0.001,
  // Marcador ponderado: peso ATA vs resto, multiplicador craque, clamp de forma.
  scorerAtaWeight: 2,
  scorerStarMult: 3,
  scorerFormMin: 0.7,
  scorerFormMax: 1.3,
  // Desempate por penáltis (Taça): base 72% ± skill GR/batedor, cap de morte súbita.
  shootoutBase: 0.72,
  shootoutSkillDivisor: 200,
  shootoutMin: 0.55,
  shootoutMax: 0.88,
  shootoutSuddenDeathCap: 20,
  // Failsafe do desempate (morte súbita esgotada): prob. de a casa ganhar o sorteio.
  shootoutFailsafeHome: 0.5,
  // Janelas de ação do treinador humano: 60s para decisões táticas (subs,
  // lesões, GR improvisado/expulso), 12s para penáltis (não travar o jogo).
  actionTimeoutMs: 60000,
  penaltyActionTimeoutMs: 12000,
  // Moral: delta por resultado + decaimento semanal para o neutro 50.
  moraleWinDelta: 25,
  moraleLossDelta: -20,
  moraleDrawDelta: 5,
  moraleDecayRate: 0.1,
  // Evolução pós-jogo (probabilidades por jogador/semana). Alvos: subidas
  // lentas por convivência/vitórias, descidas por derrotas/inatividade.
  evoAboveCeilingRoll: 0.15, // acima do potencial: deriva de retorno
  evoRustRoll: 0.15, // inativo há 3+ eventos: risco de enferrujar
  evoCohabitBase: 0.2, // convivência com plantel mais talentoso
  evoCohabitDivisor: 20, // …+ diff / 20, teto 0.75
  evoCohabitMax: 0.75,
  evoWinBase: 0.1, // vitória reforça quem está abaixo da média
  evoWinDivisor: 50, // …+ diff / 50, teto 0.45
  evoWinMax: 0.45,
  evoLossBase: 0.04, // derrota: pressão de decaimento…
  evoLossDivisor: 150, // …+ max(0,-diff) / 150, teto 0.18
  evoLossMax: 0.18,
  evoStreakBase: 0.05, // …agravada por derrotas consecutivas…
  evoStreakSlope: 0.03, // …+ 0.03 * (streak - 1), teto 0.20
  evoStreakMax: 0.2,
  evoDrawDiff: 4, // empate c/ equipa mais forte: dif. mínima p/ evoluir
  evoDrawChance: 0.2,
  evoBraceChance: 0.25, // 2+ golos
  evoGoalChance: 0.1, // 1 golo
  evoCleanSheetChance: 0.15, // GR com clean sheet em vitória
  evoRedChance: 0.2, // cartão vermelho
  evoMomentumChance: 0.1, // presença consecutiva
  evoStagnationChance: 0.04, // excesso de jogos sem descanso
} as const;
