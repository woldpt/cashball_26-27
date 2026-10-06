import { useEffect, useMemo, useState } from "react";
import {
  DIVISION_NAMES,
  POSITION_BAR_CLASS,
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
import { SponsorLogo } from "../components/shared/SponsorLogo.jsx";
import { Button } from "../components/shared/Button.jsx";
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
  V: {
    letter: "V",
    title: "Vitória",
    bar: "bg-emerald-400",
    text: "text-emerald-400",
    pill: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  },
  E: {
    letter: "E",
    title: "Empate",
    bar: "bg-amber-400",
    text: "text-amber-400",
    pill: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  },
  D: {
    letter: "D",
    title: "Derrota",
    bar: "bg-red-400",
    text: "text-red-400",
    pill: "bg-red-500/15 text-red-300 ring-red-500/30",
  },
};

// Medalhas do top 3 dos destaques (ouro · prata · bronze)
const MEDAL_CLASS = [
  "bg-gradient-to-br from-amber-200 to-amber-500 text-amber-950 shadow-amber-500/40",
  "bg-gradient-to-br from-zinc-100 to-zinc-400 text-zinc-900 shadow-zinc-300/30",
  "bg-gradient-to-br from-orange-300 to-orange-700 text-orange-950 shadow-orange-600/30",
];

/**
 * Cabeçalho de grupo (posição no plantel, resultados/por jogar nos jogos).
 *
 * @param {Object} props
 * @param {string} props.title
 * @param {string} [props.meta]
 * @param {string} [props.barClass] gradiente da faixa (cor da posição)
 * @returns {JSX.Element}
 */
function GroupHeader({ title, meta, barClass }) {
  return (
    <div className="flex items-center gap-2 px-1 py-2">
      <span
        aria-hidden
        className={`h-3.5 w-1 rounded-full bg-gradient-to-b ${barClass || "from-outline-variant to-outline-variant/40"}`}
      />
      <h3 className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
        {title}
      </h3>
      {meta && (
        <span className="text-[9px] font-bold tabular-nums text-on-surface-variant/70">
          {meta}
        </span>
      )}
      <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-outline-variant/30 to-transparent" />
    </div>
  );
}

/**
 * Pastilha da linha de contexto do cabeçalho (sobre a cor do clube).
 *
 * @param {Object} props
 * @param {string} [props.className]
 * @param {import("react").ReactNode} props.children
 * @returns {JSX.Element}
 */
function HeaderChip({ className = "", children }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1 backdrop-blur-sm ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * Um lado do cartão "duelo" do próximo jogo.
 *
 * @param {Object} props
 * @param {object|null} props.team
 * @param {boolean} props.highlight equipa do perfil (aro)
 * @param {string} props.side "Casa" | "Fora"
 * @returns {JSX.Element}
 */
function DuelSide({ team, highlight, side }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center">
      <TeamCrest
        team={team || { name: "?" }}
        size="w-12 h-12 text-lg"
        className={highlight ? "ring-2 ring-primary/50 ring-offset-2 ring-offset-surface-container" : ""}
      />
      <p className="line-clamp-2 w-full break-words text-[11px] font-black leading-tight text-on-surface">
        {team?.name ?? "Por definir"}
      </p>
      <span className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant/60">
        {side}
      </span>
    </div>
  );
}

/**
 * Próximo jogo em formato "duelo": brasão vs brasão, competição e jornada.
 *
 * @param {Object} props
 * @param {object} props.match
 * @param {object|null} props.team equipa do perfil
 * @param {(team: object) => void} [props.onOpenTeam]
 * @returns {JSX.Element}
 */
function NextMatchCard({ match, team, onOpenTeam }) {
  const home = match.imHome ? team : match.opponent;
  const away = match.imHome ? match.opponent : team;
  const when = match.roundName || `Jornada ${match.matchweek ?? "—"}`;
  const clickable = !!match.opponent?.id && typeof onOpenTeam === "function";
  return (
    <div className="rounded-lg border border-outline-variant/25 bg-gradient-to-b from-surface-container-high/70 to-surface-container-low p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Badge variant={GAME_VARIANT[match.kind] || "neutral"}>
          {GAME_LABEL[match.kind] || match.kind}
        </Badge>
        <span className="truncate text-[9px] font-black uppercase tracking-widest text-on-surface-variant/70">
          {when}
        </span>
      </div>
      <div className="flex items-start gap-2">
        <DuelSide team={home} highlight={match.imHome} side="Casa" />
        <div className="flex shrink-0 flex-col items-center pt-3.5">
          {match.isCurrent ? (
            <Badge variant="info" size="md">
              Hoje
            </Badge>
          ) : (
            <span className="font-headline text-lg font-black italic text-on-surface-variant/40">
              VS
            </span>
          )}
        </div>
        <DuelSide team={away} highlight={!match.imHome} side="Fora" />
      </div>
      {clickable && (
        <Button
          variant="ghost"
          size="sm"
          full
          className="mt-3"
          onClick={() => onOpenTeam(match.opponent)}
          title={`Abrir clube: ${match.opponent.name ?? ""}`}
        >
          Ver adversário
          <span aria-hidden className="material-symbols-outlined text-[16px] leading-none">
            chevron_right
          </span>
        </Button>
      )}
    </div>
  );
}

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
            <p
              className={`inline-block min-w-[3.25rem] rounded-md px-2 py-1 text-center font-headline text-sm font-black leading-none tabular-nums ring-1 ring-inset ${meta.pill}`}
            >
              {match.myScore}–{match.opScore}
            </p>
            {match.hasPen && (
              <p className="mt-0.5 text-center text-[8px] font-bold tabular-nums text-on-surface-variant/60">
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
          className="material-symbols-outlined hidden text-[16px] text-on-surface-variant/30 transition-transform group-hover:translate-x-0.5 group-hover:text-on-surface-variant sm:inline"
        >
          chevron_right
        </span>
      )}
    </>
  );

  const className =
    "flex w-full items-center gap-2.5 rounded-lg border border-outline-variant/25 bg-surface-container-low px-2.5 py-2 text-left transition-all duration-200";

  if (!clickable) return <div className={className}>{content}</div>;
  return (
    <button
      type="button"
      onClick={() => onOpenTeam(opponent)}
      title={`Abrir clube: ${opponent?.name ?? ""}`}
      className={`group ${className} hover:-translate-y-px hover:border-outline-variant/50 hover:bg-surface-container-high hover:shadow-lg hover:shadow-black/30`}
    >
      {content}
    </button>
  );
}

/**
 * Destaque do plantel (top por skill) na tab Resumo.
 *
 * @param {{ player: object, rank: number, onOpenPlayerHistory?: (player: object) => void }} props
 */
function HighlightRow({ player, rank, onOpenPlayerHistory }) {
  const skillClass = POSITION_TEXT_CLASS[player.position] || "text-on-surface";
  return (
    <button
      type="button"
      onClick={() => onOpenPlayerHistory?.(player)}
      title="Abrir histórico do jogador"
      className="flex w-full items-center gap-2.5 rounded-lg border border-outline-variant/25 bg-surface-container-low px-2.5 py-2 text-left transition-all duration-200 hover:-translate-y-px hover:border-outline-variant/50 hover:bg-surface-container-high hover:shadow-lg hover:shadow-black/30"
    >
      <span
        aria-label={`${rank}º`}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black shadow-md ${MEDAL_CLASS[rank - 1] || "bg-surface-bright text-on-surface-variant"}`}
      >
        {rank}
      </span>
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
  // A linha da classificação não traz a capacidade — cai no clube clicado.
  const capacity =
    teamRow?.stadium_capacity || selectedTeam?.stadium_capacity || 10000;
  const lastFiveRecord = ["V", "E", "D"]
    .map((r) => `${lastFive.filter((m) => m.result === r).length}${r}`)
    .join(" ");
  const playedFixtures = fixtures.filter((m) => m.result);
  const upcomingFixtures = fixtures.filter((m) => !m.result);
  const ink = selectedTeam?.color_secondary || "#ffffff";

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
            capacity={capacity}
            primary={selectedTeam?.color_primary}
            secondary={selectedTeam?.color_secondary}
            mood={selectedTeam?.fans_mood ?? null}
            className="h-full w-full"
          />
        </div>
        {/* Profundidade: sombra a subir do fundo (legibilidade das tabs) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-black/15"
        />
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
            className="group -ml-1 flex items-center gap-1 rounded-full py-1 pl-1 pr-2.5 text-[10px] font-black uppercase tracking-widest text-white/80 transition-colors hover:bg-black/25 hover:text-white"
          >
            <span className="material-symbols-outlined text-[18px] leading-none transition-transform group-hover:-translate-x-0.5">
              arrow_back
            </span>
            Voltar
          </button>

          <div className="mt-1.5 flex items-center gap-3 sm:mt-3 sm:gap-5">
            <TeamCrest
              team={teamRow}
              size="w-12 h-12 sm:w-20 sm:h-20 text-lg sm:text-4xl"
              className="shadow-xl shadow-black/40 ring-2 ring-white/25"
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
            className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px] font-black uppercase tracking-widest sm:mt-3"
            style={{ color: ink }}
          >
            <HeaderChip>Época {seasonYear}</HeaderChip>
            {position != null && <HeaderChip>{position}º lugar</HeaderChip>}
            {teamRow?.points != null && (
              <HeaderChip className="tabular-nums">{teamRow.points} pts</HeaderChip>
            )}
            {(teamForms?.[selectedTeam?.id] || "").length > 0 && (
              <HeaderChip>
                Forma
                <FormDots form={teamForms[selectedTeam.id]} size="sm" />
              </HeaderChip>
            )}
            {isOwnTeam && (
              <HeaderChip className={`tabular-nums ${myBudget >= 0 ? "" : "text-red-200"}`}>
                Saldo {formatCurrency(myBudget)}
              </HeaderChip>
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
                <div className="flex flex-col gap-2">
                  {[
                    ["Resultados", playedFixtures, "from-primary to-primary/40"],
                    ["Por jogar", upcomingFixtures, null],
                  ]
                    .filter(([, list]) => list.length > 0)
                    .map(([title, list, barClass]) => (
                      <section key={title} aria-label={title}>
                        <GroupHeader
                          title={title}
                          meta={`${list.length} ${list.length === 1 ? "jogo" : "jogos"}`}
                          barClass={barClass}
                        />
                        <div className="flex flex-col gap-1.5">
                          {list.map((match) => (
                            <MatchLine
                              key={`${match.kind}-${match.slot}-${match.opponentId}`}
                              match={match}
                              onOpenTeam={onOpenTeamSquad}
                            />
                          ))}
                        </div>
                      </section>
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
                meta={lastFive.length > 0 ? lastFiveRecord : ""}
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
                    <NextMatchCard
                      match={nextMatch}
                      team={teamRow}
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
                      {highlights.map((player, i) => (
                        <HighlightRow
                          key={player.id}
                          rank={i + 1}
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
                <div className="flex shrink-0 justify-center rounded-lg bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.07),transparent_70%)] py-2 sm:w-44">
                  <TeamKit
                    team={teamRow}
                    className="h-32 object-contain sm:h-36"
                  />
                </div>
                <dl className="grid flex-1 grid-cols-1 gap-2 min-[400px]:grid-cols-2">
                  {[
                    {
                      icon: "palette",
                      label: "Cores",
                      value: (
                        <span className="flex items-center gap-1.5">
                          {[teamRow?.color_primary, teamRow?.color_secondary]
                            .filter(Boolean)
                            .map((color) => (
                              <span
                                key={color}
                                className="h-5 w-5 rounded-full border border-outline-variant/40 shadow-sm shadow-black/40"
                                style={{ backgroundColor: color }}
                              />
                            ))}
                        </span>
                      ),
                    },
                    {
                      icon: "handshake",
                      label: "Patrocinador",
                      value: brand ? (
                        <span className="flex min-w-0 items-center gap-2">
                          <SponsorLogo brand={brand} className="h-6 w-6 shrink-0 rounded-sm" />
                          <span className="truncate">{brand.name}</span>
                        </span>
                      ) : (
                        "—"
                      ),
                    },
                    { icon: "stadium", label: "Estádio", value: teamRow?.stadium_name || "—" },
                    {
                      icon: "groups",
                      label: "Capacidade",
                      value: `${capacity.toLocaleString("pt-PT")} lugares`,
                    },
                    isOwnTeam && squadStats
                      ? { icon: "payments", label: "Folha semanal", value: formatCurrency(squadStats.wage) }
                      : null,
                  ]
                    .filter(Boolean)
                    .map((fact) => (
                      <div
                        key={fact.label}
                        className="flex min-w-0 items-center gap-3 rounded-lg border border-outline-variant/20 bg-surface-container-low px-3 py-2.5"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-bright/60 text-on-surface-variant">
                          <span aria-hidden className="material-symbols-outlined text-[18px] leading-none">
                            {fact.icon}
                          </span>
                        </span>
                        <div className="min-w-0 flex-1">
                          <dt className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/70">
                            {fact.label}
                          </dt>
                          <dd className="mt-0.5 truncate text-xs font-black tabular-nums text-on-surface">
                            {fact.value}
                          </dd>
                        </div>
                      </div>
                    ))}
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
                      <GroupHeader
                        title={POS_GROUP_LABEL[pos]}
                        meta={`${group.length} · ${formatCurrency(wage)}/sem`}
                        barClass={POSITION_BAR_CLASS[pos]}
                      />
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
