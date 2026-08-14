/**
 * ModalShell — moldura de modais padronizada.
 *
 * Unifica backdrop, z-index, container e animações de todos os modais.
 * Variantes:
 *  - "card": backdrop + card centrado (`bg-surface-container` token);
 *  - "wide": card com largura maior (histórico de jogador, plantel);
 *  - "fullscreen": apenas backdrop — o conteúdo ocupa o ecrã
 *    (sorteio da Taça, fim de época);
 *  - "transparent": sem fundo/desfoque (suspense de penáltis).
 *
 * z-index centralizado em `MODAL_Z` (constants/index.js).
 */
import { motion, AnimatePresence } from "framer-motion";
import { MODAL_Z } from "../../constants/index.js";

const MAX_WIDTH = {
  card: "max-w-sm",
  wide: "max-w-3xl",
  xl: "max-w-5xl",
  md: "max-w-md",
  lg: "max-w-lg",
};

/**
 * @param {{
 *   visible?: boolean,
 *   onClose?: () => void,
 *   z?: number,
 *   variant?: "card"|"wide"|"xl"|"md"|"lg"|"fullscreen"|"transparent",
 *   align?: "center"|"start",
 *   backdropStyle?: object,
 *   backdropClassName?: string,
 *   cardClassName?: string,
 *   dismissable?: boolean,
 *   children: import("react").ReactNode,
 * }} props
 */
export function ModalShell({
  visible = true,
  onClose,
  z = MODAL_Z.default,
  variant = "card",
  align = "center",
  backdropStyle,
  backdropClassName = "",
  cardClassName = "",
  dismissable = false,
  children,
}) {
  const isTransparent = variant === "transparent";
  const isFullscreen = variant === "fullscreen";
  const maxWidth = MAX_WIDTH[variant] || MAX_WIDTH.card;

  const backdropClasses = `fixed inset-0 overflow-y-auto ${
    isTransparent
      ? ""
      : "bg-zinc-950/90 backdrop-blur-sm"
  } ${isFullscreen ? "flex flex-col items-center p-4" : "flex items-center justify-center p-3 sm:p-4"} ${
    align === "start" ? "items-start" : ""
  } ${backdropClassName}`;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="modal-backdrop"
          className={backdropClasses}
          style={{ zIndex: z, ...backdropStyle }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => dismissable && onClose?.()}
        >
          {isFullscreen || isTransparent ? (
            children
          ) : (
            <motion.div
              className={`w-full ${maxWidth} rounded-xl border border-outline-variant/20 bg-surface-container shadow-2xl overflow-hidden my-auto ${cardClassName}`}
              initial={{ scale: 0.93, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.93, y: 24 }}
              transition={{ type: "spring", stiffness: 340, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
            >
              {children}
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
