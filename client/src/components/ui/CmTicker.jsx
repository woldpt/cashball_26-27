import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../../contexts/GameContext.jsx";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion.js";

// Velocidade de leitura da passagem única.
const MS_PER_CHAR = 90;
const MIN_PLAY_MS = 8000;
// Pausa estática para quem prefere movimento reduzido (temporizador em CSS,
// sem setState em efeitos — dispara o mesmo onAnimationEnd).
const REDUCED_STILL_MS = 5000;

/**
 * Notícias CM — rodapé breaking-news (estilo CNN): etiqueta vermelha fixa +
 * notícias da sala em passagem ÚNICA, uma de cada vez. A notícia ativa é
 * derivada da fila (a primeira por mostrar): notícias novas entram na fila
 * sem remontar a tira em curso. Quando a fila esvazia, a barra sai a
 * deslizar para baixo. O texto aparece já visível e sai a deslizar para a
 * esquerda — sem período de barra vazia. Alimentado pelas `systemMessage`
 * com `cm: true`. Escondido em direto; no telemóvel vive por cima da
 * MobileNav, com etiqueta compacta.
 *
 * @param {{ hidden?: boolean, sidebarCollapsed?: boolean }} props
 */
export function CmTicker({ hidden = false, sidebarCollapsed = false }) {
  const { cmNews } = useGame();
  const reduced = usePrefersReducedMotion();
  const items = cmNews || [];
  const [shownIds, setShownIds] = useState(() => new Set());

  // Ativa da fila (derivado, sem efeitos): chave estável durante a passagem,
  // por isso novidades a meio não reiniciam a animação.
  const active = items.find((it) => !shownIds.has(it.id)) ?? null;
  const visible = !hidden && active !== null;
  const duration = Math.max(MIN_PLAY_MS, (active?.text?.length || 0) * MS_PER_CHAR);

  const finishRun = (id) => {
    setShownIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          key="cm-ticker"
          role="status"
          aria-live="polite"
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={`fixed bottom-16 lg:bottom-0 right-0 z-30 h-8 flex items-stretch bg-black border-t border-red-900/60 overflow-hidden shadow-[0_-4px_12px_rgba(0,0,0,0.5)] left-0 ${sidebarCollapsed ? "lg:left-[var(--sidebar-w-collapsed)]" : "lg:left-[var(--sidebar-w)]"}`}
        >
          <div className="shrink-0 bg-red-600 text-white text-[10px] lg:text-xs font-black px-2 lg:px-3 flex items-center uppercase tracking-widest select-none">
            Notícias CM
          </div>
          <div className="overflow-hidden flex-1 relative">
            <div
              key={active.id}
              onAnimationEnd={() => finishRun(active.id)}
              className="absolute left-0 top-0 h-full whitespace-nowrap pl-2 text-[10px] text-zinc-200"
              style={{
                animation: reduced
                  ? `cmTickerStill ${REDUCED_STILL_MS}ms linear 1`
                  : `cmTickerPass ${duration}ms linear 1`,
              }}
            >
              <span className="mr-2 text-red-500">◆</span>
              {active.text}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
