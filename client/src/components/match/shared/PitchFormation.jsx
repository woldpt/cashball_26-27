import { memo, useMemo } from "react";
import { POSITION_SHORT_LABELS, POSITION_ACCENT_HEX } from "../../../constants/index.js";
import { POSITION_FULL_LABELS, filterMatchEvents } from "../matchConstants.js";
import { PlayerAvatar } from "../../shared/PlayerAvatar.jsx";
import { Stars } from "../../shared/Stars.jsx";
import { FatigueIndicator } from "./FatigueIndicator.jsx";

/* ── Relvado ─────────────────────────────────────────────────────────────
 * Estilo partilhado com o pitch das Táticas (TacticsView): verde escuro em
 * gradiente radial, sem faixas de corte, linhas discretas e escurecimento
 * para baixo. Centralizado aqui para que todos os usos o partilhem. */
export const TURF_BACKGROUND = "radial-gradient(ellipse at 50% 25%, #1f5c1a 0%, #123a0d 50%, #09200a 100%)";
export const TURF_OVERLAY_CLASS = "bg-linear-to-b from-black/5 via-transparent to-black/25";

/* ── Linhas do relvado (SVG, simétrico) ────────────────────────────────── */
const PITCH_SVG = (
  <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 315 560" preserveAspectRatio="none" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2.2" aria-hidden="true">
    <rect x="15" y="15" width="285" height="530" rx="2" />
    <line x1="15" y1="280" x2="300" y2="280" />
    <circle cx="157" cy="280" r="42" />
    <rect x="62" y="15" width="191" height="123" />
    <rect x="108" y="15" width="99" height="63" />
    <rect x="62" y="422" width="191" height="123" />
    <rect x="108" y="482" width="99" height="63" />
    <g fill="rgba(255,255,255,0.2)" stroke="none">
      <circle cx="157" cy="280" r="2.5" />
      <circle cx="157" cy="104" r="2.5" />
      <circle cx="157" cy="456" r="2.5" />
    </g>
  </svg>
);

/* ── Posições das linhas ───────────────────────────────────────────────── */
const ROW_POSITIONS = { ATA: "4%", MED: "28%", DEF: "52%", GR: "76%" };

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

/* Linhas com 4+ jogadores: só o apelido (o nome inteiro truncava em "Afonso …"). */
const lastWord = (n) => (n || "").trim().split(/\s+/).pop();

/* ── Marcador de jogador (em campo) ──────────────────────────────────────
 * Cara do jogador (PlayerAvatar) com anel na cor da posição, placard com
 * nome + skill e badges de eventos da Live (golos, cartões). */
/** player, teamColor, badges {goals,yellow,red}|undefined, starColor, count, showFatigue, selected, isPreview, threatIcon (emoji de ameaça), onClick. */
export const PlayerMarker = memo(function PlayerMarker({ player, teamColor, badges, starColor = "amber-400", count = 1, showFatigue = true, selected = false, isPreview = false, threatIcon = null, onClick = null }) {
  const accent = POSITION_ACCENT_HEX?.[player.position] || "#94a3b8";
  const compact = count >= 4;
  const avatarCls = compact ? "w-8 h-8" : "w-10 h-10";
  const nameCls = compact ? "text-[9px]" : "text-[10px]";
  const skillCls = compact ? "text-[9px]" : "text-[10px]";
  const isJunior = player.isJunior === true;
  const Tag = onClick ? "button" : "div";
  const tagProps = onClick
    ? {
        type: "button",
        onClick,
        "aria-pressed": selected || isPreview,
        "aria-label": selected
          ? `${player.name} escolhido para sair — tocar para desselecionar`
          : `${player.name} — escolher para sair`,
      }
    : {};
  const ringCls = selected
    ? "outline outline-2 outline-rose-400 outline-offset-2 rounded-lg"
    : isPreview
      ? "outline outline-2 outline-emerald-400 outline-offset-2 rounded-lg"
      : "";
  return (
    <Tag
      {...tagProps}
      className={`flex flex-col items-center gap-0.5 flex-1 min-w-0 ${ringCls} ${onClick ? "cursor-pointer bg-transparent border-0 p-0" : ""}`}
      style={{ maxWidth: "104px" }}
    >
      <div className="relative shrink-0">
        <div
          className="rounded-full overflow-hidden"
          title={POSITION_FULL_LABELS[player.position]}
          style={{
            boxShadow: threatIcon
              ? "0 0 0 2px #fbbf24, 0 0 16px #fbbf24aa, 0 4px 10px rgba(0,0,0,0.6)"
              : `0 0 0 2px ${accent}, 0 0 12px ${accent}66, 0 4px 10px rgba(0,0,0,0.6)`,
          }}
        >
          <PlayerAvatar
            seed={player.id ?? player.name ?? "?"}
            position={player.position}
            teamColor={teamColor}
            nationality={player.nationality}
            photo={player.photo || null}
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
        {threatIcon && (
          <span
            className="absolute -top-1.5 -left-2 w-5 h-5 rounded-full bg-amber-400 text-[11px] flex items-center justify-center border border-black/40 shadow-md pointer-events-none"
            title="Ameaça do adversário"
          >
            {threatIcon}
          </span>
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
        {isJunior && !player.name ? "Júnior" : compact ? lastWord(player.name) : player.name}
        {!!player.is_star && (player.position === "MED" || player.position === "ATA") && (
          <span className={`ml-0.5 ${starColor}`} title="Craque">★</span>
        )}
      </div>
      <span className={`font-black tabular-nums text-amber-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] ${skillCls}`}>
        {player.rating != null ? (
          <Stars value={player.rating} hideValue className="text-amber-300" />
        ) : (
          (player.skill ?? "-")
        )}
      </span>
      {showFatigue && (
        <FatigueIndicator player={player} compact className="max-w-full truncate text-[7px]" />
      )}
    </Tag>
  );
});

/* ── Linha de jogadores ────────────────────────────────────────────────── */
export function PlayerRow({ posKey, players, teamColor, badgesById, starColor, showFatigue = true, onPlayerClick = null, selectedId = null, previewId = null, threatIcons = null }) {
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
          selected={selectedId != null && player?.id != null && Number(player.id) === Number(selectedId)}
          isPreview={previewId != null && player?.id != null && Number(player.id) === Number(previewId)}
          threatIcon={player?.id != null ? threatIcons?.get(Number(player.id)) : null}
          onClick={onPlayerClick ? () => onPlayerClick(player) : null}
        />
      ))}
    </div>
  );
}

/* ── PitchFormation — relvado broadcast com os 11 ──────────────────────── */
/** rows {GR,DEF,MED,ATA}, events+liveMinute (badges live), teamColor (camisola), posColors (legado), starColor, withOverlay, showFatigue, onPlayerClick, selectedId, previewId, threatIcons (Map id→emoji, marca ameaças). */
export function PitchFormation({
  rows,
  events,
  liveMinute,
  teamColor,
  posColors,
  starColor,
  withOverlay = true,
  showFatigue = true,
  onPlayerClick = null,
  selectedId = null,
  previewId = null,
  threatIcons = null,
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
          onPlayerClick={onPlayerClick}
          selectedId={selectedId}
          previewId={previewId}
          threatIcons={threatIcons}
        />
      ))}
      {withOverlay && (
        <div className={`absolute inset-0 pointer-events-none ${TURF_OVERLAY_CLASS}`} />
      )}
    </div>
  );
}
