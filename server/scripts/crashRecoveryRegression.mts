/**
 * Regression E2E — idempotência de crash/restart (tabela `applied_weeks`).
 *
 * Clona uma sala real para um quarto descartável (`game_CRASHT.db`), carrega-a com
 * o caminho de produção (`getGame`) e exercita as AÇÕES reais de recuperação,
 * reconstruindo em disco o estado de "crash" que cada proteção cobre:
 *
 *  S1 — applyWeeklyFinancesOnce (P0-1): cobrança única por (season, slot).
 *       Após aplicar + "morrer" o processo e recarregar a sala, uma nova aplicação
 *       do mesmo slot NÃO pode re-cobrir rendimentos/salários nem duplicar journal.
 *  S2 — recoverFinalizedSlot · liga (P0-2): slot com marcador 'finalized' já
 *       commitado → recovery avança o calendário SEM re-simular/re-cobrar.
 *  S3 — recoverFinalizedSlot · Taça (P1-2): idem para um slot de taça — e sem
 *       tocar no matchweek da liga.
 *  S4 — checkAllReady (entrypoint real): com o mesmo estado de crash, o dispatch
 *       de produção escolhe a recovery (marcador presente) em vez de replay.
 *
 * Run: cd server && npm run test:crash-recovery
 * Env opcional: CRASHTEST_ROOM=XXXX  (fonte da cópia; default = primeira game_*.db)
 */
import sqlite3 from "sqlite3";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dbDir = path.join(scriptDir, "..", "db");

const TEST_ROOM = "CRASHT"; // código reservado ao teste — nunca usar numa sala real
const dstPath = path.join(dbDir, `game_${TEST_ROOM}.db`);

const { getGame, saveGameState, activeGames } = require("../gameManager") as any;
const { generateFixturesForDivision, applyPostMatchQualityEvolution } =
  require("../game/engine") as any;
const { SEASON_CALENDAR, LOAN_WEEKLY_INSTALLMENT } = require("../gameConstants") as any;

// Espelho de applyWeeklyFinancesOnce (weeklyFlowHelpers.ts): o delta da 1ª
// aplicação deve bater EXATAMENTE com esta fórmula — se derivar no server, o
// teste falha.
const WEEKLY_BASE_INCOME_SQL = `CASE division
  WHEN 1 THEN 80000 WHEN 2 THEN 50000 WHEN 3 THEN 35000
  WHEN 4 THEN 25000 WHEN 5 THEN 12000 ELSE 0 END`;
const expectedWeeklyDelta = () =>
  rawGet(
    dstPath,
    `SELECT SUM(
       ${WEEKLY_BASE_INCOME_SQL}
       - CAST((loan_amount * 0.015) AS INTEGER)
       - (SELECT COALESCE(SUM(wage), 0) FROM players WHERE players.team_id = teams.id)
       - MIN(${LOAN_WEEKLY_INSTALLMENT}, loan_amount)
     ) AS delta FROM teams`,
  ).then((r) => r[0]?.delta ?? 0);
const { createWeeklyFlowHelpers } = require("../weeklyFlowHelpers") as any;

// ── helpers de disco (conexões curtas e frescas — leem o que um restart veria) ──
function rawGet(
  dbPath: string,
  sql: string,
  params: unknown[] = [],
): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err?: Error) => {
      if (err) return reject(err);
      db.all(sql, params as any[], (e2: Error | null, rows: any[]) => {
        db.close(() => (e2 ? reject(e2) : resolve(rows)));
      });
    });
  });
}

function rawExec(dbPath: string, sql: string, params: unknown[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err?: Error) => {
      if (err) return reject(err);
      db.run(sql, params as any[], (e2: Error | null) => {
        db.close(() => (e2 ? reject(e2) : resolve()));
      });
    });
  });
}

const kvGet = (key: string) =>
  rawGet(dstPath, "SELECT value FROM game_state WHERE key = ?", [key]).then(
    (r) => r[0]?.value ?? null,
  );
const kvSet = (key: string, value: string) =>
  rawExec(
    dstPath,
    `INSERT INTO game_state (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
const sumBudget = async () =>
  ((await rawGet(dstPath, "SELECT COALESCE(SUM(budget),0) AS s FROM teams"))[0]?.s ??
    0);
const newsCount = async (type: string) =>
  (await rawGet(dstPath, "SELECT COUNT(*) AS n FROM club_news WHERE type = ?", [type]))[0]
    ?.n ?? 0;
const markerRows = async (season: number, slot: number, kind: string) =>
  (
    await rawGet(
      dstPath,
      `SELECT COUNT(*) AS n FROM applied_weeks WHERE season = ? AND slot = ? AND kind = ?`,
      [season, slot, kind],
    )
  )[0]?.n ?? 0;

async function waitForKv(key: string, want: string, timeoutMs = 3000): Promise<boolean> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if ((await kvGet(key)) === want) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return (await kvGet(key)) === want;
}

let failures = 0;
function ok(cond: boolean, msg: string): void {
  if (!cond) {
    failures += 1;
    console.error(`FAIL — ${msg}`);
  } else {
    console.log(`ok   — ${msg}`);
  }
}

// ── carga/fecho da sala via caminho de produção ───────────────────────────────
function loadRoom(): Promise<any> {
  return new Promise((resolve, reject) => {
    const g = getGame(TEST_ROOM, (ready: any, err?: Error) =>
      err ? reject(err) : resolve(ready),
    );
    if (!g)
      reject(new Error("getGame devolveu null — existe db/base.db semeado?"));
  });
}

function closeRoom(game: any): Promise<void> {
  return new Promise((resolve) => {
    try {
      if (game.phaseTimer) clearTimeout(game.phaseTimer);
      for (const t of game.pendingAuctionQueueTimers ?? []) clearTimeout(t as any);
    } catch {
      /* timers irrelevantes */
    }
    delete activeGames[TEST_ROOM]; // força getGame a re-hidratar do disco
    game.db.close(() => resolve());
  });
}

// ── deps do factory: reais onde a semântica conta, sentinelas onde não pode correr ─
function buildHelpers(): any {
  const noop = () => {};
  const mustNotRun = (name: string) => () => {
    throw new Error(`${name} foi chamado — inesperado no teste de crash-recovery`);
  };
  return createWeeklyFlowHelpers({
    io: { to: () => ({ emit: noop }) },
    getPlayerList: (g: any) => Object.values(g.playersByName ?? {}),
    emitPresence: noop,
    generateFixturesForDivision, // real — prepareLeagueFixtures na recovery
    pauseAllRunningAuctions: noop,
    resumeAllPausedAuctions: noop,
    simulateMatchSegment: mustNotRun("simulateMatchSegment"),
    calculateMatchAttendance: () => 0,
    pickRefereeSummary: () => null,
    saveGameState, // real — a recovery persiste via este caminho
    persistMatchResults: mustNotRun("persistMatchResults"),
    applyPostMatchQualityEvolution,
    applyTrainingBonuses: noop,
    startCupRound: mustNotRun("startCupRound"),
    finalizeCupRound: mustNotRun("finalizeCupRound"),
    continueFromEtGate: mustNotRun("continueFromEtGate"),
    applySeasonEnd: mustNotRun("applySeasonEnd"),
    listPlayerOnMarket: noop,
    processContractExpiries: noop,
    processAgentRenegotiations: noop,
    resendPendingContractRequests: noop,
    processNpcTransferActivity: noop,
    refreshMarket: mustNotRun("refreshMarket"),
    processCoachEvents: noop,
  });
}

async function main(): Promise<void> {
  // ── preparação: snapshot WAL-safe de uma sala real para o quarto de teste ──
  const srcName =
    process.env.CRASHTEST_ROOM ||
    fs
      .readdirSync(dbDir)
      .find((f) => f.startsWith("game_") && f.endsWith(".db"));
  if (!srcName) {
    console.warn(`⚠ Sem game_*.db em ${dbDir} — nada para clonar. Skip.`);
    return;
  }
  const srcPath = path.join(dbDir, srcName);
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(dstPath + suffix, { force: true });
  await rawExec(srcPath, `VACUUM INTO '${dstPath}'`);

  const season = parseInt((await kvGet("season")) || "1", 10);
  const teamsN = (await rawGet(dstPath, "SELECT COUNT(*) AS n FROM teams"))[0]?.n ?? 0;
  console.log(
    `Crash-recovery E2E | fonte=${srcName} → game_${TEST_ROOM}.db | season=${season} | ${teamsN} equipas\n`,
  );

  const helpers = buildHelpers();
  let game: any;

  try {
    // ── S1 — finanças semanais: cobrança única, sem replay após restart ────────
    console.log("S1 · applyWeeklyFinancesOnce (idempotência weekly_finance)");
    ok(SEASON_CALENDAR[2].type === "league", "setup: slot 2 é de liga");
    await kvSet("calendarIndex", "2");
    await kvSet("gamePhase", "lobby");
    await rawExec(
      dstPath,
      `CREATE TABLE IF NOT EXISTS applied_weeks (
         season INTEGER NOT NULL, slot INTEGER NOT NULL, kind TEXT NOT NULL,
         PRIMARY KEY (season, slot, kind)
       )`,
    );
    await rawExec(
      dstPath,
      `DELETE FROM applied_weeks WHERE season = ? AND slot = 2 AND kind = 'weekly_finance'`,
      [season],
    );

    game = await loadRoom();
    ok(game.calendarIndex === 2, "sala carrega em calendarIndex=2");
    const B0 = await sumBudget();
    const news0 = await newsCount("weekly_income");
    const expDelta = await expectedWeeklyDelta();
    const r1 = await helpers.applyWeeklyFinancesOnce(game);
    ok(r1 === true, "1ª aplicação devolve true");
    const B1 = await sumBudget();
    ok(
      B1 - B0 === expDelta,
      `finanças exatas de 1 semana (Δ esperado ${expDelta}, obtido ${B1 - B0})`,
    );
    ok(
      (await newsCount("weekly_income")) - news0 === teamsN,
      "journal: exatamente 1 linha 'weekly_income' por equipa",
    );
    ok(
      (await markerRows(season, 2, "weekly_finance")) === 1,
      "marcador weekly_finance presente (1 linha)",
    );

    await closeRoom(game); // ← processo "morre" aqui
    game = await loadRoom(); // ← restart: hidratação fresca do disco
    const r2 = await helpers.applyWeeklyFinancesOnce(game);
    ok(r2 === true, "reaplicação após restart devolve true (no-op)");
    ok((await sumBudget()) === B1, "SEM re-cobrança de rendimentos/salários");
    ok(
      (await newsCount("weekly_income")) === news0 + teamsN,
      "sem linhas de journal duplicadas",
    );
    ok(
      (await markerRows(season, 2, "weekly_finance")) === 1,
      "marcador único mantido",
    );

    // ── S2 — slot de liga já finalizado: avançar, nunca re-simular ────────────
    console.log("\nS2 · recoverFinalizedSlot (liga)");
    await closeRoom(game);
    const entryL = SEASON_CALENDAR[4] as any; // liga MW5
    ok(entryL.type === "league", "setup: slot 4 é de liga");
    await kvSet("calendarIndex", "4");
    await kvSet("gamePhase", "lobby");
    await rawExec(
      dstPath,
      `INSERT OR IGNORE INTO applied_weeks (season, slot, kind) VALUES (?, 4, 'finalized')`,
      [season],
    );
    const mwL = entryL.matchweek;
    const matchesN0 = (
      await rawGet(dstPath, "SELECT COUNT(*) AS n FROM matches WHERE season = ? AND matchweek = ?", [
        season,
        mwL,
      ])
    )[0]?.n ?? 0;
    const Bpre2 = await sumBudget();

    game = await loadRoom();
    ok(
      game.calendarIndex === 4 && game.currentEvent?.type === "league",
      "sala carrega no slot finalizado (crash antes de avançar)",
    );
    const mwMem0 = game.matchweek;
    helpers.recoverFinalizedSlot(game, entryL);
    ok(game.calendarIndex === 5, "memória: calendarIndex 4 → 5");
    ok(game.matchweek === mwMem0 + 1, `memória: matchweek ${mwMem0} → ${mwMem0 + 1}`);
    ok(
      await waitForKv("calendarIndex", "5"),
      "disco: calendarIndex persistido = 5 (visível por um restart)",
    );
    ok((await sumBudget()) === Bpre2, "SEM re-cobrança de bilheteira/rendimentos");
    const matchesN1 = (
      await rawGet(dstPath, "SELECT COUNT(*) AS n FROM matches WHERE season = ? AND matchweek = ?", [
        season,
        mwL,
      ])
    )[0]?.n ?? 0;
    ok(matchesN1 === matchesN0, `SEM re-simulação (${matchesN0} linhas de jogos intactas)`);

    // ── S3 — slot de taça já finalizado: idem, sem mexer na liga ──────────────
    console.log("\nS3 · recoverFinalizedSlot (Taça)");
    await closeRoom(game);
    const entryC = SEASON_CALENDAR[3] as any; // Taça R1
    ok(entryC.type === "cup", "setup: slot 3 é de taça");
    await kvSet("calendarIndex", "3");
    await kvSet("gamePhase", "lobby");
    await rawExec(
      dstPath,
      `INSERT OR IGNORE INTO applied_weeks (season, slot, kind) VALUES (?, 3, 'finalized')`,
      [season],
    );
    const Bpre3 = await sumBudget();

    game = await loadRoom();
    ok(
      game.calendarIndex === 3 && game.currentEvent?.type === "cup",
      "sala carrega no slot de taça finalizado (crash antes de avançar)",
    );
    const mwMem1 = game.matchweek;
    helpers.recoverFinalizedSlot(game, entryC);
    ok(game.calendarIndex === 4, "memória: calendarIndex 3 → 4");
    ok(
      game.matchweek === mwMem1,
      "matchweek da liga NÃO incrementado por round de taça",
    );
    ok(await waitForKv("calendarIndex", "4"), "disco: calendarIndex persistido = 4");
    ok((await sumBudget()) === Bpre3, "SEM re-cobrança (palmarés/verba intactos)");

    // ── S4 — entrypoint real: checkAllReady escolhe recovery com marcador ─────
    console.log("\nS4 · checkAllReady (dispatch de produção)");
    await closeRoom(game);
    await kvSet("calendarIndex", "3");
    await kvSet("gamePhase", "lobby");
    // Preferir os coaches humanos reais da sala (lockedCoaches é re-derivado
    // do DB na carga); senão, injetar 2 sessões de teste qualquer.
    game = await loadRoom();
    let coaches = [...game.lockedCoaches].slice(0, 2);
    if (coaches.length < 2) {
      coaches = (
        await rawGet(dstPath, "SELECT name FROM players WHERE team_id IS NOT NULL LIMIT 2")
      ).map((r) => r.name);
    }
    ok(coaches.length === 2, "setup: 2 coaches para o lobby");
    for (const name of coaches) {
      const p = game.playersByName[name];
      if (p) {
        p.socketId = `test-${name}`;
        p.ready = true;
      } else {
        game.playersByName[name] = { name, socketId: `test-${name}`, ready: true, teamId: 1 } as any;
      }
    }
    game.lockedCoaches = new Set(coaches);
    const Bpre4 = await sumBudget();

    await helpers.checkAllReady(game);
    ok(
      await waitForKv("calendarIndex", "4"),
      "dispatch escolheu recovery (calendário avançou p/ 4, sem replay)",
    );
    ok((await sumBudget()) === Bpre4, "SEM re-cobrança via entrypoint real");
    ok(game.gamePhase === "lobby", "fase volta a lobby após recovery");
  } finally {
    if (activeGames[TEST_ROOM]) {
      await closeRoom(activeGames[TEST_ROOM]);
    }
    for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(dstPath + suffix, { force: true });
  }

  console.log(
    failures === 0
      ? `\n✅ crash-recovery E2E: todos os cenários passaram`
      : `\n❌ ${failures} verificação(ões) falharam`,
  );
  if (failures > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("ERRO no harness:", err);
  process.exitCode = 1;
});
