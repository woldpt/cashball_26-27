import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { getPosStyle, PITCH_POS_COLORS, buildPositionRows, filterMatchEvents } from "../matchConstants.js";
import { CUP_FINAL_STADIUM } from "../../../constants/index.js";
import {
  MatchPitch,
  PitchFormation,
  PossessionBar,
  EventCard,
  RefWeatherBar,
  BenchPlayers,
  MatchScoreboard,
} from "../shared/index.js";

/* ── MatchView — vista principal do jogo ──────────────────────────────
 * Dois modos:
 *  - legacy (jogo próprio): separadores por equipa + pitch único + banco;
 *  - spectate (jogo alheio, prop `spectate`): placar broadcast + dois
 *    pitches em simultâneo (empilhados < lg, lado a lado >= lg), sem
 *    separadores nem bancos.
 */
/** fixture (destaque), liveMinute, teams, isCupMatch, cupMatchRoundName, showFatigue (jogo próprio), spectate (jogo alheio: dual-pitch sem bancos). */
export function MatchView({ fixture, liveMinute, teams, isCupMatch, cupMatchRoundName, showFatigue = true, spectate = false }) {
  const [pitchSide, setPitchSide] = useState("home");

  if (!fixture) return null;

  const hInfo = teams.find((t) => t.id === fixture.homeTeamId);
  const aInfo = teams.find((t) => t.id === fixture.awayTeamId);
  const isCupFinal = isCupMatch && cupMatchRoundName === "Final";
  const stadiumName = isCupFinal ? CUP_FINAL_STADIUM : hInfo?.stadium_name;
  const evts = fixture.events || [];

  const visibleEvts = filterMatchEvents(evts, liveMinute);
  const ref = fixture.referee;
  const weatherEvent = evts.find((e) => e.type === "weather");
  const hasLineups = fixture?.homeLineup && fixture?.awayLineup;
  const posColors = PITCH_POS_COLORS;

  // ── Modo spectate (jogo alheio): scoreboard + dois pitches, sem bancos ─
  if (spectate) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Placar broadcast fixo no topo do painel */}
        <MatchScoreboard fixture={fixture} teams={teams} liveMinute={liveMinute} />

        <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
          {/* Pitches — empilhados < lg; lado a lado (2 colunas) >= lg */}
          <div className="grid grid-cols-1 gap-4 p-4 min-w-0 lg:flex-1 lg:min-h-0 lg:grid-cols-2 lg:auto-rows-fr">
            <SpectatePitchCard side="home" team={hInfo} lineup={hasLineups ? fixture.homeLineup : []} posColors={posColors} delay={0.05} />
            <SpectatePitchCard side="away" team={aInfo} lineup={hasLineups ? fixture.awayLineup : []} posColors={posColors} delay={0.15} />
          </div>

          {/* Coluna contextual — estádio/árbitro/clima + eventos */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
            className="flex flex-col gap-3 px-4 pb-4 lg:w-[340px] lg:flex-none lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-outline-variant/20"
          >
            <RefWeatherBar attendance={fixture.attendance} referee={ref} weatherEvent={weatherEvent} teamStadium={stadiumName} />
            <div className="flex flex-col gap-1 px-1 pt-1 pb-3 border-b border-outline-variant/20">
              <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Eventos</p>
              <EventList events={visibleEvts} hInfo={hInfo} aInfo={aInfo} />
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Modo legacy (jogo próprio): separadores + pitch único + banco ─────
  const sideLineup = hasLineups ? (pitchSide === "home" ? fixture.homeLineup : fixture.awayLineup) : [];
  const starters = sideLineup.filter((p) => p.is_starter === true).slice(0, 11);
  const bench = sideLineup.filter((p) => p.is_starter === false);
  const rows = buildPositionRows(starters);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Main content area */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-y-auto md:overflow-hidden">
        {/* LEFT: team toggle + pitch */}
        <div className="flex flex-col min-h-0 md:flex-1 md:overflow-hidden">
          {/* Team selector tabs */}
          <div className="shrink-0 bg-surface-container p-3 md:p-4 border-b border-outline-variant/25">
            <div className="flex gap-2 mb-3">
              {[
                { side: "home", label: hInfo?.name || "Equipa A", color: hInfo?.color_primary || "#6366f1" },
                { side: "away", label: aInfo?.name || "Equipa B", color: aInfo?.color_primary || "#f43f5e" },
              ].map(({ side, label, color }) => (
                <button key={side} onClick={() => setPitchSide(side)} className={`relative flex-1 px-3 py-2.5 rounded-lg border text-[10px] md:text-sm font-black uppercase tracking-wider transition-all duration-200 overflow-hidden ${pitchSide === side ? "bg-surface-container-high border-outline" : "border-transparent text-on-surface-variant hover:bg-surface-container-low opacity-60"}`}>
                  <span className={`absolute inset-x-0 top-0 h-[3px] rounded-t-lg ${pitchSide === side ? "opacity-100" : "opacity-40"}`} style={{ background: color, boxShadow: `0 0 8px ${color}80` }} />
                  <span className="relative z-10">{label}</span>
                </button>
              ))}
            </div>

          </div>

          {/* Pitch + Bench side by side on desktop */}
          <div className="flex flex-col md:flex-row gap-4 p-4 md:flex-1 md:min-h-0">
            {/* Pitch */}
            <div className="relative w-full max-w-[280px] mx-auto rounded-md overflow-hidden border border-white/10 bg-[linear-gradient(180deg,#05430e_0%,#0b5e1a_50%,#05430e_100%)] shadow-[0_0_30px_rgba(5,67,14,0.3)] md:w-auto md:h-full md:max-w-full">
              {hasLineups ? (
                <MatchPitch rows={rows} posColors={posColors} showFatigue={showFatigue} />
              ) : (
                <div className="flex flex-col items-center justify-center h-64 gap-2 px-4">
                  <p className="text-on-surface-variant/60 text-xs font-bold uppercase tracking-wider text-center">Sem escalação disponível</p>
                </div>
              )}
            </div>

            {/* Bench */}
            {showFatigue && (
              <div className="w-full md:w-48 shrink-0 flex flex-col min-h-0">
                <BenchPlayers bench={bench} posStyleFn={getPosStyle} />
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: weather + possession + events */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 border-t border-outline-variant/25 md:border-t-0 md:border-l">
          <RefWeatherBar attendance={fixture.attendance} referee={ref} weatherEvent={weatherEvent} teamStadium={stadiumName} />

          {/* Possession */}
          <div className="rounded-md overflow-hidden">
            <PossessionBar homePct={fixture.homePossession} awayPct={fixture.awayPossession} hInfo={hInfo} aInfo={aInfo} />
          </div>

          <div className="flex flex-col gap-1 px-1 py-0.5 border-b border-outline-variant/20 pb-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Eventos</p>
            {/* Events list */}
            <EventList events={visibleEvts} hInfo={hInfo} aInfo={aInfo} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── SpectatePitchCard — card de pitch com identidade da equipa (spectate)
 * Mobile: width-driven (cap 280px, como o MatchPitch legado).
 * >= lg: height-driven (preenche o slot do grid; largura segue 9:16). */
/** side (home|away), team (info/ cor da equipa), lineup, posColors, delay (stagger de entrada). */
function SpectatePitchCard({ side, team, lineup, posColors, delay = 0 }) {
  const color = team?.color_primary || "#6366f1";
  const starters = (lineup || []).filter((p) => p.is_starter === true).slice(0, 11);
  const rows = buildPositionRows(starters);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: "easeOut" }}
      className="flex flex-col min-w-0 rounded-lg overflow-hidden border bg-surface-container lg:min-h-0"
      style={{ borderColor: `${color}59`, boxShadow: `0 0 28px ${color}1a` }}
    >
      {/* Accent strip na cor da equipa */}
      <div className="h-1 w-full shrink-0" style={{ background: `linear-gradient(90deg, ${color}cc, transparent)` }} />

      {/* Header do card */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-surface-container-high/60 border-b border-outline-variant/20">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 6px ${color}80` }} />
        <span className="text-xs font-black uppercase tracking-wide text-on-surface truncate">{team?.name || "—"}</span>
        <span
          className="ml-auto shrink-0 px-1.5 py-0.5 rounded border text-[9px] font-black uppercase tracking-widest"
          style={{ color, borderColor: `${color}66`, backgroundColor: `${color}14` }}
        >
          {side === "home" ? "Casa" : "Fora"}
        </span>
      </div>

      {/* Pitch */}
      <div className="flex-1 min-h-0 p-2 sm:p-3 flex items-center justify-center">
        <div
          className="relative w-full max-w-[280px] mx-auto rounded-md overflow-hidden border border-white/10 bg-[linear-gradient(180deg,#05430e_0%,#0b5e1a_50%,#05430e_100%)] shadow-[0_0_30px_rgba(5,67,14,0.3)] lg:mx-0 lg:w-auto lg:h-full lg:max-w-full"
          style={{ aspectRatio: "9/16" }}
        >
          {starters.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-on-surface-variant/60 text-xs font-bold uppercase tracking-wider text-center px-4">Sem escalação disponível</p>
            </div>
          ) : (
            <PitchFormation rows={rows} posColors={posColors} showFatigue={false} />
          )}
        </div>
      </div>
    </motion.div>
  );
}

/** events (visíveis até liveMinute), hInfo, aInfo — lista cronológica com reveal. */
function EventList({ events, hInfo, aInfo }) {
  const [revealedCount, setRevealedCount] = useState(0);
  const totalRef = useRef(0);

  useEffect(() => {
    if (totalRef.current < events.length) {
      totalRef.current = events.length;
      // reveal in stagger after mount
      setTimeout(() => setRevealedCount(events.length), 50);
    }
  }, [events.length]);

  return (
    <div className="flex flex-col gap-1">
      {[...events].reverse().map((evt, i) => {
        const fromEnd = events.length - 1 - i;
        const revealed = fromEnd < revealedCount;
        // reveal top-down: stagger per index from top
        const delay = (events.length - 1 - i) * 60;
        const info = evt.team === "home" ? hInfo : aInfo;
        return (
          <motion.div key={`${evt.minute}-${i}`} initial={false} animate={{ opacity: revealed ? 1 : 0.35, y: 0 }} transition={{ duration: 0.35, delay: revealed ? 0 : delay }}>
            <EventCard event={evt} accent={info?.color_primary} showTeamBadge teamName={info?.name} />
          </motion.div>
        );
      })}
    </div>
  );
}
