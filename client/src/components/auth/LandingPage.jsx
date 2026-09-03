import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import RoomSelectScreen from "./RoomSelectScreen.jsx";

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
 * @property {string|null} token - The session token (used for authenticated API calls)
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
	token,
	availableSaves,
	setAvailableSaves,
	backendUrl,
}) => {
	const [showLoginPassword, setShowLoginPassword] = useState(false);
	const [showRegisterPassword, setShowRegisterPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);

	// Barra de título: esconde-se logo após o início do scroll vertical
	// (mostra-se de novo ao voltar ao topo). Aplica-se em desktop e mobile.
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 4);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

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

	const passwordTooShort = password !== "" && password.length < 3;

	const isMode = authPhase === "mode";

	return (
		<div
			className={`min-h-screen bg-[#060b08] text-white flex flex-col relative ${
				isMode ? "" : "pb-16"
			}`}
		>
			{/* Particle background */}
			<ParticleCanvas />

			{/* Background layers */}
			<div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
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
				{/* Glow halos as background gradients: clipped to this layer, no scroll overflow */}
				<div
					className="absolute inset-0"
					style={{
						background: `
							radial-gradient(circle 350px at 50% 50%, rgba(74,222,128,0.04), transparent 70%),
							radial-gradient(circle 250px at calc(100% - 90px) 90px, rgba(52,211,153,0.06), transparent 70%),
							radial-gradient(circle 200px at 40px calc(100% - 40px), rgba(22,163,74,0.05), transparent 70%)
						`
					}}
				/>
				{/* Vignette */}
				<div className="absolute inset-0 bg-gradient-to-b from-[#060b08]/60 via-transparent to-[#060b08]/80" />
			</div>

			{/* Sticky header — escondido em ecrãs curtos (mobile landscape) durante a
			    fase de escolha de sala: são 64px de marca sem valor funcional que
			    esmagam a grelha de salas (RoomSelectScreen recupera com short:h-dvh). */}
			<header
				aria-hidden={scrolled}
				className={`z-10 w-full border-b border-white/[0.06] bg-[#060b08]/70 backdrop-blur-xl sticky top-0 transition-transform duration-300 ease-out ${
					isMode ? "short:hidden" : ""
				} ${scrolled ? "-translate-y-full pointer-events-none" : "translate-y-0"}`}
			>
				<div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<img
							src="/icon-512.png"
							alt="Logotipo CashBall"
							className="w-8 h-8 rounded-lg"
						/>
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

			<AnimatePresence mode="wait">
				{isMode ? (
					<RoomSelectScreen
						key="room-select"
						name={name}
						availableSaves={availableSaves}
						setAvailableSaves={setAvailableSaves}
						roomCode={roomCode}
						setRoomCode={setRoomCode}
						joining={joining}
						joinError={joinError}
						disconnected={disconnected}
						resetAuthFlow={resetAuthFlow}
						joinMode={joinMode}
						selectJoinMode={selectJoinMode}
						handleLogout={handleLogout}
						token={token}
						isNewAccount={isNewAccount}
						handleJoin={handleJoin}
						backendUrl={backendUrl}
					/>
				) : (
				<motion.div
					key="landing"
					initial={false}
					exit={{
						opacity: 0,
						y: -12,
						transition: { duration: 0.35, ease: "easeIn" },
					}}
					className="flex flex-1 flex-col min-h-0"
				>
			{/* Hero + Auth card */}
			<div className="relative z-10 flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-16 px-6 sm:px-10 lg:px-16 py-14 short:gap-4 short:py-6 max-w-7xl mx-auto w-full">
				{/* Left: Hero copy */}
				<motion.div
					initial={{ opacity: 0, x: -30 }}
					animate={{ opacity: 1, x: 0 }}
					transition={{ duration: 0.6, ease: "easeOut" }}
					className="w-full lg:w-1/2 flex flex-col items-start text-left"
				>
					<div className="inline-flex items-center gap-2 border border-green-500/20 bg-green-500/5 px-3 py-1 rounded-full mb-8 short:mb-2">
						<span className="w-1 h-1 rounded-full bg-green-400" />
						<span className="text-[10px] uppercase tracking-[0.35em] text-green-400/80 font-bold">
							Gestão de Futebol Multiplayer
						</span>
					</div>

					{/* Hero title: base size clamps to the viewport so "PROSPERA."
					    never overflows 320px screens (60px text-6xl = 307px wide).
					    At >=360px the clamp resolves to exactly 3.75rem (text-6xl). */}
					<h1 className="font-headline font-black leading-none tracking-tighter mb-8 short:mb-2">
						<motion.span
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.1, duration: 0.5 }}
							className="block text-[min(3.75rem,calc((100vw-3rem)/5.2))] sm:text-7xl lg:text-[5.5rem] short:text-4xl text-white"
						>
							TREINA.
						</motion.span>
						<motion.span
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.2, duration: 0.5 }}
							className="block text-[min(3.75rem,calc((100vw-3rem)/5.2))] sm:text-7xl lg:text-[5.5rem] short:text-4xl text-green-400 drop-shadow-[0_0_40px_rgba(74,222,128,0.35)]"
						>
							PROSPERA.
						</motion.span>
						<motion.span
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.3, duration: 0.5 }}
							className="block text-[min(3.75rem,calc((100vw-3rem)/5.2))] sm:text-7xl lg:text-[5.5rem] short:text-4xl text-white"
						>
							REPETE.
						</motion.span>
					</h1>

					<motion.p
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.45, duration: 0.5 }}
						className="text-base text-white/50 leading-relaxed mb-10 max-w-md short:mb-3"
					>
						A evolução moderna da gestão de futebol clássica. Controla as
						tácticas, as finanças e o destino do teu clube em ligas multiplayer
						com até 8 treinadores.
					</motion.p>

					<motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.55, duration: 0.5 }}
						className="flex flex-wrap gap-3 short:gap-2"
					>
						{[
							{ icon: "🏆", label: "Divisões", value: "4 Ligas" },
							{ icon: "👥", label: "Treinadores", value: "Até 8" },
							{ icon: "⚡", label: "Simulação", value: "Ao vivo" },
						].map(({ icon, label, value }) => (
							<div
								key={label}
								className="flex items-center gap-2.5 bg-white/[0.03] border border-white/[0.08] hover:border-green-500/30 hover:bg-green-500/5 px-4 py-2.5 rounded-xl transition-all duration-300 short:py-1.5"
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
										className="p-8 space-y-5 short:p-5 short:space-y-4"
									>
										<div className="space-y-1 text-center mb-4">
											<p className="text-[10px] text-green-400/60 uppercase font-black tracking-[0.4em]">
												Painel do Treinador
											</p>
											<h2 className="text-2xl font-headline font-black text-white tracking-tight short:text-xl">
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
													autoComplete="username"
													className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-green-500/50 p-4 short:py-3 rounded-xl text-white text-lg font-black outline-none transition-all placeholder:text-white/20 focus:ring-1 focus:ring-green-500/30 focus:bg-green-500/[0.03]"
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
												<div className="relative">
													<input
														type={showLoginPassword ? "text" : "password"}
														autoComplete="current-password"
														className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-green-500/50 p-4 short:py-3 pr-12 rounded-xl text-white text-lg font-black outline-none transition-all placeholder:text-white/20 focus:ring-1 focus:ring-green-500/30 focus:bg-green-500/[0.03]"
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
													<button
														type="button"
														tabIndex={-1}
														onClick={() => setShowLoginPassword((s) => !s)}
														className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors p-1"
														title={
															showLoginPassword
																? "Ocultar palavra-passe"
																: "Mostrar palavra-passe"
														}
													>
														<span className="material-symbols-outlined text-[18px] leading-none">
															{showLoginPassword ? "visibility_off" : "visibility"}
														</span>
													</button>
												</div>
											</div>
										</div>
										<button
											onClick={() => handleAuthenticate("login")}
											disabled={!name.trim() || !password || authSubmitting}
											className="w-full relative overflow-hidden bg-green-500 hover:bg-green-400 disabled:bg-white/[0.06] disabled:text-white/30 text-black py-4 short:py-3 rounded-xl font-black text-base uppercase tracking-[0.2em] transition-all active:scale-[0.98] shadow-[0_4px_20px_rgba(74,222,128,0.25)] hover:shadow-[0_4px_30px_rgba(74,222,128,0.4)] group"
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
											className="w-full border border-white/[0.08] bg-white/[0.02] hover:border-green-500/30 hover:bg-green-500/[0.04] text-white/70 hover:text-white py-3 short:py-2.5 rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all"
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
										className="p-8 space-y-5 short:p-5 short:space-y-4"
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
											<h2 className="text-2xl font-headline font-black text-white tracking-tight short:text-xl">
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
													autoComplete="username"
													className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-green-500/50 p-4 short:py-3 rounded-xl text-white text-lg font-black outline-none transition-all placeholder:text-white/20 focus:ring-1 focus:ring-green-500/30 focus:bg-green-500/[0.03]"
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
												<div className="relative">
													<input
														type={showRegisterPassword ? "text" : "password"}
														autoComplete="new-password"
														className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-green-500/50 p-4 short:py-3 pr-12 rounded-xl text-white text-lg font-black outline-none transition-all placeholder:text-white/20 focus:ring-1 focus:ring-green-500/30 focus:bg-green-500/[0.03]"
														value={password}
														placeholder="••••••••"
														onChange={(e) => {
															setPassword(e.target.value);
															setAuthError("");
														}}
													/>
													<button
														type="button"
														tabIndex={-1}
														onClick={() => setShowRegisterPassword((s) => !s)}
														className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors p-1"
														title={
															showRegisterPassword
																? "Ocultar palavra-passe"
																: "Mostrar palavra-passe"
														}
													>
														<span className="material-symbols-outlined text-[18px] leading-none">
															{showRegisterPassword ? "visibility_off" : "visibility"}
														</span>
													</button>
												</div>
												{passwordTooShort && (
													<p className="text-amber-400 text-xs mt-1 font-bold">
														A palavra-passe deve ter pelo menos 3 caracteres.
													</p>
												)}
											</div>
											<div>
												<label className="block text-[10px] uppercase text-white/40 mb-2 font-bold tracking-wider">
													Confirmar Palavra-passe
												</label>
												<div className="relative">
													<input
														type={showConfirmPassword ? "text" : "password"}
														autoComplete="new-password"
														className={`w-full bg-white/[0.04] border p-4 short:py-3 pr-12 rounded-xl text-white text-lg font-black outline-none transition-all placeholder:text-white/20 focus:ring-1 ${
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
													<button
														type="button"
														tabIndex={-1}
														onClick={() => setShowConfirmPassword((s) => !s)}
														className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors p-1"
														title={
															showConfirmPassword
																? "Ocultar palavra-passe"
																: "Mostrar palavra-passe"
														}
													>
														<span className="material-symbols-outlined text-[18px] leading-none">
															{showConfirmPassword ? "visibility_off" : "visibility"}
														</span>
													</button>
												</div>
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
												password.length < 3 ||
												!confirmPassword ||
												authSubmitting ||
												registerPasswordMismatch
											}
											className="w-full relative overflow-hidden bg-green-500 hover:bg-green-400 disabled:bg-white/[0.06] disabled:text-white/30 text-black py-4 short:py-3 rounded-xl font-black text-base uppercase tracking-[0.2em] transition-all active:scale-[0.98] shadow-[0_4px_20px_rgba(74,222,128,0.25)] hover:shadow-[0_4px_30px_rgba(74,222,128,0.4)] group"
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
							</AnimatePresence>
						</div>
					</div>
				</motion.div>
			</div>

			{/* Features strip */}
			<div className="relative z-10 w-full border-t border-white/[0.06] bg-[#080d0a]/60 backdrop-blur-sm">
				<div className="max-w-7xl mx-auto px-6 lg:px-10 py-10 short:py-6">
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
								className="bg-white/[0.02] border border-white/[0.06] hover:border-green-500/25 hover:bg-green-500/[0.03] rounded-xl p-5 short:p-3 transition-all duration-300 group"
							>
								<div className="w-10 h-10 flex items-center justify-center text-xl bg-white/[0.04] rounded-xl mb-4 short:mb-2 group-hover:bg-green-500/10 transition-colors duration-300">
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
			<footer className="relative z-10 border-t border-white/[0.06] bg-[#060b08] py-5 short:py-3">
				<div className="max-w-7xl mx-auto px-6 lg:px-10 flex items-center justify-between">
					<span className="flex items-center gap-1.5 text-xs text-white/30 font-bold">
						<img src="/icon-512.png" alt="Logotipo CashBall" className="w-4 h-4 rounded-full" />
						CashBall 26/27
					</span>
					<span className="text-xs text-white/15">
						v1.02a © 2026 by Fábio Silva
					</span>
				</div>
			</footer>
			</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
};

export default LandingPage;
