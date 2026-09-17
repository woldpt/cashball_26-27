import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { CelebrationBurst } from "../../shared/CelebrationBurst.jsx";
import { freshGoalFlashes } from "../../live/liveHelpers.js";

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
 * É alimentado pelo `goalFlashRef` do GameContext ({ ts, n } por fixture+lado,
 * apenas atualizado durante isPlayingMatch), o MESMO sinal que já faz o flash
 * vermelho dos números. Só dispara em direto e para jogos onde és participante.
 *
 * Regras de jogo: transform/opacity apenas (GPU), auto-dismiss, pointer-events
 * none (nunca bloqueia input). Animações via framer → reduced-motion é
 * respeitado globalmente (MotionConfig reducedMotion="user").
 *
 * Variante `card` (cards de jogos com treinador humano no `LiveFixtureRow`):
 * a mesma fila, mas renderizada inline (`absolute inset-0`, sem portal) e em
 * ponto pequeno — wash + carimbo "GOLO!" quando marca o lado do humano,
 * variante sóbria vermelha quando marca o NPC. Sem confete: o
 * `CelebrationBurst` voa 90–210px, grande demais para um card de ~60px.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * @param {Object} props
 * @param {Object} props.goalFlashRef
 * @param {number|string} props.homeId
 * @param {number|string} props.awayId
 * @param {boolean} props.homeIsMine
 * @param {boolean} props.awayIsMine
 * @param {boolean} props.isPlayingMatch
 * @param {"page"|"card"} [props.variant="page"]
 */
export function GoalFlashOverlay({
  goalFlashRef,
  homeId,
  awayId,
  homeIsMine,
  awayIsMine,
  isPlayingMatch,
  variant = "page",
}) {
  // Fila de momentos (um por golo) + o que está no ecrã é sempre a cabeça.
  // Sem fila, dois golos no mesmo minuto colapsavam num só festejo: o
  // efeito só via o timestamp máximo (`bestTs`) e consumia-o de vez.
  const [moments, setMoments] = useState([]); // [{ mine, side, ts, seq }]
  const consumedRef = useRef({ home: { ts: 0, n: 0 }, away: { ts: 0, n: 0 } });
  const seqRef = useRef(0);

  useEffect(() => {
    if (!isPlayingMatch) return; // nunca celebrar fora de direto / replay
    // Só celebramos em jogos onde somos participante.
    if (!homeIsMine && !awayIsMine) return;
    const fresh = freshGoalFlashes(goalFlashRef, homeId, awayId, consumedRef.current);
    if (!fresh.length) return;
    setMoments((q) => [
      ...q,
      ...fresh.map(({ side, ts }) => ({
        mine: (side === "home" && homeIsMine) || (side === "away" && awayIsMine),
        side,
        ts,
        seq: ++seqRef.current,
      })),
    ]);
  }, [
    goalFlashRef,
    homeId,
    awayId,
    homeIsMine,
    awayIsMine,
    isPlayingMatch,
  ]);

  // Auto-dismiss da cabeça da fila (~2s por golo).
  useEffect(() => {
    if (!moments.length) return;
    const t = window.setTimeout(() => setMoments((q) => q.slice(1)), 1950);
    return () => window.clearTimeout(t);
  }, [moments]);

  const moment = moments[0] || null;
  if (!moment || !isPlayingMatch) return null;

  const mine = moment.mine;
  const color = mine ? "#22c55e" : "#ef4444";

  // Variante card: festejo contido no card (sem portal, sem confete).
  if (variant === "card") {
    return (
      <div
        key={`${moment.side}-${moment.ts}-${moment.seq}`}
        data-testid="card-goal-flash"
        data-mine={mine ? "true" : "false"}
        className="absolute inset-0 z-10 pointer-events-none overflow-hidden flex items-center justify-center"
      >
        <motion.div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 90% 130% at 50% 50%, ${color}${mine ? "55" : "44"} 0%, rgba(0,0,0,0) 70%)`,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 1.9, times: [0, 0.28, 1], ease: "easeOut" }}
        />
        {!mine && (
          <motion.div
            className="absolute inset-0 bg-red-950/60"
            initial={{ opacity: 0, x: 0 }}
            animate={{ opacity: [0, 1, 1, 0], x: [0, -4, 4, -3, 3, 0] }}
            transition={{ duration: 1.9, times: [0, 0.2, 0.8, 1] }}
          />
        )}
        {mine && (
          <motion.span
            className="relative font-headline font-black uppercase tracking-tight leading-none"
            style={{
              fontSize: "clamp(1rem, 4vw, 1.4rem)",
              color,
              textShadow: `0 0 14px ${color}`,
            }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.15, 1, 1.08] }}
            transition={{ duration: 1.9, times: [0, 0.16, 0.8, 1] }}
          >
            GOLO!
          </motion.span>
        )}
      </div>
    );
  }

  const overlay = (
    // `key` no flash: cada golo remonta a árvore inteira do zero. Sem isto,
    // os containers framer terminam em opacity:0 e não recomeçam — o golo
    // seguinte ficaria invisível.
    <div
      key={`${moment.side}-${moment.ts}-${moment.seq}`}
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
          <CelebrationBurst seed={`${moment.side}-${moment.ts}-${moment.seq}`} />
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
