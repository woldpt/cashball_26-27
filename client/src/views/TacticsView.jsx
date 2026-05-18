import { useTactics } from "../contexts/TacticsContext.jsx";
import { PlayerLink } from "../components/shared/PlayerLink.jsx";
import { socket } from "../socket.js";
import {
	POSITION_BORDER_CLASS,
	POSITION_TEXT_CLASS,
	POSITION_SHORT_LABELS,
	TACTIC_FORMATIONS,
} from "../constants/index.js";

/**
 * Página de Tácticas — totalmente auto-contida via useTactics().
 * Não recebe props: todos os dados e handlers vêm do TacticsContext.
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

	return (
		<div>
			{/* Warnings full-width */}
			{disconnected && (
				<div className="mb-3 px-4 py-2 text-red-400 text-[10px] font-bold text-center bg-red-500/5 border border-red-500/20 rounded-lg">
					⚠️ Desligado — a reconectar...
				</div>
			)}
			{nextMatchSummary?.isCup && !nextMatchOpponent ? (
				<div className="bg-surface-container rounded-lg flex flex-col items-center gap-4 py-8 text-center px-6">
					<p className="text-5xl">🏆</p>
					<p className="text-on-surface-variant font-bold text-sm leading-relaxed">
						Já foste eliminado desta ronda da Taça.
						<br />
						Avança para observar os jogos e seguir em frente.
					</p>
					{(() => {
						const isReady = players.find((p) => p.name === me?.name)?.ready;
						return (
							<button
								onClick={handleReady}
								disabled={!!isReady}
								className={`mt-2 px-8 py-3.5 font-headline font-black rounded-sm text-base uppercase tracking-widest transition-all ${
									isReady
										? "bg-surface-bright text-on-surface-variant cursor-not-allowed opacity-60"
										: "bg-primary text-on-primary hover:brightness-110"
								}`}
							>
								{isReady ? "⏳ A aguardar..." : "Ver jogos da Taça"}
							</button>
						);
					})()}
				</div>
			) : (
				<div className="grid grid-cols-1 xl:grid-cols-[220px_minmax(0,0.8fr)_minmax(0,0.8fr)_320px] gap-4 items-start">
					{/* ── COL 1: CONTROLO ── */}
					<div className="bg-surface-container rounded-lg overflow-hidden">
						{/* Header */}
						<div className="px-5 py-3 border-b border-outline-variant/20 flex items-center justify-between">
							<span className="font-headline text-xs font-black tracking-[0.2em] uppercase text-on-surface-variant">
								Formação
							</span>
							<button
								className="text-[9px] uppercase tracking-widest font-black text-on-surface-variant/50 hover:text-error transition-colors"
								onClick={handleClearTactic}
							>
								Limpar
							</button>
						</div>

						{/* Moral bar */}
						{(() => {
							const morale = teamInfo?.morale ?? 75;
							const mc =
								morale > 75
									? "bg-primary"
									: morale >= 50
										? "bg-tertiary"
										: "bg-error";
							const ml = morale > 75 ? "Boa" : morale >= 50 ? "Média" : "Baixa";
							const tc =
								morale > 75
									? "text-primary"
									: morale >= 50
										? "text-tertiary"
										: "text-error";
							return (
								<div className="px-4 py-2 border-b border-outline-variant/15 flex items-center gap-2">
									<span className="text-[9px] uppercase tracking-[0.2em] font-black text-on-surface-variant shrink-0">
										Moral
									</span>
									<div className="flex-1 bg-surface-bright rounded-full h-1.5 overflow-hidden">
										<div
											className={`h-full rounded-full transition-all duration-500 ${mc}`}
											style={{ width: `${morale}%` }}
										/>
									</div>
									<span className={`text-[10px] font-black shrink-0 ${tc}`}>
										{ml}
									</span>
								</div>
							);
						})()}

						{/* Familiaridade com táctica */}
						{(() => {
							const fam = tacticFamiliarity;
							const hasFamiliarity = fam && fam.bonus > 0 && fam.count >= 1;
							const badgeColor = hasFamiliarity
								? fam.count >= 10
									? "bg-amber-500/15 border-amber-500/30 text-amber-300"
									: fam.count >= 6
										? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
										: "bg-sky-500/15 border-sky-500/30 text-sky-300"
								: "bg-surface-container-high border-outline-variant/10 text-on-surface-variant/40";
							const bonusText = hasFamiliarity
								? `(+${Math.round(fam.bonus * 100)}%)`
								: "";
							const stars = hasFamiliarity
								? fam.count >= 10
									? "⭐⭐⭐⭐⭐"
									: fam.count >= 8
										? "⭐⭐⭐⭐"
										: fam.count >= 6
											? "⭐⭐⭐"
											: fam.count >= 4
												? "⭐⭐"
												: "⭐"
								: "";
							return (
								<div className="px-5 py-2 border-b border-outline-variant/15">
									{hasFamiliarity && (
										<div
											className={`flex flex-col gap-1 px-3 py-2 rounded-md border ${badgeColor}`}
										>
											<div className="flex items-center gap-2">
												<span className="text-sm">{stars}</span>
												<span className="text-[9px] opacity-70">
													{bonusText}
												</span>
											</div>
											<div className="flex items-center gap-1.5 text-[9px] opacity-70">
												<span>{fam.formation}</span>
												<span>·</span>
												<span>{fam.style}</span>
												<span>·</span>
												<span>
													{fam.count} jogo
													{fam.count > 1 ? "s" : ""}
												</span>
											</div>
										</div>
									)}
									{!hasFamiliarity && (
										<div
											className={`flex flex-col gap-1 px-3 py-2 rounded-md border ${badgeColor}`}
										>
											<div className="flex items-center gap-2">
												<span className="text-[10px] font-black uppercase tracking-widest">
													Sem rotina
												</span>
											</div>
											<div className="text-[9px] opacity-70">
												Usa tácticas diferentes ou jogo novo
											</div>
										</div>
									)}
								</div>
							);
						})()}

						{/* Formation pill buttons + familiaridade */}
						{(() => {
							const hasLineup = titulares.length > 0;
							const lastLabel = TACTIC_FORMATIONS.find(
								(f) => f.value === tactic.formation,
							)?.label;

							// Para cada formação, calcular a melhor familiaridade entre todos os estilos
							const getBestForFormation = (formation) => {
								const styles = ["OFENSIVO", "DEFENSIVO", "EQUILIBRADO"];
								let best = null;
								for (const s of styles) {
									const entry = allTacticFamiliarity[`${formation}|${s}`];
									if (entry && (!best || entry.count > best.count))
										best = entry;
								}
								return best;
							};

							const TIER_COLORS = {
								Mestre: {
									bar: "bg-amber-400",
									text: "text-amber-300",
									bg: "bg-amber-500/10",
								},
								Dominante: {
									bar: "bg-emerald-400",
									text: "text-emerald-300",
									bg: "bg-emerald-500/10",
								},
								Consolidada: {
									bar: "bg-emerald-500",
									text: "text-emerald-400",
									bg: "bg-emerald-500/10",
								},
								Familiar: {
									bar: "bg-sky-400",
									text: "text-sky-300",
									bg: "bg-sky-500/10",
								},
								"Ganhando rotina": {
									bar: "bg-sky-500",
									text: "text-sky-400",
									bg: "bg-sky-500/10",
								},
								"A familiarizar": {
									bar: "bg-slate-500",
									text: "text-slate-400",
									bg: "bg-slate-500/10",
								},
							};
							const MAX_COUNT = 21;

							return (
								<div className="px-3 py-3 border-b border-outline-variant/15 flex flex-col gap-1">
									{TACTIC_FORMATIONS.map(({ value, label }) => {
										const isAvailable =
											formationAvailabilityByValue[value] === true;
										const isActive = hasLineup && tactic.formation === value;
										const best = getBestForFormation(value);
										const colors = best
											? TIER_COLORS[best.label] || TIER_COLORS["A familiarizar"]
											: null;
										const pct = best
											? Math.min(
													100,
													Math.round((best.count / MAX_COUNT) * 100),
												)
											: 0;

										return (
											<div key={value} className="flex items-center gap-2">
												{/* Pill */}
												<button
													disabled={!isAvailable}
													title={
														isAvailable
															? undefined
															: "Indisponível: faltam jogadores aptos por posição"
													}
													onClick={() => isAvailable && handleAutoPick(value)}
													className={`shrink-0 w-[110px] px-2 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all rounded-sm text-left ${
														!isAvailable
															? "bg-surface-container-high text-on-surface-variant/35 border border-outline-variant/10 cursor-not-allowed"
															: isActive
																? "bg-primary text-on-primary"
																: "bg-surface-container-high hover:bg-surface-bright text-on-surface-variant hover:text-on-surface border border-outline-variant/20"
													}`}
												>
													{label}
												</button>

												{/* Familiaridade */}
												{best ? (
													<div
														className={`flex-1 flex items-center gap-1.5 px-2 py-1 rounded-sm ${colors.bg}`}
													>
														<div className="flex-1 h-1.5 bg-outline-variant/20 rounded-full overflow-hidden">
															<div
																className={`h-full rounded-full transition-all ${colors.bar}`}
																style={{ width: `${pct}%` }}
															/>
														</div>
														<span
															className={`text-[9px] font-black uppercase tracking-widest shrink-0 ${colors.text}`}
														>
															{best.label}
														</span>
													</div>
												) : (
													<div className="flex-1 flex items-center gap-1.5 px-2 py-1 rounded-sm bg-surface-container-high/40">
														<div className="flex-1 h-1.5 bg-outline-variant/15 rounded-full" />
														<span className="text-[9px] text-on-surface-variant/25 uppercase tracking-widest shrink-0">
															—
														</span>
													</div>
												)}
											</div>
										);
									})}
									{!hasLineup && lastLabel && (
										<p className="text-[9px] text-on-surface-variant/40 font-bold uppercase tracking-widest mt-1">
											Última: {lastLabel}
										</p>
									)}
								</div>
							);
						})()}

						{/* Mentalidade strip */}
						<div className="px-4 py-3 border-b border-outline-variant/15 bg-surface-container-high/20">
							<span className="block text-[9px] uppercase tracking-[0.2em] font-black text-on-surface-variant mb-2">
								Mentalidade
							</span>
							<div className="flex gap-1.5">
								{[
									[
										"Defensive",
										"🛡️",
										"Defensivo",
										"Prioriza não sofrer golos. Ataque mais contido, mas difícil de bater. Ideal contra adversários mais fortes.",
									],
									[
										"Balanced",
										"⚖️",
										"Equilibrado",
										"Postura neutra. Potencia a qualidade real do plantel sem arriscar. Boa escolha quando as equipas são semelhantes.",
									],
									[
										"Offensive",
										"⚔️",
										"Ofensivo",
										"Pressão total. Mais perigoso no ataque, mas exposto atrás. Ideal contra equipas fechadas ou quando precisas de marcar.",
									],
								].map(([val, icon, lbl, tooltip]) => (
									<button
										key={val}
										onClick={() => updateTactic({ style: val })}
										title={tooltip}
										className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded transition-all ${
											tactic.style === val
												? "bg-primary text-on-primary shadow-md"
												: "bg-surface-container-high hover:bg-surface-bright text-on-surface-variant border border-outline-variant/20"
										}`}
									>
										<span className="text-base leading-none">{icon}</span>
										<span className="text-[9px] font-black uppercase tracking-wide leading-none">
											{lbl}
										</span>
									</button>
								))}
							</div>
						</div>
					</div>
					{/* ── COL 2: TITULARES ── */}
					<div
						className={`bg-surface-container rounded-lg overflow-hidden transition-[box-shadow,background-color] duration-150 ${
							dragOverSection === "Titular"
								? "ring-2 ring-primary/50 bg-primary/[0.03]"
								: ""
						}`}
						onDragOver={(e) => {
							e.preventDefault();
							if (dragPlayerId) setDragOverSection("Titular");
						}}
						onDragLeave={(e) => {
							if (!e.currentTarget.contains(e.relatedTarget))
								setDragOverSection(null);
						}}
						onDrop={(e) => {
							e.preventDefault();
							if (dragPlayerId) handleDropToSection(dragPlayerId, "Titular");
							setDragOverSection(null);
						}}
					>
						<div className="px-4 py-2.5 flex items-center justify-between bg-surface-container-high/60 border-b border-outline-variant/10">
							<span className="text-[9px] uppercase tracking-[0.2em] font-black text-on-surface-variant">
								Titulares
							</span>
							<span className="text-[9px] font-black">
								<span
									className={
										annotatedSquad.filter((p) => p.status === "Titular")
											.length === 11
											? "text-primary"
											: "text-emerald-400"
									}
								>
									{annotatedSquad.filter((p) => p.status === "Titular").length}
								</span>
								<span className="text-on-surface-variant">/11</span>
							</span>
						</div>
						<div className="divide-y divide-outline-variant/10">
							{annotatedSquad
								.filter((p) => p.status === "Titular")
								.map((player) => (
									<div
										key={player.id}
										draggable={!player.isJunior}
										data-player-id={player.id}
										data-player-status="Titular"
										onDragStart={handleDragStart}
										onDragOver={(e) => {
											e.preventDefault();
											setDragOverPlayerId(player.id);
										}}
										onDragLeave={() => setDragOverPlayerId(null)}
										onDrop={(e) => {
											e.preventDefault();
											e.stopPropagation();
											if (dragPlayerId && dragPlayerId !== player.id)
												handleSwapPlayerStatuses(dragPlayerId, player.id);
											else {
												setDragOverPlayerId(null);
												setDragPlayerId(null);
											}
											setDragOverSection(null);
										}}
										onDragEnd={() => {
											setDragOverPlayerId(null);
											setDragPlayerId(null);
										}}
										className={`relative flex items-center gap-3 px-4 py-2.5 hover:bg-primary/5 transition-colors select-none ${player.isJunior ? "cursor-default" : "cursor-grab active:cursor-grabbing"} ${player.isUnavailable ? "opacity-50" : ""} ${dragOverPlayerId === player.id && dragPlayerId !== player.id ? "bg-primary/10 ring-1 ring-primary/40" : ""}`}
									>
										<span
											className={`shrink-0 px-1.5 py-0.5 bg-surface-bright rounded-sm text-[9px] font-black border-l-2 ${POSITION_BORDER_CLASS[player.position] || "border-zinc-500"} ${POSITION_TEXT_CLASS[player.position] || "text-zinc-300"}`}
										>
											{POSITION_SHORT_LABELS[player.position]}
										</span>
										<span className="flex-1 text-sm font-bold text-on-surface truncate">
											<PlayerLink playerId={player.id}>
												{player.name}
											</PlayerLink>
											{!!player.is_star &&
												(player.position === "MED" ||
													player.position === "ATA") && (
													<span className="ml-1 text-amber-400 text-[10px]">
														★
													</span>
												)}
											{player.isUnavailable &&
												(() => {
													const susp = player.suspension_until_matchweek || 0;
													const inj = player.injury_until_matchweek || 0;
													const cooldown =
														player.transfer_cooldown_until_matchweek || 0;
													const isSusp = susp > matchweekCount;
													const isInj = inj > matchweekCount;
													const isCooldown =
														!isSusp &&
														!isInj &&
														cooldown > 0 &&
														cooldown >= matchweekCount;
													if (isCooldown) {
														return (
															<span
																className="ml-1 text-xs"
																title="Em viagem — disponível na próxima jornada"
															>
																✈️ (1)
															</span>
														);
													}
													const left = isSusp
														? susp - matchweekCount
														: inj - matchweekCount;
													return (
														<span className="ml-1 text-xs">
															{isSusp ? "🟥" : "🩹"} ({left})
														</span>
													);
												})()}
										</span>
										<div className="shrink-0 grid grid-cols-3 items-center gap-x-2 text-right">
											<span className="text-sm font-black text-primary tabular-nums">
												{player.prev_skill != null &&
													player.prev_skill !== player.skill && (
														<span
															className={`mr-0.5 text-[9px] ${player.skill > player.prev_skill ? "text-emerald-400" : "text-red-400"}`}
														>
															{player.skill > player.prev_skill ? "▲" : "▼"}
														</span>
													)}
												{player.skill}
											</span>
											<span className="text-[12px] text-cyan-400/70 font-black tabular-nums">
												🛡️{player.resistance ?? "–"}
											</span>
											{(() => {
												const f = player.form ?? 100;
												return (
													<span
														className={`text-[9px] font-black ${
															f >= 115
																? "text-emerald-400"
																: f <= 85
																	? "text-rose-400"
																	: "text-on-surface-variant/40"
														}`}
													>
														{f >= 115 ? "💪" : f <= 85 ? "😩" : "👍"}
													</span>
												);
											})()}
										</div>
										{!player.isJunior && (
											<span
												className="shrink-0 w-6 h-6 rounded-full bg-emerald-500/15 flex items-center justify-center text-sm cursor-pointer"
												onClick={(e) => {
													e.stopPropagation();
													setOpenStatusPickerId((prev) =>
														prev === player.id ? null : player.id,
													);
												}}
											>
												🟢
											</span>
										)}
										{!player.isJunior &&
											openStatusPickerId === player.id &&
											(() => {
												const subCount = Object.entries(
													tactic.positions,
												).filter(
													([id, s]) =>
														s === "Suplente" && Number(id) !== player.id,
												).length;
												const titCount = Object.entries(
													tactic.positions,
												).filter(
													([id, s]) =>
														s === "Titular" && Number(id) !== player.id,
												).length;
												const subsFull = subCount >= 5;
												const titularesFull = titCount >= 11;
												return (
													<div
														className="absolute right-4 top-full z-50 bg-surface-container-high border border-outline-variant/40 rounded-md shadow-xl p-1 flex flex-col gap-0.5 min-w-35"
														onClick={(e) => e.stopPropagation()}
													>
														{[
															["Titular", "🟢", "Titular"],
															["Suplente", "🟡", "Suplente"],
															["Excluído", "⚫️", "Não convocado"],
														].map(([status, emoji, label]) => {
															const unavail =
																player.isUnavailable &&
																(status === "Titular" || status === "Suplente");
															const disabled =
																unavail ||
																(status === "Titular" &&
																	titularesFull &&
																	player.status !== "Titular") ||
																(status === "Suplente" &&
																	subsFull &&
																	player.status !== "Suplente");
															return (
																<button
																	key={status}
																	onClick={() =>
																		!disabled &&
																		handleSetPlayerStatus(player.id, status)
																	}
																	className={`px-3 py-2 rounded text-xs font-bold flex items-center gap-2 text-left ${disabled ? "opacity-40 cursor-not-allowed" : player.status === status ? "bg-surface-bright text-on-surface" : "hover:bg-surface-bright/60 text-on-surface-variant"}`}
																>
																	{emoji} {label}
																</button>
															);
														})}
													</div>
												);
											})()}
									</div>
								))}
							{annotatedSquad.filter((p) => p.status === "Titular").length ===
								0 && (
								<p className="px-4 py-6 text-center text-[11px] text-on-surface-variant/40 font-bold">
									Nenhum titular designado
								</p>
							)}
						</div>
					</div>

					{/* ── COL 3: SUPLENTES + NÃO CONVOCADOS ── */}
					<div
						className={`bg-surface-container rounded-lg overflow-hidden transition-[box-shadow,background-color] duration-150 ${
							dragOverSection === "Suplente"
								? "ring-2 ring-amber-500/50 bg-amber-500/[0.03]"
								: ""
						}`}
						onDragOver={(e) => {
							e.preventDefault();
							if (dragPlayerId) setDragOverSection("Suplente");
						}}
						onDragLeave={(e) => {
							if (!e.currentTarget.contains(e.relatedTarget))
								setDragOverSection(null);
						}}
						onDrop={(e) => {
							e.preventDefault();
							if (dragPlayerId) handleDropToSection(dragPlayerId, "Suplente");
							setDragOverSection(null);
						}}
					>
						<div className="px-4 py-2.5 flex items-center justify-between bg-surface-container-high/60 border-b border-outline-variant/10">
							<span className="text-[9px] uppercase tracking-[0.2em] font-black text-on-surface-variant">
								Suplentes
							</span>
							<span className="text-[9px] font-black">
								<span className="text-amber-400">
									{
										annotatedSquad.filter(
											(p) => p.status === "Suplente" && !p.isUnavailable,
										).length
									}
								</span>
								<span className="text-on-surface-variant">/5</span>
							</span>
						</div>
						<div className="divide-y divide-outline-variant/10">
							{annotatedSquad
								.filter((p) => p.status === "Suplente" && !p.isUnavailable)
								.map((player) => (
									<div
										key={player.id}
										draggable={!player.isJunior}
										data-player-id={player.id}
										data-player-status="Suplente"
										onDragStart={handleDragStart}
										onDragOver={(e) => {
											e.preventDefault();
											setDragOverPlayerId(player.id);
										}}
										onDragLeave={() => setDragOverPlayerId(null)}
										onDrop={(e) => {
											e.preventDefault();
											e.stopPropagation();
											if (dragPlayerId && dragPlayerId !== player.id)
												handleSwapPlayerStatuses(dragPlayerId, player.id);
											else {
												setDragOverPlayerId(null);
												setDragPlayerId(null);
											}
											setDragOverSection(null);
										}}
										onDragEnd={() => {
											setDragOverPlayerId(null);
											setDragPlayerId(null);
										}}
										className={`relative flex items-center gap-3 px-4 py-2.5 hover:bg-primary/5 transition-colors select-none ${player.isJunior ? "cursor-default" : "cursor-grab active:cursor-grabbing"} ${player.isUnavailable ? "opacity-35" : ""} ${dragOverPlayerId === player.id && dragPlayerId !== player.id ? "bg-amber-500/10 ring-1 ring-amber-500/40" : ""}`}
									>
										<span
											className={`shrink-0 px-1.5 py-0.5 bg-surface-bright rounded-sm text-[9px] font-black border-l-2 ${POSITION_BORDER_CLASS[player.position] || "border-zinc-500"} ${POSITION_TEXT_CLASS[player.position] || "text-zinc-300"}`}
										>
											{POSITION_SHORT_LABELS[player.position]}
										</span>
										<span className="flex-1 text-sm font-medium text-on-surface truncate">
											<PlayerLink playerId={player.id}>
												{player.name}
											</PlayerLink>
											{!!player.is_star &&
												(player.position === "MED" ||
													player.position === "ATA") && (
													<span className="ml-1 text-amber-400 text-[10px]">
														★
													</span>
												)}
											{player.isUnavailable &&
												(() => {
													const susp = player.suspension_until_matchweek || 0;
													const inj = player.injury_until_matchweek || 0;
													const cooldown =
														player.transfer_cooldown_until_matchweek || 0;
													const isSusp = susp > matchweekCount;
													const isInj = inj > matchweekCount;
													const isCooldown =
														!isSusp &&
														!isInj &&
														cooldown > 0 &&
														cooldown >= matchweekCount;
													if (isCooldown) {
														return (
															<span
																className="ml-1 text-xs"
																title="Em viagem — disponível na próxima jornada"
															>
																✈️ (1)
															</span>
														);
													}
													const left = isSusp
														? susp - matchweekCount
														: inj - matchweekCount;
													return (
														<span className="ml-1 text-xs">
															{isSusp ? "🟥" : "🩹"} ({left})
														</span>
													);
												})()}
										</span>
										<div className="shrink-0 grid grid-cols-3 items-center gap-x-2 text-right">
											<span className="text-sm font-black text-primary tabular-nums">
												{player.prev_skill != null &&
													player.prev_skill !== player.skill && (
														<span
															className={`mr-0.5 text-[9px] ${player.skill > player.prev_skill ? "text-emerald-400" : "text-red-400"}`}
														>
															{player.skill > player.prev_skill ? "▲" : "▼"}
														</span>
													)}
												{player.skill}
											</span>
											<span className="text-[12px] text-cyan-400/70 font-black tabular-nums">
												🛡️{player.resistance ?? "–"}
											</span>
											{(() => {
												const f = player.form ?? 100;
												return (
													<span
														className={`text-[9px] font-black ${
															f >= 115
																? "text-emerald-400"
																: f <= 85
																	? "text-rose-400"
																	: "text-on-surface-variant/40"
														}`}
													>
														{f >= 115 ? "💪" : f <= 85 ? "😩" : "👍"}
													</span>
												);
											})()}
										</div>
										{!player.isJunior && (
											<span
												className="shrink-0 w-6 h-6 rounded-full bg-amber-500/15 flex items-center justify-center text-sm cursor-pointer"
												onClick={(e) => {
													e.stopPropagation();
													setOpenStatusPickerId((prev) =>
														prev === player.id ? null : player.id,
													);
												}}
											>
												🟡
											</span>
										)}
										{!player.isJunior &&
											openStatusPickerId === player.id &&
											(() => {
												const titCount = Object.entries(
													tactic.positions,
												).filter(
													([id, s]) =>
														s === "Titular" && Number(id) !== player.id,
												).length;
												const subCount = Object.entries(
													tactic.positions,
												).filter(
													([id, s]) =>
														s === "Suplente" && Number(id) !== player.id,
												).length;
												const titularesFull = titCount >= 11;
												const subsFull = subCount >= 5;
												return (
													<div
														className="absolute right-4 top-full z-50 bg-surface-container-high border border-outline-variant/40 rounded-md shadow-xl p-1 flex flex-col gap-0.5 min-w-35"
														onClick={(e) => e.stopPropagation()}
													>
														{[
															["Titular", "🟢", "Titular"],
															["Suplente", "🟡", "Suplente"],
															["Excluído", "⚫️", "Não convocado"],
														].map(([status, emoji, label]) => {
															const disabled =
																(status === "Titular" &&
																	titularesFull &&
																	player.status !== "Titular") ||
																(status === "Suplente" &&
																	subsFull &&
																	player.status !== "Suplente");
															return (
																<button
																	key={status}
																	onClick={() =>
																		!disabled &&
																		handleSetPlayerStatus(player.id, status)
																	}
																	className={`px-3 py-2 rounded text-xs font-bold flex items-center gap-2 ${disabled ? "opacity-40 cursor-not-allowed" : player.status === status ? "bg-surface-bright text-on-surface" : "hover:bg-surface-bright/60 text-on-surface-variant"}`}
																>
																	{emoji} {label}
																</button>
															);
														})}
													</div>
												);
											})()}
									</div>
								))}
							{annotatedSquad.filter((p) => p.status === "Suplente").length ===
								0 && (
								<p className="px-4 py-4 text-center text-[11px] text-on-surface-variant/40 font-bold">
									Nenhum suplente
								</p>
							)}
						</div>
						{annotatedSquad.filter(
							(p) =>
								!p.isJunior &&
								(p.isUnavailable ||
									(p.status !== "Titular" && p.status !== "Suplente")),
						).length > 0 && (
							<div
								onDragOver={(e) => {
									e.preventDefault();
									e.stopPropagation();
									if (dragPlayerId) setDragOverSection("Excluído");
								}}
								onDragLeave={(e) => {
									if (!e.currentTarget.contains(e.relatedTarget))
										setDragOverSection(null);
								}}
								onDrop={(e) => {
									e.preventDefault();
									e.stopPropagation();
									if (dragPlayerId) handleDropToSection(dragPlayerId, "Excluído");
									setDragOverSection(null);
								}}
							>
								<div className="px-4 py-1.5 bg-surface-container-lowest/80 text-[8px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40 border-t border-outline-variant/10">
									Não convocados
								</div>
								{annotatedSquad
									.filter(
										(p) =>
											!p.isJunior &&
											(p.isUnavailable ||
												(p.status !== "Titular" && p.status !== "Suplente")),
									)
									.map((player) => (
										<div
											key={player.id}
											draggable
											data-player-id={player.id}
											data-player-status="Excluído"
											onDragStart={handleDragStart}
											onDragOver={(e) => {
												e.preventDefault();
												setDragOverPlayerId(player.id);
											}}
											onDragLeave={() => setDragOverPlayerId(null)}
											onDrop={(e) => {
												e.preventDefault();
												e.stopPropagation();
												if (dragPlayerId && dragPlayerId !== player.id)
													handleSwapPlayerStatuses(dragPlayerId, player.id);
												else {
													setDragOverPlayerId(null);
													setDragPlayerId(null);
												}
												setDragOverSection(null);
											}}
											onDragEnd={() => {
												setDragOverPlayerId(null);
												setDragPlayerId(null);
											}}
											className={`relative flex items-center gap-3 px-4 py-2 select-none transition-all cursor-grab active:cursor-grabbing ${dragOverPlayerId === player.id && dragPlayerId !== player.id ? "opacity-100 bg-zinc-700/40 ring-1 ring-zinc-500/40" : player.isUnavailable ? "bg-red-950/50 hover:bg-red-900/40 opacity-80" : "opacity-40 hover:opacity-70"}`}
										>
											<span
												className={`shrink-0 w-5.5 text-center text-[10px] font-black ${
													player.position === "GR"
														? "text-amber-400"
														: player.position === "DEF"
															? "text-sky-400"
															: player.position === "MED"
																? "text-primary"
																: "text-red-400"
												}`}
											>
												{POSITION_SHORT_LABELS[player.position]}
											</span>
											<span className="flex-1 text-sm font-medium text-on-surface-variant truncate">
												{player.name}
												{!!player.is_star &&
													(player.position === "MED" ||
														player.position === "ATA") && (
														<span className="ml-1 text-amber-400 text-[10px]">
															★
														</span>
													)}
											</span>
											<div className="shrink-0 grid grid-cols-3 items-center gap-x-2 text-right">
												<span className="text-xs font-bold text-on-surface-variant tabular-nums">
													{player.skill}
												</span>
												<span className="text-[12px] text-cyan-400/70 font-black tabular-nums">
													🛡️{player.resistance ?? "–"}
												</span>
												{(() => {
													const f = player.form ?? 100;
													return (
														<span
															className={`text-[9px] font-black ${
																f >= 115
																	? "text-emerald-400"
																	: f <= 85
																		? "text-rose-400"
																		: "text-on-surface-variant/40"
															}`}
														>
															{f >= 115 ? "💪" : f <= 85 ? "😩" : "👍"}
														</span>
													);
												})()}
											</div>
											<span
												className="shrink-0 w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-sm cursor-pointer"
												onClick={(e) => {
													e.stopPropagation();
													setOpenStatusPickerId((prev) =>
														prev === player.id ? null : player.id,
													);
												}}
											>
												⚫️
											</span>
											{openStatusPickerId === player.id &&
												(() => {
													const subCount = Object.entries(
														tactic.positions,
													).filter(
														([id, s]) =>
															s === "Suplente" && Number(id) !== player.id,
													).length;
													const titCount = Object.entries(
														tactic.positions,
													).filter(
														([id, s]) =>
															s === "Titular" && Number(id) !== player.id,
													).length;
													const subsFull = subCount >= 5;
													const titularesFull = titCount >= 11;
													return (
														<div
															className="absolute right-4 bottom-full mb-1 z-50 bg-surface-container-high border border-outline-variant/40 rounded-md shadow-xl p-1 flex flex-col gap-0.5 min-w-35"
															onClick={(e) => e.stopPropagation()}
														>
															{[
																["Titular", "🟢", "Titular"],
																["Suplente", "🟡", "Suplente"],
																["Excluído", "⚫️", "Não convocado"],
															].map(([status, emoji, label]) => {
																const unavail =
																	player.isUnavailable &&
																	(status === "Titular" ||
																		status === "Suplente");
																const disabled =
																	unavail ||
																	(status === "Titular" && titularesFull) ||
																	(status === "Suplente" && subsFull);
																return (
																	<button
																		key={status}
																		onClick={() =>
																			!disabled &&
																			handleSetPlayerStatus(player.id, status)
																		}
																		className={`px-3 py-2 rounded text-xs font-bold flex items-center gap-2 ${disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-surface-bright/60 text-on-surface-variant"}`}
																	>
																		{emoji} {label}
																	</button>
																);
															})}
														</div>
													);
												})()}
										</div>
									))}
							</div>
						)}
					</div>

					{/* ── COL 4: CAMPO + JOGAR ── */}
					<div className="flex flex-col gap-3">
						{/* JOGAR button — desktop */}
						<div className="max-lg:hidden bg-surface-container rounded-lg p-4">
							{(() => {
								const isReady = players.find((p) => p.name === me.name)?.ready;
								const isHalftime = showHalftimePanel && !isPlayingMatch;
								const isEliminatedCupSpectator =
									nextMatchSummary?.isCup && !nextMatchOpponent;
								const isDisabled = isEliminatedCupSpectator
									? !!isReady
									: !isHalftime && !isReady && !isLineupComplete;
								return (
									<>
										<button
											onClick={isHalftime ? handleHalftimeReady : handleReady}
											disabled={isDisabled}
											className={`w-full py-3.5 font-headline font-black rounded-sm text-base uppercase tracking-widest transition-all ${
												isReady
													? "bg-surface-bright text-on-surface-variant"
													: isDisabled
														? "bg-surface-bright text-on-surface-variant cursor-not-allowed opacity-40"
														: "bg-primary text-on-primary hover:brightness-110"
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
											<p className="text-[10px] text-zinc-600 mt-2 text-center">
												A jornada avança quando todos clicarem.
											</p>
										)}
									</>
								);
							})()}
						</div>

						{/* ── Mobile FAB ── botão flutuante circular no canto inferior direito.
                                 Só aparece quando a tática está bem definida (plantel completo). */}
						{(() => {
							const fabReady = players.find((p) => p.name === me.name)?.ready;
							const fabHalftime = showHalftimePanel && !isPlayingMatch;
							const fabCupSpec = nextMatchSummary?.isCup && !nextMatchOpponent;
							// Esconder se já está pronto (já clicou)
							if (fabReady) return null;
							// Só aparece com tática válida, halftime ou eliminado da taça
							if (!fabHalftime && !fabCupSpec && !isLineupComplete) return null;

							const fabIcon = fabHalftime
								? "skip_next"
								: fabCupSpec
									? "arrow_forward"
									: "play_arrow";
							const fabLabel = fabHalftime
								? "2ª Parte"
								: fabCupSpec
									? "Ver Taça"
									: "Jogar";

							return (
								<button
									onClick={fabHalftime ? handleHalftimeReady : handleReady}
									aria-label={fabLabel}
									className="lg:hidden fixed bottom-28 right-4 z-50 w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 duration-200"
									style={{
										background:
											"radial-gradient(circle at 35% 30%, rgba(255,255,255,0.25) 0%, transparent 70%), #10b981",
										boxShadow:
											"0 0 32px 8px rgba(16,185,129,0.50), 0 8px 20px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.25)",
									}}
								>
									{/* Anel de pulso exterior */}
									<span className="absolute inset-0 rounded-full bg-primary/40 animate-ping" />
									{/* Anel de pulso intermédio (offset) */}
									<span
										className="absolute inset-0 rounded-full bg-primary/20 animate-ping"
										style={{ animationDelay: "0.3s" }}
									/>
									<span className="material-symbols-outlined text-[28px] text-white drop-shadow-lg relative z-10 leading-none">
										{fabIcon}
									</span>
								</button>
							);
						})()}

						{/* Campo mini */}
						<div className="bg-surface-container rounded-lg overflow-hidden">
							{/* 2D Pitch */}
							{(() => {
								const titulares = annotatedSquad.filter(
									(p) => p.status === "Titular",
								);
								const grPlayers = titulares.filter((p) => p.position === "GR");
								const defPlayers = titulares.filter(
									(p) => p.position === "DEF",
								);
								const medPlayers = titulares.filter(
									(p) => p.position === "MED",
								);
								const ataPlayers = titulares.filter(
									(p) => p.position === "ATA",
								);
								const rows = [ataPlayers, medPlayers, defPlayers, grPlayers];
								const rowYs = ["7%", "30%", "55%", "79%"];
								const posColors = {
									GR: "bg-amber-500 text-zinc-900",
									DEF: "bg-sky-500 text-zinc-900",
									MED: "bg-primary text-on-primary",
									ATA: "bg-red-500 text-white",
								};
								return (
									<div
										className={`relative w-full transition-[box-shadow] duration-150 ${
											dragPlayerId &&
											dragOverSection === "Titular" &&
											annotatedSquad.find((p) => p.id === dragPlayerId)?.status !== "Titular"
												? "ring-4 ring-inset ring-primary/60"
												: ""
										}`}
										style={{
											aspectRatio: "9/12",
											background:
												"linear-gradient(180deg, #05430e 0%, #0b5e1a 50%, #05430e 100%)",
										}}
										onDragOver={(e) => {
											e.preventDefault();
											if (dragPlayerId) setDragOverSection("Titular");
										}}
										onDragLeave={(e) => {
											if (!e.currentTarget.contains(e.relatedTarget))
												setDragOverSection(null);
										}}
										onDrop={(e) => {
											e.preventDefault();
											if (dragPlayerId) handleDropToSection(dragPlayerId, "Titular");
											setDragOverSection(null);
										}}
									>
										<svg
											className="absolute inset-0 w-full h-full"
											viewBox="0 0 560 315"
											preserveAspectRatio="none"
											aria-hidden="true"
										>
											<rect
												x="10"
												y="10"
												width="540"
												height="295"
												fill="none"
												stroke="rgba(255,255,255,0.18)"
												strokeWidth="1.5"
												rx="2"
											/>
											<line
												x1="10"
												y1="157"
												x2="550"
												y2="157"
												stroke="rgba(255,255,255,0.15)"
												strokeWidth="1"
											/>
											<circle
												cx="280"
												cy="157"
												r="50"
												fill="none"
												stroke="rgba(255,255,255,0.12)"
												strokeWidth="1"
											/>
											<circle
												cx="280"
												cy="157"
												r="3"
												fill="rgba(255,255,255,0.18)"
											/>
											<rect
												x="168"
												y="10"
												width="224"
												height="70"
												fill="none"
												stroke="rgba(255,255,255,0.12)"
												strokeWidth="1"
											/>
											<rect
												x="224"
												y="10"
												width="112"
												height="26"
												fill="none"
												stroke="rgba(255,255,255,0.1)"
												strokeWidth="1"
											/>
											<rect
												x="168"
												y="235"
												width="224"
												height="70"
												fill="none"
												stroke="rgba(255,255,255,0.12)"
												strokeWidth="1"
											/>
											<rect
												x="224"
												y="289"
												width="112"
												height="26"
												fill="none"
												stroke="rgba(255,255,255,0.1)"
												strokeWidth="1"
											/>
										</svg>
										{rows.map((rowPlayers, ri) =>
											rowPlayers.length > 0 ? (
												<div
													key={ri}
													className="absolute w-full flex justify-evenly items-start px-4"
													style={{ top: rowYs[ri] }}
												>
													{rowPlayers.map((player) => (
														<div
															key={player.id}
															className="flex flex-col items-center gap-0.5 cursor-grab active:cursor-grabbing"
															style={{ maxWidth: "80px" }}
															draggable
															data-player-id={player.id}
															data-player-status="Titular"
															onDragStart={handleDragStart}
															onDragOver={(e) => {
																e.preventDefault();
																e.stopPropagation();
																setDragOverPlayerId(player.id);
															}}
															onDragLeave={() => setDragOverPlayerId(null)}
															onDrop={(e) => {
																e.preventDefault();
																e.stopPropagation();
																if (dragPlayerId && dragPlayerId !== player.id)
																	handleSwapPlayerStatuses(dragPlayerId, player.id);
																else {
																	setDragOverPlayerId(null);
																	setDragPlayerId(null);
																}
																setDragOverSection(null);
															}}
															onDragEnd={() => {
																setDragOverPlayerId(null);
																setDragPlayerId(null);
															}}
														>
															<div
																className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-xs border-2 border-white/20 shrink-0 relative shadow-lg transition-transform ${posColors[player.position] || "bg-zinc-500 text-white"} ${player.isUnavailable ? "opacity-50 ring-2 ring-red-500" : ""} ${dragPlayerId === player.id ? "opacity-40 scale-90" : ""} ${dragOverPlayerId === player.id && dragPlayerId !== player.id ? "ring-2 ring-white scale-110" : ""}`}
															>
																{POSITION_SHORT_LABELS[player.position] || "?"}
																{player.isUnavailable && (
																	<span className="absolute -top-1 -right-1 text-[9px] leading-none">
																		{(player.suspension_until_matchweek || 0) >
																		matchweekCount
																			? "🟥"
																			: (player.injury_until_matchweek || 0) >
																					matchweekCount
																				? "🩹"
																				: "✈️"}
																	</span>
																)}
															</div>
															<div
																className="bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-[9px] font-black text-white text-center cursor-pointer hover:text-primary transition-colors"
																style={{
																	maxWidth: "72px",
																	whiteSpace: "nowrap",
																	overflow: "hidden",
																	textOverflow: "ellipsis",
																}}
																onClick={() =>
																	socket.emit("requestPlayerHistory", {
																		playerId: player.id,
																	})
																}
															>
																{player.name.split(" ").pop()}
															</div>
															<span
																className="text-[9px] font-black"
																style={{
																	color: "var(--color-primary)",
																	textShadow: "0 1px 4px rgba(0,0,0,0.95)",
																}}
															>
																{player.skill}
															</span>
														</div>
													))}
												</div>
											) : null,
										)}
										{dragPlayerId &&
											dragOverSection === "Titular" &&
											annotatedSquad.find((p) => p.id === dragPlayerId)?.status !== "Titular" && (
											<div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
												<div className="bg-black/50 border border-primary/50 px-4 py-2 rounded-lg backdrop-blur-sm">
													<p className="text-primary font-black text-xs uppercase tracking-widest animate-pulse">
														↓ Soltar para entrar em campo
													</p>
												</div>
											</div>
										)}
										{!tactic.formation && titulares.length === 0 && (
											<div className="absolute inset-0 flex items-center justify-center">
												<p
													className="text-zinc-300 text-sm font-bold text-center px-8 leading-relaxed"
													style={{
														textShadow: "0 1px 4px rgba(0,0,0,0.9)",
													}}
												>
													Arrasta jogadores para o campo ou escolhe uma formação
												</p>
											</div>
										)}
										<div className="absolute inset-0 bg-linear-to-t from-black/30 to-transparent pointer-events-none" />
									</div>
								);
							})()}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
