/**
 * Badge — chip de estado inline (STYLE.md §5).
 *
 * Formato canónico: `text-[9px] font-black uppercase px-1.5 py-px rounded
 * border tracking-widest` com variantes semânticas de cor.
 */

const VARIANT_CLASSES = {
  neutral: "bg-surface-bright text-on-surface-variant/70 border-outline-variant/30",
  junior: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  renovado:
    "relative overflow-hidden bg-gradient-to-r from-amber-700/60 via-yellow-500/60 to-amber-700/60 text-amber-100 border-amber-500/40 shadow-sm shadow-amber-500/30",
  sold: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  cooldown: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  suspended: "bg-error-container/60 text-error border-error/30",
  injured: "bg-amber-900/30 text-amber-400 border-amber-700/30",
  error: "bg-error-container/40 text-error border-error/20",
  info: "bg-primary/20 text-primary border-primary/35",
  warning: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const SIZE_CLASSES = {
  sm: "px-1.5 py-px rounded",
  md: "px-2 py-0.5 rounded-sm",
};

/**
 * @param {{
 *   variant?: keyof typeof VARIANT_CLASSES,
 *   size?: "sm"|"md",
 *   title?: string,
 *   className?: string,
 *   style?: object,
 *   children: import("react").ReactNode,
 * }} props
 */
export function Badge({
  variant = "neutral",
  size = "sm",
  title,
  className = "",
  style,
  children,
}) {
  return (
    <span
      title={title}
      style={style}
      className={`text-[9px] font-black uppercase ${SIZE_CLASSES[size]} border tracking-widest whitespace-nowrap ${
        VARIANT_CLASSES[variant] || VARIANT_CLASSES.neutral
      } ${className}`}
    >
      {children}
    </span>
  );
}
