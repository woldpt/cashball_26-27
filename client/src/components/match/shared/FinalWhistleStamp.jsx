import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";

/* ── FinalWhistleStamp — carimbo do apito final ──────────────────────────
 *
 * Selo transitório sobre o hero do MEU jogo quando o árbitro apita (só
 * aparece enquanto `whistle` está definido — o GameContext limpa-o ao fim
 * de 5 s). O apito é igual para todos os resultados; a frase é que muda
 * com o desfecho, na perspetiva da minha equipa.
 */

/* Narração de fim de jogo por desfecho (escolha determinística pelo
 * marcador — um re-render a meio do selo não troca a frase). */
const PHRASES = {
  win: [
    "Termina o jogo! Festa grande — noite de glória para os nossos.",
    "Apito final! Três pontos que sabem a glória.",
    "Acabou! O árbitro apita e a bancada rende-se à equipa.",
  ],
  draw: [
    "Apito final! Ninguém cedeu — fica o empate.",
    "Termina o jogo! Dividem-se os pontos e as emoções.",
    "Acabou! Um ponto cada lado, ninguém sai contente.",
  ],
  loss: [
    "Termina o jogo. Cabeça levantada — a resposta vem já a seguir.",
    "Apito final! Noite para esquecer, a equipa fica a dever uma.",
    "Acabou. O árbitro apita e o silêncio diz tudo.",
  ],
};

/** Cor do clarão/brilho por desfecho (vitória verde, derrota vermelha, empate âmbar). */
const TONE = { win: "#22c55e", loss: "#ef4444", draw: "#f59e0b" };

/**
 * Sobreposição a ecrã inteiro (portal, para escapar a ancestrais com
 * `transform`): clarão branco, vinheta escura, e o selo entra "à pancada".
 * `pointer-events-none` — nunca bloqueia cliques.
 *
 * @param {Object} props
 * @param {{ outcome: "win" | "loss" | "draw", myGoals: number, oppGoals: number } | null} props.whistle
 * @param {string} [props.hColor] Cor da equipa da casa (cenografia de luz).
 * @param {string} [props.aColor] Cor da equipa de fora (cenografia de luz).
 * @returns {JSX.Element|null}
 */
export function FinalWhistleStamp({ whistle, hColor = "#3b82f6", aColor = "#f43f5e" }) {
  const reduce = useReducedMotion();
  if (!whistle) return null;
  const pool = PHRASES[whistle.outcome] || PHRASES.draw;
  const phrase = pool[(whistle.myGoals * 7 + whistle.oppGoals) % pool.length];
  const tone = TONE[whistle.outcome] || TONE.draw;
  return createPortal(
    <div
      role="status"
      className="fixed inset-0 z-[60] pointer-events-none flex flex-col items-center justify-center gap-4 px-4"
    >
      <motion.div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: `radial-gradient(circle at center, ${tone}33 0%, rgb(0 0 0 / 0.78) 70%)` }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35 }}
      />
      {!reduce && (
        <motion.div
          aria-hidden="true"
          className="absolute inset-0 bg-white"
          initial={{ opacity: 0.85 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      )}
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 2.4, rotate: -6 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={reduce ? { duration: 0.2 } : { type: "spring", stiffness: 380, damping: 16, mass: 0.9 }}
        className="relative flex flex-col items-center gap-2 px-8 py-6 rounded-3xl border-4 bg-surface-container-high/95"
        style={{
          borderColor: tone,
          boxShadow: `0 0 90px ${tone}88, 0 0 40px ${hColor}55, 0 0 24px ${aColor}45`,
        }}
      >
        <span aria-hidden="true" className="text-6xl sm:text-7xl">📯</span>
        <span className="text-xs sm:text-sm font-black uppercase tracking-[0.4em] text-on-surface-variant">
          Apito final
        </span>
        <span className="text-6xl sm:text-8xl font-headline font-black tabular-nums leading-none text-on-surface">
          {whistle.myGoals}–{whistle.oppGoals}
        </span>
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        className="relative max-w-md text-center text-base sm:text-lg font-bold text-white"
      >
        {phrase}
      </motion.p>
    </div>,
    document.body,
  );
}
