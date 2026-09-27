import { AGG_TIERS } from "../../constants/index.js";
import { aggLabel } from "../../utils/playerHelpers.js";

/**
 * BadgeSkills — badge único de skills (STYLE.md §10).
 *
 * Retângulo de cantos arredondados com os valores sempre
 * pela mesma ordem: SKILL dourado (maior, negrito, glow só no número)
 * | FORMA verde | MOR violeta | RES azul | AGR vermelha (número na cor
 * do tier, etiqueta só no tooltip; escondida com hideStats). Uma só
 * receita para Plantel, Tática, intervenção/substituições e mercado.
 * Exceção: `skillLast` (Intervenção em vertical) põe o SKILL em último.
 *
 * Sem label "Skill" — só o número dourado a negrito com glow.
 * Na semana em que a skill muda (`prevSkill` do backend, só preenchido
 * nessa semana), o número pinta-se de verde (subiu) ou vermelho (desceu)
 * em vez do dourado — sem setas.
 */

/**
 * @param {{
 *   skill?: number,
 *   resistance?: number,
 *   form?: number,
 *   morale?: number,
 *   aggressiveness?: number|string,
 *   prevSkill?: number|null,
 *   skillLast?: boolean,
 *   hideStats?: boolean,
 *   size?: "md"|"sm",
 *   className?: string,
 * }} props
 */
export function BadgeSkills({
  skill,
  resistance,
  form,
  morale,
  aggressiveness,
  prevSkill = null,
  skillLast = false,
  hideStats = false,
  size = "md",
  className = "",
}) {
  const sm = size === "sm";
  // AGR: número 10–50 pintado com a cor do tier; etiqueta só no tooltip.
  // Visível em todas as larguras (inclusive mobile); escondida com hideStats.
  const hasAgg = aggressiveness != null;
  const aggKey = hasAgg ? aggLabel(aggressiveness) : null;
  const aggColor = (aggKey && AGG_TIERS[aggKey]?.color) || "text-zinc-400";
  const aggNum =
    typeof aggressiveness === "number"
      ? Math.max(1, Math.min(50, Math.round(aggressiveness)))
      : "–";
  const skillCls = sm ? "text-[15px]" : "text-[18px] sm:text-[19px]";
  const numCls = sm ? "text-[11px]" : "text-[12px] sm:text-[13px]";
  // Abaixo de 360px o padding encolhe (4.ª célula RES): a 320px o badge
  // de 4 células excedia a linha em 25px (topwidgets harness); 360+ passa
  // com px-2, por isso o breakpoint é 360 e não sm. O sm segue a mesma
  // receita (px-1 <360px) desde a 5.ª célula AGR, que tirava 10px às
  // linhas h-10 do CompactPlayerCard a 320px (intervencao harness).
  const cellCls = sm ? "px-1 min-[360px]:px-1.5 py-0.5" : "px-1 min-[360px]:px-2 py-0.5";
  // Tendência semanal: prevSkill só vem preenchido na semana da mudança
  // (o backend limpa-o nas outras). Só o número muda de cor — sem setas.
  const trend =
    prevSkill != null && skill != null && prevSkill !== skill
      ? Math.sign(skill - prevSkill)
      : 0;
  const skillColor =
    trend > 0 ? "text-emerald-400" : trend < 0 ? "text-red-400" : "text-amber-300";
  // Glow só no número — textShadow estático forte (sem keyframes novos
  // para não regressar o briefing em landscape, ver 2262acd986f6).
  // Acompanha a cor do número para não misturar âmbar com verde/vermelho.
  const glowRgb = trend > 0 ? "52,211,153" : trend < 0 ? "248,113,113" : "251,191,36";
  const glowStyle = {
    textShadow: `0 0 10px rgba(${glowRgb},0.9), 0 0 22px rgba(${glowRgb},0.45), 0 0 36px rgba(${glowRgb},0.20)`,
  };
  // Intervenção em vertical: SKILL em último (skillLast) para o número
  // principal ficar encostado à direita. A célula é a mesma peça nos dois
  // casos — só muda o sítio e o lado da borda.
  const skillCell = (
    <div
      className={`flex items-center justify-center bg-amber-400/12 min-w-[3ch] ${!hideStats ? (skillLast ? "border-l border-amber-400/20" : "border-r border-amber-400/20") : ""} ${cellCls}`}
    >
      <span
        className={`font-black font-headline tabular-nums leading-none ${skillColor} ${skillCls}`}
        style={glowStyle}
      >
        {skill ?? "—"}
      </span>
    </div>
  );
  const trendSuffix = trend !== 0 ? ` (desde ${prevSkill})` : "";
  const statsTitle = `Forma ${form ?? "—"} · Moral ${morale ?? "—"} · RES ${resistance ?? "—"} · AGR ${hasAgg ? `${aggNum} ${aggKey}` : "—"}`;
  const skillTitle = `Skill ${skill ?? "—"}${trendSuffix}`;
  const title = skillLast ? `${statsTitle} · ${skillTitle}` : `${skillTitle} · ${statsTitle}`;
  return (
    <div
      title={title}
      className={`flex items-stretch rounded-lg border border-outline-variant/25 overflow-hidden shrink-0 ${className}`}
    >
      {!skillLast && skillCell}
      {!hideStats && (
        <>
          <div className={`flex flex-col items-center justify-center gap-0.5 bg-emerald-500/10 border-r border-emerald-500/20 ${cellCls}`}>
            <span className="text-[7px] uppercase tracking-widest text-emerald-200/70 font-bold leading-none">
              Forma
            </span>
            <span className={`font-black tabular-nums leading-none text-emerald-400 ${numCls}`}>
              {form ?? "–"}
            </span>
          </div>
          <div className={`flex flex-col items-center justify-center gap-0.5 bg-violet-500/10 border-r border-violet-500/20 ${cellCls}`}>
            <span className="text-[7px] uppercase tracking-widest text-violet-200/70 font-bold leading-none">
              Mor
            </span>
            <span className={`font-black tabular-nums leading-none text-violet-400 ${numCls}`}>
              {morale ?? "–"}
            </span>
          </div>
          <div className={`flex flex-col items-center justify-center gap-0.5 bg-sky-500/10 border-r border-sky-500/20 ${cellCls}`}>
            <span className="text-[7px] uppercase tracking-widest text-sky-200/70 font-bold leading-none">
              Res
            </span>
            <span className={`font-black tabular-nums leading-none text-sky-400 ${numCls}`}>
              {resistance ?? "–"}
            </span>
          </div>
          <div className={`flex flex-col items-center justify-center gap-0.5 bg-red-500/10 ${skillLast ? "border-r border-red-500/20" : ""} ${cellCls}`}>
            <span className="text-[7px] uppercase tracking-widest text-red-200/70 font-bold leading-none">
              Agr
            </span>
            <span className={`font-black tabular-nums leading-none ${aggColor} ${numCls}`}>
              {hasAgg ? aggNum : "–"}
            </span>
          </div>
        </>
      )}
      {skillLast && skillCell}
    </div>
  );
}
