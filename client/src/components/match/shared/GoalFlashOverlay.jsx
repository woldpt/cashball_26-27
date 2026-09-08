import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { CelebrationBurst } from "../../shared/CelebrationBurst.jsx";

/* ── GoalFlashOverlay — momento de golo ao vivo ─────────────────────────
 *
 * Overlay efémero (~2s) sobre o painel do teu jogo quando um golo é
 * revelado em direto:
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
 * @param {string} [props.hColor]  Cor primária da casa.
 * @param {string} [props.aColor]  Cor primária da fora.
 * @param {string} [props.hName]   Nome da equipa da casa.
 * @param {string} [props.aName]   Nome da equipa de fora.
 * @param {number} [props.homeGoals] Marcador atual (casa), até liveMinute.
 * @param {number} [props.awayGoals] Marcador atual (fora), até liveMinute.
 */
export function GoalFlashOverlay({
  goalFlashRef,
  homeId,
  awayId,
  homeIsMine,
  awayIsMine,
  isPlayingMatch,
  hColor = "#6366f1",
  aColor = "#f43f5e",
  hName = "Casa",
  aName = "Fora",
  homeGoals = 0,
  awayGoals = 0,
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
  const color = moment.side === "home" ? hColor : aColor;
  const teamName = moment.side === "home" ? hName : aName;

  return (
    <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
      {/* wash de cor radial (equipa que marcou) */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 75% 75% at 50% 42%, ${color}${mine ? "59" : "22"} 0%, rgba(0,0,0,0) 70%)`,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 1.9, times: [0, 0.28, 1], ease: "easeOut" }}
      />

      {/* Vinheta escura extra no golo adversário (sóbrio) */}
      {!mine && (
        <motion.div
          className="absolute inset-0 bg-red-950/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.9, 0] }}
          transition={{ duration: 1.9, times: [0, 0.2, 1] }}
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

      {/* Núcleo do texto */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-4">
        <motion.span
          className="font-headline font-black uppercase tracking-tight leading-none text-center"
          style={{
            fontSize: mine ? "clamp(3rem, 14vw, 6rem)" : "clamp(1.4rem, 6vw, 2.4rem)",
            color: mine ? color : "#ff6b6b",
            textShadow: mine
              ? `0 0 30px ${color}`
              : "0 0 18px rgba(255, 80, 80, 0.55)",
          }}
          initial={{ opacity: 0, scale: 0.5, y: mine ? 6 : 0 }}
          animate={
            mine
              ? { opacity: [0, 1, 1, 0], scale: [0.5, 1.18, 1.02, 1.1], y: [6, 0, 0, -4] }
              : {
                  opacity: [0, 1, 1, 0],
                  x: [0, -6, 6, -4, 4, 0], // shake subtil
                }
          }
          transition={{ duration: 1.9, times: [0, 0.16, 0.8, 1] }}
        >
          {mine ? "GOLO!" : "GOLO DO ADVERSÁRIO"}
        </motion.span>

        {mine ? (
          <motion.div
            className="flex flex-col items-center"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: [0, 1, 1, 0], y: [8, 0, 0, -6] }}
            transition={{ duration: 1.9, times: [0, 0.2, 0.8, 1] }}
          >
            <span
              className="text-[10px] sm:text-xs font-black uppercase tracking-[0.25em]"
              style={{ color }}
            >
              {teamName}
            </span>
            <span className="text-2xl sm:text-4xl font-black font-headline tabular-nums mt-1 text-on-surface">
              {homeGoals}
              <span className="text-on-surface/25 text-lg sm:text-2xl mx-1.5">–</span>
              {awayGoals}
            </span>
          </motion.div>
        ) : (
          <motion.span
            className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.25em] text-red-300/80 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.9, times: [0, 0.2, 0.8, 1] }}
          >
            ⚠ o adversário marcou
          </motion.span>
        )}
      </div>
    </div>
  );
}
