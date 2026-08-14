import { useState } from "react";
import { getPosStyle, PITCH_POS_COLORS, buildPositionRows, filterMatchEvents } from "../matchConstants.js";
import {
  MatchPitch,
  PossessionBar,
  EventCard,
  RefWeatherBar,
  BenchPlayers,
} from "../shared/index.js";

/* ── MatchView — Main match view (2 columns: narrative + pitch) ─────── */
export function MatchView({ fixture, liveMinute, teams }) {
  const [pitchSide, setPitchSide] = useState("home");

  if (!fixture) return null;

  const hInfo = teams.find((t) => t.id === fixture.homeTeamId);
  const aInfo = teams.find((t) => t.id === fixture.awayTeamId);
  const evts = fixture.events || [];

  const visibleEvts = filterMatchEvents(evts, liveMinute);
  const ref = fixture.referee;
  const weatherEvent = evts.find((e) => e.type === "weather");
  const hasLineups = fixture?.homeLineup && fixture?.awayLineup;

  /* ── Pitch side data ──────────────────────────────────────────────── */

  const sideLineup = hasLineups
    ? pitchSide === "home"
      ? fixture.homeLineup
      : fixture.awayLineup
    : [];

  const starters = sideLineup.filter((p) => p.is_starter === true).slice(0, 11);
  const bench = sideLineup.filter((p) => p.is_starter === false);

  const rows = buildPositionRows(starters);
  const posColors = PITCH_POS_COLORS;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* ── Main layout: mobile = vertical stack, desktop = 2 columns ─────── */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-y-auto md:overflow-hidden">
        {/* ═══ LEFT (desktop) / TOP (mobile): Pitch + Bench ═══ */}
        <div className="flex flex-col min-h-0 md:flex-1 md:overflow-hidden">
          {/* Team toggle badges */}
          <div className="shrink-0 flex items-center gap-2 px-4 py-3 bg-surface-container-high/50 border-b border-outline-variant/15">
            <TeamBadge
              team={hInfo}
              side="home"
              active={pitchSide === "home"}
              onClick={() => setPitchSide("home")}
              label="Casa"
            />
            <TeamBadge
              team={aInfo}
              side="away"
              active={pitchSide === "away"}
              onClick={() => setPitchSide("away")}
              label="Fora"
            />
          </div>

          {/* Pitch + Bench: side by side on desktop, stacked on mobile */}
          <div className="flex flex-col md:flex-row gap-4 p-4 md:flex-1 md:min-h-0">
            {/* Pitch */}
            <div className="md:flex-1 md:min-h-0 md:min-w-0 md:flex md:items-center md:justify-center">
              <MatchPitch rows={rows} posColors={posColors} />
            </div>

            {/* Bench */}
            {hasLineups && (
              <div className="md:flex-1 md:min-h-0 md:max-w-[240px] md:overflow-y-auto flex flex-col">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant mb-2.5 px-1 shrink-0">
                  Suplentes
                </p>
                <BenchPlayers players={bench} posStyleFn={getPosStyle} />
              </div>
            )}
          </div>
        </div>

        {/* ═══ RIGHT (desktop) / BOTTOM (mobile): Narrative ═══
         * Each contextual block wrapped in its own card so they're visually
         * distinct (was: all three children stacked at space-y-3, which
         * blended the three info sources into a single block). */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 border-t md:border-t-0 md:border-l border-outline-variant/20 min-h-0">
          <div className="rounded-md overflow-hidden">
            <RefWeatherBar
              attendance={fixture.attendance}
              referee={ref}
              weatherEvent={weatherEvent}
              teamStadium={hInfo?.stadium_name}
            />
          </div>

          <PossessionBar
            homePossession={fixture.homePossession}
            awayPossession={fixture.awayPossession}
            homeColor={hInfo?.color_primary}
            awayColor={aInfo?.color_primary}
          />

          <EventList events={visibleEvts} hInfo={hInfo} aInfo={aInfo} />
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function TeamBadge({ team, active, onClick, label }) {
  const color = team?.color_primary || "#6366f1";
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-widest transition-all border ${
        active
          ? "bg-surface-container border-primary/60 text-on-surface shadow-[0_0_12px_rgba(99,102,241,0.2)]"
          : "bg-surface-container-low/40 border-outline-variant/25 text-on-surface-variant/70 hover:border-outline hover:text-on-surface-variant"
      }`}
    >
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
        style={{ background: color, boxShadow: active ? `0 0 8px ${color}80` : "none" }}
      />
      {team?.name || label}
    </button>
  );
}

/* ── EventList ─────────────────────────────────────────────────────────── */

function EventList({ events, hInfo, aInfo }) {
  if (events.length === 0) {
    return (
      <div className="rounded-md border border-outline-variant/25 bg-surface-container py-12 flex flex-col items-center gap-2">
        <span className="text-3xl text-on-surface-variant/40">⚽</span>
        <p className="text-on-surface-variant/60 text-xs font-medium">Sem eventos a mostrar</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {events.map((e, i) => {
        const isHome = e.team === "home";
        const accent = (isHome ? hInfo : aInfo)?.color_primary;
        const teamName = (isHome ? hInfo : aInfo)?.name;
        return <EventCard key={i} event={e} accent={accent} showTeamBadge teamName={teamName} />;
      })}
    </div>
  );
}
