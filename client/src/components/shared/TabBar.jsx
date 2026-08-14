/**
 * TabBar — barra de filtros/tabs de página padronizada.
 *
 * Container canónico: `flex items-center gap-1 bg-surface-container-high
 * rounded-lg p-1` com item ativo `bg-primary text-white shadow`.
 * Substitui as variações em CalendarioTab, TeamSquadView, TeamSquadModal
 * e MatchView (tamanhos sm/md).
 */

/**
 * @param {{
 *   tabs: Array<{ key: string, label: import("react").ReactNode }>,
 *   active: string,
 *   onChange: (key: string) => void,
 *   size?: "sm"|"md",
 *   className?: string,
 * }} props
 */
export function TabBar({ tabs, active, onChange, size = "sm", className = "" }) {
  const itemClass =
    size === "md"
      ? "px-4 py-2 text-sm"
      : "px-3 py-1 text-xs";
  return (
    <div
      className={`flex items-center gap-1 bg-surface-container-high rounded-lg p-1 ${className}`}
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`${itemClass} rounded font-black uppercase tracking-wide transition-all ${
            active === tab.key
              ? "bg-primary text-white shadow"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
