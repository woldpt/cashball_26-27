import { useEffect, useMemo, useState } from "react";
import {
  DIVISION_NAMES,
  POSITION_TEXT_CLASS,
  SEASON_CALENDAR,
} from "../constants/index.js";
import { generateLeagueFixtures } from "../utils/fixtures.js";
import { formatCurrency } from "../utils/formatters.js";
import { isSameTeamId } from "../utils/teamHelpers.js";
import { weatherForFixture } from "../utils/weather.js";
import { useGame } from "../contexts/GameContext.jsx";
import { rankStandings } from "../utils/standingsRank.js";
import { PlayerRow } from "../components/shared/PlayerRow.jsx";
import { PlayerAvatar } from "../components/shared/PlayerAvatar.jsx";
import { SummaryWidget } from "../components/shared/SummaryWidget.jsx";
import { StatTile } from "../components/shared/StatTile.jsx";
import { TabBar } from "../components/shared/TabBar.jsx";
import { Badge } from "../components/shared/Badge.jsx";
import { CoachAvatar } from "../components/shared/CoachAvatar.jsx";
import { TeamCrest } from "../components/shared/TeamCrest.jsx";
import { TeamKit } from "../components/shared/TeamKit.jsx";
import { StadiumIllustration } from "../components/shared/StadiumIllustration.jsx";
import { Panel } from "../components/shared/Panel.jsx";
import { EmptyState } from "../components/shared/EmptyState.jsx";
import { FormDots } from "../components/shared/FormDots.jsx";
import { TeamHistoryView } from "./TeamHistoryView.jsx";

const POS_ORDER = ["GR", "DEF", "MED", "ATA"];
const POS_GROUP_LABEL = {
  GR: "Guarda-redes",
  DEF: "Defesas",
  MED: "Médios",
  ATA: "Avançados",
};

const GAME_LABEL = { league: "Liga", cup: "Taça", friendly: "Amigável" };
const GAME_VARIANT = { league: "info", cup: "warning", friendly: "cooldown" };

const RESULT_META = {
  V: { letter: "V", title: "Vitória", bar: "bg-emerald-400", text: "text-emerald-400" },
  E: { letter: "E", title: "Empate", bar: "bg-amber-400", text: "text-amber-400" },
  D: { letter: "D", title: "Derrota", bar: "bg-red-400", text: "text-red-400" },
};

/**
 * Uma linha de jogo do clube (últimos jogos, próximo jogo e calendário).
 * Marcador sempre na perspetiva do clube — o badge de resultado decide.
 *
 * @param {{ match: object, onOpenTeam?: (team: object) => void }} props
 */
function MatchLine({ match, onOpenTeam }) {
  const meta = match.result ? RESULT_META[match.result] : null;
  const opponent = match.opponent;
  const when = match.roundName
    ? match.roundName
    : `Jornada ${match.matchweek ?? "—"}`;
  const clickable = !!opponent?.id && typeof onOpenTeam === "function";

  const content = (
    <>
      <span
        aria-hidden
        className={`w-1 self-stretch rounded-full ${meta ? meta.bar : "bg-outline-variant/40"}`}
      />
      {meta ? (
        <span
          title={meta.title}
          className={`w-4 shrink-0 text-center text-[10px] font-black ${meta.text}`}
        >
          {meta.letter}
        </span>
      ) : (
        <span
          aria-hidden
          className="w-4 shrink-0 text-center text-[10px] font-black text-on-surface-variant/40"
        >
          ·
        </span>
      )}
      <TeamCrest team={opponent || { name: "?" }} size="w-7 h-7 text-[10px]" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-black text-on-surface">
          {opponent?.name ?? "Adversário por definir"}
        </p>
        <div className="flex items-center gap-1.5 text-[9px] font-bold text-on-surface-variant/70">
          <span className="shrink-0">{match.imHome ? "Casa" : "Fora"}</span>
          <span className="text-on-surface-variant/40">·</span>
          <span className="truncate">{when}</span>
          <Badge
            variant={GAME_VARIANT[match.kind] || "neutral"}
            className="ml-auto shrink-0"
          >
            {GAME_LABEL[match.kind] || match.kind}
          </Badge>
        </div>
      </div>
      <div className="shrink-0 text-right">
        {match.result ? (
          <>
            <p className="font-headline text-sm font-black tabular-nums text-on-surface">
              {match.myScore}–{match.opScore}
            </p>
            {match.hasPen && (
              <p className="text-[8px] font-bold tabular-nums text-on-surface-variant/60">
                {match.myPen}–{match.opPen} g.p.
              </p>
            )}
          </>
        ) : match.isCurrent ? (
          <Badge variant="info">Hoje</Badge>
        ) : (
          <Badge variant="neutral">VS</Badge>
        )}
      </div>
      {clickable && (
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

  if (!clickable) return <div className={className}>{content}</div>;
  return (
    <button
      type="button"
      onClick={() => onOpenTeam(opponent)}
      title={`Abrir clube: ${opponent?.name ?? ""}`}
      className={`group ${className} hover:border-outline-variant/50 hover:bg-surface-container-high`}
    >
      {content}
    </button>
  );
}

/**
 * Destaque do plantel (top por skill) na tab Resumo.
 *
 * @param {{ player: object, onOpenPlayerHistory?: (player: object) => void }} props
 */
function HighlightRow({ player, onOpenPlayerHistory }) {
  const skillClass = POSITION_TEXT_CLASS[player.position] || "text-on-surface";
  return (
    <button
      type="button"
      onClick={() => onOpenPlayerHistory?.(player)}
      title="Abrir histórico do jogador"
      className="flex w-full items-center gap-3 rounded-md border border-outline-variant/25 bg-surface-container-low px-2.5 py-2 text-left transition-colors hover:border-outline-variant/50 hover:bg-surface-container-high"
    >
      <PlayerAvatar
        seed={player.id}
        position={player.position}
        nationality={player.nationality}
        photo={player.photo || null}
        size="mdR"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-black text-on-surface">
          {player.name}
        </p>
        <p className="truncate text-[9px] font-bold text-on-surface-variant/70">
          {POS_GROUP_LABEL[player.position] || player.position} · {player.age} anos
          {player.goals ? ` · ${player.goals} golos` : ""}
        </p>
      </div>
      <span
        className={`shrink-0 font-headline text-lg font-black tabular-nums ${skillClass}`}
        style={{ textShadow: "0 0 10px currentColor" }}
      >
        {player.skill}
      </span>
    </button>
  );
}

/**
 * @param {{
 *   selectedTeam: object|null,
 *   selectedTeamSquad: Array,
 *   selectedTeamLoading: boolean,
 *   me: object|null,
 *   avatarSeed: string,
 *   coachAvatars: object, {nome do coach: versão da imagem carregada}
 *   coachAvatarSeeds: object, {nome do coach: seed procedural partilhado}
 *   backendUrl: string,
 *   players: Array,
 *   clubHistory: object|null,
 *   clubHistoryTeamId: number|null,
 *   setTransferProposalModal: function,
 *   myBudget: number,
 *   currentMatchweek: number,
 *   calendarData,
 *   teams,
 *   teamForms?: Object, {teamId: "VVEDE"} forma dos últimos 5 jogos
 *   onBack: function,
 *   onOpenTeamSquad: function,
 *   onOpenPlayerHistory?: (player: object) => void,
 *   onRequestCalendar?: () => void,
 * }} props
 */
export function OtherSquadsTab({
  selectedTeam,
  selectedTeamSquad,
  selectedTeamLoading,
  me,
  avatarSeed = "",
  coachAvatars = {},
  coachAvatarSeeds = {},
  backendUrl = "",
  players,
  clubHistory,
  clubHistoryTeamId,
  setTransferProposalModal,
  myBudget = 0,
  currentMatchweek = 1,
  calendarData,
  teams,
  teamForms = {},
  onBack,
  onOpenTeamSquad,
  onOpenPlayerHistory,
  onRequestCalendar,
}) {
  const [activeTab, setActiveTab] = useState("summary");

  // O calendário global só é refrescado ao visitar o Calendário — sem isto,
  // a tab local mostrava estados de uma semana anterior.
  // O céu do estádio também precisa dele (meteo da jornada): pede-o quando
  // falta ou está numa jornada anterior.
  const { calendarIndex } = useGame();
  const calendarStale = !calendarData || calendarData.calendarIndex !== calendarIndex;
  useEffect(() => {
    if (activeTab === "calendar" || calendarStale) onRequestCalendar?.();
  }, [activeTab, selectedTeam?.id, onRequestCalendar, calendarStale]);

  const isOwnTeam = isSameTeamId(selectedTeam?.id, me?.teamId);
  const isNpcTeam =
    !isOwnTeam &&
    !players.some((p) => isSameTeamId(p.teamId, selectedTeam?.id));
  const showProposalCol = isNpcTeam;

  const isHumanCoached =
    selectedTeam?.coach_is_human === 1 ||
    players.some((p) => isSameTeamId(p.teamId, selectedTeam?.id));
  const coachName = isOwnTeam
    ? me?.name || "—"
    : selectedTeam?.coach_name || "—";
  // Seed partilhado (mesma cara para todos); fallback à convenção antiga.
  const sharedCoachSeed =
    !isOwnTeam && selectedTeam?.coach_name
      ? coachAvatarSeeds?.[selectedTeam.coach_name]
      : null;
  const coachAvatarSeed = sharedCoachSeed
    ? `${selectedTeam.coach_name}|${sharedCoachSeed}`
    : isOwnTeam
      ? `${me?.name ?? "?"}|${avatarSeed}`
      : `coach|${selectedTeam?.coach_name ?? selectedTeam?.id ?? "?"}`;

  const selectedTeamDivision = selectedTeam?.division;
  const seasonYear = calendarData?.year ?? new Date().getFullYear();

  // Linha fresca da classificação (o objeto clicado pode vir do briefing,
  // sem pontos/forma atualizados).
  const teamRow = useMemo(
    () => (teams || []).find((t) => isSameTeamId(t.id, selectedTeam?.id)) || selectedTeam,
    [teams, selectedTeam],
  );
  const teamsById = useMemo(
    () => new Map((teams || []).map((t) => [t.id, t])),
    [teams],
  );

  const divisionTeams = useMemo(
    () => (teams || []).filter((t) => t.division === selectedTeamDivision),
    [teams, selectedTeamDivision],
  );

  const position = useMemo(() => {
    const idx = rankStandings(divisionTeams).findIndex((t) =>
      isSameTeamId(t.id, selectedTeam?.id),
    );
    return idx >= 0 ? idx + 1 : null;
  }, [divisionTeams, selectedTeam]);

  // Calendário da época do clube: liga (jogada ou gerada) + taça/amigáveis.
  const { fixtures, lastFive, nextMatch } = useMemo(() => {
    const curIdx = calendarData?.calendarIndex ?? 0;
    const divTeams = [...divisionTeams].sort((a, b) => a.id - b.id);
    const seeds =
      calendarData?.fixtureSeeds?.[selectedTeamDivision] ??
      divTeams.map((t) => t.id);
    const playedLeague = calendarData?.leagueMatches ?? [];
    const cupMatches = calendarData?.cupMatches ?? [];
    const myId = selectedTeam?.id;

    const normalize = (homeTeamId, awayTeamId, slot, kind, extra) => {
      const imHome = isSameTeamId(homeTeamId, myId);
      const opponentId = imHome ? awayTeamId : homeTeamId;
      const opponent = teamsById.get(opponentId) || null;
      const result = extra.result ?? null;
      return {
        slot,
        kind,
        imHome,
        opponentId,
        opponent,
        matchweek: extra.matchweek ?? null,
        roundName: extra.roundName ?? null,
        myScore: result ? (imHome ? result.home_score : result.away_score) : null,
        opScore: result ? (imHome ? result.away_score : result.home_score) : null,
        myPen: result ? (imHome ? result.home_penalties : result.away_penalties) : 0,
        opPen: result ? (imHome ? result.away_penalties : result.home_penalties) : 0,
        hasPen:
          !!result &&
          ((result.home_penalties || 0) > 0 || (result.away_penalties || 0) > 0),
        winnerTeamId: result?.winner_team_id ?? null,
      };
    };

    const list = [];
    for (const entry of SEASON_CALENDAR) {
      if (entry.type === "league") {
        const status =
          entry.calendarIndex < curIdx
            ? "done"
            : entry.calendarIndex === curIdx
              ? "current"
              : "future";
        const fixturesForWeek =
          status === "done"
            ? playedLeague
                .filter(
                  (m) =>
                    m.matchweek === entry.matchweek &&
                    divTeams.some((t) => t.id === m.home_team_id) &&
                    divTeams.some((t) => t.id === m.away_team_id),
                )
                .map((m) => ({
                  homeTeamId: m.home_team_id,
                  awayTeamId: m.away_team_id,
                  result: m,
                }))
            : generateLeagueFixtures(seeds, entry.matchweek).map((f) => ({
                ...f,
                result: null,
              }));
        const mine = fixturesForWeek.find(
          (f) =>
            isSameTeamId(f.homeTeamId, myId) || isSameTeamId(f.awayTeamId, myId),
        );
        if (!mine) continue;
        list.push(
          normalize(mine.homeTeamId, mine.awayTeamId, entry.calendarIndex, "league", {
            matchweek: entry.matchweek,
            result: mine.result,
          }),
        );
        continue;
      }
      // Taça e amigável: existem em cup_matches a partir do sorteio.
      const cup = cupMatches.find(
        (m) =>
          Number(m.round) === entry.round &&
          (isSameTeamId(m.home_team_id, myId) || isSameTeamId(m.away_team_id, myId)),
      );
      if (!cup) continue;
      list.push(
        normalize(
          cup.home_team_id,
          cup.away_team_id,
          entry.calendarIndex,
          entry.type === "friendly" ? "friendly" : "cup",
          {
            roundName: entry.roundName,
            result: cup.played ? cup : null,
          },
        ),
      );
    }

    list.sort((a, b) => a.slot - b.slot);
    // Resultado: na taça quem decide é o winner_team_id (empate com vitória
    // nos penáltis é V, não E).
    for (const m of list) {
      m.isCurrent = m.slot === curIdx && m.myScore == null;
      if (m.myScore == null) {
        m.result = null;
        continue;
      }
      const decided = m.kind === "cup" && m.winnerTeamId != null;
      const won = decided
        ? isSameTeamId(m.winnerTeamId, myId)
        : m.myScore > m.opScore;
      const drew = decided ? false : m.myScore === m.opScore;
      m.result = won ? "V" : drew ? "E" : "D";
    }

    const played = list.filter((m) => m.result);
    return {
      fixtures: list,
      lastFive: played.slice(-5).reverse(),
      nextMatch: list.find((m) => !m.result) || null,
    };
  }, [calendarData, divisionTeams, selectedTeamDivision, selectedTeam, teamsById]);

  // Plantel: totais + destaques (só quando o requestTeamSquad respondeu).
  const squadLoaded = !selectedTeamLoading && selectedTeamSquad.length > 0;
  const squadStats = useMemo(() => {
    if (!squadLoaded) return null;
    let skill = 0;
    let value = 0;
    let wage = 0;
    for (const p of selectedTeamSquad) {
      skill += p.skill || 0;
      value += p.value || 0;
      wage += p.wage || 0;
    }
    return {
      count: selectedTeamSquad.length,
      avgSkill: Math.round(skill / selectedTeamSquad.length),
      value,
      wage,
    };
  }, [selectedTeamSquad, squadLoaded]);

  const highlights = useMemo(
    () =>
      squadLoaded
        ? [...selectedTeamSquad].sort((a, b) => (b.skill || 0) - (a.skill || 0)).slice(0, 3)
        : [],
    [selectedTeamSquad, squadLoaded],
  );

  // Meteo da jornada (mesma previsão determinística do servidor): só se o
  // jogo desta jornada for em casa da equipa selecionada.
  const homeWeather =
    !calendarStale && nextMatch?.isCurrent && nextMatch.imHome
      ? weatherForFixture(calendarData.season, calendarData.matchweek, selectedTeam.id, nextMatch.opponentId)
      : null;

  const trophies = clubHistoryTeamId === selectedTeam?.id ? clubHistory?.trophies ?? [] : [];
  const lastTrophySeason = trophies.reduce(
    (max, t) => Math.max(max, t.season ?? 0),
    0,
  );
  const brand = teamRow?.sponsorBrand;

  return (
    <div className="min-h-0 flex-1 w-full overflow-y-auto overscroll-contain bg-surface text-on-surface">
      {/* ── CABEÇALHO (um só, responsivo) ─────────────────────── */}
      <div
        className="relative overflow-hidden border-b border-black/30"
        style={{ background: selectedTeam?.color_primary || "#18181b" }}
      >
        {/* Estádio do clube, desvanecido sobre a cor (desktop) */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-[55%] sm:block"
          style={{
            maskImage: "linear-gradient(to left, black 45%, transparent 95%)",
            WebkitMaskImage: "linear-gradient(to left, black 45%, transparent 95%)",
          }}
        >
          <StadiumIllustration
            seed={selectedTeam?.id}
            weather={homeWeather}
            capacity={selectedTeam?.stadium_capacity || 10000}
            primary={selectedTeam?.color_primary}
            secondary={selectedTeam?.color_secondary}
            mood={selectedTeam?.fans_mood ?? null}
            className="h-full w-full"
          />
        </div>
        {/* Hairline nas cores do clube */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 z-10 h-0.5"
          style={{
            background: `linear-gradient(90deg, ${selectedTeam?.color_primary || "#2d6a4f"}, ${
              selectedTeam?.color_secondary || "#e9c349"
            })`,
          }}
        />

        <div className="relative z-10 px-4 pb-3 pt-2.5 sm:px-6 sm:pb-5 sm:pt-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/80 transition-colors hover:text-white"
          >
            <span className="material-symbols-outlined text-[18px]">
              arrow_back
            </span>
            Voltar
          </button>

          <div className="mt-1.5 flex items-center gap-3 sm:mt-3 sm:gap-5">
            <TeamCrest
              team={teamRow}
              size="w-11 h-11 sm:w-20 sm:h-20 text-lg sm:text-4xl"
              className="shadow-lg"
            />
            <div className="min-w-0 flex-1">
              <p
                className="text-[10px] font-black uppercase tracking-widest sm:text-xs"
                style={{ color: selectedTeam?.color_secondary || "#fff" }}
              >
                {DIVISION_NAMES[selectedTeamDivision] ||
                  `Divisão ${selectedTeamDivision}`}
              </p>
              <h1
                className="truncate font-headline text-lg font-black leading-tight tracking-tighter sm:text-3xl md:text-4xl"
                style={{ color: selectedTeam?.color_secondary || "#ffffff" }}
              >
                {selectedTeam?.name}
              </h1>
            </div>

            {/* Treinador — avatar em mobile, pastilha completa em sm+ */}
            <div className="shrink-0 rounded-lg border border-white/10 bg-black/45 px-2 py-1.5 backdrop-blur-sm sm:px-3 sm:py-2">
              <p className="mb-1 hidden items-center justify-end gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/70 sm:flex">
                Treinador
                {!isOwnTeam && isHumanCoached && (
                  <Badge variant="warning" size="sm">
                    Humano
                  </Badge>
                )}
              </p>
              <div className="flex items-center gap-2">
                <p
                  className={`hidden max-w-[12rem] truncate font-headline text-lg font-black tracking-tight sm:block ${
                    !isOwnTeam && isHumanCoached ? "text-amber-300" : "text-white"
                  }`}
                >
                  {coachName}
                </p>
                <CoachAvatar
                  name={coachName}
                  seed={coachAvatarSeed}
                  teamColor={selectedTeam?.color_primary}
                  size="md"
                  coachAvatars={coachAvatars}
                  backendUrl={backendUrl}
                  photo={selectedTeam?.coach_photo || null}
                />
              </div>
            </div>
          </div>

          {/* Linha de contexto: posição · pontos · forma (· saldo, equipa própria) */}
          <div
            className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] font-black uppercase tracking-widest sm:mt-3"
            style={{ color: selectedTeam?.color_secondary || "#fff" }}
          >
            <span>Época {seasonYear}</span>
            {position != null && (
              <>
                <span className="opacity-50">·</span>
                <span>{position}º lugar</span>
              </>
            )}
            {teamRow?.points != null && (
              <>
                <span className="opacity-50">·</span>
                <span>{teamRow.points} pts</span>
              </>
            )}
            {(teamForms?.[selectedTeam?.id] || "").length > 0 && (
              <>
                <span className="opacity-50">·</span>
                <FormDots form={teamForms[selectedTeam.id]} size="sm" />
              </>
            )}
            {isOwnTeam && (
              <>
                <span className="opacity-50">·</span>
                <span className={myBudget >= 0 ? "" : "text-red-200"}>
                  Saldo {formatCurrency(myBudget)}
                </span>
              </>
            )}
          </div>

          <div className="mt-3 sm:mt-5">
            <TabBar
              size="sm"
              expand
              className="sm:hidden"
              tabs={[
                { key: "summary", label: "Resumo" },
                { key: "squad", label: "Plantel" },
                { key: "calendar", label: "Jogos" },
                { key: "history", label: "História" },
              ]}
              active={activeTab}
              onChange={setActiveTab}
            />
            <TabBar
              size="md"
              className="hidden sm:flex"
              tabs={[
                { key: "summary", label: "Resumo" },
                { key: "squad", label: "Plantel" },
                { key: "calendar", label: "Jogos" },
                { key: "history", label: "História" },
              ]}
              active={activeTab}
              onChange={setActiveTab}
            />
          </div>
        </div>
      </div>

      {/* Conteúdo — rola junto com o cabeçalho (um só scroll) */}
      <div>
        {activeTab === "history" ? (
          <TeamHistoryView
            selectedTeam={selectedTeam}
            clubHistory={clubHistory}
            clubHistoryTeamId={clubHistoryTeamId}
            teams={teams}
            onOpenTeamSquad={onOpenTeamSquad}
            onOpenPlayerHistory={onOpenPlayerHistory}
          />
        ) : activeTab === "calendar" ? (
          <div className="space-y-3 p-3 sm:p-6">
            {fixtures.length === 0 ? (
              <EmptyState
                icon="calendar_month"
                title="Sem jogos para mostrar"
                description="O calendário desta equipa ainda não está sorteado."
              />
            ) : (
              <Panel
                title="Calendário da época"
                icon="calendar_month"
                meta={`${fixtures.length} jogos · Época ${seasonYear}`}
              >
                <div className="flex flex-col gap-1.5">
                  {fixtures.map((match) => (
                    <MatchLine
                      key={`${match.kind}-${match.slot}-${match.opponentId}`}
                      match={match}
                      onOpenTeam={onOpenTeamSquad}
                    />
                  ))}
                </div>
              </Panel>
            )}
          </div>
        ) : activeTab === "summary" ? (
          /* ── RESUMO ─────────────────────────────────────────── */
          <div className="space-y-4 p-3 sm:p-6">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4">
              <SummaryWidget
                compactMobile
                label="Posição"
                value={position != null ? `${position}º` : "—"}
                sub={
                  DIVISION_NAMES[selectedTeamDivision] ||
                  `Divisão ${selectedTeamDivision}`
                }
                valueClass="text-lg sm:text-2xl"
                accentClass="border-primary"
                valueColorClass="text-primary"
              />
              <SummaryWidget
                compactMobile
                label="Pontos"
                value={teamRow?.points ?? "—"}
                sub={
                  teamRow
                    ? `${teamRow.wins ?? 0}V ${teamRow.draws ?? 0}E ${teamRow.losses ?? 0}D`
                    : "—"
                }
                valueClass="text-lg sm:text-2xl"
                accentClass="border-tertiary"
              />
              <SummaryWidget
                compactMobile
                label="Plantel"
                value={squadStats ? squadStats.count : "—"}
                sub={squadStats ? formatCurrency(squadStats.value) : "—"}
                valueClass="text-lg sm:text-2xl"
              />
              <SummaryWidget
                compactMobile
                label="Troféus"
                value={trophies.length}
                sub={
                  lastTrophySeason > 0
                    ? `Último: ${lastTrophySeason}`
                    : "Sem títulos"
                }
                valueClass="text-lg sm:text-2xl"
                accentClass="border-amber-500"
                valueColorClass="text-amber-400"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
              <Panel
                title="Últimos jogos"
                icon="sports_soccer"
                meta={`${lastFive.length} ${lastFive.length === 1 ? "jogo" : "jogos"}`}
                className="min-w-0 lg:col-span-2"
              >
                {lastFive.length === 0 ? (
                  <EmptyState
                    icon="sports_soccer"
                    title="Ainda sem jogos esta época"
                    description="Os resultados aparecem aqui depois da primeira jornada."
                  />
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {lastFive.map((match) => (
                      <MatchLine
                        key={`${match.kind}-${match.slot}-${match.opponentId}`}
                        match={match}
                        onOpenTeam={onOpenTeamSquad}
                      />
                    ))}
                  </div>
                )}
              </Panel>

              <div className="flex min-w-0 flex-col gap-4">
                <Panel title="Próximo jogo" icon="flag">
                  {nextMatch ? (
                    <MatchLine
                      match={nextMatch}
                      onOpenTeam={onOpenTeamSquad}
                    />
                  ) : (
                    <p className="px-1 text-[11px] font-bold text-on-surface-variant/70">
                      Sem jogo agendado.
                    </p>
                  )}
                </Panel>

                <Panel
                  title="Destaques do plantel"
                  icon="star"
                  meta={squadStats ? `Skill médio ${squadStats.avgSkill}` : ""}
                >
                  {selectedTeamLoading ? (
                    <p className="px-1 text-[11px] font-bold text-on-surface-variant/70">
                      A carregar plantel...
                    </p>
                  ) : highlights.length === 0 ? (
                    <p className="px-1 text-[11px] font-bold text-on-surface-variant/70">
                      Sem jogadores encontrados.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {highlights.map((player) => (
                        <HighlightRow
                          key={player.id}
                          player={player}
                          onOpenPlayerHistory={onOpenPlayerHistory}
                        />
                      ))}
                    </div>
                  )}
                </Panel>
              </div>
            </div>

            <Panel title="Clube" icon="shield">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex shrink-0 justify-center sm:w-40">
                  <TeamKit
                    team={teamRow}
                    className="h-32 object-contain sm:h-36"
                  />
                </div>
                <dl className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <dt className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">
                      Cores
                    </dt>
                    <dd className="mt-1 flex items-center gap-2">
                      {[teamRow?.color_primary, teamRow?.color_secondary]
                        .filter(Boolean)
                        .map((color) => (
                          <span
                            key={color}
                            className="h-5 w-5 rounded-full border border-outline-variant/40"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">
                      Patrocinador
                    </dt>
                    <dd className="mt-1 truncate text-xs font-black text-on-surface">
                      {brand?.name || "—"}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">
                      Estádio
                    </dt>
                    <dd className="mt-1 truncate text-xs font-black text-on-surface">
                      {teamRow?.stadium_name || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">
                      Capacidade
                    </dt>
                    <dd className="mt-1 text-xs font-black tabular-nums text-on-surface">
                      {(teamRow?.stadium_capacity || 10000).toLocaleString("pt-PT")}{" "}
                      lugares
                    </dd>
                  </div>
                  {isOwnTeam && squadStats && (
                    <div className="min-w-0">
                      <dt className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">
                        Folha semanal
                      </dt>
                      <dd className="mt-1 truncate text-xs font-black tabular-nums text-on-surface">
                        {formatCurrency(squadStats.wage)}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </Panel>
          </div>
        ) : selectedTeamLoading ? (
          <div className="p-6 sm:p-8">
            <EmptyState icon="group" title="A carregar plantel..." />
          </div>
        ) : selectedTeamSquad.length === 0 ? (
          <div className="p-6 sm:p-8">
            <EmptyState
              icon="group"
              title="Sem jogadores encontrados"
              description="Este clube ainda não tem plantel registado."
            />
          </div>
        ) : (
          /* ── PLANTEL ─────────────────────────────────────────── */
          <div className="space-y-4 p-3 sm:p-6">
            <Panel
              title="Plantel"
              icon="group"
              meta={`${selectedTeamSquad.length} jogadores`}
            >
              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatTile label="Jogadores">
                  {selectedTeamSquad.length}
                </StatTile>
                <StatTile label="Skill médio">
                  {squadStats?.avgSkill ?? "—"}
                </StatTile>
                <StatTile label="Valor">
                  {formatCurrency(squadStats?.value ?? 0)}
                </StatTile>
                <StatTile label="Salários/semana">
                  {formatCurrency(squadStats?.wage ?? 0)}
                </StatTile>
              </div>

              <div className="flex flex-col gap-1.5">
                {POS_ORDER.map((pos) => {
                  const group = selectedTeamSquad.filter(
                    (p) => p.position === pos,
                  );
                  if (!group.length) return null;
                  const wage = group.reduce((sum, p) => sum + (p.wage || 0), 0);
                  return (
                    <section key={pos} aria-label={POS_GROUP_LABEL[pos]}>
                      <div className="flex items-center gap-2 px-1 py-2">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                          {POS_GROUP_LABEL[pos]}
                        </h3>
                        <span className="text-[9px] font-bold tabular-nums text-on-surface-variant/70">
                          {group.length} · {formatCurrency(wage)}/sem
                        </span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {group.map((player) => (
                          <PlayerRow
                            key={player.id}
                            player={player}
                            matchweekCount={currentMatchweek}
                            showProposalCol={showProposalCol}
                            myBudget={myBudget}
                            onOpenPlayerHistory={onOpenPlayerHistory}
                            onProposal={(data) => setTransferProposalModal(data)}
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}
