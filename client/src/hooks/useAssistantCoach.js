import { useCallback, useEffect, useMemo, useState } from "react";
import { socket } from "../socket.js";
import { useGame } from "../contexts/GameContext.jsx";
import { useTactics } from "../contexts/TacticsContext.jsx";
import { isPlayerAvailable } from "../utils/playerHelpers.js";
import { trainingCapTip } from "../utils/trainingCapAdvice.js";

const SEEN_BASE_KEY = "cashball_assistant";
const TRAINING_BASE_KEY = "cashball_training_focus";

/**
 * Chave de visto 1x por situação/semana: muda com o calendarIndex,
 * por isso a dica volta se a situação persistir na semana seguinte.
 * @param {string} [roomCode]
 * @param {number} [calendarIndex]
 * @param {string} [tipId]
 */
function seenKey(roomCode, calendarIndex, tipId) {
  return `${SEEN_BASE_KEY}:${roomCode ?? "?"}:${calendarIndex ?? 0}:${tipId}`;
}

/**
 * Dicas que dispensam uma vez por SALA, não por jornada. São as que exigem
 * trabalho recorrente (o 11 refaz-se toda a jornada) mas já têm o seu próprio
 * gate na UI que as resolve — a Tática bloqueia o Pronto com o motivo. Sem
 * isto, a dica do 11 repetia-se todas as semanas e tapava as outras.
 */
const ONCE_PER_ROOM_TIPS = new Set(["lineup"]);

/**
 * @param {string} [roomCode]
 * @param {number} [calendarIndex]
 * @param {{id: string}} tip
 */
function seenKeyFor(roomCode, calendarIndex, tip) {
  return ONCE_PER_ROOM_TIPS.has(tip.id)
    ? seenKey(roomCode, "sala", tip.id)
    : seenKey(roomCode, calendarIndex, tip.id);
}

/**
 * getTrainingFocus com timeout — o servidor pode nunca responder
 * (socket caído); resolve null em vez de pendurar o adjunto.
 * Espelho do `emitWithTimeout` do TrainingTab (só leitura, sem retry).
 * @param {number} [ms]
 * @returns {Promise<string|null>}
 */
function fetchServerTrainingFocus(ms = 3000) {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        resolve(null);
      }
    }, ms);
    try {
      socket.emit("getTrainingFocus", (result) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(typeof result === "string" ? result : null);
      });
    } catch {
      done = true;
      clearTimeout(timer);
      resolve(null);
    }
  });
}

/**
 * Totós do adjunto: regras fechadas v1, todas derivadas do estado que o
 * cliente já tem (zero backend). Prioridade: o que bloqueia o Pronto primeiro.
 * @returns {{ tip: object|null, dismissTip: () => void, goTip: () => void }}
 */
export function useAssistantCoach() {
  const {
    me,
    mySquad,
    teamInfo,
    totalWeeklyWage,
    currentBudget,
    sponsorState,
    jobOfferModal,
    calendarIndex,
    activeTab,
    isMatchInProgress,
    panelMode,
    dismissalModal,
    welcomeModal,
    navigateTab,
  } = useGame();
  const { isLineupComplete } = useTactics();

  // Re-render ao dispensar: a chave de visto é sincrónica em localStorage.
  const [dismissTick, setDismissTick] = useState(0);
  // Foco vindo da BD, carimbado por semana: chave diferente = ainda a
  // perguntar (benefício da dúvida: não nagar); focus string = definido
  // (atual ou herdado); null = nunca houve treino.
  const [serverTraining, setServerTraining] = useState({ key: null, focus: undefined });

  const roomCode = me?.roomCode;
  const trainingKey = roomCode
    ? `${TRAINING_BASE_KEY}:${roomCode}`
    : TRAINING_BASE_KEY;
  // Valor do foco (não só a existência): a dica do teto precisa de saber se
  // o treino é Forma/Resistência. Ausente = lido da BD abaixo.
  const localTraining =
    typeof window !== "undefined"
      ? window.localStorage.getItem(trainingKey)
      : null;
  const hasLocalTraining = Boolean(localTraining);

  // A BD é a verdade; o localStorage é só o caminho rápido. Pergunta ao
  // servidor só quando o caminho rápido falha (outro dispositivo/cache limpa).
  useEffect(() => {
    if (!me?.teamId || hasLocalTraining) return;
    const weekKey = `${roomCode ?? "?"}:${calendarIndex ?? 0}`;
    let alive = true;
    fetchServerTrainingFocus().then((focus) => {
      if (alive) setServerTraining({ key: weekKey, focus });
    });
    return () => {
      alive = false;
    };
  }, [me?.teamId, roomCode, calendarIndex, hasLocalTraining]);

  const tip = useMemo(() => {
    if (!me?.teamId) return null;
    if (isMatchInProgress || panelMode !== null) return null;
    if (dismissalModal || welcomeModal) return null;

    const week = (calendarIndex ?? 0) + 1;

    // Herança silenciosa: foco atual ou herdado da BD conta como definido.
    // Chave de outra semana = ainda a perguntar — nunca nagar por dúvida.
    // ponytail: sem round-trip quando o localStorage chega; noutro
    // dispositivo cai aqui e a BD decide uma vez por semana.
    const weekKey = `${roomCode ?? "?"}:${calendarIndex ?? 0}`;
    const serverFocus =
      serverTraining.key === weekKey ? serverTraining.focus : undefined;
    const hasTraining = hasLocalTraining || serverFocus !== null;
    // Foco ativo: localStorage primeiro, BD como fallback. Desconhecido =
    // sem dica de teto (não adivinhar).
    const focusName =
      localTraining ?? (typeof serverFocus === "string" ? serverFocus : null);
    // Teto do atributo treinado (Forma/Resistência) já atingido pela maioria
    // do plantel: no máximo o bónus semanal é zero, logo a semana é perdida.
    const capTip = trainingCapTip(mySquad, focusName);
    const unavailable = (mySquad || []).filter(
      (p) => !isPlayerAvailable(p, week),
    ).length;
    const hasRedFlag =
      (mySquad || []).some((p) => p?.contract_request_pending) ||
      sponsorState?.pending === true ||
      jobOfferModal != null;
    const fansMood = teamInfo?.fans_mood ?? null;

    /** @type {Array<{id: string, mood: string, text: string, tab: string, cta: string}>} */
    const candidates = [
      !hasRedFlag
        ? null
        : {
            id: "redflag",
            mood: "worried",
            text: "Tens pendências no Jornal que bloqueiam o Pronto.",
            tab: "jornal",
            cta: "Ver Jornal",
          },
      isLineupComplete
        ? null
        : {
            id: "lineup",
            mood: "worried",
            text: "O onze não está fechado para a jornada.",
            tab: "tactic",
            cta: "Fechar onze",
          },
      hasTraining
        ? null
        : {
            id: "training",
            mood: "worried",
            text: "Esqueceste-te de definir o treino da semana.",
            tab: "training",
            cta: "Definir treino",
          },
      capTip,
      unavailable < 3
        ? null
        : {
            id: "medical",
            mood: "worried",
            text: "A enfermaria está cheia — revê o plantel.",
            tab: "players",
            cta: "Ver plantel",
          },
      currentBudget >= (totalWeeklyWage || 0)
        ? null
        : {
            id: "wage",
            mood: "worried",
            text: "O saldo não cobre uma semana de salários.",
            tab: "finances",
            cta: "Ver finanças",
          },
      fansMood == null || fansMood >= 23
        ? null
        : {
            id: "fans",
            mood: "sad",
            text: "Os adeptos estão inquietos — precisam de uma vitória.",
            tab: "club",
            cta: "Ver clube",
          },
    ].filter(Boolean);

    // Anti-Clippy: 1x por situação (semana, ou sala nas dicas recorrentes)
    // + nunca na tab que resolve.
    return (
      candidates.find(
        (c) =>
          c.tab !== activeTab &&
          typeof window !== "undefined" &&
          window.localStorage.getItem(
            seenKeyFor(roomCode, calendarIndex, c),
          ) !== "1",
      ) || null
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dismissTick força re-render após dispensar
  }, [
    me?.teamId,
    me?.roomCode,
    isMatchInProgress,
    panelMode,
    dismissalModal,
    welcomeModal,
    calendarIndex,
    mySquad,
    sponsorState?.pending,
    jobOfferModal,
    teamInfo?.fans_mood,
    teamInfo?.budget,
    totalWeeklyWage,
    currentBudget,
    isLineupComplete,
    activeTab,
    hasLocalTraining,
    localTraining,
    serverTraining,
    dismissTick,
  ]);

  const dismissTip = useCallback(() => {
    if (tip && typeof window !== "undefined") {
      window.localStorage.setItem(
        seenKeyFor(me?.roomCode, calendarIndex, tip),
        "1",
      );
    }
    setDismissTick((t) => t + 1);
  }, [tip, me?.roomCode, calendarIndex]);

  const goTip = useCallback(() => {
    if (!tip) return;
    dismissTip();
    navigateTab(tip.tab);
  }, [tip, dismissTip, navigateTab]);

  return { tip, dismissTip, goTip };
}
