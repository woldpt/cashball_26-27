import { memo } from "react";
import { PrimaryCTA } from "../../shared/PrimaryCTA.jsx";
import { PrepStepper } from "./PrepStepper.jsx";

/**
 * PrepCtaCard — cartão de ação do pré-jogo (coluna direita): confirma que
 * o briefing está concluído e avança para a fase da tática. Ocupa o topo
 * da terceira coluna, ao lado do herói de duelo.
 * @param {{ onAdvance?: () => void }} props
 * @returns {JSX.Element}
 */
export const PrepCtaCard = memo(function PrepCtaCard({ onAdvance }) {
  return (
    <div className="min-w-0 h-full flex flex-col bg-surface-container border border-outline-variant/25 rounded-2xl overflow-hidden">
      <div className="flex items-center px-4 short:px-3 py-2 short:py-1 border-b border-outline-variant/15">
        <PrepStepper current="briefing" />
      </div>
      <div className="flex-1 px-4 short:px-3 py-3 short:py-2 lg:py-4 flex flex-col justify-center gap-2">
        <p className="text-base lg:text-lg font-headline font-black uppercase tracking-tight text-white leading-tight">
          Prepara a estratégia
        </p>
        <p className="text-[11px] short:text-[10px] font-bold text-gray-400 leading-snug">
          O relatório está pronto. Ajusta a tática e escala o onze para a partida.
        </p>
        <div className="mt-1 flex flex-col items-stretch gap-1">
          <PrimaryCTA onClick={onAdvance}>Avançar para a Tática</PrimaryCTA>
          <span className="text-center text-[9px] text-gray-600 font-bold">
            Podes voltar atrás a qualquer momento
          </span>
        </div>
      </div>
    </div>
  );
});
