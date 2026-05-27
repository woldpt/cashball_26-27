/**
 * @param {{
 *   icon?: string,
 *   label: string,
 *   children: ReactNode,
 *   accent?: string,
 * }} props
 */
export function StatTile({ icon, label, children, accent = "border-outline-variant/15" }) {
  return (
    <div
      className={`flex flex-col items-center justify-center bg-surface/50 rounded-md px-2.5 py-2 border ${accent}`}
    >
      {icon && (
        <span className="material-symbols-outlined text-sm leading-none mb-1" style={{ color: "#52525b" }}>
          {icon}
        </span>
      )}
      <div className="text-[8px] uppercase tracking-widest text-zinc-600 font-black mb-1">
        {label}
      </div>
      <span className="text-white font-black text-base leading-none">{children}</span>
    </div>
  );
}
