const CACHE_VERSION_KEY = "cashball_cache_version";
const PRESERVED_LOCAL_KEYS = [
  "cashballSession",
  "cashballAdminSession",
  CACHE_VERSION_KEY,
];
const PRESERVED_LOCAL_PREFIXES = ["cashball_inbox_read:"];

function preserveLocalStorageKeys(keys) {
  const preserved = new Map();
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (
      key &&
      (keys.includes(key) ||
        PRESERVED_LOCAL_PREFIXES.some((prefix) => key.startsWith(prefix)))
    ) {
      preserved.set(key, localStorage.getItem(key));
    }
  }
  return preserved;
}

function restoreLocalStorageKeys(preserved) {
  preserved.forEach((value, key) => {
    localStorage.setItem(key, value);
  });
}

/**
 * Verifica se o cache do browser está sincronizado com o servidor.
 * Se o servidor reiniciou (nova version), limpa todo o cache e força reload.
 * Retorna true se foi necessário fazer reload.
 */
export async function checkCacheVersion() {
  if (typeof window === "undefined") return false;

  try {
    const res = await fetch("/api/cache-version");
    const data = await res.json();
    const serverVersion = String(data.version);
    const clientVersion = String(localStorage.getItem(CACHE_VERSION_KEY));

    if (clientVersion !== serverVersion) {
      // Cache desatualizado ou inexistente → hard reset sem perder sessão
      const preservedLocal = preserveLocalStorageKeys(PRESERVED_LOCAL_KEYS);
      localStorage.clear();
      restoreLocalStorageKeys(preservedLocal);
      sessionStorage.clear();
      localStorage.setItem(CACHE_VERSION_KEY, serverVersion);
      return true;
    }
    return false;
  } catch {
    // Erro de rede → ignora, app continua normal
    return false;
  }
}
