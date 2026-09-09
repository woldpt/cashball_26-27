/**
 * Snapshot da tática em sessionStorage — sobrevive à morte da tab no telemóvel
 * (o browser fecha tabs em background a todo o momento), mas morre com a
 * sessão, para nunca ressuscitar um 11 de outra época noutro dia.
 *
 * O servidor continua fonte da verdade: o restauro só se aplica quando o
 * `gameState` chega a MEIO de jogo com posições vazias (servidor reiniciado
 * perdeu a tática em memória). No lobby o servidor limpa de propósito e o
 * snapshot NÃO é aplicado.
 */

const SNAP_TTL_MS = 7 * 24 * 3600 * 1000;

function key(coachName, roomCode) {
  return `cashball_tactic:${coachName}:${roomCode}`;
}

export function saveTacticSnapshot(coachName, roomCode, tactic) {
  if (!coachName || !roomCode || !tactic || typeof tactic !== "object") return;
  try {
    window.sessionStorage.setItem(
      key(coachName, roomCode),
      JSON.stringify({
        formation: tactic.formation ?? null,
        style: tactic.style ?? null,
        positions: tactic.positions ?? {},
        ts: Date.now(),
      }),
    );
  } catch {
    /* armazenamento indisponível — ignora */
  }
}

export function loadTacticSnapshot(coachName, roomCode) {
  if (!coachName || !roomCode) return null;
  try {
    const raw = window.sessionStorage.getItem(key(coachName, roomCode));
    if (!raw) return null;
    const snap = JSON.parse(raw);
    if (!snap || typeof snap !== "object") return null;
    if (typeof snap.ts === "number" && Date.now() - snap.ts > SNAP_TTL_MS) {
      return null;
    }
    if (!snap.positions || Object.keys(snap.positions).length === 0) return null;
    return snap;
  } catch {
    return null;
  }
}
