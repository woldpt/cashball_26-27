import {
  DIVISION_NAMES,
  POSITION_TEXT_CLASS,
  SEASON_CALENDAR,
} from "../constants/index.js";
import { generateLeagueFixtures } from "../utils/fixtures.js";
import { formatCurrency } from "../utils/formatters.js";
import { isSameTeamId } from "../utils/teamHelpers.js";
import { PlayerRow } from "../components/shared/PlayerRow.jsx";
import { SummaryWidget } from "../components/shared/SummaryWidget.jsx";
import { TabBar } from "../components/shared/TabBar.jsx";
import { Badge } from "../components/shared/Badge.jsx";
import { PlayerAvatar } from "../components/shared/PlayerAvatar.jsx";
import { TeamHistoryView } from "./TeamHistoryView.jsx";
import { useMemo, useState } from "react";

/**
 * @param {{
 *   selectedTeam: object|null,
 *   selectedTeamSquad: Array,
 *   selectedTeamLoading: boolean,
 *   me: object|null,
 *   avatarSeed: string,
 *   players: Array,
 *   clubHistory: object|null,
 *   clubHistoryTeamId: number|null,
 *   setTransferProposalModal: function,
 *   myBudget: number,
 *   currentMatchweek: number,
 *   calendarData,
 *   teams,
 *   onBack: function,
 *   onOpenTeamSquad: function,
 *   onOpenPlayerHistory?: (player: object) => void,
 * }} props
 */
export function TeamSquadView({
  selectedTeam,
  selectedTeamSquad,
  selectedTeamLoading,
  me,
  avatarSeed = "",
  players,
  clubHistory,
  clubHistoryTeamId,
  setTransferProposalModal,
  myBudget = 0,
  currentMatchweek = 1,
  calendarData,
  teams,
  onBack,
  onOpenTeamSquad,
  onOpenPlayerHistory,
}) {
  const [activeTab, setActiveTab] = useState("squad");

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
  const coachAvatarSeed = isOwnTeam
    ? `${me?.name ?? "?"}|${avatarSeed}`
    : `coach|${selectedTeam?.coach_name ?? selectedTeam?.id ?? "?"}`;

  const selectedTeamDivision = selectedTeam?.division;

  const seasonYear = calendarData?.year ?? new Date().getFullYear();

  const teamFixtures = useMemo(() => {
    const curIdx = calendarData?.calendarIndex ?? 0;
    const divTeams = (teams ?? [])
      .filter((t) => t.division === selectedTeamDivision)
      .sort((a, b) => a.id - b.id);

    // calendarIndex é um índice misto (0–18, liga + taça) enquanto matchweek
    // só avança nas jornadas de liga — o estado tem de vir de
    // entry.calendarIndex, não de tratar calendarIndex como número de jornada.
    return SEASON_CALENDAR.filter((entry) => entry.type === "league")
      .map((entry) => {
        const status =
          entry.calendarIndex < curIdx
            ? "done"
            : entry.calendarIndex === curIdx
              ? "current"
              : "future";
        const divFixtures =
          status === "done"
            ? (calendarData?.leagueMatches ?? [])
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
            : generateLeagueFixtures(
                calendarData?.fixtureSeeds?.[selectedTeamDivision] ??
                  divTeams.map((t) => t.id),
                entry.matchweek,
              ).map((f) => ({ ...f, result: null }));
        const myFixture = divFixtures.find(
          (f) =>
            f.homeTeamId === selectedTeam.id ||
            f.awayTeamId === selectedTeam.id,
        );
        if (!myFixture) return null;
        const imHome = myFixture.homeTeamId === selectedTeam.id;
        const opponent = teams.find(
          (t) =>
            t.id === (imHome ? myFixture.awayTeamId : myFixture.homeTeamId),
        );
        const stadiumTeam = imHome ? selectedTeam : opponent;
        const myScore = myFixture.result
          ? imHome
            ? myFixture.result.home_score
            : myFixture.result.away_score
          : null;
        const opScore = myFixture.result
          ? imHome
            ? myFixture.result.away_score
            : myFixture.result.home_score
          : null;
        const won = myFixture.result
          ? imHome
            ? myFixture.result.home_score > myFixture.result.away_score
            : myFixture.result.away_score > myFixture.result.home_score
          : null;
        const drew = myFixture.result
          ? myFixture.result.home_score === myFixture.result.away_score
          : null;
        return {
          fixture: { ...myFixture, matchweek: entry.matchweek },
          status,
          imHome,
          opponent,
          stadiumTeam,
          myScore,
          opScore,
          won,
          drew,
        };
      })
      .filter(Boolean);
  }, [calendarData, selectedTeam, selectedTeamDivision, teams]);

  return (
    <div className="min-h-screen w-full bg-surface text-on-surface flex flex-col">
      {/* Header mobile — barra compacta + monograma (cor da equipa como acento) */}
      <div className="sm:hidden border-b border-outline-variant/60 bg-surface-container-low">
        {/* Hairline nas cores da equipa */}
        <div
          className="h-0.5 w-full"
          style={{
            background: `linear-gradient(90deg, ${selectedTeam.color_primary || "#2d6a4f"}, ${
              selectedTeam.color_secondary || "#e9c349"
            })`,
          }}
        />
        <div className="flex items-center gap-3 px-4 pt-2.5 pb-2">
          <button
            onClick={onBack}
            aria-label="Voltar"
            className="-ml-1 shrink-0 p-1.5 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors"
          >
            <span className="material-symbols-outlined text-[22px]">
              arrow_back
            </span>
          </button>
          {/* Monograma */}
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-black shrink-0 border border-white/10"
            style={{
              background: selectedTeam.color_primary || "#2d6a4f",
              color: selectedTeam.color_secondary || "#fff",
            }}
          >
            {selectedTeam.name?.[0] || "?"}
          </div>
          {/* Nome + meta */}
          <div className="flex-1 min-w-0">
            <h1 className="font-headline text-lg font-black tracking-tight leading-tight truncate text-on-surface">
              {selectedTeam.name}
            </h1>
            <p className="text-[11px] uppercase tracking-widest font-bold text-on-surface-variant truncate">
              {DIVISION_NAMES[selectedTeam.division] ||
                `Divisão ${selectedTeam.division}`}
              · Época {seasonYear}
            </p>
          </div>
          {/* Saldo (só equipa própria) */}
          {isOwnTeam && (
            <div
              className="shrink-0 rounded-md bg-surface px-2.5 py-1 border-l-4"
              style={{
                borderLeftColor: selectedTeam.color_primary || "#2d6a4f",
              }}
            >
              <p className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant">
                Saldo
              </p>
              <p
                className={`font-headline text-sm font-black tabular-nums leading-tight ${
                  myBudget >= 0 ? "text-on-surface" : "text-error"
                }`}
              >
                {formatCurrency(myBudget)}
              </p>
            </div>
          )}
        </div>
        <div className="px-4 pb-3">
          <TabBar
            size="md"
            className="overflow-x-auto"
            tabs={[
              { key: "squad", label: "Plantel" },
              { key: "calendar", label: "Calendário" },
              { key: "history", label: "História" },
            ]}
            active={activeTab}
            onChange={setActiveTab}
          />
        </div>
      </div>

      {/* Header desktop — banner colorido (inalterado) */}
      <div
        className="hidden sm:block relative px-6 py-4 sm:py-8 border-b border-zinc-800 overflow-hidden"
        style={{
          background: selectedTeam.color_primary || "#18181b",
        }}
      >
        {/* Ambient glow blobs */}
        <div
          className="pointer-events-none absolute -top-16 -left-16 w-80 h-80 rounded-full blur-[100px] opacity-15"
          style={{ background: selectedTeam.color_primary || "#2d6a4f" }}
        />
        <div
          className="pointer-events-none absolute top-24 -right-16 w-64 h-64 rounded-full blur-[80px] opacity-10"
          style={{ background: selectedTeam.color_secondary || "#e9c349" }}
        />

        {/* Gradient overlay */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: selectedTeam.color_primary
              ? `linear-gradient(to right, ${selectedTeam.color_primary}40, transparent 70%)`
              : "linear-gradient(to right, #2d6a4f40, transparent 70%)",
          }}
        />

        {/* Back */}
        <div className="relative z-10">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/80 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">
              arrow_back
            </span>
            Voltar
          </button>
        </div>

        {/* Hero section */}
        <div className="relative flex flex-col sm:flex-row gap-3 sm:gap-5 items-start sm:items-center">
          {/* Team badge */}
          <div
            className="w-12 h-12 sm:w-20 sm:h-20 rounded-xl flex items-center justify-center text-xl sm:text-4xl font-black shrink-0 shadow-lg border border-white/10"
            style={{
              background: selectedTeam.color_primary || "#201f1f",
              color: selectedTeam.color_secondary || "#fff",
            }}
          >
            {selectedTeam.name?.[0] || "?"}
          </div>

          {/* Team info */}
          <div className="flex-1 min-w-0">
            <p
              className="text-xs uppercase tracking-widest font-black mb-1"
              style={{ color: selectedTeam.color_secondary || "#fff" }}
            >
              {DIVISION_NAMES[selectedTeam.division] ||
                `Divisão ${selectedTeam.division}`}
            </p>
            <h1
              className="font-headline text-2xl sm:text-3xl md:text-4xl font-black tracking-tighter leading-none mb-1 truncate"
              style={{ color: selectedTeam.color_secondary || "#ffffff" }}
            >
              {selectedTeam.name}
            </h1>
            <p className="text-sm text-on-surface-variant/80 font-bold">
              Época {seasonYear}
            </p>
          </div>

          {/* Coach */}
          <div className="shrink-0 text-right hidden sm:block">
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/80 font-black mb-1 flex items-center justify-end gap-1.5">
              Treinador
              {!isOwnTeam && isHumanCoached && (
                <Badge variant="warning" size="sm">
                  Humano
                </Badge>
              )}
            </p>
            <div className="flex items-center justify-end gap-2">
              <p
                className={`font-headline font-black text-lg tracking-tight ${
                  !isOwnTeam && isHumanCoached
                    ? "text-amber-300"
                    : "text-on-surface"
                }`}
              >
                {coachName}
              </p>
              <PlayerAvatar
                seed={coachAvatarSeed}
                teamColor={selectedTeam.color_primary}
                size="md"
              />
            </div>
          </div>
        </div>

        {/* Budget widget (only for own team) */}
        {isOwnTeam && (
          <div className="relative mt-3 sm:mt-5">
            <SummaryWidget
              compactMobile
              label="Saldo Disponível"
              value={formatCurrency(myBudget)}
              valueClass="text-lg sm:text-2xl"
              valueColorClass={myBudget >= 0 ? "text-on-surface" : "text-error"}
              className="h-auto"
              accentStyle={{
                borderLeftColor: selectedTeam.color_primary || "#2d6a4f",
              }}
            />
          </div>
        )}

        {/* Tab Navigation */}
        <div className="relative mt-3 sm:mt-5">
          <TabBar
            size="md"
            className="overflow-x-auto"
            tabs={[
              { key: "squad", label: "Plantel" },
              { key: "calendar", label: "Calendário" },
              { key: "history", label: "História" },
            ]}
            active={activeTab}
            onChange={setActiveTab}
          />
        </div>
      </div>

      {/* Content */}
      <div className="overflow-auto flex-1">
        {activeTab === "history" ? (
          <TeamHistoryView
            selectedTeam={selectedTeam}
            clubHistory={clubHistory}
            clubHistoryTeamId={clubHistoryTeamId}
          />
        ) : activeTab === "calendar" ? (
          <div className="space-y-2 p-6">
            {teamFixtures.length === 0 && (
              <div className="bg-surface-container rounded-lg p-8 text-center">
                <p className="text-on-surface-variant text-sm">
                  Sem jogos para mostrar.
                </p>
              </div>
            )}
            {teamFixtures.map(
              ({
                imHome,
                opponent,
                stadiumTeam,
                myScore,
                opScore,
                won,
                drew,
                fixture,
                status,
              }) => {
                const matchweek = fixture.matchweek;
                const isCurrent = status === "current";
                const isDone = status === "done";

                const outcomeClass =
                  !isDone || myScore === null
                    ? ""
                    : won
                      ? "border-l-2 border-l-emerald-500"
                      : drew
                        ? "border-l-2 border-l-amber-500"
                        : "border-l-2 border-l-red-500";

                const cardBase = `flex items-stretch gap-0 rounded-lg overflow-hidden transition-opacity ${
                  isDone
                    ? "bg-surface-container"
                    : isCurrent
                      ? "bg-surface-container border border-primary/40"
                      : "bg-surface-container opacity-60"
                } ${outcomeClass}`;

                const weekLabel = `Jornada ${matchweek}`;

                const scoreBlock =
                  isDone && myScore !== null ? (
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/60">
                        Resultado
                      </span>
                      <span
                        className={`text-xl font-headline font-black leading-none ${
                          won
                            ? "text-emerald-400"
                            : drew
                              ? "text-amber-400"
                              : "text-red-400"
                        }`}
                      >
                        {imHome ? myScore : opScore} –{" "}
                        {imHome ? opScore : myScore}
                      </span>
                      <span
                        className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                          won
                            ? "bg-emerald-500/20 text-emerald-400"
                            : drew
                              ? "bg-amber-500/20 text-amber-400"
                              : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {won ? "Vitória" : drew ? "Empate" : "Derrota"}
                      </span>
                    </div>
                  ) : isCurrent ? (
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/60">
                        Próximo Jogo
                      </span>
                      <span className="text-xl font-headline font-black text-on-surface-variant/60">
                        VS
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-primary/20 text-primary animate-pulse">
                        Ativo
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-surface-bright text-on-surface-variant/40">
                        Agendado
                      </span>
                    </div>
                  );

                return (
                  <div key={matchweek} className={cardBase}>
                    <div className="w-16 sm:w-28 shrink-0 flex flex-col justify-center gap-1 px-2 sm:px-3 py-3 border-r border-outline-variant/10">
                      <span
                        className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded self-start bg-primary/20 text-primary`}
                      >
                        Liga
                      </span>
                      <span className="text-[10px] font-black text-on-surface leading-tight">
                        {weekLabel}
                      </span>
                      {opponent && (
                        <span
                          className={`hidden sm:inline-block text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded self-start ${
                            imHome
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-sky-500/20 text-sky-400"
                          }`}
                        >
                          {imHome ? "Casa" : "Fora"}
                        </span>
                      )}
                      {isCurrent && (
                        <span className="text-[9px] text-primary font-bold">
                          Hoje
                        </span>
                      )}
                    </div>

                    <div className="flex-1 flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-3 min-w-0">
                      <div
                        className={`hidden sm:flex shrink-0 w-8 h-8 rounded items-center justify-center text-xs font-black border ${"border-primary/30 text-primary bg-primary/10"}`}
                      >
                        ⚽
                      </div>
                      <div
                        className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-black border border-white/10 shrink-0"
                        style={{
                          background: opponent?.color_primary || "#333",
                          color: opponent?.color_secondary || "#fff",
                        }}
                      >
                        {opponent?.name?.[0] ?? "?"}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <button
                          className="text-sm font-black text-on-surface text-left truncate hover:text-primary transition-colors"
                          onClick={() => opponent && onOpenTeamSquad(opponent)}
                        >
                          {opponent?.name ?? "TBD"}
                        </button>
                        <span className="hidden sm:block text-[10px] text-on-surface-variant/60 truncate">
                          {stadiumTeam?.stadium_name
                            ? `${stadiumTeam.stadium_name.toUpperCase()} (${imHome ? "Casa" : "Fora"})`
                            : imHome
                              ? "Casa"
                              : "Fora"}
                        </span>
                        {opponent && (
                          <span
                            className={`sm:hidden text-[8px] font-black uppercase tracking-widest ${
                              imHome ? "text-emerald-400" : "text-sky-400"
                            }`}
                          >
                            {imHome ? "Casa" : "Fora"}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center justify-end px-2 sm:px-4 py-3">
                      {scoreBlock}
                    </div>
                  </div>
                );
              },
            )}
          </div>
        ) : selectedTeamLoading ? (
          <div className="p-8 text-center text-zinc-400 font-bold">
            A carregar plantel...
          </div>
        ) : selectedTeamSquad.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 font-bold">
            Sem jogadores encontrados.
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 p-6">
            {["GR", "DEF", "MED", "ATA"].map((pos) => {
              const group = selectedTeamSquad.filter((p) => p.position === pos);
              if (!group.length) return null;
              const posLabel =
                pos === "GR"
                  ? "Guarda-redes"
                  : pos === "DEF"
                    ? "Defesas"
                    : pos === "MED"
                      ? "Médios"
                      : "Avançados";
              return (
                <div key={pos}>
                  <div className="flex items-center gap-2 px-1 py-2 mt-1 first:mt-0">
                    <span
                      className={`text-[10px] font-black uppercase tracking-widest ${POSITION_TEXT_CLASS[pos] || "text-zinc-400"}`}
                    >
                      {posLabel}
                    </span>
                    <span className="text-[9px] text-on-surface-variant/30 font-bold">
                      {group.length}
                    </span>
                  </div>
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
