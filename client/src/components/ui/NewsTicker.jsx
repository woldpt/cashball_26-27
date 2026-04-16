import { socket } from "../../socket.js";
import { getTeamColor } from "../../utils/teamHelpers.js";

/**
 * @param {{ newsTickerItems: Array }} props
 */
export function NewsTicker({ newsTickerItems }) {
  if (!newsTickerItems.length) return null;

  return (
    <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 z-50 h-8 flex items-stretch bg-zinc-950 border-t border-zinc-700 overflow-hidden">
      <div className="shrink-0 bg-red-600 text-white text-xs font-black px-3 flex items-center uppercase tracking-widest select-none">
        Notícias
      </div>
      <div className="overflow-hidden flex-1 relative">
        <style>{`@keyframes tickerScroll { 0% { transform: translateX(100vw); } 100% { transform: translateX(-100%); } }`}</style>
        <div
          key={newsTickerItems.length}
          className="absolute whitespace-nowrap flex items-center h-full gap-8 text-xs text-zinc-200"
          style={{
            animation: `tickerScroll ${Math.max(15, newsTickerItems.length * 8)}s linear`,
          }}
        >
          {newsTickerItems.map((item) => {
            const dotColor = getTeamColor(item.teamId);
            if (!item.playerId || !item.playerName) {
              return (
                <span key={item.id}>
                  <span className="mr-2" style={{ color: dotColor }}>
                    ◆
                  </span>
                  {item.text}
                </span>
              );
            }
            const parts = item.text.split(item.playerName);
            return (
              <span key={item.id}>
                <span className="mr-2" style={{ color: dotColor }}>
                  ◆
                </span>
                {parts[0]}
                <button
                  type="button"
                  className="text-amber-400 hover:text-amber-300 underline underline-offset-2 cursor-pointer font-semibold"
                  onClick={() =>
                    socket.emit("requestPlayerHistory", {
                      playerId: item.playerId,
                    })
                  }
                >
                  {item.playerName}
                </button>
                {parts.slice(1).join(item.playerName)}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
