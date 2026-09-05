import type { ActiveGame, Tactic, PlayerRow, MatchFixture, MatchSide } from "../types";
import {
  generateJuniorGR,
  withJuniorGRs,
  generateJuniorFieldPlayer,
  ensureFullBench,
  pickBestPlayer,
  weightedPickScorer,
  isPlayerAvailable,
  convertToEmergencyGK,
  getEffectiveSkill,
} from "./playerUtils";
import {
  canMakeSubstitution,
  incrementSubCount,
  RES_NEUTRAL,
  EMERGENCY_GK_SKILL,
} from "../gameConstants";

// Re-export so external files can still import from "./game/engine"
export {
  withJuniorGRs,
  ensureFullBench,
  getEffectiveSkill,
  generateJuniorGR,
  generateJuniorFieldPlayer,
  isPlayerAvailable,
} from "./playerUtils";
import {
  goalPhrase,
  ownGoalPhrase,
  penaltyGoalPhrase,
  penaltyMissPhrase,
  varPhrase,
  yellowPhrase,
  redPhrase,
  injuryPhrase,
  subPhrase,
  emergencyGkPhrase,
  nearMissPhrase,
  bigSavePhrase,
  weatherPhrase,
  extraTimeStartPhrase,
  finalStartPhrase,
  finalGoalPhrase,
  finalEndPhrase,
  tacticStartPhrase,
  secondHalfTacticPhrase,
  computeMatchOdds,
  bettingPhrase,
} from "./commentary";
import {
  clampSkill,
  getWeatherForFixture,
  normaliseStyle,
  isCupFinalRound,
  getAggressivenessValue,
  average,
  selectPenaltyTaker,
  computeSidePower,
  computeOpenPlayGoalProbability,
  quotaFromFormation,
} from "./matchCalculations";
import type { SidePower } from "./matchCalculations";
import type { Rng } from "./matchCalculations";
import { recalcPlayerValue, MATCH_TUNING } from "../gameConstants";
import { getTacticBonus } from "./tacticFamiliarity";

/**
 * API mínima do sqlite3 usada pelo engine (audit: antes era `type Db = any`,
 * o que desligava o typecheck em todos os acessos à BD do módulo).
 * Só run/get/all com callbacks de erro — o resto do sqlite3 não é usado aqui.
 */
export type Db = {
  run(
    sql: string,
    params?: any[],
    callback?: (this: unknown, err: Error | null) => void,
  ): unknown;
  get(
    sql: string,
    params?: any[],
    callback?: (this: unknown, err: Error | null, row?: any) => void,
  ): unknown;
  all(
    sql: string,
    params?: any[],
    callback?: (this: unknown, err: Error | null, rows?: any[]) => void,
  ): unknown;
};

/**
 * Contexto de um segmento simulado (audit: antes `context: any`).
 * `game` é obrigatório — todos os chamadores (liga, Taça, testes) passam-no.
 */
export type SegmentContext = {
  game: ActiveGame;
  io?: any;
  matchweek?: number;
  calendarIndex?: number;
  rng?: Rng;
  onMinute?: (minute: number) => unknown;
  hasHumanInET?: boolean;
};

// Helpers promisificados (a DB é callback-style) — ÚNICA implementação.
// Antes cada função enrolava o seu `new Promise` à mão (~7 cópias).
export function dbRunAsync(db: Db, sql: string, params: any[] = []): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    db.run(sql, params, (err: any) => (err ? reject(err) : resolve()));
  });
}

export function dbAllAsync<T = any>(db: Db, sql: string, params: any[] = []): Promise<T[]> {
  return new Promise<T[]>((resolve, reject) => {
    db.all(sql, params, (err: any, rows: T[]) =>
      err ? reject(err) : resolve(rows || []),
    );
  });
}

export function dbGetAsync<T = any>(
  db: Db,
  sql: string,
  params: any[] = [],
): Promise<T | undefined> {
  return new Promise<T | undefined>((resolve, reject) => {
    db.get(sql, params, (err: any, row: T) =>
      err ? reject(err) : resolve(row ?? undefined),
    );
  });
}

// ── Deltas pós-jogo (fix #2: flush transacional) ─────────────────────────────
// Durante a simulação, golos/cartões/lesões/presenças NÃO escrevem na DB.
// São acumulados por fixture e descarregados de uma vez por
// queueMatchDeltaWrites(), dentro da transação atómica do apito final
// (finalizeLeagueEvent / finalizeCupRound), junto às classificações e ao
// marker 'finalized'. Assim um crash a meio do jogo nunca deixa contadores
// de jogadores a meio sem o resultado correspondente.
type MatchInjuryDelta = {
  newSkill: number;
  injuryUntil: number;
  oldSkill: number;
  count: number;
  matchweek: number;
  season: number;
};

type MatchDeltas = {
  calendarIndex: number;
  appearances: Set<number>;
  goals: Map<number, number>;
  reds: Map<number, number>; // playerId -> suspensionUntil
  injuries: Map<number, MatchInjuryDelta>;
};

function getMatchDeltas(fixture: MatchFixture): MatchDeltas {
  if (!fixture._deltas) {
    fixture._deltas = {
      calendarIndex: 0,
      appearances: new Set<number>(),
      goals: new Map<number, number>(),
      reds: new Map<number, number>(),
      injuries: new Map<number, MatchInjuryDelta>(),
    };
  }
  return fixture._deltas;
}

function recordMatchGoal(fixture: MatchFixture, playerId: number) {
  if (typeof playerId !== "number" || playerId <= 0) return; // juniores (IDs negativos) não têm linha na DB
  const d = getMatchDeltas(fixture);
  d.goals.set(playerId, (d.goals.get(playerId) ?? 0) + 1);
}

function recordMatchRed(
  fixture: MatchFixture,
  playerId: number,
  suspensionUntil: number,
) {
  if (typeof playerId !== "number" || playerId <= 0) return;
  const d = getMatchDeltas(fixture);
  const prev = d.reds.get(playerId);
  d.reds.set(playerId, prev != null ? Math.max(prev, suspensionUntil) : suspensionUntil);
}

function recordMatchInjury(
  fixture: MatchFixture,
  playerId: number,
  injury: Omit<MatchInjuryDelta, "count">,
) {
  if (typeof playerId !== "number" || playerId <= 0) return;
  const d = getMatchDeltas(fixture);
  const prev = d.injuries.get(playerId);
  d.injuries.set(playerId, {
    ...injury,
    // Segunda lesão do mesmo jogador no mesmo jogo: acumula o contador,
    // mantém o skill/injuryUntil mais recentes.
    count: (prev?.count ?? 0) + 1,
  });
}

function recordMatchAppearances(
  fixture: MatchFixture,
  playerIds: number[],
  calendarIndex: number,
) {
  const d = getMatchDeltas(fixture);
  d.calendarIndex = calendarIndex;
  for (const id of playerIds) {
    if (typeof id === "number" && id > 0) d.appearances.add(id);
  }
}

/**
 * Descarrega os deltas acumulados de todos os fixtures para a DB.
 * NÃO gere transação — emite os UPDATEs/INSERTs ordenados na conexão dada,
 * para o chamador os embrulhar na sua transação atómica do apito final.
 * Os `fixture._deltas` só são libertados quando TODOS os writes confirmam
 * (antes limpavam-se ao enfileirar — uma morte entre o enqueue e o COMMIT
 * perdia golos/vermelhos/lesões sem hipótese de replay). A flag
 * `_deltasQueued` impede duplo enqueue enquanto o flush está em curso.
 */
export function queueMatchDeltaWrites(db: Db, fixtures: MatchFixture[]): void {
  for (const fixture of fixtures || []) {
    const d: MatchDeltas | undefined = fixture?._deltas;
    if (!d || fixture._deltasQueued) continue;
    fixture._deltasQueued = true;

    let pending = 0;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      fixture._deltas = undefined;
      fixture._deltasQueued = false;
    };
    // Todos os db.run são emitidos de forma síncrona abaixo; cada callback
    // decrementa — quando chegam todos, os deltas podem ser libertados.
    // O callback corre mesmo em erro do sqlite: reporta e conta na mesma,
    // para o flush completar em vez de pendurar a flag para sempre.
    const trackedRun = (sql: string, params: any[]) => {
      pending++;
      db.run(sql, params, (err: unknown) => {
        if (err)
          console.error(
            `[engine] delta write falhou (${sql.slice(0, 60)}…):`,
            err,
          );
        pending--;
        if (pending === 0) finish();
      });
    };

    try {

      if (d.appearances.size > 0 && d.calendarIndex > 0) {
        const ids = [...d.appearances];
        const ph = ids.map(() => "?").join(",");
        trackedRun(
          // Guard anti-replay: igual ao incremento imediato anterior — um flush
          // repetido do mesmo slot nunca conta presenças a dobrar.
          `UPDATE players SET games_played = games_played + 1, last_appearance_matchweek = MAX(last_appearance_matchweek, ?) WHERE id IN (${ph}) AND COALESCE(last_appearance_matchweek, 0) < ?`,
          [d.calendarIndex, d.calendarIndex, ...ids],
        );
      }
      for (const [id, count] of d.goals) {
        trackedRun(
          "UPDATE players SET goals = goals + ?, career_goals = career_goals + ? WHERE id = ?",
          [count, count, id],
        );
      }
      for (const [id, until] of d.reds) {
        trackedRun(
          "UPDATE players SET red_cards = red_cards + 1, career_reds = career_reds + 1, suspension_games = suspension_games + 2, suspension_until_matchweek = CASE WHEN suspension_until_matchweek > ? THEN suspension_until_matchweek ELSE ? END WHERE id = ?",
          [until, until, id],
        );
      }
      for (const [id, inj] of d.injuries) {
        trackedRun(
          "UPDATE players SET injuries = injuries + ?, career_injuries = career_injuries + ?, prev_skill = skill, skill = ?, injury_until_matchweek = CASE WHEN injury_until_matchweek > ? THEN injury_until_matchweek ELSE ? END WHERE id = ?",
          [inj.count, inj.count, inj.newSkill, inj.injuryUntil, inj.injuryUntil, id],
        );
        trackedRun(
          "INSERT OR REPLACE INTO player_skill_snapshots (player_id, matchweek, season, skill) VALUES (?, ?, ?, ?)",
          [id, inj.matchweek, inj.season, inj.oldSkill],
        );
      }
      // Fixture sem writes (deltas vazios): sem callbacks, libertar já.
      if (pending === 0) finish();
    } catch (err) {
      // Throw síncrono a meio da emissão (ex.: DB fechada): repor a flag
      // para a próxima tentativa não ser ignorada — os deltas ficam retidos.
      console.error("[engine] flush de deltas interrompido:", err);
      fixture._deltasQueued = false;
    }
  }
}

type MatchFatigueSnapshot = {
  matchMinutes: number;
  fatigueLoss: number;
};

export function getMatchFatigueSnapshot(
  fixture: MatchFixture,
  side: MatchSide,
  playerId: number,
): MatchFatigueSnapshot {
  return {
    matchMinutes: Number(fixture._minutesPlayed?.[side]?.[playerId] ?? 0),
    fatigueLoss: Number(fixture._fatigueLoss?.[side]?.[playerId] ?? 0),
  };
}

/**
 * Snapshot de lineup (titulares + suplentes) para exibição no cliente — ÚNICA
 * implementação (fix #7). Havia 3 cópias (engine, weeklyFlowHelpers ×2) que
 * divergiram (ex. skill bruto vs. efetiva). Usa sempre a skill efetiva em jogo.
 */
export function buildLineupSnapshot(
  fixture: MatchFixture,
  squad: PlayerRow[],
  tactic: Tactic | null,
  fullRoster: PlayerRow[] | undefined,
  side: MatchSide,
) {
  const starterIds = new Set(squad.map((p: any) => p.id));
  const starters = squad.map((p) => ({
    id: p.id,
    name: p.name,
    position: p.position,
    is_star: p.is_star || 0,
    skill: getEffectiveSkill(p),
    ...getMatchFatigueSnapshot(fixture, side, p.id),
    is_starter: true,
  }));
  const bench = (fullRoster || [])
    .filter(
      (p: any) =>
        !starterIds.has(p.id) &&
        (!tactic?.positions || tactic.positions[p.id] === "Suplente"),
    )
    .map((p: any) => ({
      id: p.id,
      name: p.name,
      position: p.position,
      is_star: p.is_star || 0,
      skill: getEffectiveSkill(p),
      ...getMatchFatigueSnapshot(fixture, side, p.id),
      is_starter: false,
    }));
  return [...starters, ...bench];
}

/**
 * Snapshot do fixture para os payloads das ações de jogo (5 chamadas a
 * waitForMatchAction repetiam este bloco — ÚNICA implementação).
 */
export function buildFixtureData(
  fixture: MatchFixture,
): Record<string, unknown> {
  return {
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    attendance: fixture.attendance,
    referee: fixture.referee,
    homePossession: fixture.homePossession,
    awayPossession: fixture.awayPossession,
    homeGoals: fixture.finalHomeGoals,
    awayGoals: fixture.finalAwayGoals,
    events: fixture.events || [],
  };
}

/**
 * Cartão de jogador para as janelas de ação (penálti, lesão, subs, GR).
 * ÚNICA implementação — antes cada chamada construía o objeto à mão, com
 * campos inconsistentes (umas com resistance/form/is_star, outras sem).
 * `detailed=false` + `fatigue=false` reproduz o cartão mínimo do penálti.
 */
export function buildPlayerCard(
  p: PlayerRow,
  fixture: MatchFixture,
  side: MatchSide,
  opts: { detailed?: boolean; fatigue?: boolean } = {},
): Record<string, unknown> {
  const { detailed = true, fatigue = true } = opts;
  return {
    id: p.id,
    name: p.name,
    position: p.position,
    skill: getEffectiveSkill(p),
    ...(detailed
      ? { resistance: p.resistance, form: p.form, is_star: p.is_star }
      : {}),
    ...(fatigue ? getMatchFatigueSnapshot(fixture, side, p.id) : {}),
  };
}

export async function getTeamSquad(
  db: Db,
  teamId: number,
  tactic: Tactic | null,
  currentMatchweek = 1,
): Promise<PlayerRow[]> {
  const rows = await dbAllAsync<PlayerRow>(
    db,
    "SELECT * FROM players WHERE team_id = ?",
    [teamId],
  );

  // Build available roster and inject juniors: withJuniorGRs guarantees a
  // GR, ensureFullBench tops up the pool to 2 GR + 16 field players so the
  // best-XI auto-pick below can never return a lineup shorter than 11.
  const availableReal = (rows || []).filter((p) =>
    isPlayerAvailable(p, currentMatchweek),
  );
      const availableRows = ensureFullBench(
        withJuniorGRs(availableReal, teamId, currentMatchweek),
        teamId,
        currentMatchweek,
      );

      // If tactic has explicit position assignments, use them
      if (tactic && tactic.positions) {
        const picked = availableRows.filter(
          (p) => tactic.positions[p.id] === "Titular",
        );
        if (picked.length === 11) return picked;
      }

      // Auto-pick best 11 based on formation
      const sorted = [...availableRows].sort((a, b) => getEffectiveSkill(b) - getEffectiveSkill(a));
      const lineup = [];
      const formationStr =
        tactic && tactic.formation ? tactic.formation : "4-4-2";
      const parts = formationStr.split("-");
      const positions = {
        GR: 1,
        DEF: parseInt(parts[0], 10),
        MED: parseInt(parts[1], 10),
        ATA: parseInt(parts[2], 10),
      };
      const currentPos = { GR: 0, DEF: 0, MED: 0, ATA: 0 };

      sorted.forEach((p) => {
        if (currentPos[p.position] < positions[p.position]) {
          lineup.push(p);
          currentPos[p.position]++;
        }
      });

      if (lineup.length < 11) {
        const missing = 11 - lineup.length;
        // Never fill with a 2nd GK — that causes the 2-GK bug
        const remaining = sorted.filter(
          (p) => !lineup.includes(p) && p.position !== "GR",
        );
        lineup.push(...remaining.slice(0, missing));
      }

      return lineup;
}

/**
 * Defensive guarantee applied whenever a fresh on-pitch squad is built:
 * the starting XI must contain at least 1 available GR and 10 available field
 * players. Existing squad members are kept untouched; missing slots are topped
 * up with junior players from an ensureFullBench pool. Never used to re-add
 * players mid-match — only when the squad is first built (or restored).
 */
function ensureStartingXI(
  squad: PlayerRow[],
  teamId: number,
  matchweek: number,
  formation?: string | null,
): PlayerRow[] {
  const avail = (squad || []).filter((p) => isPlayerAvailable(p, matchweek));
  const grCount = avail.filter((p) => p.position === "GR").length;
  const fieldCount = avail.length - grCount;
  if (grCount >= 1 && fieldCount >= 10) return squad;

  const pool = ensureFullBench(
    withJuniorGRs(squad || [], teamId, matchweek),
    teamId,
    matchweek,
  );
  const inSquad = new Set((squad || []).map((p) => p.id));
  const result = [...(squad || [])];
  const quota = quotaFromFormation(formation);
  const currentPos = { GR: grCount, DEF: 0, MED: 0, ATA: 0 };
  for (const p of result) {
    if (p.position !== "GR" && quota[p.position] != null) {
      currentPos[p.position]++;
    }
  }

  const candidates = [...pool]
    .filter((p) => !inSquad.has(p.id))
    .sort((a, b) => getEffectiveSkill(b) - getEffectiveSkill(a));

  for (const p of candidates) {
    if (result.length >= 11) break;
    if (currentPos[p.position] < quota[p.position]) {
      result.push(p);
      currentPos[p.position]++;
    }
  }
  if (result.length < 11) {
    const missing = 11 - result.length;
    const remaining = candidates.filter(
      (p) => !result.includes(p) && p.position !== "GR",
    );
    result.push(...remaining.slice(0, missing));
  }
  return result;
}

// Gera fixtures para uma divisão usando um calendário determinístico com
// alternância rígida de casa/fora para todas as equipas.
//
// Algoritmo: circle method com padrão C/F fixo por posição e jornada.
//   seeds[0] é o pivot (fixo); seeds[1..n-1] rodam a cada jornada.
//   Par i na jornada r: se (i + r) % 2 === 0 → seeds[i] em casa, senão fora.
//   Segunda volta: inverter C/F de cada par da primeira volta correspondente.
//
// Se seeds estiver vazio, faz query à DB ordenada por id (1ª época).
export async function generateFixturesForDivision(
  db: Db,
  division: number,
  matchweek: number,
  seeds: number[],
): Promise<MatchFixture[]> {
  // Se não há seeds, buscar equipas da DB ordenadas (sem embaralhar).
  // Em erro de DB, devolve [] (sem equipas não há fixtures).
  let seedIds =
    seeds.length > 0
      ? seeds
      : await dbAllAsync<{ id: number }>(
          db,
          "SELECT id FROM teams WHERE division = ? ORDER BY id",
          [division],
        ).then(
          (rows) => (rows && rows.length >= 2 ? rows.map((r) => r.id) : []),
          () => [],
        );

  const n = seedIds.length;
  if (n < 2) return [];

  const totalRounds = n - 1; // jornadas na primeira volta
  const totalMatchweeks = totalRounds * 2;
  const normMw = ((matchweek - 1) % totalMatchweeks) + 1;
  const isSecondLeg = normMw > totalRounds;
  // round 0-indexed dentro da volta
  const round = isSecondLeg ? normMw - totalRounds - 1 : normMw - 1;

  // Rotação circle method: seeds[0] fixo, seeds[1..] rodam
  const rotating = seedIds.slice(1);
  const rotated: number[] = [];
  for (let i = 0; i < rotating.length; i++) {
    rotated.push(rotating[(i + round) % rotating.length]);
  }
  const allIds = [seedIds[0], ...rotated];

  const fixtures: MatchFixture[] = [];
  for (let i = 0; i < Math.floor(n / 2); i++) {
    const a = allIds[i];
    const b = allIds[n - 1 - i];

    // Padrão C/F alternado: cada equipa tem alternância perfeita
    let homeId: number;
    let awayId: number;
    // Encontrar posição da equipa no seeds original
    const teamIndexInSeed = seedIds.indexOf(a);
    const isSecondLegMatchweek = isSecondLeg ? 1 : 0;
    const aIsHome = (teamIndexInSeed + round + isSecondLegMatchweek) % 2 === 0;
    if (aIsHome) {
      homeId = a;
      awayId = b;
    } else {
      homeId = b;
      awayId = a;
    }

    fixtures.push({
      homeTeamId: homeId,
      awayTeamId: awayId,
      finalHomeGoals: 0,
      finalAwayGoals: 0,
      events: [],
    });
  }

  return fixtures;
}

function getCurrentPlayerState(game: ActiveGame, teamId: number) {
  return Object.values(game.playersByName).find(
    (p) => p.teamId === teamId && p.socketId,
  );
}

/**
 * Mapa de ações de jogo pendentes (ÚNICO acesso — cria on-demand).
 * Várias janelas podem coexistir (jogos diferentes na mesma sala), por isso
 * a chave é o actionId e não um slot único no game.
 */
/** Entrada do mapa de ações pendentes (audit: antes Map<string, any>). */
export type PendingMatchAction = {
  actionId: string;
  type: string;
  teamId: number;
  timer: ReturnType<typeof setTimeout>;
  finalize: (choice: MatchActionChoice, source?: string) => void;
  fallback: () => MatchActionChoice;
  // Notify-once no reconnect (socketSessionHandlers): o timer continua vivo
  // como rede de segurança e só se notifica o cliente, sem consumir a ação.
  expiredNotified?: boolean;
};

export function getPendingMatchActions(
  game: ActiveGame,
): Map<string, PendingMatchAction> {
  let map = game.pendingMatchActions;
  if (!(map instanceof Map)) {
    map = new Map();
    game.pendingMatchActions = map;
  }
  return map;
}

/** Espreita sem remover (para validar teamId antes de consumir). */
export function peekPendingMatchAction(
  game: ActiveGame,
  actionId: string,
): PendingMatchAction | undefined {
  const map = game.pendingMatchActions;
  return map instanceof Map ? map.get(actionId) : undefined;
}

/**
 * Consome a ação: remove do mapa + clearTimeout. Idempotente — resolve
 * undefined se já tiver sido finalizada (timeout, disconnect, leave).
 */
export function takePendingMatchAction(
  game: ActiveGame,
  actionId: string,
): PendingMatchAction | undefined {
  const map = game.pendingMatchActions;
  if (!(map instanceof Map)) return undefined;
  const pa = map.get(actionId);
  if (pa) {
    if (pa.timer) clearTimeout(pa.timer);
    map.delete(actionId);
  }
  return pa;
}

/** Todas as ações pendentes de uma equipa (para disconnect/leave em lote). */
export function listTeamMatchActions(
  game: ActiveGame,
  teamId: number,
): PendingMatchAction[] {
  const map = game.pendingMatchActions;
  if (!(map instanceof Map)) return [];
  return [...map.values()].filter((pa) => pa && pa.teamId === teamId);
}

function waitForMatchAction({
  game,
  io,
  type,
  teamId,
  payload,
  timeoutMs,
  fallback,
  fixtureData,
}: {
  game: ActiveGame;
  io: any;
  type: string;
  teamId: number;
  payload: Record<string, unknown>;
  timeoutMs: number;
  fallback: () => MatchActionChoice;
  fixtureData?: Record<string, unknown>;
}): Promise<{ choice: MatchActionChoice; source: string }> {
  const humanCoach = getCurrentPlayerState(game, teamId);
  if (!humanCoach) {
    return Promise.resolve({ choice: fallback(), source: "auto" });
  }

  return new Promise<{ choice: MatchActionChoice; source: string }>((resolve) => {
    const actionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const finalize = (choice, source = "auto") => {
      // Idempotente: timeout/disconnect/leave podem já ter consumido a ação.
      takePendingMatchAction(game, actionId);
      io.to(game.roomCode).emit("matchActionResolved", {
        actionId,
        teamId,
        source,
      });
      // Quando a pausa de substituição termina, notificar todos os jogadores
      if (type === "user_substitution") {
        io.to(game.roomCode).emit("substitutionPauseEnded", { teamId });
      }
      resolve({ choice, source });
    };

    const timer = setTimeout(() => {
      finalize(fallback(), "auto");
    }, timeoutMs);

    getPendingMatchActions(game).set(actionId, {
      actionId,
      type,
      teamId,
      timer,
      finalize,
      fallback,
    });

    io.to(game.roomCode).emit("matchActionRequired", {
      actionId,
      type,
      teamId,
      ...payload,
      ...(fixtureData || {}),
    });
  });
}

// Normaliza a escolha de qualquer ação de jogo para { playerOut, playerIn }.
// Contrato com o cliente (ver resolveMatchAction em socketGameplayHandlers):
//   - subs (user_substitution/injury/gk_red_card) → objeto { playerOut, playerIn };
//   - escolha única (penalty/emergency_gk) → id nu (payload.playerId) ou
//     objeto { playerId } por robustez;
//   - fallbacks automáticos → qualquer uma das formas acima ou null.
// Devolve nulls nas partes em falta.
export type MatchActionChoice =
  | {
      playerOut?: number | null;
      playerIn?: number | null;
      playerId?: number | null;
    }
  | number
  | null
  | undefined;

export function normalizeMatchChoice(
  choice: MatchActionChoice,
): { playerOut: number | null; playerIn: number | null } {
  if (typeof choice === "number") {
    return { playerOut: null, playerIn: choice };
  }
  if (choice != null && typeof choice === "object") {
    return {
      playerOut: choice.playerOut ?? null,
      playerIn: choice.playerIn ?? choice.playerId ?? null,
    };
  }
  return { playerOut: null, playerIn: null };
}

export function normalizeMatchChoices(
  choice: MatchActionChoice | MatchActionChoice[],
): { playerOut: number | null; playerIn: number | null }[] {
  if (Array.isArray(choice)) {
    return (choice as MatchActionChoice[])
      .map((c) => normalizeMatchChoice(c))
      .filter((c) => c.playerOut != null && c.playerIn != null);
  }
  const single = normalizeMatchChoice(choice as MatchActionChoice);
  if (single.playerOut != null && single.playerIn != null) return [single];
  return [];
}

/**
 * Versão da força de um lado — dirty-flag para o computeSidePower.
 * Qualquer mutação do onze em campo (sub, expulsão, lesão, fadiga,
 * conversão em GR improvisado) faz bumpPowerVersion; o loop de minutos
 * recalcula a força só quando a versão muda.
 */
/** Rótulo pt-PT da mentalidade normalizada para o direto. */
function styleDisplayLabel(style: string): string {
  if (style === "OFENSIVO") return "Ofensivo";
  if (style === "DEFENSIVO") return "Defensivo";
  return "Equilibrado";
}

/**
 * Adota tática/mentalidade live do treinador a meio do segmento (efeito
 * prático no minuto seguinte, sem re-simular o passado).
 * O setTactic do cliente SUBSTITUI playerState.tactic (objeto novo), por isso
 * a referência fotografada no início do segmento (fixture._t1/_t2 + params da
 * simulação) fica obsoleta. Corre no topo de cada minuto e funde o objeto
 * live para as referências da engine:
 * - formação/estilo → adotados + bumpPowerVersion (força recalculada no
 *   minuto); o chamador refresca ainda a familiaridade para a nova tática;
 * - labels Titular/Suplente → fundidas para janelas futuras, mas o XI nunca
 *   muda aqui: a verdade de jogo prevalece (XI atual = Titular,
 *   expulsos/lesionados/substituídos removidos).
 * Devolve { formation, style } quando formação/estilo mudaram, senão null.
 */
export function adoptLiveTactic(
  game: ActiveGame,
  fixture: MatchFixture,
  side: MatchSide,
  tactic: Tactic | null,
  lineupIds: Set<number>,
): { formation: string; style: string } | null {
  const teamId = side === "home" ? fixture.homeTeamId : fixture.awayTeamId;
  const coachState: any = Object.values(game.playersByName || {}).find(
    (p: any) => p && (p as any).teamId === teamId,
  );
  const live = coachState?.tactic;
  if (!live || typeof live !== "object" || live === tactic) return null;
  const canonical = side === "home" ? fixture._t1 : fixture._t2;
  const refs = new Set<any>([tactic, canonical].filter(Boolean));
  if (refs.size === 0) return null;
  const newFormation =
    typeof live.formation === "string" && live.formation
      ? live.formation
      : null;
  // Fallback para o evento do direto: se a formação vier omissa mas o estilo
  // mudou, anunciar a formação vigente em vez de "null".
  const currentFormation =
    (tactic as any)?.formation ||
    (canonical as any)?.formation ||
    "4-4-2";
  const newStyle = normaliseStyle(live.style);
  let tacticalChange = false;
  for (const ref of refs) {
    if (newFormation && ref.formation !== newFormation) {
      ref.formation = newFormation;
      tacticalChange = true;
    }
    if (newStyle && normaliseStyle(ref.style) !== newStyle) {
      ref.style = live.style;
      tacticalChange = true;
    }
    if (live.positions && typeof live.positions === "object") {
      const merged: Record<string, string> = { ...(ref.positions || {}) };
      for (const [id, status] of Object.entries(live.positions)) {
        if (status === "Suplente" || status === "Titular")
          merged[id] = status as string;
      }
      ref.positions = merged;
    }
  }
  // Verdade de jogo sobre os labels: o XI atual é sempre Titular e quem
  // saiu (vermelho/lesão/substituído) nunca volta via labels.
  const truthRef: any = canonical || tactic;
  if (truthRef && truthRef.positions) {
    const unavailable = new Set<number>();
    for (const e of fixture.events || []) {
      if (
        ((e as any).type === "red" || (e as any).type === "injury") &&
        (e as any).team === side &&
        (e as any).playerId != null
      ) {
        unavailable.add(Number((e as any).playerId));
      }
    }
    const subbedOut = (fixture as any)._subbedOut;
    if (subbedOut instanceof Set) {
      for (const id of subbedOut) unavailable.add(Number(id));
    }
    for (const id of unavailable) {
      delete truthRef.positions[id];
      delete truthRef.positions[String(id)];
    }
    for (const id of lineupIds) {
      truthRef.positions[id] = "Titular";
    }
  }
  if (tacticalChange) bumpPowerVersion(fixture, side);
  return tacticalChange
    ? { formation: newFormation ?? currentFormation, style: newStyle }
    : null;
}

export function getPowerVersion(fixture: MatchFixture, side: MatchSide): number {
  return Number(
    side === "home" ? (fixture._homePowerV ?? 0) : (fixture._awayPowerV ?? 0),
  );
}

function bumpPowerVersion(fixture: MatchFixture, side: MatchSide): void {
  if (side === "home") fixture._homePowerV = getPowerVersion(fixture, side) + 1;
  else fixture._awayPowerV = getPowerVersion(fixture, side) + 1;
}

/**
 * Sincroniza as táticas após uma saída/entrada em campo, para que
 * applyHalftimeSubs/applyETSubs não desfaçam substituições forçadas quando a
 * fase seguinte começa. Sincroniza fixture._t1/_t2 E coachState (no caso comum
 * são o mesmo objeto; quando diferem — ex. NPC sem coach — ambos importam).
 */
function syncTacticPositions(
  game: ActiveGame,
  fixture: MatchFixture,
  side: MatchSide,
  teamId: number,
  outIds: number[],
  inIds: number[],
) {
  const tacticRef = side === "home" ? fixture._t1 : fixture._t2;
  if (tacticRef?.positions) {
    for (const id of outIds) delete tacticRef.positions[id];
    for (const id of inIds) tacticRef.positions[id] = "Titular";
  }
  const coachState = Object.values(game.playersByName).find(
    (p: any) => (p as any).teamId === teamId,
  ) as any;
  if (coachState?.tactic?.positions) {
    for (const id of outIds) delete coachState.tactic.positions[id];
    for (const id of inIds) coachState.tactic.positions[id] = "Titular";
  }
}

/**
 * Remove um jogador de campo sem reposição (lesão sem subs restantes,
 * expulsão, GR expulso antes do improvisado). Sincroniza squad, lineupIds,
 * _subbedOut (expulsos/lesados nunca voltam como suplentes), snapshot de
 * lineup e táticas — o bloco antes copiado em ~4 sítios (fix #7).
 */
function removeFromPitch({
  fixture,
  game,
  side,
  squad,
  lineupIds,
  outId,
}: {
  fixture: MatchFixture;
  game: ActiveGame;
  side: MatchSide;
  squad: PlayerRow[];
  lineupIds: Set<number>;
  outId: number;
}) {
  const idx = squad.findIndex((p: any) => p.id === outId);
  if (idx > -1) squad.splice(idx, 1);
  lineupIds.delete(outId);
  (fixture._subbedOut ??= new Set<number>()).add(outId);

  const lineupRef = side === "home" ? fixture.homeLineup : fixture.awayLineup;
  if (lineupRef) {
    const li = lineupRef.findIndex((p: any) => p.id === outId);
    if (li > -1) lineupRef.splice(li, 1);
  }

  const teamId = side === "home" ? fixture.homeTeamId : fixture.awayTeamId;
  syncTacticPositions(game, fixture, side, teamId, [outId], []);
  bumpPowerVersion(fixture, side);
}

/**
 * Troca um jogador em campo por outro (substituição normal, lesão com
 * reposição, sacrificado do GR expulso). Com countSub=true conta para o
 * limite de substituições da partida (expulsões não contam — regra oficial).
 * O bloco antes copiado em 3 sítios (fix #7).
 */
function swapOnPitch({
  fixture,
  game,
  side,
  squad,
  lineupIds,
  outId,
  incoming,
  countSub = false,
}: {
  fixture: MatchFixture;
  game: ActiveGame;
  side: MatchSide;
  squad: PlayerRow[];
  lineupIds: Set<number>;
  outId: number;
  incoming: PlayerRow;
  countSub?: boolean;
}) {
  const teamId = side === "home" ? fixture.homeTeamId : fixture.awayTeamId;
  const idx = squad.findIndex((p: any) => p.id === outId);
  if (idx > -1) squad.splice(idx, 1, incoming);
  lineupIds.delete(outId);
  lineupIds.add(incoming.id);
  (fixture._subbedOut ??= new Set<number>()).add(outId);
  if (countSub) incrementSubCount(fixture, teamId);

  const lineupRef = side === "home" ? fixture.homeLineup : fixture.awayLineup;
  if (lineupRef) {
    const li = lineupRef.findIndex((p: any) => p.id === outId);
    if (li > -1) {
      lineupRef[li] = {
        id: incoming.id,
        name: incoming.name,
        position: incoming.position,
        is_star: incoming.is_star || 0,
        skill: getEffectiveSkill(incoming),
        ...getMatchFatigueSnapshot(fixture, side, incoming.id),
      };
    }
  }

  syncTacticPositions(game, fixture, side, teamId, [outId], [incoming.id]);
  bumpPowerVersion(fixture, side);
}

/**
 * GR improvisado — regra do futebol profissional: quando o GR em campo sai
 * (expulsão ou lesão) e não há outro GR disponível, um jogador de campo
 * calça as luvas até ao fim do jogo (skill no piso de emergência).
 *
 * Abre a ação `emergency_gk` para o treinador escolher quem vai para a
 * baliza (fallback: o mais fraco em campo). O escolhido é CONVERTIDO na
 * `squad` (clone com position GR + skill piso) — sem gastar substituição,
 * sem alterar a posição real na DB. O resultado: a equipa joga com menos
 * um jogador, mas SEMPRE com alguém na baliza.
 *
 * Espera que o jogador que saiu já tenha sido removido de `squad`/
 * lineup pelo caller (o `outPlayer` serve para o payload da UI).
 */
async function openEmergencyGKAction({
  fixture,
  squad,
  side,
  teamId,
  io,
  game,
  minute,
  emergencyCandidates,
  outPlayer,
  benchPlayers = [],
}: {
  fixture: any;
  squad: any[];
  side: MatchSide;
  teamId: number;
  io: any;
  game: ActiveGame;
  minute: number;
  emergencyCandidates: any[];
  outPlayer: any;
  benchPlayers?: any[];
}) {
  const weakest = () =>
    [...emergencyCandidates].sort(
      (a, b) => (getEffectiveSkill(a) || 0) - (getEffectiveSkill(b) || 0),
    )[0];
  const fallback = () => weakest()?.id ?? null;

  const result = await waitForMatchAction({
    game,
    io,
    type: "emergency_gk",
    teamId,
    payload: {
      minute,
      teamId,
      injuredPlayer: outPlayer,
      onPitch: emergencyCandidates.map((p) => buildPlayerCard(p, fixture, side)),
      benchPlayers: benchPlayers.map((p) => buildPlayerCard(p, fixture, side)),
      currentScore: {
        home: fixture.finalHomeGoals,
        away: fixture.finalAwayGoals,
      },
    },
    timeoutMs: MATCH_TUNING.actionTimeoutMs,
    fallback,
    fixtureData: buildFixtureData(fixture),
  });

  const { playerIn: choiceId } = normalizeMatchChoice(result.choice);
  const chosen =
    (choiceId != null &&
      emergencyCandidates.find((p) => p.id === choiceId)) ||
    weakest() ||
    null;
  if (!chosen) return null;

  // Converte o escolhido na squad (clone — a referência original fica intacta;
  // o jogador mantém o mesmo id em campo, por isso lineupIds não muda).
  const ci = squad.findIndex((p: any) => p.id === chosen.id);
  const converted = convertToEmergencyGK(chosen);
  if (ci > -1) squad[ci] = converted;
  bumpPowerVersion(fixture, side);

  // Snapshot de lineup: o escolhido passa a constar como GR (skill piso).
  const lineupRef = side === "home" ? fixture.homeLineup : fixture.awayLineup;
  if (lineupRef) {
    const li = lineupRef.findIndex((p: any) => p.id === chosen.id);
    if (li > -1) {
      lineupRef[li] = {
        ...lineupRef[li],
        position: "GR",
        skill: EMERGENCY_GK_SKILL,
      };
    }
  }

  // Táticas sincronizadas: o escolhido mantém-se titular (as fases seguintes
  // não podem desfazer isto).
  const tacticRef = side === "home" ? fixture._t1 : fixture._t2;
  if (tacticRef?.positions) {
    tacticRef.positions[chosen.id] = "Titular";
  }
  const coachState = Object.values(game.playersByName).find(
    (p: any) => (p as any).teamId === teamId,
  ) as any;
  if (coachState?.tactic?.positions) {
    coachState.tactic.positions[chosen.id] = "Titular";
  }

  fixture.events.push({
    minute,
    type: "emergency_gk",
    team: side,
    emoji: "🧤",
    playerId: chosen.id,
    playerName: chosen.name,
    text: `[${minute}'] 🧤 ${emergencyGkPhrase(chosen.name)}`,
  });

  return converted;
}

async function applyInjuryEvent({
  fixture,
  teamSide,
  squad,
  fullRoster,
  lineupIds,
  currentMatchweek,
  io,
  game,
  rng = Math.random,
}: {
  fixture: MatchFixture;
  teamSide: "home" | "away";
  squad: PlayerRow[];
  fullRoster: PlayerRow[];
  lineupIds: Set<number>;
  currentMatchweek: number;
  io: any;
  game: ActiveGame;
  rng?: Rng;
}) {
  if (!squad.length) return { replaced: false, injuredPlayer: null };

  const injuredPlayer = squad[Math.floor(rng() * squad.length)];
  const severityRoll = rng();
  let injuryWeeks;
  let injuryLabel;
  if (severityRoll < MATCH_TUNING.injurySevereShare) {
    // Grave: 3–8 semanas, incomum
    injuryWeeks =
      MATCH_TUNING.injurySevereMinWeeks +
      Math.floor(rng() * MATCH_TUNING.injurySevereExtraWeeks);
    injuryLabel = "grave";
  } else {
    // Leve: 1 semana (afasta da próxima convocatória), comum
    injuryWeeks = 1;
    injuryLabel = "leve";
  }

  const injuryUntil = currentMatchweek + injuryWeeks;
  const qualityLoss =
    injuryLabel === "grave"
      ? MATCH_TUNING.injurySevereLossBase +
        Math.floor(rng() * MATCH_TUNING.injurySevereLossExtra)
      : 0;
  const oldSkill = injuredPlayer.skill ?? 0;
  const newSkill = Math.max(1, oldSkill - qualityLoss);
  // Acumulado em memória — o flush transacional no apito final aplica o
  // UPDATE + snapshot de skill atomicamente com o resultado do jogo.
  recordMatchInjury(fixture, injuredPlayer.id, {
    newSkill,
    injuryUntil,
    oldSkill,
    matchweek: currentMatchweek,
    season: game.season || 1,
  });

  fixture.events.push({
    minute: fixture._minute,
    type: "injury",
    team: teamSide,
    emoji: "🚑",
    playerId: injuredPlayer.id,
    playerName: injuredPlayer.name,
    text: `[${fixture._minute}'] 🚑 ${injuryPhrase(injuredPlayer.name, injuryLabel)}`,
    severity: injuryLabel,
  });

  const teamId = teamSide === "home" ? fixture.homeTeamId : fixture.awayTeamId;

  // Sem substituições restantes: a equipa fica obrigatoriamente a jogar com
  // menos um jogador (o lesado sai sem reposição — regra oficial).
  if (!canMakeSubstitution(fixture, teamId)) {
    // Notifica o treinador que a equipa passa a jogar com menos um jogador.
    io.to(game.roomCode).emit("substitutionCapReached", { teamId });
    removeFromPitch({
      fixture,
      game,
      side: teamSide,
      squad,
      lineupIds,
      outId: injuredPlayer.id,
    });

    // Último GR sai sem reposição → jogador de campo calça as luvas
    // (GR improvisado, skill piso). A equipa fica a jogar com menos um,
    // mas SEMPRE com alguém na baliza.
    if (injuredPlayer.position === "GR") {
      const emergencyCandidates = squad.filter(
        (p: any) => p.position !== "GR",
      );
      const benchList = (fullRoster || squad).filter(
        (p: any) => !lineupIds.has(p.id),
      );

      await openEmergencyGKAction({
        fixture,
        squad,
        side: teamSide,
        teamId,
        io,
        game,
        minute: fixture._minute,
        emergencyCandidates,
        outPlayer: buildPlayerCard(injuredPlayer, fixture, teamSide),
        benchPlayers: benchList,
      });
    }

    return { replaced: false, injuredPlayer, replacement: null };
  }

  // Only show players who were explicitly chosen as "Suplente" in the pre-match tactic.
  // This prevents listing the full squad and showing players that weren't on the bench.
  const tactic = teamSide === "home" ? fixture._t1 : fixture._t2;
  const tacticPositions: Record<number, string> = tactic?.positions || {};
  const benchIds = new Set(
    Object.entries(tacticPositions)
      .filter(([, status]) => status === "Suplente")
      .map(([id]) => Number(id)),
  );
  const roster = fullRoster || squad;
  const availableBench = roster.filter(
    (p) =>
      !lineupIds.has(p.id) &&
      (benchIds.size === 0 || benchIds.has(p.id)) &&
      !(fixture._subbedOut as Set<number> | undefined)?.has(p.id),
  );

  // If the injured player is a goalkeeper, prefer substituting with another goalkeeper
  let substituteCandidates = availableBench;
  const grBench = availableBench.filter((p) => p.position === "GR");
  if (injuredPlayer.position === "GR") {
    substituteCandidates = grBench.length > 0 ? grBench : availableBench;
  }

  const fallback = () => pickBestPlayer(substituteCandidates)?.id || null;
  const result = await waitForMatchAction({
    game,
    io,
    type: "injury",
    teamId,
    payload: {
      minute: fixture._minute,
      teamId,
      injuredPlayer: buildPlayerCard(injuredPlayer, fixture, teamSide),
      benchPlayers: substituteCandidates.map((p) => buildPlayerCard(p, fixture, teamSide)),
      currentScore: {
        home: fixture.finalHomeGoals,
        away: fixture.finalAwayGoals,
      },
      // Último GR sai com reposição mas sem GR no banco: o substituto que
      // entra calça as luvas — a UI avisa com o badge de GR improvisado.
      ...(injuredPlayer.position === "GR" && grBench.length === 0
        ? { incomingBecomesGK: true }
        : {}),
    },
    timeoutMs: MATCH_TUNING.actionTimeoutMs,
    fallback,
    fixtureData: buildFixtureData(fixture),
  });

  const forcedChoice = normalizeMatchChoice(result.choice);
  const replacement =
    forcedChoice.playerIn != null &&
    availableBench.find((p) => p.id === forcedChoice.playerIn);
  if (replacement) {
    // Último GR sai e não há GR no banco → o substituto que entra calça as
    // luvas (GR improvisado, clone com skill piso — a posição real fica
    // intacta na DB).
    const emergencyConversion =
      injuredPlayer.position === "GR" && grBench.length === 0;
    const incoming = emergencyConversion
      ? convertToEmergencyGK(replacement)
      : replacement;
    swapOnPitch({
      fixture,
      game,
      side: teamSide,
      squad,
      lineupIds,
      outId: injuredPlayer.id,
      incoming,
      countSub: true,
    });

    fixture.events.push({
      minute: fixture._minute,
      type: "substitution",
      team: teamSide,
      emoji: "🔁",
      playerId: incoming.id,
      playerName: incoming.name,
      text: `[${fixture._minute}'] 🔁 ${subPhrase(injuredPlayer.name, incoming.name)}`,
    });

    // Comentário dedicado: o substituto é agora o GR improvisado.
    if (emergencyConversion) {
      fixture.events.push({
        minute: fixture._minute,
        type: "emergency_gk",
        team: teamSide,
        emoji: "🧤",
        playerId: incoming.id,
        playerName: incoming.name,
        text: `[${fixture._minute}'] 🧤 ${emergencyGkPhrase(incoming.name)}`,
      });
    }

    return { replaced: true, injuredPlayer, replacement: incoming };
  }

  removeFromPitch({
    fixture,
    game,
    side: teamSide,
    squad,
    lineupIds,
    outId: injuredPlayer.id,
  });

  return { replaced: false, injuredPlayer, replacement: null };
}

async function applyPenaltyEvent({
  fixture,
  teamSide,
  squad,
  currentMatchweek,
  io,
  game,
  rng = Math.random,
}: {
  fixture: MatchFixture;
  teamSide: "home" | "away";
  squad: PlayerRow[];
  currentMatchweek: number;
  io: any;
  game: ActiveGame;
  rng?: Rng;
}) {
  const teamId = teamSide === "home" ? fixture.homeTeamId : fixture.awayTeamId;
  const filteredCandidates = squad.filter((p) =>
    isPlayerAvailable(p, currentMatchweek),
  );
  // Fallback: se nenhum jogador disponível (todos expulsos/lesionados), usar squad completo
  const takerCandidates =
    filteredCandidates.length > 0 ? filteredCandidates : squad;
  const fallback = () => selectPenaltyTaker(takerCandidates)?.id || null;
  const result = await waitForMatchAction({
    game,
    io,
    type: "penalty",
    teamId,
    payload: {
      minute: fixture._minute,
      teamId,
      takerCandidates: takerCandidates.map((p) => buildPlayerCard(p, fixture, teamSide, { detailed: false, fatigue: false })),
      currentScore: {
        home: fixture.finalHomeGoals,
        away: fixture.finalAwayGoals,
      },
    },
    timeoutMs: MATCH_TUNING.penaltyActionTimeoutMs,
    fallback,
    fixtureData: buildFixtureData(fixture),
  });

  const { playerIn: takerId } = normalizeMatchChoice(result.choice);
  const taker =
    (takerId != null && takerCandidates.find((p) => p.id === takerId)) ||
    takerCandidates.find((p) => p.id === fallback()) ||
    null;
  if (!taker) return;

  // Base 82% goal rate, skill efetiva (range 5–50) shifts it ±6 pp around the mean (30)
  const penaltySkill = getEffectiveSkill(taker) || 0;
  const goalChance = Math.max(
    MATCH_TUNING.penaltyMin,
    Math.min(
      MATCH_TUNING.penaltyMax,
      MATCH_TUNING.penaltyBase +
        (penaltySkill - MATCH_TUNING.penaltySkillMid) /
          MATCH_TUNING.penaltySkillDivisor,
    ),
  );
  const scored = rng() < goalChance;

  if (scored) {
    if (teamSide === "home") fixture.finalHomeGoals++;
    else fixture.finalAwayGoals++;
    // Acumulado em memória — flush transacional no apito final.
    recordMatchGoal(fixture, taker.id);
    fixture.events.push({
      minute: fixture._minute,
      type: "penalty_goal",
      team: teamSide,
      emoji: "⚽",
      playerId: taker.id,
      playerName: taker.name,
      text: `[${fixture._minute}'] ⚽ ${penaltyGoalPhrase(taker.name)}`,
      penaltySuspense: true,
      penaltyResult: "GOLO!!!",
    });
  } else {
    // Miss type proportions: 60% save · 10% post · 10% wide · 20% panenka
    const missRoll = rng();
    let missType: string;
    if (missRoll < MATCH_TUNING.penaltyMissSave) {
      missType = "DEFENDEU!";
    } else if (missRoll < MATCH_TUNING.penaltyMissPost) {
      missType = "AO POSTE!";
    } else if (missRoll < MATCH_TUNING.penaltyMissWide) {
      missType = "AO LADO!";
    } else {
      missType = "PANENKA FALHADO!";
    }
    fixture.events.push({
      minute: fixture._minute,
      type: "penalty_miss",
      team: teamSide,
      emoji: "❌",
      playerId: taker.id,
      playerName: taker.name,
      text: `[${fixture._minute}'] ❌ ${penaltyMissPhrase(taker.name, missType)}`,
      penaltySuspense: true,
      penaltyResult: missType,
    });
  }
}


function ensureFatigueLedgers(fixture: MatchFixture) {
  if (!fixture._minutesPlayed) {
    fixture._minutesPlayed = { home: {}, away: {} };
  }
  if (!fixture._minutesPlayed.home) fixture._minutesPlayed.home = {};
  if (!fixture._minutesPlayed.away) fixture._minutesPlayed.away = {};
  if (!fixture._fatigueLoss) {
    fixture._fatigueLoss = { home: {}, away: {} };
  }
  if (!fixture._fatigueLoss.home) fixture._fatigueLoss.home = {};
  if (!fixture._fatigueLoss.away) fixture._fatigueLoss.away = {};
}

function getLineupIndex(
  fixture: MatchFixture,
  side: MatchSide,
): Map<number, number> {
  const lineupRef = side === "home" ? fixture.homeLineup : fixture.awayLineup;
  const empty = new Map<number, number>();
  if (!lineupRef) return empty;
  let cache =
    side === "home"
      ? fixture._lineupIndex?.home
      : fixture._lineupIndex?.away;
  if (!cache || cache.arr !== lineupRef || cache.byId.size !== lineupRef.length) {
    const byId = new Map<number, number>();
    lineupRef.forEach((p: any, i: number) => {
      if (p && typeof p.id === "number") byId.set(p.id, i);
    });
    cache = { arr: lineupRef, byId };
    if (!fixture._lineupIndex) fixture._lineupIndex = {};
    fixture._lineupIndex[side] = cache;
  }
  return cache.byId;
}

function syncFatigueSnapshot(
  fixture: MatchFixture,
  side: MatchSide,
  playerId: number,
  skill?: number,
) {
  const lineupRef = side === "home" ? fixture.homeLineup : fixture.awayLineup;
  if (!lineupRef) return;

  let li = getLineupIndex(fixture, side).get(playerId);
  // O índice pode estar stale (swapOnPitch troca o id na posição sem mudar
  // o tamanho): validar pela identidade e forçar rebuild se divergir.
  if (li === undefined || (lineupRef[li] as any)?.id !== playerId) {
    if (!fixture._lineupIndex) fixture._lineupIndex = {};
    fixture._lineupIndex[side] = undefined;
    li = getLineupIndex(fixture, side).get(playerId);
    if (li === undefined || (lineupRef[li] as any)?.id !== playerId) return;
  }

  const next: Record<string, unknown> = {
    ...lineupRef[li],
    ...getMatchFatigueSnapshot(fixture, side, playerId),
  };
  if (skill !== undefined) next.skill = skill;
  lineupRef[li] = next;
}

function applyFatigueToPlayer(
  fixture: MatchFixture,
  side: MatchSide,
  player: PlayerRow,
  amount: number,
  rng: Rng = Math.random,
) {
  ensureFatigueLedgers(fixture);

  // O cansaço vive em `_matchSkill` (só memória) — `player.skill` é o atributo
  // persistente e nunca é mutado em jogo (senão o flush de lesões e os
  // snapshots de lineup guardariam valores fatigados na DB).
  const before = Number(getEffectiveSkill(player) ?? 0);
  const after = Math.max(1, before - amount);
  player._matchSkill = after;
  // A skill efetiva mudou — a força do lado fica dirty.
  if (after !== before) bumpPowerVersion(fixture, side);

  const effectiveLoss = Math.max(0, before - after);
  if (effectiveLoss > 0) {
    fixture._fatigueLoss[side][player.id] =
      (fixture._fatigueLoss[side][player.id] ?? 0) + effectiveLoss;
  }
  syncFatigueSnapshot(fixture, side, player.id, after);
}

// Aplica um golpe de cansaço (-amount skill) aos jogadores no onze, com
// probabilidade de escape baseada na resistência. Só mexe em memória —
// nunca persiste na base de dados.
function applyFatigue(
  fixture: MatchFixture,
  side: MatchSide,
  squad: PlayerRow[],
  lineupIds: Set<number>,
  amount: number,
  rng: Rng = Math.random,
) {
  for (const p of squad) {
    if (!lineupIds.has(p.id)) continue;

    const resistance = p.resistance ?? RES_NEUTRAL;
    const skipChance = (resistance - 1) * MATCH_TUNING.fatigueSkipPerResPoint;
    if (rng() >= skipChance) {
      applyFatigueToPlayer(fixture, side, p, amount, rng);
    } else {
      syncFatigueSnapshot(fixture, side, p.id, getEffectiveSkill(p));
    }
  }
}

// Cansaço progressivo por minutos jogados. Cada jogador em campo acumula
// minutos no fixture (fixture._minutesPlayed) e, a cada intervalo de fadiga
// (MATCH_TUNING.fatigueIntervalMinutes), rola contra a resistência para
// perder 1 de skill efetiva. Jogadores que entram mais
// tarde (substituições) começam a contar do zero — pernas frescas valem mais
// que titulares cansados. O snapshot de lineup é mantido em sincronia para
// que o ecrã de intervalo e os painéis de substituição mostrem o skill real.
function trackFatigue(
  fixture: MatchFixture,
  side: MatchSide,
  squad: PlayerRow[],
  lineupIds: Set<number>,
  rng: Rng = Math.random,
) {
  ensureFatigueLedgers(fixture);
  const mps = fixture._minutesPlayed[side];
  for (const p of squad) {
    if (!lineupIds.has(p.id)) continue;
    const played = (mps[p.id] ?? 0) + 1;
    mps[p.id] = played;
    syncFatigueSnapshot(fixture, side, p.id, getEffectiveSkill(p));
    if (played % MATCH_TUNING.fatigueIntervalMinutes !== 0) continue;

    const resistance = p.resistance ?? RES_NEUTRAL;
    const skipChance = (resistance - 1) * MATCH_TUNING.fatigueSkipPerResPoint;
    if (rng() < skipChance) continue;

    applyFatigueToPlayer(fixture, side, p, 1, rng);
  }
}

// Gera os eventos de introdução (weather + táctica) do minuto 1 antes da simulação.
// Chamada em weeklyFlowHelpers.ts antes de emitir matchSegmentStart, para que os
// comentários já estejam no payload durante a pausa de 5s.
// As guards na engine (!fixture._weather / !fixture._firstHalfStartComment) evitam duplicação.
export function generateIntroEvents(
  fixture: MatchFixture,
  homeTactic: Tactic | null,
  awayTactic: Tactic | null,
): void {
  // Weather — clima determinístico partilhado com a previsão do briefing.
  if (!fixture._weather) {
    const { condition: weatherCondition, emoji: weatherEmoji } =
      getWeatherForFixture(
        fixture.season ?? 1,
        fixture.matchweek ?? 1,
        fixture.homeTeamId ?? 0,
        fixture.awayTeamId ?? 0,
      );
    fixture._weather = weatherCondition;
    fixture.events.push({
      minute: 1,
      type: "weather",
      team: null,
      emoji: weatherEmoji,
      text: `[1'] ${weatherEmoji} ${weatherPhrase(weatherCondition)}`,
    });
  }

  // Previsão de apostas (intro) — mesma função usada no nextMatchSummary,
  // para que o card do TacticsView e o evento do minuto 1 tenham odds iguais.
  if (!fixture._bettingIntroShown) {
    const homeName = fixture.homeTeam?.name || String(fixture.homeTeamId);
    const awayName = fixture.awayTeam?.name || String(fixture.awayTeamId);
    const homeTeam = fixture.homeTeam as any;
    const awayTeam = fixture.awayTeam as any;
    const odds = computeMatchOdds(
      {
        division: homeTeam?.division ?? 4,
        position: homeTeam?.position ?? null,
      },
      {
        division: awayTeam?.division ?? 4,
        position: awayTeam?.position ?? null,
      },
    );
    fixture.events.push({
      minute: 1,
      type: "betting",
      team: null,
      emoji: "📊",
      text: `[1'] 📊 ${bettingPhrase(homeName, awayName, odds)}`,
    });
    fixture._bettingIntroShown = true;
  }

  // Comentário táctico de início
  if (!fixture._firstHalfStartComment) {
    const homeName = fixture.homeTeam?.name || String(fixture.homeTeamId);
    const awayName = fixture.awayTeam?.name || String(fixture.awayTeamId);
    const homeFormation = homeTactic?.formation || "4-4-2";
    const awayFormation = awayTactic?.formation || "4-4-2";
    const homeStyle = normaliseStyle(homeTactic?.style);
    const awayStyle = normaliseStyle(awayTactic?.style);

    if (isCupFinalRound(fixture.round)) {
      fixture.events.push({
        minute: 1,
        type: "phase_start",
        team: null,
        emoji: "🏟️",
        text: `[1'] 🏟️ ${finalStartPhrase()}`,
      });
    } else {
      fixture.events.push({
        minute: 1,
        type: "phase_start",
        team: null,
        emoji: "📋",
        text: `[1'] 📋 ${tacticStartPhrase(homeName, homeFormation, homeStyle, awayName, awayFormation, awayStyle)}`,
      });
    }
    fixture._firstHalfStartComment = true;
  }
}

// Pré-gera o comentário táctico do minuto 46 antes da simulação da segunda parte.
// Chamada em weeklyFlowHelpers.ts antes de emitir matchSegmentStart, para que o
// comentário já esteja no payload durante a pausa de 5s.
// A guard na engine (!fixture._secondHalfStartComment) evita duplicação.
export function generateSecondHalfIntroEvents(
  fixture: MatchFixture,
  homeTactic: Tactic | null,
  awayTactic: Tactic | null,
): void {
  if (!fixture._secondHalfStartComment) {
    const homeName = fixture.homeTeam?.name || String(fixture.homeTeamId);
    const awayName = fixture.awayTeam?.name || String(fixture.awayTeamId);
    const homeFormation = homeTactic?.formation || "4-4-2";
    const awayFormation = awayTactic?.formation || "4-4-2";
    const homeStyle = normaliseStyle(homeTactic?.style);
    const awayStyle = normaliseStyle(awayTactic?.style);
    fixture.events.push({
      minute: 46,
      type: "phase_start",
      team: null,
      emoji: "🔔",
      text: `[46'] 🔔 ${secondHalfTacticPhrase(homeName, homeFormation, homeStyle, awayName, awayFormation, awayStyle)}`,
    });
    fixture._secondHalfStartComment = true;
  }
}

/**
 * Barreira de minuto para o direto sincronizado (audit #1).
 * Cada fixture simula o segmento inteiro numa só chamada e invoca
 * `wait(minuto)` via `onMinute`; o `onTick` (emit + sleep) corre UMA vez
 * por minuto, só depois de TODAS as fixtures terem simulado esse minuto.
 * Preserva o pacing observável do antigo loop minuto-a-minuto (incluindo a
 * espera partilhada em janelas de substituição), sem pagar o setup
 * (plantéis, moral, rosters, snapshots) 90× por jogo.
 * `abort()` liberta quem espera — usado quando uma fixture falha, para o
 * `Promise.all` rejeitar sem deixar tarefas penduradas na barreira.
 */
export function createMinuteBarrier(
  total: number,
  onTick: (minute: number) => Promise<void>,
) {
  let arrived = 0;
  let aborted = false;
  let gate: Promise<void> = Promise.resolve();
  let releaseGate: () => void = () => {};
  const renewGate = () => {
    gate = new Promise<void>((r) => {
      releaseGate = r;
    });
  };
  renewGate();
  return {
    async wait(minute: number): Promise<void> {
      if (aborted) return;
      arrived++;
      if (arrived >= total) {
        arrived = 0;
        const release = releaseGate;
        renewGate();
        try {
          await onTick(minute);
        } finally {
          release();
        }
      } else {
        await gate;
      }
    },
    abort() {
      aborted = true;
      releaseGate();
    },
  };
}

export async function simulateMatchSegment(
  db: Db,
  fixture: MatchFixture,
  homeTactic: Tactic | null,
  awayTactic: Tactic | null,
  startMin: number,
  endMin: number,
  context: SegmentContext,
) {
  const currentMatchweek = context.matchweek || 1;
  // Slot-based: calendarIndex is 0-based (slot 0 is a real first slot). The old
  // `|| 1` corrupted slot 0 into 1, breaking the per-slot replay guard below.
  const currentCalendarIndex =
    typeof context.calendarIndex === "number" && Number.isFinite(context.calendarIndex)
      ? context.calendarIndex
      : 1;
  const io = context.io;
  const game = context.game;
  // RNG injetável (fix #9): testes/replays passam context.rng (seeded);
  // produção usa Math.random — comportamento inalterado.
  const rng: Rng = context.rng ?? Math.random;

  let homeSquad;
  const isFreshHomeBuild = !fixture._homeSquad;
  if (fixture._homeSquad) {
    homeSquad = fixture._homeSquad;
  } else if (fixture.homeLineup && fixture.homeLineup.length > 0) {
    const homeIds = new Set(fixture.homeLineup.map((p: any) => p.id));
    for (const e of fixture.events || []) {
      if (e.team === "home") {
        if ((e.type === "red" || e.type === "injury") && e.playerId)
          homeIds.delete(e.playerId);
        if (e.type === "substitution" && e.playerId) homeIds.add(e.playerId);
      }
    }
    // Junior GRs have negative IDs — fetch real players from DB, then re-add any juniors.
    // Em erro de DB, segue com [] (o ensureStartingXI repõe juniores).
    const homeAllIds = Array.from(homeIds);
    const homeRealIds = homeAllIds.filter((id: number) => id > 0);
    const homeJuniorIds = new Set(homeAllIds.filter((id: number) => id < 0));
    const homePh =
      homeRealIds.length > 0 ? homeRealIds.map(() => "?").join(",") : "0";
    const homeDbPlayers = await dbAllAsync(
      db,
      `SELECT * FROM players WHERE id IN (${homePh})`,
      homeRealIds.length > 0 ? homeRealIds : [],
    ).catch(() => []);
    // Re-add cached junior GRs whose IDs are still in the active lineup.
    const homeCachedJuniors = (fixture._homeFullRoster || []).filter((p: any) =>
      homeJuniorIds.has(p.id),
    );
    homeSquad = [...homeDbPlayers, ...homeCachedJuniors];
    fixture._homeSquad = homeSquad;
  } else {
    homeSquad = await getTeamSquad(
      db,
      fixture.homeTeamId,
      homeTactic,
      currentMatchweek,
    );
    fixture._homeSquad = homeSquad;
  }

  if (isFreshHomeBuild) {
    homeSquad = ensureStartingXI(
      homeSquad,
      fixture.homeTeamId,
      currentMatchweek,
      homeTactic?.formation,
    );
    fixture._homeSquad = homeSquad;
  }

  let awaySquad;
  const isFreshAwayBuild = !fixture._awaySquad;
  if (fixture._awaySquad) {
    awaySquad = fixture._awaySquad;
  } else if (fixture.awayLineup && fixture.awayLineup.length > 0) {
    const awayIds = new Set(fixture.awayLineup.map((p: any) => p.id));
    for (const e of fixture.events || []) {
      if (e.team === "away") {
        if ((e.type === "red" || e.type === "injury") && e.playerId)
          awayIds.delete(e.playerId);
        if (e.type === "substitution" && e.playerId) awayIds.add(e.playerId);
      }
    }
    // Junior GRs have negative IDs — fetch real players from DB, then re-add any juniors.
    // Em erro de DB, segue com [] (o ensureStartingXI repõe juniores).
    const awayAllIds = Array.from(awayIds);
    const awayRealIds = awayAllIds.filter((id: number) => id > 0);
    const awayJuniorIds = new Set(awayAllIds.filter((id: number) => id < 0));
    const awayPh =
      awayRealIds.length > 0 ? awayRealIds.map(() => "?").join(",") : "0";
    const awayDbPlayers = await dbAllAsync(
      db,
      `SELECT * FROM players WHERE id IN (${awayPh})`,
      awayRealIds.length > 0 ? awayRealIds : [],
    ).catch(() => []);
    const awayCachedJuniors = (fixture._awayFullRoster || []).filter((p: any) =>
      awayJuniorIds.has(p.id),
    );
    awaySquad = [...awayDbPlayers, ...awayCachedJuniors];
    fixture._awaySquad = awaySquad;
  } else {
    awaySquad = await getTeamSquad(
      db,
      fixture.awayTeamId,
      awayTactic,
      currentMatchweek,
    );
    fixture._awaySquad = awaySquad;
  }

  if (isFreshAwayBuild) {
    awaySquad = ensureStartingXI(
      awaySquad,
      fixture.awayTeamId,
      currentMatchweek,
      awayTactic?.formation,
    );
    fixture._awaySquad = awaySquad;
  }

  if (!fixture._yellowCards) {
    fixture._yellowCards = {};
  }

  // Track games played — registado uma vez por jogo (minuto 1 da 1ª parte).
  // Só acumulado em memória (fixture._deltas); o flush transacional no apito
  // final aplica o incremento com o guard anti-replay por calendarIndex.
  if (startMin === 1) {
    const participantIds = ([
      ...Array.from(new Set((homeSquad || []).map((p: any) => p.id))),
      ...Array.from(new Set((awaySquad || []).map((p: any) => p.id))),
    ].filter((id) => typeof id === "number" && id > 0) as number[]);
    if (participantIds.length > 0) {
      recordMatchAppearances(fixture, participantIds, currentCalendarIndex);
    }

    // Weather event — emitted once at the start of each match (mesma fonte
    // da previsão do briefing: getWeatherForFixture).
    if (!fixture._weather) {
      const { condition: weatherCondition, emoji: weatherEmoji } =
        getWeatherForFixture(
          fixture.season ?? 1,
          fixture.matchweek ?? 1,
          fixture.homeTeamId ?? 0,
          fixture.awayTeamId ?? 0,
        );
      fixture._weather = weatherCondition;
      fixture.events.push({
        minute: 1,
        type: "weather",
        team: null,
        emoji: weatherEmoji,
        text: `[1'] ${weatherEmoji} ${weatherPhrase(weatherCondition)}`,
      });
    }
  }

  // Load team morale values (cached on fixture for minute-by-minute mode)
  let homeMorale: number, awayMorale: number;
  if (fixture._homeMorale !== undefined) {
    homeMorale = fixture._homeMorale;
    awayMorale = fixture._awayMorale;
  } else {
    // Em erro de DB, moral neutra 50 (comportamento anterior).
    const moraleOrNeutral = (teamId: number) =>
      dbGetAsync(db, "SELECT morale FROM teams WHERE id = ?", [teamId]).then(
        (row) => (row && row.morale != null ? row.morale : 50),
        () => 50,
      );
    [homeMorale, awayMorale] = await Promise.all([
      moraleOrNeutral(fixture.homeTeamId),
      moraleOrNeutral(fixture.awayTeamId),
    ]);
    fixture._homeMorale = homeMorale;
    fixture._awayMorale = awayMorale;
  }

  // Load full rosters for bench availability during injuries (cached on fixture)
  let homeFullRoster: PlayerRow[], awayFullRoster: PlayerRow[];
  if (fixture._homeFullRoster) {
    homeFullRoster = fixture._homeFullRoster;
    awayFullRoster = fixture._awayFullRoster;
  } else {
    const loadFullRoster = async (teamId: number): Promise<PlayerRow[]> => {
      const rows = await dbAllAsync<PlayerRow>(
        db,
        "SELECT * FROM players WHERE team_id = ?",
        [teamId],
      );
      const available = (rows || []).filter((p) =>
        isPlayerAvailable(p, currentMatchweek),
      );
      return ensureFullBench(
        withJuniorGRs(available, teamId, currentMatchweek),
        teamId,
        currentMatchweek,
      );
    };
    [homeFullRoster, awayFullRoster] = await Promise.all([
      loadFullRoster(fixture.homeTeamId),
      loadFullRoster(fixture.awayTeamId),
    ]);
    fixture._homeFullRoster = homeFullRoster;
    fixture._awayFullRoster = awayFullRoster;
  }

  if (!fixture.homeLineup || fixture.homeLineup.length === 0) {
    fixture.homeLineup = buildLineupSnapshot(
      fixture,
      homeSquad,
      homeTactic,
      fixture._homeFullRoster,
      "home",
    );
    fixture.awayLineup = buildLineupSnapshot(
      fixture,
      awaySquad,
      awayTactic,
      fixture._awayFullRoster,
      "away",
    );
  }

  // Persistent lineup tracking across all minutes in this segment
  const homeLineupIds = new Set<number>(homeSquad.map((p: any) => p.id));
  const awayLineupIds = new Set<number>(awaySquad.map((p: any) => p.id));


  // Familiaridade (memória táctica) — síncrono, em memória no game object.
  // Holder mutável (em vez de `let`): o corpo do minuto corre em
  // processMatchMinute e a adoção live recalcula para a nova tática.
  const fam = {
    home: getTacticBonus(game, fixture.homeTeamId, homeTactic),
    away: getTacticBonus(game, fixture.awayTeamId, awayTactic),
  };

  // Força com dirty-flag: calcula-se UMA vez por segmento (tática, moral e
  // familiaridade podem mudar entre segmentos) e recalcula-se dentro do
  // minuto só quando o onze mexe — sub/expulsão/lesão/fadiga fazem
  // bumpPowerVersion. Substitui a chave-string O(22) por minuto/lado.
  // Holder mutável: processMatchMinute lê/escreve via refreshPowerIfDirty.
  const powers = {
    home: computeSidePower(homeSquad, homeTactic, homeMorale, fam.home),
    away: computeSidePower(awaySquad, awayTactic, awayMorale, fam.away),
  };
  fixture._homePower = {
    power: powers.home,
    version: getPowerVersion(fixture, "home"),
  };
  fixture._awayPower = {
    power: powers.away,
    version: getPowerVersion(fixture, "away"),
  };

  const refreshPowerIfDirty = (side: MatchSide) => {
    const field = side === "home" ? "_homePower" : "_awayPower";
    const version = getPowerVersion(fixture, side);
    const cached = fixture[field];
    if (cached && cached.version === version) return cached.power;
    const power = computeSidePower(
      side === "home" ? powers.home.squad : powers.away.squad,
      side === "home" ? homeTactic : awayTactic,
      side === "home" ? homeMorale : awayMorale,
      side === "home" ? fam.home : fam.away,
    );
    fixture[field] = { power, version };
    if (side === "home") powers.home = power;
    else powers.away = power;
    return power;
  };

  for (let minute = startMin; minute <= endMin; minute++) {
    fixture._minute = minute;

    await processMatchMinute({
      fixture,
      game,
      io,
      minute,
      homeTactic,
      awayTactic,
      homeSquad,
      awaySquad,
      homeFullRoster,
      awayFullRoster,
      homeLineupIds,
      awayLineupIds,
      currentMatchweek,
      rng,
      fam,
      powers,
      refreshPower: refreshPowerIfDirty,
    });

    // Hook de progresso por minuto (fix #6): os chamadores recebem cada minuto
    // simulado para emitir updates/dormir, sem partir a simulação em N chamadas
    // de 1 minuto com setup repetido (plantéis, morale, rostos, lineups).
    if (typeof context.onMinute === "function") {
      await context.onMinute(minute);
    }
  }

  delete fixture._minute;

  if (isCupFinalRound(fixture.round) && !fixture._finalEndComment) {
    const winnerName =
      fixture.finalHomeGoals > fixture.finalAwayGoals
        ? fixture.homeTeam?.name
        : fixture.finalAwayGoals > fixture.finalHomeGoals
          ? fixture.awayTeam?.name
          : null;
    if (winnerName) {
      fixture.events.push({
        minute: 120,
        type: "phase_end",
        team: null,
        emoji: "🏆",
        text: `[FIM] 🏆 ${finalEndPhrase(winnerName)}`,
      });
    }
    fixture._finalEndComment = true;
  }
}

/**
 * Contexto de um minuto simulado (audit: partir a god-function do segmento).
 * O loop de simulateMatchSegment limita-se a: minuto → processMatchMinute →
 * onMinute. O estado mutável partilhado (familiaridade, forças) viaja em
 * holders para o refresh continuar lazy via dirty-flag.
 */
export type MinuteTickContext = {
  fixture: MatchFixture;
  game: ActiveGame;
  io: any;
  minute: number;
  homeTactic: Tactic | null;
  awayTactic: Tactic | null;
  homeSquad: PlayerRow[];
  awaySquad: PlayerRow[];
  homeFullRoster: PlayerRow[];
  awayFullRoster: PlayerRow[];
  homeLineupIds: Set<number>;
  awayLineupIds: Set<number>;
  currentMatchweek: number;
  rng: Rng;
  fam: { home: number; away: number };
  powers: { home: SidePower; away: SidePower };
  refreshPower: (side: MatchSide) => SidePower;
};

/**
 * Um minuto de jogo (extraído de simulateMatchSegment): adoção de tática
 * live, comentários de fase, fadiga, golos, cartões, lesões e substituições.
 */
/**
 * Passo do minuto: adota formação/estilo live do treinador (efeito neste
 * minuto) e recalcula a familiaridade. O XI nunca muda aqui.
 */
function applyLiveTacticAdoption(tick: MinuteTickContext): void {
  const { game, fixture, minute, homeTactic, awayTactic, homeLineupIds, awayLineupIds, fam } = tick;

  // Tática/mentalidade live: o treinador pode mudar a meio do segmento via
  // setTactic — adotar formação+estilo com efeito neste minuto (o passado
  // não se re-simula). O XI nunca muda aqui, só via subs/janelas.
  const homeTacticChange = adoptLiveTactic(
    game,
    fixture,
    "home",
    homeTactic,
    homeLineupIds,
  );
  if (homeTacticChange) {
    fam.home = getTacticBonus(game, fixture.homeTeamId, homeTactic);
    const homeName =
      fixture.homeTeam?.name || String(fixture.homeTeamId);
    fixture.events.push({
      minute,
      type: "tactic_change",
      team: "home",
      emoji: "\ud83d\udd04",
      text: `[${minute}'] \ud83d\udd04 ${homeName} muda para ${homeTacticChange.formation} (${styleDisplayLabel(homeTacticChange.style)})`,
    });
  }
  const awayTacticChange = adoptLiveTactic(
    game,
    fixture,
    "away",
    awayTactic,
    awayLineupIds,
  );
  if (awayTacticChange) {
    fam.away = getTacticBonus(game, fixture.awayTeamId, awayTactic);
    const awayName =
      fixture.awayTeam?.name || String(fixture.awayTeamId);
    fixture.events.push({
      minute,
      type: "tactic_change",
      team: "away",
      emoji: "\ud83d\udd04",
      text: `[${minute}'] \ud83d\udd04 ${awayName} muda para ${awayTacticChange.formation} (${styleDisplayLabel(awayTacticChange.style)})`,
    });
  }
}

/**
 * Passo do minuto: comentários de fase (1'/46'/91') — cada um uma vez por jogo.
 */
function pushPhaseStartComments(tick: MinuteTickContext): void {
  const { fixture, minute, homeTactic, awayTactic } = tick;

  if (minute === 1 && !fixture._firstHalfStartComment) {
    const homeName = fixture.homeTeam?.name || String(fixture.homeTeamId);
    const awayName = fixture.awayTeam?.name || String(fixture.awayTeamId);
    const homeFormation = homeTactic?.formation || "4-4-2";
    const awayFormation = awayTactic?.formation || "4-4-2";
    const homeStyle = normaliseStyle(homeTactic?.style);
    const awayStyle = normaliseStyle(awayTactic?.style);

    if (isCupFinalRound(fixture.round)) {
      fixture.events.push({
        minute,
        type: "phase_start",
        team: null,
        emoji: "🏟️",
        text: `[1'] 🏟️ ${finalStartPhrase()}`,
      });
    } else {
      fixture.events.push({
        minute,
        type: "phase_start",
        team: null,
        emoji: "📋",
        text: `[1'] 📋 ${tacticStartPhrase(homeName, homeFormation, homeStyle, awayName, awayFormation, awayStyle)}`,
      });
    }
    fixture._firstHalfStartComment = true;
  }

  if (minute === 46 && !fixture._secondHalfStartComment) {
    const homeName = fixture.homeTeam?.name || String(fixture.homeTeamId);
    const awayName = fixture.awayTeam?.name || String(fixture.awayTeamId);
    const homeFormation = homeTactic?.formation || "4-4-2";
    const awayFormation = awayTactic?.formation || "4-4-2";
    const homeStyle = normaliseStyle(homeTactic?.style);
    const awayStyle = normaliseStyle(awayTactic?.style);
    fixture.events.push({
      minute,
      type: "phase_start",
      team: null,
      emoji: "🔔",
      text: `[46'] 🔔 ${secondHalfTacticPhrase(homeName, homeFormation, homeStyle, awayName, awayFormation, awayStyle)}`,
    });
    fixture._secondHalfStartComment = true;
  }

  if (minute === 91 && !fixture._extraTimeStartComment) {
    fixture.events.push({
      minute,
      type: "phase_start",
      team: null,
      emoji: "⏱️",
      text: `[91'] ⏱️ ${extraTimeStartPhrase()}`,
    });
    fixture._extraTimeStartComment = true;
  }
}

/**
 * Passo do minuto: fadiga progressiva do XI + desgaste extra com frio/neve.
 */
function applyMinuteFatigue(tick: MinuteTickContext): void {
  const { fixture, minute, homeSquad, awaySquad, homeLineupIds, awayLineupIds, rng } = tick;

  // Cansaço progressivo: cada intervalo de fadiga jogado, -1 skill efetiva,
  // com escape por resistência. Quem entra depois (subs) começa do zero.
  trackFatigue(fixture, "home", homeSquad, homeLineupIds, rng);
  trackFatigue(fixture, "away", awaySquad, awayLineupIds, rng);

  // Condições climatéricas adversas aceleram o desgaste ao minuto 60
  if (
    minute === 60 &&
    !fixture._fatigue3Applied &&
    (fixture._weather === "neve" || fixture._weather === "frio")
  ) {
    applyFatigue(fixture, "home", homeSquad, homeLineupIds, 1, rng);
    applyFatigue(fixture, "away", awaySquad, awayLineupIds, 1, rng);
    fixture._fatigue3Applied = true;
  }
}

export async function processMatchMinute(tick: MinuteTickContext): Promise<void> {
  const {
    fixture,
    game,
    io,
    minute,
    homeTactic,
    awayTactic,
    homeSquad,
    awaySquad,
    homeFullRoster,
    awayFullRoster,
    homeLineupIds,
    awayLineupIds,
    currentMatchweek,
    rng,
    fam,
    powers,
    refreshPower,
  } = tick;

  applyLiveTacticAdoption(tick);
  pushPhaseStartComments(tick);
  applyMinuteFatigue(tick);

  const currentHome = refreshPower("home");
  const currentAway = refreshPower("away");

  let goalScoredThisMinute = false;

  const maybeOpenPlayGoal = (attackingSide) => {
    if (goalScoredThisMinute) return;
    const attacking = attackingSide === "home" ? currentHome : currentAway;
    const defending = attackingSide === "home" ? currentAway : currentHome;
    const isHome = attackingSide === "home";

    // O estilo de cada equipa já está codificado no computeSidePower
    // (ataque com fator ofensivo próprio, defesa com fator defensivo
    // próprio). NÃO voltar a ajustar pelo estilo do adversário aqui:
    // dividir por (1 / fator[adversário]) anulava o bónus defensivo e
    // fazia com que se marcasse ligeiramente MAIS contra equipas defensivas.

    // Posse de bola: quem domina o meio campo tem ligeiramente mais probabilidade
    const totalMid =
      (currentHome.midStrength || 0) + (currentAway.midStrength || 0);
    const homePossession =
      totalMid > 0 ? (currentHome.midStrength || 0) / totalMid : 0.5;
    const possessionFactor = isHome
      ? 0.9 + homePossession * 0.2 // range 0.90–1.10
      : 0.9 + (1 - homePossession) * 0.2;

    // Guardar posse no fixture para exibição no cliente
    fixture._homePossession = Math.round(homePossession * 100);
    fixture._awayPossession = 100 - fixture._homePossession;

    // Ego conflict penalty: 3+ craques no onze titular reduzem probabilidade
    const scoringSquad = isHome ? powers.home.squad : powers.away.squad;
    const craquesInXI = scoringSquad.filter(
      (p) => p.is_star && (p.position === "MED" || p.position === "ATA"),
    ).length;
    let egoFactor = 1;
    if (craquesInXI > MATCH_TUNING.egoThreshold) {
      const egoPenalty = Math.min(
        MATCH_TUNING.egoPenaltyMax,
        (craquesInXI - MATCH_TUNING.egoThreshold) * MATCH_TUNING.egoPenaltyPerExtra,
      );
      egoFactor = 1.0 - egoPenalty;
    }

    const probGoal = computeOpenPlayGoalProbability({
      attack: attacking.attack,
      defense: defending.defense,
      minute,
      isHome,
      isFinal: isCupFinalRound(fixture.round),
      weather: fixture._weather,
      possessionFactor,
      egoFactor,
    });

    if (rng() >= probGoal) return;

    // Auto-golo (~8% das oportunidades de golo): a bola entra na baliza da
    // equipa que defende, "creditado" a um defensor desse lado. Conta no
    // marcador da equipa atacante (beneficiada), mas NÃO credita o jogador —
    // sem update em players.goals e sem interação com o VAR.
    if (rng() < MATCH_TUNING.ownGoalShare) {
      const defendingSquad = isHome ? powers.away.squad : powers.home.squad;
      const defCulprits = defendingSquad.filter(
        (p) => p.position === "DEF",
      );
      const culpritPool =
        defCulprits.length > 0
          ? defCulprits
          : defendingSquad.filter((p) => p.position !== "GR");
      const culprit = weightedPickScorer(culpritPool, rng) || null;

      if (isHome) fixture.finalHomeGoals++;
      else fixture.finalAwayGoals++;
      goalScoredThisMinute = true;

      fixture.events.push({
        minute,
        type: "own_goal",
        team: attackingSide, // equipa beneficiada — o cliente conta por e.team
        emoji: "⚽",
        playerId: culprit ? culprit.id : null,
        playerName: culprit ? culprit.name : "Jogador",
        text: `[${minute}'] ⚽ ${ownGoalPhrase(
          culprit ? culprit.name : "Jogador",
        )}`,
      });
      return;
    }

    const scorers = scoringSquad.filter(
      (p) => p.position === "ATA" || p.position === "MED",
    );
    const scorer =
      scorers.length > 0 ? weightedPickScorer(scorers, rng) : scoringSquad[0];

    // VAR: 5% de hipótese de golo ser anulado
    if (rng() < MATCH_TUNING.varDisallowedShare) {
      fixture.events.push({
        minute,
        type: "var_disallowed",
        team: attackingSide,
        emoji: "🚩",
        playerId: scorer ? scorer.id : null,
        playerName: scorer ? scorer.name : "Jogador",
        text: `[${minute}'] 🚩 ${varPhrase(scorer ? scorer.name : "Jogador")}`,
        wasGoal: true,
      });
      return;
    }

    const homeBefore = fixture.finalHomeGoals;
    const awayBefore = fixture.finalAwayGoals;
    if (isHome) fixture.finalHomeGoals++;
    else fixture.finalAwayGoals++;
    goalScoredThisMinute = true;

    const scoredSideGoals = isHome
      ? fixture.finalHomeGoals
      : fixture.finalAwayGoals;
    const otherSideGoals = isHome
      ? fixture.finalAwayGoals
      : fixture.finalHomeGoals;
    const wasBehind = isHome
      ? homeBefore < awayBefore
      : awayBefore < homeBefore;
    const goalCtx = {
      opener: homeBefore + awayBefore === 0,
      equalizer:
        scoredSideGoals === otherSideGoals && homeBefore + awayBefore > 0,
      comeback: wasBehind && scoredSideGoals > otherSideGoals,
      late: minute >= 85,
      winningBig:
        Math.abs(fixture.finalHomeGoals - fixture.finalAwayGoals) >= 3,
    };

    const decisiveChance = Math.min(
      MATCH_TUNING.decisiveMax,
      craquesInXI * MATCH_TUNING.decisivePerStar,
    );
    const isDecisive = rng() < decisiveChance;

    const goalText = isCupFinalRound(fixture.round)
      ? finalGoalPhrase(scorer ? scorer.name : "Jogador")
      : goalPhrase(scorer ? scorer.name : "Jogador", goalCtx);
    fixture.events.push({
      minute,
      type: "goal",
      team: attackingSide,
      emoji: "⚽",
      playerId: scorer ? scorer.id : null,
      playerName: scorer ? scorer.name : "Jogador",
      text: `[${minute}'] ⚽ ${goalText}`,
      isDecisive,
    });

    if (scorer) {
      // Acumulado em memória — flush transacional no apito final.
      recordMatchGoal(fixture, scorer.id);
    }
  };

  const isCupExtraTime =
    minute >= 91 && game?.currentEvent?.type === "cup";
  // No último minuto regulamentar da liga (min 90+), não disparar eventos bloqueantes
  // para evitar que a janela de acção apareça após o apito final
  const isLastLeagueMinute =
    minute >= 90 && game?.currentEvent?.type !== "cup";
  const penaltyChance =
    minute < 90 || isCupExtraTime ? MATCH_TUNING.penaltyPerMinute : 0;
  if (rng() < penaltyChance) {
    const attackingSide = rng() < 0.5 ? "home" : "away";
    const attackingSquad = attackingSide === "home" ? powers.home.squad : powers.away.squad;
    const totalGoalsBefore = fixture.finalHomeGoals + fixture.finalAwayGoals;
    await applyPenaltyEvent({
      fixture,
      teamSide: attackingSide,
      squad: attackingSquad,
      currentMatchweek,
      io,
      game,
      rng,
    });
    if (fixture.finalHomeGoals + fixture.finalAwayGoals > totalGoalsBefore) {
      goalScoredThisMinute = true;
    }
  }

  maybeOpenPlayGoal("home");
  maybeOpenPlayGoal("away");

  // Near-miss / big save events — roughly 1–2 per match, commentary-only
  if (!goalScoredThisMinute && rng() < MATCH_TUNING.nearMissPerMinute) {
    const nearMissSide =
      currentHome.attack > currentAway.attack
        ? rng() < 0.55
          ? "home"
          : "away"
        : rng() < 0.55
          ? "away"
          : "home";
    const nearMissSquad = nearMissSide === "home" ? powers.home.squad : powers.away.squad;
    const oppSquad = nearMissSide === "home" ? powers.away.squad : powers.home.squad;
    const attackers = nearMissSquad.filter(
      (p) => p.position === "ATA" || p.position === "MED",
    );
    const attacker =
      attackers.length > 0 ? weightedPickScorer(attackers, rng) : nearMissSquad[0];
    if (attacker) {
      const isBigSave = rng() < MATCH_TUNING.bigSaveShare;
      const grPlayer = oppSquad.find((p) => p.position === "GR");
      const phrase =
        isBigSave && grPlayer
          ? bigSavePhrase(grPlayer.name)
          : nearMissPhrase(attacker.name);
      fixture.events.push({
        minute,
        type: "near_miss",
        team: nearMissSide,
        emoji: "🥅",
        playerId: isBigSave && grPlayer ? grPlayer.id : attacker.id,
        playerName: isBigSave && grPlayer ? grPlayer.name : attacker.name,
        text: `[${minute}'] 🥅 ${phrase}`,
      });
    }
  }

  const homeAggAvg = average(
    powers.home.squad.map((p) => getAggressivenessValue(p)),
  );
  const awayAggAvg = average(
    powers.away.squad.map((p) => getAggressivenessValue(p)),
  );

  const executeRedCard = async (
    offender: PlayerRow,
    isHomeCard: boolean,
    squad: PlayerRow[],
    side: "home" | "away",
  ) => {
    // Acumulado em memória — o flush transacional no apito final aplica o
    // UPDATE atomicamente com o resultado do jogo.
    recordMatchRed(fixture, offender.id, currentMatchweek + 2);
    fixture.events.push({
      minute,
      type: "red",
      team: side,
      emoji: "🟥",
      playerId: offender.id,
      playerName: offender.name,
      text: `[${minute}'] 🟥 ${redPhrase(offender.name)}`,
    });

    const lineupIds = isHomeCard ? homeLineupIds : awayLineupIds;
    const fullRoster = isHomeCard ? homeFullRoster : awayFullRoster;
    const tactic = isHomeCard ? homeTactic : awayTactic;
    const teamId = isHomeCard ? fixture.homeTeamId : fixture.awayTeamId;

    if (offender.position === "GR") {
      // GK sent off — the team must play with 10: the reserve GK comes on and
      // an outfield player is sacrificed. The coach chooses which field player
      // leaves; on timeout/NPC the weakest on-pitch field player is sacrificed.
      const tacticPositions: Record<number, string> = tactic?.positions || {};
      const benchIds = new Set(
        Object.entries(tacticPositions)
          .filter(([, status]) => status === "Suplente")
          .map(([id]) => Number(id)),
      );
      const availableBench = fullRoster.filter(
        (p) => !lineupIds.has(p.id) && (benchIds.size === 0 || benchIds.has(p.id)),
      );

      const grBench = availableBench.filter((p) => p.position === "GR");
      const grCandidates = grBench.length > 0 ? grBench : availableBench;
      // On-pitch outfield players the coach may sacrifice (the sent-off GK is out)
      const fieldOnPitch = squad.filter(
        (p) => p.id !== offender.id && p.position !== "GR",
      );

      if (grBench.length === 0) {
        // Último GR expulso e sem GR no banco → GR improvisado: o treinador
        // escolhe em campo quem vai para a baliza (fallback: o mais fraco).
        // O expulso sai, a equipa fica com 10 — SEM gastar substituição.
        removeFromPitch({
          fixture,
          game,
          side,
          squad,
          lineupIds,
          outId: offender.id,
        });

        await openEmergencyGKAction({
          fixture,
          squad,
          side,
          teamId,
          io,
          game,
          minute,
          emergencyCandidates: fieldOnPitch,
          outPlayer: buildPlayerCard(offender, fixture, side),
          benchPlayers: availableBench,
        });
        return;
      }

      const fallback = () => {
        const weakest = [...fieldOnPitch].sort(
          (a, b) => (getEffectiveSkill(a) || 0) - (getEffectiveSkill(b) || 0),
        )[0];
        const bestGR = pickBestPlayer(grCandidates);
        return { playerOut: weakest?.id ?? null, playerIn: bestGR?.id ?? null };
      };
      const result = await waitForMatchAction({
        game,
        io,
        type: "gk_red_card",
        teamId,
        payload: {
          minute,
          teamId,
          sentOffPlayer: buildPlayerCard(offender, fixture, side),
          onPitch: fieldOnPitch.map((p) => buildPlayerCard(p, fixture, side)),
          benchPlayers: grCandidates.map((p) => buildPlayerCard(p, fixture, side)),
          currentScore: {
            home: fixture.finalHomeGoals,
            away: fixture.finalAwayGoals,
          },
        },
        timeoutMs: MATCH_TUNING.actionTimeoutMs,
        fallback,
        fixtureData: buildFixtureData(fixture),
      });

      const forcedChoice = normalizeMatchChoice(result.choice);
      const incoming =
        forcedChoice.playerIn != null
          ? grCandidates.find((p) => p.id === forcedChoice.playerIn)
          : null;

      // 1) O GR expulso sai sempre (sem gastar substituição).
      removeFromPitch({
        fixture,
        game,
        side,
        squad,
        lineupIds,
        outId: offender.id,
      });

      if (incoming) {
        // 2)+3) Sacrifica o escolhido e entra o GR suplente.
        const sacrificed =
          forcedChoice.playerOut != null
            ? squad.find((p) => p.id === forcedChoice.playerOut)
            : null;
        if (sacrificed) {
          swapOnPitch({
            fixture,
            game,
            side,
            squad,
            lineupIds,
            outId: sacrificed.id,
            incoming,
          });
        } else {
          // Escolha degenerada (sem sacrificado): o GR entra sem sacrificar
          // ninguém — preserva o comportamento anterior para este edge.
          squad.push(incoming);
          lineupIds.add(incoming.id);
          syncTacticPositions(game, fixture, side, teamId, [], [incoming.id]);
          bumpPowerVersion(fixture, side);
        }

        fixture.events.push({
          minute,
          type: "substitution",
          team: side,
          emoji: "🔁",
          playerId: incoming.id,
          playerName: incoming.name,
          text: `[${minute}'] 🔁 ${subPhrase(sacrificed ? sacrificed.name : offender.name, incoming.name)}`,
        });
      }
    } else {
      // Expulsão de jogador de campo — sai sem reposição (regra oficial).
      removeFromPitch({
        fixture,
        game,
        side,
        squad,
        lineupIds,
        outId: offender.id,
      });
    }
  };

  const emitCard = async (isHomeCard: boolean) => {
    const squad = isHomeCard ? powers.home.squad : powers.away.squad;
    const side = isHomeCard ? "home" : "away";
    if (squad.length > 0) {
      const offender = squad[Math.floor(rng() * squad.length)];
      const offenderId = offender.id;

      if (fixture._yellowCards[offenderId] >= 1) {
        if (rng() < MATCH_TUNING.secondYellowRedShare) {
          await executeRedCard(offender, isHomeCard, squad, side);
        }
      } else if (rng() < MATCH_TUNING.directRedShare) {
        await executeRedCard(offender, isHomeCard, squad, side);
      } else {
        fixture._yellowCards[offenderId] =
          (fixture._yellowCards[offenderId] || 0) + 1;
        fixture.events.push({
          minute,
          type: "yellow",
          team: side,
          emoji: "🟨",
          playerId: offender.id,
          playerName: offender.name,
          text: `[${minute}'] 🟨 ${yellowPhrase(offender.name)}`,
        });
      }
    }
  };

  const homeCardProb =
    MATCH_TUNING.cardBaseRate *
    (1 + (homeAggAvg - 3) * MATCH_TUNING.cardAggPerPoint);
  const awayCardProb =
    MATCH_TUNING.cardBaseRate *
    (1 + (awayAggAvg - 3) * MATCH_TUNING.cardAggPerPoint);
  // No último minuto regulamentar da liga não disparar cartões — um vermelho
  // ao GR abriria a janela obrigatória de substituição após o apito final
  if (!isLastLeagueMinute && rng() < homeCardProb) await emitCard(true);
  if (!isLastLeagueMinute && rng() < awayCardProb) await emitCard(false);

  const injuryChance = rng();
  const weatherInjuryMult =
    MATCH_TUNING.injuryWeatherMult[fixture._weather ?? ""] ?? 1.0;
  if (
    !isLastLeagueMinute &&
    injuryChance < MATCH_TUNING.injuryPerMinute * weatherInjuryMult
  ) {
    const isHomeInjury = rng() > 0.5;
    const squad = isHomeInjury ? powers.home.squad : powers.away.squad;
    const side = isHomeInjury ? "home" : "away";
    const lineupIds = isHomeInjury ? homeLineupIds : awayLineupIds;
    const fullRoster = isHomeInjury ? homeFullRoster : awayFullRoster;
    if (squad.length > 0) {
      const injuredPlayer = squad[Math.floor(rng() * squad.length)];
      const resistanceSkip =
        ((injuredPlayer?.resistance ?? RES_NEUTRAL) - 1) *
        MATCH_TUNING.injuryResistSkipPerPoint;
      if (rng() < resistanceSkip) {
        // jogador resistiu — ignorar lesão
      } else {
        const injuryResult = await applyInjuryEvent({
          fixture,
          teamSide: side,
          squad,
          fullRoster,
          lineupIds,
          currentMatchweek,
          io,
          game,
          rng,
        });
        if (injuryResult.replaced && side === "home") powers.home.squad = squad;
        if (injuryResult.replaced && side === "away") powers.away.squad = squad;
      }
    }
  }

  // User substitutions (nunca abrir a janela no último minuto regulamentar da liga;
  // consumir sempre os pedidos pendentes para não vazarem para o jogo seguinte)
  if (game.pendingSubstitutions && game.pendingSubstitutions.size > 0) {
    const teamsToSub = [fixture.homeTeamId, fixture.awayTeamId].filter((id) =>
      game.pendingSubstitutions.has(id),
    );
    for (const teamId of teamsToSub) {
      game.pendingSubstitutions.delete(teamId);
      if (isLastLeagueMinute) {
        // Pedido consumido sem janela: termina o banner de pausa dos outros
        // treinadores (senão ficava à mostra até à próxima substituição).
        io.to(game.roomCode).emit("substitutionPauseEnded", { teamId });
        continue;
      }
      // Sem substituições restantes: consome o pedido sem abrir a janela e
      // notifica o treinador de que esgotou as substituições da partida.
      if (!canMakeSubstitution(fixture, teamId)) {
        io.to(game.roomCode).emit("substitutionCapReached", { teamId });
        // O pedido foi consumido sem abrir a janela: termina o banner de pausa.
        io.to(game.roomCode).emit("substitutionPauseEnded", { teamId });
        continue;
      }

      const isHome = teamId === fixture.homeTeamId;
      const squad = isHome ? powers.home.squad : powers.away.squad;
      const fullRoster = isHome ? homeFullRoster : awayFullRoster;
      const tactic = isHome ? homeTactic : awayTactic;
      const side = isHome ? "home" : "away";
      const lineupIds = isHome ? homeLineupIds : awayLineupIds;

      const onPitch = squad.filter((p: any) => lineupIds.has(p.id));

      const tacticPositions: Record<number, string> = tactic?.positions || {};
      const benchIds = new Set(
        Object.entries(tacticPositions)
          .filter(([, status]) => status === "Suplente")
          .map(([id]) => Number(id)),
      );
      const availableBench = fullRoster.filter(
        (p: any) =>
          !lineupIds.has(p.id) &&
          benchIds.has(p.id) &&
          !(fixture._subbedOut as Set<number> | undefined)?.has(p.id),
      );

      if (onPitch.length > 0 && availableBench.length > 0) {
        const result = await waitForMatchAction({
          game,
          io,
          type: "user_substitution",
          teamId,
          payload: {
            minute: fixture._minute,
            teamId,
            onPitch: onPitch.map((p) => buildPlayerCard(p, fixture, side, { detailed: false })),
            benchPlayers: availableBench.map((p) => buildPlayerCard(p, fixture, side, { detailed: false })),
          },
          timeoutMs: MATCH_TUNING.actionTimeoutMs,
          fallback: () => null,
          fixtureData: buildFixtureData(fixture),
        });

        // Batch: o cliente pode enviar várias trocas na mesma pausa (Substituir
        // acumula, Continuar resolve em lote). Retrocompatível com escolha única.
        const batch = normalizeMatchChoices(result.choice as any);
        for (const userChoice of batch) {
          if (!canMakeSubstitution(fixture, teamId)) {
            io.to(game.roomCode).emit("substitutionCapReached", { teamId });
            break;
          }
          const playerOutId = userChoice.playerOut as number;
          const playerInId = userChoice.playerIn as number;

          const playerOut = squad.find((p: any) => p.id === playerOutId);
          const playerIn = fullRoster.find((p: any) => p.id === playerInId);

          if (playerOut && playerIn) {
            swapOnPitch({
              fixture,
              game,
              side,
              squad,
              lineupIds,
              outId: playerOutId,
              incoming: playerIn,
              countSub: true,
            });

            fixture.events.push({
              minute: fixture._minute,
              type: "substitution",
              team: side,
              emoji: "🔁",
              playerId: playerInId,
              playerName: playerIn.name,
              text: `[${fixture._minute}'] 🔁 ${subPhrase(playerOut.name, playerIn.name)}`,
            });

            if (isHome) powers.home.squad = squad;
            if (!isHome) powers.away.squad = squad;
          }
        }
      }
    }
  }
}

export async function applyPostMatchQualityEvolution(
  db: Db,
  fixtures: MatchFixture[],
  currentMatchweek: number,
  season: number,
  calendarIndex: number = 1,
  rng: Rng = Math.random,
) {
  // Helpers de módulo ligados a esta conexão (ver topo do ficheiro).
  const dbRun = (sql: string, params: any[] = []) =>
    dbRunAsync(db, sql, params);
  const dbAll = <T = any>(sql: string, params: any[] = []) =>
    dbAllAsync<T>(db, sql, params);

  // Nunca rejeitar: os chamadores encadeiam .then() sem .catch() e a evolução
  // é secundária face ao resultado já comitado. Erros logam e seguem.
  try {
    const teamResults = new Map<number, string>();
    for (const match of fixtures || []) {
      const homeResult =
        match.finalHomeGoals > match.finalAwayGoals
          ? "W"
          : match.finalHomeGoals < match.finalAwayGoals
            ? "L"
            : "D";
      const awayResult =
        match.finalAwayGoals > match.finalHomeGoals
          ? "W"
          : match.finalAwayGoals < match.finalHomeGoals
            ? "L"
            : "D";
      teamResults.set(match.homeTeamId, homeResult);
      teamResults.set(match.awayTeamId, awayResult);
    }

    // ── Moral por equipa ───────────────────────────────────────────────
    // Decaimento semanal para o neutro 50 (uma vez por evento do calendário)
    // para a moral refletir a forma recente em vez de histórico acumulado.
    // Depois o delta do resultado — tudo com await (antes era fire-and-forget
    // com race entre o decaimento global e os updates por equipa).
    await dbRun(
      `UPDATE teams SET morale = MAX(0, MIN(100, CAST(morale + (50 - morale) * ${MATCH_TUNING.moraleDecayRate} AS INTEGER)))`,
    );

    const moraleUpdates: Array<{ teamId: number; delta: number }> = [];
    for (const [teamId, result] of teamResults.entries()) {
      let delta;
      if (result === "W") delta = MATCH_TUNING.moraleWinDelta;
      else if (result === "L") delta = MATCH_TUNING.moraleLossDelta;
      else delta = MATCH_TUNING.moraleDrawDelta;
      moraleUpdates.push({ teamId, delta });
    }

    if (moraleUpdates.length > 0) {
      const rows = await dbAll<{ id: number; morale: number | null }>(
        "SELECT id, morale FROM teams WHERE id IN (" +
          moraleUpdates.map(() => "?").join(",") +
          ")",
        moraleUpdates.map((u) => u.teamId),
      );
      const current = new Map<number, number>(
        rows.map((row) => [row.id, row.morale ?? 50]),
      );
      // Batch único em vez de SELECT + N UPDATEs.
      const cases: string[] = [];
      const params: any[] = [];
      const ids: number[] = [];
      for (const { teamId, delta } of moraleUpdates) {
        if (!current.has(teamId)) continue;
        const newMorale = Math.max(
          0,
          Math.min(100, (current.get(teamId) ?? 50) + delta),
        );
        cases.push("WHEN ? THEN ?");
        params.push(teamId, newMorale);
        ids.push(teamId);
      }
      if (ids.length > 0) {
        const ph = ids.map(() => "?").join(",");
        await dbRun(
          `UPDATE teams SET morale = CASE id ${cases.join(" ")} END WHERE id IN (${ph})`,
          [...params, ...ids],
        );
      }
    }

    // ── Sequências de derrotas (para a pressão de decaimento) ──────────
    const teamLossStreak = new Map<number, number>();
    const lastTeamResult = new Map<number, string>();
    try {
      const seasonMatches = await dbAll<any>(
        "SELECT home_team_id AS home, away_team_id AS away, home_score, away_score FROM matches WHERE season = ? ORDER BY matchweek, id",
        [season],
      );
      for (const m of seasonMatches) {
        const homeRes = m.home_score > m.away_score ? "W" : m.home_score < m.away_score ? "L" : "D";
        const awayRes = m.away_score > m.home_score ? "W" : m.away_score < m.home_score ? "L" : "D";
        for (const [tid, res] of [
          [m.home, homeRes],
          [m.away, awayRes],
        ] as Array<[number, string]>) {
          if (res === "L") {
            teamLossStreak.set(
              tid,
              (lastTeamResult.get(tid) === "L" ? teamLossStreak.get(tid) || 0 : 0) + 1,
            );
          } else {
            teamLossStreak.set(tid, 0);
          }
          lastTeamResult.set(tid, res);
        }
      }
    } catch (streakErr) {
      console.error("[engine] evolution: failed to load season matches:", streakErr);
    }

    const players = await dbAll<any>(
      "SELECT id, team_id, position, skill, potential, form, games_played, last_appearance_matchweek, joined_matchweek, injury_until_matchweek, suspension_until_matchweek FROM players WHERE team_id IS NOT NULL ORDER BY team_id, id",
    );
    if (!players || players.length === 0) {
      return;
    }

    // ── Build individual performance maps from fixture events ─────────
    const playerGoals = new Map<number, number>();
    const playerRedCards = new Map<number, boolean>();
    const teamCleanSheetWin = new Map<number, boolean>();
    // Players that appeared in any lineup (starters + bench) and those
    // who actually started — used to weigh minutes and detect rust.
    const appearedIds = new Set<number>();
    const starterIds = new Set<number>();

    for (const match of fixtures || []) {
      // Track clean sheet wins: team won and opponent scored 0
      if (
        match.finalHomeGoals > match.finalAwayGoals &&
        match.finalAwayGoals === 0
      ) {
        teamCleanSheetWin.set(match.homeTeamId, true);
      }
      if (
        match.finalAwayGoals > match.finalHomeGoals &&
        match.finalHomeGoals === 0
      ) {
        teamCleanSheetWin.set(match.awayTeamId, true);
      }

      // Lineups: starters (is_starter) + bench; subbed-in players are part
      // of the final squad snapshot, so they count as appeared (not started).
      for (const lineup of [match.homeLineup, match.awayLineup] as any[]) {
        for (const p of lineup || []) {
          if (typeof p?.id !== "number" || p.id <= 0) continue;
          appearedIds.add(p.id);
          if (p.is_starter) starterIds.add(p.id);
        }
      }

      // Parse events for goals and red cards
      const events = match.events || [];
      for (const evt of events) {
        if (!evt.playerId) continue;
        if (evt.type === "goal" || evt.type === "penalty_goal") {
          playerGoals.set(
            evt.playerId,
            (playerGoals.get(evt.playerId) || 0) + 1,
          );
        }
        if (evt.type === "red" || evt.type === "gk_red_card") {
          playerRedCards.set(evt.playerId, true);
        }
      }
    }

    const teamGroups = new Map();
    for (const player of players) {
      if (!teamGroups.has(player.team_id))
        teamGroups.set(player.team_id, []);
      teamGroups.get(player.team_id).push(player);
    }

    const updates = [];
    for (const player of players) {
      if ((player.injury_until_matchweek || 0) >= currentMatchweek)
        continue;
      if ((player.suspension_until_matchweek || 0) >= currentMatchweek)
        continue;

      const group = teamGroups.get(player.team_id) || [];
      const avgSkill =
        group.reduce((sum, p) => sum + (p.skill || 0), 0) /
        Math.max(1, group.length);
      const diff = avgSkill - (player.skill || 0);
      const teamResult = teamResults.get(player.team_id) || "D";

      const potential =
        player.potential != null ? Math.min(50, player.potential) : 50;
      // Cabeçote até ao teto de potencial (talent ceiling)
      const room = potential - (player.skill || 0);

      const appeared = appearedIds.has(player.id);
      const started = starterIds.has(player.id);
      // 90 min ≈ full effect, só banco/entrou ≈ metade, não jogou ≈ 0
      const minutesFactor = started ? 1 : appeared ? 0.5 : 0;
      const lastAppearance = player.last_appearance_matchweek || 0;
      const playedPrev = lastAppearance > 0 && lastAppearance === calendarIndex - 1;

      let delta = 0;

      // Acima do teto de potencial: deriva suave de retorno à média,
      // compensável por performance forte (golos / clean sheet)
      if (room < 0 && rng() < MATCH_TUNING.evoAboveCeilingRoll) {
        delta -= 1;
      }

      if (!appeared) {
        // ── Inatividade / "enferrujar" ─────────────────────────────
        // Quem não joga há 3+ eventos do calendário tem risco crescente
        // de perder qualidade, mesmo abaixo do potencial. Contratações
        // recentes têm um período de graça antes de sofrerem rust.
        const justJoined =
          (player.joined_matchweek || 0) >= calendarIndex - 3;
        const idleForAWhile =
          lastAppearance === 0 ? !justJoined : lastAppearance < calendarIndex - 3;
        if (idleForAWhile && rng() < MATCH_TUNING.evoRustRoll) {
          delta -= 1;
        }
        if (delta !== 0) {
          updates.push({
            id: player.id,
            skill: clampSkill((player.skill || 0) + delta),
          });
        }
        continue;
      }

      // Convivência: jogadores abaixo da média do plantel evoluem ao
      // conviver com colegas mais talentosos (spec: "evoluem se
      // conviverem com jogadores mais talentosos").
      // Só aplica enquanto houver cabeçote até ao potencial.
      if (
        room > 0 &&
        diff >= 1 &&
        rng() <
          Math.min(
            MATCH_TUNING.evoCohabitMax,
            MATCH_TUNING.evoCohabitBase + diff / MATCH_TUNING.evoCohabitDivisor,
          ) * minutesFactor
      ) {
        delta += 1;
      }

      // Vitória reforça evolução para jogadores abaixo da média
      if (
        room > 0 &&
        teamResult === "W" &&
        diff >= 0 &&
        rng() <
          Math.min(
            MATCH_TUNING.evoWinMax,
            MATCH_TUNING.evoWinBase + diff / MATCH_TUNING.evoWinDivisor,
          ) * minutesFactor
      ) {
        delta += 1;
      }

      // Maus resultados: jogadores perdem qualidade se houver derrotas
      // (spec: "perdem qualidade se houver muitos maus resultados seguidos")
      // Jogadores acima da média do plantel são mais afectados
      if (teamResult === "L") {
        const lossPressure = Math.min(
          MATCH_TUNING.evoLossMax,
          MATCH_TUNING.evoLossBase +
            Math.max(0, -diff) / MATCH_TUNING.evoLossDivisor,
        );
        if (rng() < lossPressure) delta -= 1;
        // Derrotas consecutivas aumentam a pressão de decaimento
        const streak = teamLossStreak.get(player.team_id) || 0;
        if (
          streak >= 2 &&
          rng() <
            Math.min(
              MATCH_TUNING.evoStreakMax,
              MATCH_TUNING.evoStreakBase +
                MATCH_TUNING.evoStreakSlope * (streak - 1),
            )
        ) {
          delta -= 1;
        }
      }

      // Empate contra equipa mais forte — pequena hipótese de evolução
      if (
        room > 0 &&
        teamResult === "D" &&
        diff >= MATCH_TUNING.evoDrawDiff &&
        rng() < MATCH_TUNING.evoDrawChance * minutesFactor
      ) {
        delta += 1;
      }

      // ── Performance individual pós-jogo ──────────────────────────
      const goals = playerGoals.get(player.id) || 0;

      // Marcou 2+ golos: 25% de chance de +1 skill
      if (goals >= 2 && rng() < MATCH_TUNING.evoBraceChance) {
        delta += 1;
      }
      // Marcou 1 golo: 10% de chance de +1 skill
      else if (goals === 1 && rng() < MATCH_TUNING.evoGoalChance) {
        delta += 1;
      }

      // GR com clean sheet em vitória: 15% de chance de +1 skill
      if (
        player.position === "GR" &&
        teamResult === "W" &&
        teamCleanSheetWin.has(player.team_id) &&
        rng() < MATCH_TUNING.evoCleanSheetChance
      ) {
        delta += 1;
      }

      // Cartão vermelho: 20% de chance de -1 skill
      if (playerRedCards.has(player.id) && rng() < MATCH_TUNING.evoRedChance) {
        delta -= 1;
      }

      // Momentum: presença consecutiva impulsiona a evolução
      if (
        playedPrev &&
        room > 0 &&
        rng() < MATCH_TUNING.evoMomentumChance * minutesFactor
      ) {
        delta += 1;
      }
      // Estagnação por excesso de jogos sem descanso
      if (
        playedPrev &&
        (player.games_played || 0) >= 6 &&
        rng() < MATCH_TUNING.evoStagnationChance
      ) {
        delta -= 1;
      }

      if (delta !== 0) {
        updates.push({
          id: player.id,
          skill: clampSkill((player.skill || 0) + delta),
        });
      }
    }

    // Limpar prev_skill de semanas anteriores; só os que mudam esta semana ficam marcados.
    await dbRun(
      "UPDATE players SET prev_skill = NULL WHERE team_id IS NOT NULL",
    );
    if (updates.length > 0) {
      // Batch único (CASE) em vez de N UPDATEs com contador `remaining`.
      const skillCases: string[] = [];
      const valueCases: string[] = [];
      const params: any[] = [];
      const ids: number[] = [];
      for (const update of updates) {
        skillCases.push("WHEN ? THEN ?");
        valueCases.push("WHEN ? THEN ?");
        params.push(
          update.id,
          update.skill,
          update.id,
          recalcPlayerValue(update.skill),
        );
        ids.push(update.id);
      }
      const ph = ids.map(() => "?").join(",");
      await dbRun(
        `UPDATE players SET prev_skill = skill, skill = CASE id ${skillCases.join(" ")} END, value = CASE id ${valueCases.join(" ")} END WHERE id IN (${ph})`,
        [...params, ...ids],
      );
    }
    // Snapshot do skill de todos os jogadores para continuidade.
    await dbRun(
      "INSERT OR REPLACE INTO player_skill_snapshots (player_id, matchweek, season, skill) SELECT id, ?, ?, skill FROM players WHERE team_id IS NOT NULL AND skill IS NOT NULL",
      [currentMatchweek, season],
    );
  } catch (err) {
    console.error("[engine] evolution failed:", err);
  }
}

// ─── EXTRA TIME ──────────────────────────────────────────────────────────────
// Simulates a single continuous extra-time period (91–120).
// No halftime pause at 105 — ET runs straight through.
export async function simulateExtraTime(
  db: Db,
  fixture: MatchFixture,
  homeTactic: Tactic | null,
  awayTactic: Tactic | null,
  context: SegmentContext,
) {
  // Use real-time speed ONLY if a human coach is participating in ANY of the ET fixtures.
  // When multiple ET fixtures run in parallel (Promise.all), NPC-only fixtures
  // must use the same delay as the human fixture — otherwise they race from
  // 91→120 in ~3s and their matchMinuteUpdate events advance liveMinute to 120
  // before the human fixture's minute-91 update arrives, causing the clock to
  // visibly jump forward and then snap back.
  // If no human is in ANY ET fixture, run fast (100ms) to avoid wasting time.
  const anyHumanInET =
    context.hasHumanInET ??
    (context.game &&
      Object.values(context.game.playersByName).some(
        (p: any) =>
          !!p.socketId &&
          (p.teamId === fixture.homeTeamId || p.teamId === fixture.awayTeamId),
      ));
  const msPerMinute = anyHumanInET ? 1000 : 100;

  const emitMinuteUpdate = (minute: number) => {
    if (!context.io || !context.game) return;
    context.io.to(context.game.roomCode).emit("matchMinuteUpdate", {
      minute,
      fixtures: [
        {
          homeTeamId: fixture.homeTeamId,
          awayTeamId: fixture.awayTeamId,
          homeGoals: fixture.finalHomeGoals,
          awayGoals: fixture.finalAwayGoals,
          minuteEvents: (fixture.events || []).filter(
            (e: any) => e.minute === minute,
          ),
          homePossession: fixture._homePossession ?? 50,
          awayPossession: fixture._awayPossession ?? 50,
        },
      ],
    });
  };

  // Período único 91–120 (fix #6): uma só chamada, com setup (plantéis,
  // morale, rosters, lineups) feito uma vez. O hook onMinute preserva os
  // updates ao vivo e o ritmo do relógio minuto a minuto.
  await simulateMatchSegment(db, fixture, homeTactic, awayTactic, 91, 120, {
    ...context,
    onMinute: async (minute: number) => {
      emitMinuteUpdate(minute);
      if (minute < 120) await new Promise((r) => setTimeout(r, msPerMinute));
    },
  });

  const etEvents = fixture.events.filter((e: any) => e.minute >= 91);
  return { etEvents };
}

/**
 * Escolhe o batedor do desempate por skill, sem repetir enquanto houver
 * estreantes. Exportado para teste (U6) — a volta reinicia quando todos já
 * marcaram, mas o escolhido é SEMPRE marcado como usado (inclusive ao
 * reiniciar): senão o melhor batedor repetia em chutes seguidos de morte
 * súbita longa.
 */
export function pickShootoutTaker(
  squad: PlayerRow[],
  usedIds: Set<number>,
): PlayerRow | null {
  let available = squad.filter((p) => !usedIds.has(p.id));
  if (available.length === 0) {
    // Cycle through again if all have taken a penalty
    usedIds.clear();
    available = [...squad];
  }
  // Pick by skill
  available.sort((a, b) => getEffectiveSkill(b) - getEffectiveSkill(a));
  const taker = available[0] || null;
  if (taker) usedIds.add(taker.id);
  return taker;
}

// ─── PENALTY SHOOTOUT ─────────────────────────────────────────────────────────
// Simulates a penalty shootout between two squads.
// Returns { homeGoals, awayGoals, kicks: [{team, playerName, scored}] }
export function simulatePenaltyShootout(
  homeSquad: PlayerRow[],
  awaySquad: PlayerRow[],
  rng: Rng = Math.random,
) {
  const kicks = [];
  let homeGoals = 0;
  let awayGoals = 0;

  const homeUsed = new Set<number>();
  const awayUsed = new Set<number>();
  const homeGK = homeSquad.find((p) => p.position === "GR") || homeSquad[0];
  const awayGK = awaySquad.find((p) => p.position === "GR") || awaySquad[0];

  const calcScoredChance = (taker, gk) => {
    const takerSkill = taker ? getEffectiveSkill(taker) || 10 : 10;
    const gkSkill = gk ? getEffectiveSkill(gk) || 10 : 10;
    return Math.max(
      MATCH_TUNING.shootoutMin,
      Math.min(
        MATCH_TUNING.shootoutMax,
        MATCH_TUNING.shootoutBase +
          (takerSkill - gkSkill) / MATCH_TUNING.shootoutSkillDivisor,
      ),
    );
  };

  // Chutes alternados (ordem real: casa → fora em cada ronda). A decisão é
  // verificada após CADA chute — o segundo batedor joga a saber o resultado
  // do primeiro, como no futebol real (antes os dois chutavam em
  // "simultâneo" e só se verificava no fim da ronda).
  let homeTaken = 0;
  let awayTaken = 0;
  const takeKick = (side: "home" | "away", suddenDeath = false) => {
    const squad = side === "home" ? homeSquad : awaySquad;
    const used = side === "home" ? homeUsed : awayUsed;
    // O GR que defende é o da equipa adversária.
    const gk = side === "home" ? awayGK : homeGK;
    const taker = pickShootoutTaker(squad, used);
    const scored = rng() < calcScoredChance(taker, gk);
    if (scored) {
      if (side === "home") homeGoals++;
      else awayGoals++;
    }
    if (side === "home") homeTaken++;
    else awayTaken++;
    kicks.push({
      team: side,
      playerName: taker ? taker.name : "?",
      scored,
      ...(suddenDeath ? { suddenDeath: true } : {}),
    });
  };
  // Decisão regulamentar: a equipa em desvantagem já não chega ao empate
  // mesmo marcando todos os chutes que lhe restam (5 - já marcados).
  const regulationDecided = () =>
    homeGoals > awayGoals + (5 - awayTaken) ||
    awayGoals > homeGoals + (5 - homeTaken);

  // 5 regulation rounds
  for (let round = 0; round < 5; round++) {
    takeKick("home");
    if (regulationDecided()) break;
    takeKick("away");
    if (regulationDecided()) break;
  }

  // Sudden death if still tied
  let sdRound = 0;
  while (homeGoals === awayGoals && sdRound < MATCH_TUNING.shootoutSuddenDeathCap) {
    sdRound++;
    // Na morte súbita a decisão só é possível com igual nº de chutes —
    // o chute da casa nunca decide sozinho, mas o de fora sim.
    takeKick("home", true);
    takeKick("away", true);

    if (homeGoals !== awayGoals) break; // One scored, other didn't → winner decided
  }

  // Failsafe do desempate: após 20 rondas de morte súbita ainda empatado
  // (probabilidade ínfima), sorteio imparcial em vez de favorecer a casa.
  if (homeGoals === awayGoals) {
    if (rng() < MATCH_TUNING.shootoutFailsafeHome) homeGoals++;
    else awayGoals++;
  }

  return { homeGoals, awayGoals, kicks };
}
