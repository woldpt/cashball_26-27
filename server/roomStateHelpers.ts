import type { ActiveGame, PlayerSession, RoomSeat } from "./types";

/**
 * Assentos da sala + presença + pausa + log de eventos.
 *
 * Regra do projeto: funções simples com `game`/`io` por chamada (não há estado
 * de módulo). O único estado partilhado vive no próprio `ActiveGame`.
 *
 * Porquê assentos: `playersByName` é in-memory e derivava a presença de um
 * `socketId` transitório. Um flape apagava o `ready`, a tática e o direito ao
 * lugar, e a ausência fazia o servidor decidir pelo treinador
 * (`engine.ts:waitForMatchAction`, `source:"auto"`). O assento é a fonte
 * durável; `playersByName` passa a projeção dele.
 */

/** Grace de presença: um socket que morre (wifi → 5G) não conta como ausente
 *  durante este intervalo — evita congelar a sala num flape de poucos segundos. */
export const PRESENCE_GRACE_MS = 25_000;

const TABLE_SEATS = `CREATE TABLE IF NOT EXISTS room_seats (
  coach_name TEXT PRIMARY KEY COLLATE NOCASE,
  team_id INTEGER,
  seat_epoch INTEGER NOT NULL DEFAULT 0,
  device_id TEXT,
  last_seen_at INTEGER NOT NULL DEFAULT 0,
  intent TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'member'
)`;

const TABLE_EVENTS = `CREATE TABLE IF NOT EXISTS room_events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
)`;

/** Criação idempotente nas salas existentes (o schema.sql só cobre salas novas). */
export function ensureRoomStateTables(db: any): void {
  db.run(TABLE_SEATS, (err: Error | null) => {
    if (err) console.error("[roomState] room_seats:", err.message);
  });
  db.run(TABLE_EVENTS, (err: Error | null) => {
    if (err) console.error("[roomState] room_events:", err.message);
  });
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_room_events_created_at ON room_events(created_at)",
    () => {},
  );
}

function emptySeat(name: string): RoomSeat {
  return {
    name,
    teamId: null,
    seatEpoch: 0,
    deviceId: null,
    lastSeenAt: 0,
    intent: { ready: false },
    status: "member",
  };
}

function parseIntent(raw: any): RoomSeat["intent"] {
  try {
    const parsed = JSON.parse(raw ?? "{}");
    return {
      ready: !!parsed.ready,
      formation: parsed.formation,
      style: parsed.style,
      positions: parsed.positions || {},
    };
  } catch {
    return { ready: false };
  }
}

/** Escreve um assento na DB (best-effort, como o resto do ficheiro). */
export function persistSeat(game: ActiveGame, seat: RoomSeat): void {
  game.db.run(
    `INSERT INTO room_seats (coach_name, team_id, seat_epoch, device_id, last_seen_at, intent, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(coach_name) DO UPDATE SET
       team_id = excluded.team_id,
       seat_epoch = excluded.seat_epoch,
       device_id = excluded.device_id,
       last_seen_at = excluded.last_seen_at,
       intent = excluded.intent,
       status = excluded.status`,
    [
      seat.name,
      seat.teamId,
      seat.seatEpoch,
      seat.deviceId,
      seat.lastSeenAt,
      JSON.stringify(seat.intent || {}),
      seat.status,
    ],
    (err: Error | null) => {
      if (err) console.error(`[roomState] persistSeat ${seat.name}:`, err.message);
    },
  );
}

function projectSeatToPlayer(game: ActiveGame, seat: RoomSeat): PlayerSession {
  const existing = game.playersByName[seat.name];
  const base: PlayerSession =
    existing ||
    ({
      name: seat.name,
      teamId: seat.teamId,
      roomCode: game.roomCode,
      ready: false,
      tactic: { formation: "4-4-2", style: "Balanced" },
      socketId: null,
    } as PlayerSession);
  base.teamId = seat.teamId;
  base.ready = !!seat.intent.ready;
  base.tactic = {
    ...(base.tactic || { formation: "4-4-2", style: "Balanced" }),
    formation: (seat.intent.formation ?? base.tactic?.formation ?? "4-4-2") as any,
    style: (seat.intent.style ?? base.tactic?.style ?? "Balanced") as any,
    positions: (seat.intent.positions ?? base.tactic?.positions ?? {}) as any,
  };
  game.playersByName[seat.name] = base;
  return base;
}

/**
 * Carrega os assentos da DB para a memória e projeta-os em `playersByName`.
 * A presença (socket) fica a null: depois de um restart ninguém está ligado
 * até voltar a ligar-se — é isso que faz uma sala retomar em pausa.
 */
export function loadSeats(game: ActiveGame, onDone?: () => void): void {
  game.db.all(
    "SELECT coach_name, team_id, seat_epoch, device_id, last_seen_at, intent, status FROM room_seats",
    (err: any, rows: any[]) => {
      if (err) {
        console.error(`[roomState] loadSeats ${game.roomCode}:`, err.message);
        if (onDone) onDone();
        return;
      }
      for (const row of rows || []) {
        const seat: RoomSeat = {
          name: String(row.coach_name),
          teamId: row.team_id ?? null,
          seatEpoch: Number(row.seat_epoch) || 0,
          deviceId: row.device_id ?? null,
          lastSeenAt: Number(row.last_seen_at) || 0,
          intent: parseIntent(row.intent),
          status: (row.status as RoomSeat["status"]) || "member",
        };
        game.seats[seat.name] = seat;
        if (seat.status !== "member") continue;
        projectSeatToPlayer(game, seat);
      }
      if (onDone) onDone();
    },
  );
}

/**
 * Garante um assento para cada treinador humano da sala que ainda não tenha
 * assento (salas anteriores a esta funcionalidade). A fonte é a própria DB da
 * sala: `managers` (quem existe) + `teams.manager_id` (que clube dirige).
 */
export function backfillSeats(game: ActiveGame, onDone?: () => void): void {
  game.db.all(
    `SELECT m.name AS coach_name, t.id AS team_id, m.is_human AS is_human
       FROM managers m LEFT JOIN teams t ON t.manager_id = m.id`,
    (_err: any, rows: any[]) => {
      const missing: RoomSeat[] = [];
      for (const r of rows || []) {
        const name = r?.coach_name ? String(r.coach_name) : "";
        if (!name || game.seats[name]) continue;
        if (r.is_human === 0) continue;
        const seat = emptySeat(name);
        seat.teamId = r.team_id ?? null;
        missing.push(seat);
      }
      if (missing.length === 0) {
        if (onDone) onDone();
        return;
      }
      game.db.serialize(() => {
        game.db.run("BEGIN");
        for (const seat of missing) {
          game.seats[seat.name] = seat;
          if (seat.status === "member") projectSeatToPlayer(game, seat);
          game.db.run(
            `INSERT OR IGNORE INTO room_seats (coach_name, team_id, seat_epoch, device_id, last_seen_at, intent, status)
             VALUES (?, ?, 0, NULL, 0, '{}', 'member')`,
            [seat.name, seat.teamId],
          );
        }
        game.db.run("COMMIT", () => {
          console.log(
            `[${game.roomCode}] 🪑 Backfill de ${missing.length} assento(s) a partir de managers/teams`,
          );
          if (onDone) onDone();
        });
      });
    },
  );
}

/** Assento existente ou criado (sem persistir). */
export function seatOf(game: ActiveGame, name: string): RoomSeat {
  if (!game.seats[name]) game.seats[name] = emptySeat(name);
  return game.seats[name];
}

/**
 * Reclama o assento para um socket. Devolve o socket antigo (se havia outro)
 * para o servidor poder destacá-lo — destacar, nunca matar: o socket antigo
 * pode reclamar o mesmo assento de volta (era o kill-switch de reconexão).
 */
export function claimSeat(
  game: ActiveGame,
  name: string,
  opts: { teamId?: number | null; deviceId?: string | null } = {},
): { seat: RoomSeat; previousSeatEpoch: number } {
  const seat = seatOf(game, name);
  const previousSeatEpoch = seat.seatEpoch;
  seat.seatEpoch += 1;
  if (opts.teamId !== undefined) seat.teamId = opts.teamId;
  if (opts.deviceId !== undefined) seat.deviceId = opts.deviceId;
  if (seat.status !== "member") seat.status = "member";
  seat.lastSeenAt = Date.now();
  persistSeat(game, seat);
  return { seat, previousSeatEpoch };
}

/** Marca presença (lease). Guarda em memória; o `last_seen_at` da DB é
 *  atualizado em transições com significado (join/ready/ação), não a cada tick. */
export function markSeatSeen(game: ActiveGame, name: string): void {
  if (!name) return;
  game.seatSeenAt[name] = Date.now();
}

export function isSeatPresent(game: ActiveGame, name: string): boolean {
  // Assento libertado (leave/kick/despedida) nunca conta como presente, mesmo
  // com lease fresco em memória — senão um kick deixava janelas pendentes a
  // resolverem sozinhas durante a grace em vez de caírem de imediato.
  if (game.seats[name] && game.seats[name].status !== "member") return false;
  const player = game.playersByName[name];
  if (player && player.socketId) return true;
  const seen = game.seatSeenAt[name];
  return typeof seen === "number" && Date.now() - seen < PRESENCE_GRACE_MS;
}

/** Grava a intenção (ready/tática) no assento — sobrevive a disconnect e restart. */
export function setSeatIntent(
  game: ActiveGame,
  name: string,
  patch: Partial<RoomSeat["intent"]>,
  opts: { persist?: boolean } = {},
): void {
  const seat = seatOf(game, name);
  seat.intent = { ...seat.intent, ...patch };
  seat.lastSeenAt = Date.now();
  projectSeatToPlayer(game, seat);
  if (opts.persist !== false) persistSeat(game, seat);
}

export function setSeatTeamId(game: ActiveGame, name: string, teamId: number | null): void {
  const seat = seatOf(game, name);
  seat.teamId = teamId;
  persistSeat(game, seat);
}

/** Liberta o assento (leaveRoom/kick/despedimento/libertamento pelo admin). */
export function releaseSeat(
  game: ActiveGame,
  name: string,
  status: RoomSeat["status"] = "left",
): void {
  const seat = game.seats[name];
  if (!seat) return;
  seat.status = status;
  seat.lastSeenAt = Date.now();
  persistSeat(game, seat);
}

/** Remove o assento por completo (sala sem esse treinador). */
export function deleteSeat(game: ActiveGame, name: string): void {
  delete game.seats[name];
  game.db.run("DELETE FROM room_seats WHERE coach_name = ? COLLATE NOCASE", [name], () => {});
}

// ── Presença da ronda + pausa ────────────────────────────────────────────────

/**
 * Equipas humanas que a fase em curso obriga a estar presentes.
 * - Fase de jogo: equipas nas fixtures em curso.
 * - Lobby: equipas dos treinadores bloqueados (a semana não arranca sem eles).
 */
export function requiredTeamIds(game: ActiveGame): Set<number> {
  const ids = new Set<number>();
  const fixtures = game.currentFixtures || [];
  if (fixtures.length > 0) {
    for (const f of fixtures) {
      if (f?.homeTeamId != null) ids.add(f.homeTeamId);
      if (f?.awayTeamId != null) ids.add(f.awayTeamId);
    }
    return ids;
  }
  for (const name of game.lockedCoaches || []) {
    const teamId = game.seats[name]?.teamId ?? game.playersByName[name]?.teamId;
    if (teamId != null) ids.add(teamId);
  }
  return ids;
}

/**
 * Treinadores ausentes com equipa em jogo. Vazio = nada bloqueia.
 * Treinadores sem equipa (despedidos, espectadores) nunca bloqueiam.
 */
export function computeAbsentees(game: ActiveGame): string[] {
  const required = requiredTeamIds(game);
  if (required.size === 0) return [];
  const absent: string[] = [];
  for (const seat of Object.values(game.seats)) {
    if (seat.status !== "member") continue;
    if (seat.teamId == null || !required.has(seat.teamId)) continue;
    if (!isSeatPresent(game, seat.name)) absent.push(seat.name);
  }
  return absent.sort();
}

function emitPause(game: ActiveGame, io: any, coaches: string[], since: number): void {
  io.to(game.roomCode).emit("roomPaused", {
    reason: "coach_absent",
    coaches,
    since,
    phase: game.gamePhase,
    minute: game.liveMinute ?? null,
  });
}

/**
 * Pausa derivada (não é estado guardado: recalcula-se da presença) e a espera
 * que congela a sala. O emissor é o único sítio que resolve as esperas.
 */
export function emitPresencePause(game: ActiveGame, io: any): boolean {
  const absent = computeAbsentees(game);
  if (absent.length === 0) {
    if (game.pausedSince) {
      console.log(`[${game.roomCode}] ▶ Pausa terminada — todos presentes`);
      game.pausedSince = null;
      io.to(game.roomCode).emit("roomResumed", { phase: game.gamePhase });
    }
    const waiters = [...(game.pauseWaiters || [])];
    game.pauseWaiters = new Set();
    for (const resolve of waiters) resolve();
    return false;
  }
  if (!game.pausedSince) game.pausedSince = Date.now();
  emitPause(game, io, absent, game.pausedSince);
  return true;
}

/**
 * Congela a sala até todos os treinadores da ronda estarem presentes.
 * Resolve de imediato se não faltar ninguém (caminho normal, custo ~0).
 */
export function waitForPresence(game: ActiveGame, io: any): Promise<void> {
  if (!emitPresencePause(game, io)) return Promise.resolve();
  return new Promise<void>((resolve) => {
    if (!game.pauseWaiters) game.pauseWaiters = new Set();
    game.pauseWaiters.add(resolve);
    // O registo é feito depois de reavaliar: se a presença voltou entre o
    // emit e o registo, o waiter ficaria pendurado para sempre.
    if (computeAbsentees(game).length === 0) {
      game.pauseWaiters.delete(resolve);
      emitPresencePause(game, io);
    }
  });
}

/** Resolve esperas pendentes (usado quando um assento é libertado pelo admin). */
export function releasePause(game: ActiveGame, io: any): void {
  game.pausedSince = null;
  const waiters = [...(game.pauseWaiters || [])];
  game.pauseWaiters = new Set();
  for (const resolve of waiters) resolve();
  io.to(game.roomCode).emit("roomResumed", { phase: game.gamePhase });
}

// ── Log de eventos (sequência para o cliente + auditoria) ─────────────────────

/**
 * Acrescenta um evento ao log da sala e emite-o aos clientes com um `seq`
 * monotónico.
 *
 * ponytail: o log é write-ahead para sequência/auditoria/resync do cliente; a
 * reconstrução completa do estado (event sourcing puro) fica para quando o
 * `game_state` deixar de ser suficiente — a projeção do snapshot continua a
 * mandar. `applyRoomEvent` cobre só os eventos que mudam a fase/cursor.
 */
export function appendRoomEvent(
  game: ActiveGame,
  io: any,
  type: string,
  payload: Record<string, unknown> = {},
): number {
  const seq = (game.eventSeq || 0) + 1;
  game.eventSeq = seq;
  const createdAt = Date.now();
  game.db.run(
    "INSERT INTO room_events (type, payload, created_at) VALUES (?, ?, ?)",
    [type, JSON.stringify(payload), createdAt],
    (err: Error | null) => {
      if (err) console.error(`[roomState] appendRoomEvent ${type}:`, err.message);
    },
  );
  if (io) {
    io.to(game.roomCode).emit("roomEvent", { seq, type, payload, createdAt });
  }
  return seq;
}

/** Último seq já gravado na sala (para retomar a numeração após restart). */
export function loadEventSeq(game: ActiveGame, onDone?: (seq: number) => void): void {
  game.db.get(
    "SELECT COALESCE(MAX(seq), 0) AS seq FROM room_events",
    (_err: any, row: any) => {
      game.eventSeq = Number(row?.seq) || 0;
      if (onDone) onDone(game.eventSeq);
    },
  );
}

export function recentEvents(game: ActiveGame, limit = 40): Promise<any[]> {
  return new Promise((resolve) => {
    game.db.all(
      "SELECT seq, type, payload, created_at FROM room_events ORDER BY seq DESC LIMIT ?",
      [limit],
      (_err: any, rows: any[]) => resolve(rows || []),
    );
  });
}

/**
 * Reaplica no arranque os eventos que ficaram depois do último snapshot (a
 * janela entre gravar o snapshot e o processo cair). Best-effort: só os
 * eventos com efeito na projeção contam (ver `applyRoomEvent`).
 */
export function replayEventsSince(
  game: ActiveGame,
  fromSeq: number,
  onDone?: () => void,
): void {
  // fromSeq <= 0 = nenhum snapshot ainda: reaplica tudo desde o início.
  const from = Number.isFinite(fromSeq) && fromSeq > 0 ? fromSeq : 0;
  if (from >= game.eventSeq) {
    if (onDone) onDone();
    return;
  }
  game.db.all(
    "SELECT type, payload FROM room_events WHERE seq > ? ORDER BY seq ASC",
    [from],
    (err: any, rows: any[]) => {
      if (err) {
        console.error(`[roomState] replay ${game.roomCode}:`, err.message);
        if (onDone) onDone();
        return;
      }
      for (const row of rows || []) {
        let payload: any = {};
        try {
          payload = JSON.parse(row.payload ?? "{}");
        } catch {
          /* payload de auditoria ilegível: ignorado */
        }
        try {
          applyRoomEvent(game, { type: row.type, payload });
        } catch (err2: any) {
          console.error(
            `[roomState] applyRoomEvent ${row.type} falhou: ${err2?.message}`,
          );
        }
      }
      if (rows?.length) {
        console.log(
          `[${game.roomCode}] 🔁 ${rows.length} evento(s) reaplicados (seq > ${from})`,
        );
      }
      if (onDone) onDone();
    },
  );
}

/**
 * Registo estruturado de um avanço de calendário (Fase 0): quem, quando e
 * porquê. É o que permite provar em produção que uma jornada avançou sem os
 * treinadores presentes — antes disto, o avanço era silencioso.
 */
export function logCalendarAdvance(
  game: ActiveGame,
  io: any,
  reason: string,
  actor = "system",
): number {
  const payload = {
    reason,
    actor,
    calendarIndex: game.calendarIndex,
    matchweek: game.matchweek,
    season: game.season,
    phase: game.gamePhase,
    absent: computeAbsentees(game),
  };
  console.log(
    `[${game.roomCode}] 📅 calendar → idx=${game.calendarIndex} mw=${game.matchweek} | reason=${reason} | actor=${actor} | absent=[${payload.absent.join(", ")}]`,
  );
  return appendRoomEvent(game, io, "calendar_advanced", payload);
}

/**
 * Aplica um evento à projeção (usado na retoma após restart, quando o
 * snapshot ficou atrás do log). Só os eventos que mexem em fase/cursor têm
 * efeito; os restantes são auditoria.
 */
export function applyRoomEvent(game: ActiveGame, evt: { type: string; payload: any }): void {
  const p = evt.payload || {};
  switch (evt.type) {
    case "week_started":
      game.gamePhase = "match_first_half";
      if (typeof p.calendarIndex === "number") game.calendarIndex = p.calendarIndex;
      break;
    case "phase_changed":
      if (p.phase) game.gamePhase = p.phase;
      if (typeof p.liveMinute === "number") game.liveMinute = p.liveMinute;
      break;
    case "minute":
      if (typeof p.minute === "number") game.liveMinute = p.minute;
      break;
    case "week_finalized":
      if (typeof p.calendarIndex === "number") game.calendarIndex = p.calendarIndex;
      if (typeof p.matchweek === "number") game.matchweek = p.matchweek;
      game.gamePhase = "lobby";
      break;
  }
}

/**
 * Ponto de controlo por minuto: grava só o cursor e o estado transitório dos
 * jogos em curso (barato, cabe numa transação). É isto que permite retomar no
 * mesmo minuto em vez de recomeçar 0-0.
 */
export function saveMatchCheckpoint(game: ActiveGame): void {
  if (!game.currentFixtures || game.currentFixtures.length === 0) return;
  const checkpoint = {
    liveMinute: game.liveMinute ?? null,
    phase: game.gamePhase,
    fixtures: game.currentFixtures.map((f: any) => ({
      homeTeamId: f.homeTeamId,
      awayTeamId: f.awayTeamId,
      finalHomeGoals: f.finalHomeGoals || 0,
      finalAwayGoals: f.finalAwayGoals || 0,
      events: f.events || [],
      homeLineup: f.homeLineup || [],
      awayLineup: f.awayLineup || [],
      _t1: f._t1 || null,
      _t2: f._t2 || null,
      _minute: f._minute ?? null,
      _subbedOut: f._subbedOut ? [...f._subbedOut] : [],
      _yellowCards: f._yellowCards ? { ...f._yellowCards } : {},
      _homePossession: f._homePossession ?? 50,
      _awayPossession: f._awayPossession ?? 50,
      _simulatedMinutes: f._simulatedMinutes ? [...f._simulatedMinutes] : [],
    })),
  };
  game.db.run(
    "INSERT OR REPLACE INTO game_state (key, value) VALUES ('matchCheckpoint', ?)",
    [JSON.stringify(checkpoint)],
    (err: Error | null) => {
      if (err) console.error(`[roomState] saveMatchCheckpoint:`, err.message);
    },
  );
}
