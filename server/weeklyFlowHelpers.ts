import type { ActiveGame, PlayerSession, Tactic } from "./types";
import {
  maybeNotifyLastMissing,
  maybeNotifyMatchday,
  maybeNotifyWaiting,
} from "./push";
import type { CalendarEntry } from "./gameConstants";
import { CUP_FINAL_ROUND } from "./gameConstants";
import { SPONSOR_SECOND_TRANCHE_SLOT, sponsorById, drawNpcChoice, drawOffersAny } from "./game/sponsors";
import {
  emitCmNews,
  readCmLeaders,
  diffCmLeaders,
  cmLeaderText,
  pickCmGoleada,
  cmGoleadaText,
} from "./cmNews";
import { ensureNpcStaff, fetchStaffSalaryTotals } from "./staffHelpers";
import { logProgressNews } from "./progressNewsHelpers";
import { leagueMatchRowWrites } from "./matchSummaryHelpers";
import {
  SEASON_CALENDAR,
  DIVISION_NAMES,
  LOAN_INSTALLMENT_BY_DIVISION,
  loanInstallment,
  STADIUM_UPKEEP_PER_SEAT_WEEK,
  STADIUM_UPKEEP_EXEMPT_SEATS,
  AWAY_TICKET_SHARE,
  WEEKLY_BASE_INCOME,
  CUP_FINAL_SPECTATOR_MS_PER_MINUTE,
  DEFAULT_MS_PER_MINUTE,
  remainingSubstitutions,
  incrementSubCount,
  slotForLeagueMatchweek,
  FRIENDLY_ROUND,
} from "./gameConstants";

/**
 * Prestação do empréstimo por divisão dentro do SQL (números nossos,
 * sem input de utilizador — interpolar é seguro e evita 10 parâmetros).
 */
const LOAN_DIV_CASE = `CASE division ${[1, 2, 3, 4]
  .map((d) => `WHEN ${d} THEN ${LOAN_INSTALLMENT_BY_DIVISION[d]}`)
  .join(" ")} ELSE ${LOAN_INSTALLMENT_BY_DIVISION[5]} END`;

/** Promisificados mínimos sobre a API callback do sqlite (mesma conexão
 *  serializada — `await` preserva a ordem exata das cadeias por callbacks). */
function dbGet(db: any, sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err: any, row: any) =>
      err ? reject(err) : resolve(row),
    );
  });
}
function dbAll(db: any, sql: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err: any, rows: any[]) =>
      err ? reject(err) : resolve(rows || []),
    );
  });
}
function dbRun(db: any, sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err: any) => (err ? reject(err) : resolve()));
  });
}

/** Pontos e V/E/D de um marcador (casa e fora). */
function pointsForScore(
  hG: number,
  aG: number,
): {
  hPts: number;
  hW: number;
  hD: number;
  hL: number;
  aPts: number;
  aW: number;
  aD: number;
  aL: number;
} {
  if (hG > aG)
    return { hPts: 3, hW: 1, hD: 0, hL: 0, aPts: 0, aW: 0, aD: 0, aL: 1 };
  if (hG < aG)
    return { hPts: 0, hW: 0, hD: 0, hL: 1, aPts: 3, aW: 1, aD: 0, aL: 0 };
  return { hPts: 1, hW: 0, hD: 1, hL: 0, aPts: 1, aW: 0, aD: 1, aL: 0 };
}

/** Payload de fim de jogo: bilheteira por equipa + MOM + árbitro. */
function buildFullTimeFixtures(
  game: ActiveGame,
  fixtures: any[],
  completedMatchweek: number,
  pickRefereeSummary: (
    roomCode: string,
    teamId: number,
    opponentId: number,
    matchweek: number,
  ) => { name: string },
): any[] {
  return fixtures.map((fixture) => {
    const total =
      (fixture.attendance || 0) * ((fixture as any)._ticketPrice || 15);
    const awayTicketRevenue = Math.floor(total * AWAY_TICKET_SHARE);
    return {
      ...fixture,
      homeTicketRevenue: total - awayTicketRevenue,
      awayTicketRevenue,
      mom: computeMoms(
        fixture.events || [],
        fixture.homeLineup || [],
        fixture.awayLineup || [],
      ),
      referee: pickRefereeSummary(
        game.roomCode,
        fixture.homeTeamId,
        fixture.awayTeamId,
        completedMatchweek,
      ),
    };
  });
}

/**
 * Factos do resumo financeiro semanal (1 notícia por equipa com treinador
 * humano), em JSON `v: 1` na coluna `description` — o padrão das notícias
 * da Taça/classificação final. `oldLoan` é a dívida ANTES da semana; os
 * restantes valores são idênticos aos do UPDATE de despesas (mesmas
 * fórmulas do SQL). `staff` é o salário semanal dos funcionários do clube
 * (linha própria). O cliente renderiza o parágrafo + tabela; notícias
 * antigas (texto corrido) caem no fallback em `inboxItems`.
 */
export function buildWeeklyFinanceFacts(p: {
  income: number;
  wages: number;
  upkeep: number;
  staff?: number;
  sponsor?: number;
  interest: number;
  installment: number;
  oldLoan: number;
}): string {
  const hasLoan = p.oldLoan > 0;
  const staff = p.staff || 0;
  const sponsor = p.sponsor || 0;
  const net =
    p.income +
    sponsor -
    p.wages -
    p.upkeep -
    staff -
    (hasLoan ? p.interest + p.installment : 0);
  return JSON.stringify({
    v: 1,
    income: p.income,
    wages: p.wages,
    upkeep: p.upkeep,
    staff,
    sponsor,
    interest: hasLoan ? p.interest : 0,
    installment: hasLoan ? p.installment : 0,
    net,
    hasLoan,
    loanPaidOff: hasLoan && p.installment >= p.oldLoan,
  });
}
import {
  currentSlot,
  fetchTopScorers,
  getAllTeamForms,
  getStandingsRows,
  getTeamsWithCoachNames,
  logClubNews,
  logClubNewsOnce,
  runRoomTask,
  slimMatchResult,
  snapshotBalanceHistory,
} from "./coreHelpers";
import {
  pauseAllRunningAuctions,
  clearPhaseTimer,
} from "./matchFlowHelpers";
import {
  withJuniorGRs,
  ensureFullBench,
  generateIntroEvents,
  generateSecondHalfIntroEvents,
  buildLineupSnapshot,
  getMatchFatigueSnapshot,
  queueMatchDeltaWrites,
  createMinuteBarrier,
} from "./game/engine";
import { generateAITactic } from "./game/matchCalculations";
import { halftimeSubPhrase } from "./game/commentary";
import { loadSquadRatings } from "./game/oddsSquad";
import { computeMoms } from "./game/mom";
import {
  appendRoomEvent,
  clearMatchCheckpoint,
  clearSeatPositions,
  computeAbsentees,
  hasHumanTeamInFixtures,
  isSeatPresent,
  resetAllReady,
  logCalendarAdvance,
  requiredTeamIds,
  waitForPresence,
} from "./roomStateHelpers";

const MAX_NPC_HALFTIME_SUBS = 2;
const NPC_FRESHNESS_SKILL_BUFFER = 2;

// Rede anti-cala da finalização: se o finalize (liga/taça/amigável) não
// concluir — promise pendente, callback perdido — a sala nunca fica presa
// em silêncio em match_finalizing. O normal conclui em segundos; o
// temporizador dispara só no patológico: log alto + lobby + segmento livre.
// unref para não prender a saída de scripts/testes que corram o segmento.
const FINALIZE_WATCHDOG_MS = 5 * 60 * 1000;

// NPCs use the fatigue accumulated by the actual cached XI, rather
// than the permanent DB skill used by generateAITactic. They only
// replace a tired outfield player when a same-position bench player
// is close enough to that player's current match skill for freshness
// to make up the difference.
function planNpcHalftimeSubs(
  fixture: any,
  squad: any[] | undefined,
  tactic: any,
  fullRoster: any[] | undefined,
  teamSide: "home" | "away",
): void {
  if (!squad || !tactic?.positions || !fullRoster) return;

  const positions: Record<number, string> = tactic.positions;
  const currentIds = new Set(squad.map((p: any) => p.id));
  const unavailableIds = new Set(
    (fixture.events || [])
      .filter(
        (e: any) =>
          (e.type === "injury" || e.type === "red") &&
          e.team === teamSide &&
          e.playerId,
      )
      .map((e: any) => e.playerId),
  );
  const bench = fullRoster.filter(
    (p: any) =>
      !currentIds.has(p.id) &&
      positions[p.id] === "Suplente" &&
      !unavailableIds.has(p.id),
  );

  const tiredPlayers = squad
    .filter(
      (p: any) => p.position !== "GR" && positions[p.id] !== "Suplente",
    )
    .map((player: any) => ({
      player,
      fatigue: getMatchFatigueSnapshot(fixture, teamSide, player.id),
    }))
    .filter(
      ({ fatigue }) => fatigue.matchMinutes >= 45 && fatigue.fatigueLoss >= 2,
    )
    .sort(
      (a, b) =>
        b.fatigue.fatigueLoss - a.fatigue.fatigueLoss ||
        b.fatigue.matchMinutes - a.fatigue.matchMinutes,
    );

  const usedBenchIds = new Set<number>();
  let planned = 0;
  for (const { player: outgoing } of tiredPlayers) {
    if (planned >= MAX_NPC_HALFTIME_SUBS) break;

    const replacement = bench
      .filter(
        (p: any) =>
          !usedBenchIds.has(p.id) &&
          p.position === outgoing.position &&
          Number(p.skill || 0) + NPC_FRESHNESS_SKILL_BUFFER >=
            Number(outgoing.skill || 0),
      )
      .sort((a: any, b: any) => (b.skill || 0) - (a.skill || 0))[0];

    if (!replacement) continue;

    positions[outgoing.id] = "Suplente";
    positions[replacement.id] = "Titular";
    usedBenchIds.add(replacement.id);
    planned += 1;
  }
}

function applyHalftimeSubs(
  fixture: any,
  squad: any[] | undefined,
  tactic: any,
  fullRoster: any[] | undefined,
  teamSide: "home" | "away",
): void {
  if (!squad || !tactic?.positions || !fullRoster) return;
  const positions: Record<number, string> = tactic.positions;
  const currentIds = new Set(squad.map((p: any) => p.id));

  // Players in the current squad who are now marked as Suplente (subbed out at halftime)
  const toRemoveIds = squad
    .filter((p: any) => positions[p.id] === "Suplente")
    .map((p: any) => p.id);

  // Players not in squad who are now marked as Titular (subbed in at halftime)
  let toAddIds = Object.entries(positions)
    .filter(
      ([id, status]) => status === "Titular" && !currentIds.has(Number(id)),
    )
    .map(([id]) => Number(id));

  // Filter out injured and red-carded players from incoming substitutions
  const injuredIds = new Set(
    (fixture.events || [])
      .filter(
        (e: any) =>
          (e.type === "injury" || e.type === "red") && e.team === teamSide && e.playerId,
      )
      .map((e: any) => e.playerId),
  );
  toAddIds = toAddIds.filter((id) => !injuredIds.has(id));

  // Quem já foi substituído no 1.º tempo não volta (espelho de
  // applyETSubs) — mesmo que um payload stale o volte a marcar
  // "Titular" na tática.
  const subbedOut = fixture._subbedOut as Set<number> | undefined;
  if (subbedOut) toAddIds = toAddIds.filter((id) => !subbedOut.has(id));

  if (toRemoveIds.length === 0 && toAddIds.length === 0) return;

  // Limitado ao número de substituições ainda possíveis na partida.
  // Cada "saída + entrada" conta como uma substituição e esgota o limite
  // por equipa (MAX_SUBSTITUTIONS), que inclui intervalos e alongamentos.
  const teamId =
    teamSide === "home" ? fixture.homeTeamId : fixture.awayTeamId;
  const maxPairs = Math.min(
    toRemoveIds.length,
    toAddIds.length,
    remainingSubstitutions(fixture, teamId),
  );
  if (maxPairs <= 0) return;

  // Limitar às substituições ainda permitidas (ordem de declaração).
  const limitedOutIds = toRemoveIds.slice(0, maxPairs);
  const limitedInIds = toAddIds.slice(0, maxPairs);

  // Snapshot outgoing/incoming players BEFORE modifying the squad
  const outPlayers = limitedOutIds
    .map((id: number) => squad.find((p: any) => p.id === id))
    .filter(Boolean);
  const inPlayers = limitedInIds
    .map((id: number) => fullRoster.find((p: any) => p.id === id))
    .filter(Boolean);

  // Remove subbed-out players
  for (const id of limitedOutIds) {
    const idx = squad.findIndex((p: any) => p.id === id);
    if (idx > -1) squad.splice(idx, 1);
    (fixture._subbedOut ??= new Set<number>()).add(id);
  }

  // Add subbed-in players from the full roster
  for (const player of inPlayers) {
    squad.push(player);
  }

  // Cada substituição feita conta para o limite de substituições da partida.
  for (let i = 0; i < maxPairs; i++) {
    incrementSubCount(fixture, teamId);
  }

  // Update the lineup snapshot to reflect the new squad composition
  if (teamSide === "home") {
    fixture.homeLineup = buildLineupSnapshot(
      fixture,
      squad,
      tactic,
      fixture._homeFullRoster,
      "home",
    );
  } else {
    fixture.awayLineup = buildLineupSnapshot(
      fixture,
      squad,
      tactic,
      fixture._awayFullRoster,
      "away",
    );
  }

  // Emit halftime_sub events so the client lineup display reflects the changes
  const remainingInPlayers = [...inPlayers];
  for (const outPlayer of outPlayers) {
    const matchingIndex = remainingInPlayers.findIndex(
      (inPlayer: any) => inPlayer.position === outPlayer.position,
    );
    const inPlayer =
      matchingIndex >= 0
        ? remainingInPlayers.splice(matchingIndex, 1)[0]
        : remainingInPlayers.shift();
    if (!inPlayer) break;

    const phrase = halftimeSubPhrase(outPlayer.name, inPlayer.name);
    fixture.events = fixture.events || [];
    fixture.events.push({
      minute: 45,
      type: "halftime_sub",
      team: teamSide,
      emoji: "🔁",
      outPlayerId: outPlayer.id,
      outPlayerName: outPlayer.name,
      playerId: inPlayer.id,
      playerName: inPlayer.name,
      position: inPlayer.position,
      text: `[HT] 🔁 ${phrase}`,
    });
  }
}

interface WeeklyFlowDeps {
  io: any;
  getPlayerList: (game: ActiveGame) => PlayerSession[];
  emitPresence: (game: ActiveGame) => void;
  generateFixturesForDivision: (
    db: any,
    division: number,
    matchweek: number,
    seeds: number[],
  ) => Promise<any[]>;
  pauseAllRunningAuctions: (game: ActiveGame, io: any) => void;
  resumeAllPausedAuctions: (game: ActiveGame) => void;
  simulateMatchSegment: (...args: any[]) => Promise<void>;
  calculateMatchAttendance: (
    db: any,
    homeTeamId: number,
    opponentTeamId?: number,
    ctx?: { competition?: "league" | "cup"; cupRound?: number; season?: number; matchweek?: number },
  ) => Promise<number>;
  explainAttendance: (
    db: any,
    homeTeamId: number,
    opponentTeamId?: number,
    ctx?: { competition?: "league" | "cup"; cupRound?: number; season?: number; matchweek?: number },
  ) => Promise<{ attendance: number; occupancy: number; capacity: number; ticketPrice: number; reasons: string[] }>;
  pickRefereeSummary: (
    roomCode: string,
    teamId: number,
    opponentId: number,
    matchweek: number,
  ) => { name: string };
  saveGameState: (game: ActiveGame) => void;
  persistMatchResults: (
    game: ActiveGame,
    fixtures: any[],
    matchweek: number,
    onDone?: () => void,
  ) => void;
  applyPostMatchQualityEvolution: (
    db: any,
    fixtures: any[],
    currentMatchweek: number,
    season: number,
    calendarIndex?: number,
  ) => Promise<void>;
  applyTrainingBonuses: (
    game: ActiveGame,
    fixtures: any[],
    completedCalendarIndex: number,
  ) => Promise<void>;
  prepareFriendlyFixtures: (game: ActiveGame) => Promise<void>;
  finalizeFriendly: (game: ActiveGame) => Promise<void>;
  startCupRound: (game: ActiveGame, round: number) => Promise<void>;
  finalizeCupRound: (game: ActiveGame) => Promise<void>;
  continueFromEtGate: (game: ActiveGame) => Promise<void>;
  applySeasonEnd: (game: ActiveGame) => Promise<void>;
  listPlayerOnMarket: (
    game: ActiveGame,
    playerId: number,
    mode: string,
    price: number,
    callback?: (...args: any[]) => void,
  ) => void;
  processContractExpiries: (
    game: ActiveGame,
    usedProposals: Set<number>,
  ) => Promise<void>;
  processAgentRenegotiations: (
    game: ActiveGame,
    usedProposals: Set<number>,
  ) => Promise<void>;
  resendPendingContractRequests: (game: ActiveGame) => Promise<void>;
  processNpcAgentPressure: (game: ActiveGame) => Promise<void>;
  processNpcInvestment: (game: ActiveGame) => Promise<void>;
  processNpcTransferActivity: (game: ActiveGame) => Promise<void>;
  refreshMarket: (game: ActiveGame, emitToRoom?: boolean) => void;
  processCoachEvents: (game: ActiveGame) => Promise<void>;
}

export function createWeeklyFlowHelpers(deps: WeeklyFlowDeps) {
  const {
    io,
    getPlayerList,
    emitPresence,
    generateFixturesForDivision,
    pauseAllRunningAuctions,
    resumeAllPausedAuctions,
    simulateMatchSegment,
    calculateMatchAttendance,
    explainAttendance,
    pickRefereeSummary,
    saveGameState,
    persistMatchResults,
    applyPostMatchQualityEvolution,
    applyTrainingBonuses,
    prepareFriendlyFixtures,
    finalizeFriendly,
    startCupRound,
    finalizeCupRound,
    continueFromEtGate,
    applySeasonEnd,
    listPlayerOnMarket,
    processContractExpiries,
    processAgentRenegotiations,
    resendPendingContractRequests,
    processNpcAgentPressure,
    processNpcInvestment,
    processNpcTransferActivity,
    refreshMarket,
    processCoachEvents,
  } = deps;

  // Guard against concurrent match segment execution
  const segmentRunning: Record<string, boolean> = {};

  // Initialize fixture seeds for the given divisions if not yet set.
  // Seeds are normally generated at season end; this handles epoch 1 and any
  // gap where seeds were never persisted, as well as stale seeds from a
  // mid-rollover crash (teams mudaram de divisão mas os seeds antigos ficaram).
  async function ensureFixtureSeeds(
    game: ActiveGame,
    divs: number[],
  ): Promise<void> {
    let changed = false;
    for (const div of divs) {
      // Query current teams in this division from DB (source of truth)
      const rows = await new Promise<Array<{ id: number }>>((resolve) => {
        game.db.all(
          "SELECT id FROM teams WHERE division = ? ORDER BY id",
          [div],
          (err: any, rows: Array<{ id: number }>) => {
            if (err || !rows) return resolve([]);
            resolve(rows);
          },
        );
      });
      if (rows.length < 2) continue;

      const dbIds = rows.map((r) => r.id);
      const seedIds = game.fixtureSeeds[div] || [];
      const dbSet = new Set(dbIds);

      // Validate: seeds must contain exactly the same teams as the DB
      const seedsMatch =
        seedIds.length === dbIds.length &&
        seedIds.every((id) => dbSet.has(id));

      if (seedsMatch) continue;

      // Regenerate: Fisher-Yates shuffle for unpredictability (mirrors applySeasonEnd)
      const shuffled = [...dbIds];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      game.fixtureSeeds[div] = shuffled;
      changed = true;
    }
    if (changed) {
      console.log(
        `[${game.roomCode}] 🎲 fixtureSeeds regenerados (validação):`,
        Object.entries(game.fixtureSeeds)
          .map(([d, ids]) => `div${d}=${(ids as number[]).length}eq`)
          .join(", "),
      );
      saveGameState(game);
    }
  }

  // Gera fixtures de liga para uma jornada e guarda em game.currentFixtures,
  // enriquecidas com os nomes das equipas. Fonte ÚNICA de verdade para o
  // briefing (nextMatchSummary) e para o jogo real — assim o casa/fora visto
  // no briefing é sempre exatamente o que vai ser jogado.
  async function prepareLeagueFixtures(
    game: ActiveGame,
    matchweek: number,
  ): Promise<void> {
    await ensureFixtureSeeds(game, [1, 2, 3, 4]);
    const seeds = game.fixtureSeeds;
    console.log(
      `[${game.roomCode}] ⚽ Generating league fixtures for mw=${matchweek}`,
    );
    const [f1, f2, f3, f4] = await Promise.all([
      generateFixturesForDivision(game.db, 1, matchweek, seeds[1] ?? []),
      generateFixturesForDivision(game.db, 2, matchweek, seeds[2] ?? []),
      generateFixturesForDivision(game.db, 3, matchweek, seeds[3] ?? []),
      generateFixturesForDivision(game.db, 4, matchweek, seeds[4] ?? []),
    ]);
    const fixtures = [...f1, ...f2, ...f3, ...f4];
    console.log(
      `[${game.roomCode}] ⚽ Generated ${fixtures.length} league fixtures`,
    );

    // Enriquecer fixtures com nomes das equipas para narração de táticas
    const allTeamIds = new Set<number>();
    for (const f of fixtures) {
      allTeamIds.add(f.homeTeamId);
      allTeamIds.add(f.awayTeamId);
    }
    const teamRows = await new Promise<Array<{ id: number; name: string }>>(
      (resolve) => {
        game.db.all(
          "SELECT id, name FROM teams WHERE id IN (" +
            Array.from(allTeamIds)
              .map(() => "?")
              .join(",") +
            ")",
          [...allTeamIds],
          (err: any, rows: Array<{ id: number; name: string }>) => {
            resolve(rows || []);
          },
        );
      },
    );
    const teamMap = new Map(
      teamRows.map((t) => [t.id, t.name] as [number, string]),
    );
    for (const f of fixtures) {
      const homeName = teamMap.get(f.homeTeamId);
      const awayName = teamMap.get(f.awayTeamId);
      if (homeName) f.homeTeam = { id: f.homeTeamId, name: homeName };
      if (awayName) f.awayTeam = { id: f.awayTeamId, name: awayName };
    }
    game.currentFixtures = fixtures;
  }

  // ─── UNIFIED MATCH SEGMENT RUNNER ───────────────────────────────────────────
  // Handles both league and cup first/second halves.
  // Uses game.currentFixtures populated by the caller.

  const MS_PER_GAME_MINUTE = DEFAULT_MS_PER_MINUTE;

  async function runMatchSegment(
    game: ActiveGame,
    startMin: number,
    endMin: number,
  ): Promise<void> {
    // Prevent re-running the same segment
    const segmentKey = `${startMin}-${endMin}`;
    if (game._lastCompletedSegment === segmentKey) {
      console.warn(
        `[${game.roomCode}] Skipping already-completed segment ${segmentKey}`,
      );
      return;
    }

    console.log(
      `[${game.roomCode}] ▶ runMatchSegment ${startMin}-${endMin} | phase=${game.gamePhase} | fixtures=${game.currentFixtures.length}`,
    );

    const entry = game.currentEvent as CalendarEntry | null;

    // Calculate attendance only for league first halves
    if (startMin === 1 && entry?.type != null) {
      const attCtx = {
        competition: (entry?.type === "friendly" ? "cup" : (entry?.type ?? "league")) as "league" | "cup",
        cupRound:
          entry?.type === "league"
            ? undefined
            : ((game.currentFixtures[0] as any)?.round ?? (entry as any)?.round),
        season: game.season || 1,
        matchweek: game.matchweek || 1,
      };
      for (const fixture of game.currentFixtures) {
        const breakdown = await explainAttendance(
          game.db,
          fixture.homeTeamId,
          fixture.awayTeamId,
          attCtx,
        );
        fixture.attendance = breakdown.attendance;
        // Ambiente e preço vivos na fixture: o motor lê a ocupação para o
        // bónus casa e a finalização usa o preço real na bilheteira.
        (fixture as any)._occupancy = breakdown.occupancy;
        (fixture as any)._ticketPrice = breakdown.ticketPrice;
      }
    }

    // Novo jogo: limpar pedidos de substituição pendentes que possam ter sido
    // engolidos no apito final do jogo anterior (evita janelas fantasma)
    if (startMin === 1) {
      game.pendingSubstitutions?.clear();
    }

    // Read tactics for all fixtures once at segment start
    const fixtureTactics: Array<{ t1: Tactic | null; t2: Tactic | null }> =
      await Promise.all(
      game.currentFixtures.map(async (fixture) => {
        const p1 = Object.values(game.playersByName).find(
          (p) => p.teamId === fixture.homeTeamId,
        );
        const p2 = Object.values(game.playersByName).find(
          (p) => p.teamId === fixture.awayTeamId,
        );
        let t1 = p1 ? p1.tactic : fixture._t1;
        let t2 = p2 ? p2.tactic : fixture._t2;
        if (!t1) {
          t1 = await generateAITactic(
            game.db,
            fixture.homeTeamId,
            fixture.awayTeamId,
            (game.calendarIndex ?? 0) + 1,
          );
        }
        if (!t2) {
          t2 = await generateAITactic(
            game.db,
            fixture.awayTeamId,
            fixture.homeTeamId,
            (game.calendarIndex ?? 0) + 1,
          );
        }
        // Fotografia da 1.ª parte para a memória táctica (50/50): no arranque
        // da 2.ª parte, fixture._t1/_t2 ainda trazem o fim da 1.ª parte (com a
        // adoção live incluída) antes de serem relidos com as escolhas do intervalo.
        if (startMin === 46) {
          if (fixture._t1?.formation) {
            (fixture as any)._firstHalfT1 = {
              formation: fixture._t1.formation,
              style: fixture._t1.style,
            };
          }
          if (fixture._t2?.formation) {
            (fixture as any)._firstHalfT2 = {
              formation: fixture._t2.formation,
              style: fixture._t2.style,
            };
          }
        }
        fixture._t1 = t1;
        fixture._t2 = t2;
        return { t1, t2 };
      }),
    );

    // Detect if any connected human has a team in the current fixtures
    const humanInFixtures = game.currentFixtures.some((f) =>
      Object.values(game.playersByName).some(
        (p: any) =>
          p.socketId &&
          (p.teamId === f.homeTeamId || p.teamId === f.awayTeamId),
      ),
    );
    const effectiveMsPerMinute = humanInFixtures
      ? (game.msPerMinute ?? MS_PER_GAME_MINUTE)
      : entry?.type === "cup" && (entry as any)?.roundName === "Final"
        ? CUP_FINAL_SPECTATOR_MS_PER_MINUTE
        : 100;

    // At the start of the second half, apply halftime tactic changes (substitutions/style)
    // to the cached squads. fixture._homeSquad/_awaySquad were set during the first half and
    // won't reflect tactic position changes made during the interval otherwise.
    // Snapshot via buildLineupSnapshot (implementação única no engine).

    // At the start of the second half, apply halftime tactic changes (substitutions/style)
    if (startMin === 46) {
      try {
        for (let fi = 0; fi < game.currentFixtures.length; fi++) {
          const fixture = game.currentFixtures[fi];
          const { t1, t2 } = fixtureTactics[fi];

          const hasCoachForTeam = (teamId: number) =>
            Object.values(game.playersByName).some(
              (p: any) => Number(p.teamId) === Number(teamId),
            );

          if (!hasCoachForTeam(fixture.homeTeamId)) {
            planNpcHalftimeSubs(
              fixture,
              fixture._homeSquad,
              t1,
              fixture._homeFullRoster,
              "home",
            );
            fixture._t1 = t1;
          }
          if (!hasCoachForTeam(fixture.awayTeamId)) {
            planNpcHalftimeSubs(
              fixture,
              fixture._awaySquad,
              t2,
              fixture._awayFullRoster,
              "away",
            );
            fixture._t2 = t2;
          }

          applyHalftimeSubs(
            fixture,
            fixture._homeSquad,
            t1,
            fixture._homeFullRoster,
            "home",
          );
          applyHalftimeSubs(
            fixture,
            fixture._awaySquad,
            t2,
            fixture._awayFullRoster,
            "away",
          );
        }
      } catch (err) {
        console.error(
          `[${game.roomCode}] Error applying halftime substitutions:`,
          err,
        );
      }
    }

    // Pré-gerar eventos de introdução (weather + táctica + apostas) do minuto 1
    // para que cheguem ao cliente no payload do matchSegmentStart e sejam visíveis
    // durante a pausa de 5s. A engine ignora-os no loop graças às guards
    // _weather/_firstHalfStartComment/_bettingIntroShown.
    if (startMin === 1) {
      // Build a standings-position lookup for every team in every division,
      // so the betting intro can compute odds from table position. Uses the
      // same getStandingsRows ranking as nextMatchSummary → odds iguais no
      // TacticsView e durante o jogo. Uma query cobre todas as equipas.
      const allTeams = await new Promise<
        Array<{
          id: number;
          division: number;
          name: string;
          points: number;
          goals_for: number;
          goals_against: number;
        }>
      >((resolve) => {
        game.db.all(
          "SELECT id, division, name, points, goals_for, goals_against FROM teams",
          (err: any, rows: any[]) => {
            if (err || !rows) return resolve([]);
            resolve(rows);
          },
        );
      });
      const squadByTeamId = await loadSquadRatings(game.db);
      const positionByTeamId = new Map<number, number>();
      const divisionByTeamId = new Map<number, number>();
      const byDivision = new Map<number, any[]>();
      for (const t of allTeams) {
        divisionByTeamId.set(t.id, t.division);
        const list = byDivision.get(t.division) || [];
        list.push(t);
        byDivision.set(t.division, list);
      }
      for (const rows of byDivision.values()) {
        const ranked = getStandingsRows(rows);
        ranked.forEach((team, index) => {
          positionByTeamId.set(team.id, index + 1);
        });
      }

      for (let fi = 0; fi < game.currentFixtures.length; fi++) {
        const fixture = game.currentFixtures[fi];
        // Estampar season/matchweek para a engine gerar o mesmo tempo que a previsão
        fixture.season = game.season;
        fixture.matchweek = game.matchweek;
        // Stamp standings position + division onto homeTeam/awayTeam for odds
        if (fixture.homeTeam) {
          (fixture.homeTeam as any).division =
            divisionByTeamId.get(fixture.homeTeamId) ?? 4;
          (fixture.homeTeam as any).position =
            positionByTeamId.get(fixture.homeTeamId) ?? null;
          (fixture.homeTeam as any).squad =
            squadByTeamId.get(fixture.homeTeamId) ?? null;
        }
        if (fixture.awayTeam) {
          (fixture.awayTeam as any).division =
            divisionByTeamId.get(fixture.awayTeamId) ?? 4;
          (fixture.awayTeam as any).position =
            positionByTeamId.get(fixture.awayTeamId) ?? null;
          (fixture.awayTeam as any).squad =
            squadByTeamId.get(fixture.awayTeamId) ?? null;
        }
        const { t1, t2 } = fixtureTactics[fi];
        generateIntroEvents(fixture, t1, t2);
      }
    }

    // Pré-gerar comentário táctico do minuto 46 para que chegue ao cliente
    // no payload do matchSegmentStart e seja visível durante a pausa de 5s.
    // A guard na engine (!fixture._secondHalfStartComment) evita duplicação.
    if (startMin === 46) {
      for (let fi = 0; fi < game.currentFixtures.length; fi++) {
        const fixture = game.currentFixtures[fi];
        const { t1, t2 } = fixtureTactics[fi];
        generateSecondHalfIntroEvents(fixture, t1, t2);
      }
    }

    // Emit match segment start so the client can show the match UI immediately
    io.to(game.roomCode).emit("matchSegmentStart", {
      startMin,
      endMin,
      matchweek: game.matchweek,
      isCup: entry?.type !== "league",
      cupRound: entry?.type !== "league" ? ((entry as any).round ?? null) : null,
      cupRoundName: entry?.type !== "league" ? ((entry as any).roundName ?? null) : null,
      fixtures: game.currentFixtures.map((f) => ({
        homeTeamId: f.homeTeamId,
        awayTeamId: f.awayTeamId,
        homeTeam: f.homeTeam || null,
        awayTeam: f.awayTeam || null,
        finalHomeGoals: f.finalHomeGoals || 0,
        finalAwayGoals: f.finalAwayGoals || 0,
        events: f.events || [],
        attendance: f.attendance || null,
        homeLineup: f.homeLineup || [],
        awayLineup: f.awayLineup || [],
      })),
    });

    // Pausa de introdução: dá tempo ao cliente para mostrar o relógio em repouso
    // antes de os eventos do minuto 1/46/91 chegarem. Só quando há humanos na partida.
    if (humanInFixtures) {
      // Arranque do jogo respira mais: o cliente mostra a análise pré-jogo.
      await new Promise((r) => setTimeout(r, startMin === 1 ? 7000 : 2000));
    }

    // ── Segmento inteiro de uma vez por fixture (audit #1) ───────────────
    // Antes: simulateMatchSegment(minute, minute) 90× por jogo, pagando setup
    // (plantéis, moral, rosters, snapshots) a cada minuto. Agora: uma chamada
    // startMin–endMin por fixture, em paralelo; a barreira rendezvous a cada
    // minuto para o direto continuar sincronizado (um emit + um sleep por
    // minuto, como antes). Janelas de substituição continuam a bloquear
    // dentro do loop de minutos — a espera partilhada mantém-se.
    const barrier = createMinuteBarrier(
      game.currentFixtures.length,
      async (minute) => {
        // Congelamento: enquanto faltar um treinador com equipa em jogo, a
        // sala não anda um minuto sequer. Espera aqui (rendezvous de todos os
        // jogos) e retoma exatamente neste minuto quando ele voltar.
        maybeNotifyWaiting(game);
        await waitForPresence(game, io);
        // Sala apagada a meio do jogo: abortar a barreira. Sem isto o
        // `return` nu saltava o sleep e os minutos corriam fantasma até
        // ao fim, com a transição HALFTIME a escrever na BD já fechada.
        if (game.purged) {
          barrier.abort();
          return;
        }
        if ((game.gamePhase as string) === "lobby") return;

        // Minuto em direto para o relógio do cliente. Sem checkpoint
        // durável: uma quebra volta ao lobby e a ronda rejoga-se do 0.
        game.liveMinute = minute;

        // Emit per-minute update so the client clock stays in sync
        io.to(game.roomCode).emit("matchMinuteUpdate", {
          minute,
          fixtures: game.currentFixtures.map((f) => ({
            homeTeamId: f.homeTeamId,
            awayTeamId: f.awayTeamId,
            isFriendly: f.round === FRIENDLY_ROUND,
            homeGoals: f.finalHomeGoals,
            awayGoals: f.finalAwayGoals,
            minuteEvents: (f.events || []).filter((e) => e.minute === minute),
            homeLineup: f.homeLineup || [],
            awayLineup: f.awayLineup || [],
            homePossession: f._homePossession ?? 50,
            awayPossession: f._awayPossession ?? 50,
          })),
        });

        // Wait before next minute to sync with client clock
        if (minute < endMin) {
          await new Promise((r) => setTimeout(r, effectiveMsPerMinute));
        }
      },
    );
    await Promise.all(
      game.currentFixtures.map((fixture, fi) => {
        const { t1, t2 } = fixtureTactics[fi];
        return simulateMatchSegment(
          game.db,
          fixture,
          t1,
          t2,
          startMin,
          endMin,
          {
            game,
            io,
            matchweek: (game.calendarIndex ?? 0) + 1,
            calendarIndex: game.calendarIndex,
            onMinute: (minute: number) => barrier.wait(minute),
          },
        ).catch((err) => {
          barrier.abort();
          throw err;
        });
      }),
    );

    // Sala apagada durante o segmento: não transitar (HALFTIME/FULLTIME),
    // não gravar, não finalizar — a sala já não existe e a BD está fechada.
    if (game.purged) return;
    game._lastCompletedSegment = segmentKey;
    console.log(
      `[${game.roomCode}] ✓ Segment ${startMin}-${endMin} completed | phase=${game.gamePhase}`,
    );

    if (endMin === 45) {
      // ── Halftime ─────────────────────────────────────────────────────────
      console.log(
        `[${game.roomCode}] ⏸ HALFTIME reached | entry=${entry ? `type:${entry.type}` : "null"} | gamePhase=${game.gamePhase}`,
      );
      game.gamePhase = "match_halftime";

      if (entry?.type !== "league") {
        const halftimePayload = {
          round: (entry as any).round,
          roundName: (entry as any).roundName,
          season: game.season,
          fixtures: game.currentFixtures.map((fixture) => ({
            homeTeam: fixture.homeTeam || null,
            isFriendly: fixture.round === FRIENDLY_ROUND,
            awayTeam: fixture.awayTeam || null,
            homeGoals: fixture.finalHomeGoals,
            awayGoals: fixture.finalAwayGoals,
            events: (fixture.events || []).slice(),
            homeLineup: fixture.homeLineup || [],
            awayLineup: fixture.awayLineup || [],
            _t1: fixture._t1 || null,
            _t2: fixture._t2 || null,
            attendance: fixture.attendance || null,
            homePossession: fixture._homePossession ?? 50,
            awayPossession: fixture._awayPossession ?? 50,
            // Estado das substituições: o cliente só o tem em memória e perde-o
            // num reload ao intervalo.
            subsUsed: { ...(fixture._subCountByTeam || {}) },
            subbedOutIds: [...(fixture._subbedOut || [])],
            referee: pickRefereeSummary(
              game.roomCode,
              fixture.homeTeamId,
              fixture.awayTeamId,
              game.matchweek,
            ),
          })),
        };
        game.cupHalftimePayload = halftimePayload;
        game.lastHalftimePayload = halftimePayload;
        console.log(
          `[${game.roomCode}] Emitting cupHalfTimeResults with ${game.currentFixtures.length} fixtures`,
        );
        io.to(game.roomCode).emit("cupHalfTimeResults", halftimePayload);
      } else {
        const halfTimeFixtures = game.currentFixtures.map((fixture) => ({
          ...fixture,
          subsUsed: { ...(fixture._subCountByTeam || {}) },
          subbedOutIds: [...(fixture._subbedOut || [])],
          referee: pickRefereeSummary(
            game.roomCode,
            fixture.homeTeamId,
            fixture.awayTeamId,
            game.matchweek,
          ),
        }));
        const halftimePayload = {
          matchweek: game.matchweek,
          results: halfTimeFixtures,
        };
        game.lastHalftimePayload = halftimePayload;
        io.to(game.roomCode).emit("halfTimeResults", halftimePayload);
      }

      // Limpar o ready no assento e na projeção: sem isto um rejoin no
      // intervalo herdava o intent.ready obsoleto e avançava sem Pronto.
      resetAllReady(game);
      emitPresence(game);
      saveGameState(game);

      // No safety timer: the game waits at halftime until every coach presses
      // "Pronto" (setReady). The previous 120s safety timer was removed because
      // it forced the second half without the user's explicit action, which is
      // not acceptable in single player.
      clearPhaseTimer(game);

      return;
    }

    // ── Full time ────────────────────────────────────────────────────────────
    console.log(
      `[${game.roomCode}] 🏁 FULL TIME reached | entry=${entry ? `type:${entry.type}` : "null"} | phase=${game.gamePhase}`,
    );
    game.gamePhase = "match_finalizing";
    // Apito final: a semana jogada fica fixada até ao próximo jogo (ver `newsSlotFor`).
    game._whistleSlot = currentSlot(game);
    saveGameState(game);

    const finalizeWatchdog = setTimeout(() => {
      if (game.gamePhase !== "match_finalizing") return;
      if ((game as any).purged) return;
      console.error(
        `[${game.roomCode}] ❌ finalize watchdog: fase presa em match_finalizing — a libertar para lobby`,
      );
      segmentRunning[game.roomCode] = false;
      revertWeekToLobby(game);
      console.error(
        `[${game.roomCode}] ⚠ finalização da jornada presa — sala libertada para o lobby`,
      );
    }, FINALIZE_WATCHDOG_MS);
    (finalizeWatchdog as any)?.unref?.();
    try {
      if (entry?.type === "cup") {
        await finalizeCupRound(game);
      } else if (entry?.type === "friendly") {
        await finalizeFriendly(game);
      } else {
        await finalizeLeagueEvent(game);
      }
    } finally {
      clearTimeout(finalizeWatchdog);
    }
  }

  // ─── HALFTIME → SECOND HALF ─────────────────────────────────────────────────
  // Shared transition used by checkAllReady (all coaches ready), by the halftime
  // safety timer (coach stalled) and by the cup auto-advance (no human in the
  // cup fixtures). Guarded by segmentRunning so it can never double-run.

  async function advanceFromHalftime(game: ActiveGame) {
    if (game.gamePhase !== "match_halftime") return;
    if (segmentRunning[game.roomCode]) {
      console.warn(
        `[${game.roomCode}] ⚠ advanceFromHalftime blocked: segmentRunning is true`,
      );
      return;
    }
    // Congelamento: a segunda parte não começa com um treinador da ronda ausente.
    if (computeAbsentees(game).length > 0) {
      maybeNotifyWaiting(game);
      void waitForPresence(game, io).then(() => {
        advanceFromHalftime(game).catch((err) =>
          console.error(`[${game.roomCode}] advanceFromHalftime (pós-pausa):`, err),
        );
      });
      return;
    }
    segmentRunning[game.roomCode] = true;

    // Cancel halftime safety timeout
    clearPhaseTimer(game);

    const entry = game.currentEvent as any;
    console.log(
      `[${game.roomCode}] ▶ Halftime → second half | type=${entry?.type ?? "unknown"}`,
    );

    pauseAllRunningAuctions(game, io);
    game.gamePhase = "match_second_half";
    saveGameState(game);

    // For cup/friendly matches, emit animation before second half starts
    if (entry?.type !== "league") {
      io.to(game.roomCode).emit("cupSecondHalfStart", {
        round: entry.round,
        roundName: entry.roundName,
        season: game.season,
        results: game.currentFixtures.map((f) => ({
          homeTeamId: f.homeTeamId,
          awayTeamId: f.awayTeamId,
          finalHomeGoals: f.finalHomeGoals,
          finalAwayGoals: f.finalAwayGoals,
          events: f.events,
          attendance: f.attendance || null,
          homeLineup: f.homeLineup || [],
          awayLineup: f.awayLineup || [],
          _t1: f._t1 || null,
          _t2: f._t2 || null,
        })),
      });
    }

    try {
      await runMatchSegment(game, 46, 90);
    } catch (segmentErr) {
      console.error(
        `[${game.roomCode}] ❌ Second half segment failed:`,
        segmentErr,
      );
    } finally {
      segmentRunning[game.roomCode] = false;
    }
    // segmentRunning is now false; safe to auto-advance if all coaches were dismissed.
    if ((game.gamePhase as string) === "lobby") {
      checkAllReady(game);
    }
  }

  // ─── CLASSIFICAÇÃO FINAL NO JORNAL ─────────────────────────────────────────
  // Última jornada da liga (a seguir vem a final da Taça): congela a tabela
  // final por divisão no Jornal — o fim de época faz reset aos pontos e a
  // classificação desapareceria sem rasto. Uma linha por equipa (o Jornal
  // filtra por team_id); idempotente via logClubNewsOnce (equipa+tipo+semana+ano).
  async function logLeagueFinalStandings(
    game: ActiveGame,
    completedMatchweek: number,
  ): Promise<void> {
    const teams = (await getTeamsWithCoachNames(game.db)) || [];
    const byDiv = new Map<number, any[]>();
    for (const t of teams) {
      const div = Number((t as any).division) || 0;
      if (!byDiv.has(div)) byDiv.set(div, []);
      byDiv.get(div)!.push(t);
    }
    for (const [div, rows] of byDiv) {
      const ordered = getStandingsRows(rows);
      const divName = DIVISION_NAMES[div] || `Divisão ${div}`;
      const table = ordered.map((t: any, i: number) => ({
        pos: i + 1,
        id: t.id,
        name: t.name,
        p: t.points || 0,
        j: (t.wins || 0) + (t.draws || 0) + (t.losses || 0),
        v: t.wins || 0,
        e: t.draws || 0,
        d: t.losses || 0,
        gf: t.goals_for || 0,
        gs: t.goals_against || 0,
      }));
      const facts = JSON.stringify({
        v: 1,
        season: game.season,
        year: game.year,
        matchweek: completedMatchweek,
        divId: div,
        divName,
        champion: table[0]?.name || "?",
        rows: table,
      });
      for (const t of rows) {
        logClubNewsOnce(
          game,
          "league_final",
          `📊 Classificação final — ${divName}`,
          (t as any).id,
          {
            description: facts,
            matchweek: completedMatchweek,
            // Esta chamada corre depois de o calendário avançar (a semana da
            // classificação final é a da última jornada, não a seguinte).
            slot: slotForLeagueMatchweek(completedMatchweek),
            year: game.year || 0,
          },
          io,
        );
      }
    }
  }

  // ─── LEAGUE EVENT FINALIZATION ───────────────────────────────────────────────

  async function finalizeLeagueEvent(game: ActiveGame): Promise<void> {
    const fixtures = game.currentFixtures;
    const entry = game.currentEvent as CalendarEntry | null;
    const completedMatchweek = game.matchweek;
    const completedCalendarIndex = game.calendarIndex;

    console.log(
      `[${game.roomCode}] 📊 finalizeLeagueEvent | mw=${completedMatchweek} | fixtures=${fixtures.length}`,
    );

    return new Promise<void>((resolveOuter) => {
      // Transação linear com awaits (conexão serializada: mesma ordem da
      // cadeia antiga por callbacks). Falha aqui → ROLLBACK + lobby, sem COMMIT.
      void (async () => {
        try {
          // Líderes antes da jornada (para o rodapé Notícias CM).
          (game as any)._cmLeadersBefore = await readCmLeaders(game.db);
          // Transação na fila da sala (ligação SQLite única); só o BEGIN…COMMIT lá dentro.
          await runRoomTask(game.roomCode, async () => {
            await dbRun(game.db, "BEGIN TRANSACTION"); // fora do try: um BEGIN falhado não faz ROLLBACK alheio
            try {

              // Deltas do jogo (golos, cartões, lesões, presenças) acumulados em
              // memória pela engine — comitados atomicamente com classificações +
              // receita + marker 'finalized' (janela de crash fechada).
              queueMatchDeltaWrites(game.db, fixtures);

              for (const match of fixtures) {
                for (const [sql, params] of leagueMatchRowWrites(game.season, completedMatchweek, match)) {
                  await dbRun(game.db, sql, params);
                }
              }

              for (const match of fixtures) {
                const hG = match.finalHomeGoals;
                const aG = match.finalAwayGoals;
                const pts = pointsForScore(hG, aG);
                await dbRun(
                  game.db,
                  `UPDATE teams SET points=points+?, wins=wins+?, draws=draws+?, losses=losses+?, goals_for=goals_for+?, goals_against=goals_against+? WHERE id=?`,
                  [pts.hPts, pts.hW, pts.hD, pts.hL, hG, aG, match.homeTeamId],
                );
                await dbRun(
                  game.db,
                  `UPDATE teams SET points=points+?, wins=wins+?, draws=draws+?, losses=losses+?, goals_for=goals_for+?, goals_against=goals_against+? WHERE id=?`,
                  [pts.aPts, pts.aW, pts.aD, pts.aL, aG, hG, match.awayTeamId],
                );
              }

              // ── BILHETEIRA — dentro da transação para comitar atomicamente
              // com as classificações (antes corria após o COMMIT, fora de
              // transação — janela de crash). Mesmo valor semanal: attendance ×
              // preço do bilhete da casa, com 15% para o visitante (AWAY_TICKET_SHARE).
              for (const match of fixtures) {
                const ticketPrice = (match as any)._ticketPrice || 15;
                const revenue = (match.attendance || 0) * ticketPrice;
                if (revenue > 0) {
                  const awayShare = Math.floor(revenue * AWAY_TICKET_SHARE);
                  const homeShare = revenue - awayShare;
                  await dbRun(
                    game.db,
                    "UPDATE teams SET budget = budget + ? WHERE id = ?",
                    [homeShare, match.homeTeamId],
                  );
                  if (awayShare > 0) {
                    await dbRun(
                      game.db,
                      "UPDATE teams SET budget = budget + ? WHERE id = ?",
                      [awayShare, match.awayTeamId],
                    );
                  }
                }
              }

              // Recovery marker for crash recovery: committed atomically with standings +
              // ticket revenue. If a process dies after this COMMIT but before the
              // calendar advances, restart sees the row and advances state instead of
              // replaying the week (see recoverFinalizedSlot in checkAllReady's lobby).
              await dbRun(
                game.db,
                "INSERT OR IGNORE INTO applied_weeks (season, slot, kind) VALUES (?, ?, 'finalized')",
                [game.season, completedCalendarIndex],
              );
              await dbRun(game.db, "COMMIT");
            } catch (txErr) {
              await dbRun(game.db, "ROLLBACK").catch(() => {});
              throw txErr;
            }
          });
        } catch (txErr) {
          console.error(`[${game.roomCode}] Standings update error:`, txErr);
          revertWeekToLobby(game);
          resolveOuter();
          return;
        }

        await (async () => {

          // Saldo de fim de semana (inclui a bilheteira acabada de creditar).
          snapshotBalanceHistory(
            game,
            game.season,
            completedCalendarIndex,
            game.year || 0,
            completedMatchweek,
          );

          // Emit match results
          const fullTimeFixtures = buildFullTimeFixtures(
            game,
            fixtures,
            completedMatchweek,
            pickRefereeSummary,
          );

          // Store in history (projeção magra — o payload completo segue no emit)
          game.allMatchResults = game.allMatchResults ?? {};
          game.allMatchResults[completedMatchweek] = fullTimeFixtures.map(slimMatchResult);

          io.to(game.roomCode).emit("matchResults", {
            matchweek: completedMatchweek,
            results: fullTimeFixtures,
          });
          console.log(
            `[${game.roomCode}] 📣 matchResults emitted | mw=${completedMatchweek} | n=${fullTimeFixtures.length}`,
          );

          resetAllReady(game);
          clearSeatPositions(game);
          // Web Push: resultado + posição a quem não viu o jogo (fire-and-forget,
          // antes de currentFixtures ser limpo — é daí que saem as equipas).
          maybeNotifyMatchday(game, fixtures, completedMatchweek);

          // Advance state
          game.calendarIndex += 1;
          game.matchweek += 1;
          clearMatchCheckpoint(game);
          logCalendarAdvance(game, io, "league_finalized", "week_end");
          game.lastPlayedAt = new Date().toISOString();
          game.currentEvent = SEASON_CALENDAR[game.calendarIndex] ?? null;
          // Última jornada da liga (a seguir vem a final da Taça): congela a
          // tabela final no Jornal antes de a final poder correr e o fim de
          // época fazer reset aos pontos. Fire-and-forget: a linha é
          // idempotente (logClubNewsOnce) e o pós-jogo não depende dela.
          if (
            entry?.type === "league" &&
            (game.currentEvent as any)?.type === "cup" &&
            (game.currentEvent as any)?.round === CUP_FINAL_ROUND
          ) {
            logLeagueFinalStandings(game, completedMatchweek).catch((standErr: any) =>
              console.error(
                `[${game.roomCode}] League-final standings news failed:`,
                standErr?.message || standErr,
              ),
            );
          }
          game.currentFixtures = [];
          game.gamePhase = "lobby";
          game.lastHalftimePayload = null;
          console.log(
            `[${game.roomCode}] ↩ League match finalized → lobby | calendarIndex=${game.calendarIndex} | mw=${game.matchweek} | nextEvent=${game.currentEvent?.type ?? "none"}`,
          );

          // Preparar fixtures da próxima jornada de liga JÁ no lobby — fonte
          // única de verdade para o briefing (nextMatchSummary) e o jogo real.
          // Elimina qualquer divergência de casa/fora entre o que o briefing
          // mostra e o que é jogado.
          if (game.currentEvent?.type === "league") {
            try {
              await prepareLeagueFixtures(
                game,
                (game.currentEvent as any).matchweek,
              );
            } catch (prepErr) {
              console.error(
                `[${game.roomCode}] ❌ League fixture prep failed (will regenerate at match start):`,
                prepErr,
              );
            }
          }

          // Estado de época para a sala: mantém matchweekCount/calendarIndex do
          // cliente em sincronia após CADA jornada (liga) e dispara o refetch
          // do nextMatchSummary na tab de tática.
          io.to(game.roomCode).emit("seasonState", {
            matchweek: game.matchweek,
            calendarIndex: game.calendarIndex,
            season: game.season,
            year: game.year,
          });
          saveGameState(game);

          // Véspera de Taça: preparar o sorteio ANTES do processamento
          // pesado (evolução, contratos, economia NPC, eventos) para o
          // popup chegar ao cliente sem esperar por essa cadeia. Só precisa
          // do currentEvent, já avançado acima.
          if (game.currentEvent?.type === "cup") {
            try {
              await startCupRound(game, (game.currentEvent as any).round);
              saveGameState(game);
            } catch (cupErr) {
              console.error(
                `[${game.roomCode}] Cup draw preparation error:`,
                cupErr,
              );
            }
          }

          // Check season end: calendarIndex past end of calendar
          const seasonDone = game.calendarIndex >= SEASON_CALENDAR.length;

          persistMatchResults(game, fixtures, completedMatchweek, () => {
            // ── Broadcast updated standings ASAP ─────────────────────────────
            // Teams/forms/topScorers are final right after persistMatchResults
            // writes the matches. Emit them before the heavy background
            // processing (quality evolution, training bonuses, transfers…) so
            // the client's Classification screen shows fresh data immediately
            // instead of waiting for the whole post-match chain to finish.
            // standingsUpdated só sai depois dos três: o cliente refaz o pedido
            // ao recebê-lo e não pode apanhar teamsData/forms/artilheiros velhos.
            Promise.all([
              getTeamsWithCoachNames(game.db).catch(() => null),
              getAllTeamForms(game.db, game.season).catch(() => null),
              fetchTopScorers(game.db).catch(() => null),
            ]).then(([teams, forms, scorers]) => {
              if (teams) {
                io.to(game.roomCode).emit("teamsData", teams);
                // O calendarIndex já avançou: o plantel (expulsos/lesões) tem
                // de acompanhar, não chegar só no fim da cadeia.
                emitHumanSquads(game).catch(() => {});
              }
              if (forms) io.to(game.roomCode).emit("teamForms", forms);
              if (scorers) io.to(game.roomCode).emit("topScorers", scorers);
              io.to(game.roomCode).emit("standingsUpdated");
              io.to(game.roomCode).emit("globalNewsUpdated");
            });

            // Notícias CM: novo líder por divisão + goleada da jornada.
            readCmLeaders(game.db).then((cmLeadersAfter) => {
              for (const { div, name } of diffCmLeaders((game as any)._cmLeadersBefore ?? new Map(), cmLeadersAfter)) {
                emitCmNews(game, io, cmLeaderText(div, name));
              }
              const gol = pickCmGoleada(fixtures);
              if (gol) emitCmNews(game, io, cmGoleadaText(gol));
            });

            applyPostMatchQualityEvolution(game.db, fixtures, completedCalendarIndex + 1, game.season || 1, completedCalendarIndex)
              .then(() =>
                applyTrainingBonuses(game, fixtures, completedCalendarIndex),
              )
              .then(() => logProgressNews(game, fixtures, completedCalendarIndex))
              .then(async () => {
                if (seasonDone) {
                  try {
                    await applySeasonEnd(game);
                    refreshMarket(game);
                    // Nova época em curso — re-emite o estado resetado para o
                    // cliente não ficar com matchweek/calendarIndex da época velha.
                    io.to(game.roomCode).emit("seasonState", {
                      matchweek: game.matchweek,
                      calendarIndex: game.calendarIndex,
                      season: game.season,
                      year: game.year,
                    });
                  } catch (seErr) {
                    console.error(
                      `[${game.roomCode}] Season end error:`,
                      seErr,
                    );
                  }
                  resolveOuter();
                  return;
                }

                // Drain pending auction queue — skip if next event is a cup round to avoid
                // the auction modal overlapping the cup draw animation.
                if (
                  game.pendingAuctionQueue &&
                  game.pendingAuctionQueue.length > 0 &&
                  game.currentEvent?.type !== "cup"
                ) {
                  const queue = game.pendingAuctionQueue.splice(0) as any[];
                  if (!game.pendingAuctionQueueTimers)
                    game.pendingAuctionQueueTimers = [];
                  let qDelay = 500;
                  for (const qEntry of queue) {
                    const tid = setTimeout(() => {
                      game.pendingAuctionQueueTimers =
                        game.pendingAuctionQueueTimers.filter((t) => t !== tid);
                      listPlayerOnMarket(
                        game,
                        qEntry.playerId,
                        qEntry.mode,
                        qEntry.price,
                        qEntry.callback,
                      );
                    }, qDelay);
                    game.pendingAuctionQueueTimers.push(tid);
                    qDelay += 18000;
                  }
                }

                // Orçamento de propostas de contrato: 1 nova por treinador por
                // semana, partilhado entre renovações e renegociações. Re-emissões
                // de pedidos pendentes não consomem o orçamento.
                const weeklyProposals = new Set<number>();
                try {
                  await resendPendingContractRequests(game);
                } catch (_) {}
                try {
                  await processContractExpiries(game, weeklyProposals);
                } catch (_) {}
                try {
                  await processAgentRenegotiations(game, weeklyProposals);
                } catch (_) {}
                try {
                  // Economia NPC: pressão salarial anti-acumulação (folha sobe
                  // com riqueza/desempenho até ao teto sustentável). Correr logo
                  // a seguir às negociações humanas, antes das transferências.
                  await processNpcAgentPressure(game);
                } catch (_) {}
                try {
                  await processNpcTransferActivity(game);
                } catch (_) {}
                try {
                  // Equipa técnica dos NPCs: uma contratação por semana ao
                  // nível da divisão, com reserva de tesouraria (espelha o
                  // foco de treino automático).
                  await ensureNpcStaff(game);
                } catch (_) {}
                try {
                  // Direção investe excedente: NPCs ricos gastam (obra/academia)
                  // até ao limiar — esvazia pilhas sem árbitro central.
                  await processNpcInvestment(game);
                } catch (_) {}
                // Retomar leilões pausados durante o jogo (antes de refreshMarket
                // para que o mercado emitido já reflicta os leilões como "open")
                resumeAllPausedAuctions(game);
                refreshMarket(game);
                try {
                  await processCoachEvents(game);
                } catch (coachErr) {
                  console.error(
                    `[${game.roomCode}] Coach events error:`,
                    coachErr,
                  );
                }

                // Emitir o resumo semanal do mercado de treinadores (modal)
                if (game.coachMarketEvents && game.coachMarketEvents.length > 0) {
                  io.to(game.roomCode).emit("coachMarketReport", {
                    matchweek: game.matchweek,
                    events: game.coachMarketEvents,
                  });
                  game.coachMarketEvents = [];
                }

                // Sorteio já preparado na entrada do lobby (ver acima).

                // Standings (teamsData/teamForms/topScorers) were already
                // broadcast right after persistMatchResults — only squad info
                // and presence remain.
                emitHumanSquads(game)
                  .catch(() => {})
                  .then(() => {
                    emitPresence(game);
                    resolveOuter();
                  });
              })
              .catch((error: any) => {
                console.error(
                  `[${game.roomCode}] Post-match evolution error:`,
                  error,
                );
                resolveOuter();
              });
          });
        })();
      })();
    });
  }

  // Lê os plantéis dos humanos ligados e emite-lhes o `mySquad`. Chamado logo
  // a seguir ao `teamsData` (o calendarIndex já avançou; sem isto um expulso
  // aparecia disponível até ao fim da cadeia) e outra vez no fim, porque a
  // evolução/treino/contratos mudam as skills.
  async function emitHumanSquads(game: ActiveGame): Promise<void> {
    const humans = getPlayerList(game).filter(
      (p) => p.socketId && p.teamId != null,
    );
    const teamIds = [...new Set(humans.map((p) => p.teamId as number))];
    if (teamIds.length === 0) return;
    const allPlayers: any[] = await new Promise((resolve, reject) =>
      game.db.all(
        `SELECT * FROM players WHERE team_id IN (${teamIds.map(() => "?").join(",")})`,
        teamIds,
        (err: any, rows: any[]) => (err ? reject(err) : resolve(rows || [])),
      ),
    );
    const byTeam = new Map<number, any[]>();
    for (const p of allPlayers) {
      const list = byTeam.get(p.team_id) || [];
      list.push(p);
      byTeam.set(p.team_id, list);
    }
    const slot = (game.calendarIndex ?? 0) + 1;
    for (const player of humans) {
      const squad = byTeam.get(player.teamId as number) || [];
      io.to(player.socketId as string).emit(
        "mySquad",
        ensureFullBench(
          withJuniorGRs(squad, player.teamId as number, slot),
          player.teamId as number,
          slot,
        ),
      );
    }
  }

  // Falha no fecho da jornada: volta ao lobby do MESMO slot, sem Prontos nem
  // fixtures (regeneram no próximo arranque) — a jornada rejoga-se do 0, como
  // numa quebra. Sem isto a fase ficava presa ou o jogo repetia com o 11 antigo.
  function revertWeekToLobby(game: ActiveGame) {
    game.gamePhase = "lobby";
    game._whistleSlot = undefined;
    game.currentFixtures = [];
    game.lastHalftimePayload = null;
    resetAllReady(game);
    clearSeatPositions(game);
    emitPresence(game);
    saveGameState(game);
  }

  // ─── MAIN DISPATCH: checkAllReady ────────────────────────────────────────────
  // Cup and league use the IDENTICAL flow: lobby → match_first_half → halftime
  // → match_second_half → finalize → lobby. No special cup phases.

  // Weekly finance (base income by division, wages, loan interest + installment)
  // applied at most once per calendar slot. A crash mid-week resets the phase to
  // lobby and startWeekOnce re-runs; the applied_weeks marker guarantees the money
  // is never charged twice for the same (season, slot).
  async function applyWeeklyFinancesOnce(game: ActiveGame): Promise<boolean> {
    const slot = game.calendarIndex;
    const rollback = () => dbRun(game.db, "ROLLBACK").catch(() => {});
    try {
      const charged = await dbGet(
        game.db,
        "SELECT 1 AS done FROM applied_weeks WHERE season = ? AND slot = ? AND kind = 'weekly_finance'",
        [game.season, slot],
      ).catch((chkErr: any) => {
        // Sem saber se a semana já foi cobrada não se cobra: a semana volta
        // ao lobby e tenta de novo (antes cobrava sem proteção — risco de 2×).
        console.error(
          `[${game.roomCode}] ⚠ applied_weeks('weekly_finance') read error — finance not applied:`,
          chkErr.message,
        );
        return "error" as const;
      });
      if (charged === "error") return false;
      if (charged) {
        // Already charged in a previous attempt for this slot.
        return true;
      }

      // Transação na fila da sala (ligação SQLite única): só BEGIN…COMMIT lá dentro.
      const applied = await runRoomTask(game.roomCode, async () => {
        try {
          await dbRun(game.db, "BEGIN TRANSACTION");
        } catch (begErr) {
          console.error(
            `[${game.roomCode}] ❌ Weekly finance BEGIN failed:`,
            begErr,
          );
          return false;
        }
        try {
          // Relê o marcador já dentro da fila: se outra chamada cobrou esta
          // semana entre a verificação de cima e aqui, não se cobra outra vez.
          const already = await dbGet(
            game.db,
            "SELECT 1 AS done FROM applied_weeks WHERE season = ? AND slot = ? AND kind = 'weekly_finance'",
            [game.season, slot],
          );
          if (already) {
            await rollback();
            return true;
          }
          // Weekly base income by division (keeps lower-division teams viable)
          for (const [div, income] of Object.entries(WEEKLY_BASE_INCOME)) {
            await dbRun(
              game.db,
              "UPDATE teams SET budget = budget + ? WHERE division = ?",
              [income, Number(div)],
            );
          }

          // Patrocinadores: prestação semanal do perfil B + 2.ª tranche do
          // perfil C na semana 10. Cada crédito tem linha `sponsor` no Jornal
          // para a reconciliação do gráfico não esmagar valores (bug antigo
          // dos prémios creditados sem diário). Salas antigas sem as colunas
          // caem no catch com lista vazia.
          // Clube com patrocinador por escolher mas sem treinador humano
          // (despedido ou saído antes de escolher): escolha automática, como os
          // NPC. Sem isto o clube perdia o patrocínio da época inteira.
          try {
            const orphans: any[] = await dbAll(
              game.db,
              `SELECT t.id, t.division FROM teams t LEFT JOIN managers m ON t.manager_id = m.id
               WHERE t.sponsor_pending = 1 AND COALESCE(m.is_human, 0) = 0`,
            );
            if (orphans.length > 0) {
              const takenRows: any[] = await dbAll(
                game.db,
                "SELECT sponsor_id FROM teams WHERE sponsor_season = ? AND sponsor_id IS NOT NULL",
                [game.season],
              );
              const taken = new Set<string>(takenRows.map((r) => String(r.sponsor_id)));
              for (const t of orphans) {
                const choice = drawNpcChoice(t.division, taken) ?? drawOffersAny(taken, 1)[0] ?? null;
                if (!choice) continue;
                taken.add(choice.sponsorId);
                await dbRun(
                  game.db,
                  `UPDATE teams SET sponsor_id = ?, sponsor_profile = ?, sponsor_pending = 0, sponsor_offers = NULL,
                     sponsor_upfront = ?, sponsor_weekly = ?, sponsor_second_half = ?, sponsor_paid_second = 0,
                     sponsor_season = ?, budget = budget + ?
                   WHERE id = ? AND sponsor_pending = 1`,
                  [choice.sponsorId, choice.profile, choice.upfront, choice.weekly, choice.secondHalf, game.season, choice.upfront, t.id],
                );
              }
            }
          } catch (orphanErr) {
            console.error(`[${game.roomCode}] ⚠ sponsor auto-pick failed:`, orphanErr);
          }
          const paidSponsor: Record<number, number> = {};
          try {
            const sponsorRows: any[] = await dbAll(
              game.db,
              `SELECT id, sponsor_id, sponsor_weekly, sponsor_second_half, sponsor_paid_second
               FROM teams WHERE sponsor_season = ? AND (sponsor_weekly > 0 OR (sponsor_second_half > 0 AND sponsor_paid_second = 0))`,
              [game.season],
            );
            for (const t of sponsorRows) {
              const sName = sponsorById(String(t.sponsor_id || ""))?.name || "Patrocinador";
              if ((t.sponsor_weekly || 0) > 0) {
                await dbRun(game.db, "UPDATE teams SET budget = budget + ? WHERE id = ?", [t.sponsor_weekly, t.id]);
                paidSponsor[t.id] = (paidSponsor[t.id] || 0) + t.sponsor_weekly;
                logClubNews(game, "sponsor", `${sName} — prestação semanal`, t.id, {
                  amount: t.sponsor_weekly,
                  description: `Patrocínio ${sName} (época ${game.year})`,
                });
              }
              if (slot === SPONSOR_SECOND_TRANCHE_SLOT && (t.sponsor_second_half || 0) > 0 && !t.sponsor_paid_second) {
                await dbRun(
                  game.db,
                  "UPDATE teams SET budget = budget + ?, sponsor_paid_second = 1 WHERE id = ?",
                  [t.sponsor_second_half, t.id],
                );
                paidSponsor[t.id] = (paidSponsor[t.id] || 0) + t.sponsor_second_half;
                logClubNews(game, "sponsor", `${sName} — 2.ª tranche`, t.id, {
                  amount: t.sponsor_second_half,
                  description: `Patrocínio ${sName}, segunda metade (época ${game.year})`,
                });
              }
            }
          } catch {}

          // Dívida/capacidade/salários ANTES dos descontos — os mesmos valores
          // alimentam o UPDATE de despesas e o resumo do Jornal. Em erro de
          // leitura, segue com mapas vazios (comportamento anterior).
          const preLoan: Record<number, number> = {};
          const preDiv: Record<number, number> = {};
          const preHuman: Record<number, number> = {};
          const preWages: Record<number, number> = {};
          const preSeats: Record<number, number> = {};
          const preRows: any[] = await dbAll(
            game.db,
            `SELECT t.id, t.loan_amount, t.division, t.stadium_capacity,
                          m.is_human,
                          (SELECT COALESCE(SUM(wage), 0)
                           FROM players WHERE players.team_id = t.id) AS wages
                   FROM teams t
                   LEFT JOIN managers m ON t.manager_id = m.id`,
          ).catch(() => []);
          for (const r of preRows) {
            preLoan[r.id] = r.loan_amount || 0;
            preDiv[r.id] = r.division ?? 5;
            preHuman[r.id] = r.is_human || 0;
            preWages[r.id] = r.wages || 0;
            preSeats[r.id] = r.stadium_capacity || 0;
          }

          // Funcionários: salário semanal por equipa (linha própria da folha).
          // Falha de leitura → mapa vazio (as salas antigas sem a tabela não
          // podem travar a semana).
          const preStaff: Record<number, number> = {};
          for (const [teamId, total] of await fetchStaffSalaryTotals(game).catch(
            () => new Map<number, number>(),
          )) {
            preStaff[teamId] = total;
          }

          // Deduct weekly wages + loan interest + principal installment (same for
          // cup and league weeks). The installment abates the loan principal so the
          // visible debt shrinks week over week, and scales with the division's
          // base income (a flat fee was 3 weekly incomes for Distritais). Stadium
          // upkeep spares the first STADIUM_UPKEEP_EXEMPT_SEATS seats: giant
          // stadiums still cost millions per season (anti-snowball), small ones breathe.
          try {
            await dbRun(
              game.db,
              `UPDATE teams SET
                        loan_amount = MAX(0, loan_amount - (${LOAN_DIV_CASE})),
                        budget = budget
                          - CAST((loan_amount * 0.015) AS INTEGER)
                          - (SELECT COALESCE(SUM(wage), 0) FROM players WHERE players.team_id = teams.id)
                          - (SELECT COALESCE(SUM(salary_weekly), 0) FROM team_staff WHERE team_id = teams.id)
                          - CAST((MAX(0, COALESCE(stadium_capacity, 0) - ?) * ?) AS INTEGER)
                          - MIN((${LOAN_DIV_CASE}), loan_amount)`,
              [STADIUM_UPKEEP_EXEMPT_SEATS, STADIUM_UPKEEP_PER_SEAT_WEEK],
            );
          } catch (expErr) {
            console.error(`[${game.roomCode}] ❌ Weekly expense DB error:`, expErr);
            await rollback();
            return false;
          }

          // Resumo financeiro semanal: 1 notícia por equipa com
          // treinador humano. Os valores são os mesmos do UPDATE
          // (loan_amount pré-atualização; idênticas fórmulas do SQL).
          for (const teamId of Object.keys(preLoan)) {
            const id = Number(teamId);
            if (!preHuman[id]) continue;
            const oldLoan = preLoan[id];
            const div = preDiv[id] ?? 5;
            const income = WEEKLY_BASE_INCOME[div] ?? 0;
            const wages = preWages[id] || 0;
            const upkeep = Math.trunc(
              Math.max(0, (preSeats[id] || 0) - STADIUM_UPKEEP_EXEMPT_SEATS) *
                STADIUM_UPKEEP_PER_SEAT_WEEK,
            );
            const interest = Math.floor(oldLoan * 0.015);
            const installment = Math.min(loanInstallment(div), oldLoan);
            logClubNews(game, "weekly_finance", "Resumo Financeiro da Semana", id, {
              description: buildWeeklyFinanceFacts({
                income,
                wages,
                upkeep,
                staff: preStaff[id] || 0,
                sponsor: paidSponsor[id] || 0,
                interest,
                installment,
                oldLoan,
              }),
            });
          }

          // Marker + COMMIT: dinheiro e Jornal comitam atomicamente; um crash
          // antes daqui deixa tudo sem marker, por isso rejogar é seguro.
          await dbRun(
            game.db,
            "INSERT OR IGNORE INTO applied_weeks (season, slot, kind) VALUES (?, ?, 'weekly_finance')",
            [game.season, slot],
          );
          try {
            await dbRun(game.db, "COMMIT");
          } catch (commitErr) {
            console.error(
              `[${game.roomCode}] ❌ Weekly finance COMMIT failed:`,
              commitErr,
            );
            await rollback();
            return false;
          }
          return true;
        } catch (unexpected) {
          console.error(
            `[${game.roomCode}] ❌ Weekly finance unexpected error:`,
            unexpected,
          );
          await rollback();
          return false;
        }
      });
      if (!applied) return false;
      // Saldo real pós-descontos (o jogo da semana ainda não
      // foi jogado); a finalização atualiza o mesmo slot
      // com a bilheteira — o ponto final é de fim de semana.
      snapshotBalanceHistory(
        game,
        game.season,
        slot,
        game.year || 0,
        game.matchweek || 0,
      );
      return true;
    } catch (unexpected) {
      console.error(
        `[${game.roomCode}] ❌ Weekly finance unexpected error:`,
        unexpected,
      );
      return false;
    }
  }

  // Lobby → start of the current week (league or cup): clear auction queue timers,
  // pause auctions, set phase, apply weekly finance (idempotent), prepare
  // fixtures and run the first half. Extracted from checkAllReady so it can run
  // behind the applied_weeks recovery marker — a slot already finalized in a
  // previous process is never replayed.
  async function startWeekOnce(game: ActiveGame, entry: CalendarEntry): Promise<void> {
    if (game.pendingAuctionQueueTimers?.length) {
      for (const tid of game.pendingAuctionQueueTimers) clearTimeout(tid);
      game.pendingAuctionQueueTimers = [];
    }
    pauseAllRunningAuctions(game, io);

    segmentRunning[game.roomCode] = true;
    game.gamePhase = "match_first_half";
    game.currentEvent = entry;
    game._lastCompletedSegment = null;
    game._whistleSlot = undefined;

    console.log(
      `[${game.roomCode}] 🏟 Starting match | type=${entry.type} | calendarIndex=${game.calendarIndex} | ${entry.type === "cup" ? `round=${(entry as any).round}` : entry.type === "friendly" ? `amigável` : `mw=${(entry as any).matchweek}`}`,
    );

    const financed = await applyWeeklyFinancesOnce(game);
    if (!financed) {
      console.error(
        `[${game.roomCode}] ❌ Weekly finance not applied — reverting to lobby`,
      );
      game.gamePhase = "lobby";
      game.currentEvent = entry;
      segmentRunning[game.roomCode] = false;
      return;
    }
    // As finanças semanais mexeram nos saldos: o cliente tem de os ver já.
    getTeamsWithCoachNames(game.db)
      .then((t: any[]) => io.to(game.roomCode).emit("teamsData", t))
      .catch(() => {});

    try {
      if (entry.type === "friendly") {
        // Amigável: sorteio invisível feito à entrada do lobby (fim de época).
        // Fallback: preparar agora se faltar (ex. recovery).
        if (!game.currentFixtures || game.currentFixtures.length === 0) {
          await prepareFriendlyFixtures(game);
        }
      } else if (entry.type === "cup") {
        // Cup fixtures were prepared when we entered the lobby (see finalizeLeagueEvent).
        // Fallback: prepare now if missing (e.g. crash recovery).
        if (!game.currentFixtures || game.currentFixtures.length === 0) {
          console.log(
            `[${game.roomCode}] 🏆 Cup fixtures missing, generating draw for round ${(entry as any).round}`,
          );
          await startCupRound(game, (entry as any).round);
        } else {
          console.log(
            `[${game.roomCode}] 🏆 Cup fixtures already prepared: ${game.currentFixtures.length} matches`,
          );
        }
      } else {
        // League: reutilizar fixtures já preparadas na entrada do lobby
        // (mesma fonte que o briefing) ou gerar com seeds determinísticos.
        const mw = (entry as any).matchweek;
        const prepped = game.currentFixtures ?? [];
        const hasLeagueFixtures =
          prepped.length > 0 && !(prepped[0] as any)?.round;
        if (hasLeagueFixtures) {
          console.log(
            `[${game.roomCode}] ⚽ Reusing lobby-prepared league fixtures for mw=${mw}: ${prepped.length} matches`,
          );
        } else {
          await prepareLeagueFixtures(game, mw);
        }
      }
    } catch (fixtureErr) {
      console.error(
        `[${game.roomCode}] ❌ Fixture generation failed — reverting to lobby:`,
        fixtureErr,
      );
      game.gamePhase = "lobby";
      game.currentEvent = entry;
      game.currentFixtures = [];
      segmentRunning[game.roomCode] = false;
      saveGameState(game);
      // Reset ready states so coaches can retry
      resetAllReady(game);
      emitPresence(game);
      console.error(`[${game.roomCode}] ⚠ erro ao gerar jogos — sala revertida para o lobby.`);
      return;
    }

    saveGameState(game);

    // NOTA: uma interrupção a meio recomeça sempre 0-0: a quebra volta ao
    // lobby do slot (sem tática gravada) e a ronda rejoga-se do início.
    // Aqui só se arranca uma semana nova a partir do lobby, com
    // fixtures frescas (currentFixtures = [] no finalize).
    appendRoomEvent(game, io, "week_started", {
      calendarIndex: game.calendarIndex,
      matchweek: game.matchweek,
      type: entry.type,
    });
    // O checkpoint anterior é de outra jornada: não pode sobreviver para ser
    // aplicado a estas fixtures diferentes.
    clearMatchCheckpoint(game);

    try {
      await runMatchSegment(game, 1, 45);
    } catch (segmentErr) {
      console.error(
        `[${game.roomCode}] ❌ First half segment failed:`,
        segmentErr,
      );
    } finally {
      segmentRunning[game.roomCode] = false;
    }

    // Captura lineups da primeira parte a partir dos squads que realmente jogaram.
    // Liga fixtures não têm homeLineup/awayLineup definidos antes deste ponto.
    // Necessário para applyTrainingBonuses ver todos os jogadores participantes.
    // Snapshot via buildLineupSnapshot (implementação única no engine).
    for (let fi = 0; fi < game.currentFixtures.length; fi++) {
      const fx = game.currentFixtures[fi];
      const p1 = Object.values(game.playersByName).find(
        (p) => p.teamId === fx.homeTeamId,
      );
      const p2 = Object.values(game.playersByName).find(
        (p) => p.teamId === fx.awayTeamId,
      );
      const t1 = (p1?.tactic as object) || fx._t1 || {};
      const t2 = (p2?.tactic as object) || fx._t2 || {};
      // Cup fixtures start with homeLineup: [] (truthy), so the backup
      // snapshot must check length, not just truthiness — otherwise the
      // cup lineups would never be recovered post-first-half.
      if ((!fx.homeLineup || fx.homeLineup.length === 0) && fx._homeSquad)
        fx.homeLineup = buildLineupSnapshot(
          fx,
          fx._homeSquad,
          t1,
          fx._homeFullRoster,
          "home",
        );
      if ((!fx.awayLineup || fx.awayLineup.length === 0) && fx._awaySquad)
        fx.awayLineup = buildLineupSnapshot(
          fx,
          fx._awaySquad,
          t2,
          fx._awayFullRoster,
          "away",
        );
    }

    // segmentRunning is now false; safe to auto-advance if all coaches were dismissed.
    // (runMatchSegment may have moved the phase — read it through a string-typed alias
    // so the literal narrowing from the assignment above does not hide those values.)
    const phaseNow: string = game.gamePhase;
    if (phaseNow === "lobby") {
      checkAllReady(game);
      return;
    }

    // Auto-advance cup/friendly halftime when no HUMAN team is in any fixture
    // (all eliminated — no substitutions screen needed). Decide por assentos,
    // não por `socketId`: um treinador com jogo que esteja offline no intervalo
    // tem de continuar a mandar no seu Pronto — senão a 2.ª parte arrancava
    // sozinha quando ele voltava (autorun).
    if (phaseNow === "match_halftime" && entry?.type !== "league") {
      if (!hasHumanTeamInFixtures(game, game.currentFixtures)) {
        console.log(
          `[${game.roomCode}] 🏆 No human in cup fixtures — auto-advancing to second half`,
        );
        await advanceFromHalftime(game);
      }
    }
  }

  // Crash recovery: the current slot was already finalized by a previous process run
  // (its 'finalized' marker committed atomically with standings + ticket revenue in
  // finalizeLeagueEvent). Replaying the event would double-apply results and money, so
  // advance state exactly like the normal finalize tail. If the crash landed in the
  // narrow window after that COMMIT, only match-row persistence / post-match evolution
  // for this one week may be missing (npm run audit:gamestate surfaces it).
  function recoverFinalizedSlot(game: ActiveGame, entry: CalendarEntry): void {
    console.warn(
      `[${game.roomCode} ⚠ Crash recovery: slot ${game.calendarIndex} already finalized — advancing calendar without replaying the week`,
    );
    game.calendarIndex += 1;
    if (entry.type === "league") game.matchweek += 1;
    logCalendarAdvance(game, io, "recover_finalized_slot", "crash_recovery");
    game.lastPlayedAt = new Date().toISOString();
    game.currentEvent = SEASON_CALENDAR[game.calendarIndex] ?? null;
    game.currentFixtures = [];
    game.gamePhase = "lobby";
    game.lastHalftimePayload = null;
    resetAllReady(game);
    clearSeatPositions(game);

    if (game.currentEvent?.type === "league") {
      prepareLeagueFixtures(game, (game.currentEvent as any).matchweek).catch(
        (prepErr: any) =>
          console.error(`[${game.roomCode} ❌ Recovery fixture prep failed:`, prepErr),
      );
    }

    io.to(game.roomCode).emit("seasonState", {
      matchweek: game.matchweek,
      calendarIndex: game.calendarIndex,
      season: game.season,
      year: game.year,
    });
    saveGameState(game);
    resumeAllPausedAuctions(game);

    if (game.calendarIndex >= SEASON_CALENDAR.length) {
      applySeasonEnd(game)
        .then(() => {
          refreshMarket(game);
          io.to(game.roomCode).emit("seasonState", {
            matchweek: game.matchweek,
            calendarIndex: game.calendarIndex,
            season: game.season,
            year: game.year,
          });
        })
        .catch((seErr: any) =>
          console.error(`[${game.roomCode} Season end error (recovery):`, seErr),
        );
    }
  }

  // Fim de época interrompido (quebra entre o último slot e a época nova):
  // volta a correr applySeasonEnd — idempotente por passo (applied_weeks) e
  // single-flight, por isso é seguro chamar de vários sítios.
  function recoverSeasonEnd(game: ActiveGame): boolean {
    if (game.calendarIndex < SEASON_CALENDAR.length) return false;
    if ((game as any)._seasonEndRunning) return true;
    console.warn(
      `[${game.roomCode}] ♻ Fim de época por concluir (calendarIndex=${game.calendarIndex}) — a retomar`,
    );
    applySeasonEnd(game)
      .then(() => {
        refreshMarket(game);
        io.to(game.roomCode).emit("seasonState", {
          matchweek: game.matchweek,
          calendarIndex: game.calendarIndex,
          season: game.season,
          year: game.year,
        });
      })
      .catch((seErr: any) =>
        console.error(`[${game.roomCode}] Season end error (retoma):`, seErr),
      );
    return true;
  }

  // Assentos de que a fase atual espera (membros das equipas da ronda). Usado
  // no início do checkAllReady e outra vez no callback assíncrono do arranque.
  function seatsWaitedFor(game: ActiveGame) {
    const requiredTeams =
      game.gamePhase === "match_et_gate"
        ? new Set<number>(
            game.currentFixtures
              .filter((f) => (f as any).round !== FRIENDLY_ROUND && f.finalHomeGoals === f.finalAwayGoals)
              .flatMap((f) => [f.homeTeamId, f.awayTeamId]),
          )
        : requiredTeamIds(game);
    return Object.values(game.seats).filter(
      (seat) =>
        seat.status === "member" &&
        seat.teamId != null &&
        requiredTeams.has(seat.teamId),
    );
  }

  async function checkAllReady(game: ActiveGame) {
    // Web Push (Fase 2): antes do gate de presença — o em-falta está
    // tipicamente ausente. Leitura pura + fire-and-forget, sem await.
    maybeNotifyLastMissing(game);
    // ── Congelamento: um treinador da ronda ausente pára a sala inteira ────
    // Antes, a ausência era simplesmente ignorada a meio do jogo (só contavam
    // os ligados) e o jogo avançava sem ele — a jornada seguinte chegava-lhe
    // já jogada. Agora espera-se, e re-despacha-se quando ele voltar.
    if (computeAbsentees(game).length > 0) {
      maybeNotifyWaiting(game);
      // Um só waiter por sala: cada checkAllReady durante a ausência empilhava
      // mais um waitForPresence (e um re-despacho por cada um ao voltar).
      if ((game as any)._readyWaitArmed) return;
      (game as any)._readyWaitArmed = true;
      waitForPresence(game, io).then(() => {
        (game as any)._readyWaitArmed = false;
        checkAllReady(game).catch((err) =>
          console.error(`[${game.roomCode}] checkAllReady (pós-pausa):`, err),
        );
      });
      return;
    }

    // ── Prontidão por assento (todas as fases, mesma regra) ────────────────
    // A fonte é o assento durável, não o socket: um flape não apaga o ready e
    // um treinador que voltou a ligar mantém a intenção que já tinha dado.
    // O prolongamento (Taça) só espera pelas equipas empatadas — eliminados e
    // espectadores não bloqueiam.
    const waitingSeats = seatsWaitedFor(game);
    if (waitingSeats.length === 0) {
      // Lobby da Taça com treinadores eliminados: esperar por um clique explícito
      // em «Avançar para Taça». Sem membros na sala, mantém-se o avanço automático.
      if (game.gamePhase === "lobby" && (game.currentEvent as any)?.type === "cup") {
        const seatedMembers = Object.values(game.seats).filter(
          (seat) => seat.status === "member" && seat.teamId != null,
        );
        if (seatedMembers.length > 0 && !seatedMembers.some((seat) => seat.intent.ready)) {
          console.log(
            `[${game.roomCode}] ⏸ checkAllReady: Taça à espera do avanço explícito de um treinador`,
          );
          return;
        }
      }
      // Ninguém humano nesta ronda (só NPCs) — não há nada a esperar.
      console.log(
        `[${game.roomCode}] ⏸ checkAllReady: sem treinadores humanos na ronda — a avançar`,
      );
    } else {
      const notReady = waitingSeats.filter((seat) => !seat.intent.ready);
      if (notReady.length > 0) {
        console.warn(
          `[${game.roomCode}] ⏸ checkAllReady blocked (${game.gamePhase}): ${notReady.map((s) => s.name).join(", ")}`,
        );
        return;
      }
      console.log(
        `[${game.roomCode}] ✅ Todos os assentos da ronda prontos (${waitingSeats.length}): ${waitingSeats.map((s) => s.name).join(", ")}`,
      );
    }

    console.log(
      `[${game.roomCode}] 🔄 checkAllReady dispatching | calendarIndex=${game.calendarIndex} | gamePhase=${game.gamePhase} | segmentRunning=${!!segmentRunning[game.roomCode]}`,
    );

    // ── Lobby → start match (league OR cup, identical) ──────────────────────
    if (game.gamePhase === "lobby") {
      // Single-flight do arranque de semana: o callback do db.get abaixo cria
      // uma janela onde um segundo dispatch
      // (dois "Pronto" quase simultâneos) entrava em startWeekOnce em paralelo
      // e o segundo BEGIN das finanças falhava dentro da transação do primeiro
      // (SQLITE_ERROR: cannot start a transaction within a transaction).
      // Reclamar aqui, de forma síncrona (check + set sem await pelo meio
      // é atómico em JS): o 2.º dispatch simultâneo é rejeitado; as saídas
      // antecipadas deste ramo repõem a false (o startWeekOnce gere a flag
      // a partir daqui).
      if (segmentRunning[game.roomCode]) {
        console.warn(
          `[${game.roomCode}] ⚠ Lobby→match blocked: segmentRunning is true (match already in progress)`,
        );
        return;
      }
      segmentRunning[game.roomCode] = true;
      // Gate único do 11+7 no setReady (socketGameplayHandlers): quem chega
      // aqui já validou o 11 + banco ao clicar "Ir a jogo". Sem revalidação —
      // só quórum de readys.
      const entry = SEASON_CALENDAR[game.calendarIndex];
      if (!entry) {
        console.warn(
          `[${game.roomCode}] ⚠ checkAllReady: calendarIndex ${game.calendarIndex} out of range (calendar length: ${SEASON_CALENDAR.length})`,
        );
        segmentRunning[game.roomCode] = false;
        recoverSeasonEnd(game);
        return;
      }

      // ── Crash recovery + idempotent week start (applied_weeks) ───────────────
      // 'finalized' marker committed atomically with standings means this slot
      // already ran in a previous process — advance it instead of replaying.
      game.db.get(
        "SELECT 1 AS done FROM applied_weeks WHERE season = ? AND slot = ? AND kind = 'finalized'",
        [game.season, game.calendarIndex],
        (finErr: any, finRow: any) => {
          if (finErr) {
            console.error(
              `[${game.roomCode}] ⚠ applied_weeks('finalized') read error — continuing without recovery:`,
              finErr.message,
            );
          } else if (finRow) {
            recoverFinalizedSlot(game, entry);
            segmentRunning[game.roomCode] = false;
            return;
          }
          // O db.get é assíncrono: um Pronto retirado (ou uma equipa que perdeu
          // um jogador) entretanto não pode deixar a semana arrancar.
          if (seatsWaitedFor(game).some((seat) => !seat.intent.ready)) {
            console.warn(`[${game.roomCode}] ⏸ arranque cancelado: Pronto retirado durante a verificação`);
            segmentRunning[game.roomCode] = false;
            return;
          }
          startWeekOnce(game, entry).catch((startErr: any) => {
            console.error(
              `[${game.roomCode}] ❌ Week start failed:`,
              startErr,
            );
          });
        },
      );
      return;
    }

    // ── ET gate → start extra time (cup only) ────────────────────────────────
    if (game.gamePhase === "match_et_gate") {
      if (segmentRunning[game.roomCode]) {
        console.warn(
          `[${game.roomCode}] ⚠ ET gate→ET blocked: segmentRunning is true`,
        );
        return;
      }
      console.log(
        `[${game.roomCode}] ⏩ ET gate acknowledged — starting extra time`,
      );
      segmentRunning[game.roomCode] = true;
      try {
        await continueFromEtGate(game);
      } catch (segErr) {
        console.error(
          `[${game.roomCode}] ❌ Extra time (from ET gate) failed:`,
          segErr,
        );
      } finally {
        segmentRunning[game.roomCode] = false;
      }
      // segmentRunning is now false; safe to auto-advance if all coaches were dismissed.
      if ((game.gamePhase as string) === "lobby") {
        checkAllReady(game);
      }
      return;
    }

    // ── Halftime → second half (league AND cup, identical) ──────────────────
    if (game.gamePhase === "match_halftime") {
      await advanceFromHalftime(game);
      return;
    }
  }

  return {
    checkAllReady,
    runMatchSegment,
    // Superfície de teste (crashRecoveryRegression.mts): acesso direto às ações
    // críticas de idempotência — aplicação das finanças semanais e recovery de
    // slot já finalizado. Não usadas pelo fluxo normal (index.ts).
    applyWeeklyFinancesOnce,
    recoverFinalizedSlot,
    finalizeLeagueEvent,
    recoverSeasonEnd,
  };
}
