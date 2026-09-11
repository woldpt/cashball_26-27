import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { MODAL_Z, POSITION_ACCENT_HEX } from "../../constants/index.js";
import { ModalShell } from "./ModalShell.jsx";
import { Button } from "./Button.jsx";
import { CelebrationBurst } from "./CelebrationBurst.jsx";
import { PlayerAvatar } from "./PlayerAvatar.jsx";

/**
 * Custom in-game dialog replacing window.prompt / window.confirm.
 *
 * @param {{
 *   dialog: {
 *     mode: "prompt"|"confirm",
 *    title: string,
 *    description?: string,
 *    stats?: { label: string, value: string, className?: string }[],
 *    defaultValue?: string,
 *    confirmLabel?: string,
 *    cancelLabel?: string,
 *    danger?: boolean,
 *    cancelDanger?: boolean,
    peerPositionLabel?: string,
    positionPeers?: Array<{ id: number, name: string, skill: number, wage: number }>,
 *     onConfirm: (value?: string) => void,
 *     onCancel: () => void,
 *     // Contratos: o modal fica aberto à espera do servidor e transforma-se
 *     // no sítio (proposal → waiting → renewed|declined|counter). Com
 *     // `awaitServer`, Confirmar/Cancelar emitem sem fechar; a fase `waiting`
 *     // esconde os botões; as fases terminais mostram Continuar (hideCancel).
 *     kind?: "contract",
 *     playerId?: number,
 *     awaitServer?: boolean,
 *     phase?: "proposal"|"waiting"|"renewed"|"declined",
 *     waitingText?: string,
 *     hideCancel?: boolean,
 *     avatar?: { seed: string|number, position?: string, teamColor?: string, nationality?: string, photo?: string|null },
 *   } | null,
 *   z?: number,
 *   onClose: () => void,
 * }} props
 */
export function GameDialog({ dialog, onClose, z = MODAL_Z.default }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (dialog?.mode === "prompt" && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [dialog]);

  const handleConfirm = () => {
    if (!dialog) return;
    if (dialog.mode === "prompt") {
      dialog.onConfirm(inputRef.current?.value ?? "");
    } else {
      dialog.onConfirm();
    }
    if (!dialog.awaitServer) onClose();
  };

  const handleCancel = () => {
    dialog?.onCancel?.();
    if (!dialog || !dialog.awaitServer) onClose();
  };

  const phase = dialog?.phase || "proposal";
  const isTerminal = phase === "renewed" || phase === "declined";
  const accent = POSITION_ACCENT_HEX[dialog?.avatar?.position] || "#d97706";

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleConfirm();
    if (e.key === "Escape") {
      // Em espera o Escape só fecha (o pedido já foi emitido — o resultado
      // chega por evento e reabre em fallback); senão equivale a Cancelar.
      if (phase === "waiting") onClose();
      else handleCancel();
    }
  };

  return (
    <ModalShell
      visible={!!dialog}
      onClose={onClose}
      z={z}
      variant="card"
      dismissable
    >
      <div
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-outline-variant/15">
          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-black mb-1">
            {dialog?.mode === "prompt" ? "Inserir valor" : "Confirmação"}
          </p>
          <h3 className="text-base font-black text-on-surface leading-snug">
            {dialog?.title}
          </h3>
          {dialog?.description && (
            <p className="text-xs text-on-surface-variant mt-1">
              {dialog.description}
            </p>
          )}
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {phase === "waiting" ? (
            <div className="py-6 text-center" role="status">
              <p className="text-2xl animate-pulse" aria-hidden>💬</p>
              <p className="mt-2 text-xs font-bold text-on-surface-variant">
                {dialog?.waitingText ?? "A falar com o agente…"}
              </p>
            </div>
          ) : isTerminal ? (
            <div className="relative text-center overflow-hidden py-2">
              {phase === "renewed" ? (
                <CelebrationBurst seed={dialog?.avatar?.seed ?? dialog?.playerId ?? "contract"} />
              ) : (
                <motion.div
                  className="text-5xl mb-3"
                  aria-hidden
                  initial={{ x: 60, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 120, damping: 16 }}
                >
                  💼
                </motion.div>
              )}
              <motion.p
                className="font-headline font-black text-2xl tracking-tight uppercase mb-1"
                style={phase === "renewed" ? { color: accent } : undefined}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
              >
                {phase === "renewed" ? "Renovado!" : "Fez as malas"}
              </motion.p>
              {dialog?.avatar && phase === "renewed" && (
                <div className="flex justify-center mb-3">
                  <PlayerAvatar
                    seed={dialog.avatar.seed}
                    position={dialog.avatar.position}
                    teamColor={dialog.avatar.teamColor}
                    nationality={dialog.avatar.nationality}
                    size="lg"
                    photo={dialog.avatar.photo || null}
                  />
                </div>
              )}
              {dialog?.stats?.length > 0 && (
                <div className="mb-3 flex flex-wrap justify-center gap-1.5">
                  {dialog.stats.map((stat, i) => (
                    <span
                      key={i}
                      className={`rounded-md border px-2 py-1 text-[11px] font-bold ${stat.className ?? "border-outline-variant/20 bg-surface text-on-surface-variant"}`}
                    >
                      <span className="mr-1 uppercase tracking-wide opacity-70">
                        {stat.label}
                      </span>
                      {stat.value}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
          <>
          {dialog?.mode === "confirm" && dialog?.stats?.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {dialog.stats.map((stat, i) => (
                <span
                  key={i}
                  className={`rounded-md border border-outline-variant/20 bg-surface px-2 py-1 text-[11px] font-bold text-on-surface-variant ${stat.className ?? ""}`}
                >
                  <span className="mr-1 uppercase tracking-wide opacity-70">
                    {stat.label}
                  </span>
                  {stat.value}
                </span>
              ))}
            </div>
          )}
          {dialog?.mode === "confirm" && Array.isArray(dialog?.positionPeers) && (
            <div className="mb-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1.5">
                Mesma posição no plantel{dialog?.peerPositionLabel ? ` · ${dialog.peerPositionLabel}` : ""}
              </p>
              {dialog.positionPeers.length === 0 ? (
                <p className="text-[11px] text-on-surface-variant/70">
                  É o único{dialog?.peerPositionLabel ? ` ${dialog.peerPositionLabel}` : ""} do plantel.
                </p>
              ) : (
                <ul className="max-h-40 overflow-y-auto divide-y divide-outline-variant/15 rounded-md border border-outline-variant/20 bg-surface/60">
                  {dialog.positionPeers.map((peer) => (
                    <li
                      key={peer.id}
                      className="flex items-center gap-2 px-2 py-1.5"
                    >
                      <span className="flex-1 min-w-0 truncate text-xs uppercase tracking-tight text-on-surface">
                        {peer.name}
                      </span>
                      <span className="text-[11px] font-black tabular-nums text-on-surface">
                        {peer.skill}
                      </span>
                      <span className="w-24 shrink-0 text-right text-[11px] tabular-nums text-on-surface-variant">
                        €{Number(peer.wage ?? 0).toLocaleString("pt-PT")}/sem
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {dialog?.mode === "prompt" && (
            <input
              ref={inputRef}
              type="number"
              min="0"
              defaultValue={dialog.defaultValue ?? ""}
              className="w-full rounded-md border border-outline-variant/30 bg-surface px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 transition-colors"
            />
          )}
          </>
          )}
        </div>

        {/* Actions */}
        {phase !== "waiting" && (
        <div className="flex gap-2 px-5 pb-5">
          {!dialog?.hideCancel && (
          <Button
            variant={dialog?.cancelDanger ? "dangerSoft" : "secondary"}
            className="flex-1"
            onClick={handleCancel}
          >
            {dialog?.cancelLabel ?? "Cancelar"}
          </Button>
          )}
          <Button
            variant={dialog?.danger ? "dangerSoft" : "success"}
            className="flex-1"
            onClick={handleConfirm}
          >
            {dialog?.confirmLabel ?? "Confirmar"}
          </Button>
        </div>
        )}
      </div>
    </ModalShell>
  );
}
