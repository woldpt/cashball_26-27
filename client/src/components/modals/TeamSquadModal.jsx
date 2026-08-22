import {
  DIVISION_NAMES,
  POSITION_TEXT_CLASS,
  MODAL_Z,
  SEASON_CALENDAR,
} from "../../constants/index.js";
import { generateLeagueFixtures } from "../../utils/fixtures.js";
import { isSameTeamId } from "../../utils/teamHelpers.js";
import { PlayerRow } from "../shared/PlayerRow.jsx";
import { ModalShell } from "../shared/ModalShell.jsx";
import { TabBar } from "../shared/TabBar.jsx";
import { useState } from "react";

/**
 * @param {{
 *   selectedTeam: object|null,
 *   selectedTeamSquad: Array,
 *   selectedTeamLoading: boolean,
 *   me: object|null,
 *   players: Array,
 *   palmares: object,
 *   palmaresTeamId: number|null,
 *   handleCloseTeamSquad: function,
 *   setTransferProposalModal: function,
 *   myBudget: number,
 * }} props
 */
export function TeamSquadModal({
  selectedTeam,
  selectedTeamSquad,
  selectedTeamLoading,
  me,
  players,
  palmares,
  palmaresTeamId,
  handleCloseTeamSquad,
  setTransferProposalModal,
  myBudget = 0,
  currentMatchweek = 1,
  calendarData,
  teams,
  setSelectedTeam,
}) {
  const [activeTab, setActiveTab] = useState("squad");

  const isOwnTeam = isSameTeamId(selectedTeam?.id, me?.teamId);
  const isNpcTeam =
    !isOwnTeam &&
    !players.some((p) => isSameTeamId(p.teamId, selectedTeam?.id));
  const showProposalCol = isNpcTeam;

  const selectedTeamDivision = selectedTeam?.division;
  const selectedDivTeams = teams
    .filter((t) => t.division === selectedTeamDivision)
    .sort((a, b) => a.id - b.id);

  const getTeamFixtures = () => {
    const curIdx = calendarData?.calendarIndex ?? 0;
    const cal = calendarData;

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
            ? (cal?.leagueMatches ?? [])
                .filter(
                  (m) =>
                    m.matchweek === entry.matchweek &&
                    selectedDivTeams.some((t) => t.id === m.home_team_id) &&
                    selectedDivTeams.some((t) => t.id === m.away_team_id),
                )
                .map((m) => ({
                  homeTeamId: m.home_team_id,
                  awayTeamId: m.away_team_id,
                  result: m,
                }))
            : generateLeagueFixtures(
                cal?.fixtureSeeds?.[selectedTeamDivision] ??
                  selectedDivTeams.map((t) => t.id),
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
  };

  return (
    <ModalShell
      visible={!!selectedTeam}
      onClose={handleCloseTeamSquad}
      z={MODAL_Z.teamSquad}
      variant="xl"
      dismissable
    >
      {selectedTeam && (
        <div className="flex flex-col" style={{ maxHeight: "90vh" }}>
          {/* Header + Tabs */}
          <div
            className="px-5 py-4 border-b border-outline-variant/15 flex flex-col gap-3"
            style={{ background: selectedTeam.color_primary || "#18181b" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p
                  className="text-xs uppercase tracking-widest font-black"
                  style={{ color: selectedTeam.color_secondary || "#ffffff" }}
                >
                  {activeTab === "squad" ? "Plantel" : "Calendário"}
                </p>
                <h3
                  className="text-2xl md:text-3xl font-black"
                  style={{ color: selectedTeam.color_secondary || "#ffffff" }}
                >
                  {selectedTeam.name}
                </h3>
                <p
                  className="text-sm font-bold"
                  style={{ color: selectedTeam.color_secondary || "#ffffff" }}
                >
                  {DIVISION_NAMES[selectedTeam.division] ||
                    `Divisão ${selectedTeam.division}`}
                </p>
              </div>
              <button
                onClick={handleCloseTeamSquad}
                className="shrink-0 px-4 py-2 rounded-md bg-surface-container/40 font-black uppercase text-sm border border-outline-variant/20 hover:bg-surface-container"
                style={{
                  color: selectedTeam.color_secondary || "#ffffff",
                  borderColor: selectedTeam.color_secondary || "#ffffff",
                }}
              >
                Fechar
              </button>
            </div>

            {/* Tab Navigation */}
            <TabBar
              tabs={[
                { key: "squad", label: "Plantel" },
                { key: "calendar", label: "Calendário" },
              ]}
              active={activeTab}
              onChange={setActiveTab}
            />
          </div>

          {/* Palmarés */}
          {activeTab === "squad" &&
            palmaresTeamId === selectedTeam?.id &&
            palmares.trophies?.length > 0 && (
              <div className="border-t border-zinc-800 px-6 py-4">
                <h4 className="text-xs text-amber-400 font-black uppercase tracking-widest mb-3 flex items-center gap-2">
                  🏆 Palmarés
                </h4>
                <div className="flex flex-wrap gap-2">
                  {palmares.trophies.map((trophy, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded-full bg-amber-900/30 border border-amber-700/40 text-amber-300 text-xs font-black"
                    >
                      🏆 {trophy.achievement}
                      {trophy.season ? ` (${trophy.season})` : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}

          <div className="overflow-auto">
            {activeTab === "calendar" ? (
              <div className="space-y-2">
                {getTeamFixtures().length === 0 && (
                  <div className="bg-surface-container rounded-lg p-8 text-center">
                    <p className="text-on-surface-variant text-sm">
                      Sem jogos para mostrar.
                    </p>
                  </div>
                )}
                {getTeamFixtures().map(
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
                              onClick={() =>
                                opponent &&
                                handleCloseTeamSquad &&
                                setSelectedTeam(opponent)
                              }
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
              <div className="p-8 text-center text-zinc-500 font-bold">
                Sem jogadores encontrados.
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 p-4">
                {["GR", "DEF", "MED", "ATA"].map((pos) => {
                  const group = selectedTeamSquad.filter(
                    (p) => p.position === pos,
                  );
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
      )}
    </ModalShell>
  );
}
