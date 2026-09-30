import sqlite3 from "sqlite3";
import { runExec, serializeRoomTask } from "../coreHelpers.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const db: any = new sqlite3.Database(":memory:");
await runExec(db, "CREATE TABLE t (id INTEGER PRIMARY KEY, v INTEGER)");
await runExec(db, "INSERT INTO t (id, v) VALUES (1, 0)");

// Controlo: 16 BEGIN concorrentes SEM fila — reproduz o bug original.
let controlErrors = 0;
await Promise.all(
  Array.from({ length: 16 }, async () => {
    try {
      await runExec(db, "BEGIN");
      await sleep(5);
      await runExec(db, "COMMIT");
    } catch {
      controlErrors++;
      await runExec(db, "ROLLBACK").catch(() => {});
    }
  }),
);

// Alvo: 16 tarefas concorrentes COM fila — mesmo padrão do finalizeAuction.
let queuedErrors = 0;
for (let i = 0; i < 16; i++) {
  serializeRoomTask("PROOF", async () => {
    try {
      await runExec(db, "BEGIN");
      await sleep(5); // interleave garantido se houvesse concorrência
      await runExec(db, "UPDATE t SET v = v + 1 WHERE id = 1");
      await runExec(db, "COMMIT");
    } catch (e) {
      queuedErrors++;
      await runExec(db, "ROLLBACK").catch(() => {});
    }
  });
}
// Espera a fila esvaziar (cadeia por sala: última tarefa fecha a cadeia).
await new Promise<void>((resolve) => {
  const check = () => {
    serializeRoomTask("PROOF", async () => {});
    setTimeout(resolve, 50);
  };
  setTimeout(check, 1500);
});

const row: any = await new Promise((res, rej) =>
  db.get("SELECT v FROM t WHERE id = 1", (e: any, r: any) => (e ? rej(e) : res(r))),
);
console.log(`controlo sem fila: ${controlErrors}/16 BEGIN falharam (bug reproduzido: ${controlErrors > 0})`);
console.log(`com fila: ${queuedErrors} erros, contador=${row.v} (esperado 0 erros, 16)`);
if (!(controlErrors > 0 && queuedErrors === 0 && row.v === 16)) {
  console.error("PROVA FALHOU");
  process.exit(1);
}
console.log("PROVA OK");
process.exit(0);
