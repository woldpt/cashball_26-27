/* ── Mentality / Tactics buttons (halftime) ───────────────────────────── */
import { MatchIcon } from "./MatchIcon.jsx";

/* Each option carries an icon + accent hex. The accent drives ALL selected
 * styling (background, border, glow) so the old hardcoded indigo glow bug —
 * where picking "Ofensivo" still produced an indigo halo — is fixed. */
const TACTIC_OPTIONS = [
  {
    value: "Defensive",
    label: "Defensivo",
    accent: "#3b82f6",
    icon: "phase-start",
  },
  {
    value: "Balanced",
    label: "Neutro",
    accent: "#6366f1",
    icon: "form-flat",
  },
  { value: "Offensive", label: "Ofensivo", accent: "#f59e0b", icon: "form-up" },
];

/**
 * Grupo de 3 botões que escreve um campo da tática (mentalidade por omissão;
 * também pressão e conversa ao intervalo).
 * @param {Object} props
 * @param {string} [props.value] - Valor ativo.
 * @param {(patch: Object) => void} props.onChange - Recebe `{ [field]: valor }`.
 * @param {string} [props.className]
 * @param {Array<{value: string, label: string, accent: string, icon?: string}>} [props.options]
 * @param {string} [props.field] - Campo da tática (style | pressure | talk).
 * @returns {JSX.Element}
 */
export function TacticsButtons({ value, onChange, className, options = TACTIC_OPTIONS, field = "style" }) {
  return (
    <div className={`grid grid-cols-3 gap-2 ${className || ""}`}>
      {options.map(({ value: optValue, label, accent, icon }) => {
        const isActive = value === optValue;
        return (
          <button
            key={optValue}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange({ [field]: optValue })}
            className={`flex flex-row items-center justify-center gap-1 sm:gap-1.5 py-1.5 px-2 sm:px-3 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-normal sm:tracking-wide transition-all border ${
              isActive
                ? "text-on-surface"
                : "bg-surface-container-low/60 border-outline/40 text-on-surface-variant/80 hover:border-outline hover:text-on-surface-variant"
            }`}
            /* Selected state derives ALL color from the accent inline — the
             * old code layered a dead className `shadow-[0_0_20px_rgba(99,102,241,0.15)]`
             * on top, which flickered indigo during the transition. */
            style={
              isActive
                ? {
                    background: `${accent}30`,
                    borderColor: `${accent}80`,
                    boxShadow: `0 0 20px ${accent}25`,
                  }
                : {}
            }
          >
            {icon && (
              <MatchIcon
                name={icon}
                className={`h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 ${isActive ? "" : "opacity-70"}`}
              />
            )}
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
