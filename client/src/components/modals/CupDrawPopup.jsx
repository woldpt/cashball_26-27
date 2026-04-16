import { socket } from "../../socket.js";

/**
 * @param {{ cupDraw: object|null, cupDrawRevealIdx: number, me: object, showCupDrawPopup: boolean, setShowCupDrawPopup: function }} props
 */
export function CupDrawPopup({
  cupDraw,
  cupDrawRevealIdx,
  me,
  showCupDrawPopup,
  setShowCupDrawPopup,
}) {
  if (!showCupDrawPopup || !cupDraw) return null;

  return (
    <div className="fixed inset-0 z-140 bg-zinc-950/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-lg border border-primary/30 bg-surface-container shadow-2xl overflow-hidden">
        <div className="bg-linear-to-r from-amber-900/40 to-zinc-900 px-6 py-4 border-b border-amber-700/30">
          <p className="text-xs text-amber-400 uppercase font-black tracking-widest mb-1">
            Taça de Portugal · Temporada {cupDraw.season}
          </p>
          <h2 className="text-2xl font-black text-white">
            Sorteio — {cupDraw.roundName}
          </h2>
        </div>

        <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
          {(cupDraw.fixtures || []).map((fixture, pairIdx) => {
            const homeIdx = pairIdx * 2;
            const awayIdx = pairIdx * 2 + 1;
            const homeRevealed = cupDrawRevealIdx > homeIdx;
            const awayRevealed = cupDrawRevealIdx > awayIdx;
            const isMyPair =
              awayRevealed &&
              (fixture.homeTeam?.id === me?.teamId ||
                fixture.awayTeam?.id === me?.teamId);

            return (
              <div
                key={pairIdx}
                className={`flex items-center gap-3 rounded-xl border px-4 py-2 transition-all ${
                  isMyPair
                    ? "border-primary bg-primary/10"
                    : "border-outline-variant/20 bg-surface"
                }`}
              >
                <div
                  className={`flex-1 text-right font-black text-sm transition-all duration-300 ${
                    homeRevealed
                      ? "opacity-100 translate-x-0"
                      : "opacity-0 translate-x-4"
                  }`}
                  style={{
                    color: homeRevealed
                      ? fixture.homeTeam?.color_primary || "#fff"
                      : "transparent",
                  }}
                >
                  {homeRevealed ? fixture.homeTeam?.name || "?" : "···"}
                </div>
                <div className="text-zinc-600 font-black text-xs shrink-0">
                  vs
                </div>
                <div
                  className={`flex-1 text-left font-black text-sm transition-all duration-300 ${
                    awayRevealed
                      ? "opacity-100 translate-x-0"
                      : "opacity-0 -translate-x-4"
                  }`}
                  style={{
                    color: awayRevealed
                      ? fixture.awayTeam?.color_primary || "#fff"
                      : "transparent",
                  }}
                >
                  {awayRevealed ? fixture.awayTeam?.name || "?" : "···"}
                </div>
              </div>
            );
          })}

          {cupDrawRevealIdx < (cupDraw.fixtures || []).length * 2 && (
            <div className="text-center py-2">
              <span className="animate-pulse text-amber-400 text-xs font-black uppercase tracking-widest">
                A sortear…
              </span>
            </div>
          )}
        </div>

        {cupDraw.humanInCup &&
          cupDrawRevealIdx >= (cupDraw.fixtures || []).length * 2 && (
            <div className="px-6 pb-6">
              <button
                onClick={() => {
                  setShowCupDrawPopup(false);
                  socket.emit("cupDrawAcknowledged");
                }}
                className="w-full rounded-sm bg-primary px-4 py-3 font-black uppercase tracking-widest text-on-primary hover:brightness-110"
              >
                Continuar
              </button>
            </div>
          )}
      </div>
    </div>
  );
}
