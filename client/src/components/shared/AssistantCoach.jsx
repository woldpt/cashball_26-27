import { motion } from "framer-motion";
import { MODAL_Z } from "../../constants/index.js";
import { useAssistantCoach } from "../../hooks/useAssistantCoach.js";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion.js";
import { Button } from "../shared/Button.jsx";

/**
 * Retrato do adjunto em medalhão (asset `/coaches/mister.webp`, JJ sem fundo): disco verde
 * da casa, anel a tinta e retrato recortado.
 * `mood` só muda o tratamento do retrato — "sad" dessatura e escurece.
 * @param {string} mood Expressão do adjunto ("worried" | "sad").
 * @param {boolean} [compact] Medalhão mais pequeno (tutorial no telemóvel).
 */
export function AssistantMascot({ mood, compact }) {
  const sad = mood === "sad";
  const size = compact ? "h-[76px] w-[76px]" : "h-[108px] w-[108px]";
  return (
    <div
      role="img"
      aria-label="Treinador-adjunto"
      className={`relative ${size} shrink-0 rounded-full flex items-center justify-center bg-[radial-gradient(circle_at_30%_25%,#1f8f4f,#0a3d1e_72%)] ring-2 ring-zinc-900 shadow-[0_4px_14px_rgba(0,0,0,0.5)]`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-[3px] rounded-full ring-1 ring-white/25"
      />
      <img
        src="/coaches/mister.webp"
        alt=""
        className="h-[86%] w-[86%] rounded-full object-cover object-top ring-1 ring-zinc-900/80"
        style={sad ? { filter: "saturate(0.45) brightness(0.82)" } : undefined}
      />
    </div>
  );
}

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
      className="fixed bottom-16 lg:bottom-6 left-0 right-0 pointer-events-none flex justify-center lg:justify-end px-3 lg:pr-6"
      style={{ zIndex: MODAL_Z.assistant }}
      data-tour="assistant-coach"
    >
      <motion.div
        key={tip.id}
        initial={reducedMotion ? false : { y: "110%" }}
        animate={{ y: 0 }}
        transition={{ duration: 0.3 }}
        className="pointer-events-auto flex items-end gap-2 w-full max-w-md lg:flex-row-reverse"
        role="dialog"
        aria-live="polite"
        aria-label={`Treinador-adjunto: ${tip.text}`}
      >
        <AssistantMascot mood={tip.mood} />
        {/* Clicar no balão dispensa — o 11 mantém-se dispensável pelo X (teclado). */}
        <div
          onClick={onDismiss}
          className="relative flex-1 cursor-pointer bg-white border-2 border-zinc-900 rounded-2xl shadow-2xl p-3 pr-2 text-zinc-900"
        >
          {/* Rabicho do balão: aponta ao retrato (à esquerda no mobile,
              à direita em desktop, onde o retrato fica no canto). */}
          <span
            aria-hidden
            className="absolute bottom-5 w-4 h-4 rotate-45 bg-white -left-[9px] border-l-2 border-b-2 border-zinc-900 lg:left-auto lg:-right-[9px] lg:border-l-0 lg:border-r-2"
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
 * Treinador-adjunto: medalhão do treinador + balão de banda desenhada.
 * Monta-se no `GameLayout`; o hook decide se há dica (1x/situação/semana).
 * @returns {JSX.Element|null}
 */
export function AssistantCoach() {
  const { tip, dismissTip, goTip } = useAssistantCoach();

  if (!tip) return null;

  return <AssistantCoachView tip={tip} onGo={goTip} onDismiss={dismissTip} />;
}
