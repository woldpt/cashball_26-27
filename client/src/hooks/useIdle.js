import { useEffect, useState } from "react";

const ACTIVITY_EVENTS = [
  "pointerdown",
  "pointermove",
  "keydown",
  "touchstart",
  "wheel",
];

/**
 * Inatividade do jogador: devolve `true` quando passa `ms` sem qualquer
 * input (rato, toque, teclado, scroll). Qualquer atividade rearma a contagem.
 * @param {number} [ms] Milissegundos parado até considerar inativo.
 * @returns {boolean} true quando o jogador está parado há pelo menos `ms`.
 */
export function useIdle(ms = 90_000) {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    let timer = 0;
    const arm = () => {
      setIdle(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), ms);
    };
    arm();
    for (const e of ACTIVITY_EVENTS) window.addEventListener(e, arm, { passive: true });
    return () => {
      window.clearTimeout(timer);
      for (const e of ACTIVITY_EVENTS) window.removeEventListener(e, arm);
    };
  }, [ms]);

  return idle;
}
