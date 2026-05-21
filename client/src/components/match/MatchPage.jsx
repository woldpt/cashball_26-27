import { useState, useMemo } from "react";
import {
	TabJogo,
	TabLineup,
	TabAdversario,
	TabIntervencao,
} from "./MatchTabs.jsx";
import { useTactics } from "../../contexts/TacticsContext.jsx";
import { generateLeagueFixtures } from "../../utils/fixtures.js";
import { DIVISION_NAMES } from "../../constants/index.js";

/**
 * Painel flutuante de jogo (ao vivo, intervalo, acção, detalhe).
 * As props de táctica já NÃO são passadas pelo App.jsx —
 * são consumidas directamente via useTactics().
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
		: handleSelectOut;
	const effectiveSelectIn = matchAction
		? (player) => setSwapTarget(player)
		: handleSelectIn;

	// ── Multi-league fixture data ────────────────────────────────────────────
	const { myDivision, teamsByDivision, divisionFixtures } = useMemo(() => {
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
			const seedIds = divTeams.map((t) => t.id);
			fixtures[div] = generateLeagueFixtures(seedIds, wk);
		});

		return {
			myDivision: myDiv,
			teamsByDivision: byDiv,
			divisionFixtures: fixtures,
		};
	}, [teams, myTeamId, currentJornada]);

	// ── Fixture Card (compacto) ──────────────────────────────────────────────
	const FixtureCard = ({ homeTeamId, awayTeamId }) => {
		const home = teams.find((t) => t.id === homeTeamId);
		const away = teams.find((t) => t.id === awayTeamId);
		const hAccent = home?.color_primary || "#6366f1";
		const aAccent = away?.color_primary || "#6366f1";
		return (
			<div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-800/40 bg-zinc-950/60 hover:bg-zinc-900/50 transition-colors">
				<span
					className="w-2 h-2 rounded-full shrink-0 shadow-sm"
					style={{ background: hAccent, boxShadow: `0 0 6px ${hAccent}60` }}
				/>
				<span className="flex-1 text-[10px] font-bold text-zinc-300 truncate">
					{home?.name || "—"}
				</span>
				<span className="text-[8px] font-black text-zinc-600 shrink-0">vs</span>
				<span className="flex-1 text-[10px] font-bold text-zinc-300 truncate text-right">
					{away?.name || "—"}
				</span>
				<span
					className="w-2 h-2 rounded-full shrink-0 shadow-sm"
					style={{ background: aAccent, boxShadow: `0 0 6px ${aAccent}60` }}
				/>
			</div>
		);
	};

	// ── Tab routing ───────────────────────────────────────────────────────────
	const getDefaultTab = (m) =>
		m === "action" || m === "halftime" ? "intervencao" : "jogo";
	const [activeTab, setActiveTab] = useState(() => getDefaultTab(mode));
	const [prevMode, setPrevMode] = useState(mode);
	if (mode !== prevMode) {
		setPrevMode(mode);
		setActiveTab(getDefaultTab(mode));
	}

	const sidebarLeft = sidebarCollapsed ? "lg:left-14" : "lg:left-64";
	const tabs =
		mode === "detail"
			? [
					{ key: "jogo", label: "Jogo" },
					{ key: "locais", label: "Locais" },
					{ key: "visitantes", label: "Visitantes" },
				]
			: mode === "action"
				? [
						{ key: "jogo", label: "Jogo" },
						{ key: "intervencao", label: "Intervenção" },
					]
				: mode === "halftime"
					? [
							{ key: "jogo", label: "Jogo" },
							{ key: "adversario", label: "Adversário" },
							{ key: "intervencao", label: "Intervenção" },
						]
					: [
							{ key: "jogo", label: "Jogo" },
							{ key: "lineup", label: "Lineup" },
							{ key: "adversario", label: "Adversário" },
							{ key: "intervencao", label: "Intervenção" },
						];

	const isCupContext = isCupMatch || cupPreMatch;
	const canContinue = !isCupContext || myTeamInCup;

	if (!fixture && mode !== "action" && mode !== "halftime") {
		return (
			<div
				className={`fixed inset-y-0 left-0 right-0 ${sidebarLeft} z-120 flex flex-col bg-[#0d0d14]`}
			>
				<div className="flex-1 flex items-center justify-center">
					<p className="text-sm font-bold text-zinc-500">
						Sem dados do jogo disponíveis
					</p>
				</div>
			</div>
		);
	}

	// ── Helpers ──────────────────────────────────────────────────────────
	const getTeamName = (teamId) => teams.find((t) => t.id === teamId)?.name || "—";
	const getTeamColor = (teamId) => teams.find((t) => t.id === teamId)?.color_primary || "#6366f1";
	const homeTeam = teams.find((t) => t.id === fixture?.homeTeamId);
	const awayTeam = teams.find((t) => t.id === fixture?.awayTeamId);
	const hColor = homeTeam?.color_primary || "#6366f1";
	const aColor = awayTeam?.color_primary || "#f43f5e";

	return (
		<div
			className={`fixed inset-y-0 left-0 right-0 ${sidebarLeft} z-120 flex flex-col bg-[linear-gradient(180deg,#0d0d14_0%,#11111b_100%)]`}
		>
			{/* Header */}
			<div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-sm">
				<button
					onClick={onClose}
					className="w-8 h-8 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-400 hover:text-white flex items-center justify-center transition-all border border-zinc-700/50 hover:border-zinc-600/50"
				>
					←
				</button>
				<div className="flex-1 flex items-center gap-2 min-w-0">
					{/* Home team indicator */}
					<span
						className="w-1.5 h-8 rounded-full shrink-0 shadow-sm"
						style={{ background: hColor, boxShadow: `0 0 8px ${hColor}60` }}
					/>
					<span className="text-sm font-black text-white truncate">
						{getTeamName(fixture?.homeTeamId)}
						{" vs "}
						{getTeamName(fixture?.awayTeamId)}
					</span>
					{/* Away team indicator */}
					<span
						className="w-1.5 h-8 rounded-full shrink-0 shadow-sm"
						style={{ background: aColor, boxShadow: `0 0 8px ${aColor}60` }}
					/>
					{isCupMatch && (
						<span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
							{cupMatchRoundName || "Taça"}
						</span>
					)}
				</div>
				{isPlayingMatch && (
					<span className="text-[10px] font-black text-primary animate-pulse bg-primary/10 px-2 py-1 rounded-lg border border-primary/30">
						{liveMinute}'
					</span>
				)}
			</div>

			{/* Tab navigation */}
			<div className="shrink-0 flex w-full border-b border-zinc-800/60 bg-zinc-950/60 backdrop-blur-sm">
				{tabs.map((tab) => {
					const disabled =
						tab.key === "intervencao" &&
						mode !== "action" &&
						mode !== "halftime";
					return (
						<button
							key={tab.key}
							onClick={() => !disabled && setActiveTab(tab.key)}
							disabled={disabled}
							className={`flex-1 min-w-0 py-2.5 px-1 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${
								activeTab === tab.key
									? "text-white border-primary bg-primary/5 shadow-[inset_0_-1px_0_0_#6366f1]"
									: disabled
										? "text-zinc-700 cursor-not-allowed border-transparent"
										: "text-zinc-500 hover:text-zinc-300 border-transparent hover:bg-zinc-800/30"
							}`}
						>
							{tab.label}
						</button>
					);
				})}
			</div>

			{/* Content */}
			<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
				{mode === "halftime" || mode === "action" ? (
					<>
						{activeTab === "jogo" && (
							<TabJogo
								fixture={fixture}
								liveMinute={liveMinute}
								teams={teams}
							/>
						)}
						{activeTab === "locais" && (
							<TabAdversario
								fixture={fixture}
								myTeamId={fixture?.homeTeamId}
								teams={teams}
							/>
						)}
						{activeTab === "visitantes" && (
							<TabAdversario
								fixture={fixture}
								myTeamId={fixture?.awayTeamId}
								teams={teams}
							/>
						)}
						{activeTab === "lineup" && (
							<TabLineup
								fixture={fixture}
								liveMinute={liveMinute}
								teams={teams}
							/>
						)}
						{activeTab === "adversario" && mode !== "detail" && (
							<TabAdversario
								fixture={fixture}
								myTeamId={myTeamId}
								teams={teams}
							/>
						)}
						{activeTab === "intervencao" && mode !== "detail" && (
							<TabIntervencao
								mode={mode}
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
								fixture={fixture}
								teams={teams}
								myTeamId={myTeamId}
							/>
						)}
					</>
				) : (
					/* ── Grid layout: detail / overview mode ───────────────── */
					<div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-3 p-3 min-h-0 overflow-auto">
						{/* ── COL 1-3: Our game ── */}
						<div className="lg:col-span-3 flex flex-col min-h-0 overflow-hidden rounded-lg bg-zinc-950/50 border border-zinc-800/40">
							{activeTab === "jogo" && (
								<TabJogo
									fixture={fixture}
									liveMinute={liveMinute}
									teams={teams}
								/>
							)}
							{activeTab === "locais" && (
								<TabAdversario
									fixture={fixture}
									myTeamId={fixture?.homeTeamId}
									teams={teams}
								/>
							)}
							{activeTab === "visitantes" && (
								<TabAdversario
									fixture={fixture}
									myTeamId={fixture?.awayTeamId}
									teams={teams}
								/>
							)}
							{activeTab === "lineup" && (
								<TabLineup
									fixture={fixture}
									liveMinute={liveMinute}
									teams={teams}
								/>
							)}
							{activeTab === "adversario" && mode !== "detail" && (
								<TabAdversario
									fixture={fixture}
									myTeamId={myTeamId}
									teams={teams}
								/>
							)}
						</div>

						{/* ── COL 4-5 right sidebar: Our league's games ── */}
						<div className="lg:col-span-2 flex flex-col min-h-0 overflow-hidden rounded-lg bg-zinc-950/50 border border-zinc-800/40">
							<div className="shrink-0 px-2.5 py-1.5 border-b border-zinc-800 bg-zinc-950/70">
								<h3 className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
									{DIVISION_NAMES[myDivision] || "Liga"} · J
									{currentJornada || "—"}
								</h3>
							</div>
							<div className="flex-1 overflow-y-auto space-y-1 p-2">
								{(divisionFixtures[myDivision] || []).length === 0 ? (
									<p className="text-zinc-600 text-[10px] font-bold text-center py-4">
										Sem jogos disponíveis
									</p>
								) : (
									(divisionFixtures[myDivision] || [])
										.filter(
											(f) =>
												f.homeTeamId !== myTeamId && f.awayTeamId !== myTeamId,
										)
										.map((f, i) => (
											<FixtureCard
												key={i}
												homeTeamId={f.homeTeamId}
												awayTeamId={f.awayTeamId}
											/>
										))
								)}
							</div>
						</div>

						{/* ── BOTTOM: Other championships ── */}
						<div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
							{Object.keys(teamsByDivision)
								.filter((d) => Number(d) !== myDivision)
								.sort()
								.slice(0, 3)
								.map((div) => (
									<div
										key={div}
										className="flex flex-col min-h-0 rounded-lg bg-zinc-950/50 border border-zinc-800/40 overflow-hidden"
									>
										<div className="shrink-0 px-2.5 py-1.5 border-b border-zinc-800 bg-zinc-950/70">
											<h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
												{DIVISION_NAMES[Number(div)] || `Divisão ${div}`}
											</h4>
										</div>
										<div className="flex-1 overflow-y-auto space-y-1 p-2">
											{(divisionFixtures[div] || []).length === 0 ? (
												<p className="text-zinc-600 text-[10px] font-bold text-center py-4">
													Sem jogos
												</p>
											) : (
												(divisionFixtures[div] || []).map((f, i) => (
													<FixtureCard
														key={i}
														homeTeamId={f.homeTeamId}
														awayTeamId={f.awayTeamId}
													/>
												))
											)}
										</div>
									</div>
								))}
						</div>
					</div>
				)}
			</div>

			{/* ── Footer ── */}
			{mode === "halftime" && (
				<button
					onClick={canContinue ? onReady : undefined}
					disabled={!canContinue || isReady}
					className={`shrink-0 w-full py-3.5 text-sm font-black uppercase tracking-widest transition-all border-t border-zinc-800 ${
						!canContinue
							? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
							: isReady
								? "bg-zinc-800 text-zinc-500"
								: cupPreMatch
									? "bg-green-600 hover:bg-green-500 text-zinc-950"
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
				<button
					onClick={() => onResolveAction(null)}
					className="shrink-0 w-full py-3.5 text-sm font-black uppercase tracking-widest bg-primary hover:brightness-110 text-on-primary transition-all border-t border-zinc-800"
				>
					▶ CONTINUAR
				</button>
			)}
			{mode === "detail" && (
				<button
					onClick={onClose}
					className="shrink-0 w-full py-3 text-sm font-black uppercase tracking-widest bg-zinc-900 hover:bg-zinc-800 text-zinc-300 transition-all border-t border-zinc-800"
				>
					Fechar
				</button>
			)}
		</div>
	);
}
