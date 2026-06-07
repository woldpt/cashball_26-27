import { getEffectiveLineup } from "../../../utils/playerHelpers.js";
import { POSITION_SHORT_LABELS } from "../../../constants/index.js";
import { PlayerLink } from "../../shared/PlayerLink.jsx";
import { getPosStyle } from "../matchConstants.js";

const POS_ORDER = { GR: 0, DEF: 1, MED: 2, ATA: 3 };

/* ── TabLineup — Home vs Away lineups ───────────────────────────────────── */
export function TabLineup({ fixture, liveMinute, teams }) {
  if (!fixture?.homeLineup || !fixture?.awayLineup) return null;
  const hInfo = teams.find((t) => t.id === fixture.homeTeamId);
  const aInfo = teams.find((t) => t.id === fixture.awayTeamId);
  const evts = fixture.events || [];
  const homeLineup = getEffectiveLineup(fixture.homeLineup, evts, liveMinute, "home");
  const awayLineup = getEffectiveLineup(fixture.awayLineup, evts, liveMinute, "away");

  const renderPlayer = (p, opts = {}) => {
    const { isOff = false, offReason = null } = opts;
    const label = isOff
      ? offReason === "red" ? "🟥" : offReason === "injury" ? "🚑" : "🔄"
      : p.goals > 0 ? Array(p.goals).fill("⚽").join("") : "";

    return (
      <div
        key={p.id ?? p.name}
        className={`flex items-center gap-2 py-1.5 px-2 rounded-md transition-colors ${isOff ? "opacity-40" : "hover:bg-surface-container/60"}`}
      >
        <span
          className={`shrink-0 px-1.5 py-px rounded text-[9px] font-black uppercase tracking-widest border ${isOff ? "border-outline-variant/15 bg-surface-container/20 text-on-surface-variant/40" : getPosStyle(p.position).badgeBg + " " + getPosStyle(p.position).badgeText + " " + getPosStyle(p.position).badgeBorder}`}
        >
          {isOff ? "" : POSITION_SHORT_LABELS[p.position] || "?"}
        </span>
        <span className={`flex-1 truncate text-xs font-black ${isOff ? "text-on-surface-variant/60 line-through" : "text-on-surface"}`}>
          <PlayerLink playerId={p.id}>{p.name}</PlayerLink>
          {!!p.is_star && (p.position === "MED" || p.position === "ATA") && (
            <span className="ml-0.5 text-amber-400 font-black">*</span>
          )}
        </span>
        {!isOff && p.skill != null && (
          <span className="text-[10px] font-black tabular-nums text-on-surface-variant/80 shrink-0 w-5 text-right">
            {p.skill}
          </span>
        )}
        {label && <span className="text-[10px] shrink-0">{label}</span>}
      </div>
    );
  };

  const sortedLineup = (arr) =>
    [...arr].sort((a, b) => (POS_ORDER[a.position] ?? 9) - (POS_ORDER[b.position] ?? 9));

  return (
    <div className="flex gap-3 flex-1 overflow-hidden min-h-0 w-full p-3">
      {[
        { info: hInfo, lineup: homeLineup, side: "home" },
        { info: aInfo, lineup: awayLineup, side: "away" },
      ].map(({ info, lineup }, idx) => {
        const accent = info?.color_primary || "#6366f1";
        return (
          <div key={idx} className="flex-1 flex flex-col min-w-0 overflow-y-auto rounded-lg border border-outline/40 bg-surface-container shadow-sm">
            <div className="px-5 py-4 border-b border-outline/40 shrink-0 flex items-center gap-2 bg-surface-container-high/50 rounded-t-lg">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: accent, boxShadow: `0 0 8px ${accent}60` }} />
              <h2 className="text-base font-black font-headline tracking-tight text-tertiary uppercase truncate" style={{ color: accent }}>
                {info?.name || "—"}
              </h2>
            </div>

            <div className="px-2 py-1">
              {sortedLineup(lineup.active).map((p) => renderPlayer(p))}
            </div>

            {lineup.offPlayers.length > 0 && (
              <>
                <div className="mx-2 my-1.5 border-t border-outline-variant/25" />
                <div className="px-2 py-1">
                  {lineup.offPlayers.map((p) => renderPlayer(p, { isOff: true, offReason: p.reason }))}
                </div>
              </>
            )}

            {lineup.subPlayers.length > 0 && (
              <>
                <div className="mx-2 my-1.5 border-t border-outline-variant/25" />
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 px-3 py-1">Entrou</p>
                <div className="px-2 pb-2">
                  {lineup.subPlayers.map((p) => (
                    <div key={p.id ?? p.name} className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-surface-container/60 transition-colors">
                      <span className="w-5 text-[9px] font-black text-emerald-400 shrink-0 flex items-center justify-center">↑</span>
                      <span className="flex-1 truncate text-xs font-black text-on-surface-variant">
                        <PlayerLink playerId={p.id}>{p.name}</PlayerLink>
                      </span>
                      {p.goals > 0 && <span className="text-[10px] shrink-0">{Array(p.goals).fill("⚽").join("")}</span>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
