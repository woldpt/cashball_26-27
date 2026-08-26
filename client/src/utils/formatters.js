const ONE_DAY = 24 * 60 * 60 * 1000;

/** Milissegundos do início (local) do dia de uma data. */
export function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** true se aTs e bTs pertencem ao mesmo dia de calendário (local). */
export function isSameDay(aTs, bTs) {
  return startOfDay(new Date(aTs)) === startOfDay(new Date(bTs));
}

/**
 * Rótulo de dia para separadores de chat (estilo WhatsApp):
 * "Hoje", "Ontem", ou data pt-PT (inclui o ano só se diferente do atual).
 * Retorna string vazia para timestamps inválidos.
 */
export function formatChatDay(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const today = startOfDay(new Date());
  const day = startOfDay(d);
  if (day === today) return "Hoje";
  if (day === today - ONE_DAY) return "Ontem";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(
    "pt-PT",
    sameYear
      ? { day: "2-digit", month: "2-digit" }
      : { day: "2-digit", month: "2-digit", year: "numeric" },
  );
}

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
