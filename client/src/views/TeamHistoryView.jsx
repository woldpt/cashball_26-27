import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Panel } from "../components/shared/Panel.jsx";
import { SummaryWidget } from "../components/shared/SummaryWidget.jsx";
import { EmptyState } from "../components/shared/EmptyState.jsx";
import { TabBar } from "../components/shared/TabBar.jsx";
import { Badge } from "../components/shared/Badge.jsx";
import { TeamCrest } from "../components/shared/TeamCrest.jsx";
import { TrophyCabinet } from "../components/shared/TrophyCabinet.jsx";
import { formatCurrency } from "../utils/formatters.js";
import { staggerItemProps } from "../motion.js";

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

/** Resultado de um jogo: letra + cor (barra lateral, letra e marcador). */
const RESULT_META = {
  V: { letter: "V", title: "Vitória", bar: "bg-emerald-400", text: "text-emerald-400" },
  E: { letter: "E", title: "Empate", bar: "bg-amber-400", text: "text-amber-400" },
  D: { letter: "D", title: "Derrota", bar: "bg-red-400", text: "text-red-400" },
};

const EVENT_META = {
  transfer_in: {
    icon: "south_west",
    label: "Contratação",
    variant: "sold",
    box: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    credit: false,
  },
  transfer_out: {
    icon: "north_east",
    label: "Saída",
    variant: "error",
    box: "bg-error-container/40 text-error border-error/20",
    credit: true,
  },
  auction_won: {
    icon: "gavel",
    label: "Leilão",
    variant: "warning",
    box: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    credit: false,
  },
  prize: {
    icon: "emoji_events",
    label: "Prémio",
    variant: "warning",
    box: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    credit: true,
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

/**
 * Resolve o jogo do ponto de vista do clube: lado, marcador, penáltis e
 * resultado. Na Taça quem decide é o `winnerTeamId` (um empate com vitória
 * nos penáltis é V, não E).
 *
 * @param {object} game
 * @param {number|null} teamId
 */
function resolveGame(game, teamId) {
  const imHome = game.homeTeamId === teamId;
  const myScore = imHome ? game.homeScore : game.awayScore;
  const opScore = imHome ? game.awayScore : game.homeScore;
  const decided = game.kind !== "league" && game.winnerTeamId != null;
  const won = decided ? game.winnerTeamId === teamId : myScore > opScore;
  const drew = decided ? false : myScore === opScore;
  const myPen = imHome ? game.homePenalties : game.awayPenalties;
  const opPen = imHome ? game.awayPenalties : game.homePenalties;
  return {
    game,
    imHome,
    myScore,
    opScore,
    myPen,
    opPen,
    hasPen: (game.homePenalties || 0) > 0 || (game.awayPenalties || 0) > 0,
    result: won ? "V" : drew ? "E" : "D",
    opponent: imHome ? game.awayName : game.homeName,
    // ponytail: ordem aproximada dentro da época (o servidor não guarda a
    // data do jogo) — suficiente para a série invicta; refinar se a Taça
    // passar a registar jornada.
    slot:
      game.kind === "league"
        ? (game.matchweek ?? 0)
        : game.kind === "friendly"
          ? -1
          : 100 + (game.round ?? 0),
    year: game.year ?? game.season ?? 0,
  };
}

/**
 * Uma linha da trajetória: época, posição, barra V/E/D, contexto
 * (campeão da divisão) e totais.
 *
 * @param {{ rec: object, teamName: string|undefined, hasTrophy: boolean, isBest: boolean, index: number }} props
 */
function SeasonRow({ rec, teamName, hasTrophy, isBest, index }) {
  const total = rec.wins + rec.draws + rec.losses;
  const pct = (value) => (total > 0 ? (value / total) * 100 : 0);
  const posVariant =
    rec.position === 1 ? "warning" : rec.position <= 3 ? "info" : "neutral";
  const gap =
    rec.championPoints != null ? rec.championPoints - rec.points : null;
  const isChampion =
    gap === 0 && (rec.championName == null || rec.championName === teamName);
  const context = isChampion
    ? "Campeão da divisão"
    : rec.championName != null && gap != null
      ? `A ${gap} pts do campeão (${rec.championName})`
      : rec.divisionSize
        ? `Divisão de ${rec.divisionSize} equipas`
        : null;

  return (
    <motion.div
      {...staggerItemProps(index)}
      className={`relative overflow-hidden rounded-md border bg-surface-container-low px-3 py-2.5 ${
        isBest ? "border-amber-500/40" : "border-outline-variant/25"
      }`}
    >
      {isBest && (
        <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-amber-400/70" />
      )}
      <div className="flex items-center gap-2">
        <span className="text-xs font-black tabular-nums text-on-surface">
          Época {rec.year}
        </span>
        <Badge variant={posVariant} title={`${rec.position}º lugar`}>
          {rec.position}º
        </Badge>
        {hasTrophy && (
          <span
            aria-hidden
            title="Época com troféu"
            className="flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden"
          >
            <span
              className="material-symbols-outlined text-[14px] text-amber-400"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              emoji_events
            </span>
          </span>
        )}
        <span className="ml-auto font-headline text-sm font-black tabular-nums text-on-surface">
          {rec.points}
          <span className="ml-0.5 text-[9px] font-bold text-on-surface-variant/70">
            pts
          </span>
        </span>
      </div>

      <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-surface-container-high">
        <span className="bg-emerald-500" style={{ width: `${pct(rec.wins)}%` }} />
        <span className="bg-amber-500" style={{ width: `${pct(rec.draws)}%` }} />
        <span className="bg-red-500" style={{ width: `${pct(rec.losses)}%` }} />
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2 text-[9px] font-bold">
        <span className={`truncate ${isChampion ? "text-amber-400" : "text-on-surface-variant/70"}`}>
          {context || "—"}
        </span>
        <span className="shrink-0 tabular-nums text-on-surface-variant/70">
          <span className="text-emerald-400">{rec.wins}V</span>{" "}
          <span className="text-amber-400">{rec.draws}E</span>{" "}
          <span className="text-red-400">{rec.losses}D</span>
          <span className="mx-1 text-on-surface-variant/40">·</span>
          {rec.goalsFor}:{rec.goalsAgainst}
        </span>
      </div>
    </motion.div>
  );
}

/**
 * Uma linha do arquivo de jogos. É clicável quando há `onOpenTeam`:
 * abrir o adversário é a ação natural (não há detalhe de jogo a mostrar).
 *
 * @param {{ item: object, teamsById: Map, onOpenTeam?: (team: object) => void }} props
 */
function GameRow({ item, teamsById, onOpenTeam }) {
  const { game, opponent, imHome, myScore, opScore, myPen, opPen, hasPen } =
    item;
  const meta = RESULT_META[item.result];
  const oppTeam =
    teamsById.get(imHome ? game.awayTeamId : game.homeTeamId) || {
      name: opponent,
    };
  const when =
    game.kind === "friendly"
      ? null
      : game.kind === "cup"
        ? game.roundName || "Taça"
        : `Jornada ${game.matchweek ?? "—"}`;

  const content = (
    <>
      <span aria-hidden className={`w-1 self-stretch rounded-full ${meta.bar}`} />
      <span
        title={meta.title}
        className={`w-4 shrink-0 text-center text-[10px] font-black ${meta.text}`}
      >
        {meta.letter}
      </span>
      <TeamCrest team={oppTeam} size="w-7 h-7 text-[10px]" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-black text-on-surface">{opponent}</p>
        <div className="flex items-center gap-1.5 text-[9px] font-bold text-on-surface-variant/70">
          <span className="shrink-0">{imHome ? "Casa" : "Fora"}</span>
          {when && (
            <>
              <span className="text-on-surface-variant/40">·</span>
              <span className="truncate">{when}</span>
            </>
          )}
          <Badge
            variant={GAME_VARIANT[game.kind] || "neutral"}
            className="ml-auto shrink-0"
          >
            {GAME_LABEL[game.kind] || game.kind}
          </Badge>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-headline text-sm font-black tabular-nums text-on-surface">
          {myScore}–{opScore}
        </p>
        {hasPen && (
          <p className="text-[8px] font-bold tabular-nums text-on-surface-variant/60">
            {myPen}–{opPen} g.p.
          </p>
        )}
      </div>
      {onOpenTeam && (
        <span
          aria-hidden
          className="material-symbols-outlined hidden text-[16px] text-on-surface-variant/30 group-hover:text-on-surface-variant sm:inline"
        >
          chevron_right
        </span>
      )}
    </>
  );

  const className =
    "flex w-full items-center gap-2 rounded-md border border-outline-variant/25 bg-surface-container-low px-2.5 py-2 text-left transition-colors";

  if (!onOpenTeam) {
    return <div className={className}>{content}</div>;
  }
  return (
    <button
      type="button"
      onClick={() => onOpenTeam(oppTeam)}
      title={`Abrir clube: ${opponent}`}
      className={`group ${className} hover:border-outline-variant/50 hover:bg-surface-container-high`}
    >
      {content}
    </button>
  );
}

/**
 * Mini-tile de recorde do arquivo (maior vitória, série invicta, ...).
 *
 * @param {{ icon: string, label: string, tone: string, value: string, sub: string }} props
 */
function RecordTile({ icon, label, tone, value, sub }) {
  return (
    <div className="rounded-md border border-outline-variant/25 bg-surface-container-low px-3 py-2">
      <div className="flex items-center gap-1.5">
        <span aria-hidden className={`material-symbols-outlined text-[14px] ${tone}`}>
          {icon}
        </span>
        <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">
          {label}
        </span>
      </div>
      <p className="mt-1 font-headline text-lg font-black leading-none tabular-nums text-on-surface">
        {value}
      </p>
      <p className="mt-1 truncate text-[9px] font-bold text-on-surface-variant/70">
        {sub}
      </p>
    </div>
  );
}

/**
 * Evento da linha do tempo, com nó na rail vertical. O nome do jogador
 * abre o histórico dele quando há `player_id`.
 *
 * @param {{ evt: object, isLast: boolean, onOpenPlayer?: (playerId: number) => void, index: number }} props
 */
function TimelineEvent({ evt, isLast, onOpenPlayer, index }) {
  const meta = EVENT_META[evt.type] || {
    icon: "info",
    label: evt.type,
    variant: "neutral",
    box: "bg-surface-bright text-on-surface-variant/70 border-outline-variant/30",
  };
  const related =
    evt.type === "transfer_in"
      ? `De ${evt.related_team_name}`
      : evt.type === "transfer_out"
        ? `Para ${evt.related_team_name}`
        : evt.related_team_name;

  return (
    <motion.div {...staggerItemProps(index)} className="relative flex gap-3 pb-3 last:pb-0">
      {!isLast && (
        <span
          aria-hidden
          className="absolute bottom-0 left-[11px] top-7 w-px bg-outline-variant/25"
        />
      )}
      <span
        aria-hidden
        className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border ${meta.box}`}
      >
        <span
          className="material-symbols-outlined text-[13px]"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {meta.icon}
        </span>
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 truncate text-xs font-black text-on-surface">
            {evt.title || meta.label}
          </p>
          {evt.amount > 0 && (
            <span
              className={`shrink-0 font-headline text-xs font-black tabular-nums ${
                meta.credit ? "text-emerald-400" : "text-error"
              }`}
            >
              {meta.credit ? "+" : "-"}
              {formatCurrency(evt.amount)}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <Badge variant={meta.variant}>{meta.label}</Badge>
          {evt.player_name &&
            (evt.player_id != null && onOpenPlayer ? (
              <button
                type="button"
                onClick={() => onOpenPlayer(evt.player_id)}
                title="Abrir histórico do jogador"
                className="flex min-w-0 items-center gap-1 text-[10px] font-black text-primary hover:text-primary/80"
              >
                <span aria-hidden className="material-symbols-outlined text-[12px]">
                  person
                </span>
                <span className="truncate">{evt.player_name}</span>
              </button>
            ) : (
              <span className="truncate text-[10px] font-bold text-on-surface-variant/80">
                {evt.player_name}
              </span>
            ))}
          {related && (
            <span className="truncate text-[10px] font-bold text-on-surface-variant/70">
              {related}
            </span>
          )}
          <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/60">
            Jornada {evt.matchweek ?? "—"}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Tab "História" do perfil de clube (a mesma página serve o próprio clube e
 * qualquer adversário): resumo, trajetória por época, arquivo de jogos,
 * sala de troféus e linha do tempo. Só épocas concluídas — a época em curso
 * vive no Calendário.
 *
 * @param {{
 *   selectedTeam: object|null,
 *   clubHistory: object|null,
 *   clubHistoryTeamId: number|null,
 *   teams?: object[],
 *   onOpenTeamSquad?: (team: object) => void,
 *   onOpenPlayerHistory?: (player: { id: number }) => void,
 * }} props
 * @returns {JSX.Element}
 */
export function TeamHistoryView({
  selectedTeam,
  clubHistory,
  clubHistoryTeamId,
  teams = [],
  onOpenTeamSquad,
  onOpenPlayerHistory,
}) {
  const [gamesFilter, setGamesFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");
  // null = sem escolha do utilizador: a época mais recente (do filtro atual)
  // é a aberta. Mudar de filtro volta a este default sem useEffect.
  const [openSeasons, setOpenSeasons] = useState(null);

  const { trophies = [], events = [], seasonRecords = [], games = [] } =
    clubHistory ?? {};
  const teamId = selectedTeam?.id ?? null;

  const teamsById = useMemo(
    () => new Map((teams || []).map((t) => [t.id, t])),
    [teams],
  );

  // `onOpenPlayerHistory` segue a convenção da casa (recebe um objeto
  // jogador — MySquadTab/PlayerRow); troféus e eventos só têm o id.
  const openPlayer = useMemo(
    () =>
      onOpenPlayerHistory
        ? (playerId) => onOpenPlayerHistory({ id: playerId })
        : undefined,
    [onOpenPlayerHistory],
  );

  const gamesWithOutcome = useMemo(
    () => games.map((game) => resolveGame(game, teamId)),
    [games, teamId],
  );

  const bestSeason = useMemo(
    () =>
      [...seasonRecords].sort(
        (a, b) => a.position - b.position || b.season - a.season,
      )[0],
    [seasonRecords],
  );

  const summary = useMemo(() => {
    let wins = 0;
    let draws = 0;
    let losses = 0;
    for (const item of gamesWithOutcome) {
      if (item.result === "V") wins += 1;
      else if (item.result === "E") draws += 1;
      else losses += 1;
    }
    return { total: gamesWithOutcome.length, wins, draws, losses };
  }, [gamesWithOutcome]);

  const seasonRange = useMemo(() => {
    if (seasonRecords.length === 0) return null;
    const years = seasonRecords.map((r) => r.year);
    return { min: Math.min(...years), max: Math.max(...years) };
  }, [seasonRecords]);

  const lastTrophySeason = useMemo(
    () => trophies.reduce((max, t) => Math.max(max, t.season ?? 0), 0) || null,
    [trophies],
  );

  const trophySeasons = useMemo(
    () => new Set(trophies.map((t) => t.season).filter((s) => s != null)),
    [trophies],
  );

  const kindCounts = useMemo(() => {
    const counts = { all: gamesWithOutcome.length, league: 0, cup: 0, friendly: 0 };
    for (const item of gamesWithOutcome) {
      if (counts[item.game.kind] !== undefined) counts[item.game.kind] += 1;
    }
    return counts;
  }, [gamesWithOutcome]);

  const filteredGames = useMemo(
    () =>
      gamesWithOutcome.filter(
        (item) =>
          (gamesFilter === "all" || item.game.kind === gamesFilter) &&
          (resultFilter === "all" || item.result === resultFilter),
      ),
    [gamesWithOutcome, gamesFilter, resultFilter],
  );

  // Ao contrário da lista de troféus, os jogos vêm DESC (mais recente
  // primeiro): o agrupamento preserva a ordem recebida do servidor.
  const gamesByYear = useMemo(() => {
    const map = new Map();
    for (const item of filteredGames) {
      if (!map.has(item.year)) map.set(item.year, []);
      map.get(item.year).push(item);
    }
    return [...map.entries()].sort((a, b) => (b[0] || 0) - (a[0] || 0));
  }, [filteredGames]);

  const records = useMemo(() => {
    if (gamesWithOutcome.length === 0) return [];
    let biggestWin = null;
    let biggestLoss = null;
    let topGoals = null;
    for (const item of gamesWithOutcome) {
      const diff = item.myScore - item.opScore;
      const goals = item.myScore + item.opScore;
      if (diff > 0 && (!biggestWin || diff > biggestWin.diff)) {
        biggestWin = { ...item, diff };
      }
      if (diff < 0 && (!biggestLoss || diff < biggestLoss.diff)) {
        biggestLoss = { ...item, diff };
      }
      if (!topGoals || goals > topGoals.goals) {
        topGoals = { ...item, goals };
      }
    }

    // Série invicta: por época (o slot aproxima a ordem cronológica interna).
    let streak = null;
    const bySeason = new Map();
    for (const item of gamesWithOutcome) {
      const key = item.game.season ?? item.year;
      if (!bySeason.has(key)) bySeason.set(key, []);
      bySeason.get(key).push(item);
    }
    for (const items of bySeason.values()) {
      let run = 0;
      for (const item of [...items].sort((a, b) => a.slot - b.slot)) {
        if (item.result === "D") {
          run = 0;
        } else {
          run += 1;
          if (!streak || run > streak.count) {
            streak = { count: run, year: item.year };
          }
        }
      }
    }

    const place = (item) => (item.imHome ? "Casa" : "Fora");
    const sub = (item) => `${item.opponent} · ${place(item)} · ${item.year}`;
    const tiles = [];
    if (biggestWin) {
      tiles.push({
        key: "win",
        icon: "trending_up",
        tone: "text-emerald-400",
        label: "Maior vitória",
        value: `${biggestWin.myScore}–${biggestWin.opScore}`,
        sub: sub(biggestWin),
      });
    }
    if (biggestLoss) {
      tiles.push({
        key: "loss",
        icon: "trending_down",
        tone: "text-error",
        label: "Maior derrota",
        value: `${biggestLoss.myScore}–${biggestLoss.opScore}`,
        sub: sub(biggestLoss),
      });
    }
    if (topGoals) {
      tiles.push({
        key: "goals",
        icon: "sports_soccer",
        tone: "text-tertiary",
        label: "Mais golos",
        value: `${topGoals.myScore}–${topGoals.opScore}`,
        sub: `${topGoals.goals} golos · ${sub(topGoals)}`,
      });
    }
    if (streak) {
      tiles.push({
        key: "streak",
        icon: "local_fire_department",
        tone: "text-amber-400",
        label: "Série invicta",
        value: `${streak.count} ${streak.count === 1 ? "jogo" : "jogos"}`,
        sub: `Época ${streak.year}`,
      });
    }
    return tiles;
  }, [gamesWithOutcome]);

  const filteredEvents = useMemo(
    () =>
      eventFilter === "all"
        ? events
        : events.filter((e) => (EVENT_GROUPS[eventFilter] || []).includes(e.type)),
    [events, eventFilter],
  );

  const eventsByYear = useMemo(() => {
    const map = new Map();
    for (const evt of filteredEvents) {
      const year = evt.year ?? 0;
      if (!map.has(year)) map.set(year, []);
      map.get(year).push(evt);
    }
    return [...map.entries()].sort((a, b) => (b[0] || 0) - (a[0] || 0));
  }, [filteredEvents]);

  const defaultOpenSeasons = useMemo(
    () => (gamesByYear.length > 0 ? new Set([gamesByYear[0][0]]) : new Set()),
    [gamesByYear],
  );
  const expandedSeasons = openSeasons ?? defaultOpenSeasons;

  const toggleSeason = (year) => {
    const next = new Set(expandedSeasons);
    if (next.has(year)) next.delete(year);
    else next.add(year);
    setOpenSeasons(next);
  };

  // Mudar de filtro volta ao default (época mais recente do filtro aberta).
  const changeGamesFilter = (key) => {
    setGamesFilter(key);
    setOpenSeasons(null);
  };
  const changeResultFilter = (key) => {
    setResultFilter(key);
    setOpenSeasons(null);
  };

  if (!clubHistory || clubHistoryTeamId !== selectedTeam?.id) {
    return (
      <div className="space-y-4">
        <EmptyState icon="history_edu" title="A carregar histórico..." />
      </div>
    );
  }

  const hasAnything =
    trophies.length > 0 ||
    events.length > 0 ||
    seasonRecords.length > 0 ||
    games.length > 0;

  if (!hasAnything) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon="stadium"
          title="Ainda sem história para contar"
          description="O histórico do clube escreve-se no fim de cada época. A época em curso acompanha-se no Calendário."
        />
      </div>
    );
  }

  const gamesMeta =
    gamesFilter === "all" && resultFilter === "all"
      ? `${filteredGames.length} ${filteredGames.length === 1 ? "jogo" : "jogos"}`
      : `${filteredGames.length} de ${games.length}`;

  return (
    <div className="space-y-4">
      {/* ── RESUMO ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4">
        <SummaryWidget
          compactMobile
          label="Épocas"
          value={seasonRecords.length}
          sub={
            seasonRange
              ? seasonRange.min === seasonRange.max
                ? `Época ${seasonRange.min}`
                : `${seasonRange.min}–${seasonRange.max}`
              : "—"
          }
          valueClass="text-lg sm:text-2xl"
        />
        <SummaryWidget
          compactMobile
          label="Melhor"
          value={bestSeason ? `${bestSeason.position}º` : "—"}
          sub={bestSeason ? `Época ${bestSeason.year}` : "—"}
          valueClass="text-lg sm:text-2xl"
          accentClass="border-primary"
          valueColorClass="text-primary"
        />
        <SummaryWidget
          compactMobile
          label="Jogos"
          value={summary.total}
          sub={`${summary.wins}V ${summary.draws}E ${summary.losses}D`}
          valueClass="text-lg sm:text-2xl"
          accentClass="border-tertiary"
        />
        <SummaryWidget
          compactMobile
          label="Troféus"
          value={trophies.length}
          sub={lastTrophySeason ? `Último: ${lastTrophySeason}` : "Sem títulos"}
          valueClass="text-lg sm:text-2xl"
          accentClass="border-amber-500"
          valueColorClass="text-amber-400"
        />
      </div>

      {/* ── TRAJETÓRIA + SALA DE TROFÉUS ───────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        {seasonRecords.length > 0 && (
          <Panel
            title="Trajetória"
            icon="timeline"
            meta={`${seasonRecords.length} ${seasonRecords.length === 1 ? "época" : "épocas"}`}
            className="lg:col-span-2"
          >
            <div className="flex flex-col gap-1.5">
              {seasonRecords.map((rec, i) => (
                <SeasonRow
                  key={rec.season}
                  rec={rec}
                  teamName={selectedTeam?.name}
                  hasTrophy={trophySeasons.has(rec.year)}
                  isBest={bestSeason != null && rec.season === bestSeason.season}
                  index={i}
                />
              ))}
            </div>
          </Panel>
        )}
        <Panel
          title="Sala de troféus"
          icon="emoji_events"
          meta={`${trophies.length} ${trophies.length === 1 ? "troféu" : "troféus"}`}
          className={seasonRecords.length === 0 ? "lg:col-span-3" : ""}
        >
          {trophies.length > 0 ? (
            <TrophyCabinet trophies={trophies} onOpenPlayer={openPlayer} />
          ) : (
            <EmptyState icon="trophy" title="Nenhum título conquistado." />
          )}
        </Panel>
      </div>

      {/* ── ARQUIVO DE JOGOS ───────────────────────────────────── */}
      {games.length > 0 && (
        <Panel title="Arquivo de jogos" icon="sports_soccer" meta={gamesMeta}>
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold text-on-surface-variant/60">
            <span aria-hidden className="material-symbols-outlined text-[13px]">
              info
            </span>
            Só épocas concluídas — a época em curso está no Calendário.
          </p>

          {records.length > 0 && (
            <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
              {records.map((tile) => (
                <RecordTile
                  key={tile.key}
                  icon={tile.icon}
                  label={tile.label}
                  tone={tile.tone}
                  value={tile.value}
                  sub={tile.sub}
                />
              ))}
            </div>
          )}

          <div className="mb-3 flex flex-col gap-2">
            <TabBar
              size="sm"
              expand
              tabs={[
                { key: "all", label: `Todos · ${kindCounts.all}` },
                { key: "league", label: `Liga · ${kindCounts.league}` },
                { key: "cup", label: `Taça · ${kindCounts.cup}` },
                { key: "friendly", label: `Amig. · ${kindCounts.friendly}` },
              ]}
              active={gamesFilter}
              onChange={changeGamesFilter}
            />
            <TabBar
              size="sm"
              expand
              tabs={[
                { key: "all", label: "Todos" },
                { key: "V", label: "Vitórias" },
                { key: "E", label: "Empates" },
                { key: "D", label: "Derrotas" },
              ]}
              active={resultFilter}
              onChange={changeResultFilter}
            />
          </div>

          {filteredGames.length === 0 ? (
            <p className="px-1 text-[11px] font-bold text-on-surface-variant/70">
              Sem jogos nesta combinação de filtros.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {gamesByYear.map(([year, yearGames]) => {
                const isOpen = expandedSeasons.has(year);
                const wins = yearGames.filter((i) => i.result === "V").length;
                const draws = yearGames.filter((i) => i.result === "E").length;
                const losses = yearGames.length - wins - draws;
                return (
                  <section key={year} aria-label={`Época ${year}`}>
                    <button
                      type="button"
                      onClick={() => toggleSeason(year)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center gap-2 rounded-md border border-outline-variant/25 bg-surface-container-high/40 px-3 py-2 text-left transition-colors hover:bg-surface-container-high"
                    >
                      <span className="text-[10px] font-black uppercase tracking-widest text-on-surface">
                        Época {year}
                      </span>
                      <span className="flex items-center gap-1.5 text-[9px] font-black tabular-nums">
                        <span className="text-emerald-400">{wins}V</span>
                        <span className="text-amber-400">{draws}E</span>
                        <span className="text-red-400">{losses}D</span>
                      </span>
                      <span className="text-[9px] font-bold tabular-nums text-on-surface-variant/60">
                        {yearGames.length}{" "}
                        {yearGames.length === 1 ? "jogo" : "jogos"}
                      </span>
                      <span
                        aria-hidden
                        className="material-symbols-outlined ml-auto text-sm text-on-surface-variant"
                      >
                        {isOpen ? "expand_less" : "expand_more"}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="mt-1.5 flex flex-col gap-1.5">
                        {yearGames.map((item, i) => (
                          <GameRow
                            key={`${item.game.kind}-${item.game.homeTeamId}-${item.game.awayTeamId}-${item.game.matchweek ?? item.game.round ?? 0}-${i}`}
                            item={item}
                            teamsById={teamsById}
                            onOpenTeam={onOpenTeamSquad}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </Panel>
      )}

      {/* ── LINHA DO TEMPO ─────────────────────────────────────── */}
      {events.length > 0 && (
        <Panel
          title="Linha do tempo"
          icon="history"
          meta={`${filteredEvents.length} eventos`}
        >
          <div className="mb-3">
            <TabBar
              size="sm"
              expand
              tabs={[
                { key: "all", label: "Todos" },
                { key: "market", label: "Mercado" },
                { key: "managers", label: "Técnicos" },
                { key: "prize", label: "Prémios" },
              ]}
              active={eventFilter}
              onChange={setEventFilter}
            />
          </div>
          {filteredEvents.length === 0 ? (
            <p className="px-1 text-[11px] font-bold text-on-surface-variant/70">
              Sem eventos nesta categoria.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {eventsByYear.map(([year, yearEvents]) => (
                <section key={year} aria-label={`Época ${year}`}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                      Época {year}
                    </span>
                    <span className="h-px flex-1 bg-outline-variant/20" />
                    <span className="text-[9px] font-bold tabular-nums text-on-surface-variant/50">
                      {yearEvents.length}
                    </span>
                  </div>
                  <div className="flex flex-col pl-0.5">
                    {yearEvents.map((evt, i) => (
                      <TimelineEvent
                        key={evt.id ?? `${year}-${evt.type}-${i}`}
                        evt={evt}
                        isLast={i === yearEvents.length - 1}
                        onOpenPlayer={openPlayer}
                        index={i}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
