/**
 * Regression — congelamento da sala por treinador ausente + durabilidade.
 *
 * Sem sockets nem servidor: exercita a lógica pura dos assentos/pausa. É o
 * teste que FALHA se alguém voltar a fazer
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
 *   F8 — clearSeatPositions: quebra apaga o 11 do assento E da projeção
 *        (a retoma é sempre ao lobby, sem tática gravada)
 *   F9 — resetAllReady: limpa o intent do assento E a projeção (um intent
 *        obsoleto a `true` fazia a sala avançar sem ninguém clicar Pronto)
 *   F10 — kick a meio da ronda: libertar o assento resolve a espera pendente
 *        (é o contrato que o kickCoach usa fora do lobby para destravar)
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
  clearSeatPositions,
  releaseSeat,
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
test("F8 — clearSeatPositions apaga o 11 e preserva o resto", () => {
  const writes: string[] = [];
  const game: any = makeGame({
    db: { run: (sql: string) => writes.push(sql) },
  });
  const a = seat("A", HOME);
  a.intent = { ready: true, formation: "4-3-3", positions: { 1: 101, 9: 109 } };
  game.seats = { A: a };
  game.playersByName = {
    A: { name: "A", teamId: HOME, socketId: "s1", tactic: { positions: { 1: 101 } } },
  };

  clearSeatPositions(game);

  assert.deepEqual(game.seats.A.intent.positions, {}, "positions do assento limpas");
  assert.equal(game.seats.A.intent.ready, true, "ready do assento intacto");
  assert.equal(game.seats.A.intent.formation, "4-3-3", "formação intacta");
  assert.deepEqual(game.playersByName.A.tactic.positions, {}, "projeção limpa");
  assert.equal(writes.length, 1, "só o assento com 11 é persistido");
});

// ── F9 ──────────────────────────────────────────────────────────────────────
test("F9 — resetAllReady limpa assento e projeção", () => {
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

// ── F10 ─────────────────────────────────────────────────────────────────────
test("F10 — kick a meio da ronda resolve a espera pendente", async () => {
  const writes: any[] = [];
  const game: any = makeGame({
    db: { run: (sql: string, params: any[]) => writes.push([sql, params]) },
  });
  game.seats["A"] = seat("A", HOME);
  game.seats["B"] = seat("B", AWAY);
  game.playersByName["B"] = { name: "B", teamId: AWAY, socketId: "s2" };
  const io = ioStub();

  // A ausente congela a ronda (barreira de minuto / intervalo à espera).
  let resolved = false;
  const pending = waitForPresence(game, io).then(() => {
    resolved = true;
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(resolved, false, "não pode avançar com A ausente");

  // O admin expulsa A a meio do jogo: o assento libertado destrava a espera.
  releaseSeat(game, "A", "kicked");
  emitPresencePause(game, io);
  await pending;
  assert.equal(resolved, true);
  assert.ok(io.emitted.some((e: any) => e.evt === "roomResumed"));
  assert.ok(
    writes.some(([, params]: any[]) => params?.[0] === "A" && params?.[6] === "kicked"),
    "assento persistido como kicked",
  );
});
