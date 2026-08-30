import { POSITION_SHORT_LABELS } from "../../../constants/index.js";
import { POSITION_FULL_LABELS } from "../matchConstants.js";

/**
 * Single opponent player row — passivo (sem hover, sem button).
 * Mostra skill + posição + craque + forma/RES (quando visível).
 *
 * @param {object} props - Props do jogador.
 * @param {object} props.player - Dados do jogador (id, name, position, skill, resistance, form, is_star).
 * @param {object} props.posStyle - Estilo da posição (getPosStyle).
 * @param {boolean} [props.hideResForm] - Ocultar RES e forma.
 */
export function OpponentGridCard({ player, posStyle, hideResForm = false }) {
  const s = posStyle;
  const form = player.form ?? 100;
  const formIcon = form >= 115 ? "💪" : form <= 85 ? "😩" : "👍";
  const formColor =
    form >= 115 ? "text-emerald-400" : form <= 85 ? "text-rose-400" : "text-on-surface-variant";

  return (
    <div
      className={`relative flex items-center gap-1.5 rounded border border-outline-variant/20 ${s.bgGrad} via-surface-container/60 to-surface/20 bg-gradient-to-r px-2 py-1.5 min-w-0`}
    >
      {/* Faixa lateral por posição */}
      <div className={`shrink-0 w-0.5 self-stretch rounded-full bg-gradient-to-b ${s.bar}`} />

      {/* Skill + posição + nome */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <span
          className={`shrink-0 text-xs font-black font-headline tabular-nums leading-none ${s.badgeText}`}
          style={{ textShadow: "0 0 6px currentColor" }}
        >
          {player.skill ?? "—"}
        </span>
        <span
          className={`shrink-0 w-5 text-center text-[9px] font-bold uppercase tracking-widest rounded px-1 border ${s.badgeBg} ${s.badgeText} ${s.badgeBorder}`}
          title={POSITION_FULL_LABELS[player.position]}
        >
          {POSITION_SHORT_LABELS[player.position] || "?"}
        </span>
        <span className="truncate text-xs font-semibold text-on-surface min-w-0">
          {player.name}
          {!!player.is_star && (player.position === "MED" || player.position === "ATA") && (
            <span className="ml-0.5 text-amber-400" title="Craque" aria-label="Craque">★</span>
          )}
        </span>
      </div>

      {/* RES + forma à direita — oculto para adversário */}
      {!hideResForm && (
        <div className="shrink-0 flex items-center gap-1.5">
          <span className="text-[9px] font-bold tabular-nums text-cyan-400 leading-none">
            {player.resistance ?? "–"}
          </span>
          <span className={`text-xs leading-none ${formColor}`}>
            {formIcon}
          </span>
        </div>
      )}
    </div>
  );
}
