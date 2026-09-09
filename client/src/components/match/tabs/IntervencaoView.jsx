import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MAX_MATCH_SUBS } from "../../../constants/index.js";
import {
  sortPlayersByPos,
  buildPositionRows,
  filterMatchEvents,
  buildPlayerMatchStats,
} from "../matchConstants.js";
import { GhostButton, MatchIcon } from "../shared/index.js";
import { TeamCrest } from "../../live/TeamCrest.jsx";
import {
  useCompactViewport,
  useLandscapePhone,
} from "../../../hooks/useIsMobile.js";
import { SubsPanel } from "./intervencao/SubsPanel.jsx";
import { usePrefersReducedMotion } from "./intervencao/subsSelection.js";
import {
  AdversarioPanel,
  CronologiaPanel,
} from "./intervencao/Panels.jsx";

/* ── IntervencaoView — substitutions + chronology + opponent ─────────────
 * Simplified layout:
 *   [Descrição do ecrã]            [Scoreboard]   [Anular todas]
 *   [Tab Cronologia] [Tab Substituições] [Tab Adversário]
 *   (Subs)  Titulares | Suplentes | [Mentalidade | Substituições]
 *   [Iniciar/Continuar]  ← full-width button em MatchPage (mantido)
 * ──────────────────────────────────────────────────────────────────────── */
export function IntervencaoView({
  mode,
  fixture,
  liveMinute,
  teams,
  myTeamId,
  isCupMatch,
  isCupExtraTime,
  matchAction,
  injuryCountdown,
  tactic,
  onUpdateTactic,
  annotatedSquad,
  subbedOut,
  confirmedSubs,
  subsMade,
  swapSource,
  swapTarget,
  onSelectOut,
  onSelectIn,
  onConfirmSub,
  onResetSub,
  onResetAllSubs,
  redCardedHalftimeIds,
  injuredHalftimeIds,
  onResolveAction,
  isUserSubPause = false,
  pauseInitialIdx = null,
}) {
  const [centerTab, setCenterTab] = useState("subs");
  const [confirmResetAll, setConfirmResetAll] = useState(false);

  // Two-tap arm for "Anular todas" auto-disarms after 3s so a stale armed
  // state can't surprise the user later.
  useEffect(() => {
    if (!confirmResetAll) return;
    const timer = setTimeout(() => setConfirmResetAll(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmResetAll]);

  // Declarada cedo (antes do hook abaixo) para evitar TDZ no array de deps.
  const isHalftime = mode === "halftime";

  // Compacto = mobile vertical OU ecrã baixo: telemóvel em horizontal tem
  // largura de desktop mas só ~375px de altura (a grid desktop cortaria).
  const compact = useCompactViewport();
  // Banda landscape phone → compressão extra; o vertical não muda.
  const shortLandscape = useLandscapePhone();

  // Mobile halftime: the top zone alternates between the score and the phase
  // title, fading over every 5 seconds.
  const [phaseIsScore, setPhaseIsScore] = useState(true);
  useEffect(() => {
    if (!isHalftime) return;
    const timer = setInterval(() => setPhaseIsScore((v) => !v), 5000);
    return () => clearInterval(timer);
  }, [isHalftime]);

  const reducedMotion = usePrefersReducedMotion();

  /* ── Mode booleans ────────────────────────────────────────────── */
  const isPreExtraTime =
    isHalftime && isCupMatch && (liveMinute ?? 0) >= 90 && !isCupExtraTime;
  const actionType = matchAction?.type || null;
  const isEmergencyGk = actionType === "emergency_gk";
  const isForcedSwap =
    isEmergencyGk || actionType === "injury" || actionType === "gk_red_card";
  const isGkRedCard = actionType === "gk_red_card";
  const isActionSub = actionType === "user_substitution";

  const selectedOutId =
    typeof swapSource === "object" && swapSource !== null
      ? swapSource.id
      : swapSource;
  const selectedInId =
    typeof swapTarget === "object" && swapTarget !== null
      ? swapTarget.id
      : swapTarget;

  const forceOutPlayer =
    matchAction?.injuredPlayer ||
    matchAction?.sentOffPlayer ||
    matchAction?.dismissedPlayer ||
    null;

  /* ── Team info ────────────────────────────────────────────────── */
  const isHome =
    myTeamId != null && Number(fixture?.homeTeamId) === Number(myTeamId);
  const isMyFixture =
    myTeamId != null &&
    (Number(fixture?.homeTeamId) === Number(myTeamId) ||
      Number(fixture?.awayTeamId) === Number(myTeamId));
  const hInfo = teams?.find((t) => t.id === fixture?.homeTeamId);
  const aInfo = teams?.find((t) => t.id === fixture?.awayTeamId);

  // O plantel base vem da BD e mantém a skill permanente. Durante o jogo,
  // sobrepõe-se a fadiga transitória do fixture para a decisão do intervalo
  // comparar titulares cansados com suplentes frescos sem persistir estado
  // de jogo no plantel.
  const liveOwnLineup = isHome ? fixture?.homeLineup : fixture?.awayLineup;
  const liveOwnById = useMemo(
    () =>
      new Map(
        (liveOwnLineup || []).map((player) => [Number(player.id), player]),
      ),
    [liveOwnLineup],
  );
  const panelSquad = useMemo(
    () =>
      isHalftime && isMyFixture
        ? annotatedSquad.map((player) => {
            const livePlayer = liveOwnById.get(Number(player.id));
            if (!livePlayer) return player;
            return {
              ...player,
              skill: livePlayer.skill ?? player.skill,
              matchMinutes: livePlayer.matchMinutes ?? 0,
              fatigueLoss: livePlayer.fatigueLoss ?? 0,
            };
          })
        : annotatedSquad,
    [isHalftime, isMyFixture, annotatedSquad, liveOwnById],
  );

  /* ── Our squad ────────────────────────────────────────────────── */
  const useTacticSquad = isHalftime || isUserSubPause;
  const onPitchPlayers = useMemo(
    () =>
      useTacticSquad
        ? sortPlayersByPos(
            panelSquad.filter(
              (p) =>
                tactic?.positions?.[p.id] === "Titular" &&
                !subbedOut.includes(p.id) &&
                !redCardedHalftimeIds.has(p.id) &&
                !injuredHalftimeIds?.has(p.id),
            ),
          )
        : isActionSub
          ? sortPlayersByPos(matchAction?.onPitch || [])
          : isGkRedCard
            ? sortPlayersByPos(matchAction?.onPitch || [])
            : isEmergencyGk
              ? sortPlayersByPos(matchAction?.onPitch || [])
              : forceOutPlayer
                ? [forceOutPlayer]
                : [],
    [
      useTacticSquad,
      panelSquad,
      tactic,
      subbedOut,
      redCardedHalftimeIds,
      injuredHalftimeIds,
      isActionSub,
      isGkRedCard,
      isEmergencyGk,
      matchAction,
      forceOutPlayer,
    ],
  );

  const benchPlayers = useMemo(
    () =>
      useTacticSquad
        ? sortPlayersByPos(
            panelSquad
              .filter((p) => tactic?.positions?.[p.id] === "Suplente")
              // Quem já saiu em campo nesta pausa (ou antes) não volta a constar
              // no banco — re-entrada é impossível (também garantida no servidor).
              // No intervalo mantém-se visível (desativado) para referência.
              .filter((p) => !isUserSubPause || !subbedOut.includes(p.id))
              .filter((p) => !injuredHalftimeIds?.has(p.id)),
          )
        : sortPlayersByPos(matchAction?.benchPlayers || []),
    [
      useTacticSquad,
      panelSquad,
      tactic,
      isUserSubPause,
      subbedOut,
      injuredHalftimeIds,
      matchAction,
    ],
  );

  const playerById = useCallback(
    (id) =>
      panelSquad.find((p) => p.id === id) ||
      onPitchPlayers.find((p) => p.id === id) ||
      benchPlayers.find((p) => p.id === id) ||
      null,
    [panelSquad, onPitchPlayers, benchPlayers],
  );

  const effectiveOutId = isGkRedCard
    ? selectedOutId
    : selectedOutId ||
      (isForcedSwap && !isEmergencyGk ? forceOutPlayer?.id : null);
  const targetPlayer = playerById(selectedInId);
  const sourcePlayer = playerById(effectiveOutId);
  // GR improvisado: escolha única (quem vai para a baliza) — sem par Sai/Entra.
  const limitReached = subsMade >= MAX_MATCH_SUBS;
  const canConfirmSwap = isEmergencyGk
    ? !!selectedInId && !isHalftime
    : !!effectiveOutId &&
      !!selectedInId &&
      (!isHalftime && !isUserSubPause ? true : !limitReached);

  // During a forced swap the opponent/chronology tabs are noise — lock the
  // view on subs while the auto-substitution countdown runs.
  const activeCenterTab = isForcedSwap ? "subs" : centerTab;

  // Reason the confirm button is disabled — surfaced next to the button
  // instead of leaving the user guessing (was: silent disabled state).
  const confirmHint = canConfirmSwap
    ? null
    : isEmergencyGk
      ? "Escolhe quem vai para a baliza."
      : !effectiveOutId
        ? "Escolhe o jogador que sai."
        : !selectedInId
          ? "Escolhe o jogador que entra."
          : limitReached
            ? "Limite de substituições atingido."
            : null;

  /* ── Dados do adversário ──────────────────────────────────────── */
  // Verificação estrita: arrays vazios ([] são truthy) não contam como escalação.
  const oppData = useMemo(() => {
    const hasLineups =
      !!fixture?.homeLineup?.length && !!fixture?.awayLineup?.length;
    const oppLineup =
      (isHome ? fixture?.awayLineup : fixture?.homeLineup) || [];
    // Defesa: expulsos adversários não podem constar da escalação exibida
    // (o snapshot do servidor pode estar stale em jogos a decorrer).
    const oppRedCardedIds = new Set(
      (fixture?.events || [])
        .filter(
          (e) =>
            e.type === "red" &&
            e.team === (isHome ? "away" : "home") &&
            e.playerId != null,
        )
        .map((e) => Number(e.playerId)),
    );
    const oppLineupFiltered = oppLineup.filter(
      (p) => !oppRedCardedIds.has(Number(p.id)),
    );
    const oppStarters = sortPlayersByPos(
      oppLineupFiltered.filter((p) => p.is_starter === true).slice(0, 11),
    );
    const oppBench = sortPlayersByPos(
      oppLineupFiltered.filter((p) => p.is_starter === false),
    );
    return {
      hasLineups,
      oppStarters,
      oppBench,
      oppRows: buildPositionRows(oppStarters),
      oppInfo: isHome ? aInfo : hInfo,
    };
  }, [fixture, isHome, aInfo, hInfo]);
  const { hasLineups, oppBench, oppRows, oppInfo } = oppData;

  /* ── Cronologia ───────────────────────────────────────────────── */
  const evts = useMemo(() => fixture?.events || [], [fixture]);
  const weatherEvent = useMemo(
    () => evts.find((e) => e.type === "weather"),
    [evts],
  );
  const visibleEvts = useMemo(
    () => filterMatchEvents(evts, liveMinute),
    [evts, liveMinute],
  );
  const playerMatchStats = useMemo(
    () => buildPlayerMatchStats(evts, liveMinute),
    [evts, liveMinute],
  );
  const referee = fixture.referee;

  /* ── Action title ─────────────────────────────────────────────── */
  const titleText = isPreExtraTime
    ? "Pausa antes do prolongamento"
    : isHalftime
      ? "Gestão da Equipa"
      : isEmergencyGk
        ? "Sem GR — quem vai para a baliza?"
        : isForcedSwap
          ? `Substituição obrigatória · ${forceOutPlayer?.name || "jogador"}`
          : "Pausa para substituição";

  const actionTheme = isForcedSwap
    ? "from-red-700/20 via-orange-500/10 to-transparent"
    : isActionSub
      ? "from-cyan-500/20 via-blue-500/10 to-transparent"
      : "from-emerald-500/15 via-primary/10 to-transparent";

  /* ── Handlers ──────────────────────────────────────────────────── */
  const handlePickOut = useCallback(
    (player) => {
      if (!player) return;
      onSelectOut(isHalftime ? player.id : player);
    },
    [onSelectOut, isHalftime],
  );
  const handlePickIn = useCallback(
    (player) => {
      if (!player) return;
      onSelectIn(isHalftime ? player.id : player);
    },
    [onSelectIn, isHalftime],
  );

  // "Anular todas" em dois toques: o primeiro arma, o segundo confirma.
  // Partilhado pelo botão desktop e pelo ícone compacto do mobile junto ao
  // contador SUBS.
  const handleArmResetAll = useCallback(() => {
    if (confirmResetAll) {
      onResetAllSubs();
      setConfirmResetAll(false);
    } else {
      setConfirmResetAll(true);
    }
  }, [confirmResetAll, onResetAllSubs]);

  /* ── Tabs ──────────────────────────────────────────────────────── */
  const tabs = [
    { key: "cronologia", label: "Cronologia" },
    { key: "subs", label: "Substituições" },
    { key: "adversario", label: "Adversário" },
  ];

  /* ── Render ────────────────────────────────────────────────────── */
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex flex-col flex-1 min-h-0 overflow-hidden bg-surface-container-low isolate"
      style={{
        background: `radial-gradient(ellipse 70% 40% at 50% 0%, ${hInfo?.color_primary || "#333"}12 0%, transparent 70%), var(--color-surface-container-low)`,
      }}
    >
      {/* ── Halftime mobile: intermitência score ↔ título da fase + posse 2px ──
       * Substitui (só no mobile) a barra de score do MatchPage e o bloco de
       * posse de bola; desvanecimento de 5s entre os dois estados. */}
      {isHalftime && hInfo?.name && aInfo?.name && (
        <div className={`${compact ? "" : "hidden"} shrink-0 border-b border-outline-variant/25 bg-surface-container-high`}>
          <div className="relative h-10 overflow-hidden">
            {/* Score — versão compacta do banner de intervalo do MatchPage. */}
            <motion.div
              initial={false}
              animate={{ opacity: phaseIsScore ? 1 : 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.6, ease: "easeInOut" }}
              className="absolute inset-0 flex items-stretch"
              aria-hidden={!phaseIsScore}
            >
              <div
                className="flex min-w-0 flex-1 items-center justify-end gap-1.5 px-3 text-[10px] font-black uppercase tracking-wide"
                style={{ backgroundColor: `${hInfo.color_primary || "#6366f1"}20`, color: hInfo.color_primary || "#6366f1" }}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: hInfo.color_primary || "#6366f1", boxShadow: `0 0 6px ${hInfo.color_primary || "#6366f1"}60` }} />
                <span className="truncate">{hInfo.name}</span>
              </div>
              <div className="flex items-center gap-2 bg-surface-container-low px-3 font-black text-base tracking-widest text-on-surface">
                <span className="tabular-nums">{fixture?.finalHomeGoals ?? 0}</span>
                <span className="text-sm text-on-surface-variant/60">–</span>
                <span className="tabular-nums">{fixture?.finalAwayGoals ?? 0}</span>
              </div>
              <div
                className="flex min-w-0 flex-1 items-center justify-start gap-1.5 px-3 text-[10px] font-black uppercase tracking-wide"
                style={{ backgroundColor: `${aInfo.color_primary || "#f43f5e"}20`, color: aInfo.color_primary || "#f43f5e" }}
              >
                <span className="truncate">{aInfo.name}</span>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: aInfo.color_primary || "#f43f5e", boxShadow: `0 0 6px ${aInfo.color_primary || "#f43f5e"}60` }} />
              </div>
            </motion.div>
            {/* Título da fase — alterna com o score. */}
            <motion.div
              initial={false}
              animate={{ opacity: phaseIsScore ? 0 : 1 }}
              transition={{ duration: reducedMotion ? 0 : 0.6, ease: "easeInOut" }}
              className="absolute inset-0 flex items-center justify-center"
              aria-hidden={phaseIsScore}
            >
              <span className="text-sm font-black uppercase tracking-[0.25em] text-on-surface">
                {isPreExtraTime ? "Prolongamento" : "Intervalo"}
              </span>
            </motion.div>
          </div>
          {/* Posse de bola em linha de 2px (substitui o bloco no mobile). */}
          {fixture?.homePossession != null && (
            <div className="flex h-0.5 w-full" aria-hidden="true">
              <div
                style={{
                  width: `${fixture.homePossession}%`,
                  background: hInfo.color_primary || "#6366f1",
                  borderRight: "1px solid rgba(255,255,255,0.5)",
                }}
              />
              <div className="flex-1" style={{ background: aInfo.color_primary || "#f43f5e" }} />
            </div>
          )}
        </div>
      )}

      {/* Title bar — description on the left, reset far right. No mobile de
       * intervalo fica oculta (o banner intermitente acima ocupa o lugar). */}
      <div
        className={`${isHalftime && compact ? "hidden" : "flex"} shrink-0 px-4 sm:px-5 py-3 sm:py-4 border-b border-outline-variant/20 bg-gradient-to-r ${actionTheme} items-center justify-between gap-2 sm:gap-4`}
      >
        <div className="min-w-0 flex-1">
          {/* No truncate: a forced-swap title must never cut the player's name. */}
          <h2 className="text-base font-bold font-headline tracking-tight text-on-surface uppercase text-left leading-snug">
            {titleText}
          </h2>
          {/* Lesão do último GR com reposição sem GR no banco: o substituto que
           * entra calça as luvas — aviso em destaque antes de confirmar. */}
          {matchAction?.incomingBecomesGK && !isEmergencyGk && (
            <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-amber-300/90">
              <span aria-hidden="true">🧤</span>
              O substituto vai para a baliza — GR improvisado
            </p>
          )}
        </div>

        {/* Two-tap confirm: destructive action wipes all planned subs. */}
        {isHalftime && confirmedSubs.length > 0 && (
          <GhostButton
            onClick={handleArmResetAll}
            icon={
              <MatchIcon
                name="reset"
                className="h-3.5 w-3.5 text-rose-400/80"
              />
            }
            className="text-rose-400/80 hover:text-rose-300 hover:bg-rose-500/10 shrink-0"
          >
            {confirmResetAll ? "Confirmar?" : "Anular todas"}
          </GhostButton>
        )}
      </div>

      {/* ── Main tab row: Cronologia | Substituições | Adversário ── */}
      {/* Hidden during forced swaps — the other tabs are noise while the
       * auto-substitution countdown runs. */}
      {!isForcedSwap && (
        <div className={`shrink-0 ${shortLandscape ? "px-4 py-1" : "px-4 py-2"} bg-surface-container-high/50 border-b border-outline-variant/15`}>
          <div className="flex rounded-md bg-surface-container p-1.5 gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setCenterTab(tab.key)}
                className={`flex-1 min-w-0 ${shortLandscape ? "py-1.5" : "py-2.5"} text-xs font-bold uppercase tracking-widest rounded-md transition-all ${
                  activeCenterTab === tab.key
                    ? "bg-surface-container-high text-on-surface shadow-sm shadow-black/20"
                    : "text-on-surface-variant/70 hover:text-on-surface-variant hover:bg-surface-container-high/50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Active panel ─────────────────────────────────────────── */}
      <AnimatePresence mode="wait" initial={false}>
        {activeCenterTab === "cronologia" ? (
          <motion.div
            key="cronologia"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex flex-col flex-1 min-h-0 overflow-hidden"
          >
            <CronologiaPanel
              visibleEvts={visibleEvts}
              fixture={fixture}
              hInfo={hInfo}
              aInfo={aInfo}
              referee={referee}
              weatherEvent={weatherEvent}
            />
          </motion.div>
        ) : activeCenterTab === "adversario" ? (
          <motion.div
            key="adversario"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex flex-col flex-1 min-h-0 overflow-hidden"
          >
            <AdversarioPanel
              hasLineups={hasLineups}
              oppInfo={oppInfo}
              oppRows={oppRows}
              oppBench={oppBench}
            />
          </motion.div>
        ) : (
          <motion.div
            key="subs"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex flex-col flex-1 min-h-0 overflow-hidden"
          >
            <SubsPanel
              isHalftime={isHalftime}
              isUserSubPause={isUserSubPause}
              pauseInitialIdx={pauseInitialIdx}
              isForcedSwap={isForcedSwap}
              isGkRedCard={isGkRedCard}
              isEmergencyGk={isEmergencyGk}
              confirmedSubs={confirmedSubs}
              tactic={tactic}
              onUpdateTactic={onUpdateTactic}
              playerMatchStats={playerMatchStats}
              onPitchPlayers={onPitchPlayers}
              benchPlayers={benchPlayers}
              effectiveOutId={effectiveOutId}
              selectedInId={selectedInId}
              sourcePlayer={sourcePlayer}
              targetPlayer={targetPlayer}
              handlePickOut={handlePickOut}
              handlePickIn={handlePickIn}
              forceOutPlayer={forceOutPlayer}
              subbedOut={subbedOut}
              subsMade={subsMade}
              injuryCountdown={injuryCountdown}
              confirmHint={confirmHint}
              canConfirmSwap={canConfirmSwap}
              onResetSub={onResetSub}
              onConfirmSub={onConfirmSub}
              onResolveAction={onResolveAction}
              confirmResetAll={confirmResetAll}
              onArmResetAll={handleArmResetAll}
              summary={{ fixture, hInfo, aInfo, liveMinute }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
