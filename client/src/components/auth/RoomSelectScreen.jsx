import { motion } from "framer-motion";

/**
 * Vista full-screen de escolha de sala (fase "mode", depois do login).
 * Ocupa todo o viewport abaixo do header sticky: topo com saudação/acções,
 * tabs de modo, grelha de salas com scroll próprio e barra de ação fixa.
 *
 * @typedef {Object} RoomSelectScreenProps
 * @property {string} name
 * @property {Array} availableSaves - The list of available saves
 * @property {function} setAvailableSaves
 * @property {string} roomCode
 * @property {function} setRoomCode
 * @property {boolean} joining
 * @property {string} joinError
 * @property {boolean} disconnected
 * @property {function} resetAuthFlow
 * @property {string|null} joinMode
 * @property {function} selectJoinMode
 * @property {function} handleLogout
 * @property {string|null} token - The session token (used for authenticated API calls)
 * @property {boolean} isNewAccount
 * @property {function} handleJoin
 * @property {string} backendUrl
 */

const MODES = [
	{ mode: "new-game", icon: "add_circle", label: "Novo Jogo", sub: "Começa do zero" },
	{ mode: "saved-game", icon: "history", label: "Continuar", sub: "Época guardada" },
	{ mode: "friend-room", icon: "group_add", label: "Amigos", sub: "Código de sala" },
];

/** Formata uma data ISO como dd/mm/aaaa (pt-PT). */
const formatMatchDate = (iso) => {
	if (!iso) return null;
	try {
		return new Date(iso).toLocaleDateString("pt-PT", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
		});
	} catch {
		return null;
	}
};

const RoomSelectScreen = ({
	name,
	availableSaves,
	setAvailableSaves,
	roomCode,
	setRoomCode,
	joining,
	joinError,
	disconnected,
	resetAuthFlow,
	joinMode,
	selectJoinMode,
	handleLogout,
	token,
	isNewAccount,
	handleJoin,
	backendUrl,
}) => {
	// Sala jogada mais recentemente (para destaque na lista de saves)
	const lastPlayedSave = availableSaves.reduce(
		(best, s) =>
			s.lastPlayedAt &&
			(!best || new Date(s.lastPlayedAt) > new Date(best.lastPlayedAt))
				? s
				: best,
		null,
	);

	const ctaLabel = joining
		? "A GERAR CONTRATO..."
		: joinMode === "new-game"
			? "CRIAR JOGO"
			: joinMode === "saved-game"
				? "CONTINUAR JOGO"
				: joinMode === "friend-room"
					? "JUNTAR A AMIGOS"
					: "";

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.98 }}
			animate={{ opacity: 1, scale: 1 }}
			exit={{ opacity: 0, y: -16, transition: { duration: 0.3, ease: "easeIn" } }}
			transition={{ duration: 0.45, ease: "easeOut" }}
			className="relative z-10 mx-auto flex h-[calc(100dvh-4rem)] short:h-dvh w-full max-w-7xl flex-col px-4 sm:px-10 lg:px-16 pb-3 pt-4 sm:pb-4 sm:pt-8 short:pb-2 short:pt-2"
		>
			{/* ─── Topo: saudação + acções ─────────────────────── */}
			<motion.div
				initial={{ opacity: 0, y: 14 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 }}
				className="flex flex-wrap items-center justify-between gap-2 sm:gap-4"
			>
				<div className="short:min-w-0 short:flex-1">
					<p className="mb-1 text-[10px] font-black uppercase tracking-[0.4em] text-green-400/60 short:hidden">
						Sessão autenticada
					</p>
					<h2 className="font-headline text-2xl font-black leading-none tracking-tight text-white sm:text-3xl lg:text-4xl short:text-2xl short:truncate">
						Olá,{" "}
						<span className="text-green-400 drop-shadow-[0_0_12px_rgba(74,222,128,0.5)]">
							{name}
						</span>
					</h2>
				</div>
				<div className="flex items-center gap-2 sm:gap-3">
					<button
						onClick={resetAuthFlow}
						className="flex items-center gap-1 rounded-full border border-white/[0.08] px-3 py-1.5 sm:px-4 sm:py-2 short:py-1.5 text-[10px] font-black uppercase tracking-widest text-white/40 transition-colors hover:border-white/20 hover:text-white/70"
					>
						<span className="material-symbols-outlined text-[13px] leading-none">
							swap_horiz
						</span>
						Trocar conta
					</button>
					<button
						onClick={handleLogout}
						className="flex items-center gap-1 rounded-full border border-red-500/10 px-3 py-1.5 sm:px-4 sm:py-2 short:py-1.5 text-[10px] font-black uppercase tracking-widest text-red-400/50 transition-colors hover:border-red-500/30 hover:text-red-400"
						title="Terminar sessão completamente"
					>
						<span className="material-symbols-outlined text-[13px] leading-none">
							logout
						</span>
						Sair
					</button>
				</div>
			</motion.div>

			{isNewAccount && (
				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.35, delay: 0.12 }}
					className="mt-4 flex items-start gap-2 self-start rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 short:hidden"
				>
					<span className="material-symbols-outlined mt-0.5 text-base leading-tight text-green-400">
						check_circle
					</span>
					<p className="text-xs font-bold text-green-300">
						Conta criada com sucesso! Bem-vindo,{" "}
						<span className="text-green-200">{name}</span>. Escolhe o modo e
						comemça a época.
					</p>
				</motion.div>
			)}

			{/* ─── Tabs de modo ──────────────────────────────────── */}
			<motion.div
				initial={{ opacity: 0, y: 14 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.4, ease: "easeOut", delay: 0.15 }}
				className="mt-4 sm:mt-6 grid shrink-0 grid-cols-3 gap-2 sm:gap-3 short:mt-3"
			>
				{MODES.map(({ mode, icon, label, sub }) => (
					<button
						key={mode}
						onClick={() => selectJoinMode(mode)}
						className={`flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 rounded-xl border px-2 py-3 sm:px-5 sm:py-4 short:flex-row short:gap-2 short:py-2 text-left transition-all duration-200 ${
							joinMode === mode
								? "border-green-500/40 bg-green-500/10 shadow-[0_0_20px_rgba(74,222,128,0.08)]"
								: "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
						}`}
					>
						<span
							className={`material-symbols-outlined shrink-0 text-[20px] sm:text-[24px] short:text-[20px] leading-none ${
								joinMode === mode ? "text-green-400" : "text-white/30"
							}`}
						>
							{icon}
						</span>
						<div className="min-w-0 flex-1">
							<p
								className={`text-xs sm:text-sm font-black leading-tight text-center sm:text-left ${
									joinMode === mode ? "text-green-400" : "text-white/70"
								}`}
							>
								{label}
							</p>
							<p className="mt-0.5 hidden sm:block short:hidden text-[10px] leading-tight text-white/30">
								{sub}
							</p>
						</div>
						{joinMode === mode && (
							<span className="material-symbols-outlined text-[18px] leading-none text-green-400">
								check_circle
							</span>
						)}
					</button>
				))}
			</motion.div>

			{/* ─── Corpo: grelha de salas / formulário ─────────── */}
			<div className="mt-4 sm:mt-6 min-h-[140px] sm:min-h-0 short:min-h-[90px] flex-1 overflow-y-auto short:mt-1">
				{joinMode === "saved-game" && (
					<>
						{availableSaves.length === 0 ? (
							<motion.div
								initial={{ opacity: 0, y: 14 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.35, delay: 0.2 }}
								className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-6 py-16 short:py-8 text-center"
							>
								<span className="material-symbols-outlined text-5xl short:text-3xl text-white/15">
									folder_open
								</span>
								<div>
									<p className="font-headline text-lg font-black text-white">
										Nenhuma sala gravada
									</p>
									<p className="mt-1 text-sm text-white/40">
										Ainda não tens épocas guardadas com este treinador.
									</p>
								</div>
								<button
									onClick={() => selectJoinMode("new-game")}
									className="rounded-xl bg-green-500 px-6 py-3 text-xs font-black uppercase tracking-[0.2em] text-black shadow-[0_4px_20px_rgba(74,222,128,0.25)] transition-all hover:bg-green-400"
								>
									Criar novo jogo
								</button>
							</motion.div>
						) : (
							<div className="grid grid-cols-1 gap-4 pb-4 sm:pb-6 sm:grid-cols-2 xl:grid-cols-3 short:gap-3 short:pb-3">
								{availableSaves.map((save, i) => {
									const selected = roomCode === save.code;
									const isLastPlayed =
										save.code === lastPlayedSave?.code;
									return (
										<motion.div
											key={save.code}
											initial={{ opacity: 0, y: 16 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{
												duration: 0.35,
												ease: "easeOut",
												delay: Math.min(0.2 + i * 0.05, 0.7),
											}}
											onClick={() => setRoomCode(save.code)}
											className={`group relative flex cursor-pointer flex-col gap-3 rounded-2xl border p-5 short:p-3 transition-all duration-200 ${
												selected
													? "border-green-500/50 bg-green-500/[0.08] shadow-[0_0_30px_rgba(74,222,128,0.15)]"
													: "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04]"
											}`}
										>
											<div className="flex items-start justify-between gap-3">
												<div className="min-w-0">
													<p
														className={`font-headline truncate text-lg font-black uppercase tracking-tight ${
															selected
																? "text-white"
																: "text-white/80"
														}`}
													>
														{save.name}
													</p>
													<span className="font-mono text-[11px] text-white/35">
														{save.code}
													</span>
												</div>
												<div className="flex shrink-0 items-center gap-2">
													{save.isMultiplayer && (
														<span
															className={`inline-flex items-center gap-1 rounded border px-1.5 py-px text-[9px] font-black uppercase tracking-widest ${save.isAdmin ? "border-sky-500/30 bg-sky-500/20 text-sky-400" : "border-white/10 bg-white/5 text-white/40"}`}
															title={save.isAdmin ? "És o Admin desta sala" : "Sala multijogador — só o Admin pode apagá-la"}
														>
															{save.isAdmin ? "Admin" : `${save.coachCount || 2} treinadores`}
														</span>
													)}
													{isLastPlayed && (
														<span className="inline-flex items-center gap-1 rounded border border-green-500/30 bg-green-500/20 px-1.5 py-px text-[9px] font-black uppercase tracking-widest text-green-400">
															<span className="h-1 w-1 animate-pulse rounded-full bg-green-400" />
															Última jogada
														</span>
													)}
												</div>
											</div>

											{save.coaches && save.coaches.length > 0 && (
												<span className="inline-block w-fit max-w-full rounded border border-amber-500/30 bg-amber-500/20 px-1.5 py-px text-[9px] font-black uppercase tracking-widest text-amber-400">
													{save.coaches.join(", ")}
												</span>
											)}

											<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
												{save.teamName && (
													<span className="text-[11px] text-white/35">
														🏟️ {save.teamName}
													</span>
												)}
												{save.year && (
													<span className="text-[11px] text-white/35">
														📅 {save.year}
													</span>
												)}
												{formatMatchDate(save.lastPlayedAt) && (
													<span className="text-[11px] text-white/35">
														⚽ Última partida:{" "}
														{formatMatchDate(save.lastPlayedAt)}
													</span>
												)}
											</div>

											<div className="mt-auto flex items-center justify-between">
												<span
													className={`text-[9px] font-black uppercase tracking-widest ${
														selected ? "text-green-400" : "text-white/20"
													}`}
												>
													{selected ? "● Selecionada" : "Tocar para selecionar"}
												</span>
												<button
													onClick={(e) => {
														e.stopPropagation();
														const canDelete = !save.isMultiplayer || save.isAdmin;
														const confirmMsg = canDelete
															? save.isMultiplayer
																? `És o Admin da sala "${save.name}". Apagar permanentemente PARA TODOS os treinadores?`
																: `Apagar a sala "${save.name}" permanentemente?`
															: `Sair da sala "${save.name}"? A sala continua para os restantes treinadores (só o Admin pode apagá-la).`;
														if (!window.confirm(confirmMsg)) return;
														fetch(
															`${backendUrl}/saves/${encodeURIComponent(save.code)}`,
															{
																method: "DELETE",
																headers: {
																	"Content-Type": "application/json",
																},
																body: JSON.stringify({
																	name,
																	token,
																}),
															},
														)
															.then((r) => r.json())
															.then((data) => {
																if (data.ok) {
																	setAvailableSaves(
																		(prev) =>
																			prev.filter(
																				(s) => s.code !== save.code,
																			),
																	);
																	if (roomCode === save.code)
																		setRoomCode("");
																} else {
																	alert(
																		data.error ||
																			"Erro ao apagar sala.",
																	);
																}
															})
															.catch(() =>
																alert(
																	"Erro de ligação ao servidor.",
																),
															);
													}}
													className="rounded-lg p-1.5 text-white/20 transition-colors hover:bg-red-500/10 hover:text-red-400"
													title={
														!save.isMultiplayer || save.isAdmin
															? save.isMultiplayer
																? "Apagar sala (Admin: apaga para todos)"
																: "Apagar sala"
															: "Sair da sala (só o Admin pode apagar)"
													}
												>
													<span className="material-symbols-outlined text-[16px] leading-none">
														{!save.isMultiplayer || save.isAdmin ? "delete" : "logout"}
													</span>
												</button>
											</div>
										</motion.div>
									);
								})}
							</div>
						)}
					</>
				)}

				{(joinMode === "new-game" || joinMode === "friend-room") && (
					<motion.div
						initial={{ opacity: 0, y: 14 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.35, delay: 0.2 }}
						className="mx-auto max-w-xl"
					>
						<div className="space-y-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 short:p-4">
							<label className="block text-[10px] font-bold uppercase tracking-[0.3em] text-green-400/70">
								{joinMode === "new-game"
									? "Nome do novo jogo"
									: "Código da Sala"}
							</label>
							<input
								type="text"
								autoComplete="off"
								className={`w-full rounded-xl border bg-white/[0.04] p-4 short:py-3 text-center text-xl font-black uppercase tracking-widest text-white outline-none transition-all placeholder:text-white/20 focus:ring-1 ${
									joinMode === "new-game"
										? "border-green-500/30 focus:border-green-500/60 focus:ring-green-500/30"
										: "border-emerald-400/20 focus:border-emerald-400/60 focus:ring-emerald-400/30"
								}`}
								value={roomCode}
								placeholder="INVERNO"
								onChange={(e) =>
									setRoomCode(e.target.value.toUpperCase())
								}
								onKeyDown={(e) => {
									if (e.key === "Enter") handleJoin();
								}}
							/>
							<p className="text-center text-xs text-white/35">
								{joinMode === "new-game"
									? "Recebes um clube aleatório da 4ª Divisão."
									: "Pede o código ao teu amigo que criou a sala."}
							</p>
						</div>
					</motion.div>
				)}

				{!joinMode && (
					<motion.div
						initial={{ opacity: 0, y: 14 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.35, delay: 0.2 }}
						className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-6 py-16 short:py-8 text-center"
					>
						<span className="material-symbols-outlined text-5xl short:text-3xl text-white/15">
							sports_esports
						</span>
						<p className="font-headline text-lg font-black text-white">
							Como queres jogar hoje?
						</p>
						<p className="text-sm text-white/40">
							Escolhe um modo acima — novo jogo, época guardada ou sala de
							amigos.
						</p>
					</motion.div>
				)}
			</div>

			{/* ─── Barra de ação fixa ───────────────────────────── */}
			<motion.div
				initial={{ opacity: 0, y: 16 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.4, ease: "easeOut", delay: 0.25 }}
				className="mt-3 sm:mt-4 shrink-0 short:mt-2"
			>
				<div className="flex flex-col gap-2 sm:gap-3 rounded-2xl border border-white/[0.08] bg-[#0a1410]/85 p-3 sm:p-4 backdrop-blur-xl shadow-[0_-8px_40px_rgba(0,0,0,0.35)] sm:flex-row sm:items-center sm:justify-between short:flex-row short:items-center short:justify-between short:gap-1.5 short:px-2 short:py-1.5">
					<div className="min-w-0 flex-1">
						{roomCode ? (
							<div className="flex items-center gap-2.5">
								<span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.9)]" />
								<div className="min-w-0 short:flex short:items-baseline short:gap-x-2">
									<p className="shrink-0 text-[9px] font-black uppercase tracking-widest text-white/35 leading-none">
										Sala selecionada
									</p>
									<p className="font-headline truncate text-lg font-black uppercase tracking-tight text-white leading-tight short:min-w-0">
										{roomCode}
									</p>
								</div>
							</div>
						) : (
							<p className="text-xs text-white/35 font-bold">
								{!joinMode
									? "Escolhe um modo para continuar."
									: joinMode === "saved-game"
										? "Toca numa sala da grelha para a selecionar."
										: "Introduz o código e confirma."}
							</p>
						)}
						{joinError && (
							<p className="mt-1 text-xs sm:text-sm font-bold leading-tight text-red-400">
								⚠️ {joinError}
							</p>
						)}
						{!joinError && disconnected && (
							<p className="mt-1 text-xs sm:text-sm font-bold leading-tight text-red-400">
								⚠️ Sem ligação ao servidor. Tenta novamente.
							</p>
						)}
					</div>
					{joinMode && (
						<button
							onClick={handleJoin}
							disabled={!roomCode || joining}
							className={`relative overflow-hidden disabled:bg-white/[0.06] disabled:text-white/30 py-3 sm:py-4 short:py-2 px-6 sm:px-8 rounded-xl font-black text-sm uppercase tracking-[0.2em] transition-all active:scale-[0.98] group sm:w-auto w-full short:w-auto ${
								joinMode === "saved-game"
									? "bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_4px_20px_rgba(6,182,212,0.25)] hover:shadow-[0_4px_30px_rgba(6,182,212,0.4)]"
									: "bg-green-500 hover:bg-green-400 text-black shadow-[0_4px_20px_rgba(74,222,128,0.25)] hover:shadow-[0_4px_30px_rgba(74,222,128,0.4)]"
							}`}
						>
							<span className="relative z-10">{ctaLabel}</span>
							<div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
						</button>
					)}
				</div>
			</motion.div>
		</motion.div>
	);
};

export default RoomSelectScreen;
