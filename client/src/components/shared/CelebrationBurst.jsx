import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

const PARTICLES = [
  "🍾",
  "🥂",
  "✨",
  "🎉",
  "💫",
  "🎊",
  "✨",
  "🎉",
  "🥂",
  "💫",
  "🎊",
  "🍾",
  "✨",
  "🎉",
];

/** Vida da festa: partículas extintas a ~2,15s (delay ≤0,25 + 1,9s). */
const DISMOUNT_MS = 2300;

/**
 * Explosão de champanhe e partículas de festejo — reutilizada pelos modais
 * de celebração (contratação, vitória).
 *
 * Distribuição determinística (função do índice + seed) — mesmo seed,
 * mesmo leque. O raio do leque acompanha o ecrã (ver `radius`): 14
 * partículas espalhadas por toda a largura, para a festa ser vista de
 * relance em vez de procurada no centro.
 *
 * @param {{
 *   seed: string|number,
 *   showChampagne?: boolean,
 *   origin?: {x: number, y: number},
 * }} props
 *   `origin` em px do viewport desloca o leque (ex.: o marcador da partida
 *   no `GoalFlashOverlay`); sem ela o leque sai do habitual 50% × 38%.
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

export function CelebrationBurst({ seed, showChampagne = true, origin = null }) {
  // Auto-desmonta após a festa (~2,3s): os modais que o usam ficam abertos
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
    const t = window.setTimeout(() => setDone(true), DISMOUNT_MS);
    return () => window.clearTimeout(t);
  }, [done, seed]);

  // Raio máximo do leque, 1× por montagem (o componente nasce e morre com
  // cada festejo): proporcional ao ecrã, para o telemóvel não atirar confete
  // para fora e o desktop não o encolher num canto.
  const radius = useMemo(
    () =>
      Math.min(
        520,
        Math.max(150, Math.min(window.innerWidth, window.innerHeight) * 0.58),
      ),
    [],
  );

  const particles = useMemo(() => {
    const base = hashSeed(seed);
    return PARTICLES.map((emoji, i) => {
      const jitter = ((i * 137 + base * 100) % 100) / 100;
      return {
        id: i,
        emoji,
        angle: (Math.PI * 2 * i) / PARTICLES.length + jitter * 0.45,
        dist: radius * (0.4 + jitter * 0.6),
        size: 18 + jitter * 26,
        delay: jitter * 0.25,
        rot: jitter * 180 - 90,
      };
    });
  }, [seed, radius]);

  if (done) return null;

  return (
    <>
      {particles.map((p) => (
        <motion.span
          key={`${seed}-${p.id}`}
          aria-hidden="true"
          className="absolute pointer-events-none select-none"
          style={{
            left: origin ? origin.x : "50%",
            top: origin ? origin.y : "38%",
            fontSize: p.size,
          }}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
          animate={{
            x: Math.cos(p.angle) * p.dist,
            y: Math.sin(p.angle) * p.dist - 40,
            opacity: [0, 1, 1, 0],
            scale: [0.4, 1.15, 1, 0.75],
            rotate: p.rot,
          }}
          transition={{
            duration: 1.9,
            delay: p.delay,
            times: [0, 0.16, 0.68, 1],
            ease: "easeOut",
          }}
        >
          {p.emoji}
        </motion.span>
      ))}

      {showChampagne && (
        <>
          <motion.div
            className="absolute left-4 top-6 pointer-events-none select-none text-5xl"
            aria-hidden="true"
            initial={{ rotate: -30, y: 0, opacity: 0, scale: 0.7 }}
            animate={{ rotate: -55, y: [0, -14, 0], opacity: 1, scale: 1 }}
            transition={{ duration: 1.7, delay: 0.15 }}
          >
            🍾
          </motion.div>
          <motion.div
            className="absolute right-4 top-6 pointer-events-none select-none text-5xl"
            aria-hidden="true"
            initial={{ rotate: 30, y: 0, opacity: 0, scale: 0.7 }}
            animate={{ rotate: 55, y: [0, -14, 0], opacity: 1, scale: 1 }}
            transition={{ duration: 1.7, delay: 0.15 }}
          >
            🍾
          </motion.div>
        </>
      )}
    </>
  );
}
