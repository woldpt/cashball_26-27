import { AnimatePresence } from "framer-motion";
import { useGame } from "../../contexts/GameContext.jsx";
import { useAssistantCoach } from "../../hooks/useAssistantCoach.js";
import { AssistantCoachView, AssistantMascot } from "./AssistantCoachView.jsx";

// A vista pura vive em `AssistantCoachView.jsx` (sem contextos, sem socket);
// o tutorial importa o medalhão directamente de lá (mantém-se fora do socket).
export { AssistantCoachView, AssistantMascot };

/**
 * Treinador-adjunto: boneco do treinador + balão de banda desenhada.
 * Monta-se no `GameLayout`; o hook decide se há dica (1x/situação/semana) e
 * o balão cala-se enquanto o fly-up do menu mobile está aberto.
 * @returns {JSX.Element|null}
 */
export function AssistantCoach() {
  const { mobileSubMenu } = useGame();
  const { tip, dismissTip, goTip } = useAssistantCoach();

  return (
    <AnimatePresence>
      {tip && (
        <AssistantCoachView
          key={tip.id}
          tip={tip}
          menuOpen={mobileSubMenu != null}
          onGo={goTip}
          onDismiss={dismissTip}
        />
      )}
    </AnimatePresence>
  );
}
