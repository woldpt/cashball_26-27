/**
 * BadgeSkills — badge único de skills (STYLE.md §10).
 *
 * Retângulo de cantos arredondados com os quatro valores sempre
 * pela mesma ordem: SKILL dourado (maior, negrito, glow só no número)
 * | RES azul | FORMA verde | MOR violeta. Uma só receita para Plantel,
 * Tática, intervenção/substituições e mercado.
 *
 * Sem label "Skill" — só o número dourado a negrito com glow.
 */

/**
 * @param {{
 *   skill?: number,
 *   resistance?: number,
 *   form?: number,
 *   morale?: number,
 *   delta?: number,
 *   hideResForm?: boolean,
 *   size?: "md"|"sm",
 *   className?: string,
 * }} props
 */
export function BadgeSkills({
  skill,
  resistance,
  form,
  morale,
  delta = 0,
  hideResForm = false,
  size = "md",
  className = "",
}) {
  const sm = size === "sm";
  const skillCls = sm ? "text-[15px]" : "text-[18px] sm:text-[19px]";
  const numCls = sm ? "text-[11px]" : "text-[12px] sm:text-[13px]";
  // Abaixo de 360px o padding encolhe (4.ª célula MOR): a 320px o badge
  // de 4 células excedia a linha em 25px (topwidgets harness); 360+ passa
  // com px-2, por isso o breakpoint é 360 e não sm.
  const cellCls = sm ? "px-1.5 py-0.5" : "px-1 min-[360px]:px-2 py-0.5";
  // Glow só no número — textShadow estático forte (sem keyframes novos
  // para não regressar o briefing em landscape, ver 2262acd986f6).
  const glowStyle = {
    textShadow:
      "0 0 10px rgba(251,191,36,0.9), 0 0 22px rgba(251,191,36,0.45), 0 0 36px rgba(251,191,36,0.20)",
  };
  return (
    <div
      title={`Skill ${skill ?? "—"} · RES ${resistance ?? "—"} · Forma ${form ?? "—"} · Moral ${morale ?? "—"}`}
      className={`flex items-stretch rounded-lg border border-outline-variant/25 overflow-hidden shrink-0 ${className}`}
    >
      <div
        className={`flex items-center justify-center gap-1 bg-amber-400/12 ${!hideResForm ? "border-r border-amber-400/20" : ""} ${cellCls}`}
      >
        {delta !== 0 && (
          <span
            className={`text-[10px] font-black leading-none ${delta > 0 ? "text-emerald-400" : "text-red-400"}`}
          >
            {delta > 0 ? "▲" : "▼"}
          </span>
        )}
        <span
          className={`font-black font-headline tabular-nums leading-none text-amber-300 ${skillCls}`}
          style={glowStyle}
        >
          {skill ?? "—"}
        </span>
      </div>
      {!hideResForm && (
        <>
          <div className={`flex flex-col items-center justify-center gap-0.5 bg-sky-500/10 border-r border-sky-500/20 ${cellCls}`}>
            <span className="text-[7px] uppercase tracking-widest text-sky-200/70 font-bold leading-none">
              Res
            </span>
            <span className={`font-black tabular-nums leading-none text-sky-400 ${numCls}`}>
              {resistance ?? "–"}
            </span>
          </div>
          <div className={`flex flex-col items-center justify-center gap-0.5 bg-emerald-500/10 border-r border-emerald-500/20 ${cellCls}`}>
            <span className="text-[7px] uppercase tracking-widest text-emerald-200/70 font-bold leading-none">
              Forma
            </span>
            <span className={`font-black tabular-nums leading-none text-emerald-400 ${numCls}`}>
              {form ?? "–"}
            </span>
          </div>
          <div className={`flex flex-col items-center justify-center gap-0.5 bg-violet-500/10 ${cellCls}`}>
            <span className="text-[7px] uppercase tracking-widest text-violet-200/70 font-bold leading-none">
              Mor
            </span>
            <span className={`font-black tabular-nums leading-none text-violet-400 ${numCls}`}>
              {morale ?? "–"}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// Alias histórico — o badge nasceu como SkillBadge
export const SkillBadge = BadgeSkills;
