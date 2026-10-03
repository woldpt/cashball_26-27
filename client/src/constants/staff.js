/**
 * staff.js — catálogo de apresentação dos funcionários (rótulos, ícones e
 * formatação dos efeitos).
 *
 * Os NÚMEROS (tabela de salários, custos, bónus por nível) vêm sempre do
 * servidor (`staffState`) — aqui só se formata o que ele manda. Um papel novo
 * no servidor aparece na UI com o fallback; para ficar bonito basta acrescentar
 * a entrada neste mapa.
 */

/**
 * @typedef {object} StaffRoleMeta
 * @property {string} label Nome do papel.
 * @property {string} icon Ícone `material-symbols-outlined`.
 * @property {string} description Uma linha sobre o que o papel faz.
 * @property {(effect: object) => string} effect Efeito do nível, já formatado.
 */

/** @type {Record<string, StaffRoleMeta>} */
export const STAFF_ROLE_META = {
  auxiliar: {
    label: "Treinador Auxiliar",
    icon: "school",
    description: "Acelera a evolução das skills no treino semanal.",
    effect: (e) => `Treino +${e.trainingPct}%`,
  },
  fisico: {
    label: "Preparador Físico",
    icon: "fitness_center",
    description: "Recupera a forma de quem descansa e trava o desgaste.",
    effect: (e) => {
      const parts = [];
      if (e.restedForm) parts.push(`+${e.restedForm} forma`);
      if (e.resistance) parts.push(`+${e.resistance} resistência`);
      if (e.decayPct) parts.push(`−${e.decayPct}% desgaste`);
      return parts.join(" · ");
    },
  },
};

const FALLBACK = {
  label: "Funcionário",
  icon: "badge",
  description: "Trabalha nos bastidores do clube.",
  effect: () => "",
};

/**
 * Apresentação de um papel (com fallback para papéis novos do servidor).
 * @param {string} role
 * @returns {StaffRoleMeta}
 */
export function staffRoleMeta(role) {
  return STAFF_ROLE_META[role] || FALLBACK;
}

/**
 * Estrelas do nível (☆☆☆☆☆ a ★★★★★).
 * @param {number} level
 * @param {number} max
 * @returns {string}
 */
export function staffLevelStars(level, max = 5) {
  const n = Math.max(0, Math.min(max, Math.floor(Number(level) || 0)));
  return "★".repeat(n) + "☆".repeat(max - n);
}
