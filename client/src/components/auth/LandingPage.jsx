import { AnimatePresence, motion } from "framer-motion";

/**
 * @typedef {Object} LandingPageProps
 * @property {string} authPhase - "login" | "register" | "mode"
 * @property {function} setAuthPhase
 * @property {string} name
 * @property {function} setName
 * @property {string} password
 * @property {function} setPassword
 * @property {string} confirmPassword
 * @property {function} setConfirmPassword
 * @property {string} roomCode
 * @property {function} setRoomCode
 * @property {boolean} authSubmitting
 * @property {string} authError
 * @property {function} setAuthError
 * @property {boolean} isNewAccount
 * @property {boolean} joining
 * @property {boolean} disconnected
 * @property {string} joinError
 * @property {function} setJoinError
 * @property {function} handleAuthenticate
 * @property {function} handleJoin
 * @property {function} resetAuthFlow
 * @property {function} selectJoinMode
 * @property {string|null} joinMode
 * @property {function} handleLogout
 * @property {Object|null} me - The user object (to show reconnection status)
 * @property {Array} availableSaves - The list of available saves
 * @property {function} setAvailableSaves
 * @property {string} backendUrl
 */

const LandingPage = ({
	authPhase,
	setAuthPhase,
	name,
	setName,
	password,
	setPassword,
	confirmPassword,
	setConfirmPassword,
	roomCode,
	setRoomCode,
	authSubmitting,
	authError,
	setAuthError,
	isNewAccount,
	joining,
	disconnected,
	joinError,
	setJoinError,
	handleAuthenticate,
	handleJoin,
	resetAuthFlow,
	selectJoinMode,
	joinMode,
	handleLogout,
	me,
	availableSaves,
	setAvailableSaves,
	backendUrl,
}) => {
	// 1. Reconnecting State
	if (me && !me.teamId) {
		return (
			<div className="min-h-screen bg-surface text-on-surface flex flex-col items-center justify-center p-6 pb-24">
				<h1 className="text-5xl font-headline font-black text-primary mb-6 tracking-tight">
					CashBall <span className="text-on-surface">26/27</span>
				</h1>
				<div className="bg-surface-container p-8 rounded-md w-full max-w-md relative overflow-hidden shadow-2xl text-center">
					<div className="absolute top-0 inset-x-0 h-0.5 bg-linear-to-r from-primary via-primary to-transparent"></div>
					<p className="text-[10px] uppercase tracking-[0.35em] text-on-surface-variant font-bold mb-3">
						A entrar na sala
					</p>
					<p className="text-2xl font-headline font-black text-on-surface mb-1">
						A reconectar...
					</p>
					<p className="text-xs text-on-surface-variant font-medium tracking-wide">
						{me.name} · {me.roomCode?.toUpperCase()}
					</p>
				</div>
			</div>
		);
	}

	const registerPasswordMismatch =
		confirmPassword !== "" && password !== confirmPassword;

	return (
		<div className="min-h-screen bg-surface text-on-surface flex flex-col relative overflow-hidden pb-16">
			{/* Background layer */}
			<div className="pointer-events-none fixed inset-0 z-0">
				<div className="absolute inset-0 grid-lines"></div>
				<div className="absolute inset-0 pitch-glow"></div>
				<div className="absolute inset-0 bg-linear-to-b from-transparent via-surface/20 to-surface/70"></div>
			</div>

			{/* Sticky header */}
			<header className="z-10 w-full border-b border-outline-variant/25 bg-surface/80 backdrop-blur-md sticky top-0">
				<div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
					<div className="flex items-center gap-2.5">
						<span className="text-2xl">⚽</span>
						<span className="font-headline font-black text-xl tracking-tighter">
							Cash<span className="text-tertiary">Ball</span>
							<span className="text-on-surface-variant font-bold ml-2 text-sm">
								26/27
							</span>
						</span>
					</div>
					<div className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full">
						<span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
						<span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary hidden sm:block">
							Época 26/27 · Activa
						</span>
					</div>
				</div>
			</header>

			{/* Hero + Auth card */}
			<div className="relative z-10 flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-16 px-6 sm:px-10 lg:px-16 py-14 max-w-7xl mx-auto w-full">
				{/* Left: Hero copy */}
				<div className="w-full lg:w-1/2 flex flex-col items-start text-left">
					<div className="inline-flex items-center gap-2 border border-outline-variant/40 bg-surface-container px-3 py-1 rounded-full mb-8">
						<span className="text-[10px] uppercase tracking-[0.35em] text-on-surface-variant font-bold">
							Gestão de Futebol Multiplayer
						</span>
					</div>
					<h1 className="font-headline font-black leading-none tracking-tighter mb-8">
						<span className="block text-6xl sm:text-7xl lg:text-[5.5rem] text-on-surface">
							TREINA.
						</span>
						<span className="block text-6xl sm:text-7xl lg:text-[5.5rem] text-tertiary drop-shadow-[0_0_32px_rgba(233,195,73,0.2)]">
							PROSPERA.
						</span>
						<span className="block text-6xl sm:text-7xl lg:text-[5.5rem] text-on-surface">
							REPETE.
						</span>
					</h1>
					<p className="text-base text-on-surface-variant leading-relaxed mb-10 max-w-md">
						A evolução moderna da gestão de futebol clássica. Controla as
						tácticas, as finanças e o destino do teu clube em ligas multiplayer
						com até 8 treinadores.
					</p>
					<div className="flex flex-wrap gap-3">
						{[
							{ icon: "🏆", label: "Divisões", value: "4 Ligas" },
							{ icon: "👥", label: "Treinadores", value: "Até 8" },
							{ icon: "⚡", label: "Simulação", value: "Ao vivo" },
						].map(({ icon, label, value }) => (
							<div
								key={label}
								className="flex items-center gap-2.5 bg-surface-container border border-outline-variant/30 px-4 py-2.5 rounded-lg"
							>
								<span className="text-lg">{icon}</span>
								<div>
									<p className="text-[9px] uppercase tracking-wider text-on-surface-variant font-bold leading-none mb-0.5">
										{label}
									</p>
									<p className="text-sm font-black text-on-surface leading-none">
										{value}
									</p>
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Right: Auth glass card */}
				<div className="w-full lg:w-1/2 flex justify-center lg:justify-end">
					<div className="glass-card rounded-2xl w-full max-w-md relative overflow-hidden shadow-2xl">
						{/* Corner accents */}
						<div className="absolute top-2 right-2 w-12 h-12 border-t border-r border-primary/25 rounded-tr-xl pointer-events-none"></div>
						<div className="absolute bottom-2 left-2 w-12 h-12 border-b border-l border-primary/25 rounded-bl-xl pointer-events-none"></div>
						{/* Top accent bar */}
						<div className="absolute top-0 inset-x-0 h-0.5 bg-linear-to-r from-primary/40 via-primary to-primary/40"></div>

						{/* ─── LOGIN PHASE ───────────────────────── */}
						<AnimatePresence mode="wait">
							{authPhase === "login" && (
								<motion.div
									key="login"
									initial={{ opacity: 0, x: -20 }}
									animate={{ opacity: 1, x: 0 }}
									exit={{ opacity: 0, x: 20 }}
									className="p-8 space-y-5"
								>
									<div className="space-y-1 text-center mb-4">
										<p className="text-[10px] text-on-surface-variant uppercase font-black tracking-[0.4em]">
											Painel do Treinador
										</p>
										<h2 className="text-2xl font-headline font-black text-on-surface tracking-tight">
											Acede à tua conta
										</h2>
										<p className="text-xs text-on-surface-variant">
											Depois escolhes novo jogo, época guardada ou amigos.
										</p>
									</div>
									<div className="space-y-3">
										<div>
											<label className="block text-[10px] uppercase text-on-surface-variant mb-2 font-bold tracking-wider">
												Nome de Treinador
											</label>
											<input
												type="text"
												className="w-full bg-surface border border-outline-variant p-4 rounded-sm text-on-surface text-lg font-black outline-none transition-all placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary"
												value={name}
												placeholder="Ex: Cobra"
												onChange={(e) => {
													setName(e.target.value);
													setAuthError("");
												}}
											/>
										</div>
										<div>
											<label className="block text-[10px] uppercase text-on-surface-variant mb-2 font-bold tracking-wider">
												Palavra-passe
											</label>
											<input
												type="password"
												className="w-full bg-surface border border-outline-variant p-4 rounded-sm text-on-surface text-lg font-black outline-none transition-all placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary"
												value={password}
												placeholder="••••••••"
												onChange={(e) => {
													setPassword(e.target.value);
													setAuthError("");
												}}
												onKeyDown={(e) => {
													if (e.key === "Enter") handleAuthenticate("login");
												}}
											/>
										</div>
									</div>
									<button
										onClick={() => handleAuthenticate("login")}
										disabled={!name.trim() || !password || authSubmitting}
										className="w-full bg-primary hover:brightness-110 disabled:bg-surface-bright disabled:text-on-surface-variant text-on-primary py-4 rounded font-black text-base uppercase tracking-[0.2em] transition-all active:scale-95"
									>
										{authSubmitting ? "A VALIDAR..." : "ENTRAR"}
									</button>
									<button
										onClick={() => {
											setConfirmPassword("");
											setAuthError("");
											setJoinError("");
											setAuthPhase("register");
										}}
										className="w-full border border-outline-variant/60 bg-surface-container hover:border-primary/40 text-on-surface py-3 rounded font-black text-xs uppercase tracking-[0.2em] transition-all"
									>
										Criar conta
									</button>
									{authError && (
										<p className="text-red-400 text-sm text-center font-bold">
											⚠️ {authError}
										</p>
									)}
									{!authError && disconnected && (
										<p className="text-red-400 text-sm text-center font-bold">
											⚠️ Sem ligação ao servidor. Tenta novamente.
										</p>
									)}
								</motion.div>
							)}

							{/* ─── REGISTER PHASE ────────────────────── */}
							{authPhase === "register" && (
								<motion.div
									key="register"
									initial={{ opacity: 0, x: 20 }}
									animate={{ opacity: 1, x: 0 }}
									exit={{ opacity: 0, x: -20 }}
									className="p-8 space-y-5"
								>
									<button
										onClick={resetAuthFlow}
										className="text-xs text-zinc-500 hover:text-zinc-300 font-black uppercase tracking-widest flex items-center gap-1"
									>
										← Voltar
									</button>
									<div className="space-y-1 text-center">
										<p className="text-[10px] text-on-surface-variant uppercase font-black tracking-[0.4em]">
											Nova conta
										</p>
										<h2 className="text-2xl font-headline font-black text-on-surface tracking-tight">
											Cria a tua conta de treinador
										</h2>
									</div>
									<div className="space-y-3">
										<div>
											<label className="block text-[10px] uppercase text-on-surface-variant mb-2 font-bold tracking-wider">
												Nome de Treinador
											</label>
											<input
												type="text"
												className="w-full bg-surface border border-outline-variant p-4 rounded-sm text-on-surface text-lg font-black outline-none transition-all placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary"
												value={name}
												placeholder="Ex: Amorim"
												onChange={(e) => {
													setName(e.target.value);
													setAuthError("");
												}}
											/>
										</div>
										<div>
											<label className="block text-[10px] uppercase text-on-surface-variant mb-2 font-bold tracking-wider">
												Palavra-passe
											</label>
											<input
												type="password"
												className="w-full bg-surface border border-outline-variant p-4 rounded-sm text-on-surface text-lg font-black outline-none transition-all placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary"
												value={password}
												placeholder="••••••••"
												onChange={(e) => {
													setPassword(e.target.value);
													setAuthError("");
												}}
											/>
										</div>
										<div>
											<label className="block text-[10px] uppercase text-on-surface-variant mb-2 font-bold tracking-wider">
												Confirmar Palavra-passe
											</label>
											<input
												type="password"
												className={`w-full bg-surface border p-4 rounded-sm text-on-surface text-lg font-black outline-none transition-all placeholder:text-on-surface-variant/40 focus:ring-2 ${
													registerPasswordMismatch
														? "border-red-500 focus:ring-red-500"
														: "border-outline-variant focus:ring-primary"
												}`}
												value={confirmPassword}
												placeholder="••••••••"
												onChange={(e) => {
													setConfirmPassword(e.target.value);
													setAuthError("");
												}}
												onKeyDown={(e) => {
													if (e.key === "Enter" && !registerPasswordMismatch) {
														handleAuthenticate("register");
													}
												}}
											/>
											{registerPasswordMismatch && (
												<p className="text-red-400 text-xs mt-1 font-bold">
													As palavras-passe não coincidem.
												</p>
											)}
										</div>
									</div>
									<button
										onClick={() => handleAuthenticate("register")}
										disabled={
											!name.trim() ||
											!password ||
											authSubmitting ||
											registerPasswordMismatch
										}
										className="w-full bg-primary hover:brightness-110 disabled:bg-surface-container disabled:text-on-surface-variant text-on-primary py-4 rounded font-black text-base uppercase tracking-[0.2em] transition-all active:scale-95"
									>
										{authSubmitting ? "A CRIAR CONTA..." : "CRIAR CONTA"}
									</button>
									{authError && (
										<p className="text-red-400 text-sm text-center font-bold">
											⚠️ {authError}
										</p>
									)}
									{!authError && disconnected && (
										<p className="text-red-400 text-sm text-center font-bold">
											⚠️ Sem ligação ao servidor. Tenta novamente.
										</p>
									)}
								</motion.div>
							)}

							{/* ─── MODE PHASE ────────────────────────── */}
							{authPhase === "mode" && (
								<motion.div
									key="mode"
									initial={{ opacity: 0, scale: 0.95 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0, scale: 1.05 }}
									className="p-6 space-y-5"
								>
									{/* Banner de boas-vindas para conta recém-criada */}
									{isNewAccount && (
										<div className="flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded px-3 py-2">
											<span className="material-symbols-outlined text-emerald-400 text-base leading-tight mt-0.5">
												check_circle
											</span>
											<p className="text-emerald-300 text-xs font-bold">
												Conta criada com sucesso! Bem-vindo,{" "}
												<span className="text-emerald-200">{name}</span>.
											</p>
										</div>
									)}
									<div className="space-y-3 text-center">
										<div className="space-y-1">
											<p className="text-[10px] text-on-surface-variant uppercase font-black tracking-[0.4em]">
												Sessão autenticada
											</p>
											<h2 className="text-xl font-headline font-black text-on-surface tracking-tight">
												Olá, <span className="text-primary">{name}</span>
											</h2>
											<p className="text-xs text-on-surface-variant">
												Como queres jogar hoje?
											</p>
										</div>
										<div className="flex items-center justify-center gap-3">
											<button
												onClick={resetAuthFlow}
												className="flex items-center gap-1 text-[10px] text-on-surface-variant hover:text-on-surface font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-outline-variant/30 hover:border-outline-variant transition-colors"
											>
												<span className="material-symbols-outlined text-[13px] leading-none">
													swap_horiz
												</span>
												Trocar conta
											</button>
											<button
												onClick={handleLogout}
												className="flex items-center gap-1 text-[10px] text-error/60 hover:text-error font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-error/20 hover:border-error/40 transition-colors"
												title="Terminar sessão completamente"
											>
												<span className="material-symbols-outlined text-[13px] leading-none">
													logout
												</span>
												Sair
											</button>
										</div>
									</div>

									<div className="flex flex-col sm:flex-row gap-2">
										{[
											{
												mode: "new-game",
												icon: "add_circle",
												label: "Novo Jogo",
												sub: "Começa do zero",
											},
											{
												mode: "saved-game",
												icon: "history",
												label: "Continuar",
												sub: "Época guardada",
											},
											{
												mode: "friend-room",
												icon: "group_add",
												label: "Amigos",
												sub: "Código de sala",
											},
										].map(({ mode, icon, label, sub }) => (
											<button
												key={mode}
												onClick={() => selectJoinMode(mode)}
												className={`flex-1 flex items-center sm:flex-col sm:items-start gap-3 sm:gap-1 rounded-xl border px-4 py-3 sm:p-4 text-left transition-all ${
													joinMode === mode
														? "border-primary bg-primary/10"
														: "border-outline-variant/20 bg-surface hover:border-outline-variant/50"
												}`}
											>
												<span
													className={`material-symbols-outlined text-[22px] shrink-0 leading-none ${
														joinMode === mode
															? "text-primary"
															: "text-on-surface-variant"
													}`}
												>
													{icon}
												</span>
												<div className="min-w-0">
													<p
														className={`text-sm font-black leading-tight ${
															joinMode === mode
																? "text-primary"
																: "text-on-surface"
														}`}
													>
														{label}
													</p>
													<p className="text-[10px] text-on-surface-variant leading-tight mt-0.5 hidden sm:block">
														{sub}
													</p>
												</div>
												{joinMode === mode && (
													<span className="ml-auto sm:hidden material-symbols-outlined text-primary text-[18px] leading-none">
														check_circle
													</span>
												)}
											</button>
										))}
									</div>

									{joinMode === "new-game" && (
										<div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
											<label className="block text-[10px] uppercase text-on-surface-variant font-bold tracking-[0.3em]">
												Nome do novo jogo
											</label>
											<input
												type="text"
												className="w-full bg-surface border border-outline-variant p-3.5 rounded-lg text-on-surface text-base font-black outline-none transition-all placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary uppercase"
												value={roomCode}
												placeholder="INVERNO"
												onChange={(e) =>
													setRoomCode(e.target.value.toUpperCase())
												}
												onKeyDown={(e) => {
													if (e.key === "Enter") handleJoin();
												}}
											/>
											<p className="text-xs text-on-surface-variant/70">
												Recebes um clube aleatório da 4ª Divisão.
											</p>
										</div>
									)}

									{joinMode === "saved-game" && (
										<div className="space-y-3 rounded-xl border border-outline-variant/20 bg-surface-container p-4">
											<label className="block text-[10px] uppercase text-cyan-300 font-bold tracking-[0.3em]">
												As tuas Salas Gravadas
											</label>
											{availableSaves.length === 0 ? (
												<p className="text-on-surface-variant text-sm py-2">
													{name
														? "Nenhum save encontrado para este treinador."
														: "Introduz o teu nome para ver as tuas salas."}
												</p>
											) : (
												<div className="space-y-2 max-h-48 overflow-y-auto">
													{availableSaves.map((save) => (
														<div
															key={save.code}
															onClick={() => setRoomCode(save.code)}
															className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all ${
																roomCode === save.code
																	? "border-cyan-500 bg-cyan-500/15 text-white"
																	: "border-outline-variant/20 bg-surface text-on-surface-variant hover:border-outline-variant hover:text-on-surface"
															}`}
														>
															<div className="flex flex-col flex-1 min-w-0">
																<span className="font-black text-sm uppercase tracking-widest truncate">
																	{save.name}
																</span>
																<span className="text-[10px] font-mono text-on-surface-variant/60">
																	{save.code}
																</span>
																{(save.teamName || save.year) && (
																	<div className="flex items-center gap-2 mt-0.5">
																		{save.teamName && (
																			<span className="text-[10px] text-on-surface-variant/50 truncate">
																				🏟️ {save.teamName}
																			</span>
																		)}
																		{save.year && (
																			<span className="text-[10px] text-on-surface-variant/50">
																				📅 {save.year}
																			</span>
																		)}
																	</div>
																)}
															</div>
															<button
																onClick={(e) => {
																	e.stopPropagation();
																	if (
																		!window.confirm(
																			`Apagar a sala "${save.name}" permanentemente?`,
																		)
																	)
																		return;
																	fetch(
																		`${backendUrl}/saves/${encodeURIComponent(save.code)}`,
																		{
																			method: "DELETE",
																			headers: {
																				"Content-Type": "application/json",
																			},
																			body: JSON.stringify({
																				name,
																				password,
																			}),
																		},
																	)
																		.then((r) => r.json())
																		.then((data) => {
																			if (data.ok) {
																				setAvailableSaves((prev) =>
																					prev.filter(
																						(s) => s.code !== save.code,
																					),
																				);
																				if (roomCode === save.code)
																					setRoomCode("");
																			} else {
																				alert(
																					data.error || "Erro ao apagar sala.",
																				);
																			}
																		})
																		.catch(() =>
																			alert("Erro de ligação ao servidor."),
																		);
																}}
																className="shrink-0 text-on-surface-variant/40 hover:text-error transition-colors p-1.5 rounded"
																title="Apagar sala"
															>
																<span className="material-symbols-outlined text-[16px] leading-none">
																	delete
																</span>
															</button>
														</div>
													))}
												</div>
											)}
										</div>
									)}

									{joinMode === "friend-room" && (
										<div className="space-y-3 rounded-xl border border-outline-variant/20 bg-surface-container p-4">
											<label className="block text-[10px] uppercase text-emerald-300 font-bold tracking-[0.3em]">
												Código da Sala
											</label>
											<input
												type="text"
												className="w-full bg-surface border border-outline-variant p-3.5 rounded-lg text-on-surface text-base font-black outline-none transition-all placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary uppercase tracking-widest"
												value={roomCode}
												placeholder="INVERNO"
												onChange={(e) =>
													setRoomCode(e.target.value.toUpperCase())
												}
												onKeyDown={(e) => {
													if (e.key === "Enter") handleJoin();
												}}
											/>
											<p className="text-xs text-on-surface-variant/70">
												Pede o código ao teu amigo que criou a sala.
											</p>
										</div>
									)}

									{joinMode && (
										<button
											onClick={handleJoin}
											disabled={!roomCode || joining}
											className={`w-full disabled:bg-surface-container disabled:text-on-surface-variant py-4 rounded-lg font-black text-sm uppercase tracking-[0.2em] transition-all active:scale-95 ${
												joinMode === "saved-game"
													? "bg-cyan-500 hover:bg-cyan-400 text-zinc-950"
													: "bg-primary hover:brightness-110 text-on-primary"
											}`}
										>
											{joining
												? "A GERAR CONTRATO..."
												: joinMode === "new-game"
													? "CRIAR JOGO"
													: joinMode === "saved-game"
														? "CONTINUAR JOGO"
														: "JUNTAR A AMIGOS"}
										</button>
									)}

									{joinError && (
										<p className="text-red-400 text-sm text-center font-bold">
											⚠️ {joinError}
										</p>
									)}
									{!joinError && disconnected && (
										<p className="text-red-400 text-sm text-center font-bold">
											⚠️ Sem ligação ao servidor. Tenta novamente.
										</p>
									)}
								</motion.div>
							)}
						</AnimatePresence>
					</div>
				</div>
			</div>

			{/* Features strip */}
			<div className="relative z-10 w-full border-t border-outline-variant/20 bg-surface-container/50 backdrop-blur-sm">
				<div className="max-w-7xl mx-auto px-6 lg:px-10 py-10">
					<div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
						{[
							{
								icon: "🌍",
								label: "4 Divisões",
								desc: "Primeira Liga, Segunda, Liga 3 e Campeonato de Portugal com promoção e descida.",
							},
							{
								icon: "👥",
								label: "Até 8 Treinadores",
								desc: "Multiplayer assíncrono — submete as tácticas quando quiseres, simula em grupo.",
							},
							{
								icon: "💰",
								label: "Finanças & Contratos",
								desc: "Gere o orçamento, renegocia contratos e evita a falência do clube.",
							},
							{
								icon: "⚡",
								label: "Simulação ao Vivo",
								desc: "Eventos em tempo real. Acompanhe os jogos e notícias à medida que acontecem.",
							},
						].map(({ icon, label, desc }) => (
							<div
								key={label}
								className="bg-surface border border-outline-variant/20 hover:border-tertiary/30 rounded-xl p-5 transition-all group"
							>
								<div className="w-10 h-10 flex items-center justify-center text-xl bg-surface-container-high rounded-lg mb-4 group-hover:bg-tertiary/10 transition-colors">
									{icon}
								</div>
								<p className="font-headline font-black text-sm text-on-surface mb-1.5 tracking-tight">
									{label}
								</p>
								<p className="text-xs text-on-surface-variant leading-relaxed">
									{desc}
								</p>
							</div>
						))}
					</div>
				</div>
			</div>

			{/* Footer */}
			<footer className="relative z-10 border-t border-outline-variant/20 bg-surface py-5">
				<div className="max-w-7xl mx-auto px-6 lg:px-10 flex items-center justify-between">
					<span className="text-xs text-on-surface-variant font-bold">
						⚽ CashBall 26/27
					</span>
					<span className="text-xs text-on-surface-variant/40">
						v0.2a-TESTING © 2026 by Fábio Silva
					</span>
				</div>
			</footer>
		</div>
	);
};

export default LandingPage;
