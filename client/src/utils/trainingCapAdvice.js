import {
  TRAINING_CAP_SQUAD_RATIO,
  TRAINING_CAP_TARGETS,
} from "../constants/index.js";

/**
 * Aviso de teto do treino: a Forma/Resistência tem máximo 50 e, no teto, o
 * bónus semanal é zero — continuar com esse foco desperdiça a semana.
 * Dispara quando a maioria do plantel (TRAINING_CAP_SQUAD_RATIO) já está no
 * teto do atributo treinado. Foco de skill (ou desconhecido) nunca avisa.
 *
 * @param {object[]} squad Plantel do treinador (`mySquad`)
 * @param {string|null} focusName Foco de treino ativo (ex. "Forma")
 * @returns {{id: string, mood: string, text: string, tab: string, cta: string}|null}
 */
export function trainingCapTip(squad, focusName) {
  const target = focusName ? TRAINING_CAP_TARGETS[focusName] : undefined;
  if (!target) return null;

  const rows = (squad || []).filter(
    (p) => typeof p?.[target.field] === "number",
  );
  if (rows.length === 0) return null;

  const capped = rows.filter((p) => p[target.field] >= target.max).length;
  if (capped / rows.length < TRAINING_CAP_SQUAD_RATIO) return null;

  return {
    id: "trainingcap",
    mood: "worried",
    // Voz do adjunto como nas outras dicas — mas sem prometer o plantel
    // inteiro: o gate é a maioria (TRAINING_CAP_SQUAD_RATIO).
    text: `Foco na ${focusName}? Ó mister, a maioria dos meninos já está no teto — este treino não rende. Muda o foco!`,
    tab: "training",
    cta: "Mudar foco",
  };
}
