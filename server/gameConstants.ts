/**
 * Escala unificada 1–50: forma/resistência (migração v2), agressividade e
 * moral de equipa (migração v4).
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
/** Neutro da moral individual (players.morale 1–50, como forma e resistência). */
export const MORALE_NEUTRAL = 25;
/** Referência económica: preserva o fator médio antigo form/90 (100→1,11). */
export const ECON_FORM_REF = 100 / 90;
/** Ritmo da simulação ao vivo (ms por minuto de jogo): 2000 com humanos,
 * 100 nas rondas só-NPC. A Final sem humanos corre a meio-tempo (500)
 * para se acompanhar como espetador — ritmo de gala. */
export const CUP_FINAL_SPECTATOR_MS_PER_MINUTE = 500;

/**
 * Ritmo da simulação ao vivo, por sala (o admin escolhe o preset).
 * Chave canónica: o cliente envia a chave, o servidor valida e guarda os ms.
 */
export const SIM_SPEED_PRESETS = {
  calm: 3000, // Calmo — 1 min de jogo = 3s reais
  normal: 2000, // Normal — 1 min de jogo = 2s reais
  fast: 1000, // Rápido — 1 min de jogo = 1s real
} as const;
export type SimSpeedKey = keyof typeof SIM_SPEED_PRESETS;
export const DEFAULT_SIM_SPEED: SimSpeedKey = "normal";
export const DEFAULT_MS_PER_MINUTE: number = SIM_SPEED_PRESETS[DEFAULT_SIM_SPEED];

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
 * Manutenção semanal do estádio: custo por lugar por semana de jogo.
 * 1.5€ → um 120k custa ~3.6M€/época, um 10k ~300k€/época (20 semanas).
 * Calibrado contra a sala FGPQH6 (Chaves: ~4.9M€ bilheteira/época).
 */
export const STADIUM_UPKEEP_PER_SEAT_WEEK = 1.5;

/**
 * Re-exportado de db/seedEcon.js (fonte única partilhada com a seed).
 */
import {
  FANBASE_BY_DIVISION as ECON_FANBASE,
  BUDGET_BY_DIVISION as ECON_BUDGET,
  SKILL_RANGE_BY_DIVISION as ECON_SKILL_RANGE,
  WAGE_SEED_SPREAD as ECON_WAGE_SPREAD,
  recalcPlayerValue as econRecalcPlayerValue,
  fairWeeklyWage as econFairWeeklyWage,
} from "./db/seedEcon.js";
export const FANBASE_BY_DIVISION: Record<number, number> = ECON_FANBASE;
export const BUDGET_BY_DIVISION: Record<number, number> = ECON_BUDGET;
export const SKILL_RANGE_BY_DIVISION: Record<number, [number, number]> =
  ECON_SKILL_RANGE;
export const WAGE_SEED_SPREAD: number = ECON_WAGE_SPREAD;

/**
 * Teto suave da massa adepta por divisão: sem subir de divisão não há
 * enchente de 50k. Revisto em cada evolução de fim de época.
 */
export const FANBASE_DIV_CAP: Record<number, number> = {
  1: 120000,
  2: 60000,
  3: 30000,
  4: 15000,
  5: 8000,
};

/** Variação máxima da massa adepta por fim de época. */
export const FANBASE_GROWTH_TITLE = 0.2;
export const FANBASE_GROWTH_PROMOTED = 0.2;
export const FANBASE_GROWTH_MIDTABLE = 0.05;
export const FANBASE_DECLINE_BOTTOM = -0.1;
export const FANBASE_DECLINE_RELEGATED = -0.2;

/**
 * Agentes farejam riqueza (só humanos): mult = 1 + min(CAP, max(0, budget - FLOOR) / SCALE).
 * Banco de 14M€ → pedidos ×1.45; abaixo de 5M€ nada muda.
 */
export const WEALTH_AGENT_FLOOR = 5000000;
export const WEALTH_AGENT_SCALE = 20000000;
export const WEALTH_AGENT_CAP = 0.5;

export function wealthAgentMultiplier(budget: number): number {
  return (
    1 + Math.min(WEALTH_AGENT_CAP, Math.max(0, (budget || 0) - WEALTH_AGENT_FLOOR) / WEALTH_AGENT_SCALE)
  );
}

/** Direção NPC investe excedente: limiar de riqueza e custo da academia. */
export const NPC_INVEST_BUDGET_THRESHOLD = 10000000;
export const NPC_ACADEMY_COST = 500000;

/** Piso de skill nas compras NPC: rejeita abaixo de (nível da equipa − margem). */
export const NPC_BUY_FLOOR_MARGIN = 10;

/**
 * Re-exportadas de db/seedEcon.js (fonte única partilhada com a seed).
 * O valor é recalculado sempre que o skill muda (treino, evolução, decaimento).
 */
export const recalcPlayerValue: (skill: number) => number =
  econRecalcPlayerValue;

/**
 * Re-exportada de db/seedEcon.js (fonte única partilhada com a seed).
 * Âncoras: skill 10 → ~1000€/sem, skill 50 → ~8000€/sem.
 */
export const fairWeeklyWage: (skill: number) => number = econFairWeeklyWage;

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
  5: 400000,
};

/**
 * Rendimento base semanal creditado a cada equipa pela sua divisão
 * (mantém as equipas das divisões baixas viáveis). Promovido aqui para ser
 * partilhado pela folha semanal e pela economia NPC (evita duplicação).
 */
export const WEEKLY_BASE_INCOME: Record<number, number> = {
  1: 80000,
  2: 50000,
  3: 35000,
  4: 25000,
  5: 20000,
};

/** Número de eventos (semanas de jogo) por época = SEASON_CALENDAR.length (1 amigável + 14 liga + 5 taça). */
export const NPC_SEASON_WEEKS = 20;

/**
 * Folha salarial semanal "de equilíbrio" (break-even) de uma divisão:
 * o que uma equipa pode pagar em ordenados ao longo de uma época inteira
 * sem perder dinheiro, dados o rendimento base semanal e o patrocínio anual
 * (único, creditado no fim de época) amortizado pelas semanas da época.
 * Acima deste valor a folha sozinha excede a receita garantida → insolvência
 * estrutural (depende de prémios/bilheteiras/vendas para não afundar).
 */
export function npcStructuralBreakEvenFolha(division: number): number {
  const base = WEEKLY_BASE_INCOME[division] ?? 12000;
  const sponsor = SPONSOR_REVENUE_BY_DIVISION[division] ?? 0;
  return Math.round(base + sponsor / NPC_SEASON_WEEKS);
}

/**
 * Teto para a pressão de agentes dos NPCs (P1): nunca se sobe a folha acima
 * de NPC_FOLHA_CAP_RATIO × break-even (nunca se compromete um NPC a pagar
 * mais do que ganha numa época — sem risco de insolvência criada pelo próprio
 * mecanismo anti-acumulação). <1 deixa uma pequena margem de segurança anual.
 */
export const NPC_FOLHA_CAP_RATIO = 0.95;

/** Teto efetivo da folha usado nas subidas de salário dos NPCs (P1). */
export function npcSustainableWeeklyFolha(division: number): number {
  return Math.round(
    npcStructuralBreakEvenFolha(division) * NPC_FOLHA_CAP_RATIO,
  );
}

/**
 * Semanas consecutivas de "insolvência estrutural" (orçamento negativo E
 * folha acima do break-even) antes de um NPC entrar em restrições (aviso).
 */
export const NPC_NEGATIVE_BUDGET_WARN_STREAK = 2;

/**
 * Idem, para a redução forçada de custos: a direção coloca os excedentários
 * de maior ordenado à venda. Repete-se de X em X semanas enquanto se mantiver
 * em insolvência estrutural. Só clubes que perdem dinheiro *com garantia*
 * (folha > receita anual) são cortados — clubes só apertados (negativo
 * transitório, mas folha ≤ break-even, recuperáveis no patrocínio) NÃO são.
 */
export const NPC_NEGATIVE_BUDGET_CUT_STREAK = 4;
export const NPC_NEGATIVE_BUDGET_CUT_INTERVAL = 3;

/** Máximo de jogadores excedentários libertados por evento de corte de custos. */
export const NPC_WAGE_CUT_PER_EVENT = 2;

/**
 * Incremento mínimo entre lances num leilão (servidor e cliente devem usar o mesmo valor).
 * Aplica-se a qualquer leilão, incluindo os que começam a €0.
 */
export const AUCTION_BID_STEP = 10000;

/**
 * Amortização semanal do empréstimo bancário (pagamento de capital),
 * escalonada por divisão: a prestação fixa única (35K/sem) valia 3 mesadas
 * para uma Distrital e meia para a 1.ª Liga. Cada divisão paga à medida
 * da sua mesada; a dívida visível diminui semana a semana até a zero.
 */
export const LOAN_INSTALLMENT_BY_DIVISION: Record<number, number> = {
  1: 50000,
  2: 40000,
  3: 30000,
  4: 20000,
  5: 15000,
};

/** Prestação semanal do empréstimo para uma divisão (fallback: D5). */
export function loanInstallment(division: number): number {
  return LOAN_INSTALLMENT_BY_DIVISION[division] ?? 15000;
}

/**
 * Lugares isentos da manutenção semanal do estádio: os primeiros 3000
 * lugares não pagam. Um estádio de 5 mil (divisões baixas) poupa ~90K€/época;
 * os gigantes continuam a pagar milhões — o luxo paga-se, a base respira.
 */
export const STADIUM_UPKEEP_EXEMPT_SEATS = 3000;

/**
 * Quinhão do visitante na bilheteira (liga e Taça): 15% da receita vai
 * para a equipa de fora. Jogar num estádio cheio deixa de render zero.
 */
export const AWAY_TICKET_SHARE = 0.15;

/**
 * Duração de um contrato em slots de calendário (1 época = 20 semanas).
 * Um jogador contratado/renovado no slot X só pode ser transferido a
 * partir do slot X da época seguinte. Relógio único: os slots andam em
 * todas as semanas (amigável, liga e taça), não só nas jornadas da liga.
 */
export const CONTRACT_LENGTH_MATCHWEEKS = 20;

/**
 * Fragmento SQL partilhado: limpa o estado de pedido do agente ao
 * assinar/renovar/libertar um contrato. Usado nos UPDATEs de contrato do
 * leilão, compra NPC, renovação NPC e expiração — um único sítio evita
 * divergências de colunas entre caminhos.
 */
export const CONTRACT_REQUEST_RESET_SQL =
  "contract_request_pending = 0, contract_requested_wage = 0, contract_request_is_renegotiation = 0";

/**
 * Renegociação de agente: só para salários muito abaixo do justo (< 70%).
 */
export const AGENT_RENEGOTIATION_WAGE_FLOOR = 0.7;

/** NPC só renova contrato a jogador necessário se a equipa tiver orçamento
 * acima deste piso (nunca insolvência por renovação). */
export const NPC_RENEW_MIN_BUDGET = 5000;

/**
 * Piso anti-preço-simbólico no leilão ex-clube (contrato expirado ou corte
 * de folha NPC): preço mínimo = max(skill × FLOOR_RATE, FLOOR_MIN_SKILL) ×
 * FLOOR_WEEKS — garante que nem jogadores baratos saem a preço de pele.
 */
export const AUCTION_PRICE_FLOOR_RATE = 40;
export const AUCTION_PRICE_FLOOR_MIN_SKILL = 500;
export const AUCTION_PRICE_FLOOR_WEEKS = 12;
/** Rácio mínimo sobre o valor efetivo no leilão ex-clube. */
export const AUCTION_PRICE_FLOOR_VALUE_RATIO = 0.65;

/**
 * NPC coloca jogadores no mercado por plantel cheio: probabilidade semanal
 * do 1.º limiar de tamanho de plantel cumprido (desc).
 */
export const NPC_LIST_SQUAD_THRESHOLDS = [
  { size: 16, chance: 0.4 },
  { size: 12, chance: 0.15 },
] as const;

/**
 * Época absoluta (1-based) derivada de (season, slot).
 * O slot é 1-based (1..20) e reseta no fim de época — monótono por época.
 */
export function contractEpoch(season: number, slot: number): number {
  return (Math.max(1, season) - 1) * CONTRACT_LENGTH_MATCHWEEKS + Math.min(20, Math.max(1, slot));
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

/** Ronda reservada ao amigável de pré-época em cup_matches (nunca avança). */
export const FRIENDLY_ROUND = 0;
/** Nome canónico do amigável (servidor e cliente usam a mesma string). */
export const FRIENDLY_ROUND_NAME = "Amigável de pré-época";

/**
 * Typed calendar entry — a league matchweek, a cup round or the pre-season friendly.
 * calendarIndex is the position in SEASON_CALENDAR (0-based, 0..19).
 * O amigável viaja no fio como taça (ronda 0): a vista live e o jornal
 * reutilizam o caminho da taça sem estados novos.
 */
export type CalendarEntry =
  | { type: "league"; matchweek: number; calendarIndex: number }
  | { type: "cup"; round: number; roundName: string; teamsIn: number; calendarIndex: number }
  | { type: "friendly"; round: 0; roundName: string; calendarIndex: number };

/**
 * The single source of truth for season structure.
 * Each entry is one "game week" — the game plays exactly one event per entry.
 * League, cup and friendly NEVER run simultaneously.
 * 20 entries total: 1 pre-season friendly + 14 league matchweeks + 5 cup rounds.
 */
export const SEASON_CALENDAR: CalendarEntry[] = [
  { type: "friendly", round: 0, roundName: "Amigável de pré-época", calendarIndex: 0  },
  { type: "league", matchweek: 1,  calendarIndex: 1  },
  { type: "league", matchweek: 2,  calendarIndex: 2  },
  { type: "league", matchweek: 3,  calendarIndex: 3  },
  { type: "cup",    round: 1, roundName: "16 avos de final", teamsIn: 32, calendarIndex: 4  },
  { type: "league", matchweek: 4,  calendarIndex: 5  },
  { type: "league", matchweek: 5,  calendarIndex: 6  },
  { type: "league", matchweek: 6,  calendarIndex: 7  },
  { type: "cup",    round: 2, roundName: "Oitavos de final", teamsIn: 16, calendarIndex: 8  },
  { type: "league", matchweek: 7,  calendarIndex: 9  },
  { type: "league", matchweek: 8,  calendarIndex: 10 },
  { type: "league", matchweek: 9,  calendarIndex: 11 },
  { type: "cup",    round: 3, roundName: "Quartos de final", teamsIn: 8,  calendarIndex: 12 },
  { type: "league", matchweek: 10, calendarIndex: 13 },
  { type: "league", matchweek: 11, calendarIndex: 14 },
  { type: "cup",    round: 4, roundName: "Meias-finais",     teamsIn: 4,  calendarIndex: 15 },
  { type: "league", matchweek: 12, calendarIndex: 16 },
  { type: "league", matchweek: 13, calendarIndex: 17 },
  { type: "league", matchweek: 14, calendarIndex: 18 },
  { type: "cup",    round: 5, roundName: "Final",            teamsIn: 2,  calendarIndex: 19 },
];

/**
 * Semana do calendário (1..20) de uma jornada da liga. `matchweek` não é uma
 * data: repete-se nas semanas de Taça que o seguem (ver SEASON_CALENDAR).
 */
export function slotForLeagueMatchweek(matchweek: number): number {
  const entry = SEASON_CALENDAR.find(
    (e) => e.type === "league" && (e as any).matchweek === Number(matchweek),
  );
  return (entry?.calendarIndex ?? 0) + 1;
}

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
  goalBaseRate: 0.04, // (modelo antigo — calibração/scripts)
  homeGoalFactor: 1.08, // vantagem casa (fora da final da Taça)
  awayGoalFactor: 0.92,
  // Posse (hatrick-style): médios decidem a repartição das chances, fixada
  // no apito inicial. 50% ± diferença de médios × possePorPonto + estilo.
  chancesTotal: 30, // chances/jogo no total, divididas pela posse
  possePerPoint: 0.014, // 10 pts de diferença de médios ≈ 14pp de posse (antes 7.5pp — o gap de qualidade não se via nas chances)
  posseStyleDefensiva: 0.02, // estilo inclina: DEFENSIVO + / OFENSIVO −
  // Conversão de chance: p = base × ATA/(ATA + defWeight×(DEF+GR)).
  // Médias → o nº de jogadores não pesa; defWeight é a "parede".
  // Parede 1.2→1.6: o gap de qualidade abre mais o marcador; base 0.175→0.21
  // compensa para o total de golos da liga não se mover (~2.5/jogo).
  chanceGoalBase: 0.21,
  chanceDefWeight: 1.6,
  chanceGoalMin: 0.06,
  chanceGoalMax: 0.32,
  // Chance sem golo: repartição (cumulativo) GR defende · poste · resto ao lado.
  chanceSaveShare: 0.55,
  chancePostShare: 0.7,
  // Prolongamento (91'–120'): sem o pico de 1.62 dos 86'–90'. Medido com
  // 1500 jogos (harness): 1.62 → 1.17 golos/ET e 70% dos ET decididos; a 1.0
  // ficam 0.72 golos/ET e 51% decididos no ET (49% para penáltis).
  extraTimeChanceMult: 1,
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
  // (escala 1–50, âncora 30). Alvo: um vermelho direto é raro.
  cardBaseRate: 0.015,
  cardAggPerPoint: 0.01,
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
  // Carga de lesões: se a equipa começa o jogo com jogadores já lesionados
  // (injury_until_matchweek >= jornada atual), a taxa de lesão dela nesse
  // jogo é reduzida a este fator — amortiza lesões consecutivas (queixas
  // de coaches). Lido da BD no arranque do jogo → estável em replays/crashes.
  injuryLoadSoftener: 0.5,
  // Fadiga: a cada intervalo de minutos jogados, -1 skill efetiva, com
  // escape por resistência (por ponto). 0.00816→0.012: resistência máxima
  // evita ~60% do desgaste (antes ~40%) — a resistência nota-se mais.
  fatigueIntervalMinutes: 15,
  fatigueSkipPerResPoint: 0.012,
  // GR cansam-se muito menos que jogadores de campo: bónus extra de escape
  // (soma-se ao skipChance) para quem joga como GR (posição "GR", incl. GR
  // improvisado). +0.50 ≈ metade do desgaste de um jogador de campo médio.
  fatigueGRSkipBonus: 0.5,
  // Moral de equipa (1–50, neutro 25): desvia o ataque ±10% e a defesa ±5%
  // em torno de 25. Deliberadamente pequeno — a forma ajusta, não decide.
  moraleAttackPerPoint: 0.004,
  moraleDefensePerPoint: 0.002,
  // Marcador ponderado: peso ATA vs resto (DEF raro), multiplicador craque, clamp de forma.
  scorerAtaWeight: 2,
  scorerDefWeight: 0.3,
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
  // Moral de equipa (1–50): delta por resultado + decaimento semanal para
  // o neutro 25. Metade dos deltas antigos (25/−20/5) — empate 2,5→2.
  moraleWinDelta: 12,
  moraleLossDelta: -10,
  moraleDrawDelta: 2,
  moraleDecayRate: 0.1,
  // Moral individual (players.morale 1–50, neutro 25): deltas por evento
  // + peso na skill efetiva. Deliberadamente pequeno — como a forma.
  moralePlayerWinDelta: 2,
  moralePlayerLossDelta: -2,
  moralePlayerDrawDelta: 1,
  moralePlayerStarterBonus: 1,
  moralePlayerBenchMalus: -1,
  moralePlayerGoalBonus: 1,
  moralePlayerOwnGoalMalus: -2,
  moralePlayerRedMalus: -2,
  // Média do plantel desvia ataque e defesa ±5% em torno do neutro.
  moralePlayerPerPoint: 0.002,
  // ── Mood dos adeptos (fans_mood 1–50, coluna teams.fans_mood; migração v5)
  // Memória emocional da bancada — distinta da moral do plantel. A assistência
  // deriva dela (ver calculateMatchAttendance em coreHelpers).
  fansMoodDefault: 30, // valor de arranque (época 1 / clubes novos)
  fansMoodDecayRate: 0.15, // decaimento semanal para a base de fidelidade
  // Base de fidelidade por divisão (para onde o mood regride sem resultados):
  // clubes grandes mantêm o apoio, clubes pequenos vivem do momento.
  fansBaseByDivision: { 1: 33, 2: 30, 3: 28, 4: 25, 5: 23 } as Record<number, number>,
  fansWinDelta: 5, // vitória base
  fansLossDelta: -5, // derrota base
  fansDrawDelta: 1, // empate base
  fansHomeWinBonus: 1, // ganhar em casa sabe melhor
  fansHomeLossMalus: -2, // perder em casa dói mais
  fansMarginPerGoal: 1, // por golo de margem além do 1º (goleada/humilhação)
  fansUpsetBonus: 2, // vencer equipa de escalão superior (divisão menor)
  fansShameMalus: -3, // perder com equipa de escalão inferior (vergonha)
  fansExpectedLossSoftener: 3, // derrota esperada com mais fortes dói menos
  fansDerbyMultiplier: 2, // dérbi (mesma divisão): emoções a dobrar
  fansCupRoundMultiplier: { 1: 1, 2: 1.1, 3: 1.25, 4: 1.5, 5: 1.8 } as Record<number, number>,
  // ── Assistências (calculateMatchAttendance) ──────────────────────────
  // Chão de fiéis por divisão: % da capacidade que aparece mesmo em crise.
  faithfulFloorByDivision: { 1: 0.35, 2: 0.3, 3: 0.25, 4: 0.22, 5: 0.2 } as Record<number, number>,
  attendanceAbsoluteMinRatio: 0.12, // nunca abaixo de 12% (pessoal, erros, curiosos)
  attendanceJitter: 0.1, // variação natural por jogo ±10%
  attendanceMagicNightChance: 0.05, // "noite mágica": +8..15% (raro)
  attendanceDesertChance: 0.12, // "deserção" em crise (mood<13, 3+ sem ganhar)
  attendanceDesertMoodMax: 13,
  // Preço do bilhete: procura reage ao desvio face aos 15€ base.
  ticketBasePrice: 15,
  ticketDemandPerEuro: 0.014, // mult = 1 − (preço−15) × 0.014
  // Fator adversário/posição: bónus que se somam (teto global em baixo).
  attendanceDerbyBonus: 0.12, // mesma divisão = rivalidade local
  attendanceLeaderVisitBonus: 0.08, // visita do 1º/2º classificado
  attendanceTitleRaceBonus: 0.08, // equipa da casa no top 3
  attendanceBottomMalus: -0.06, // equipa da casa nos últimos 2
  attendanceWeakVisitorMalus: -0.05, // visitante dos últimos 2
  attendanceBonusCap: 0.35, // teto da soma dos bónus contextuais
  // Ronda da Taça: as primeiras eliminatórias esvaziam, a final enche.
  attendanceCupRoundMult: { 1: 0.85, 2: 0.9, 3: 1.0, 4: 1.1, 5: 1.25 } as Record<number, number>,
  // Meteorologia: sol puxa gente, chuva forte/neve esvaziam.
  attendanceWeatherMult: {
    sol: 1.05,
    chuva: 0.94,
    vento: 0.97,
    chuva_forte: 0.88,
    frio: 0.93,
    nevoeiro: 0.95,
    neve: 0.85,
  } as Record<string, number>,
  // ── Bónus casa por ambiente (computeSidePower, só equipa da casa) ────
  crowdBonusOccupancy: 0.9, // lotação ≥90% → vulcão
  crowdBonusAttack: 0.04, // +4% ataque
  crowdPenaltyOccupancy: 0.4, // lotação <40% → morgue
  crowdPenaltyAttack: -0.03, // −3% ataque
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
