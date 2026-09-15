/**
 * Regression — congelamento da sala por treinador ausente + durabilidade.
 *
 * Sem sockets nem servidor: exercita a lógica pura dos assentos/pausa e a
 * gravação do ponto de controlo. É o teste que FALHA se alguém voltar a fazer
 * o servidor avançar (ou decidir) por conta de um treinador que não está lá —
 * o bug reportado: "o jogo avança para a próxima jornada automaticamente"
 * enquanto o telemóvel estava offline.
 *
 *   F1 — computeAbsentees: equipa na ronda sem presença = ausente
 *   F2 — lease dentro da grace conta como presente (um flape não congela)
 *   F3 — treinador sem equipa (despedido/espectador) nunca bloqueia
 *   F4 — assento libertado (leave/kick/despedida) não bloqueia
 *   F5 — waitForPresence: resolve logo se ninguém falta
 *   F6 — waitForPresence: bloqueia e resolve quando todos voltam
 *   F7 — room_events: append numerado + replay reconstrói fase/cursor
 *   F8 — saveMatchCheckpoint: golos/minuto sobrevivem ao round-trip
 *   F9 — applyMatchCheckpoint: checkpoint de OUTRA jornada/jogos é recusado
 *        (era este o bug do dilúvio de "minuto N já simulado": o checkpoint
 *        velho era colado às fixtures novas e a partida não jogava nada)
 *   F10 — lastSimulatedMinute: fallback do cursor de retoma
 *   F11 — resetAllReady: limpa o intent do assento E a projeção (um intent
 *        obsoleto a `true` fazia a sala avançar sem ninguém clicar Pronto)
 *
 * Run: cd server && npm run test:session-freeze
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sqlite3 = require("sqlite3").verbose();
const {
  computeAbsentees,
  waitForPresence,
  emitPresencePause,
  isSeatPresent,
  appendRoomEvent,
  loadEventSeq,
  replayEventsSince,
  applyRoomEvent,
  saveMatchCheckpoint,
  applyMatchCheckpoint,
  lastSimulatedMinute,
  resetAllReady,
  ensureRoomStateTables,
  PRESENCE_GRACE_MS,
} = require("../roomStateHelpers.ts");

const HOME = 10;
const AWAY = 20;

function makeGame(overrides: any = {}) {
  return {
    roomCode: "TEST01",
    db: null,
    seats: {},
    seatSeenAt: {},
    playersByName: {},
    lockedCoaches: new Set(),
    currentFixtures: [
      { homeTeamId: HOME, awayTeamId: AWAY },
    ],
    pauseWaiters: new Set(),
    pausedSince: null,
    eventSeq: 0,
    snapshotSeq: 0,
    gamePhase: "match_first_half",
    calendarIndex: 3,
    matchweek: 4,
    season: 1,
    liveMinute: 27,
    currentEvent: { type: "league", matchweek: 4 },
    matchCheckpoint: null,
    ...overrides,
  };
}

function seat(name: string, teamId: number | null, status = "member") {
  return {
    name,
    teamId,
    seatEpoch: 1,
    deviceId: "dev",
    lastSeenAt: Date.now(),
    intent: { ready: false },
    status,
  };
}

function ioStub() {
  const emitted: any[] = [];
  return {
    emitted,
    to: () => ({ emit: (evt: string, payload: any) => emitted.push({ evt, payload }) }),
  };
}

function openDb(): Promise<any> {
  return new Promise((resolve) => {
    const db = new sqlite3.Database(":memory:", () => resolve(db));
  });
}
const run = (db: any, sql: string, params: any[] = []) =>
  new Promise<void>((resolve) => db.run(sql, params, () => resolve()));
const get = (db: any, sql: string, params: any[] = []) =>
  new Promise<any>((resolve) => db.get(sql, params, (_e: any, r: any) => resolve(r ?? null)));

// ── F1/F2 ───────────────────────────────────────────────────────────────────
test("F1 — equipa na ronda sem presença conta como ausente", () => {
  const game: any = makeGame();
  game.seats["A"] = seat("A", HOME);
  game.seats["B"] = seat("B", AWAY);
  // Ninguém ligado (depois de um restart, por exemplo).
  assert.deepEqual(computeAbsentees(game), ["A", "B"]);

  // B liga-se → só A falta.
  game.playersByName["B"] = { name: "B", teamId: AWAY, socketId: "s1" };
  assert.deepEqual(computeAbsentees(game), ["A"]);
});

test("F2 — lease dentro da grace é presença (um flape não congela a sala)", () => {
  const game: any = makeGame();
  game.seats["A"] = seat("A", HOME);
  game.playersByName["A"] = { name: "A", teamId: HOME, socketId: null };
  // Socket caiu agora: lease fresco.
  game.seatSeenAt["A"] = Date.now();
  assert.equal(isSeatPresent(game, "A"), true);
  assert.deepEqual(computeAbsentees(game), []);

  // Lease velho (para lá da grace): ausente.
  game.seatSeenAt["A"] = Date.now() - PRESENCE_GRACE_MS - 1000;
  assert.equal(isSeatPresent(game, "A"), false);
  assert.deepEqual(computeAbsentees(game), ["A"]);
});

// ── F3/F4 ───────────────────────────────────────────────────────────────────
test("F3 — treinador sem equipa nunca bloqueia a ronda", () => {
  const game: any = makeGame();
  game.seats["Despedido"] = seat("Despedido", null);
  game.seats["A"] = seat("A", HOME);
  game.playersByName["A"] = { name: "A", teamId: HOME, socketId: "s1" };
  assert.deepEqual(computeAbsentees(game), []);
});

test("F4 — assento libertado (leave/kick/despedida) liberta o bloqueio", () => {
  const game: any = makeGame();
  game.seats["A"] = seat("A", HOME);
  assert.deepEqual(computeAbsentees(game), ["A"]);
  game.seats["A"].status = "kicked";
  assert.deepEqual(computeAbsentees(game), []);
});

// ── F5/F6 ───────────────────────────────────────────────────────────────────
test("F5 — waitForPresence resolve logo quando ninguém falta", async () => {
  const game: any = makeGame();
  game.seats["A"] = seat("A", HOME);
  game.playersByName["A"] = { name: "A", teamId: HOME, socketId: "s1" };
  let resolved = false;
  await waitForPresence(game, ioStub()).then(() => {
    resolved = true;
  });
  assert.equal(resolved, true);
});

test("F6 — waitForPresence bloqueia e resolve quando todos voltam", async () => {
  const game: any = makeGame();
  game.seats["A"] = seat("A", HOME);
  game.seats["B"] = seat("B", AWAY);
  const io = ioStub();

  let resolved = false;
  const pending = waitForPresence(game, io).then(() => {
    resolved = true;
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(resolved, false, "não pode avançar com ausentes");
  assert.ok(
    io.emitted.some((e: any) => e.evt === "roomPaused" && e.payload.coaches.length === 2),
    "tem de anunciar a pausa com quem falta",
  );

  // A volta → a sala descongela.
  game.playersByName["A"] = { name: "A", teamId: HOME, socketId: "s1" };
  game.playersByName["B"] = { name: "B", teamId: AWAY, socketId: "s2" };
  emitPresencePause(game, io);
  await pending;
  assert.equal(resolved, true);
  assert.ok(io.emitted.some((e: any) => e.evt === "roomResumed"));
});

// ── F7 ──────────────────────────────────────────────────────────────────────
test("F7 — room_events numera e o replay repõe fase/cursor", async () => {
  const db = await openDb();
  ensureRoomStateTables(db);
  await new Promise((r) => setTimeout(r, 30));

  const game: any = makeGame({ db });
  appendRoomEvent(game, null, "week_started", { calendarIndex: 3 });
  appendRoomEvent(game, null, "minute", { minute: 30 });
  appendRoomEvent(game, null, "week_finalized", { calendarIndex: 4, matchweek: 5 });
  await new Promise((r) => setTimeout(r, 40));

  assert.equal(game.eventSeq, 3);

  // Projeção "perdida" (como depois de um restart no meio da janela).
  const reloaded: any = makeGame({ db, eventSeq: 0, snapshotSeq: 0 });
  await new Promise<void>((resolve) =>
    loadEventSeq(reloaded, () => {
      replayEventsSince(reloaded, 0, () => resolve());
    }),
  );
  assert.equal(reloaded.eventSeq, 3);
  assert.equal(reloaded.calendarIndex, 4);
  assert.equal(reloaded.matchweek, 5);
  assert.equal(reloaded.gamePhase, "lobby");

  // applyRoomEvent direto (contrato do replay)
  const g2: any = makeGame({ gamePhase: "match_first_half" });
  applyRoomEvent(g2, { type: "phase_changed", payload: { phase: "match_halftime", liveMinute: 45 } });
  assert.equal(g2.gamePhase, "match_halftime");
  assert.equal(g2.liveMinute, 45);
  db.close();
});

// ── F8 ──────────────────────────────────────────────────────────────────────
test("F8 — saveMatchCheckpoint guarda minuto/golos para retomar", async () => {
  const db = await openDb();
  await run(db, "CREATE TABLE game_state (key TEXT PRIMARY KEY, value TEXT)");
  const game: any = makeGame({ db });
  game.currentFixtures = [
    {
      homeTeamId: HOME,
      awayTeamId: AWAY,
      finalHomeGoals: 2,
      finalAwayGoals: 1,
      events: [{ minute: 12, type: "goal" }],
      homeLineup: [{ id: 1 }],
      awayLineup: [{ id: 2 }],
      _t1: { formation: "4-4-2" },
      _t2: { formation: "4-3-3" },
      // Formatos REAIS do engine: amarelos são objeto, expulsos são Set.
      // Trocar isto rebenta a gravação (`_yellowCards is not iterable`).
      _yellowCards: { 1: 1, 7: 2 },
      _subbedOut: new Set([3, 4]),
      _simulatedMinutes: new Set([1, 2, 3]),
    },
  ];
  game.liveMinute = 27;

  saveMatchCheckpoint(game);
  await new Promise((r) => setTimeout(r, 30));

  const row = await get(db, "SELECT value FROM game_state WHERE key = 'matchCheckpoint'");
  assert.ok(row, "checkpoint gravado");
  const cp = JSON.parse(row.value);
  assert.equal(cp.liveMinute, 27);
  assert.equal(cp.fixtures[0].finalHomeGoals, 2);
  assert.equal(cp.fixtures[0].events.length, 1);
  assert.equal(cp.fixtures[0]._t2.formation, "4-3-3");
  assert.deepEqual(cp.fixtures[0]._yellowCards, { 1: 1, 7: 2 });
  assert.deepEqual(cp.fixtures[0]._subbedOut, [3, 4]);

  // Round-trip: o checkpoint gravado aplica-se à mesma jornada sem rebentar.
  const reloaded: any = makeGame({ db, calendarIndex: game.calendarIndex });
  reloaded.currentFixtures = [
    { homeTeamId: HOME, awayTeamId: AWAY },
  ];
  assert.equal(applyMatchCheckpoint(reloaded, cp), true);
  assert.deepEqual(reloaded.currentFixtures[0]._yellowCards, { 1: 1, 7: 2 });
  assert.equal(reloaded.currentFixtures[0]._subbedOut.has(4), true);
  assert.equal(reloaded.currentFixtures[0]._simulatedMinutes.has(3), true);
  db.close();
});

// ── F9 ──────────────────────────────────────────────────────────────────────
test("F9 — checkpoint de outra jornada/jogos é recusado", () => {
  const cpOf = (season: number, slot: number) => ({
    season,
    calendarIndex: slot,
    liveMinute: 45,
    phase: "match_first_half",
    fixtures: [
      {
        homeTeamId: HOME,
        awayTeamId: AWAY,
        finalHomeGoals: 2,
        finalAwayGoals: 1,
        events: [{ minute: 12, type: "goal" }],
        _simulatedMinutes: Array.from({ length: 45 }, (_, i) => i + 1),
      },
    ],
  });

  // Jornada seguinte: fixtures novas (mesmo par, mas outro slot).
  const game: any = makeGame({ calendarIndex: 4, season: 1 });
  game.currentFixtures = [{ homeTeamId: HOME, awayTeamId: AWAY }];
  assert.equal(
    applyMatchCheckpoint(game, cpOf(1, 3)),
    false,
    "slot diferente não pode aplicar",
  );
  assert.equal(
    (game.currentFixtures[0] as any)._simulatedMinutes,
    undefined,
    "minutos da jornada nova ficam limpos",
  );
  assert.equal(game.liveMinute, 27, "cursor da jornada nova intacto");

  // Outra época.
  assert.equal(applyMatchCheckpoint(game, cpOf(2, 4)), false);

  // Jogos diferentes (troca de adversário) no mesmo slot.
  const otherPair = cpOf(1, 4);
  otherPair.fixtures[0].awayTeamId = 999;
  assert.equal(applyMatchCheckpoint(game, otherPair), false);

  // Checkpoint DESTA jornada e DESTES jogos: aplica.
  assert.equal(applyMatchCheckpoint(game, cpOf(1, 4)), true);
  assert.equal((game.currentFixtures[0] as any).finalHomeGoals, 2);
  assert.equal((game.currentFixtures[0] as any)._simulatedMinutes.size, 45);
  assert.equal(game.liveMinute, 45);

  // Formato antigo (sem season/calendarIndex) é recusado mesmo com os jogos a
  // coincidir: é o caso real do log em produção, e aceitá-lo reintroduzia o
  // dilúvio quando o sorteio volta a dar o mesmo par noutra jornada.
  const legacy: any = cpOf(1, 4);
  delete legacy.season;
  delete legacy.calendarIndex;
  const fresh: any = makeGame({ calendarIndex: 4, season: 1 });
  fresh.currentFixtures = [{ homeTeamId: HOME, awayTeamId: AWAY }];
  assert.equal(applyMatchCheckpoint(fresh, legacy), false, "sem identidade: recusado");
  assert.equal(
    (fresh.currentFixtures[0] as any)._simulatedMinutes,
    undefined,
    "fixtures da sala ficam intocadas",
  );

  // Lixo não rebenta.
  assert.equal(applyMatchCheckpoint(game, null), false);
  assert.equal(applyMatchCheckpoint(game, { fixtures: "nope" }), false);
});

// ── F10 ─────────────────────────────────────────────────────────────────────
test("F10 — lastSimulatedMinute alimenta o cursor de retoma", () => {
  const game: any = makeGame({ liveMinute: null });
  game.currentFixtures = [
    { homeTeamId: HOME, awayTeamId: AWAY, _simulatedMinutes: new Set([1, 2, 3]) },
    { homeTeamId: 30, awayTeamId: 40, _simulatedMinutes: new Set([1, 2, 3, 4, 5]) },
    { homeTeamId: 50, awayTeamId: 60 },
  ];
  assert.equal(lastSimulatedMinute(game), 5);
  // Retoma: nunca começa em 1 com o segmento todo marcado.
  const from = Math.max(1, (game.liveMinute ?? lastSimulatedMinute(game)) + 1);
  assert.equal(from, 6);
  assert.equal(lastSimulatedMinute(makeGame()), 0);
});

// ── F11 ─────────────────────────────────────────────────────────────────────
test("F11 — resetAllReady limpa assento e projeção", () => {
  const writes: string[] = [];
  const game: any = makeGame({
    db: { run: (sql: string) => writes.push(sql) },
  });
  const a = seat("A", HOME);
  a.intent = { ready: true, formation: "4-3-3" };
  const b = seat("B", AWAY);
  b.intent = { ready: false };
  game.seats = { A: a, B: b };
  game.playersByName = {
    A: { name: "A", teamId: HOME, socketId: "s1", ready: true },
    B: { name: "B", teamId: AWAY, socketId: "s2", ready: true },
  };

  resetAllReady(game);

  assert.equal(game.seats.A.intent.ready, false, "intent do assento limpo");
  assert.equal(game.seats.A.intent.formation, "4-3-3", "tática preservada");
  assert.equal(game.playersByName.A.ready, false);
  assert.equal(game.playersByName.B.ready, false);
  // Só o assento que estava pronto é persistido.
  assert.equal(writes.length, 1);

  // Invariante: depois do reset nenhum membro pode aparecer pronto — é o que
  // o checkAllReady (por assento) usa para decidir avançar.
  assert.equal(
    Object.values(game.seats).every((x: any) => !x.intent.ready),
    true,
  );
});
