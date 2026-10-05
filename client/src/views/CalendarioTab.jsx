import { useMemo, memo, useState } from "react";
import { motion } from "framer-motion";
import { SEASON_CALENDAR, CUP_FINAL_STADIUM } from "../constants/index.js";
import { generateLeagueFixtures } from "../utils/fixtures.js";
import { TabBar } from "../components/shared/TabBar.jsx";
import { Badge } from "../components/shared/Badge.jsx";
import { EmptyState } from "../components/shared/EmptyState.jsx";
import { Panel } from "../components/shared/Panel.jsx";
import { FormDots } from "../components/shared/FormDots.jsx";
import { formatCurrency } from "../utils/formatters.js";
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

// MOM da minha equipa + a minha parte da bilheteira (casa = total − 15% visitante).
const myMomOf = (match, myTeamId) => {
  if (!match) return null;
  const imHome = homeIdOf(match) === myTeamId;
  return imHome ? match.home_mom : match.away_mom;
};
const myTicketRevenueOf = (match, myTeamId) => {
  const total = match?.ticket_revenue ?? 0;
  if (!total) return null;
  if (homeIdOf(match) !== myTeamId) return null; // só em casa
  const away = Math.floor(total * 0.15);
  return total - away;
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
    myMom: myMomOf(myMatch, myTeamId),
    myTicketRevenue: myTicketRevenueOf(myMatch, myTeamId),
  };
};

const buildCupItem = (entry, status, ctx) => {
  const { cal, teams, myTeam, myTeamId, eliminatedCupRound } = ctx;
  // Rondas após a eliminação (ou Div. 5, que não joga a Taça) → placeholder.
  const notInCup = myTeam?.division === 5;
  if (notInCup || (eliminatedCupRound !== null && entry.round > eliminatedCupRound)) {
    return { entry, status, type: "cup", eliminated: true, notInCup };
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
    myMom: myMomOf(playedMatch, myTeamId),
    myTicketRevenue: myTicketRevenueOf(playedMatch, myTeamId),
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
    myMom: myMomOf(myFixture.result, myTeamId),
    myTicketRevenue: myTicketRevenueOf(myFixture.result, myTeamId),
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
        <span
          className={`${sz} rounded-full shrink-0 border border-white/10 shadow-md`}
          style={{ backgroundColor: team?.color_primary || "#333" }}
        >
          <img
            src={team.crest}
            alt={team?.name || "crest"}
            onError={(e) => { e.currentTarget.parentElement.style.display = "none"; const fb = e.currentTarget.parentElement.nextElementSibling; if (fb) fb.style.display = "flex"; }}
            className="crest-shadow w-full h-full object-contain p-1"
            loading="lazy"
          />
        </span>
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
  myMom,
  myTicketRevenue,
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
        {myMom && (
          <span className="text-[9px] text-on-surface-variant/70 max-w-[130px] truncate">
            MOM: {myMom}
          </span>
        )}
        {myTicketRevenue != null && (
          <span className="text-[9px] text-emerald-400 font-bold tabular-nums">
            Bilheteira: {formatCurrency(myTicketRevenue)}
          </span>
        )}
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

// Hero do próximo jogo — topo da lista. Adversário + forma + estádio + atalho p/ tática.
function NextMatchHero({ item, teamForms, onOpenTeamSquad, onGoToTactics }) {
  const { opponent, entry, type, stadiumTeam, venueLabel } = item;
  if (!opponent) return null; // adversário ainda não sorteado
  const form = teamForms?.[opponent.id] || "";
  return (
    <div className="rounded-md border border-primary/40 bg-primary/5 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <TeamCircle team={opponent} />
        <div className="flex flex-col min-w-0">
          <span className="text-[9px] font-black uppercase tracking-widest text-primary">
            Próximo Jogo · {type === "league" ? `Jornada ${entry.matchweek}` : entry.roundName}
          </span>
          <button
            className="text-base short:text-sm font-black text-on-surface text-left truncate hover:text-primary"
            onClick={() => onOpenTeamSquad(opponent)}
          >
            {opponent.name}
          </button>
          <div className="flex items-center gap-2 mt-0.5">
            <FormDots form={form} size="sm" />
            <span className="text-[10px] text-on-surface-variant/70 truncate">
              {stadiumTeam?.stadium_name ? stadiumTeam.stadium_name.toUpperCase() : venueLabel}
            </span>
          </div>
        </div>
      </div>
      <button
        onClick={onGoToTactics}
        className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary text-on-primary px-3 py-2 text-xs font-black uppercase tracking-wide hover:opacity-90 transition-opacity"
      >
        <span className="material-symbols-outlined text-[16px]">sports_esports</span>
        Preparar tática
      </button>
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
 *   teamForms: object,
 *   navigateTab: (key: string) => void,
 * }} props
 */
/**
 * Amigável da semana da Taça para quem está fora dela: o jogo (ronda -r em
 * cupMatches), a inscrição pendente ou o botão para marcar na véspera.
 * @param {Object} props
 * @param {{round: number}} props.entry
 * @param {Object} props.cal
 * @param {Array<{id: number, name: string}>} props.teams
 * @param {number} props.myTeamId
 * @param {{cupRound: number, signedUp: boolean}|null} props.cupWeekFriendly
 * @param {(done: (res: {ok: boolean, error?: string}) => void) => void} props.onSignup
 * @returns {JSX.Element|null}
 */
function CupWeekFriendlyRow({ entry, cal, teams, myTeamId, cupWeekFriendly, onSignup }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const match = findMyFixture(
    cal?.cupMatches?.filter((m) => m.round === -entry.round) ?? [],
    myTeamId,
  );
  const opponent = match?.away_team_id ? opponentOf(teams, match, myTeamId) : null;
  const canSignup = !match && cupWeekFriendly?.cupRound === entry.round && !cupWeekFriendly.signedUp;
  let text = null;
  if (opponent) {
    const { myScore, opScore } = splitScore(match.played ? match : null, myTeamId);
    text = match.played
      ? `Amigável vs ${opponent.name} · ${myScore}–${opScore}`
      : `Amigável vs ${opponent.name} (${homeIdOf(match) === myTeamId ? "Casa" : "Fora"})`;
  } else if (match || (cupWeekFriendly?.cupRound === entry.round && cupWeekFriendly.signedUp)) {
    text = "Amigável marcado — adversário definido no fecho da jornada";
  } else if (!canSignup) {
    return null;
  }
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-surface-container border-l-2 border-l-primary">
      <span className="flex items-center gap-2 text-xs font-bold text-on-surface min-w-0">
        <span className="material-symbols-outlined text-[16px] text-primary">handshake</span>
        <span className="truncate">{text ?? error ?? "Sem jogo nesta semana — queres marcar um amigável?"}</span>
      </span>
      {canSignup && (
        <button
          disabled={busy}
          className="shrink-0 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded bg-primary text-on-primary disabled:opacity-50"
          onClick={() => {
            setBusy(true);
            onSignup((res) => {
              setBusy(false);
              if (!res?.ok) setError(res?.error ?? "Não foi possível marcar.");
            });
          }}
        >
          Marcar amigável
        </button>
      )}
    </div>
  );
}

export function CalendarioTab({ calendarData, me, teams, seasonYear, calFilter, setCalFilter, handleOpenTeamSquad, teamForms, navigateTab, cupWeekFriendly, onSignupCupFriendly }) {
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

  // Próximo jogo para o hero: o actual, senão o primeiro futuro com adversário.
  const nextItem =
    calEntries.find((e) => e.status === "current" && !e.eliminated && e.opponent) ??
    calEntries.find((e) => e.status === "future" && !e.eliminated && e.opponent) ??
    null;

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
            {nextItem && (
              <NextMatchHero
                item={nextItem}
                teamForms={teamForms}
                onOpenTeamSquad={handleOpenTeamSquad}
                onGoToTactics={() => navigateTab("tactic")}
              />
            )}
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
                  <div key={entry.calendarIndex} className="flex flex-col gap-1">
                  <motion.div
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
                          {item.notInCup ? "Fora da Taça" : "Eliminado da Taça"}
                        </span>
                        <span className="text-[10px] text-on-surface-variant/40">
                          {entry.roundName}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center justify-end px-4 short:px-2 py-2.5 sm:py-3 short:py-1.5">
                      <Badge variant="error">{item.notInCup ? "Fora" : "Eliminado"}</Badge>
                    </div>
                  </motion.div>
                  {entry.round !== CUP_FINAL_ROUND && (
                    <CupWeekFriendlyRow
                      entry={entry}
                      cal={cal}
                      teams={teams}
                      myTeamId={myTeamId}
                      cupWeekFriendly={cupWeekFriendly}
                      onSignup={onSignupCupFriendly}
                    />
                  )}
                  </div>
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
