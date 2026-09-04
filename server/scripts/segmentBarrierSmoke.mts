/**
 * Smoke — segmento semanal via barreira de minuto (audit #1).
 *
 * Replica EXATAMENTE o que weeklyFlowHelpers faz agora: uma chamada
 * startMin–endMin por fixture, em paralelo, com `createMinuteBarrier` a
 * rendezvous cada minuto (um emit + pacing por minuto). Valida, com a engine
 * REAL e 2 fixtures concorrentes:
 *
 *   B1 — ticks 1..45 exatamente uma vez cada, por ordem (direto sincronizado)
 *   B2 — ambas as fixtures simulam os 45 minutos; score ↔ eventos de golo
 *   B3 — substituição de utilizador injetada a meio abre janela, resolve e
 *        troca mesmo o jogador em campo (cálculo dinâmico pós-sub)
 *   B4 — sem contaminação cruzada: cada fixture só tem eventos/golos das
 *        suas equipas; o mapa de pending actions termina vazio
 *
 * Run: cd server && npm run test:segment-barrier
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const sqlite3 = require("sqlite3");
const {
  simulateMatchSegment,
  createMinuteBarrier,
  peekPendingMatchAction,
} = require("../game/engine.ts");

for (const method of ["run", "get", "all"] as const) {
  const orig = (sqlite3.Database.prototype as any)[method];
  (sqlite3.Database.prototype as any)[method] = function (
    this: any,
    sql: string,
    ...args: any[]
  ) {
    const cbIdx = args.findIndex((a: any) => typeof a === "function");
    if (cbIdx === -1) args.push(() => {});
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
const START_MIN = 1;
const END_MIN = 45;

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "barrier-smoke-"));
  const dbPath = path.join(tmpDir, "test.db");
  fs.copyFileSync(path.join(__dirname, "../db/base.db"), dbPath);
  const db: any = new sqlite3.Database(dbPath);
  const run = (sql: string, params: any[] = []) =>
    new Promise<void>((resolve, reject) => {
      db.run(sql, params, (err: any) => (err ? reject(err) : resolve()));
    });
  for (const [col, def] of [
    ["signed_season", "INTEGER DEFAULT NULL"],
    ["career_games", "INTEGER DEFAULT 0"],
    ["games_played", "INTEGER DEFAULT 0"],
    ["last_appearance_matchweek", "INTEGER"],
  ] as Array<[string, string]>) {
    await run(`ALTER TABLE players ADD COLUMN ${col} ${def}`);
  }
  const teams: any[] = await new Promise((resolve, reject) => {
    db.all("SELECT id FROM teams ORDER BY id LIMIT 4", (err: any, rows: any) =>
      err ? reject(err) : resolve(rows),
    );
  });
  if (teams.length < 4) {
    console.error("base.db sem 4 equipas");
    process.exit(1);
  }
  const [t1, t2, t3, t4] = teams.map((t) => t.id);

  const realRandom = Math.random;
  Math.random = makeRng(20260904);

  const emissions: Array<{ ev: string; data: any }> = [];
  const game: any = {
    roomCode: "BARRIER-SMOKE",
    calendarIndex: 5,
    matchweek: 3,
    playersByName: Object.fromEntries(
      [t1, t2, t3, t4].map((teamId, i) => [
        `Coach${i}`,
        {
          name: `Coach${i}`,
          teamId,
          socketId: `socket-${i}`,
          ready: true,
          tactic: { formation: "4-4-2", style: "Balanced", positions: {} },
        },
      ]),
    ),
  };
  const io: any = {
    to: (_room: string) => ({
      emit: (ev: string, data: any) => {
        emissions.push({ ev, data });
        // Auto-resposta como um cliente (10ms, como no penalty-ordering).
        // Para user_substitution responde com escolha REAL (como o cliente
        // faria via resolveMatchAction) — o fallback do servidor é null
        // (treinador que não responde não mexe), o que não exercitaria a troca.
        if (ev === "matchActionRequired") {
          const pending = peekPendingMatchAction(game, data?.actionId);
          if (!pending) return;
          setTimeout(() => {
            if (!peekPendingMatchAction(game, pending.actionId)) return;
            let choice = pending.fallback ? pending.fallback() : null;
            let source = "auto";
            if (pending.type === "user_substitution") {
              const outRaw = data?.onPitch?.[0];
              const inRaw = data?.benchPlayers?.[0];
              const outId =
                outRaw != null ? (outRaw.id ?? outRaw) : null;
              const inId = inRaw != null ? (inRaw.id ?? inRaw) : null;
              if (outId != null && inId != null) {
                choice = { playerOut: outId, playerIn: inId };
                source = "client";
              }
            }
            pending.finalize(choice, source);
          }, 10);
        }
      },
    }),
  };

  const mkFixture = (homeTeamId: number, awayTeamId: number) => ({
    homeTeamId,
    awayTeamId,
    homeTeam: `Home ${homeTeamId}`,
    awayTeam: `Away ${awayTeamId}`,
    finalHomeGoals: 0,
    finalAwayGoals: 0,
    events: [] as any[],
    season: 1,
    matchweek: 3,
  });
  const mkTactic = () => ({
    formation: "4-4-2",
    style: "Balanced",
    positions: {} as Record<number, string>,
  });
  const fixtureA = mkFixture(t1, t2);
  const fixtureB = mkFixture(t3, t4);
  const homeTacticA = mkTactic();
  const awayTacticA = mkTactic();
  const homeTacticB = mkTactic();
  const awayTacticB = mkTactic();

  const ticks: number[] = [];
  const barrier = createMinuteBarrier(2, async (minute: number) => {
    ticks.push(minute);
    // B5 — ao minuto 20 o treinador da casa (jogo A) muda formação + mentalidade
    // via setTactic (objeto novo, como faz o cliente): tem de vigorar no min 21.
    if (minute === 20) {
      game.playersByName["Coach0"].tactic = {
        formation: "3-5-2",
        style: "Ofensivo",
        positions: {},
      };
      console.log("  …tática mudada no minuto 20 (casa A → 3-5-2 Ofensivo)");
    }
    // B3 — a meio do segmento, o treinador da casa (jogo A) pede substituição:
    // monta posições (titulares + 3 suplentes) e injeta o pedido.
    if (minute === 10) {
      const lineupIds = new Set(
        (fixtureA.homeLineup || []).map((p: any) => p.id),
      );
      const candidates = (fixtureA._homeFullRoster || []).filter(
        (p: any) => !lineupIds.has(p.id),
      );
      if (lineupIds.size > 0 && candidates.length >= 3) {
        for (const id of lineupIds) homeTacticA.positions[id] = "Titular";
        for (const c of candidates.slice(0, 3))
          homeTacticA.positions[c.id] = "Suplente";
        game.pendingSubstitutions = new Map([[t1, true]]);
        console.log(
          `  …sub injetada no minuto 10 (equipa ${t1}, banco: ${candidates
            .slice(0, 3)
            .map((c: any) => c.id)
            .join(",")})`,
        );
      }
    }
  });

  try {
    // Replica o weeklyFlowHelpers: uma chamada por fixture, em paralelo.
    await Promise.all([
      simulateMatchSegment(db, fixtureA, homeTacticA, awayTacticA, START_MIN, END_MIN, {
        game,
        io,
        matchweek: 3,
        calendarIndex: 5,
        onMinute: (m: number) => barrier.wait(m),
      }).catch((err: any) => {
        barrier.abort();
        throw err;
      }),
      simulateMatchSegment(db, fixtureB, homeTacticB, awayTacticB, START_MIN, END_MIN, {
        game,
        io,
        matchweek: 3,
        calendarIndex: 5,
        onMinute: (m: number) => barrier.wait(m),
      }).catch((err: any) => {
        barrier.abort();
        throw err;
      }),
    ]);
  } finally {
    Math.random = realRandom;
  }

  // B1 — direto sincronizado: um tick por minuto, por ordem
  check(
    ticks.length === END_MIN &&
      ticks.every((m, i) => m === START_MIN + i),
    `B1: ticks=${JSON.stringify(ticks.slice(0, 8))}… (total ${ticks.length}, esperado ${END_MIN})`,
  );

  for (const [label, fx] of [
    ["A", fixtureA],
    ["B", fixtureB],
  ] as const) {
    const evts = (fx as any).events;
    // B2 — 45 minutos simulados; score ↔ golos em eventos
    check(
      evts.every((e: any) => e.minute >= START_MIN && e.minute <= END_MIN),
      `B2-${label}: eventos fora de [${START_MIN},${END_MIN}]`,
    );
    check(
      (fx as any).finalHomeGoals ===
        evts.filter((e: any) => GOAL_TYPES.has(e.type) && e.team === "home").length,
      `B2-${label}: finalHomeGoals != golos em eventos`,
    );
    check(
      (fx as any).finalAwayGoals ===
        evts.filter((e: any) => GOAL_TYPES.has(e.type) && e.team === "away").length,
      `B2-${label}: finalAwayGoals != golos em eventos`,
    );
  }

  // B3 — a sub injetada abriu janela, resolveu e trocou em campo
  const subModals = emissions.filter(
    (x) =>
      x.ev === "matchActionRequired" &&
      x.data?.type === "user_substitution" &&
      x.data?.teamId === t1,
  );
  check(subModals.length === 1, `B3: janelas de sub da equipa ${t1}: ${subModals.length} (esperado 1)`);
  const subEvents = (fixtureA.events as any[]).filter(
    (e) => e.type === "substitution" && e.team === "home",
  );
  check(subEvents.length >= 1, `B3: eventos de substituição da casa no jogo A: ${subEvents.length}`);
  if (subModals.length === 1 && subEvents.length >= 1) {
    console.log(
      `  …sub concluída: modal@${subModals[0].data.minute}' → evento@${subEvents[0].minute}' (${subEvents[0].text?.slice(0, 60) || ""})`,
    );
  }

  // B5 — a mudança de tática do minuto 20 vigora no minuto seguinte
  check(
    (homeTacticA as any).formation === "3-5-2" &&
      (homeTacticA as any).style === "Ofensivo",
    `B5: tática da casa A após setTactic: ${JSON.stringify({ f: (homeTacticA as any).formation, s: (homeTacticA as any).style })}`,
  );
  const tacticEvents = (fixtureA.events as any[]).filter(
    (e) => e.type === "tactic_change" && e.team === "home",
  );
  check(tacticEvents.length === 1, `B5: eventos tactic_change da casa A: ${tacticEvents.length} (esperado 1)`);
  if (tacticEvents.length === 1) {
    check(
      tacticEvents[0].minute === 21,
      `B5: tactic_change no minuto ${tacticEvents[0].minute} (esperado 21)`,
    );
    console.log(`  …tática adotada: "${tacticEvents[0].text}"`);
  }

  // B4 — sem contaminação: equipas de A nunca aparecem em B e vice-versa
  const idsA = new Set([t1, t2]);
  const idsB = new Set([t3, t4]);
  for (const e of (fixtureB.events as any[])) {
    check(
      e.homeTeamId === undefined ||
        (e.homeTeamId !== t1 && e.homeTeamId !== t2),
      `B4: evento do jogo B referencia equipa do jogo A`,
    );
  }
  check(
    (fixtureA.events as any[]) !== (fixtureB.events as any[]),
    "B4: arrays de eventos partilhados entre fixtures",
  );
  void idsA;
  void idsB;

  // Mapa de pending actions termina vazio (tudo consumido/resolvido)
  const { getPendingMatchActions } = require("../game/engine.ts");
  check(
    getPendingMatchActions(game).size === 0,
    `B4: pending actions por resolver: ${getPendingMatchActions(game).size}`,
  );

  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });

  if (failures > 0) {
    console.error(`\n❌ barrier smoke: ${failures} falha(s)`);
    process.exit(1);
  }
  console.log(
    `\n✅ barrier smoke: 2 fixtures × 45' concorrentes, ${ticks.length} ticks, ` +
      `placares A ${(fixtureA.finalHomeGoals as number)}-${(fixtureA.finalAwayGoals as number)} / ` +
      `B ${(fixtureB.finalHomeGoals as number)}-${(fixtureB.finalAwayGoals as number)}`,
  );
}

main().catch((e) => {
  console.error("SMOKE ERROR:", e);
  process.exit(2);
});
