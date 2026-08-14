import { POSITION_SHORT_LABELS } from "../../../constants/index.js";
import { POSITION_FULL_LABELS } from "../matchConstants.js";

/* ── SVG Pitch ─────────────────────────────────────────────────────────── */
const PITCH_SVG = (
  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 315 560" preserveAspectRatio="none" aria-hidden="true">
    <rect x="10" y="10" width="295" height="540" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" rx="3" />
    <line x1="10" y1="280" x2="305" y2="280" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
    <circle cx="157" cy="280" r="50" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
    <circle cx="157" cy="280" r="3" fill="rgba(255,255,255,0.25)" />
    <rect x="25" y="10" width="265" height="150" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
    <rect x="85" y="10" width="145" height="40" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
    <rect x="25" y="400" width="265" height="150" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
    <rect x="85" y="510" width="145" height="40" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
  </svg>
);

/* ── Row positions ─────────────────────────────────────────────────────── */
const ROW_POSITIONS = { GR: "8%", DEF: "31%", MED: "56%", ATA: "81%" };

/* ── Player marker (on-pitch) ───────────────────────────────────────────
 * Marker internal gap `gap-0.5` → `gap-1` for breathing room between the
 * circle, name, skill sub-elements. Name pill enlarged to allow longer
 * Portuguese surnames to display. */
export function PlayerMarker({ player, posColors, starColor = "amber-400", count = 1 }) {
  const color = posColors?.[player.position] || posColors?.default || "bg-zinc-500 text-white";
  const compact = count >= 4;
  const sizeCls = compact ? "w-7 h-7 text-[10px]" : "w-9 h-9 text-[11px]";
  const nameCls = compact ? "text-[9px]" : "text-[10px]";
  const skillCls = compact ? "text-[9px]" : "text-[10px]";
  return (
    <div className="flex flex-col items-center gap-1 flex-1 min-w-0" style={{ maxWidth: "100px" }}>
      <div
        className={`rounded-full flex items-center justify-center font-bold border border-white/30 shadow-lg ${sizeCls} ${color}`}
        title={POSITION_FULL_LABELS[player.position]}
      >
        {POSITION_SHORT_LABELS[player.position] || "?"}
      </div>
      <div
        className={`bg-black/70 px-1 py-0.5 rounded font-semibold text-white text-center truncate w-full ${nameCls}`}
      >
        {player.name}
        {!!player.is_star && (player.position === "MED" || player.position === "ATA") && (
          <span className={`ml-0.5 ${starColor}`} title="Craque">★</span>
        )}
      </div>
      <span className={`font-semibold text-amber-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] ${skillCls}`}>
        {player.skill ?? "-"}
      </span>
    </div>
  );
}

/* ── Row of players ────────────────────────────────────────────────────── */
export function PlayerRow({ posKey, players, posColors, starColor }) {
  if (!players || players.length === 0) return null;
  return (
    <div
      className="absolute w-full flex justify-evenly items-start px-2"
      style={{ top: ROW_POSITIONS[posKey] || "50%" }}
    >
      {players.map((player) => (
        <PlayerMarker
          key={player.id ?? player.name}
          player={player}
          posColors={posColors}
          starColor={starColor}
          count={players.length}
        />
      ))}
    </div>
  );
}

/* ── Main PitchFormation component ────────────────────────────────────── */
export function PitchFormation({
  rows,
  posColors,
  starColor,
  withOverlay = true,
}) {
  return (
    <div className="relative w-full h-full overflow-hidden">
      {PITCH_SVG}
      {Object.entries(rows).map(([posKey, players]) => (
        <PlayerRow
          key={posKey}
          posKey={posKey}
          players={players}
          posColors={posColors}
          starColor={starColor}
        />
      ))}
      {withOverlay && (
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/40 to-transparent" />
      )}
    </div>
  );
}
