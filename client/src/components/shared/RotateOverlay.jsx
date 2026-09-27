import { AnimatePresence, motion } from "framer-motion";
import { fade } from "../../motion.js";
import { useMobileLandscape } from "../../hooks/useIsMobile.js";

/**
 * RotateOverlay — bloqueia a interação em telemóvel landscape.
 *
 * O CashBall joga-se em retrato: quando o viewport está em orientação
 * horizontal abaixo de `lg` (`useMobileLandscape`), este overlay fixo tapa
 * a app e pede a rotação. Desktop e retrato nunca o veem (o hook devolve
 * `false`); o código landscape existente fica como fallback por baixo.
 *
 * @returns {JSX.Element} Overlay de rotação (ou nada, em retrato/desktop).
 */
export function RotateOverlay() {
  const isMobileLandscape = useMobileLandscape();

  return (
    <AnimatePresence initial={false}>
      {isMobileLandscape && (
        <motion.div
          key="rotate-overlay"
          role="alert"
          aria-live="assertive"
          initial={fade.initial}
          animate={fade.animate}
          exit={fade.exit}
          transition={fade.transition}
          className="fixed inset-0 z-[99990] flex flex-col items-center justify-center gap-4 bg-surface px-8 text-center"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-14 w-14 text-primary"
          >
            <rect x="9" y="4" width="6" height="16" rx="1.5" />
            <path d="M7 3.5A9 9 0 0 0 3.2 9" />
            <path d="M1.6 6.8L3.2 9l2.6-.9" />
            <path d="M17 20.5A9 9 0 0 0 20.8 15" />
            <path d="M22.4 17.2l-1.6-2.2-2.6.9" />
          </svg>
          <p className="text-lg font-black uppercase tracking-widest text-on-surface">
            Roda o telemóvel
          </p>
          <p className="max-w-xs text-sm font-semibold leading-relaxed text-on-surface-variant">
            O CashBall joga-se em retrato. Roda o telemóvel para continuares.
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
