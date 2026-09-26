import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";

const sqlite = sqlite3.verbose();

// Chat messages older than this (2 days) are neither shown nor kept.
export const CHAT_RETENTION_MS = 2 * 24 * 60 * 60 * 1000;

let globalDb: any = null;
// Setup do schema corre uma única vez e em série; consumidores aguardam-no
// (evita "no such table" quando a BD é recriada de raiz no arranque).
let schemaReady: Promise<void> | null = null;

function runAsync(db: any, sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err: Error | null) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function getDbDir(): string {
  const candidates = [
    path.join(__dirname, "db"),
    path.join(__dirname, "..", "db"),
    path.join(process.cwd(), "db"),
  ];
  return (
    candidates.find((dir) => fs.existsSync(path.join(dir, "base.db"))) ??
    candidates.find((dir) => fs.existsSync(dir)) ??
    candidates[0]
  );
}

export function openGlobalDb(): any {
  if (globalDb) return globalDb;

  const dbDir = getDbDir();
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.join(dbDir, "global_chat.db");
  globalDb = new sqlite.Database(dbPath);
  const db = globalDb;
  // WAL + busy_timeout: consistência a crash e acesso concorrente seguro.
  // Tudo aguardado via schemaReady — nunca fire-and-forget (um falhanço
  // silencioso aqui deixava a BD sem tabela e crashava o servidor).
  schemaReady = (async () => {
    try {
      await runAsync(db, "PRAGMA journal_mode = WAL");
      await runAsync(db, "PRAGMA busy_timeout = 5000");
      await runAsync(db, `CREATE TABLE IF NOT EXISTS global_chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coach_name TEXT NOT NULL,
    room_code TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  )`);
      // Prune history older than the retention window (one-shot on startup)
      await runAsync(
        db,
        "DELETE FROM global_chat_messages WHERE timestamp < ?",
        [Date.now() - CHAT_RETENTION_MS],
      );
    } catch (err) {
      console.error("[globalDatabase] Falha a preparar global_chat.db:", err);
      throw err;
    }
  })();
  return globalDb;
}

// Garante ligação aberta + schema pronto; rejeita (alto) se a BD falhar —
// os chamadores degradam com histórico vazio em vez de crashar o servidor.
async function ensureReady(): Promise<any> {
  const db = openGlobalDb();
  if (schemaReady) await schemaReady;
  return db;
}

export function saveGlobalMessage(
  coachName: string,
  roomCode: string,
  message: string,
  timestamp: number,
): Promise<number> {
  return ensureReady().then(
    (db) =>
      new Promise<number>((resolve, reject) => {
        // Keep the table bounded: drop messages outside the retention window
        db.run("DELETE FROM global_chat_messages WHERE timestamp < ?", [
          Date.now() - CHAT_RETENTION_MS,
        ]);
        db.run(
          "INSERT INTO global_chat_messages (coach_name, room_code, message, timestamp) VALUES (?, ?, ?, ?)",
          [coachName, roomCode, message, timestamp],
          function (this: any, err: Error | null) {
            if (err) reject(err);
            else resolve(this.lastID);
          },
        );
      }),
  );
}

export function getGlobalMessages(
  limit = 50,
  sinceMs: number = Date.now() - CHAT_RETENTION_MS,
): Promise<any[]> {
  return ensureReady().then(
    (db) =>
      new Promise<any[]>((resolve, reject) => {
        db.all(
          "SELECT id, coach_name AS coachName, room_code AS roomCode, message, timestamp FROM global_chat_messages WHERE timestamp >= ? ORDER BY id DESC LIMIT ?",
          [sinceMs, limit],
          (err: Error | null, rows: any[]) => {
            if (err) reject(err);
            else resolve((rows || []).reverse());
          },
        );
      }),
  );
}
