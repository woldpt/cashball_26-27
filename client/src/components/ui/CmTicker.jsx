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
 * notícias da sala em passagem ÚNICA. Cada fornada toca uma vez e a barra
 * sai a deslizar para baixo; notícia nova fá-la regressar. Alimentado pelas
 * `systemMessage` com `cm: true`. Escondido em direto; no telemóvel vive por
 * cima da MobileNav, com etiqueta compacta.
 *
 * @param {{ hidden?: boolean, sidebarCollapsed?: boolean }} props
 */
export function CmTicker({ hidden = false, sidebarCollapsed = false }) {
  const { cmNews } = useGame();
  const reduced = usePrefersReducedMotion();
  const items = cmNews || [];
  const [shownIds, setShownIds] = useState(() => new Set());

  // Pendentes desta fornada (derivado do estado, sem efeitos).
  const pending = items.filter((it) => !shownIds.has(it.id));
  const visible = !hidden && pending.length > 0;
  const runKey = pending.map((it) => it.id).join("|");

  // Duração proporcional ao texto para velocidade de leitura constante.
  const chars = pending.reduce((n, it) => n + (it.text?.length || 0), 0);
  const duration = Math.max(MIN_PLAY_MS, chars * MS_PER_CHAR);

  const finishRun = (played) => {
    setShownIds((prev) => {
      const next = new Set(prev);
      for (const it of played) next.add(it.id);
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
          className={`fixed bottom-16 lg:bottom-0 right-0 z-30 h-8 flex items-stretch bg-black border-t border-red-900/60 overflow-hidden left-0 ${sidebarCollapsed ? "lg:left-14" : "lg:left-64"}`}
        >
          <div className="shrink-0 bg-red-600 text-white text-[10px] lg:text-xs font-black px-2 lg:px-3 flex items-center uppercase tracking-widest select-none">
            Notícias CM
          </div>
          <div className="overflow-hidden flex-1 relative">
            <style>{`
              @keyframes cmTickerPass {
                0%   { transform: translateX(0); }
                100% { transform: translateX(-100%); }
              }
              @keyframes cmTickerStill {
                0%   { opacity: 1; }
                100% { opacity: 1; }
              }
            `}</style>
            <div
              key={runKey}
              onAnimationEnd={() => finishRun(pending)}
              className="absolute whitespace-nowrap flex items-center h-full text-[10px] text-zinc-200 pl-[100%]"
              style={{
                gap: "5rem",
                animation: reduced
                  ? `cmTickerStill ${REDUCED_STILL_MS}ms linear 1`
                  : `cmTickerPass ${duration}ms linear 1`,
              }}
            >
              {pending.map((item) => (
                <span key={item.id} className="shrink-0">
                  <span className="mr-2 text-red-500">◆</span>
                  {item.text}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
