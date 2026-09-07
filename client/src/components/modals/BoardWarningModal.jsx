import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ModalShell } from "../shared/ModalShell.jsx";
import { Button } from "../shared/Button.jsx";
import { MODAL_Z, DIVISION_NAMES } from "../../constants/index.js";
import { formatCurrency } from "../../utils/formatters.js";
import { playNotification } from "../../utils/audio.js";

/**
 * Brasão da equipa com fallback para círculo de iniciais —
 * mesmo footprint/padrão do TeamBadge em SeasonEndModal.
 *
 * @param {{ team: object|null, size?: "md"|"lg" }} props
 */
function Crest({ team, size = "md" }) {
  const sz = size === "lg" ? "w-12 h-12 text-xs" : "w-9 h-9 text-[11px]";
  const [failed, setFailed] = useState(() => false);
  if (team?.crest && !failed) {
    return (
      <img
        src={team.crest}
        alt={team.name || "crest"}
        onError={() => setFailed(true)}
        className={`${sz} rounded-full object-contain bg-white p-0.5 border border-white/10 shrink-0`}
        loading="lazy"
      />
    );
  }
  return (
    <div
      className={`${sz} rounded-full flex items-center justify-center font-black shrink-0 border border-white/10`}
      style={{
        background: team?.colorPrimary || "#27272a",
        color: team?.colorSecondary || "#fff",
      }}
    >
      {team?.name?.[0] || "?"}
    </div>
  );
}

/**
 * BoardWarningModal — aviso da direcção do clube sobre orçamento negativo.
 *
 * Substitui o antigo toast por-socket `systemMessage` (o servidor deixou de o
 * emitir; o aviso agora viaja no evento `boardBudgetWarning`).
 *
 *  - level 1 (1.ª semana com orçamento negativo) → tema âmbar;
 *  - level 3 (3.ª semana consecutiva) → tema vermelho, "último aviso";
 *  - fecho apenas manual (botão "Continuar") — sem auto-fecho;
 *  - som de notificação ao mostrar.
 *
 * @param {{
 *   boardWarning: {level: number, budget: number, streak: number, teamId: number, teamName: string, division: number, crest: string|null, colorPrimary: string, colorSecondary: string}|null,
 *   onClose: function,
 * }} props
 */
export function BoardWarningModal({ boardWarning, onClose }) {
  const isFinal = !!boardWarning && boardWarning.level === 3;
  const accent = isFinal ? "text-error" : "text-amber-400";

  useEffect(() => {
    if (boardWarning) playNotification();
  }, [boardWarning]);

  if (!boardWarning) return null;

  const budget = boardWarning.budget ?? 0;
  const streak = boardWarning.streak ?? 1;

  return (
    <ModalShell
      visible
      z={MODAL_Z.boardWarning}
      variant="card"
      backdropStyle={{
        background: isFinal
          ? "radial-gradient(ellipse at center, rgba(220,38,38,0.18) 0%, rgba(10,10,10,0.97) 70%)"
          : "radial-gradient(ellipse at center, rgba(245,158,11,0.15) 0%, rgba(10,10,10,0.97) 70%)",
        backdropFilter: "blur(8px)",
      }}
    >
      <motion.div
        className="relative w-full bg-surface-container border rounded-xl shadow-2xl overflow-hidden"
        style={{ borderColor: isFinal ? "rgba(239,68,68,0.35)" : "rgba(245,158,11,0.35)" }}
        initial={{ scale: 0.93, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 28, delay: 0.05 }}
      >
        {/* Glow de fundo tinto pela severidade */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: isFinal
              ? "radial-gradient(ellipse at 50% 0%, rgba(239,68,68,0.10) 0%, transparent 60%)"
              : "radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.10) 0%, transparent 60%)",
          }}
        />

        <div className="relative flex flex-col items-center gap-4 px-6 pt-7 pb-6 sm:px-8">
          {/* ⚠️ pulsante + severidade */}
          <div className="flex flex-col items-center gap-2.5">
            <motion.span
              className={`material-symbols-outlined ${accent}`}
              style={{ fontSize: "3rem" }}
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            >
              warning
            </motion.span>
            <motion.span
              className="inline-block text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded border"
              style={{
                color: isFinal ? "#f87171" : "#fbbf24",
                borderColor: isFinal ? "rgba(239,68,68,0.45)" : "rgba(245,158,11,0.45)",
                backgroundColor: isFinal ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)",
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.3 }}
            >
              {isFinal ? "Último aviso · Direcção" : "Aviso · Direcção"}
            </motion.span>
          </div>

          {/* Clube */}
          <motion.div
            className="flex w-full items-center gap-3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22, duration: 0.3 }}
          >
            <Crest
              team={{
                name: boardWarning.teamName,
                crest: boardWarning.crest,
                colorPrimary: boardWarning.colorPrimary,
                colorSecondary: boardWarning.colorSecondary,
              }}
              size="lg"
            />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-white font-bold text-base truncate">
                {boardWarning.teamName}
              </p>
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                {DIVISION_NAMES[boardWarning.division] ||
                  `Divisão ${boardWarning.division}`}
              </p>
            </div>
          </motion.div>

          {/* Orçamento + semanas */}
          <motion.div
            className="grid grid-cols-2 gap-2.5 w-full text-center"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32, duration: 0.3 }}
          >
            <div className="bg-surface-container-high/60 rounded-lg p-3 border border-outline-variant/25">
              <p className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider mb-1">
                Orçamento atual
              </p>
              <p className="text-error font-black text-base tabular-nums leading-none">
                {formatCurrency(budget)}
              </p>
            </div>
            <div className="bg-surface-container-high/60 rounded-lg p-3 border border-outline-variant/25">
              <p className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider mb-1">
                Semanas consecutivas
              </p>
              <p className="text-white font-black text-base tabular-nums leading-none">
                {streak}
              </p>
            </div>
          </motion.div>

          {/* Texto do aviso */}
          <motion.p
            className="text-center text-xs leading-relaxed text-zinc-300 max-w-xs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.42, duration: 0.3 }}
          >
            {isFinal
              ? "A Direcção admite despedimento por insolvência se o orçamento continuar negativo."
              : "Orçamento negativo — risco de bancarrota se a tendência continuar."}
          </motion.p>

          {/* Fecho manual */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.3 }}
          >
            <Button variant={isFinal ? "danger" : "accent"} onClick={onClose}>
              Continuar
            </Button>
          </motion.div>
        </div>
      </motion.div>
    </ModalShell>
  );
}
