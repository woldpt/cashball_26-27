/**
 * Regression — realocação de coaches humanos despedidos.
 *
 * Regra de intenção: "Quando se é despedido, fica-se numa equipa da mesma
 * Liga, ou inferior (excepto Distritais, div 5) — mas nunca no topo da
 * tabela: procurar entre os últimos 4 classificados dessa divisão."
 *
 * Cenários:
 *  A. Humano na Liga 3 (div 3), médio → despedido por orçamento ⇒ o clube
 *     atribuído pertence aos últimos 4 classificados da div 3 (nunca a um
 *     clube do topo).
 *  B. O clube do humano foi promovido ao fim da época (div 3 → div 2, o coach
 *     fica com o clube) e, na época seguinte, é despedido ⇒ realocação usa a
 *     divisão CORRENTE (div 2), dentro dos últimos 4 dessa divisão. (Explica
 *     o incidente observado "despedido na Liga 3, reintegrado na Segunda":
 *     o clube tinha sido promovido antes.)
 *  D. Últimos 4 da div de origem já ocupados por outros humanos ⇒ desce uma
 *     divisão e continua a escolher apenas entre os últimos 4 (nunca fica
 *     sem clube).
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

// Fixtures com classificação explícita (pontos) para os "últimos 4" serem
// determinísticos e independentes de desempates.
const DIV3_TOP = [
  [210, "TOP", 40],
  [211, "T2", 38],
  [212, "M1", 30],
  [213, "M2", 25],
];
const DIV3_BOTTOM = [
  [221, "B1", 12],
  [222, "B2", 10],
  [223, "B3", 6],
  [224, "B4", 2],
];
const DIV4 = [
  [301, "P1", 24],
  [302, "P2", 20],
  [303, "P3", 15],
  [304, "P4", 9],
  [305, "P5", 5],
  [306, "P6", 1],
];
const DIV2 = [
  [101, "S1", 30],
  [102, "S2", 26],
  [103, "S3", 22],
  [104, "S4", 18],
];
const DIV4_BOTTOM4_NAMES = ["P3", "P4", "P5", "P6"];
const DIV3_BOTTOM4_NAMES = ["B1", "B2", "B3", "B4"];

/**
 * Sala:
 *  div 2 → S1..S4 (NPC)
 *  div 3 → TOP,T2,M1,M2 + HUMA_C(201, humano Huma, 18pts) + B1..B4
 *  div 4 → P1..P6
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
  for (const name of ["H2", "H3", "H4", "H5"]) await insMgr(name, true);

  type Spec = [number, string, number, number, number]; // id, nome, div, pts, mgrId
  const specs: Spec[] = [];
  for (const [id, name, pts] of DIV2) specs.push([id, name, 2, pts, 0]);
  specs.push([201, "HUMA_C", 3, 18, humanId]);
  for (const [id, name, pts] of [...DIV3_TOP, ...DIV3_BOTTOM])
    specs.push([id, name, 3, pts, 0]);
  for (const [id, name, pts] of DIV4) specs.push([id, name, 4, pts, 0]);

  for (const [id, name, division, points, mgr] of specs) {
    const managerId = mgr || (await insMgr(`NPC${id}`, false));
    await new Promise<void>((resolve, reject) =>
      db.run(
        "INSERT INTO teams (id, name, division, manager_id, points) VALUES (?, ?, ?, ?, ?)",
        [id, name, division, managerId, points],
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

const teamRow = async (db: any, teamId: number): Promise<any> =>
  runGet(db, "SELECT * FROM teams WHERE id=?", [teamId]);

async function main() {
  // ---------- Cenário A: despedido a meio da Liga 3 ⇒ últimos 4 da div 3 ----------
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
  const newTeam = await teamRow(db, player.teamId);
  assert(newTeam.division === 3, `A: realocação na mesma divisão (div ${newTeam.division})`);
  assert(DIV3_BOTTOM4_NAMES.includes(newTeam.name), `A: clube atribuído está entre os últimos 4 classificados da Liga 3 — obtido "${newTeam.name}"`);
  assert((await teamRow(db, player.teamId)).manager_id != null, "A: clube atribuído ficou com treinador");

  // ---------- Cenário B: promoção → despedição ⇒ realocação na div 2 ----------
  db = await setupDb();
  ({ game, helpers } = makeGame(db));
  // Fim de época: HUMA_C promovido div 3 → div 2 e classificação resetada.
  await new Promise((res) => db.exec("UPDATE teams SET division=2 WHERE id=201", res));
  await new Promise((res) =>
    db.exec(
      "UPDATE teams SET points=0, wins=0, draws=0, losses=0, goals_for=0, goals_against=0 WHERE division=2",
      res,
    ),
  );
  game.season = 2;
  game.matchweek = 6; // orçamento é o gatilho (form da nova época ainda limpa)
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
  const newTeamB = await teamRow(db, playerB.teamId);
  assert(newTeamB.division === 2, `B: realocação usa divisão CORRENTE do clube (div ${newTeamB.division}) — caso 'Liga 3 → Segunda Liga' quando o clube tinha subido`);
  assert(["S1", "S2", "S3", "S4"].includes(newTeamB.name), `B: clube atribuído está entre os últimos 4 classificados da div 2 — obtido "${newTeamB.name}"`);

  // ---------- Cenário D: últimos 4 da div 3 ocupados ⇒ desce p/ div 4 (aí sim, últimos 4) ----------
  db = await setupDb();
  ({ game, helpers } = makeGame(db));
  // Quatro humanos adicionais seguram os últimos 4 classificados da Liga 3.
  const bottom4TeamIds: Array<[number, string]> = [
    [221, "H2"], [222, "H3"], [223, "H4"], [224, "H5"],
  ];
  for (const [teamId, name] of bottom4TeamIds) {
    game.playersByName[name] = { name, teamId, socketId: null, ready: false };
  }
  await primeBudgetDismissal(game, 201);
  try {
    await helpers.processCoachEvents(game);
  } finally {
    restoreRandom();
  }

  const playerD = game.playersByName["Huma"];
  assert(playerD.teamId !== 201, "D: coach despedido do clube da Liga 3");
  if (playerD.teamId == null) {
    console.error("FAIL: D — nenhum clube atribuído ao humano");
    process.exit(1);
  }
  const newTeamD = await teamRow(db, playerD.teamId);
  assert(newTeamD.division === 4, `D: sem últimos-4 livres na div 3, desceu para div ${newTeamD.division}`);
  assert(DIV4_BOTTOM4_NAMES.includes(newTeamD.name), `D: clube da div 4 atribuído está entre os últimos 4 classificados — obtido "${newTeamD.name}"`);

  console.log("\nPASS coachDismissalLeagueRegression");
}

main().catch((err) => {
  restoreRandom();
  console.error("ERROR:", err?.stack ?? err);
  process.exit(1);
});
