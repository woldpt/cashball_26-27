import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../../contexts/GameContext.jsx";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion.js";
import { useMobileLandscape } from "../../hooks/useIsMobile.js";

// Velocidade de leitura da passagem única (a largura do texto cresce com o
// nº de caracteres, logo ms/carácter ≈ velocidade constante em px/s).
const MS_PER_CHAR = 150;
const MIN_PLAY_MS = 6000;
// Movimento reduzido: o texto fica estático (e quebra linha em vez de ser
// cortado); o tempo de leitura é proporcional ao tamanho.
const REDUCED_MS_PER_CHAR = 60;
const REDUCED_MIN_MS = 5000;

/**
 * Notícias CM — rodapé breaking-news (estilo CNN): etiqueta vermelha fixa +
 * notícias da sala em passagem ÚNICA, uma de cada vez. A notícia ativa é
 * derivada da fila (a primeira por mostrar): notícias novas entram na fila
 * sem remontar a tira em curso. Quando a fila esvazia, a barra sai a
 * deslizar para baixo. O texto aparece já visível e sai a deslizar para a
 * esquerda — sem período de barra vazia. Clicar abre o Jornal; passar o rato
 * ou focar pausa a passagem; o "×" dispensa a fila. Alimentado pelas
 * `systemMessage` com `cm: true`. Escondido em direto (o que ficou por mostrar é descartado); no telemóvel vive por
 * cima da MobileNav (portrait) ou ao lado da rail (landscape).
 *
 * @param {Object} props
 * @param {boolean} [props.hidden] Esconde a barra (ex.: jogo em direto).
 * @param {boolean} [props.paused] Esconde sem descartar a fila (ex.: adjunto a falar).
 * @param {boolean} [props.sidebarCollapsed] Sidebar desktop encolhida (ajusta o offset esquerdo).
 * @returns {JSX.Element}
 */
export function CmTicker({ hidden = false, paused = false, sidebarCollapsed = false }) {
  const { cmNews, navigateTab } = useGame();
  const reduced = usePrefersReducedMotion();
  const isMobileLandscape = useMobileLandscape();
  const items = cmNews || [];
  const [shownIds, setShownIds] = useState(() => new Set());
  const [wasHidden, setWasHidden] = useState(hidden);

  // Ativa da fila (derivado, sem efeitos): chave estável durante a passagem,
  // por isso novidades a meio não reiniciam a animação.
  const pending = items.filter((it) => !shownIds.has(it.id));
  const active = pending[0] ?? null;
  const queued = Math.max(0, pending.length - 1);
  const visible = !hidden && !paused && active !== null;

  // Ao esconder (jogo em direto) descarta o que ficou por mostrar: seria
  // notícia velha no fim da jornada. As que chegam durante o jogo mantêm-se.
  // Ajuste de estado durante o render (sem efeitos), só na transição.
  if (hidden !== wasHidden) {
    setWasHidden(hidden);
    if (hidden && pending.length > 0) {
      setShownIds((prev) => new Set([...prev, ...pending.map((it) => it.id)]));
    }
  }
  const chars = active?.text?.length || 0;
  const duration = reduced
    ? Math.max(REDUCED_MIN_MS, chars * REDUCED_MS_PER_CHAR)
    : Math.max(MIN_PLAY_MS, chars * MS_PER_CHAR);

  // Marca como mostradas e descarta ids que já saíram da fila (cmNews é
  // limitado), para o Set não crescer sem limite.
  const markShown = (ids) => {
    setShownIds((prev) => {
      const live = new Set(items.map((it) => it.id));
      const next = new Set([...prev].filter((id) => live.has(id)));
      ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const sideOffset = isMobileLandscape ? "left-[var(--rail-w)]" : "left-0";
  const lgOffset = sidebarCollapsed
    ? "lg:left-[var(--sidebar-w-collapsed)]"
    : "lg:left-[var(--sidebar-w)]";
  const bottom = isMobileLandscape ? "bottom-0" : "bottom-[var(--mobile-nav-h)]";

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          key="cm-ticker"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={`fixed ${bottom} lg:bottom-0 right-0 z-30 flex items-stretch bg-black border-t border-error-container/60 overflow-hidden shadow-[0_-4px_12px_rgba(0,0,0,0.5)] ${reduced ? "min-h-9" : "h-9"} ${sideOffset} ${lgOffset}`}
        >
          <div className="shrink-0 bg-error-container text-white text-[10px] lg:text-xs font-black px-2 lg:px-3 flex items-center uppercase tracking-widest select-none">
            Notícias CM
          </div>
          <button
            type="button"
            onClick={() => navigateTab("jornal")}
            aria-label="Abrir o Jornal"
            className="cm-ticker-hit flex-1 min-w-0 relative overflow-hidden text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
          >
            <div
              key={active.id}
              onAnimationEnd={() => markShown([active.id])}
              className={`${reduced ? "cm-ticker-still relative py-1.5 pr-2" : "cm-ticker-pass absolute left-0 top-0 h-full flex items-center whitespace-nowrap"} pl-2 text-xs text-zinc-100`}
              style={{ "--cm-dur": `${duration}ms` }}
            >
              <span aria-hidden className="mr-2 text-error">◆</span>
              {active.text}
            </div>
          </button>
          {queued > 0 && (
            <div
              className="shrink-0 flex items-center px-2 text-[10px] font-bold text-zinc-400 select-none"
              title={`Mais ${queued} na fila`}
            >
              +{queued}
            </div>
          )}
          <button
            type="button"
            onClick={() => markShown(pending.map((it) => it.id))}
            aria-label="Dispensar notícias"
            className="shrink-0 px-2 flex items-center text-zinc-400 hover:text-white focus-visible:outline-2 focus-visible:outline-primary"
          >
            <span aria-hidden className="material-symbols-outlined text-[16px] leading-none">close</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
