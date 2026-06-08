import { useState } from "react";
import { getPosStyle, PITCH_POS_COLORS, buildPositionRows, filterMatchEvents } from "../matchConstants.js";
import {
  PitchFormation,
  PossessionBar,
  EventCard,
  RefWeatherBar,
  BenchPlayers,
} from "../shared/index.js";

/* ── MatchView — Main match view (2 columns: narrative + pitch) ─────── */
export function MatchView({ fixture, liveMinute, teams, mode }) {
  const [pitchSide, setPitchSide] = useState("home");

  if (!fixture) return null;

  const hInfo = teams.find((t) => t.id === fixture.homeTeamId);
  const aInfo = teams.find((t) => t.id === fixture.awayTeamId);
  const evts = fixture.events || [];

  const visibleEvts = filterMatchEvents(evts, liveMinute);
  const ref = fixture.referee;
  const weatherEvent = evts.find((e) => e.type === "weather");
  const isHalftime = mode === "halftime";
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
      {/* ── Halftime score banner ──────────────────────────────────── */}
      {isHalftime && (
        <div className="shrink-0 p-3">
          <HalftimeBanner
            hInfo={hInfo}
            aInfo={aInfo}
            homeGoals={fixture.finalHomeGoals ?? 0}
            awayGoals={fixture.finalAwayGoals ?? 0}
          />
        </div>
      )}

      {/* ── 2-column layout ────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ═══ LEFT: Narrative ═══ */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <RefWeatherBar
            attendance={fixture.attendance}
            referee={ref}
            weatherEvent={weatherEvent}
            teamStadium={hInfo?.stadium_name}
          />

          <PossessionBar
            homePossession={fixture.homePossession}
            awayPossession={fixture.awayPossession}
            homeColor={hInfo?.color_primary}
            awayColor={aInfo?.color_primary}
          />

          <EventList events={visibleEvts} hInfo={hInfo} aInfo={aInfo} />
        </div>

        {/* ═══ RIGHT: Pitch + Bench ═══ */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Team toggle badges */}
          <div className="shrink-0 flex items-center gap-2 px-3 py-2.5 bg-surface-container-high/50">
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

          {/* Pitch */}
          <div className="flex gap-3 flex-1 min-h-0">
            <div className="flex-1 relative rounded-md overflow-hidden border border-outline-variant/25 bg-[linear-gradient(180deg,#05430e_0%,#0b5e1a_50%,#05430e_100%)] shadow-[0_0_30px_rgba(5,67,14,0.3)]" style={{ aspectRatio: "9/16", maxHeight: "420px" }}>
              {hasLineups ? (
                <>
                  <PitchFormation rows={rows} posColors={posColors} withOverlay={false} />
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/40 to-transparent" />
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-on-surface-variant/60 text-xs font-bold">Sem escalação disponível</p>
                </div>
              )}
            </div>

            {/* Bench */}
            {hasLineups && (
              <div className="flex-1 flex flex-col">
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 px-1">
                  Suplentes
                </p>
                <BenchPlayers players={bench} posStyleFn={getPosStyle} />
              </div>
            )}
          </div>
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
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-black uppercase tracking-widest transition-all border ${
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

function HalftimeBanner({ hInfo, aInfo, homeGoals, awayGoals }) {
  return (
    <div className="rounded-md overflow-hidden border border-outline-variant/25 bg-surface-container-low shadow-sm shadow-black/30">
      <div className="flex items-center justify-center gap-5 pt-4 pb-1.5">
        <TeamMiniBadge info={hInfo} />
        <div className="flex items-center gap-2.5">
          <span className="text-3xl font-black font-headline tabular-nums text-on-surface tracking-tighter">
            {homeGoals}
          </span>
          <span className="text-on-surface-variant/60 text-lg font-black">—</span>
          <span className="text-3xl font-black font-headline tabular-nums text-on-surface tracking-tighter">
            {awayGoals}
          </span>
        </div>
        <TeamMiniBadge info={aInfo} />
      </div>
      <div className="flex items-center justify-center pb-3.5">
        <span className="inline-flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.3em] px-2.5 py-1 rounded-full bg-surface-container-high/80 border border-outline-variant/25 text-on-surface-variant">
          <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" />
          Intervalo
          <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" />
        </span>
      </div>
    </div>
  );
}

function TeamMiniBadge({ info }) {
  return (
    <div className="flex flex-col items-center gap-1 min-w-0 max-w-[30%]">
      <span
        className="w-3 h-3 rounded-full shrink-0"
        style={{ background: info?.color_primary || "#6366f1", boxShadow: `0 0 10px ${info?.color_primary || "#6366f1"}80` }}
      />
      <span className="text-[9px] font-black text-on-surface-variant truncate text-center leading-tight uppercase tracking-[0.15em]">
        {info?.name || "—"}
      </span>
    </div>
  );
}

function EventList({ events, hInfo, aInfo }) {
  if (events.length === 0) {
    return (
      <div className="rounded-md border border-outline-variant/25 bg-surface-container py-12 flex flex-col items-center gap-2">
        <span className="text-3xl text-on-surface-variant/40">⚽</span>
        <p className="text-on-surface-variant/60 text-xs font-bold">Sem eventos a mostrar</p>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {events.map((e, i) => {
        const isHome = e.team === "home";
        const accent = (isHome ? hInfo : aInfo)?.color_primary;
        const teamName = (isHome ? hInfo : aInfo)?.name;
        return <EventCard key={i} event={e} accent={accent} showTeamBadge teamName={teamName} />;
      })}
    </div>
  );
}