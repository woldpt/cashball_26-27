import { useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { socket } from "./socket.js";
import { useGame } from "./contexts/GameContext.jsx";
import { computePostMatchFlow } from "./utils/postMatchFlow.js";
import { TransferProposalModal } from "./components/modals/TransferProposalModal.jsx";
import { SigningCelebrationModal } from "./components/modals/SigningCelebrationModal.jsx";
import { PostMatchMoodModal } from "./components/modals/PostMatchMoodModal.jsx";
import { GameDialog } from "./components/shared/GameDialog.jsx";
import { InviteRoomModal } from "./components/modals/InviteRoomModal.jsx";
import { PenaltySuspensePopup } from "./components/modals/PenaltySuspensePopup.jsx";
import { PenaltyTakerPopup } from "./components/modals/PenaltyTakerPopup.jsx";
import { CupDrawPopup } from "./components/modals/CupDrawPopup.jsx";
import { PenaltyShootoutPopup } from "./components/modals/PenaltyShootoutPopup.jsx";
import { BoardWarningModal } from "./components/modals/BoardWarningModal.jsx";
import { WaitingCoachesModal } from "./components/modals/WaitingCoachesModal.jsx";
import { DismissalModal } from "./components/modals/DismissalModal.jsx";
import { JobOfferModal } from "./components/modals/JobOfferModal.jsx";
import { CoachMarketModal } from "./components/modals/CoachMarketModal.jsx";
import { SeasonEndModal } from "./components/modals/SeasonEndModal.jsx";
import { PlayerHistoryModal } from "./components/modals/PlayerHistoryModal.jsx";
import { MatchPage } from "./components/match/MatchPage.jsx";
import { RoomHub } from "./components/chat/RoomHub.jsx";
import { AdminPanel } from "./components/admin/AdminPanel.jsx";

/**
 * GameOverlays — monta todos os overlays do jogo (modais de evento, ecrã de
 * jogo ao vivo, chat/room, admin). Consome useGame() sozinho. Separado do
 * GameLayout para o chrome não agregar a orquestração dos modais nem a
 * sequenciação pós-jogo (postMatchFlow).
 */
export function GameOverlays() {
  const {
    activeChatTabRef,
    activeTab,
    addToast,
    adminPanelOpen,
    avatarSeed,
    awaitingCoaches,
    backendUrl,
    boardWarning,
    buyPlayer,
    chatInput,
    chatMessagesRef,
    chatOpenRef,
    coachAvatars,
    coachMarketReport,
    cupDraw,
    cupDrawRevealIdx,
    cupMatchRoundName,
    cupPenaltyKickIdx,
    cupPenaltyPopup,
    cupPreMatch,
    cupRoundResults,
    currentJornada,
    dismissalModal,
    gameDialog,
    globalMessages,
    globalPlayers,
    handleCloseMatch,
    handleHalftimeReady,
    handleResolveMatchAction,
    injuredHalftimeIds,
    injuryCountdown,
    isCupExtraTime,
    isCupMatch,
    isPlayingMatch,
    jobOfferModal,
    isMatchActionPending,
    listPlayerAuction,
    listPlayerFixed,
    liveMinute,
    lockedCoaches,
    matchAction,
    matchResults,
    matchweekCount,
    me,
    myMatch,
    navigateTab,
    myTeamInCup,
    openAuctionBid,
    panelFixture,
    panelIsReady,
    panelMode,
    penaltySuspense,
    playerHistoryModal,
    players,
    postMatchMood,
    redCardedHalftimeIds,
    removeFromTransferList,
    renewPlayerContract,
    roomCreator,
    roomHubOpen,
    roomHubRef,
    roomMessages,
    season,
    seasonEndModal,
    setAdminPanelOpen,
    setBoardWarning,
    setChatInput,
    setCoachMarketReport,
    setCupDrawRevealIdx,
    setCupPenaltyKickIdx,
    setCupPenaltyPopup,
    setDismissalModal,
    setGameDialog,
    setJobOfferModal,
    setPlayerHistoryModal,
    setPostMatchMood,
    setRoomHubOpen,
    setSeasonEndModal,
    setShowCupDrawPopup,
    setSigningCelebration,
    setTransferProposalModal,
    showCupDrawPopup,
    showHalftimePanel,
    sidebarCollapsed,
    signingCelebration,
    teamInfo,
    teams,
    transferProposalModal,
    unreadGlobal,
    unreadRoom,
  } = useGame();

  const postMatchFlow = computePostMatchFlow({
    seasonEndModal,
    cupPenaltyPopup,
    postMatchMood,
    boardWarning,
    dismissalModal,
    jobOfferModal,
  });

  // Landing pós-jogo: quando a partida TERMINOU (Liga ou Taça) e TODOS os
  // modais pós-jogo estão concluídos, regressar ao Jornal (tab landing).
  // Dispara uma vez por partida (chave jornada/ronda) — o utilizador pode
  // voltar ao tab "Jogar" para ver o jogo final sem ser devolvido.
  // Duas guardas contra o disparo antecipado (o matchResults já existe no
  // pontapé de saída e ao intervalo): (1) `hadMatchInProgressRef` garante
  // que houve mesmo jogo a decorrer nesta sessão; (2) o jogo tem de estar
  // parado no minuto final (sem intervalo, ação ou pausa pendente).
  const endedMatchKey = isCupMatch && cupRoundResults
    ? `cup:${cupRoundResults.season}:${cupRoundResults.round}`
    : matchResults?.matchweek
      ? `league:${season}:${matchResults.matchweek}`
      : null;
  const postMatchLandedKeyRef = useRef(null);
  const hadMatchInProgressRef = useRef(false);
  const matchFinished =
    !isPlayingMatch &&
    !showHalftimePanel &&
    !matchAction &&
    !isMatchActionPending &&
    liveMinute >= 90;
  // Qualquer modal que possa surgir no pós-jogo bloqueia o landing — não
  // só a sequência central (postMatchFlow) mas também agentes/contratos
  // (gameDialog), mercado de treinadores, propostas, celebrações e o
  // sorteio da Taça. Os estados brutos (não os `show*` faseados) garantem
  // que o landing espera pela fila inteira, não só pelo modal visível.
  const anyPostMatchModal =
    postMatchMood ||
    cupPenaltyPopup ||
    boardWarning ||
    dismissalModal ||
    jobOfferModal ||
    seasonEndModal ||
    gameDialog ||
    coachMarketReport ||
    transferProposalModal ||
    signingCelebration ||
    showCupDrawPopup ||
    penaltySuspense ||
    playerHistoryModal;
  useEffect(() => {
    if (isPlayingMatch || showHalftimePanel || matchAction) {
      hadMatchInProgressRef.current = true;
      return;
    }
    if (!hadMatchInProgressRef.current) return;
    if (!matchFinished) return;
    if (!endedMatchKey) return;
    if (postMatchLandedKeyRef.current === endedMatchKey) return;
    if (anyPostMatchModal) return;
    if (activeTab !== "live") return;
    postMatchLandedKeyRef.current = endedMatchKey;
    hadMatchInProgressRef.current = false;
    navigateTab("jornal");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    endedMatchKey,
    anyPostMatchModal,
    activeTab,
    isPlayingMatch,
    showHalftimePanel,
    matchAction,
    matchFinished,
  ]);

  return (
    <>


      <TransferProposalModal
        transferProposalModal={transferProposalModal}
        setTransferProposalModal={setTransferProposalModal}
      />

      <SigningCelebrationModal
        signing={signingCelebration}
        onClose={() => setSigningCelebration(null)}
        teams={teams}
        me={me}
      />

      <PostMatchMoodModal
        mood={postMatchFlow.showMood ? postMatchMood : null}
        onClose={() => setPostMatchMood(null)}
      />

      <GameDialog dialog={gameDialog} onClose={() => setGameDialog(null)} />
      <InviteRoomModal />

      <PenaltySuspensePopup penaltySuspense={penaltySuspense} />

      <PenaltyTakerPopup
        key={matchAction?.actionId ?? "none"}
        matchAction={matchAction}
        teams={teams}
        onResolveAction={handleResolveMatchAction}
      />

      <CupDrawPopup
        showCupDrawPopup={showCupDrawPopup}
        cupDraw={cupDraw}
        cupDrawRevealIdx={cupDrawRevealIdx}
        me={me}
        players={players}
        setShowCupDrawPopup={setShowCupDrawPopup}
        setCupDrawRevealIdx={setCupDrawRevealIdx}
      />

      <PenaltyShootoutPopup
        cupPenaltyPopup={cupPenaltyPopup}
        cupPenaltyKickIdx={cupPenaltyKickIdx}
        teams={teams}
        setCupPenaltyPopup={setCupPenaltyPopup}
        setCupPenaltyKickIdx={setCupPenaltyKickIdx}
      />

      <BoardWarningModal
        boardWarning={postMatchFlow.showBoardWarning ? boardWarning : null}
        onClose={() => setBoardWarning(null)}
      />

      {/* MatchPage — AnimatePresence mode="wait": abrir/fechar/trocar modo
          (prematch → halftime) faz exit+entrance suave. */}
      <AnimatePresence mode="wait">
        {panelMode !== null && (
          <MatchPage
            key={panelMode}
            mode={panelMode}
            onClose={handleCloseMatch}
            fixture={panelFixture}
            liveMinute={liveMinute}
            teams={teams}
            isCupMatch={isCupMatch}
            cupMatchRoundName={cupMatchRoundName}
            currentJornada={currentJornada}
            isPlayingMatch={isPlayingMatch}
            sidebarCollapsed={sidebarCollapsed}
            onReady={handleHalftimeReady}
            isReady={panelIsReady}
            cupPreMatch={cupPreMatch}
            myTeamInCup={myTeamInCup}
            myTeamId={me?.teamId}
            redCardedHalftimeIds={redCardedHalftimeIds}
            injuredHalftimeIds={injuredHalftimeIds}
            matchAction={matchAction}
            injuryCountdown={injuryCountdown}
            onResolveAction={handleResolveMatchAction}
            matchResults={matchResults}
            isCupExtraTime={isCupExtraTime}
            cupRoundResults={cupRoundResults}
          />
        )}
      </AnimatePresence>

      {/* Modal de espera multiplayer no intervalo */}
      {/* Espectadores da Taça (sem fixture nesta ronda → !myMatch) são auto-ready
          ao intervalo; permitir cancelar bloquearia o jogo sem razão. */}
      <WaitingCoachesModal
        players={players}
        visible={
          panelMode === "halftime" &&
          panelIsReady &&
          lockedCoaches &&
          lockedCoaches.length >= 2
        }
        onCancel={() => socket.emit("setReady", false)}
        canCancel={!(isCupMatch && !myMatch)}
      />

      <DismissalModal
        dismissalModal={postMatchFlow.showDismissal ? dismissalModal : null}
        onContinue={() => setDismissalModal(null)}
      />


      <JobOfferModal
        jobOfferModal={postMatchFlow.showJobOffer ? jobOfferModal : null}
        setJobOfferModal={setJobOfferModal}
      />

      <CoachMarketModal
        report={coachMarketReport}
        onClose={() => setCoachMarketReport(null)}
        meName={me?.name ?? null}
        coachAvatars={coachAvatars}
        backendUrl={backendUrl}
      />

      <SeasonEndModal
        data={postMatchFlow.showSeasonEnd ? seasonEndModal : null}
        teams={teams}
        me={me}
        onClose={() => setSeasonEndModal(null)}
      />

      <PlayerHistoryModal
        playerHistoryModal={playerHistoryModal}
        setPlayerHistoryModal={setPlayerHistoryModal}
        myTeamId={me?.teamId}
        matchweekCount={matchweekCount}
        season={season}
        isPlayingMatch={isPlayingMatch}
        showHalftimePanel={showHalftimePanel}
        renewPlayerContract={renewPlayerContract}
        listPlayerAuction={listPlayerAuction}
        listPlayerFixed={listPlayerFixed}
        removeFromTransferList={removeFromTransferList}
        buyPlayer={buyPlayer}
        openAuctionBid={openAuctionBid}
        myBudget={teamInfo?.budget ?? 0}
        setGameDialog={setGameDialog}
      />

      <RoomHub
        me={me}
        roomHubRef={roomHubRef}
        roomHubOpen={roomHubOpen}
        setRoomHubOpen={setRoomHubOpen}
        roomMessages={roomMessages}
        globalMessages={globalMessages}
        globalPlayers={globalPlayers}
        players={players}
        teams={teams}
        roomCreator={roomCreator}
        matchweekCount={matchweekCount}
        unreadRoom={unreadRoom}
        unreadGlobal={unreadGlobal}
        chatInput={chatInput}
        setChatInput={setChatInput}
        avatarSeed={avatarSeed}
        coachAvatars={coachAvatars}
        backendUrl={backendUrl}
        chatMessagesRef={chatMessagesRef}
        addToast={addToast}
        awaitingCoaches={awaitingCoaches}
        chatOpenRef={chatOpenRef}
        activeChatTabRef={activeChatTabRef}
      />

      <AdminPanel
        open={adminPanelOpen}
        onClose={() => setAdminPanelOpen(false)}
      />
    </>
  );
}
