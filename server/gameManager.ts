import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import type { ActiveGame, GamePhase, PlayerSession } from "./types";
import { SEASON_CALENDAR, TEAMS_PER_DIVISION, FRIENDLY_ROUND, signingWage, DEFAULT_MS_PER_MINUTE, SIM_SPEED_PRESETS } from "./gameConstants";
import { currentEpoch, getSeasonEndMatchweek, isContractLocked, runGet, runExec, serializeRoomTask, slimMatchResult } from "./coreHelpers";
import { dealDisplaySponsors } from "./game/sponsors";
import { getOfflineCoaches, getRoomRoster } from "./presenceHelpers";
import {
  backfillSeats,
  clearSeatPositions,
  isSeatPresent,
  loadEventSeq,
  loadSeats,
  markSeatSeen,
  persistSeat,
  replayEventsSince,
  resetAllReady,
  seatOf,
} from "./roomStateHelpers";

const sqlite = sqlite3.verbose();

// Localização das salas: saves/<criador>/game_<ROOM>.db.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { findRoomDbFile, creatorDbPath, savesDirFor } = require("./db/roomPaths");

// Fisher-Yates shuffle via Math.random — usado no sorteio 60→40 por sala
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const activeGames: Record<string, ActiveGame> = {};

// Índice global socketId → roomCode para O(1) lookup no disconnect
// Mantido em sincronismo com bindSocket/unbindSocket
const socketRoomIndex: Record<string, string> = {};

type SqliteDb = any;
type DbRow = { [key: string]: any } | null;
type OnReady = (game: ActiveGame | null, error?: Error) => void;

function dbDirCandidates() {
  return [
    path.join(__dirname, "db"),
    path.join(__dirname, "..", "db"),
    path.join(process.cwd(), "db"),
  ];
}

function resolveDbPaths(roomCode: string, creatorName?: string) {
  const candidates = dbDirCandidates();
  const existingBasePath = candidates
    .map((dir) => path.join(dir, "base.db"))
    .find((candidatePath) => fs.existsSync(candidatePath));

  const targetDbDir = existingBasePath
    ? path.dirname(existingBasePath)
    : candidates.find((dir) => fs.existsSync(dir)) ||
      path.join(process.cwd(), "db");

  if (!fs.existsSync(targetDbDir)) {
    fs.mkdirSync(targetDbDir, { recursive: true });
  }

  const savesDir = savesDirFor(targetDbDir);
  // Sala existente: em saves/.
  // Sala nova com criador conhecido: nasce logo em saves/<criador>/.
  const dbPath =
    findRoomDbFile(savesDir, roomCode) ??
    (creatorName
      ? creatorDbPath(savesDir, roomCode, creatorName)
      : path.join(savesDir, `game_${roomCode}.db`));

  if (!fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  return {
    dbPath,
    basePath: existingBasePath || path.join(targetDbDir, "base.db"),
    targetDbDir,
  };
}

function doesGameExist(roomCode: string) {
  const { dbPath } = resolveDbPaths(roomCode);
  return fs.existsSync(dbPath);
}

function generateUniqueRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code;
  do {
    code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (doesGameExist(code));
  return code;
}

function getGame(roomCode: string, onReady?: OnReady, creatorName?: string): ActiveGame | null {
  if (activeGames[roomCode]) {
    if (onReady) onReady(activeGames[roomCode]);
    return activeGames[roomCode];
  }

  const { dbPath, basePath, targetDbDir } = resolveDbPaths(roomCode, creatorName);

  if (!fs.existsSync(dbPath)) {
    if (!fs.existsSync(basePath)) {
      console.error(
        `[gameManager] base.db not found in ${targetDbDir} — run: npm run seed:real`,
      );
      if (onReady)
        onReady(
          null,
          new Error("Base DB not found. Server needs to be seeded first."),
        );
      return null;
    }
    const stat = fs.statSync(basePath);
    if (stat.size < 1024) {
      console.error(
        "[gameManager] base.db is empty or corrupt — run: npm run seed:real",
      );
      if (onReady)
        onReady(
          null,
          new Error("Base DB is empty. Server needs to be seeded first."),
        );
      return null;
    }
    fs.copyFileSync(basePath, dbPath);
    // --- Pool 60→50: sorteio por sala (TEAMS_PER_DIVISION por divisão, fixos garantidos) ---
    try {
      const DatabaseSync: any = (() => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          return require("node:sqlite").DatabaseSync;
        } catch {
          return null;
        }
      })();
      if (DatabaseSync) {
        const tmp = new DatabaseSync(dbPath);
        try {
          tmp.exec("PRAGMA foreign_keys = ON");
          const rows: Array<{ id: number; name: string; division: number }> = tmp
            .prepare("SELECT id, name, division FROM teams")
            .all();
          const byDiv: Record<number, typeof rows> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
          for (const r of rows) {
            if (byDiv[r.division]) byDiv[r.division].push(r);
            else byDiv[r.division] = [r];
          }
          const FIXED: Record<number, string[]> = {
            1: ["Sporting", "Porto", "Benfica"],
            4: ["Juventude", "Juventude SC"],
          };
          const keepIds: number[] = [];
          for (let d = 1; d <= 5; d++) {
            const pool = byDiv[d] || [];
            const fixedNames = FIXED[d] || [];
            const fixed = pool.filter((t) => fixedNames.includes(t.name));
            const rest = pool.filter((t) => !fixedNames.includes(t.name));
            const need = TEAMS_PER_DIVISION - fixed.length;
            if (pool.length !== 12) console.warn(`[gameManager] D${d} pool inesperado: ${pool.length} (esperado 12)`);
            if (need < 0) throw new Error(`Fixos a mais na D${d}`);
            const sampled = shuffle(rest).slice(0, need);
            keepIds.push(...fixed.map((t) => t.id), ...sampled.map((t) => t.id));
          }
          const keepSet = new Set(keepIds);
          const dropIds = rows.filter((r) => !keepSet.has(r.id)).map((r) => r.id);
          if (dropIds.length !== rows.length - 5 * TEAMS_PER_DIVISION) console.warn(`[gameManager] drop inesperado: ${dropIds.length}`);
          // Guardar manager_ids das equipas a remover para limpar chat_messages após delete de teams
          let dropManagerIds: number[] = [];
          if (dropIds.length) {
            const phM = dropIds.map(() => "?").join(",");
            try {
              const mRows: Array<{ manager_id: number }> = tmp.prepare(`SELECT manager_id FROM teams WHERE id IN (${phM}) AND manager_id IS NOT NULL`).all(...dropIds);
              dropManagerIds = mRows.map((r) => r.manager_id).filter((v) => Number.isFinite(v));
            } catch (e) { console.warn(`[gameManager] Falha ao recolher manager_ids de drop para chat_messages:`, e); }
          }
          tmp.exec("BEGIN");
            if (dropIds.length) {
              const ph = dropIds.map(() => "?").join(",");
              // Limpeza de FKs antes de apagar players/teams (evita SQLITE_CONSTRAINT_FOREIGNKEY)
              tmp.prepare(`DELETE FROM player_skill_snapshots WHERE player_id IN (SELECT id FROM players WHERE team_id IN (${ph}))`).run(...dropIds);
              tmp.prepare(`DELETE FROM training_player_history WHERE player_id IN (SELECT id FROM players WHERE team_id IN (${ph})) OR team_id IN (${ph})`).run(...dropIds, ...dropIds);
              tmp.prepare(`DELETE FROM club_news WHERE player_id IN (SELECT id FROM players WHERE team_id IN (${ph})) OR team_id IN (${ph})`).run(...dropIds, ...dropIds);
              tmp.prepare(`DELETE FROM players WHERE team_id IN (${ph})`).run(...dropIds);
              // Tabelas que referenciam teams
              tmp.prepare(`DELETE FROM matches WHERE home_team_id IN (${ph}) OR away_team_id IN (${ph})`).run(...dropIds, ...dropIds);
              tmp.prepare(`DELETE FROM cup_matches WHERE home_team_id IN (${ph}) OR away_team_id IN (${ph})`).run(...dropIds, ...dropIds);
              tmp.prepare(`DELETE FROM palmares WHERE team_id IN (${ph})`).run(...dropIds);
              tmp.prepare(`DELETE FROM team_training WHERE team_id IN (${ph})`).run(...dropIds);
              // Tabelas que o getGame cria mais tarde (um base.db antigo pode
              // não as ter): só limpar se existirem — sem isto o DELETE atirava
              // "no such table" e enchia o log com um stack trace que não é erro.
              const hasTable = (t: string) =>
                !!tmp
                  .prepare(
                    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
                  )
                  .get(t);
              if (hasTable("player_tactic_history"))
                try { tmp.prepare(`DELETE FROM player_tactic_history WHERE team_id IN (${ph})`).run(...dropIds); } catch (e) { console.warn(`[gameManager] player_tactic_history delete falhou:`, e); }
              // club_news secundário por related_team_id
              try { tmp.prepare(`DELETE FROM club_news WHERE related_team_id IN (${ph})`).run(...dropIds); } catch (e) { console.warn(`[gameManager] club_news related delete falhou:`, e); }
              tmp.prepare(`DELETE FROM teams WHERE id IN (${ph})`).run(...dropIds);
              tmp.prepare(`DELETE FROM managers WHERE id NOT IN (SELECT manager_id FROM teams WHERE manager_id IS NOT NULL)`).run();
              tmp.prepare(`DELETE FROM player_skill_snapshots WHERE player_id NOT IN (SELECT id FROM players)`).run();
              // chat_messages após teams/managers: usa dropManagerIds directo (não órfãos antes do delete)
              if (dropManagerIds.length && hasTable("chat_messages")) {
                try {
                  const phMgr = dropManagerIds.map(() => "?").join(",");
                  tmp.prepare(`DELETE FROM chat_messages WHERE coach_name IN (SELECT name FROM managers WHERE id IN (${phMgr}))`).run(...dropManagerIds);
                } catch (e) { console.warn(`[gameManager] chat_messages delete falhou:`, e); }
              }
            }
            tmp.prepare(`INSERT OR REPLACE INTO game_state (key,value) VALUES ('pool_sampling', ?)`).run(JSON.stringify({ kept: keepIds.length, dropped: dropIds.length, at: new Date().toISOString() }));
            // Sala nova arranca no amigável (slot 0): o template não traz
            // calendarIndex e o derive cairia na 1.ª jornada da liga.
            // calendarVersion=2 salta a migração v2; cutover=1 preserva a
            // avaliação de contratos da época 1 como até aqui.
            tmp.prepare(`INSERT OR REPLACE INTO game_state (key,value) VALUES ('calendarIndex','0'),('calendarVersion','2'),('contractCutoverSeason','1')`).run();
            // Sorteio imediato do amigável de pré-época (ronda 0, época 1):
            // a sala nova já nasce com adversário — o briefing não espera.
            const friendlyIds: number[] = tmp.prepare("SELECT id FROM teams WHERE division BETWEEN 1 AND 5 ORDER BY id").all().map((r: any) => r.id);
            const shuffledFriendly = shuffle(friendlyIds);
            if (shuffledFriendly.length % 2 === 1) shuffledFriendly.pop();
            const friendlyVals: string[] = [];
            const friendlyParams: number[] = [];
            for (let i = 0; i + 1 < shuffledFriendly.length; i += 2) {
              friendlyVals.push("(1, ?, ?, ?)");
              friendlyParams.push(FRIENDLY_ROUND, shuffledFriendly[i], shuffledFriendly[i + 1]);
            }
            if (friendlyVals.length) tmp.prepare(`INSERT INTO cup_matches (season, round, home_team_id, away_team_id) VALUES ${friendlyVals.join(",")}`).run(...friendlyParams);
            // Patrocinador de exibição da época 1 (só visual, sem dinheiro):
            // 1 marca por clube, única no escalão. sponsor_season=0 mantém o
            // fixo antigo no fim da época 1.
            const displayTeams: Array<{ id: number; division: number }> = tmp.prepare("SELECT id, division FROM teams").all();
            const displayUpd = tmp.prepare("UPDATE teams SET sponsor_id = ?, sponsor_season = 0, sponsor_pending = 0 WHERE id = ?");
            for (const d of dealDisplaySponsors(displayTeams)) displayUpd.run(d.sponsorId, d.teamId);
          tmp.exec("COMMIT");
          console.log(`[gameManager] Sala ${roomCode}: pool 60→50 filtrado (keep ${keepIds.length}, drop ${dropIds.length})`);
        } finally {
          try { tmp.exec("ROLLBACK"); } catch { /* COMMIT já executado */ }
          tmp.close();
        }
      } else {
        console.error(`[gameManager] node:sqlite indisponível (requer Node ≥ 22.13) — abortar criação de ${roomCode}`);
        try { if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath); } catch {}
        const err = new Error("node:sqlite indisponível — pool 60→40 não aplicado");
        if (onReady) onReady(null, err);
        return null;
      }
    } catch (e) {
      console.error(`[gameManager] Falha ao filtrar pool 60→40 para ${roomCode}:`, e);
      try { if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath); } catch {}
      const err = e instanceof Error ? e : new Error(String(e));
      if (onReady) onReady(null, err);
      return null;
    }
  }

  const db = new sqlite.Database(dbPath);
  // Aumentar cache de páginas SQLite para 8 MB — reduz I/O repetido em DB frias.
  db.run("PRAGMA cache_size=-8000");
  // WAL: melhor consistência a crash + leituras concorrentes sem bloquear
  // (audits/repair podem ler enquanto o server escreve). busy_timeout evita
  // "database is locked" quando outra conexão segura o arquivo.
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA busy_timeout = 5000");
  db.run("PRAGMA foreign_keys = ON", (err: Error | null) => {
    if (err)
      console.error(
        `[gameManager] Failed to enable foreign keys for ${roomCode}:`,
        err.message,
      );
  });

  const game: ActiveGame = {
    roomCode,
    db,
    playersByName: {} as Record<string, PlayerSession>,
    socketToName: {} as Record<string, string>,
    roomMembers: new Set<string>(),

    // New unified state machine
    calendarIndex: 0,
    calendarVersion: 2,
    contractCutoverSeason: null,
    gamePhase: "lobby",
    season: 1,
    year: 2026,
    matchweek: 1,

    // Current event runtime
    currentEvent: null,
    currentFixtures: [],
    liveMinute: null,

    // Single phase timer + ack set
    phaseTimer: null,
    phaseAcks: new Set<string>(),

    // Cup runtime payloads
    cupTeamIds: [],
    cupHalftimePayload: null,
    cupDrawSeenBy: new Set<string>(),

    // Room owner
    roomCreator: "",
    msPerMinute: DEFAULT_MS_PER_MINUTE,

    // Retained fields
    lockedCoaches: new Set<string>(),

    // Assentos duráveis + presença por lease + pausa
    seats: {} as ActiveGame["seats"],
    seatSeenAt: {} as ActiveGame["seatSeenAt"],
    pauseWaiters: new Set<() => void>(),
    pausedSince: null,
    eventSeq: 0,
    snapshotSeq: 0,
    globalMarket: [],
    auctions: {} as Record<string, unknown>,
    recentAuctions: [],
    auctionTimers: {} as Record<string, unknown>,
    pendingAuctionQueue: [],
    pendingAuctionQueueTimers: [],
    initialized: false,
    roomName: "",

    // Fixture seeds por divisão (aleatórios por época)
    fixtureSeeds: {},

    // Memória táctica por equipa (estrelas por jogo; persistida em game_state)
    tacticFamiliarity: {},

    // Histórico de resultados de jornadas
    allMatchResults: {},

    // Coach dismissal & job offers
    pendingJobOffers: {},
    negativeBudgetStreak: {},
    npcNegativeBudgetStreak: {},
    boardBudgetWarned: {},
    coachMatchesManaged: {},
    npcMatchesManaged: {},
    dismissedCoachSince: {},
    dismissalOptions: {},
    dismissalsThisSeason: new Set<string>(),
    kickedCoaches: new Set<string>(),

    // Resumo semanal do mercado de treinadores (transiente)
    coachMarketEvents: [],
  };

  activeGames[roomCode] = game;

  // Valor de mercado derivado do skill (skill² × 500 + skill × 2000 + piso
  // de €30.000): função direta do skill, sincronizada em cada load.
  db.run(
    "UPDATE players SET value = CAST(ROUND(skill * skill * 500 + skill * 2000 + 30000) AS INTEGER) WHERE skill IS NOT NULL",
    (valueErr: Error | null) => {
      if (valueErr)
        console.warn(`[gameManager] value sync failed: ${valueErr.message}`);
    },
  );

        const loadPersistedState = () => {
          // ── Read persisted state (flat: one query for all keys) ──────────────
          db.all(
            "SELECT key, value FROM game_state",
            (_, stateRows: Array<{ key: string; value: string }> | null) => {
              const st: Record<string, string> = {};
              for (const row of stateRows || []) st[row.key] = row.value;

              // Season / year / matchweek
              if (st["season"]) game.season = parseInt(st["season"]) || 1;
              if (st["year"]) {
                game.year = parseInt(st["year"]) || 2025 + game.season;
              } else {
                game.year = 2025 + game.season;
              }
              if (st["matchweek"])
                game.matchweek = parseInt(st["matchweek"]) || 1;
              if (st["lastPlayedAt"]) game.lastPlayedAt = st["lastPlayedAt"];

              game.calendarIndex = parseInt(st["calendarIndex"]) || 0;

              game.calendarVersion = 2;
              if (st["contractCutoverSeason"] != null && st["contractCutoverSeason"] !== "null") {
                game.contractCutoverSeason = parseInt(st["contractCutoverSeason"]) || null;
              } else {
                game.contractCutoverSeason = null;
              }

              // Uma fase de jogo aqui é sempre dobrada para lobby a seguir ao
              // replay de eventos (ver backfillSeats abaixo): a quebra do
              // servidor nunca retoma no minuto.
              if (st["gamePhase"]) {
                game.gamePhase = st["gamePhase"] as GamePhase;
                console.log(
                  `[gameManager] Restored gamePhase='${game.gamePhase}' for room ${roomCode}`,
                );
              }

              if (st["snapshotSeq"])
                game.snapshotSeq = parseInt(st["snapshotSeq"], 10) || 0;

              if (st["roomName"]) {
                (game as any).roomName = st["roomName"];
              }

              // Cup team IDs
              if (st["cupTeamIds"]) {
                try {
                  const parsed = JSON.parse(st["cupTeamIds"]);
                  if (Array.isArray(parsed)) game.cupTeamIds = parsed;
                } catch (_) {}
              }

              // Cup draw seen-by tracking
              if (st["cupDrawSeenBy"]) {
                try {
                  const parsed = JSON.parse(st["cupDrawSeenBy"]);
                  if (Array.isArray(parsed)) game.cupDrawSeenBy = new Set(parsed);
                } catch (_) {}
              }

              // Current fixtures (for reconnect during match or cup lobby)
              if (st["currentFixtures"]) {
                try {
                  const parsed = JSON.parse(st["currentFixtures"]);
                  if (Array.isArray(parsed)) game.currentFixtures = parsed;
                } catch (_) {}
              }

              // Current live minute for reconnects mid-match
              if (Object.prototype.hasOwnProperty.call(st, "liveMinute")) {
                if (st["liveMinute"] === "null") {
                  game.liveMinute = null;
                } else {
                  const parsedMinute = parseInt(st["liveMinute"], 10);
                  game.liveMinute = Number.isFinite(parsedMinute)
                    ? parsedMinute
                    : null;
                }
              }

              // Sem retoma no minuto: um checkpoint de build anterior é lixo —
              // limpa-se a chave para não envenenar arranques futuros.
              if (st["matchCheckpoint"] && st["matchCheckpoint"] !== "null") {
                db.run(
                  "INSERT OR REPLACE INTO game_state (key, value) VALUES ('matchCheckpoint', 'null')",
                  () => {},
                );
              }

              // Sem jogo em curso o cursor não significa nada — e um 41 residual
              // num lobby já enganou a retoma (era o valor que fazia
              // `from = max(1, liveMinute+1)` saltar minutos).
              if (
                game.gamePhase === "lobby" &&
                game.liveMinute != null &&
                game.liveMinute !== 0
              ) {
                console.log(
                  `[gameManager] liveMinute residual ${game.liveMinute} descartado (room ${roomCode}, fase lobby)`,
                );
                game.liveMinute = 0;
              }

              // lockedCoaches is NOT restored from this game_state key (transient).
              // It is re-derived at the end of load from the managers/teams tables
              // (human coaches with a team), so rooms with 2+ humans stay blocked
              // until every coach is online — even across server restarts.

              // Room creator (persisted so Admin badge survives restarts)
              if (st["roomCreator"]) {
                game.roomCreator = String(st["roomCreator"]);
              }

              // Ritmo da simulação (preset do admin; salas antigas ficam no default)
              const savedMs = Number(st["msPerMinute"]);
              game.msPerMinute = (Object.values(SIM_SPEED_PRESETS) as number[]).includes(savedMs)
                ? savedMs
                : DEFAULT_MS_PER_MINUTE;

              // Coach dismissal persistence — o convite sobrevive ao restart
              game.pendingJobOffers = {};
              if (st["pendingJobOffers"]) {
                try {
                  game.pendingJobOffers = JSON.parse(st["pendingJobOffers"]) || {};
                } catch (_) {}
              }
              if (st["negativeBudgetStreak"]) {
                try {
                  const parsed = JSON.parse(st["negativeBudgetStreak"]);
                  game.negativeBudgetStreak = Object.fromEntries(
                    Object.entries(parsed).map(([k, v]) => [
                      Number(k),
                      Number(v),
                    ]),
                  );
                } catch (_) {}
              }
              if (st["npcNegativeBudgetStreak"]) {
                try {
                  const parsed = JSON.parse(st["npcNegativeBudgetStreak"]);
                  game.npcNegativeBudgetStreak = Object.fromEntries(
                    Object.entries(parsed).map(([k, v]) => [
                      Number(k),
                      Number(v),
                    ]),
                  );
                } catch (_) {}
              }
              if (st["boardBudgetWarned"]) {
                try {
                  const parsed = JSON.parse(st["boardBudgetWarned"]);
                  game.boardBudgetWarned = Object.fromEntries(
                    Object.entries(parsed).map(([k, v]) => [
                      Number(k),
                      Number(v),
                    ]),
                  );
                } catch (_) {}
              }
              if (st["dismissedCoachSince"]) {
                try {
                  const parsed = JSON.parse(st["dismissedCoachSince"]);
                  game.dismissedCoachSince = Object.fromEntries(
                    Object.entries(parsed).map(([k, v]) => [
                      String(k),
                      v as { matchweek: number; division: number },
                    ]),
                  );
                } catch (_) {}
              }
              if (st["coachMatchesManaged"]) {
                try {
                  const parsed = JSON.parse(st["coachMatchesManaged"]);
                  game.coachMatchesManaged = Object.fromEntries(
                    Object.entries(parsed).map(([k, v]) => [
                      String(k),
                      Number(v),
                    ]),
                  );
                } catch (_) {}
              }
              if (st["npcMatchesManaged"]) {
                try {
                  const parsed = JSON.parse(st["npcMatchesManaged"]);
                  game.npcMatchesManaged = Object.fromEntries(
                    Object.entries(parsed).map(([k, v]) => [
                      Number(k),
                      Number(v),
                    ]),
                  );
                } catch (_) {}
              }
              if (st["dismissalsThisSeason"]) {
                try {
                  const names = JSON.parse(st["dismissalsThisSeason"]);
                  if (Array.isArray(names))
                    game.dismissalsThisSeason = new Set<string>(names);
                } catch (_) {}
              }
              if (st["kickedCoaches"]) {
                try {
                  const names = JSON.parse(st["kickedCoaches"]);
                  if (Array.isArray(names))
                    game.kickedCoaches = new Set<string>(names);
                } catch (_) {}
              }
              if (st["fixtureSeeds"]) {
                try {
                  const parsed = JSON.parse(st["fixtureSeeds"]);
                  if (parsed && typeof parsed === "object") {
                    game.fixtureSeeds = Object.fromEntries(
                      Object.entries(parsed).map(([k, v]) => [
                        Number(k),
                        Array.isArray(v) ? (v as number[]) : [],
                      ]),
                    );
                  }
                } catch (_) {}
              }
              if (st["allMatchResults"]) {
                try {
                  const parsed = JSON.parse(st["allMatchResults"]);
                  if (parsed && typeof parsed === "object") {
                    // .map(slim): salas com o blob antigo (fixture completo)
                    // ficam magras já neste load — não só a partir da 1.ª jornada nova.
                    game.allMatchResults = Object.fromEntries(
                      Object.entries(parsed).map(([k, v]) => [
                        Number(k),
                        Array.isArray(v) ? (v as any[]).map(slimMatchResult) : [],
                      ]),
                    );
                  }
                } catch (_) {}
              }

              // ── Memória táctica: restaurar histórico de formações ──
              if (st["tacticFamiliarity"]) {
                try {
                  const parsed = JSON.parse(st["tacticFamiliarity"]);
                  if (parsed && typeof parsed === "object") {
                    game.tacticFamiliarity = Object.fromEntries(
                      Object.entries(parsed).map(([k, v]) => [
                        Number(k),
                        { history: ((v as { history?: string[] })?.history || []).slice(0, 5) },
                      ]),
                    );
                  }
                } catch (_) {}
              }

              // Limpar pendingMatchActions persistidas na DB — após reinício do servidor
              // o jogo já foi reposto para "lobby", por isso qualquer ação pendente
              // é obsoleta. Criar um stub inerte causaria bloqueios silenciosos.
              if (st["pendingMatchAction"] && st["pendingMatchAction"] !== "null") {
                game.pendingMatchActions?.clear();
                db.run(
                  `INSERT OR REPLACE INTO game_state (key, value) VALUES ('pendingMatchAction', 'null')`,
                  (cleanErr: Error | null) => {
                    if (cleanErr) {
                      console.error(
                        `[gameManager] Erro ao limpar pendingMatchAction na DB (room ${roomCode}):`,
                        cleanErr.message,
                      );
                    } else {
                      console.log(
                        `[gameManager] pendingMatchAction obsoleta removida após reinício (room ${roomCode})`,
                      );
                    }
                  },
                );
              }

              // Set currentEvent from calendarIndex
              game.currentEvent = SEASON_CALENDAR[game.calendarIndex] ?? null;

              // ── Restaurar leilões concluídos ("Recentes": visíveis durante 2 jornadas) ──
              if (st["recentAuctions"]) {
                try {
                  const parsed = JSON.parse(st["recentAuctions"]);
                  if (Array.isArray(parsed)) {
                    const mw = game.matchweek || 0;
                    (game as any).recentAuctions = parsed
                      .filter((r) => r && r.playerId != null && mw - (r.closedMatchweek ?? mw) <= 2)
                      .slice(-100);
                  }
                } catch (_) {}
              }

              // ── Restaurar leilões ativos (open + paused) ─────────────────────────
              let restoredAuctionIds: number[] = [];
              const rawAuctions = st["activeAuctions"];
              if (rawAuctions) {
                try {
                  const parsed = JSON.parse(rawAuctions);
                  if (Array.isArray(parsed) && parsed.length > 0) {
                    const now = Date.now();
                    for (const a of parsed) {
                      if (!a.playerId) continue;
                      const pid = Number(a.playerId);
                      const isPaused = a.status === "paused" || a.pausedRemainingMs != null && a.endsAt == null;
                      if (isPaused) {
                        game.auctions[String(pid)] = {
                          playerId: pid,
                          sellerTeamId: a.sellerTeamId ?? null,
                          startingPrice: a.startingPrice ?? 0,
                          status: "paused",
                          bids: (a.bids && !Array.isArray(a.bids)) ? a.bids : {},
                          timer: null,
                          endsAt: null,
                          pausedRemainingMs: a.pausedRemainingMs,
                          npcRelicitationCount: a.npcRelicitationCount || {},
                          isExClub: !!a.isExClub,
                          guaranteed: !!a.guaranteed,
                        };
                      } else {
                        // open — recalcular tempo restante; se já expirou, agenda finalização curta
                        let remainingMs: number;
                        if (a.endsAt) remainingMs = Math.max(0, Number(a.endsAt) - now);
                        else if (a.pausedRemainingMs != null) remainingMs = Math.max(0, Number(a.pausedRemainingMs));
                        else remainingMs = 120000;
                        // floor 1s para já expirados, senão garante 10s mínimo para evitar race
                        const timerMs = remainingMs <= 0 ? 1000 : Math.max(10000, remainingMs);
                        const endsAt = now + timerMs;
                        game.auctions[String(pid)] = {
                          playerId: pid,
                          sellerTeamId: a.sellerTeamId ?? null,
                          startingPrice: a.startingPrice ?? 0,
                          status: "open",
                          bids: (a.bids && !Array.isArray(a.bids)) ? a.bids : {},
                          timer: null,
                          endsAt,
                          pausedRemainingMs: undefined,
                          npcRelicitationCount: a.npcRelicitationCount || {},
                          isExClub: !!a.isExClub,
                          guaranteed: !!a.guaranteed,
                        };
                        if (!game.auctionTimers) game.auctionTimers = {} as any;
                        // Agenda finalização delayed — usa lógica inline para não depender de auctionHelpers no load
                        const tid = setTimeout(() => {
                          const auc = (game.auctions as any)?.[pid];
                          if (!auc || auc.status !== "open") return;
                          const hasBids = auc.bids && Object.keys(auc.bids).length > 0;
                          const pushRecent = (player: any, result: any) => {
                            const list = (((game as any).recentAuctions as any[]) || []).filter(
                              (r: any) => r && Number(r.playerId) !== Number(pid),
                            );
                            list.push({
                              playerId: pid,
                              name: player?.name ?? "?",
                              position: player?.position ?? null,
                              photo: player?.photo || null,
                              skill: player?.skill,
                              is_star: player?.is_star || 0,
                              team_name: player?.team_name || null,
                              sellerTeamId: auc.sellerTeamId ?? null,
                              isExClub: !!auc.isExClub,
                              result,
                              closed: true,
                              closedMatchweek: game.matchweek || 0,
                            });
                            (game as any).recentAuctions = list.slice(-100);
                          };
                          if (!hasBids) {
                            db.get("SELECT p.*, COALESCE(t.name, '?') as team_name FROM players p LEFT JOIN teams t ON p.team_id = t.id WHERE p.id=?", [pid], (_e0: any, pl0: any) => {
                              if (pl0) pushRecent(pl0, { playerId: pid, playerName: pl0.name, sold: false });
                              db.run("UPDATE players SET transfer_status='none', transfer_price=0 WHERE id=?", [pid]);
                              delete (game.auctions as any)[pid];
                              delete (game.auctionTimers as any)[pid];
                            });
                            return;
                          }
                          // Com lances: finaliza inline (merge de auctionHelpers.finalizeAuction,
                          // com as mesmas garantias: revalida orçamento — o valor só era
                          // verificado no lance —, respeita o lock do agente e movimenta
                          // dinheiro/transferência numa transação).
                          // Serializado por sala (mesma fila do finalizeAuction):
                          // leilões restaurados com endsAt expirado disparam todos
                          // no mesmo tick e o 2.º BEGIN falhava dentro da
                          // transação do 1.º (SQLITE_ERROR).
                          serializeRoomTask(roomCode, () =>
                          (async () => {
                            const closeUnsold = async () => {
                              const pl = await runGet<any>(db, "SELECT p.*, COALESCE(t.name, '?') as team_name FROM players p LEFT JOIN teams t ON p.team_id = t.id WHERE p.id=?", [pid]);
                              if (pl) pushRecent(pl, { playerId: pid, playerName: pl.name, sold: false });
                              db.run("UPDATE players SET transfer_status='none', transfer_price=0 WHERE id=?", [pid]);
                              delete (game.auctions as any)[pid];
                              delete (game.auctionTimers as any)[pid];
                            };
                            const bidsDesc = Object.entries(auc.bids || {})
                              .map(([tid2, val]) => ({
                                teamId: parseInt(tid2, 10),
                                amount: Number((val as any)?.amount || 0),
                              }))
                              .sort((x, y) => y.amount - x.amount);
                            // O orçamento só era validado no lance; entre o lance e o
                            // fecho pode ter sido gasto noutro leilão — passa ao seguinte.
                            let winner: { teamId: number; amount: number } | null = null;
                            for (const cand of bidsDesc) {
                              const buyer = await runGet<any>(db, "SELECT budget FROM teams WHERE id=?", [cand.teamId]);
                              if (buyer && (buyer.budget || 0) >= cand.amount) { winner = cand; break; }
                            }
                            if (!winner) { await closeUnsold(); return; }
                            const player = await runGet<any>(db, "SELECT p.*, COALESCE(t.name, '?') as team_name FROM players p LEFT JOIN teams t ON p.team_id = t.id WHERE p.id=?", [pid]);
                            if (!player) { delete (game.auctions as any)[pid]; delete (game.auctionTimers as any)[pid]; return; }
                            if (isContractLocked(player, game as any)) { await closeUnsold(); return; }
                            const buyerTeamId = winner.teamId;
                            const finalBid = winner.amount;
                            await runExec(db, "BEGIN");
                            try {
                              await runExec(db, "UPDATE teams SET budget = budget + ? WHERE id = ?", [finalBid, auc.sellerTeamId]);
                              await runExec(db, "UPDATE teams SET budget = budget - ? WHERE id = ?", [finalBid, buyerTeamId]);
                              const seasonEndMw = getSeasonEndMatchweek(game.matchweek || 1);
                              await runExec(
                                db,
                                "UPDATE players SET team_id=?, wage=?, contract_until_matchweek=?, contract_start_epoch=?, joined_matchweek=?, transfer_cooldown_until_matchweek=?, morale = MIN(50, morale + 8), transfer_status='none', transfer_price=0, contract_request_pending=0, contract_requested_wage=0, contract_request_is_renegotiation=0 WHERE id=?",
                                [buyerTeamId, signingWage(player), seasonEndMw, currentEpoch(game as any), game.matchweek, game.matchweek, pid],
                              );
                              await runExec(db, "COMMIT");
                            } catch (txErr) {
                              await runExec(db, "ROLLBACK").catch(() => {});
                              console.error(`[${roomCode}] ❌ finalizeAuction (crash-recovery): transação falhou, leilão fechado sem venda`, txErr);
                              await closeUnsold();
                              return;
                            }
                            const buyerTeam = await runGet<any>(db, "SELECT name FROM teams WHERE id=?", [buyerTeamId]);
                            pushRecent(player, { playerId: pid, playerName: player.name, sold: true, buyerTeamId, buyerTeamName: buyerTeam?.name ?? "?", finalBid });
                          })().catch((err) => {
                            console.error(`[${roomCode}] ❌ finalizeAuction (crash-recovery):`, err);
                          }),
                          );
                        }, timerMs) as unknown as any;
                        // unref para não bloquear shutdown
                        if (tid && typeof (tid as any).unref === "function") (tid as any).unref();
                        (game.auctionTimers as any)[pid] = tid;
                      }
                      restoredAuctionIds.push(pid);
                    }
                    console.log(
                      `[gameManager] ${parsed.length} leilão(ões) restaurado(s) (room ${roomCode}) — ${restoredAuctionIds.length} ids`,
                    );
                  }
                } catch (_) {}
              }

              // ── Limpar leilões órfãos + carregar mercado numa única query ─────────
              const placeholders = restoredAuctionIds.length > 0
                ? `AND id NOT IN (${restoredAuctionIds.map(() => "?").join(",")})`
                : "";
              db.run(
                `UPDATE players SET transfer_status = 'none', transfer_price = 0 WHERE transfer_status = 'auction' ${placeholders}`,
                restoredAuctionIds,
                () => {
                  db.all(
                    "SELECT p.*, COALESCE(t.name, 'Sem clube') as team_name FROM players p LEFT JOIN teams t ON p.team_id = t.id WHERE p.team_id IS NOT NULL AND p.transfer_status != 'none'",
                    (err8, cleanedRows) => {
                      if (!err8 && cleanedRows)
                        game.globalMarket = cleanedRows;
                      // Deriva o conjunto de coaches humanos (is_human=1) que têm
                      // equipa: é a fonte de verdade para o bloqueio de presença.
                      // Salas com 2+ humanos ficam bloqueadas até TODOS estarem online,
                      // mesmo depois de reinícios do servidor (regenera-se a partir da DB).
                      db.all(
                        "SELECT m.name FROM managers m JOIN teams t ON t.manager_id = m.id WHERE m.is_human = 1",
                        (err9, humanRows) => {
                          const names = ((humanRows || []) as any[]).map(
                            (r) => r?.name,
                          );
                          game.lockedCoaches = new Set(
                            names.filter(Boolean) as string[],
                          );
                          if (game.lockedCoaches.size > 0) {
                            console.log(
                              `[gameManager] Room ${roomCode} requires presence of ${game.lockedCoaches.size} human coach(es): ${[...game.lockedCoaches].join(", ")}`,
                            );
                          }
                          // Assentos + numeração de eventos: carregar antes de
                          // marcar inicializado — o primeiro join precisa dos
                          // assentos para saber quem falta.
                          loadEventSeq(game, () => {
                            // Eventos posteriores ao último snapshot (janela de
                            // crash) são reaplicados antes de projetar assentos.
                            replayEventsSince(game, game.snapshotSeq, () => {
                              loadSeats(game, () => {
                                backfillSeats(game, () => {
                                  // Quebra a meio do jogo volta SEMPRE ao lobby do
                                  // slot (corre DEPOIS do replay de eventos, que
                                  // pode ter reposto uma fase de jogo): o jogo
                                  // parado é descartado e rejoga-se do minuto 0
                                  // — sem retoma no minuto, sem tática gravada.
                                  // Exceção: slot já finalizado, que o ramo lobby
                                  // do `checkAllReady` avança em vez de rejogar.
                                  const ph: string = game.gamePhase;
                                  if (
                                    ph === "match_first_half" ||
                                    ph === "match_halftime" ||
                                    ph === "match_second_half" ||
                                    ph === "match_et_gate" ||
                                    ph === "match_extra_time" ||
                                    ph === "match_finalizing"
                                  ) {
                                    console.log(
                                      `[${roomCode}] ⏮ Quebra a meio do jogo: fase=${ph} → lobby do slot ${game.calendarIndex} (jogo descartado, sem tática)`,
                                    );
                                    game.gamePhase = "lobby";
                                    game.liveMinute = null;
                                    game.currentFixtures = [];
                                    game.cupHalftimePayload = null;
                                    game.lastHalftimePayload = null;
                                    resetAllReady(game);
                                    clearSeatPositions(game);
                                    saveGameState(game);
                                  } else if (game.gamePhase === "lobby") {
                                    // Pronto pré-crash não vale em lobby: o
                                    // treinador reconfirma-o com um clique.
                                    resetAllReady(game);
                                  }
                                  // Depois do backfill: o log tem de dizer quantos
                                  // assentos a sala tem (dizia 0 e logo 2).
                                  console.log(
                                    `[${roomCode}] 🪑 ${Object.keys(game.seats).length} assento(s) | eventSeq=${game.eventSeq}`,
                                  );
                                  game.initialized = true;
                                  if (onReady) onReady(game);
                                });
                              });
                            });
                          });
                        },
                      );
                    },
                  );
                },
              );
            },
          );
        };

        loadPersistedState();

  return game;
}

function saveGameState(game: ActiveGame): void {
  // Sala apagada: a BD está fechada; ignorar em silêncio (evita a inundação
  // SQLITE_MISUSE de segmentos fantasmas ainda a terminar).
  if (game.purged) return;
  console.log(
    `[${game.roomCode}] 💾 saveGameState | phase=${game.gamePhase} | calIdx=${game.calendarIndex} | mw=${game.matchweek} | season=${game.season}`,
  );
  const upsert = (key: string, value: string) => {
    game.db.run(
      "INSERT OR REPLACE INTO game_state (key, value) VALUES (?, ?)",
      [key, value],
      (err) => {
        if (err) console.error(`[gameManager] Error saving ${key}:`, err);
      },
    );
  };

  // ── New keys ──────────────────────────────────────────────────────────────
  upsert("calendarIndex", String(game.calendarIndex));
  upsert("calendarVersion", "2");
  upsert(
    "contractCutoverSeason",
    game.contractCutoverSeason != null ? String(game.contractCutoverSeason) : "null",
  );
  upsert("gamePhase", game.gamePhase);
  // Sequência do último snapshot: o log de eventos serve para re-sincronizar o
  // cliente (seq) e para auditoria; a projeção do snapshot continua a mandar.
  game.snapshotSeq = game.eventSeq || 0;
  upsert("snapshotSeq", String(game.snapshotSeq));
  upsert("season", String(game.season || 1));
  upsert("year", String(game.year || 2026));
  if (game.lastPlayedAt) upsert("lastPlayedAt", String(game.lastPlayedAt));
  upsert("matchweek", String(game.matchweek || 1));
  upsert(
    "liveMinute",
    game.liveMinute != null ? String(game.liveMinute) : "null",
  );
  upsert("cupTeamIds", JSON.stringify(game.cupTeamIds || []));
  upsert(
    "cupHalftimePayload",
    game.cupHalftimePayload ? JSON.stringify(game.cupHalftimePayload) : "null",
  );
  upsert(
    "cupDrawSeenBy",
    JSON.stringify([...(game.cupDrawSeenBy ?? [])]),
  );
  upsert(
    "lastHalftimePayload",
    game.lastHalftimePayload
      ? JSON.stringify(game.lastHalftimePayload)
      : "null",
  );
  // lockedCoaches is intentionally NOT persisted — it is transient state.
  // Coaches re-add themselves as they reconnect (via assignPlayer).
  // See restore path above for the rationale.
  upsert("roomName", (game as any).roomName || "");
  upsert("roomCreator", game.roomCreator || "");
  upsert("msPerMinute", String(game.msPerMinute ?? DEFAULT_MS_PER_MINUTE));
  upsert("pendingJobOffers", JSON.stringify(game.pendingJobOffers || {}));
  upsert(
    "negativeBudgetStreak",
    JSON.stringify(game.negativeBudgetStreak || {}),
  );
  upsert(
    "npcNegativeBudgetStreak",
    JSON.stringify(game.npcNegativeBudgetStreak || {}),
  );
  upsert(
    "boardBudgetWarned",
    JSON.stringify(game.boardBudgetWarned || {}),
  );
  upsert("dismissedCoachSince", JSON.stringify(game.dismissedCoachSince || {}));
  upsert(
    "coachMatchesManaged",
    JSON.stringify(game.coachMatchesManaged || {}),
  );
  upsert(
    "npcMatchesManaged",
    JSON.stringify(game.npcMatchesManaged || {}),
  );
  upsert(
    "dismissalsThisSeason",
    JSON.stringify([...(game.dismissalsThisSeason ?? [])]),
  );
  upsert(
    "kickedCoaches",
    JSON.stringify([...(game.kickedCoaches ?? [])]),
  );
  upsert("fixtureSeeds", JSON.stringify(game.fixtureSeeds || {}));
  upsert("allMatchResults", JSON.stringify(game.allMatchResults || {}));
  upsert(
    "tacticFamiliarity",
    JSON.stringify(game.tacticFamiliarity || {}),
  );

  // Persist pending match actions for crash recovery (only serialisable fields)
  const pendingList = [...(game.pendingMatchActions?.values() ?? [])];
  if (pendingList.length > 0) {
    upsert(
      "pendingMatchAction",
      JSON.stringify(
        pendingList.map((pa) => ({
          actionId: pa.actionId,
          type: pa.type,
          teamId: pa.teamId,
          fallback: pa.fallback ? pa.fallback() : null,
        })),
      ),
    );
  } else {
    upsert("pendingMatchAction", "null");
  }

  // Persist current fixtures for crash recovery (only serialisable fields)
  if (game.currentFixtures && game.currentFixtures.length > 0) {
    const serializableFixtures = game.currentFixtures.map((f) => ({
      homeTeamId: f.homeTeamId,
      awayTeamId: f.awayTeamId,
      homeTeam: f.homeTeam || null,
      awayTeam: f.awayTeam || null,
      finalHomeGoals: f.finalHomeGoals || 0,
      finalAwayGoals: f.finalAwayGoals || 0,
      attendance: f.attendance || 0,
      events: f.events || [],
      homeLineup: f.homeLineup || [],
      awayLineup: f.awayLineup || [],
      _t1: f._t1 || null,
      _t2: f._t2 || null,
    }));
    upsert("currentFixtures", JSON.stringify(serializableFixtures));
  } else {
    upsert("currentFixtures", "[]");
  }

  // Persistir leilões ativos (open + paused) para recuperação após reinício — corrige 3.
  // open: precisa de endsAt para retomar o countdown; paused: precisa de pausedRemainingMs
  const activeAuctions = Object.values(game.auctions || {})
    .filter((a: any) => a.status === "paused" || a.status === "open")
    .map((a: any) => ({
      playerId: a.playerId,
      sellerTeamId: a.sellerTeamId,
      startingPrice: a.startingPrice,
      bids: a.bids || {},
      status: a.status,
      endsAt: a.endsAt ?? null,
      pausedRemainingMs: a.pausedRemainingMs ?? (a.endsAt ? Math.max(0, a.endsAt - Date.now()) : undefined),
      npcRelicitationCount: a.npcRelicitationCount || {},
      isExClub: !!a.isExClub,
    }));
  // compat: antigos restores liam só pausedAuctions
  const legacyPaused = activeAuctions.filter((a: any) => a.status === "paused");
  upsert("pausedAuctions", JSON.stringify(legacyPaused));
  upsert("activeAuctions", JSON.stringify(activeAuctions));
  // Leilões concluídos ("Recentes"): expiram 2 jornadas após o fecho
  const mw = game.matchweek || 0;
  const recentAuctions = (((game as any).recentAuctions as any[]) || []).filter(
    (r: any) => r && mw - (r.closedMatchweek ?? mw) <= 2,
  );
  (game as any).recentAuctions = recentAuctions;
  upsert("recentAuctions", JSON.stringify(recentAuctions.slice(-100)));

  // ── Legacy keys (backward compat — kept so old clients/DBs still work) ──
  // Derive legacy values from new state
  const legacyMatchState = (() => {
    switch (game.gamePhase) {
      case "match_first_half":
        return "running_first_half";
      case "match_halftime":
        return "halftime";
      case "match_second_half":
        return "playing_second_half";
      default:
        return "idle";
    }
  })();
  const cupEntry = game.currentEvent?.type === "cup" ? game.currentEvent : null;
  const legacyCupRound = cupEntry ? cupEntry.round : 0;
  const legacyCupState = (() => {
    if (!cupEntry) return "idle";
    switch (game.gamePhase) {
      case "match_first_half":
        return "playing_first_half";
      case "match_halftime":
        return "halftime";
      case "match_second_half":
        return "playing_second_half";
      default:
        return "idle";
    }
  })();

  upsert("matchState", legacyMatchState);
  upsert("cupRound", String(legacyCupRound));
  upsert("cupState", legacyCupState);
}

function getPlayerBySocket(
  game: ActiveGame,
  socketId: string,
): PlayerSession | null {
  const name = game.socketToName[socketId];
  return name ? game.playersByName[name] : null;
}

function bindSocket(
  game: ActiveGame,
  name: string,
  socketId: string,
): string | null {
  const existing = game.playersByName[name];
  const oldSocketId =
    existing && existing.socketId && existing.socketId !== socketId
      ? existing.socketId
      : null;
  if (oldSocketId) {
    delete game.socketToName[oldSocketId];
    delete socketRoomIndex[oldSocketId];
  }
  if (game.playersByName[name]) {
    game.playersByName[name].socketId = socketId;
  }
  game.socketToName[socketId] = name;
  socketRoomIndex[socketId] = game.roomCode;
  // Lease de presença renovado no bind. O assento (epoch/deviceId) é reclamado
  // pelo chamador (assignPlayer), que é quem conhece o deviceId do cliente.
  markSeatSeen(game, name);
  return oldSocketId;
}

function unbindSocket(game: ActiveGame, socketId: string): void {
  const name = game.socketToName[socketId];
  if (name && game.playersByName[name]) {
    game.playersByName[name].socketId = null;
  }
  delete game.socketToName[socketId];
  delete socketRoomIndex[socketId];
  // NOTA: o assento NÃO é libertado aqui — equipa, ready e tática continuam a
  // ser dele. Só `leaveRoom`/kick/despedimento/libertamento pelo admin o
  // removem. A presença cai porque o lease (seatSeenAt) deixa de ser renovado.
  if (name) {
    // O lease começa na queda (não no último pacote): quem via o jogo sem
    // clicar há >90 s não pode ficar ausente no próprio instante da queda.
    markSeatSeen(game, name);
    const seat = seatOf(game, name);
    seat.lastSeenAt = Date.now();
    persistSeat(game, seat);
  }
}

function getGameBySocket(socketId: string): ActiveGame | null {
  // O(1) lookup via índice global em vez de iterar todos os rooms
  const roomCode = socketRoomIndex[socketId];
  if (roomCode && activeGames[roomCode]) {
    return activeGames[roomCode];
  }
  // Fallback: varredura linear (socket ligado antes de bindSocket ser chamado)
  for (const roomCode in activeGames) {
    if (activeGames[roomCode].socketToName[socketId]) {
      return activeGames[roomCode];
    }
  }
  return null;
}

function getPlayerList(game: ActiveGame): PlayerSession[] {
  return Object.values(game.playersByName).filter((p) => p.socketId !== null);
}

/**
 * Emite playerListUpdate + awaitingCoaches + roomRoster de forma atómica.
 * Usar em vez de emitir os eventos separadamente para garantir
 * que o cliente recebe sempre os estados sincronizados. O roomRoster é a
 * lista completa de registados (online + offline, com equipa e estado) —
 * é ele que o RoomHub renderiza.
 */
function emitPresence(game: ActiveGame, io: any): void {
  io.to(game.roomCode).emit("playerListUpdate", {
    // Mesma definição de presença do roster: socket ligado OU lease dentro da
    // grace (um bloqueio de ecrã não faz da equipa um NPC nas outras vistas).
    players: Object.values(game.playersByName).filter(
      (p) => p.socketId || isSeatPresent(game, p.name),
    ),
    roomCreator: game.roomCreator || "",
  });
  io.to(game.roomCode).emit("awaitingCoaches", getOfflineCoaches(game));
  io.to(game.roomCode).emit("roomRoster", getRoomRoster(game));
}

// Persiste o estado in-flight de todas as salas ativas (jogo, fase,
// fixtures, minute, etc.) na base de dados. Usado no graceful shutdown e em
// erros fatais para que um restart do processo nunca perca progresso.
function flushAllGameStates(): void {
  for (const game of Object.values(activeGames)) {
    try {
      saveGameState(game);
    } catch (err: any) {
      console.error(
        `[gameManager] flush ${game.roomCode} failed:`,
        err?.message,
      );
    }
  }
}

function closeAllDatabases(): Promise<void> {
  const closes = Object.values(activeGames).map(
    (game) =>
      new Promise<void>((resolve) => {
        try {
          game.db.close((err: Error | null) => {
            if (err)
              console.error("[gameManager] DB close error:", err.message);
            resolve();
          });
        } catch (err) {
          console.error("[gameManager] DB close threw:", err);
          resolve();
        }
      }),
  );
  return Promise.all(closes).then(() => undefined);
}

/**
 * Fecha uma sala em memória (usado quando a sala é apagada em /saves).
 *
 * Sem isto o objeto continuava em `activeGames` depois de o ficheiro ser
 * apagado: os timers da semana/leilões continuavam a correr, `saveGameState`
 * escrevia para um inode já desligado e `generateUniqueRoomCode` (que só olha
 * a ficheiros) podia devolver o mesmo código e receber a sala antiga de
 * memória em vez de uma nova.
 */
function purgeGame(roomCode: string): boolean {
  const game = activeGames[roomCode];
  if (!game) return false;
  // Sala morta primeiro: antes de acordar os pauseWaiters — um segmento
  // congelado acorda e aborta no próximo tick em vez de correr fantasma
  // até ao fim na BD já fechada (SQLITE_MISUSE).
  game.purged = true;
  game.gamePhase = "lobby";
  if (game.phaseTimer) {
    clearTimeout(game.phaseTimer);
    game.phaseTimer = null;
  }
  for (const action of game.pendingMatchActions?.values?.() ?? []) {
    if (action?.timer) clearTimeout(action.timer);
  }
  game.pendingMatchActions?.clear?.();
  for (const resolve of [...(game.pauseWaiters || [])]) resolve();
  game.pauseWaiters = new Set();
  game.pausedSince = null;
  for (const [socketId, code] of Object.entries(socketRoomIndex)) {
    if (code === roomCode) delete socketRoomIndex[socketId];
  }
  delete activeGames[roomCode];
  try {
    game.db.close(() => {});
  } catch (err: any) {
    console.warn(`[gameManager] purge ${roomCode}: DB close falhou:`, err?.message);
  }
  console.log(`[gameManager] 🗑 Sala ${roomCode} fechada em memória`);
  return true;
}

module.exports = {
  getGame,
  purgeGame,
  getGameBySocket,
  saveGameState,
  getPlayerBySocket,
  bindSocket,
  unbindSocket,
  getPlayerList,
  emitPresence,
  activeGames,
  doesGameExist,
  generateUniqueRoomCode,
  closeAllDatabases,
  flushAllGameStates,
};
