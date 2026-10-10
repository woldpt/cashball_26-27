import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../../contexts/GameContext.jsx";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion.js";

// Ciclo contínuo: o tempo acompanha o texto (mesma velocidade para notícias
// curtas e longas), com um mínimo para não passar depressa demais.
const MS_PER_CHAR = 150;
const MIN_CYCLE_MS = 6000;
// Uma cópia do ciclo tem de cobrir o ecrã largo: com poucas notícias repetem-se
// dentro da cópia até chegar a este número de caracteres.
const MIN_COPY_CHARS = 400;
const SEPARATOR_CHARS = 4;
// Movimento reduzido: o texto fica parado, uma notícia de cada vez, com tempo
// de leitura proporcional ao tamanho.
const REDUCED_MS_PER_CHAR = 60;
const REDUCED_MIN_MS = 5000;

/**
 * Uma cópia do ciclo: todas as notícias, repetidas se forem poucas para encher o ecrã.
 * @param {Array<{id: number, text: string}>} items Pelo menos uma notícia.
 * @returns {{list: Array<{id: number, text: string}>, chars: number}}
 */
function buildCopy(items) {
  const list = [];
  let chars = 0;
  while (chars < MIN_COPY_CHARS) {
    for (const it of items) {
      list.push(it);
      chars += (it.text?.length || 0) + SEPARATOR_CHARS;
    }
  }
  return { list, chars };
}

/**
 * Notícias CM — rodapé breaking-news (estilo CNN): etiqueta vermelha fixa +
 * notícias da sala em ciclo contínuo, repetindo todas as que houver. Só se
 * mostra quando há pelo menos uma notícia. Passar o rato pausa o ciclo.
 * Alimentado pelas `systemMessage` com `cm: true`. Só é renderizado no Jornal
 * (ver `GameLayout`); escondido em direto e calado enquanto o adjunto fala.
 * Ocupa a área `ticker` do `.game-shell`: por baixo do conteúdo, por cima da
 * MobileNav. Altura fixa (h-7 / lg:h-9) — o Jornal desconta-a no CSS.
 *
 * @param {Object} props
 * @param {boolean} [props.hidden] Esconde a barra (ex.: jogo em direto).
 * @param {boolean} [props.paused] Esconde a barra (ex.: adjunto a falar).
 * @returns {JSX.Element}
 */
export function CmTicker({ hidden = false, paused = false }) {
  const { cmNews } = useGame();
  const reduced = usePrefersReducedMotion();
  const items = cmNews || [];
  const visible = !hidden && !paused && items.length > 0;

  // Movimento reduzido: qual a notícia parada na vez.
  const [stillIndex, setStillIndex] = useState(0);
  const still = items.length > 0 ? items[stillIndex % items.length] : null;
  useEffect(() => {
    if (!reduced || !visible || items.length < 2) return undefined;
    const t = setTimeout(
      () => setStillIndex((i) => i + 1),
      Math.max(REDUCED_MIN_MS, (still?.text?.length || 0) * REDUCED_MS_PER_CHAR),
    );
    return () => clearTimeout(t);
  }, [reduced, visible, items.length, still]);

  const copy = items.length > 0 && !reduced ? buildCopy(items) : null;
  const duration = copy ? Math.max(MIN_CYCLE_MS, copy.chars * MS_PER_CHAR) : 0;
  // Lista nova = ciclo recomeça (a chave muda e o elemento volta a montar).
  const loopKey = items.map((it) => it.id).join("-");

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
          className="cm-ticker [grid-area:ticker] relative z-(--z-ticker) flex items-stretch bg-black border-t border-error-container/60 overflow-hidden shadow-[0_-4px_12px_rgba(0,0,0,0.5)] h-7 lg:h-9"
        >
          <div className="shrink-0 bg-error-container text-white text-[10px] lg:text-xs font-black px-2 lg:px-3 flex items-center uppercase tracking-widest select-none">
            Notícias CM
          </div>
          <div className="cm-ticker-hit flex-1 min-w-0 relative overflow-hidden">
            {reduced ? (
              <div className="absolute inset-0 flex items-center">
                <p
                  key={still.id}
                  className="line-clamp-2 leading-tight pl-2 pr-2 text-[11px] lg:text-xs text-zinc-100"
                >
                  <span aria-hidden className="mr-2 text-error">◆</span>
                  {still.text}
                </p>
              </div>
            ) : (
              <div
                key={loopKey}
                className="cm-ticker-loop absolute top-0 h-full flex w-max items-center whitespace-nowrap text-[11px] lg:text-xs text-zinc-100"
                style={{ "--cm-dur": `${duration}ms` }}
              >
                {/* Duas cópias iguais: a segunda (escondida aos leitores de ecrã)
                    entra logo a seguir à primeira e o loop fecha sem saltos. */}
                {[0, 1].map((n) => (
                  <div
                    key={n}
                    aria-hidden={n === 1 || undefined}
                    className="flex shrink-0 items-center pl-2"
                  >
                    {copy.list.map((it, i) => (
                      <span key={i} className="mr-6">
                        <span aria-hidden className="mr-2 text-error">◆</span>
                        {it.text}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
