import { useState } from "react";
import { getPosStyle } from "../matchConstants.js";
import {
  GhostButton,
  MatchIcon,
  PrimaryButton,
} from "../shared/index.js";

/* ── SwapControls — Sai → Entra + Limpar/Substituir + hint + countdown ───
 * Halftime e pausa user_substitution acumulam em fila (onConfirmSub) e só
 * avançam em Continuar; restantes ações resolvem imediatamente. */
export function SwapControls({
  isHalftime,
  isUserSubPause = false,
  isForcedSwap,
  isEmergencyGk = false,
  injuryCountdown,
  effectiveOutId,
  sourcePlayer,
  selectedInId,
  targetPlayer,
  confirmHint,
  canConfirmSwap,
  onResetSub,
  onConfirmSub,
  onResolveAction,
  confirmedSubs = [],
  pauseInitialIdx = null,
  compact = false,
  outSlotAction = null,
}) {
  // Local "resolving" state gives immediate feedback on click in action mode
  // (was: button fired and the user got no signal until the parent reacted).
  const [resolving, setResolving] = useState(false);
  // Halftime mirror: the confirm button is never unmounted, so feedback is a
  // brief transient state that auto-disarms instead of getting stuck.
  const [submitting, setSubmitting] = useState(false);

  const handleConfirmHalftime = () => {
    setSubmitting(true);
    onConfirmSub();
    window.setTimeout(() => setSubmitting(false), 900);
  };

  return (
    <div className={`space-y-3 ${compact ? "px-4 py-3" : ""}`}>
      {/* Forced-swap countdown — a single pulsing element where urgency matters. */}
      {isForcedSwap && injuryCountdown !== null && (
        <>
          {/* One-time screen-reader announcement: the ticking number is
           * aria-hidden to avoid spamming the live region every second. */}
          <span role="status" className="sr-only">
            {isEmergencyGk
              ? "Escolha automática iminente — quem vai para a baliza?"
              : "Substituição automática iminente — escolhe o substituto."}
          </span>
          <span
            aria-hidden="true"
            className="block text-amber-300 font-black text-xs tabular-nums animate-pulse motion-reduce:animate-none"
          >
            Auto em {injuryCountdown}s
          </span>
        </>
      )}

      {/* The Sai/Entra chain — two grouped clusters so the eye can scan
       * "[who's leaving] → [who's coming in]". Empty slots are dashed
       * placeholders with an actionable hint (was: bare "—"). */}
      {/* GR improvisado: sem par Sai/Entra — escolha única de quem calça as
       * luvas (não é substituição; ninguém sai para dar lugar). */}
      {isEmergencyGk ? (
        <div className="grid min-w-0 grid-cols-1 items-end gap-y-1">
          <span className="text-[10px] text-on-surface-variant/60 font-semibold uppercase tracking-wide">
            Para a baliza
          </span>
          <SwapSlot
            tone="emerald"
            player={selectedInId ? targetPlayer : null}
            placeholder="Quem vai para a baliza"
            onClick={outSlotAction}
            ariaLabel={
              selectedInId
                ? "Jogador escolhido para a baliza — tocar para voltar aos titulares"
                : "Escolher quem vai para a baliza — ver os titulares"
            }
          />
        </div>
      ) : compact ? (
        // Mobile: 2 colunas — legenda (9px) + chip de uma linha, altura mínima.
        <div className="grid min-w-0 grid-cols-2 items-end gap-x-3 gap-y-1">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-on-surface-variant/60">
            Sai
          </span>
          <span className="text-right text-[9px] font-semibold uppercase tracking-widest text-on-surface-variant/60">
            Entra
          </span>
          <SwapSlot
            tone="rose"
            player={effectiveOutId ? sourcePlayer : null}
            placeholder="Quem sai"
            onClick={outSlotAction}
            ariaLabel={
              effectiveOutId
                ? "Trocador por quem sai — voltar aos titulares"
                : "Escolher quem sai — ver os titulares"
            }
          />
          <SwapSlot
            tone="emerald"
            player={selectedInId ? targetPlayer : null}
            placeholder="Quem entra"
          />
        </div>
      ) : (
        <div className="grid min-w-0 items-center gap-y-2 sm:gap-x-2 grid-cols-[auto_1fr] sm:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto]">
          <span className="text-[10px] text-on-surface-variant/60 font-semibold uppercase tracking-wide">
            Sai
          </span>
          <SwapSlot
            tone="rose"
            player={effectiveOutId ? sourcePlayer : null}
            placeholder="Escolhe quem sai"
          />
          {/* Flow indicator: chevron-down (rotated) stacked on mobile, chevron-right on desktop. */}
          <MatchIcon
            name="chevron-right"
            title="Substituição"
            className="h-4 w-4 shrink-0 col-span-2 justify-self-center rotate-90 sm:col-auto sm:justify-self-start sm:rotate-0 text-on-surface-variant/60"
          />
          <span className="text-[10px] text-on-surface-variant/60 font-semibold uppercase tracking-wide">
            Entra
          </span>
          <SwapSlot
            tone="emerald"
            player={selectedInId ? targetPlayer : null}
            placeholder="Escolhe quem entra"
          />
        </div>
      )}

      {/* Why the confirm button is disabled — never leave it silent. */}
      {!canConfirmSwap && confirmHint && (
        <p className="text-[11px] font-semibold text-amber-300/90">
          {confirmHint}
        </p>
      )}

      {/* Action buttons — pausa user_substitution usa o mesmo fluxo de fila do intervalo */}
      {isHalftime || isUserSubPause ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <GhostButton
              onClick={onResetSub}
              icon={<MatchIcon name="reset" className="h-3.5 w-3.5" />}
              aria-label="Limpar seleção ou anular última substituição"
              className="h-11 flex-1 sm:h-10"
            >
              Limpar
            </GhostButton>
            <PrimaryButton
              onClick={handleConfirmHalftime}
              disabled={!canConfirmSwap || submitting}
              tone="emerald"
              icon={<MatchIcon name="confirm" className="h-4 w-4" />}
              className="h-11 flex-1 sm:h-10"
            >
              {submitting ? "A substituir…" : "Substituir"}
            </PrimaryButton>
          </div>
          {isUserSubPause && (() => {
            const start = pauseInitialIdx ?? confirmedSubs.length;
            const queued = confirmedSubs.slice(start);
            if (queued.length === 0) return null;
            return (
              <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-2 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300/80">
                  Na fila desta pausa · {queued.length}
                </p>
                <p className="text-[11px] font-medium text-on-surface/80">
                  Clica em <span className="font-black text-emerald-300">Substituir</span> para adicionar mais — só <span className="font-black">Continuar</span> avança o jogo.
                </p>
              </div>
            );
          })()}
        </div>
      ) : isEmergencyGk ? (
        <PrimaryButton
          disabled={!canConfirmSwap || resolving}
          onClick={() => {
            setResolving(true);
            onResolveAction(selectedInId);
          }}
          tone="indigo"
          icon={<span aria-hidden="true" className="text-sm leading-none">🧤</span>}
          className="h-11 w-full sm:h-10"
        >
          {resolving ? "A confirmar…" : "Vai para a baliza"}
        </PrimaryButton>
      ) : (
        <PrimaryButton
          disabled={!canConfirmSwap || resolving}
          onClick={() => {
            setResolving(true);
            onResolveAction({
              playerOut: effectiveOutId,
              playerIn: selectedInId,
            });
          }}
          tone="indigo"
          icon={<MatchIcon name="confirm" className="h-4 w-4" />}
          className="h-11 w-full sm:h-10"
        >
          {resolving ? "A substituir…" : "Substituir"}
        </PrimaryButton>
      )}
    </div>
  );
}

/**
 * SAI/ENTRA value box. Filled: pos badge + name chip.
 * Empty: dashed placeholder with an actionable hint.
 * Com `onClick` torna-se um botão (mobile: devolve à folha de titulares).
 *
 * @param {string} tone - Color tone of the filled chip ("rose"|"emerald").
 * @param {object} player - Player to display; null renders the placeholder.
 * @param {string} placeholder - Empty-state hint text.
 * @param {Function} [props.onClick] - Handler que torna o slot um botão.
 * @param {string} [props.ariaLabel] - Rótulo acessível quando é botão.
 */
function SwapSlot({ tone, player, placeholder, onClick = null, ariaLabel }) {
  const interactive = !!onClick;
  const Tag = interactive ? "button" : "span";
  const tagProps = interactive
    ? { type: "button", onClick, "aria-label": ariaLabel }
    : {};
  if (!player) {
    return (
      <Tag
        {...tagProps}
        className={`border border-dashed border-outline-variant/40 text-on-surface-variant/50 text-xs font-semibold px-3 py-1.5 rounded-md truncate min-w-0 ${
          interactive ? "cursor-pointer active:scale-[0.98] transition-transform" : ""
        }`}
      >
        {placeholder}
      </Tag>
    );
  }
  const posStyle = getPosStyle(player.position);
  const toneClass =
    tone === "rose"
      ? "bg-rose-950/80 text-rose-200 border-rose-800/50"
      : "bg-emerald-950/80 text-emerald-200 border-emerald-800/50";
  return (
    <Tag
      {...tagProps}
      className={`flex items-center gap-1.5 border ${toneClass} text-xs font-semibold px-2 py-1 rounded-md min-w-0 ${
        interactive ? "cursor-pointer active:scale-[0.98] transition-transform" : ""
      }`}
    >
      <span
        className={`shrink-0 px-1 py-px rounded text-[9px] font-bold uppercase tracking-widest border ${posStyle.badgeBg} ${posStyle.badgeText} ${posStyle.badgeBorder}`}
      >
        {player.position}
      </span>
      <span className="truncate min-w-0">{player.name}</span>
      <span className="shrink-0 text-[10px] font-black tabular-nums text-on-surface/60">
        {player.skill}
      </span>
    </Tag>
  );
}
