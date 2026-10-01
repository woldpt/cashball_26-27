import { useCallback, useMemo, useState } from "react";
import { useGame } from "../contexts/GameContext.jsx";
import { useTactics } from "../contexts/TacticsContext.jsx";
import { isPlayerAvailable } from "../utils/playerHelpers.js";

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

  const tip = useMemo(() => {
    if (!me?.teamId) return null;
    if (isMatchInProgress || panelMode !== null) return null;
    if (dismissalModal || welcomeModal) return null;

    const week = (calendarIndex ?? 0) + 1;
    const roomCode = me?.roomCode;

    const hasTraining =
      typeof window === "undefined" ||
      Boolean(
        window.localStorage.getItem(
          roomCode ? `${TRAINING_BASE_KEY}:${roomCode}` : TRAINING_BASE_KEY,
        ),
      );
    // ponytail: só localStorage, sem round-trip ao servidor — noutro
    // dispositivo o adjunto pode insistir uma vez a mais; o Treino é que manda.
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

    // Anti-Clippy: 1x por situação/semana + nunca na tab que resolve.
    return (
      candidates.find(
        (c) =>
          c.tab !== activeTab &&
          typeof window !== "undefined" &&
          window.localStorage.getItem(seenKey(roomCode, calendarIndex, c.id)) !==
            "1",
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
    dismissTick,
  ]);

  const dismissTip = useCallback(() => {
    if (tip && typeof window !== "undefined") {
      window.localStorage.setItem(
        seenKey(me?.roomCode, calendarIndex, tip.id),
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
