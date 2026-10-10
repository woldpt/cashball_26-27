import { memo } from "react";
import { PrepStepper } from "./PrepStepper.jsx";

/**
 * PrepCtaCard — faixa informativa do pré-jogo, por baixo do herói de duelo.
 * Sem botão: o avanço é o "Continuar" do cabeçalho (`usePlayCta`).
 * @returns {JSX.Element}
 */
export const PrepCtaCard = memo(function PrepCtaCard() {
  return (
    <div className="min-w-0 flex flex-wrap items-center gap-x-4 gap-y-1 bg-surface-container border border-outline-variant/25 rounded-2xl px-4 short:px-3 py-2 short:py-1.5">
      <PrepStepper current="briefing" />
      <p className="flex-1 min-w-0 text-[11px] short:text-[10px] font-bold text-gray-400 leading-snug">
        <span className="text-white font-black uppercase tracking-wide">Prepara a estratégia.</span>{" "}
        Carrega em Continuar para ajustar a tática e escalar o onze.
      </p>
    </div>
  );
});
