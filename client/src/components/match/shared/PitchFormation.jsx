import { POSITION_SHORT_LABELS } from "../../../constants/index.js";

/* ── SVG Pitch ─────────────────────────────────────────────────────────── */
const PITCH_SVG = (
  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 315 560" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
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

/* ── Player marker (on-pitch) ─────────────────────────────────────────── */
export function PlayerMarker({ player, posColors, starColor = "amber-400" }) {
  const color = posColors?.[player.position] || posColors?.default || "bg-zinc-500 text-white";
  return (
    <div className="flex flex-col items-center gap-0.5" style={{ maxWidth: "90px" }}>
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-[10px] border border-white/30 shadow-lg ${color}`}
      >
        {POSITION_SHORT_LABELS[player.position] || "?"}
      </div>
      <div
        className="bg-black/70 px-1.5 py-0.5 rounded text-[9px] font-black text-white text-center truncate"
        style={{ maxWidth: "85px" }}
      >
        {player.name}
        {!!player.is_star && (player.position === "MED" || player.position === "ATA") && (
          <span className={`ml-0.5 ${starColor}`}>*</span>
        )}
      </div>
      <span className="text-[9px] font-black text-amber-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
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
      className="absolute w-full flex justify-evenly items-start px-3"
      style={{ top: ROW_POSITIONS[posKey] || "50%" }}
    >
      {players.map((player) => (
        <PlayerMarker
          key={player.id ?? player.name}
          player={player}
          posColors={posColors}
          starColor={starColor}
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
