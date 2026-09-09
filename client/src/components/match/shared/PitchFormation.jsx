import { memo, useMemo } from "react";
import { POSITION_SHORT_LABELS, POSITION_ACCENT_HEX } from "../../../constants/index.js";
import { POSITION_FULL_LABELS, filterMatchEvents } from "../matchConstants.js";
import { PlayerAvatar } from "../../shared/PlayerAvatar.jsx";
import { FatigueIndicator } from "./FatigueIndicator.jsx";

/* ── Relvado broadcast ───────────────────────────────────────────────────
 * Faixas de corte (mowing stripes) + foco de luz no topo + vinheta nas
 * bordas para aspeto de transmissão TV. Centralizado aqui para que todos
 * os usos (jogo próprio, spectate, pré-jogo) partilhem o mesmo visual. */
const TURF_BACKGROUND = [
  "radial-gradient(ellipse 90% 45% at 50% 0%, rgba(255,255,255,0.09) 0%, transparent 60%)",
  "repeating-linear-gradient(180deg, rgba(255,255,255,0.045) 0px, rgba(255,255,255,0.045) 40px, transparent 40px, transparent 80px)",
  "linear-gradient(180deg, #0a5a16 0%, #0d6b1d 45%, #0a5a16 100%)",
].join(", ");

/* ── Linhas do relvado (SVG nítido, estilo broadcast) ──────────────────── */
const PITCH_SVG = (
  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 315 560" preserveAspectRatio="none" aria-hidden="true">
    <rect x="10" y="10" width="295" height="540" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" rx="3" />
    <line x1="10" y1="280" x2="305" y2="280" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
    <circle cx="157" cy="280" r="50" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1" />
    <circle cx="157" cy="280" r="3.5" fill="rgba(255,255,255,0.45)" />
    <rect x="25" y="10" width="265" height="150" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1" />
    <rect x="85" y="10" width="145" height="40" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
    <circle cx="157" cy="115" r="2.5" fill="rgba(255,255,255,0.35)" />
    <rect x="25" y="400" width="265" height="150" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1" />
    <rect x="85" y="510" width="145" height="40" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
    <circle cx="157" cy="445" r="2.5" fill="rgba(255,255,255,0.35)" />
  </svg>
);

/* ── Posições das linhas ───────────────────────────────────────────────── */
const ROW_POSITIONS = { GR: "7%", DEF: "30%", MED: "55%", ATA: "80%" };

/**
 * Estatísticas por jogador a partir dos eventos visíveis (golos, cartões).
 * @param {Array} events - Eventos do jogo (fixture.events).
 * @param {number} liveMinute - Minuto atual da Live.
 * @returns {Map<number, { goals: number, yellow: boolean, red: boolean }>}
 */
function usePlayerBadges(events, liveMinute) {
  return useMemo(() => {
    const stats = new Map();
    if (!Array.isArray(events)) return stats;
    const visible = liveMinute == null ? events : filterMatchEvents(events, liveMinute);
    for (const e of visible) {
      if (e?.playerId == null) continue;
      const key = Number(e.playerId);
      if (!stats.has(key)) stats.set(key, { goals: 0, yellow: false, red: false });
      const s = stats.get(key);
      if (e.type === "goal" || e.type === "penalty_goal") s.goals += 1;
      else if (e.type === "yellow") s.yellow = true;
      else if (e.type === "red") s.red = true;
    }
    return stats;
  }, [events, liveMinute]);
}

/* ── Marcador de jogador (em campo) ──────────────────────────────────────
 * Cara do jogador (PlayerAvatar) com anel na cor da posição, placard com
 * nome + skill e badges de eventos da Live (golos, cartões). */
/** player, teamColor, badges {goals,yellow,red}|undefined, starColor, count, showFatigue. */
export const PlayerMarker = memo(function PlayerMarker({ player, teamColor, badges, starColor = "amber-400", count = 1, showFatigue = true }) {
  const accent = POSITION_ACCENT_HEX?.[player.position] || "#94a3b8";
  const compact = count >= 4;
  const avatarCls = compact ? "w-8 h-8" : "w-10 h-10";
  const nameCls = compact ? "text-[9px]" : "text-[10px]";
  const skillCls = compact ? "text-[9px]" : "text-[10px]";
  const isJunior = player.isJunior === true;
  return (
    <div className="flex flex-col items-center gap-0.5 flex-1 min-w-0" style={{ maxWidth: "104px" }}>
      <div className="relative shrink-0">
        <div
          className="rounded-full overflow-hidden"
          title={POSITION_FULL_LABELS[player.position]}
          style={{
            boxShadow: `0 0 0 2px ${accent}, 0 0 12px ${accent}66, 0 4px 10px rgba(0,0,0,0.6)`,
          }}
        >
          <PlayerAvatar
            seed={player.id ?? player.name ?? "?"}
            position={player.position}
            teamColor={teamColor}
            nationality={player.nationality}
            size={avatarCls}
            className="block"
          />
        </div>
        {/* Badges de eventos — marcador, amonestado, expulso */}
        {(badges?.goals > 0 || badges?.yellow || badges?.red) && (
          <div className="absolute -top-1.5 -right-2 flex items-center gap-0.5 pointer-events-none">
            {badges.goals > 0 && (
              <span
                className="min-w-4 h-4 px-0.5 rounded-full bg-amber-400 text-zinc-950 text-[9px] font-black flex items-center justify-center border border-black/40 shadow-md"
                title={`${badges.goals} ${badges.goals === 1 ? "golo" : "golos"}`}
              >
                ⚽{badges.goals > 1 ? badges.goals : ""}
              </span>
            )}
            {(badges.yellow || badges.red) && (
              <span
                className={`w-3 h-4 rounded-[2px] border border-black/50 shadow-md ${badges.red ? "bg-red-500" : "bg-yellow-400"}`}
                title={badges.red ? "Expulso" : "Amarelo"}
              />
            )}
          </div>
        )}
        {/* Sigla da posição */}
        <span
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1 rounded text-[7px] font-black leading-tight text-white border border-black/50 shadow pointer-events-none"
          style={{ background: accent }}
        >
          {isJunior ? "JR" : (POSITION_SHORT_LABELS[player.position] || "?")}
        </span>
      </div>
      <div
        className={`mt-1 bg-black/75 px-1 py-0.5 rounded font-semibold text-white text-center truncate w-full ${nameCls}`}
        style={{ textShadow: "0 1px 2px rgba(0,0,0,0.9)" }}
      >
        {isJunior && !player.name ? "Júnior" : player.name}
        {!!player.is_star && (player.position === "MED" || player.position === "ATA") && (
          <span className={`ml-0.5 ${starColor}`} title="Craque">★</span>
        )}
      </div>
      <span className={`font-black tabular-nums text-amber-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] ${skillCls}`}>
        {player.skill ?? "-"}
      </span>
      {showFatigue && (
        <FatigueIndicator player={player} compact className="max-w-full truncate text-[7px]" />
      )}
    </div>
  );
});

/* ── Linha de jogadores ────────────────────────────────────────────────── */
export function PlayerRow({ posKey, players, teamColor, badgesById, starColor, showFatigue = true }) {
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
          teamColor={teamColor}
          badges={player?.id != null ? badgesById?.get(Number(player.id)) : undefined}
          starColor={starColor}
          count={players.length}
          showFatigue={showFatigue}
        />
      ))}
    </div>
  );
}

/* ── PitchFormation — relvado broadcast com os 11 ──────────────────────── */
/** rows {GR,DEF,MED,ATA}, events+liveMinute (badges live), teamColor (camisola), posColors (legado), starColor, withOverlay, showFatigue. */
export function PitchFormation({
  rows,
  events,
  liveMinute,
  teamColor,
  posColors,
  starColor,
  withOverlay = true,
  showFatigue = true,
}) {
  void posColors;
  const badgesById = usePlayerBadges(events, liveMinute);
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: TURF_BACKGROUND }}>
      {PITCH_SVG}
      {Object.entries(rows ?? {}).map(([posKey, players]) => (
        <PlayerRow
          key={posKey}
          posKey={posKey}
          players={players}
          teamColor={teamColor}
          badgesById={badgesById}
          starColor={starColor}
          showFatigue={showFatigue}
        />
      ))}
      {withOverlay && (
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/45 via-transparent to-white/[0.04]" />
      )}
    </div>
  );
}
