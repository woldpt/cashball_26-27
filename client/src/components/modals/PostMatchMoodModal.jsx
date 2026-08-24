import { useEffect } from "react";
import { motion } from "framer-motion";
import { ModalShell } from "../shared/ModalShell.jsx";
import { Button } from "../shared/Button.jsx";
import { CelebrationBurst } from "../shared/CelebrationBurst.jsx";
import { MODAL_Z } from "../../constants/index.js";
import { playSigningSound, playBooSound } from "../../utils/audio.js";

const FANS = {
  win: ["🎉", "🥳", "👏", "📣"],
  loss: ["😡", "😠", "😤", "📢"],
  draw: ["😐", "😑", "🤷", "👀"],
};

/**
 * Modal de humor pós-jogo — Vitória, Adeptos descontentes (derrota) ou
 * Empate. Sem timeout: requer clique do coach para avançar.
 *
 * @param {{
 *   mood: object|null,
 *   onClose: function,
 * }} props
 */
export function PostMatchMoodModal({ mood, onClose }) {
  useEffect(() => {
    if (!mood) return;
    if (mood.outcome === "win") playSigningSound();
    else if (mood.outcome === "loss") playBooSound();
  }, [mood]);

  if (!mood) return null;

  const isWin = mood.outcome === "win";
  const isLoss = mood.outcome === "loss";
  const accent = isWin ? "#4ade80" : isLoss ? "#f87171" : "#a1a1aa";
  const title = isWin
    ? "Vitória!"
    : isLoss
      ? "Adeptos Descontentes"
      : "Empate";
  const fans = FANS[mood.outcome] || FANS.draw;

  return (
    <ModalShell
      visible={!!mood}
      onClose={onClose}
      z={MODAL_Z.postMatch}
      variant="card"
      cardClassName="!bg-surface overflow-hidden"
    >
      <div
        className="relative px-6 py-8 text-center overflow-hidden"
        style={{
          background: isLoss
            ? `radial-gradient(ellipse at top, rgba(248,113,113,0.16) 0%, rgba(15,19,32,0) 60%)`
            : isWin
              ? `radial-gradient(ellipse at top, rgba(74,222,128,0.18) 0%, rgba(15,19,32,0) 60%)`
              : `radial-gradient(ellipse at top, rgba(161,161,170,0.12) 0%, rgba(15,19,32,0) 60%)`,
        }}
      >
        {isWin && <CelebrationBurst seed={`pm-${mood.key}`} />}

        {/* ── Adeptos ───────────────────────────────────────────────── */}
        {!isWin && (
          <div className="flex justify-center gap-3 mb-4">
            {fans.map((fan, i) => (
              <motion.span
                key={fan}
                className="text-3xl select-none"
                initial={{ opacity: 0, y: -10 }}
                animate={{
                  opacity: [0, 1, 0.6, 1],
                  y: [0, -8, 0],
                }}
                transition={{
                  duration: 1.6,
                  delay: i * 0.25,
                  repeat: isLoss ? Infinity : 1,
                }}
              >
                {fan}
              </motion.span>
            ))}
          </div>
        )}
        {isWin && (
          <div className="flex justify-center gap-3 mb-4">
            {fans.map((fan, i) => (
              <motion.span
                key={fan}
                className="text-3xl select-none"
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.1 + i * 0.15 }}
              >
                {fan}
              </motion.span>
            ))}
          </div>
        )}

        <span
          className="inline-block text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm mb-4"
          style={{ background: `${accent}22`, color: accent }}
        >
          {mood.roundLabel || (mood.source === "cup" ? "Taça" : "Liga")}
        </span>

        <motion.h2
          className="font-headline font-black text-3xl tracking-tight text-on-surface uppercase"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.15 }}
          style={{ color: accent }}
        >
          {title}
        </motion.h2>

        <p className="mt-3 text-sm font-bold text-on-surface-variant">
          {mood.source === "cup" ? "Eliminatória" : "Jogo contra"}{" "}
          <span className="font-headline font-black text-white">
            {mood.opponentName}
          </span>
        </p>

        <p className="mt-2 font-headline font-black text-4xl tracking-tight text-white tabular-nums">
          {mood.myGoals}
          <span className="mx-2 text-on-surface-variant">–</span>
          {mood.oppGoals}
        </p>

        {isLoss && (
          <p className="mt-2 text-[11px] font-bold text-on-surface-variant">
            Os adeptos abandonaram o estádio a assobiar…
          </p>
        )}

        <div className="mt-6">
          <Button onClick={onClose} variant={isWin ? "success" : "secondary"} full>
            Continuar
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
