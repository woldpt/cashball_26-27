import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Panel } from "../components/shared/Panel.jsx";
import { SummaryWidget } from "../components/shared/SummaryWidget.jsx";
import { EmptyState } from "../components/shared/EmptyState.jsx";
import { TabBar } from "../components/shared/TabBar.jsx";
import { Badge } from "../components/shared/Badge.jsx";
import { formatCurrency } from "../utils/formatters.js";
import { staggerItemProps } from "../motion.js";

const EVENT_META = {
  transfer_in: {
    icon: "south_west",
    label: "Contratação",
    variant: "sold",
    box: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  transfer_out: {
    icon: "north_east",
    label: "Saída",
    variant: "error",
    box: "bg-error-container/40 text-error border-error/20",
  },
  auction_won: {
    icon: "gavel",
    label: "Leilão",
    variant: "warning",
    box: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
  prize: {
    icon: "emoji_events",
    label: "Prémio",
    variant: "warning",
    box: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
  manager_dismissed: {
    icon: "person_remove",
    label: "Despedimento",
    variant: "suspended",
    box: "bg-error-container/60 text-error border-error/30",
  },
  manager_hired: {
    icon: "person_add",
    label: "Novo treinador",
    variant: "cooldown",
    box: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  },
};

const EVENT_GROUPS = {
  market: ["transfer_in", "transfer_out", "auction_won"],
  managers: ["manager_dismissed", "manager_hired"],
  prize: ["prize"],
};

const GAME_LABEL = {
  league: "Liga",
  cup: "Taça",
  friendly: "Amigável",
};

const GAME_VARIANT = {
  league: "info",
  cup: "warning",
  friendly: "cooldown",
};

const OUTCOME_META = {
  won: { label: "V", title: "Vitória", variant: "sold" },
  drew: { label: "E", title: "Empate", variant: "warning" },
  lost: { label: "D", title: "Derrota", variant: "error" },
};

/**
 * @param {{ rec: object, isBest: boolean, index: number }} props
 * @returns {JSX.Element}
 */
function SeasonCard({ rec, isBest, index }) {
  const posVariant =
    rec.position === 1 ? "warning" : rec.position <= 3 ? "info" : "neutral";
  return (
    <motion.div
      {...staggerItemProps(index)}
      className={`rounded-md p-3 bg-surface-container-low border ${
        isBest ? "border-amber-500/40" : "border-outline-variant/25"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-black text-on-surface">Época {rec.year}</p>
        <Badge variant={posVariant}>{rec.position}º lugar</Badge>
      </div>
      <div className="flex items-center gap-2 text-[11px] font-black">
        <span className="text-emerald-400">{rec.wins}V</span>
        <span className="text-amber-400">{rec.draws}E</span>
        <span className="text-red-400">{rec.losses}D</span>
        <span className="text-on-surface-variant/60 ml-auto tabular-nums">
          {rec.goalsFor}:{rec.goalsAgainst}
        </span>
      </div>
      <p className="text-[10px] text-on-surface-variant/70 font-bold mt-1 tabular-nums">
        {rec.points} pontos
      </p>
    </motion.div>
  );
}

/**
 * @param {{ game: object, teamId: number|null, index: number }} props
 * @returns {JSX.Element}
 */
function GameRow({ game: g, teamId, index }) {
  const imHome = g.homeTeamId === teamId;
  const opponent = imHome ? g.awayName : g.homeName;
  const myScore = imHome ? g.homeScore : g.awayScore;
  const opScore = imHome ? g.awayScore : g.homeScore;
  const hasPen = (g.homePenalties || 0) > 0 || (g.awayPenalties || 0) > 0;
  const myPen = imHome ? g.homePenalties : g.awayPenalties;
  const opPen = imHome ? g.awayPenalties : g.homePenalties;
  const won =
    g.kind === "cup" && g.winnerTeamId != null
      ? g.winnerTeamId === teamId
      : myScore > opScore;
  const drew =
    g.kind === "cup" && g.winnerTeamId != null ? false : myScore === opScore;
  const outcome = OUTCOME_META[won ? "won" : drew ? "drew" : "lost"];
  const place = imHome ? "Casa" : "Fora";
  const detail =
    g.kind === "league"
      ? `${place} · Jornada ${g.matchweek ?? "—"} · Época ${g.year ?? "—"}`
      : `${place} · ${g.roundName || "Taça"} · Época ${g.year ?? "—"}`;
  return (
    <motion.div
      {...staggerItemProps(index)}
      className="flex items-center gap-2 sm:gap-3 rounded-md bg-surface-container-low border border-outline-variant/25 px-3 py-2.5"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black text-on-surface truncate">{opponent}</p>
        <p className="text-[10px] text-on-surface-variant/60 font-bold uppercase tracking-widest truncate">
          {detail}
        </p>
      </div>
      <Badge variant={GAME_VARIANT[g.kind] || "neutral"}>
        {GAME_LABEL[g.kind] || g.kind}
      </Badge>
      <Badge variant={outcome.variant} title={outcome.title}>
        {outcome.label}
      </Badge>
      <div className="shrink-0 flex flex-col items-end gap-0.5">
        <span className="text-sm font-black tabular-nums text-on-surface">
          {myScore}–{opScore}
        </span>
        {hasPen && (
          <span className="text-[9px] text-on-surface-variant/60 font-bold tabular-nums">
            {myPen}–{opPen} g.p.
          </span>
        )}
      </div>
    </motion.div>
  );
}

/**
 * @param {{ trophy: object, index: number }} props
 * @returns {JSX.Element}
 */
function TrophyChip({ trophy, index }) {
  const isTopScorer = (trophy.achievement || "").includes("Melhor Marcador");
  return (
    <motion.div
      {...staggerItemProps(index)}
      className="flex items-center gap-2 px-3 py-2 rounded-md border border-amber-500/30 bg-amber-500/5"
    >
      <span
        aria-hidden
        className="material-symbols-outlined text-amber-400 text-base"
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        {isTopScorer ? "sports_soccer" : "emoji_events"}
      </span>
      <div className="min-w-0">
        <p className="text-amber-400 font-black text-xs">{trophy.achievement}</p>
        {trophy.season ? (
          <p className="text-on-surface-variant text-[10px] font-bold tabular-nums">
            {trophy.season}
          </p>
        ) : null}
        {trophy.coach_name && trophy.is_human_coach ? (
          <p className="text-on-surface-variant/60 text-[9px] mt-0.5 truncate">
            Treinador: {trophy.coach_name}
          </p>
        ) : null}
      </div>
    </motion.div>
  );
}

/**
 * @param {{ evt: object, index: number }} props
 * @returns {JSX.Element}
 */
function EventRow({ evt, index }) {
  const meta = EVENT_META[evt.type] || {
    icon: "info",
    label: evt.type,
    variant: "neutral",
    box: "bg-surface-bright text-on-surface-variant/70 border-outline-variant/30",
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
    <motion.div
      {...staggerItemProps(index)}
      className="flex items-center gap-3 rounded-md bg-surface-container-low border border-outline-variant/25 px-3 py-2.5"
    >
      <span
        aria-hidden
        className={`shrink-0 w-8 h-8 rounded-md flex items-center justify-center border ${meta.box}`}
      >
        <span
          className="material-symbols-outlined text-[16px]"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {meta.icon}
        </span>
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-black text-on-surface truncate">
            {evt.title || meta.label}
          </p>
          <Badge variant={meta.variant}>{meta.label}</Badge>
        </div>
        {subtitle ? (
          <p className="text-[11px] text-on-surface-variant/70 font-bold truncate">
            {subtitle}
          </p>
        ) : null}
        <p className="text-[10px] text-on-surface-variant/60 font-bold uppercase tracking-widest">
          Jornada {evt.matchweek ?? "—"} · Ano {evt.year ?? "—"}
        </p>
      </div>
      {evt.amount > 0 && (
        <span className="shrink-0 text-xs text-tertiary font-black tabular-nums">
          {formatCurrency(evt.amount)}
        </span>
      )}
    </motion.div>
  );
}

/**
 * @param {{
 *   selectedTeam: object|null,
 *   clubHistory: object|null,
 *   clubHistoryTeamId: number|null,
 * }} props
 * @returns {JSX.Element}
 */
export function TeamHistoryView({
  selectedTeam,
  clubHistory,
  clubHistoryTeamId,
}) {
  const [gamesFilter, setGamesFilter] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");

  const { trophies = [], events = [], seasonRecords = [], games = [] } =
    clubHistory ?? {};

  const bestSeason = useMemo(
    () =>
      [...seasonRecords].sort(
        (a, b) => a.position - b.position || b.season - a.season,
      )[0],
    [seasonRecords],
  );

  const gameCounts = useMemo(
    () => ({
      all: games.length,
      league: games.filter((g) => g.kind === "league").length,
      cup: games.filter((g) => g.kind === "cup").length,
      friendly: games.filter((g) => g.kind === "friendly").length,
    }),
    [games],
  );

  const filteredGames = useMemo(
    () =>
      gamesFilter === "all"
        ? games
        : games.filter((g) => g.kind === gamesFilter),
    [games, gamesFilter],
  );

  // Agrupamento por ano (descendente); dentro de cada época mantém-se
  // a ordem recebida do servidor.
  const gamesByYear = useMemo(() => {
    const map = new Map();
    for (const g of filteredGames) {
      const year = g.year ?? g.season ?? 0;
      if (!map.has(year)) map.set(year, []);
      map.get(year).push(g);
    }
    return [...map.entries()].sort((a, b) => (b[0] || 0) - (a[0] || 0));
  }, [filteredGames]);

  const eventCounts = useMemo(
    () => ({
      all: events.length,
      market: events.filter((e) =>
        (EVENT_GROUPS.market || []).includes(e.type),
      ).length,
      managers: events.filter((e) =>
        (EVENT_GROUPS.managers || []).includes(e.type),
      ).length,
      prize: events.filter((e) =>
        (EVENT_GROUPS.prize || []).includes(e.type),
      ).length,
    }),
    [events],
  );

  const filteredEvents = useMemo(
    () =>
      eventFilter === "all"
        ? events
        : events.filter((e) =>
            (EVENT_GROUPS[eventFilter] || []).includes(e.type),
          ),
    [events, eventFilter],
  );

  if (!clubHistory || clubHistoryTeamId !== selectedTeam?.id) {
    return (
      <div className="space-y-4 px-3 py-4 sm:p-6">
        <EmptyState emoji="📜" title="A carregar histórico..." />
      </div>
    );
  }

  const hasAnything =
    trophies.length > 0 ||
    events.length > 0 ||
    seasonRecords.length > 0 ||
    games.length > 0;

  return (
    <div className="space-y-4 px-3 py-4 sm:p-6">
      {/* ── RESUMO ─────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <SummaryWidget
          compactMobile
          label="Épocas"
          value={seasonRecords.length}
        />
        <SummaryWidget
          compactMobile
          label="Melhor"
          value={bestSeason ? `${bestSeason.position}º` : "—"}
          sub={bestSeason ? `Época ${bestSeason.year}` : undefined}
          accentClass="border-amber-500"
          valueColorClass="text-amber-400"
        />
        <SummaryWidget
          compactMobile
          label="Troféus"
          value={trophies.length}
          accentClass="border-tertiary"
        />
      </div>

      {!hasAnything && (
        <EmptyState
          emoji="🏟️"
          title="Sem histórico registado para esta equipa."
        />
      )}

      {/* ── ÉPOCA A ÉPOCA ──────────────────────────────────── */}
      {seasonRecords.length > 0 && (
        <Panel
          title="Época a época"
          icon="calendar_month"
          meta={`${seasonRecords.length} épocas · Liga`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {seasonRecords.map((rec, i) => (
              <SeasonCard
                key={rec.season}
                rec={rec}
                isBest={bestSeason != null && rec.season === bestSeason.season}
                index={i}
              />
            ))}
          </div>
        </Panel>
      )}

      {/* ── JOGOS ──────────────────────────────────────────── */}
      {games.length > 0 && (
        <Panel
          title="Jogos"
          icon="sports_soccer"
          meta={`${filteredGames.length} jogos`}
        >
          <div className="flex flex-col gap-2 mb-3">
            <TabBar
              size="sm"
              expand
              tabs={[
                { key: "all", label: `Todos · ${gameCounts.all}` },
                { key: "league", label: `Liga · ${gameCounts.league}` },
                { key: "cup", label: `Taça · ${gameCounts.cup}` },
                {
                  key: "friendly",
                  label: `Amigáveis · ${gameCounts.friendly}`,
                },
              ]}
              active={gamesFilter}
              onChange={setGamesFilter}
            />
          </div>
          {filteredGames.length === 0 ? (
            <p className="text-[11px] text-on-surface-variant/70 font-bold px-1">
              Sem jogos de {GAME_LABEL[gamesFilter]} no histórico.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {gamesByYear.map(([year, yearGames]) => {
                let stagger = 0;
                return (
                  <section key={year} aria-label={`Época ${year}`}>
                    <div className="flex items-center gap-2 px-1 py-2">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                        Época {year}
                      </h4>
                      <span className="text-[9px] text-on-surface-variant/60 font-bold tabular-nums">
                        {yearGames.length}{" "}
                        {yearGames.length === 1 ? "jogo" : "jogos"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {yearGames.map((g) => {
                        // Os jogos não têm id próprio: a chave compõe os
                        // campos que os distinguem + índice na época.
                        const key =
                          `${g.kind}-${g.season ?? g.year}-${g.matchweek ?? g.round}-` +
                          `${g.homeTeamId}-${g.awayTeamId}-${g.homeScore}-${g.awayScore}`;
                        return (
                          <GameRow
                            key={`${key}-${stagger}`}
                            game={g}
                            teamId={selectedTeam?.id}
                            index={stagger++}
                          />
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </Panel>
      )}

      {/* ── PALMARÉS ───────────────────────────────────────── */}
      {trophies.length > 0 && (
        <Panel
          title="Palmarés"
          icon="emoji_events"
          meta={`${trophies.length} ${trophies.length === 1 ? "troféu" : "troféus"}`}
        >
          <div className="flex flex-wrap gap-2">
            {trophies.map((trophy, i) => (
              <TrophyChip
                key={`${trophy.season}-${trophy.achievement}-${i}`}
                trophy={trophy}
                index={i}
              />
            ))}
          </div>
        </Panel>
      )}

      {/* ── LINHA DO TEMPO ─────────────────────────────────── */}
      {events.length > 0 && (
        <Panel
          title="Linha do tempo"
          icon="history"
          meta={`${filteredEvents.length} eventos`}
        >
          <div className="flex flex-col gap-2 mb-3">
            <TabBar
              size="sm"
              expand
              tabs={[
                { key: "all", label: `Todos · ${eventCounts.all}` },
                { key: "market", label: `Mercado · ${eventCounts.market}` },
                {
                  key: "managers",
                  label: `Treinadores · ${eventCounts.managers}`,
                },
                { key: "prize", label: `Prémios · ${eventCounts.prize}` },
              ]}
              active={eventFilter}
              onChange={setEventFilter}
            />
          </div>
          {filteredEvents.length === 0 ? (
            <p className="text-[11px] text-on-surface-variant/70 font-bold px-1">
              Sem eventos nesta categoria.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {filteredEvents.map((evt, i) => (
                <EventRow key={evt.id ?? `${evt.year}-${evt.type}-${i}`} evt={evt} index={i} />
              ))}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
