/**
 * Session Audit — o que está a prender uma sala e porquê.
 *
 * Existe por causa de um sintoma real: "o jogo avança para a próxima jornada
 * automaticamente" enquanto os clientes estão offline. Antes não havia forma
 * de ver, fora dos logs, quem avançou o calendário e quem faltava na ronda.
 *
 * Mostra: assentos (equipa/ready/último sinal), quem falta para a ronda em
 * curso, fase/minuto/calendarIndex e os últimos eventos da sala
 * (`room_events` — inclui cada avanço de calendário e a razão dele).
 *
 * Uso (o servidor pode estar a correr — SQLite em WAL):
 *   cd server && npm run audit:session <ROOM_CODE>
 */

const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

function all(db: any, sql: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve) => db.all(sql, params, (_e: any, r: any[]) => resolve(r || [])));
}
function get(db: any, sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve) => db.get(sql, params, (_e: any, r: any) => resolve(r ?? null)));
}

function fmtAge(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}min`;
  return `${(s / 3600).toFixed(1)}h`;
}

async function main() {
  const roomCode = (process.argv[2] || "").toUpperCase();
  if (!roomCode) {
    console.error("Usage: npm run audit:session <ROOM_CODE>");
    process.exit(1);
  }

  const dbDir = path.join(__dirname, "..", "db");
  const { findRoomDbFile, savesDirFor } = require("../db/roomPaths");
  const savesDir = savesDirFor(dbDir);
  const dbPath =
    findRoomDbFile(savesDir, roomCode) ??
    findRoomDbFile(dbDir, roomCode) ??
    path.join(savesDir, `game_${roomCode}.db`);
  if (!fs.existsSync(dbPath)) {
    console.error(`❌ Sala não encontrada: ${dbPath}`);
    process.exit(1);
  }

  const db = new sqlite3.Database(dbPath);
  console.log(`\n🔎 audit:session ${roomCode}\n   ${dbPath}\n${"─".repeat(64)}`);

  const state = async (key: string) =>
    (await get(db, "SELECT value FROM game_state WHERE key = ?", [key]))?.value ?? null;

  const phase = (await state("gamePhase")) || "—";
  const calendarIndex = (await state("calendarIndex")) || "—";
  const matchweek = (await state("matchweek")) || "—";
  const season = (await state("season")) || "—";
  const liveMinute = (await state("liveMinute")) || "null";
  const snapshotSeq = (await state("snapshotSeq")) || "0";

  console.log(
    `\n📅 Estado: fase=${phase} | calendarIndex=${calendarIndex} | mw=${matchweek} | época=${season} | minuto=${liveMinute} | snapshotSeq=${snapshotSeq}`,
  );

  // Assentos
  let seats: any[] = [];
  try {
    seats = await all(
      db,
      "SELECT coach_name, team_id, seat_epoch, last_seen_at, intent, status FROM room_seats ORDER BY coach_name",
    );
  } catch {
    console.log("\n⚠️  Tabela room_seats inexistente (sala anterior a esta versão).");
  }

  // Equipas da ronda em curso (para saber quem é obrigatório)
  let fixtures: any[] = [];
  const rawFixtures = await state("currentFixtures");
  if (rawFixtures) {
    try {
      fixtures = JSON.parse(rawFixtures);
    } catch {
      /* ignore */
    }
  }
  const requiredTeams = new Set<number>();
  for (const f of fixtures) {
    if (f?.homeTeamId != null) requiredTeams.add(f.homeTeamId);
    if (f?.awayTeamId != null) requiredTeams.add(f.awayTeamId);
  }
  if (requiredTeams.size === 0) {
    const rows = await all(
      db,
      "SELECT t.id AS team_id FROM managers m JOIN teams t ON t.manager_id = m.id WHERE m.is_human = 1",
    );
    for (const r of rows) requiredTeams.add(r.team_id);
  }

  const teamNames = new Map<number, string>();
  for (const t of await all(db, "SELECT id, name FROM teams")) teamNames.set(t.id, t.name);

  console.log(`\n🪑 Assentos (${seats.length}) — obrigatório = equipa na ronda`);
  if (seats.length === 0) console.log("   (sem assentos)");
  for (const s of seats) {
    let intent: any = {};
    try {
      intent = JSON.parse(s.intent || "{}");
    } catch {
      /* ignore */
    }
    const required = s.team_id != null && requiredTeams.has(s.team_id);
    const tag =
      s.status !== "member"
        ? `[${s.status}]`
        : required
          ? intent.ready
            ? "✅ pronto"
            : "⏸ falta ready"
          : "· fora da ronda";
    console.log(
      `   ${s.coach_name.padEnd(18)} ${(teamNames.get(s.team_id) || "sem clube").padEnd(22)} epoch=${String(s.seat_epoch).padEnd(4)} último sinal=${fmtAge(Number(s.last_seen_at) || null).padEnd(6)} ${tag}`,
    );
  }

  const requiredSeats = seats.filter(
    (s) => s.status === "member" && s.team_id != null && requiredTeams.has(s.team_id),
  );
  const missing = requiredSeats
    .filter((s) => {
      try {
        return !JSON.parse(s.intent || "{}").ready;
      } catch {
        return true;
      }
    })
    .map((s) => s.coach_name);
  console.log(
    `\n🔒 Bloqueio da ronda: ${missing.length === 0 ? "nenhum (pode avançar)" : `à espera de ${missing.join(", ")}`}`,
  );
  console.log(
    "   Nota: presença (socket ligado) só é conhecida pelo processo vivo; aqui vê-se o último sinal gravado.",
  );

  // Eventos
  let events: any[] = [];
  try {
    events = await all(
      db,
      "SELECT seq, type, payload, created_at FROM room_events ORDER BY seq DESC LIMIT 25",
    );
  } catch {
    console.log("\n⚠️  Tabela room_events inexistente.");
  }
  console.log(`\n📜 Últimos eventos (${events.length})`);
  for (const e of events.reverse()) {
    let p: any = {};
    try {
      p = JSON.parse(e.payload || "{}");
    } catch {
      /* ignore */
    }
    const detail =
      e.type === "calendar_advanced"
        ? `idx=${p.calendarIndex} mw=${p.matchweek} reason=${p.reason} actor=${p.actor} absent=[${(p.absent || []).join(",")}]`
        : JSON.stringify(p).slice(0, 160);
    console.log(
      `   #${String(e.seq).padStart(5)} ${new Date(e.created_at).toISOString().slice(11, 19)} ${e.type.padEnd(22)} ${detail}`,
    );
  }

  console.log(`\n${"─".repeat(64)}\n`);
  db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
