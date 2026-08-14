/**
 * StatTile — mini tile de estatística (usado no verso dos cards de leilão).
 * Token-based (STYLE.md §1): sem cores hardcoded.
 *
 * @param {{
 *   icon?: string,
 *   label: string,
 *   children: import("react").ReactNode,
 *   accent?: string,
 * }} props
 */
export function StatTile({ icon, label, children, accent = "border-outline-variant/15" }) {
  return (
    <div
      className={`flex flex-col items-center justify-center bg-surface/50 rounded-md px-2.5 py-2 border ${accent}`}
    >
      {icon && (
        <span className="material-symbols-outlined text-sm leading-none mb-1 text-on-surface-variant/40">
          {icon}
        </span>
      )}
      <div className="text-[8px] uppercase tracking-widest text-on-surface-variant/60 font-black mb-1">
        {label}
      </div>
      <span className="text-on-surface font-black text-base leading-none">{children}</span>
    </div>
  );
}
