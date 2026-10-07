import { MatchBriefing } from "../components/live/MatchBriefing.jsx";

/**
 * Página de Briefing — relatório do próximo jogo, independente da Tática.
 * @returns {JSX.Element}
 */
export function BriefingView() {
  return (
    <div className="pb-20 short:pb-4 xl:pb-0">
      <MatchBriefing />
    </div>
  );
}
