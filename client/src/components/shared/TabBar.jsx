/**
 * TabBar — barra de filtros/tabs de página padronizada.
 *
 * Container canónico: `flex items-center gap-1 bg-surface-container-high
 * rounded-lg p-1` com item ativo `bg-primary text-white shadow`.
 * Substitui as variações em CalendarioTab, TeamSquadView, TeamSquadModal
 * e MatchView (tamanhos sm/md).
 *
 * O fundo do item ativo é um indicador deslizante (layoutId) — o mesmo
 * padrão do bottom-nav mobile — em vez de trocar bg instantaneamente.
 */

import { useId } from "react";
import { motion } from "framer-motion";
import { SPRING } from "../../motion.js";

/**
 * @param {{
 *   tabs: Array<{ key: string, label: import("react").ReactNode }>,
 *   active: string,
 *   onChange: (key: string) => void,
 *   size?: "sm"|"md",
 *   expand?: boolean,
 *   className?: string,
 * }} props
 */
export function TabBar({ tabs, active, onChange, size = "sm", expand = false, className = "" }) {
  // `expand` = segmented control: items partilham a largura (sem scroll);
  // tracking/padding reduzidos para caber labels longos em telas pequenas.
  // useId por instância: cada TabBar tem o seu próprio layoutId, evitando
  // que indicadores de TabBars diferentes "viajem" entre si.
  const id = useId().replace(/:/g, "");
  const itemClass =
    size === "md"
      ? expand
        ? "px-0 py-2 text-sm"
        : "px-4 py-2 text-sm tracking-wide"
      : expand
        ? "px-0 py-1 text-xs"
        : "px-3 py-1 text-xs tracking-wide";
  // normal-case: uppercase é ~15% mais largo — em telas pequenas os labels
  // cabem melhor em mixed case (o expand existe exatamente para isso).
  const expandClass = expand
    ? "flex-1 min-w-0 justify-center whitespace-nowrap overflow-hidden tracking-tight normal-case"
    : "";
  return (
    <div
      className={`flex items-center gap-1 bg-surface-container-high rounded-lg p-1 ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`relative ${itemClass} ${expandClass}rounded font-black uppercase transition-colors ${
              isActive
                ? "text-white"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {isActive && (
              <motion.span
                layoutId={`tab-ind-${id}`}
                className="absolute inset-0 rounded bg-primary shadow"
                transition={SPRING.indicator}
              />
            )}
            <span className="relative">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
