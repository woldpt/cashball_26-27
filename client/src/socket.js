import { io } from "socket.io-client";

export const socket = io(import.meta.env.VITE_BACKEND_URL || undefined, {
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 300,
  reconnectionDelayMax: 3000,
  timeout: 20000,
});

// Detect server restarts: reload the page so the client picks up new assets.
let _knownServerStartTime = null;
socket.on("serverStartTime", (t) => {
  if (_knownServerStartTime === null) {
    _knownServerStartTime = t;
  } else if (_knownServerStartTime !== t) {
    window.location.reload();
  }
});

socket.on("connect_error", (err) => {
  console.error("[socket] connect_error:", err.message);
});

socket.on("reconnect_attempt", (attempt) => {
  console.log("[socket] reconnect attempt", attempt);
});

socket.on("reconnect_failed", () => {
  console.error("[socket] reconnection failed");
});

socket.on("sessionDisplaced", () => {
  // Desactivar reconexão automática antes de desligar para evitar ciclos
  socket.io.opts.reconnection = false;
  socket.disconnect();
});

// ── Fila de saída resiliente (wifi → 5G → wifi) ────────────────────────────
// Emits feitos sem rede perdiam-se em silêncio (o Pronto, a tática, o lance).
// `queueEmit` envia de imediato quando há ligação e fila quando não há;
// `emitComAck` acrescenta confirmação + retry para ações críticas de dinheiro
// (lances — o servidor descarta `__actionId` repetidos, ver actionDedup.ts).
// A fila vive só em memória: intenções de dinheiro nunca são reenviadas sem
// o utilizador (a snapshot da tática em uiSnapshot.js cobre a morte da tab).

const outbox = [];
const outboxListeners = new Set();
// Última intenção enviada por evento coalescível (tática, pronto): reenviada
// no (re)join para um flape não obrigar a reconfirmar (o servidor faz reset
// do ready no disconnect — o reenvio repõe a intenção explícita do utilizador).
const stickyIntents = new Map();
// Eventos onde só a última intenção interessa (last-write-wins no servidor).
const COALESCE_EVENTS = new Set(["setTactic", "setReady"]);

function notifyOutbox() {
  const snapshot = { pending: outbox.length };
  for (const cb of outboxListeners) {
    try {
      cb(snapshot);
    } catch {
      /* ignore */
    }
  }
}

export function subscribeOutbox(cb) {
  outboxListeners.add(cb);
  return () => outboxListeners.delete(cb);
}

export function getOutboxPending() {
  return outbox.length;
}

function sendNow(entry) {
  if (entry.needsAck) {
    const timeoutMs = entry.timeoutMs ?? 8000;
    socket
      .timeout(timeoutMs)
      .emit(entry.event, entry.payload, (err, res) => {
        if (err) {
          if (entry.retries > 0) {
            entry.retries -= 1;
            entry.attempts += 1;
            sendNow(entry);
          } else {
            entry.onError?.(new Error("Sem resposta do servidor."));
          }
          return;
        }
        const response = Array.isArray(res) ? res[0] : res;
        if (response && response.ok === false && !response.silent) {
          entry.onError?.(new Error(response.error || "Ação recusada."));
          return;
        }
        entry.onOk?.(response);
      });
  } else {
    socket.emit(entry.event, entry.payload);
  }
}

function enqueue(entry) {
  if (COALESCE_EVENTS.has(entry.event)) {
    const idx = outbox.findIndex((e) => e.event === entry.event);
    if (idx >= 0) outbox[idx] = entry;
    else outbox.push(entry);
  } else {
    outbox.push(entry);
  }
  notifyOutbox();
}

/**
 * Envia um evento sem ack: de imediato se ligado, fila se offline.
 * `setTactic`/`setReady` coalescem (só a última intenção é enviada).
 */
export function queueEmit(event, payload) {
  const entry = { event, payload, needsAck: false };
  if (COALESCE_EVENTS.has(event)) stickyIntents.set(event, payload);
  if (socket.connected) {
    sendNow(entry);
    return;
  }
  enqueue(entry);
}

/** Gera um id de idempotência para retries (servidor: actionDedup.ts). */
export function newActionId() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch {
    /* ignore */
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Envia com confirmação do servidor + retry (lances). O payload com objeto
 * recebe `__actionId` para o servidor descartar duplicados.
 */
export function emitComAck(event, payload, opts = {}) {
  const withId =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? { ...payload, __actionId: payload.__actionId ?? newActionId() }
      : payload;
  const entry = {
    event,
    payload: withId,
    needsAck: true,
    timeoutMs: opts.timeoutMs ?? 8000,
    retries: opts.retries ?? 2,
    attempts: 0,
    onOk: opts.onOk,
    onError: opts.onError,
  };
  if (socket.connected) {
    sendNow(entry);
    return;
  }
  enqueue(entry);
}

/**
 * Esvazia a fila + repõe intenções sticky. Chamar APÓS o join estar ligado
 * no servidor (`teamAssigned`/`gameState`) — antes disso o servidor ainda
 * não conhece este socket e descartava os emits.
 */
export function flushOutbox() {
  if (!socket.connected) return;
  for (const [event, payload] of stickyIntents) {
    const stillQueued = outbox.some((e) => e.event === event);
    if (!stillQueued) socket.emit(event, payload);
  }
  while (outbox.length > 0 && socket.connected) {
    const entry = outbox.shift();
    sendNow(entry);
  }
  notifyOutbox();
}

// Tentar esvaziar ao reconectar (o flush completo dá-se no teamAssigned/
// gameState, quando o join já está ligado no servidor).
socket.on("connect", () => {
  if (outbox.length > 0) notifyOutbox();
});

// ── Reconnect agressivo ao foregroundar / voltar online ────────────────
// O browser do telemóvel suspende tabs em background e corta a rede ao
// bloquear o ecrã. Quando o utilizador volta, forçamos um connect imediato
// (sem esperar pelo timer de backoff) para minimizar o tempo offline.
function forceReconnect() {
  if (!socket.connected && !socket.connecting) {
    console.log("[socket] forcing reconnect on foreground/online");
    socket.connect();
  }
}

window.addEventListener("online", () => {
  console.log("[socket] navigator online — forcing reconnect");
  forceReconnect();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    forceReconnect();
  }
});
