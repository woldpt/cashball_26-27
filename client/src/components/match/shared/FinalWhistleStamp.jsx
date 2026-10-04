import { AnimatePresence, motion } from "framer-motion";

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

/**
 * @param {Object} props
 * @param {{ outcome: "win" | "loss" | "draw", myGoals: number, oppGoals: number } | null} props.whistle
 * @param {string} [props.hColor] Cor da equipa da casa (cenografia de luz).
 * @param {string} [props.aColor] Cor da equipa de fora (cenografia de luz).
 * @returns {JSX.Element|null}
 */
export function FinalWhistleStamp({ whistle, hColor = "#3b82f6", aColor = "#f43f5e" }) {
  if (!whistle) return null;
  const pool = PHRASES[whistle.outcome] || PHRASES.draw;
  const phrase = pool[(whistle.myGoals * 7 + whistle.oppGoals) % pool.length];
  return (
    <AnimatePresence>
      <div key="final-whistle" className="flex flex-col items-center gap-1.5 mt-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: -8 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="animate-heartbeat px-8 py-4 rounded-full border-2 bg-surface-container-high/90 backdrop-blur-sm"
          style={{
            borderColor: `${hColor}aa`,
            boxShadow: `0 0 60px ${hColor}55, 0 0 24px ${aColor}45`,
          }}
        >
          <span className="flex items-center gap-3 text-lg sm:text-2xl font-black uppercase tracking-[0.2em] text-on-surface">
            <span aria-hidden="true" className="text-3xl sm:text-4xl">📯</span>
            <span>Apito final · {whistle.myGoals}–{whistle.oppGoals}</span>
          </span>
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="text-sm font-bold text-on-surface text-center px-4"
        >
          {phrase}
        </motion.p>
      </div>
    </AnimatePresence>
  );
}
