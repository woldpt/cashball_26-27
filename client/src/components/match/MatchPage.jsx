/* eslint-disable react-hooks/set-state-in-effect -- snapshot inicial da fila de subs no arranque da pausa */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { takeover } from "../../motion.js";
import { MatchView, IntervencaoView } from "./MatchTabs.jsx";
import { useTactics } from "../../contexts/TacticsContext.jsx";
import { socket } from "../../socket.js";
import { useGame } from "../../contexts/GameContext.jsx";
import { generateLeagueFixtures } from "../../utils/fixtures.js";
import { DIVISION_NAMES } from "../../constants/index.js";
import { isFriendlyMatch } from "../live/liveHelpers.js";
import {
	useLandscapePhone,
} from "../../hooks/useIsMobile.js";

/**
 * Painel flutuante de jogo (ao vivo, intervalo, acção, detalhe).
 *
 * Routing simplificado:
 *   - modo normal (live/detail) → MatchView (2 colunas: narrativa + pitch)
 *   - modo halftime/action     → IntervencaoView (subs + cronologia + adversário)
 */
export function MatchPage({
	mode,
	onClose,
	fixture,
	liveMinute,
	teams,
	isCupMatch,
	cupMatchRoundName,
	currentJornada,
	isPlayingMatch,
	onReady,
	isReady,
	cupPreMatch,
	myTeamInCup,
	myTeamId,
	redCardedHalftimeIds,
	injuredHalftimeIds,
	matchAction,
	injuryCountdown,
	onResolveAction,
	matchResults,
	isCupExtraTime,
	cupRoundResults,
	currentCupRound,
}) {
	// ── Tactic state & handlers from context ─────────────────────────────────
	const {
		tactic,
		updateTactic,
		annotatedSquad,
		subbedOut,
		confirmedSubs,
		subsMade,
		swapSource,
		swapTarget,
		setSwapSource,
		setSwapTarget,
		handleSelectOut,
		handleSelectIn,
		handleConfirmSub,
		handleResetSub,
		handleResetAllSubs,
	} = useTactics();

	const { waitingForResults, resultsWaitTimedOut } = useGame();

	// MOM do jogo: o fixture da liga já traz `mom` no payload final
	// (matchResults); na Taça o fixture (matchResults simplificado) não traz,
	// por isso procurar no payload da ronda (cupRoundResults.results).
	const momOverride = useMemo(() => {
		if (fixture?.mom) return fixture.mom;
		if (!isCupMatch || !fixture || !cupRoundResults?.results) return null;
		const row = cupRoundResults.results.find(
			(r) =>
				Number(r.homeTeamId) === Number(fixture.homeTeamId) &&
				Number(r.awayTeamId) === Number(fixture.awayTeamId),
		);
		return row?.mom || null;
	}, [fixture, isCupMatch, cupRoundResults]);
	// Banda landscape phone → header menos alto para dar espaço ao conteúdo.
	const shortLandscape = useLandscapePhone();

	// Pausa de substituição a meio do jogo (user_substitution): o botão
	// Substituir só acumula na fila local (handleConfirmSub), o jogo só avança
	// em "Continuar" que envia o lote todo de uma vez. Outras ações (injury,
	// gk_red_card, emergency_gk) continuam a resolver imediatamente.
	const isUserSubPause = matchAction?.type === "user_substitution";
	const [pauseInitialIdx, setPauseInitialIdx] = useState(null);
	useEffect(() => {
		if (isUserSubPause) {
			if (pauseInitialIdx === null) {
				setPauseInitialIdx(confirmedSubs.length);
			}
		} else if (pauseInitialIdx !== null) {
			setPauseInitialIdx(null);
		}
	}, [isUserSubPause, confirmedSubs.length, pauseInitialIdx]);

	const effectiveSelectOut = isUserSubPause
		? (player) => {
				const id = typeof player === "object" && player !== null ? player.id : player;
				handleSelectOut(id);
			}
		: matchAction
			? (player) => setSwapSource(player)
			: (playerId) => handleSelectOut(playerId);
	const effectiveSelectIn = isUserSubPause
		? (player) => {
				const id = typeof player === "object" && player !== null ? player.id : player;
				handleSelectIn(id);
			}
		: matchAction
			? (player) => setSwapTarget(player)
			: (playerId) => handleSelectIn(playerId);

	const handlePauseContinue = () => {
		const start = pauseInitialIdx ?? confirmedSubs.length;
		const delta = confirmedSubs.slice(start);
		if (delta.length === 0) {
			onResolveAction(null);
			return;
		}
		const batch = delta.map((s) => ({ playerOut: s.out, playerIn: s.in }));
		onResolveAction(batch);
	};

	// ── Multi-league fixture data ────────────────────────────────────────────
	const { myDivision, divisionFixtures } = useMemo(() => {
		const myTeam = teams.find((t) => t.id === myTeamId);
		const myDiv = myTeam?.division;

		const byDiv = {};
		teams.forEach((t) => {
			if (!byDiv[t.division]) byDiv[t.division] = [];
			byDiv[t.division].push(t);
		});
		Object.values(byDiv).forEach((arr) => arr.sort((a, b) => a.id - b.id));

		const wk = currentJornada || 1;
		const fixtures = {};
		Object.entries(byDiv).forEach(([div, divTeams]) => {
			const divTeamIds = new Set(divTeams.map((t) => t.id));
			const realFixtures = matchResults?.results?.filter((r) =>
				divTeamIds.has(r.homeTeamId),
			);
			if (realFixtures && realFixtures.length > 0) {
				fixtures[div] = realFixtures;
			} else {
				const seedIds = divTeams.map((t) => t.id);
				fixtures[div] = generateLeagueFixtures(seedIds, wk);
			}
		});

		return {
			myDivision: myDiv,
			divisionFixtures: fixtures,
		};
	}, [teams, myTeamId, currentJornada, matchResults]);

	// Extract cup fixtures from matchResults for the sidebar when in cup mode
	const cupOtherFixtures = useMemo(() => {
		if (!isCupMatch || !matchResults?.results) return [];
		// Amigável na semana da Taça: só os outros amigáveis, não a eliminatória.
		const friendly = !!fixture?.isFriendly;
		return matchResults.results.filter(
			(r) =>
				!!r.isFriendly === friendly &&
				Number(r.homeTeamId) !== Number(myTeamId) &&
				Number(r.awayTeamId) !== Number(myTeamId),
		);
	}, [isCupMatch, matchResults, myTeamId, fixture]);

	// ── Fixture Card (compact) ──────────────────────────────────────────────
	const FixtureCard = ({ homeTeamId, awayTeamId, fixtureData }) => {
		const home = teams.find((t) => t.id === homeTeamId);
		const away = teams.find((t) => t.id === awayTeamId);
		const hAccent = home?.color_primary || "#6366f1";
		const aAccent = away?.color_primary || "#6366f1";
		const hasResult = fixtureData?.finalHomeGoals != null;
		return (
			<div className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-outline-variant/25 bg-surface-container-low/60 hover:bg-surface-container/50 transition-colors">
				<span
					className="w-2 h-2 rounded-full shrink-0 shadow-sm"
					style={{ background: hAccent, boxShadow: `0 0 6px ${hAccent}60` }}
				/>
				<span className="flex-1 text-[10px] font-bold text-on-surface-variant truncate">
					{home?.name || "—"}
				</span>
				{hasResult ? (
					<div className="flex items-center gap-1 shrink-0">
						<span className="text-[11px] font-black tabular-nums text-on-surface min-w-[1.2em] text-right">
							{fixtureData.finalHomeGoals}
						</span>
						<span className="text-[8px] font-black text-on-surface-variant/60">
							—
						</span>
						<span className="text-[11px] font-black tabular-nums text-on-surface min-w-[1.2em] text-left">
							{fixtureData.finalAwayGoals}
						</span>
					</div>
				) : (
					<span className="text-[8px] font-black text-on-surface-variant/60 shrink-0 mx-1">
						vs
					</span>
				)}
				<span className="flex-1 text-[10px] font-bold text-on-surface-variant truncate text-right">
					{away?.name || "—"}
				</span>
				<span
					className="w-2 h-2 rounded-full shrink-0 shadow-sm"
					style={{ background: aAccent, boxShadow: `0 0 6px ${aAccent}60` }}
				/>
			</div>
		);
	};

	// ── Helpers ──────────────────────────────────────────────────────────
	const getTeamName = (teamId) =>
		teams.find((t) => t.id === teamId)?.name || "—";
	const homeTeam = teams.find((t) => t.id === fixture?.homeTeamId);
	const awayTeam = teams.find((t) => t.id === fixture?.awayTeamId);
	const hColor = homeTeam?.color_primary || "#6366f1";
	const aColor = awayTeam?.color_primary || "#f43f5e";
	const isFriendly =
		isFriendlyMatch(fixture, currentCupRound) || /amigável/i.test(cupMatchRoundName || "");
	const isCupContext = isCupMatch || cupPreMatch;
	// Quem tem de confirmar neste gate: no prolongamento só quem tem jogo
	// EMPATADO (jogos sem humanos seguem sem confirmação). Sem resultados
	// conhecidos falha para o botão — o consentimento nunca fica bloqueado
	// por estado do cliente em falta.
	const isEtGate = isCupMatch && (liveMinute ?? 0) >= 90 && !isCupExtraTime;
	const gateResults = matchResults?.results || [];
	const myDrawnFixture = gateResults.some(
		(fx) =>
			(fx.homeTeamId === myTeamId || fx.awayTeamId === myTeamId) &&
			fx.finalHomeGoals === fx.finalAwayGoals,
	);
	const canContinue =
		!isCupContext || (isEtGate && gateResults.length > 0 ? myDrawnFixture : myTeamInCup);
	// Jogos de clubes terceiros (nenhuma equipa é minha) → esconder badges de fadiga no pitch
	const isThirdPartyMatch =
		!!fixture &&
		Number(fixture.homeTeamId) !== Number(myTeamId) &&
		Number(fixture.awayTeamId) !== Number(myTeamId);
	const { sidebarCollapsed, isMatchInProgress } = useGame();
	// Durante o jogo a sidebar está oculta — o painel ocupa a largura toda.
	const sidebarLeft = isMatchInProgress
		? "lg:left-0"
		: sidebarCollapsed
			? "lg:left-[var(--sidebar-w-collapsed)]"
			: "lg:left-[var(--sidebar-w)]";


	// Botão de retomar o jogo: portal para o slot do header (onde está o JOGAR).
	const ctaSlot = document.getElementById("match-cta-slot");
	const ctaLabel =
		mode === "halftime"
			? !canContinue
				? `⏳ A AGUARDAR ${isFriendly ? "JOGO AMIGÁVEL" : "JOGO DA TAÇA"}...`
				: isReady
					? "⏳ A AGUARDAR OUTRO TREINADOR..."
					: cupPreMatch
						? `▶ INICIAR JOGO — ${isFriendly ? "AMIGÁVEL" : "TAÇA"}`
						: isCupMatch && !isFriendly && (liveMinute ?? 0) >= 90 && !isCupExtraTime
							? "▶ INICIAR PROLONGAMENTO"
							: isCupMatch && !isFriendly
								? "▶ 2ª PARTE — TAÇA"
								: "▶ INICIAR 2ª PARTE"
			: mode === "action" && isUserSubPause
				? `▶ CONTINUAR${(() => { const n = confirmedSubs.length - (pauseInitialIdx ?? confirmedSubs.length); return n > 0 ? ` (${n})` : ""; })()}`
				: null;
	const ctaDisabled = mode === "halftime" && (!canContinue || isReady);

	// ── Mode-based rendering ──────────────────────────────────────────────
	const isIntervencao = mode === "halftime" || mode === "action";

	if (!fixture && !isIntervencao) {
		return (
			<motion.div
				className={`fixed inset-y-0 left-0 right-0 ${sidebarLeft} z-120 flex flex-col bg-[#0d0d14]`}
				initial={takeover.initial}
				animate={takeover.animate}
				exit={takeover.exit}
				transition={takeover.transition}
			>
				<div className="flex-1 flex items-center justify-center">
					<p className="text-sm font-bold text-on-surface-variant">
						Sem dados do jogo disponíveis
					</p>
				</div>
			</motion.div>
		);
	}

	return (
		<motion.div
			className={`fixed inset-y-0 left-0 right-0 ${sidebarLeft} z-120 flex flex-col bg-[linear-gradient(180deg,#0d0d14_0%,#11111b_100%)]`}
			initial={takeover.initial}
			animate={takeover.animate}
			exit={takeover.exit}
			transition={takeover.transition}
			>
			{/* Header */}
			<div className={`shrink-0 flex items-center gap-3 ${shortLandscape ? "px-4 py-1.5" : "px-4 py-3"} border-b border-outline-variant/25 bg-surface-container-high backdrop-blur-sm`}>
				<button
					onClick={onClose}
					className="w-8 h-8 rounded-xl bg-surface-container-high/80 hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-all border border-outline/40 hover:border-outline"
				>
					←
				</button>
				<div className="flex-1 flex items-center gap-2 min-w-0">
					<span
						className="w-1.5 h-8 rounded-full shrink-0 shadow-sm"
						style={{ background: hColor, boxShadow: `0 0 8px ${hColor}60` }}
					/>
					<span className="text-sm font-black text-on-surface truncate">
						{getTeamName(fixture?.homeTeamId)} vs {getTeamName(fixture?.awayTeamId)}
					</span>
					<span
						className="w-1.5 h-8 rounded-full shrink-0 shadow-sm"
						style={{ background: aColor, boxShadow: `0 0 8px ${aColor}60` }}
					/>
					{isCupMatch && !isFriendly && (
						<span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30">
							{cupMatchRoundName || "Taça"}
						</span>
					)}
				</div>
				{isPlayingMatch && (
					<span className="text-[10px] font-black text-primary animate-pulse bg-primary/10 px-2 py-1 rounded-md border border-primary/30">
						{liveMinute}'
					</span>
				)}
			</div>

			{/* ── Aviso de espera pelo servidor ──────────────────────────────
				Aos 90'/120' o relógio local pára e liberta os menus; se os
				resultados tardarem, mostrar em vez de silêncio. */}
			{waitingForResults && resultsWaitTimedOut && !isIntervencao && (
				<div className="shrink-0 mx-4 mt-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 flex items-center gap-3">
					<div className="flex-1 min-w-0">
						<p className="text-xs font-black uppercase tracking-widest text-amber-300">
							⏳ À espera do servidor…
						</p>
						<p className="text-[11px] text-on-surface-variant">
							Se persistir, recarrega a página.
						</p>
					</div>
					<button
						onClick={() => socket.emit("requestResync")}
						className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-black uppercase bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40"
					>
						↻ Tentar de novo
					</button>
				</div>
			)}

			{/* ── Content ────────────────────────────────────────────────── */}
			<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
				{isIntervencao ? (
					<IntervencaoView
						mode={mode}
						fixture={fixture}
						liveMinute={liveMinute}
						teams={teams}
						myTeamId={myTeamId}
						isCupMatch={isCupMatch}
						isFriendly={isFriendly}
						isCupExtraTime={isCupExtraTime}
						matchAction={matchAction}
						injuryCountdown={injuryCountdown}
						tactic={tactic}
						onUpdateTactic={updateTactic}
						annotatedSquad={annotatedSquad}
						subbedOut={subbedOut}
						confirmedSubs={confirmedSubs}
						subsMade={subsMade}
						swapSource={swapSource}
						swapTarget={swapTarget}
						onSelectOut={effectiveSelectOut}
						onSelectIn={effectiveSelectIn}
						onConfirmSub={handleConfirmSub}
						onResetSub={handleResetSub}
						onResetAllSubs={handleResetAllSubs}
						redCardedHalftimeIds={redCardedHalftimeIds}
						injuredHalftimeIds={injuredHalftimeIds}
						onResolveAction={onResolveAction}
						isUserSubPause={isUserSubPause}
						pauseInitialIdx={pauseInitialIdx}
					/>
				) : (
					<MatchView
						fixture={fixture}
						liveMinute={liveMinute}
						teams={teams}
						isCupMatch={isCupMatch}
						cupMatchRoundName={cupMatchRoundName}
						showFatigue={!isThirdPartyMatch}
						spectate={isThirdPartyMatch}
						mom={momOverride}
					/>
				)}

				{/* Sidebar: other games (live mode only, not detail) */}
				{!isIntervencao && mode !== "detail" && (
					<div className="shrink-0 border-t border-outline-variant/25 bg-surface-container-high/70 px-3 py-2">
						<h4 className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-1.5">
							{isCupMatch
								? isFriendly
									? "Amigáveis · Outros jogos"
									: `${cupMatchRoundName || "Taça"} · Outros jogos`
								: `${DIVISION_NAMES[myDivision] || "Liga"} · J${currentJornada || "—"}`}
						</h4>
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
							{isCupMatch
								? cupOtherFixtures.map((r, i) => (
										<FixtureCard
											key={i}
											homeTeamId={r.homeTeamId}
											awayTeamId={r.awayTeamId}
											fixtureData={r}
										/>
									))
								: (divisionFixtures[myDivision] || [])
										.filter((f) => f.homeTeamId !== myTeamId && f.awayTeamId !== myTeamId)
										.map((f, i) => (
											<FixtureCard
												key={i}
												homeTeamId={f.homeTeamId}
												awayTeamId={f.awayTeamId}
												fixtureData={f}
											/>
										))}
						</div>
					</div>
				)}
			</div>

			{/* ── Footer ── (o botão de continuar vive no header: #match-cta-slot) */}
			{ctaLabel &&
				ctaSlot &&
				createPortal(
					<button
						onClick={mode === "halftime" ? onReady : handlePauseContinue}
						disabled={ctaDisabled}
						className={`h-9 px-4 rounded-lg text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${
							ctaDisabled
								? "bg-black/30 text-on-surface-variant cursor-not-allowed"
								: cupPreMatch && mode === "halftime"
									? "bg-green-600 hover:bg-green-500 text-surface-container-low"
									: "bg-primary text-on-primary shadow-lg shadow-black/30 hover:brightness-110"
						}`}
					>
						{ctaLabel}
					</button>,
					ctaSlot,
				)}
			{mode === "detail" && (
				<button
					onClick={onClose}
					className="shrink-0 w-full py-3 text-sm font-black uppercase tracking-widest bg-surface-container hover:bg-surface-container-high text-on-surface-variant transition-all border-t border-outline"
				>
					Fechar
				</button>
			)}
		</motion.div>
	);
}
