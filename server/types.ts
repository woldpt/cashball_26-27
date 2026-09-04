import type { SidePower } from "./game/matchCalculations";

export type TacticStyle =
  | "Balanced"
  | "Defensive"
  | "Offensive"
  | "EQUILIBRADO"
  | "DEFENSIVO"
  | "OFENSIVO";

export interface Tactic {
  formation: string;
  style: TacticStyle;
  positions?: Record<number, "Titular" | "Suplente" | string>;
}

export type PlayerPosition = "GR" | "DEF" | "MED" | "ATA";

/**
 * Linha de jogador (DB + campos efémeros em jogo). Os campos nucleares são
 * obrigatórios; o resto é opcional. A index signature cobre colunas raras
 * sem enfraquecer os acessos declarados.
 */
export interface PlayerRow {
  id: number;
  name: string;
  position: PlayerPosition;
  skill: number;
  // ── Só memória, durante a simulação (nunca persiste) ──
  _matchSkill?: number; // skill efetiva com fadiga (ver getEffectiveSkill)
  originalPosition?: PlayerPosition;
  isEmergencyGK?: boolean;
  isJunior?: boolean;
  // ── Atributos ──
  resistance?: number;
  form?: number;
  aggressiveness?: number | string;
  potential?: number;
  is_star?: number;
  // ── Vínculo / estado ──
  team_id?: number | null;
  age?: number;
  nationality?: string;
  value?: number;
  wage?: number;
  transfer_status?: string;
  transfer_cooldown_until_matchweek?: number;
  joined_matchweek?: number;
  signed_season?: number | null;
  // ── Contadores época / carreira ──
  games_played?: number;
  goals?: number;
  career_goals?: number;
  yellow_cards?: number;
  red_cards?: number;
  career_reds?: number;
  injuries?: number;
  career_injuries?: number;
  suspension_games?: number;
  suspension_until_matchweek?: number;
  injury_until_matchweek?: number;
  last_appearance_matchweek?: number;
  prev_skill?: number | null;
  [key: string]: unknown;
}

export type MatchSide = "home" | "away";

export interface MatchEvent {
  minute: number;
  type: string;
  team: MatchSide | null;
  text: string;
  emoji?: string;
  playerId?: number | null;
  playerName?: string;
  [key: string]: unknown;
}

/**
 * Fixture em jogo. Campos de resultado + caches transitórios (`_`) que só
 * vivem durante a simulação (plantéis, ledgers de fadiga, deltas pós-jogo,
 * memoização de força, guards de comentário). Nada com `_` persiste na DB.
 */
export interface MatchFixture {
  homeTeamId: number;
  awayTeamId: number;
  homeTeam?: { name?: string; division?: number; position?: number | null } | null;
  awayTeam?: { name?: string; division?: number; position?: number | null } | null;
  finalHomeGoals: number;
  finalAwayGoals: number;
  events: MatchEvent[];
  homeLineup?: Array<Record<string, unknown>>;
  awayLineup?: Array<Record<string, unknown>>;
  attendance?: number;
  referee?: unknown;
  round?: number;
  season?: number;
  matchweek?: number;
  homePossession?: number;
  awayPossession?: number;
  // ── Caches transitórios da simulação ──
  _minute?: number;
  _weather?: string;
  _homePossession?: number;
  _awayPossession?: number;
  _homeSquad?: PlayerRow[];
  _awaySquad?: PlayerRow[];
  _homeFullRoster?: PlayerRow[];
  _awayFullRoster?: PlayerRow[];
  _homeMorale?: number;
  _awayMorale?: number;
  _t1?: Tactic | null;
  _t2?: Tactic | null;
  _yellowCards?: Record<number, number>;
  _subbedOut?: Set<number>;
  _subCountByTeam?: Record<number, number>;
  _minutesPlayed?: { home: Record<number, number>; away: Record<number, number> };
  _fatigueLoss?: { home: Record<number, number>; away: Record<number, number> };
  _deltas?: {
    calendarIndex: number;
    appearances: Set<number>;
    goals: Map<number, number>;
    reds: Map<number, number>;
    injuries: Map<number, {
      newSkill: number;
      injuryUntil: number;
      oldSkill: number;
      count: number;
      matchweek: number;
      season: number;
    }>;
  };
  _homePower?: { power: SidePower; version: number };
  _awayPower?: { power: SidePower; version: number };
  // Índice id→posição do snapshot de lineup (evita findIndex O(11) por
  // jogador por minuto no syncFatigueSnapshot). Auto-validado: rebuild se
  // o array for trocado, mudar de tamanho (splice) ou o id na posição
  // divergir (swap). Ver getLineupIndex.
  _lineupIndex?: {
    home?: { arr: unknown[]; byId: Map<number, number> };
    away?: { arr: unknown[]; byId: Map<number, number> };
  };
  // Deltas já enfileirados para a DB (flush em curso) — impede duplo
  // enqueue; os `_deltas` só são libertados quando os writes confirmam.
  _deltasQueued?: boolean;
  _homePowerV?: number;
  _awayPowerV?: number;
  _firstHalfStartComment?: boolean;
  _secondHalfStartComment?: boolean;
  _extraTimeStartComment?: boolean;
  _finalEndComment?: boolean;
  _bettingIntroShown?: boolean;
  _fatigue3Applied?: boolean;
  _winnerId?: number;
  [key: string]: unknown;
}

export interface PlayerSession {
  name: string;
  teamId: number | null;
  roomCode: string;
  ready: boolean;
  tactic: Tactic;
  socketId: string | null;
  [key: string]: any;
}

/**
 * Evento do mercado de treinadores (despedimento / contratação) recolhido após
 * cada jornada para o modal semanal "Mercado de Treinadores".
 */
export interface CoachMarketEvent {
  type: "dismissal" | "hiring";
  coachName: string;
  teamName: string;
  division: number;
  reason?: "results" | "budget" | "relegation";
  detail?: string;
  isHuman: boolean;
  colorPrimary?: string;
  colorSecondary?: string;
}

/**
 * Single unified state machine replacing the old matchState + cupState dual machines.
 * Transitions are always linear: no concurrent league+cup activity.
 */
export type GamePhase =
  | "lobby" // Between events: tactics, transfers, squad review
  | "match_first_half" // Engine running 1-45 (league OR cup)
  | "match_halftime" // Waiting: all humans confirm Ready
  | "match_second_half" // Engine running 46-90
  | "match_et_gate" // Cup only: waiting for coaches before extra time
  | "match_extra_time" // Cup only: ET simulation running (91-120)
  | "match_finalizing" // Post-match processing (brief, blocking)
  | "season_end"; // Season wrap-up: promotions, relegations

export interface ActiveGame {
  roomCode: string;
  db: any;
  playersByName: Record<string, PlayerSession>;
  socketToName: Record<string, string>;
  // Membros persistentes da sala (espelho de room_managers). Fonte da verdade
  // para a lista de offline — playersByName é apenas in-memory e só contém
  // coaches que já ligaram desde o último load do jogo.
  roomMembers: Set<string>;

  // ── Single calendar cursor (replaces matchweek + cupRound as progress trackers) ──
  calendarIndex: number; // 0..18 within the season (index into SEASON_CALENDAR)
  season: number;
  year: number;
  matchweek: number; // convenience field: updated at end of each league event

  // ── Single state machine (replaces matchState + cupState) ──
  gamePhase: GamePhase;

  // ── Current event runtime ──
  currentEvent: any | null; // CalendarEntry | null — what we're playing RIGHT NOW
  currentFixtures: any[]; // active fixture objects (league or cup)

  // ── Single phase timer + ack set (replaces 5 separate timeouts + ack sets) ──
  phaseToken: string;
  phaseTimer: ReturnType<typeof setTimeout> | null;
  phaseAcks: Set<string>;

  // ── Cup runtime payloads ──
  cupTeamIds: number[];
  cupHalftimePayload: unknown | null;
  cupDrawSeenBy: Set<string>; // coachNames que já viram o sorteio do round actual

  // ── Room owner ──
  roomCreator: string; // nome do coach que criou a sala (badge Admin + poder de kick)

  // ── Retained fields ──
  lockedCoaches: Set<string>;
  globalMarket: any[];
  auctions: Record<string, unknown>;
  auctionTimers: Record<string, unknown>;
  pendingAuctionQueue: unknown[];
  pendingAuctionQueueTimers: ReturnType<typeof setTimeout>[];
  initialized: boolean;
  lastHalftimePayload?: any;
  // Ações de jogo pendentes por actionId (penáltis, lesões, subs, GR).
  // É um Map e não um slot único: vários jogos com humanos na mesma sala
  // podem ter janelas abertas em simultâneo — com slot único, a segunda
  // ação expulsava a primeira e o timer órfão resolvia-a tarde com fallback.
  pendingMatchActions?: Map<string, any>;
  pendingSubstitutions?: Set<number>;

  // ── Fixture seeds por divisão (ordem aleatória no início de cada época) ──
  fixtureSeeds: Record<number, number[]>; // div → [teamId, ...] ordenado por seed

  // ── Memória táctica por equipa (estrelas por jogo; persistida em game_state) ──
  tacticFamiliarity: Record<number, { history: string[] }>;

  // ── Histórico de resultados de todas as jornadas ──
  allMatchResults: Record<number, any[]>; // matchweek → [{homeTeamId, awayTeamId, homeGoals, awayGoals, ...}, ...]

  // ── Coach dismissal & job offers ──
  pendingJobOffers: Record<string, { fromTeamId: number; toTeamId: number }>;
  negativeBudgetStreak: Record<number, number>; // teamId → semanas consecutivas com budget < 0
  boardBudgetWarned: Record<number, number>; // teamId → nível de aviso da direcção já enviado (1 ou 3)
  coachMatchesManaged: Record<string, number>; // coachName → jogos dirigidos no clube atual (carência antes de despedimento)
  npcMatchesManaged: Record<number, number>; // teamId → jogos do treinador NPC atual (carência antes de despedimento)
  dismissedCoachSince: Record<
    string,
    {
      matchweek: number;
      division: number;
      reason?: "results" | "budget" | "relegation";
      teamName?: string;
      detail?: string;
    }
  >; // coachName → info de despedimento
  dismissalsThisSeason: Set<string>; // coaches despedidos na época actual (máx 1 por época)

  // ── Coaches expulso da sala pelo Admin (ban permanente, persistido) ──
  kickedCoaches: Set<string>; // coachName → expulso definitivamente da sala

  // ── Resumo semanal do mercado de treinadores (transiente, limpo após emissão) ──
  coachMarketEvents: CoachMarketEvent[];

  [key: string]: any;
}
