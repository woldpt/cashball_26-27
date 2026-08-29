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
