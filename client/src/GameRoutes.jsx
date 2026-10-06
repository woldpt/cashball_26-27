import { socket } from "./socket.js";
import { useGame } from "./contexts/GameContext.jsx";
import { LiveView } from "./components/live/index.js";
import { StandingsTab } from "./views/StandingsTab.jsx";
import { BracketTab } from "./views/BracketTab.jsx";
import { CalendarioTab } from "./views/CalendarioTab.jsx";
import { ClubTab } from "./views/ClubTab.jsx";
import { JournalTab } from "./views/JournalTab.jsx";
import { FinancesTab } from "./views/FinancesTab.jsx";
import { StadiumTab } from "./views/StadiumTab.jsx";
import { MySquadTab } from "./views/MySquadTab.jsx";
import { OtherSquadsTab } from "./views/OtherSquadsTab.jsx";
import { TrainingTab } from "./views/TrainingTab.jsx";
import { TacticsView } from "./views/TacticsView.jsx";
import { TransferHub } from "./components/ui/TransferHub.jsx";
import { AuctionsTab } from "./views/AuctionsTab.jsx";
import { ScoutView } from "./views/ScoutView.jsx";
import { UserSettingsPage } from "./pages/UserSettingsPage.jsx";
import { useStaffState } from "./hooks/useStaffState.js";
import { DIVISION_NAMES } from "./constants/index.js";
import { isSameTeamId } from "./utils/teamHelpers.js";

/**
 * GameRoutes — resolve qual a view ativa a renderizar. Consome useGame()
 * sozinho (sem props além de auth). Separado do GameLayout para o ficheiro
 * de chrome não agregar o switch de páginas.
 */
export function GameRoutes({ handleLogout, setAuthPhase }) {
  const {
    // active tab + helpers de navegação usados aqui
    activeTab,
    // match ao vivo / simulação
    allMatchResults,
    matchweekCount,
    calendarIndex,
    currentJornada,
    standingsStale,
    // equipas / plantel
    teams,
    teamInfo,
    teamForms,
    players,
    mySquad,
    annotatedSquad,
    me,
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
    // calendário
    calendarData,
    nextMatchSummary,
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
    showOwnMarketPlayers,
    setShowOwnMarketPlayers,
    buyPlayer,
    listPlayerAuction,
    removeFromTransferList,
    openAuctionBid,
    activeAuctions,
    highlightedAuctionId,
    playerSearchData,
    playerSearchLoading,
    setPlayerSearchLoading,
    nextPlayerSearchId,
    selectedTeam,
    selectedTeamSquad,
    selectedTeamLoading,
    handleOpenTeamSquad,
    handleCloseTeamSquad,
    refreshCalendar,
    navigateTab,
    resetGameState,
    leaveToMenu,
    // avatares
    avatarSeed,
    setAvatarSeed,
    coachAvatars,
    coachAvatarSeeds,
    setCoachAvatars,
    backendUrl,
    // dialog
    setGameDialog,
    setTransferProposalModal,
  } = useGame();

  // Equipa técnica (funcionários): estado do meu clube, partilhado pelo
  // Clube (contratação) e pelo Treino (menção ao auxiliar). Vive aqui, e não
  // dentro das views, para o Clube ser um componente puro (é o que os
  // harnesses de layout renderizam).
  const {
    staff,
    pending: staffPending,
    hire: hireStaff,
    fire: fireStaff,
  } = useStaffState();

  return (
    <>
                    {activeTab === "live" && <LiveView />}

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
                        teamForms={teamForms}
                        navigateTab={navigateTab}
                        cupWeekFriendly={nextMatchSummary?.cupWeekFriendly ?? null}
                        onSignupCupFriendly={(round, done) =>
                          socket.emit("signupCupWeekFriendly", { round }, (res) => {
                            done?.(res);
                            if (!res?.ok) return;
                            socket.emit("requestCalendar");
                            socket.emit("requestNextMatchSummary", { teamId: me?.teamId });
                          })
                        }
                      />
                    )}
                    {activeTab === "club" && (
                      <ClubTab
                        teamInfo={teamInfo}
                        seasonYear={seasonYear}
                        me={me}
                        currentBudget={currentBudget}
                        totalWeeklyWage={totalWeeklyWage}
                        loanAmount={loanAmount}
                        palmaresTeamId={palmaresTeamId}
                        palmares={palmares}
                        clubNews={clubNews}
                        staff={staff}
                        staffPending={staffPending}
                        onHireStaff={hireStaff}
                        onFireStaff={fireStaff}
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
                        onOpenTeamSquad={(team) =>
                          isSameTeamId(team?.id, me?.teamId)
                            ? navigateTab("players")
                            : handleOpenTeamSquad(team)
                        }
                        onOpenPlayerHistory={(player) =>
                          socket.emit("requestPlayerHistory", {
                            playerId: player.id,
                          })
                        }
                        onOpenCupBracket={() => {
                          navigateTab("bracket");
                          socket.emit("requestCupBracket");
                        }}
                      />
                    )}

                    {activeTab === "finances" && (
                      <FinancesTab
                        financeData={financeData}
                        totalWeeklyWage={totalWeeklyWage}
                        completedJornada={completedJornada}
                        elapsedWeeks={calendarIndex ?? 0}
                        loanInterestPerWeek={loanInterestPerWeek}
                        loanAmount={loanAmount}
                        currentBudget={currentBudget}
                        seasonYear={seasonYear}
                        capacityRevPerGame={capacityRevPerGame}
                        mySquad={mySquad}
                        staff={staff}
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
                      <MySquadTab
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
                      <OtherSquadsTab
                        selectedTeam={selectedTeam}
                        selectedTeamSquad={selectedTeamSquad}
                        selectedTeamLoading={selectedTeamLoading}
                        me={me}
                        avatarSeed={avatarSeed}
                        coachAvatars={coachAvatars}
                        coachAvatarSeeds={coachAvatarSeeds}
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
                        teamForms={teamForms}
                        onBack={handleCloseTeamSquad}
                        onOpenTeamSquad={handleOpenTeamSquad}
                        onOpenPlayerHistory={(player) =>
                          socket.emit("requestPlayerHistory", {
                            playerId: player.id,
                          })
                        }
                        onRequestCalendar={refreshCalendar}
                      />
                    )}

                    {activeTab === "training" && (
                      <TrainingTab
                        me={me}
                        matchweek={currentJornada}
                        staff={staff}
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
                        showOwnMarketPlayers={showOwnMarketPlayers}
                        setShowOwnMarketPlayers={setShowOwnMarketPlayers}
                        isSameTeamId={isSameTeamId}
                        buyPlayer={buyPlayer}
                        listPlayerAuction={listPlayerAuction}
                        removeFromTransferList={removeFromTransferList}
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
                      <AuctionsTab
                        activeAuctions={activeAuctions}
                        highlightAuctionId={highlightedAuctionId}
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
                      <ScoutView
                        me={me}
                        players={players}
                        myBudget={currentBudget}
                        matchweekCount={matchweekCount}
                        playerSearchData={playerSearchData}
                        playerSearchLoading={playerSearchLoading}
                        setPlayerSearchLoading={setPlayerSearchLoading}
                        nextPlayerSearchId={nextPlayerSearchId}
                        setTransferProposalModal={setTransferProposalModal}
                        setGameDialog={setGameDialog}
                        buyPlayer={buyPlayer}
                        openAuctionBid={openAuctionBid}
                        activeAuctions={activeAuctions}
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
                          resetGameState();
                          leaveToMenu();
                          setAuthPhase("mode");
                        }}
                      />
                    )}    </>
  );
}
