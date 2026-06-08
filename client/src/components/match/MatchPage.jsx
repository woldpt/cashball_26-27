import { useMemo } from "react";
import { MatchView, IntervencaoView } from "./MatchTabs.jsx";
import { useTactics } from "../../contexts/TacticsContext.jsx";
import { generateLeagueFixtures } from "../../utils/fixtures.js";
import { DIVISION_NAMES } from "../../constants/index.js";

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
	sidebarCollapsed,
	matchResults,
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

	// When a server-driven match action is active, selections go straight to
	// setSwapSource/setSwapTarget (the server resolves the swap).
	// During normal halftime the UI handlers manage the swap lifecycle.
	const effectiveSelectOut = matchAction
		? (player) => setSwapSource(player)
		: (playerId) => handleSelectOut(playerId);
	const effectiveSelectIn = matchAction
		? (player) => setSwapTarget(player)
		: (playerId) => handleSelectIn(playerId);

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
			const realFixtures = matchResults?.results?.filter(
				(r) => divTeamIds.has(r.homeTeamId),
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
		return matchResults.results.filter(
			(r) =>
				Number(r.homeTeamId) !== Number(myTeamId) &&
				Number(r.awayTeamId) !== Number(myTeamId),
		);
	}, [isCupMatch, matchResults, myTeamId]);

	// ── Fixture Card (compact) ──────────────────────────────────────────────
	const FixtureCard = ({ homeTeamId, awayTeamId, fixtureData }) => {
		const home = teams.find((t) => t.id === homeTeamId);
		const away = teams.find((t) => t.id === awayTeamId);
		const hAccent = home?.color_primary || "#6366f1";
		const aAccent = away?.color_primary || "#6366f1";
		const hasResult = fixtureData?.finalHomeGoals != null;
		return (
			<div className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-outline-variant/25 bg-surface-container-low/60 hover:bg-surface-container/50 transition-colors">
				<span className="w-2 h-2 rounded-full shrink-0 shadow-sm" style={{ background: hAccent, boxShadow: `0 0 6px ${hAccent}60` }} />
				<span className="flex-1 text-[10px] font-bold text-on-surface-variant truncate">{home?.name || "—"}</span>
				{hasResult ? (
					<div className="flex items-center gap-1 shrink-0">
						<span className="text-[11px] font-black tabular-nums text-on-surface min-w-[1.2em] text-right">{fixtureData.finalHomeGoals}</span>
						<span className="text-[8px] font-black text-on-surface-variant/60">—</span>
						<span className="text-[11px] font-black tabular-nums text-on-surface min-w-[1.2em] text-left">{fixtureData.finalAwayGoals}</span>
					</div>
				) : (
					<span className="text-[8px] font-black text-on-surface-variant/60 shrink-0 mx-1">vs</span>
				)}
				<span className="flex-1 text-[10px] font-bold text-on-surface-variant truncate text-right">{away?.name || "—"}</span>
				<span className="w-2 h-2 rounded-full shrink-0 shadow-sm" style={{ background: aAccent, boxShadow: `0 0 6px ${aAccent}60` }} />
			</div>
		);
	};

	// ── Helpers ──────────────────────────────────────────────────────────
	const getTeamName = (teamId) => teams.find((t) => t.id === teamId)?.name || "—";
	const homeTeam = teams.find((t) => t.id === fixture?.homeTeamId);
	const awayTeam = teams.find((t) => t.id === fixture?.awayTeamId);
	const hColor = homeTeam?.color_primary || "#6366f1";
	const aColor = awayTeam?.color_primary || "#f43f5e";
	const isCupContext = isCupMatch || cupPreMatch;
	const canContinue = !isCupContext || myTeamInCup;
	const sidebarLeft = sidebarCollapsed ? "lg:left-14" : "lg:left-64";

	// ── Mode-based rendering ──────────────────────────────────────────────
	const isIntervencao = mode === "halftime" || mode === "action";

	if (!fixture && !isIntervencao) {
		return (
			<div className={`fixed inset-y-0 left-0 right-0 ${sidebarLeft} z-120 flex flex-col bg-[#0d0d14]`}>
				<div className="flex-1 flex items-center justify-center">
					<p className="text-sm font-bold text-on-surface-variant">Sem dados do jogo disponíveis</p>
				</div>
			</div>
		);
	}

	return (
		<div className={`fixed inset-y-0 left-0 right-0 ${sidebarLeft} z-120 flex flex-col bg-[linear-gradient(180deg,#0d0d14_0%,#11111b_100%)]`}>
			{/* Header */}
			<div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-outline/40 bg-surface-container-high backdrop-blur-sm">
				<button onClick={onClose} className="w-8 h-8 rounded-xl bg-surface-container-high/80 hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-all border border-outline/40 hover:border-outline">←</button>
				<div className="flex-1 flex items-center gap-2 min-w-0">
					<span className="w-1.5 h-8 rounded-full shrink-0 shadow-sm" style={{ background: hColor, boxShadow: `0 0 8px ${hColor}60` }} />
					<span className="text-sm font-black text-on-surface truncate">
						{getTeamName(fixture?.homeTeamId)} vs {getTeamName(fixture?.awayTeamId)}
					</span>
					<span className="w-1.5 h-8 rounded-full shrink-0 shadow-sm" style={{ background: aColor, boxShadow: `0 0 8px ${aColor}60` }} />
					{isCupMatch && (
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

			{/* ── Halftime score banner ──────────────────────────────────── */}
			{mode === "halftime" && fixture && (
				<div className="shrink-0 flex items-stretch border-b border-outline/40 bg-surface-container-high backdrop-blur-sm">
					<div className="flex-1 text-center py-2 px-3 font-black text-[11px] uppercase truncate flex items-center justify-center gap-1.5" style={{ backgroundColor: hColor + "20", color: hColor }}>
						<span className="w-2 h-2 rounded-full shrink-0" style={{ background: hColor, boxShadow: `0 0 6px ${hColor}60` }} />
						{homeTeam?.name || "Casa"}
					</div>
					<div className="flex items-center justify-center gap-3 px-6 bg-surface-container-low text-on-surface font-black text-xl tracking-widest">
						<span className="tabular-nums">{fixture.finalHomeGoals ?? 0}</span>
						<span className="text-on-surface-variant/60 text-base">—</span>
						<span className="tabular-nums">{fixture.finalAwayGoals ?? 0}</span>
					</div>
					<div className="flex-1 text-center py-2 px-3 font-black text-[11px] uppercase truncate flex items-center justify-center gap-1.5" style={{ backgroundColor: aColor + "20", color: aColor }}>
						{awayTeam?.name || "Fora"}
						<span className="w-2 h-2 rounded-full shrink-0" style={{ background: aColor, boxShadow: `0 0 6px ${aColor}60` }} />
					</div>
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
					/>
				) : (
					<MatchView
						fixture={fixture}
						liveMinute={liveMinute}
						teams={teams}
						mode={mode}
					/>
				)}

				{/* Sidebar: other games (non-intervention modes) */}
				{!isIntervencao && (
					<div className="shrink-0 border-t border-outline/40 bg-surface-container-high/70 px-3 py-2">
						<h4 className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-1.5">
							{isCupMatch ? `${cupMatchRoundName || "Taça"} · Outros jogos` : `${DIVISION_NAMES[myDivision] || "Liga"} · J${currentJornada || "—"}`}
						</h4>
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
							{isCupMatch
								? cupOtherFixtures.map((r, i) => <FixtureCard key={i} homeTeamId={r.homeTeamId} awayTeamId={r.awayTeamId} fixtureData={r} />)
								: (divisionFixtures[myDivision] || [])
										.filter((f) => f.homeTeamId !== myTeamId && f.awayTeamId !== myTeamId)
										.map((f, i) => <FixtureCard key={i} homeTeamId={f.homeTeamId} awayTeamId={f.awayTeamId} fixtureData={f} />)}
						</div>
					</div>
				)}
			</div>

			{/* ── Footer ── */}
			{mode === "halftime" && (
				<button
					onClick={canContinue ? onReady : undefined}
					disabled={!canContinue || isReady}
					className={`shrink-0 w-full py-3.5 text-sm font-black uppercase tracking-widest transition-all border-t border-outline ${
						!canContinue
							? "bg-surface-container-high text-on-surface-variant cursor-not-allowed"
							: isReady
								? "bg-surface-container-high text-on-surface-variant"
								: cupPreMatch
									? "bg-green-600 hover:bg-green-500 text-surface-container-low"
									: "bg-primary hover:brightness-110 text-on-primary"
					}`}
				>
					{!canContinue
						? "⏳ A AGUARDAR JOGO DA TAÇA..."
						: isReady
							? "⏳ A AGUARDAR OUTRO TREINADOR..."
							: cupPreMatch
								? "▶ INICIAR JOGO — TAÇA"
								: isCupMatch
									? "▶ 2ª PARTE — TAÇA"
									: "▶ INICIAR 2ª PARTE"}
				</button>
			)}
			{mode === "action" && matchAction?.type === "user_substitution" && (
				<button onClick={() => onResolveAction(null)} className="shrink-0 w-full py-3.5 text-sm font-black uppercase tracking-widest bg-primary hover:brightness-110 text-on-primary transition-all border-t border-outline">
					▶ CONTINUAR
				</button>
			)}
			{mode === "detail" && (
				<button onClick={onClose} className="shrink-0 w-full py-3 text-sm font-black uppercase tracking-widest bg-surface-container hover:bg-surface-container-high text-on-surface-variant transition-all border-t border-outline">
					Fechar
				</button>
			)}
		</div>
	);
}