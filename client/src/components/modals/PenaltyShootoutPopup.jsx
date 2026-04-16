/**
 * @param {{ cupPenaltyPopup: object|null, cupPenaltyKickIdx: number, teams: Array, setCupPenaltyPopup: function, setCupPenaltyKickIdx: function }} props
 */
export function PenaltyShootoutPopup({
  cupPenaltyPopup,
  cupPenaltyKickIdx,
  teams,
  setCupPenaltyPopup,
  setCupPenaltyKickIdx,
}) {
  if (!cupPenaltyPopup) return null;

  const kicks = cupPenaltyPopup.kicks || [];
  const visibleKicks = kicks.slice(0, cupPenaltyKickIdx);
  const allRevealed = cupPenaltyKickIdx >= kicks.length;
  const homeTeam = teams.find((t) => t.id === cupPenaltyPopup.homeTeamId);
  const awayTeam = teams.find((t) => t.id === cupPenaltyPopup.awayTeamId);

  let runningHome = 0;
  let runningAway = 0;
  visibleKicks.forEach((k) => {
    if (k.team === "home" && k.scored) runningHome++;
    if (k.team === "away" && k.scored) runningAway++;
  });

  const rounds = [];
  for (let i = 0; i < kicks.length; i += 2) {
    rounds.push({
      home: kicks[i],
      away: kicks[i + 1] || null,
      roundNum: Math.floor(i / 2) + 1,
    });
  }

  return (
    <div className="fixed inset-0 z-150 bg-zinc-950/92 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg border border-outline-variant/20 bg-surface-container shadow-2xl overflow-hidden">
        <div className="bg-amber-900/20 px-6 py-4 border-b border-amber-800/30 text-center">
          <p className="text-[10px] text-amber-400 uppercase font-black tracking-widest">
            Taça de Portugal
          </p>
          <h2 className="text-lg font-black text-white mt-1">
            Grandes Penalidades
          </h2>
          <div className="flex items-center justify-center gap-4 mt-3">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: homeTeam?.color_primary || "#666" }}
              />
              <span className="font-black text-sm text-white">
                {homeTeam?.name}
              </span>
            </div>
            <span
              className={`text-2xl font-black px-4 py-1 rounded border ${
                allRevealed
                  ? "text-white bg-surface border-outline-variant/30"
                  : "text-zinc-500 bg-surface border-outline-variant/20 animate-pulse"
              }`}
            >
              {allRevealed
                ? `${cupPenaltyPopup.homeGoals} – ${cupPenaltyPopup.awayGoals}`
                : `${runningHome} – ${runningAway}`}
            </span>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm text-white">
                {awayTeam?.name}
              </span>
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: awayTeam?.color_primary || "#666" }}
              />
            </div>
          </div>
        </div>

        <div className="p-4 max-h-80 overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-500 uppercase tracking-wider font-black text-[9px]">
                <th className="text-right pb-2 pr-2 w-1/3">
                  {homeTeam?.name?.slice(0, 10)}
                </th>
                <th className="text-center pb-2 w-8">#</th>
                <th className="text-left pb-2 pl-2 w-1/3">
                  {awayTeam?.name?.slice(0, 10)}
                </th>
              </tr>
            </thead>
            <tbody>
              {rounds.map((round, ri) => {
                const homeVisible = cupPenaltyKickIdx > ri * 2;
                const awayVisible = cupPenaltyKickIdx > ri * 2 + 1;
                const isSuddenDeath = round.home?.suddenDeath;
                return (
                  <tr
                    key={ri}
                    className={`border-t border-zinc-800/50 ${isSuddenDeath ? "bg-amber-900/10" : ""}`}
                  >
                    <td className="text-right pr-2 py-1.5">
                      {homeVisible ? (
                        <span className="inline-flex items-center gap-1.5 justify-end">
                          <span className="text-zinc-400 truncate max-w-25">
                            {round.home.playerName}
                          </span>
                          <span
                            className={`font-black text-sm ${round.home.scored ? "text-emerald-400" : "text-red-400"}`}
                          >
                            {round.home.scored ? "✓" : "✗"}
                          </span>
                        </span>
                      ) : (
                        <span className="text-zinc-700">—</span>
                      )}
                    </td>
                    <td className="text-center py-1.5">
                      <span
                        className={`font-black text-zinc-500 ${isSuddenDeath ? "text-amber-400" : ""}`}
                      >
                        {isSuddenDeath ? "SD" : round.roundNum}
                      </span>
                    </td>
                    <td className="text-left pl-2 py-1.5">
                      {awayVisible && round.away ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className={`font-black text-sm ${round.away.scored ? "text-emerald-400" : "text-red-400"}`}
                          >
                            {round.away.scored ? "✓" : "✗"}
                          </span>
                          <span className="text-zinc-400 truncate max-w-25">
                            {round.away.playerName}
                          </span>
                        </span>
                      ) : (
                        <span className="text-zinc-700">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!allRevealed && (
            <div className="text-center py-3">
              <span className="animate-pulse text-amber-400 text-xs font-black uppercase tracking-widest">
                A rematar…
              </span>
            </div>
          )}
        </div>

        {allRevealed && (
          <div className="px-6 pb-6 pt-2">
            <button
              onClick={() => {
                setCupPenaltyPopup(null);
                setCupPenaltyKickIdx(0);
              }}
              className="w-full rounded-sm bg-primary px-4 py-3 font-black uppercase tracking-widest text-on-primary hover:brightness-110"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
