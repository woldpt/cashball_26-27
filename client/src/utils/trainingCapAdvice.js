import {
  TRAINING_CAP_SQUAD_RATIO,
  TRAINING_CAP_TARGETS,
  TRAINING_LOW_AVG,
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

/**
 * Oposto do teto: a média do plantel em Forma/Resistência está abaixo de
 * TRAINING_LOW_AVG e o foco ativo não é esse atributo. Com os dois baixos,
 * aponta o mais baixo.
 *
 * @param {object[]} squad Plantel do treinador (`mySquad`)
 * @param {string|null} focusName Foco de treino ativo
 * @returns {{id: string, mood: string, text: string, tab: string, cta: string}|null}
 */
export function trainingLowTip(squad, focusName) {
  let worst = null;
  for (const [name, { field }] of Object.entries(TRAINING_CAP_TARGETS)) {
    if (name === focusName) continue;
    const vals = (squad || [])
      .map((p) => p?.[field])
      .filter((v) => typeof v === "number");
    if (vals.length === 0) continue;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    if (avg < TRAINING_LOW_AVG && (!worst || avg < worst.avg))
      worst = { name, avg };
  }
  if (!worst) return null;
  return {
    id: "traininglow",
    mood: "worried",
    text: `Ó mister, os meninos andam em baixo de ${worst.name}! Assim não aguentam o jogo. Puxa por isso no treino!`,
    tab: "training",
    cta: "Mudar foco",
  };
}
