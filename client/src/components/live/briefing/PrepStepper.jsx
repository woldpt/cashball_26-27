import { memo } from "react";

/**
 * Stepper da fase de pré-jogo — "1 Briefing → 2 Tática".
 * @param {{ current?: "briefing"|"tactics" }} props
 * @returns {JSX.Element}
 */
export const PrepStepper = memo(function PrepStepper({ current = "briefing" }) {
  const steps = [
    { key: "briefing", n: 1, label: "Briefing" },
    { key: "tactics", n: 2, label: "Tática" },
  ];
  return (
    <ol className="flex items-center gap-1.5" aria-label="Progresso do pré-jogo">
      {steps.map((s, i) => {
        const active = s.key === current;
        const done =
          steps.findIndex((x) => x.key === current) > i;
        return (
          <li key={s.key} className="flex items-center gap-1.5" aria-current={active ? "step" : undefined}>
            {i > 0 && (
              <span aria-hidden className="text-gray-700 text-[9px] font-black">→</span>
            )}
            <span
              className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest ${
                active ? "text-white" : done ? "text-green-400" : "text-gray-600"
              }`}
            >
              <span
                aria-hidden
                className={`w-4 h-4 rounded-full text-[8px] flex items-center justify-center ${
                  active
                    ? "bg-emerald-500 text-green-950"
                    : done
                      ? "bg-green-500/20 text-green-400"
                      : "bg-surface-bright text-gray-500"
                }`}
              >
                {s.n}
              </span>
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
});
