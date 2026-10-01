import { motion } from "framer-motion";
import { MODAL_Z } from "../../constants/index.js";
import { useAssistantCoach } from "../../hooks/useAssistantCoach.js";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion.js";
import { Button } from "../shared/Button.jsx";

/**
 * @param {string} mood Expressão do adjunto ("worried" | "sad").
 */
function AssistantMascot({ mood }) {
  const sad = mood === "sad";
  return (
    <svg
      viewBox="0 0 72 88"
      className="h-[76px] w-[62px] shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
      role="img"
      aria-label="Treinador-adjunto"
    >
      {/* Tronco (fato de treino) */}
      <path d="M8,88 C8,66 20,58 36,58 C52,58 64,66 64,88 Z" fill="#15803d" />
      <path
        d="M30,58 L36,68 L42,58"
        fill="none"
        stroke="#f8fafc"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Apito ao peito */}
      <path
        d="M36,68 C36,74 30,76 26,78"
        fill="none"
        stroke="#eab308"
        strokeWidth="1.6"
      />
      <circle cx="24" cy="79" r="3.4" fill="#eab308" />
      <circle cx="24" cy="79" r="1.3" fill="#713f12" />
      {/* Pescoço e cabeça */}
      <rect x="31" y="44" width="10" height="14" rx="3" fill="#e8b98a" />
      <circle cx="36" cy="32" r="16" fill="#f0c9a0" />
      {/* Boné */}
      <path d="M20,30 C20,16 28,10 36,10 C44,10 52,16 52,30 L52,32 L20,32 Z" fill="#166534" />
      <rect x="48" y="28" width="12" height="4" rx="2" fill="#166534" />
      <circle cx="36" cy="10" r="2.4" fill="#22c55e" />
      {/* Olhos */}
      <circle cx="30" cy="36" r="2" fill="#18181b" />
      <circle cx="42" cy="36" r="2" fill="#18181b" />
      {/* Sobrancelhas */}
      {sad ? (
        <>
          <line x1="26" y1="30" x2="34" y2="32.5" stroke="#18181b" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="46" y1="30" x2="38" y2="32.5" stroke="#18181b" strokeWidth="1.8" strokeLinecap="round" />
        </>
      ) : (
        <>
          <line x1="26" y1="31" x2="34" y2="29" stroke="#18181b" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="46" y1="31" x2="38" y2="29" stroke="#18181b" strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}
      {/* Boca */}
      {sad ? (
        <path d="M30,48 C32,45 40,45 42,48" fill="none" stroke="#18181b" strokeWidth="2" strokeLinecap="round" />
      ) : (
        <path d="M29,45 C32,49 40,49 43,45" fill="none" stroke="#18181b" strokeWidth="2" strokeLinecap="round" />
      )}
    </svg>
  );
}

/**
 * Treinador-adjunto: mascote até à cintura + balão de banda desenhada.
 * Monta-se no `GameLayout`; o hook decide se há dica (1x/situação/semana).
 * @returns {JSX.Element|null}
 */
/**
 * Vista pura do adjunto (sem contextos): a mesma usada em produção e no harness.
 * @param {Object} props
 * @param {{id: string, mood: string, text: string, cta: string}} props.tip Dica ativa.
 * @param {() => void} props.onGo Navega para a tab que resolve.
 * @param {() => void} props.onDismiss Dispensa a dica (1x/semana).
 * @returns {JSX.Element}
 */
export function AssistantCoachView({ tip, onGo, onDismiss }) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div
      className="fixed bottom-16 lg:bottom-6 left-0 right-0 pointer-events-none flex justify-center px-3"
      style={{ zIndex: MODAL_Z.assistant }}
      data-tour="assistant-coach"
    >
      <motion.div
        key={tip.id}
        initial={reducedMotion ? false : { y: "110%" }}
        animate={{ y: 0 }}
        transition={{ duration: 0.3 }}
        className="pointer-events-auto flex items-end gap-2 w-full max-w-md"
        role="dialog"
        aria-live="polite"
        aria-label={`Treinador-adjunto: ${tip.text}`}
      >
        <AssistantMascot mood={tip.mood} />
        <div className="relative flex-1 bg-white border-2 border-zinc-900 rounded-2xl shadow-2xl p-3 pr-2 text-zinc-900">
          {/* Rabicho do balão */}
          <span
            aria-hidden
            className="absolute -left-[9px] bottom-5 w-4 h-4 rotate-45 bg-white border-l-2 border-b-2 border-zinc-900"
          />
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
            Treinador-adjunto
          </p>
          <p className="text-sm leading-snug mt-0.5">{tip.text}</p>
          <div className="flex items-center justify-between gap-2 mt-2">
            <Button variant="primary" size="sm" uppercase onClick={onGo}>
              {tip.cta}
            </Button>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dispensar dica"
              className="min-w-11 min-h-11 px-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              X
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/**
 * Treinador-adjunto: mascote até à cintura + balão de banda desenhada.
 * Monta-se no `GameLayout`; o hook decide se há dica (1x/situação/semana).
 * @returns {JSX.Element|null}
 */
export function AssistantCoach() {
  const { tip, dismissTip, goTip } = useAssistantCoach();

  if (!tip) return null;

  return <AssistantCoachView tip={tip} onGo={goTip} onDismiss={dismissTip} />;
}
