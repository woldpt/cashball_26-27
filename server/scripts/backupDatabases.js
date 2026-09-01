#!/usr/bin/env node
/**
 * backupDatabases.js — Backup consistente de todas as bases SQLite do Cashball.
 *
 * Usa a Online Backup API do sqlite3 npm (mesma primitiva do `sqlite3 .backup`):
 *   - funciona sem CLI sqlite3 (ex.: imagem Docker alpine);
 *   - é seguro correr com o server ativo (WAL/rollback journal suportados);
 *   - produz ficheiros .db completos e consistentes.
 *
 * Protocolo deste build do node-sqlite3: `db.backup(dest, cb)` só sinaliza o
 * init no callback — as páginas são copiadas via `backup.step(-1)` até
 * `done=true`, seguido de `backup.finish()` antes de fechar a origem.
 *
 * Uso manual / cron no host:
 *   node server/scripts/backupDatabases.js
 *
 * Variáveis de ambiente:
 *   DB_DIR          — diretório das bases (default: <server>/db)
 *   BACKUP_DIR      — raiz dos backups (default: <repo>/backups)
 *   RETENTION_COUNT — nº de snapshots a manter (default: 7)
 */
"use strict";

const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3");

const SERVER_DIR = path.join(__dirname, "..");
const REPO_ROOT = path.join(SERVER_DIR, "..");

const DB_DIR = process.env.DB_DIR || path.join(SERVER_DIR, "db");
const BACKUP_ROOT =
  process.env.BACKUP_DIR || path.join(REPO_ROOT, "backups");
const RETENTION_COUNT = Math.max(
  1,
  parseInt(process.env.RETENTION_COUNT || "7", 10),
);

function timestampDir() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

function listRoomDbs() {
  if (!fs.existsSync(DB_DIR)) return [];
  return fs
    .readdirSync(DB_DIR)
    .filter((f) => f.endsWith(".db") && fs.statSync(path.join(DB_DIR, f)).size > 0);
}

/** Backs up one source DB into destDir using the Online Backup API. */
function backupOne(srcFile, destDir) {
  return new Promise((resolve) => {
    const src = path.join(DB_DIR, srcFile);
    const dest = path.join(destDir, srcFile);
    let db;
    try {
      db = new sqlite3.Database(src, sqlite3.OPEN_READONLY);
    } catch (err) {
      console.error(`[backup] ${srcFile}: failed to open: ${err.message}`);
      resolve(false);
      return;
    }

    const fail = (msg) => {
      console.error(`[backup] ${srcFile}: ${msg}`);
      db.close(() => {});
      resolve(false);
    };

    const step = (attempt) => {
      backup.step(-1, (err, done) => {
        if (err) {
          // BUSY/LOCKED podem ocorrer com o server ativo — retry limitado.
          const code = err.errno || 0;
          if ((code === sqlite3.BUSY || code === sqlite3.LOCKED) && attempt < 10) {
            setTimeout(() => step(attempt + 1), 250);
            return;
          }
          return fail(err.message);
        }
        if (!done) return step(attempt);
        backup.finish((fErr) => {
          db.close((closeErr) => {
            const e = fErr || closeErr;
            if (e) {
              console.error(`[backup] ${srcFile}: ${e.message}`);
              resolve(false);
              return;
            }
            let size = 0;
            try {
              size = fs.statSync(dest).size;
            } catch {}
            console.log(
              `[backup] ${srcFile} → ${path.basename(destDir)}/${srcFile} (${(size / 1024).toFixed(1)} KB)`,
            );
            resolve(true);
          });
        });
      });
    };

    const backup = db.backup(dest, (initErr) => {
      if (initErr) return fail(`init: ${initErr.message}`);
      step(0);
    });
  });
}

/** Keeps only the newest RETENTION_COUNT timestamped snapshot dirs. */
function pruneOldBackups() {
  if (!fs.existsSync(BACKUP_ROOT)) return;
  const stampRe = /^\d{8}_\d{6}$/;
  const stamps = fs
    .readdirSync(BACKUP_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && stampRe.test(e.name))
    .map((e) => e.name)
    .sort();
  const excess = stamps.length - RETENTION_COUNT;
  for (let i = 0; i < excess; i++) {
    const dir = path.join(BACKUP_ROOT, stamps[i]);
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`[backup] pruned old snapshot ${stamps[i]}`);
  }
}

async function runBackup() {
  const dbs = listRoomDbs();
  if (dbs.length === 0) {
    console.warn(`[backup] no databases found in ${DB_DIR} — nothing to do`);
    return true;
  }
  fs.mkdirSync(BACKUP_ROOT, { recursive: true });
  const stamp = timestampDir();
  const destDir = path.join(BACKUP_ROOT, stamp);
  fs.mkdirSync(destDir, { recursive: true });
  console.log(`[backup] backing up ${dbs.length} database(s) → ${destDir}`);

  let okCount = 0;
  for (const f of dbs) {
    const ok = await backupOne(f, destDir);
    if (ok) okCount++;
  }
  pruneOldBackups();
  console.log(`[backup] done: ${okCount}/${dbs.length} succeeded`);
  return okCount === dbs.length;
}

// Run directly (manual/cron). When required as a module, expose runBackup().
if (require.main === module) {
  runBackup()
    .then((ok) => process.exit(ok ? 0 : 1))
    .catch((err) => {
      console.error("[backup] fatal:", err);
      process.exit(1);
    });
}

module.exports = { runBackup };
