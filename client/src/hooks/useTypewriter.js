import { useCallback, useEffect, useState } from "react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion.js";

/**
 * Efeito de máquina de escrever: revela `text` letra a letra (por defeito
 * 1 letra/18ms) e recomeça quando o texto muda. Com
 * `prefers-reduced-motion` devolve o texto integral de imediato.
 * `complete()` revela tudo — para o 1.º clique fechar o texto antes de dispensar.
 * @param {string} text Texto a ditar.
 * @param {number} [speed] Milissegundos por letra.
 * @returns {{shown: string, done: boolean, complete: () => void}}
 */
export function useTypewriter(text, speed = 18) {
  const reducedMotion = usePrefersReducedMotion();
  const full = text ?? "";
  const chars = Array.from(full);
  const total = chars.length;
  // Recomeço quando o texto muda (ajuste durante a renderização, sem efeito).
  const [prevFull, setPrevFull] = useState(full);
  const [count, setCount] = useState(0);
  if (prevFull !== full) {
    setPrevFull(full);
    setCount(0);
  }
  const done = reducedMotion || count >= total;

  useEffect(() => {
    if (reducedMotion || count >= total) return undefined;
    const id = setTimeout(() => setCount((c) => c + 1), speed);
    return () => clearTimeout(id);
  }, [reducedMotion, count, total, speed]);

  const complete = useCallback(() => setCount(total), [total]);

  return { shown: reducedMotion ? full : chars.slice(0, count).join(""), done, complete };
}
