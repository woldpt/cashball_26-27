/**
 * Regression test — Funcionários do clube (`team_staff`).
 *
 * Regras em causa:
 *  - Tabela de preços: efeito linear no nível, salário a dobrar (3k..48k),
 *    assinatura = 4 semanas de salário, despedimento = 2 semanas.
 *  - Contratação/despedimento com dinheiro: débito condicional ao saldo,
 *    um funcionário por papel (UNIQUE), teto de STAFF_SLOTS lugares e
 *    despedimento que não deixa o clube em saldo negativo.
 *  - Efeitos no treino (applyTrainingBonuses): Treinador Auxiliar +8%/nível
 *    no progresso de skill; Preparador Físico +1 forma (quem descansa) a cada
 *    2 níveis, +0.5 de resistência treinada por nível e -8%/nível no
 *    decaimento da resistência.
 *  - NPCs contratam sozinhos (1 por semana, ao nível da divisão, com reserva
 *    de tesouraria); divisão 5 e equipas humanas ficam de fora.
 *
 * Run: cd server && npm run test:staff
 */
import sqlite3 from "sqlite3";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { staffSalaryFor, staffSigningFee, staffSeverance, STAFF_SLOTS } =
  require("../gameConstants.ts") as {
    staffSalaryFor: (level: number) => number;
    staffSigningFee: (level: number) => number;
    staffSeverance: (level: number) => number;
    STAFF_SLOTS: number;
  };
const { hireStaff, fireStaff, buildStaffState, ensureNpcStaff, staffEffectNumbers } =
  require("../staffHelpers.ts") as {
    hireStaff: (game: any, teamId: number, role: string, level: number) => Promise<any>;
    fireStaff: (game: any, teamId: number, role: string) => Promise<any>;
    buildStaffState: (game: any, teamId: number) => Promise<any>;
    ensureNpcStaff: (game: any) => Promise<void>;
    staffEffectNumbers: (role: string, level: number) => Record<string, number>;
  };
const {
  staffInjuryChanceMult,
  staffInjuryWeeks,
  staffInjurySkillLoss,
  staffAttendanceMult,
  staffFansDecayMult,
} = require("../gameConstants.ts") as {
  staffInjuryChanceMult: (level: number) => number;
  staffInjuryWeeks: (level: number, weeks: number) => number;
  staffInjurySkillLoss: (level: number, loss: number) => number;
  staffAttendanceMult: (level: number) => number;
  staffFansDecayMult: (level: number) => number;
};
const { applyTrainingBonuses } = require("../trainingHelpers.ts") as {
  applyTrainingBonuses: (
    game: any,
    fixtures: any[],
    completedCalendarIndex: number,
  ) => Promise<void>;
};
const { calculateMatchAttendance } = require("../coreHelpers.ts") as {
  calculateMatchAttendance: (
    db: unknown,
    homeTeamId: number,
    opponentTeamId?: number,
    ctx?: unknown,
  ) => Promise<number>;
};
const { applyPostMatchQualityEvolution } = require("../game/engine.ts") as {
  applyPostMatchQualityEvolution: (
    db: unknown,
    fixtures: any[],
    currentMatchweek: number,
    season: number,
    calendarIndex?: number,
  ) => Promise<void>;
};

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`ok  - ${msg}`);
}

function assertEq(actual: unknown, expected: unknown, msg: string) {
  if (actual !== expected) {
    console.error(`FAIL: ${msg} — esperado ${expected}, obtido ${actual}`);
    process.exit(1);
  }
  console.log(`ok  - ${msg} (${JSON.stringify(actual)})`);
}

function openDb(schema: string): sqlite3.Database {
  const db = new sqlite3.Database(":memory:");
  db.exec(schema, (err) => {
    if (err) {
      console.error("FAIL: schema —", err.message);
      process.exit(1);
    }
  });
  return db;
}

function run(db: sqlite3.Database, sql: string, params: any[] = []): Promise<void> {
  return new Promise((res, rej) => db.run(sql, params, (e) => (e ? rej(e) : res())));
}

function get(db: sqlite3.Database, sql: string, params: any[] = []): Promise<any> {
  return new Promise((res, rej) =>
    db.get(sql, params, (e, row) => (e ? rej(e) : res(row))),
  );
}

function all(db: sqlite3.Database, sql: string, params: any[] = []): Promise<any[]> {
  return new Promise((res, rej) =>
    db.all(sql, params, (e, rows) => (e ? rej(e) : res(rows || []))),
  );
}

const MONEY_SCHEMA = `
  CREATE TABLE teams (id INTEGER PRIMARY KEY, name TEXT, division INTEGER, budget INTEGER, loan_amount INTEGER DEFAULT 0, stadium_capacity INTEGER DEFAULT 10000);
  CREATE TABLE team_staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL DEFAULT '',
    salary_weekly INTEGER NOT NULL DEFAULT 0,
    hired_slot INTEGER NOT NULL DEFAULT 0,
    UNIQUE(team_id, role)
  );
  CREATE TABLE club_news (id INTEGER PRIMARY KEY AUTOINCREMENT, team_id INTEGER, type TEXT, title TEXT, description TEXT, player_id INTEGER, player_name TEXT, related_team_id INTEGER, related_team_name TEXT, amount INTEGER, matchweek INTEGER, slot INTEGER, year INTEGER);
`;

const TRAIN_SCHEMA = `
  CREATE TABLE teams (id INTEGER PRIMARY KEY, name TEXT, division INTEGER, budget INTEGER DEFAULT 0);
  CREATE TABLE players (
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
  CREATE TABLE team_training (team_id INTEGER, matchweek INTEGER, training_focus TEXT, applied INTEGER DEFAULT 0);
  CREATE TABLE player_skill_snapshots (player_id INTEGER, matchweek INTEGER, season INTEGER, skill INTEGER);
  CREATE TABLE training_player_history (id INTEGER PRIMARY KEY AUTOINCREMENT, player_id INTEGER, team_id INTEGER, matchweek INTEGER, attribute TEXT, old_value REAL, new_value REAL, delta REAL DEFAULT 0, focus TEXT);
  CREATE TABLE team_staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL DEFAULT '',
    salary_weekly INTEGER NOT NULL DEFAULT 0,
    hired_slot INTEGER NOT NULL DEFAULT 0,
    UNIQUE(team_id, role)
  );
`;

async function main() {
  // ── A. Tabela de preços (efeito linear, salário a dobrar) ────────────────
  const salaries = [1, 2, 3, 4, 5].map(staffSalaryFor);
  assertEq(salaries.join(","), "3000,6000,12000,24000,48000", "salário dobra por nível");
  assertEq(staffSigningFee(3), 48000, "assinatura de nível 3 = 4 semanas");
  assertEq(staffSeverance(3), 24000, "despedimento de nível 3 = 2 semanas");
  assertEq(staffEffectNumbers("auxiliar", 5).trainingPct, 40, "auxiliar nível 5 = +40% treino");
  const fisico4 = staffEffectNumbers("fisico", 4);
  assert(
    fisico4.restedForm === 2 && fisico4.resistance === 2 && fisico4.decayPct === 32,
    "preparador físico nível 4 = +2 forma / +2.0 resistência / -32% decaimento",
  );

  // ── Director de Comunicação e Médico ────────────────────────────────────
  const comm5 = staffEffectNumbers("comunicacao", 5);
  assert(
    comm5.attendancePct === 10 && comm5.fansDecayPct === 40,
    "comunicação nível 5 = +10% lotação / -40% queda de ânimo",
  );
  assertEq(staffAttendanceMult(3), 1.06, "lotação com comunicação nível 3 (+6%)");
  assertEq(staffFansDecayMult(5), 0.6, "queda de ânimo travada a 60% no nível 5");
  const medico5 = staffEffectNumbers("medico", 5);
  assert(
    medico5.injuryPct === 30 && medico5.weeksCut === 2 && medico5.skillSaved === 5,
    "médico nível 5 = -30% lesões / -2 semanas / poupa 5 de skill",
  );
  assertEq(staffInjuryChanceMult(0), 1, "sem médico a probabilidade de lesão fica igual");
  assertEq(staffInjuryChanceMult(5), 0.7, "médico nível 5 corta 30% da probabilidade");
  assertEq(staffInjuryWeeks(0, 6), 6, "sem médico as semanas de lesão não mudam");
  assertEq(staffInjuryWeeks(5, 6), 4, "médico nível 5 encurta 6 semanas para 4");
  assertEq(staffInjuryWeeks(5, 1), 1, "lesão leve nunca desce de 1 semana");
  assertEq(staffInjurySkillLoss(5, 4), 0, "médico nível 5 apaga a perda de skill de 4");
  assertEq(staffInjurySkillLoss(2, 6), 4, "médico nível 2 poupa 2 de uma perda de 6");

  // ── B. Contratação e despedimento (dinheiro a sério) ────────────────────
  const dbMoney = openDb(MONEY_SCHEMA);
  await run(
    dbMoney,
    "INSERT INTO teams (id, name, division, budget) VALUES (5, 'Humano A', 2, 1000000), (6, 'Humano B', 2, 1000000), (7, 'Humano C', 2, 100000)",
  );
  const moneyGame: any = {
    db: dbMoney,
    roomCode: "TESTSTAFF",
    season: 1,
    calendarIndex: 3,
    matchweek: 4,
    year: 2026,
    playersByName: { a: { teamId: 5 }, b: { teamId: 6 }, c: { teamId: 7 } },
  };

  const hired = await hireStaff(moneyGame, 5, "auxiliar", 3);
  assert(hired.ok === true, "contratar auxiliar nível 3 funciona");
  assertEq(
    (await get(dbMoney, "SELECT budget FROM teams WHERE id = 5")).budget,
    952000,
    "assinatura debitada do orçamento",
  );
  const newsRow = await get(
    dbMoney,
    "SELECT title, amount, type FROM club_news WHERE team_id = 5 ORDER BY id DESC LIMIT 1",
  );
  assert(
    newsRow?.type === "staff_hire" && newsRow?.amount === 48000,
    "contratação entra no Jornal com o custo",
  );

  const state5 = await buildStaffState(moneyGame, 5);
  assertEq(state5.used, 1, "estado conta 1 lugar ocupado");
  assertEq(state5.salaryWeekly, 12000, "estado soma o salário semanal");
  assertEq(state5.members[0].effect.trainingPct, 24, "efeito do nível 3 no estado (+24%)");
  assertEq(String(state5.salaries.join(",")), "3000,6000,12000,24000,48000", "tabela de preços no estado");
  assertEq(state5.slots, STAFF_SLOTS, "teto de lugares no estado");
  assertEq(state5.roles.length, 4, "estado expõe os 4 papéis (auxiliar, físico, comunicação, médico)");
  assertEq(
    state5.previews.medico[4].injuryPct,
    30,
    "pré-visualização do médico nível 5 no estado (-30% lesões)",
  );
  assertEq(
    state5.previews.comunicacao[0].attendancePct,
    2,
    "pré-visualização da comunicação nível 1 no estado (+2% lotação)",
  );

  assertEq(
    (await hireStaff(moneyGame, 5, "auxiliar", 1)).error,
    "role_taken",
    "não se contrata dois no mesmo papel",
  );
  assertEq(
    (await hireStaff(moneyGame, 5, "inventado", 1)).error,
    "invalid_role",
    "papel inválido é rejeitado",
  );
  assertEq(
    (await hireStaff(moneyGame, 5, "fisico", 9)).error,
    "invalid_level",
    "nível fora de 1..5 é rejeitado",
  );
  assertEq(
    (await hireStaff(moneyGame, 7, "auxiliar", 5)).error,
    "no_budget",
    "sem saldo para a assinatura não contrata",
  );
  assertEq(
    (await get(dbMoney, "SELECT budget FROM teams WHERE id = 7")).budget,
    100000,
    "contratação falhada não mexe no orçamento",
  );

  // Teto de lugares: 4 papéis para 3 lugares — o 4.º é recusado.
  assertEq(
    (await hireStaff(moneyGame, 5, "fisico", 1)).ok,
    true,
    "2.º papel contratado (preparador físico nível 1)",
  );
  assertEq(
    (await hireStaff(moneyGame, 5, "medico", 1)).ok,
    true,
    "3.º papel contratado (médico nível 1)",
  );
  const fullState = await buildStaffState(moneyGame, 5);
  assertEq(
    fullState.used === fullState.slots,
    true,
    "estado assinala a equipa técnica cheia (3/3)",
  );
  assertEq(
    (await hireStaff(moneyGame, 5, "comunicacao", 1)).error,
    "no_slots",
    "4.º papel recusado: sem lugares livres",
  );
  assertEq(
    (await hireStaff(moneyGame, 5, "fisico", 3)).error,
    "role_taken",
    "papel já ocupado continua a ser recusado antes do teto",
  );

  const fired = await fireStaff(moneyGame, 5, "auxiliar");
  assert(fired.ok === true, "despedir funciona");
  assertEq(fired.severance, 24000, "indemnização de nível 3 = 2 semanas");
  assertEq(
    (await get(dbMoney, "SELECT budget FROM teams WHERE id = 5")).budget,
    928000 - 24000,
    "indemnização debitada",
  );
  assertEq(
    (await fireStaff(moneyGame, 5, "auxiliar")).error,
    "not_found",
    "despedir quem já saiu é rejeitado",
  );

  // Sem saldo para a indemnização, o funcionário FICA (nunca saldo negativo).
  await run(
    dbMoney,
    "INSERT INTO team_staff (team_id, role, level, name, salary_weekly) VALUES (6, 'auxiliar', 5, 'Caro', 48000)",
  );
  await run(dbMoney, "UPDATE teams SET budget = 1000 WHERE id = 6");
  const poorFire = await fireStaff(moneyGame, 6, "auxiliar");
  assert(poorFire.ok === false, "despedimento sem saldo é recusado");
  assertEq(
    (await get(dbMoney, "SELECT COUNT(*) AS n FROM team_staff WHERE team_id = 6")).n,
    1,
    "funcionário recusado no despedimento fica no clube",
  );

  // ── C. Contratação automática dos NPCs ──────────────────────────────────
  await run(
    dbMoney,
    `INSERT INTO teams (id, name, division, budget) VALUES
       (10, 'NPC D1 rico', 1, 2000000),
       (11, 'NPC D4', 4, 1000000),
       (12, 'NPC D5 rico', 5, 2000000),
       (13, 'NPC D4 pobre', 4, 40000)`,
  );
  await ensureNpcStaff(moneyGame);
  assertEq(
    (await get(dbMoney, "SELECT level FROM team_staff WHERE team_id = 10 AND role = 'auxiliar'")).level,
    3,
    "NPC de D1 contrata auxiliar nível 3",
  );
  assertEq(
    (await get(dbMoney, "SELECT level FROM team_staff WHERE team_id = 11 AND role = 'auxiliar'")).level,
    1,
    "NPC de D4 contrata auxiliar nível 1",
  );
  assertEq(
    (await get(dbMoney, "SELECT COUNT(*) AS n FROM team_staff WHERE team_id = 12")).n,
    0,
    "divisão 5 não investe em funcionários",
  );
  assertEq(
    (await get(dbMoney, "SELECT COUNT(*) AS n FROM team_staff WHERE team_id = 13")).n,
    0,
    "NPC sem reserva de tesouraria não contrata",
  );
  assertEq(
    (await get(dbMoney, "SELECT COUNT(*) AS n FROM team_staff WHERE team_id = 5")).n,
    2,
    "equipa humana não é tocada pela contratação automática",
  );
  await ensureNpcStaff(moneyGame);
  assertEq(
    (await get(dbMoney, "SELECT COUNT(*) AS n FROM team_staff WHERE team_id = 10")).n,
    2,
    "NPC preenche o 2.º papel na semana seguinte",
  );
  await ensureNpcStaff(moneyGame);
  assertEq(
    (await get(dbMoney, "SELECT COUNT(*) AS n FROM team_staff WHERE team_id = 10")).n,
    3,
    "NPC enche os 3 lugares (4 papéis para 3 lugares)",
  );
  await ensureNpcStaff(moneyGame);
  assertEq(
    (await get(dbMoney, "SELECT COUNT(*) AS n FROM team_staff WHERE team_id = 10")).n,
    3,
    "sem lugares livres o NPC para de contratar",
  );

  // ── D. Efeitos no treino ────────────────────────────────────────────────
  const dbTrain = openDb(TRAIN_SCHEMA);
  await run(
    dbTrain,
    `INSERT INTO teams (id, name, division, budget) VALUES
       (1, 'Auxiliar L5', 1, 0), (2, 'Sem equipa técnica', 1, 0),
       (3, 'Físico L5', 1, 0), (4, 'Sem equipa técnica 2', 1, 0)`,
  );
  await run(
    dbTrain,
    `INSERT INTO team_staff (team_id, role, level, name, salary_weekly) VALUES
       (1, 'auxiliar', 5, 'A', 48000), (1, 'fisico', 5, 'B', 48000), (3, 'fisico', 5, 'C', 48000)`,
  );
  // Um titular por equipa (todos no mesmo onze) + um suplente em 1 e 2 para
  // medir a recuperação de forma de quem descansa.
  await run(
    dbTrain,
    `INSERT INTO players (id, team_id, name, position, skill, form, resistance, potential) VALUES
       (1, 1, 'Titular A', 'MED', 20, 32, 26, 50),
       (2, 2, 'Titular B', 'MED', 20, 32, 26, 50),
       (3, 3, 'Titular C', 'MED', 20, 32, 26, 50),
       (4, 4, 'Titular D', 'MED', 20, 32, 26, 50),
       (5, 1, 'Suplente A', 'MED', 20, 30, 26, 50),
       (6, 2, 'Suplente B', 'MED', 20, 30, 26, 50)`,
  );
  await run(
    dbTrain,
    `INSERT INTO team_training (team_id, matchweek, training_focus, applied) VALUES
       (1, 0, 'Médios', 0), (2, 0, 'Médios', 0),
       (3, 0, 'Resistência', 0), (4, 0, 'Resistência', 0)`,
  );
  const trainGame: any = {
    db: dbTrain,
    roomCode: "TESTTRAIN",
    season: 1,
    calendarIndex: 0,
    playersByName: {
      a: { teamId: 1 },
      b: { teamId: 2 },
      c: { teamId: 3 },
      d: { teamId: 4 },
    },
  };
  const fixtures = [{ homeLineup: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }], awayLineup: [] }];
  await applyTrainingBonuses(trainGame, fixtures, 0);

  const p = (id: number) => get(dbTrain, "SELECT * FROM players WHERE id = ?", [id]);

  // Auxiliar: +40% de progresso (mesmo jogador, mesma forma e potencial).
  const p1 = await p(1);
  const p2 = await p(2);
  assertEq(p2.skill, 23, "sem funcionário: 3 pontos de skill na semana (referência)");
  assertEq(p1.skill, 24, "com auxiliar nível 5: +40% de progresso dá 1 ponto a mais");
  assertEq(p1.training_skill_progress, 0.96, "progresso com auxiliar (+40%)");
  assertEq(p2.training_skill_progress, 0.4, "progresso sem funcionário");

  // Preparador físico: quem descansa recupera +4 vs +2 ao nível 5.
  assertEq((await p(5)).form, 34, "suplente com preparador físico nível 5: +4 forma");
  assertEq((await p(6)).form, 32, "suplente sem funcionário: +2 forma");

  // Resistência treinada: +0.5 por nível (4.9 → 7.4 ao nível 5).
  assertEq((await p(3)).resistance, 33, "resistência com preparador físico nível 5");
  assertEq((await p(4)).resistance, 30, "resistência sem funcionário");

  // Decaimento de resistência travado: -8%/nível (0.92 → 0.552).
  assertEq(p1.resistance, 25, "titular com preparador físico desgasta-se menos");
  assertEq(p1.training_resistance_progress, 0.45, "desgaste travado (-40%) no acumulador");
  assertEq(p2.resistance, 25, "titular sem funcionário desgasta 1 ponto");
  assertEq(p2.training_resistance_progress, 0.08, "desgaste cheio no acumulador");

  // ── E. Director de Comunicação: lotação ─────────────────────────────────
  // Mesmo jogo (mesma seed de jitter), mesma equipa: só a linha do staff muda.
  const dbAtt = openDb(`
    CREATE TABLE teams (id INTEGER PRIMARY KEY, name TEXT, stadium_capacity INTEGER, division INTEGER, avg_attendance INTEGER, fans_mood INTEGER, ticket_price INTEGER, points INTEGER, goals_for INTEGER, goals_against INTEGER);
    CREATE TABLE matches (id INTEGER PRIMARY KEY AUTOINCREMENT, matchweek INTEGER, home_team_id INTEGER, away_team_id INTEGER, home_score INTEGER, away_score INTEGER, played INTEGER);
    CREATE TABLE players (id INTEGER PRIMARY KEY, team_id INTEGER, skill INTEGER);
    CREATE TABLE team_staff (team_id INTEGER, role TEXT, level INTEGER);
  `);
  await run(
    dbAtt,
    "INSERT INTO teams (id, name, stadium_capacity, division, avg_attendance, fans_mood, ticket_price, points, goals_for, goals_against) VALUES (1, 'Casa', 60000, 1, 0, 22, 15, 10, 10, 8), (2, 'Fora', 60000, 1, 0, 22, 15, 8, 8, 10)",
  );
  await run(
    dbAtt,
    "INSERT INTO players (id, team_id, skill) VALUES (1, 1, 30), (2, 2, 30)",
  );
  const attBefore = await calculateMatchAttendance(dbAtt, 1, 2);
  await run(dbAtt, "INSERT INTO team_staff (team_id, role, level) VALUES (1, 'comunicacao', 5)");
  const attAfter = await calculateMatchAttendance(dbAtt, 1, 2);
  assert(
    attAfter > attBefore,
    `director de comunicação enche mais o estádio (${attBefore} → ${attAfter})`,
  );
  assert(
    attAfter - attBefore >= Math.floor(attBefore * 0.08),
    `o ganho é da ordem dos +10% do nível 5 (${attAfter - attBefore} bilhetes)`,
  );

  // ── F. Director de Comunicação: decaimento do ânimo dos adeptos ─────────
  // Par idêntico (div 4, mood 45 → base 25): sem staff −3 (42); com nível 5
  // −1.8 sobre o total (43.2 → CAST 43). Os dois não jogam, logo não há delta
  // de resultado a mascarar o efeito.
  const dbFans = openDb(`
    CREATE TABLE teams (id INTEGER PRIMARY KEY, morale INTEGER DEFAULT 50, fans_mood INTEGER, division INTEGER);
    CREATE TABLE matches (id INTEGER PRIMARY KEY AUTOINCREMENT, season INTEGER, matchweek INTEGER, home_team_id INTEGER, away_team_id INTEGER, home_score INTEGER, away_score INTEGER);
    CREATE TABLE players (id INTEGER PRIMARY KEY, team_id INTEGER, position TEXT, skill INTEGER, potential INTEGER, form INTEGER, games_played INTEGER, last_appearance_matchweek INTEGER, joined_matchweek INTEGER, injury_until_matchweek INTEGER, suspension_until_matchweek INTEGER);
    CREATE TABLE team_staff (team_id INTEGER, role TEXT, level INTEGER);
  `);
  await run(
    dbFans,
    "INSERT INTO teams (id, morale, fans_mood, division) VALUES (1, 50, 30, 4), (2, 50, 30, 4), (7, 50, 45, 4), (8, 50, 45, 4)",
  );
  // Nota: `db.run` só executa a PRIMEIRA instrução — cada INSERT vai separado.
  await run(
    dbFans,
    "INSERT INTO team_staff (team_id, role, level) VALUES (8, 'comunicacao', 5)",
  );
  await applyPostMatchQualityEvolution(
    dbFans as never,
    [{ homeTeamId: 1, awayTeamId: 2, finalHomeGoals: 1, finalAwayGoals: 1 }],
    1,
    1,
  );
  const mood7 = (await get(dbFans, "SELECT fans_mood FROM teams WHERE id = 7")).fans_mood;
  const mood8 = (await get(dbFans, "SELECT fans_mood FROM teams WHERE id = 8")).fans_mood;
  assertEq(mood7, 42, "sem comunicação o ânimo decai para a base (−3)");
  assertEq(mood8, 43, "comunicação nível 5 trava o decaimento (−1.8 → −1)");

  console.log("\nAll assertions passed.");
  dbMoney.close();
  dbTrain.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
