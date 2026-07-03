/* ── Button — Action button primitives used across match tabs ───────────
 *
 * Visual hierarchy:
 *   - PrimaryButton: prominent CTA (emerald when confirm, indigo for
 *     action-resolve). Carries a leading SVG icon to be scannable.
 *   - GhostButton: secondary text-only action (Reset, Anular links).
 *
 * These are intentionally heavier than the old `text-[11px] font-black`
 * pills so users can find buttons that previously looked like captions.
 */

/**
 * Primary call-to-action button.
 *
 * @param {Object} props
 * @param {import("react").ReactNode} [props.children] - Button label.
 * @param {import("react").ReactNode} [props.icon] - Optional leading icon
 *   (typically a <MatchIcon /> element).
 * @param {boolean} [props.disabled]
 * @param {"emerald"|"indigo"} [props.tone="emerald"] - Visual tone. Use
 *   "emerald" for confirm-type actions, "indigo" for action-resolve.
 * @param {string} [props.className] - Extra classes appended last.
 * @param {Function} [props.onClick]
 * @param {string} [props.type]
 */
export function PrimaryButton({
  children,
  icon,
  disabled = false,
  tone = "emerald",
  className = "",
  onClick,
  type = "button",
  ...rest
}) {
  const toneClasses =
    tone === "indigo"
      ? "bg-primary/90 hover:brightness-110 text-on-primary border-primary/40 shadow-[0_0_16px_rgba(99,102,241,0.2)]"
      : "bg-emerald-600/90 hover:bg-emerald-500/90 text-white border-emerald-400/40 shadow-[0_0_16px_rgba(16,185,129,0.25)]";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 shrink-0 px-5 py-2.5 rounded-md text-sm font-bold tracking-wide transition-all border ${
        disabled
          ? "bg-surface-container-high/80 border-outline/40 text-on-surface-variant/50 cursor-not-allowed shadow-none"
          : toneClasses
      } ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

/**
 * Ghost / secondary text button. Visually subordinate to PrimaryButton —
 * used for "reset" / "anular" links so they don't compete with the CTA.
 *
 * @param {Object} props
 * @param {import("react").ReactNode} [props.children]
 * @param {import("react").ReactNode} [props.icon]
 * @param {string} [props.className]
 * @param {Function} [props.onClick]
 * @param {string} [props.type]
 */
export function GhostButton({ children, icon, className = "", onClick, type = "button", ...rest }) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold uppercase tracking-wider text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/60 transition-colors ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
