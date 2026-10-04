import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { queueEmit } from "./socket.js";
import { useGame } from "./contexts/GameContext.jsx";
import { cupFlowLog } from "./utils/cupFlowLog.js";
import { computePostMatchFlow } from "./utils/postMatchFlow.js";
import { TransferProposalModal } from "./components/modals/TransferProposalModal.jsx";
import { SigningCelebrationModal } from "./components/modals/SigningCelebrationModal.jsx";
import { GameDialog } from "./components/shared/GameDialog.jsx";
import { GoalFlashOverlay } from "./components/match/shared/GoalFlashOverlay.jsx";
import { InviteRoomModal } from "./components/modals/InviteRoomModal.jsx";
import { PenaltySuspensePopup } from "./components/modals/PenaltySuspensePopup.jsx";
import { PenaltyTakerPopup } from "./components/modals/PenaltyTakerPopup.jsx";
import { CupDrawPopup } from "./components/modals/CupDrawPopup.jsx";
import { PenaltyShootoutPopup } from "./components/modals/PenaltyShootoutPopup.jsx";
import { WaitingCoachesModal } from "./components/modals/WaitingCoachesModal.jsx";
import { DismissalModal } from "./components/modals/DismissalModal.jsx";
import { CoachMarketModal } from "./components/modals/CoachMarketModal.jsx";
import { SeasonEndModal } from "./components/modals/SeasonEndModal.jsx";
import { PlayerHistoryModal } from "./components/modals/PlayerHistoryModal.jsx";
import { MatchPage } from "./components/match/MatchPage.jsx";
import { RoomHub } from "./components/chat/RoomHub.jsx";
import { RoomSettings } from "./components/room/RoomSettings.jsx";
import { AdminPanel } from "./components/admin/AdminPanel.jsx";

/**
 * GameOverlays — monta todos os overlays do jogo (modais de evento, ecrã de
 * jogo ao vivo, chat/room, admin). Consome useGame() sozinho. Separado do
 * GameLayout para o chrome não agregar a orquestração dos modais nem a
 * sequenciação pós-jogo (postMatchFlow).
 */
export function GameOverlays() {
  const {
    activeTab,
    adminPanelOpen,
    backendUrl,
    buyPlayer,
    coachAvatars,
    coachAvatarSeeds,
    coachMarketReport,
    cupDraw,
    cupDrawRevealIdx,
    cupMatchRoundName,
    currentCupRound,
    cupPenaltyKickIdx,
    cupPenaltyPopup,
    cupPreMatch,
    cupRoundResults,
    currentJornada,
    dismissalModal,
    gameDialog,
    // Festejo de golo do meu jogo — global, não preso ao tab Jogo (abaixo).
    goalFlashRef,
    handleCloseMatch,
    handleHalftimeReady,
    handleResolveMatchAction,
    injuredHalftimeIds,
    injuryCountdown,
    isCupExtraTime,
    isCupMatch,
    isPlayingMatch,
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
    redCardedHalftimeIds,
    removeFromTransferList,
    renewPlayerContract,
    respondContractRequest,
    roomCreator,
    roomSettingsOpen,
    simSpeed,
    season,
    seasonEndModal,
    setAdminPanelOpen,
    setCoachMarketReport,
    setCupDrawRevealIdx,
    setCupPenaltyKickIdx,
    setCupPenaltyPopup,
    setDismissalModal,
    setGameDialog,
    setPlayerHistoryModal,
    setRoomSettingsOpen,
    setSeasonEndModal,
    setShowCupDrawPopup,
    setSigningCelebration,
    setTransferProposalModal,
    showCupDrawPopup,
    showHalftimePanel,
    signingCelebration,
    teamInfo,
    teams,
    transferProposalModal,
    waitingForResults,
    resultsWaitTimedOut,
  } = useGame();

  // A espera multiplayer quer mostrar-se ao intervalo (pronto, sala com
  // 2+ coaches); a fila disciplina-a: suprimida enquanto houver passo
  // pós-jogo pendente (ver postMatchFlow.showWaiting).
  const halftimeWaitingWantsShow =
    panelMode === "halftime" &&
    panelIsReady &&
    lockedCoaches &&
    lockedCoaches.length >= 2;
  const postMatchFlow = computePostMatchFlow({
    seasonEndModal,
    cupPenaltyPopup,
    cupDrawPending: showCupDrawPopup && !!cupDraw,
    dismissalModal,
    waitingWantsShow: halftimeWaitingWantsShow,
  });
  // O sorteio espera pela fila (penáltis primeiro); o raw continua a
  // bloquear o landing via anyPostMatchModal até ser fechado.
  const showCupDrawPopupGated =
    postMatchFlow.showCupDraw && showCupDrawPopup;

  // Faixa global de espera (visível em qualquer tab): prolongamento da Taça
  // à espera de Prontos (gate sem timeout) ou resultados a tardar fora do
  // tab Jogo (o aviso do MatchPage só lá aparece). Só ET real (90'): o
  // intervalo normal é aos 45' e não mostra nada.
  const etGateWait = (() => {
    if (!showHalftimePanel || !isCupMatch || liveMinute < 90) return null;
    const drawn = new Set(
      (matchResults?.results || [])
        .filter((r) => r.finalHomeGoals === r.finalAwayGoals)
        .flatMap((r) => [String(r.homeTeamId), String(r.awayTeamId)]),
    );
    if (drawn.size === 0) return null;
    const missing = (players || []).filter(
      (p) => p.teamId != null && drawn.has(String(p.teamId)) && !p.ready,
    );
    if (missing.length === 0) return null;
    const names = missing.map((p) => `${p.name}${p.socketId ? "" : " (ausente)"}`);
    return `⏳ Prolongamento — à espera de: ${names.join(", ")}`;
  })();
  const showGlobalWaitBanner =
    etGateWait != null ||
    (waitingForResults && resultsWaitTimedOut && activeTab !== "live");

  // Landing pós-jogo: quando a partida TERMINOU (Liga ou Taça) e TODOS os
  // modais pós-jogo estão concluídos, regressar ao Jornal (tab landing).
  // Dispara uma vez por partida (chave jornada/ronda) — o utilizador pode
  // voltar ao tab "Jogar" para ver o jogo final sem ser devolvido.
  // Duas guardas contra o disparo antecipado (o matchResults já existe no
  // pontapé de saída e ao intervalo): (1) `hadMatchInProgressRef` garante
  // que houve mesmo jogo a decorrer nesta sessão; (2) o jogo tem de estar
  // parado no minuto final (sem intervalo, ação ou pausa pendente).
  // Chave do último jogo terminado (latch): a Taça/amigável chega via
  // cupRoundResults, mas o efeito de limpeza desliga isCupMatch no commit
  // seguinte — derivar a chave de isCupMatch perdia a aterragem sempre que o
  // direto do cliente ainda não tinha terminado (sistemático no amigável).
  // Agarra-se à chegada, só com jogo visto (hadMatch), e cada chegada
  // sobrescreve: rondas seguintes continuam a aterrar. Liga: o mesmo estado
  // é reutilizado no direto, por isso só agarra com mom (só o final traz).
  const [latchedEndedKey, setLatchedEndedKey] = useState(null);
  const endedMatchKey = latchedEndedKey;
  const postMatchLandedKeyRef = useRef(null);
  const hadMatchInProgressRef = useRef(false);
  useEffect(() => {
    if (cupRoundResults && hadMatchInProgressRef.current) {
      setLatchedEndedKey(
        `cup:${cupRoundResults.season}:${cupRoundResults.round}`,
      );
    }
  }, [cupRoundResults]);
  useEffect(() => {
    const leagueFinal =
      matchResults?.matchweek &&
      (matchResults.results || []).some((r) => r.mom != null);
    if (leagueFinal && hadMatchInProgressRef.current) {
      setLatchedEndedKey(`league:${season}:${matchResults.matchweek}`);
    }
  }, [matchResults, season]);
  const matchFinished =
    !isPlayingMatch &&
    !showHalftimePanel &&
    !matchAction &&
    !isMatchActionPending &&
    liveMinute >= 90;
  // Qualquer modal que possa surgir no pós-jogo bloqueia o landing — não
  // só a sequência central (postMatchFlow) mas também agentes/contratos
  // (gameDialog), mercado de treinadores, propostas, celebrações e o
  // sorteio da Taça. O humor pós-jogo, os avisos da direção e os convites
  // vivem na caixa de entrada (Jornal, o próprio tab de aterragem), por
  // isso não bloqueiam. Os estados brutos (não os `show*` faseados)
  // garantem que o landing espera pela fila inteira, não só pelo modal
  // visível.
  const anyPostMatchModal =
    cupPenaltyPopup ||
    dismissalModal ||
    seasonEndModal ||
    postMatchFlow.showWaiting ||
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
    // Apito final: 2 s de narração de fim de jogo antes do landing — o
    // carimbo e a frase aparecem no mesmo commit do fim, e o salto
    // imediato não deixava vê-los. O latch fica no callback (re-runs
    // durante a espera rearmam; só um timer vivo — modais bloqueiam,
    // sair do tab cancela).
    const t = setTimeout(() => {
      cupFlowLog("landing pós-jogo → Jornal", { key: endedMatchKey });
      postMatchLandedKeyRef.current = endedMatchKey;
      hadMatchInProgressRef.current = false;
      navigateTab("jornal");
    }, 2000);
    return () => clearTimeout(t);
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
      {showGlobalWaitBanner && (
        <div className="fixed top-0 inset-x-0 z-40 flex justify-center pointer-events-none px-3 pt-2">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-amber-500/40 bg-zinc-950/90 px-4 py-1.5 shadow-xl backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            <span className="text-[11px] font-bold text-amber-200">
              {etGateWait ?? "⏳ À espera do servidor…"}
            </span>
          </div>
        </div>
      )}
      {/* ── Festejo de golo do MEU jogo, montado no topo da app ──────────
       * Vive aqui, e não dentro do `LiveMatchHero`, porque o som de golo
       * nasce no GameContext (global) enquanto o herói só existe no tab
       * "Jogo": um golo marcado com o utilizador noutro tab (Plantel,
       * Mercado, Classificações...) tocava o som e falhava a festa. O
       * overlay renderiza `null` sem momento — custo zero quando ocioso.
       */}
      {myMatch && (
        <GoalFlashOverlay
          goalFlashRef={goalFlashRef}
          homeId={myMatch.homeTeamId}
          awayId={myMatch.awayTeamId}
          homeIsMine={myMatch.homeTeamId === me?.teamId}
          awayIsMine={myMatch.awayTeamId === me?.teamId}
        />
      )}

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
        showCupDrawPopup={showCupDrawPopupGated}
        cupDraw={cupDraw}
        cupDrawRevealIdx={cupDrawRevealIdx}
        me={me}
        players={players}
        setShowCupDrawPopup={setShowCupDrawPopup}
        setCupDrawRevealIdx={setCupDrawRevealIdx}
      />

      {/* Chave por eliminatória (F4): um 2.º shootout da mesma ronda
          remonta limpo em vez de herdar a revelação do anterior. */}
      <PenaltyShootoutPopup
        key={
          cupPenaltyPopup
            ? `pen-${cupPenaltyPopup.round}:${cupPenaltyPopup.homeTeamId}-${cupPenaltyPopup.awayTeamId}`
            : "pen-none"
        }
        cupPenaltyPopup={cupPenaltyPopup}
        cupPenaltyKickIdx={cupPenaltyKickIdx}
        teams={teams}
        setCupPenaltyPopup={setCupPenaltyPopup}
        setCupPenaltyKickIdx={setCupPenaltyKickIdx}
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
            currentCupRound={currentCupRound}
            currentJornada={currentJornada}
            isPlayingMatch={isPlayingMatch}
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
      {/* Espectadores da Taça (sem fixture nesta ronda → !myMatch) não têm
          Pronto que dar ao intervalo; permitir cancelar só fabricaria estados. */}
      <WaitingCoachesModal
        players={players}
        visible={postMatchFlow.showWaiting}
        onCancel={() => queueEmit("setReady", false)}
        canCancel={!(isCupMatch && !myMatch)}
      />

      <DismissalModal
        dismissalModal={postMatchFlow.showDismissal ? dismissalModal : null}
        onContinue={() => {
          queueEmit("confirmDismissalClub");
          setDismissalModal(null);
        }}
        onSwap={(teamId) => queueEmit("swapDismissalClub", teamId)}
      />


      <CoachMarketModal
        report={coachMarketReport}
        onClose={() => setCoachMarketReport(null)}
        meName={me?.name ?? null}
        coachAvatars={coachAvatars}
        coachAvatarSeeds={coachAvatarSeeds}
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
        respondContractRequest={respondContractRequest}
        listPlayerAuction={listPlayerAuction}
        listPlayerFixed={listPlayerFixed}
        removeFromTransferList={removeFromTransferList}
        buyPlayer={buyPlayer}
        openAuctionBid={openAuctionBid}
        myBudget={teamInfo?.budget ?? 0}
        setGameDialog={setGameDialog}
      />

      <RoomHub />

      <AdminPanel
        open={adminPanelOpen}
        onClose={() => setAdminPanelOpen(false)}
      />

      <RoomSettings
        open={roomSettingsOpen}
        onClose={() => setRoomSettingsOpen(false)}
        me={me}
        roomCreator={roomCreator}
        simSpeed={simSpeed}
      />
    </>
  );
}
