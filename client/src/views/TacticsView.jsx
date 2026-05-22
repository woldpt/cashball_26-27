import { useTactics } from "../contexts/TacticsContext.jsx";
import { PlayerLink } from "../components/shared/PlayerLink.jsx";
import { socket } from "../socket.js";
import {
	POSITION_SHORT_LABELS,
	TACTIC_FORMATIONS,
} from "../constants/index.js";

/** Badge de posição estilo Stitch: quadrado colorido */
const POS_BADGE_BG = {
	GR: "bg-yellow-600",
	DEF: "bg-blue-600",
	MED: "bg-green-600",
	ATA: "bg-red-600",
};

/** Cor do dot de status */
const STATUS_DOT = {
	Titular: "bg-green-500",
	Suplente: "bg-yellow-500",
	Excluído: "bg-gray-700",
};

/**
 * Linha de jogador estilo Stitch.
 * Mostra: badge posição | nome | skill | resistência | forma | dot status
 */
function PlayerRow({ player, matchweekCount, onClick, dotColor, draggable, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd, isOver, isDragging, children }) {
	return (
		<div
			draggable={draggable}
			onDragStart={onDragStart}
			onDragOver={onDragOver}
			onDragLeave={onDragLeave}
			onDrop={onDrop}
			onDragEnd={onDragEnd}
			className={`relative player-row flex items-center justify-between p-1.5 rounded cursor-pointer border transition-colors select-none
				${isDragging ? "opacity-40" : ""}
				${isOver ? "border-[#4ade80]/50 bg-[#4ade80]/5" : "border-transparent hover:border-[#333]"}
				${player.isUnavailable ? "opacity-50" : ""}
				${!draggable ? "cursor-default" : "cursor-grab active:cursor-grabbing"}
			`}
		>
			{/* Badge posição */}
			<div className="flex items-center space-x-2 truncate min-w-0">
				<span className={`w-4 h-4 rounded ${POS_BADGE_BG[player.position] || "bg-gray-600"} text-[9px] font-bold flex items-center justify-center text-white shrink-0`}>
					{POSITION_SHORT_LABELS[player.position]?.[0] ?? "?"}
				</span>
				<span className="font-medium truncate text-[#e0e0e0] text-xs">
					{onClick ? (
						<PlayerLink playerId={player.id}>{player.name}</PlayerLink>
					) : (
						player.name
					)}
					{!!player.is_star && (player.position === "MED" || player.position === "ATA") && (
						<span className="ml-1 text-amber-400 text-[10px]">★</span>
					)}
					{player.isUnavailable && (() => {
						const susp = player.suspension_until_matchweek || 0;
						const inj = player.injury_until_matchweek || 0;
						const cooldown = player.transfer_cooldown_until_matchweek || 0;
						const isSusp = susp > matchweekCount;
						const isCooldown = !isSusp && !(inj > matchweekCount) && cooldown > 0 && cooldown >= matchweekCount;
						if (isCooldown) return <span className="ml-1 text-xs" title="Em viagem">✈️ (1)</span>;
						const left = isSusp ? susp - matchweekCount : inj - matchweekCount;
						return <span className="ml-1 text-xs">{isSusp ? "🟥" : "🩹"} ({left})</span>;
					})()}
				</span>
			</div>
			{/* Stats + dot */}
			<div className="flex items-center space-x-2 shrink-0 text-[10px]">
				<span className="font-bold text-[#e0e0e0]">{player.skill}</span>
				<span className="text-blue-400 flex items-center">
					<svg className="w-3 h-3 mr-0.5" fill="currentColor" viewBox="0 0 20 20">
						<path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
					</svg>
					{player.resistance ?? "–"}
				</span>
				{(() => {
					const f = player.form ?? 100;
					return (
						<span className={f >= 115 ? "text-green-400" : f <= 85 ? "text-red-400" : "text-gray-500"}>
							{f >= 115 ? "💪" : f <= 85 ? "😩" : "👍"}
						</span>
					);
				})()}
				<span className={`w-2 h-2 rounded-full shrink-0 ${dotColor || "bg-gray-700"}`} />
			</div>
			{children}
		</div>
	);
}

/**
 * Página de Tácticas — totalmente auto-contida via useTactics().
 */
export function TacticsView() {
	const {
		tactic,
		tacticFamiliarity,
		allTacticFamiliarity,
		annotatedSquad,
		titulares,
		formationAvailabilityByValue,
		isLineupComplete,
		nextMatchOpponent,
		openStatusPickerId,
		setOpenStatusPickerId,
		dragOverPlayerId,
		setDragOverPlayerId,
		dragPlayerId,
		setDragPlayerId,
		dragOverSection,
		setDragOverSection,
		updateTactic,
		handleClearTactic,
		handleAutoPick,
		handleSetPlayerStatus,
		handleSwapPlayerStatuses,
		handleDropToSection,
		handleDragStart,
		handleReady,
		handleHalftimeReady,
		matchweekCount,
		teamInfo,
		nextMatchSummary,
		players,
		me,
		showHalftimePanel,
		isPlayingMatch,
		disconnected,
		isCupMatch,
	} = useTactics();

	/* ── helpers ── */
	const getBestForFormation = (formation) => {
		const styles = ["OFENSIVO", "DEFENSIVO", "EQUILIBRADO"];
		let best = null;
		for (const s of styles) {
			const entry = allTacticFamiliarity[`${formation}|${s}`];
			if (entry && (!best || entry.count > best.count)) best = entry;
		}
		return best;
	};

	const TIER_COLORS = {
		Mestre: { bar: "bg-amber-400", text: "text-amber-300", bg: "bg-amber-500/10" },
		Dominante: { bar: "bg-emerald-400", text: "text-emerald-300", bg: "bg-emerald-500/10" },
		Consolidada: { bar: "bg-emerald-500", text: "text-emerald-400", bg: "bg-emerald-500/10" },
		Familiar: { bar: "bg-sky-400", text: "text-sky-300", bg: "bg-sky-500/10" },
		"Ganhando rotina": { bar: "bg-sky-500", text: "text-sky-400", bg: "bg-sky-500/10" },
		"A familiarizar": { bar: "bg-slate-500", text: "text-slate-400", bg: "bg-slate-500/10" },
	};
	const MAX_COUNT = 21;

	/* ── status picker popup ── */
	function StatusPicker({ player, above = false }) {
		if (openStatusPickerId !== player.id) return null;
		const subCount = Object.entries(tactic.positions).filter(([id, s]) => s === "Suplente" && Number(id) !== player.id).length;
		const titCount = Object.entries(tactic.positions).filter(([id, s]) => s === "Titular" && Number(id) !== player.id).length;
		const subsFull = subCount >= 5;
		const titularesFull = titCount >= 11;
		return (
			<div
				className={`absolute right-1 ${above ? "bottom-full mb-1" : "top-full"} z-50 bg-[#1e1e1e] border border-[#333] rounded-md shadow-xl p-1 flex flex-col gap-0.5 min-w-[140px]`}
				onClick={(e) => e.stopPropagation()}
			>
				{[["Titular", "🟢", "Titular"], ["Suplente", "🟡", "Suplente"], ["Excluído", "⚫️", "Não convocado"]].map(([status, emoji, label]) => {
					const unavail = player.isUnavailable && (status === "Titular" || status === "Suplente");
					const disabled = unavail
						|| (status === "Titular" && titularesFull && player.status !== "Titular")
						|| (status === "Suplente" && subsFull && player.status !== "Suplente");
					return (
						<button
							key={status}
							onClick={() => !disabled && handleSetPlayerStatus(player.id, status)}
							className={`px-3 py-2 rounded text-xs font-bold flex items-center gap-2 text-left ${disabled ? "opacity-40 cursor-not-allowed text-gray-500" : player.status === status ? "bg-[#2a2a2a] text-[#e0e0e0]" : "hover:bg-[#2a2a2a] text-[#9e9e9e]"}`}
						>
							{emoji} {label}
						</button>
					);
				})}
			</div>
		);
	}

	return (
		<div>
			{/* Warnings */}
			{disconnected && (
				<div className="mb-3 px-4 py-2 text-red-400 text-[10px] font-bold text-center bg-red-500/5 border border-red-500/20 rounded-lg">
					⚠️ Desligado — a reconectar...
				</div>
			)}

			{nextMatchSummary?.isCup && !nextMatchOpponent ? (
				<div className="bg-[#1e1e1e] border border-[#333] rounded-lg flex flex-col items-center gap-4 py-8 text-center px-6">
					<p className="text-5xl">🏆</p>
					<p className="text-[#9e9e9e] font-bold text-sm leading-relaxed">
						Já foste eliminado desta ronda da Taça.<br />
						Avança para observar os jogos e seguir em frente.
					</p>
					{(() => {
						const isReady = players.find((p) => p.name === me?.name)?.ready;
						return (
							<button
								onClick={handleReady}
								disabled={!!isReady}
								className={`mt-2 px-8 py-3.5 font-bold rounded text-sm uppercase tracking-wider transition-all ${isReady ? "bg-[#2a2a2a] text-[#9e9e9e] cursor-not-allowed opacity-60" : "bg-green-200 text-green-900 hover:brightness-105 active:scale-95"}`}
							>
								{isReady ? "⏳ A aguardar..." : "Ver jogos da Taça"}
							</button>
						);
					})()}
				</div>
			) : (
				<div className="flex flex-col lg:flex-row gap-3 items-start">

					{/* ── COL 1: FORMAÇÃO ── */}
					<div className="lg:w-[220px] flex-shrink-0 space-y-0 bg-[#1e1e1e] border border-[#333] rounded-lg overflow-hidden">
						{/* Header */}
						<div className="flex justify-between items-center px-3 py-2.5 border-b border-[#333]">
							<h2 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Formação</h2>
							<button className="text-[10px] text-gray-500 uppercase hover:text-red-400 transition-colors" onClick={handleClearTactic}>
								Limpar
							</button>
						</div>

						{/* Moral */}
						{(() => {
							const morale = teamInfo?.morale ?? 75;
							const fillColor = morale > 75 ? "bg-green-500" : morale >= 50 ? "bg-yellow-500" : "bg-red-500";
							const textColor = morale > 75 ? "text-green-400" : morale >= 50 ? "text-yellow-500" : "text-red-400";
							const label = morale > 75 ? "Boa" : morale >= 50 ? "Média" : "Baixa";
							return (
								<div className="px-3 py-2.5 border-b border-[#333]">
									<div className="flex justify-between text-xs mb-1.5">
										<span className="text-gray-400 uppercase text-[10px] tracking-wider">Moral</span>
										<span className={`text-[10px] font-bold ${textColor}`}>{label}</span>
									</div>
									<div className="w-full bg-gray-700 h-1.5 rounded-full overflow-hidden">
										<div className={`${fillColor} h-full rounded-full transition-all duration-500`} style={{ width: `${morale}%` }} />
									</div>
								</div>
							);
						})()}

						{/* Mentalidade */}
						<div className="px-3 py-2.5 border-b border-[#333]">
							<h3 className="text-[10px] text-gray-400 mb-2 uppercase tracking-wider">Mentalidade</h3>
							<div className="flex space-x-1">
								{[
									["Defensive", "🛡️", "Defensivo", "Prioriza não sofrer golos."],
									["Balanced", "⚖️", "Equilibrado", "Postura neutra."],
									["Offensive", "⚔️", "Ofensivo", "Pressão total."],
								].map(([val, icon, lbl, tooltip]) => {
									const isActive = tactic.style === val;
									return (
										<button
											key={val}
											onClick={() => updateTactic({ style: val })}
											title={tooltip}
											className={`flex-1 rounded p-1.5 text-center flex flex-col items-center justify-center border transition-all active:scale-95 ${
												isActive
													? "bg-[#4ade80]/20 border-[#4ade80] text-[#4ade80]"
													: "bg-[#2a2a2a] border-[#444] text-gray-400 opacity-60 hover:opacity-80"
											}`}
										>
											<span className="text-base leading-none mb-0.5">{icon}</span>
											<span className={`text-[8px] uppercase font-bold leading-none ${isActive ? "text-[#4ade80]" : ""}`}>{lbl}</span>
										</button>
									);
								})}
							</div>
						</div>

						{/* Familiaridade atual */}
						{(() => {
							const fam = tacticFamiliarity;
							if (!fam || fam.bonus <= 0 || fam.count < 1) return null;
							const badgeColor = fam.count >= 10
								? "bg-amber-500/15 border-amber-500/30 text-amber-300"
								: fam.count >= 6
									? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
									: "bg-sky-500/15 border-sky-500/30 text-sky-300";
							const stars = fam.count >= 10 ? "⭐⭐⭐⭐⭐" : fam.count >= 8 ? "⭐⭐⭐⭐" : fam.count >= 6 ? "⭐⭐⭐" : fam.count >= 4 ? "⭐⭐" : "⭐";
							return (
								<div className="px-3 py-2 border-b border-[#333]">
									<div className={`flex flex-col gap-1 px-2 py-1.5 rounded border ${badgeColor}`}>
										<div className="flex items-center gap-2">
											<span className="text-sm">{stars}</span>
											<span className="text-[9px] opacity-70">(+{Math.round(fam.bonus * 100)}%)</span>
										</div>
										<div className="flex items-center gap-1.5 text-[9px] opacity-70">
											<span>{fam.formation}</span><span>·</span>
											<span>{fam.style}</span><span>·</span>
											<span>{fam.count} jogo{fam.count > 1 ? "s" : ""}</span>
										</div>
									</div>
								</div>
							);
						})()}

						{/* Lista de formações */}
						<div className="px-3 py-2.5 space-y-1.5">
							{TACTIC_FORMATIONS.map(({ value, label }) => {
								const isAvailable = formationAvailabilityByValue[value] === true;
								const isActive = titulares.length > 0 && tactic.formation === value;
								const best = getBestForFormation(value);
								const colors = best ? (TIER_COLORS[best.label] || TIER_COLORS["A familiarizar"]) : null;
								const pct = best ? Math.min(100, Math.round((best.count / MAX_COUNT) * 100)) : 0;

								return (
									<div key={value} className="flex items-center gap-2">
										<button
											disabled={!isAvailable}
											title={isAvailable ? undefined : "Indisponível: faltam jogadores aptos"}
											onClick={() => isAvailable && handleAutoPick(value)}
											className={`shrink-0 w-[90px] px-2 py-1.5 text-xs font-bold rounded text-left transition-all active:scale-95 ${
												!isAvailable
													? "bg-[#2a2a2a] text-gray-600 cursor-not-allowed"
													: isActive
														? "bg-green-200 text-green-900 shadow"
														: "bg-[#2a2a2a] text-gray-300 hover:bg-[#333]"
											}`}
										>
											{label}
										</button>
										{best ? (
											<div className={`flex-1 flex items-center gap-1.5 px-1.5 py-1 rounded ${colors.bg}`}>
												<div className="flex-1 h-1 bg-[#333] rounded-full overflow-hidden">
													<div className={`h-full rounded-full ${colors.bar}`} style={{ width: `${pct}%` }} />
												</div>
												<span className={`text-[8px] font-bold uppercase shrink-0 ${colors.text}`}>{best.label}</span>
											</div>
										) : (
											<div className="flex-1 flex items-center gap-1.5 px-1.5 py-1 rounded bg-[#2a2a2a]/40">
												<div className="flex-1 h-1 bg-[#333] rounded-full" />
												<span className="text-[8px] text-gray-600 uppercase shrink-0">—</span>
											</div>
										)}
									</div>
								);
							})}
						</div>
					</div>

					{/* ── COL 2+3: TITULARES + SUPLENTES ── */}
					<div className="flex-1 flex flex-col sm:flex-row gap-3 min-w-0">

						{/* Titulares */}
						<section
							className={`bg-[#1e1e1e] border rounded-lg overflow-hidden flex-1 min-w-0 flex flex-col transition-colors ${dragOverSection === "Titular" ? "border-[#4ade80]/50" : "border-[#333]"}`}
							onDragOver={(e) => { e.preventDefault(); if (dragPlayerId) setDragOverSection("Titular"); }}
							onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverSection(null); }}
							onDrop={(e) => { e.preventDefault(); if (dragPlayerId) handleDropToSection(dragPlayerId, "Titular"); setDragOverSection(null); }}
						>
							<div className="flex justify-between items-center px-2 py-2 border-b border-[#333]">
								<h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Titulares</h2>
								<span className="text-[10px] text-gray-500">
									<span className={annotatedSquad.filter((p) => p.status === "Titular").length === 11 ? "text-[#4ade80]" : "text-[#e0e0e0]"}>
										{annotatedSquad.filter((p) => p.status === "Titular").length}
									</span>/11
								</span>
							</div>
							<div className="flex-1 overflow-y-auto px-1 py-1 space-y-0.5">
								{annotatedSquad.filter((p) => p.status === "Titular").map((player) => (
									<PlayerRow
										key={player.id}
										player={player}
										matchweekCount={matchweekCount}
										onClick
										dotColor={STATUS_DOT.Titular}
										draggable={!player.isJunior}
										onDragStart={handleDragStart}
										onDragOver={(e) => { e.preventDefault(); setDragOverPlayerId(player.id); }}
										onDragLeave={() => setDragOverPlayerId(null)}
										onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (dragPlayerId && dragPlayerId !== player.id) handleSwapPlayerStatuses(dragPlayerId, player.id); else { setDragOverPlayerId(null); setDragPlayerId(null); } setDragOverSection(null); }}
										onDragEnd={() => { setDragOverPlayerId(null); setDragPlayerId(null); }}
										isOver={dragOverPlayerId === player.id && dragPlayerId !== player.id}
										isDragging={dragPlayerId === player.id}
									>
										{!player.isJunior && (
											<>
												<button
													className="shrink-0 w-2 h-2 rounded-full bg-green-500 ml-1"
													onClick={(e) => { e.stopPropagation(); setOpenStatusPickerId((prev) => prev === player.id ? null : player.id); }}
												/>
												<StatusPicker player={player} />
											</>
										)}
									</PlayerRow>
								))}
								{annotatedSquad.filter((p) => p.status === "Titular").length === 0 && (
									<p className="px-2 py-6 text-center text-[11px] text-gray-600 font-bold">Nenhum titular designado</p>
								)}
							</div>
						</section>

						{/* Suplentes + Não convocados */}
						<section
							className={`bg-[#1e1e1e] border rounded-lg overflow-hidden flex-1 min-w-0 flex flex-col transition-colors ${dragOverSection === "Suplente" ? "border-yellow-500/50" : "border-[#333]"}`}
							onDragOver={(e) => { e.preventDefault(); if (dragPlayerId) setDragOverSection("Suplente"); }}
							onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverSection(null); }}
							onDrop={(e) => { e.preventDefault(); if (dragPlayerId) handleDropToSection(dragPlayerId, "Suplente"); setDragOverSection(null); }}
						>
							<div className="flex justify-between items-center px-2 py-2 border-b border-[#333]">
								<h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Suplentes</h2>
								<span className="text-[10px] text-gray-500">
									<span className="text-yellow-400">{annotatedSquad.filter((p) => p.status === "Suplente" && !p.isUnavailable).length}</span>/5
								</span>
							</div>
							<div className="px-1 py-1 space-y-0.5">
								{annotatedSquad.filter((p) => p.status === "Suplente" && !p.isUnavailable).map((player) => (
									<PlayerRow
										key={player.id}
										player={player}
										matchweekCount={matchweekCount}
										onClick
										dotColor={STATUS_DOT.Suplente}
										draggable={!player.isJunior}
										onDragStart={handleDragStart}
										onDragOver={(e) => { e.preventDefault(); setDragOverPlayerId(player.id); }}
										onDragLeave={() => setDragOverPlayerId(null)}
										onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (dragPlayerId && dragPlayerId !== player.id) handleSwapPlayerStatuses(dragPlayerId, player.id); else { setDragOverPlayerId(null); setDragPlayerId(null); } setDragOverSection(null); }}
										onDragEnd={() => { setDragOverPlayerId(null); setDragPlayerId(null); }}
										isOver={dragOverPlayerId === player.id && dragPlayerId !== player.id}
										isDragging={dragPlayerId === player.id}
									>
										{!player.isJunior && (
											<>
												<button
													className="shrink-0 w-2 h-2 rounded-full bg-yellow-500 ml-1"
													onClick={(e) => { e.stopPropagation(); setOpenStatusPickerId((prev) => prev === player.id ? null : player.id); }}
												/>
												<StatusPicker player={player} />
											</>
										)}
									</PlayerRow>
								))}
								{annotatedSquad.filter((p) => p.status === "Suplente").length === 0 && (
									<p className="px-2 py-4 text-center text-[11px] text-gray-600 font-bold">Nenhum suplente</p>
								)}
							</div>

							{/* Não convocados */}
							{annotatedSquad.filter((p) => !p.isJunior && (p.isUnavailable || (p.status !== "Titular" && p.status !== "Suplente"))).length > 0 && (
								<div
									onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (dragPlayerId) setDragOverSection("Excluído"); }}
									onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverSection(null); }}
									onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (dragPlayerId) handleDropToSection(dragPlayerId, "Excluído"); setDragOverSection(null); }}
								>
									<div className="px-2 py-1.5 border-t border-[#333]">
										<h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Não Convocados</h2>
									</div>
									<div className="px-1 py-1 space-y-0.5 opacity-50">
										{annotatedSquad.filter((p) => !p.isJunior && (p.isUnavailable || (p.status !== "Titular" && p.status !== "Suplente"))).map((player) => (
											<PlayerRow
												key={player.id}
												player={player}
												matchweekCount={matchweekCount}
												dotColor={STATUS_DOT.Excluído}
												draggable
												onDragStart={handleDragStart}
												onDragOver={(e) => { e.preventDefault(); setDragOverPlayerId(player.id); }}
												onDragLeave={() => setDragOverPlayerId(null)}
												onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (dragPlayerId && dragPlayerId !== player.id) handleSwapPlayerStatuses(dragPlayerId, player.id); else { setDragOverPlayerId(null); setDragPlayerId(null); } setDragOverSection(null); }}
												onDragEnd={() => { setDragOverPlayerId(null); setDragPlayerId(null); }}
												isOver={dragOverPlayerId === player.id && dragPlayerId !== player.id}
												isDragging={dragPlayerId === player.id}
											>
												<button
													className="shrink-0 w-2 h-2 rounded-full bg-gray-700 ml-1"
													onClick={(e) => { e.stopPropagation(); setOpenStatusPickerId((prev) => prev === player.id ? null : player.id); }}
												/>
												<StatusPicker player={player} above />
											</PlayerRow>
										))}
									</div>
								</div>
							)}
						</section>
					</div>

					{/* ── COL 4: CAMPO + JOGAR ── */}
					<div className="lg:w-[280px] flex-shrink-0 flex flex-col gap-3">

						{/* Botão JOGAR — desktop */}
						<div className="max-lg:hidden">
							{(() => {
								const isReady = players.find((p) => p.name === me.name)?.ready;
								const isHalftime = showHalftimePanel && !isPlayingMatch;
								const isEliminatedCupSpectator = nextMatchSummary?.isCup && !nextMatchOpponent;
								const isDisabled = isEliminatedCupSpectator ? !!isReady : !isHalftime && !isReady && !isLineupComplete;
								return (
									<>
										<button
											onClick={isHalftime ? handleHalftimeReady : handleReady}
											disabled={isDisabled}
											className={`w-full p-4 font-bold rounded text-sm uppercase tracking-wider transition-all active:scale-95 ${
												isReady
													? "bg-[#2a2a2a] text-[#9e9e9e] cursor-not-allowed"
													: isDisabled
														? "bg-[#2a2a2a] text-gray-600 cursor-not-allowed opacity-60"
														: "bg-green-200 text-green-900 hover:brightness-105 shadow-lg"
											}`}
										>
											{isReady
												? "⏳ A aguardar..."
												: isEliminatedCupSpectator
													? "Avançar para Taça"
													: isHalftime && isCupMatch
														? "2ª Parte — Taça"
														: isHalftime
															? "2ª Parte"
															: "Jogar Jornada"}
										</button>
										{isDisabled && !isEliminatedCupSpectator && !isReady && (
											<p className="text-[10px] font-bold text-red-400 mt-2 text-center">
												Faltam titulares: 1 GR + 10 de campo
											</p>
										)}
										{!isDisabled && !isReady && (
											<p className="text-[9px] text-center text-gray-500 mt-1">
												A jornada avança quando todos clicarem.
											</p>
										)}
									</>
								);
							})()}
						</div>

						{/* Mobile FAB */}
						{(() => {
							const fabReady = players.find((p) => p.name === me.name)?.ready;
							const fabHalftime = showHalftimePanel && !isPlayingMatch;
							const fabCupSpec = nextMatchSummary?.isCup && !nextMatchOpponent;
							if (fabReady) return null;
							if (!fabHalftime && !fabCupSpec && !isLineupComplete) return null;
							const fabIcon = fabHalftime ? "skip_next" : fabCupSpec ? "arrow_forward" : "play_arrow";
							const fabLabel = fabHalftime ? "2ª Parte" : fabCupSpec ? "Ver Taça" : "Jogar";
							return (
								<button
									onClick={fabHalftime ? handleHalftimeReady : handleReady}
									aria-label={fabLabel}
									className="lg:hidden fixed bottom-28 right-4 z-50 w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 duration-200"
									style={{
										background: "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.25) 0%, transparent 70%), #10b981",
										boxShadow: "0 0 32px 8px rgba(16,185,129,0.50), 0 8px 20px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.25)",
									}}
								>
									<span className="absolute inset-0 rounded-full bg-[#4ade80]/40 animate-ping" />
									<span className="absolute inset-0 rounded-full bg-[#4ade80]/20 animate-ping" style={{ animationDelay: "0.3s" }} />
									<span className="material-symbols-outlined text-[28px] text-white drop-shadow-lg relative z-10 leading-none">{fabIcon}</span>
								</button>
							);
						})()}

						{/* Campo */}
						<div
							className={`relative w-full rounded-lg overflow-hidden transition-[box-shadow] duration-150 ${dragPlayerId && dragOverSection === "Titular" && annotatedSquad.find((p) => p.id === dragPlayerId)?.status !== "Titular" ? "ring-2 ring-[#4ade80]/60" : ""}`}
							style={{
								aspectRatio: "9/12",
								background: "linear-gradient(to bottom, #2d5a27 0%, #1a3816 100%)",
							}}
							onDragOver={(e) => { e.preventDefault(); if (dragPlayerId) setDragOverSection("Titular"); }}
							onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverSection(null); }}
							onDrop={(e) => { e.preventDefault(); if (dragPlayerId) handleDropToSection(dragPlayerId, "Titular"); setDragOverSection(null); }}
						>
							{/* Linhas do campo */}
							<div className="absolute inset-[10px] border border-white/20 pointer-events-none">
								<div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/20" />
								<div className="absolute top-1/2 left-1/2 w-10 h-10 border border-white/20 rounded-full -translate-x-1/2 -translate-y-1/2" />
							</div>

							{/* Jogadores no campo */}
							{(() => {
								const tits = annotatedSquad.filter((p) => p.status === "Titular");
								const grPlayers = tits.filter((p) => p.position === "GR");
								const defPlayers = tits.filter((p) => p.position === "DEF");
								const medPlayers = tits.filter((p) => p.position === "MED");
								const ataPlayers = tits.filter((p) => p.position === "ATA");
								const rows = [ataPlayers, medPlayers, defPlayers, grPlayers];
								const rowYs = ["7%", "30%", "55%", "79%"];
								const posColors = {
									GR: "bg-yellow-600",
									DEF: "bg-blue-600",
									MED: "bg-green-600",
									ATA: "bg-red-600",
								};
								return rows.map((rowPlayers, ri) =>
									rowPlayers.length > 0 ? (
										<div
											key={ri}
											className="absolute w-full flex justify-evenly items-start px-4"
											style={{ top: rowYs[ri] }}
										>
											{rowPlayers.map((player) => (
												<div
													key={player.id}
													className={`field-player flex flex-col items-center cursor-grab active:cursor-grabbing ${dragPlayerId === player.id ? "opacity-40" : ""} ${dragOverPlayerId === player.id && dragPlayerId !== player.id ? "scale-110" : ""}`}
													style={{ maxWidth: "60px" }}
													draggable
													data-player-id={player.id}
													data-player-status="Titular"
													onDragStart={handleDragStart}
													onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverPlayerId(player.id); }}
													onDragLeave={() => setDragOverPlayerId(null)}
													onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (dragPlayerId && dragPlayerId !== player.id) handleSwapPlayerStatuses(dragPlayerId, player.id); else { setDragOverPlayerId(null); setDragPlayerId(null); } setDragOverSection(null); }}
													onDragEnd={() => { setDragOverPlayerId(null); setDragPlayerId(null); }}
												>
													<div className={`w-8 h-8 rounded-full ${posColors[player.position] || "bg-gray-500"} text-white font-bold flex items-center justify-center text-xs shadow-md border-2 border-white/20 relative ${player.isUnavailable ? "opacity-50 ring-2 ring-red-500" : ""}`}>
														{POSITION_SHORT_LABELS[player.position]?.[0] ?? "?"}
														{player.isUnavailable && (
															<span className="absolute -top-1 -right-1 text-[9px] leading-none">
																{(player.suspension_until_matchweek || 0) > matchweekCount ? "🟥" : (player.injury_until_matchweek || 0) > matchweekCount ? "🩹" : "✈️"}
															</span>
														)}
													</div>
													<span
														className="text-[8px] bg-black/50 px-1 rounded mt-1 font-bold text-white cursor-pointer hover:text-[#4ade80] transition-colors"
														style={{ maxWidth: "56px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
														onClick={() => socket.emit("requestPlayerHistory", { playerId: player.id })}
													>
														{player.name.split(" ").pop()}
													</span>
													<span className="text-[8px] text-[#4ade80] font-bold" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.95)" }}>
														{player.skill}
													</span>
												</div>
											))}
										</div>
									) : null
								);
							})()}

							{dragPlayerId && dragOverSection === "Titular" && annotatedSquad.find((p) => p.id === dragPlayerId)?.status !== "Titular" && (
								<div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
									<div className="bg-black/50 border border-[#4ade80]/50 px-4 py-2 rounded-lg backdrop-blur-sm">
										<p className="text-[#4ade80] font-black text-xs uppercase tracking-widest animate-pulse">↓ Soltar para entrar em campo</p>
									</div>
								</div>
							)}
							{!tactic.formation && titulares.length === 0 && (
								<div className="absolute inset-0 flex items-center justify-center">
									<p className="text-gray-300 text-sm font-bold text-center px-8 leading-relaxed" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}>
										Arrasta jogadores para o campo ou escolhe uma formação
									</p>
								</div>
							)}
							<div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
