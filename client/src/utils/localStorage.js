/**
 * Persistência local do cliente — três coisas que NÃO devem morrer juntas:
 *
 *   cashball_auth   {name, token}      — credencial (TTL 30 dias no servidor)
 *   cashball_rooms  {name: roomCode}   — onde este treinador jogava
 *   cashball_device deviceId           — identifica a instalação (sessões)
 *
 * Antes era uma única chave `cashballSession` com tudo: qualquer erro de auth
 * apagava também o ponteiro da sala, e o jogo "desaparecia" (era preciso o
 * código da sala para voltar). Só o logout explícito limpa as duas.
 */

const AUTH_KEY = "cashball_auth";
const ROOMS_KEY = "cashball_rooms";
const DEVICE_KEY = "cashball_device";
const LEGACY_KEY = "cashballSession";

function readJson(key) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  if (typeof window === "undefined") return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

/** Migra a chave antiga (auth+sala juntos) para as duas novas, uma vez. */
function migrateLegacy() {
  const legacy = readJson(LEGACY_KEY);
  if (!legacy?.name || !legacy?.token) return;
  if (!readJson(AUTH_KEY)) {
    writeJson(AUTH_KEY, { name: legacy.name, token: legacy.token });
  }
  if (legacy.roomCode) {
    const rooms = readJson(ROOMS_KEY) || {};
    if (!rooms[legacy.name]) {
      rooms[legacy.name] = legacy.roomCode;
      writeJson(ROOMS_KEY, rooms);
    }
  }
  // A chave antiga fica (inofensiva) para rollback; deixa de ser escrita.
}

// ── Credencial ────────────────────────────────────────────────────────────────

export function loadSavedAuth() {
  migrateLegacy();
  const auth = readJson(AUTH_KEY);
  if (!auth?.name || !auth?.token) return null;
  return { name: auth.name, token: auth.token };
}

export function saveSavedAuth({ name, token }) {
  if (!name || !token) return;
  writeJson(AUTH_KEY, { name, token });
}

/** Só a credencial. O ponteiro das salas sobrevive — é o que permite voltar. */
export function clearSavedAuth() {
  writeJson(AUTH_KEY, null);
}

// ── Ponteiro da sala ──────────────────────────────────────────────────────────

export function loadRoomPointers() {
  return readJson(ROOMS_KEY) || {};
}

export function saveRoomPointer(name, roomCode) {
  if (!name || !roomCode) return;
  const rooms = readJson(ROOMS_KEY) || {};
  rooms[name] = roomCode;
  writeJson(ROOMS_KEY, rooms);
}

export function clearRoomPointer(name) {
  if (!name) return;
  const rooms = readJson(ROOMS_KEY) || {};
  delete rooms[name];
  writeJson(ROOMS_KEY, rooms);
}

// ── Sessão completa (compatibilidade com o fluxo de auto-join) ───────────────

export function loadSavedSession() {
  const auth = loadSavedAuth();
  if (!auth) return null;
  const roomCode = (readJson(ROOMS_KEY) || {})[auth.name] || "";
  if (!roomCode) return null;
  return { name: auth.name, token: auth.token, roomCode };
}

/** Logout explícito: limpa tudo (é a única saída que apaga o ponteiro). */
export function clearSavedSession() {
  writeJson(AUTH_KEY, null);
  writeJson(ROOMS_KEY, null);
  try {
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
}

// ── Identidade do dispositivo ─────────────────────────────────────────────────

/**
 * Id estável por instalação. Serve para distinguir "voltei no mesmo telemóvel"
 * (reconectar é normal) de "abri noutro dispositivo" (aí sim desloca a sessão).
 */
export function getDeviceId() {
  if (typeof window === "undefined") return "server";
  try {
    let id = window.localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return "sem-storage";
  }
}

export function hasSeenWelcome(coachName, roomCode) {
  try {
    return (
      window.localStorage.getItem(
        `cashball_welcome:${coachName}:${roomCode}`,
      ) === "1"
    );
  } catch {
    return false;
  }
}

export function markWelcomeSeen(coachName, roomCode) {
  try {
    window.localStorage.setItem(
      `cashball_welcome:${coachName}:${roomCode}`,
      "1",
    );
  } catch {
    // Ignore storage failures.
  }
}

export function hasSeenWelcomeThisSession(coachName, roomCode) {
  try {
    return (
      window.sessionStorage.getItem(
        `cashball_welcome_session:${coachName}:${roomCode}`,
      ) === "1"
    );
  } catch {
    return false;
  }
}

export function markWelcomeSeenThisSession(coachName, roomCode) {
  try {
    window.sessionStorage.setItem(
      `cashball_welcome_session:${coachName}:${roomCode}`,
      "1",
    );
  } catch {
    // Ignore storage failures.
  }
}
