import { memo } from "react";

/**
 * PrimaryCTA — CTA principal verde do pré-jogo/jornada.
 *
 * Unifica os botões de avanço com gradiente inline espalhados pelo
 * `MatchBriefing`/`TacticsView` ("Avançar para a Tática", "Jogar Jornada")
 * num único componente canónico.
 *
 * @param {{
 *   children: import("react").ReactNode,
 *   onClick?: (e: import("react").MouseEvent) => void,
 *   disabled?: boolean,
 *   className?: string,
 *   title?: string,
 * }} props
 */
export const PrimaryCTA = memo(function PrimaryCTA({
  children,
  onClick,
  disabled = false,
  className = "",
  title,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`group w-full lg:w-60 shrink-0 inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 lg:py-3.5 font-black text-xs lg:text-sm uppercase tracking-widest text-green-950 transition-all duration-200 active:scale-95 hover:scale-[1.02] border border-emerald-300/40 shadow-[0_10px_30px_-8px_rgba(34,197,94,0.55)] hover:shadow-[0_14px_40px_-8px_rgba(34,197,94,0.75)] focus-visible:outline-2 focus-visible:outline-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 ${className}`}
      style={{
        background:
          "linear-gradient(135deg, #86efac 0%, #4ade80 30%, #22c55e 60%, #16a34a 100%)",
      }}
    >
      <span>{children}</span>
      <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-1">
        →
      </span>
    </button>
  );
});
