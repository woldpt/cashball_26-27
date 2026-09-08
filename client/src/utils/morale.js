/**
 * Etiqueta de moral do plantel com humor (pt-PT).
 * Escala única partilhada por TacticsView, ClubTab e MatchBriefing.
 * @param {number} morale Valor 0–100 (qualquer número é limitado à escala)
 * @returns {string} Etiqueta com humor
 */
export function getMoraleLabel(morale) {
  const v = Math.max(0, Math.min(100, Number(morale) || 0));
  if (v < 15) return "Na Lama";
  if (v < 30) return "De Rasto";
  if (v < 45) return "Razoável";
  if (v < 60) return "Animados";
  if (v < 75) return "Bom";
  if (v < 90) return "Em Chamas";
  return "Excelente";
}
