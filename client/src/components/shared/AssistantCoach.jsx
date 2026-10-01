import { motion } from "framer-motion";
import { MODAL_Z } from "../../constants/index.js";
import { useAssistantCoach } from "../../hooks/useAssistantCoach.js";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion.js";
import { Button } from "../shared/Button.jsx";

/**
 * Mascote do adjunto, estilo Hattrick: retrato meio-corpo de um veterano de
 * cabelo grisalho penteado para trás, barba branca aparada, casaco de treino
 * verde de gola aberta e apito — inspirado na fisionomia de Jorge Jesus.
 * @param {string} mood Expressão do adjunto ("worried" | "sad").
 */
function AssistantMascot({ mood }) {
  const sad = mood === "sad";
  return (
    <svg
      viewBox="0 0 96 128"
      className="h-[112px] w-[84px] shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
      role="img"
      aria-label="Treinador-adjunto"
    >
      {/* Pescoço (fica por baixo da barba e do colarinho) */}
      <rect x="41" y="52" width="14" height="36" rx="6" fill="#c98f5d" />
      {/* Orelhas */}
      <circle cx="26.5" cy="46" r="4.5" fill="#e3a76f" />
      <circle cx="69.5" cy="46" r="4.5" fill="#e3a76f" />
      {/* Tronco — casaco de treino verde */}
      <path d="M12,128 C12,98 26,86 48,86 C70,86 84,98 84,128 Z" fill="#15803d" />
      {/* Fendas das mangas */}
      <path
        d="M25,90 C21,102 19,114 19,128"
        fill="none"
        stroke="#14532d"
        strokeWidth="2"
        opacity="0.55"
        strokeLinecap="round"
      />
      <path
        d="M71,90 C75,102 77,114 77,128"
        fill="none"
        stroke="#14532d"
        strokeWidth="2"
        opacity="0.55"
        strokeLinecap="round"
      />
      {/* T-shirt branca à vista + colarinho aberto */}
      <path d="M40,90 L56,90 L48,108 Z" fill="#f8fafc" />
      <path d="M36,88 L48,102 L48,94 C42,92 38,90 36,88 Z" fill="#166534" />
      <path d="M60,88 L48,102 L48,94 C54,92 58,90 60,88 Z" fill="#166534" />
      {/* Fecho central do casaco */}
      <line x1="48" y1="108" x2="48" y2="128" stroke="#d1fae5" strokeWidth="1.5" opacity="0.7" />
      {/* Apito com cordão, ao peito */}
      <path
        d="M46,96 C40,101 34,103 30,105"
        fill="none"
        stroke="#eab308"
        strokeWidth="1.6"
      />
      <circle cx="28" cy="107" r="3.6" fill="#eab308" />
      <circle cx="28" cy="107" r="1.4" fill="#713f12" />
      {/* Cabeça — pele tostada */}
      <ellipse cx="48" cy="40" rx="21" ry="24" fill="#e3a76f" />
      {/* Cabelo grisalho penteado para trás */}
      <path
        d="M27,44 C22,20 34,7 48,7 C62,7 74,20 69,44 C69,31 63,24 55,21 C50,19.5 45,19.5 41,21 C33,24 27,31 27,44 Z"
        fill="#cbd5e1"
      />
      <path
        d="M38,13 C33,19 30,27 30,35"
        fill="none"
        stroke="#94a3b8"
        strokeWidth="1.4"
        opacity="0.8"
        strokeLinecap="round"
      />
      <path
        d="M58,13 C63,19 66,27 66,35"
        fill="none"
        stroke="#94a3b8"
        strokeWidth="1.4"
        opacity="0.8"
        strokeLinecap="round"
      />
      {/* Barba branca aparada ao queixo */}
      <path
        d="M30,42 C30,63 37,74 48,74 C59,74 66,63 66,42 C66,55 58,61 48,61 C38,61 30,55 30,42 Z"
        fill="#e2e8f0"
      />
      {/* Sobrancelhas grossas grisalhas */}
      {sad ? (
        <>
          <path d="M30,25 L41.5,27.5" stroke="#94a3b8" strokeWidth="3.4" strokeLinecap="round" />
          <path d="M66,25 L54.5,27.5" stroke="#94a3b8" strokeWidth="3.4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M30,27 L42,31" stroke="#94a3b8" strokeWidth="3.4" strokeLinecap="round" />
          <path d="M66,27 L54,31" stroke="#94a3b8" strokeWidth="3.4" strokeLinecap="round" />
        </>
      )}
      {/* Olhos severos */}
      <circle cx="38" cy={sad ? 38.5 : 37.5} r="2.6" fill="#0f172a" />
      <circle cx="58" cy={sad ? 38.5 : 37.5} r="2.6" fill="#0f172a" />
      {/* Nariz */}
      <path d="M48,33.5 L44.5,44 C46,45.5 50,45.5 51.5,44 Z" fill="#d6995f" />
      {/* Bigode grisalho */}
      <path
        d="M35,47.5 C37.5,43.5 58.5,43.5 61,47.5 C57.5,51 53,49.5 48,49.5 C43,49.5 38.5,51 35,47.5 Z"
        fill="#eef2f7"
      />
      {/* Boca caída (por baixo do bigode) */}
      {sad ? (
        <path d="M43,58 Q48,54.5 53,58" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
      ) : (
        <path d="M43,56 Q48,54 53,56" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
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
