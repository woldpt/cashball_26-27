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

/**
 * Conta quantos jogadores têm um dado estado na tática, ignorando ids que já
 * não estão no plantel (vendidos/leiloados) e o `excludeId`.
 *
 * @param {Object<string, string>} positions Mapa id → estado.
 * @param {string} status "Titular" | "Suplente" | "Excluído".
 * @param {Set<number>} squadIds Ids (Number) do plantel atual.
 * @param {number} [excludeId] Jogador a não contar (o que está a ser movido).
 * @returns {number}
 */
export function countStatus(positions, status, squadIds, excludeId) {
  return Object.entries(positions || {}).filter(
    ([id, s]) =>
      s === status && squadIds.has(Number(id)) && Number(id) !== excludeId,
  ).length;
}
