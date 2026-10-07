import { memo } from "react";
import { PrepStepper } from "./PrepStepper.jsx";

/**
 * PrepCtaCard — cartão informativo do pré-jogo (coluna direita), ao lado do
 * herói de duelo. Só desktop (lg+). Sem botão: o avanço é o "Continuar" do
 * cabeçalho (`usePlayCta`).
 * @returns {JSX.Element}
 */
export const PrepCtaCard = memo(function PrepCtaCard() {
  return (
    <div className="hidden lg:flex min-w-0 h-full flex-col bg-surface-container border border-outline-variant/25 rounded-2xl overflow-hidden">
      <div className="flex items-center px-4 short:px-3 py-2 short:py-1 border-b border-outline-variant/15">
        <PrepStepper current="briefing" />
      </div>
      <div className="flex-1 px-4 short:px-3 py-3 short:py-2 lg:py-4 flex flex-col justify-center gap-2">
        <p className="text-base lg:text-lg font-headline font-black uppercase tracking-tight text-white leading-tight">
          Prepara a estratégia
        </p>
        <p className="text-[11px] short:text-[10px] font-bold text-gray-400 leading-snug">
          O relatório está pronto. Carrega em Continuar para ajustar a tática e escalar o onze.
        </p>
      </div>
    </div>
  );
});
