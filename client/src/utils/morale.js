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
 * Tom semântico da moral — mesmos limiares do getMoraleLabel (7 níveis),
 * para a etiqueta nunca vestir cor de outro escalão (ex. "Animados" de vermelho).
 * @param {number} morale Valor 0–100 (qualquer número é limitado à escala)
 * @returns {string} tom ("red"|"orange"|"amber"|"yellow"|"lime"|"green"|"emerald")
 */
export function getMoraleColor(morale) {
  const v = Math.max(0, Math.min(100, Number(morale) || 0));
  if (v < 15) return "red";
  if (v < 30) return "orange";
  if (v < 45) return "amber";
  if (v < 60) return "yellow";
  if (v < 75) return "lime";
  if (v < 90) return "green";
  return "emerald";
}

const MORALE_TONE_CLASSES = {
  red: { text: "text-red-400", bar: "bg-red-500", dot: "bg-red-400" },
  orange: { text: "text-orange-400", bar: "bg-orange-500", dot: "bg-orange-400" },
  amber: { text: "text-amber-400", bar: "bg-amber-500", dot: "bg-amber-400" },
  yellow: { text: "text-yellow-300", bar: "bg-yellow-400", dot: "bg-yellow-300" },
  lime: { text: "text-lime-400", bar: "bg-lime-500", dot: "bg-lime-400" },
  green: { text: "text-green-400", bar: "bg-green-500", dot: "bg-green-400" },
  emerald: { text: "text-emerald-400", bar: "bg-emerald-500", dot: "bg-emerald-400" },
};

/**
 * Classes Tailwind do tom da moral (texto, barra e dot partilham o tom).
 * @param {number} morale Valor 0–100
 * @returns {{ text: string, bar: string, dot: string }} classes do tom
 */
export function getMoraleClasses(morale) {
  return MORALE_TONE_CLASSES[getMoraleColor(morale)] ?? MORALE_TONE_CLASSES.amber;
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
