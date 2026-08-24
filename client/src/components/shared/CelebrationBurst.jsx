import { useMemo } from "react";
import { motion } from "framer-motion";

const PARTICLES = ["🍾", "🥂", "✨", "🎉", "💫", "✨"];

/**
 * Explosão de champanhe e partículas de festejo — reutilizada pelos modais
 * de celebração (contratação, vitória).
 *
 * Distribuição determinística (apenas função do índice) — render puro.
 *
 * @param {{
 *   seed: string|number,
 *   showChampagne?: boolean,
 * }} props
 */
export function CelebrationBurst({ seed, showChampagne = true }) {
  const particles = useMemo(
    () =>
      PARTICLES.map((emoji, i) => {
        const jitter = ((i * 137) % 100) / 100;
        return {
          id: i,
          emoji,
          angle: (Math.PI * 2 * i) / PARTICLES.length + jitter * 0.5,
          dist: 90 + jitter * 120,
          size: 16 + jitter * 22,
          delay: jitter * 0.3,
          rot: jitter * 120 - 60,
        };
      }),
    [],
  );

  return (
    <>
      {particles.map((p) => (
        <motion.span
          key={`${seed}-${p.id}`}
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
            initial={{ rotate: -30, y: 0, opacity: 0 }}
            animate={{ rotate: -55, y: [0, -10, 0], opacity: 1 }}
            transition={{ duration: 1.4, delay: 0.2 }}
          >
            🍾
          </motion.div>
          <motion.div
            className="absolute right-4 top-6 pointer-events-none select-none text-4xl"
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
