import { useState } from "react";

import { motion, AnimatePresence } from "framer-motion";
import { getEffectiveLineup } from "../../utils/playerHelpers.js";
import {
  POSITION_SHORT_LABELS,
  MAX_MATCH_SUBS,
} from "../../constants/index.js";
import { PlayerLink } from "../shared/PlayerLink.jsx";

const POS_ORDER = { GR: 0, DEF: 1, MED: 2, ATA: 3 };
const _sortByPos = (arr) =>
  [...arr].sort(
    (a, b) =>
      (POS_ORDER[a.position] ?? 9) - (POS_ORDER[b.position] ?? 9) ||
      (b.skill ?? 0) - (a.skill ?? 0),
  );

const WEATHER_LABELS = {
  "☀️": "Sol",
  "🌧️": "Chuva",
  "⛈️": "Chuva forte",
  "💨": "Vento",
  "🥶": "Frio",
  "🌫️": "Nevoeiro",
  "❄️": "Neve",
};

const EVENT_TYPES = [
  "goal",
  "penalty_goal",
  "own_goal",
  "penalty_miss",
  "yellow",
  "red",
  "injury",
  "substitution",
  "phase_start",
];

function getEventIcon(e) {
  if (e.emoji) return e.emoji;
  switch (e.type) {
    case "goal":
    case "penalty_goal":
      return "⚽";
    case "own_goal":
      return "⚽🔙";
    case "yellow":
      return "🟨";
    case "red":
      return "🟥";
    case "injury":
      return "🤕";
    case "substitution":
      return "🔄";
    default:
      return "";
  }
}

function FormBadge({ form }) {
  const f = form ?? 100;
  return (
    <span
      className={`text-[10px] font-black ${f >= 115 ? "text-emerald-400" : f <= 85 ? "text-rose-400" : "text-zinc-400"}`}
    >
      {f >= 115 ? "💪" : f <= 85 ? "😩" : "👍"}
    </span>
  );
}

// ── TeamFormationView — pitch SVG + bench for a given team ──────────────────

function TeamFormationView({ teamId, fixture, liveMinute }) {
  if (!fixture?.homeLineup || !fixture?.awayLineup) return null;

  const isHome = fixture.homeTeamId === teamId;
  const lineup = isHome ? fixture.homeLineup : fixture.awayLineup;

  const evts = fixture.events || [];

  const effective = getEffectiveLineup(lineup, evts, liveMinute, isHome ? "home" : "away");

  const starters = _sortByPos(
    effective.active.filter((p) => p.is_starter !== false).slice(0, 11),
  );

  const bench = _sortByPos(
    lineup.filter((p) => p.is_starter === false),
  );

  const rows = {
    ATA: starters.filter((p) => p.position === "ATA"),
    MED: starters.filter((p) => p.position === "MED"),
    DEF: starters.filter((p) => p.position === "DEF"),
    GR: starters.filter((p) => p.position === "GR"),
  };

  const posColors = {
    GR: "bg-amber-500 text-zinc-950",
    DEF: "bg-sky-500 text-zinc-950",
    MED: "bg-emerald-500 text-zinc-950",
    ATA: "bg-rose-500 text-white",
  };

  const subbedIn = effective.active.filter(
    (p) => p.is_starter === false,
  );

  const tactic = isHome ? fixture._t1 : fixture._t2;
  const formation = tactic?.formation || null;
  const styleRaw = tactic?.style?.toUpperCase?.() || null;
  const styleLabel =
    styleRaw === "OFENSIVO"
      ? "Ofensivo"
      : styleRaw === "DEFENSIVO"
        ? "Defensivo"
        : styleRaw === "EQUILIBRADO"
          ? "Equilibrado"
          : null;

  if (starters.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-zinc-600 text-xs font-bold">
          Sem dados da escalação
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex gap-3 min-h-0 overflow-hidden p-3">
      {/* Pitch SVG */}
      <div
        className="relative rounded-md overflow-hidden border border-emerald-900/60 bg-[linear-gradient(180deg,#05430e_0%,#0b5e1a_50%,#05430e_100%)]"
        style={{ aspectRatio: "9/16", maxHeight: "420px", flex: "0 0 auto", width: "52%" }}
      >
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 315 560" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <rect x="10" y="10" width="295" height="540" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" rx="2" />
          <line x1="10" y1="280" x2="305" y2="280" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
          <circle cx="157" cy="280" r="50" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
          <circle cx="157" cy="280" r="3" fill="rgba(255,255,255,0.18)" />
          <rect x="25" y="10" width="265" height="150" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
          <rect x="85" y="10" width="145" height="40" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          <rect x="25" y="400" width="265" height="150" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
          <rect x="85" y="510" width="145" height="40" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        </svg>

        {["GR", "DEF", "MED", "ATA"].map((key) => {
          const rowPlayers = rows[key] || [];
          if (rowPlayers.length === 0) return null;
          return (
            <div
              key={key}
              className="absolute w-full flex justify-evenly items-start px-3"
              style={{ top: { GR: "8%", DEF: "31%", MED: "56%", ATA: "81%" }[key] }}
            >
              {rowPlayers.map((player) => (
                <div
                  key={player.id ?? player.name}
                  className="flex flex-col items-center gap-0.5"
                  style={{ maxWidth: "90px" }}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-[10px] border border-white/30 shadow-lg ${posColors[player.position] || "bg-zinc-500 text-white"}`}
                  >
                    {POSITION_SHORT_LABELS[player.position] || "?"}
                  </div>
                  <div
                    className="bg-black/65 backdrop-blur-sm px-1.5 py-0.5 rounded text-[9px] font-black text-white text-center truncate"
                    style={{ maxWidth: "85px" }}
                  >
                    <PlayerLink playerId={player.id}>{player.name}</PlayerLink>
                    {!!player.is_star &&
                      (player.position === "MED" || player.position === "ATA") && (
                        <span className="ml-0.5 text-amber-400">*</span>
                      )}
                  </div>
                  <span className="text-[9px] font-black text-amber-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                    {player.skill ?? "-"}
                  </span>
                </div>
              ))}
            </div>
          );
        })}

        {/* Tactic badge */}
        {(formation || styleLabel) && (
          <div className="absolute bottom-1.5 right-1.5 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-[8px] font-black text-zinc-300">
            {[formation, styleLabel].filter(Boolean).join(" · ")}
          </div>
        )}

        <div className="absolute inset-0 pointer-events-none bg-linear-to-t from-black/35 to-transparent" />
      </div>

      {/* Bench + subs */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <p className="shrink-0 text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">
          Banco
        </p>
        <div className="flex-1 overflow-y-auto space-y-0.5">
          {subbedIn.length > 0 && (
            <>
              <p className="text-[8px] font-black uppercase tracking-widest text-emerald-500/70 pt-1">
                Entrou
              </p>
              {subbedIn.map((p) => (
                <div
                  key={`sub-${p.id ?? p.name}`}
                  className="flex items-center gap-1.5 py-1 px-1.5 rounded bg-surface-container-high/30"
                >
                  <span className="text-[10px] font-black text-emerald-500 shrink-0">↑</span>
                  <span className="flex-1 truncate text-[10px] font-bold text-zinc-300">
                    <PlayerLink playerId={p.id}>{p.name}</PlayerLink>
                  </span>
                  {p.goals > 0 && (
                    <span className="text-[10px] shrink-0">
                      {Array(p.goals).fill("⚽").join("")}
                    </span>
                  )}
                </div>
              ))}
            </>
          )}
          {bench.map((player) => (
            <div
              key={player.id ?? player.name}
              className="flex items-center gap-1.5 py-1 px-1.5 rounded bg-surface-container-high/30"
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-black border border-white/20 shrink-0 ${posColors[player.position] || "bg-zinc-500 text-white"}`}
              >
                {POSITION_SHORT_LABELS[player.position] || "?"}
              </span>
              <span className="flex-1 truncate text-[10px] font-bold text-zinc-300">
                <PlayerLink playerId={player.id}>{player.name}</PlayerLink>
                {!!player.is_star &&
                  (player.position === "MED" || player.position === "ATA") && (
                    <span className="ml-0.5 text-amber-400 font-black">*</span>
                  )}
              </span>
              <span className="text-[9px] font-black tabular-nums text-zinc-500 shrink-0">
                {player.skill ?? "—"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function MatchPanel({
  mode,
  onClose,
  fixture,
  liveMinute,
  teams,
  isCupMatch,
  cupMatchRoundName,
  currentJornada,
  isPlayingMatch,
  subsMade,
  myTeamInCup,
  cupPreMatch,
  matchAction,
  injuryCountdown,
  onReady,
  isReady,
  onResolveAction,
}) {
  const [centerTab, setCenterTab] = useState("casa");

  const isOpen = !!mode;

  const hInfo = fixture ? teams.find((t) => t.id === fixture.homeTeamId) : null;
  const aInfo = fixture ? teams.find((t) => t.id === fixture.awayTeamId) : null;
  const evts = fixture?.events || [];
  const weatherEvent = evts.find((e) => e.type === "weather");
  const ref = fixture?.referee;
  const refBalance = ref?.balance ?? 50;

  const visibleEvts = evts
    .filter((e) => e.minute <= liveMinute && EVENT_TYPES.includes(e.type))
    .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));

  const homeGoals = visibleEvts.filter(
    (e) =>
      (e.type === "goal" || e.type === "penalty_goal" || e.type === "var_goal_pending") && e.team === "home",
  ).length;
  const awayGoals = visibleEvts.filter(
    (e) =>
      (e.type === "goal" || e.type === "penalty_goal" || e.type === "var_goal_pending") && e.team === "away",
  ).length;

  const displayHomeGoals =
    fixture?.finalHomeGoals ?? matchAction?.currentScore?.home ?? homeGoals;
  const displayAwayGoals =
    fixture?.finalAwayGoals ?? matchAction?.currentScore?.away ?? awayGoals;

  const modeBadgeLabel =
    mode === "halftime"
      ? cupPreMatch
        ? "Pré-Jogo"
        : liveMinute >= 90
          ? "Antes do Extra · Taça"
          : isCupMatch
            ? "Intervalo · Taça"
            : "Intervalo"
      : mode === "action"
        ? matchAction?.type === "injury"
          ? "Lesão"
          : matchAction?.type === "gk_red_card"
            ? "Expulsão GR"
            : matchAction?.type === "penalty"
              ? "Penálti"
              : matchAction?.type === "user_substitution"
                ? "Pausa Tática"
                : "Urgente"
        : null;

  const competitionLabel = isCupMatch
    ? `🏆 ${cupMatchRoundName}`
    : `Jornada ${currentJornada}`;

  const isCupContext = isCupMatch || cupPreMatch;
  const canContinue = !isCupContext || myTeamInCup;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="matchpanel-backdrop"
          className="fixed inset-0 z-120 bg-zinc-950/90 backdrop-blur-sm flex items-start sm:items-center justify-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={mode === "detail" ? onClose : undefined}
        >
          <motion.div
            className="w-full sm:max-w-2xl bg-surface-container border border-outline-variant/30 rounded-t-2xl sm:rounded-lg shadow-2xl flex flex-col max-h-[calc(95vh-3.5rem)] sm:max-h-[calc(92vh-3.5rem)] mt-[3.5rem]"
            initial={{ y: 40, opacity: 0.8 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div className="shrink-0 flex items-center gap-2 px-3 py-2.5 bg-[linear-gradient(120deg,#090b12_0%,#121726_45%,#241b10_100%)] border-b border-zinc-800 rounded-t-2xl sm:rounded-t-lg">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {isPlayingMatch && mode === "detail" && (
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                )}
                <span className="text-amber-500 font-black text-sm tabular-nums shrink-0">
                  {mode === "action" && matchAction
                    ? `${matchAction.minute ?? liveMinute}'`
                    : `${liveMinute}'`}
                </span>
                {modeBadgeLabel ? (
                  <span
                    className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0 ${
                      mode === "action"
                        ? "bg-red-900/60 text-red-300"
                        : "bg-zinc-900/80 text-zinc-300"
                    }`}
                  >
                    {modeBadgeLabel}
                  </span>
                ) : (
                  <span className="text-amber-500 font-black text-xs uppercase tracking-widest shrink-0">
                    {competitionLabel}
                  </span>
                )}
              </div>

              {mode === "halftime" && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {Array.from({ length: MAX_MATCH_SUBS }).map((_, i) => (
                    <span
                      key={i}
                      className={`w-2 h-2 rounded-full transition-colors ${i < subsMade ? "bg-primary" : "bg-zinc-700"}`}
                    />
                  ))}
                  <span className="ml-1 text-[10px] font-bold text-zinc-500 tabular-nums">
                    {MAX_MATCH_SUBS - subsMade}/{MAX_MATCH_SUBS}
                  </span>
                </div>
              )}
              {mode === "action" && injuryCountdown !== null && (
                <span className="shrink-0 text-amber-400 font-black text-sm tabular-nums">
                  {injuryCountdown}s ⏱
                </span>
              )}
              {mode === "detail" && (
                <button
                  onClick={onClose}
                  className="shrink-0 text-zinc-500 hover:text-white transition-colors text-sm font-black px-2 py-1"
                  aria-label="Fechar"
                >
                  ✕
                </button>
              )}
            </div>

            {/* ═══ 2-col grid ═══════════════════════════════════════════════ */}
            <div className="flex-1 min-h-[400px] overflow-hidden grid grid-cols-1 md:grid-cols-[0.85fr_1.6fr]">

              {/* ═══ COL ESQUERDA — Cronologia ════════════════════════════ */}
              <div className="flex flex-col min-h-0 overflow-hidden border-r border-zinc-800/60">
                <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-zinc-800/60 bg-zinc-950/70">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 shadow-[0_0_8px_rgba(250,204,21,0.5)]" />
                  <span className="text-[8px] font-black uppercase tracking-[0.25em] text-amber-400">
                    Cronologia
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5">

                  {/* Score banner */}
                  {(fixture || matchAction) && (
                    <div className="rounded-lg overflow-hidden border border-zinc-800/60 bg-[linear-gradient(135deg,#111118,#1a1a2e)] mb-2">
                      <div className="flex items-center justify-center gap-3 px-2 py-2.5">
                        <div className="flex flex-col items-center gap-0.5">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: hInfo?.color_primary || "#6366f1" }}
                          />
                          <span className="text-[8px] font-black text-zinc-500 uppercase tracking-wider truncate max-w-[70px]">
                            {hInfo?.name || "Casa"}
                          </span>
                        </div>
                        <span className="text-lg font-black tabular-nums text-white">
                          {displayHomeGoals}
                        </span>
                        <span className="text-zinc-600 text-sm font-black">—</span>
                        <span className="text-lg font-black tabular-nums text-white">
                          {displayAwayGoals}
                        </span>
                        <div className="flex flex-col items-center gap-0.5">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: aInfo?.color_primary || "#f43f5e" }}
                          />
                          <span className="text-[8px] font-black text-zinc-500 uppercase tracking-wider truncate max-w-[70px]">
                            {aInfo?.name || "Fora"}
                          </span>
                        </div>
                      </div>
                      {modeBadgeLabel && (
                        <div className="flex items-center justify-center pb-2.5">
                          <span className="inline-flex items-center gap-1 text-[7px] font-black uppercase tracking-[0.25em] px-2 py-0.5 rounded-full bg-zinc-900/80 border border-zinc-700/50 text-zinc-500">
                            {modeBadgeLabel}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Ref / weather bar */}
                  {(fixture?.attendance || ref?.refereeName || weatherEvent) && (
                    <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-800/60 bg-zinc-950/60 text-[9px]">
                      {fixture?.attendance && (
                        <span className="text-zinc-500 font-bold">
                          🏟️ {fixture.attendance.toLocaleString("pt-PT")}
                        </span>
                      )}
                      {ref?.refereeName && (
                        <span className="text-zinc-500 font-bold">
                          👤 {ref.refereeName}{" "}
                          <span
                            className={`font-black tabular-nums ${refBalance >= 60 ? "text-emerald-400" : refBalance <= 40 ? "text-red-400" : "text-zinc-400"}`}
                          >
                            {refBalance}
                          </span>
                        </span>
                      )}
                      {weatherEvent && (
                        <span className="text-zinc-500 font-bold">
                          {weatherEvent.emoji}{" "}
                          {WEATHER_LABELS[weatherEvent.emoji] || ""}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Possession bar */}
                  {fixture?.homePossession != null && (
                    <div className="rounded-lg overflow-hidden border border-zinc-800/60 bg-zinc-950/60 backdrop-blur-sm mb-2">
                      <div className="flex justify-between items-center px-2.5 py-1.5">
                        <span className="text-[10px] font-black text-white tabular-nums">
                          {fixture.homePossession}%
                        </span>
                        <span className="text-[7px] font-black uppercase tracking-[0.2em] text-zinc-500">
                          Posse
                        </span>
                        <span className="text-[10px] font-black text-white tabular-nums">
                          {fixture.awayPossession}%
                        </span>
                      </div>
                      <div className="h-1.5 mx-2.5 mb-1.5 rounded-full overflow-hidden bg-zinc-800/80 flex">
                        <div
                          className="h-full rounded-l-full transition-all duration-700 ease-out"
                          style={{
                            width: `${fixture.homePossession}%`,
                            background: `linear-gradient(90deg, ${hInfo?.color_primary || "#6366f1"}, ${hInfo?.color_primary || "#6366f1"}cc)`,
                            boxShadow: `0 0 8px ${hInfo?.color_primary || "#6366f1"}44`,
                          }}
                        />
                        <div
                          className="h-full flex-1 rounded-r-full transition-all duration-700 ease-out"
                          style={{
                            background: `linear-gradient(90deg, ${aInfo?.color_primary || "#f43f5e"}cc, ${aInfo?.color_primary || "#f43f5e"})`,
                            boxShadow: `0 0 8px ${aInfo?.color_primary || "#f43f5e"}44`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Events */}
                  {visibleEvts.length === 0 ? (
                    <div className="rounded-lg border border-zinc-800/40 bg-zinc-950/40 py-6 flex flex-col items-center gap-1.5">
                      <span className="text-xl text-zinc-700">⚽</span>
                      <p className="text-zinc-600 text-[10px] font-bold">
                        Sem eventos
                      </p>
                    </div>
                  ) : (
                    visibleEvts.map((e, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-zinc-800/30 bg-zinc-950/40"
                      >
                        <span className="text-zinc-600 font-black w-7 shrink-0 text-right tabular-nums text-[10px]">
                          {e.minute != null ? `${e.minute}'` : "—"}
                        </span>
                        <span className="w-4 shrink-0 text-center text-xs">
                          {getEventIcon(e)}
                        </span>
                        <span className="flex-1 truncate text-[10px] font-bold text-white">
                          <PlayerLink playerId={e.playerId}>
                            {e.playerName || e.player_name || ""}
                          </PlayerLink>
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* ═══ COL DIREITA — Casa / Fora ════════════════════════════ */}
              <div className="flex flex-col min-h-0 overflow-hidden">
                {/* Internal tab nav */}
                <div className="shrink-0 flex border-b border-zinc-800/60 bg-zinc-950/50">
                  {[
                    { id: "casa", label: hInfo?.name || "Casa", color: hInfo?.color_primary },
                    { id: "fora", label: aInfo?.name || "Fora", color: aInfo?.color_primary },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setCenterTab(tab.id)}
                      className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-colors relative ${
                        centerTab === tab.id
                          ? "text-zinc-100"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      <span className="relative z-10">{tab.label}</span>
                      {centerTab === tab.id && (
                        <span
                          className="absolute bottom-0 left-0 right-0 h-0.5"
                          style={{ background: tab.color || "#f59e0b" }}
                        />
                      )}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                  {centerTab === "casa" && (
                    <TeamFormationView
                      teamId={fixture?.homeTeamId}
                      fixture={fixture}
                      liveMinute={liveMinute}
                    />
                  )}
                  {centerTab === "fora" && (
                    <TeamFormationView
                      teamId={fixture?.awayTeamId}
                      fixture={fixture}
                      liveMinute={liveMinute}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* ── Footer ── */}
            {mode === "halftime" && (
              <>
                <button
                  onClick={canContinue ? onReady : undefined}
                  disabled={!canContinue || isReady}
                  className={`shrink-0 w-full py-3.5 text-sm font-black uppercase tracking-widest transition-all ${
                    !canContinue
                      ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                      : isReady
                        ? "bg-zinc-800 text-zinc-500"
                        : cupPreMatch
                          ? "bg-green-600 hover:bg-green-500 text-zinc-950"
                          : "bg-primary hover:brightness-110 text-on-primary"
                  }`}
                >
                  {!canContinue
                    ? "⏳ A AGUARDAR JOGO DA TAÇA..."
                    : isReady
                      ? "⏳ A AGUARDAR..."
                      : cupPreMatch
                        ? "▶ INICIAR JOGO — TAÇA"
                        : isCupMatch
                          ? "▶ 2ª PARTE — TAÇA"
                          : "▶ INICIAR 2ª PARTE"}
                </button>
              </>
            )}
            {mode === "action" && matchAction?.type === "user_substitution" && (
              <button
                onClick={() => onResolveAction(null)}
                className="shrink-0 w-full py-3.5 text-sm font-black uppercase tracking-widest bg-primary hover:brightness-110 text-on-primary transition-all"
              >
                ▶ CONTINUAR
              </button>
            )}
            {mode === "detail" && (
              <button
                onClick={onClose}
                className="shrink-0 w-full py-3 text-sm font-black uppercase tracking-widest bg-zinc-900 hover:bg-zinc-800 text-zinc-300 transition-all border-t border-zinc-800"
              >
                Fechar
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
