import type { ActiveGame } from "./types";

// ── Idempotência de ações críticas (anti-duplicado em retry/reconnect) ──────
// O cliente gera um `__actionId` (uuid) por intenção do utilizador (ex.: lance
// num leilão) e reenvia-o em caso de timeout de ack. O servidor regista o id
// à primeira execução; reenvios com o mesmo id são descartados sem efeitos.
// Memória por sala (não persistida): chega para a janela de retry (timeouts de
// segundos); entradas com mais de 10 min são varridas no próprio insert.

const ACTION_TTL_MS = 10 * 60 * 1000;
const MAX_ACTIONS = 500;

function actionStore(game: ActiveGame): Map<string, number> {
  const g = game as ActiveGame & { recentActionIds?: Map<string, number> };
  if (!(g.recentActionIds instanceof Map)) {
    g.recentActionIds = new Map<string, number>();
  }
  return g.recentActionIds;
}

/**
 * Regista uma intenção. Devolve `true` à primeira vez (executar) e `false`
 * se o id já foi visto (duplicado — descartar sem efeitos).
 */
export function claimActionId(game: ActiveGame, actionId: unknown): boolean {
  if (typeof actionId !== "string" || actionId.length === 0) return true;
  const store = actionStore(game);
  if (store.has(actionId)) return false;
  const now = Date.now();
  store.set(actionId, now);
  if (store.size > MAX_ACTIONS) {
    // Varre expirados; se continuar cheio, remove os mais antigos.
    for (const [id, at] of store) {
      if (now - at > ACTION_TTL_MS) store.delete(id);
    }
    while (store.size > MAX_ACTIONS) {
      const oldest = store.keys().next();
      if (oldest.done) break;
      store.delete(oldest.value);
    }
  }
  return true;
}
