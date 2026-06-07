import { POSITION_SHORT_LABELS } from "../../../constants/index.js";
import { getPosStyle } from "../matchConstants.js";
import {
  PitchFormation,
  PossessionBar,
  EventCard,
  RefWeatherBar,
  BenchPlayers,
} from "../shared/index.js";

const POS_ORDER = { GR: 0, DEF: 1, MED: 2, ATA: 3 };
const MATCH_EVENT_TYPES = [
  "goal", "penalty_goal", "own_goal", "penalty_miss",
  "yellow", "red", "injury", "substitution", "phase_start",
];

/* ── TabJogo — Match events, possession, commentary ─────────────────────── */
export function TabJogo({ fixture, liveMinute, teams, mode, myTeamId }) {
  if (!fixture) return null;
  const hInfo = teams.find((t) => t.id === fixture.homeTeamId);
  const aInfo = teams.find((t) => t.id === fixture.awayTeamId);
  const evts = fixture.events || [];

  const visibleEvts = evts
    .filter((e) => e.minute <= liveMinute && MATCH_EVENT_TYPES.includes(e.type))
    .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));

  const ref = fixture.referee;
  const weatherEvent = evts.find((e) => e.type === "weather");
  const homeGoals = fixture.finalHomeGoals ?? 0;
  const awayGoals = fixture.finalAwayGoals ?? 0;
  const isHalftime = mode === "halftime";
  const hasLineups = fixture?.homeLineup && fixture?.awayLineup;

  // ── Our team lineup ──────────────────────────────────────────────
  const isOurHome = fixture.homeTeamId === myTeamId;
  const ourLineup = hasLineups
    ? (isOurHome ? fixture.homeLineup : fixture.awayLineup) || []
    : [];

  const starters = ourLineup.filter((p) => p.is_starter === true).slice(0, 11);
  const bench = ourLineup.filter((p) => p.is_starter === false);

  const rows = {
    GR: starters.filter((p) => p.position === "GR"),
    DEF: starters.filter((p) => p.position === "DEF"),
    MED: starters.filter((p) => p.position === "MED"),
    ATA: starters.filter((p) => p.position === "ATA"),
  };

  const posColors = {
    GR: "bg-amber-500 text-zinc-950",
    DEF: "bg-sky-500 text-zinc-950",
    MED: "bg-emerald-500 text-zinc-950",
    ATA: "bg-rose-500 text-white",
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {isHalftime && (
        <div className="shrink-0 p-3">
          <div className="rounded-lg overflow-hidden border border-outline/40 bg-surface-container-low shadow-sm shadow-black/30">
            <div className="flex items-center justify-center gap-5 pt-4 pb-1.5">
              <TeamBadge info={hInfo} />
              <div className="flex items-center gap-2.5">
                <span className="text-3xl font-black font-headline tabular-nums text-on-surface tracking-tighter">{homeGoals}</span>
                <span className="text-on-surface-variant/60 text-lg font-black">—</span>
                <span className="text-3xl font-black font-headline tabular-nums text-on-surface tracking-tighter">{awayGoals}</span>
              </div>
              <TeamBadge info={aInfo} />
            </div>
            <div className="flex items-center justify-center pb-3.5">
              <span className="inline-flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.3em] px-2.5 py-1 rounded-full bg-surface-container-high/80 border border-outline/40 text-on-surface-variant">
                <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" />
                Intervalo
                <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" />
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ═══ COLUNA 1: Info + Possessão + Cronologia + Narração ═══ */}
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

          <Commentary events={evts} liveMinute={liveMinute} />
        </div>

        {/* ═══ COLUNA 2: Pitch + Suplentes ═══ */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden border-l border-outline/40">
          <div className="flex gap-3 flex-1 min-h-0">
            <div className="flex-1 relative rounded-lg overflow-hidden border border-outline/40 bg-[linear-gradient(180deg,#05430e_0%,#0b5e1a_50%,#05430e_100%)] shadow-[0_0_30px_rgba(5,67,14,0.3)]" style={{ aspectRatio: "9/16", maxHeight: "420px" }}>
              <PitchFormation rows={rows} posColors={posColors} />
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/40 to-transparent" />
            </div>

            <BenchSection players={bench} hasLineups={hasLineups} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function TeamBadge({ info }) {
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
      <div className="rounded-lg border border-outline-variant/25 bg-surface-container py-12 flex flex-col items-center gap-2">
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
        return <EventCard key={i} event={e} accent={accent} showTeamBadge />;
      })}
    </div>
  );
}

function Commentary({ events, liveMinute }) {
  const commentary = events
    .filter((e) => e.minute <= liveMinute && e.text)
    .sort((a, b) => (b.minute ?? 0) - (a.minute ?? 0));
  if (commentary.length === 0) return null;

  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 px-1">Narração</p>
      <div className="space-y-1.5">
        {commentary.slice(0, 20).map((e, i) => {
          const phrase = e.text.replace(/^\[(?:\d+'|HT)\]\s*\S*\s*/, "").trim();
          if (!phrase) return null;
          return (
            <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg border border-outline-variant/25 bg-surface-container">
              <span className="text-on-surface-variant/60 font-black text-[10px] w-7 shrink-0 text-right pt-px tabular-nums">
                {e.minute != null ? `${e.minute}'` : "—"}
              </span>
              <span className="w-5 shrink-0 text-center text-sm pt-px">{e.emoji || ""}</span>
              <span className="flex-1 text-[11px] text-on-surface-variant leading-relaxed">{phrase}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BenchSection({ players, hasLineups }) {
  if (!hasLineups) return null;
  if (players.length === 0) {
    return (
      <div className="flex-1 flex flex-col">
        <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 px-1">Suplentes</p>
        <p className="text-center text-on-surface-variant/60 text-xs font-bold py-6 px-2">Sem suplentes disponíveis</p>
      </div>
    );
  }
  return (
    <div className="flex-1 flex flex-col">
      <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 px-1">Suplentes</p>
      <div className="flex-1 overflow-y-auto space-y-1">
        {players.map((player) => (
          <BenchPlayerCard key={player.id ?? player.name} player={player} />
        ))}
      </div>
    </div>
  );
}

function BenchPlayerCard({ player }) {
  const s = getPosStyle(player.position);
  return (
    <div
      className={`relative group flex items-stretch rounded-lg overflow-hidden border border-outline-variant/25 bg-gradient-to-r ${s.bgGrad} via-surface-container/70 to-surface/30 transition-all duration-200 hover:-translate-y-px hover:shadow-lg ${s.glow} shadow-sm shadow-black/30`}
    >
      <div className={`shrink-0 w-1 bg-gradient-to-b ${s.bar}`} />
      <div className="flex items-center gap-2 flex-1 py-1.5 px-2.5">
        <span className={`shrink-0 px-1.5 py-px rounded text-[9px] font-black uppercase tracking-widest border ${s.badgeBg} ${s.badgeText} ${s.badgeBorder}`}>
          {POSITION_SHORT_LABELS[player.position] || "?"}
        </span>
        <span className="flex-1 truncate text-[10px] font-black text-on-surface">
          {player.name}
          {!!player.is_star && (player.position === "MED" || player.position === "ATA") && (
            <span className="ml-0.5 text-amber-400 font-black">*</span>
          )}
        </span>
        <span className="text-[9px] font-black tabular-nums text-on-surface-variant/80 shrink-0">
          {player.skill ?? "—"}
        </span>
      </div>
    </div>
  );
}
