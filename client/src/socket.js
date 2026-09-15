import { io } from "socket.io-client";

export const socket = io(import.meta.env.VITE_BACKEND_URL || undefined, {
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 300,
  reconnectionDelayMax: 3000,
  timeout: 20000,
});

// Detect server restarts: pede uma resincronização em vez de recarregar a
// página. O reload obrigava a um join novo na janela em que a auth/DB ainda
// não está pronta — e um `joinError` aí apagava a sessão guardada (o jogo
// "desaparecia"). O servidor responde com o estado completo.
let _knownServerStartTime = null;

// Banner de reload manual após restart (ver ServerRestartBanner.jsx). O reload
// automático foi removido de propósito: o resync automático continua e o
// utilizador escolhe quando recarregar.
const restartListeners = new Set();
export function subscribeServerRestart(cb) {
  restartListeners.add(cb);
  return () => restartListeners.delete(cb);
}
function notifyRestart() {
  for (const cb of restartListeners) {
    try {
      cb();
    } catch {
      /* ignore */
    }
  }
}

socket.on("serverStartTime", (t) => {
  if (_knownServerStartTime === null) {
    _knownServerStartTime = t;
  } else if (_knownServerStartTime !== t) {
    _knownServerStartTime = t;
    console.log("[socket] servidor reiniciou — a ressincronizar estado");
    socket.emit("requestResync");
    notifyRestart();
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

// A sessão foi reclamada noutro dispositivo. NÃO se desliga a reconexão: era
// um interruptor de sentido único — um displacement falso (socket antigo a meio
// de um flape, segunda tab) deixava o cliente sem reconectar até reload manual.
// Quem decide é o servidor (só desloca com deviceId diferente).
const displacedListeners = new Set();
export function subscribeSessionDisplaced(cb) {
  displacedListeners.add(cb);
  return () => displacedListeners.delete(cb);
}
socket.on("sessionDisplaced", (info) => {
  console.warn("[socket] sessionDisplaced", info);
  for (const cb of displacedListeners) {
    try {
      cb(info || {});
    } catch {
      /* ignore */
    }
  }
});

// ── Pausa da sala (congelamento por treinador ausente) ───────────────────────
// O servidor não decide nem avança por um treinador ausente: a sala pára. Estes
// listeners alimentam o aviso global (RoomPauseBanner.jsx).
const pauseListeners = new Set();
export function subscribeRoomPause(cb) {
  pauseListeners.add(cb);
  return () => pauseListeners.delete(cb);
}
function notifyPause(state) {
  for (const cb of pauseListeners) {
    try {
      cb(state);
    } catch {
      /* ignore */
    }
  }
}
socket.on("roomPaused", (info) => notifyPause({ paused: true, ...(info || {}) }));
socket.on("roomResumed", () => notifyPause({ paused: false }));

// ── Sequência da sala: deteta eventos perdidos e pede resync ─────────────────
// O servidor numera tudo o que muda estado (`roomEvent`, e o `seq` do
// `gameState`). Se a sequência saltar, perdeu-se um evento a meio de um flape e
// o cliente pede o estado completo — em vez de ficar com uma UI parcialmente
// velha, que era o que acontecia com os one-shot sem garantia.
let lastSeq = 0;
socket.on("gameState", (data) => {
  if (typeof data?.seq === "number") lastSeq = data.seq;
});
socket.on("roomEvent", (evt) => {
  if (typeof evt?.seq !== "number") return;
  if (lastSeq > 0 && evt.seq > lastSeq + 1) {
    console.warn(
      `[socket] salto de sequência ${lastSeq} → ${evt.seq} — a pedir resync`,
    );
    socket.emit("requestResync");
  }
  lastSeq = Math.max(lastSeq, evt.seq);
});
export function getRoomSeq() {
  return lastSeq;
}

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
