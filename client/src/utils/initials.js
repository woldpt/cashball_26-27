/**
 * Iniciais de um nome para selos/badges de treinador
 * (ex.: "João Silva" → "JS", "Paulo" → "P", "José Maria Silva" → "JS").
 * Remove acentos para não partir em fontes/badges estreitos.
 *
 * @param {string} name
 * @returns {string}
 */
export function initialsFromName(name = "") {
  const clean = String(name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (!clean) return "";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
