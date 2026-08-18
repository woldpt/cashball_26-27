/**
 * ensureSeeded — decide se o base.db (template de novas salas) precisa de ser
 * re-semeado no arranque do container.
 *
 * Re-seeda quando:
 *   - o ficheiro não existe;
 *   - faltam tabelas obrigatórias (ex.: base.db antigo de uma era anterior);
 *   - não há jogadores;
 *   - o hash das fixtures (`game_state.fixtures_hash`) difere do atual —
 *     cobre qualquer alteração a all_teams.json sem intervenção manual.
 *
 * Salas existentes (game_<room>.db) nunca são tocadas — o seed só atua no
 * template base.db.
 *
 * Uso: node db/ensureSeeded.js   (DB_PATH opcional para testes)
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const dbPath = process.env.DB_PATH || path.join(process.cwd(), "db", "base.db");
const fixturesPath = path.join(__dirname, "fixtures", "all_teams.json");
const seedPath = path.join(__dirname, "seed.js");
const schemaPath = path.join(__dirname, "schema.sql");

// Tabelas essenciais — se alguma faltar, o base.db está de uma era anterior.
const REQUIRED_TABLES = [
  "teams",
  "players",
  "matches",
  "game_state",
  "player_skill_snapshots",
];

function templateHash() {
  // Hash das fixtures + seed.js + schema.sql: qualquer alteração de conteúdo
  // (valores, regras de seed ou schema) obriga a re-semear o base.db.
  const parts = [];
  for (const p of [fixturesPath, seedPath, schemaPath]) {
    if (!fs.existsSync(p)) return null;
    parts.push(fs.readFileSync(p));
  }
  return crypto.createHash("sha256").update(Buffer.concat(parts)).digest("hex");
}

function openDb() {
  const sqlite3 = require("sqlite3").verbose();
  return new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
}

function queryAll(db, sql) {
  return new Promise((resolve, reject) => {
    db.all(sql, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

function queryOne(db, sql) {
  return new Promise((resolve, reject) => {
    db.get(sql, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

/**
 * @returns {Promise<{ needsSeed: boolean; reason: string }>}
 */
async function diagnose() {
  if (!fs.existsSync(dbPath)) {
    return { needsSeed: true, reason: "ficheiro ausente" };
  }
  const db = openDb();
  try {
    const rows = await queryAll(
      db,
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    );
    const present = new Set(rows.map((r) => r.name));
    const missing = REQUIRED_TABLES.filter((t) => !present.has(t));
    if (missing.length > 0) {
      return {
        needsSeed: true,
        reason: `faltam tabelas: ${missing.join(", ")}`,
      };
    }

    const cnt = await queryOne(db, "SELECT COUNT(*) AS c FROM players");
    if (!cnt || !cnt.c) {
      return { needsSeed: true, reason: "sem jogadores" };
    }

    const currentHash = templateHash();
    if (currentHash) {
      const st = await queryOne(
        db,
        "SELECT value FROM game_state WHERE key = 'fixtures_hash'",
      );
      if (!st || st.value !== currentHash) {
        return {
          needsSeed: true,
          reason: `fixtures/seed/schema alterados (esperado ${currentHash.slice(0, 12)}, encontrado ${st ? st.value.slice(0, 12) : "—"})`,
        };
      }
    }

    return { needsSeed: false, reason: "atualizado" };
  } catch (err) {
    return {
      needsSeed: true,
      reason: `erro ao ler base (${err.message || err})`,
    };
  } finally {
    db.close();
  }
}

async function main() {
  const { needsSeed, reason } = await diagnose();
  if (!needsSeed) {
    console.log(`[ensureSeeded] base.db ${reason} — a saltar seed.`);
    process.exit(0);
  }
  console.log(`[ensureSeeded] base.db desatualizado (${reason}) — a fazer seed...`);
  execFileSync("node", [seedPath], {
    stdio: "inherit",
    cwd: path.join(__dirname, ".."),
  });
  console.log("[ensureSeeded] Seed concluído.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[ensureSeeded] Falhou:", err);
  process.exit(1);
});
