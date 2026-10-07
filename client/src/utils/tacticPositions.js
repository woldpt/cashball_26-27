const VALID_FORMATIONS = new Set([
  "4-4-2", "4-3-3", "3-5-2", "5-3-2", "4-5-1", "3-4-3", "4-2-4", "5-4-1",
]);

/**
 * Tática "limpa": todos os jogadores do plantel ficam "Excluído", mas a
 * formação mantém-se. O servidor descarta qualquer `setTactic` sem uma
 * formação válida, por isso nunca se pode enviar `formation: ""`.
 *
 * @param {Object} prev Tática anterior (formation, style, positions…).
 * @param {Array<{id: number|string}>} squad Plantel atual.
 * @returns {Object} Nova tática, com a formação anterior (ou "4-4-2").
 */
export function buildClearedTactic(prev, squad) {
  const formation = VALID_FORMATIONS.has(prev?.formation)
    ? prev.formation
    : "4-4-2";
  return {
    ...prev,
    formation,
    positions: Object.fromEntries(
      (squad || []).map((p) => [p.id, "Excluído"]),
    ),
  };
}
