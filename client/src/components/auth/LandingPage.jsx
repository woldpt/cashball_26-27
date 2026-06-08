import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";

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

/** Animated particle canvas for background effect */
const ParticleCanvas = () => {
	const canvasRef = useRef(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		let animId;

		const resize = () => {
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;
		};
		resize();
		window.addEventListener("resize", resize);

		const particles = Array.from({ length: 55 }, () => ({
			x: Math.random() * window.innerWidth,
			y: Math.random() * window.innerHeight,
			r: Math.random() * 1.4 + 0.3,
			dx: (Math.random() - 0.5) * 0.25,
			dy: (Math.random() - 0.5) * 0.25,
			alpha: Math.random() * 0.5 + 0.15,
		}));

		const draw = () => {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			for (const p of particles) {
				ctx.beginPath();
				ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
				ctx.fillStyle = `rgba(74,222,128,${p.alpha})`;
				ctx.fill();
				p.x += p.dx;
				p.y += p.dy;
				if (p.x < 0) p.x = canvas.width;
				if (p.x > canvas.width) p.x = 0;
				if (p.y < 0) p.y = canvas.height;
				if (p.y > canvas.height) p.y = 0;
			}
			animId = requestAnimationFrame(draw);
		};
		draw();

		return () => {
			cancelAnimationFrame(animId);
			window.removeEventListener("resize", resize);
		};
	}, []);

	return (
		<canvas
			ref={canvasRef}
			className="pointer-events-none fixed inset-0 z-0 opacity-40"
		/>
	);
};

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
			<div className="min-h-screen bg-[#080d0a] text-white flex flex-col items-center justify-center p-6 pb-24">
				<ParticleCanvas />
				<motion.div
					initial={{ opacity: 0, scale: 0.95 }}
					animate={{ opacity: 1, scale: 1 }}
					className="relative bg-[#0e1a12]/80 border border-green-500/20 backdrop-blur-xl p-8 rounded-2xl w-full max-w-md shadow-[0_0_60px_rgba(74,222,128,0.08)] text-center"
				>
					<div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-green-400/60 to-transparent rounded-t-2xl" />
					<div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
						<span className="material-symbols-outlined text-green-400 text-2xl animate-spin" style={{ animationDuration: "2s" }}>
							autorenew
						</span>
					</div>
					<p className="text-[10px] uppercase tracking-[0.35em] text-green-400/70 font-bold mb-2">
						A entrar na sala
					</p>
					<p className="text-2xl font-headline font-black text-white mb-1">
						A reconectar...
					</p>
					<p className="text-xs text-white/40 font-medium tracking-wide">
						{me.name} · {me.roomCode?.toUpperCase()}
					</p>
				</motion.div>
			</div>
		);
	}

	const registerPasswordMismatch =
		confirmPassword !== "" && password !== confirmPassword;

	return (
		<div className="min-h-screen bg-[#060b08] text-white flex flex-col relative overflow-hidden pb-16">
			{/* Particle background */}
			<ParticleCanvas />

			{/* Background layers */}
			<div className="pointer-events-none fixed inset-0 z-0">
				{/* Pitch grid lines */}
				<div
					className="absolute inset-0 opacity-[0.04]"
					style={{
						backgroundImage: `
							linear-gradient(rgba(74,222,128,1) 1px, transparent 1px),
							linear-gradient(90deg, rgba(74,222,128,1) 1px, transparent 1px)
						`,
						backgroundSize: "80px 80px",
					}}
				/>
				{/* Center circle glow */}
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-green-500/[0.04] blur-3xl" />
				{/* Top-right accent glow */}
				<div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-emerald-400/[0.06] blur-3xl" />
				{/* Bottom-left accent */}
				<div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full bg-green-600/[0.05] blur-3xl" />
				{/* Vignette */}
				<div className="absolute inset-0 bg-gradient-to-b from-[#060b08]/60 via-transparent to-[#060b08]/80" />
			</div>

			{/* Sticky header */}
			<header className="z-10 w-full border-b border-white/[0.06] bg-[#060b08]/70 backdrop-blur-xl sticky top-0">
				<div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="w-8 h-8 rounded-lg bg-green-500/15 border border-green-500/30 flex items-center justify-center text-base">
							⚽
						</div>
						<span className="font-headline font-black text-xl tracking-tighter text-white">
							Cash<span className="text-green-400">Ball</span>
							<span className="text-white/30 font-bold ml-2 text-sm">26/27</span>
						</span>
					</div>
					<div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full">
						<span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
						<span className="text-[10px] font-black uppercase tracking-[0.3em] text-green-400 hidden sm:block">
							Época 26/27 · Activa
						</span>
					</div>
				</div>
			</header>

			{/* Hero + Auth card */}
			<div className="relative z-10 flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-16 px-6 sm:px-10 lg:px-16 py-14 max-w-7xl mx-auto w-full">
				{/* Left: Hero copy */}
				<motion.div
					initial={{ opacity: 0, x: -30 }}
					animate={{ opacity: 1, x: 0 }}
					transition={{ duration: 0.6, ease: "easeOut" }}
					className="w-full lg:w-1/2 flex flex-col items-start text-left"
				>
					<div className="inline-flex items-center gap-2 border border-green-500/20 bg-green-500/5 px-3 py-1 rounded-full mb-8">
						<span className="w-1 h-1 rounded-full bg-green-400" />
						<span className="text-[10px] uppercase tracking-[0.35em] text-green-400/80 font-bold">
							Gestão de Futebol Multiplayer
						</span>
					</div>

					<h1 className="font-headline font-black leading-none tracking-tighter mb-8">
						<motion.span
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.1, duration: 0.5 }}
							className="block text-6xl sm:text-7xl lg:text-[5.5rem] text-white"
						>
							TREINA.
						</motion.span>
						<motion.span
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.2, duration: 0.5 }}
							className="block text-6xl sm:text-7xl lg:text-[5.5rem] text-green-400 drop-shadow-[0_0_40px_rgba(74,222,128,0.35)]"
						>
							PROSPERA.
						</motion.span>
						<motion.span
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.3, duration: 0.5 }}
							className="block text-6xl sm:text-7xl lg:text-[5.5rem] text-white"
						>
							REPETE.
						</motion.span>
					</h1>

					<motion.p
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.45, duration: 0.5 }}
						className="text-base text-white/50 leading-relaxed mb-10 max-w-md"
					>
						A evolução moderna da gestão de futebol clássica. Controla as
						tácticas, as finanças e o destino do teu clube em ligas multiplayer
						com até 8 treinadores.
					</motion.p>

					<motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.55, duration: 0.5 }}
						className="flex flex-wrap gap-3"
					>
						{[
							{ icon: "🏆", label: "Divisões", value: "4 Ligas" },
							{ icon: "👥", label: "Treinadores", value: "Até 8" },
							{ icon: "⚡", label: "Simulação", value: "Ao vivo" },
						].map(({ icon, label, value }) => (
							<div
								key={label}
								className="flex items-center gap-2.5 bg-white/[0.03] border border-white/[0.08] hover:border-green-500/30 hover:bg-green-500/5 px-4 py-2.5 rounded-xl transition-all duration-300"
							>
								<span className="text-lg">{icon}</span>
								<div>
									<p className="text-[9px] uppercase tracking-wider text-white/40 font-bold leading-none mb-0.5">
										{label}
									</p>
									<p className="text-sm font-black text-white leading-none">
										{value}
									</p>
								</div>
							</div>
						))}
					</motion.div>
				</motion.div>

				{/* Right: Auth glass card */}
				<motion.div
					initial={{ opacity: 0, x: 30 }}
					animate={{ opacity: 1, x: 0 }}
					transition={{ duration: 0.6, ease: "easeOut" }}
					className="w-full lg:w-1/2 flex justify-center lg:justify-end"
				>
					<div className="relative w-full max-w-md">
						{/* Outer glow */}
						<div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-green-500/20 via-transparent to-green-500/5 blur-sm pointer-events-none" />
						<div className="relative bg-[#0a1410]/90 border border-white/[0.08] backdrop-blur-2xl rounded-2xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.6),0_0_0_1px_rgba(74,222,128,0.08)]">
							{/* Top accent bar */}
							<div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-green-400/70 to-transparent" />
							{/* Corner accents */}
							<div className="absolute top-3 right-3 w-10 h-10 border-t border-r border-green-500/20 rounded-tr-xl pointer-events-none" />
							<div className="absolute bottom-3 left-3 w-10 h-10 border-b border-l border-green-500/20 rounded-bl-xl pointer-events-none" />

							{/* ─── LOGIN PHASE ───────────────────────── */}
							<AnimatePresence mode="wait">
								{authPhase === "login" && (
									<motion.div
										key="login"
										initial={{ opacity: 0, x: -20 }}
										animate={{ opacity: 1, x: 0 }}
										exit={{ opacity: 0, x: 20 }}
										transition={{ duration: 0.25 }}
										className="p-8 space-y-5"
									>
										<div className="space-y-1 text-center mb-4">
											<p className="text-[10px] text-green-400/60 uppercase font-black tracking-[0.4em]">
												Painel do Treinador
											</p>
											<h2 className="text-2xl font-headline font-black text-white tracking-tight">
												Acede à tua conta
											</h2>
											<p className="text-xs text-white/40">
												Depois escolhes novo jogo, época guardada ou amigos.
											</p>
										</div>
										<div className="space-y-3">
											<div>
												<label className="block text-[10px] uppercase text-white/40 mb-2 font-bold tracking-wider">
													Nome de Treinador
												</label>
												<input
													type="text"
													className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-green-500/50 p-4 rounded-xl text-white text-lg font-black outline-none transition-all placeholder:text-white/20 focus:ring-1 focus:ring-green-500/30 focus:bg-green-500/[0.03]"
													value={name}
													placeholder="Ex: Cobra"
													onChange={(e) => {
														setName(e.target.value);
														setAuthError("");
													}}
												/>
											</div>
											<div>
												<label className="block text-[10px] uppercase text-white/40 mb-2 font-bold tracking-wider">
													Palavra-passe
												</label>
												<input
													type="password"
													className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-green-500/50 p-4 rounded-xl text-white text-lg font-black outline-none transition-all placeholder:text-white/20 focus:ring-1 focus:ring-green-500/30 focus:bg-green-500/[0.03]"
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
											className="w-full relative overflow-hidden bg-green-500 hover:bg-green-400 disabled:bg-white/[0.06] disabled:text-white/30 text-black py-4 rounded-xl font-black text-base uppercase tracking-[0.2em] transition-all active:scale-[0.98] shadow-[0_4px_20px_rgba(74,222,128,0.25)] hover:shadow-[0_4px_30px_rgba(74,222,128,0.4)] group"
										>
											<span className="relative z-10">
												{authSubmitting ? "A VALIDAR..." : "ENTRAR"}
											</span>
											<div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
										</button>
										<button
											onClick={() => {
												setConfirmPassword("");
												setAuthError("");
												setJoinError("");
												setAuthPhase("register");
											}}
											className="w-full border border-white/[0.08] bg-white/[0.02] hover:border-green-500/30 hover:bg-green-500/[0.04] text-white/70 hover:text-white py-3 rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all"
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
										transition={{ duration: 0.25 }}
										className="p-8 space-y-5"
									>
										<button
											onClick={resetAuthFlow}
											className="text-xs text-white/30 hover:text-white/70 font-black uppercase tracking-widest flex items-center gap-1 transition-colors"
										>
											← Voltar
										</button>
										<div className="space-y-1 text-center">
											<p className="text-[10px] text-green-400/60 uppercase font-black tracking-[0.4em]">
												Nova conta
											</p>
											<h2 className="text-2xl font-headline font-black text-white tracking-tight">
												Cria a tua conta de treinador
											</h2>
										</div>
										<div className="space-y-3">
											<div>
												<label className="block text-[10px] uppercase text-white/40 mb-2 font-bold tracking-wider">
													Nome de Treinador
												</label>
												<input
													type="text"
													className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-green-500/50 p-4 rounded-xl text-white text-lg font-black outline-none transition-all placeholder:text-white/20 focus:ring-1 focus:ring-green-500/30 focus:bg-green-500/[0.03]"
													value={name}
													placeholder="Ex: Amorim"
													onChange={(e) => {
														setName(e.target.value);
														setAuthError("");
													}}
												/>
											</div>
											<div>
												<label className="block text-[10px] uppercase text-white/40 mb-2 font-bold tracking-wider">
													Palavra-passe
												</label>
												<input
													type="password"
													className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-green-500/50 p-4 rounded-xl text-white text-lg font-black outline-none transition-all placeholder:text-white/20 focus:ring-1 focus:ring-green-500/30 focus:bg-green-500/[0.03]"
													value={password}
													placeholder="••••••••"
													onChange={(e) => {
														setPassword(e.target.value);
														setAuthError("");
													}}
												/>
											</div>
											<div>
												<label className="block text-[10px] uppercase text-white/40 mb-2 font-bold tracking-wider">
													Confirmar Palavra-passe
												</label>
												<input
													type="password"
													className={`w-full bg-white/[0.04] border p-4 rounded-xl text-white text-lg font-black outline-none transition-all placeholder:text-white/20 focus:ring-1 ${
														registerPasswordMismatch
															? "border-red-500/60 focus:ring-red-500/30 focus:border-red-500/60"
															: "border-white/[0.08] focus:border-green-500/50 focus:ring-green-500/30 focus:bg-green-500/[0.03]"
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
											className="w-full relative overflow-hidden bg-green-500 hover:bg-green-400 disabled:bg-white/[0.06] disabled:text-white/30 text-black py-4 rounded-xl font-black text-base uppercase tracking-[0.2em] transition-all active:scale-[0.98] shadow-[0_4px_20px_rgba(74,222,128,0.25)] hover:shadow-[0_4px_30px_rgba(74,222,128,0.4)] group"
										>
											<span className="relative z-10">
												{authSubmitting ? "A CRIAR CONTA..." : "CRIAR CONTA"}
											</span>
											<div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
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
										initial={{ opacity: 0, scale: 0.97 }}
										animate={{ opacity: 1, scale: 1 }}
										exit={{ opacity: 0, scale: 1.03 }}
										transition={{ duration: 0.25 }}
										className="p-6 space-y-5"
									>
										{isNewAccount && (
											<div className="flex items-start gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2.5">
												<span className="material-symbols-outlined text-green-400 text-base leading-tight mt-0.5">
													check_circle
												</span>
												<p className="text-green-300 text-xs font-bold">
													Conta criada com sucesso! Bem-vindo,{" "}
													<span className="text-green-200">{name}</span>.
												</p>
											</div>
										)}
										<div className="space-y-3 text-center">
											<div className="space-y-1">
												<p className="text-[10px] text-green-400/60 uppercase font-black tracking-[0.4em]">
													Sessão autenticada
												</p>
												<h2 className="text-xl font-headline font-black text-white tracking-tight">
													Olá,{" "}
													<span className="text-green-400 drop-shadow-[0_0_12px_rgba(74,222,128,0.5)]">
														{name}
													</span>
												</h2>
												<p className="text-xs text-white/40">
													Como queres jogar hoje?
												</p>
											</div>
											<div className="flex items-center justify-center gap-3">
												<button
													onClick={resetAuthFlow}
													className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70 font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-white/[0.08] hover:border-white/20 transition-colors"
												>
													<span className="material-symbols-outlined text-[13px] leading-none">
														swap_horiz
													</span>
													Trocar conta
												</button>
												<button
													onClick={handleLogout}
													className="flex items-center gap-1 text-[10px] text-red-400/50 hover:text-red-400 font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-red-500/10 hover:border-red-500/30 transition-colors"
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
													className={`flex-1 flex items-center sm:flex-col sm:items-start gap-3 sm:gap-1 rounded-xl border px-4 py-3 sm:p-4 text-left transition-all duration-200 ${
														joinMode === mode
															? "border-green-500/40 bg-green-500/10 shadow-[0_0_20px_rgba(74,222,128,0.08)]"
															: "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
													}`}
												>
													<span
														className={`material-symbols-outlined text-[22px] shrink-0 leading-none ${
															joinMode === mode
																? "text-green-400"
																: "text-white/30"
														}`}
													>
														{icon}
													</span>
													<div className="min-w-0">
														<p
															className={`text-sm font-black leading-tight ${
																joinMode === mode
																	? "text-green-400"
																	: "text-white/70"
															}`}
														>
															{label}
														</p>
														<p className="text-[10px] text-white/30 leading-tight mt-0.5 hidden sm:block">
															{sub}
														</p>
													</div>
													{joinMode === mode && (
														<span className="ml-auto sm:hidden material-symbols-outlined text-green-400 text-[18px] leading-none">
															check_circle
														</span>
													)}
												</button>
											))}
										</div>

										{joinMode === "new-game" && (
											<motion.div
												initial={{ opacity: 0, y: 8 }}
												animate={{ opacity: 1, y: 0 }}
												className="space-y-3 rounded-xl border border-green-500/20 bg-green-500/[0.04] p-4"
											>
												<label className="block text-[10px] uppercase text-green-400/70 font-bold tracking-[0.3em]">
													Nome do novo jogo
												</label>
												<input
													type="text"
													className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-green-500/50 p-3.5 rounded-xl text-white text-base font-black outline-none transition-all placeholder:text-white/20 focus:ring-1 focus:ring-green-500/30 uppercase"
													value={roomCode}
													placeholder="INVERNO"
													onChange={(e) =>
														setRoomCode(e.target.value.toUpperCase())
													}
													onKeyDown={(e) => {
														if (e.key === "Enter") handleJoin();
													}}
												/>
												<p className="text-xs text-white/30">
													Recebes um clube aleatório da 4ª Divisão.
												</p>
											</motion.div>
										)}

										{joinMode === "saved-game" && (
											<motion.div
												initial={{ opacity: 0, y: 8 }}
												animate={{ opacity: 1, y: 0 }}
												className="space-y-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4"
											>
												<label className="block text-[10px] uppercase text-cyan-400/70 font-bold tracking-[0.3em]">
													As tuas Salas Gravadas
												</label>
												{availableSaves.length === 0 ? (
													<p className="text-white/30 text-sm py-2">
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
																className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
																	roomCode === save.code
																		? "border-cyan-500/40 bg-cyan-500/10 text-white"
																		: "border-white/[0.06] bg-white/[0.02] text-white/50 hover:border-white/[0.12] hover:text-white/80"
																}`}
															>
																<div className="flex flex-col flex-1 min-w-0">
																	<span className="font-black text-sm uppercase tracking-widest truncate">
																		{save.name}
																	</span>
																	<span className="text-[10px] font-mono text-white/30">
																		{save.code}
																	</span>
																	{save.coaches && save.coaches.length > 0 && (
																		<span className="text-[9px] font-black uppercase px-1.5 py-px rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 tracking-widest inline-block mt-1 w-fit">
																			{save.coaches.join(", ")}
																		</span>
																	)}
																	{(save.teamName || save.year) && (
																		<div className="flex items-center gap-2 mt-0.5">
																			{save.teamName && (
																				<span className="text-[10px] text-white/30 truncate">
																					🏟️ {save.teamName}
																				</span>
																			)}
																			{save.year && (
																				<span className="text-[10px] text-white/30">
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
																	className="shrink-0 text-white/20 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10"
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
											</motion.div>
										)}

										{joinMode === "friend-room" && (
											<motion.div
												initial={{ opacity: 0, y: 8 }}
												animate={{ opacity: 1, y: 0 }}
												className="space-y-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4"
											>
												<label className="block text-[10px] uppercase text-emerald-400/70 font-bold tracking-[0.3em]">
													Código da Sala
												</label>
												<input
													type="text"
													className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-green-500/50 p-3.5 rounded-xl text-white text-base font-black outline-none transition-all placeholder:text-white/20 focus:ring-1 focus:ring-green-500/30 uppercase tracking-widest"
													value={roomCode}
													placeholder="INVERNO"
													onChange={(e) =>
														setRoomCode(e.target.value.toUpperCase())
													}
													onKeyDown={(e) => {
														if (e.key === "Enter") handleJoin();
													}}
												/>
												<p className="text-xs text-white/30">
													Pede o código ao teu amigo que criou a sala.
												</p>
											</motion.div>
										)}

										{joinMode && (
											<button
												onClick={handleJoin}
												disabled={!roomCode || joining}
												className={`w-full relative overflow-hidden disabled:bg-white/[0.06] disabled:text-white/30 py-4 rounded-xl font-black text-sm uppercase tracking-[0.2em] transition-all active:scale-[0.98] group ${
													joinMode === "saved-game"
														? "bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_4px_20px_rgba(6,182,212,0.25)] hover:shadow-[0_4px_30px_rgba(6,182,212,0.4)]"
														: "bg-green-500 hover:bg-green-400 text-black shadow-[0_4px_20px_rgba(74,222,128,0.25)] hover:shadow-[0_4px_30px_rgba(74,222,128,0.4)]"
												}`}
											>
												<span className="relative z-10">
													{joining
														? "A GERAR CONTRATO..."
														: joinMode === "new-game"
															? "CRIAR JOGO"
															: joinMode === "saved-game"
																? "CONTINUAR JOGO"
																: "JUNTAR A AMIGOS"}
												</span>
												<div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
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
				</motion.div>
			</div>

			{/* Features strip */}
			<div className="relative z-10 w-full border-t border-white/[0.06] bg-[#080d0a]/60 backdrop-blur-sm">
				<div className="max-w-7xl mx-auto px-6 lg:px-10 py-10">
					<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
								className="bg-white/[0.02] border border-white/[0.06] hover:border-green-500/25 hover:bg-green-500/[0.03] rounded-xl p-5 transition-all duration-300 group"
							>
								<div className="w-10 h-10 flex items-center justify-center text-xl bg-white/[0.04] rounded-xl mb-4 group-hover:bg-green-500/10 transition-colors duration-300">
									{icon}
								</div>
								<p className="font-headline font-black text-sm text-white mb-1.5 tracking-tight">
									{label}
								</p>
								<p className="text-xs text-white/40 leading-relaxed">{desc}</p>
							</div>
						))}
					</div>
				</div>
			</div>

			{/* Footer */}
			<footer className="relative z-10 border-t border-white/[0.06] bg-[#060b08] py-5">
				<div className="max-w-7xl mx-auto px-6 lg:px-10 flex items-center justify-between">
					<span className="text-xs text-white/30 font-bold">
						⚽ CashBall 26/27
					</span>
					<span className="text-xs text-white/15">
						v0.2a-TESTING © 2026 by Fábio Silva
					</span>
				</div>
			</footer>
		</div>
	);
};

export default LandingPage;
