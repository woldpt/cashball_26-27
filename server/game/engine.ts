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
  CUP_FINAL_SPECTATOR_MS_PER_MINUTE,
  DEFAULT_MS_PER_MINUTE,
} from "../gameConstants";
import {
  computeAbsentees,
  isSeatPresent,
  waitForPresence,
} from "../roomStateHelpers";

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
  chanceSavedPhrase,
  chancePostPhrase,
  chanceOffTargetPhrase,
  bigSavePhrase,
  weatherPhrase,
  extraTimeStartPhrase,
  finalStartPhrase,
  finalGoalPhrase,
  finalEndPhrase,
  tacticStartPhrase,
  secondHalfTacticPhrase,
  styleDisplayLabel,
  tacticChangePhrase,
  noSubInjuryPhrase,
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
  crowdFactorForOccupancy,
  computePossession,
  computeChanceGoalProbability,
  getGoalTimeMultiplier,
  getWeatherGoalMultiplier,
  quotaFromFormation,
} from "./matchCalculations";
import type { SidePower } from "./matchCalculations";
import type { Rng } from "./matchCalculations";
import { recalcPlayerValue, MATCH_TUNING, MORALE_NEUTRAL } from "../gameConstants";
import { getTacticBonus } from "./tacticFamiliarity";
import { deriveBench } from "./bench";
import { logMedicalNews } from "../coreHelpers";

// Re-exportado de ./dbAsync (extração F1 — a engine mantém o contrato)
export type { Db } from "./dbAsync";
export { dbRunAsync, dbAllAsync, dbGetAsync } from "./dbAsync";
import { dbRunAsync, dbAllAsync, dbGetAsync, type Db } from "./dbAsync";

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
  // Final da Taça sem humanos: ritmo de gala (meio-tempo) no prolongamento.
  cupFinalSpectator?: boolean;
};

// Re-exportado de ./matchDeltas (extração — a engine mantém o contrato)
export { queueMatchDeltaWrites } from "./matchDeltas";
export type { MatchDeltas, MatchInjuryDelta, MatchYellowDelta } from "./matchDeltas";
import {
  getMatchDeltas,
  recordMatchGoal,
  recordMatchRed,
  recordMatchYellow,
  recordMatchInjury,
  recordMatchAppearances,
} from "./matchDeltas";

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
  const starterIds = new Set(squad.map((p: PlayerRow) => p.id));
  const starters = squad.map((p) => ({
    id: p.id,
    name: p.name,
    position: p.position,
    is_star: p.is_star || 0,
    skill: getEffectiveSkill(p),
    photo: (p as any).photo || null,
    nationality: (p as any).nationality || null,
    ...getMatchFatigueSnapshot(fixture, side, p.id),
    is_starter: true,
  }));
  const bench = (fullRoster || [])
    .filter(
      (p: PlayerRow) =>
        !starterIds.has(p.id) &&
        (!tactic?.positions || tactic.positions[p.id] === "Suplente"),
    )
    .map((p: PlayerRow) => ({
      id: p.id,
      name: p.name,
      position: p.position,
      is_star: p.is_star || 0,
      skill: getEffectiveSkill(p),
      photo: p.photo || null,
      nationality: p.nationality || null,
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

    // Padrão C/F aproximado (não perfeito — como no futebol real, há quebras).
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
  // Payload original (para re-emitir ao treinador que (re)ligar a meio da
  // janela) + deadline absoluta (para o countdown do cliente derivar do
  // servidor em vez de um valor fixo local).
  payload: Record<string, unknown>;
  expiresAt: number;
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

async function waitForMatchAction({
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
  const humanCoach = Object.values(game.playersByName).find(
    (p) => p.teamId === teamId,
  );
  if (!humanCoach) {
    // Equipa sem treinador humano (NPC): a decisão automática é o normal.
    return Promise.resolve({ choice: fallback(), source: "auto" });
  }

  // Treinador humano AUSENTE: a sala congela. Não se decide por ele — era
  // exatamente isto que fazia o jogo avançar sozinho para a jornada seguinte
  // enquanto o telemóvel estava sem rede. Nada anda até ele voltar (ou o
  // assento ser libertado explicitamente: kick/despedida/`adminReleaseRoom`).
  if (!isSeatPresent(game, humanCoach.name)) {
    io.to(game.roomCode).emit("systemMessage", {
      text: `⏸ Sala em pausa — à espera de ${humanCoach.name}.`,
      broadcast: true,
    });
    await waitForPresence(game, io);
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
        // A escolha aplicada permite ao cliente sincronizar posições e
        // contadores mesmo quando a ação foi resolvida por fallback/timeout
        // (o cliente não emitiu o resolve e ficaria desincronizado).
        choice: choice ?? null,
      });
      // Quando a pausa de decisão termina, notificar todos os jogadores
      // (substituição pedida + lesão/penálti/GR abrem banner nos outros coaches).
      if (
        type === "user_substitution" ||
        type === "injury" ||
        type === "penalty" ||
        type === "emergency_gk" ||
        type === "gk_red_card"
      ) {
        io.to(game.roomCode).emit("substitutionPauseEnded", { teamId });
      }
      resolve({ choice, source });
    };

    // A janela só corre com o treinador presente. Se ele desaparecer a meio
    // dela, o relógio reinicia quando voltar em vez de decidir por ele.
    const arm = (): ReturnType<typeof setTimeout> => {
      const t = setTimeout(async () => {
        if (!isSeatPresent(game, humanCoach.name)) {
          io.to(game.roomCode).emit("matchActionBlocked", {
            actionId,
            teamId,
            type,
            absent: computeAbsentees(game),
          });
          await waitForPresence(game, io);
          const entry = getPendingMatchActions(game).get(actionId);
          if (!entry) return; // foi consumida entretanto (leave/kick)
          entry.expiresAt = Date.now() + timeoutMs;
          entry.timer = arm();
          io.to(game.roomCode).emit("matchActionRequired", {
            actionId,
            type,
            teamId,
            ...payload,
            ...(fixtureData || {}),
            expiresAt: entry.expiresAt,
          });
          return;
        }
        finalize(fallback(), "auto");
      }, timeoutMs);
      return t;
    };

    const timer = arm();
    const expiresAt = Date.now() + timeoutMs;
    getPendingMatchActions(game).set(actionId, {
      actionId,
      type,
      teamId,
      timer,
      finalize,
      fallback,
      payload: { ...(payload || {}), ...(fixtureData || {}) },
      expiresAt,
    });

    io.to(game.roomCode).emit("matchActionRequired", {
      actionId,
      type,
      teamId,
      ...payload,
      ...(fixtureData || {}),
      expiresAt,
    });

    // Lesão/penálti/GR: avisar os outros coaches com o mesmo banner da
    // pausa de substituição (a substituição pedida já notificou via
    // "request_substitution").
    if (
      type === "injury" ||
      type === "penalty" ||
      type === "emergency_gk" ||
      type === "gk_red_card"
    ) {
      io.to(game.roomCode).emit("substitutionPauseStarted", {
        teamId,
        coachName: (humanCoach as any)?.name,
        type,
      });
    }
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
  const idx = squad.findIndex((p: PlayerRow) => p.id === outId);
  if (idx > -1) squad.splice(idx, 1);
  lineupIds.delete(outId);
  (fixture._subbedOut ??= new Set<number>()).add(outId);

  const lineupRef = side === "home" ? fixture.homeLineup : fixture.awayLineup;
  if (lineupRef) {
    const li = lineupRef.findIndex((p: PlayerRow) => p.id === outId);
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
  const idx = squad.findIndex((p: PlayerRow) => p.id === outId);
  if (idx > -1) squad.splice(idx, 1, incoming);
  lineupIds.delete(outId);
  lineupIds.add(incoming.id);
  (fixture._subbedOut ??= new Set<number>()).add(outId);
  if (countSub) incrementSubCount(fixture, teamId);

  const lineupRef = side === "home" ? fixture.homeLineup : fixture.awayLineup;
  if (lineupRef) {
    const li = lineupRef.findIndex((p: PlayerRow) => p.id === outId);
    if (li > -1) {
      // is_starter é o que o cliente usa para separar XI/banco (MatchView) e o
      // briefing para derivar a formação — sem ele o jogador que entrava
      // desaparecia do relvado e continuava a constar como suplente (um
      // "suplente" marcava golos). A entrada antiga de banco do mesmo jogador
      // tem de sair: senão ficava duplicado (XI sem flag + banco com false).
      lineupRef[li] = {
        id: incoming.id,
        name: incoming.name,
        position: incoming.position,
        is_star: incoming.is_star || 0,
        is_starter: true,
        skill: getEffectiveSkill(incoming),
        ...getMatchFatigueSnapshot(fixture, side, incoming.id),
      };
      for (let i = lineupRef.length - 1; i > li; i--) {
        if (lineupRef[i].id === incoming.id) lineupRef.splice(i, 1);
      }
      for (let i = li - 1; i >= 0; i--) {
        if (lineupRef[i].id === incoming.id) lineupRef.splice(i, 1);
      }
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
  const ci = squad.findIndex((p: PlayerRow) => p.id === chosen.id);
  const converted = convertToEmergencyGK(chosen);
  if (ci > -1) squad[ci] = converted;
  bumpPowerVersion(fixture, side);

  // Snapshot de lineup: o escolhido passa a constar como GR (skill piso).
  const lineupRef = side === "home" ? fixture.homeLineup : fixture.awayLineup;
  if (lineupRef) {
    const li = lineupRef.findIndex((p: PlayerRow) => p.id === chosen.id);
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
  // ATENÇÃO: oldSkill vem do fullRoster (objetos reais da BD) e NUNCA de
  // injuredPlayer.skill — um clone de GR improvisado (convertToEmergencyGK) tem
  // skill=EMERGENCY_GK_SKILL e pode estar no squad; gravar essa skill na BD
  // destruiria permanentemente o atributo persistente do jogador real.
  const oldSkill =
    (fullRoster || []).find((p: any) => p.id === injuredPlayer.id)?.skill ??
    injuredPlayer.skill ??
    0;
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
    // O toast pode passar despercebido: sem janela de escolha, o treinador tem
    // de saber explicitamente que o lesado sai sem reposição.
    const capTeamName =
      teamSide === "home"
        ? fixture.homeTeam?.name || String(teamId)
        : fixture.awayTeam?.name || String(teamId);
    io.to(game.roomCode).emit("systemMessage", {
      text: noSubInjuryPhrase(injuredPlayer.name, capTeamName),
      broadcast: true,
    });
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
        (p: any) =>
          !lineupIds.has(p.id) &&
          !(fixture._subbedOut as Set<number> | undefined)?.has(p.id),
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
  const roster = fullRoster || squad;
  const { availableBench, grBench } = deriveBench({
    roster,
    tacticPositions: tactic?.positions,
    lineupIds,
    fixture,
  });

  // If the injured player is a goalkeeper, prefer substituting with another goalkeeper
  let substituteCandidates = availableBench;
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
  // Validar contra substituteCandidates (a lista enviada ao cliente), NÃO
  // availableBench: quando o lesionado é GR, a lista mostrada só tem GR —
  // um choice válido fora dela deixaria a equipa sem GR em campo.
  const replacement =
    forcedChoice.playerIn != null &&
    substituteCandidates.find((p) => p.id === forcedChoice.playerIn);
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

// Probabilidade de escape do rolo de cansaço: baseada na resistência
// (por ponto) + bónus para GR (posição "GR", incl. improvisado) — os GR
// cansam-se muito menos que os jogadores de campo.
function fatigueSkipChance(p: PlayerRow): number {
  const resistance = p.resistance ?? RES_NEUTRAL;
  const skipChance = (resistance - 1) * MATCH_TUNING.fatigueSkipPerResPoint;
  // Teto 1: sem isto o GR com resistência alta dava 1,09 — imune à fadiga.
  return Math.min(
    1,
    p.position === "GR"
      ? skipChance + MATCH_TUNING.fatigueGRSkipBonus
      : skipChance,
  );
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

    if (rng() >= fatigueSkipChance(p)) {
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

    if (rng() < fatigueSkipChance(p)) continue;

    applyFatigueToPlayer(fixture, side, p, 1, rng);
  }
}

// Gera os eventos de introdução (weather + táctica) do minuto 1 antes da simulação.
// Clima determinístico partilhado com a previsão do briefing — ÚNICA via
// de emissão do evento `weather` (antes em 2 cópias: intro + arranque do
// segmento). Idempotente por `fixture._weather`.
function ensureWeatherEvent(fixture: MatchFixture): void {
  if (fixture._weather) return;
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

// Comentário táctico do minuto 1 — ÚNICA implementação (antes em 2 cópias:
// intro + passo do minuto). Idempotente por `_firstHalfStartComment`.
function pushFirstHalfStartComment(
  fixture: MatchFixture,
  homeTactic: Tactic | null,
  awayTactic: Tactic | null,
  minute = 1,
): void {
  if (fixture._firstHalfStartComment) return;
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
      text: `[${minute}'] 🏟️ ${finalStartPhrase()}`,
    });
  } else {
    fixture.events.push({
      minute,
      type: "phase_start",
      team: null,
      emoji: "📋",
      text: `[${minute}'] 📋 ${tacticStartPhrase(homeName, homeFormation, homeStyle, awayName, awayFormation, awayStyle)}`,
    });
  }
  fixture._firstHalfStartComment = true;
}

// Comentário táctico do minuto 46 — ÚNICA implementação (antes em 2 cópias:
// pré-geração + passo do minuto). Idempotente por `_secondHalfStartComment`.
function pushSecondHalfStartComment(
  fixture: MatchFixture,
  homeTactic: Tactic | null,
  awayTactic: Tactic | null,
  minute = 46,
): void {
  if (fixture._secondHalfStartComment) return;
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
    text: `[${minute}'] 🔔 ${secondHalfTacticPhrase(homeName, homeFormation, homeStyle, awayName, awayFormation, awayStyle)}`,
  });
  fixture._secondHalfStartComment = true;
}

// Chamada em weeklyFlowHelpers.ts antes de emitir matchSegmentStart, para que os
// comentários já estejam no payload durante a pausa de 5s.
// As guards na engine (!fixture._weather / !fixture._firstHalfStartComment) evitam duplicação.
export function generateIntroEvents(
  fixture: MatchFixture,
  homeTactic: Tactic | null,
  awayTactic: Tactic | null,
): void {
  // Weather — clima determinístico partilhado com a previsão do briefing.
  ensureWeatherEvent(fixture);

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
  pushFirstHalfStartComment(fixture, homeTactic, awayTactic);
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
  pushSecondHalfStartComment(fixture, homeTactic, awayTactic);
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

/**
 * Restauro único de plantel por lado (F2): as vias casa/fora eram o mesmo
 * bloco de ~25 linhas 2× (lineup + eventos → DB → juniores em cache →
 * ensureStartingXI em build fresco). Difere só em lado/lineup/caches.
 */
async function restoreSideSquad(
  db: Db,
  fixture: MatchFixture,
  side: MatchSide,
  tactic: Tactic | null,
  currentMatchweek: number,
): Promise<PlayerRow[]> {
  const squadKey = side === "home" ? "_homeSquad" : "_awaySquad";
  const rosterKey = side === "home" ? "_homeFullRoster" : "_awayFullRoster";
  const lineup = side === "home" ? fixture.homeLineup : fixture.awayLineup;
  const teamId = side === "home" ? fixture.homeTeamId : fixture.awayTeamId;
  const cached = (fixture as any)[squadKey];
  const isFreshBuild = !cached;
  let squad;
  if (cached) {
    squad = cached;
  } else if (lineup && lineup.length > 0) {
    const ids = new Set(lineup.map((p: any) => p.id));
    for (const e of fixture.events || []) {
      if (e.team === side) {
        if ((e.type === "red" || e.type === "injury") && e.playerId)
          ids.delete(e.playerId);
        if (e.type === "substitution" && e.playerId) ids.add(e.playerId);
      }
    }
    // Junior GRs have negative IDs — fetch real players from DB, then re-add any juniors.
    // Em erro de DB, segue com [] (o ensureStartingXI repõe juniores).
    const allIds = Array.from(ids);
    const realIds = allIds.filter((id: number) => id > 0);
    const juniorIds = new Set(allIds.filter((id: number) => id < 0));
    const ph = realIds.length > 0 ? realIds.map(() => "?").join(",") : "0";
    const dbPlayers = await dbAllAsync(
      db,
      `SELECT * FROM players WHERE id IN (${ph})`,
      realIds.length > 0 ? realIds : [],
    ).catch(() => []);
    // Re-add cached junior GRs whose IDs are still in the active lineup.
    const cachedJuniors = ((fixture as any)[rosterKey] || []).filter((p: any) =>
      juniorIds.has(p.id),
    );
    squad = [...dbPlayers, ...cachedJuniors];
    (fixture as any)[squadKey] = squad;
  } else {
    squad = await getTeamSquad(db, teamId, tactic, currentMatchweek);
    (fixture as any)[squadKey] = squad;
  }
  if (isFreshBuild) {
    squad = ensureStartingXI(squad, teamId, currentMatchweek, tactic?.formation);
    (fixture as any)[squadKey] = squad;
  }
  return squad;
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

  const homeSquad = await restoreSideSquad(db, fixture, "home", homeTactic, currentMatchweek);

  const awaySquad = await restoreSideSquad(db, fixture, "away", awayTactic, currentMatchweek);

  if (!fixture._yellowCards) {
    fixture._yellowCards = {};
  }

  // Track games played — registado uma vez por jogo (minuto 1 da 1ª parte).
  // Só acumulado em memória (fixture._deltas); o flush transacional no apito
  // final aplica o incremento com o guard anti-replay por calendarIndex.
  if (startMin === 1) {
    const participantIds = ([
      ...Array.from(new Set((homeSquad || []).map((p: PlayerRow) => p.id))),
      ...Array.from(new Set((awaySquad || []).map((p: PlayerRow) => p.id))),
    ].filter((id) => typeof id === "number" && id > 0) as number[]);
    if (participantIds.length > 0) {
      recordMatchAppearances(fixture, participantIds, currentCalendarIndex);
    }

    // Weather event — emitted once at the start of each match (mesma fonte
    // da previsão do briefing: getWeatherForFixture).
    ensureWeatherEvent(fixture);
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
        (row) => (row && row.morale != null ? row.morale : 25),
        () => 25,
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

  // Carga de lesões: equipa que começa o jogo com jogadores lesionados
  // (injury_until_matchweek >= jornada atual) tem a taxa de lesão reduzida
  // neste jogo (amortiza lesões consecutivas). Calculado da BD no arranque:
  // estável em replays de crash (o estado da BD já inclui o flush da
  // jornada anterior, que finaliza antes da seguinte começar).
  if (fixture._injuryLoadMult === undefined) {
    const countInjured = (teamId: number) =>
      dbGetAsync(
        db,
        "SELECT COUNT(*) AS n FROM players WHERE team_id = ? AND injury_until_matchweek >= ?",
        [teamId, currentMatchweek],
      )
        .then((row) => (row && typeof row.n === "number" ? row.n : 0))
        .catch(() => 0);
    const [homeInjured, awayInjured] = await Promise.all([
      countInjured(fixture.homeTeamId),
      countInjured(fixture.awayTeamId),
    ]);
    fixture._injuryLoadMult = {
      home: homeInjured > 0 ? MATCH_TUNING.injuryLoadSoftener : 1,
      away: awayInjured > 0 ? MATCH_TUNING.injuryLoadSoftener : 1,
    };
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
  const homeLineupIds = new Set<number>(homeSquad.map((p: PlayerRow) => p.id));
  const awayLineupIds = new Set<number>(awaySquad.map((p: PlayerRow) => p.id));


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
  // Ambiente da casa: a ocupação foi fixada no arranque (runMatchSegment).
  // Sem ocupação (replays antigos, testes) → neutro, sem efeito no jogo.
  const homeCrowd = crowdFactorForOccupancy(
    typeof fixture._occupancy === "number" ? fixture._occupancy : null,
  );
  const powers = {
    home: computeSidePower(homeSquad, homeTactic, homeMorale, fam.home, homeCrowd),
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
      side === "home" ? homeCrowd : 1,
    );
    fixture[field] = { power, version };
    if (side === "home") powers.home = power;
    else powers.away = power;
    return power;
  };

  // Posse e nº de chances (hatrick-style): os médios repartem o total de
  // chances, fixado no 1.º apito (não por minuto). A curva de tempo
  // espalha-as; a qualidade (ATA vs DEF+GR) decide a conversão.
  if (fixture._homeChances == null) {
    const possH = computePossession(
      powers.home.midStrength || 0,
      powers.away.midStrength || 0,
      homeTactic?.style,
      awayTactic?.style,
    );
    fixture._homePossession = Math.round(possH * 100);
    fixture._awayPossession = 100 - fixture._homePossession;
    fixture._homeChances = MATCH_TUNING.chancesTotal * possH;
    fixture._awayChances = MATCH_TUNING.chancesTotal * (1 - possH);
  }

  for (let minute = startMin; minute <= endMin; minute++) {
    fixture._minute = minute;

    // Guarda anti-duplo-minuto: uma fixture nunca simula o mesmo minuto duas
    // vezes. Sem isto, dois arranques sobrepostos da mesma semana (dois
    // "Pronto" quase simultâneos, antes do single-flight do lobby) ou um
    // segmento repetido produziam dois golos no mesmo minuto da mesma equipa
    // — `goalScoredThisMinute` só protege dentro de uma passagem.
    const alreadySimulated = fixture._simulatedMinutes?.has(minute);
    if (alreadySimulated) {
      // Aviso uma vez por minuto/fixture (um segmento inteiro já simulado são
      // 45 linhas por jogo × N jogos e enchia o log). Inclui o segmento para
      // identificar de imediato quem re-simulou.
      const warned: Set<number> = (fixture._dupMinuteWarned ??= new Set<number>());
      if (!warned.has(minute)) {
        warned.add(minute);
        console.warn(
          `[${game?.roomCode}] ⚠ minuto ${minute} já simulado nesta fixture (segmento ${startMin}-${endMin}) — ignorado`,
        );
      }
    } else {
      (fixture._simulatedMinutes ??= new Set<number>()).add(minute);
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
    }

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
      text: `[${minute}'] ${tacticChangePhrase(homeName, homeTacticChange.formation, homeTacticChange.style)}`,
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
      text: `[${minute}'] ${tacticChangePhrase(awayName, awayTacticChange.formation, awayTacticChange.style)}`,
    });
  }
}

/**
 * Passo do minuto: comentários de fase (1'/46'/91') — cada um uma vez por jogo.
 */
function pushPhaseStartComments(tick: MinuteTickContext): void {
  const { fixture, minute, homeTactic, awayTactic } = tick;

  if (minute === 1) pushFirstHalfStartComment(fixture, homeTactic, awayTactic, minute);
  if (minute === 46) pushSecondHalfStartComment(fixture, homeTactic, awayTactic, minute);

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

  const maybeOpenPlayGoal = (attackingSide: MatchSide) => {
    if (goalScoredThisMinute) return;
    const attacking = attackingSide === "home" ? currentHome : currentAway;
    const defending = attackingSide === "home" ? currentAway : currentHome;
    const isHome = attackingSide === "home";

    // Hatrick-style: posse (médios, fixa no apito) → nº de chances → cada
    // chance é um evento concreto: vira golo ou vai para o log do jogo
    // (defesa do GR, poste, ao lado).
    const nChances = isHome ? fixture._homeChances : fixture._awayChances;
    if (nChances == null) return;
    const chanceRate = (nChances * getGoalTimeMultiplier(minute)) / 90;
    if (rng() >= chanceRate) return;

    // Chance! O rematador (qualquer jogador de campo) é creditado — o mesmo
    // jogador marca ou falha o lance. O peso por posição (ATA domina, DEF
    // raro) vive no weightedPickScorer.
    const scoringSquad = isHome ? powers.home.squad : powers.away.squad;
    const shooters = scoringSquad.filter((p) => p.position !== "GR");
    const scorer =
      shooters.length > 0 ? weightedPickScorer(shooters, rng) : scoringSquad[0];

    // Ego conflict penalty: 3+ craques no onze titular reduzem probabilidade
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

    // A qualidade (ATA vs DEF+GR, médias) decide a conversão; casa/clima/ego
    // continuam multiplicadores.
    let probGoal = computeChanceGoalProbability(
      attacking.attack,
      defending.defense,
    );
    if (!isCupFinalRound(fixture.round)) {
      probGoal *= isHome
        ? MATCH_TUNING.homeGoalFactor
        : MATCH_TUNING.awayGoalFactor;
    }
    probGoal *= getWeatherGoalMultiplier(fixture._weather);
    probGoal *= egoFactor;

    if (rng() >= probGoal) {
      // Sem golo: o lance vai para o log com o seu desfecho.
      const r = rng();
      const defendingSquad = isHome ? powers.away.squad : powers.home.squad;
      const grPlayer = defendingSquad.find((p) => p.position === "GR");
      let emoji: string;
      let text: string;
      if (r < MATCH_TUNING.chanceSaveShare) {
        const grName = grPlayer ? grPlayer.name : "o guarda-redes";
        emoji = "🧤";
        text = `[${minute}'] 🧤 ${chanceSavedPhrase(
          scorer ? scorer.name : "Jogador",
          grName,
        )}`;
      } else if (r < MATCH_TUNING.chancePostShare) {
        emoji = "🥅";
        text = `[${minute}'] 🥅 ${chancePostPhrase(
          scorer ? scorer.name : "Jogador",
        )}`;
      } else {
        emoji = "💨";
        text = `[${minute}'] 💨 ${chanceOffTargetPhrase(
          scorer ? scorer.name : "Jogador",
        )}`;
      }
      fixture.events.push({
        minute,
        type: "chance",
        team: attackingSide,
        emoji,
        playerId: scorer ? scorer.id : null,
        playerName: scorer ? scorer.name : "Jogador",
        text,
      });
      return;
    }

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
  // Amigável de pré-época: só para testar — sem cartões nem lesões.
  const isFriendly = game?.currentEvent?.type === "friendly";
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
    const attackers = nearMissSquad.filter((p) => p.position !== "GR");
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
      const { availableBench, grBench } = deriveBench({
        roster: fullRoster,
        tacticPositions: tactic?.positions,
        lineupIds,
        fixture,
      });
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
        // Acumulação de amarelos (FIFA): ao 3º em jogos oficiais (o amigável
        // não gera cartões), castigo de 1 jogo e contagem zerada no flush.
        // O 2º amarelo in-game que vira vermelho não acumula — é expulsão.
        const banUntil =
          (offender.yellow_cards || 0) + (fixture._yellowCards[offenderId] || 0) >= 3
            ? currentMatchweek + 1
            : null;
        recordMatchYellow(fixture, offenderId, banUntil);
        if (banUntil != null) {
          // Notícia própria no momento do 3º amarelo (à FIFA: "vai cumprir
          // castigo"); idempotente por (jogador, until) — o replay pós-crash
          // não duplica e o scan genérico pós-finalização é deduplicado.
          logMedicalNews(
            game,
            side === "home" ? fixture.homeTeamId : fixture.awayTeamId,
            "suspension",
            offender,
            banUntil,
            currentMatchweek,
            undefined,
            io,
            undefined,
            "yellow",
          );
        }
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
    (1 + (homeAggAvg - 30) * MATCH_TUNING.cardAggPerPoint);
  const awayCardProb =
    MATCH_TUNING.cardBaseRate *
    (1 + (awayAggAvg - 30) * MATCH_TUNING.cardAggPerPoint);
  // No último minuto regulamentar da liga não disparar cartões — um vermelho
  // ao GR abriria a janela obrigatória de substituição após o apito final
  if (!isLastLeagueMinute && !isFriendly && rng() < homeCardProb) await emitCard(true);
  if (!isLastLeagueMinute && !isFriendly && rng() < awayCardProb) await emitCard(false);

  // Lesões: rolls independentes por lado (antes dos multiplicadores de clima
  // e de carga de lesões). A taxa total equivale ao roll global anterior
  // (0,3%/min para as duas equipas), mas agora permite multiplicador
  // por equipa (carga de lesões).
  const weatherInjuryMult =
    MATCH_TUNING.injuryWeatherMult[fixture._weather ?? ""] ?? 1.0;
  const injuryBasePerSide =
    (MATCH_TUNING.injuryPerMinute * weatherInjuryMult) / 2;
  const homeInjuryMult = fixture._injuryLoadMult?.home ?? 1;
  const awayInjuryMult = fixture._injuryLoadMult?.away ?? 1;
  const rollInjuryForSide = async (side: "home" | "away") => {
    const isHome = side === "home";
    const squad = isHome ? powers.home.squad : powers.away.squad;
    if (squad.length === 0) return;
    const injuredPlayer = squad[Math.floor(rng() * squad.length)];
    const resistanceSkip =
      ((injuredPlayer?.resistance ?? RES_NEUTRAL) - 1) *
      MATCH_TUNING.injuryResistSkipPerPoint;
    if (rng() < resistanceSkip) {
      // jogador resistiu — ignorar lesão
      return;
    }
    const injuryResult = await applyInjuryEvent({
      fixture,
      teamSide: side,
      squad,
      fullRoster: isHome ? homeFullRoster : awayFullRoster,
      lineupIds: isHome ? homeLineupIds : awayLineupIds,
      currentMatchweek,
      io,
      game,
      rng,
    });
    if (injuryResult.replaced && side === "home") powers.home.squad = squad;
    if (injuryResult.replaced && side === "away") powers.away.squad = squad;
  };
  if (!isLastLeagueMinute && !isFriendly) {
    if (rng() < injuryBasePerSide * homeInjuryMult) {
      await rollInjuryForSide("home");
    } else if (rng() < injuryBasePerSide * awayInjuryMult) {
      await rollInjuryForSide("away");
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
      // Sem substituições restantes: notifica mas mantém a janela aberta
      // para permitir alterar a mentalidade (que não consome substituição).
      // A pausa continua com as substituições bloqueadas.
      const cappedForMentality = !canMakeSubstitution(fixture, teamId);
      if (cappedForMentality) {
        io.to(game.roomCode).emit("substitutionCapReached", { teamId });
      }

      const isHome = teamId === fixture.homeTeamId;
      const squad = isHome ? powers.home.squad : powers.away.squad;
      const fullRoster = isHome ? homeFullRoster : awayFullRoster;
      const tactic = isHome ? homeTactic : awayTactic;
      const side = isHome ? "home" : "away";
      const lineupIds = isHome ? homeLineupIds : awayLineupIds;

      const onPitch = squad.filter((p: any) => lineupIds.has(p.id));

      const { availableBench, benchIds } = deriveBench({
        roster: fullRoster,
        tacticPositions: tactic?.positions,
        lineupIds,
        fixture,
        allowUnlisted: false,
      });

      const shouldOpenPause = cappedForMentality ? onPitch.length > 0 : onPitch.length > 0 && availableBench.length > 0;
      if (shouldOpenPause) {
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

          // Re-entrada é impossível: o "entra" tem de estar no banco da tática
          // (Suplente), não em campo — incluindo trocas já aplicadas neste
          // mesmo lote — e nunca ter sido substituído nesta partida.
          const incomingValid =
            playerIn != null &&
            benchIds.has(playerInId) &&
            !lineupIds.has(playerInId) &&
            !(fixture._subbedOut as Set<number> | undefined)?.has(playerInId);

          if (playerOut && incomingValid) {
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

// Re-exportado de ./evolution (extração F1 — a engine mantém o contrato)
export { applyPostMatchQualityEvolution } from "./evolution";

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
  // Exceção: a Final sem humanos tem ritmo de gala (meio-tempo) para se
  // acompanhar como espetador — igual ao tempo regulamentar da final.
  const anyHumanInET =
    context.hasHumanInET ??
    (context.game &&
      Object.values(context.game.playersByName).some(
        (p: any) =>
          !!p.socketId &&
          (p.teamId === fixture.homeTeamId || p.teamId === fixture.awayTeamId),
      ));
  const msPerMinute = anyHumanInET
    ? ((context.game as any)?.msPerMinute ?? DEFAULT_MS_PER_MINUTE)
    : context.cupFinalSpectator
      ? CUP_FINAL_SPECTATOR_MS_PER_MINUTE
      : 100;

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

// Re-exportado de ./shootout (extração F1 — a engine mantém o contrato)
export { pickShootoutTaker, simulatePenaltyShootout } from "./shootout";
