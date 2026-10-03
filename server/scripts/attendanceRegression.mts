/**
 * Regression test — assistências dinâmicas com mood dos adeptos.
 *
 * Modelo (coreHelpers.computeAttendance): a assistência deriva do entusiasmo
 * (mood 45% + forma com recência 35% + posição 20%) sobre um chão de fiéis por
 * divisão, com bónus contextuais (dérbi, líder, título), multiplicadores
 * (Taça, meteo, preço) e choques determinísticos por jogo (jitter ±10%,
 * noite mágica, deserção em crise). O avg_attendance histórico DEIXOU de ser
 * piso — crises reais esvaziam o estádio (ver cenário 2).
 *
 * Run: cd server && npm run test:attendance
 */
import { createRequire } from "node:module";
import sqlite3 from "sqlite3";

const require = createRequire(import.meta.url);
const { calculateMatchAttendance, explainAttendance } = require("../coreHelpers.ts") as {
  calculateMatchAttendance: typeof import("../coreHelpers").calculateMatchAttendance;
  explainAttendance: typeof import("../coreHelpers").explainAttendance;
};

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`ok  - ${msg}`);
}

const CAP = 10000;

interface SetupOpts {
  mood?: number;
  ticket?: number;
  /** resultados da equipa 1 (home=true → joga em casa) */
  results?: Array<{ home: boolean; gf: number; ga: number }>;
  /** pontos [t1, t2, t3, t4] na divisão 1 (controla posição) */
  points?: [number, number, number, number];
  /** divisão do adversário (2) e skill (2) */
  oppDivision?: number;
  oppSkill?: number;
}

async function setupDb(overrides: SetupOpts = {}) {
  const db = new sqlite3.Database(":memory:");
  const run = (sql: string, params: any[] = []) =>
    new Promise<void>((resolve, reject) => {
      db.run(sql, params, (err) => (err ? reject(err) : resolve()));
    });

  await run(
    "CREATE TABLE teams (id INTEGER PRIMARY KEY, name TEXT, stadium_capacity INTEGER, division INTEGER, avg_attendance INTEGER, fans_mood INTEGER, ticket_price INTEGER, points INTEGER, goals_for INTEGER, goals_against INTEGER)",
  );
  await run(
    "CREATE TABLE matches (id INTEGER PRIMARY KEY AUTOINCREMENT, matchweek INTEGER, home_team_id INTEGER, away_team_id INTEGER, home_score INTEGER, away_score INTEGER, played INTEGER)",
  );
  await run(
    "CREATE TABLE players (id INTEGER PRIMARY KEY, team_id INTEGER, skill INTEGER)",
  );
  // Funcionários (Director de Comunicação): a lotação leva o bónus do nível.
  await run(
    "CREATE TABLE team_staff (team_id INTEGER, role TEXT, level INTEGER)",
  );

  const pts = overrides.points ?? [10, 10, 10, 10];
  const names = ["Casa", "Rival", "Meio", "Fundo"];
  for (let i = 0; i < 4; i++) {
    await run(
      "INSERT INTO teams (id, name, stadium_capacity, division, avg_attendance, fans_mood, ticket_price, points, goals_for, goals_against) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)",
      [
        i + 1,
        names[i],
        CAP,
        i === 1 ? (overrides.oppDivision ?? 1) : 1,
        4000,
        i === 0 ? (overrides.mood ?? 60) : 60,
        i === 0 ? (overrides.ticket ?? 15) : 15,
        pts[i],
      ],
    );
  }

  const results = overrides.results ?? [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const homeId = r.home ? 1 : 2;
    const awayId = r.home ? 2 : 1;
    const hs = r.home ? r.gf : r.ga;
    const as = r.home ? r.ga : r.gf;
    await run(
      "INSERT INTO matches (matchweek, home_team_id, away_team_id, home_score, away_score, played) VALUES (?, ?, ?, ?, ?, 1)",
      [i + 1, homeId, awayId, hs, as],
    );
  }

  const oppSkill = overrides.oppSkill ?? 50;
  await run("INSERT INTO players (id, team_id, skill) VALUES (10, 2, ?)", [oppSkill]);
  await run("INSERT INTO players (id, team_id, skill) VALUES (11, 2, ?)", [oppSkill]);

  return db;
}

const wins = (n: number, home = true) =>
  Array.from({ length: n }, () => ({ home, gf: 2, ga: 0 }));
const losses = (n: number, home = true) =>
  Array.from({ length: n }, (_, i) => ({
    home,
    gf: i === n - 1 && home ? 0 : 0,
    ga: i === n - 1 && home ? 3 : 2,
  }));

async function main() {
  // ── 1. Noite de gala: 5V + mood 90 + dérbi + líder → lotação esgotada ────
  {
    const db = await setupDb({
      mood: 90,
      results: wins(5),
      points: [15, 12, 6, 0],
    });
    const attendance = await calculateMatchAttendance(db, 1, 2);
    assert(
      attendance === CAP,
      `5V + mood 90 + dérbi esgota o estádio (obtido ${attendance}/${CAP})`,
    );
    db.close();
  }

  // ── 2. Crise real esvazia: 5D + mood 20 + último + visitante fraco ───────
  // Comportamento NOVO: o avg_attendance (4000) já não é piso. O chão agora é
  // o dos fiéis (35% div 1) modulado pelo entusiasmo quase nulo.
  {
    const db = await setupDb({
      mood: 20,
      results: losses(5),
      points: [0, 6, 9, 15],
      oppDivision: 2,
      oppSkill: 10,
    });
    const attendance = await calculateMatchAttendance(db, 1, 2);
    assert(
      attendance >= 2500 && attendance <= 4500,
      `5D + mood 20 esvazia bem abaixo do histórico (obtido ${attendance}, esperado 2500–4500)`,
    );
    const explained = await explainAttendance(db, 1, 2);
    assert(
      explained.attendance === attendance,
      `explainAttendance devolve o mesmo número (${explained.attendance})`,
    );
    assert(
      Array.isArray(explained.reasons) && explained.reasons.length <= 3,
      `motivos curtos para a UI (${JSON.stringify(explained.reasons)})`,
    );
    db.close();
  }

  // ── 3. Bilhetes baratos puxam gente, caros afastam ───────────────────────
  // Contexto neutro de propósito (adversário de outra divisão, fraco e sem ser
  // líder): com dérbi + adversário de peso + visita do líder o bónus saturava a
  // capacidade e os dois preços empatavam no teto — o teste não media nada.
  {
    const ctx = {
      mood: 25,
      results: wins(2),
      oppDivision: 2,
      oppSkill: 20,
      points: [6, 3, 15, 12] as [number, number, number, number],
    };
    const cheap = await setupDb({ ...ctx, ticket: 10 });
    const pricey = await setupDb({ ...ctx, ticket: 30 });
    const aCheap = await calculateMatchAttendance(cheap, 1, 2);
    const aPricey = await calculateMatchAttendance(pricey, 1, 2);
    assert(
      aCheap < CAP && aPricey < CAP,
      `o cenário do preço não satura a capacidade (${aCheap} e ${aPricey} < ${CAP})`,
    );
    assert(
      aCheap > aPricey,
      `bilhete a 10€ (${aCheap}) enche mais que a 30€ (${aPricey})`,
    );
    cheap.close();
    pricey.close();
  }

  // ── 4. Dérbi (mesma divisão) puxa mais que jogo banal ────────────────────
  {
    const derby = await setupDb({
      mood: 50,
      points: [6, 12, 9, 3],
      oppSkill: 30,
    });
    const banal = await setupDb({
      mood: 50,
      points: [6, 12, 9, 3],
      oppDivision: 2,
      oppSkill: 30,
    });
    const aDerby = await calculateMatchAttendance(derby, 1, 2);
    const aBanal = await calculateMatchAttendance(banal, 1, 2);
    assert(
      aDerby > aBanal,
      `dérbi (${aDerby}) puxa mais que adversário equivalente de outra divisão (${aBanal})`,
    );
    derby.close();
    banal.close();
  }

  // ── 5. Determinístico por jogo: mesma semente → mesmo número ─────────────
  {
    const db = await setupDb({ mood: 70, results: wins(3) });
    const ctx = { competition: "league" as const, season: 2, matchweek: 7 };
    const a = await calculateMatchAttendance(db, 1, 2, ctx);
    const b = await calculateMatchAttendance(db, 1, 2, ctx);
    assert(a === b, `duas chamadas iguais dão o mesmo número (${a})`);
    db.close();
  }

  // ── 6. Director de Comunicação (funcionário): +10% de lotação no nível 5 ─
  // Mesma equipa e mesmo jogo (mesma semente de jitter): só a linha do staff
  // muda, por isso a diferença é 100% do funcionário.
  {
    const db = await setupDb({
      mood: 25,
      oppDivision: 2,
      oppSkill: 20,
      points: [6, 3, 15, 12],
    });
    const before = await calculateMatchAttendance(db, 1, 2);
    await new Promise<void>((resolve, reject) => {
      db.run(
        "INSERT INTO team_staff (team_id, role, level) VALUES (1, 'comunicacao', 5)",
        (err: any) => (err ? reject(err) : resolve()),
      );
    });
    const after = await calculateMatchAttendance(db, 1, 2);
    assert(
      after > before,
      `comunicação nível 5 enche mais o estádio (${before} → ${after})`,
    );
    assert(
      after - before >= Math.floor(before * 0.08),
      `o ganho é da ordem dos +10% do nível 5 (${after - before} bilhetes)`,
    );
    db.close();
  }

  // ── 7. Taça: final enche mais que 16 avos ────────────────────────────────
  // Contexto neutro (adversário de outra divisão e sem ser líder): o que se
  // compara aqui é só o multiplicador da ronda, sem bónus a empurrar ao teto.
  {
    const db = await setupDb({
      mood: 25,
      oppDivision: 2,
      oppSkill: 20,
      points: [6, 3, 15, 12],
    });
    const early = await calculateMatchAttendance(db, 1, 2, {
      competition: "cup",
      cupRound: 1,
      season: 1,
      matchweek: 4,
    });
    const fin = await calculateMatchAttendance(db, 1, 2, {
      competition: "cup",
      cupRound: 5,
      season: 1,
      matchweek: 4,
    });
    assert(
      fin > early,
      `final da Taça (${fin}) enche mais que os 16 avos (${early})`,
    );
    db.close();
  }

  // ── 8. Limite de divisão mantém-se (divisão 5 → cap 4800) ────────────────
  {
    const db = new sqlite3.Database(":memory:");
    const run = (sql: string, params: any[] = []) =>
      new Promise<void>((resolve, reject) => {
        db.run(sql, params, (err) => (err ? reject(err) : resolve()));
      });
    await run(
      "CREATE TABLE teams (id INTEGER PRIMARY KEY, stadium_capacity INTEGER, division INTEGER, avg_attendance INTEGER, fans_mood INTEGER, ticket_price INTEGER, points INTEGER, goals_for INTEGER, goals_against INTEGER)",
    );
    await run(
      "CREATE TABLE matches (id INTEGER PRIMARY KEY AUTOINCREMENT, matchweek INTEGER, home_team_id INTEGER, away_team_id INTEGER, home_score INTEGER, away_score INTEGER, played INTEGER)",
    );
    await run(
      "CREATE TABLE players (id INTEGER PRIMARY KEY, team_id INTEGER, skill INTEGER)",
    );
    await run(
      "INSERT INTO teams (id, stadium_capacity, division, avg_attendance, fans_mood, ticket_price, points, goals_for, goals_against) VALUES (1, 10000, 5, NULL, 90, 15, 15, 0, 0)",
    );
    await run(
      "INSERT INTO teams (id, stadium_capacity, division, avg_attendance, fans_mood, ticket_price, points, goals_for, goals_against) VALUES (2, 10000, 5, NULL, 60, 15, 0, 0, 0)",
    );
    await run("INSERT INTO players (id, team_id, skill) VALUES (10, 2, 50)");
    for (let i = 0; i < 5; i++) {
      await run(
        "INSERT INTO matches (matchweek, home_team_id, away_team_id, home_score, away_score, played) VALUES (?, 1, 2, 3, 0, 1)",
        [i + 1],
      );
    }
    const attendance = await calculateMatchAttendance(db, 1, 2);
    assert(
      attendance === 4800,
      `forma perfeita respeita limite da divisão 5 (4800) — obtido ${attendance}`,
    );
    db.close();
  }

  console.log("\nTodos os testes passaram ✔");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
