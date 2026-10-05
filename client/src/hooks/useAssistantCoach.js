import { useCallback, useEffect, useMemo, useState } from "react";
import { socket } from "../socket.js";
import { useGame } from "../contexts/GameContext.jsx";
import { useTactics } from "../contexts/TacticsContext.jsx";
import {
  ASSISTANT_TIP_IDS,
  pickAssistantTip,
  seenKeyFor,
} from "../utils/assistantTips.js";
import { useIdle } from "./useIdle.js";

const TRAINING_BASE_KEY = "cashball_training_focus";

/**
 * Onze incompleto só chateia após inatividade: aparecer logo no início da
 * semana torna-se maçador; surge só com a janela aberta e parada.
 */
const LINEUP_IDLE_MS = 90_000;

/** Silêncio do adjunto depois de um jogo acabar. */
const POST_MATCH_QUIET_MS = 45_000;

/**
 * Dicas já vistas na sala/semana corrente (chaves em localStorage). Lido uma
 * vez por sala/semana — o memo passa a depender de dados, não de localStorage
 * lido em render.
 * @param {string} [roomCode]
 * @param {number} [calendarIndex]
 * @returns {Set<string>}
 */
function readSeenIds(roomCode, calendarIndex) {
  const seen = new Set();
  if (typeof window === "undefined") return seen;
  for (const id of ASSISTANT_TIP_IDS) {
    if (
      window.localStorage.getItem(seenKeyFor(roomCode, calendarIndex, id)) === "1"
    ) {
      seen.add(id);
    }
  }
  return seen;
}

/**
 * Âmbito dos vistos: mudou (outra sala ou outra jornada) = reler.
 * @param {string} [roomCode]
 * @param {number} [calendarIndex]
 */
function seenScope(roomCode, calendarIndex) {
  return `${roomCode ?? "?"}:${calendarIndex ?? 0}`;
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
 * Treinador-adjunto: decide se há dica e qual (as regras vivem em
 * `utils/assistantTips.js`, puras e testadas). Aqui fica só o estado do
 * cliente: foco de treino (localStorage + BD), gate de inatividade do onze
 * e os vistos da semana.
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
    nextMatchSummary,
  } = useGame();
  const { isLineupComplete } = useTactics();

  // Silêncio pós-jogo: logo a seguir ao apito final o adjunto chateia.
  const [postMatchQuiet, setPostMatchQuiet] = useState(false);
  const [wasInMatch, setWasInMatch] = useState(isMatchInProgress);
  if (wasInMatch !== isMatchInProgress) {
    setWasInMatch(isMatchInProgress);
    if (!isMatchInProgress) setPostMatchQuiet(true);
  }
  useEffect(() => {
    if (!postMatchQuiet) return undefined;
    const t = setTimeout(() => setPostMatchQuiet(false), POST_MATCH_QUIET_MS);
    return () => clearTimeout(t);
  }, [postMatchQuiet]);

  // Vistos da semana em estado. Relido quando a sala/semana muda — ajuste
  // durante o render (sem efeito), evita um flash da dica já dispensada.
  const scope = seenScope(me?.roomCode, calendarIndex);
  const [seen, setSeen] = useState(() => ({
    scope,
    ids: readSeenIds(me?.roomCode, calendarIndex),
  }));
  if (seen.scope !== scope) {
    setSeen({ scope, ids: readSeenIds(me?.roomCode, calendarIndex) });
  }

  // Onze por fechar: só após inatividade (janela aberta e parada) —
  // nunca logo no início da semana. Depois de aparecer 1x, trava até
  // dispensar/fechar (senão escondia-se ao ir clicar no CTA).
  const lineupIdle = useIdle(LINEUP_IDLE_MS);
  const [lineupGate, setLineupGate] = useState({ week: calendarIndex, shown: false });
  if (lineupGate.week !== calendarIndex || (isLineupComplete && lineupGate.shown)) {
    setLineupGate({ week: calendarIndex, shown: false });
  }

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
    if (isMatchInProgress || postMatchQuiet || panelMode !== null) return null;
    if (dismissalModal || welcomeModal) return null;

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

    return pickAssistantTip(
      {
        squad: mySquad,
        matchweek: (calendarIndex ?? 0) + 1,
        hasRedFlag:
          (mySquad || []).some((p) => p?.contract_request_pending) ||
          sponsorState?.pending === true ||
          jobOfferModal != null,
        hasTraining,
        focusName,
        fansMood: teamInfo?.fans_mood ?? null,
        currentBudget,
        totalWeeklyWage,
        isLineupComplete,
        lineupEligible: !isLineupComplete && lineupIdle && !lineupGate.shown,
        cupWeekFriendly: nextMatchSummary?.cupWeekFriendly ?? null,
      },
      { activeTab, seenIds: seen.ids },
    );
  }, [
    me?.teamId,
    roomCode,
    isMatchInProgress,
    postMatchQuiet,
    panelMode,
    dismissalModal,
    welcomeModal,
    calendarIndex,
    mySquad,
    sponsorState?.pending,
    jobOfferModal,
    teamInfo?.fans_mood,
    totalWeeklyWage,
    currentBudget,
    isLineupComplete,
    lineupIdle,
    lineupGate.shown,
    nextMatchSummary?.cupWeekFriendly,
    activeTab,
    hasLocalTraining,
    localTraining,
    serverTraining,
    seen,
  ]);

  // Trava depois de aparecer: sem isto escondia-se ao ir clicar no CTA.
  if (tip?.id === "lineup" && !lineupGate.shown) {
    setLineupGate((g) => ({ ...g, shown: true }));
  }

  const dismissTip = useCallback(() => {
    if (!tip) return;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        seenKeyFor(me?.roomCode, calendarIndex, tip.id),
        "1",
      );
    }
    setSeen((prev) => ({ ...prev, ids: new Set(prev.ids).add(tip.id) }));
  }, [tip, me?.roomCode, calendarIndex]);

  const goTip = useCallback(() => {
    if (!tip) return;
    dismissTip();
    navigateTab(tip.tab);
  }, [tip, dismissTip, navigateTab]);

  return { tip, dismissTip, goTip };
}
