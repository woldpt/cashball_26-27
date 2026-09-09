import { memo } from "react";
import { THREAT_ROLE_META } from "../../match/matchConstants.js";

/**
 * Valor da ameaça em chip âmbar para leitura rápida.
 * @param {{ threat: { role: string, skill: number|null, form: number|null, goals: number|null } }} props
 * @returns {JSX.Element}
 */
const ThreatValue = memo(function ThreatValue({ threat }) {
  const value =
    threat.role === "goleador"
      ? `${threat.goals} ${threat.goals === 1 ? "golo" : "golos"}`
      : threat.role === "forma"
        ? `Forma ${threat.form ?? "—"}`
        : `Skill ${threat.skill ?? "—"}`;
  return (
    <span className="shrink-0 text-[9px] font-black tabular-nums text-amber-400 bg-amber-500/10 rounded-md px-1.5 py-0.5">
      {value}
    </span>
  );
});

/**
 * Ameaças do adversário — grelha com os jogadores-perigo.
 * @param {{ threats?: Array<{ role: string, name: string, skill: number|null, form: number|null, goals: number|null }> }} props
 * @returns {JSX.Element|null}
 */
export const ThreatGrid = memo(function ThreatGrid({ threats }) {
  if (!threats || threats.length === 0) return null;
  return (
    <div className="min-w-0 bg-surface-container border border-outline-variant/25 rounded-2xl overflow-hidden lg:flex-none lg:flex lg:flex-col">
      <div className="px-4 short:px-3 py-1.5 short:py-1 border-b border-outline-variant/15">
        <span className="text-[9px] uppercase tracking-widest text-gray-600 font-black">
          <span aria-hidden>⚠️</span> Ameaças do adversário
        </span>
      </div>
      <div className="px-3 short:px-2 py-2 short:py-1.5 flex flex-col gap-1.5 short:gap-1">
        {threats.map((t, i) => {
          const meta = THREAT_ROLE_META[t.role] ?? { icon: "❗", label: t.role };
          return (
            <div
              key={t.role ?? `threat-${i}`}
              className="min-w-0 bg-surface-container-low/60 border border-outline-variant/25 rounded-xl px-2.5 py-2 flex items-center gap-2"
            >
              <span className="shrink-0 text-[8px] uppercase tracking-widest text-gray-600 font-black">
                <span aria-hidden>{meta.icon}</span> {meta.label}
              </span>
              <span className="flex-1 min-w-0 text-[11px] font-black text-white break-words">
                {t.name}
              </span>
              <ThreatValue threat={t} />
            </div>
          );
        })}
      </div>
    </div>
  );
});
