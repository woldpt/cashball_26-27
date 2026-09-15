/**
 * inboxReadStore — ids já lidos do Jornal, partilhados por todos os consumidores.
 *
 * Porque existe: o badge do Jornal vive no `GameLayout` e a leitura acontece no
 * `JournalTab`. Com o estado dentro do hook, cada instância tinha o seu `Set`:
 * abrir uma mensagem no Jornal não baixava o badge (o `GameLayout` nunca
 * desmonta, por isso nem trocar de tab o ressincronizava).
 *
 * O estado é um `Map` de módulo (chave = sala + treinador, para que dois
 * treinadores no mesmo browser ou o mesmo treinador em salas diferentes não
 * partilhem leituras), persistido em localStorage e observável — o
 * `useSyncExternalStore` do `useInbox` lê-o com referências estáveis.
 */

/** Teto barato de leituras guardadas: os mais antigos saem primeiro. */
const MAX_READS = 400;

const STORE_PREFIX = "cashball_inbox_read:";
const stores = new Map();
const listeners = new Set();

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null; // node/SSR ou armazenamento bloqueado
  }
}

function loadIds(key) {
  try {
    const raw = storage()?.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

/** Chave de persistência das leituras de um treinador numa sala. */
export function inboxReadKey(roomCode, coachName) {
  return `${STORE_PREFIX}${roomCode || "?"}:${coachName || "?"}`;
}

/**
 * Ids lidos da chave. Referência estável enquanto nada mudar — é o contrato do
 * `useSyncExternalStore` (uma referência nova a cada chamada = render infinito).
 * @param {string} key
 * @returns {Set<string>}
 */
export function readIdsFor(key) {
  let ids = stores.get(key);
  if (!ids) {
    ids = loadIds(key);
    stores.set(key, ids);
  }
  return ids;
}

/** @param {() => void} listener */
export function subscribeInboxReads(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function commit(key, ids) {
  stores.set(key, ids);
  try {
    storage()?.setItem(key, JSON.stringify([...ids]));
  } catch {
    /* armazenamento cheio/bloqueado: segue sem persistir */
  }
  for (const listener of [...listeners]) listener();
}

/**
 * Marca ids como lidos. Ids já lidos não mudam nada (sem escrita nem aviso).
 * @param {string} key
 * @param {Iterable<string|null|undefined>} ids
 */
export function markInboxReadMany(key, ids) {
  const prev = readIdsFor(key);
  const next = new Set(prev);
  for (const id of ids) if (id) next.add(id);
  if (next.size === prev.size) return;
  while (next.size > MAX_READS) next.delete(next.values().next().value);
  commit(key, next);
}

/** @param {string} key @param {string} id */
export function markInboxRead(key, id) {
  markInboxReadMany(key, [id]);
}
