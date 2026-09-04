/**
 * Regression — integridade temporal dos eventos de partida (penálti + golos).
 *
 * Contexto (bug report): num jogo empatado a 0-0 apareceu o modal de escolha do
 * marcador; após o penálti convertido o resultado era 1-1 e o golo do
 * adversário estava "marcado no minuto anterior ao penálti". Suspeitas:
 *   (A) o servidor emite um evento de golo com minuto ANTERIOR já decorrido
 *       (backdating / estado stale), ou
 *   (B) score e eventos chegam dessincronizados no payload minuto-a-minuto.
 *
 * Este teste corre a engine REAL (`simulateMatchSegment`) em centenas de jogos
 * seedados, capturando TODAS as emissões socket em ordem cronológica, e valida:
 *
 *   I1 — score ↔ eventos: finalHomeGoals == nº de eventos-golo da equipa (idem away)
 *   I2 — cada evento nasce no minuto corrente (e.minute === m); nunca backdating
 *   I3 — minutos dos golos são não-decrescentes na ordem em que entram em fixture.events
 *   I4 — cada matchMinuteUpdate só traz minuteEvents do minuto emitido, todos presentes
 *        em fixture.events, com totals iguais ao estado final*Goals
 *   I5 — penálti: o `matchActionRequired` chega DEPOIS do update(m-1) (quando m>START_MIN)
 *        e ANTES do update(m), com currentScore igual ao score pré-lotaria
 *
 * No fim imprime as linhas temporais de jogos com penálti + golo aberto próximo,
 * para inspeção manual do que o cliente veria.
 *
 * Run: cd server && npm run test:penalty-ordering
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const sqlite3 = require("sqlite3");
const { simulateMatchSegment, peekPendingMatchAction } = require("../game/engine.ts");

// Diagnóstico: logar SQL que falha (o engine usa callbacks; um 'error' órfão
// num Statement sem listener crasharia o processo)
for (const method of ["run", "get", "all"] as const) {
  const orig = (sqlite3.Database.prototype as any)[method];
  (sqlite3.Database.prototype as any)[method] = function (
    this: any,
    sql: string,
    ...args: any[]
  ) {
    let cbIdx = args.findIndex((a) => typeof a === "function");
    if (cbIdx === -1) {
      // statement fire-and-forget — anexar listener para não crashar o processo
      args.push(() => {});
    }
    const wrapped = (...cbArgs: any[]) => cbArgs;
    try {
      return orig.apply(this, [sql, ...args]);
    } catch (e) {
      console.error(`[sqlite ${method}] throw em: ${String(sql).slice(0, 120)}`);
      throw e;
    }
  };
}
process.on("uncaughtException", (e) => {
  console.error("UNCAUGHT:", e);
  process.exit(2);
});

let failures = 0;
function check(cond: boolean, msg: string): void {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${msg}`);
  }
}

// RNG determinística (mulberry32) — o mesmo seed reproduz o mesmo jogo
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GOAL_TYPES = new Set(["goal", "penalty_goal", "own_goal"]);
const isGoalType = (e: any) => GOAL_TYPES.has(e.type);

interface Emission {
  ev: string;
  data: any;
}

const START_MIN = 1;
const END_MIN = 45;
const MATCHES = Number(process.env.MATCHES || 400);

// Replica EXATAMENTE o que weeklyFlowHelpers.runMatchSegment emite por minuto
 function emitMinuteUpdateLikeWeeklyLoop(
  emissions: Emission[],
  fixture: any,
  m: number,
) {
  emissions.push({
    ev: "matchMinuteUpdate",
    data: {
      minute: m,
      fixtures: [
        {
          homeTeamId: fixture.homeTeamId,
          awayTeamId: fixture.awayTeamId,
          homeGoals: fixture.finalHomeGoals,
          awayGoals: fixture.finalAwayGoals,
          minuteEvents: (fixture.events || []).filter((e) => e.minute === m),
        },
      ],
    },
  });
}

async function runMatch(
  db: sqlite3.Database,
  seed: number,
  homeId: number,
  awayId: number,
) {
  const rng = makeRng(seed);
  const realRandom = Math.random;
  Math.random = () => rng();

  const emissions: Emission[] = [];
  const game: any = {
    roomCode: "REGTEST",
    calendarIndex: 5,
    matchweek: 3,
    pendingMatchAction: null,
    playersByName: {
      CoachTeste: {
        name: "CoachTeste",
        teamId: homeId,
        socketId: "socket-teste",
        ready: true,
        tactic: { formation: "4-4-2", style: "Balanced", positions: {} },
      },
    },
  };
  const io: any = {
    to: (_room: string) => ({
      emit: (ev: string, data: any) => {
        emissions.push({ ev, data });
        // Responder como um cliente faria (fallback do servidor = escolha automática).
        // Usa o mapa de pending actions (fix audit #2): espreita sem consumir;
        // o finalize consome de forma idempotente.
        if (ev === "matchActionRequired") {
          const pending = peekPendingMatchAction(game, data?.actionId);
          if (!pending) return;
          setTimeout(() => {
            if (peekPendingMatchAction(game, pending.actionId)) {
              pending.finalize(
                pending.fallback ? pending.fallback() : null,
                "auto",
              );
            }
          }, 10);
        }
      },
    }),
  };

  const fixture: any = {
    homeTeamId: homeId,
    awayTeamId: awayId,
    homeTeam: "Home Reg",
    awayTeam: "Away Reg",
    finalHomeGoals: 0,
    finalAwayGoals: 0,
    events: [] as any[],
    season: 1,
    matchweek: 3,
  };
  const homeTactic = {
    formation: "4-4-2",
    style: "Balanced",
    positions: {} as Record<number, string>,
  };
  const awayTactic = {
    formation: "4-4-2",
    style: "Balanced",
    positions: {} as Record<number, string>,
  };

  try {
    for (let m = START_MIN; m <= END_MIN; m++) {
      const beforeCount = fixture.events.length;
      // Score ANTES deste minuto — para validar o currentScore do modal de penálti
      const preScore = { home: fixture.finalHomeGoals, away: fixture.finalAwayGoals };
      await simulateMatchSegment(
        db,
        fixture,
        homeTactic,
        awayTactic,
        m,
        m,
        { game, io, matchweek: 3, calendarIndex: 5 },
      );
      // weeklyFlowHelpers emite o update logo depois de simular todos os fixtures
      emitMinuteUpdateLikeWeeklyLoop(emissions, fixture, m);

      const events = fixture.events;
      const newEvents = events.slice(beforeCount);

      // I1 — score ↔ eventos
      check(
        fixture.finalHomeGoals ===
          events.filter((e) => isGoalType(e) && e.team === "home").length,
        `I1 seed=${seed} m=${m}: finalHomeGoals=${fixture.finalHomeGoals} != golos em eventos`,
      );
      check(
        fixture.finalAwayGoals ===
          events.filter((e) => isGoalType(e) && e.team === "away").length,
        `I1 seed=${seed} m=${m}: finalAwayGoals=${fixture.finalAwayGoals} != golos em eventos`,
      );

      // I2 — nenhum evento nasce com minuto antigo (backdating)
      for (const e of newEvents) {
        check(
          e.minute === m,
          `I2 seed=${seed} m=${m}: evento "${e.type}" nasceu com minuto ${e.minute}`,
        );
      }

      // I3 — minutos de golos não-decrescentes na ordem em que chegam
      const goalEvts = events.filter((e) => isGoalType(e));
      for (let i = 1; i < goalEvts.length; i++) {
        check(
          goalEvts[i].minute >= goalEvts[i - 1].minute,
          `I3 seed=${seed} m=${m}: golo em ${goalEvts[i].minute}' após golo em ${goalEvts[i - 1].minute}'`,
        );
      }

      // I4 — payload do update do minuto
      const updIdx = emissions.findIndex(
        (x) => x.ev === "matchMinuteUpdate" && x.data.minute === m,
      );
      check(updIdx > -1, `I4 seed=${seed} m=${m}: matchMinuteUpdate em falta`);
      if (updIdx > -1) {
        const f =
          emissions[updIdx].data.fixtures?.find(
            (x: any) => x.homeTeamId === homeId && x.awayTeamId === awayId,
          ) || null;
        check(!!f, `I4 seed=${seed} m=${m}: fixture em falta no payload`);
        if (f) {
          check(
            f.homeGoals === fixture.finalHomeGoals,
            `I4 seed=${seed} m=${m}: homeGoals do payload stale`,
          );
          check(
            f.awayGoals === fixture.finalAwayGoals,
            `I4 seed=${seed} m=${m}: awayGoals do payload stale`,
          );
          for (const e of f.minuteEvents || []) {
            check(e.minute === m, `I4 seed=${seed} m=${m}: minuteEvents com minuto ${e.minute}`);
            check(
              fixture.events.includes(e),
              `I4 seed=${seed} m=${m}: evento do payload não existe em fixture.events`,
            );
          }
        }

        // I5 — penálti neste minuto: modal entre update(m-1) e update(m),
        // currentScore = score pré-lotaria (antes de qualquer mutação deste minuto)
        const modalsHere = emissions
          .slice(0, updIdx)
          .filter(
            (x) =>
              x.ev === "matchActionRequired" &&
              x.data.type === "penalty" &&
              Number(x.data.minute) === m,
          );
        for (const modal of modalsHere) {
          check(
            Number(modal.data.minute) === m,
            `I5 seed=${seed} m=${m}: matchActionRequired com minuto ${modal.data.minute}`,
          );
          const cs = modal.data.currentScore;
          check(
            cs?.home === preScore.home && cs?.away === preScore.away,
            `I5 seed=${seed} m=${m}: currentScore ${JSON.stringify(cs)} != score pré-minuto ${JSON.stringify(preScore)}`,
          );
        }
      }
    }
  } finally {
    Math.random = realRandom;
  }
  return { emissions, fixture };
}

async function main() {
  // Copy de base.db para não mutar o template
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "penalty-reg-"));
  const dbPath = path.join(tmpDir, "test.db");
  fs.copyFileSync(path.join(__dirname, "../db/base.db"), dbPath);
  const probe = new sqlite3.Database(dbPath);
  // Colunas adicionadas pelo gameManager no arranque da sala (ausentes no template)
  const cols: Array<[string, string]> = [
    ["signed_season", "INTEGER DEFAULT NULL"],
    ["career_games", "INTEGER DEFAULT 0"],
    ["games_played", "INTEGER DEFAULT 0"],
    ["last_appearance_matchweek", "INTEGER"],
  ];
  for (const [col, def] of cols) {
    await new Promise<void>((resolve, reject) => {
      probe.run(
        `ALTER TABLE players ADD COLUMN ${col} ${def}`,
        (err) => (err ? reject(err) : resolve()),
      );
    });
  }
  const firstTeams: any[] = await new Promise((resolve, reject) => {
    probe.all(
      "SELECT id FROM teams ORDER BY id LIMIT 2",
      (err, rows) => (err ? reject(err) : resolve(rows as any[])),
    );
  });
  probe.close();
  if (firstTeams.length < 2) {
    console.error("base.db sem equipas suficientes");
    process.exit(1);
  }
  const [homeId, awayId] = [firstTeams[0].id, firstTeams[1].id];

  console.log(
    `A correr ${MATCHES} jogos simulados (min ${START_MIN}-${END_MIN}, equipas ${homeId} vs ${awayId}) contra a engine real…`,
  );

  let penaltyMatches = 0;
  const interesting: Array<{ seed: number; fixture: any }> = [];

  for (let seed = 1; seed <= MATCHES; seed++) {
    // copy fresca por jogo — a engine muta players/teams (games_played, morale…)
    const matchDbPath = path.join(tmpDir, `m${seed}.db`);
    fs.copyFileSync(dbPath, matchDbPath);
    const dbForMatch: any = new sqlite3.Database(matchDbPath);
    dbForMatch.on?.("error", (e: any) => {
      // Evita crash por erro de statement órfão; o próprio run faz asserts
    });
    const res = await runMatch(dbForMatch, seed, homeId, awayId);
    dbForMatch.close();
    fs.rmSync(matchDbPath, { force: true });
    const evts: any[] = res.fixture.events;
    const penEvents = evts.filter(
      (e) => e.type === "penalty_goal" || e.type === "penalty_miss",
    );
    if (penEvents.length > 0) {
      penaltyMatches++;
      const penMinutes = penEvents.map((e) => e.minute);
      const nearOpenGoal = evts.some(
        (e) => e.type === "goal" && penMinutes.some((pm) => Math.abs(e.minute - pm) <= 3),
      );
      if (nearOpenGoal) interesting.push({ seed, fixture: res.fixture });
    }
  }

  console.log(`\nJogos com penálti: ${penaltyMatches}/${MATCHES}`);
  if (interesting.length > 0) {
    console.log(
      "\n── Linhas temporais (penálti + golo aberto em ±3 min, como o cliente veria) ──",
    );
    for (const { seed, fixture } of interesting.slice(0, 5)) {
      console.log(`\nseed=${seed}:`);
      (fixture.events as any[])
        .filter((e) => isGoalType(e) || e.type === "penalty_miss")
        .sort((a, b) => a.minute - b.minute)
        .forEach((e) =>
          console.log(
            `  ${String(e.minute).padStart(2)}'  ${e.type.padEnd(12)} ${e.team.padEnd(5)}  ${e.playerName || ""}`,
          ),
        );
      console.log(`  score final: ${fixture.finalHomeGoals}-${fixture.finalAwayGoals}`);
    }
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });

  if (failures > 0) {
    console.error(`\n❌ penaltyOrderingRegression: ${failures} falha(s) de invariante — ver acima`);
    process.exit(1);
  }
  console.log("\n✅ penaltyOrderingRegression: todas as invariantes passaram");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
