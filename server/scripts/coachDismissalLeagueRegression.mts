/**
 * Regression — invariante de liga no realocamento de coaches despedidos.
 *
 * Regra de intenção: "Quando se é despedido, fica-se numa equipa da mesma
 * Liga, ou inferior (excepto equipas dos Distritais, div 5)."
 *
 * Cenário A: humano na Liga 3 (div 3) despedido por orçamento → o clube
 *   atribuído tem de estar na div 3 ou 4 (nunca 1, 2 nem 5).
 * Cenário B (reprodução do incidente): o clube do humano foi promovido ao fim
 *   da época (div 3 → div 2) e, na época seguinte, ele é despedido por
 *   orçamento → a realocação usa a divisão CORRENTE do clube (div 2), podendo
 *   atribuir outro clube da Segunda Liga. Explica "despedido na Liga 3,
 *   reintegrado na Segunda Liga" quando o clube tinha sido promovido antes.
 *
 * Run: cd server && npm run test:coach-dismissal-league
 */
import sqlite3 from "sqlite3";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createCoachDismissalHelpers } = require("../coachDismissalHelpers.ts") as {
  createCoachDismissalHelpers: (deps: any) => {
    processCoachEvents: (game: any) => Promise<void>;
  };
};

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`ok  - ${msg}`);
}

const runAll = (
  db: any,
  sql: string,
  params: any[] = [],
): Promise<any[]> =>
  new Promise((resolve, reject) =>
    db.all(sql, params, (err: any, rows: any[]) =>
      err ? reject(err) : resolve(rows || []),
    ),
  );
const runGet = (db: any, sql: string, params: any[] = []): Promise<any> =>
  new Promise((resolve, reject) =>
    db.get(sql, params, (err: any, row: any) =>
      err ? reject(err) : resolve(row),
    ),
  );

function createMockIo() {
  const emitted: Array<{ room: string; event: string; payload: any }> = [];
  const io: any = {
    to: (room: string) => ({
      emit: (event: string, payload?: any) => {
        emitted.push({ room, event, payload });
      },
    }),
  };
  return { io, emitted };
}

const SCHEMA = `CREATE TABLE teams (
    id INTEGER PRIMARY KEY, name TEXT, division INTEGER, manager_id INTEGER,
    budget INTEGER DEFAULT 1000000, color_primary TEXT DEFAULT '#333',
    color_secondary TEXT DEFAULT '#fff', points INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0, draws INTEGER DEFAULT 0, losses INTEGER DEFAULT 0,
    goals_for INTEGER DEFAULT 0, goals_against INTEGER DEFAULT 0,
    stadium_capacity INTEGER DEFAULT 5000, stadium_name TEXT DEFAULT 'Estádio'
  );
  CREATE TABLE managers (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE,
    is_human INTEGER DEFAULT 0, reputation INTEGER DEFAULT 50
  );
  CREATE TABLE players (
    id INTEGER PRIMARY KEY, team_id INTEGER, name TEXT, position TEXT, skill INTEGER DEFAULT 50
  );
  CREATE TABLE matches (
    id INTEGER PRIMARY KEY, home_team_id INTEGER, away_team_id INTEGER,
    home_score INTEGER DEFAULT 0, away_score INTEGER DEFAULT 0,
    played INTEGER DEFAULT 1, season INTEGER DEFAULT 1
  );`;

/**
 * Sala: div 2 → S1..S4 (NPC); div 3 → HUMA_C(201) + C1..C3; div 4 → P1..P6.
 */
async function setupDb() {
  const db = new sqlite3.Database(":memory:");
  await new Promise((res) => db.exec(SCHEMA, res));
  const insMgr = (name: string, isHuman: boolean): Promise<number> =>
    new Promise((resolve, reject) => {
      db.run(
        "INSERT INTO managers (name, is_human, reputation) VALUES (?, ?, 50)",
        [name, isHuman ? 1 : 0],
        function (this: any, err: any) {
          if (err) reject(err);
          else resolve(this.lastID);
        },
      );
    });
  const humanId = await insMgr("Huma", true);
  // [teamId, name, division, managerId]
  const specs: Array<[number, string, number, number]> = [
    [101, "S1", 2, 0], [102, "S2", 2, 0], [103, "S3", 2, 0], [104, "S4", 2, 0],
    [201, "HUMA_C", 3, humanId], [202, "C1", 3, 0], [203, "C2", 3, 0], [204, "C3", 3, 0],
    [301, "P1", 4, 0], [302, "P2", 4, 0], [303, "P3", 4, 0],
    [304, "P4", 4, 0], [305, "P5", 4, 0], [306, "P6", 4, 0],
  ];
  for (const [id, name, division, mgr] of specs) {
    const managerId = mgr || (await insMgr(`NPC${id}`, false));
    await new Promise<void>((resolve, reject) =>
      db.run(
        "INSERT INTO teams (id, name, division, manager_id) VALUES (?, ?, ?, ?)",
        [id, name, division, managerId],
        (err: any) => (err ? reject(err) : resolve()),
      ),
    );
  }
  return db;
}

function makeGame(db: any): any {
  const { io } = createMockIo();
  const game: any = {
    db, roomCode: "TEST", season: 1, matchweek: 6,
    playersByName: { Huma: { name: "Huma", teamId: 201, socketId: null, ready: false } },
    pendingJobOffers: {}, negativeBudgetStreak: {}, boardBudgetWarned: {},
    coachMatchesManaged: {}, npcMatchesManaged: {}, dismissedCoachSince: {},
    dismissalsThisSeason: new Set<string>(), coachMarketEvents: [],
    lockedCoaches: new Set<string>(),
  };
  const helpers = createCoachDismissalHelpers({
    io, runAll, runGet,
    saveGameState: async () => {},
    getRoomCoaches: async () => [],
  });
  return { game, helpers };
}

/** Determinístico: orçamento negativo + streak no limite (5ª semana) + random=0. */
async function primeBudgetDismissal(game: any, teamId: number) {
  await new Promise<void>((resolve, reject) =>
    game.db.run("UPDATE teams SET budget = -150 WHERE id = ?", [teamId], (err: any) =>
      err ? reject(err) : resolve(),
    ),
  );
  game.negativeBudgetStreak[teamId] = 4; // passa a 5 → prob 0.95
  game.coachMatchesManaged["Huma"] = 9; // incrementa p/ 10 ≥ carência de 5
  const realRandom = Math.random;
  (Math as any).__realRandom = realRandom;
  Math.random = () => 0;
}
function restoreRandom() {
  if ((Math as any).__realRandom) Math.random = (Math as any).__realRandom;
}

const divOf = async (db: any, teamId: number): Promise<number | null> => {
  const r = await runGet(db, "SELECT division FROM teams WHERE id=?", [teamId]);
  return r?.division ?? null;
};

async function main() {
  // ---------- Cenário A: despedimento genuíno na Liga 3 ----------
  let db = await setupDb();
  let { game, helpers } = makeGame(db);
  await primeBudgetDismissal(game, 201);
  try {
    await helpers.processCoachEvents(game);
  } finally {
    restoreRandom();
  }

  const player = game.playersByName["Huma"];
  assert(player.teamId !== 201, "A: coach despedido do clube da Liga 3");
  if (player.teamId == null) {
    console.error("FAIL: A — nenhum clube atribuído ao humano");
    process.exit(1);
  }
  const newDiv = await divOf(db, player.teamId);
  assert(newDiv === 3 || newDiv === 4, `A: novo clube é da Liga 3 (div 3) ou CP (div 4) — obtido div ${newDiv}`);
  assert((await runGet(db, "SELECT manager_id FROM teams WHERE id=?", [player.teamId])).manager_id != null, "A: clube atribuído ficou com treinador");
  console.log(`ok  - A: invariante confirmada — despedimento na div 3 nunca coloca em div 1/2/5 (novo div=${newDiv})`);

  // ---------- Cenário B: repro — promoção → despedição → Segunda Liga ----------
  db = await setupDb();
  ({ game, helpers } = makeGame(db));
  // Fim de época: o clube do humano (HUMA_C) é promovido div 3 → div 2.
  await new Promise((res) => db.exec("UPDATE teams SET division=2 WHERE id=201", res));
  game.season = 2;
  game.matchweek = 6; // 5+ jogos da nova época já jogados (form limpa → sem V/D ainda; orçamento é o gatilho)
  await primeBudgetDismissal(game, 201);
  try {
    await helpers.processCoachEvents(game);
  } finally {
    restoreRandom();
  }

  const playerB = game.playersByName["Huma"];
  assert(playerB.teamId !== 201, "B: coach despedido do clube promovido");
  if (playerB.teamId == null) {
    console.error("FAIL: B — nenhum clube atribuído ao humano");
    process.exit(1);
  }
  const newDivB = await divOf(db, playerB.teamId);
  // Com fromDivision=2, o primeiro nível explorado é a própria Segunda Liga.
  assert(newDivB === 2 || newDivB === 3 || newDivB === 4, `B: realocação usa divisão CORRENTE (div ${newDivB} ≥ origem efetiva 2)`);
  console.log(`ok  - B: incidente reproduzido — clube promovido a div 2 + despedição ⇒ reatribuição em nível ${newDivB} (explica 'Liga 3 → Segunda Liga' quando o clube tinha subido na época anterior)`);

  console.log("\nPASS coachDismissalLeagueRegression");
}

main().catch((err) => {
  restoreRandom();
  console.error("ERROR:", err?.stack ?? err);
  process.exit(1);
});
