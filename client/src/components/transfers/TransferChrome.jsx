/**
 * Peças comuns às páginas de Transferências (Scout · Mercado · Leilões):
 * topo com o saldo em destaque, chip-toggle de filtro e barra de "% do saldo".
 */
import { formatCurrency } from "../../utils/formatters.js";
import { hexToRgba } from "../../utils/colorHelpers.js";
import { FLAG_TO_COUNTRY, POSITION_ACCENT_HEX } from "../../constants/index.js";
import { CountUp } from "../shared/CountUp.jsx";
import { PlayerAvatar } from "../shared/PlayerAvatar.jsx";
import { BadgeSkills } from "../shared/BadgeSkills.jsx";
import { TeamCrest } from "../shared/TeamCrest.jsx";
import { TeamLink } from "../shared/TeamLink.jsx";

const CHIP_TONE = {
  neutral: "bg-surface-container-high/80 text-on-surface border-outline-variant/25",
  good: "bg-emerald-500/12 text-emerald-300 border-emerald-500/30",
  bad: "bg-rose-500/12 text-rose-300 border-rose-500/30",
  warn: "bg-amber-500/12 text-amber-300 border-amber-500/30",
};

/**
 * TransferHeader — topo das páginas de transferências: ícone, kicker
 * «Transferências», título, saldo grande e chips de contexto. `children`
 * entra por baixo (barra de filtros), dentro do mesmo cartão.
 *
 * @param {Object} props
 * @param {string} props.icon - ícone Material Symbols.
 * @param {string} props.title - título da página.
 * @param {number} props.budget - valor em destaque (saldo do treinador por defeito).
 * @param {string} [props.kicker] - sobretítulo (por defeito «Transferências»).
 * @param {string} [props.valueLabel] - rótulo do valor (por defeito «Saldo»).
 * @param {string} [props.valueClass] - cor do valor (por defeito verde/`error`).
 * @param {Array<{label: string, value?: import("react").ReactNode, tone?: "neutral"|"good"|"bad"|"warn", icon?: string}>} [props.chips]
 * @param {import("react").ReactNode} [props.children]
 * @returns {JSX.Element}
 */
export function TransferHeader({ icon, title, budget = 0, kicker = "Transferências", valueLabel = "Saldo", valueClass, chips = [], children }) {
  return (
    <header className="relative overflow-hidden rounded-md border border-outline-variant/20 bg-surface-container-low shadow-sm shadow-black/30">
      <div aria-hidden className="top-light" />
      {/* Brilho da marca + linhas de relvado: só decoração, sem layout. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(ellipse 60% 120% at 0% 0%, color-mix(in oklab, var(--color-primary) 22%, transparent) 0%, transparent 70%), radial-gradient(ellipse 50% 140% at 100% 0%, rgba(16,185,129,0.14) 0%, transparent 70%), repeating-linear-gradient(115deg, transparent 0 22px, rgba(255,255,255,0.018) 22px 44px)",
        }}
      />
      <div className="relative flex items-center gap-3 px-3.5 sm:px-5 pt-3 sm:pt-4 pb-2.5 sm:pb-3">
        <span className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center bg-primary/15 border border-primary/30 text-primary shadow-md shadow-black/40">
          <span className="material-symbols-outlined text-[22px] sm:text-[26px] w-[1em] overflow-hidden">{icon}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.25em] text-on-surface-variant leading-none">
            {kicker}
          </p>
          <h1 className="mt-1 font-headline font-black uppercase tracking-tight text-on-surface text-lg sm:text-2xl leading-none truncate">
            {title}
          </h1>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant leading-none">
            {valueLabel}
          </p>
          <p
            className={`mt-1 font-headline font-black tracking-tighter tabular-nums leading-none text-lg sm:text-3xl ${budget < 0 ? "text-error" : valueClass || "text-emerald-400"}`}
            style={{ textShadow: "0 0 18px currentColor" }}
          >
            <CountUp value={budget} format={formatCurrency} />
          </p>
        </div>
      </div>
      {chips.length > 0 && (
        <div className="relative flex flex-wrap gap-1.5 px-3.5 sm:px-5 pb-3">
          {chips.map((chip) => (
            <span
              key={chip.label}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider tabular-nums ${CHIP_TONE[chip.tone || "neutral"]}`}
            >
              {chip.icon && <span className="material-symbols-outlined text-[13px] leading-none w-[1em] overflow-hidden">{chip.icon}</span>}
              {chip.value != null && <span className="text-[11px]">{chip.value}</span>}
              <span className="opacity-80">{chip.label}</span>
            </span>
          ))}
        </div>
      )}
      {children && (
        <div className="relative border-t border-outline-variant/15 bg-surface-container/60 px-2.5 sm:px-4 py-2.5 sm:py-3 space-y-2">
          {children}
        </div>
      )}
    </header>
  );
}

/**
 * FilterChip — toggle de filtro em pílula (substitui as checkboxes soltas).
 *
 * @param {Object} props
 * @param {boolean} props.active
 * @param {(next: boolean) => void} props.onChange
 * @param {string} [props.icon] - ícone Material Symbols.
 * @param {import("react").ReactNode} props.children
 * @returns {JSX.Element}
 */
export function FilterChip({ active, onChange, icon, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onChange(!active)}
      className={`inline-flex items-center gap-1.5 min-h-9 px-3 rounded-full border text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 whitespace-nowrap ${
        active
          ? "bg-primary/20 border-primary/60 text-on-surface shadow-[0_0_14px_-4px_var(--color-primary)]"
          : "bg-surface/60 border-outline-variant/25 text-on-surface-variant hover:text-on-surface hover:border-outline-variant/50"
      }`}
    >
      <span className={`material-symbols-outlined text-[15px] leading-none w-[1em] overflow-hidden ${active ? "text-primary" : ""}`}>
        {active ? "check_circle" : icon || "radio_button_unchecked"}
      </span>
      {children}
    </button>
  );
}

/**
 * BudgetMeter — quanto do saldo leva um preço. Vermelho com «faltam X»
 * quando não chega.
 *
 * @param {Object} props
 * @param {number} props.price
 * @param {number} props.budget
 * @returns {JSX.Element}
 */
export function BudgetMeter({ price, budget }) {
  const fits = budget > 0 && price <= budget;
  const pct = fits ? Math.max(2, Math.round((price / budget) * 100)) : 100;
  const barColor = !fits ? "bg-rose-500" : pct > 75 ? "bg-amber-400" : "bg-emerald-400";
  return (
    <div>
      <div className="h-1.5 rounded-full bg-surface/80 overflow-hidden">
        <div className={`h-full rounded-full ${barColor} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <p className={`mt-1 text-[9px] font-black uppercase tracking-wider tabular-nums ${fits ? "text-on-surface-variant" : "text-rose-400"}`}>
        {fits ? `${pct}% do teu saldo` : `Faltam ${formatCurrency(price - Math.max(0, budget))}`}
      </p>
    </div>
  );
}

/**
 * TransferCardHead — cabeça comum dos cromos de Mercado e Leilões: avatar com
 * anel da posição, selos, nome (abre o jogador), clube e BadgeSkills.
 * A posição em marca-d'água grande no canto dá a identidade do cromo.
 *
 * @param {Object} props
 * @param {{id: number, name: string, position: string, nationality?: string, photo?: string|null, skill?: number, form?: number, morale?: number, resistance?: number, aggressiveness?: number|string}} props.player
 * @param {object|null} [props.team] - equipa do vendedor (brasão/cores).
 * @param {number|null} [props.teamId] - para o TeamLink.
 * @param {string} props.teamLabel
 * @param {import("react").ReactNode} [props.badges] - selos à esquerda.
 * @param {import("react").ReactNode} [props.corner] - canto superior direito.
 * @param {() => void} [props.onOpen]
 * @returns {JSX.Element}
 */
export function TransferCardHead({ player, team, teamId, teamLabel, badges, corner, onOpen }) {
  const posHex = POSITION_ACCENT_HEX[player.position] || "#94a3b8";
  const country = FLAG_TO_COUNTRY?.[player.nationality] || "";
  return (
    <div className="relative px-3 short:px-2 pt-3 short:pt-2">
      <span
        aria-hidden
        className="pointer-events-none absolute right-2 -top-1 font-headline font-black text-6xl leading-none tracking-tighter select-none"
        style={{ color: posHex, opacity: 0.07 }}
      >
        {player.position}
      </span>
      <div className="relative flex gap-3 short:gap-2">
        <div className="relative shrink-0 self-start">
          <div
            className="rounded-full"
            style={{ boxShadow: `0 0 0 2px rgba(10,10,16,0.9), 0 0 0 3.5px ${posHex}, 0 0 18px ${hexToRgba(posHex, 0.45)}` }}
          >
            <PlayerAvatar
              seed={player.id}
              position={player.position}
              teamColor={posHex}
              nationality={player.nationality}
              size="md"
              photo={player.photo || null}
            />
          </div>
          <span
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-px rounded-sm text-[9px] font-black tracking-wider shadow-md shadow-black/60"
            style={{ background: posHex, color: "#0d0d14" }}
          >
            {player.position}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 flex-wrap min-h-5">
            {badges}
            {corner && <span className="ml-auto">{corner}</span>}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen?.();
            }}
            title="Ver detalhes do jogador"
            className="mt-1 block max-w-full text-left font-headline font-black uppercase tracking-tight text-on-surface text-[15px] short:text-sm leading-tight line-clamp-2 bg-transparent cursor-pointer hover:text-primary transition-colors"
          >
            {player.name}
          </button>
          <p className="mt-1 flex items-center gap-1.5 text-[10px] text-on-surface-variant min-w-0">
            <TeamCrest team={team || { name: teamLabel }} size="w-4 h-4 text-[7px]" />
            <span className="truncate" title={teamLabel}>
              <TeamLink teamId={teamId}>{teamLabel}</TeamLink>
            </span>
            {player.nationality && (
              <span className="shrink-0 opacity-70" title={country}>
                · {player.nationality}
              </span>
            )}
          </p>
        </div>
      </div>
      <BadgeSkills
        className="mt-2.5 short:mt-1.5"
        skill={player.skill}
        form={player.form}
        morale={player.morale}
        resistance={player.resistance}
        aggressiveness={player.aggressiveness}
      />
    </div>
  );
}
