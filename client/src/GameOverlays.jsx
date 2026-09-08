import { useState } from "react";
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
import { CupUpsetModal } from "./components/modals/CupUpsetModal.jsx";
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
 * sequenciação pós-jogo (cupUpsetAckKey + postMatchFlow).
 */
export function GameOverlays() {
  const {
    activeChatTabRef,
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
    listPlayerAuction,
    listPlayerFixed,
    liveMinute,
    lockedCoaches,
    matchAction,
    matchResults,
    matchweekCount,
    me,
    myMatch,
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

  // `cupUpsetAckKey` recorda a última ronda da Taça cuja celebração de surpresas
  // o utilizador fechou, para o sequenciador saber quando o cup upset já não
  // bloqueia os avisos/fim de época.
  const [cupUpsetAckKey, setCupUpsetAckKey] = useState(null);
  const currentCupRoundKey = cupRoundResults
    ? `${cupRoundResults.season}:${cupRoundResults.round}`
    : null;
  const cupUpsetPending =
    !!currentCupRoundKey &&
    (cupRoundResults?.upsets?.length ?? 0) > 0 &&
    currentCupRoundKey !== cupUpsetAckKey;
  const postMatchFlow = computePostMatchFlow({
    seasonEndModal,
    cupPenaltyPopup,
    postMatchMood,
    boardWarning,
    dismissalModal,
    jobOfferModal,
    cupUpsetPending,
  });

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

      <CupUpsetModal
        cupRoundResults={postMatchFlow.showCupRoundResults ? cupRoundResults : null}
        teams={teams}
        postMatchMood={postMatchMood}
        onDismiss={(roundKey) => {
          if (roundKey != null) setCupUpsetAckKey(roundKey);
        }}
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
