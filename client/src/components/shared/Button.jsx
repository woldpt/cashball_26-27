/**
 * Button — botão padronizado da aplicação.
 *
 * Unifica as receitas inline espalhadas pelos modais/views (raios,
 * cores e hovers diferentes) num único componente com variantes
 * semânticas e tamanhos. Formato base: `rounded-md font-black uppercase
 * tracking-widest` com `disabled:opacity-30 disabled:cursor-not-allowed`.
 */

const VARIANT_CLASSES = {
  primary: "bg-primary hover:brightness-110 text-on-primary",
  success:
    "bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500",
  secondary:
    "bg-surface-container-high hover:bg-surface-bright text-on-surface border border-outline-variant/25",
  danger: "bg-error-container hover:brightness-110 text-on-error-container",
  ghost:
    "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/60",
  accent: "bg-amber-500 hover:bg-amber-400 text-black",
  dangerSoft: "bg-error/20 border border-error/30 text-error hover:bg-error/30",
};

const SIZE_CLASSES = {
  sm: "px-3 py-1.5 text-[10px]",
  md: "px-4 py-2.5 text-xs",
  lg: "px-5 py-3 text-sm",
};

/**
 * @param {{
 *   variant?: keyof typeof VARIANT_CLASSES,
 *   size?: "sm"|"md"|"lg",
 *   full?: boolean,
 *   uppercase?: boolean,
 *   disabled?: boolean,
 *   className?: string,
 *   children: import("react").ReactNode,
 *   onClick?: (e: import("react").MouseEvent) => void,
 *   type?: string,
 *   title?: string,
 * }} props
 */
export function Button({
  variant = "primary",
  size = "md",
  full = false,
  uppercase = true,
  disabled = false,
  className = "",
  children,
  onClick,
  type = "button",
  title,
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md font-black transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed ${
        uppercase ? "uppercase tracking-widest" : "tracking-wide"
      } ${VARIANT_CLASSES[variant] || VARIANT_CLASSES.primary} ${
        SIZE_CLASSES[size]
      } ${full ? "w-full" : ""} ${className}`}
    >
      {children}
    </button>
  );
}
