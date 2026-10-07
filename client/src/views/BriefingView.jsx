import { useEffect } from "react";
import { MatchBriefing } from "../components/live/MatchBriefing.jsx";
import { useTactics } from "../contexts/TacticsContext.jsx";

/**
 * Página de Briefing — relatório do próximo jogo, independente da Tática.
 * Abri-la conta como "visto" nesta jornada (o Continuar passa à tática).
 * @returns {JSX.Element}
 */
export function BriefingView() {
  const { nextMatchSummary, markBriefingSeen } = useTactics();
  useEffect(() => {
    if (nextMatchSummary) markBriefingSeen();
  }, [nextMatchSummary, markBriefingSeen]);
  return (
    <div className="pb-20 short:pb-4 xl:pb-0">
      <MatchBriefing />
    </div>
  );
}
