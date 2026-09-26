import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

const PARTICLES = ["🍾", "🥂", "✨", "🎉", "💫", "🎊"];

/**
 * Explosão de champanhe e partículas de festejo — reutilizada pelos modais
 * de celebração (contratação, vitória).
 *
 * Distribuição determinística (função do índice + seed) — mesmo seed,
 * mesmo leque.
 *
 * @param {{
 *   seed: string|number,
 *   showChampagne?: boolean,
 * }} props
 */

/**
 * Hash curto string|number → [0, 1). Barato e determinístico: varia o
 * leque por golo/contratação sem Math.random no render.
 */
function hashSeed(seed) {
  const s = String(seed ?? "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h % 100) / 100;
}

export function CelebrationBurst({ seed, showChampagne = true }) {
  // Auto-desmonta após a festa (~2,2s): os modais que o usam ficam abertos
  // e acumulariam nós invisíveis (opacity 0) no DOM. O reset vive no render
  // (padrão documentado do React), não no efeito — lint proíbe setState
  // síncrono em efeitos.
  const [prevSeed, setPrevSeed] = useState(seed);
  const [done, setDone] = useState(false);
  if (!Object.is(prevSeed, seed)) {
    setPrevSeed(seed);
    setDone(false);
  }
  useEffect(() => {
    if (done) return;
    const t = window.setTimeout(() => setDone(true), 2200);
    return () => window.clearTimeout(t);
  }, [done, seed]);

  const particles = useMemo(() => {
    const base = hashSeed(seed);
    return PARTICLES.map((emoji, i) => {
      const jitter = ((i * 137 + base * 100) % 100) / 100;
      return {
        id: i,
        emoji,
        angle: (Math.PI * 2 * i) / PARTICLES.length + jitter * 0.5,
        dist: 90 + jitter * 120,
        size: 16 + jitter * 22,
        delay: jitter * 0.3,
        rot: jitter * 120 - 60,
      };
    });
  }, [seed]);

  if (done) return null;

  return (
    <>
      {particles.map((p) => (
        <motion.span
          key={`${seed}-${p.id}`}
          aria-hidden="true"
          className="absolute pointer-events-none select-none"
          style={{ left: "50%", top: "38%", fontSize: p.size }}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
          animate={{
            x: Math.cos(p.angle) * p.dist,
            y: Math.sin(p.angle) * p.dist - 40,
            opacity: [0, 1, 0],
            scale: [0.4, 1.1, 0.7],
            rotate: p.rot,
          }}
          transition={{
            duration: 1.6,
            delay: p.delay,
            ease: "easeOut",
          }}
        >
          {p.emoji}
        </motion.span>
      ))}

      {showChampagne && (
        <>
          <motion.div
            className="absolute left-4 top-6 pointer-events-none select-none text-4xl"
            aria-hidden="true"
            initial={{ rotate: -30, y: 0, opacity: 0 }}
            animate={{ rotate: -55, y: [0, -10, 0], opacity: 1 }}
            transition={{ duration: 1.4, delay: 0.2 }}
          >
            🍾
          </motion.div>
          <motion.div
            className="absolute right-4 top-6 pointer-events-none select-none text-4xl"
            aria-hidden="true"
            initial={{ rotate: 30, y: 0, opacity: 0 }}
            animate={{ rotate: 55, y: [0, -10, 0], opacity: 1 }}
            transition={{ duration: 1.4, delay: 0.2 }}
          >
            🍾
          </motion.div>
        </>
      )}
    </>
  );
}
