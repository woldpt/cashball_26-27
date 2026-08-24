/**
 * Regression test — "Ao fim de muitas jornadas o resultado do treino
 * deixa de ser exibido".
 *
 * Reproduces the convergence scenario with the REAL server helpers:
 * a squad trains for 60 matchweeks with a fixed focus and a stable
 * starting XI.  Once every attribute hits its cap/floor (skill →
 * potential, form → 50/130, resistance → 1/5), every row written for
 * the latest matchweek has `new_value == old_value`, which the
 * frontend's groupByPlayer filters out — leaving the report blank.
 *
 * Expected behaviour (the fix): `getTrainingHistory(null)` must return
 * the most recent matchweek that still has at least one real attribute
 * change, so the report always has something meaningful to display.
 *
 * Run: npm run test:training-report
 */
import sqlite3 from "sqlite3";
import { createRequire } from "node:module";

// Load the REAL server helpers via CJS require to avoid tsx ESM/CJS interop
// quirks when importing .ts modules from a .mts script.
const require = createRequire(import.meta.url);
const { createTrainingHelpers } = require("../trainingHelpers.ts") as {
  createTrainingHelpers: (deps: { io: any }) => {
    applyTrainingBonuses: (
      game: any,
      fixtures: any[],
      completedCalendarIndex: number,
    ) => Promise<void>;
  };
};
const { createTrainingHandlers } = require("../socketTrainingHandlers.ts") as {
  createTrainingHandlers: (deps: { io: any }) => {
    getTrainingHistory: (game: any, teamId: number, calendarIndex: number | null) => Promise<any[]>;
  };
};

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`ok  - ${msg}`);
}

async function main() {
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
        team_id INTEGER,
        matchweek INTEGER,
        training_focus TEXT,
        applied INTEGER DEFAULT 0
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

  // Realistic 18-man squad; ids 1..11 are the stable starting XI.
  const positions = ["GR","GR","DEF","DEF","DEF","DEF","MED","MED","MED","MED","ATA","ATA","GR","DEF","MED","ATA","DEF","MED"];
  const baseSkill = [40,42,38,36,34,33,30,29,28,27,26,25,24,22,20,18,16,14];
  const potential =  [45,46,42,40,38,37,35,34,33,32,31,30,29,27,25,23,21,19];
  const form =       [90,88,87,86,85,84,83,82,81,80,79,78,77,76,75,74,73,72];
  for (let i = 0; i < 18; i++) {
    await new Promise((res) =>
      db.run(
        "INSERT INTO players (id, team_id, name, position, skill, form, resistance, potential, training_skill_progress, training_resistance_progress) VALUES (?,1,?,?,?,?,?,?,0,0)",
        [i + 1, "P" + (i + 1), positions[i], baseSkill[i], form[i], 3, potential[i]],
        res,
      ),
    );
  }

  const game: any = {
    db,
    roomCode: "TEST",
    season: 1,
    calendarIndex: 0,
    playersByName: {},
  };

  const { applyTrainingBonuses } = createTrainingHelpers({ io: {} });
  const { getTrainingHistory } = createTrainingHandlers({ io: {} });

  const fixtures = [{ homeLineup: Array.from({ length: 11 }, (_, i) => ({ id: i + 1 })), awayLineup: [] }];
  const FOCUS = "Médios";

  await new Promise((res) =>
    db.run("INSERT INTO team_training (team_id, matchweek, training_focus, applied) VALUES (1, 0, ?, 0)", [FOCUS], res),
  );

  // Simulate 60 matchweeks of training with the same focus and XI.
  for (let mw = 1; mw <= 60; mw++) {
    await new Promise((res) =>
      db.run(
        "INSERT OR IGNORE INTO team_training (team_id, matchweek, training_focus, applied) VALUES (1, ?, ?, 0)",
        [mw, FOCUS],
        res,
      ),
    );
    game.calendarIndex = mw;
    await applyTrainingBonuses(game, fixtures, mw);
  }

  // What the frontend receives on mount: getTrainingHistory(null).
  const history: any[] = await getTrainingHistory(game, 1, null);

  assert(history.length > 0, "history rows exist after 60 matchweeks");

  const hasRealChange = history.some((r) => r.new_value !== r.old_value);
  assert(
    hasRealChange,
    "default history contains at least one real attribute change (report would not be blank)",
  );

  // Mirror the frontend groupByPlayer filter: players with ≥1 visible delta.
  const visiblePlayers = new Set(
    history.filter((r) => r.new_value !== r.old_value).map((r) => r.player_id),
  ).size;
  assert(visiblePlayers > 0, "at least one player would be displayed in the report");

  console.log("\nAll assertions passed.");
  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
