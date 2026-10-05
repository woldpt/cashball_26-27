import { AnimatePresence } from "framer-motion";
import { useGame } from "../../contexts/GameContext.jsx";
import { AssistantCoachView, AssistantMascot } from "./AssistantCoachView.jsx";

// A vista pura vive em `AssistantCoachView.jsx` (sem contextos, sem socket);
// o tutorial importa o medalhão directamente de lá (mantém-se fora do socket).
export { AssistantCoachView, AssistantMascot };

/**
 * Treinador-adjunto: boneco do treinador + balão de banda desenhada.
 * O `GameLayout` corre o `useAssistantCoach` (a barra de notícias também
 * precisa de saber se há dica) e passa o resultado; o balão cala-se enquanto
 * o fly-up do menu mobile está aberto.
 * @param {Object} props
 * @param {object|null} props.tip Dica ativa.
 * @param {() => void} props.dismissTip Dispensa a dica.
 * @param {() => void} props.goTip Navega para a tab que resolve.
 * @returns {JSX.Element}
 */
export function AssistantCoach({ tip, dismissTip, goTip }) {
  const { mobileSubMenu, me, teams } = useGame();
  const color = teams.find((t) => Number(t.id) === Number(me?.teamId))?.color_primary;

  return (
    <AnimatePresence>
      {tip && (
        <AssistantCoachView
          key={tip.id}
          tip={tip}
          menuOpen={mobileSubMenu != null}
          onGo={goTip}
          onDismiss={dismissTip}
          color={color}
        />
      )}
    </AnimatePresence>
  );
}
