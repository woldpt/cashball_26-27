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

/**
 * Cor semântica da moral do plantel (mesmos limiares do TacticsView).
 * @param {number} morale Valor 0–100 (qualquer número é limitado à escala)
 * @returns {string} chave de cor ("green"|"amber"|"red") para mapear para classes
 */
export function getMoraleColor(morale) {
  const v = Math.max(0, Math.min(100, Number(morale) || 0));
  if (v > 75) return "green";
  if (v >= 50) return "amber";
  return "red";
}

/**
 * Etiqueta do mood dos adeptos (bancada) — escala própria, mais emocional
 * que a moral do plantel. Partilhada por StadiumTab e MatchBriefing.
 * @param {number} mood Valor 0–100 (qualquer número é limitado à escala)
 * @returns {string} Etiqueta com humor
 */
export function getFansMoodLabel(mood) {
  const v = Math.max(0, Math.min(100, Number(mood) || 0));
  if (v < 15) return "Furiosos";
  if (v < 30) return "Zangados";
  if (v < 45) return "Desconfiados";
  if (v < 60) return "Mornos";
  if (v < 75) return "Confiantes";
  if (v < 90) return "Eufóricos";
  return "Em Êxtase";
}
