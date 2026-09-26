import { useMemo, memo } from "react";
import { motion } from "framer-motion";
import { SEASON_CALENDAR, CUP_FINAL_STADIUM } from "../constants/index.js";
import { generateLeagueFixtures } from "../utils/fixtures.js";
import { TabBar } from "../components/shared/TabBar.jsx";
import { Badge } from "../components/shared/Badge.jsx";
import { EmptyState } from "../components/shared/EmptyState.jsx";
import { Panel } from "../components/shared/Panel.jsx";
import { staggerItemProps } from "../motion.js";

// Rondas com significado especial — o SEASON_CALENDAR não as nomeia.
const FRIENDLY_ROUND = 0;
const CUP_FINAL_ROUND = 5;

// Desfecho → variante Badge (§5) + acento lateral + cor do marcador.
// Um só mapa: antes misturava `error` com `red/emerald-500` hardcoded.
const OUTCOME_BADGE = { won: "sold", drew: "warning", lost: "error" };
const OUTCOME_ACCENT = {
  won: "border-l-emerald-500",
  drew: "border-l-amber-500",
  lost: "border-l-error",
};
const OUTCOME_TEXT = {
  won: "text-emerald-400",
  drew: "text-amber-400",
  lost: "text-error",
};
const VENUE_BADGE = { Casa: "sold", Fora: "info", Neutro: "warning" };
const TYPE_ICON = {
  league: "sports_soccer",
  friendly: "handshake",
  cup: "trophy",
};

// ── Helpers puros (fora do render) ──────────────────────────────────────
// As fixtures da liga usam { homeTeamId, awayTeamId } e as da Taça
// { home_team_id, away_team_id } — os acessores cobrem os dois formatos.

const homeIdOf = (f) => f?.home_team_id ?? f?.homeTeamId ?? null;
const awayIdOf = (f) => f?.away_team_id ?? f?.awayTeamId ?? null;

const findMyFixture = (fixtures, myTeamId) =>
  fixtures.find(
    (f) => homeIdOf(f) === myTeamId || awayIdOf(f) === myTeamId,
  ) ?? null;

const opponentOf = (teams, match, myTeamId) => {
  if (!match) return null;
  const oppId =
    homeIdOf(match) === myTeamId ? awayIdOf(match) : homeIdOf(match);
  return teams.find((t) => t.id === oppId) ?? null;
};

// Devolve sempre { myScore, opScore } (null quando ainda por jogar).
const splitScore = (playedMatch, myTeamId) => {
  if (!playedMatch) return { myScore: null, opScore: null };
  const imHome = homeIdOf(playedMatch) === myTeamId;
  const homeScore = playedMatch.home_score ?? null;
  const awayScore = playedMatch.away_score ?? null;
  return {
    myScore: imHome ? homeScore : awayScore,
    opScore: imHome ? awayScore : homeScore,
  };
};

const buildFriendlyItem = (entry, status, ctx) => {
  const { cal, teams, myTeam, myTeamId } = ctx;
  const fixtures =
    cal?.cupMatches?.filter((m) => m.round === FRIENDLY_ROUND) ?? [];
  const myMatch = findMyFixture(fixtures, myTeamId);
  const opponent = opponentOf(teams, myMatch, myTeamId);
  const imHome = homeIdOf(myMatch) === myTeamId;
  const { myScore, opScore } = splitScore(
    myMatch?.played ? myMatch : null,
    myTeamId,
  );
  return {
    entry,
    status,
    type: "friendly",
    opponent,
    imHome,
    stadiumTeam: imHome ? myTeam : opponent,
    venueLabel: opponent ? (imHome ? "Casa" : "Fora") : "—",
    myScore,
    opScore,
    won:
      myScore != null && opScore != null ? myScore > opScore : null,
    drew:
      myScore != null && opScore != null ? myScore === opScore : null,
  };
};

const buildCupItem = (entry, status, ctx) => {
  const { cal, teams, myTeam, myTeamId, eliminatedCupRound } = ctx;
  // Rondas após a eliminação → placeholder de eliminado.
  if (eliminatedCupRound !== null && entry.round > eliminatedCupRound) {
    return { entry, status, type: "cup", eliminated: true };
  }
  const fixtures =
    cal?.cupMatches?.filter((m) => m.round === entry.round) ?? [];
  const myMatch = findMyFixture(fixtures, myTeamId);
  // Sem jogo sorteado para mim → placeholder TBD em vez de esconder a ronda.
  const playedMatch = myMatch?.played ? myMatch : null;
  const opponent = opponentOf(teams, myMatch, myTeamId);
  const imHome = homeIdOf(myMatch) === myTeamId;
  const isFinal = entry.round === CUP_FINAL_ROUND;
  const stadiumTeam = isFinal
    ? { stadium_name: CUP_FINAL_STADIUM }
    : imHome
      ? myTeam
      : opponent;
  const venueLabel = isFinal
    ? "Neutro"
    : opponent
      ? imHome
        ? "Casa"
        : "Fora"
      : "—";
  const hasPen =
    !!playedMatch &&
    ((playedMatch.home_penalties ?? 0) > 0 ||
      (playedMatch.away_penalties ?? 0) > 0);
  const { myScore, opScore } = splitScore(playedMatch, myTeamId);
  const myPen = hasPen
    ? imHome
      ? playedMatch.home_penalties
      : playedMatch.away_penalties
    : null;
  const opPen = hasPen
    ? imHome
      ? playedMatch.away_penalties
      : playedMatch.home_penalties
    : null;
  return {
    entry,
    status,
    type: "cup",
    opponent,
    imHome,
    stadiumTeam,
    venueLabel,
    hasPen,
    myScore,
    opScore,
    myPen,
    opPen,
    won: playedMatch ? playedMatch.winner_team_id === myTeamId : null,
  };
};

const buildLeagueItem = (entry, status, ctx) => {
  const { cal, teams, myTeam, myTeamId, myDivision, myDivTeams } = ctx;
  const divFixtures =
    status === "done"
      ? (cal?.leagueMatches
          ?.filter(
            (m) =>
              m.matchweek === entry.matchweek &&
              myDivTeams.some((t) => t.id === m.home_team_id) &&
              myDivTeams.some((t) => t.id === m.away_team_id),
          )
          .map((m) => ({
            homeTeamId: m.home_team_id,
            awayTeamId: m.away_team_id,
            result: m,
          })) ?? [])
      : generateLeagueFixtures(
          cal?.fixtureSeeds?.[myDivision] ?? myDivTeams.map((t) => t.id),
          entry.matchweek,
        ).map((f) => ({ ...f, result: null }));
  const myFixture = findMyFixture(divFixtures, myTeamId);
  if (!myFixture) return null;
  const imHome = homeIdOf(myFixture) === myTeamId;
  const opponent = teams.find(
    (t) => t.id === (imHome ? awayIdOf(myFixture) : homeIdOf(myFixture)),
  );
  const { myScore, opScore } = splitScore(myFixture.result, myTeamId);
  return {
    entry,
    status,
    type: "league",
    opponent,
    imHome,
    stadiumTeam: imHome ? myTeam : opponent,
    venueLabel: imHome ? "Casa" : "Fora",
    myScore,
    opScore,
    won: myFixture.result
      ? myScore > opScore
      : null,
    drew: myFixture.result ? myScore === opScore : null,
  };
};

// ── Peças de UI (fora do render) ─────────────────────────────────────────

// Crachá da equipa — crest com fallback para a inicial.
const TeamCircle = memo(function TeamCircle({ team, size = "lg" }) {
  const sz =
    size === "lg" ? "w-10 h-10 text-base" : "w-7 h-7 text-xs";
  if (team?.crest) {
    return (
      <>
        <img
          src={team.crest}
          alt={team?.name || "crest"}
          onError={(e) => { e.currentTarget.style.display = "none"; const fb = e.currentTarget.nextElementSibling; if (fb) fb.style.display = "flex"; }}
          className={`${sz} rounded-full object-contain bg-white p-1 shrink-0 border border-white/10`}
          loading="lazy"
        />
        <div
          className={`${sz} rounded-full hidden items-center justify-center font-black shrink-0 border border-white/10`}
          style={{ background: team?.color_primary || "#333", color: team?.color_secondary || "#fff" }}
        >
          {team?.name?.[0] ?? "?"}
        </div>
      </>
    );
  }
  return (
    <div
      className={`${sz} rounded-full flex items-center justify-center font-black shrink-0 border border-white/10`}
      style={{
        background: team?.color_primary || "#333",
        color: team?.color_secondary || "#fff",
      }}
    >
      {team?.name?.[0] ?? "?"}
    </div>
  );
});

// Coluna direita do cartão: resultado / próximo jogo / agendado.
function ScoreBlock({
  status,
  type,
  myScore,
  opScore,
  imHome,
  won,
  drew,
  hasPen,
  myPen,
  opPen,
}) {
  if (status === "done" && myScore !== null) {
    const key = won ? "won" : drew ? "drew" : "lost";
    return (
      <div className="flex flex-col items-end gap-1 short:gap-0.5">
        <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/60">
          Resultado
        </span>
        <span
          className={`text-xl short:text-sm font-headline font-black leading-none tabular-nums ${OUTCOME_TEXT[key]}`}
        >
          {imHome ? myScore : opScore} – {imHome ? opScore : myScore}
        </span>
        {hasPen && (
          <span className="text-[9px] text-amber-400 font-bold tabular-nums">
            {imHome ? myPen : opPen}–{imHome ? opPen : myPen} gp
          </span>
        )}
        <Badge variant={OUTCOME_BADGE[key]}>
          {won ? "Vitória" : drew ? "Empate" : "Derrota"}
          {type === "cup" && !won && !drew ? " · Eliminado" : ""}
        </Badge>
      </div>
    );
  }
  if (status === "current") {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/60">
          Próximo Jogo
        </span>
        <span className="text-xl short:text-sm font-headline font-black text-on-surface-variant/60 tabular-nums">
          vs
        </span>
        <Badge
          variant="info"
          className="animate-pulse"
        >
          Ativo
        </Badge>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <Badge variant="neutral">Agendado</Badge>
    </div>
  );
}

/**
 * @param {{
 *   calendarData: object|null,
 *   me: { teamId: number }|null,
 *   teams: object[],
 *   seasonYear: number,
 *   calFilter: string,
 *   setCalFilter: (f: string) => void,
 *   handleOpenTeamSquad: (team: object) => void,
 * }} props
 */
export function CalendarioTab({ calendarData, me, teams, seasonYear, calFilter, setCalFilter, handleOpenTeamSquad }) {
  const cal = calendarData;
  const curIdx = cal?.calendarIndex ?? 0;
  const calYear = cal?.year ?? seasonYear;
  const myTeamId = me?.teamId;
  const myTeam = useMemo(
    () => teams.find((t) => t.id === myTeamId),
    [teams, myTeamId],
  );
  const myDivision = myTeam?.division;
  const myDivTeams = useMemo(
    () =>
      teams
        .filter((t) => t.division === myDivision)
        .sort((a, b) => a.id - b.id),
    [teams, myDivision],
  );

  const getStatus = (entry) => {
    if (entry.calendarIndex < curIdx) return "done";
    if (entry.calendarIndex === curIdx) return "current";
    return "future";
  };

  // Ronda da Taça em que a minha equipa foi eliminada (null = ainda em prova).
  const eliminatedCupRound = useMemo(() => {
    if (!cal?.cupMatches) return null;
    for (const e of SEASON_CALENDAR) {
      if (e.type !== "cup") continue;
      const myMatch = findMyFixture(
        cal.cupMatches.filter((m) => m.round === e.round),
        myTeamId,
      );
      if (myMatch?.played && myMatch.winner_team_id !== myTeamId) {
        return e.round;
      }
    }
    return null;
  }, [cal, myTeamId]);

  // Lista plana dos MEUS jogos na época, sempre por ordem cronológica.
  const calEntries = useMemo(() => {
    const ctx = {
      cal,
      teams,
      myTeam,
      myTeamId,
      myDivision,
      myDivTeams,
      eliminatedCupRound,
    };
    return SEASON_CALENDAR.filter((entry) => {
      if (calFilter === "league") return entry.type === "league";
      if (calFilter === "cup")
        return entry.type === "cup" || entry.type === "friendly";
      return true;
    })
      .map((entry) => {
        const status = getStatus(entry);
        if (entry.type === "friendly")
          return buildFriendlyItem(entry, status, ctx);
        if (entry.type === "cup") return buildCupItem(entry, status, ctx);
        return buildLeagueItem(entry, status, ctx);
      })
      .filter(Boolean)
      .sort((a, b) => a.entry.calendarIndex - b.entry.calendarIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cal,
    calFilter,
    curIdx,
    teams,
    myTeam,
    myTeamId,
    myDivision,
    myDivTeams,
    eliminatedCupRound,
  ]);

  const entriesLabel = `${calEntries.length} ${calEntries.length === 1 ? "jogo" : "jogos"}`;

  return (
    <div className="space-y-4 short:space-y-2">
      {/* ── PAGE HEADER ──────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 mb-1">
          Timeline do Treinador
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3 short:gap-2">
          <div>
            <h2 className="text-2xl short:text-lg font-headline font-black text-on-surface leading-tight">
              Calendário de Competições
            </h2>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Temporada {calYear}
              {myTeam ? ` · ${myTeam.name}` : ""}
            </p>
          </div>
          {/* Filter tabs */}
          <TabBar
            tabs={[
              { key: "all", label: "Todos" },
              { key: "league", label: "Liga" },
              { key: "cup", label: "Taça" },
            ]}
            active={calFilter}
            onChange={setCalFilter}
          />
        </div>
      </div>

      {/* ── MATCH TIMELINE ────────────────────────────────── */}
      <Panel
        title="Jogos"
        icon="calendar_month"
        meta={cal ? entriesLabel : `Temporada ${calYear}`}
      >
        {!cal ? (
          <EmptyState
            emoji="📅"
            title="A carregar calendário…"
          />
        ) : calEntries.length === 0 ? (
          <EmptyState
            emoji="📭"
            title="Sem jogos para mostrar."
            description="Os teus jogos da época aparecem aqui."
          />
        ) : (
          <div className="flex flex-col gap-1.5">
            {calEntries.map((item, idx) => {
              const {
                entry,
                status,
                type,
                eliminated,
                opponent,
                imHome,
                stadiumTeam,
                venueLabel,
                myScore,
                opScore,
                won,
                drew,
                hasPen,
                myPen,
                opPen,
              } = item;

              // ── Eliminado da Taça ──────────────────
              if (eliminated) {
                return (
                  <motion.div
                    key={entry.calendarIndex}
                    {...staggerItemProps(idx)}
                    className="flex items-stretch gap-0 rounded-md overflow-hidden opacity-40 bg-surface-container border-l-2 border-l-error"
                  >
                    <div className="w-16 sm:w-28 shrink-0 flex flex-col justify-center gap-1 px-2 sm:px-3 short:px-1.5 py-2.5 sm:py-3 short:py-1.5 border-r border-outline-variant/10">
                      <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded self-start bg-error/20 text-error">
                        Taça
                      </span>
                      <span className="text-[10px] font-black text-on-surface leading-tight">
                        {entry.roundName}
                      </span>
                    </div>
                    <div className="flex-1 flex items-center gap-3 px-4 short:px-2 py-2.5 sm:py-3 short:py-1.5 min-w-0">
                      <div className="shrink-0 w-8 h-8 short:w-6 short:h-6 rounded hidden sm:flex items-center justify-center border border-error/30 text-error bg-error/10">
                        <span className="material-symbols-outlined text-[18px]">
                          trophy
                        </span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-black text-error leading-tight">
                          Eliminado da Taça
                        </span>
                        <span className="text-[10px] text-on-surface-variant/40">
                          {entry.roundName}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center justify-end px-4 short:px-2 py-2.5 sm:py-3 short:py-1.5">
                      <Badge variant="error">Eliminado</Badge>
                    </div>
                  </motion.div>
                );
              }

              const isCurrent = status === "current";
              const isDone = status === "done";
              const key = won ? "won" : drew ? "drew" : "lost";

              // result outcome class
              const outcomeClass =
                !isDone || myScore === null
                  ? ""
                  : OUTCOME_ACCENT[key];

              const cardBase = `flex items-stretch gap-0 rounded-md overflow-hidden transition-opacity ${
                isDone
                  ? "bg-surface-container"
                  : isCurrent
                    ? "bg-surface-container border border-primary/40"
                    : "bg-surface-container opacity-60"
              } ${outcomeClass}`;

              // Left date column content
              const weekLabel =
                type === "league"
                  ? `Jornada ${entry.matchweek}`
                  : entry.roundName;

              return (
                <motion.div
                  key={entry.calendarIndex}
                  {...staggerItemProps(idx)}
                  className={cardBase}
                >
                  {/* Left: matchweek + competition type */}
                  <div className="w-16 sm:w-28 shrink-0 flex flex-col justify-center gap-1 px-2 sm:px-3 short:px-1.5 py-2.5 sm:py-3 short:py-1.5 border-r border-outline-variant/10">
                    <span
                      className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded self-start ${
                        type === "league"
                          ? "bg-primary/20 text-primary"
                          : "bg-amber-500/20 text-amber-400"
                      }`}
                    >
                      {type === "league"
                        ? "Liga"
                        : type === "friendly"
                          ? "Amigável"
                          : "Taça"}
                    </span>
                    <span className="text-[10px] font-black text-on-surface leading-tight">
                      {weekLabel}
                    </span>
                    {!(type === "cup" && !opponent) && (
                      <span className="hidden sm:inline-block self-start">
                        <Badge variant={VENUE_BADGE[venueLabel] || "neutral"}>
                          {venueLabel}
                        </Badge>
                      </span>
                    )}
                    {isCurrent && (
                      <span className="text-[9px] text-primary font-bold">
                        Hoje
                      </span>
                    )}
                  </div>

                  {/* Center: teams + stadium */}
                  <div className="flex-1 flex items-center gap-2 sm:gap-3 short:gap-1 px-2 sm:px-4 short:px-2 py-2.5 sm:py-3 short:py-1.5 min-w-0">
                    {/* Type icon — hidden on mobile */}
                    <div
                      className={`hidden sm:flex shrink-0 w-8 h-8 rounded items-center justify-center border ${
                        type === "league"
                          ? "border-primary/30 text-primary bg-primary/10"
                          : "border-amber-500/30 text-amber-400 bg-amber-500/10"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {TYPE_ICON[type]}
                      </span>
                    </div>
                    {/* Opponent logo */}
                    <TeamCircle team={opponent} />
                    {/* Opponent info */}
                    <div className="flex flex-col min-w-0">
                      <button
                        disabled={!opponent}
                        className={`text-sm short:text-xs font-black text-on-surface text-left truncate transition-colors ${opponent ? "hover:text-primary" : "cursor-default"}`}
                        onClick={() =>
                          opponent &&
                          handleOpenTeamSquad(opponent)
                        }
                      >
                        {opponent?.name ?? "TBD"}
                      </button>
                      <span className="hidden sm:block text-[10px] text-on-surface-variant/60 truncate">
                        {stadiumTeam?.stadium_name
                          ? `${stadiumTeam.stadium_name.toUpperCase()} (${venueLabel})`
                          : venueLabel}
                      </span>
                      {/* Mobile-only home/away indicator */}
                      {!(type === "cup" && !opponent) && (
                        <span
                          className={`sm:hidden text-[8px] font-black uppercase tracking-widest ${
                            venueLabel === "Neutro"
                              ? "text-amber-400"
                              : imHome
                                ? "text-emerald-400"
                                : "text-sky-400"
                          }`}
                        >
                          {venueLabel}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: score/status */}
                  <div className="shrink-0 flex items-center justify-end px-2 sm:px-4 short:px-2 py-2.5 sm:py-3 short:py-1.5">
                    <ScoreBlock
                      status={status}
                      type={type}
                      myScore={myScore}
                      opScore={opScore}
                      imHome={imHome}
                      won={won}
                      drew={drew}
                      hasPen={hasPen}
                      myPen={myPen}
                      opPen={opPen}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* ── END OF CALENDAR ────────── */}
    </div>
  );
}
