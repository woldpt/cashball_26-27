import { AGG_TIERS } from "../../constants/index.js";
import { aggLabel } from "../../utils/playerHelpers.js";

/**
 * BadgeSkills — badge único de skills (STYLE.md §10).
 *
 * Retângulo de cantos arredondados com os valores sempre
 * pela mesma ordem: SKILL dourado (maior, negrito, glow só no número)
 * | FOR verde | MOR violeta | RES azul | AGR vermelha (número na cor
 * do tier, etiqueta só no tooltip; escondida com hideStats). Uma só
 * receita para Plantel, Tática, intervenção/substituições e mercado.
 * Exceção: `skillLast` (Intervenção em vertical) mostra só
 * FOR · MOR · SKILL, com o SKILL em último.
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
 *   resWarning?: string,
 *   form?: number,
 *   morale?: number,
 *   aggressiveness?: number|string,
 *   prevSkill?: number|null,
 *   skillLast?: boolean,
 *   hideStats?: boolean,
 *   size?: "md"|"sm"|"lg",
 *   className?: string,
 * }} props
 */
export function BadgeSkills({
  skill,
  resistance,
  resWarning,
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
  const lg = size === "lg";
  // AGR: número 10–50 pintado com a cor do tier; etiqueta só no tooltip.
  // Visível em todas as larguras (inclusive mobile); escondida com hideStats.
  const hasAgg = aggressiveness != null;
  const aggKey = hasAgg ? aggLabel(aggressiveness) : null;
  const aggColor = (aggKey && AGG_TIERS[aggKey]?.color) || "text-zinc-400";
  const aggNum =
    typeof aggressiveness === "number"
      ? Math.max(1, Math.min(50, Math.round(aggressiveness)))
      : "–";
  const skillCls = sm ? "text-[15px]" : lg ? "text-[24px] sm:text-[26px]" : "text-[18px] sm:text-[19px]";
  const numCls = sm ? "text-[11px]" : lg ? "text-[15px] sm:text-base" : "text-[12px] sm:text-[13px]";
  const labelCls = lg
    ? "text-[8px] uppercase tracking-widest font-bold leading-none"
    : "text-[7px] uppercase tracking-widest font-bold leading-none";
  // Abaixo de 360px o padding encolhe (4.ª célula RES): a 320px o badge
  // de 4 células excedia a linha em 25px (topwidgets harness); 360+ passa
  // com px-2, por isso o breakpoint é 360 e não sm. O sm segue a mesma
  // receita (px-1 <360px) desde a 5.ª célula AGR, que tirava 10px às
  // linhas h-10 do CompactPlayerCard a 320px (intervencao harness).
  const cellCls = lg ? "px-3 min-[360px]:px-3.5 py-1.5" : sm ? "px-1 min-[360px]:px-1.5 py-0.5" : "px-1 min-[360px]:px-2 py-0.5";
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
    textShadow: lg
      ? `0 0 12px rgba(${glowRgb},0.9), 0 0 28px rgba(${glowRgb},0.45), 0 0 48px rgba(${glowRgb},0.20)`
      : `0 0 10px rgba(${glowRgb},0.9), 0 0 22px rgba(${glowRgb},0.45), 0 0 36px rgba(${glowRgb},0.20)`,
  };
  // Herói dourado (só lg, i.e. modal): célula SKILL com mais presença.
  const skillBg = lg ? "bg-amber-400/20" : "bg-amber-400/12";
  const skillBorder = lg ? "border-amber-400/30" : "border-amber-400/20";
  // Intervenção em vertical: só FORMA · MOR · SKILL (skillLast), com o
  // número principal encostado à direita. A célula SKILL é a mesma peça
  // nos dois casos — só muda o sítio e o lado da borda.
  const skillCell = (
    <div
      className={`flex items-center justify-center ${skillBg} min-w-[3ch] ${!hideStats ? (skillLast ? `border-l ${skillBorder}` : `border-r ${skillBorder}`) : ""} ${cellCls}`}
    >
      <span
        className={`inline-block w-[2ch] text-center font-black font-headline tabular-nums leading-none ${skillColor} ${skillCls}`}
        style={glowStyle}
      >
        {skill ?? "—"}
      </span>
    </div>
  );
  const trendSuffix = trend !== 0 ? ` (desde ${prevSkill})` : "";
  const statsTitle = skillLast
    ? `Forma ${form ?? "—"} · Moral ${morale ?? "—"}`
    : `Forma ${form ?? "—"} · Moral ${morale ?? "—"} · RES ${resistance ?? "—"} · AGR ${hasAgg ? `${aggNum} ${aggKey}` : "—"}`;
  const skillTitle = `Skill ${skill ?? "—"}${trendSuffix}`;
  const title = skillLast ? `${statsTitle} · ${skillTitle}` : `${skillTitle} · ${statsTitle}`;
  return (
    <div
      data-tour="player-skills"
      title={title}
      className={`flex items-stretch rounded-lg border border-outline-variant/25 overflow-hidden shrink-0 ${className}`}
    >
      {!skillLast && skillCell}
      {!hideStats && (
        <>
          <div className={`flex flex-col items-center justify-center gap-0.5 bg-emerald-500/10 border-r border-emerald-500/20 ${cellCls}`}>
            <span className={`${labelCls} text-emerald-200/70`}>
              For
            </span>
            <span className={`font-black tabular-nums leading-none text-emerald-400 ${numCls}`}>
              {form ?? "–"}
            </span>
          </div>
          <div className={`flex flex-col items-center justify-center gap-0.5 bg-violet-500/10 border-r border-violet-500/20 ${cellCls}`}>
            <span className={`${labelCls} text-violet-200/70`}>
              {lg ? "Moral" : "Mor"}
            </span>
            <span className={`font-black tabular-nums leading-none text-violet-400 ${numCls}`}>
              {morale ?? "–"}
            </span>
          </div>
          {!skillLast && (
          <div
            title={resWarning}
            className={`relative flex flex-col items-center justify-center gap-0.5 bg-sky-500/10 border-r border-sky-500/20 ${cellCls}`}
          >
            {resWarning && (
              <span className="absolute top-0 right-0 flex items-center justify-center w-2.5 h-2.5 rounded-full bg-amber-500 text-[7px] font-black leading-none text-black">
                !
              </span>
            )}
            <span className={`${labelCls} text-sky-200/70`}>
              Res
            </span>
            <span className={`font-black tabular-nums leading-none text-sky-400 ${numCls}`}>
              {resistance ?? "–"}
            </span>
          </div>
          )}
          {!skillLast && (
          <div className={`flex flex-col items-center justify-center gap-0.5 bg-red-500/10 ${cellCls}`}>
            <span className={`${labelCls} text-red-200/70`}>
              Agr
            </span>
            <span className={`font-black tabular-nums leading-none ${aggColor} ${numCls}`}>
              {hasAgg ? aggNum : "–"}
            </span>
          </div>
          )}
        </>
      )}
      {skillLast && skillCell}
    </div>
  );
}
