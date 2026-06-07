import { PlayerLink } from "../../shared/PlayerLink.jsx";

/* ── Event icon mapping (internal) ──────────────────────────────────── */
function getEventIcon(e) {
  return (
    e.emoji ||
    (e.type === "goal" || e.type === "penalty_goal"
      ? "⚽"
      : e.type === "own_goal"
        ? "⚽🔙"
        : e.type === "yellow"
          ? "🟨"
          : e.type === "red"
            ? "🟥"
            : e.type === "injury"
              ? "🤕"
              : e.type === "substitution"
                ? "🔄"
                : "")
  );
}

/* ── Event card ───────────────────────────────────────────────────────── */
export function EventCard({ event, accent, showTeamBadge, showIcon = true }) {
  const isHome = event.team === "home";
  const teamName = event.teamName || (isHome ? event.homeTeam : event.awayTeam);
  const icon = getEventIcon(event);
  const name = event.playerName || event.player_name || "";

  return (
    <div
      className="relative group flex items-stretch rounded-md overflow-hidden border border-outline-variant/25 bg-surface-container/50 transition-all duration-200 hover:-translate-y-px hover:shadow-lg shadow-sm shadow-black/30"
    >
      {accent && (
        <div className="shrink-0 w-1" style={{ background: `linear-gradient(to bottom, ${accent}99, ${accent})` }} />
      )}
      <div className="flex items-center gap-2.5 flex-1 px-3 py-2">
        <span className="text-on-surface-variant/80 font-black w-8 shrink-0 text-right tabular-nums text-[11px]">
          {event.minute != null ? `${event.minute}'` : "—"}
        </span>
        {showIcon && <span className="w-5 shrink-0 text-center text-sm">{icon}</span>}
        <span className="flex-1 truncate text-xs font-black text-on-surface">
          <PlayerLink playerId={event.playerId}>
            {name}
          </PlayerLink>
        </span>
        {showTeamBadge && accent && (
          <span
            className="text-[9px] font-black uppercase tracking-widest shrink-0 px-1.5 py-px rounded"
            style={{
              color: accent,
              borderColor: `${accent}30`,
              background: `${accent}20`,
              borderWidth: "1px",
              borderStyle: "solid",
            }}
          >
            {teamName || ""}
          </span>
        )}
      </div>
    </div>
  );
}
