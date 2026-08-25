/**
 * Regression test — estado do treino corrompe em jogos multi-época.
 *
 * Root cause: `team_training.matchweek` e `training_player_history.matchweek`
 * guardam o `game.calendarIndex`, que é 0-based POR ÉPOCA (`applySeasonEnd`
 * faz `game.calendarIndex = 0`). Sem limpeza no fim da época, as linhas da
 * época anterior colidiam com a nova época (mesmo `(team_id, matchweek)`):
 *  - o relatório do treino (`getTrainingHistory`) misturava jogadores e
 *    atributos de épocas diferentes no mesmo índice de jornada,
 *  - o `getTrainingFocus` podia devolver o foco da época anterior,
 *  - o carry-forward do primeiro evento da nova época não encontrava
 *    referência (`matchweek < 0`).
 *
 * Fix: `clearSeasonTrainingState` (chamado em `applySeasonEnd`) apaga
 * `team_training` e `training_player_history` antes de reiniciar o
 * calendarIndex — a nova época começa limpa, igual à época 1.
 *
 * Run: cd server && npm run test:training-multiseason
 */
import sqlite3 from "sqlite3";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createTrainingHelpers } = require("../trainingHelpers.ts") as {
  createTrainingHelpers: (deps: { io: any }) => {
    applyTrainingBonuses: (
      game: any,
      fixtures: any[],
      completedCalendarIndex: number,
    ) => Promise<void>;
    clearSeasonTrainingState: (game: any) => Promise<void>;
  };
};
const { createTrainingHandlers } = require("../socketTrainingHandlers.ts") as {
  createTrainingHandlers: (deps: { io: any }) => {
    getTrainingHistory: (game: any, teamId: number, calendarIndex: number | null) => Promise<any[]>;
    getTrainingFocus: (game: any, teamId: number) => Promise<string | null>;
  };
};

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`ok  - ${msg}`);
}

async function setupDb() {
  const db = new sqlite3.Database(":memory:");
  await new Promise((res) =>
    db.exec(
      `CREATE TABLE players (
        id INTEGER PRIMARY KEY,
        team_id INTEGER,
        name TEXT,
        position TEXT,
        skill INTEGER,
        form INTEGER,
        resistance INTEGER,
        potential INTEGER,
        training_skill_progress REAL DEFAULT 0,
        training_resistance_progress REAL DEFAULT 0,
        value INTEGER DEFAULT 0
      );
      CREATE TABLE team_training (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id INTEGER NOT NULL,
        matchweek INTEGER NOT NULL,
        training_focus TEXT NOT NULL,
        applied INTEGER DEFAULT 0,
        UNIQUE(team_id, matchweek)
      );
      CREATE TABLE training_player_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER,
        team_id INTEGER,
        matchweek INTEGER,
        attribute TEXT,
        old_value REAL,
        new_value REAL,
        delta REAL DEFAULT 0,
        focus TEXT
      );
      CREATE TABLE player_skill_snapshots (
        player_id INTEGER,
        matchweek INTEGER,
        season INTEGER,
        skill INTEGER
      );`,
      res,
    ),
  );

  const positions = ["GR","GR","DEF","DEF","DEF","DEF","MED","MED","MED","MED","ATA","ATA","GR","DEF","MED","ATA","DEF","MED"];
  for (let i = 1; i <= 18; i++) {
    await new Promise((res) =>
      db.run(
        "INSERT INTO players (id, team_id, name, position, skill, form, resistance, potential, training_skill_progress, training_resistance_progress) VALUES (?,1,?,?,?,?,?,?,0,0)",
        [i, "P" + i, positions[i - 1], 40, 90, 3, 45],
        res,
      ),
    );
  }
  return db;
}

function setFocus(db: any, teamId: number, matchweek: number, focus: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(
      "INSERT OR REPLACE INTO team_training (team_id, matchweek, training_focus, applied) VALUES (?, ?, ?, 0)",
      [teamId, matchweek, focus],
      (err: any) => (err ? reject(err) : resolve()),
    );
  });
}

/** Joga `count` eventos consecutivos. Apenas o primeiro recebe foco
 *  explícito (como um jogador que escolhe o foco); os restantes dependem
 *  do carry-forward. */
async function playEvents(
  db: any,
  applyTrainingBonuses: any,
  game: any,
  startIndex: number,
  count: number,
  focus: string,
): Promise<void> {
  const fixtures = [
    { homeLineup: Array.from({ length: 11 }, (_, i) => ({ id: i + 1 })), awayLineup: [] },
  ];
  for (let i = 0; i < count; i++) {
    const idx = startIndex + i;
    if (i === 0) await setFocus(db, 1, idx, focus);
    game.calendarIndex = idx;
    await applyTrainingBonuses(game, fixtures, idx);
  }
}

async function main() {
  const db = await setupDb();
  const { applyTrainingBonuses, clearSeasonTrainingState } = createTrainingHelpers({ io: {} });
  const { getTrainingHistory, getTrainingFocus } = createTrainingHandlers({ io: {} });
  const game: any = { db, roomCode: "TEST", season: 1, calendarIndex: 0, playersByName: {} };

  // ── Época 1: 2 eventos com foco "Forma" ───────────────────────────────────
  await playEvents(db, applyTrainingBonuses, game, 0, 2, "Forma");

  // ── Fim de época 1 → limpeza (o fix em applySeasonEnd) ───────────────────
  await clearSeasonTrainingState(game);
  game.season = 2;

  // 1. Sem foco escolhido na nova época, o foco NÃO pode vir da anterior ────
  game.calendarIndex = 1;
  const focus = await getTrainingFocus(game, 1);
  assert(
    focus === null,
    `época 2 sem foco escolhido → null (obtido ${focus})`,
  );

  // ── Época 2: 2 eventos com foco "Médios" ──────────────────────────────────
  await playEvents(db, applyTrainingBonuses, game, 0, 2, "Médios");

  // 2. Relatório do último treino NÃO pode misturar épocas ──────────────────
  const history: any[] = await getTrainingHistory(game, 1, null);
  assert(history.length > 0, "época 2: existe histórico do último treino");
  assert(
    history.every((r) => r.focus === "Médios" && r.calendar_index === 1),
    `época 2: relatório contém apenas dados da época atual (rows=${history.length}, focos=${[...new Set(history.map((r) => r.focus))].join(",")})`,
  );

  // 3. Treino volta a ser aplicado por recorrência na época 2 ───────────────
  const s2History = await new Promise<any[]>((resolve, reject) => {
    db.all(
      "SELECT matchweek, COUNT(*) c FROM training_player_history WHERE team_id = 1 GROUP BY matchweek ORDER BY matchweek",
      (err, rows) => (err ? reject(err) : resolve(rows || [])),
    );
  });
  const mwsWithHistory = s2History.map((r) => r.matchweek);
  assert(
    mwsWithHistory.length === 2 && mwsWithHistory[0] === 0 && mwsWithHistory[1] === 1,
    `época 2: treino aplicado em todos os eventos via carry-forward (matchweeks=${mwsWithHistory.join(",")})`,
  );

  // 4. team_training limpo — sem linhas órfãs da época anterior ─────────────
  const staleRows = await new Promise<number>((resolve, reject) => {
    db.get(
      "SELECT COUNT(*) c FROM team_training WHERE applied = 0 AND matchweek >= 2",
      (err, row) => (err ? reject(err) : resolve(row.c)),
    );
  });
  assert(staleRows === 0, `sem linhas órfãs de team_training na época 2 (count=${staleRows})`);

  console.log("\nTodos os testes passaram ✔");
  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
