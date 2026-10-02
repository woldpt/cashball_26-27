import { useGame } from "../../contexts/GameContext.jsx";

/**
 * Notícias CM — rodapé breaking-news (estilo CNN): etiqueta vermelha fixa +
 * notícias da sala em scroll infinito. Alimentado pelas `systemMessage` com
 * `cm: true` (fim de época/prémios, treinadores/equipas). Sem filler: sem
 * notícias, sem barra. Escondido em direto; no telemóvel vive por cima
 * da MobileNav.
 *
 * @param {{ hidden?: boolean, sidebarCollapsed?: boolean }} props
 */
export function CmTicker({ hidden = false, sidebarCollapsed = false }) {
  const { cmNews } = useGame();
  const items = cmNews || [];

  if (hidden || items.length === 0) return null;

  // Conteúdo duplicado + translateX(-50%): o loop `infinite` fica contínuo.
  const doubled = [...items, ...items];
  // ~15 s por notícia; mínimo 40 s para listas curtas andarem devagar.
  const duration = Math.max(40, items.length * 15);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-16 lg:bottom-0 right-0 z-30 h-8 flex items-stretch bg-black border-t border-red-900/60 overflow-hidden left-0 ${sidebarCollapsed ? "lg:left-14" : "lg:left-64"}`}
    >
      <div className="shrink-0 bg-red-600 text-white text-xs font-black px-3 flex items-center uppercase tracking-widest select-none">
        Notícias CM
      </div>
      <div className="overflow-hidden flex-1 relative">
        <style>{`
          @keyframes cmTickerScroll {
            0%   { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
        `}</style>
        <div
          key={items.length}
          className="absolute whitespace-nowrap flex items-center h-full text-[10px] text-zinc-200"
          style={{
            gap: "5rem",
            animation: `cmTickerScroll ${duration}s linear infinite`,
          }}
        >
          {doubled.map((item, idx) => (
            <span key={`${item.id}-${idx}`} className="shrink-0">
              <span className="mr-2 text-red-500">◆</span>
              {item.text}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
