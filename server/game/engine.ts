import type { ActiveGame, Tactic } from "../types";
import {
  generateJuniorGR,
  withJuniorGRs,
  generateJuniorFieldPlayer,
  ensureFullBench,
  pickBestPlayer,
  weightedPickScorer,
  isPlayerAvailable,
} from "./playerUtils";
import {
  canMakeSubstitution,
  incrementSubCount,
} from "../gameConstants";

// Re-export so external files can still import from "./game/engine"
export {
  withJuniorGRs,
  ensureFullBench,
} from "./playerUtils";
import {
  goalPhrase,
  penaltyGoalPhrase,
  penaltyMissPhrase,
  varPhrase,
  yellowPhrase,
  redPhrase,
  injuryPhrase,
  subPhrase,
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
  getGoalTimeMultiplier,
  getWeatherGoalMultiplier,
  normaliseStyle,
  getAggressivenessValue,
  average,
  selectPenaltyTaker,
} from "./matchCalculations";
import { recalcPlayerValue } from "../gameConstants";
import { getTacticBonus } from "./tacticFamiliarity";

type Db = any;
type PlayerRow = any;
type MatchFixture = any;
type MatchSide = "home" | "away";

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

async function getTeamSquad(
  db: Db,
  teamId: number,
  tactic: Tactic | null,
  currentMatchweek = 1,
): Promise<PlayerRow[]> {
  return new Promise<PlayerRow[]>((resolve, reject) => {
    db.all("SELECT * FROM players WHERE team_id = ?", [teamId], (err, rows) => {
      if (err) return reject(err);

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
        const lineup = availableRows.filter(
          (p) => tactic.positions[p.id] === "Titular",
        );
        if (lineup.length === 11) return resolve(lineup);
      }

      // Auto-pick best 11 based on formation
      const sorted = [...availableRows].sort((a, b) => b.skill - a.skill);
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

      resolve(lineup);
    });
  });
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
  const quota = { GR: 1, DEF: 4, MED: 4, ATA: 2 };
  const currentPos = { GR: grCount, DEF: 0, MED: 0, ATA: 0 };
  for (const p of result) {
    if (p.position !== "GR" && quota[p.position] != null) {
      currentPos[p.position]++;
    }
  }

  const candidates = [...pool]
    .filter((p) => !inSquad.has(p.id))
    .sort((a, b) => b.skill - a.skill);

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
// Se seeds estiver vazio, faz query à DB e embaralha aleatoriamente (1ª época).
async function generateFixturesForDivision(
  db: Db,
  division: number,
  matchweek: number,
  seeds: number[],
): Promise<MatchFixture[]> {
  // Se não há seeds, buscar equipas da DB ordenadas (sem embaralhar)
  let seedIds =
    seeds.length > 0
      ? seeds
      : await new Promise<number[]>((resolve) => {
          db.all(
            "SELECT id FROM teams WHERE division = ? ORDER BY id",
            [division],
            (err: any, rows: Array<{ id: number }>) => {
              if (err || !rows || rows.length < 2) return resolve([]);
              resolve(rows.map((r) => r.id));
            },
          );
        });

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
  fallback: () => any;
  fixtureData?: Record<string, unknown>;
}): Promise<{ choice: any; source: string }> {
  const humanCoach = getCurrentPlayerState(game, teamId);
  if (!humanCoach) {
    return Promise.resolve({ choice: fallback(), source: "auto" });
  }

  return new Promise<{ choice: any; source: string }>((resolve) => {
    const actionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const finalize = (choice, source = "auto") => {
      const pendingAction: any = game.pendingMatchAction;
      if (pendingAction && pendingAction.actionId === actionId) {
        clearTimeout(pendingAction.timer);
        game.pendingMatchAction = null;
      }
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

    game.pendingMatchAction = {
      actionId,
      type,
      teamId,
      timer,
      finalize,
      fallback,
    };

    io.to(game.roomCode).emit("matchActionRequired", {
      actionId,
      type,
      teamId,
      ...payload,
      ...(fixtureData || {}),
    });
  });
}

// Normalizes a forced-swap choice: the client sends { playerOut, playerIn }
// (object) while legacy/auto paths may send a bare player id. Returns
// { playerOut, playerIn } with nulls for missing parts.
function normalizeForcedChoice(
  choice: any,
): { playerOut: number | null; playerIn: number | null } {
  if (choice && typeof choice === "object") {
    return {
      playerOut: choice.playerOut ?? null,
      playerIn: choice.playerIn ?? null,
    };
  }
  return { playerOut: null, playerIn: choice ?? null };
}

async function applyInjuryEvent({
  db,
  fixture,
  teamSide,
  squad,
  fullRoster,
  lineupIds,
  currentMatchweek,
  io,
  game,
}: {
  db: Db;
  fixture: MatchFixture;
  teamSide: "home" | "away";
  squad: PlayerRow[];
  fullRoster: PlayerRow[];
  lineupIds: Set<number>;
  currentMatchweek: number;
  io: any;
  game: ActiveGame;
}) {
  if (!squad.length) return { replaced: false, injuredPlayer: null };

  const injuredPlayer = squad[Math.floor(Math.random() * squad.length)];
  const severityRoll = Math.random();
  let injuryWeeks;
  let injuryLabel;
  if (severityRoll < 0.1) {
    // Grave: 3–8 semanas, incomum
    injuryWeeks = 3 + Math.floor(Math.random() * 6);
    injuryLabel = "grave";
  } else {
    // Leve: 1 semana (afasta da próxima convocatória), comum
    injuryWeeks = 1;
    injuryLabel = "leve";
  }

  const injuryUntil = currentMatchweek + injuryWeeks;
  const qualityLoss =
    injuryLabel === "grave" ? 2 + Math.floor(Math.random() * 4) : 0;
  const oldSkill = injuredPlayer.skill ?? 0;
  const newSkill = Math.max(1, oldSkill - qualityLoss);
  db.run(
    "UPDATE players SET injuries = injuries + 1, career_injuries = career_injuries + 1, prev_skill = skill, skill = ?, injury_until_matchweek = CASE WHEN injury_until_matchweek > ? THEN injury_until_matchweek ELSE ? END WHERE id = ?",
    [newSkill, injuryUntil, injuryUntil, injuredPlayer.id],
    () => {
      // Record skill snapshot before injury
      db.run(
        "INSERT OR REPLACE INTO player_skill_snapshots (player_id, matchweek, season, skill) VALUES (?, ?, ?, ?)",
        [injuredPlayer.id, currentMatchweek, game.season || 1, oldSkill],
      );
    },
  );

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
    const idx = squad.findIndex((p) => p.id === injuredPlayer.id);
    if (idx > -1) squad.splice(idx, 1);
    lineupIds.delete(injuredPlayer.id);
    (fixture._subbedOut ??= new Set<number>()).add(injuredPlayer.id);

    // Remover jogador do snapshot de lineup quando sai sem substituto
    const lineupRefNoSub =
      teamSide === "home" ? fixture.homeLineup : fixture.awayLineup;
    if (lineupRefNoSub) {
      const li = lineupRefNoSub.findIndex(
        (p: any) => p.id === injuredPlayer.id,
      );
      if (li > -1) lineupRefNoSub.splice(li, 1);
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
  if (injuredPlayer.position === "GR") {
    const grBench = availableBench.filter((p) => p.position === "GR");
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
      injuredPlayer: {
        id: injuredPlayer.id,
        name: injuredPlayer.name,
        position: injuredPlayer.position,
        skill: injuredPlayer.skill,
        resistance: injuredPlayer.resistance,
        form: injuredPlayer.form,
        is_star: injuredPlayer.is_star,
        ...getMatchFatigueSnapshot(fixture, teamSide, injuredPlayer.id),
      },
      benchPlayers: substituteCandidates.map((p) => ({
        id: p.id,
        name: p.name,
        position: p.position,
        skill: p.skill,
        resistance: p.resistance,
        form: p.form,
        is_star: p.is_star,
        ...getMatchFatigueSnapshot(fixture, teamSide, p.id),
      })),
      currentScore: {
        home: fixture.finalHomeGoals,
        away: fixture.finalAwayGoals,
      },
    },
    timeoutMs: 60000,
    fallback,
    fixtureData: {
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
    },
  });

  const forcedChoice = normalizeForcedChoice(result.choice);
  const replacement =
    forcedChoice.playerIn != null &&
    availableBench.find((p) => p.id === forcedChoice.playerIn);
  if (replacement) {
    const idx = squad.findIndex((p) => p.id === injuredPlayer.id);
    if (idx > -1) squad.splice(idx, 1, replacement);
    lineupIds.delete(injuredPlayer.id);
    lineupIds.add(replacement.id);
    (fixture._subbedOut ??= new Set<number>()).add(injuredPlayer.id);
    incrementSubCount(fixture, teamId);

    // Actualizar snapshot de lineup para que o ecrã de intervalo reflicta a substituição
    const lineupRef =
      teamSide === "home" ? fixture.homeLineup : fixture.awayLineup;
    if (lineupRef) {
      const li = lineupRef.findIndex((p: any) => p.id === injuredPlayer.id);
      if (li > -1) {
        lineupRef[li] = {
          id: replacement.id,
          name: replacement.name,
          position: replacement.position,
          is_star: replacement.is_star || 0,
          skill: replacement.skill,
          ...getMatchFatigueSnapshot(fixture, teamSide, replacement.id),
        };
      }
    }

    // Keep tactic positions in sync so applyHalftimeSubs/applyETSubs
    // don't undo this forced substitution when the next phase starts.
    // (Mirrors the user_substitution path below.)
    const tacticRef = teamSide === "home" ? fixture._t1 : fixture._t2;
    if (tacticRef?.positions) {
      delete tacticRef.positions[injuredPlayer.id];
      tacticRef.positions[replacement.id] = "Titular";
    }
    const coachState = Object.values(game.playersByName).find(
      (p: any) => (p as any).teamId === teamId,
    ) as any;
    if (coachState?.tactic?.positions) {
      delete coachState.tactic.positions[injuredPlayer.id];
      coachState.tactic.positions[replacement.id] = "Titular";
    }

    fixture.events.push({
      minute: fixture._minute,
      type: "substitution",
      team: teamSide,
      emoji: "🔁",
      playerId: replacement.id,
      playerName: replacement.name,
      text: `[${fixture._minute}'] 🔁 ${subPhrase(injuredPlayer.name, replacement.name)}`,
    });
    return { replaced: true, injuredPlayer, replacement };
  }

  const idx = squad.findIndex((p) => p.id === injuredPlayer.id);
  if (idx > -1) squad.splice(idx, 1);
  lineupIds.delete(injuredPlayer.id);
  (fixture._subbedOut ??= new Set<number>()).add(injuredPlayer.id);

  // Remover jogador do snapshot de lineup quando sai sem substituto
  const lineupRefNoSub =
    teamSide === "home" ? fixture.homeLineup : fixture.awayLineup;
  if (lineupRefNoSub) {
    const li = lineupRefNoSub.findIndex((p: any) => p.id === injuredPlayer.id);
    if (li > -1) lineupRefNoSub.splice(li, 1);
  }

  return { replaced: false, injuredPlayer, replacement: null };
}

async function applyPenaltyEvent({
  db,
  fixture,
  teamSide,
  squad,
  currentMatchweek,
  io,
  game,
}: {
  db: Db;
  fixture: MatchFixture;
  teamSide: "home" | "away";
  squad: PlayerRow[];
  currentMatchweek: number;
  io: any;
  game: ActiveGame;
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
      takerCandidates: takerCandidates.map((p) => ({
        id: p.id,
        name: p.name,
        position: p.position,
        skill: p.skill,
      })),
      currentScore: {
        home: fixture.finalHomeGoals,
        away: fixture.finalAwayGoals,
      },
    },
    timeoutMs: 12000,
    fallback,
    fixtureData: {
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
    },
  });

  const taker =
    result.choice && takerCandidates.find((p) => p.id === result.choice)
      ? takerCandidates.find((p) => p.id === result.choice)
      : fallback();
  if (!taker) return;

  // Base 82% goal rate, skill (range 5–50) shifts it ±6 pp around the mean (30)
  const penaltySkill = taker.skill || 0;
  const goalChance = Math.max(
    0.74,
    Math.min(0.92, 0.82 + (penaltySkill - 30) / 250),
  );
  const scored = Math.random() < goalChance;

  if (scored) {
    if (teamSide === "home") fixture.finalHomeGoals++;
    else fixture.finalAwayGoals++;
    db.run(
      "UPDATE players SET goals = goals + 1, career_goals = career_goals + 1 WHERE id = ?",
      [taker.id],
    );
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
    const missRoll = Math.random();
    let missType: string;
    if (missRoll < 0.6) {
      missType = "DEFENDEU!";
    } else if (missRoll < 0.7) {
      missType = "AO POSTE!";
    } else if (missRoll < 0.8) {
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

// Intervalo de minutos jogados entre cada redução de skill por cansaço.
// A cada múltiplo deste valor, o jogador em campo rola contra a resistência.
const FATIGUE_INTERVAL_MINUTES = 15;

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

function syncFatigueSnapshot(
  fixture: MatchFixture,
  side: MatchSide,
  playerId: number,
  skill?: number,
) {
  const lineupRef = side === "home" ? fixture.homeLineup : fixture.awayLineup;
  if (!lineupRef) return;

  const li = lineupRef.findIndex((q: any) => q.id === playerId);
  if (li < 0) return;

  const next = {
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
) {
  ensureFatigueLedgers(fixture);

  const before = Number(player.skill ?? 0);
  const after = Math.max(1, before - amount);
  player.skill = after;

  const effectiveLoss = Math.max(0, before - after);
  if (effectiveLoss > 0) {
    fixture._fatigueLoss[side][player.id] =
      (fixture._fatigueLoss[side][player.id] ?? 0) + effectiveLoss;
  }
  syncFatigueSnapshot(fixture, side, player.id, player.skill);
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
) {
  for (const p of squad) {
    if (!lineupIds.has(p.id)) continue;

    const resistance = p.resistance || 3;
    const skipChance = (resistance - 1) * 0.1;
    if (Math.random() >= skipChance) {
      applyFatigueToPlayer(fixture, side, p, amount);
    } else {
      syncFatigueSnapshot(fixture, side, p.id, p.skill);
    }
  }
}

// Cansaço progressivo por minutos jogados. Cada jogador em campo acumula
// minutos no fixture (fixture._minutesPlayed) e, a cada FATIGUE_INTERVAL_MINUTES,
// rola contra a resistência para perder 1 skill. Jogadores que entram mais
// tarde (substituições) começam a contar do zero — pernas frescas valem mais
// que titulares cansados. O snapshot de lineup é mantido em sincronia para
// que o ecrã de intervalo e os painéis de substituição mostrem o skill real.
function trackFatigue(
  fixture: MatchFixture,
  side: MatchSide,
  squad: PlayerRow[],
  lineupIds: Set<number>,
) {
  ensureFatigueLedgers(fixture);
  const mps = fixture._minutesPlayed[side];
  for (const p of squad) {
    if (!lineupIds.has(p.id)) continue;
    const played = (mps[p.id] ?? 0) + 1;
    mps[p.id] = played;
    syncFatigueSnapshot(fixture, side, p.id, p.skill);
    if (played % FATIGUE_INTERVAL_MINUTES !== 0) continue;

    const resistance = p.resistance || 3;
    const skipChance = (resistance - 1) * 0.1;
    if (Math.random() < skipChance) continue;

    applyFatigueToPlayer(fixture, side, p, 1);
  }
}

// Gera os eventos de introdução (weather + táctica) do minuto 1 antes da simulação.
// Chamada em weeklyFlowHelpers.ts antes de emitir matchSegmentStart, para que os
// comentários já estejam no payload durante a pausa de 5s.
// As guards na engine (!fixture._weather / !fixture._firstHalfStartComment) evitam duplicação.
export function generateIntroEvents(
  fixture: MatchFixture,
  homeTactic: any,
  awayTactic: any,
): void {
  // Weather
  if (!fixture._weather) {
    // Semente determinística idêntica à usada na previsão (matchSummaryHelpers)
    const season = fixture.season ?? 1;
    const matchweek = fixture.matchweek ?? 1;
    const homeId = fixture.homeTeamId ?? 0;
    const awayId = fixture.awayTeamId ?? 0;
    let ws = (season * 1000 + matchweek * 31 + homeId + awayId) >>> 0 || 1;
    ws ^= ws << 13;
    ws ^= ws >>> 17;
    ws ^= ws << 5;
    const weatherRoll = (ws >>> 0) / 0xffffffff;
    let weatherCondition: string;
    if (weatherRoll < 0.35) weatherCondition = "sol";
    else if (weatherRoll < 0.65) weatherCondition = "chuva";
    else if (weatherRoll < 0.8) weatherCondition = "vento";
    else if (weatherRoll < 0.88) weatherCondition = "chuva_forte";
    else if (weatherRoll < 0.95) weatherCondition = "frio";
    else if (weatherRoll < 0.98) weatherCondition = "nevoeiro";
    else weatherCondition = "neve";

    const weatherEmojis: Record<string, string> = {
      sol: "☀️",
      chuva: "🌧️",
      chuva_forte: "⛈️",
      vento: "💨",
      frio: "🥶",
      nevoeiro: "🌫️",
      neve: "❄️",
    };
    fixture._weather = weatherCondition;
    fixture.events.push({
      minute: 1,
      type: "weather",
      team: null,
      emoji: weatherEmojis[weatherCondition] || "🌤️",
      text: `[1'] ${weatherEmojis[weatherCondition] || "🌤️"} ${weatherPhrase(weatherCondition)}`,
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
    const homeName = fixture.homeTeam?.name || fixture.homeTeamId;
    const awayName = fixture.awayTeam?.name || fixture.awayTeamId;
    const homeFormation = homeTactic?.formation || "4-4-2";
    const awayFormation = awayTactic?.formation || "4-4-2";
    const homeStyle = normaliseStyle(homeTactic?.style);
    const awayStyle = normaliseStyle(awayTactic?.style);

    if (fixture.round === 5) {
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
  homeTactic: any,
  awayTactic: any,
): void {
  if (!fixture._secondHalfStartComment) {
    const homeName = fixture.homeTeam?.name || fixture.homeTeamId;
    const awayName = fixture.awayTeam?.name || fixture.awayTeamId;
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

async function simulateMatchSegment(
  db: Db,
  fixture: MatchFixture,
  homeTactic: Tactic | null,
  awayTactic: Tactic | null,
  startMin: number,
  endMin: number,
  context: any = {},
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
    homeSquad = await new Promise<any[]>((resolve) => {
      const allIds = Array.from(homeIds);
      const realIds = allIds.filter((id: number) => id > 0);
      const juniorIds = new Set(allIds.filter((id: number) => id < 0));
      const ph = realIds.length > 0 ? realIds.map(() => "?").join(",") : "0";
      db.all(
        `SELECT * FROM players WHERE id IN (${ph})`,
        realIds.length > 0 ? realIds : [],
        (_, r) => {
          const dbPlayers = r || [];
          // Re-add cached junior GRs whose IDs are still in the active lineup.
          const cachedJuniors = (fixture._homeFullRoster || []).filter(
            (p: any) => juniorIds.has(p.id),
          );
          resolve([...dbPlayers, ...cachedJuniors]);
        },
      );
    });
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
    awaySquad = await new Promise<any[]>((resolve) => {
      const allIds = Array.from(awayIds);
      const realIds = allIds.filter((id: number) => id > 0);
      const juniorIds = new Set(allIds.filter((id: number) => id < 0));
      const ph = realIds.length > 0 ? realIds.map(() => "?").join(",") : "0";
      db.all(
        `SELECT * FROM players WHERE id IN (${ph})`,
        realIds.length > 0 ? realIds : [],
        (_, r) => {
          const dbPlayers = r || [];
          const cachedJuniors = (fixture._awayFullRoster || []).filter(
            (p: any) => juniorIds.has(p.id),
          );
          resolve([...dbPlayers, ...cachedJuniors]);
        },
      );
    });
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
    );
    fixture._awaySquad = awaySquad;
  }

  if (!fixture._yellowCards) {
    fixture._yellowCards = {};
  }

  // Track games played — increment once per match (startMin === 1, first minute of first half only)
  // Exclude junior GR negative IDs — they are ephemeral and have no DB row.
  if (startMin === 1) {
    const participantIds = [
      ...Array.from(new Set((homeSquad || []).map((p: any) => p.id))),
      ...Array.from(new Set((awaySquad || []).map((p: any) => p.id))),
    ].filter((id) => typeof id === "number" && id > 0);
    if (participantIds.length > 0) {
      const ph = participantIds.map(() => "?").join(",");
      db.run(
        // Crash-safe guard: a replay of an already-appeared calendar slot must not
        // double-increment games_played. last_appearance_matchweek stores the most
        // recent calendar slot in which the player appeared (see season reset in
        // applySeasonEnd, which zeroes it so a new season's slot 0 is not blocked).
        `UPDATE players SET games_played = games_played + 1, last_appearance_matchweek = MAX(last_appearance_matchweek, ?) WHERE id IN (${ph}) AND COALESCE(last_appearance_matchweek, 0) < ?`,
        [currentCalendarIndex, currentCalendarIndex, ...participantIds],
      );
    }

    // Weather event — emitted once at the start of each match
    if (!fixture._weather) {
      // Semente determinística idêntica à usada em generateIntroEvents / matchSummaryHelpers
      const season = fixture.season ?? 1;
      const matchweek = fixture.matchweek ?? 1;
      const homeId = fixture.homeTeamId ?? 0;
      const awayId = fixture.awayTeamId ?? 0;
      let ws = (season * 1000 + matchweek * 31 + homeId + awayId) >>> 0 || 1;
      ws ^= ws << 13;
      ws ^= ws >>> 17;
      ws ^= ws << 5;
      const weatherRoll = (ws >>> 0) / 0xffffffff;
      let weatherCondition: string;
      if (weatherRoll < 0.35) weatherCondition = "sol";
      else if (weatherRoll < 0.65) weatherCondition = "chuva";
      else if (weatherRoll < 0.8) weatherCondition = "vento";
      else if (weatherRoll < 0.88) weatherCondition = "chuva_forte";
      else if (weatherRoll < 0.95) weatherCondition = "frio";
      else if (weatherRoll < 0.98) weatherCondition = "nevoeiro";
      else weatherCondition = "neve";

      const weatherEmojis: Record<string, string> = {
        sol: "☀️",
        chuva: "🌧️",
        chuva_forte: "⛈️",
        vento: "💨",
        frio: "🥶",
        nevoeiro: "🌫️",
        neve: "❄️",
      };
      fixture._weather = weatherCondition;
      fixture.events.push({
        minute: 1,
        type: "weather",
        team: null,
        emoji: weatherEmojis[weatherCondition] || "🌤️",
        text: `[1'] ${weatherEmojis[weatherCondition] || "🌤️"} ${weatherPhrase(weatherCondition)}`,
      });
    }
  }

  // Load team morale values (cached on fixture for minute-by-minute mode)
  let homeMorale: number, awayMorale: number;
  if (fixture._homeMorale !== undefined) {
    homeMorale = fixture._homeMorale;
    awayMorale = fixture._awayMorale;
  } else {
    [homeMorale, awayMorale] = await Promise.all([
      new Promise<number>((res) =>
        db.get(
          "SELECT morale FROM teams WHERE id = ?",
          [fixture.homeTeamId],
          (err, row) => res(row && row.morale != null ? row.morale : 50),
        ),
      ),
      new Promise<number>((res) =>
        db.get(
          "SELECT morale FROM teams WHERE id = ?",
          [fixture.awayTeamId],
          (err, row) => res(row && row.morale != null ? row.morale : 50),
        ),
      ),
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
    homeFullRoster = await new Promise<PlayerRow[]>((resolve, reject) => {
      db.all(
        "SELECT * FROM players WHERE team_id = ?",
        [fixture.homeTeamId],
        (err, rows) => {
          if (err) return reject(err);
          const available = (rows || []).filter((p) =>
            isPlayerAvailable(p, currentMatchweek),
          );
          resolve(
            ensureFullBench(
              withJuniorGRs(available, fixture.homeTeamId, currentMatchweek),
              fixture.homeTeamId,
              currentMatchweek,
            ),
          );
        },
      );
    });
    awayFullRoster = await new Promise<PlayerRow[]>((resolve, reject) => {
      db.all(
        "SELECT * FROM players WHERE team_id = ?",
        [fixture.awayTeamId],
        (err, rows) => {
          if (err) return reject(err);
          const available = (rows || []).filter((p) =>
            isPlayerAvailable(p, currentMatchweek),
          );
          resolve(
            ensureFullBench(
              withJuniorGRs(available, fixture.awayTeamId, currentMatchweek),
              fixture.awayTeamId,
              currentMatchweek,
            ),
          );
        },
      );
    });
    fixture._homeFullRoster = homeFullRoster;
    fixture._awayFullRoster = awayFullRoster;
  }

  // Snapshot the lineups for this segment so clients can display "who was on the pitch"
  // Inclui titulares e suplentes (do fullRoster que não estão no squad activo)
  const lineupSnapshot = (
    squad: any[],
    tactic: any,
    fullRoster: any[] | undefined,
    side: MatchSide,
  ) => {
    const starterIds = new Set(squad.map((p: any) => p.id));
    const starters = squad.map((p) => ({
      id: p.id,
      name: p.name,
      position: p.position,
      is_star: p.is_star || 0,
      skill: p.skill,
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
        skill: p.skill,
        ...getMatchFatigueSnapshot(fixture, side, p.id),
        is_starter: false,
      }));
    return [...starters, ...bench];
  };
  if (!fixture.homeLineup || fixture.homeLineup.length === 0) {
    fixture.homeLineup = lineupSnapshot(
      homeSquad,
      homeTactic,
      fixture._homeFullRoster,
      "home",
    );
    fixture.awayLineup = lineupSnapshot(
      awaySquad,
      awayTactic,
      fixture._awayFullRoster,
      "away",
    );
  }

  // Persistent lineup tracking across all minutes in this segment
  const homeLineupIds = new Set<number>(homeSquad.map((p: any) => p.id));
  const awayLineupIds = new Set<number>(awaySquad.map((p: any) => p.id));

  const getPower = (squad, tactic, morale = 50, familiarityBonus = 0) => {
    const formation = String(tactic?.formation || "4-4-2");
    const style = normaliseStyle(tactic?.style);

    const midfielders = squad.filter((p) => p.position === "MED");
    const forwards = squad.filter((p) => p.position === "ATA");
    const defenders = squad.filter((p) => p.position === "DEF");
    const keepers = squad.filter((p) => p.position === "GR");

    const avgMidfielderQuality = average(midfielders.map((p) => p.skill || 0));
    const avgForwardQuality = average(forwards.map((p) => p.skill || 0));
    const avgDefenderQuality = average(defenders.map((p) => p.skill || 0));
    const avgKeeperQuality = average(keepers.map((p) => p.skill || 0));

    const formationOffensiveFactors = {
      "4-2-4": 1.15,
      "3-4-3": 1.12,
      "4-3-3": 1.08,
      "3-5-2": 1.05,
      "4-4-2": 1.0,
      "4-5-1": 0.9,
      "5-3-2": 0.85,
      "5-4-1": 0.8,
    };

    const formationDefensiveFactors = {
      "5-4-1": 1.25,
      "5-3-2": 1.2,
      "4-5-1": 1.1,
      "4-4-2": 1.0,
      "3-5-2": 0.95,
      "4-3-3": 0.9,
      "3-4-3": 0.85,
      "4-2-4": 0.75,
    };

    const styleOffensiveFactor = {
      DEFENSIVO: 0.85,
      EQUILIBRADO: 1.0,
      OFENSIVO: 1.15,
    };

    const styleDefensiveFactor = {
      DEFENSIVO: 1.15,
      EQUILIBRADO: 1.0,
      OFENSIVO: 0.85,
    };

    const formationAttack = formationOffensiveFactors[formation] ?? 1.0;
    const formationDefense = formationDefensiveFactors[formation] ?? 1.0;

    // Morale (0-100) swings attack by ±10% and defense by ±5% around 50.
    // Kept deliberately small: form should nudge outcomes, not override the
    // quality gap between squads (winning streaks used to pile up morale and
    // make even weaker teams nearly unbeatable).
    const moraleAttackFactor = 1 + (morale - 50) * 0.002;
    const moraleDefenseFactor = 1 + (morale - 50) * 0.001;

    const avgForm = average(squad.map((p) => p.form || 100));
    const formFactor = Math.max(0.85, Math.min(1.15, avgForm / 100));

    const attackBase = avgMidfielderQuality * 0.4 + avgForwardQuality * 0.6;
    const defenseBase = avgDefenderQuality * 0.6 + avgKeeperQuality * 0.4;

    const familiarityAttackFactor = 1 + familiarityBonus;
    const familiarityDefenseFactor = 1 + familiarityBonus * 0.5;

    return {
      attack:
        attackBase *
        formationAttack *
        moraleAttackFactor *
        styleOffensiveFactor[style] *
        formFactor *
        familiarityAttackFactor,
      defense:
        defenseBase *
        formationDefense *
        moraleDefenseFactor *
        formFactor *
        familiarityDefenseFactor,
      style,
      squad,
      midStrength: avgMidfielderQuality,
    };
  };

  // Familiaridade (memória táctica) — síncrono, em memória no game object
  const homeFam = getTacticBonus(game, fixture.homeTeamId, homeTactic);
  const awayFam = getTacticBonus(game, fixture.awayTeamId, awayTactic);

  const home = getPower(homeSquad, homeTactic, homeMorale, homeFam);
  const away = getPower(awaySquad, awayTactic, awayMorale, awayFam);

  for (let minute = startMin; minute <= endMin; minute++) {
    fixture._minute = minute;

    if (minute === 1 && !fixture._firstHalfStartComment) {
      const homeName = fixture.homeTeam?.name || fixture.homeTeamId;
      const awayName = fixture.awayTeam?.name || fixture.awayTeamId;
      const homeFormation = homeTactic?.formation || "4-4-2";
      const awayFormation = awayTactic?.formation || "4-4-2";
      const homeStyle = normaliseStyle(homeTactic?.style);
      const awayStyle = normaliseStyle(awayTactic?.style);

      if (fixture.round === 5) {
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
      const homeName = fixture.homeTeam?.name || fixture.homeTeamId;
      const awayName = fixture.awayTeam?.name || fixture.awayTeamId;
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

    // Cansaço progressivo: cada FATIGUE_INTERVAL_MINUTES jogados, -1 skill,
    // com escape por resistência. Quem entra depois (subs) começa do zero.
    trackFatigue(fixture, "home", homeSquad, homeLineupIds);
    trackFatigue(fixture, "away", awaySquad, awayLineupIds);

    // Condições climatéricas adversas aceleram o desgaste ao minuto 60
    if (
      minute === 60 &&
      !fixture._fatigue3Applied &&
      (fixture._weather === "neve" || fixture._weather === "frio")
    ) {
      applyFatigue(fixture, "home", homeSquad, homeLineupIds, 1);
      applyFatigue(fixture, "away", awaySquad, awayLineupIds, 1);
      fixture._fatigue3Applied = true;
    }

    const currentHome = getPower(home.squad, homeTactic, homeMorale, homeFam);
    const currentAway = getPower(away.squad, awayTactic, awayMorale, awayFam);

    let goalScoredThisMinute = false;

    const maybeOpenPlayGoal = (attackingSide) => {
      if (goalScoredThisMinute) return;
      const attacking = attackingSide === "home" ? currentHome : currentAway;
      const defending = attackingSide === "home" ? currentAway : currentHome;
      const isHome = attackingSide === "home";

      // Apply opponent style factor to attack per README spec:
      // força_ofensiva *= (1 / estilo_factor[adversário_instrução])
      const STYLE_FACTORS = {
        DEFENSIVO: 0.85,
        EQUILIBRADO: 1.0,
        OFENSIVO: 1.15,
      };
      const opponentStyleFactor = STYLE_FACTORS[defending.style] || 1.0;
      const adjustedAttack =
        (attacking.attack || 1) * (1.0 / opponentStyleFactor);

      const ratio =
        adjustedAttack / (adjustedAttack + (defending.defense || 1) * 2);
      let probGoal = ratio * 0.03 * getGoalTimeMultiplier(fixture._minute);
      if (fixture.round !== 5) {
        probGoal *= isHome ? 1.08 : 0.92;
      }
      probGoal *= getWeatherGoalMultiplier(fixture._weather);

      // Posse de bola: quem domina o meio campo tem ligeiramente mais probabilidade
      const totalMid =
        (currentHome.midStrength || 0) + (currentAway.midStrength || 0);
      const homePossession =
        totalMid > 0 ? (currentHome.midStrength || 0) / totalMid : 0.5;
      const possessionFactor = isHome
        ? 0.9 + homePossession * 0.2 // range 0.90–1.10
        : 0.9 + (1 - homePossession) * 0.2;
      probGoal *= possessionFactor;

      // Guardar posse no fixture para exibição no cliente
      fixture._homePossession = Math.round(homePossession * 100);
      fixture._awayPossession = 100 - fixture._homePossession;

      // Ego conflict penalty: 3+ craques no onze titular reduzem probabilidade
      const scoringSquad = isHome ? home.squad : away.squad;
      const craquesInXI = scoringSquad.filter(
        (p) => p.is_star && (p.position === "MED" || p.position === "ATA"),
      ).length;
      if (craquesInXI > 2) {
        const egoPenalty = Math.min(0.3, (craquesInXI - 2) * 0.1);
        probGoal *= 1.0 - egoPenalty;
      }

      if (Math.random() >= probGoal) return;

      const scorers = scoringSquad.filter(
        (p) => p.position === "ATA" || p.position === "MED",
      );
      const scorer =
        scorers.length > 0 ? weightedPickScorer(scorers) : scoringSquad[0];

      // VAR: 5% de hipótese de golo ser anulado
      if (Math.random() < 0.05) {
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

      const decisiveChance = Math.min(0.6, craquesInXI * 0.2);
      const isDecisive = Math.random() < decisiveChance;

      const goalText =
        fixture.round === 5
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
        db.run(
          "UPDATE players SET goals = goals + 1, career_goals = career_goals + 1 WHERE id = ?",
          [scorer.id],
        );
      }
    };

    const isCupExtraTime =
      minute >= 91 && context.game?.currentEvent?.type === "cup";
    // No último minuto regulamentar da liga (min 90+), não disparar eventos bloqueantes
    // para evitar que a janela de acção apareça após o apito final
    const isLastLeagueMinute =
      minute >= 90 && context.game?.currentEvent?.type !== "cup";
    const penaltyChance = minute < 90 || isCupExtraTime ? 0.002 : 0;
    if (Math.random() < penaltyChance) {
      const attackingSide = Math.random() < 0.5 ? "home" : "away";
      const attackingSquad = attackingSide === "home" ? home.squad : away.squad;
      const totalGoalsBefore = fixture.finalHomeGoals + fixture.finalAwayGoals;
      await applyPenaltyEvent({
        db,
        fixture,
        teamSide: attackingSide,
        squad: attackingSquad,
        currentMatchweek,
        io,
        game,
      });
      if (fixture.finalHomeGoals + fixture.finalAwayGoals > totalGoalsBefore) {
        goalScoredThisMinute = true;
      }
    }

    maybeOpenPlayGoal("home");
    maybeOpenPlayGoal("away");

    // Near-miss / big save events — roughly 1–2 per match, commentary-only
    if (!goalScoredThisMinute && Math.random() < 0.018) {
      const nearMissSide =
        currentHome.attack > currentAway.attack
          ? Math.random() < 0.55
            ? "home"
            : "away"
          : Math.random() < 0.55
            ? "away"
            : "home";
      const nearMissSquad = nearMissSide === "home" ? home.squad : away.squad;
      const oppSquad = nearMissSide === "home" ? away.squad : home.squad;
      const attackers = nearMissSquad.filter(
        (p) => p.position === "ATA" || p.position === "MED",
      );
      const attacker =
        attackers.length > 0 ? weightedPickScorer(attackers) : nearMissSquad[0];
      if (attacker) {
        const isBigSave = Math.random() < 0.45;
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
      home.squad.map((p) => getAggressivenessValue(p)),
    );
    const awayAggAvg = average(
      away.squad.map((p) => getAggressivenessValue(p)),
    );

    const executeRedCard = async (
      offender: PlayerRow,
      isHomeCard: boolean,
      squad: PlayerRow[],
      side: "home" | "away",
    ) => {
      db.run(
        "UPDATE players SET red_cards = red_cards + 1, career_reds = career_reds + 1, suspension_games = suspension_games + 2, suspension_until_matchweek = CASE WHEN suspension_until_matchweek > ? THEN suspension_until_matchweek ELSE ? END WHERE id = ?",
        [currentMatchweek + 2, currentMatchweek + 2, offender.id],
      );
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

        const fallback = () => {
          const weakest = [...fieldOnPitch].sort(
            (a, b) => (a.skill || 0) - (b.skill || 0),
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
            sentOffPlayer: {
              id: offender.id,
              name: offender.name,
              position: offender.position,
              skill: offender.skill,
              resistance: offender.resistance,
              form: offender.form,
              is_star: offender.is_star,
              ...getMatchFatigueSnapshot(fixture, side, offender.id),
            },
            onPitch: fieldOnPitch.map((p) => ({
              id: p.id,
              name: p.name,
              position: p.position,
              skill: p.skill,
              resistance: p.resistance,
              form: p.form,
              is_star: p.is_star,
              ...getMatchFatigueSnapshot(fixture, side, p.id),
            })),
            benchPlayers: grCandidates.map((p) => ({
              id: p.id,
              name: p.name,
              position: p.position,
              skill: p.skill,
              resistance: p.resistance,
              form: p.form,
              is_star: p.is_star,
              ...getMatchFatigueSnapshot(fixture, side, p.id),
            })),
            currentScore: {
              home: fixture.finalHomeGoals,
              away: fixture.finalAwayGoals,
            },
          },
          timeoutMs: 60000,
          fallback,
          fixtureData: {
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
          },
        });

        const forcedChoice = normalizeForcedChoice(result.choice);
        const incoming =
          forcedChoice.playerIn != null
            ? grCandidates.find((p) => p.id === forcedChoice.playerIn)
            : null;

        // 1) The sent-off GK always leaves.
        const gkIdx = squad.findIndex((p) => p.id === offender.id);
        if (gkIdx > -1) squad.splice(gkIdx, 1);
        lineupIds.delete(offender.id);

        if (incoming) {
          // 2) Sacrifice the chosen outfield player so the reserve GK can come on.
          const sacrificed =
            forcedChoice.playerOut != null
              ? squad.find((p) => p.id === forcedChoice.playerOut)
              : null;
          if (sacrificed) {
            const si = squad.findIndex((p) => p.id === sacrificed.id);
            if (si > -1) squad.splice(si, 1);
            lineupIds.delete(sacrificed.id);
          }

          // 3) The reserve GK comes on.
          squad.push(incoming);
          lineupIds.add(incoming.id);

          const lineupRef =
            side === "home" ? fixture.homeLineup : fixture.awayLineup;
          if (lineupRef) {
            const gi = lineupRef.findIndex((p: any) => p.id === offender.id);
            if (gi > -1) lineupRef.splice(gi, 1);
            if (sacrificed) {
              const li = lineupRef.findIndex((p: any) => p.id === sacrificed.id);
              if (li > -1) {
                lineupRef[li] = {
                  id: incoming.id,
                  name: incoming.name,
                  position: incoming.position,
                  is_star: incoming.is_star || 0,
                  skill: incoming.skill,
                  ...getMatchFatigueSnapshot(fixture, side, incoming.id),
                };
              }
            }
          }

          // Keep tactic positions in sync so applyHalftimeSubs/applyETSubs
          // don't undo this forced swap when the next phase starts.
          const tacticRef =
            side === "home" ? fixture._t1 : fixture._t2;
          if (tacticRef?.positions) {
            delete tacticRef.positions[offender.id];
            if (sacrificed) delete tacticRef.positions[sacrificed.id];
            tacticRef.positions[incoming.id] = "Titular";
          }
          const coachState = Object.values(game.playersByName).find(
            (p: any) => (p as any).teamId === teamId,
          ) as any;
          if (coachState?.tactic?.positions) {
            delete coachState.tactic.positions[offender.id];
            if (sacrificed) delete coachState.tactic.positions[sacrificed.id];
            coachState.tactic.positions[incoming.id] = "Titular";
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
        // Non-GK red card — just remove the player
        const idx = squad.findIndex((p: any) => p.id === offender.id);
        if (idx > -1) {
          squad.splice(idx, 1);
          lineupIds.delete(offender.id);
        }
        // Remover expulso do snapshot de lineup para que o ecrã de
        // intervalo/live não o mostre (equipa a jogar com menos um).
        const lineupRef = side === "home" ? fixture.homeLineup : fixture.awayLineup;
        if (lineupRef) {
          const li = lineupRef.findIndex((p: any) => p.id === offender.id);
          if (li > -1) lineupRef.splice(li, 1);
        }
      }
    };

    const emitCard = async (isHomeCard: boolean) => {
      const squad = isHomeCard ? home.squad : away.squad;
      const side = isHomeCard ? "home" : "away";
      if (squad.length > 0) {
        const offender = squad[Math.floor(Math.random() * squad.length)];
        const offenderId = offender.id;

        if (fixture._yellowCards[offenderId] >= 1) {
          if (Math.random() < 0.15) {
            await executeRedCard(offender, isHomeCard, squad, side);
          }
        } else if (Math.random() < 0.005) {
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

    const homeCardProb = 0.015 * (1 + (homeAggAvg - 3) * 0.1);
    const awayCardProb = 0.015 * (1 + (awayAggAvg - 3) * 0.1);
    // No último minuto regulamentar da liga não disparar cartões — um vermelho
    // ao GR abriria a janela obrigatória de substituição após o apito final
    if (!isLastLeagueMinute && Math.random() < homeCardProb) await emitCard(true);
    if (!isLastLeagueMinute && Math.random() < awayCardProb) await emitCard(false);

    const injuryChance = Math.random();
    const weatherInjuryMult =
      fixture._weather === "neve"
        ? 1.6
        : fixture._weather === "chuva_forte"
          ? 1.4
          : fixture._weather === "vento"
            ? 1.3
            : fixture._weather === "chuva"
              ? 1.2
              : 1.0;
    if (!isLastLeagueMinute && injuryChance < 0.003 * weatherInjuryMult) {
      const isHomeInjury = Math.random() > 0.5;
      const squad = isHomeInjury ? home.squad : away.squad;
      const side = isHomeInjury ? "home" : "away";
      const lineupIds = isHomeInjury ? homeLineupIds : awayLineupIds;
      const fullRoster = isHomeInjury ? homeFullRoster : awayFullRoster;
      if (squad.length > 0) {
        const injuredPlayer = squad[Math.floor(Math.random() * squad.length)];
        const resistanceSkip = ((injuredPlayer?.resistance || 3) - 1) * 0.08;
        if (Math.random() < resistanceSkip) {
          // jogador resistiu — ignorar lesão
        } else {
          const injuryResult = await applyInjuryEvent({
            db,
            fixture,
            teamSide: side,
            squad,
            fullRoster,
            lineupIds,
            currentMatchweek,
            io,
            game,
          });
          if (injuryResult.replaced && side === "home") home.squad = squad;
          if (injuryResult.replaced && side === "away") away.squad = squad;
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
        const squad = isHome ? home.squad : away.squad;
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
              onPitch: onPitch.map((p: any) => ({
                id: p.id,
                name: p.name,
                position: p.position,
                skill: p.skill,
                ...getMatchFatigueSnapshot(fixture, side, p.id),
              })),
              benchPlayers: availableBench.map((p: any) => ({
                id: p.id,
                name: p.name,
                position: p.position,
                skill: p.skill,
                ...getMatchFatigueSnapshot(fixture, side, p.id),
              })),
            },
            timeoutMs: 60000,
            fallback: () => null,
            fixtureData: {
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
            },
          });

          if (
            result.choice &&
            result.choice.playerOut &&
            result.choice.playerIn
          ) {
            const playerOutId = result.choice.playerOut;
            const playerInId = result.choice.playerIn;

            const playerOut = squad.find((p: any) => p.id === playerOutId);
            const playerIn = fullRoster.find((p: any) => p.id === playerInId);

            if (playerOut && playerIn) {
              const idx = squad.findIndex((p: any) => p.id === playerOutId);
              if (idx > -1) squad.splice(idx, 1, playerIn);
              lineupIds.delete(playerOutId);
              lineupIds.add(playerInId);
              (fixture._subbedOut ??= new Set<number>()).add(playerOutId);
              incrementSubCount(fixture, teamId);

              // Actualizar snapshot de lineup para que o ecrã de intervalo reflicta a substituição
              const lineupRef = isHome
                ? fixture.homeLineup
                : fixture.awayLineup;
              if (lineupRef) {
                const li = lineupRef.findIndex(
                  (p: any) => p.id === playerOutId,
                );
                if (li > -1) {
                  lineupRef[li] = {
                    id: playerIn.id,
                    name: playerIn.name,
                    position: playerIn.position,
                    is_star: playerIn.is_star || 0,
                    skill: playerIn.skill,
                    ...getMatchFatigueSnapshot(fixture, side, playerIn.id),
                  };
                }
              }

              // Keep tactic positions in sync so applyHalftimeSubs/applyETSubs
              // don't undo this substitution when the next phase starts.
              const coachState = Object.values(game.playersByName).find(
                (p: any) => (p as any).teamId === teamId,
              ) as any;
              if (coachState?.tactic?.positions) {
                delete coachState.tactic.positions[playerOutId];
                coachState.tactic.positions[playerInId] = "Titular";
              }

              fixture.events.push({
                minute: fixture._minute,
                type: "substitution",
                team: side,
                emoji: "🔁",
                playerId: playerInId,
                playerName: playerIn.name,
                text: `[${fixture._minute}'] 🔁 ${subPhrase(playerOut.name, playerIn.name)}`,
              });

              if (isHome) home.squad = squad;
              if (!isHome) away.squad = squad;
            }
          }
        }
      }
    }
  }

  delete fixture._minute;

  if (fixture.round === 5 && !fixture._finalEndComment) {
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

async function applyPostMatchQualityEvolution(
  db: Db,
  fixtures: MatchFixture[],
  currentMatchweek: number,
  season: number,
  calendarIndex: number = 1,
) {
  return new Promise<void>((resolve) => {
    const teamResults = new Map();
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

    // ── Morale update per team ─────────────────────────────────────────────
    // Weekly decay toward neutral 50 (once per calendar event) so morale
    // reflects recent form instead of accumulated cross-season history.
    db.run(
      "UPDATE teams SET morale = MAX(0, MIN(100, CAST(morale + (50 - morale) * 0.1 AS INTEGER)))",
    );

    const moraleUpdates = [];
    for (const [teamId, result] of teamResults.entries()) {
      let delta;
      if (result === "W") delta = 25;
      else if (result === "L") delta = -20;
      else delta = 5;
      moraleUpdates.push({ teamId, delta });
    }

    if (moraleUpdates.length > 0) {
      db.all(
        "SELECT id, morale FROM teams WHERE id IN (" +
          moraleUpdates.map(() => "?").join(",") +
          ")",
        moraleUpdates.map((u) => u.teamId),
        (err, rows) => {
          if (err || !rows) return;
          rows.forEach((row) => {
            const upd = moraleUpdates.find((u) => u.teamId === row.id);
            if (!upd) return;
            const newMorale = Math.max(
              0,
              Math.min(100, (row.morale ?? 50) + upd.delta),
            );
            db.run("UPDATE teams SET morale = ? WHERE id = ?", [
              newMorale,
              row.id,
            ]);
          });
        },
      );
    }

    // ── Player skill evolution ─────────────────────────────────────────────
    // Load the season's results and the players in one serialized batch so the
    // losing streak of each team is ready when computing per-player deltas.
    db.serialize(() => {
      const teamLossStreak = new Map<number, number>();
      const lastTeamResult = new Map<number, string>();
      db.all(
        "SELECT home_team_id AS home, away_team_id AS away, home_score, away_score FROM matches WHERE season = ? ORDER BY matchweek, id",
        [season],
        (streakErr, seasonMatches) => {
          if (streakErr) {
            console.error("[engine] evolution: failed to load season matches:", streakErr);
          }
          for (const m of seasonMatches || []) {
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
        },
      );
      db.all(
        "SELECT id, team_id, position, skill, potential, form, games_played, last_appearance_matchweek, joined_matchweek, injury_until_matchweek, suspension_until_matchweek FROM players WHERE team_id IS NOT NULL ORDER BY team_id, id",
        (err, players) => {
        if (err || !players || players.length === 0) {
          resolve();
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
          if (room < 0 && Math.random() < 0.15) {
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
            if (idleForAWhile && Math.random() < 0.15) {
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
            Math.random() < Math.min(0.75, 0.20 + diff / 20) * minutesFactor
          ) {
            delta += 1;
          }

          // Vitória reforça evolução para jogadores abaixo da média
          if (
            room > 0 &&
            teamResult === "W" &&
            diff >= 0 &&
            Math.random() < Math.min(0.45, 0.10 + diff / 50) * minutesFactor
          ) {
            delta += 1;
          }

          // Maus resultados: jogadores perdem qualidade se houver derrotas
          // (spec: "perdem qualidade se houver muitos maus resultados seguidos")
          // Jogadores acima da média do plantel são mais afectados
          if (teamResult === "L") {
            const lossPressure = Math.min(
              0.18,
              0.04 + Math.max(0, -diff) / 150,
            );
            if (Math.random() < lossPressure) delta -= 1;
            // Derrotas consecutivas aumentam a pressão de decaimento
            const streak = teamLossStreak.get(player.team_id) || 0;
            if (
              streak >= 2 &&
              Math.random() < Math.min(0.20, 0.05 + 0.03 * (streak - 1))
            ) {
              delta -= 1;
            }
          }

          // Empate contra equipa mais forte — pequena hipótese de evolução
          if (
            room > 0 &&
            teamResult === "D" &&
            diff >= 4 &&
            Math.random() < 0.20 * minutesFactor
          ) {
            delta += 1;
          }

          // ── Performance individual pós-jogo ──────────────────────────
          const goals = playerGoals.get(player.id) || 0;

          // Marcou 2+ golos: 25% de chance de +1 skill
          if (goals >= 2 && Math.random() < 0.25) {
            delta += 1;
          }
          // Marcou 1 golo: 10% de chance de +1 skill
          else if (goals === 1 && Math.random() < 0.10) {
            delta += 1;
          }

          // GR com clean sheet em vitória: 15% de chance de +1 skill
          if (
            player.position === "GR" &&
            teamResult === "W" &&
            teamCleanSheetWin.has(player.team_id) &&
            Math.random() < 0.15
          ) {
            delta += 1;
          }

          // Cartão vermelho: 20% de chance de -1 skill
          if (playerRedCards.has(player.id) && Math.random() < 0.20) {
            delta -= 1;
          }

          // Momentum: presença consecutiva impulsiona a evolução
          if (
            playedPrev &&
            room > 0 &&
            Math.random() < 0.10 * minutesFactor
          ) {
            delta += 1;
          }
          // Estagnação por excesso de jogos sem descanso
          if (
            playedPrev &&
            (player.games_played || 0) >= 6 &&
            Math.random() < 0.04
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

        if (updates.length === 0) {
          // Mesmo sem evoluções, limpar prev_skill de semanas anteriores
          db.run(
            "UPDATE players SET prev_skill = NULL WHERE team_id IS NOT NULL",
            () => {
              // Snapshot all players' skill for continuity
              db.run(
                "INSERT OR REPLACE INTO player_skill_snapshots (player_id, matchweek, season, skill) SELECT id, ?, ?, skill FROM players WHERE team_id IS NOT NULL AND skill IS NOT NULL",
                [currentMatchweek, season],
                () => resolve(),
              );
            },
          );
          return;
        }

        let remaining = updates.length;
        db.serialize(() => {
          // Limpar prev_skill de semanas anteriores; só os que mudam esta semana ficam marcados
          db.run(
            "UPDATE players SET prev_skill = NULL WHERE team_id IS NOT NULL",
          );
updates.forEach((update) => {
            db.run(
              "UPDATE players SET prev_skill = skill, skill = ?, value = ? WHERE id = ?",
              [update.skill, recalcPlayerValue(update.skill), update.id],
              () => {
                remaining -= 1;
                if (remaining === 0) {
                  // Snapshot all players' skill after evolution
                  db.run(
                    "INSERT OR REPLACE INTO player_skill_snapshots (player_id, matchweek, season, skill) SELECT id, ?, ?, skill FROM players WHERE team_id IS NOT NULL AND skill IS NOT NULL",
                    [currentMatchweek, season],
                    () => resolve(),
                  );
                }
              },
            );
          });
      });
    },
    );
    });
});
}

module.exports = {
  withJuniorGRs,
  generateJuniorGR,
  generateJuniorFieldPlayer,
  ensureFullBench,
  isPlayerAvailable,
  simulateMatchSegment,
  getTeamSquad,
  generateFixturesForDivision,
  applyPostMatchQualityEvolution,
  simulateExtraTime,
  simulatePenaltyShootout,
  generateIntroEvents,
  generateSecondHalfIntroEvents,
  getMatchFatigueSnapshot,
};

// ─── EXTRA TIME ──────────────────────────────────────────────────────────────
// Simulates a single continuous extra-time period (91–120).
// No halftime pause at 105 — ET runs straight through.
async function simulateExtraTime(
  db: Db,
  fixture: MatchFixture,
  homeTactic: Tactic | null,
  awayTactic: Tactic | null,
  context: any,
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

  // Single ET period: minutes 91–120, no halftime pause
  for (let minute = 91; minute <= 120; minute++) {
    await simulateMatchSegment(
      db,
      fixture,
      homeTactic,
      awayTactic,
      minute,
      minute,
      context,
    );
    emitMinuteUpdate(minute);
    if (minute < 120) await new Promise((r) => setTimeout(r, msPerMinute));
  }

  const etEvents = fixture.events.filter((e: any) => e.minute >= 91);
  return { et1Events: etEvents, et2Events: [] };
}

// ─── PENALTY SHOOTOUT ─────────────────────────────────────────────────────────
// Simulates a penalty shootout between two squads.
// Returns { homeGoals, awayGoals, kicks: [{team, playerName, scored}] }
function simulatePenaltyShootout(
  homeSquad: PlayerRow[],
  awaySquad: PlayerRow[],
) {
  const kicks = [];
  let homeGoals = 0;
  let awayGoals = 0;

  const pickShooter = (squad, usedIds) => {
    const available = squad.filter((p) => !usedIds.has(p.id));
    if (available.length === 0) {
      // Cycle through again if all have taken a penalty
      usedIds.clear();
      return squad[0] || null;
    }
    // Pick by skill
    available.sort((a, b) => b.skill - a.skill);
    return available[0];
  };

  const homeUsed = new Set();
  const awayUsed = new Set();
  const homeGK = homeSquad.find((p) => p.position === "GR") || homeSquad[0];
  const awayGK = awaySquad.find((p) => p.position === "GR") || awaySquad[0];

  const calcScoredChance = (taker, gk) => {
    const takerSkill = taker ? taker.skill || 10 : 10;
    const gkSkill = gk ? gk.skill || 10 : 10;
    return Math.max(0.55, Math.min(0.88, 0.72 + (takerSkill - gkSkill) / 200));
  };

  // 5 regulation rounds
  for (let round = 0; round < 5; round++) {
    const homeTaker = pickShooter(homeSquad, homeUsed);
    const awayTaker = pickShooter(awaySquad, awayUsed);
    if (homeTaker) homeUsed.add(homeTaker.id);
    if (awayTaker) awayUsed.add(awayTaker.id);

    const homeScored = Math.random() < calcScoredChance(homeTaker, awayGK);
    const awayScored = Math.random() < calcScoredChance(awayTaker, homeGK);

    if (homeScored) homeGoals++;
    if (awayScored) awayGoals++;

    kicks.push({
      team: "home",
      playerName: homeTaker ? homeTaker.name : "?",
      scored: homeScored,
    });
    kicks.push({
      team: "away",
      playerName: awayTaker ? awayTaker.name : "?",
      scored: awayScored,
    });

    // Early finish: if one side can't catch up after n rounds
    const remaining = 4 - round;
    if (homeGoals > awayGoals + remaining || awayGoals > homeGoals + remaining)
      break;
  }

  // Sudden death if still tied
  let sdRound = 0;
  while (homeGoals === awayGoals && sdRound < 20) {
    sdRound++;
    const homeTaker = pickShooter(homeSquad, homeUsed);
    const awayTaker = pickShooter(awaySquad, awayUsed);
    if (homeTaker) homeUsed.add(homeTaker.id);
    if (awayTaker) awayUsed.add(awayTaker.id);

    const homeScored = Math.random() < calcScoredChance(homeTaker, awayGK);
    const awayScored = Math.random() < calcScoredChance(awayTaker, homeGK);

    if (homeScored) homeGoals++;
    if (awayScored) awayGoals++;

    kicks.push({
      team: "home",
      playerName: homeTaker ? homeTaker.name : "?",
      scored: homeScored,
      suddenDeath: true,
    });
    kicks.push({
      team: "away",
      playerName: awayTaker ? awayTaker.name : "?",
      scored: awayScored,
      suddenDeath: true,
    });

    if (homeScored !== awayScored) break; // One scored, other didn't → winner decided
  }

  // Tiebreak failsafe
  if (homeGoals === awayGoals) homeGoals++;

  return { homeGoals, awayGoals, kicks };
}
