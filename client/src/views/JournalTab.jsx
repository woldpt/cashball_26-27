/**
 * JournalTab — capa de fanzine da bancada.
 *
 * Landing tab (pós-login e pós-jogo). Estética de jornal fotocopiado:
 * cabeçalho-masthead, manchete gigante do teu jogo com carimbo rodado,
 * tiras secundárias em molduras de banda desenhada (série, classificação,
 * humanos, artilheiros, mercado, bancadas) e voz de gozão de café
 * (utils/journalHeadlines.js, pt-PT).
 *
 * Dados: `globalNews` ({news, results} com `attendance`/`homeCapacity` por
 * jogo) + `teams` (com `coach_is_human`, `coach_name`, `fans_mood`,
 * `ticket_price`) + `topScorers` + `teamForms` + `players` (coaches),
 * tudo do GameContext.
 */
import { useMemo } from "react";
import { EmptyState } from "../components/shared/EmptyState.jsx";
import { TeamCrest } from "../components/live/TeamCrest.jsx";
import { formatCurrency } from "../utils/formatters.js";
import { getFansMoodLabel } from "../utils/morale.js";
import {
  buildHeadline,
  STAMP_TONE_CLASS,
} from "../utils/journalHeadlines.js";

const CUP_ROUND_LABELS = {
  1: "16 avos de final",
  2: "Oitavos de final",
  3: "Quartos de final",
  4: "Meias-finais",
  5: "Final",
};

const CARTOON_EMOJI = {
  megafone: "📣",
  bota: "👟",
  balde: "🪣",
  muralha: "🧱",
  apito: "📯",
  coroa: "👑",
};

/**
 * Nomes de capa do Jornal — feitos na bancada dos adeptos (banais, sem marca,
 * sem "cashball"). Cada época herda um par nome+slogan determinístico
 * (seed = seasonYear), estável durante toda a temporada e sem Math.random,
 * para a capa não oscilar entre renders.
 */
const MASTHEADS = [
  { name: "A Voz da Bancada", tagline: "a voz do povo que não cala — nem joga" },
  { name: "Feito na Bancada", tagline: "impresso entre assobios e palmas" },
  { name: "O Correio da Bancada", tagline: "notícias de cima, do quiosque e da tasca" },
  { name: "Do Alto da Bancada", tagline: "a melhor vista e os piores palpites" },
  { name: "O Grito da Bancada", tagline: "quando calamos é porque perdeu" },
  { name: "O Pingo da Bancada", tagline: "gotas de verdade entre a chuva de assobios" },
  { name: "O Boletim do Adepto", tagline: "o parecer oficial de quem só assobia" },
  { name: "Notícias da Tasca", tagline: "tudo o que se soube antes do pão com manteiga" },
];

/**
 * Ordenação canónica da classificação: pontos → diferença de golos →
 * golos marcados → nome (igual ao servidor e a `standingsRank`).
 */
function compareRows(a, b) {
  return (
    (b.points || 0) - (a.points || 0) ||
    (b.goals_for || 0) -
      (b.goals_against || 0) -
      ((a.goals_for || 0) - (a.goals_against || 0)) ||
    (b.goals_for || 0) - (a.goals_for || 0) ||
    String(a.name || "").localeCompare(String(b.name || ""))
  );
}

function cupLabel(round) {
  return CUP_ROUND_LABELS[round] || `Ronda ${round}`;
}

function gameKey(r) {
  return `${r.competition}|${r.matchweek ?? ""}|${r.round ?? ""}|${r.homeTeamId}|${r.awayTeamId}`;
}

function crowdLine(r) {
  if (r?.attendance == null) return null;
  const occ =
    r.homeCapacity > 0
      ? ` · ${Math.round((r.attendance / r.homeCapacity) * 100)}%`
      : "";
  return `${Number(r.attendance).toLocaleString("pt-PT")}${occ}`;
}

/* ── Rabiscos: estrela de banda desenhada com emoji lá dentro ──────────── */
function Burst({ emoji, className = "text-tertiary", size = 56 }) {
  return (
    <span
      aria-hidden
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} className="absolute inset-0">
        <path
          d="M50 2 L61 22 L82 12 L80 34 L100 40 L84 54 L96 72 L74 72 L70 94 L54 78 L38 94 L34 72 L12 72 L24 54 L8 40 L28 34 L26 12 L47 22 Z"
          fill="currentColor"
          opacity="0.9"
        />
        <circle cx="50" cy="52" r="26" fill="var(--color-surface-container)" />
      </svg>
      <span className="relative text-2xl leading-none">{emoji}</span>
    </span>
  );
}

/* ── Tira de fita-cola (pura decoração) ────────────────────────────────── */
function Tape({ className = "" }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute -top-0 left-10 h-5 w-20 -translate-y-1/2 rotate-[-6deg] bg-tertiary/50 shadow-sm ${className}`}
    />
  );
}

/* ── Moldura fanzine: cartão com sombra dura + autocolante de título ───── */
function FanzineCard({
  sticker,
  stickerClass = "bg-tertiary text-zinc-950",
  meta,
  tilt = "",
  children,
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-md border-2 border-on-surface/15 bg-surface-container shadow-[4px_4px_0_rgba(0,0,0,0.45)] ${tilt}`}
    >
      <Tape />
      <div className="flex items-center justify-between gap-2 px-3 short:px-2 pt-3 short:pt-2">
        <span
          className={`inline-flex -rotate-2 rounded-sm px-2 py-0.5 text-[10px] font-black uppercase tracking-widest shadow-md shadow-black/50 ${stickerClass}`}
        >
          {sticker}
        </span>
        {meta && (
          <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
            {meta}
          </span>
        )}
      </div>
      <div className="px-1.5 pb-1.5 pt-1">{children}</div>
    </section>
  );
}

/* ── Resultado em vinheta de banda desenhada ───────────────────────────── */
function ComicResultRow({ r, teamById, myTeamId, contextLabel }) {
  const home = teamById.get(r.homeTeamId);
  const away = teamById.get(r.awayTeamId);
  const moms = [r.momHome?.playerName, r.momAway?.playerName].filter(Boolean);
  return (
    <div className="m-1.5 rounded-sm border border-dashed border-outline-variant/40 bg-surface-container-low px-2 py-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <TeamCrest
          team={home || { name: r.homeName }}
          isMine={r.homeTeamId === myTeamId}
          size="sm"
          rotate={6}
        />
        <p className="flex-1 min-w-0 text-right text-xs font-black text-on-surface truncate">
          {r.homeName}
        </p>
        <div className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-container-high border-2 border-on-surface/20">
          <span className="text-xs font-black text-on-surface tabular-nums">{r.homeScore}</span>
          <span className="text-[10px] text-on-surface-variant">–</span>
          <span className="text-xs font-black text-on-surface tabular-nums">{r.awayScore}</span>
        </div>
        <p className="flex-1 min-w-0 text-xs font-black text-on-surface truncate">
          {r.awayName}
        </p>
        <TeamCrest
          team={away || { name: r.awayName }}
          isMine={r.awayTeamId === myTeamId}
          size="sm"
          rotate={-6}
        />
      </div>
      {(moms.length > 0 || contextLabel) && (
        <p className="mt-0.5 text-[10px] text-on-surface-variant truncate text-center">
          {moms.length > 0 ? `⭐ ${moms.join(" · ")}` : ""}
          {moms.length > 0 && contextLabel ? " · " : ""}
          {contextLabel || ""}
        </p>
      )}
    </div>
  );
}

/** Pontinhos de forma V/E/D (letra mais recente à direita). */
function MiniFormDots({ form = "" }) {
  const chars = String(form).split("").slice(-5);
  while (chars.length < 5) chars.unshift(null);
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      {chars.map((c, i) => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${
            c === "V"
              ? "bg-emerald-500"
              : c === "E"
                ? "bg-amber-500"
                : c === null
                  ? "bg-surface-container-high"
                  : "bg-red-500"
          }`}
        />
      ))}
    </span>
  );
}

/**
 * @param {{
 *   globalNews: {news: Array, results: Array},
 *   teams: Array,
 *   me: object,
 *   seasonYear: number,
 *   topScorers?: Array,
 *   teamForms?: Object,
 *   players?: Array,
 *   onOpenPlayerHistory?: (player: {id:number}) => void,
 * }} props
 */
export function JournalTab({
  globalNews = { news: [], results: [] },
  teams = [],
  me,
  seasonYear,
  topScorers = [],
  teamForms = {},
  players = [],
  onOpenPlayerHistory,
}) {
  // Masthead da época (nome+slogan) — determinístico por seasonYear.
  const masthead = useMemo(() => {
    const list = MASTHEADS;
    return list[Math.abs(Number(seasonYear) || 0) % list.length];
  }, [seasonYear]);

  const news = useMemo(
    () => (Array.isArray(globalNews?.news) ? globalNews.news : []),
    [globalNews],
  );
  const results = useMemo(
    () => (Array.isArray(globalNews?.results) ? globalNews.results : []),
    [globalNews],
  );

  const teamById = useMemo(() => {
    const map = new Map();
    for (const t of teams || []) map.set(t.id, t);
    return map;
  }, [teams]);

  const myTeamId = me?.teamId != null ? Number(me.teamId) : null;
  const myTeam = useMemo(
    () =>
      myTeamId == null
        ? null
        : ((teams || []).find((t) => Number(t.id) === myTeamId) ?? null),
    [teams, myTeamId],
  );
  const myDivision = myTeam?.division ?? null;

  const humanTeamIds = useMemo(() => {
    const set = new Set();
    for (const t of teams || [])
      if (t.coach_is_human === 1) set.add(Number(t.id));
    for (const p of players || [])
      if (p?.teamId != null) set.add(Number(p.teamId));
    return set;
  }, [teams, players]);

  const coachByTeamId = useMemo(() => {
    const map = new Map();
    for (const t of teams || [])
      if (t.coach_name) map.set(Number(t.id), t.coach_name);
    return map;
  }, [teams]);

  // ── Jornada anterior (só Liga) ──────────────────────────────────────────
  const leagueResults = useMemo(
    () => results.filter((r) => r.competition === "League"),
    [results],
  );
  const lastWeek = useMemo(
    () =>
      leagueResults.reduce((max, r) => Math.max(max, r.matchweek || 0), 0),
    [leagueResults],
  );
  const lastWeekGames = useMemo(
    () => leagueResults.filter((r) => (r.matchweek || 0) === lastWeek),
    [leagueResults, lastWeek],
  );

  // ── Manchete: o meu jogo da jornada; senão o meu jogo da Taça ──────────
  const myLeagueGame = useMemo(
    () =>
      myTeamId == null
        ? null
        : (lastWeekGames.find(
            (r) =>
              Number(r.homeTeamId) === myTeamId ||
              Number(r.awayTeamId) === myTeamId,
          ) ?? null),
    [lastWeekGames, myTeamId],
  );
  const myCupGame = useMemo(() => {
    if (myTeamId == null) return null;
    const mine = results.filter(
      (r) =>
        r.competition === "Cup" &&
        (Number(r.homeTeamId) === myTeamId ||
          Number(r.awayTeamId) === myTeamId),
    );
    mine.sort((a, b) => (b.round || 0) - (a.round || 0));
    return mine[0] ?? null;
  }, [results, myTeamId]);
  const headline = useMemo(
    () => myLeagueGame ?? myCupGame,
    [myLeagueGame, myCupGame],
  );

  // ── Posições na série (para o gozão: tombar gigantes / tropeções) ───────
  const divStandings = useMemo(() => {
    if (myDivision == null) return [];
    return [...(teams || [])]
      .filter((t) => Number(t.division) === Number(myDivision))
      .sort(compareRows);
  }, [teams, myDivision]);
  const myPos = useMemo(() => {
    if (myTeamId == null) return null;
    const i = divStandings.findIndex((t) => Number(t.id) === myTeamId);
    return i >= 0 ? i + 1 : null;
  }, [divStandings, myTeamId]);
  const oppPos = useMemo(() => {
    if (!headline || headline.competition !== "League") return null;
    const oppId =
      Number(headline.homeTeamId) === myTeamId
        ? Number(headline.awayTeamId)
        : Number(headline.homeTeamId);
    const i = divStandings.findIndex((t) => Number(t.id) === oppId);
    return i >= 0 ? i + 1 : null;
  }, [headline, divStandings, myTeamId]);

  const voice = useMemo(
    () =>
      buildHeadline(headline, {
        myTeamId,
        myPos,
        oppPos,
        totalTeams: divStandings.length || null,
      }),
    [headline, myTeamId, myPos, oppPos, divStandings],
  );
  const stampClass = STAMP_TONE_CLASS[voice.stamp.tone] || STAMP_TONE_CLASS.draw;

  // ── A minha série (jornada, sem o jogo da manchete) ─────────────────────
  const seriesGames = useMemo(() => {
    if (myDivision == null) return [];
    const key = headline ? gameKey(headline) : null;
    return lastWeekGames.filter(
      (r) =>
        (Number(r.homeDivision) === Number(myDivision) ||
          Number(r.awayDivision) === Number(myDivision)) &&
        gameKey(r) !== key,
    );
  }, [lastWeekGames, myDivision, headline]);

  // ── Humanos noutras divisões (jornada) ──────────────────────────────────
  const humanGames = useMemo(() => {
    if (myDivision == null) return [];
    const key = headline ? gameKey(headline) : null;
    return lastWeekGames.filter((r) => {
      if (gameKey(r) === key) return false;
      const inMyDiv =
        Number(r.homeDivision) === Number(myDivision) ||
        Number(r.awayDivision) === Number(myDivision);
      if (inMyDiv) return false;
      return (
        humanTeamIds.has(Number(r.homeTeamId)) ||
        humanTeamIds.has(Number(r.awayTeamId))
      );
    });
  }, [lastWeekGames, myDivision, headline, humanTeamIds]);

  // ── Mini-classificação da minha divisão ─────────────────────────────────
  const miniTable = useMemo(() => {
    if (myDivision == null) return { rows: [], myPos: -1, total: 0 };
    const divTeams = [...divStandings];
    const pos = divTeams.findIndex((t) => Number(t.id) === myTeamId);
    const want = new Set([0, pos - 1, pos, pos + 1, divTeams.length - 2, divTeams.length - 1]);
    const rows = divTeams
      .map((t, i) => ({ team: t, pos: i + 1 }))
      .filter(({ pos: p }) => want.has(p - 1));
    return { rows, myPos: pos + 1, total: divTeams.length };
  }, [divStandings, myDivision, myTeamId]);

  // ── Artilheiros + mercado ───────────────────────────────────────────────
  const scorers = useMemo(
    () => (Array.isArray(topScorers) ? topScorers.slice(0, 5) : []),
    [topScorers],
  );
  const topTransfers = useMemo(
    () =>
      news
        .filter((n) => n.source === "transfer")
        .sort((a, b) => (b.amount || 0) - (a.amount || 0))
        .slice(0, 5),
    [news],
  );

  // ── Bancadas ────────────────────────────────────────────────────────────
  const fansMood = myTeam?.fans_mood ?? null;
  const myGameCrowd = headline ? crowdLine(headline) : null;
  const bestHouse = useMemo(() => {
    const pool = [...seriesGames, ...(myLeagueGame ? [myLeagueGame] : [])].filter(
      (r) => r.attendance != null,
    );
    if (pool.length === 0) return null;
    pool.sort((a, b) => (b.attendance || 0) - (a.attendance || 0));
    return pool[0];
  }, [seriesGames, myLeagueGame]);

  const hasAnything =
    headline != null ||
    seriesGames.length > 0 ||
    humanGames.length > 0 ||
    miniTable.rows.length > 0 ||
    scorers.length > 0 ||
    topTransfers.length > 0;

  if (!hasAnything) {
    return (
      <div className="space-y-4 short:space-y-2">
        <EmptyState
          emoji="📰"
          title="Jornal sem manchetes"
          description="Ainda não se jogou nesta época."
        />
      </div>
    );
  }

  const headlineHome = headline ? teamById.get(headline.homeTeamId) : null;
  const headlineAway = headline ? teamById.get(headline.awayTeamId) : null;

  return (
    <div className="space-y-4 short:space-y-2">
      {/* ── MASTHEAD ──────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-md border-2 border-on-surface/20 bg-surface-container px-4 short:px-3 py-3 short:py-2 shadow-[4px_4px_0_rgba(0,0,0,0.45)]">
        <Tape className="left-1/2" />
        <div aria-hidden className="tactical-pattern absolute inset-0" />
        <div className="relative flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="inline-flex -rotate-2 rounded-sm bg-error px-1.5 py-px text-[9px] font-black uppercase tracking-widest text-zinc-950 shadow-md shadow-black/50">
              {masthead.tagline}
            </p>
            <h1 className="mt-1 font-headline text-2xl sm:text-4xl short:text-xl font-black uppercase tracking-tight leading-none text-on-surface">
              {masthead.name}
            </h1>
            <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
              {lastWeek > 0 ? `N.º ${lastWeek}` : "N.º 0"} · Época {seasonYear || ""} · Preço: 3 pontos
            </p>
          </div>
          <Burst emoji="📰" className="text-primary hidden sm:inline-flex" size={60} />
        </div>
      </div>

      {/* ── MANCHETE GIGANTE ──────────────────────────────────────────── */}
      {headline && (
        <section className="relative overflow-hidden rounded-md border-2 border-tertiary/40 bg-surface-container shadow-[6px_6px_0_rgba(0,0,0,0.5)]">
          <Tape />
          <Tape className="left-auto right-10 rotate-[5deg]" />
          <div aria-hidden className="tactical-pattern absolute inset-0" />
          {/* Carimbo rodado */}
          <span
            className={`absolute right-2 sm:right-4 top-9 sm:top-10 rotate-[12deg] rounded-sm border-4 px-2 py-0.5 font-headline text-sm sm:text-lg font-black uppercase tracking-widest bg-surface/70 ${stampClass}`}
          >
            {voice.stamp.text}
          </span>
          <div className="relative px-4 sm:px-6 short:px-3 pt-4 short:pt-3 pb-3">
            <div className="flex items-start gap-3">
              <Burst emoji={CARTOON_EMOJI[voice.cartoon] || "📣"} className="text-tertiary mt-1" size={64} />
              <div className="min-w-0 flex-1">
                <p className="inline-flex -rotate-1 rounded-sm bg-primary px-1.5 py-px text-[9px] font-black uppercase tracking-widest text-zinc-950">
                  {voice.kicker}
                </p>
                <h2 className="mt-1 font-headline text-2xl sm:text-4xl short:text-xl font-black uppercase tracking-tight leading-[1.02] text-on-surface">
                  {voice.title}
                </h2>
                <p className="mt-1 text-xs sm:text-sm short:text-[11px] text-on-surface-variant italic leading-snug">
                  {voice.subtitle}
                </p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/70">
                  {headline.competition === "League"
                    ? `Liga · Jornada ${headline.matchweek}`
                    : `Taça · ${cupLabel(headline.round)}`}
                </p>
              </div>
            </div>

            {/* Placar */}
            <div className="mt-3 flex items-center gap-3 short:gap-2 rounded-sm border-2 border-on-surface/20 bg-surface-container-low px-3 py-3 short:py-2">
              <div className="flex-1 min-w-0 flex flex-col items-center gap-1.5 text-center">
                <TeamCrest
                  team={headlineHome || { name: headline.homeName }}
                  isMine={Number(headline.homeTeamId) === myTeamId}
                  size="lg"
                  rotate={6}
                />
                <p className="text-sm short:text-xs font-black text-on-surface leading-tight break-words">
                  {headline.homeName}
                </p>
                {headline.momHome && (
                  <p className="text-[10px] text-amber-400/90 truncate max-w-full">
                    ⭐ {headline.momHome.playerName}
                  </p>
                )}
              </div>
              <div className="shrink-0 flex flex-col items-center gap-1 px-3 py-1.5 rounded bg-surface-container-high border-2 border-tertiary/40 -rotate-1">
                <div className="flex items-center gap-2">
                  <span className="text-3xl sm:text-5xl short:text-2xl font-black font-headline text-on-surface tabular-nums">
                    {headline.homeScore}
                  </span>
                  <span className="font-headline text-lg text-tertiary">–</span>
                  <span className="text-3xl sm:text-5xl short:text-2xl font-black font-headline text-on-surface tabular-nums">
                    {headline.awayScore}
                  </span>
                </div>
              </div>
              <div className="flex-1 min-w-0 flex flex-col items-center gap-1.5 text-center">
                <TeamCrest
                  team={headlineAway || { name: headline.awayName }}
                  isMine={Number(headline.awayTeamId) === myTeamId}
                  size="lg"
                  rotate={-6}
                />
                <p className="text-sm short:text-xs font-black text-on-surface leading-tight break-words">
                  {headline.awayName}
                </p>
                {headline.momAway && (
                  <p className="text-[10px] text-amber-400/90 truncate max-w-full">
                    ⭐ {headline.momAway.playerName}
                  </p>
                )}
              </div>
            </div>

            {myGameCrowd && (
              <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                🏟️ {myGameCrowd} nas bancadas
              </p>
            )}
          </div>
        </section>
      )}

      {/* ── TIRAS FANZINE ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 short:gap-2 items-start">
        {seriesGames.length > 0 && (
          <FanzineCard sticker="A tua série" meta={`Jornada ${lastWeek}`} tilt="sm:rotate-[0.4deg]">
            <div>
              {seriesGames.map((r) => (
                <ComicResultRow
                  key={gameKey(r)}
                  r={r}
                  teamById={teamById}
                  myTeamId={myTeamId}
                />
              ))}
            </div>
            <p className="px-2.5 pb-2 text-[10px] italic text-on-surface-variant/70">
              Recorte e cole no caderno do mister. ✂️
            </p>
          </FanzineCard>
        )}

        {miniTable.rows.length > 0 && (
          <FanzineCard
            sticker="Classificação"
            stickerClass="bg-primary text-zinc-950"
            meta={miniTable.myPos > 0 ? `${miniTable.myPos}.º` : ""}
            tilt="sm:rotate-[-0.4deg]"
          >
            <div>
              {miniTable.rows.map(({ team, pos }, i) => {
                const prev = miniTable.rows[i - 1]?.pos ?? null;
                const gap = prev != null && pos - prev > 1;
                const isMe = Number(team.id) === myTeamId;
                const played =
                  (team.wins || 0) + (team.draws || 0) + (team.losses || 0);
                const marker =
                  myDivision > 1 && pos <= 2
                    ? "border-l-emerald-500"
                    : pos > miniTable.total - 2
                      ? "border-l-red-500"
                      : "border-l-transparent";
                return (
                  <div key={team.id}>
                    {gap && (
                      <p className="px-3 text-center text-[10px] text-on-surface-variant/50 leading-none py-0.5">
                        ✂️ - - - - - - - - -
                      </p>
                    )}
                    <div
                      className={`flex items-center gap-2 px-2.5 short:px-2 py-1.5 border-l-2 ${marker} ${
                        isMe ? "bg-primary-container/25 -rotate-[0.5deg]" : ""
                      }`}
                    >
                      <span className="w-4 shrink-0 text-[10px] font-black text-on-surface-variant tabular-nums">
                        {pos}
                      </span>
                      <TeamCrest team={team} isMine={isMe} size="sm" />
                      <p className="flex-1 min-w-0 text-xs font-black text-on-surface truncate">
                        {pos === 1 ? "👑 " : ""}{team.name}
                        {isMe ? " · TU" : ""}
                      </p>
                      <MiniFormDots form={teamForms[team.id] || ""} />
                      <span className="w-6 shrink-0 text-right text-[10px] text-on-surface-variant tabular-nums">
                        {played}J
                      </span>
                      <span className="w-7 shrink-0 text-right text-xs font-black text-on-surface tabular-nums">
                        {team.points || 0}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </FanzineCard>
        )}

        {humanGames.length > 0 && (
          <FanzineCard
            sticker="Os outros humanos"
            stickerClass="bg-amber-500 text-zinc-950"
            meta={`${humanGames.length} jogo${humanGames.length !== 1 ? "s" : ""}`}
            tilt="sm:rotate-[0.4deg]"
          >
            <div>
              {humanGames.map((r) => {
                const div =
                  Number(r.homeDivision) === Number(r.awayDivision)
                    ? r.homeDivision
                    : null;
                const coachIds = [r.homeTeamId, r.awayTeamId].filter((id) =>
                  humanTeamIds.has(Number(id)),
                );
                const coachTxt = coachIds
                  .map((id) => coachByTeamId.get(Number(id)))
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <ComicResultRow
                    key={gameKey(r)}
                    r={r}
                    teamById={teamById}
                    myTeamId={myTeamId}
                    contextLabel={`${div != null ? `Série ${div}` : "Taça"}${coachTxt ? ` · 🧢 ${coachTxt}` : ""}`}
                  />
                );
              })}
            </div>
            <p className="px-2.5 pb-2 text-[10px] italic text-on-surface-variant/70">
              Espionagem legal: vê como andam os teus rivais de carne e osso. 🕵️
            </p>
          </FanzineCard>
        )}

        {scorers.length > 0 && (
          <FanzineCard
            sticker="Artilheiros"
            stickerClass="bg-tertiary text-zinc-950"
            meta="Top 5"
            tilt="sm:rotate-[-0.4deg]"
          >
            <div>
              {scorers.map((s, i) => (
                <div
                  key={s.id}
                  className={`flex items-center gap-2.5 px-2.5 short:px-2 py-2 short:py-1.5 m-1.5 rounded-sm border ${
                    i === 0
                      ? "border-tertiary/50 bg-tertiary/10 -rotate-[0.5deg]"
                      : "border-dashed border-outline-variant/40 bg-surface-container-low"
                  }`}
                >
                  <span
                    className={`shrink-0 w-6 h-6 flex items-center justify-center text-[10px] font-black rounded-sm rotate-[-4deg] ${
                      i === 0
                        ? "bg-tertiary text-zinc-950"
                        : "bg-surface-bright text-on-surface"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() =>
                        s.id != null && onOpenPlayerHistory?.({ id: s.id })
                      }
                      className="block max-w-full truncate text-xs font-black text-on-surface hover:text-primary transition-colors text-left"
                    >
                      {i === 0 ? "👑 " : ""}{s.name}
                    </button>
                    <p className="text-[10px] text-on-surface-variant truncate">
                      {s.team_name || ""}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-sm bg-surface-container-high border border-on-surface/15 px-1.5 py-0.5 text-xs font-black text-on-surface tabular-nums rotate-[2deg]">
                    {s.goals} {s.goals === 1 ? "golo" : "golos"}
                  </span>
                </div>
              ))}
            </div>
          </FanzineCard>
        )}

        {topTransfers.length > 0 && (
          <FanzineCard
            sticker="Mercado negro… quer dizer, mercado"
            stickerClass="bg-emerald-400 text-zinc-950"
            meta="Top 5"
            tilt="sm:rotate-[0.4deg]"
          >
            <div>
              {topTransfers.map((n) => (
                <div
                  key={`t-${n.id}`}
                  className="flex items-center gap-2.5 px-2.5 short:px-2 py-2 short:py-1.5 m-1.5 rounded-sm border border-dashed border-outline-variant/40 bg-surface-container-low"
                >
                  <span aria-hidden className="shrink-0 text-base">🏷️</span>
                  <div className="flex-1 min-w-0">
                    {n.player_id && n.player_name ? (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenPlayerHistory?.({
                            id: n.player_id,
                            name: n.player_name,
                          })
                        }
                        className="block max-w-full truncate text-xs font-black text-on-surface hover:text-primary transition-colors text-left"
                      >
                        {n.player_name}
                      </button>
                    ) : (
                      <p className="truncate text-xs font-black text-on-surface">
                        {n.title}
                      </p>
                    )}
                    <p className="text-[10px] text-on-surface-variant truncate">
                      {n.title.includes("→")
                        ? n.title.split("·").slice(1).join("·").trim() ||
                          n.title
                        : n.title}
                      {n.description ? ` · ${n.description}` : ""}
                    </p>
                  </div>
                  {n.amount != null && (
                    <span className="shrink-0 rotate-[2deg] rounded-sm bg-emerald-400 px-1.5 py-0.5 text-[11px] font-black text-zinc-950 tabular-nums shadow-md shadow-black/50">
                      {formatCurrency(n.amount)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </FanzineCard>
        )}

        {fansMood != null && (
          <FanzineCard
            sticker="Bancadas"
            stickerClass="bg-error text-zinc-950"
            meta="Termómetro"
            tilt="sm:rotate-[-0.4deg]"
          >
            <div className="px-2.5 short:px-2 py-2.5 short:py-1.5">
              <div className="flex items-center gap-2.5">
                <Burst emoji={fansMood >= 70 ? "🥳" : fansMood >= 45 ? "🙂" : fansMood >= 25 ? "😬" : "🤬"} className={fansMood >= 70 ? "text-tertiary" : fansMood >= 45 ? "text-primary" : fansMood >= 25 ? "text-amber-500" : "text-error"} size={52} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-black text-on-surface truncate">
                      {getFansMoodLabel(fansMood)}
                    </p>
                    {myTeam?.ticket_price != null && (
                      <p className="shrink-0 text-[10px] text-on-surface-variant">
                        🎟️ {formatCurrency(myTeam.ticket_price)}
                      </p>
                    )}
                  </div>
                  <div
                    className="mt-1.5 h-2.5 rounded-full bg-surface-container-high border border-on-surface/15 overflow-hidden"
                    role="progressbar"
                    aria-valuenow={Math.max(0, Math.min(100, Number(fansMood) || 0))}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Estado de espírito dos adeptos"
                  >
                    <div
                      className={`h-full rounded-full transition-all ${fansMood >= 70 ? "bg-tertiary" : fansMood >= 45 ? "bg-primary" : fansMood >= 25 ? "bg-amber-500" : "bg-error"}`}
                      style={{
                        width: `${Math.max(0, Math.min(100, Number(fansMood) || 0))}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] italic text-on-surface-variant/80">
                    {fansMood >= 70
                      ? "A bancada está pelo clube — tragam é golos!"
                      : fansMood >= 45
                        ? "Morno. Um bom resultado e isto ferve."
                        : fansMood >= 25
                          ? "Adeptos de sobrolho carregado. Cuidado com os assobios."
                          : "Lenços brancos na gaveta… por enquanto."}
                  </p>
                </div>
              </div>
              {bestHouse && (
                <p className="mt-1.5 rounded-sm border border-dashed border-outline-variant/40 bg-surface-container-low px-2 py-1 text-[10px] text-on-surface-variant truncate">
                  🏟️ Melhor casa da série: {bestHouse.homeName}{" "}
                  {Number(bestHouse.attendance).toLocaleString("pt-PT")}
                </p>
              )}
            </div>
          </FanzineCard>
        )}
      </div>

      {/* ── RODAPÉ ────────────────────────────────────────────────────── */}
      <p className="text-center text-[10px] italic text-on-surface-variant/60 px-4">
        Impresso na bancada com tinta e suor · Proibido insultar o árbitro ·
        Devolver ao quiosque depois de ler 🗞️
      </p>
    </div>
  );
}
