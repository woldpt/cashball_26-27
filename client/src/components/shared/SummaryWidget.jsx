/**
 * SummaryWidget — widget de resumo do topo de página (STYLE.md §3).
 *
 * Container canónico: `bg-surface-container-low p-5 rounded-md h-28
 * border-l-4 <accent>` com label micro em cima e valor grande em baixo.
 */

/**
 * @param {{
 *   label: string,
 *   value: import("react").ReactNode,
 *   sub?: string,
 *   accentClass?: string,
 *   accentStyle?: object,
 *   valueClass?: string,
 *   valueColorClass?: string,
 *   labelClass?: string,
 *   subClass?: string,
  *   className?: string,
  *   flat?: boolean,
  *   compactMobile?: boolean,
 *   children?: import("react").ReactNode,
 * }} props
 */
export function SummaryWidget({
  label,
  value,
  sub,
  accentClass = "border-primary",
  accentStyle,
  valueClass = "text-3xl",
  valueColorClass = "text-on-surface",
  labelClass = "",
  subClass = "",
  className = "",
  flat = false,
  compactMobile = false,
  children,
}) {
  return (
    <div
      className={`${
        flat
          ? "bg-surface-container p-6 rounded-xl flex flex-col justify-between"
          : compactMobile
            ? "bg-surface-container-low p-3 sm:p-5 rounded-md flex flex-col justify-between h-16 sm:h-28 border-l-4"
            : "bg-surface-container-low p-5 rounded-md flex flex-col justify-between h-28 border-l-4"
      } ${flat ? "" : accentClass} ${className}`}
      style={accentStyle}
    >
      <span
        className={`text-[10px] font-black uppercase tracking-widest text-on-surface-variant ${labelClass}`}
      >
        {label}
      </span>
      <span
        className={`font-black font-headline tracking-tighter tabular-nums leading-none ${valueColorClass} ${valueClass}`}
      >
        {value}
      </span>
      {sub && (
        <span
          className={`text-[9px] text-on-surface-variant font-black uppercase tracking-widest ${subClass}`}
        >
          {sub}
        </span>
      )}
      {children}
    </div>
  );
}
