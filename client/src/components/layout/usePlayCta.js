import { socket } from "../../socket.js";
import { useGame } from "../../contexts/GameContext.jsx";
import { useTactics } from "../../contexts/TacticsContext.jsx";
import { useInbox } from "../../hooks/useInbox.js";

/**
 * Botão principal da jornada ("Continuar"), partilhado pelo header desktop e
 * pelo bottom-nav mobile. Dinâmico: Jornal (se há red flags) → Briefing (1ª vez
 * na jornada) → Tática → "Jogar!" com o 11 válido.
 *
 * - `idle` — por preparar; `active` — já na tab de tática;
 * - `waiting` — pronto, à espera dos outros treinadores (`readyCount/totalCoaches`);
 * - `live` — jogo em curso (desativado).
 *
 * @param {() => void} scrollToTop Sobe o conteúdo ao topo depois de navegar.
 * @returns {{ canPlay: boolean, short: string, state: "idle"|"active"|"waiting"|"live", label: string, icon: string, readyCount: number, totalCoaches: number, onClick: () => void }}
 */
export function usePlayCta(scrollToTop) {
  const {
    players,
    awaitingCoaches,
    me,
    activeTab,
    navigateTab,
    teamInfo,
    isMatchInProgress,
    setMobileSubMenu,
  } = useGame();
  const {
    tactic,
    isLineupComplete,
    handleReady,
    nextMatchSummary,
    nextMatchOpponent,
    briefingSeen,
  } = useTactics();
  const { redFlags } = useInbox();

  const myReady = !!players.find((p) => p.name === me?.name)?.ready;
  const readyCount = players.filter((p) => p.ready).length;
  const totalCoaches =
    players.length +
    awaitingCoaches.filter((n) => !players.some((p) => p.name === n)).length;

  const state = isMatchInProgress
    ? "live"
    : myReady
      ? "waiting"
      : activeTab === "tactic"
        ? "active"
        : "idle";

  // Na tática com 11 + banco válidos o botão passa a confirmar a jornada.
  // Espectador eliminado da Taça tem o seu próprio botão na página.
  const canPlay =
    state === "active" &&
    isLineupComplete &&
    !(nextMatchSummary?.isCup && !nextMatchOpponent);

  const onClick = () => {
    if (isMatchInProgress) return;
    if (canPlay) return handleReady();
    // Sem adversário (eliminado da Taça) não há briefing a ver.
    const hasBriefing = !!nextMatchSummary && !(nextMatchSummary.isCup && !nextMatchOpponent);
    const dest = redFlags > 0 ? "jornal" : hasBriefing && !briefingSeen ? "briefing" : "tactic";
    navigateTab(dest);
    setMobileSubMenu(null);
    scrollToTop();
    if (dest === "tactic" && teamInfo?.id && tactic) {
      socket.emit("requestTacticFamiliarity", teamInfo.id);
      socket.emit("requestAllTacticFamiliarity");
    }
  };

  return {
    state,
    label: state === "live" ? "AO VIVO" : state === "waiting" ? "PRONTO" : canPlay ? "Jogar!" : "Continuar",
    short: state === "live" ? "AO VIVO" : state === "waiting" ? "PRONTO" : canPlay ? "JOGAR" : "CONTINUAR",
    icon: state === "live" ? "sensors" : state === "waiting" ? "check_circle" : canPlay ? "play_arrow" : "arrow_forward",
    canPlay,
    readyCount,
    totalCoaches,
    onClick,
  };
}
