import { useMemo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ModalShell } from "../shared/ModalShell.jsx";
import { PlayerAvatar } from "../shared/PlayerAvatar.jsx";
import { Button } from "../shared/Button.jsx";
import { CelebrationBurst } from "../shared/CelebrationBurst.jsx";
import { MODAL_Z, POSITION_ACCENT_HEX } from "../../constants/index.js";
import { formatCurrency } from "../../utils/formatters.js";
import { playSigningSound } from "../../utils/audio.js";

const SOURCE_LABEL = {
  market: "Mercado de Transferências",
  proposal: "Proposta Aceite",
  auction: "Leilão Vencido",
};

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
        <CelebrationBurst seed={signing.playerId} />

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
            photo={signing.photo || null}
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
