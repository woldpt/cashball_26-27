import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../../contexts/GameContext.jsx";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion.js";

// Passagem única da direita para a esquerda: percorre a largura da barra +
// a do texto. ponytail: a largura da barra é estimada (CROSS_MS), não medida —
// em ecrãs muito largos anda um pouco mais depressa; medir com ref se incomodar.
const MS_PER_CHAR = 150;
const CROSS_MS = 6000;
// Movimento reduzido: o texto fica estático (e quebra linha em vez de ser
// cortado); o tempo de leitura é proporcional ao tamanho.
const REDUCED_MS_PER_CHAR = 60;
const REDUCED_MIN_MS = 5000;

/**
 * Notícias CM — rodapé breaking-news (estilo CNN): etiqueta vermelha fixa +
 * notícias da sala em passagem ÚNICA, todas as pendentes seguidas. A notícia ativa é
 * derivada da fila (a primeira por mostrar): notícias novas entram na fila
 * sem remontar a tira em curso. Quando a fila esvazia, a barra sai a
 * deslizar para baixo. O texto entra pela direita e sai pela
 * esquerda. Clicar abre o Jornal; passar o rato
 * ou focar pausa a passagem. Alimentado pelas
 * `systemMessage` com `cm: true`. Escondido em direto (o que ficou por mostrar
 * é descartado). Ocupa a área `ticker` do `.game-shell`: por baixo do
 * conteúdo, por cima da MobileNav, à direita da sidebar.
 *
 * @param {Object} props
 * @param {boolean} [props.hidden] Esconde a barra (ex.: jogo em direto).
 * @param {boolean} [props.paused] Esconde sem descartar a fila (ex.: adjunto a falar).
 * @returns {JSX.Element}
 */
export function CmTicker({ hidden = false, paused = false }) {
  const { cmNews, navigateTab } = useGame();
  const reduced = usePrefersReducedMotion();
  const items = cmNews || [];
  const [shownIds, setShownIds] = useState(() => new Set());
  const [wasHidden, setWasHidden] = useState(hidden);
  // Lote em passagem: congelado ao arrancar, para a tira não mudar de largura
  // a meio. Novidades entram no lote seguinte.
  const [batchIds, setBatchIds] = useState(null);

  // Todas as pendentes passam seguidas numa só tira. Em movimento reduzido o
  // texto é estático: uma de cada vez, senão a fila vira um bloco gigante.
  const pending = items.filter((it) => !shownIds.has(it.id));
  if (batchIds === null && pending.length > 0 && !hidden && !paused) {
    setBatchIds((reduced ? pending.slice(0, 1) : pending).map((it) => it.id));
  }
  const batch = batchIds ? items.filter((it) => batchIds.includes(it.id)) : [];
  const visible = !hidden && !paused && (batch.length > 0 || pending.length > 0);

  // Ao esconder (jogo em direto) descarta o que ficou por mostrar: seria
  // notícia velha no fim da jornada. As que chegam durante o jogo mantêm-se.
  // Ajuste de estado durante o render (sem efeitos), só na transição.
  if (hidden !== wasHidden) {
    setWasHidden(hidden);
    if (hidden && pending.length > 0) {
      setShownIds((prev) => new Set([...prev, ...pending.map((it) => it.id)]));
      setBatchIds(null);
    }
  }
  const chars = batch.reduce((n, it) => n + (it.text?.length || 0) + 4, 0);
  const duration = reduced
    ? Math.max(REDUCED_MIN_MS, chars * REDUCED_MS_PER_CHAR)
    : CROSS_MS + chars * MS_PER_CHAR;

  // Marca como mostradas e descarta ids que já saíram da fila (cmNews é
  // limitado), para o Set não crescer sem limite.
  const markShown = (ids) => {
    setShownIds((prev) => {
      const live = new Set(items.map((it) => it.id));
      const next = new Set([...prev].filter((id) => live.has(id)));
      ids.forEach((id) => next.add(id));
      return next;
    });
    setBatchIds(null);
  };

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
          className={`[grid-area:ticker] relative z-(--z-ticker) flex items-stretch bg-black border-t border-error-container/60 overflow-hidden shadow-[0_-4px_12px_rgba(0,0,0,0.5)] ${reduced ? "min-h-7 lg:min-h-9" : "h-7 lg:h-9"}`}
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
              key={batchIds?.join("-") || "empty"}
              onAnimationEnd={() => markShown(batchIds || [])}
              className={`${reduced ? "cm-ticker-still relative py-1.5 pr-2 line-clamp-2" : "cm-ticker-pass absolute top-0 h-full flex items-center whitespace-nowrap"} pl-2 text-[11px] lg:text-xs text-zinc-100`}
              style={{ "--cm-dur": `${duration}ms` }}
            >
              {batch.map((it) => (
                <span key={it.id} className="mr-6">
                  <span aria-hidden className="mr-2 text-error">◆</span>
                  {it.text}
                </span>
              ))}
            </div>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
