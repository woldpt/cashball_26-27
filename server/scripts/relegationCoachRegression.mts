/**
 * Regression test — despedimento obrigatório de treinadores humanos
 * despromovidos do Campeonato de Portugal (div 4 → div 5).
 *
 * Regra: quando um clube com treinador humano acaba nos dois últimos
 * lugares do CP (divisão 4) e é despromovido para os Distritais (divisão 5,
 * pool interno invisível), o treinador é despedido obrigatoriamente e
 * realocado automaticamente para outro clube NPC do CP.
 *
 * Diferenças face ao despedimento por forma/orçamento:
 *  - 100% garantido (sem rolagem de probabilidade);
 *  - ignora o limite de 1 despedimento/época (cenário A);
 *  - não consome o limite de despedimentos da NOVA época (cenário B).
 *
 * Run: cd server && npm run test:relegation-coach
 */
import sqlite3 from "sqlite3";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createCoachDismissalHelpers } = require("../coachDismissalHelpers.ts") as {
  createCoachDismissalHelpers: (deps: any) => {
    processRelegatedHumanCoaches: (
      game: any,
      relegatedTeamIds: number[],
    ) => Promise<void>;
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

async function setupDb() {
  const db = new sqlite3.Database(":memory:");
  await new Promise((res) =>
    db.exec(
      `CREATE TABLE teams (
        id INTEGER PRIMARY KEY,
        name TEXT,
        division INTEGER,
        manager_id INTEGER,
        budget INTEGER DEFAULT 1000000,
        color_primary TEXT DEFAULT '#333333',
        color_secondary TEXT DEFAULT '#ffffff',
        points INTEGER DEFAULT 0,
        wins INTEGER DEFAULT 0,
        draws INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        goals_for INTEGER DEFAULT 0,
        goals_against INTEGER DEFAULT 0,
        stadium_capacity INTEGER DEFAULT 5000,
        stadium_name TEXT DEFAULT 'Estádio'
      );
      CREATE TABLE managers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        is_human INTEGER DEFAULT 0,
        reputation INTEGER DEFAULT 50
      );
      CREATE TABLE players (
        id INTEGER PRIMARY KEY,
        team_id INTEGER,
        name TEXT,
        position TEXT,
        skill INTEGER DEFAULT 50
      );`,
      res,
    ),
  );

  const insertManager = (name: string, isHuman: boolean): Promise<number> =>
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

  const insertTeam = (
    id: number,
    name: string,
    division: number,
    managerId: number,
  ): Promise<void> =>
    new Promise((resolve, reject) =>
      db.run(
        "INSERT INTO teams (id, name, division, manager_id) VALUES (?, ?, ?, ?)",
        [id, name, division, managerId],
        (err: any) => (err ? reject(err) : resolve()),
      ),
    );

  // Estado de fim de época (o que applySeasonEnd deixa na DB antes de
  // chamar processRelegatedHumanCoaches):
  //  - div 4: T1 (humano CoachOutro), T2..T6 (NPC), P1/P2 (NPC, promovidos)
  //  - div 5: T7 (humano CoachHumano — será despedido), T8 (NPC — intocado)
  const coachHumanoId = await insertManager("CoachHumano", true);
  const coachOutroId = await insertManager("CoachOutro", true);
  const npcManagers: Record<number, number> = {};
  const teamSpecs: Array<[number, string, number, number]> = [
    [1, "T1", 4, coachOutroId],
    [2, "T2", 4, 0],
    [3, "T3", 4, 0],
    [4, "T4", 4, 0],
    [5, "T5", 4, 0],
    [6, "T6", 4, 0],
    [9, "P1", 4, 0],
    [10, "P2", 4, 0],
    [7, "T7", 5, coachHumanoId],
    [8, "T8", 5, 0],
  ];
  for (const [id, name, division, managerId] of teamSpecs) {
    let mgr = managerId;
    if (!mgr) {
      mgr = await insertManager(`NPC${id}`, false);
      npcManagers[id] = mgr;
    }
    await insertTeam(id, name, division, mgr);
  }
  return db;
}

/**
 * @param capPreused true → o coach já "consumiu" o limite de 1 despedimento
 *   da época (prova que o force ignora o limite). false → prova que o force
 *   NÃO consome o limite da nova época.
 */
async function makeScenario(capPreused: boolean) {
  const db = await setupDb();
  const { io, emitted } = createMockIo();
  const game: any = {
    db,
    roomCode: "TEST",
    season: 2,
    matchweek: 1,
    playersByName: {
      CoachHumano: {
        name: "CoachHumano",
        teamId: 7,
        socketId: "sock-coach1",
        ready: false,
      },
      CoachOutro: {
        name: "CoachOutro",
        teamId: 1,
        socketId: null,
        ready: false,
      },
    },
    pendingJobOffers: {},
    negativeBudgetStreak: {},
    boardBudgetWarned: {},
    coachMatchesManaged: {},
    npcMatchesManaged: {},
    dismissedCoachSince: {},
    dismissalsThisSeason: new Set<string>(
      capPreused ? ["CoachHumano"] : [],
    ),
    coachMarketEvents: [],
    lockedCoaches: new Set<string>(),
  };
  const helpers = createCoachDismissalHelpers({
    io,
    runAll,
    runGet,
    saveGameState: async () => {},
    getRoomCoaches: async () => [],
  });
  return { db, game, emitted, helpers };
}

async function main() {
  // ── Cenário A: limite de 1 despedimento/época já usado → force ignora ──
  {
    const { db, game, emitted, helpers } = await makeScenario(true);
    await helpers.processRelegatedHumanCoaches(game, [7, 8]);

    const t7 = await runGet(db, "SELECT manager_id FROM teams WHERE id = 7");
    assert(
      t7.manager_id === null,
      "cenário A: equipa despromovida (T7) fica sem treinador (manager_id NULL)",
    );

    const newTeamId = game.playersByName.CoachHumano.teamId;
    const validTargets = [2, 3, 4, 5, 6, 9, 10];
    assert(
      validTargets.includes(newTeamId),
      `cenário A: coach realocado para clube NPC do CP (obtido teamId=${newTeamId}, esperado um de [${validTargets.join(",")}])`,
    );

    const mgrRow = await runGet(
      db,
      "SELECT m.id FROM managers m JOIN teams t ON t.manager_id = m.id WHERE t.id = ?",
      [newTeamId],
    );
    const coachMgr = await runGet(
      db,
      "SELECT id FROM managers WHERE name = 'CoachHumano'",
    );
    assert(
      mgrRow && mgrRow.id === coachMgr.id,
      "cenário A: novo clube do coach aponta para o manager correto",
    );

    assert(
      game.dismissalsThisSeason.size === 1 &&
        game.dismissalsThisSeason.has("CoachHumano"),
      "cenário A: limite de 1 despedimento/época foi ignorado (despedimento aconteceu)",
    );

    const t8 = await runGet(db, "SELECT manager_id FROM teams WHERE id = 8");
    const t8Mgr = await runGet(
      db,
      "SELECT m.id FROM managers m WHERE m.name = 'NPC8'",
    );
    assert(
      t8.manager_id === t8Mgr.id,
      "cenário A: equipa NPC despromovida (T8) fica com o seu treinador NPC",
    );

    assert(
      game.playersByName.CoachOutro.teamId === 1,
      "cenário A: outro treinador humano (CoachOutro) não é afetado",
    );

    const dismissed = emitted.find(
      (e) => e.room === "sock-coach1" && e.event === "coachDismissed",
    );
    assert(
      dismissed?.payload?.reason === "relegation",
      "cenário A: emit coachDismissed com reason 'relegation'",
    );
    const assigned = emitted.find(
      (e) => e.room === "sock-coach1" && e.event === "teamAssigned",
    );
    assert(
      assigned?.payload?.teamId === newTeamId,
      "cenário A: emit teamAssigned com o novo clube",
    );
    const report = emitted.find(
      (e) => e.room === "TEST" && e.event === "coachMarketReport",
    );
    assert(
      report?.payload?.events?.length === 2 &&
        report.payload.events[0].type === "dismissal" &&
        report.payload.events[0].reason === "relegation" &&
        report.payload.events[1].type === "hiring",
      "cenário A: coachMarketReport emitido com despedimento + contratação",
    );
    const sysMsg = emitted.find(
      (e) =>
        e.room === "TEST" &&
        e.event === "systemMessage" &&
        String(e.payload?.text ?? "").includes(
          "despromoção do Campeonato de Portugal",
        ),
    );
    assert(
      Boolean(sysMsg),
      "cenário A: systemMessage de despromoção broadcast para a sala",
    );

    db.close();
  }

  // ── Cenário B: force NÃO consome o limite da nova época ─────────────────
  {
    const { db, game, helpers } = await makeScenario(false);
    await helpers.processRelegatedHumanCoaches(game, [7, 8]);

    assert(
      game.dismissalsThisSeason.size === 0,
      `cenário B: despedimento por despromoção não consome o limite da nova época (size=${game.dismissalsThisSeason.size})`,
    );
    assert(
      game.playersByName.CoachHumano.teamId !== 7,
      "cenário B: coach foi despedido e realocado",
    );
    db.close();
  }

  console.log("\nTodos os testes passaram ✔");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
