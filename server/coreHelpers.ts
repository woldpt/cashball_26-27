import type { ActiveGame } from "./types";
import {
  MAX_ATTENDANCE_BY_DIVISION,
  MATCH_TUNING,
  CONTRACT_LENGTH_MATCHWEEKS,
  contractEpoch,
  SEASON_CALENDAR,
} from "./gameConstants";
import { getWeatherForFixture } from "./game/matchCalculations";

type Db = any;
type AnyRow = Record<string, any>;

const refereeNames = [
  "João Pinheiro (AF Braga)",
  "Luís Godinho (AF Évora)",
  "Artur Soares Dias (AF Porto)",
  "António Nobre (AF Leiria)",
  "Fábio Veríssimo (AF Leiria)",
  "Tiago Martins (AF Lisboa)",
  "Miguel Nogueira (AF Lisboa)",
  "Gustavo Correia (AF Porto)",
  "Cláudio Pereira (AF Aveiro)",
  "João Gonçalves (AF Porto)",
  "André Narciso (AF Setúbal)",
  "Hélder Malheiro (AF Lisboa)",
  "Ricardo Baixinho (AF Lisboa)",
  "Hélder Carvalho (AF Santarém)",
  "Iancu Vasilica (AF Vila Real)",
  "David Rafael Silva (AF Porto)",
  "Carlos Macedo (AF Braga)",
  "José Bessa (AF Porto)",
  "Bruno Pires Costa (AF Viana do Castelo)",
  "Miguel Fonseca (AF Porto)",
  "Sérgio Guelho (AF Guarda)",
  "Anzhony Rodrigues (AF Madeira)",
  "Diogo Rosa (AF Beja)",
  "Pedro Ramalho (AF Évora)",
  "Hugo Miguel (AF Lisboa)",
  "Manuel Oliveira (AF Porto)",
  "Rui Costa (AF Porto)",
  "Bruno Esteves (AF Setúbal)",
  "Vasco Santos (AF Porto)",
  "Nuno Almeida (AF Algarve)",
  "Luís Ferreira (AF Braga)",
  "Rui Oliveira (AF Porto)",
  "Catarina Campos (AF Lisboa)",
  "Sandra Bastos (AF Aveiro)",
  "Sílvia Domingos (AF Algarve)",
  "Ana Afonso (AF Porto)",
  "Inês Andrada (AF Lisboa)",
  "Teresa Oliveira (AF Braga)",
  "Sara Alves (AF Porto)",
  "Bruno Vieira (AF Lisboa)",
  "Vítor Ferreira (AF Braga)",
  "Márcio Torres (AF Viana do Castelo)",
  "Gonçalo Neves (AF Coimbra)",
  "Flávio Jesus (AF Aveiro)",
  "Fábio Melo (AF Porto)",
  "Diogo Araújo (AF Porto)",
  "Marcos Brazão (AF Algarve)",
  "Rui Lima (AF Viana do Castelo)",
  "Vítor Lopes (AF Viana do Castelo)",
  "João Mendes (AF Santarém)",
];

export function getSeasonEndMatchweek(matchweek: number) {
  return Math.ceil(Math.max(1, matchweek) / 20) * 20;
}

/**
 * Slot actual 1-based (1..20) — o relógio único do jogo. Anda em todas as
 * semanas (amigável, liga e taça); o matchweek só anda nas jornadas da liga.
 */
export function currentSlot(game: ActiveGame): number {
  return (game.calendarIndex ?? 0) + 1;
}

/**
 * Época absoluta actual derivada do estado do jogo (em slots).
 * Salas migradas do calendário de 19 avaliam contratos da época em curso
 * com a fórmula velha até ao fim da época (ver contractCutoverSeason).
 */
export function currentEpoch(game: ActiveGame): number {
  const season = game.season || 1;
  if (
    game.contractCutoverSeason != null &&
    season <= game.contractCutoverSeason
  ) {
    return (
      (Math.max(1, season) - 1) * 14 +
      Math.min(14, Math.max(1, game.matchweek || 1))
    );
  }
  return contractEpoch(season, currentSlot(game));
}

/**
 * Etiqueta humana de um slot (para mensagens de contrato): "Jornada N",
 * nome da ronda da Taça ou "Pré-época".
 */
export function slotLabel(slot: number): string {
  const entry = SEASON_CALENDAR[Math.max(1, slot) - 1];
  if (!entry) return `Semana ${slot}`;
  if (entry.type === "league") return `Jornada ${entry.matchweek}`;
  if (entry.type === "friendly") return "Pré-época";
  return entry.roundName;
}

/**
 * Jogador com contrato em vigor (contract_start_epoch > 0) só é transferível
 * a partir do aniversário do contrato (start + 20 semanas). Epoch 0 = sem
 * contrato (free agent / seed) → transferível de imediato.
 */
export function isContractLocked(
  player: { contract_start_epoch?: number | null },
  game: ActiveGame,
): boolean {
  const start = player.contract_start_epoch || 0;
  if (start <= 0) return false;
  return currentEpoch(game) < start + CONTRACT_LENGTH_MATCHWEEKS;
}

/**
 * Constrói o histórico de skill a partir dos snapshots (player_skill_snapshots)
 * e anexa o valor actual, preservando SEMPRE a época.
 *
 * O `matchweek` dos snapshots é por época (1..14 em cada época). Descartar a
 * `season` fazia os pontos da época actual colidirem nos mesmos X da época 1
 * no gráfico (linha em zigzag / últimos registos invisíveis).
 */
export function buildSkillHistory(
  snapshots: Array<{ matchweek: number; season: number; skill: number }>,
  current: { matchweek: number; season: number; skill: number },
): Array<{ matchweek: number; season: number; skill: number }> {
  const history = snapshots.map((r) => ({
    matchweek: r.matchweek,
    season: r.season,
    skill: r.skill,
  }));
  const lastSnap = history.length > 0 ? history[history.length - 1] : null;
  const isDuplicate =
    !!lastSnap &&
    lastSnap.season === current.season &&
    lastSnap.matchweek === current.matchweek;
  if (!isDuplicate) {
    history.push({
      matchweek: current.matchweek,
      season: current.season,
      skill: current.skill,
    });
  }
  return history;
}

/**
 * Slot e época (season-relative) em que um contrato termina, derivados do
 * epoch absoluto. Usado em mensagens e badges (`label` já pronto a mostrar).
 */
export function contractEndInfo(
  player: { contract_start_epoch?: number | null },
): { season: number; matchweek: number; label: string } {
  const start = player.contract_start_epoch || 0;
  if (start <= 0) return { season: 0, matchweek: 0, label: "—" };
  const endEpoch = start + CONTRACT_LENGTH_MATCHWEEKS;
  const season = Math.ceil(endEpoch / CONTRACT_LENGTH_MATCHWEEKS);
  const mw = endEpoch - (season - 1) * CONTRACT_LENGTH_MATCHWEEKS;
  const slot = mw === 0 ? CONTRACT_LENGTH_MATCHWEEKS : mw;
  return { season, matchweek: slot, label: slotLabel(slot) };
}

/**
 * Época (1-based) → ano civil. A época 1 começa em 2026
 * (invariante do servidor: game.year = 2025 + game.season).
 */
export function seasonToYear(season: number): number {
  return 2025 + season;
}

export function hashString(input = "") {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function runAll<T extends AnyRow = AnyRow>(
  db: Db,
  sql: string,
  params: any[] = [],
): Promise<T[]> {
  return new Promise<T[]>((resolve, reject) => {
    db.all(sql, params, (err: Error | null, rows: T[]) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

export function runGet<T extends AnyRow = AnyRow>(
  db: Db,
  sql: string,
  params: any[] = [],
): Promise<T | null> {
  return new Promise<T | null>((resolve, reject) => {
    db.get(sql, params, (err: Error | null, row: T | null) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

export function validatePositiveInt(val: unknown): number | null {
  const n = Number(val);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function validateNonNegativeInt(val: unknown): number | null {
  const n = Number(val);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export function runExec(
  db: Db,
  sql: string,
  params: any[] = [],
): Promise<{ changes: number }> {
  return new Promise<{ changes: number }>((resolve, reject) => {
    db.run(sql, params, function (this: any, err: Error | null) {
      if (err) return reject(err);
      resolve({ changes: this.changes ?? 0 });
    });
  });
}

/**
 * Returns all teams with coach_name from managers table via JOIN.
 * Use this instead of SELECT * FROM teams when you need coach names.
 * Also exposes coach_is_human (1 = human coach, 0 = NPC, null = no coach).
 */
export function getTeamsWithCoachNames(db: Db): Promise<AnyRow[]> {
  return runAll(
    db,
    `SELECT t.*, m.name AS coach_name, m.is_human AS coach_is_human,
            m.photo AS coach_photo, m.zerozero_id AS coach_zerozero_id
     FROM teams t
     LEFT JOIN managers m ON t.manager_id = m.id`,
  );
}

export function getStandingsRows(teams: AnyRow[] = []) {
  return [...teams].sort((a, b) => {
    const aGoalDifference = (a.goals_for || 0) - (a.goals_against || 0);
    const bGoalDifference = (b.goals_for || 0) - (b.goals_against || 0);
    return (
      (b.points || 0) - (a.points || 0) ||
      bGoalDifference - aGoalDifference ||
      (b.goals_for || 0) - (a.goals_for || 0) ||
      String(a.name || "").localeCompare(String(b.name || ""))
    );
  });
}

export async function getAllTeamForms(
  db: Db,
  season?: number,
): Promise<Record<number, string>> {
  const rows = await runAll(
    db,
    season != null
      ? `SELECT m.home_team_id, m.away_team_id, m.home_score, m.away_score
         FROM matches m
         WHERE m.played = 1 AND m.season = ?
         ORDER BY m.id DESC`
      : `SELECT m.home_team_id, m.away_team_id, m.home_score, m.away_score
         FROM matches m
         WHERE m.played = 1
         ORDER BY m.id DESC`,
    season != null ? [season] : [],
  );
  const formMap: Record<number, string[]> = {};
  for (const row of rows) {
    const homeId = row.home_team_id;
    const awayId = row.away_team_id;
    if (!formMap[homeId]) formMap[homeId] = [];
    if (!formMap[awayId]) formMap[awayId] = [];
    if (formMap[homeId].length < 5) {
      formMap[homeId].push(
        row.home_score > row.away_score
          ? "V"
          : row.home_score < row.away_score
            ? "D"
            : "E",
      );
    }
    if (formMap[awayId].length < 5) {
      formMap[awayId].push(
        row.away_score > row.home_score
          ? "V"
          : row.away_score < row.home_score
            ? "D"
            : "E",
      );
    }
  }
  const result: Record<number, string> = {};
  for (const [id, arr] of Object.entries(formMap)) {
    result[Number(id)] = arr.reverse().join("");
  }
  return result;
}

export function pickRefereeSummary(
  roomCode: string,
  teamId: number,
  opponentId: number,
  matchweek: number,
) {
  const seed = hashString(`${roomCode}:${matchweek}:${teamId}:${opponentId}`);
  const refereeName = refereeNames[seed % refereeNames.length];
  return { name: refereeName };
}

/**
 * Contexto opcional para o cálculo de assistências. Sem ele, a função usa só
 * forma + mood + adversário (comportamento dos testes e antevisões simples).
 */
export interface AttendanceContext {
  competition?: "league" | "cup";
  cupRound?: number;
  season?: number;
  matchweek?: number;
}

export interface AttendanceBreakdown {
  attendance: number;
  occupancy: number; // 0..1 (attendance / capacity)
  capacity: number;
  ticketPrice: number;
  reasons: string[]; // etiquetas curtas pt-PT, ordenadas por impacto (máx. 3)
}

/** RNG determinístico por jogo (mulberry32 sobre o hash): a assistência varia
 * de jogo para jogo mas é estável em replays/audits do mesmo jogo. */
function attendanceRng(seedStr: string) {
  let seed = hashString(seedStr) || 1;
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function computeAttendance(
  db: Db,
  homeTeamId: number,
  opponentTeamId?: number,
  ctx?: AttendanceContext,
): Promise<AttendanceBreakdown> {
  const T = MATCH_TUNING;
  // SELECT * de propósito: tolera DBs antigas sem fans_mood/ticket_price
  // (a migração em gameManager.ts trata o caso geral; aqui há fallback).
  const team: any =
    (await runGet(db, "SELECT * FROM teams WHERE id = ?", [homeTeamId])) || {};
  const rawCapacity = team.stadium_capacity || 10000;
  const homeDiv = team.division ?? 1;
  const divLimit = MAX_ATTENDANCE_BY_DIVISION[homeDiv] ?? Infinity;
  const capacity = Math.min(rawCapacity, divLimit);
  // Massa adepta: a procura manda, não o cimento. Sem fanbase registada
  // (DBs pré-migração) não limita. A ocupação segue física: gigante
  // vazio sente-se vazio (bónus de ambiente em conformidade).
  const fanbase = team.fanbase > 0 ? team.fanbase : capacity;
  const effectiveCap = Math.min(capacity, fanbase);
  const fansMood = team.fans_mood ?? T.fansMoodDefault;
  const ticketPrice = team.ticket_price ?? T.ticketBasePrice;

  const recentMatches = await runAll<{
    home_team_id: number;
    away_team_id: number;
    home_score: number;
    away_score: number;
  }>(
    db,
    `SELECT home_team_id, away_team_id, home_score, away_score
     FROM matches
     WHERE played = 1 AND (home_team_id = ? OR away_team_id = ?)
     ORDER BY matchweek DESC, id DESC
     LIMIT 5`,
    [homeTeamId, homeTeamId],
  );

  // ── Forma com peso de recência (o jogo mais recente pesa 5× o 5º) ──────
  // V=1.0, E=0.4, D=0. Sem jogos → 0.5 (neutro).
  let formPoints = 0.5;
  let winlessStreak = 0;
  let lastHomeMargin = 0;
  let lastHomeWasWin: boolean | null = null;
  if (recentMatches.length > 0) {
    let weighted = 0;
    let weightSum = 0;
    recentMatches.forEach((m, i) => {
      const isHome = m.home_team_id === homeTeamId;
      const gf = isHome ? m.home_score : m.away_score;
      const ga = isHome ? m.away_score : m.home_score;
      const pts = gf > ga ? 1.0 : gf === ga ? 0.4 : 0;
      const w = recentMatches.length - i; // mais recente pesa mais
      weighted += pts * w;
      weightSum += w;
      if (lastHomeWasWin === null && isHome) {
        lastHomeWasWin = gf > ga;
        lastHomeMargin = gf - ga;
      }
    });
    formPoints = weighted / weightSum;
    for (const m of recentMatches) {
      const isHome = m.home_team_id === homeTeamId;
      const gf = isHome ? m.home_score : m.away_score;
      const ga = isHome ? m.away_score : m.home_score;
      if (gf > ga) break;
      winlessStreak += 1;
    }
  }

  // ── Posição na tabela (dentro da própria divisão) ─────────────────────
  let homeRank01 = 0.5; // 1 = líder, 0 = último
  let homeTop3 = false;
  let homeBottom2 = false;
  try {
    const table = await runAll<any>(
      db,
      `SELECT id, points, goals_for, goals_against FROM teams WHERE division = ?`,
      [homeDiv],
    );
    const sorted = getStandingsRows(table);
    const idx = sorted.findIndex((t) => t.id === homeTeamId);
    if (idx >= 0 && sorted.length > 1) {
      homeRank01 = 1 - idx / (sorted.length - 1);
      homeTop3 = idx <= 2;
      homeBottom2 = idx >= sorted.length - 2;
    }
  } catch {
    // tabelas mínimas de teste — mantém neutro
  }

  // ── Entusiasmo (0..~1): mood pesa mais que forma, tabela desempatia ───
  const enthusiasm =
    0.45 * (fansMood / 100) + 0.35 * formPoints + 0.2 * homeRank01;
  const faithfulFloor =
    T.faithfulFloorByDivision[homeDiv] ?? 0.25;
  let occupancyRatio = faithfulFloor + (1 - faithfulFloor) * enthusiasm;

  // ── Bónus contextuais (soma com teto) ─────────────────────────────────
  const reasons: Array<{ label: string; impact: number }> = [];
  let bonus = 0;
  const pushBonus = (amount: number, label: string | null) => {
    bonus += amount;
    if (label) reasons.push({ label, impact: Math.abs(amount) });
  };
  let oppDiv: number | null = null;
  if (opponentTeamId) {
    let oppSkill = 0;
    try {
      const opp = await runGet<{ avg_skill?: number }>(
        db,
        `SELECT ROUND(AVG(COALESCE(p.skill, 0))) as avg_skill
         FROM players p
         WHERE p.team_id = ? AND p.team_id IS NOT NULL`,
        [opponentTeamId],
      );
      oppSkill = opp?.avg_skill || 0;
    } catch {
      oppSkill = 0;
    }
    const OPPONENT_MAX_SKILL = 50;
    const quality = Math.min(oppSkill / OPPONENT_MAX_SKILL, 1);
    if (quality > 0.3) pushBonus(quality * 0.2, quality > 0.7 ? "adversário de peso" : null);
    try {
      const oppRow: any =
        (await runGet(db, "SELECT * FROM teams WHERE id = ?", [opponentTeamId])) || {};
      oppDiv = oppRow.division ?? null;
      if (oppDiv != null && oppDiv === homeDiv) {
        pushBonus(T.attendanceDerbyBonus, "dérbi");
      }
      if (oppDiv != null) {
        const oppTable = await runAll<any>(
          db,
          `SELECT id, points, goals_for, goals_against FROM teams WHERE division = ?`,
          [oppDiv],
        );
        const oppSorted = getStandingsRows(oppTable);
        const oppIdx = oppSorted.findIndex((t) => t.id === opponentTeamId);
        if (oppIdx >= 0 && oppSorted.length > 2) {
          if (oppIdx <= 1) pushBonus(T.attendanceLeaderVisitBonus, "visita do líder");
          else if (oppIdx >= oppSorted.length - 2)
            pushBonus(T.attendanceWeakVisitorMalus, null);
        }
      }
    } catch {
      // ignora contexto do adversário em DBs mínimas
    }
  }
  if (homeTop3) pushBonus(T.attendanceTitleRaceBonus, "luta pelo título");
  if (homeBottom2) pushBonus(T.attendanceBottomMalus, "crise na tabela");
  if (lastHomeWasWin === true && lastHomeMargin >= 3)
    pushBonus(0.05, "goleada em casa");
  if (lastHomeWasWin === false && lastHomeMargin <= -3)
    pushBonus(-0.05, "humilhação em casa");
  bonus = Math.max(-0.25, Math.min(T.attendanceBonusCap, bonus));

  // ── Multiplicadores: Taça, meteo, preço ───────────────────────────────
  let mult = 1 + bonus;
  const competition = ctx?.competition ?? "league";
  if (competition === "cup" && ctx?.cupRound != null) {
    const cupMult = T.attendanceCupRoundMult[ctx.cupRound] ?? 1;
    mult *= cupMult;
    if (ctx.cupRound >= 4)
      reasons.push({
        label: ctx.cupRound === 5 ? "final da Taça" : "fase decisiva da Taça",
        impact: Math.abs(cupMult - 1) + 0.2,
      });
  }
  if (ctx?.season != null && ctx?.matchweek != null && opponentTeamId) {
    try {
      const { condition } = getWeatherForFixture(
        ctx.season,
        ctx.matchweek,
        homeTeamId,
        opponentTeamId,
      );
      const wMult = T.attendanceWeatherMult[condition] ?? 1;
      mult *= wMult;
      if (condition === "chuva_forte" || condition === "neve")
        reasons.push({
          label: condition === "neve" ? "neve" : "chuva forte",
          impact: Math.abs(wMult - 1) + 0.05,
        });
      else if (condition === "sol")
        reasons.push({ label: "sol", impact: 0.03 });
    } catch {
      // sem meteo — segue sem ela
    }
  }
  const ticketMult = Math.max(
    0.7,
    Math.min(1.25, 1 - (ticketPrice - T.ticketBasePrice) * T.ticketDemandPerEuro),
  );
  mult *= ticketMult;
  if (ticketPrice > T.ticketBasePrice + 5)
    reasons.push({ label: "bilhetes caros", impact: 0.08 });
  else if (ticketPrice < T.ticketBasePrice - 4)
    reasons.push({ label: "bilhetes baratos", impact: 0.06 });

  // ── Choques: jitter natural + noite mágica / deserção (raros) ─────────
  const rng = attendanceRng(
    `${ctx?.season ?? 0}:${ctx?.matchweek ?? 0}:${homeTeamId}:${opponentTeamId ?? 0}:${recentMatches.length}`,
  );
  const jitter = 1 + (rng() * 2 - 1) * T.attendanceJitter;
  mult *= jitter;
  if (rng() < T.attendanceMagicNightChance) {
    const magic = 1.08 + rng() * 0.07;
    mult *= magic;
    reasons.push({ label: "noite mágica", impact: 0.3 });
  }
  if (
    fansMood <= T.attendanceDesertMoodMax &&
    winlessStreak >= 3 &&
    rng() < T.attendanceDesertChance
  ) {
    const desert = 1 - (0.12 + rng() * 0.06);
    mult *= desert;
    reasons.push({ label: "deserção em crise", impact: 0.35 });
  }
  if (fansMood >= 85 && formPoints >= 0.8)
    reasons.push({ label: "equipa em chamas", impact: 0.15 });
  else if (fansMood <= 25)
    reasons.push({ label: "adeptos descontentes", impact: 0.15 });

  const raw = Math.round(effectiveCap * occupancyRatio * mult);
  const attendance = Math.max(
    Math.floor(capacity * T.attendanceAbsoluteMinRatio),
    Math.min(effectiveCap, raw),
  );
  reasons.sort((a, b) => b.impact - a.impact);
  return {
    attendance,
    occupancy: capacity > 0 ? attendance / capacity : 0,
    capacity,
    ticketPrice,
    reasons: reasons.slice(0, 3).map((r) => r.label),
  };
}

export async function calculateMatchAttendance(
  db: Db,
  homeTeamId: number,
  opponentTeamId?: number,
  ctx?: AttendanceContext,
) {
  return (await computeAttendance(db, homeTeamId, opponentTeamId, ctx)).attendance;
}

/**
 * Variante explicada (Briefing/UI): devolve ocupação e motivos além do número.
 * Mesma semente do cálculo base — o número é idêntico ao de
 * `calculateMatchAttendance` com o mesmo ctx.
 */
export async function explainAttendance(
  db: Db,
  homeTeamId: number,
  opponentTeamId?: number,
  ctx?: AttendanceContext,
): Promise<AttendanceBreakdown> {
  return computeAttendance(db, homeTeamId, opponentTeamId, ctx);
}

export function logClubNews(
  game: ActiveGame,
  type: string,
  title: string,
  teamId: number,
  data: {
    player_name?: string;
    player_id?: number;
    related_team_name?: string;
    related_team_id?: number;
    amount?: number;
    description?: string;
    /** Override opcional do ano/jornada a registar (por omissão usa game). */
    year?: number;
    matchweek?: number;
  },
  io?: any,
  extra?: Record<string, any>,
) {
  const description = data.description || null;
  game.db.run(
    `INSERT INTO club_news (team_id, type, title, description, player_id, player_name, related_team_id, related_team_name, amount, matchweek, year)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      teamId,
      type,
      title,
      description,
      data.player_id || null,
      data.player_name || null,
      data.related_team_id || null,
      data.related_team_name || null,
      data.amount || null,
      data.matchweek ?? game.matchweek,
      (data.year ?? game.year) || 0,
    ],
    () => {
      if (io) {
        io.to(game.roomCode).emit("clubNewsUpdated", {
          teamId,
          type,
          title,
          playerId: data.player_id || null,
          playerName: data.player_name || null,
          ...extra,
        });
      }
    },
  );
}

interface TransferRecord {
  playerId: number | null;
  playerName: string;
  position?: string;
  skill?: number;
  isStar?: number;
  photo?: string | null;
  sellerTeamId?: number | null;
  sellerTeamName?: string | null;
  buyerTeamId?: number | null;
  buyerTeamName?: string | null;
  amount: number;
  source: string;
}

/**
 * recordTransfer — regista um negócio concluído no histórico global da época
 * (tabela transfer_history) e emite transferCompleted para a sala. É a fonte
 * canónica do painel "Histórico" do Mercado. Não-crítico: fire-and-forget,
 * nunca interfere com a transação financeira que já ocorreu.
 */
export function recordTransfer(game: ActiveGame, info: TransferRecord, io?: any) {
  const matchweek = game.matchweek || 0;
  const year = game.year || 0;

  const finish = (
    sellerTeamName: string | null,
    buyerTeamName: string | null,
  ) => {
    // Payload snake_case — a mesma forma das linhas devolvidas por
    // getTransferHistory (SELECT th.*), para o cliente tratar uma única forma.
    const payload = {
      player_id: info.playerId,
      player_name: info.playerName,
      position: info.position || null,
      skill: info.skill ?? null,
      is_star: info.isStar ? 1 : 0,
      photo: info.photo || null,
      seller_team_id: info.sellerTeamId || null,
      seller_team_name: sellerTeamName,
      buyer_team_id: info.buyerTeamId || null,
      buyer_team_name: buyerTeamName,
      amount: info.amount || 0,
      source: info.source,
      matchweek,
      year,
    };
    game.db.run(
      `INSERT INTO transfer_history
        (player_id, player_name, position, skill, is_star, photo, seller_team_id,
         seller_team_name, buyer_team_id, buyer_team_name, amount, source,
         matchweek, year)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.player_id,
        payload.player_name,
        payload.position,
        payload.skill,
        payload.is_star,
        payload.photo,
        payload.seller_team_id,
        payload.seller_team_name,
        payload.buyer_team_id,
        payload.buyer_team_name,
        payload.amount,
        payload.source,
        payload.matchweek,
        payload.year,
      ],
      (err: Error | null) => {
        if (err) {
          console.warn(
            `[recordTransfer] insert failed (${game.roomCode}):`,
            err.message,
          );
          return;
        }
        if (io) {
          io.to(game.roomCode).emit("transferCompleted", payload);
          io.to(game.roomCode).emit("globalNewsUpdated");
        }
      },
    );
  };

  const needSeller =
    !info.sellerTeamName && info.sellerTeamId != null && info.sellerTeamId > 0;
  const needBuyer =
    !info.buyerTeamName && info.buyerTeamId != null && info.buyerTeamId > 0;

  if (!needSeller && !needBuyer) {
    finish(info.sellerTeamName || null, info.buyerTeamName || null);
    return;
  }

  const fetchName = (id: number) =>
    new Promise<string | null>((resolve) => {
      game.db.get(
        "SELECT name FROM teams WHERE id = ?",
        [id],
        (err: Error | null, row: any) => {
          resolve(err ? null : row?.name || null);
        },
      );
    });

  const sellerP = needSeller ? fetchName(info.sellerTeamId as number) : Promise.resolve(info.sellerTeamName || null);
  const buyerP = needBuyer ? fetchName(info.buyerTeamId as number) : Promise.resolve(info.buyerTeamName || null);
  Promise.all([sellerP, buyerP])
    .then(([sellerName, buyerName]) => {
      finish(sellerName, buyerName);
    })
    .catch(() => {
      finish(info.sellerTeamName || null, info.buyerTeamName || null);
    });
}
