import { ASSISTANT_UNAVAILABLE_MIN } from "../constants/index.js";
import { isPlayerAvailable } from "./playerHelpers.js";
import { trainingCapTip, trainingLowTip } from "./trainingCapAdvice.js";

const SEEN_BASE_KEY = "cashball_assistant";

/**
 * Dicas que dispensam uma vez por SALA, não por jornada. São as que exigem
 * trabalho recorrente (o 11 refaz-se toda a jornada) mas já têm o seu próprio
 * gate na UI que as resolve — a Tática bloqueia o Pronto com o motivo. Sem
 * isto, a dica do 11 repetia-se todas as semanas e tapava as outras.
 * @type {Set<string>}
 */
export const ONCE_PER_ROOM_TIPS = new Set(["lineup"]);

/**
 * @typedef {object} AssistantTip
 * @property {string} id
 * @property {string} mood "worried" (padrão) | "sad" (dessaturado)
 * @property {string} text
 * @property {string} tab Tab que resolve a situação (CTA).
 * @property {string} cta
 */

/**
 * @typedef {object} AssistantState
 * @property {object[]} [squad] Plantel do treinador (`mySquad`).
 * @property {number} [matchweek] Jornada corrente (1-based).
 * @property {boolean} [hasRedFlag] Papéis que bloqueiam o Pronto (Jornal,
 *   patrocínio, proposta de emprego).
 * @property {boolean} [hasTraining] Foco de treino definido ou herdado.
 * @property {string|null} [focusName] Foco ativo (ex. "Forma").
 * @property {number|null} [fansMood] Moral dos adeptos (escala 1–50).
 * @property {number} [currentBudget]
 * @property {number} [totalWeeklyWage]
 * @property {boolean} [isLineupComplete]
 * @property {boolean} [lineupEligible] 11 por fechar E já passou o gate de
 *   inatividade (ver `LINEUP_IDLE_MS` no hook).
 */

/**
 * Chave do visto em localStorage, 1x por situação: muda com o
 * `calendarIndex`, por isso a dica volta se a situação persistir na semana
 * seguinte. As dicas recorrentes (`ONCE_PER_ROOM_TIPS`) usam a SALA como
 * âmbito em vez da jornada.
 *
 * Formato estável — mudá-lo faz reaparecer todas as dicas já vistas:
 * `cashball_assistant:<sala|?>:<jornada|sala>:<dica>`.
 * @param {string} [roomCode]
 * @param {number} [calendarIndex]
 * @param {string} tipId
 * @returns {string}
 */
export function seenKeyFor(roomCode, calendarIndex, tipId) {
  const scope = ONCE_PER_ROOM_TIPS.has(tipId) ? "sala" : (calendarIndex ?? 0);
  return `${SEEN_BASE_KEY}:${roomCode ?? "?"}:${scope}:${tipId}`;
}

/**
 * Totós do adjunto: regras fechadas v1, todas derivadas do estado que o
 * cliente já tem (zero backend). Prioridade = ordem do array: o que bloqueia
 * o Pronto primeiro. Os `build` devolvem a dica sem `id` — o id vive só aqui,
 * para não poder divergir da chave de visto.
 * @type {Array<{id: string, build: (s: AssistantState) => Omit<AssistantTip, "id">|null}>}
 */
export const ASSISTANT_TIPS = [
  {
    id: "redflag",
    build: (s) =>
      s.hasRedFlag
        ? {
            mood: "worried",
            text: "Ó meus meninos! Tens o Jornal cheio de papéis. Isto não se ganha sozinho, bora despachar, tá bem?",
            tab: "jornal",
            cta: "Resolver já",
          }
        : null,
  },
  {
    id: "lineup",
    build: (s) =>
      // `=== true` de propósito: sem evidência afirmativa (estado desconhecido)
      // o adjunto cala-se em vez de nagar.
      s.lineupEligible !== true || s.isLineupComplete === true
        ? null
        : {
            mood: "worried",
            text: "Olha, o onze não está fechado! Queres ir para o jogo coxo? Mete a carne toda no assador, bora!",
            tab: "tactic",
            cta: "Fechar o onze",
          },
  },
  {
    id: "training",
    build: (s) =>
      s.hasTraining !== false
        ? null
        : {
            mood: "worried",
            text: "Esqueceste-te do treino! Quem não treina forte não ganha. O futebol é momento e o momento é agora!",
            tab: "training",
            cta: "Puxar treino",
          },
  },
  {
    id: "trainingcap",
    build: (s) => trainingCapTip(s.squad, s.focusName),
  },
  {
    id: "traininglow",
    build: (s) => trainingLowTip(s.squad, s.focusName),
  },
  {
    id: "medical",
    build: (s) => {
      // `isPlayerAvailable` conta lesão, castigo e cooldown de transferência.
      const unavailable = (s.squad || []).filter(
        (p) => !isPlayerAvailable(p, s.matchweek),
      ).length;
      return unavailable < ASSISTANT_UNAVAILABLE_MIN
        ? null
        : {
            mood: "worried",
            text: "Tenho lesionados e castigados a mais! Revê os melões e escolhe só os que estão rijos.",
            tab: "players",
            cta: "Ver melões",
          };
    },
  },
  {
    id: "wage",
    // Ambos os números em falta = estado ainda a carregar: não inventar a
    // falência do cofre (só dispara com evidência afirmativa).
    build: (s) =>
      typeof s.currentBudget !== "number" ||
      typeof s.totalWeeklyWage !== "number" ||
      s.currentBudget >= s.totalWeeklyWage
        ? null
        : {
            mood: "worried",
            text: "O cofre não chega para os salários! A bola é redonda mas o dinheiro não estica. Despacha-te!",
            tab: "finances",
            cta: "Acertar contas",
          },
  },
];

/** Ids do catálogo, na ordem de prioridade (para ler os vistos da semana). */
export const ASSISTANT_TIP_IDS = ASSISTANT_TIPS.map((t) => t.id);

/**
 * Dicas candidatas para o estado dado, por ordem de prioridade (o `id` de
 * cada entrada do catálogo é injectado aqui).
 * @param {AssistantState} state
 * @returns {AssistantTip[]}
 */
export function buildAssistantTips(state) {
  return ASSISTANT_TIPS.map(({ id, build }) => {
    const tip = build(state || {});
    // `id` por último: o id do catálogo manda (o `trainingCapTip` traz o seu).
    return tip ? { ...tip, id } : null;
  }).filter((tip) => tip !== null);
}

/**
 * Dica a mostrar: a primeira candidata que (1) não seja da tab que a resolve
 * — anti-Clippy: apontar para onde o jogador já está não ajuda — e (2) ainda
 * não tenha sido vista nesta situação.
 * @param {AssistantState} state
 * @param {{activeTab?: string, seenIds?: Set<string>}} [opts]
 * @returns {AssistantTip|null}
 */
export function pickAssistantTip(state, { activeTab, seenIds } = {}) {
  return (
    buildAssistantTips(state).find(
      (tip) => tip.tab !== activeTab && !seenIds?.has(tip.id),
    ) ?? null
  );
}
