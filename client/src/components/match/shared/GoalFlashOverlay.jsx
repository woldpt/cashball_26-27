import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { CelebrationBurst } from "../../shared/CelebrationBurst.jsx";

/* ── GoalFlashOverlay — momento de golo ao vivo ─────────────────────────
 *
 * Overlay efémero (~2s) DE PÁGINA INTEIRA quando um golo é revelado em
 * direto no teu jogo. Renderizado via portal para o <body> como `fixed
 * inset-0` (o pai LiveMatchHero tem overflow-hidden, que encerraria o
 * festejo ao card):
 *   - marcas TU  → explosão de confete + "GOLO!" com glow na cor da equipa;
 *   - golo ADVERSÁRIO (e és participante) → flash sóbrio vermelho + shake,
 *     sem festejo — o teu marcador não celebra.
 *
 * É alimentado pelo `goalFlashRef` do GameContext (timestamp por fixture+lado,
 * apenas atualizado durante isPlayingMatch), o MESMO sinal que já faz o flash
 * vermelho dos números. Só dispara em direto e para jogos onde és participante.
 *
 * Regras de jogo: transform/opacity apenas (GPU), auto-dismiss, pointer-events
 * none (nunca bloqueia input). Animações via framer → reduced-motion é
 * respeitado globalmente (MotionConfig reducedMotion="user").
 * ─────────────────────────────────────────────────────────────────────────
 *
 * @param {Object} props
 * @param {Object} props.goalFlashRef
 * @param {number|string} props.homeId
 * @param {number|string} props.awayId
 * @param {boolean} props.homeIsMine
 * @param {boolean} props.awayIsMine
 * @param {boolean} props.isPlayingMatch
 */
export function GoalFlashOverlay({
  goalFlashRef,
  homeId,
  awayId,
  homeIsMine,
  awayIsMine,
  isPlayingMatch,
}) {
  const [moment, setMoment] = useState(null); // { mine, side, ts }
  const lastTsRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isPlayingMatch) return; // nunca celebrar fora de direto / replay
    // Timestamps mais recentes (e ainda frescos) para cada lado desta fixture.
    let bestTs = 0;
    let bestSide = null;
    const entries = [
      { side: "home", ts: goalFlashRef?.[`${homeId}_${awayId}_home`] },
      { side: "away", ts: goalFlashRef?.[`${homeId}_${awayId}_away`] },
    ];
    for (const e of entries) {
      const ts = typeof e.ts === "number" ? e.ts : 0;
      if (ts > bestTs) {
        bestTs = ts;
        bestSide = e.side;
      }
    }
    // Ignora flashes antigos/em cache (mais de 2.2s) e os já tratados.
    if (!bestSide || bestTs < Date.now() - 2200 || bestTs <= lastTsRef.current) {
      return;
    }
    const mine =
      (bestSide === "home" && homeIsMine) || (bestSide === "away" && awayIsMine);
    // Só celebramos em jogos onde somos participante.
    if (!homeIsMine && !awayIsMine) return;

    lastTsRef.current = bestTs;
    // Agenda o reveal num callback (regra react-hooks/set-state-in-effect).
    const raf = window.setTimeout(() => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      setMoment({ mine, side: bestSide, ts: bestTs });
      timerRef.current = window.setTimeout(() => setMoment(null), 1950);
    }, 0);
    return () => window.clearTimeout(raf);
  }, [
    goalFlashRef,
    homeId,
    awayId,
    homeIsMine,
    awayIsMine,
    isPlayingMatch,
  ]);

  // Limpa o timer de auto-dismiss ao desmontar.
  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  if (!moment || !isPlayingMatch) return null;

  const mine = moment.mine;
  const color = mine ? "#22c55e" : "#ef4444";

  const overlay = (
    // `key` no flash: cada golo remonta a árvore inteira do zero, mesmo que o
    // overlay anterior ainda esteja montado (golos seguidos na simulação em
    // direto). Sem isto, os containers framer terminam em opacity:0 e não
    // recomeçam — o 2º golo em diante ficaria invisível.
    <div
      key={`${moment.side}-${moment.ts}`}
      className="fixed inset-0 z-[200] pointer-events-none overflow-hidden"
    >
      {/* Wash forte da cor do momento: verde nosso, vermelho adversário. */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 75% 75% at 50% 42%, ${color}${mine ? "99" : "88"} 0%, rgba(0,0,0,0) 70%)`,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 1.9, times: [0, 0.28, 1], ease: "easeOut" }}
      />

      {/* Flash e shake vermelho do golo adversário. */}
      {!mine && (
        <motion.div
          className="absolute inset-0 bg-red-950/70"
          initial={{ opacity: 0, x: 0 }}
          animate={{ opacity: [0, 1, 1, 0], x: [0, -8, 8, -5, 5, 0] }}
          transition={{ duration: 1.9, times: [0, 0.2, 0.8, 1] }}
        />
      )}

      {/* Confete quando marcas tu */}
      {mine && (
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.95, times: [0, 0.15, 0.82, 1] }}
        >
          <CelebrationBurst seed={`${moment.side}-${moment.ts}`} />
        </motion.div>
      )}

      {/* Só o golo nosso mantém a palavra de celebração; o adversário fica em artefactos. */}
      {mine && (
        <div className="absolute inset-0 flex items-center justify-center px-4">
          <motion.span
            className="font-headline font-black uppercase tracking-tight leading-none text-center"
            style={{
              fontSize: "clamp(3rem, 14vw, 6rem)",
              color,
              textShadow: `0 0 30px ${color}`,
            }}
            initial={{ opacity: 0, scale: 0.5, y: 6 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.18, 1.02, 1.1], y: [6, 0, 0, -4] }}
            transition={{ duration: 1.9, times: [0, 0.16, 0.8, 1] }}
          >
            GOLO!
          </motion.span>
        </div>
      )}
    </div>
  );

  // Portal para o <body> como overlay fixed: cobre a página inteira (o pai
  // LiveMatchHero tem overflow-hidden, que encerraria o festejo ao card).
  return createPortal(overlay, document.body);
}
