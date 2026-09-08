import { useCallback, useMemo, useState } from "react";
import { COACH_TUTORIAL_STEPS } from "../components/tutorial/coachTutorialSteps.js";

const keyFor = (coachName, roomCode) =>
  `cashball_tutorial:${coachName ?? "?"}:${roomCode ?? "?"}`;

/**
 * Estado do tutorial guiado de contas novas de Coach.
 * A conclusão é persistida por treinador+sala em localStorage.
 *
 * @param {Object} me - coach atual ({ name, roomCode })
 * @returns {{ tutorial: { active: boolean, index: number }, total: number, startTutorial: Function, replayTutorial: Function, nextStep: Function, prevStep: Function, skipTutorial: Function, finishTutorial: Function }}
 */
export function useCoachTutorial(me) {
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);

  const storageKey = useMemo(
    () => keyFor(me?.name, me?.roomCode),
    [me?.name, me?.roomCode],
  );

  const hasCompleted = useCallback(() => {
    try {
      return window.localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  }, [storageKey]);

  const markCompleted = useCallback(() => {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // Ignore storage failures.
    }
  }, [storageKey]);

  /** Arranca do primeiro passo (usado ao fechar o WelcomeModal de conta nova). */
  const startTutorial = useCallback(() => {
    if (hasCompleted()) return false;
    setIndex(0);
    setActive(true);
    return true;
  }, [hasCompleted]);

  /** Reabre o tutorial a pedido (botão "Rever tutorial" no Clube). */
  const replayTutorial = useCallback(() => {
    setIndex(0);
    setActive(true);
  }, []);

  const nextStep = useCallback(() => {
    if (index + 1 >= COACH_TUTORIAL_STEPS.length) {
      markCompleted();
      setActive(false);
      return;
    }
    setIndex((i) => i + 1);
  }, [index, markCompleted]);

  const prevStep = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  /** Saltar marca como concluído para não reaparecer. */
  const skipTutorial = useCallback(() => {
    markCompleted();
    setActive(false);
  }, [markCompleted]);

  const finishTutorial = useCallback(() => {
    markCompleted();
    setActive(false);
  }, [markCompleted]);

  return {
    tutorial: { active, index },
    total: COACH_TUTORIAL_STEPS.length,
    startTutorial,
    replayTutorial,
    nextStep,
    prevStep,
    skipTutorial,
    finishTutorial,
  };
}
