/**
 * SkillBadge — badge único de skills (STYLE.md §5).
 *
 * Retângulo de cantos arredondados com os três valores sempre pela
 * mesma ordem: SKILL a negrito em dourado + RES + FORMA no semáforo
 * habitual (verde ≥38, amarelo ≥26, vermelho abaixo). O pulse dourado
 * reutiliza `animate-fam-glow` (brilho de familiaridade tática) —
 * sem keyframes novos. Uma só receita para Plantel, Tática,
 * intervenção/substituições e mercado.
 */

const SEMAFORO = (v) =>
  v == null
    ? "text-zinc-500"
    : v >= 38
      ? "text-green-400"
      : v >= 26
        ? "text-yellow-400"
        : "text-red-400";

/**
 * @param {{
 *   skill?: number,
 *   resistance?: number,
 *   form?: number,
 *   delta?: number,
 *   hideResForm?: boolean,
 *   size?: "md"|"sm",
 *   className?: string,
 * }} props
 */
export function SkillBadge({
  skill,
  resistance,
  form,
  delta = 0,
  hideResForm = false,
  size = "md",
  className = "",
}) {
  const sm = size === "sm";
  const skillCls = sm ? "text-[13px]" : "text-[15px]";
  const numCls = sm ? "text-[11px]" : "text-[13px]";
  const cellCls = sm ? "px-1.5 py-0.5" : "px-2 py-0.5";
  return (
    <div
      title={`Skill ${skill ?? "—"} · RES ${resistance ?? "—"} · Forma ${form ?? "—"}`}
      className={`animate-fam-glow flex items-stretch rounded-lg border border-amber-400/30 bg-amber-400/10 overflow-hidden shrink-0 ${className}`}
    >
      <div className={`flex flex-col items-center justify-center gap-0.5 ${cellCls}`}>
        <span className="text-[7px] uppercase tracking-widest text-amber-100/60 font-bold leading-none">
          Skill
        </span>
        <span className="flex items-center gap-1 leading-none">
          {delta !== 0 && (
            <span
              className={`text-[10px] font-black leading-none ${delta > 0 ? "text-emerald-400" : "text-red-400"}`}
            >
              {delta > 0 ? "▲" : "▼"}
            </span>
          )}
          <span
            className={`font-black font-headline tabular-nums leading-none text-amber-300 ${skillCls}`}
            style={{ textShadow: "0 0 10px rgba(251,191,36,0.45)" }}
          >
            {skill ?? "—"}
          </span>
        </span>
      </div>
      {!hideResForm && (
        <>
          <div className="w-px self-stretch bg-amber-400/20" />
          <div className={`flex flex-col items-center justify-center gap-0.5 ${cellCls}`}>
            <span className="text-[7px] uppercase tracking-widest text-amber-100/60 font-bold leading-none">
              Res
            </span>
            <span className={`font-black tabular-nums leading-none ${numCls} ${SEMAFORO(resistance)}`}>
              {resistance ?? "–"}
            </span>
          </div>
          <div className="w-px self-stretch bg-amber-400/20" />
          <div className={`flex flex-col items-center justify-center gap-0.5 ${cellCls}`}>
            <span className="text-[7px] uppercase tracking-widest text-amber-100/60 font-bold leading-none">
              Forma
            </span>
            <span className={`font-black tabular-nums leading-none ${numCls} ${SEMAFORO(form)}`}>
              {form ?? "–"}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
