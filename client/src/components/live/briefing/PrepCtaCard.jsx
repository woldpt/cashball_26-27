import { memo } from "react";
import { PrimaryCTA } from "../../shared/PrimaryCTA.jsx";
import { PrepStepper } from "./PrepStepper.jsx";

/**
 * PrepCtaCard — cartão de ação do pré-jogo (coluna direita): confirma que
 * o briefing está concluído e avança para a fase da tática. Ocupa o topo
 * da terceira coluna, ao lado do herói de duelo. Só desktop (lg+); em
 * mobile a ação vive no `PrepStickyBar`.
 * @param {{ onAdvance?: () => void }} props
 * @returns {JSX.Element}
 */
export const PrepCtaCard = memo(function PrepCtaCard({ onAdvance }) {
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

/**
 * PrepStickyBar — barra de ação fixa no fundo do scroll em mobile/tablet,
 * para avançar sem ter de descer o briefing todo.
 * @param {{ onAdvance?: () => void }} props
 * @returns {JSX.Element}
 */
export const PrepStickyBar = memo(function PrepStickyBar({ onAdvance }) {
  return (
    <div className="lg:hidden sticky bottom-0 z-20 -mx-4 px-4 pt-2 pb-3 flex flex-col gap-2 bg-surface/90 backdrop-blur border-t border-outline-variant/25">
      <PrepStepper current="briefing" />
      <PrimaryCTA onClick={onAdvance}>Avançar para a Tática</PrimaryCTA>
    </div>
  );
});
