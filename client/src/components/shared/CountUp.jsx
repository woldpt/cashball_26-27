import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion.js";

/**
 * CountUp — número que sobe a contar até `value` (600 ms, easing cúbico).
 * Com movimento reduzido salta direto ao valor. Só corre em `requestAnimationFrame`
 * (nunca setState síncrono no efeito).
 *
 * @param {{
 *   value: number,
 *   format?: (v: number) => string,
 *   duration?: number,
 * }} props
 */
export function CountUp({ value, format = String, duration = 600 }) {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(value);
  const settledRef = useRef(value);

  useEffect(() => {
    const from = settledRef.current;
    const to = value;
    if (from === to) return undefined;
    settledRef.current = to;
    // ponytail: sem motion lib para isto — 1 rAF chega; easing manual.
    let raf = 0;
    if (reduced) {
      raf = requestAnimationFrame(() => setDisplay(to));
    } else {
      const start = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - start) / duration);
        setDisplay(Math.round(from + (to - from) * (1 - Math.pow(1 - t, 3))));
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduced]);

  return <>{format(display)}</>;
}
