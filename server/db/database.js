const sqlite3 = require("sqlite3").verbose();
const path = require("path");
// Resolve the DB path relative to the project root (process.cwd()) so it
// works both when run directly (node db/seed.js) and from the compiled dist/
// output (node dist/index.js), both of which are executed from /app.
const dbPath = process.env.DB_PATH || path.join(process.cwd(), "db", "base.db");
const db = new sqlite3.Database(dbPath);
db.run("PRAGMA foreign_keys = ON", (err) => {
  if (err) console.error("[db] Failed to enable foreign keys:", err.message);
});
// busy_timeout: evita "database is locked" quando múltiplos processos/reads
// acedem à base em simultâneo (ex.: audits durante o runtime).
db.run("PRAGMA busy_timeout = 5000");
// Nota: a base permanece em journal_mode padrão (DELETE) de propósito —
// é copiada via fs.copyFileSync ao criar salas; WAL criaria ficheiros -wal
// separados que ficariam por copiar.
module.exports = db;
