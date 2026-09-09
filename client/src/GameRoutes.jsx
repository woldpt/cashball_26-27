import { useMemo } from "react";
import { socket } from "./socket.js";
import { useGame } from "./contexts/GameContext.jsx";
import {
  LiveMatchHero,
  CupFinalStage,
  LiveFixtureRow,
  LiveStandingsPanel,
  isDrawnAt90,
} from "./components/live/index.js";
import { StandingsTab } from "./views/StandingsTab.jsx";
import { BracketTab } from "./views/BracketTab.jsx";
import { CupTab } from "./views/CupTab.jsx";
import { CalendarioTab } from "./views/CalendarioTab.jsx";
import { ClubTab } from "./views/ClubTab.jsx";
import { JournalTab } from "./views/JournalTab.jsx";
import { FinancesTab } from "./views/FinancesTab.jsx";
import { StadiumTab } from "./views/StadiumTab.jsx";
import { PlayersTab } from "./views/PlayersTab.jsx";
import { TeamSquadView } from "./views/TeamSquadView.jsx";
import { TrainingTab } from "./views/TrainingTab.jsx";
import { TacticsView } from "./views/TacticsView.jsx";
import { TransferHub } from "./components/ui/TransferHub.jsx";
import { AuctionsPage } from "./pages/AuctionsPage.jsx";
import { PlayerSearchView } from "./views/PlayerSearchView.jsx";
import { UserSettingsPage } from "./pages/UserSettingsPage.jsx";
import { DIVISION_NAMES } from "./constants/index.js";
import { isSameTeamId } from "./utils/teamHelpers.js";

/**
 * GameRoutes — resolve qual a view ativa a renderizar. Consome useGame()
 * sozinho (sem props além de auth). Separado do GameLayout para o ficheiro
 * de chrome não agregar o switch de páginas.
 */
export function GameRoutes({ handleLogout, setAuthPhase, replayTutorial }) {
  const {
    // active tab + helpers de navegação usados aqui
    activeTab,
    // match ao vivo / simulação
    matchResults,
    allMatchResults,
    matchAction,
    matchweekCount,
    cupMatchRoundName,
    substitutionPause,
    liveMinute,
    isPlayingMatch,
    isMatchActionPending,
    isMatchInProgress,
    showHalftimePanel,
    isLiveSimulation,
    standingsStale,
    goalFlashRef,
    // equipas / plantel
    teams,
    teamInfo,
    teamForms,
    players,
    mySquad,
    annotatedSquad,
    me,
    myMatch,
    isCupMatch,
    isCupExtraTime,
    // classificações / palmarés / histórico
    prevStandings,
    topScorers,
    palmares,
    palmaresTeamId,
    clubHistory,
    clubHistoryTeamId,
    clubNews,
    // taça
    cupBracketData,
    cupDraw,
    cupRoundResults,
    cupResultsFilter,
    setCupResultsFilter,
    // calendário
    calendarData,
    calFilter,
    setCalFilter,
    // finanças / estádio
    financeData,
    totalWeeklyWage,
    completedJornada,
    loanInterestPerWeek,
    loanAmount,
    currentBudget,
    capacityRevPerGame,
    showTransferSales,
    setShowTransferSales,
    showTransferPurchases,
    setShowTransferPurchases,
    showTicketBreakdown,
    setShowTicketBreakdown,
    seasonYear,
    season,
    // mercado / scout
    filteredMarketPlayers,
    transferHistory,
    // jornal global
    globalNews,
    marketPositionFilter,
    setMarketPositionFilter,
    marketSort,
    setMarketSort,
    buyPlayer,
    openAuctionBid,
    activeAuctions,
    playerSearchData,
    playerSearchLoading,
    setPlayerSearchLoading,
    selectedTeam,
    selectedTeamSquad,
    selectedTeamLoading,
    handleOpenTeamSquad,
    handleCloseTeamSquad,
    navigateTab,
    resetGameState,
    setMe,
    // avatares
    avatarSeed,
    setAvatarSeed,
    coachAvatars,
    setCoachAvatars,
    backendUrl,
    // dialog
    setGameDialog,
    setTransferProposalModal,
    setShowMatchDetail,
    setMatchDetailFixture,
  } = useGame();

  // Jogo ao vivo que envolve pelo menos um coach humano (sala multiplayer).
  // Set memorizado: o sortHumanFirst corre O(n log n) comparações por render.
  const humanTeamIds = useMemo(
    () => new Set(players.map((p) => p.teamId)),
    [players],
  );
  const isHumanFixture = (m) =>
    humanTeamIds.has(m?.homeTeamId) || humanTeamIds.has(m?.awayTeamId);
  // MOM do meu jogo: a liga já traz `mom` no fixture final (matchResults);
  // na Taça o fixture (matchResults simplificado) não traz — procurar no
  // payload da ronda (cupRoundResults.results).
  const myMatchMom = useMemo(() => {
    if (myMatch?.mom) return myMatch.mom;
    if (!isCupMatch || !myMatch || !cupRoundResults?.results) return null;
    const row = cupRoundResults.results.find(
      (r) =>
        Number(r.homeTeamId) === Number(myMatch.homeTeamId) &&
        Number(r.awayTeamId) === Number(myMatch.awayTeamId),
    );
    return row?.mom || null;
  }, [myMatch, isCupMatch, cupRoundResults]);

  const sortHumanFirst = (a, b) =>
    Number(isHumanFixture(b)) - Number(isHumanFixture(a));

  // Final da Taça: palco de gala quer participes quer não. Sem o teu jogo,
  // a fixture da final (results[0] — a final é sempre jogo único).
  const isCupFinal = isCupMatch && cupMatchRoundName === "Final";
  const finalFixture = isCupFinal
    ? (myMatch ?? matchResults?.results?.[0] ?? null)
    : null;
  // MOM da final (para o palco): a mesma lookup do teu jogo, mas sobre a
  // fixture da final — quando participas, coincide com myMatchMom.
  const finalMom = useMemo(() => {
    if (!isCupFinal || !finalFixture || !cupRoundResults?.results)
      return null;
    const row = cupRoundResults.results.find(
      (r) =>
        Number(r.homeTeamId) === Number(finalFixture.homeTeamId) &&
        Number(r.awayTeamId) === Number(finalFixture.awayTeamId),
    );
    return row?.mom || null;
  }, [isCupFinal, finalFixture, cupRoundResults]);

  return (
    <>
                    {activeTab === "live" && (matchResults || matchAction) && (
                      <div
                        className={`bg-surface-container text-on-surface font-body p-3 sm:p-6 border border-outline-variant/20 shadow-sm relative overflow-hidden${isMatchInProgress ? " rounded-lg" : " min-h-150 rounded-lg"}`}
                      >
                        {/* ── FINAL DA TAÇA: palco de gala (participes ou não) ── */}
                        {isCupFinal && finalFixture ? (
                          <div className="mb-3">
                            <CupFinalStage
                              finalFixture={finalFixture}
                              mom={finalMom}
                              teams={teams}
                              players={players}
                              me={me}
                              liveMinute={liveMinute}
                              isPlayingMatch={isPlayingMatch}
                              isMatchActionPending={isMatchActionPending}
                              cupMatchRoundName={cupMatchRoundName}
                              substitutionPause={substitutionPause}
                              goalFlashRef={goalFlashRef}
                              isCupExtraTime={isCupExtraTime}
                              matchResults={matchResults}
                              readOnly={!myMatch}
                              onScoreClick={
                                myMatch
                                  ? () => {
                                      if (
                                        isPlayingMatch &&
                                        !isMatchActionPending
                                      ) {
                                        socket.emit("request_substitution");
                                      } else {
                                        setMatchDetailFixture(myMatch);
                                        setShowMatchDetail(true);
                                      }
                                    }
                                  : undefined
                              }
                            />
                          </div>
                        ) : (
                        <>
                        {/* ── ROW 1: MY GAME + VIRTUAL CLASSIFICATION ── */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
                          <div
                            className={`${isCupMatch ? "lg:col-span-3" : "lg:col-span-2"}`}
                          >
                            {/* ── HERO: MY MATCH ─────────────────────── */}
                            {matchResults && (
                              <LiveMatchHero
                                myMatch={myMatch}
                                mom={myMatchMom}
                                teams={teams}
                                players={players}
                                me={me}
                                liveMinute={liveMinute}
                                isPlayingMatch={isPlayingMatch}
                                isMatchActionPending={isMatchActionPending}
                                isCupMatch={isCupMatch}
                                cupMatchRoundName={cupMatchRoundName}
                                substitutionPause={substitutionPause}
                                goalFlashRef={goalFlashRef}
                                isCupExtraTime={isCupExtraTime}
                                matchResults={matchResults}
                                onScoreClick={() => {
                                  if (isPlayingMatch && !isMatchActionPending) {
                                    socket.emit("request_substitution");
                                  } else {
                                    setMatchDetailFixture(myMatch);
                                    setShowMatchDetail(true);
                                  }
                                }}
                              />
                            )}
                          </div>
                          {/* ── VIRTUAL CLASSIFICATION COLUMN ── */}
                          {!isCupMatch && matchResults?.results && (
                            <div className="lg:col-span-1 min-h-0">
                              <LiveStandingsPanel
                                teams={teams}
                                matchResults={matchResults}
                                liveMinute={liveMinute}
                                myTeamId={me.teamId}
                                teamForms={teamForms}
                                applyLiveResults={
                                  standingsStale ||
                                  isLiveSimulation ||
                                  showHalftimePanel
                                }
                              />
                            </div>
                          )}
                        </div>
                        </>
                        )}

                        {/* ── ROW 2: ALL DIVISIONS ── */}
                        {!isCupMatch &&
                          (() => {
                            const myDiv = teams.find(
                              (t) => t.id === me.teamId,
                            )?.division;
                            const allDivs = [1, 2, 3, 4];
                            return (
                              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-4">
                                {allDivs.map((div) => {
                                  const isMyDiv = div === myDiv;
                                  const divMatches = matchResults.results
                                    .filter(
                                      (m) =>
                                        teams.find((t) => t.id === m.homeTeamId)
                                          ?.division === div,
                                    )
                                    .filter(
                                      (m) =>
                                        m.homeTeamId !== me.teamId &&
                                        m.awayTeamId !== me.teamId,
                                    )
                                    .sort(sortHumanFirst);
                                  return (
                                    <div
                                      key={div}
                                      className="flex flex-col gap-2"
                                    >
                                      <div
                                        className={`px-3 py-2 rounded-t-md border-b-2 bg-surface-container-high ${
                                          isMyDiv
                                            ? "border-primary/60"
                                            : "border-outline-variant/20"
                                        }`}
                                      >
                                        <h3
                                          className={`font-headline font-extrabold text-[9px] sm:text-[10px] lg:text-[11px] tracking-tighter uppercase ${
                                            isMyDiv
                                              ? "text-primary"
                                              : "text-on-surface/50"
                                          }`}
                                        >
                                          {DIVISION_NAMES[div] || `Div ${div}`}
                                          <span className="ml-1 text-on-surface/30">
                                            {divMatches.length}
                                          </span>
                                          {isMyDiv && (
                                            <span className="ml-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary text-[7px] font-black uppercase tracking-widest border border-primary/30">
                                              A tua divisão
                                            </span>
                                          )}
                                        </h3>
                                      </div>
                                      <div className="flex flex-col gap-1.5">
                                        {divMatches.length === 0 ? (
                                          <div className="text-[10px] text-on-surface-variant/30 px-3 py-2 text-center italic">
                                            Sem jogos
                                          </div>
                                        ) : (
                                          divMatches.map((match) => (
                                            <LiveFixtureRow
                                              key={`${match.homeTeamId}-${match.awayTeamId}`}
                                              match={match}
                                              teams={teams}
                                              players={players}
                                              liveMinute={liveMinute}
                                              goalFlashRef={goalFlashRef}
                                              onOpenDetail={() => {
                                                setMatchDetailFixture(match);
                                                setShowMatchDetail(true);
                                              }}
                                            />
                                          ))
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}

                        {/* ── CUP MULTIVIEW (rondas anteriores; a final tem palco próprio) ── */}
                        {isCupMatch && !isCupFinal && matchResults?.results && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {matchResults.results
                              .filter(
                                (m) =>
                                  m.homeTeamId !== me.teamId &&
                                  m.awayTeamId !== me.teamId,
                              )
                              .filter((m) => {
                                // Após os 90': só mostra jogos ainda no prolongamento (empatados aos 90)
                                if (liveMinute <= 90) return true;
                                return isDrawnAt90(m);
                              })
                              .sort(sortHumanFirst)
                              .map((match) => (
                                <LiveFixtureRow
                                  key={`${match.homeTeamId}-${match.awayTeamId}`}
                                  match={match}
                                  teams={teams}
                                  players={players}
                                  liveMinute={liveMinute}
                                  goalFlashRef={goalFlashRef}
                                  onOpenDetail={() => {
                                    setMatchDetailFixture(match);
                                    setShowMatchDetail(true);
                                  }}
                                />
                              ))}
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === "standings" && (
                      <StandingsTab
                        teams={teams}
                        teamForms={teamForms}
                        topScorers={topScorers}
                        myTeamId={me.teamId}
                        completedJornada={completedJornada}
                        matchweekCount={matchweekCount}
                        palmares={palmares}
                        onTeamClick={handleOpenTeamSquad}
                        players={players}
                        allMatchResults={allMatchResults}
                        standingsStale={standingsStale}
                        prevStandings={prevStandings}
                      />
                    )}

                    {activeTab === "bracket" && (
                      <BracketTab
                        bracketData={cupBracketData}
                        me={me}
                        players={players}
                        onOpenTeamSquad={handleOpenTeamSquad}
                      />
                    )}

                    {activeTab === "cup" && (
                      <CupTab
                        cupRoundResults={cupRoundResults}
                        cupDraw={cupDraw}
                        me={me}
                        teams={teams}
                        cupResultsFilter={cupResultsFilter}
                        setCupResultsFilter={setCupResultsFilter}
                      />
                    )}

                    {activeTab === "calendario" && (
                      <CalendarioTab
                        calendarData={calendarData}
                        me={me}
                        teams={teams}
                        seasonYear={seasonYear}
                        calFilter={calFilter}
                        setCalFilter={setCalFilter}
                        matchweekCount={matchweekCount}
                        handleOpenTeamSquad={handleOpenTeamSquad}
                      />
                    )}
                    {activeTab === "club" && (
                      <ClubTab
                        teamInfo={teamInfo}
                        seasonYear={seasonYear}
                        me={me}
                        onReplayTutorial={replayTutorial}
                        currentBudget={currentBudget}
                        totalWeeklyWage={totalWeeklyWage}
                        loanAmount={loanAmount}
                        palmaresTeamId={palmaresTeamId}
                        palmares={palmares}
                        clubNews={clubNews}
                      />
                    )}

                    {activeTab === "jornal" && (
                      <JournalTab
                        globalNews={globalNews}
                        teams={teams}
                        me={me}
                        seasonYear={seasonYear}
                        topScorers={topScorers}
                        teamForms={teamForms}
                        players={players}
                        onOpenPlayerHistory={(player) =>
                          socket.emit("requestPlayerHistory", {
                            playerId: player.id,
                          })
                        }
                      />
                    )}

                    {activeTab === "finances" && (
                      <FinancesTab
                        financeData={financeData}
                        totalWeeklyWage={totalWeeklyWage}
                        completedJornada={completedJornada}
                        loanInterestPerWeek={loanInterestPerWeek}
                        loanAmount={loanAmount}
                        currentBudget={currentBudget}
                        seasonYear={seasonYear}
                        capacityRevPerGame={capacityRevPerGame}
                        mySquad={mySquad}
                        showTransferSales={showTransferSales}
                        setShowTransferSales={setShowTransferSales}
                        showTransferPurchases={showTransferPurchases}
                        setShowTransferPurchases={setShowTransferPurchases}
                        showTicketBreakdown={showTicketBreakdown}
                        setShowTicketBreakdown={setShowTicketBreakdown}
                        setGameDialog={setGameDialog}
                      />
                    )}

                    {activeTab === "stadium" && (
                      <StadiumTab
                        teamInfo={teamInfo}
                        currentBudget={currentBudget}
                        capacityRevPerGame={capacityRevPerGame}
                        financeData={financeData}
                        setGameDialog={setGameDialog}
                      />
                    )}

                    {activeTab === "players" && (
                      <PlayersTab
                        mySquad={mySquad}
                        annotatedSquad={annotatedSquad}
                        matchweekCount={matchweekCount}
                        season={season}
                        onOpenPlayerHistory={(player) =>
                          socket.emit("requestPlayerHistory", {
                            playerId: player.id,
                          })
                        }
                      />
                    )}

                    {activeTab === "squad" && (
                      <TeamSquadView
                        selectedTeam={selectedTeam}
                        selectedTeamSquad={selectedTeamSquad}
                        selectedTeamLoading={selectedTeamLoading}
                        me={me}
                        avatarSeed={avatarSeed}
                        coachAvatars={coachAvatars}
                        backendUrl={backendUrl}
                        players={players}
                        palmares={palmares}
                        palmaresTeamId={palmaresTeamId}
                        clubHistory={clubHistory}
                        clubHistoryTeamId={clubHistoryTeamId}
                        setTransferProposalModal={setTransferProposalModal}
                        myBudget={currentBudget}
                        currentMatchweek={matchweekCount + 1}
                        calendarData={calendarData}
                        teams={teams}
                        onBack={handleCloseTeamSquad}
                        onOpenTeamSquad={handleOpenTeamSquad}
                        onOpenPlayerHistory={(player) =>
                          socket.emit("requestPlayerHistory", {
                            playerId: player.id,
                          })
                        }
                      />
                    )}

                    {activeTab === "training" && (
                      <TrainingTab
                        me={me}
                        players={players}
                        matchweekCount={matchweekCount}
                      />
                    )}

                    {activeTab === "tactic" && <TacticsView />}

                    {activeTab === "market" && (
                      <TransferHub
                        players={filteredMarketPlayers}
                        teams={teams}
                        transferHistory={transferHistory}
                        budget={teamInfo?.budget ?? 0}
                        me={me}
                        marketPositionFilter={marketPositionFilter}
                        setMarketPositionFilter={setMarketPositionFilter}
                        marketSort={marketSort}
                        setMarketSort={setMarketSort}
                        isSameTeamId={isSameTeamId}
                        buyPlayer={buyPlayer}
                        openAuctionBid={openAuctionBid}
                        onOpenPlayerHistory={(player) =>
                          socket.emit("requestPlayerHistory", {
                            playerId: player.id,
                          })
                        }
                        setGameDialog={setGameDialog}
                        matchweekCount={matchweekCount}
                      />
                    )}

                    {activeTab === "leiloes" && (
                      <AuctionsPage
                        activeAuctions={activeAuctions}
                        me={me}
                        teams={teams}
                        teamInfo={teamInfo}
                        matchweekCount={matchweekCount}
                        socket={socket}
                        onOpenPlayerHistory={(player) =>
                          socket.emit("requestPlayerHistory", {
                            playerId: player.playerId,
                          })
                        }
                      />
                    )}

                    {activeTab === "scout" && (
                      <PlayerSearchView
                        me={me}
                        players={players}
                        myBudget={currentBudget}
                        matchweekCount={matchweekCount}
                        season={season}
                        playerSearchData={playerSearchData}
                        playerSearchLoading={playerSearchLoading}
                        setPlayerSearchLoading={setPlayerSearchLoading}
                        setTransferProposalModal={setTransferProposalModal}
                        setGameDialog={setGameDialog}
                        buyPlayer={buyPlayer}
                        openAuctionBid={openAuctionBid}
                        onOpenPlayerHistory={(player) =>
                          socket.emit("requestPlayerHistory", {
                            playerId: player.id,
                          })
                        }
                      />
                    )}

                    {activeTab === "user_settings" && (
                      <UserSettingsPage
                        me={me}
                        teamInfo={teamInfo}
                        palmares={palmares}
                        backendUrl={backendUrl}
                        avatarSeed={avatarSeed}
                        coachAvatars={coachAvatars}
                        setCoachAvatars={setCoachAvatars}
                        onAvatarSeedChange={setAvatarSeed}
                        onBack={() => navigateTab("club")}
                        onLogout={handleLogout}
                        onLeaveRoom={() => {
                          if (me?.roomCode) {
                            socket.emit("leaveRoom");
                            try {
                              const s = JSON.parse(
                                window.localStorage.getItem(
                                  "cashballSession",
                                ) || "{}",
                              );
                              window.localStorage.setItem(
                                "cashballSession",
                                JSON.stringify({
                                  name: s.name,
                                  token: s.token,
                                  roomCode: "",
                                }),
                              );
                            } catch {
                              /* ignorar */
                            }
                          }
                          resetGameState();
                          setMe(null);
                          setAuthPhase("mode");
                        }}
                      />
                    )}    </>
  );
}
