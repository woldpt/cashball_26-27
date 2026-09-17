import { memo } from "react";

/**
 * Tile — contentor base dos tiles do briefing (tokens STYLE.md §1, sem hex).
 * @param {{ label: import("react").ReactNode, children: import("react").ReactNode, className?: string }} props
 * @returns {JSX.Element}
 */
export const Tile = memo(function Tile({ label, children, className = "" }) {
  return (
    <div
      className={`min-w-0 bg-surface-container-low/60 border border-outline-variant/25 rounded-xl px-2.5 short:px-2 py-1.5 short:py-1 lg:py-2.5 flex flex-col items-center justify-center text-center ${className}`}
    >
      <span className="text-[8px] uppercase tracking-widest text-gray-600 font-black mb-0.5 lg:mb-1">
        {label}
      </span>
      <div className="w-full flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
});
