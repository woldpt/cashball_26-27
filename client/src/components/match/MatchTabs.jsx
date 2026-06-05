
import { useState } from "react";
import { motion } from "framer-motion";
import { getEffectiveLineup } from "../../utils/playerHelpers.js";
import {
  POSITION_TEXT_CLASS,
  POSITION_SHORT_LABELS,
  POSITION_BORDER_CLASS,
  MAX_MATCH_SUBS,
} from "../../constants/index.js";
import { PlayerLink } from "../shared/PlayerLink.jsx";

const POS_ORDER = { GR: 0, DEF: 1, MED: 2, ATA: 3 };

/* ── Position accent colours ─────────────────────────────────────────────── */
const POS_ACCENT = {
  GR: "#eab308",
  DEF: "#3b82f6",
  MED: "#10b981",
  ATA: "#f43f5e",
};

function posAccent(pos) {
  return POS_ACCENT[pos] || "#d97706";
}

/* ── TabJogo — Match events, possession, commentary ──────────────────────── */
export function TabJogo({ fixture, liveMinute, teams, mode }) {
  if (!fixture) return null;
  const hInfo = teams.find((t) => t.id === fixture.homeTeamId);
  const aInfo = teams.find((t) => t.id === fixture.awayTeamId);
  const evts = fixture.events || [];
  const weatherEvent = evts.find((e) => e.type === "weather");
  const visibleEvts = evts
    .filter(
      (e) =>
        e.minute <= liveMinute &&
        [
          "goal",
          "penalty_goal",
          "own_goal",
          "penalty_miss",
          "yellow",
          "red",
          "injury",
          "substitution",
          "phase_start",
        ].includes(e.type),
    )
    .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));

  const ref = fixture.referee;
  const refBalance = ref?.balance ?? 50;

  const homeGoals = fixture.finalHomeGoals ?? 0;
  const awayGoals = fixture.finalAwayGoals ?? 0;
  const isHalftime = mode === "halftime";

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {/* ── Halftime score banner ──────────────────────────────────────── */}
      {isHalftime && (
        <div className="rounded-xl overflow-hidden border border-zinc-800/60 bg-[linear-gradient(135deg,#111118,#1a1a2e)] backdrop-blur-sm shadow-[0_0_24px_rgba(0,0,0,0.4)]">
          {/* Score line */}
          <div className="flex items-center justify-center gap-5 pt-4 pb-1.5">
            <div className="flex flex-col items-center gap-1 min-w-0 max-w-[30%]">
              <span
                className="w-3 h-3 rounded-full shrink-0 shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                style={{ background: hInfo?.color_primary || "#6366f1", boxShadow: `0 0 10px ${hInfo?.color_primary || "#6366f1"}80` }}
              />
              <span className="text-[9px] font-black text-zinc-400 truncate text-center leading-tight uppercase tracking-[0.15em]">
                {hInfo?.name || "Casa"}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-3xl font-black tabular-nums text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                {homeGoals}
              </span>
              <span className="text-zinc-600 text-lg font-black">—</span>
              <span className="text-3xl font-black tabular-nums text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                {awayGoals}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1 min-w-0 max-w-[30%]">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: aInfo?.color_primary || "#f43f5e", boxShadow: `0 0 10px ${aInfo?.color_primary || "#f43f5e"}80` }}
              />
              <span className="text-[9px] font-black text-zinc-400 truncate text-center leading-tight uppercase tracking-[0.15em]">
                {aInfo?.name || "Fora"}
              </span>
            </div>
          </div>
          {/* Interval badge */}
          <div className="flex items-center justify-center pb-3.5">
            <span className="inline-flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.3em] px-2.5 py-1 rounded-full bg-zinc-900/80 border border-zinc-700/50 text-zinc-400">
              <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" />
              Intervalo
              <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" />
            </span>
          </div>
        </div>
      )}

      {/* ── Top bar: attendance, referee, weather ──────────────────────── */}
      {(fixture.attendance || ref?.refereeName || weatherEvent) && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg border border-zinc-800/60 bg-zinc-950/60 backdrop-blur-sm">
          {fixture.attendance && (
            <span className="text-zinc-400 text-[10px] font-bold flex items-center gap-1.5">
              <span className="text-base">🏟️</span>
              <span>{hInfo?.stadium_name ? `${hInfo.stadium_name} · ` : ""}</span>
              <span className="text-white tabular-nums">
                {fixture.attendance.toLocaleString("pt-PT")}
              </span>
              <span className="text-zinc-500">adeptos</span>
            </span>
          )}
          {ref?.refereeName && (
            <span className="text-zinc-400 text-[10px] font-bold flex items-center gap-1.5">
              <span className="text-base">👤</span>
              <span className="text-white">{ref.refereeName}</span>
              <span
                className={`ml-1 font-black tabular-nums ${refBalance >= 60 ? "text-emerald-400" : refBalance <= 40 ? "text-red-400" : "text-zinc-400"}`}
              >
                {refBalance}
              </span>
            </span>
          )}
          {weatherEvent && (
            <span className="text-zinc-400 text-[10px] font-bold flex items-center gap-1">
              <span className="text-sm">{weatherEvent.emoji}</span>
              <span>{WEATHER_LABELS[weatherEvent.emoji] || ""}</span>
            </span>
          )}
        </div>
      )}

      {/* ── Possession bar ─────────────────────────────────────────────── */}
      {fixture.homePossession != null && (
        <div className="rounded-xl overflow-hidden border border-zinc-800/60 bg-zinc-950/60 backdrop-blur-sm">
          <div className="flex justify-between items-center px-4 py-2">
            <span className="text-sm font-black text-white tabular-nums">
              {fixture.homePossession}%
            </span>
            <span className="text-[8px] font-black uppercase tracking-[0.25em] text-zinc-500">
              Posse de Bola
            </span>
            <span className="text-sm font-black text-white tabular-nums">
              {fixture.awayPossession}%
            </span>
          </div>
          <div className="h-2 mx-4 mb-2 rounded-full overflow-hidden bg-zinc-800/80 flex">
            <div
              className="h-full rounded-l-full transition-all duration-700 ease-out"
              style={{
                width: `${fixture.homePossession}%`,
                background: `linear-gradient(90deg, ${hInfo?.color_primary || "#6366f1"}, ${hInfo?.color_primary || "#6366f1"}cc)`,
                boxShadow: `0 0 12px ${hInfo?.color_primary || "#6366f1"}44`,
              }}
            />
            <div
              className="h-full flex-1 transition-all duration-700 ease-out"
              style={{
                background: `linear-gradient(90deg, ${aInfo?.color_primary || "#f43f5e"}cc, ${aInfo?.color_primary || "#f43f5e"})`,
                boxShadow: `0 0 12px ${aInfo?.color_primary || "#f43f5e"}44`,
              }}
            />
          </div>
        </div>
      )}

      {/* ── Events list ────────────────────────────────────────────────── */}
      {visibleEvts.length === 0 ? (
        <div className="rounded-xl border border-zinc-800/40 bg-zinc-950/40 py-8 flex flex-col items-center gap-2">
          <span className="text-3xl text-zinc-700">⚽</span>
          <p className="text-zinc-600 text-xs font-bold">Sem eventos a mostrar</p>
        </div>
      ) : (
        <div className="space-y-1">
          {visibleEvts.map((e, i) => {
            const isHome = e.team === "home";
            const evtTeam = isHome ? hInfo : aInfo;
            const accent = evtTeam?.color_primary || "#6366f1";
            const icon =
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
                          : "");
            return (
              <div
                key={i}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-zinc-800/30 bg-zinc-950/40 hover:bg-zinc-900/50 transition-colors"
              >
                <span className="text-zinc-500 font-black w-8 shrink-0 text-right tabular-nums text-[11px]">
                  {e.minute != null ? `${e.minute}'` : "—"}
                </span>
                <span className="w-5 shrink-0 text-center text-sm">{icon}</span>
                <span
                  className="flex-1 truncate text-xs font-bold text-white"
                >
                  <PlayerLink playerId={e.playerId}>
                    {e.playerName || e.player_name || ""}
                  </PlayerLink>
                </span>
                <span
                  className="text-[9px] font-black uppercase tracking-[0.2em] shrink-0 px-2 py-0.5 rounded-full border"
                  style={{
                    color: accent,
                    borderColor: `${accent}30`,
                    background: `${accent}10`,
                  }}
                >
                  {evtTeam?.name || ""}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Commentary ─────────────────────────────────────────────────── */}
      {(() => {
        const commentary = evts
          .filter((e) => e.minute <= liveMinute && e.text)
          .sort((a, b) => (b.minute ?? 0) - (a.minute ?? 0));
        if (commentary.length === 0) return null;
        return (
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.25em] text-zinc-500 mb-2 px-1">
              Narração
            </p>
            <div className="space-y-1.5">
              {commentary.slice(0, 20).map((e, i) => {
                const phrase = e.text
                  .replace(/^\[(?:\d+'|HT)\]\s*\S*\s*/, "")
                  .trim();
                if (!phrase) return null;
                return (
                  <div
                    key={i}
                    className="flex items-start gap-2 px-3 py-2 rounded-lg border border-zinc-800/30 bg-zinc-950/40"
                  >
                    <span className="text-zinc-600 font-black text-[10px] w-7 shrink-0 text-right pt-px tabular-nums">
                      {e.minute != null ? `${e.minute}'` : "—"}
                    </span>
                    <span className="w-5 shrink-0 text-center text-sm pt-px">
                      {e.emoji || ""}
                    </span>
                    <span className="flex-1 text-[11px] text-zinc-400 leading-relaxed">
                      {phrase}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

const WEATHER_LABELS = {
  "☀️": "Sol",
  "🌧️": "Chuva",
  "⛈️": "Chuva forte",
  "💨": "Vento",
  "🥶": "Frio",
  "🌫️": "Nevoeiro",
  "❄️": "Neve",
};

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

function FormBar({ form }) {
  const f = form ?? 100;
  const pct = Math.max(0, Math.min(100, f));
  const color =
    f >= 115 ? "#34d399" : f <= 85 ? "#f87171" : "#a1a1aa";
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-9 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-[9px] font-black tabular-nums" style={{ color }}>
        {f}%
      </span>
    </div>
  );
}

/* ── TabLineup — Home vs Away lineups ───────────────────────────────────── */
export function TabLineup({ fixture, liveMinute, teams }) {
  if (!fixture?.homeLineup || !fixture?.awayLineup) return null;
  const hInfo = teams.find((t) => t.id === fixture.homeTeamId);
  const aInfo = teams.find((t) => t.id === fixture.awayTeamId);
  const evts = fixture.events || [];
  const homeLineup = getEffectiveLineup(
    fixture.homeLineup,
    evts,
    liveMinute,
    "home",
  );
  const awayLineup = getEffectiveLineup(
    fixture.awayLineup,
    evts,
    liveMinute,
    "away",
  );

  const renderPlayer = (p, opts = {}) => {
    const { isOff = false, offReason = null } = opts;
    const label = isOff
      ? offReason === "red"
        ? "🟥"
        : offReason === "injury"
          ? "🚑"
          : "🔄"
      : p.goals > 0
        ? Array(p.goals).fill("⚽").join("")
        : "";
    const accent = posAccent(p.position);
    return (
      <div
        key={p.id ?? p.name}
        className={`flex items-center gap-2 py-1.5 px-2 rounded-md transition-colors ${isOff ? "opacity-40" : "hover:bg-zinc-800/40"}`}
      >
        <span
          className={`w-5 text-[9px] font-black shrink-0 flex items-center justify-center rounded-sm border ${isOff ? "text-zinc-600 border-zinc-700/50" : `border-${posAccent(p.position).slice(1)}20`}`}
          style={{
            color: isOff ? "#52525b" : accent,
            borderColor: isOff ? "#27272a" : `${accent}30`,
            background: isOff ? "transparent" : `${accent}10`,
          }}
        >
          {isOff ? "" : POSITION_SHORT_LABELS[p.position] || "?"}
        </span>
        <span
          className={`flex-1 truncate text-xs font-bold ${isOff ? "text-zinc-600 line-through" : "text-zinc-200"}`}
        >
          <PlayerLink playerId={p.id}>{p.name}</PlayerLink>
          {!!p.is_star && (p.position === "MED" || p.position === "ATA") && (
            <span className="ml-0.5 text-amber-400 font-black">*</span>
          )}
        </span>
        {!isOff && p.skill != null && (
          <span className="text-[10px] font-black tabular-nums text-zinc-500 shrink-0 w-5 text-right">
            {p.skill}
          </span>
        )}
        {label ? <span className="text-[10px] shrink-0">{label}</span> : null}
      </div>
    );
  };

  const sortedLineup = (arr) =>
    [...arr].sort(
      (a, b) => (POS_ORDER[a.position] ?? 9) - (POS_ORDER[b.position] ?? 9),
    );

  return (
    <div className="flex divide-x divide-zinc-800/60 flex-1 overflow-hidden min-h-0 w-full bg-zinc-950/30">
      {[
        { info: hInfo, lineup: homeLineup, side: "home" },
        { info: aInfo, lineup: awayLineup, side: "away" },
      ].map(({ info, lineup }, idx) => {
        const accent = info?.color_primary || "#6366f1";
        return (
          <div key={idx} className="flex-1 flex flex-col min-w-0 overflow-y-auto">
            {/* Team header */}
            <div
              className="px-3 py-2.5 border-b border-zinc-800/60 shrink-0 flex items-center gap-2"
              style={{ background: `${accent}08` }}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: accent, boxShadow: `0 0 8px ${accent}60` }} />
              <p
                className="text-[10px] font-black uppercase tracking-[0.2em] truncate"
                style={{ color: accent }}
              >
                {info?.name || "—"}
              </p>
            </div>

            {/* Active players */}
            <div className="px-2 py-1">
              {sortedLineup(lineup.active).map((p) => renderPlayer(p))}
            </div>

            {/* Off players */}
            {lineup.offPlayers.length > 0 && (
              <>
                <div className="mx-2 my-1.5 border-t border-zinc-800/40" />
                <div className="px-2 py-1">
                  {lineup.offPlayers.map((p) =>
                    renderPlayer(p, { isOff: true, offReason: p.reason }),
                  )}
                </div>
              </>
            )}

            {/* Substitutes */}
            {lineup.subPlayers.length > 0 && (
              <>
                <div className="mx-2 my-1.5 border-t border-zinc-800/40" />
                <p className="text-[8px] font-black uppercase tracking-[0.25em] text-zinc-600 px-2 py-1">
                  Entrou
                </p>
                <div className="px-2 pb-2">
                  {lineup.subPlayers.map((p) => (
                    <div
                      key={p.id ?? p.name}
                      className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-zinc-800/40 transition-colors"
                    >
                      <span className="w-5 text-[9px] font-black text-emerald-400 shrink-0 flex items-center justify-center">
                        ↑
                      </span>
                      <span className="flex-1 truncate text-xs font-bold text-zinc-300">
                        <PlayerLink playerId={p.id}>{p.name}</PlayerLink>
                      </span>
                      {p.goals > 0 && (
                        <span className="text-[10px] shrink-0">
                          {Array(p.goals).fill("⚽").join("")}
                        </span>
                      )}
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

/* ── TabAdversario — Opponent formation + bench ─────────────────────────── */
export function TabAdversario({ fixture, myTeamId, teams }) {
  if (!fixture) return null;

  const hasLineups = fixture?.homeLineup && fixture?.awayLineup;

  const isHome = fixture.homeTeamId === myTeamId;
  const oppLineup = isHome ? fixture.awayLineup : fixture.homeLineup;
  const oppTeamId = isHome ? fixture.awayTeamId : fixture.homeTeamId;
  const oppInfo = teams.find((t) => t.id === oppTeamId);

  const oppTactic = isHome ? fixture._t2 : fixture._t1;
  const formation = oppTactic?.formation || null;
  const styleRaw = oppTactic?.style?.toUpperCase?.() || null;
  const styleLabel =
    styleRaw === "OFENSIVO"
      ? "Ofensivo"
      : styleRaw === "DEFENSIVO"
        ? "Defensivo"
        : styleRaw === "EQUILIBRADO"
          ? "Equilibrado"
          : null;

  const starters = _sortByPos(
    oppLineup.filter((p) => p.is_starter === true).slice(0, 11),
  );

  const bench = _sortByPos(oppLineup.filter((p) => p.is_starter === false));

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

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
      {/* ── Opponent header ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-zinc-800/60 bg-zinc-950/60 backdrop-blur-sm">
        <span
          className="text-xs font-black uppercase tracking-[0.2em] truncate"
          style={{ color: oppInfo?.color_primary || "#f59e0b" }}
        >
          {oppInfo?.name || "Adversário"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {(formation || styleLabel) && (
            <span className="text-[9px] font-black text-zinc-500 shrink-0">
              {[formation, styleLabel].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>
      </div>

      {!hasLineups ? (
        <div className="rounded-xl border border-zinc-800/40 bg-zinc-950/40 py-8 flex flex-col items-center gap-2">
          <span className="text-3xl text-zinc-700">📋</span>
          <p className="text-zinc-500 text-xs font-bold text-center px-4">
            Escalações indisponíveis durante a simulação
          </p>
        </div>
      ) : starters.length === 0 ? (
        <div className="rounded-xl border border-zinc-800/40 bg-zinc-950/40 py-8 flex flex-col items-center gap-2">
          <span className="text-3xl text-zinc-700">🤷</span>
          <p className="text-zinc-500 text-xs font-bold text-center px-4">
            Sem dados da escalação do adversário
          </p>
        </div>
      ) : (
        <div className="flex gap-3 flex-1 min-h-0">
          {/* ── Pitch / formation ──────────────────────────────────────── */}
          <div className="flex-1 relative rounded-xl overflow-hidden border border-zinc-800/60 bg-[linear-gradient(180deg,#05430e_0%,#0b5e1a_50%,#05430e_100%)] shadow-[0_0_30px_rgba(5,67,14,0.3)]" style={{ aspectRatio: "9/16", maxHeight: "420px" }}>
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

            {["GR", "DEF", "MED", "ATA"].map((key) => {
              const rowPlayers = rows[key] || [];
              if (rowPlayers.length === 0) return null;
              return (
                <div
                  key={key}
                  className="absolute w-full flex justify-evenly items-start px-3"
                  style={{ top: key === "GR" ? "8%" : key === "DEF" ? "31%" : key === "MED" ? "56%" : "81%" }}
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
                        className="bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-[9px] font-black text-white text-center truncate"
                        style={{ maxWidth: "85px" }}
                      >
                        {player.name}
                        {!!player.is_star &&
                          (player.position === "MED" ||
                            player.position === "ATA") && (
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

            <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/40 to-transparent" />
          </div>

          {/* ── Bench ──────────────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col">
            <p className="text-[8px] font-black uppercase tracking-[0.25em] text-zinc-500 mb-2 px-1">
              Banco
            </p>
            <div className="flex-1 overflow-y-auto space-y-1">
              {bench.map((player) => (
                <div
                  key={player.id ?? player.name}
                  className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg border border-zinc-800/30 bg-zinc-950/40 hover:bg-zinc-900/50 transition-colors"
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-black border border-white/20 shrink-0 ${posColors[player.position] || "bg-zinc-500 text-white"}`}
                  >
                    {POSITION_SHORT_LABELS[player.position] || "?"}
                  </span>
                  <span className="flex-1 truncate text-[10px] font-bold text-zinc-300">
                    {player.name}
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
      )}
    </div>
  );
}

const _sortByPos = (arr) =>
  [...arr].sort(
    (a, b) =>
      (POS_ORDER[a.position] ?? 9) - (POS_ORDER[b.position] ?? 9) ||
      (b.skill ?? 0) - (a.skill ?? 0),
  );

const MATCH_EVENT_TYPES = [
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

function _filterEvents(evts, liveMinute) {
  return evts
    .filter((e) => e.minute <= liveMinute && MATCH_EVENT_TYPES.includes(e.type))
    .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
}

/* ── TabIntervencao — Substitution / management ─────────────────────────── */
export function TabIntervencao({
  mode,
  matchAction,
  injuryCountdown,
  tactic,
  onUpdateTactic,
  annotatedSquad,
  subbedOut,
  confirmedSubs,
  subsMade,
  swapSource,
  swapTarget,
  onSelectOut,
  onSelectIn,
  onConfirmSub,
  onResetSub,
  onResetAllSubs,
  redCardedHalftimeIds,
  injuredHalftimeIds,
  onResolveAction,
  fixture,
  teams,
  myTeamId,
}) {
  const shouldReduceMotion = false;
  const actionType = matchAction?.type || null;
  const isHalftime = mode === "halftime";
  const isActionMode = mode === "action";
  const isPenalty = actionType === "penalty";
  const isForcedSwap = actionType === "injury" || actionType === "gk_red_card";
  const isActionSub = actionType === "user_substitution";

  const selectedOutId =
    typeof swapSource === "object" && swapSource !== null
      ? swapSource.id
      : swapSource;
  const selectedInId =
    typeof swapTarget === "object" && swapTarget !== null
      ? swapTarget.id
      : swapTarget;

  const forceOutPlayer =
    matchAction?.injuredPlayer ||
    matchAction?.sentOffPlayer ||
    matchAction?.dismissedPlayer ||
    null;

  const isHome = myTeamId && fixture?.homeTeamId === myTeamId;
  const oppTeamId = isHome ? fixture?.awayTeamId : fixture?.homeTeamId;
  const oppInfo = teams?.find((t) => t.id === oppTeamId);

  // ── Halftime score ───────────────────────────────────────────────────
  const homeGoals = fixture?.finalHomeGoals ?? 0;
  const awayGoals = fixture?.finalAwayGoals ?? 0;
  const myTeamGoals = isHome ? homeGoals : awayGoals;
  const oppGoals = isHome ? awayGoals : homeGoals;

  const sortPlayers = (arr = []) =>
    [...arr].sort(
      (a, b) =>
        (POS_ORDER[a.position] ?? 9) - (POS_ORDER[b.position] ?? 9) ||
        (b.skill ?? 0) - (a.skill ?? 0),
    );

  const onPitchPlayers = isHalftime
    ? sortPlayers(
        annotatedSquad.filter(
          (p) =>
            tactic?.positions?.[p.id] === "Titular" &&
            !subbedOut.includes(p.id) &&
            !redCardedHalftimeIds.has(p.id) &&
            !injuredHalftimeIds?.has(p.id),
        ),
      )
    : isPenalty
      ? sortPlayers(matchAction?.takerCandidates || [])
      : isActionSub
        ? sortPlayers(matchAction?.onPitch || [])
        : forceOutPlayer
          ? [forceOutPlayer]
          : [];

  const benchPlayers = isHalftime
    ? sortPlayers(
        annotatedSquad
          .filter((p) => tactic?.positions?.[p.id] === "Suplente")
          .filter((p) => !injuredHalftimeIds?.has(p.id)),
      )
    : isPenalty
      ? []
      : sortPlayers(matchAction?.benchPlayers || []);

  const playerById = (id) =>
    annotatedSquad.find((p) => p.id === id) ||
    onPitchPlayers.find((p) => p.id === id) ||
    benchPlayers.find((p) => p.id === id) ||
    null;

  const effectiveOutId =
    selectedOutId || (isForcedSwap ? forceOutPlayer?.id : null);
  const sourcePlayer = playerById(effectiveOutId);

  const handlePickOut = (player) => {
    if (!player) return;
    onSelectOut(isActionMode ? player : player.id);
  };

  const handlePickIn = (player) => {
    if (!player) return;
    onSelectIn(isActionMode ? player : player.id);
  };

  const canConfirmSwap =
    !!effectiveOutId &&
    !!selectedInId &&
    (!isHalftime || subsMade < MAX_MATCH_SUBS);

  const actionTheme = isPenalty
    ? "from-amber-600/20 via-amber-500/5 to-transparent"
    : isForcedSwap
      ? "from-red-700/20 via-orange-500/10 to-transparent"
      : isActionSub
        ? "from-cyan-500/20 via-blue-500/10 to-transparent"
        : "from-emerald-500/15 via-primary/10 to-transparent";

  const titleText = isHalftime
    ? "Gestão da Equipa"
    : isPenalty
      ? "Escolhe o marcador"
      : isForcedSwap
        ? `Substituição obrigatória · ${forceOutPlayer?.name || "jogador"}`
        : "Pausa para substituição";

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-[linear-gradient(170deg,#0d0d14_0%,#11111b_45%,#0e1018_100%)]">
      {/* ── Confirmed subs (halftime) ────────────────────────────────── */}
      {confirmedSubs.length > 0 && isHalftime && (
        <div className="shrink-0 px-3 py-2 border-b border-cyan-900/40 bg-cyan-950/20 flex flex-wrap gap-1.5">
          {confirmedSubs.map((sub) => {
            const outP = annotatedSquad.find((p) => p.id === sub.out);
            const inP = annotatedSquad.find((p) => p.id === sub.in);
            return (
              <div
                key={`${sub.out}-${sub.in}`}
                className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold border border-cyan-800/40 bg-zinc-950/80 backdrop-blur-sm"
              >
                <span className="text-cyan-400 shrink-0">🔄</span>
                <span className="text-rose-300 truncate max-w-[80px]">
                  {outP?.name ?? "?"}
                </span>
                <span className="text-zinc-600 shrink-0 mx-0.5">→</span>
                <span className="text-emerald-300 truncate max-w-[80px]">
                  {inP?.name ?? "?"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Halftime tactics ─────────────────────────────────────────── */}
      {isHalftime && (
        <div className="shrink-0 px-3 py-2.5 border-b border-zinc-800/60 bg-zinc-950/60 backdrop-blur-sm">
          <span className="block text-[8px] font-black uppercase tracking-[0.25em] text-zinc-500 mb-2">
            Mentalidade
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { value: "Defensive", label: "Defensivo", color: "blue", accent: "#3b82f6" },
              { value: "Balanced", label: "Equilibrado", color: "primary", accent: "#6366f1" },
              { value: "Offensive", label: "Ofensivo", color: "amber", accent: "#f59e0b" },
            ].map(({ value, label, accent }) => (
              <button
                key={value}
                onClick={() => onUpdateTactic({ style: value })}
                className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all border ${
                  tactic.style === value
                    ? `border-${accent}/40 text-white shadow-[0_0_20px_${accent}30]`
                    : "bg-zinc-900/60 border-zinc-800/60 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                }`}
                style={tactic.style === value ? {
                  background: `${accent}25`,
                  borderColor: `${accent}40`,
                  boxShadow: `0 0 20px ${accent}25`,
                } : {}}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Title bar ────────────────────────────────────────────────── */}
      <div
        className={`shrink-0 px-3 py-2 border-b border-zinc-800/60 bg-gradient-to-r ${actionTheme} backdrop-blur-sm`}
      >
        <div className="flex items-center gap-2">
          {oppInfo && (
            <span
              className="text-[10px] font-black uppercase tracking-[0.2em] shrink-0"
              style={{ color: oppInfo?.color_primary || "#f59e0b" }}
            >
              {oppInfo?.name || "Adversário"}
            </span>
          )}
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-100 text-center truncate flex-1">
            {titleText}
          </p>
        </div>
        {isHalftime && (
          <div className="flex items-center justify-center gap-3 mt-2">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wide truncate max-w-[80px]">
              {teams?.find((t) => t.id === fixture?.homeTeamId)?.name || "Casa"}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-lg font-black tabular-nums text-white">{myTeamGoals}</span>
              <span className="text-zinc-600 text-sm font-black">–</span>
              <span className="text-lg font-black tabular-nums text-white">{oppGoals}</span>
            </span>
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wide truncate max-w-[80px] text-right">
              {oppInfo?.name || "Fora"}
            </span>
          </div>
        )}
        {isForcedSwap && injuryCountdown !== null && (
          <p className="text-center text-amber-300 font-black text-[10px] mt-1 tracking-wide animate-pulse">
            Auto-substituição em {injuryCountdown}s
          </p>
        )}
      </div>

      {/* ── Two columns ──────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden flex-col md:flex-row">
        {/* ── On pitch ───────────────────────────────────────────────── */}
        <div className="flex flex-col min-w-0 flex-1 overflow-hidden border-b md:border-b-0 md:border-r border-zinc-800/60">
          <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-zinc-950/70 border-b border-zinc-800/60">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
            <span className="text-[8px] font-black uppercase tracking-[0.25em] text-emerald-400">
              Em Campo
            </span>
          </div>
          <div className="min-w-0 flex-1 overflow-y-auto">
            {onPitchPlayers.map((p, i) => {
              const grAvailableOnBench = benchPlayers.some(
                (bp) => bp.position === "GR" && !subbedOut.includes(bp.id),
              );
              const noGrReplacement =
                isHalftime && p.position === "GR" && !grAvailableOnBench;
              const isLockedForced =
                isForcedSwap && !!forceOutPlayer && p.id !== forceOutPlayer.id;
              const disabled =
                noGrReplacement ||
                isLockedForced ||
                (isHalftime && subsMade >= MAX_MATCH_SUBS) ||
                (isPenalty &&
                  !(matchAction?.takerCandidates || []).find(
                    (c) => c.id === p.id,
                  ));
              const selected = effectiveOutId === p.id;
              const accent = posAccent(p.position);
              return (
                <motion.button
                  key={p.id}
                  onClick={() => !disabled && handlePickOut(p)}
                  title={
                    noGrReplacement
                      ? "Não há GR no banco para substituir"
                      : undefined
                  }
                  initial={
                    shouldReduceMotion
                      ? false
                      : { opacity: 0, x: -10, filter: "blur(2px)" }
                  }
                  animate={
                    shouldReduceMotion
                      ? undefined
                      : { opacity: 1, x: 0, filter: "blur(0px)" }
                  }
                  transition={
                    shouldReduceMotion
                      ? undefined
                      : { duration: 0.2, delay: Math.min(i, 6) * 0.02 }
                  }
                  className={`w-full flex items-center gap-2 px-3 py-2.5 border-b border-zinc-800/30 text-left select-none transition-all border-l-2 ${
                    selected
                      ? "bg-rose-500/10 border-l-rose-400"
                      : disabled
                        ? "opacity-40 cursor-not-allowed border-l-transparent"
                        : "cursor-pointer hover:bg-zinc-800/40 border-l-transparent"
                  }`}
                >
                  {/* Position badge */}
                  <span
                    className={`shrink-0 px-1.5 py-0.5 rounded-md text-[8px] font-black border ${
                      selected
                        ? "bg-rose-500/20 text-rose-200 border-rose-400/40"
                        : `border-${accent}30 text-${accent}300`
                    }`}
                    style={{
                      color: selected ? "#fecdd3" : accent,
                      borderColor: selected ? "#f43f5e60" : `${accent}30`,
                      background: selected ? "#f43f5e20" : `${accent}10`,
                    }}
                  >
                    {POSITION_SHORT_LABELS[p.position]}
                  </span>
                  {/* Name */}
                  <span
                    className={`flex-1 truncate text-[11px] font-bold ${selected ? "text-rose-100" : "text-zinc-100"}`}
                  >
                    {p.name}
                    {!!p.is_star &&
                      (p.position === "MED" || p.position === "ATA") && (
                        <span className="ml-0.5 text-amber-400 font-black">
                          *
                        </span>
                      )}
                  </span>
                  {/* Stats row */}
                  <div className="shrink-0 flex items-center gap-2 text-right">
                    <span
                      className={`text-[11px] font-black tabular-nums ${selected ? "text-rose-300" : "text-zinc-400"}`}
                    >
                      {p.skill ?? "—"}
                    </span>
                    <span className="text-[9px] text-cyan-400/60 tabular-nums">
                      🛡️{p.resistance ?? "–"}
                    </span>
                    <FormBadge form={p.form} />
                  </div>
                </motion.button>
              );
            })}
            {onPitchPlayers.length === 0 && (
              <p className="text-center text-zinc-600 text-xs font-bold py-6">
                Sem opções em campo
              </p>
            )}
          </div>
        </div>

        {/* ── Bench ──────────────────────────────────────────────────── */}
        <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
          <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-zinc-950/70 border-b border-zinc-800/60">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
            <span className="text-[8px] font-black uppercase tracking-[0.25em] text-cyan-400">
              {isPenalty ? "Escolha" : "Banco"}
            </span>
          </div>
          <div className="min-w-0 flex-1 overflow-y-auto">
            {isPenalty ? (
              <p className="text-center text-zinc-500 text-xs font-bold py-8 px-4">
                Seleciona o marcador na coluna "Em Campo".
              </p>
            ) : (
              benchPlayers.map((p, i) => {
                const alreadyUsed = isHalftime && subbedOut.includes(p.id);
                const positionMismatch =
                  !!sourcePlayer &&
                  (sourcePlayer.position === "GR") !== (p.position === "GR");
                const disabled =
                  alreadyUsed ||
                  positionMismatch ||
                  (isHalftime && subsMade >= MAX_MATCH_SUBS);
                const selected = selectedInId === p.id;
                const accent = posAccent(p.position);
                return (
                  <motion.button
                    key={p.id}
                    onClick={() => !disabled && handlePickIn(p)}
                    initial={
                      shouldReduceMotion
                        ? false
                        : { opacity: 0, x: 10, filter: "blur(2px)" }
                    }
                    animate={
                      shouldReduceMotion
                      ? undefined
                      : { opacity: 1, x: 0, filter: "blur(0px)" }
                    }
                    transition={
                      shouldReduceMotion
                      ? undefined
                      : { duration: 0.2, delay: Math.min(i, 6) * 0.02 }
                    }
                    className={`w-full flex items-center gap-2 px-3 py-2.5 border-b border-zinc-800/30 text-left select-none transition-all border-l-2 ${
                      alreadyUsed
                        ? "opacity-25 cursor-not-allowed border-l-transparent"
                        : selected
                          ? "bg-emerald-500/10 border-l-emerald-400"
                          : disabled
                            ? "opacity-40 cursor-not-allowed border-l-transparent"
                            : "cursor-pointer hover:bg-zinc-800/40 border-l-transparent"
                    }`}
                  >
                    {/* Position badge */}
                    <span
                      className={`shrink-0 px-1.5 py-0.5 rounded-md text-[8px] font-black border ${
                        alreadyUsed
                          ? "border-zinc-700/50 text-zinc-600"
                          : selected
                            ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/40"
                            : `border-${accent}30 text-${accent}300`
                      }`}
                      style={{
                        color: alreadyUsed ? "#52525b" : selected ? "#a7f3d0" : accent,
                        borderColor: alreadyUsed ? "#27272a" : selected ? "#10b98140" : `${accent}30`,
                        background: alreadyUsed ? "transparent" : selected ? "#10b98120" : `${accent}10`,
                      }}
                    >
                      {POSITION_SHORT_LABELS[p.position]}
                    </span>
                    {/* Name */}
                    <span
                      className={`flex-1 truncate text-[11px] font-bold ${selected ? "text-emerald-100" : "text-zinc-100"}`}
                    >
                      {p.name}
                      {!alreadyUsed &&
                        !!p.is_star &&
                        (p.position === "MED" || p.position === "ATA") && (
                          <span className="ml-0.5 text-amber-400 font-black">
                            *
                          </span>
                        )}
                    </span>
                    {/* Stats */}
                    <div className="shrink-0 flex items-center gap-2">
                      <span
                        className={`text-[11px] font-black tabular-nums ${selected ? "text-emerald-300" : "text-zinc-500"}`}
                      >
                        {alreadyUsed ? "—" : (p.skill ?? "—")}
                      </span>
                      {!alreadyUsed && p.resistance != null && (
                        <span className="text-[9px] text-cyan-400/60 tabular-nums">
                          🛡️{p.resistance}
                        </span>
                      )}
                      {!alreadyUsed && <FormBadge form={p.form} />}
                    </div>
                  </motion.button>
                );
              })
            )}
            {!isPenalty && benchPlayers.length === 0 && (
              <p className="text-center text-zinc-600 text-xs font-bold py-6">
                Sem opções no banco
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom bar ───────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-zinc-800/60 bg-zinc-950/80 backdrop-blur-sm px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <span className="text-[9px] text-zinc-600 shrink-0 font-bold uppercase tracking-wide">Sai</span>
            <span className="bg-rose-950/80 text-rose-200 border border-rose-800/50 text-[10px] font-black px-2.5 py-1 rounded-lg truncate max-w-[35%]">
              {effectiveOutId ? playerById(effectiveOutId)?.name || "?" : "—"}
            </span>
            {!isPenalty && (
              <>
                <span className="text-zinc-500 shrink-0 font-black text-sm">
                  →
                </span>
                <span className="text-[9px] text-zinc-600 shrink-0 font-bold uppercase tracking-wide">
                  Entra
                </span>
                <span className="bg-emerald-950/80 text-emerald-200 border border-emerald-800/50 text-[10px] font-black px-2.5 py-1 rounded-lg truncate max-w-[35%]">
                  {selectedInId ? playerById(selectedInId)?.name || "?" : "—"}
                </span>
              </>
            )}
          </div>

          {isHalftime ? (
            <>
              <button
                onClick={onResetSub}
                className="shrink-0 w-7 h-7 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-500 hover:text-white text-xs flex items-center justify-center transition-colors border border-zinc-700/50"
              >
                ✕
              </button>
              <button
                onClick={onConfirmSub}
                disabled={!canConfirmSwap}
                className={`shrink-0 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all border ${
                  canConfirmSwap
                    ? "bg-emerald-600/90 border-emerald-400/40 text-white shadow-[0_0_16px_rgba(16,185,129,0.25)] hover:bg-emerald-500/90"
                    : "bg-zinc-800/80 border-zinc-700/50 text-zinc-600 cursor-not-allowed"
                }`}
              >
                Substituir
              </button>
            </>
          ) : (
            <button
              disabled={isPenalty ? !effectiveOutId : !canConfirmSwap}
              onClick={() =>
                isPenalty
                  ? onResolveAction(effectiveOutId || null)
                  : onResolveAction({
                      playerOut: effectiveOutId,
                      playerIn: selectedInId,
                    })
              }
              className="shrink-0 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide bg-primary/90 hover:brightness-110 text-on-primary disabled:opacity-50 disabled:cursor-not-allowed border border-primary/40 shadow-[0_0_16px_rgba(99,102,241,0.2)]"
            >
              Substituir
            </button>
          )}
        </div>
      </div>

      {isHalftime && confirmedSubs.length > 0 && (
        <div className="shrink-0 border-t border-zinc-800/30 px-4 py-1.5 flex justify-center bg-zinc-950/50">
          <button
            onClick={onResetAllSubs}
            className="text-[9px] font-black uppercase tracking-[0.25em] text-rose-400/80 hover:text-rose-300 transition-colors"
          >
            ↺ Anular todas as substituições
          </button>
        </div>
      )}
    </div>
  );
}

/* ── MatchIntervencaoView — 3-col unified halftime / action view ───────── */
export function MatchIntervencaoView({
  mode,
  fixture,
  liveMinute,
  teams,
  myTeamId,
  matchAction,
  injuryCountdown,
  tactic,
  onUpdateTactic,
  annotatedSquad,
  subbedOut,
  confirmedSubs,
  subsMade,
  swapSource,
  swapTarget,
  onSelectOut,
  onSelectIn,
  onConfirmSub,
  onResetSub,
  onResetAllSubs,
  redCardedHalftimeIds,
  injuredHalftimeIds,
  onResolveAction,
}) {
  const [centerTab, setCenterTab] = useState("subs");

  /* ── Mode booleans ────────────────────────────────────────────────── */
  const isHalftime = mode === "halftime";
  const actionType = matchAction?.type || null;
  const isPenalty = actionType === "penalty";
  const isForcedSwap = actionType === "injury" || actionType === "gk_red_card";
  const isActionSub = actionType === "user_substitution";

  const selectedOutId =
    typeof swapSource === "object" && swapSource !== null
      ? swapSource.id
      : swapSource;
  const selectedInId =
    typeof swapTarget === "object" && swapTarget !== null
      ? swapTarget.id
      : swapTarget;

  const forceOutPlayer =
    matchAction?.injuredPlayer ||
    matchAction?.sentOffPlayer ||
    matchAction?.dismissedPlayer ||
    null;

  /* ── Team info ────────────────────────────────────────────────────── */
  const isHome = myTeamId && fixture?.homeTeamId === myTeamId;
  const oppTeamId = isHome ? fixture?.awayTeamId : fixture?.homeTeamId;
  const oppInfo = teams?.find((t) => t.id === oppTeamId);
  const hInfo = teams?.find((t) => t.id === fixture?.homeTeamId);
  const aInfo = teams?.find((t) => t.id === fixture?.awayTeamId);

  /* ── Our squad ────────────────────────────────────────────────────── */
  const sortPlayers = (arr = []) =>
    [...arr].sort(
      (a, b) =>
        (POS_ORDER[a.position] ?? 9) - (POS_ORDER[b.position] ?? 9) ||
        (b.skill ?? 0) - (a.skill ?? 0),
    );

  const onPitchPlayers = isHalftime
    ? sortPlayers(
        annotatedSquad.filter(
          (p) =>
            tactic?.positions?.[p.id] === "Titular" &&
            !subbedOut.includes(p.id) &&
            !redCardedHalftimeIds.has(p.id) &&
            !injuredHalftimeIds?.has(p.id),
        ),
      )
    : isPenalty
      ? sortPlayers(matchAction?.takerCandidates || [])
      : isActionSub
        ? sortPlayers(matchAction?.onPitch || [])
        : forceOutPlayer
          ? [forceOutPlayer]
          : [];

  const benchPlayers = isHalftime
    ? sortPlayers(
        annotatedSquad
          .filter((p) => tactic?.positions?.[p.id] === "Suplente")
          .filter((p) => !injuredHalftimeIds?.has(p.id)),
      )
    : isPenalty
      ? []
      : sortPlayers(matchAction?.benchPlayers || []);

  const playerById = (id) =>
    annotatedSquad.find((p) => p.id === id) ||
    onPitchPlayers.find((p) => p.id === id) ||
    benchPlayers.find((p) => p.id === id) ||
    null;

  const effectiveOutId =
    selectedOutId || (isForcedSwap ? forceOutPlayer?.id : null);
  const sourcePlayer = playerById(effectiveOutId);
  const targetPlayer = playerById(selectedInId);

  const canConfirmSwap =
    !!effectiveOutId &&
    !!selectedInId &&
    (!isHalftime || subsMade < MAX_MATCH_SUBS);

  /* ── Handlers ─────────────────────────────────────────────────────── */
  const handlePickOut = (player) => {
    if (!player) return;
    onSelectOut(isHalftime ? player.id : player);
  };

  const handlePickIn = (player) => {
    if (!player) return;
    onSelectIn(isHalftime ? player.id : player);
  };

  /* ── Opponent data (for "Adversário" tab) ─────────────────────────── */
  const hasLineups = fixture?.homeLineup && fixture?.awayLineup;
  const oppLineup = isHome ? fixture?.awayLineup : fixture?.homeLineup;
  const oppTactic = isHome ? fixture?._t2 : fixture?._t1;
  const oppFormation = oppTactic?.formation || null;
  const oppStyleRaw = oppTactic?.style?.toUpperCase?.() || null;
  const oppStyleLabel =
    oppStyleRaw === "OFENSIVO"
      ? "Ofensivo"
      : oppStyleRaw === "DEFENSIVO"
        ? "Defensivo"
        : oppStyleRaw === "EQUILIBRADO"
          ? "Equilibrado"
          : null;
  const oppStarters = hasLineups
    ? _sortByPos(oppLineup.filter((p) => p.is_starter === true).slice(0, 11))
    : [];
  const oppBench = hasLineups
    ? _sortByPos(oppLineup.filter((p) => p.is_starter === false))
    : [];

  const oppPositionRows = {
    ATA: oppStarters.filter((p) => p.position === "ATA"),
    MED: oppStarters.filter((p) => p.position === "MED"),
    DEF: oppStarters.filter((p) => p.position === "DEF"),
    GR: oppStarters.filter((p) => p.position === "GR"),
  };

  const oppPosColors = {
    GR: "bg-amber-500 text-zinc-950",
    DEF: "bg-sky-500 text-zinc-950",
    MED: "bg-emerald-500 text-zinc-950",
    ATA: "bg-rose-500 text-white",
  };

  /* ── Cronologia events ────────────────────────────────────────────── */
  const evts = fixture?.events || [];
  const weatherEvent = evts.find((e) => e.type === "weather");
  const visibleEvts = _filterEvents(evts, liveMinute);
  const ref = fixture?.referee;
  const refBalance = ref?.balance ?? 50;

  /* ── Shared helpers ───────────────────────────────────────────────── */
  const getEventIcon = (e) =>
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
                : "");

  /* ── Action title ─────────────────────────────────────────────────── */
  const titleText = isHalftime
    ? "Gestão da Equipa"
    : isPenalty
      ? "Escolhe o marcador"
      : isForcedSwap
        ? `Substituição obrigatória · ${forceOutPlayer?.name || "jogador"}`
        : "Pausa para substituição";

  const actionTheme = isPenalty
    ? "from-amber-600/20 via-amber-500/5 to-transparent"
    : isForcedSwap
      ? "from-red-700/20 via-orange-500/10 to-transparent"
      : isActionSub
        ? "from-cyan-500/20 via-blue-500/10 to-transparent"
        : "from-emerald-500/15 via-primary/10 to-transparent";

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-[linear-gradient(170deg,#0d0d14_0%,#11111b_45%,#0e1018_100%)]">
      {/* Title bar */}
      <div
        className={`shrink-0 px-3 py-2 border-b border-zinc-800/60 bg-gradient-to-r ${actionTheme} backdrop-blur-sm`}
      >
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-100 text-center">
          {titleText}
        </p>
        {isForcedSwap && injuryCountdown !== null && (
          <p className="text-center text-amber-300 font-black text-[10px] mt-1 tracking-wide animate-pulse">
            Auto-substituição em {injuryCountdown}s
          </p>
        )}
      </div>

      {/* ── 3-column grid (mobile: single col — cronologia below) ──── */}
      <div className="flex-1 min-h-0 flex flex-col md:grid md:grid-cols-[0.85fr_1.6fr] overflow-hidden">
        {/* ═══ COL ESQUERDA — Cronologia (desktop: grid col, mobile: above main) ═══ */}
        <div className="hidden md:flex flex-col min-h-0 overflow-hidden border-r border-zinc-800/60">
          <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-zinc-800/60 bg-zinc-950/70">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0 shadow-[0_0_10px_rgba(250,204,21,0.5)]" />
            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-amber-400">
              Cronologia
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">

            {/* Possession bar */}
            {fixture.homePossession != null && (
              <div className="rounded-lg overflow-hidden border border-zinc-800/60 bg-zinc-950/60 backdrop-blur-sm mb-2.5">
                <div className="flex justify-between items-center px-3 py-2">
                  <span className="text-[10px] font-black text-white tabular-nums">
                    {fixture.homePossession}%
                  </span>
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-500">
                    Posse
                  </span>
                  <span className="text-[10px] font-black text-white tabular-nums">
                    {fixture.awayPossession}%
                  </span>
                </div>
                <div className="h-1.5 mx-3 mb-2 rounded-full overflow-hidden bg-zinc-800/80 flex">
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

            {/* Ref / weather bar */}
            {(fixture?.attendance || ref?.refereeName || weatherEvent) && (
              <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg border border-zinc-800/60 bg-zinc-950/60 text-[10px]">
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

            {/* Events */}
            {visibleEvts.length === 0 ? (
              <div className="rounded-lg border border-zinc-800/40 bg-zinc-950/40 py-8 flex flex-col items-center gap-2">
                <span className="text-2xl text-zinc-700">⚽</span>
                <p className="text-zinc-600 text-[11px] font-bold">
                  Sem eventos
                </p>
              </div>
            ) : (
              visibleEvts.map((e, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-800/25 bg-zinc-950/40"
                  >
                    <span className="text-zinc-600 font-black w-8 shrink-0 text-right tabular-nums text-[11px]">
                      {e.minute != null ? `${e.minute}'` : "—"}
                    </span>
                    <span className="w-5 shrink-0 text-center text-sm">
                      {getEventIcon(e)}
                    </span>
                    <span className="flex-1 truncate text-[11px] font-black text-white">
                      <PlayerLink playerId={e.playerId}>
                        {e.playerName || e.player_name || ""}
                      </PlayerLink>
                    </span>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* ═══ COL CENTRAL — Substituições ═══════════ */}
        <div className="flex flex-col min-h-0 overflow-hidden">
          <div className="shrink-0 flex border-b border-zinc-800/60 bg-zinc-950/70">
            {[
              { key: "subs", label: "Substituições" },
              { key: "adversario", label: "Adversário" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setCenterTab(tab.key)}
                className={`flex-1 min-w-0 py-3 text-[11px] font-black uppercase tracking-widest transition-all border-b-2 ${
                  centerTab === tab.key
                    ? "text-white border-primary bg-primary/5"
                    : "text-zinc-500 hover:text-zinc-300 border-transparent hover:bg-zinc-800/30"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {centerTab === "subs" ? (
                <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Confirmed subs strip (halftime only) */}
          {isHalftime && confirmedSubs.length > 0 && (
            <div className="shrink-0 px-3 py-2 border-b border-cyan-900/40 bg-cyan-950/20 flex flex-wrap gap-1.5">
              {confirmedSubs.map((sub) => {
                const outP = annotatedSquad.find((p) => p.id === sub.out);
                const inP = annotatedSquad.find((p) => p.id === sub.in);
                return (
                  <div
                    key={`${sub.out}-${sub.in}`}
                    className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold border border-cyan-800/40 bg-zinc-950/80"
                  >
                    <span className="text-cyan-400 shrink-0">🔄</span>
                    <span className="text-rose-300 truncate max-w-[80px]">
                      {outP?.name ?? "?"}
                    </span>
                    <span className="text-zinc-500 shrink-0">→</span>
                    <span className="text-emerald-300 truncate max-w-[80px]">
                      {inP?.name ?? "?"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col h-full">
                {/* Mentality buttons (halftime) */}
                {isHalftime && (
                  <div className="px-4 py-3 border-b border-zinc-800/60">
                    <span className="block text-[9px] font-black uppercase tracking-[0.25em] text-zinc-400 mb-2.5">
                      Mentalidade
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: "Defensive", label: "Defensivo", accent: "#3b82f6" },
                        { value: "Balanced", label: "Equilibrado", accent: "#6366f1" },
                        { value: "Offensive", label: "Ofensivo", accent: "#f59e0b" },
                      ].map(({ value, label, accent }) => (
                        <button
                          key={value}
                          onClick={() => onUpdateTactic({ style: value })}
                          className={`py-2.5 rounded-lg text-[11px] font-black uppercase tracking-wide transition-all border ${
                            tactic.style === value
                              ? "text-white shadow-[0_0_20px_rgba(99,102,241,0.15)]"
                              : "bg-zinc-900/60 border-zinc-800/60 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                          }`}
                          style={
                            tactic.style === value
                              ? {
                                  background: `${accent}25`,
                                  borderColor: `${accent}40`,
                                  boxShadow: `0 0 20px ${accent}25`,
                                }
                              : {}
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex-1 grid grid-cols-2 min-h-0 overflow-hidden">
                  {/* Left: Titulares */}
                  <div className="flex flex-col min-h-0 overflow-hidden ">
                    <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-zinc-800/60 bg-zinc-950/60">
                      <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-black">
                        {isPenalty ? "Candidatos" : "Titulares"}
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto">

                {/* Players */}
                {onPitchPlayers.map((p) => {
                  const grAvailableOnBench = benchPlayers.some(
                    (bp) => bp.position === "GR" && !subbedOut.includes(bp.id),
                  );
                  const noGrReplacement =
                    isHalftime && p.position === "GR" && !grAvailableOnBench;
                  const isLockedForced =
                    isForcedSwap && !!forceOutPlayer && p.id !== forceOutPlayer.id;
                  const disabled =
                    noGrReplacement ||
                    isLockedForced ||
                    (isHalftime && subsMade >= MAX_MATCH_SUBS) ||
                    (isPenalty &&
                      !(matchAction?.takerCandidates || []).find(
                        (c) => c.id === p.id,
                      ));
                  const selected = effectiveOutId === p.id;
                  const accent = posAccent(p.position);
                  return (
                    <button
                      key={p.id}
                      onClick={() => !disabled && handlePickOut(p)}
                      title={
                        noGrReplacement
                          ? "Não há GR no banco para substituir"
                          : undefined
                      }
                      className={`w-full flex items-center gap-3 px-4 py-3 border-b border-zinc-800/25 text-left select-none transition-all ${
                        selected
                          ? "bg-rose-500/10"
                          : disabled
                            ? "opacity-40 cursor-not-allowed"
                            : "cursor-pointer hover:bg-zinc-800/30"
                      }`}
                    >
                      {/* Position badge */}
                      <span
                        className={`shrink-0 px-2 py-1 rounded-md text-[9px] font-black border ${
                          selected
                            ? "bg-rose-500/20 text-rose-200 border-rose-400/40"
                            : ""
                        }`}
                        style={
                          selected
                            ? {}
                            : {
                                color: accent,
                                borderColor: `${accent}35`,
                                background: `${accent}12`,
                              }
                        }
                      >
                        {POSITION_SHORT_LABELS[p.position]}
                      </span>
                      {/* Name */}
                      <span
                        className={`flex-1 truncate text-[12px] font-black ${
                          selected ? "text-rose-100" : "text-zinc-100"
                        }`}
                      >
                        {p.name}
                        {!!p.is_star &&
                          (p.position === "MED" || p.position === "ATA") && (
                            <span className="ml-0.5 text-amber-400 font-black">
                              *
                            </span>
                          )}
                      </span>
                      {/* Stats */}
                      <div className="shrink-0 flex items-center gap-1.5">
                            {/* Resistência */}
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="text-[8px] uppercase tracking-widest text-zinc-500 font-black leading-none">
                                RES
                              </span>
                              <span
                                className={`text-[14px] font-black tabular-nums leading-none ${
                                  (p.resistance ?? 0) >= 4
                                    ? "text-green-400"
                                    : (p.resistance ?? 0) >= 3
                                      ? "text-yellow-400"
                                      : "text-red-400"
                                }`}
                              >
                                {p.resistance ?? "–"}
                              </span>
                            </div>
                            <div className="w-px h-6 bg-zinc-700/50" />

                            {/* Forma */}
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-[8px] uppercase tracking-widest text-zinc-500 font-black leading-none">
                                FORMA
                              </span>
                              <span className="text-[14px] leading-none">
                                {(p.form ?? 100) >= 115 ? "💪" : (p.form ?? 100) <= 85 ? "😩" : "👍"}
                              </span>
                            </div>
                            <div className="w-px h-6 bg-zinc-700/50" />

                            {/* Qualidade */}
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="text-[8px] uppercase tracking-widest text-zinc-400 font-black leading-none">
                                Qualidade
                              </span>
                              <span
                                className={`text-[16px] font-black tabular-nums leading-none px-2.5 py-1 rounded-lg border ${
                                  (p.skill ?? 0) >= 40
                                    ? "bg-green-500/15 text-green-300 border-green-500/30"
                                    : (p.skill ?? 0) >= 25
                                      ? "bg-yellow-500/15 text-yellow-300 border-yellow-500/30"
                                      : "bg-red-500/15 text-red-300 border-red-500/30"
                                }`}
                                style={{
                                  textShadow:
                                    (p.skill ?? 0) >= 40
                                      ? "0 0 12px rgba(34,197,94,0.35)"
                                      : (p.skill ?? 0) >= 25
                                        ? "0 0 12px rgba(234,179,8,0.35)"
                                        : "0 0 12px rgba(239,68,68,0.35)",
                                }}
                              >
                                {p.skill ?? "–"}
                              </span>
                            </div>
                        {/* Swap-out indicator */}
                        {isHalftime && !isPenalty && (
                          <span
                            className={`text-sm shrink-0 transition-colors ml-1 ${
                              selected
                                ? "text-rose-400"
                                : disabled
                                  ? "text-zinc-700"
                                  : "text-zinc-500 group-hover:text-emerald-400"
                            }`}
                          >
                            ↔
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
                {onPitchPlayers.length === 0 && (
                  <p className="text-center text-zinc-600 text-xs font-bold py-6">
                    Sem opções em campo
                  </p>
                )}
                    </div>
                  </div>

                  {/* Right: Suplentes */}
                  {!isPenalty && (
                    <div className="flex flex-col min-h-0 overflow-hidden">
                      <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-zinc-800/60 bg-zinc-950/60">
                        <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-black">
                          Suplentes
                        </span>
                      </div>
                      <div className="flex-1 overflow-y-auto">
                        {benchPlayers.map((p) => {
                          const alreadyUsed =
                            isHalftime && subbedOut.includes(p.id);
                          const positionMismatch =
                            !!sourcePlayer &&
                            (sourcePlayer.position === "GR") !== (p.position === "GR");
                          const disabled =
                            alreadyUsed ||
                            positionMismatch ||
                            (isHalftime && subsMade >= MAX_MATCH_SUBS);
                          const selected = selectedInId === p.id;
                          const accent = posAccent(p.position);
                          return (
                            <button
                              key={p.id}
                              onClick={() => !disabled && handlePickIn(p)}
                              className={`w-full flex items-center gap-3 px-4 py-3 border-b border-zinc-800/25 text-left select-none transition-all ${
                                alreadyUsed
                                  ? "opacity-25 cursor-not-allowed"
                                  : selected
                                    ? "bg-emerald-500/10"
                                    : disabled
                                      ? "opacity-40 cursor-not-allowed"
                                      : "cursor-pointer hover:bg-zinc-800/30"
                              }`}
                            >
                              <span
                                className={`shrink-0 px-2 py-1 rounded-md text-[9px] font-black border ${
                                  alreadyUsed
                                    ? "border-zinc-700/50 text-zinc-600"
                                    : selected
                                      ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/40"
                                      : ""
                                }`}
                                style={
                                  alreadyUsed || selected
                                    ? {}
                                    : {
                                        color: accent,
                                        borderColor: `${accent}35`,
                                        background: `${accent}12`,
                                      }
                                }
                              >
                                {POSITION_SHORT_LABELS[p.position]}
                              </span>
                              <span
                                className={`flex-1 truncate text-[12px] font-black ${
                                  alreadyUsed
                                    ? "text-zinc-600"
                                    : selected
                                      ? "text-emerald-100"
                                      : "text-zinc-100"
                                }`}
                              >
                                {p.name}
                                {!!p.is_star &&
                                  (p.position === "MED" || p.position === "ATA") && (
                                    <span className="ml-0.5 text-amber-400 font-black">
                                      *
                                    </span>
                                  )}
                              </span>
                              <div className="shrink-0 flex items-center gap-1.5">
                                {alreadyUsed ? (
                                  <span className="text-[10px] text-zinc-700 font-black">—</span>
                                ) : (
                                  <>
                                    {/* Resistência */}
                                    <div className="flex flex-col items-end gap-0.5">
                                      <span className="text-[8px] uppercase tracking-widest text-zinc-500 font-black leading-none">
                                        RES
                                      </span>
                                      <span
                                        className={`text-[14px] font-black tabular-nums leading-none ${
                                          (p.resistance ?? 0) >= 4
                                            ? "text-green-400"
                                            : (p.resistance ?? 0) >= 3
                                              ? "text-yellow-400"
                                              : "text-red-400"
                                        }`}
                                      >
                                        {p.resistance ?? "–"}
                                      </span>
                                    </div>
                                    <div className="w-px h-6 bg-zinc-700/50" />

                                    {/* Forma */}
                                    <div className="flex flex-col items-center gap-0.5">
                                      <span className="text-[8px] uppercase tracking-widest text-zinc-500 font-black leading-none">
                                        FORMA
                                      </span>
                                      <span className="text-[14px] leading-none">
                                        {(p.form ?? 100) >= 115 ? "💪" : (p.form ?? 100) <= 85 ? "😩" : "👍"}
                                      </span>
                                    </div>
                                    <div className="w-px h-6 bg-zinc-700/50" />

                                    {/* Qualidade */}
                                    <div className="flex flex-col items-end gap-0.5">
                                      <span className="text-[8px] uppercase tracking-widest text-zinc-400 font-black leading-none">
                                        Qualidade
                                      </span>
                                      <span
                                        className={`text-[16px] font-black tabular-nums leading-none px-2.5 py-1 rounded-lg border ${
                                          (p.skill ?? 0) >= 40
                                            ? "bg-green-500/15 text-green-300 border-green-500/30"
                                            : (p.skill ?? 0) >= 25
                                              ? "bg-yellow-500/15 text-yellow-300 border-yellow-500/30"
                                              : "bg-red-500/15 text-red-300 border-red-500/30"
                                        }`}
                                        style={{
                                          textShadow:
                                            (p.skill ?? 0) >= 40
                                              ? "0 0 12px rgba(34,197,94,0.35)"
                                              : (p.skill ?? 0) >= 25
                                                ? "0 0 12px rgba(234,179,8,0.35)"
                                                : "0 0 12px rgba(239,68,68,0.35)",
                                        }}
                                      >
                                        {p.skill ?? "–"}
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>
                            </button>
                          );
                        })}
                        {benchPlayers.length === 0 && (
                          <p className="text-center text-zinc-600 text-xs font-bold py-6">
                            Sem suplentes disponíveis
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Penalty info */}
                  {isPenalty && (
                    <div className="flex flex-col min-h-0 overflow-hidden">
                      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/60 bg-zinc-950/60">
                        <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">
                          Escolha
                        </span>
                      </div>
                      <div className="flex-1 flex items-center justify-center">
                        <p className="text-center text-zinc-500 text-xs font-bold px-4">
                          Seleciona o marcador na coluna central.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
          </div>
        </div>


          ) : (
              <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                {/* Opponent header */}
                <div className="shrink-0 flex items-center gap-2 px-2.5 py-2 m-2 rounded-lg border border-zinc-800/60 bg-zinc-950/60">
                  <span
                    className="text-[10px] font-black uppercase tracking-[0.2em] truncate"
                    style={{ color: oppInfo?.color_primary || "#f59e0b" }}
                  >
                    {oppInfo?.name || "Adversário"}
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    {(oppFormation || oppStyleLabel) && (
                      <span className="text-[8px] font-black text-zinc-500 shrink-0">
                        {[oppFormation, oppStyleLabel]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-2 min-h-0 overflow-hidden">
                  {/* Left: Pitch */}
                  <div className="flex items-center justify-center p-2 overflow-hidden border-r border-zinc-800/60">
                    {!hasLineups ? (
                  <div className="rounded-lg border border-zinc-800/40 bg-zinc-950/40 py-8 flex flex-col items-center gap-2">
                    <span className="text-3xl text-zinc-700">📋</span>
                    <p className="text-zinc-500 text-xs font-bold text-center px-4">
                      Escalações indisponíveis durante a simulação
                    </p>
                  </div>
                ) : oppStarters.length === 0 ? (
                  <div className="rounded-lg border border-zinc-800/40 bg-zinc-950/40 py-8 flex flex-col items-center gap-2">
                    <span className="text-3xl text-zinc-700">🤷</span>
                    <p className="text-zinc-500 text-xs font-bold text-center px-4">
                      Sem dados da escalação do adversário
                    </p>
                  </div>
                ) : (
                  /* Pitch SVG */
                  <div
                    className="relative rounded-lg overflow-hidden border border-zinc-800/60 bg-[linear-gradient(180deg,#05430e_0%,#0b5e1a_50%,#05430e_100%)] shadow-[0_0_30px_rgba(5,67,14,0.3)]"
                    style={{ aspectRatio: "9/16", maxHeight: "380px" }}
                  >
                    <svg
                      className="absolute inset-0 w-full h-full"
                      viewBox="0 0 315 560"
                      preserveAspectRatio="xMidYMid meet"
                      aria-hidden="true"
                    >
                      <rect x="10" y="10" width="295" height="540" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" rx="3" />
                      <line x1="10" y1="280" x2="305" y2="280" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
                      <circle cx="157" cy="280" r="50" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                      <circle cx="157" cy="280" r="3" fill="rgba(255,255,255,0.25)" />
                      <rect x="25" y="10" width="265" height="150" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                      <rect x="85" y="10" width="145" height="40" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
                      <rect x="25" y="400" width="265" height="150" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                      <rect x="85" y="510" width="145" height="40" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
                    </svg>

                    {["GR", "DEF", "MED", "ATA"].map((key) => {
                      const rowPlayers = oppPositionRows[key] || [];
                      if (rowPlayers.length === 0) return null;
                      return (
                        <div
                          key={key}
                          className="absolute w-full flex justify-evenly items-start px-3"
                          style={{
                            top:
                              key === "GR"
                                ? "8%"
                                : key === "DEF"
                                  ? "31%"
                                  : key === "MED"
                                    ? "56%"
                                    : "81%",
                          }}
                        >
                          {rowPlayers.map((player) => (
                            <div
                              key={player.id ?? player.name}
                              className="flex flex-col items-center gap-0.5"
                              style={{ maxWidth: "90px" }}
                            >
                              <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-[10px] border border-white/30 shadow-lg ${oppPosColors[player.position] || "bg-zinc-500 text-white"}`}
                              >
                                {POSITION_SHORT_LABELS[player.position] || "?"}
                              </div>
                              <div
                                className="bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-[9px] font-black text-white text-center truncate"
                                style={{ maxWidth: "85px" }}
                              >
                                {player.name}
                                {!!player.is_star &&
                                  (player.position === "MED" ||
                                    player.position === "ATA") && (
                                    <span className="ml-0.5 text-amber-400">
                                      *
                                    </span>
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

                    <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/40 to-transparent" />
                  </div>
                )}
                  </div>

                  {/* Right: Opponent bench */}
                  <div className="flex flex-col min-h-0 overflow-hidden">
                    <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-zinc-800/60 bg-zinc-950/60">
                      <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-black">
                        Banco Adversário
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {!hasLineups || oppBench.length === 0 ? (
                        <p className="text-center text-zinc-600 text-xs font-bold py-6 px-2">
                          Sem dados do banco adversário
                        </p>
                      ) : (
                        oppBench.map((player) => (
                          <div
                            key={player.id ?? player.name}
                            className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/25"
                          >
                            <span
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-black border border-white/20 shrink-0 ${oppPosColors[player.position] || "bg-zinc-500 text-white"}`}
                            >
                              {POSITION_SHORT_LABELS[player.position] || "?"}
                            </span>
                            <span className="flex-1 truncate text-[12px] font-black text-zinc-300">
                              {player.name}
                              {!!player.is_star &&
                                (player.position === "MED" ||
                                  player.position === "ATA") && (
                                  <span className="ml-0.5 text-amber-400 font-black">
                                    *
                                  </span>
                                )}
                            </span>
                            <span className="text-[11px] font-black tabular-nums text-zinc-400 shrink-0">
                              {player.skill ?? "—"}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
          )}
        </div>
      </div>

      {/* ═══ BOTTOM BAR — Confirmation ═══════════════════════════ */}
      <div className="shrink-0 border-t border-zinc-800/60 bg-zinc-950/80 backdrop-blur-sm px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <span className="text-[10px] text-zinc-600 shrink-0 font-black uppercase tracking-wide">
              Sai
            </span>
            <span className="bg-rose-950/80 text-rose-200 border border-rose-800/50 text-[11px] font-black px-3 py-1.5 rounded-lg truncate max-w-[35%]">
              {effectiveOutId ? sourcePlayer?.name || "?" : "—"}
            </span>
            {!isPenalty && (
              <>
                <span className="text-zinc-500 shrink-0 font-black text-base">→</span>
                <span className="text-[10px] text-zinc-600 shrink-0 font-black uppercase tracking-wide">
                  Entra
                </span>
                <span className="bg-emerald-950/80 text-emerald-200 border border-emerald-800/50 text-[11px] font-black px-3 py-1.5 rounded-lg truncate max-w-[35%]">
                  {selectedInId ? targetPlayer?.name || "?" : "—"}
                </span>
              </>
            )}
          </div>

          {isHalftime ? (
            <>
              <button
                onClick={onResetSub}
                className="shrink-0 w-8 h-8 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-500 hover:text-white text-sm flex items-center justify-center transition-colors border border-zinc-700/50"
              >
                ✕
              </button>
              <button
                onClick={onConfirmSub}
                disabled={!canConfirmSwap}
                className={`shrink-0 px-5 py-2 rounded-lg text-[11px] font-black uppercase tracking-wide transition-all border ${
                  canConfirmSwap
                    ? "bg-emerald-600/90 border-emerald-400/40 text-white shadow-[0_0_16px_rgba(16,185,129,0.25)] hover:bg-emerald-500/90"
                    : "bg-zinc-800/80 border-zinc-700/50 text-zinc-600 cursor-not-allowed"
                }`}
              >
                Substituir
              </button>
            </>
          ) : (
            <button
              disabled={isPenalty ? !effectiveOutId : !canConfirmSwap}
              onClick={() =>
                isPenalty
                  ? onResolveAction(effectiveOutId || null)
                  : onResolveAction({
                      playerOut: effectiveOutId,
                      playerIn: selectedInId,
                    })
              }
              className="shrink-0 px-5 py-2 rounded-lg text-[11px] font-black uppercase tracking-wide bg-primary/90 hover:brightness-110 text-on-primary disabled:opacity-50 disabled:cursor-not-allowed border border-primary/40 shadow-[0_0_16px_rgba(99,102,241,0.2)]"
            >
              Substituir
            </button>
          )}
        </div>
      </div>

      {/* Reset all subs (halftime) */}
      {isHalftime && confirmedSubs.length > 0 && (
        <div className="shrink-0 border-t border-zinc-800/30 px-5 py-2 flex justify-center bg-zinc-950/50">
          <button
            onClick={onResetAllSubs}
            className="text-[10px] font-black uppercase tracking-[0.25em] text-rose-400/80 hover:text-rose-300 transition-colors"
          >
            ↺ Anular todas as substituições
          </button>
        </div>
      )}
    </div>
  );
}
