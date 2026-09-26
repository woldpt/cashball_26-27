import React, { useEffect, useLayoutEffect, useState } from "react";
import LandingPage from "./components/auth/LandingPage.jsx";
import { GameProvider } from "./contexts/GameContext.jsx";
import { TacticsProvider } from "./contexts/TacticsContext.jsx";
import { GameLayout } from "./GameLayout.jsx";
import { SEASON_LABEL } from "./constants/index.js";
import { useAuth } from "./hooks/useAuth.js";
import { useJoinSession } from "./hooks/useJoinSession.js";
import { loadSavedSession } from "./utils/localStorage.js";
import { checkCacheVersion } from "./utils/cacheVersion.js";
import { initPushNotifications } from "./services/pushNotifications.js";
import { AnimatePresence, motion } from "framer-motion";
import { fade } from "./motion.js";

if (window.location.search) {
	window.history.replaceState({}, "", window.location.pathname);
}

/**
 * Raiz da app: composição. O estado de auth vive no `useAuth`, o de
 * join/sessão no `useJoinSession`; aqui ficam só a cola entre os dois,
 * o gate de cache e os ecrãs (landing ↔ jogo).
 */
function App() {
	// ── Cache readiness ───────────────────────────────────────────────────
	const [cacheReady, setCacheReady] = useState(false);
	useLayoutEffect(() => {
		checkCacheVersion().then((needsReload) => {
			if (needsReload) window.location.reload();
			else setCacheReady(true);
		});
		// Inicializar push notifications em plataforma nativa (Capacitor)
		initPushNotifications();
	}, []);

	// Texto do formulário de sala: vive aqui porque os dois hooks o usam
	// (o auth edita e escolhe o default; o join confirma no sucesso).
	const [roomCode, setRoomCode] = useState("");

	const backendUrl =
		(typeof import.meta !== "undefined" && import.meta.env?.VITE_BACKEND_URL) ||
		"";

	const auth = useAuth({ backendUrl, roomCode, setRoomCode });
	const join = useJoinSession({
		setRoomCode,
		onRoomGone: () => auth.setAuthPhase("mode"),
	});

	const { me, joining, joinError } = join;

	// ── Repor sessão guardada após o gate de cache ─────────────────────────
	useEffect(() => {
		if (!cacheReady) return;
		const session = loadSavedSession();
		if (!session) return;
		auth.restoreAuth(session);
		join.restoreSession(session);
		// eslint-disable-next-line react-hooks/set-state-in-effect
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [cacheReady]);

	// ── Cola auth ↔ join ───────────────────────────────────────────────────
	const handleJoin = () => {
		join.joinRoom({
			name: auth.name,
			token: auth.token,
			roomCode,
			joinMode: auth.joinMode,
		});
	};

	const handleAuthenticate = async (mode) => {
		const ok = await auth.handleAuthenticate(mode);
		if (ok) join.setJoinError("");
	};

	const selectJoinMode = (mode) => {
		auth.selectJoinMode(mode);
		join.setJoinError("");
	};

	const resetAuthFlow = () => {
		auth.resetAuthFlow();
		join.setJoinError("");
	};

	const switchToRoom = (code) => {
		join.switchRoom({ name: auth.name, token: auth.token, roomCode: code });
	};

	// Props da landing (mesma API de antes — spread em vez de 28 linhas).
	const landingProps = {
		authPhase: auth.authPhase,
		setAuthPhase: auth.setAuthPhase,
		name: auth.name,
		setName: auth.setName,
		password: auth.password,
		setPassword: auth.setPassword,
		confirmPassword: auth.confirmPassword,
		setConfirmPassword: auth.setConfirmPassword,
		roomCode,
		setRoomCode,
		authSubmitting: auth.authSubmitting,
		authError: auth.authError,
		setAuthError: auth.setAuthError,
		isNewAccount: auth.isNewAccount,
		joining,
		joinError,
		setJoinError: join.setJoinError,
		handleAuthenticate,
		handleJoin,
		resetAuthFlow,
		selectJoinMode,
		joinMode: auth.joinMode,
		handleLogout: auth.handleLogout,
		me,
		token: auth.token,
		availableSaves: auth.availableSaves,
		setAvailableSaves: auth.setAvailableSaves,
		backendUrl,
	};

	// ── Loading screen ─────────────────────────────────────────────────────
	if (!cacheReady) {
		return (
			<div className="min-h-screen bg-surface text-on-surface flex items-center justify-center">
				<div className="text-center space-y-3">
					<img
						src="/icon-512.png"
						alt="Logotipo CashBall"
						className="w-16 h-16 mx-auto mb-1"
					/>
					<p className="text-3xl font-headline font-black text-primary tracking-tight">
						CashBall <span className="text-on-surface">{SEASON_LABEL}</span>
					</p>
					<p className="text-xs text-on-surface-variant uppercase tracking-[0.3em] font-bold animate-pulse">
						A carregar...
					</p>
				</div>
			</div>
		);
	}

	// ── Landing ↔ Game (crossfade num único AnimatePresence) ──────────────────
	// O GameProvider vive dentro do ramo "game": nunca remonta entre
	// "joining" e o jogo, pelo que o estado do contexto sobrevive.
	return (
		<AnimatePresence mode="wait">
			{!me ? (
				<motion.div
					key="landing"
					initial={fade.initial}
					animate={fade.animate}
					exit={fade.exit}
					transition={fade.transition}
				>
					<LandingPage {...landingProps} />
				</motion.div>
			) : (
				<motion.div
					key="game"
					initial={fade.initial}
					animate={fade.animate}
					exit={fade.exit}
					transition={fade.transition}
				>
					<GameProvider
						me={me}
						setMe={join.setMe}
						setRoomCode={setRoomCode}
						setJoining={join.setJoining}
						setJoinError={join.setJoinError}
						meRef={join.meRef}
						roomCodeRef={join.roomCodeRef}
						joinTimerRef={join.joinTimerRef}
						backendUrl={backendUrl}
						onAcceptRoomInvite={switchToRoom}
					>
						<AnimatePresence mode="wait">
							{!me?.teamId ? (
								<motion.div
									key="joining"
									className="min-h-screen bg-surface text-on-surface flex items-center justify-center"
									initial={fade.initial}
									animate={fade.animate}
									exit={fade.exit}
									transition={fade.transition}
								>
									<div className="text-center space-y-3">
										<img
											src="/icon-512.png"
											alt="Logotipo CashBall"
											className="w-16 h-16 mx-auto mb-1"
										/>
										<p className="text-3xl font-headline font-black text-primary tracking-tight">
											CashBall <span className="text-on-surface">{SEASON_LABEL}</span>
										</p>
										<p className="text-xs text-on-surface-variant uppercase tracking-[0.3em] font-bold animate-pulse">
											A entrar na sala...
										</p>
										{joinError ? (
											<p className="text-xs font-bold text-red-400 px-6">
												⚠️ {joinError}
											</p>
										) : null}
									</div>
								</motion.div>
							) : (
								<motion.div
									key="game-ui"
									initial={fade.initial}
									animate={fade.animate}
									exit={fade.exit}
									transition={fade.transition}
								>
									<TacticsProvider>
										<GameLayout handleLogout={auth.handleLogout} setAuthPhase={auth.setAuthPhase} />
									</TacticsProvider>
								</motion.div>
							)}
						</AnimatePresence>
					</GameProvider>
				</motion.div>
			)}
		</AnimatePresence>
	);
}

export default App;
