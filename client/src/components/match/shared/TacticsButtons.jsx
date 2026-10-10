/* ── Mentality / Tactics buttons (halftime) ───────────────────────────── */
import { MatchIcon } from "./MatchIcon.jsx";
import { STYLE_OPTIONS } from "../../../constants/index.js";

/**
 * Ícone da opção: emoji (conversa ao intervalo) ou ícone do jogo.
 * @param {Object} props
 * @param {{icon?: string, emoji?: string}} props.option
 * @param {string} props.className
 * @returns {JSX.Element|null}
 */
function OptionIcon({ option, className }) {
  if (option.emoji) return <span className="text-base leading-none" aria-hidden="true">{option.emoji}</span>;
  if (option.icon) return <MatchIcon name={option.icon} className={className} />;
  return null;
}

/**
 * Grupo de 3 opções que escreve um campo da tática (mentalidade por omissão;
 * também pressão e conversa ao intervalo).
 * - `segmented` (omissão): barra única com a opção ativa acesa — compacta,
 *   para o telemóvel e a Tática.
 * - `cards`: cartões com ícone, nome e o efeito em uma linha — para a coluna
 *   da Tática no intervalo (desktop), onde há espaço.
 * @param {Object} props
 * @param {string} [props.value] - Valor ativo.
 * @param {(patch: Object) => void} props.onChange - Recebe `{ [field]: valor }`.
 * @param {string} [props.className]
 * @param {Array<{value: string, label: string, accent: string, icon?: string, emoji?: string, hint?: string}>} [props.options]
 * @param {string} [props.field] - Campo da tática (style | pressure | talk).
 * @param {"segmented"|"cards"} [props.variant]
 * @param {string} [props.ariaLabel] - Nome do grupo para leitores de ecrã.
 * @returns {JSX.Element}
 */
export function TacticsButtons({
  value,
  onChange,
  className,
  options = STYLE_OPTIONS,
  field = "style",
  variant = "segmented",
  ariaLabel,
}) {
  if (variant === "cards") {
    return (
      <div role="radiogroup" aria-label={ariaLabel} className={`grid grid-cols-3 gap-2 ${className || ""}`}>
        {options.map((option) => {
          const { value: optValue, label, accent, hint } = option;
          const isActive = value === optValue;
          return (
            <button
              key={optValue}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onChange({ [field]: optValue })}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-center transition-all duration-200 active:scale-[0.97] ${
                isActive
                  ? "text-on-surface"
                  : "border-outline-variant/30 bg-surface-container-low/50 text-on-surface-variant hover:border-outline/60 hover:bg-surface-container/80"
              }`}
              style={
                isActive
                  ? {
                      background: `linear-gradient(160deg, ${accent}40 0%, ${accent}12 100%)`,
                      borderColor: `${accent}a6`,
                      boxShadow: `0 0 0 1px ${accent}40, 0 10px 24px -10px ${accent}aa`,
                    }
                  : undefined
              }
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors"
                style={{ background: isActive ? `${accent}55` : `${accent}1f`, color: accent }}
              >
                <OptionIcon option={option} className="h-4 w-4" />
              </span>
              <span className="w-full truncate text-[11px] font-black uppercase tracking-wider">{label}</span>
              {hint && (
                <span className="text-[10px] font-medium leading-tight text-on-surface-variant/90 line-clamp-2">
                  {hint}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`grid grid-cols-3 gap-1 rounded-xl border border-outline-variant/25 bg-surface-container-low/70 p-1 ${className || ""}`}
    >
      {options.map((option) => {
        const { value: optValue, label, accent } = option;
        const isActive = value === optValue;
        return (
          <button
            key={optValue}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange({ [field]: optValue })}
            className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-1.5 py-1.5 text-[10px] sm:text-xs font-black uppercase tracking-wide transition-all duration-200 active:scale-[0.97] ${
              isActive ? "text-on-surface" : "text-on-surface-variant/70 hover:bg-surface-container/80 hover:text-on-surface"
            }`}
            style={
              isActive
                ? {
                    background: `${accent}33`,
                    boxShadow: `inset 0 0 0 1px ${accent}a6, 0 0 18px -6px ${accent}`,
                  }
                : undefined
            }
          >
            <span
              className={`shrink-0 ${option.emoji ? "hidden min-[420px]:flex" : "flex"}`}
              style={{ color: isActive ? accent : undefined }}
            >
              <OptionIcon option={option} className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isActive ? "" : "opacity-70"}`} />
            </span>
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
