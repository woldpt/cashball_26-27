import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

/** Emojis do leque com o respetivo peso (nº de partículas). */
const PARTICLE_WEIGHTS = [
  ["⚽", 5],
  ["🥅", 3],
  ["🏆", 3],
  ["✨", 2],
  ["🎉", 1],
  ["🎊", 1],
];

const PARTICLES = PARTICLE_WEIGHTS.flatMap(([emoji, n]) =>
  Array.from({ length: n }, () => emoji),
);

/** Duração de cada partícula (s) e atraso máximo (s). */
const PARTICLE_DURATION_S = 1.9;
const PARTICLE_MAX_DELAY_S = 0.25;

/** Vida da festa: partículas extintas a ~2,15s + folga. */
const DISMOUNT_MS = (PARTICLE_DURATION_S + PARTICLE_MAX_DELAY_S) * 1000 + 150;

/** Bolas laterais: lado, posição e rotação final. */
const SIDE_BALLS = [
  { side: "left-4", from: -30, to: -55 },
  { side: "right-4", from: 30, to: 55 },
];

/**
 * Hash string|number → semente de 32 bits (FNV-1a). Barato e determinístico:
 * varia o leque por golo/contratação sem Math.random no render.
 *
 * @param {string|number|null|undefined} seed
 * @returns {number}
 */
function hashSeed(seed) {
  const s = String(seed ?? "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * PRNG determinístico (mulberry32) → função que devolve valores em [0, 1).
 *
 * @param {number} a - semente de 32 bits
 * @returns {() => number}
 */
function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Raio máximo do leque, proporcional ao ecrã: o telemóvel não atira confete
 * para fora e o desktop não o encolhe num canto.
 *
 * @returns {number}
 */
function computeRadius() {
  if (typeof window === "undefined") return 300;
  return Math.min(
    520,
    Math.max(150, Math.min(window.innerWidth, window.innerHeight) * 0.58),
  );
}

/**
 * Explosão de futebol e partículas de festejo — reutilizada pelos modais
 * de celebração (contratação, vitória).
 *
 * Distribuição determinística (função do seed): mesmo seed, mesmo leque.
 * O raio acompanha o ecrã (ver `computeRadius`) para a festa ser vista de
 * relance em vez de procurada no centro. Não renderiza nada com
 * `prefers-reduced-motion`.
 *
 * @param {Object} props
 * @param {string|number} props.seed - Semente do leque; mudar o seed reinicia a festa.
 * @param {boolean} [props.showBalls=true] - Mostra as duas bolas laterais grandes.
 * @param {{x: number, y: number}|null} [props.origin=null] - Origem em px do
 *   viewport (ex.: o marcador no `GoalFlashOverlay`); sem ela o leque sai de 50% × 38%.
 * @returns {JSX.Element|null}
 */
export function CelebrationBurst({ seed, showBalls = true, origin = null }) {
  const reduceMotion = useReducedMotion();

  // Auto-desmonta após a festa: os modais que o usam ficam abertos e
  // acumulariam nós invisíveis (opacity 0) no DOM. O reset vive no render
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

  // 1× por montagem (o componente nasce e morre com cada festejo).
  const radius = useMemo(() => computeRadius(), []);

  const particles = useMemo(() => {
    const rand = mulberry32(hashSeed(seed));
    const offset = rand() * 0.45;
    return PARTICLES.map((emoji, i) => ({
      id: i,
      emoji,
      angle: (Math.PI * 2 * i) / PARTICLES.length + offset + rand() * 0.3,
      dist: radius * (0.4 + rand() * 0.6),
      size: 18 + rand() * 26,
      delay: rand() * PARTICLE_MAX_DELAY_S,
      rot: rand() * 180 - 90,
    }));
  }, [seed, radius]);

  if (done || reduceMotion) return null;

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
            duration: PARTICLE_DURATION_S,
            delay: p.delay,
            times: [0, 0.16, 0.68, 1],
            ease: "easeOut",
          }}
        >
          {p.emoji}
        </motion.span>
      ))}

      {showBalls &&
        SIDE_BALLS.map((b) => (
          <motion.div
            key={b.side}
            className={`absolute ${b.side} top-6 pointer-events-none select-none text-5xl`}
            aria-hidden="true"
            initial={{ rotate: b.from, y: 0, opacity: 0, scale: 0.7 }}
            animate={{ rotate: b.to, y: [0, -14, 0], opacity: 1, scale: 1 }}
            transition={{ duration: 1.7, delay: 0.15 }}
          >
            ⚽
          </motion.div>
        ))}
    </>
  );
}
