import { useState } from "react";
import { DIVISION_NAMES } from "../constants/index.js";
import { formatCurrency } from "../utils/formatters.js";
import { TabBar } from "../components/shared/TabBar.jsx";

const EVENT_META = {
  transfer_in: {
    icon: "south_west",
    color: "text-emerald-400",
    chip: "bg-emerald-500/15 text-emerald-400",
    label: "Contratação",
  },
  transfer_out: {
    icon: "north_east",
    color: "text-red-400",
    chip: "bg-red-500/15 text-red-400",
    label: "Saída",
  },
  auction_won: {
    icon: "gavel",
    color: "text-amber-400",
    chip: "bg-amber-500/15 text-amber-400",
    label: "Leilão",
  },
  prize: {
    icon: "emoji_events",
    color: "text-amber-400",
    chip: "bg-amber-500/15 text-amber-400",
    label: "Prémio",
  },
  manager_dismissed: {
    icon: "person_remove",
    color: "text-rose-400",
    chip: "bg-rose-500/15 text-rose-400",
    label: "Despedimento de treinador",
  },
  manager_hired: {
    icon: "person_add",
    color: "text-sky-400",
    chip: "bg-sky-500/15 text-sky-400",
    label: "Novo treinador",
  },
};

const EVENT_GROUPS = {
  market: ["transfer_in", "transfer_out", "auction_won"],
  managers: ["manager_dismissed", "manager_hired"],
  prize: ["prize"],
};

const GAME_CHIP = {
  league: "bg-primary/20 text-primary",
  cup: "bg-amber-500/20 text-amber-400",
  friendly: "bg-sky-500/20 text-sky-400",
};

const GAME_LABEL = {
  league: "Liga",
  cup: "Taça",
  friendly: "Amigável",
};

/**
 * @param {{
 *   selectedTeam: object|null,
 *   clubHistory: object|null,
 *   clubHistoryTeamId: number|null,
 * }} props
 */
export function TeamHistoryView({ selectedTeam, clubHistory, clubHistoryTeamId }) {
  const [gamesFilter, setGamesFilter] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");
  const crest = selectedTeam?.crest ?? null;
  const [badCrest, setBadCrest] = useState(null);
  const crestOk = Boolean(crest) && badCrest !== crest;

  if (!clubHistory || clubHistoryTeamId !== selectedTeam?.id) {
    return (
      <div className="p-8 text-center text-on-surface-variant font-bold">
        A carregar histórico...
      </div>
    );
  }

  const { trophies = [], events = [], seasonRecords = [], games = [] } = clubHistory;
  const hasAnything =
    trophies.length > 0 ||
    events.length > 0 ||
    seasonRecords.length > 0 ||
    games.length > 0;

  const bestSeason = [...seasonRecords].sort(
    (a, b) => a.position - b.position || b.season - a.season,
  )[0];

  const filteredGames =
    gamesFilter === "all" ? games : games.filter((g) => g.kind === gamesFilter);
  const filteredEvents =
    eventFilter === "all"
      ? events
      : events.filter((e) => (EVENT_GROUPS[eventFilter] || []).includes(e.type));

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* ── CABEÇALHO ────────────────────────────────────────── */}
      <header
        className="relative overflow-hidden rounded-lg border border-outline-variant/10 px-4 py-4 sm:px-5"
        style={{
          background: selectedTeam?.color_primary || "#18181b",
        }}
      >
        {/* Brilho ambiente */}
        <div
          className="pointer-events-none absolute -top-16 left-0 w-full h-80 rounded-full blur-[100px] opacity-15"
          style={{ background: selectedTeam?.color_secondary || "#e9c349" }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: selectedTeam?.color_primary
              ? `linear-gradient(to right, ${selectedTeam.color_primary}40, transparent 70%)`
              : "linear-gradient(to right, #2d6a4f40, transparent 70%)",
          }}
        />
        <div className="relative flex items-center gap-3 sm:gap-4">
          {crestOk ? (
            <img
              key={selectedTeam?.id}
              src={crest}
              alt={selectedTeam.name}
              onError={() => setBadCrest(crest)}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-contain bg-white p-1.5 shrink-0 shadow-lg border border-white/10"
              loading="lazy"
            />
          ) : (
            <div
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center text-xl sm:text-2xl font-black shrink-0 shadow-lg border border-white/10"
              style={{
                background: selectedTeam?.color_secondary || "#201f1f",
                color: selectedTeam?.color_primary || "#fff",
              }}
            >
              {selectedTeam?.name?.[0] || "?"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p
              className="text-[10px] uppercase tracking-widest font-black mb-0.5 truncate"
              style={{ color: selectedTeam?.color_secondary || "#fff" }}
            >
              {selectedTeam?.division != null
                ? DIVISION_NAMES[selectedTeam.division] || `Divisão ${selectedTeam.division}`
                : "História do Clube"}
            </p>
            <h2 className="font-headline text-xl sm:text-2xl font-black tracking-tighter leading-none truncate text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.9)]">
              {selectedTeam?.name}
            </h2>
          </div>
        </div>
        <dl className="relative grid grid-cols-3 gap-2 mt-3">
          <div className="rounded-md bg-black/55 backdrop-blur-sm border border-white/10 px-2.5 py-2 text-center">
            <dt className="text-[8px] font-black uppercase tracking-widest text-white/60">
              Épocas
            </dt>
            <dd className="font-headline text-lg sm:text-xl font-black tabular-nums text-white leading-tight">
              {seasonRecords.length}
            </dd>
          </div>
          <div className="rounded-md bg-black/55 backdrop-blur-sm border border-white/10 px-2.5 py-2 text-center">
            <dt className="text-[8px] font-black uppercase tracking-widest text-white/60">
              Melhor
            </dt>
            <dd className="font-headline text-lg sm:text-xl font-black tabular-nums text-amber-300 leading-tight">
              {bestSeason ? `${bestSeason.position}º` : "—"}
            </dd>
          </div>
          <div className="rounded-md bg-black/55 backdrop-blur-sm border border-white/10 px-2.5 py-2 text-center">
            <dt className="text-[8px] font-black uppercase tracking-widest text-white/60">
              Troféus
            </dt>
            <dd className="font-headline text-lg sm:text-xl font-black tabular-nums text-white leading-tight">
              {trophies.length}
            </dd>
          </div>
        </dl>
      </header>

      {!hasAnything && (
        <div className="p-12 text-center">
          <span
            className="material-symbols-outlined text-on-surface-variant/30 text-4xl mb-2"
            style={{ fontVariationSettings: "'FILL' 0" }}
          >
            history
          </span>
          <p className="text-zinc-500 font-bold">
            Sem histórico registado para esta equipa.
          </p>
        </div>
      )}

      {/* ── ÉPOCA A ÉPOCA ─────────────────────────────────────── */}
      {seasonRecords.length > 0 && (
        <section>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">calendar_month</span>
            Época a época (Liga)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {seasonRecords.map((rec) => {
              const isBest = bestSeason != null && rec === bestSeason;
              return (
                <div
                  key={rec.season}
                  className={`rounded-lg p-3 bg-surface-container border ${
                    isBest
                      ? "border-amber-500/40"
                      : "border-outline-variant/10"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-black text-on-surface">
                      Época {rec.year}
                    </p>
                    <span
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
                        rec.position === 1
                          ? "bg-amber-500/20 text-amber-400"
                          : rec.position <= 3
                            ? "bg-sky-500/20 text-sky-400"
                            : "bg-surface-bright text-on-surface-variant/70"
                      }`}
                    >
                      {rec.position === 1 && (
                        <span className="material-symbols-outlined text-[12px]">
                          emoji_events
                        </span>
                      )}
                      {rec.position}º lugar
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-black">
                    <span className="text-emerald-400">{rec.wins}V</span>
                    <span className="text-amber-400">{rec.draws}E</span>
                    <span className="text-red-400">{rec.losses}D</span>
                    <span className="text-on-surface-variant/50 ml-auto tabular-nums">
                      {rec.goalsFor}:{rec.goalsAgainst}
                    </span>
                  </div>
                  <p className="text-[10px] text-on-surface-variant/70 font-bold mt-1">
                    {rec.points} pontos
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── JOGOS ─────────────────────────────────────────────── */}
      {games.length > 0 && (
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">sports_soccer</span>
              Jogos
            </h3>
            <TabBar
              tabs={[
                { key: "all", label: "Todos" },
                { key: "league", label: "Liga" },
                { key: "cup", label: "Taça" },
                { key: "friendly", label: "Amigáveis" },
              ]}
              active={gamesFilter}
              onChange={setGamesFilter}
              expand
              className="w-full sm:w-auto"
            />
          </div>
          {filteredGames.length === 0 ? (
            <p className="text-[11px] text-on-surface-variant/70 font-bold px-1">
              Sem jogos de {GAME_LABEL[gamesFilter]} no histórico.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {filteredGames.map((g, idx) => {
                const teamId = selectedTeam?.id;
                const imHome = g.homeTeamId === teamId;
                const opponent = imHome ? g.awayName : g.homeName;
                const myScore = imHome ? g.homeScore : g.awayScore;
                const opScore = imHome ? g.awayScore : g.homeScore;
                const hasPen =
                  (g.homePenalties || 0) > 0 || (g.awayPenalties || 0) > 0;
                const myPen = imHome ? g.homePenalties : g.awayPenalties;
                const opPen = imHome ? g.awayPenalties : g.homePenalties;
                const won =
                  g.kind === "cup" && g.winnerTeamId != null
                    ? g.winnerTeamId === teamId
                    : myScore > opScore;
                const drew =
                  g.kind === "cup" && g.winnerTeamId != null
                    ? false
                    : myScore === opScore;
                const detail =
                  g.kind === "league"
                    ? `Jornada ${g.matchweek} · Época ${g.year}`
                    : `${g.roundName} · Época ${g.year}`;
                return (
                  <div
                    key={`${g.kind}-${g.season}-${g.matchweek ?? g.round}-${g.homeTeamId}-${g.awayTeamId}-${idx}`}
                    className="flex items-center gap-3 rounded-lg bg-surface-container px-4 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-black text-on-surface truncate">
                          {opponent} {imHome ? "(C)" : "(F)"}
                        </p>
                        <span
                          className={`shrink-0 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${GAME_CHIP[g.kind] || "bg-surface-bright text-on-surface-variant/70"}`}
                        >
                          {GAME_LABEL[g.kind] || g.kind}
                        </span>
                      </div>
                      <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-widest">
                        {detail}
                      </p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-0.5">
                      <span
                        className={`text-sm font-black tabular-nums ${
                          won
                            ? "text-emerald-400"
                            : drew
                              ? "text-amber-400"
                              : "text-red-400"
                        }`}
                      >
                        {myScore}–{opScore}
                      </span>
                      {hasPen && (
                        <span className="text-[9px] text-amber-400 font-bold tabular-nums">
                          {myPen}–{opPen} gp
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── PALMARÉS ─────────────────────────────────────────── */}
      {trophies.length > 0 && (
        <section>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-3 flex items-center gap-2">
            <span
              className="material-symbols-outlined text-sm"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              emoji_events
            </span>
            Palmarés
          </h3>
          <div className="flex flex-wrap gap-2">
            {trophies.map((trophy, idx) => {
              const isTopScorer = trophy.achievement.includes("Melhor Marcador");
              return (
                <div
                  key={`${trophy.season}-${trophy.achievement}-${idx}`}
                  className="flex items-center gap-2 px-3 py-2 rounded border border-amber-500/20 bg-amber-500/5"
                >
                  <span
                    className="material-symbols-outlined text-amber-400 text-base"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {isTopScorer ? "sports_soccer" : "emoji_events"}
                  </span>
                  <div>
                    <p className="text-amber-400 font-black text-xs">
                      {trophy.achievement}
                    </p>
                    {trophy.season ? (
                      <p className="text-on-surface-variant text-[10px] font-bold">
                        {trophy.season}
                      </p>
                    ) : null}
                    {trophy.coach_name && trophy.is_human_coach && (
                      <p className="text-on-surface-variant/60 text-[9px] mt-0.5">
                        Treinador: {trophy.coach_name}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── LINHA DO TEMPO ───────────────────────────────────── */}
      {events.length > 0 && (
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">history</span>
              Linha do tempo
            </h3>
            <TabBar
              tabs={[
                { key: "all", label: "Todos" },
                { key: "market", label: "Mercado" },
                { key: "managers", label: "Treinadores" },
                { key: "prize", label: "Prémios" },
              ]}
              active={eventFilter}
              onChange={setEventFilter}
              expand
              className="w-full sm:w-auto"
            />
          </div>
          {filteredEvents.length === 0 ? (
            <p className="text-[11px] text-on-surface-variant/70 font-bold px-1">
              Sem eventos nesta categoria.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {filteredEvents.map((evt, idx) => {
                const meta = EVENT_META[evt.type] || {
                  icon: "info",
                  color: "text-on-surface-variant",
                  chip: "bg-surface-bright text-on-surface-variant/70",
                  label: evt.type,
                };
                const isManagerEvt =
                  evt.type === "manager_hired" || evt.type === "manager_dismissed";
                const subtitle =
                  evt.player_name ||
                  (evt.related_team_name
                    ? isManagerEvt
                      ? evt.related_team_name
                      : `De ${evt.related_team_name}`
                    : "");
                return (
                  <div
                    key={`${evt.year}-${evt.matchweek}-${evt.id ?? idx}`}
                    className="flex items-center gap-3 rounded-lg bg-surface-container px-4 py-3"
                  >
                    <span
                      className={`shrink-0 w-8 h-8 rounded flex items-center justify-center ${meta.chip}`}
                    >
                      <span
                        className="material-symbols-outlined text-[16px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        {meta.icon}
                      </span>
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-black text-on-surface truncate">
                          {evt.title || meta.label}
                        </p>
                        <span
                          className={`shrink-0 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${meta.chip}`}
                        >
                          {meta.label}
                        </span>
                      </div>
                      {subtitle && (
                        <p className="text-[11px] text-on-surface-variant/70 font-bold truncate">
                          {subtitle}
                        </p>
                      )}
                      <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-widest">
                        Jornada {evt.matchweek ?? "—"} · Ano {evt.year ?? "—"}
                      </p>
                    </div>
                    {evt.amount > 0 && (
                      <span className="shrink-0 text-xs text-tertiary font-black tabular-nums">
                        {formatCurrency(evt.amount)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
