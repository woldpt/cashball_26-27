import { useReducer, useEffect, useCallback } from "react";
import { socket } from "../../socket.js";
import { getTeamColor } from "../../utils/teamHelpers.js";
import rawLol from "./LOL.md?raw";
import rawCmtv from "./CMTV.md?raw";
import rawRedcarpet from "./REDCARPET.md?raw";

const parseLines = (raw) =>
  raw
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

const LOL_LINES = parseLines(rawLol);
const CMTV_LINES = parseLines(rawCmtv);
const REDCARPET_LINES = parseLines(rawRedcarpet);

const pickFillerItem = () => {
  const sources = [
    { lines: LOL_LINES, prefix: "" },
    { lines: CMTV_LINES, prefix: "ÚLTIMA HORA: " },
    { lines: REDCARPET_LINES, prefix: "" },
  ];
  const src = sources[Math.floor(Math.random() * sources.length)];
  const line = src.lines[Math.floor(Math.random() * src.lines.length)];
  return {
    id: Date.now() + Math.random(),
    text: src.prefix + line,
    playerId: null,
    playerName: null,
    teamId: null,
  };
};

function tickerReducer(state, action) {
  switch (action.type) {
    case "newNews":
      return { loopKey: state.loopKey + 1, extraItems: [] };
    case "loopEnd":
      return { loopKey: state.loopKey + 1, extraItems: [action.item] };
    default:
      return state;
  }
}

/**
 * @param {{ newsTickerItems: Array }} props
 */
export function NewsTicker({ newsTickerItems }) {
  const [{ loopKey, extraItems }, dispatch] = useReducer(tickerReducer, {
    loopKey: 0,
    extraItems: [],
  });

  useEffect(() => {
    dispatch({ type: "newNews" });
  }, [newsTickerItems]);

  const handleAnimationEnd = useCallback(() => {
    dispatch({ type: "loopEnd", item: pickFillerItem() });
  }, []);

  const allItems = [...newsTickerItems, ...extraItems];

  if (!allItems.length) return null;

  const duration = Math.max(25, allItems.length * 14);

  return (
    <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 z-50 h-8 flex items-stretch bg-zinc-950 border-t border-zinc-700 overflow-hidden">
      <div className="shrink-0 bg-red-600 text-white text-xs font-black px-3 flex items-center uppercase tracking-widest select-none">
        Alerta CM
      </div>
      <div className="overflow-hidden flex-1 relative">
        <style>{`@keyframes tickerScroll { 0% { transform: translateX(100vw); } 100% { transform: translateX(-100%); } }`}</style>
        <div
          key={loopKey}
          className="absolute whitespace-nowrap flex items-center h-full gap-8 text-xs text-zinc-200"
          style={{ animation: `tickerScroll ${duration}s linear` }}
          onAnimationEnd={handleAnimationEnd}
        >
          {allItems.map((item) => {
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
