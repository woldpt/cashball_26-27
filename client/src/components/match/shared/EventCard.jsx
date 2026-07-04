import { PlayerLink } from "../../shared/PlayerLink.jsx";
import { MatchIcon } from "./MatchIcon.jsx";
import { getEventIconStyle } from "../matchConstants.js";

/* ── Event card ─────────────────────────────────────────────────────────
 * Passive display card. No hover elevation (only the embedded PlayerLink is
 * interactive). Icons are rendered as inline SVGs via MatchIcon, replacing
 * the old emoji chain (⚽, ⚽🔙, 🟨, 🟥, 🤕, 🔄). */
export function EventCard({ event, accent, showTeamBadge, showIcon = true, teamName }) {
  const iconStyle = getEventIconStyle(event.type);
  // Custom events can still ship their own emoji via `event.emoji`.
  const customEmoji = event.emoji && !iconStyle ? event.emoji : null;
  const name =
    event.playerName || event.player_name || "";
  // Intro / narrative events (weather, betting, phase_start, etc.) carry
  // their copy in event.text rather than a playerName slot. Strip the
  // leading "[NN']" or "[HT]" prefix so the minute badge isn't duplicated.
  const narrativeText = !name && event.text
    ? event.text.replace(/^\[(?:\d+'|HT)\]\s*/, "").trim()
    : null;

  return (
    <div className="relative group flex items-stretch rounded-md overflow-hidden border border-outline-variant/25 bg-surface-container/50 shadow-sm shadow-black/30">
      {accent && (
        <div className="shrink-0 w-1" style={{ background: `linear-gradient(to bottom, ${accent}99, ${accent})` }} />
      )}
      <div className="flex items-center gap-2.5 flex-1 px-3 py-2">
        <span className="text-on-surface-variant/80 font-bold min-w-[2ch] shrink-0 text-right tabular-nums text-xs">
          {event.minute != null ? `${event.minute}'` : "—"}
        </span>
        {showIcon && (
          <span className="w-5 h-5 shrink-0 flex items-center justify-center">
            {iconStyle ? (
              <MatchIcon name={iconStyle.icon} className={`h-4 w-4 ${iconStyle.color}`} />
            ) : customEmoji ? (
              <span className="text-sm">{customEmoji}</span>
            ) : null}
          </span>
        )}
        <span className="flex-1 truncate text-xs font-semibold text-on-surface">
          {name ? (
            <PlayerLink playerId={event.playerId}>
              {name}
            </PlayerLink>
          ) : (
            narrativeText || ""
          )}
        </span>
        {showTeamBadge && accent && (
          <span
            className="text-[10px] font-bold uppercase tracking-widest shrink-0 px-2 py-0.5 rounded"
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
