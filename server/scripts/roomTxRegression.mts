/**
 * Regression — transações SQLite sem colisões (fila por sala).
 *
 *   T1 — duas tarefas `runRoomTask` com BEGIN/awaits/COMMIT em paralelo: ambas comitam
 *   T2 — uma tarefa que rejeita não parte a fila e o erro chega ao chamador
 *   T3 — um BEGIN falhado (fora do try) não fecha a transação aberta por outra tarefa
 *
 * Run: cd server && npm run test:room-tx
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sqlite3 = require("sqlite3").verbose();
const { runRoomTask, runExec, runGet } = require("../coreHelpers");

const open = () => new sqlite3.Database(":memory:");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("T1 — tarefas em paralelo comitam ambas", async () => {
  const db = open();
  await runExec(db, "CREATE TABLE t (v INTEGER)");
  const tx = (v: number) =>
    runRoomTask("T1", async () => {
      await runExec(db, "BEGIN");
      try {
        await runExec(db, "INSERT INTO t (v) VALUES (?)", [v]);
        await sleep(10);
        await runExec(db, "COMMIT");
      } catch (err) {
        await runExec(db, "ROLLBACK").catch(() => {});
        throw err;
      }
    });
  await Promise.all([tx(1), tx(2)]);
  const row = await runGet(db, "SELECT COUNT(*) AS n FROM t");
  assert.equal(row.n, 2);
});

test("T2 — tarefa que rejeita não parte a fila", async () => {
  const boom = runRoomTask("T2", async () => {
    throw new Error("boom");
  });
  const next = runRoomTask("T2", async () => 42);
  await assert.rejects(boom, /boom/);
  assert.equal(await next, 42);
});

test("T3 — BEGIN falhado fora do try não fecha a transação alheia", async () => {
  const db = open();
  await runExec(db, "CREATE TABLE t (v INTEGER)");
  await runExec(db, "BEGIN");
  await runExec(db, "INSERT INTO t (v) VALUES (1)");
  // Padrão 1a: o BEGIN falha (já há transação) e não se faz ROLLBACK.
  let beginFailed = false;
  try {
    await runExec(db, "BEGIN");
  } catch {
    beginFailed = true;
  }
  assert.ok(beginFailed);
  await runExec(db, "COMMIT"); // se a transação tivesse sido fechada, isto falhava
  const row = await runGet(db, "SELECT COUNT(*) AS n FROM t");
  assert.equal(row.n, 1);
});
