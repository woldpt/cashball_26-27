/**
 * Regression — realocação de coaches humanos despedidos.
 *
 * Regra de intenção: "Quando se é despedido, fica-se numa equipa da mesma
 * Liga, ou inferior (excepto Distritais, div 5) — mas nunca no topo da
 * tabela: procurar entre os últimos 4 classificados dessa divisão."
 *
 * Cenários:
 *  A. Humano na Liga 3 (div 3), médio → despedido por orçamento ⇒ fica sem
 *     clube e recebe 3 opções, todas entre os últimos 4 classificados da div 3
 *     (nunca a um clube do topo). Só depois de escolher fica com clube.
 *  B. O clube do humano foi promovido ao fim da época (div 3 → div 2, o coach
 *     fica com o clube) e, na época seguinte, é despedido ⇒ as opções usam a
 *     divisão CORRENTE (div 2), dentro dos últimos 4 dessa divisão.
 *  D. Últimos 4 da div de origem já ocupados por outros humanos ⇒ desce uma
 *     divisão e as opções são os últimos 4 dessa divisão.
 *  E. Escolha do clube: recusa a meio do jogo e clubes fora das opções;
 *     depois de escolher já não há troca.
 *  F. Aviso da direção por má série: 3 derrotas (aviso), 4 (último aviso),
 *     um aviso por nível e nova série depois de recuperar.
 *  G. Convite de clube guarda as vitórias recentes (motivo mostrado ao treinador).
 *
 * Run: cd server && npm run test:coach-dismissal-league
 */
import sqlite3 from "sqlite3";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createCoachDismissalHelpers } = require("../coachDismissalHelpers.ts") as {
  createCoachDismissalHelpers: (deps: any) => {
    processCoachEvents: (game: any) => Promise<void>;
    handleSwapDismissalClub: (game: any, coachName: string, toTeamId: number) => Promise<void>;
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
    id INTEGER PRIMARY KEY, team_id INTEGER, name TEXT, position TEXT, skill INTEGER DEFAULT 50,
    wage INTEGER DEFAULT 0, form INTEGER DEFAULT 32, morale INTEGER DEFAULT 25,
    value INTEGER DEFAULT 0, age INTEGER DEFAULT 25, is_star INTEGER DEFAULT 0
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
  const { io, emitted } = createMockIo();
  const game: any = {
    db, roomCode: "TEST", season: 1, matchweek: 6,
    // Assentos duráveis (roomStateHelpers): sem eles `deleteSeat` rebenta.
    seats: {}, seatSeenAt: {},
    playersByName: { Huma: { name: "Huma", teamId: 201, socketId: null, ready: false } },
    pendingJobOffers: {}, negativeBudgetStreak: {}, npcNegativeBudgetStreak: {}, boardBudgetWarned: {},
    formWarned: {},
    coachMatchesManaged: {}, npcMatchesManaged: {}, dismissedCoachSince: {},
    dismissalOptions: {}, dismissalsThisSeason: new Set<string>(), coachMarketEvents: [],
    lockedCoaches: new Set<string>(),
  };
  const helpers = createCoachDismissalHelpers({
    io, runAll, runGet,
    saveGameState: async () => {},
    getRoomCoaches: async () => [],
    // Deps que o helper passou a pedir: avatares dos treinadores (notícia do
    // despedimento) e corte salarial NPC (não usado nesta via).
    getCoachAvatars: async () => ({}),
    forceNpcWageCut: async () => 0,
  });
  return { game, helpers, emitted };
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

/** Substitui os jogos do humano (201, em casa) por uma série; o 1.º é o mais recente. */
async function setSerie(db: any, serie: string[]): Promise<void> {
  await new Promise<void>((resolve) => db.run("DELETE FROM matches", () => resolve()));
  for (let i = 0; i < serie.length; i++) {
    const win = serie[i] === "V";
    await new Promise<void>((resolve, reject) =>
      db.run(
        "INSERT INTO matches (id, home_team_id, away_team_id, home_score, away_score, played, season) VALUES (?, 201, 301, ?, ?, 1, 1)",
        [1000 + serie.length - i, win ? 1 : 0, win ? 0 : 1],
        (err: any) => (err ? reject(err) : resolve()),
      ),
    );
  }
}

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
  assert(player.teamId == null, "A: despedido fica sem clube até escolher");
  const optsA: number[] = game.dismissalOptions["Huma"];
  assert(Array.isArray(optsA) && optsA.length === 3, "A: 3 clubes à escolha");
  for (const id of optsA) {
    const t = await teamRow(db, id);
    assert(t.division === 3, `A: opção na mesma divisão (div ${t.division})`);
    assert(DIV3_BOTTOM4_NAMES.includes(t.name), `A: opção "${t.name}" está entre os últimos 4 classificados da Liga 3`);
  }
  assert((await teamRow(db, 201)).manager_id != null, "A: clube de onde foi despedido recebeu treinador NPC (não fica órfão)");
  await helpers.handleSwapDismissalClub(game, "Huma", optsA[0]);
  assert(player.teamId === optsA[0], "A: escolher o clube atribui-o");
  assert((await teamRow(db, player.teamId)).manager_id != null, "A: clube escolhido ficou com treinador");

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
  assert(playerB.teamId == null, "B: coach despedido do clube promovido fica sem clube até escolher");
  const optsB: number[] = game.dismissalOptions["Huma"] ?? [];
  assert(optsB.length === 3, "B: 3 opções à escolha");
  for (const id of optsB) {
    const t = await teamRow(db, id);
    assert(t.division === 2, `B: opções usam divisão CORRENTE do clube (div ${t.division}) — caso 'Liga 3 → Segunda Liga' quando o clube tinha subido`);
    assert(["S1", "S2", "S3", "S4"].includes(t.name), `B: opção "${t.name}" está entre os últimos 4 classificados da div 2`);
  }
  await helpers.handleSwapDismissalClub(game, "Huma", optsB[0]);
  assert(playerB.teamId === optsB[0], "B: escolha atribui o clube da div 2");

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
  assert(playerD.teamId == null, "D: coach despedido do clube da Liga 3 fica sem clube até escolher");
  const optsD: number[] = game.dismissalOptions["Huma"] ?? [];
  assert(optsD.length === 3, "D: 3 opções à escolha");
  for (const id of optsD) {
    const t = await teamRow(db, id);
    assert(t.division === 4, `D: sem últimos-4 livres na div 3, opções na div ${t.division}`);
    assert(DIV4_BOTTOM4_NAMES.includes(t.name), `D: opção "${t.name}" está entre os últimos 4 classificados da div 4`);
  }
  await helpers.handleSwapDismissalClub(game, "Huma", optsD[0]);
  assert(playerD.teamId === optsD[0], "D: escolha atribui o clube da div 4");

  // ---------- Cenário E: troca imediata (despedimento + escolha, nunca sem clube) ----------
  db = await setupDb();
  ({ game, helpers } = makeGame(db));
  await primeBudgetDismissal(game, 201);
  try {
    await helpers.processCoachEvents(game);
  } finally {
    restoreRandom();
  }
  const playerE = game.playersByName["Huma"];
  assert(playerE.teamId == null, "E: despedido sem clube enquanto não escolhe");
  const optsE: number[] = game.dismissalOptions["Huma"];
  assert(Array.isArray(optsE) && optsE.length === 3, "E: 3 clubes à escolha");
  await helpers.handleSwapDismissalClub(game, "Huma", 999999);
  assert(playerE.teamId == null, "E: clube fora das opções é ignorado");
  game.gamePhase = "match_first_half";
  await helpers.handleSwapDismissalClub(game, "Huma", optsE[1]);
  assert(playerE.teamId == null, "E: escolha recusada a meio do jogo");
  game.gamePhase = "lobby";
  const escolhidoE = optsE[1];
  await helpers.handleSwapDismissalClub(game, "Huma", escolhidoE);
  assert(playerE.teamId === escolhidoE, "E: escolha atribui o clube escolhido");
  assert((await teamRow(db, escolhidoE)).manager_id != null, "E: clube escolhido ficou com o humano");
  assert(game.dismissedCoachSince["Huma"] === undefined, "E: despedimento fecha depois de escolher");
  await helpers.handleSwapDismissalClub(game, "Huma", optsE[0]);
  assert(playerE.teamId === escolhidoE, "E: depois de escolher já não há troca");

  // ---------- Cenário F: aviso da direção por má série (3 e 4 derrotas) ----------
  db = await setupDb();
  const f = makeGame(db);
  f.game.playersByName["Huma"].socketId = "sock-huma";
  f.game.coachMatchesManaged["Huma"] = 9;
  const realRandomF = Math.random;
  Math.random = () => 0.99; // sem despedimento nem convite: só o aviso
  try {
    await setSerie(db, ["V", "V", "D", "D", "D"]); // 3 derrotas em 5
    await f.helpers.processCoachEvents(f.game);
    const avisosF = () => f.emitted.filter((e: any) => e.event === "systemMessage" && e.room === "sock-huma");
    assert(f.game.formWarned[201] === 1, "F: 3 derrotas em 5 → aviso (nível 1)");
    assert(avisosF().length === 1 && /3 derrotas/.test(avisosF()[0].payload.text), "F: aviso chega ao treinador");
    await f.helpers.processCoachEvents(f.game);
    assert(avisosF().length === 1, "F: o mesmo nível não se repete na semana seguinte");
    await setSerie(db, ["V", "D", "D", "D", "D"]); // 4 derrotas em 5
    await f.helpers.processCoachEvents(f.game);
    assert(f.game.formWarned[201] === 2, "F: 4 derrotas → último aviso (nível 2)");
    assert(avisosF().length === 2 && /Último aviso/.test(avisosF()[1].payload.text), "F: último aviso chega ao treinador");
    await setSerie(db, ["V", "V", "V", "D", "D"]); // recuperou: 2 derrotas
    await f.helpers.processCoachEvents(f.game);
    assert(f.game.formWarned[201] === 0, "F: recuperar (menos de 3 derrotas) repõe o aviso");
  } finally {
    Math.random = realRandomF;
  }

  // ---------- Cenário G: convite guarda as vitórias recentes ----------
  db = await setupDb();
  const g = makeGame(db);
  g.game.playersByName["Huma"].socketId = "sock-huma";
  g.game.coachMatchesManaged["Huma"] = 9;
  await setSerie(db, ["V", "V", "V", "D", "D"]); // 3 vitórias em 5
  const realRandomG = Math.random;
  Math.random = () => 0; // o convite sai (5%) e nada mais
  try {
    await g.helpers.processCoachEvents(g.game);
  } finally {
    Math.random = realRandomG;
  }
  assert(g.game.pendingJobOffers["Huma"]?.recentWins === 3, "G: convite guarda as 3 vitórias recentes");
  const convite = g.emitted.find((e: any) => e.event === "jobOffer");
  assert(convite?.payload?.recentWins === 3, "G: convite enviado ao treinador traz o motivo");

  // ---------- Cenário H: opções ocupadas depois de apresentadas ----------
  db = await setupDb();
  const h = makeGame(db);
  await primeBudgetDismissal(h.game, 201);
  try {
    await h.helpers.processCoachEvents(h.game);
  } finally {
    restoreRandom();
  }
  const playerH = h.game.playersByName["Huma"];
  playerH.socketId = "sock-huma";
  const optsH: number[] = [...h.game.dismissalOptions["Huma"]];
  assert(optsH.length === 3, "H: 3 opções à escolha");
  // Outro humano despedido escolhe uma das opções do Huma.
  h.game.playersByName["H2"] = { name: "H2", teamId: null, socketId: null, ready: false };
  for (const id of optsH) {
    h.game.dismissalOptions["H2"] = [id];
    h.game.dismissedCoachSince["H2"] = { division: 3 };
    h.emitted.length = 0;
    await h.helpers.handleSwapDismissalClub(h.game, "H2", id);
    const left = h.game.dismissalOptions["Huma"];
    assert(h.game.playersByName["H2"].teamId === id, `H: H2 ficou com ${id}`);
    assert(!left.includes(id) && left.length >= 1, "H: clube ocupado sai das opções do Huma, que nunca fica sem opções");
    assert(
      h.emitted.some((e: any) => e.event === "dismissalChoice" && e.room === "sock-huma"),
      "H: Huma recebe a lista atualizada",
    );
    h.game.playersByName["H2"].teamId = null; // H2 volta a estar livre para a próxima volta
  }
  assert(h.game.dismissalOptions["Huma"].length === 3, "H: opções esgotadas ⇒ novo sorteio de 3 clubes");
  assert(playerH.teamId == null, "H: Huma continua a poder escolher");

  console.log("\nPASS coachDismissalLeagueRegression");
}

main().catch((err) => {
  restoreRandom();
  console.error("ERROR:", err?.stack ?? err);
  process.exit(1);
});
