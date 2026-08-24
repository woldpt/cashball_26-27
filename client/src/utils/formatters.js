export function formatCurrency(value) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Época (1-based) → ano civil. A época 1 começa em 2026
 * (invariante do servidor: year = 2025 + season).
 *
 * @param {number} season época (1-based)
 * @returns {number} ano civil da época
 */
export function seasonToYear(season) {
  return 2025 + season;
}
