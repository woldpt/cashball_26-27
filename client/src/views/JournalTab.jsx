/**
 * JournalTab — capa de jornal.
 *
 * Landing tab (pós-login e pós-jogo). Capa com quadros pequenos, todos
 * limitados à jornada anterior — só informação relevante para o leitor:
 *  - Manchete: o teu jogo da jornada (Liga; ou o teu jogo da Taça mais
 *    recente quando não jogaste na Liga).
 *  - A tua série: restantes jogos da tua divisão na jornada.
 *  - Humanos: jogos de treinadores humanos noutras divisões na jornada.
 *  - Classificação: mini-tabela da tua divisão (líder, zona do teu clube
 *    e descida).
 *  - Artilheiros: top 5 de `topScorers`.
 *  - Mercado: 5 transferências mais valiosas da época.
 *  - Bancadas: adeptos — estado de espírito, casa do teu jogo e melhor
 *    casa da série.
 *
 * Dados: `globalNews` ({news, results} com `attendance`/`homeCapacity` por
 * jogo) + `teams` (com `coach_is_human`, `coach_name`, `fans_mood`,
 * `ticket_price`) + `topScorers` + `teamForms` + `players` (coaches),
 * tudo do GameContext.
 */
import { useMemo } from "react";
import { Panel } from "../components/shared/Panel.jsx";
import { EmptyState } from "../components/shared/EmptyState.jsx";
import { TeamCrest } from "../components/live/TeamCrest.jsx";
import { formatCurrency } from "../utils/formatters.js";
import { getFansMoodLabel } from "../utils/morale.js";

const CUP_ROUND_LABELS = {
  1: "16 avos de final",
  2: "Oitavos de final",
  3: "Quartos de final",
  4: "Meias-finais",
  5: "Final",
};

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

/**
 * Linha compacta de resultado (série + humanos).
 */
function CompactResultRow({ r, teamById, myTeamId, contextLabel }) {
  const home = teamById.get(r.homeTeamId);
  const away = teamById.get(r.awayTeamId);
  const moms = [r.momHome?.playerName, r.momAway?.playerName].filter(Boolean);
  return (
    <div className="px-3 sm:px-4 short:px-2 py-2 short:py-1.5">
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
        <div className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-container-high border border-outline-variant/20">
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
  const headlineIsMine = headline != null;

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
    if (myDivision == null) return { rows: [], myPos: -1 };
    const divTeams = [...(teams || [])]
      .filter((t) => Number(t.division) === Number(myDivision))
      .sort(compareRows);
    const myPos = divTeams.findIndex((t) => Number(t.id) === myTeamId);
    const want = new Set([0, myPos - 1, myPos, myPos + 1, divTeams.length - 2, divTeams.length - 1]);
    const rows = divTeams
      .map((t, i) => ({ team: t, pos: i + 1 }))
      .filter(({ pos }) => want.has(pos - 1));
    return { rows, myPos: myPos + 1, total: divTeams.length };
  }, [teams, myDivision, myTeamId]);

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
    headlineIsMine ||
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

  const headlineOutcome =
    headline && myTeamId != null
      ? (() => {
          const mine = Number(headline.homeTeamId) === myTeamId ? "home" : "away";
          const gf = mine === "home" ? headline.homeScore : headline.awayScore;
          const ga = mine === "home" ? headline.awayScore : headline.homeScore;
          if (gf > ga) return { word: "Vitória", cls: "text-emerald-400" };
          if (gf < ga) return { word: "Derrota", cls: "text-error" };
          return { word: "Empate", cls: "text-amber-400" };
        })()
      : null;
  const headlineHome = headline ? teamById.get(headline.homeTeamId) : null;
  const headlineAway = headline ? teamById.get(headline.awayTeamId) : null;

  return (
    <div className="space-y-4 short:space-y-2">
      {/* ── CABEÇALHO ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-1 short:px-0">
        <h1 className="font-headline text-lg sm:text-2xl short:text-base font-black tracking-tight leading-none text-on-surface">
          Jornal
        </h1>
        <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
          {lastWeek > 0 ? `Jornada ${lastWeek}` : ""} · Época {seasonYear || ""}
        </span>
      </div>

      {/* ── MANCHETE ──────────────────────────────────────────────────── */}
      {headline && (
        <Panel
          title={
            headline.competition === "League"
              ? `Liga · Jornada ${headline.matchweek}`
              : `Taça · ${cupLabel(headline.round)}`
          }
          icon="newspaper"
          padded={false}
        >
          <div className="px-4 sm:px-6 short:px-3 py-4 short:py-2 flex items-center gap-3 short:gap-2">
            <div className="flex-1 min-w-0 flex flex-col items-center gap-1.5 text-center">
              <TeamCrest
                team={headlineHome || { name: headline.homeName }}
                isMine={Number(headline.homeTeamId) === myTeamId}
                size="lg"
                rotate={6}
              />
              <p className="text-sm font-black text-on-surface leading-tight">
                {headline.homeName}
              </p>
              {headline.momHome && (
                <p className="text-[10px] text-amber-400/90 truncate max-w-full">
                  ⭐ {headline.momHome.playerName}
                </p>
              )}
            </div>
            <div className="shrink-0 flex flex-col items-center gap-1">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-surface-container-high border border-outline-variant/20">
                <span className="text-2xl short:text-xl font-black text-on-surface tabular-nums">
                  {headline.homeScore}
                </span>
                <span className="text-xs text-on-surface-variant">–</span>
                <span className="text-2xl short:text-xl font-black text-on-surface tabular-nums">
                  {headline.awayScore}
                </span>
              </div>
              {headlineOutcome && (
                <span className={`text-[10px] font-black uppercase tracking-widest ${headlineOutcome.cls}`}>
                  {headlineOutcome.word}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0 flex flex-col items-center gap-1.5 text-center">
              <TeamCrest
                team={headlineAway || { name: headline.awayName }}
                isMine={Number(headline.awayTeamId) === myTeamId}
                size="lg"
                rotate={-6}
              />
              <p className="text-sm font-black text-on-surface leading-tight">
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
            <p className="px-4 short:px-3 pb-2.5 text-center text-[10px] text-on-surface-variant">
              🏟️ {myGameCrowd}
            </p>
          )}
        </Panel>
      )}

      {/* ── QUADROS ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 short:gap-2 items-start">
        {seriesGames.length > 0 && (
          <Panel
            title="A tua série"
            icon="leaderboard"
            meta={`Jornada ${lastWeek}`}
            padded={false}
          >
            <div className="divide-y divide-outline-variant/10">
              {seriesGames.map((r) => (
                <CompactResultRow
                  key={gameKey(r)}
                  r={r}
                  teamById={teamById}
                  myTeamId={myTeamId}
                />
              ))}
            </div>
          </Panel>
        )}

        {miniTable.rows.length > 0 && (
          <Panel
            title="Classificação"
            icon="table_chart"
            meta={miniTable.myPos > 0 ? `${miniTable.myPos}.º` : ""}
            padded={false}
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
                        ⋮
                      </p>
                    )}
                    <div
                      className={`flex items-center gap-2 px-3 short:px-2 py-1.5 border-l-2 ${marker} ${
                        isMe ? "bg-primary-container/20" : ""
                      }`}
                    >
                      <span className="w-4 shrink-0 text-[10px] font-black text-on-surface-variant tabular-nums">
                        {pos}
                      </span>
                      <TeamCrest team={team} isMine={isMe} size="sm" />
                      <p className="flex-1 min-w-0 text-xs font-black text-on-surface truncate">
                        {team.name}
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
          </Panel>
        )}

        {humanGames.length > 0 && (
          <Panel
            title="Humanos"
            icon="group"
            meta={`${humanGames.length} jogo${humanGames.length !== 1 ? "s" : ""}`}
            padded={false}
          >
            <div className="divide-y divide-outline-variant/10">
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
                  <CompactResultRow
                    key={gameKey(r)}
                    r={r}
                    teamById={teamById}
                    myTeamId={myTeamId}
                    contextLabel={`${div != null ? `Série ${div}` : "Taça"}${coachTxt ? ` · ${coachTxt}` : ""}`}
                  />
                );
              })}
            </div>
          </Panel>
        )}

        {scorers.length > 0 && (
          <Panel
            title="Artilheiros"
            icon="sports_soccer"
            meta="Top 5"
            padded={false}
          >
            <div className="divide-y divide-outline-variant/10">
              {scorers.map((s, i) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2.5 px-3 sm:px-4 short:px-2 py-2 short:py-1.5"
                >
                  <span
                    className={`shrink-0 w-5 h-5 flex items-center justify-center text-[9px] font-black rounded-sm ${
                      i === 0
                        ? "bg-tertiary text-on-tertiary"
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
                      {s.name}
                    </button>
                    <p className="text-[10px] text-on-surface-variant truncate">
                      {s.team_name || ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-black text-on-surface tabular-nums">
                    {s.goals} {s.goals === 1 ? "golo" : "golos"}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {topTransfers.length > 0 && (
          <Panel title="Mercado" icon="swap_horiz" meta="Top 5" padded={false}>
            <div className="divide-y divide-outline-variant/10">
              {topTransfers.map((n) => (
                <div
                  key={`t-${n.id}`}
                  className="flex items-center gap-2.5 px-3 sm:px-4 short:px-2 py-2 short:py-1.5"
                >
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
                    <span className="shrink-0 text-xs font-black text-emerald-400 tabular-nums">
                      {formatCurrency(n.amount)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        )}

        {fansMood != null && (
          <Panel title="Bancadas" icon="stadium" padded={false}>
            <div className="px-3 sm:px-4 short:px-2 py-2.5 short:py-1.5 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black text-on-surface">
                  {getFansMoodLabel(fansMood)}
                </p>
                {myTeam?.ticket_price != null && (
                  <p className="text-[10px] text-on-surface-variant">
                    Bilhete {formatCurrency(myTeam.ticket_price)}
                  </p>
                )}
              </div>
              <div
                className="h-1.5 rounded-full bg-surface-container-high overflow-hidden"
                role="progressbar"
                aria-valuenow={Math.max(0, Math.min(100, Number(fansMood) || 0))}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Estado de espírito dos adeptos"
              >
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${Math.max(0, Math.min(100, Number(fansMood) || 0))}%`,
                  }}
                />
              </div>
              {bestHouse && (
                <p className="text-[10px] text-on-surface-variant truncate">
                  Melhor casa da série: {bestHouse.homeName}{" "}
                  {Number(bestHouse.attendance).toLocaleString("pt-PT")}
                </p>
              )}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
