import { useMemo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ModalShell } from "../shared/ModalShell.jsx";
import { PlayerAvatar } from "../shared/PlayerAvatar.jsx";
import { Button } from "../shared/Button.jsx";
import { MODAL_Z, POSITION_ACCENT_HEX } from "../../constants/index.js";
import { formatCurrency } from "../../utils/formatters.js";
import { playSigningSound } from "../../utils/audio.js";

const SOURCE_LABEL = {
  market: "Mercado de Transferências",
  proposal: "Proposta Aceite",
  auction: "Leilão Vencido",
};

const PARTICLES = ["🍾", "🥂", "✨", "🎉", "💫", "✨"];

/**
 * Modal de festejo exibido quando o jogador contrata um novo jogador
 * (compra no mercado, proposta aceite ou leilão vencido).
 *
 * @param {{
 *   signing: object|null,
 *   onClose: function,
 *   teams: array,
 *   me: object,
 * }} props
 */
export function SigningCelebrationModal({ signing, onClose, teams, me }) {
  const autoClosedRef = useRef(false);

  const myTeam = useMemo(
    () => teams?.find((t) => Number(t.id) === Number(me?.teamId)),
    [teams, me],
  );
  const teamColor = myTeam?.color_primary || myTeam?.colorPrimary || "#27272a";
  const accent = POSITION_ACCENT_HEX[signing?.position] || "#d97706";

  // Distribuição determinística (apenas função do índice) — mantém o render puro.
  const particles = useMemo(() => {
    if (!signing) return [];
    return PARTICLES.map((emoji, i) => {
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
    });
  }, [signing]);

  useEffect(() => {
    if (!signing) {
      autoClosedRef.current = false;
      return;
    }
    playSigningSound();
    const t = setTimeout(() => {
      if (!autoClosedRef.current) onClose();
    }, 5000);
    return () => clearTimeout(t);
  }, [signing]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!signing) return null;

  const handleClose = () => {
    autoClosedRef.current = true;
    onClose();
  };

  return (
    <ModalShell
      visible={!!signing}
      onClose={handleClose}
      z={MODAL_Z.signing}
      variant="card"
      cardClassName="!bg-surface overflow-hidden"
    >
      <div
        className="relative px-6 py-8 text-center overflow-hidden"
        style={{
          background: `radial-gradient(ellipse at top, ${accent}33 0%, rgba(15,19,32,0) 60%)`,
        }}
      >
        {/* ── Champagne particle burst ─────────────────────────────── */}
        {particles.map((p) => (
          <motion.span
            key={`${signing.playerId}-${p.id}`}
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

        {/* ── Champanhe popping ────────────────────────────────────── */}
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

        <span
          className="inline-block text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm mb-4"
          style={{ background: `${accent}22`, color: accent }}
        >
          {SOURCE_LABEL[signing.source] || "Nova Contratação"}
        </span>

        <div className="flex justify-center mb-4">
          <PlayerAvatar
            seed={signing.playerId}
            position={signing.position}
            teamColor={teamColor}
            nationality={signing.nationality}
            size="lg"
          />
        </div>

        <motion.h2
          className="font-headline font-black text-3xl tracking-tight text-on-surface uppercase"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.15 }}
        >
          Contratado!
        </motion.h2>

        <p className="mt-2 font-headline font-black text-lg tracking-tight text-white">
          {signing.name}
        </p>

        <div className="mt-3 flex items-center justify-center gap-3">
          <span
            className="text-[10px] font-black px-2 py-0.5 rounded-sm border"
            style={{
              background: `${accent}22`,
              color: accent,
              borderColor: `${accent}44`,
            }}
          >
            {signing.position}
          </span>
          <span
            className="text-[10px] font-black px-2 py-0.5 rounded-sm border"
            style={{
              background: `${accent}22`,
              color: accent,
              borderColor: `${accent}44`,
            }}
          >
            Força {signing.skill}
          </span>
          <span
            className="text-[10px] font-black px-2 py-0.5 rounded-sm border"
            style={{
              background: `${accent}22`,
              color: accent,
              borderColor: `${accent}44`,
            }}
          >
            {signing.age} anos
          </span>
        </div>

        <p className="mt-4 text-sm font-bold text-on-surface-variant">
          Contrato por{" "}
          <span
            className="font-black font-headline"
            style={{ color: accent }}
          >
            {formatCurrency(signing.price)}
          </span>
        </p>

        <div className="mt-6">
          <Button onClick={handleClose} variant="primary" full>
            Continuar
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
