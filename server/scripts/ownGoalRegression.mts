/**
 * Regression — own-goals (auto-golos).
 *
 * Corre a engine REAL (`simulateMatchSegment`) em centenas de jogos seedados e
 * valida:
 *
 *   O1 — frequência: pelo menos um own-goal aparece no agregado dos jogos
 *        (a feature não pode "sumir" silenciosamente)
 *   O2 — score ↔ eventos: finalHomeGoals/finalAwayGoals == nº de eventos-golo
 *        da equipa em cada minuto (own_goal conta, tal como `goal`/`penalty_goal`)
 *   O3 — lado correto: o autor do auto-golo pertence ao squad da equipa que
 *        SOFREU o golo (oposta ao `event.team`, que é a beneficiada)
 *   O4 — sem crédito estatístico: players.goals do autor NÃO incrementa
 *   O5 — higiene do evento: minuto correto, team válido, playerName presente
 *
 * Run: cd server && npm run test:own-goal
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const sqlite3 = require("sqlite3");
const { simulateMatchSegment } = require("../game/engine.ts");
const {
  withJuniorGRs,
  ensureFullBench,
  isPlayerAvailable,
} = require("../game/playerUtils.ts");

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
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ (t >>> 14);
    return ((t >>> 0) % 4294967296) / 4294967296;
  };
}

const GOAL_TYPES = new Set(["goal", "penalty_goal", "own_goal"]);
const isGoalType = (e: any) => GOAL_TYPES.has(e.type);

const START_MIN = 1;
const END_MIN = 45; // meia-época — golos bastantes, corrida rápida
const MATCHES = Number(process.env.MATCHES || 300);
const MATCHWEEK = 3;
const CALENDAR_INDEX = 5;

interface MatchResult {
  seed: number;
  fixture: any;
}

/**
 * Reconstrói o conjunto exato de jogadores que podem estar em campo para a
 * equipa (mesmo pipeline do engine no arranque do segmento): jogadores
 * disponíveis na DB + juniores gerados. Qualquer sub/lesão/expulsão apenas
 * retira/troca DENTRO deste conjunto, por isso é um sobreconjunto seguro.
 */
function buildSquadMembership(
  db: sqlite3.Database,
  teamId: number,
): Promise<Set<number>> {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM players WHERE team_id = ?", [teamId], (err, rows) => {
      if (err) return reject(err);
      const available = ((rows as any[]) || []).filter((p) =>
        isPlayerAvailable(p, MATCHWEEK),
      );
      const squad = ensureFullBench(
        withJuniorGRs(available, teamId, MATCHWEEK),
        teamId,
        MATCHWEEK,
      ) as any[];
      resolve(new Set(squad.map((p) => p.id)));
    });
  });
}

function snapshotGoals(db: sqlite3.Database): Promise<Map<number, number>> {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT id, goals FROM players WHERE team_id IS NOT NULL",
      (err, rows) => {
        if (err) return reject(err);
        const m = new Map<number, number>();
        for (const r of (rows as any[]) || []) m.set(r.id, r.goals || 0);
        resolve(m);
      },
    );
  });
}

async function runMatch(
  db: sqlite3.Database,
  seed: number,
  homeId: number,
  awayId: number,
  homeSquadIds: Set<number>,
  awaySquadIds: Set<number>,
): Promise<MatchResult> {
  const rng = makeRng(seed);
  const realRandom = Math.random;
  Math.random = () => rng();

  const game: any = {
    roomCode: "OWNREG",
    calendarIndex: CALENDAR_INDEX,
    matchweek: MATCHWEEK,
    pendingMatchAction: null,
    playersByName: {},
  };
  const io: any = {
    to: (_room: string) => ({
      emit: (ev: string, data: any) => {
        if (ev === "matchActionRequired") {
          const pending = game.pendingMatchAction;
          if (!pending) return;
          setTimeout(() => {
            if (game.pendingMatchAction?.actionId === pending.actionId) {
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
    homeTeam: "Home Own",
    awayTeam: "Away Own",
    finalHomeGoals: 0,
    finalAwayGoals: 0,
    events: [] as any[],
    season: 1,
    matchweek: MATCHWEEK,
  };
  const homeTactic = { formation: "4-4-2", style: "Balanced", positions: {} };
  const awayTactic = { formation: "4-4-2", style: "Balanced", positions: {} };

  const preGoals = await snapshotGoals(db);

  try {
    for (let m = START_MIN; m <= END_MIN; m++) {
      const beforeCount = fixture.events.length;
      await simulateMatchSegment(
        db,
        fixture,
        homeTactic,
        awayTactic,
        m,
        m,
        { game, io, matchweek: MATCHWEEK, calendarIndex: CALENDAR_INDEX },
      );

      const events = fixture.events;
      const newEvents = events.slice(beforeCount);

      // O2 — score ↔ eventos em cada minuto
      check(
        fixture.finalHomeGoals ===
          events.filter((e) => isGoalType(e) && e.team === "home").length,
        `O2 seed=${seed} m=${m}: finalHomeGoals=${fixture.finalHomeGoals} != golos em eventos (own_goal incluído)`,
      );
      check(
        fixture.finalAwayGoals ===
          events.filter((e) => isGoalType(e) && e.team === "away").length,
        `O2 seed=${seed} m=${m}: finalAwayGoals=${fixture.finalAwayGoals} != golos em eventos (own_goal incluído)`,
      );

      // O5 — higiene: cada evento nasce no minuto corrente, sem backdating
      for (const e of newEvents) {
        check(e.minute === m, `O5 seed=${seed} m=${m}: evento "${e.type}" com minuto ${e.minute}`);
        if (e.type === "own_goal") {
          check(
            (e.team === "home" || e.team === "away") && !!e.playerName,
            `O5 seed=${seed} m=${m}: own_goal malformado ${JSON.stringify(e).slice(0, 160)}`,
          );
        }
      }
    }
    // Dar tempo ao auto-finalize do penálti (timeout de 10ms no mock io)
    // para escrever na DB antes do close — evita SQLITE_READONLY órfão.
    await new Promise((r) => setTimeout(r, 50));
  } finally {
    Math.random = realRandom;
  }

  const postGoals = await snapshotGoals(db);

  // O3 + O4 — por own-goal
  for (const e of fixture.events.filter((x: any) => x.type === "own_goal")) {
    const culpritSide = e.team === "home" ? awaySquadIds : homeSquadIds;
    check(
      culpritSide.has(e.playerId),
      `O3 seed=${seed}: autor do auto-golo (id=${e.playerId}) não pertence ao squad da equipa que sofreu (${fixture[`${e.team}Team`]})`,
    );
    if (typeof e.playerId === "number" && e.playerId > 0) {
      check(
        postGoals.get(e.playerId) === preGoals.get(e.playerId),
        `O4 seed=${seed}: players.goals do autor (${e.playerId}) mudou de ${preGoals.get(e.playerId)} para ${postGoals.get(e.playerId)}`,
      );
    }
  }

  return { seed, fixture };
}

async function main() {
  // Copy de base.db para não mutar o template
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "owngoal-reg-"));
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

  // Squad membership pré-computado (não muda entre copies — mesma base)
  const baseDb: any = new sqlite3.Database(dbPath);
  const homeSquadIds = await buildSquadMembership(baseDb, homeId);
  const awaySquadIds = await buildSquadMembership(baseDb, awayId);
  baseDb.close();

  console.log(
    `A correr ${MATCHES} jogos simulados (min ${START_MIN}-${END_MIN}, equipas ${homeId} vs ${awayId}) contra a engine real…`,
  );

  const results: MatchResult[] = [];
  for (let seed = 1; seed <= MATCHES; seed++) {
    // copy fresca por jogo — a engine muta players/teams (games_played, morale…)
    const matchDbPath = path.join(tmpDir, `m${seed}.db`);
    fs.copyFileSync(dbPath, matchDbPath);
    const dbForMatch: any = new sqlite3.Database(matchDbPath);
    dbForMatch.on?.("error", (_e: any) => {
      // Erro de statement órfão (ex.: auto-finalize pós-close): o próprio
      // run faz os asserts — não crashar o processo por um erro solto.
    });
    const res = await runMatch(
      dbForMatch,
      seed,
      homeId,
      awayId,
      homeSquadIds,
      awaySquadIds,
    );
    dbForMatch.close();
    fs.rmSync(matchDbPath, { force: true });
    results.push(res);
  }

  // O1 — frequência agregada
  let totalOwn = 0;
  let matchesWithOwn = 0;
  const samples: string[] = [];
  for (const { seed, fixture } of results) {
    const ownEvents = fixture.events.filter((e: any) => e.type === "own_goal");
    if (ownEvents.length > 0) {
      matchesWithOwn++;
      if (samples.length < 8) {
        samples.push(
          `seed=${seed} ${fixture.finalHomeGoals}-${fixture.finalAwayGoals}: ` +
            ownEvents
              .map((e: any) => `${e.minute}' ${e.team}/${e.playerName}`)
              .join(" · "),
        );
      }
    }
    totalOwn += ownEvents.length;
  }

  check(
    totalOwn > 0,
    `O1: nenhum own_goal em ${MATCHES} jogos — feature parece morta`,
  );

  console.log(`\nJogos com own-goal: ${matchesWithOwn}/${MATCHES} (${totalOwn} no total)`);
  for (const s of samples) console.log(`  ${s}`);

  fs.rmSync(tmpDir, { recursive: true, force: true });

  if (failures > 0) {
    console.error(
      `\n❌ ownGoalRegression: ${failures} falha(s) de invariante — ver acima`,
    );
    process.exit(1);
  }
  console.log(`\n✅ ownGoalRegression: todas as invariantes passaram (${totalOwn} own-goals em ${MATCHES} jogos)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
