import React, {
	useEffect,
	useLayoutEffect,
	useState,
	startTransition,
} from "react";
import { socket } from "./socket.js";
import LandingPage from "./components/auth/LandingPage.jsx";
import { GameProvider } from "./contexts/GameContext.jsx";
import { TacticsProvider } from "./contexts/TacticsContext.jsx";
import { GameLayout } from "./GameLayout.jsx";
import { loadSavedSession } from "./utils/localStorage.js";
import { checkCacheVersion } from "./utils/cacheVersion.js";

if (window.location.search) {
	window.history.replaceState({}, "", window.location.pathname);
}

function App() {
	// ── Cache readiness ───────────────────────────────────────────────────
	const [cacheReady, setCacheReady] = useState(false);
	useLayoutEffect(() => {
		checkCacheVersion().then((needsReload) => {
			if (needsReload) window.location.reload();
			else setCacheReady(true);
		});
	}, []);

	// ── Auth & session state ───────────────────────────────────────────────
	const [savedSession, setSavedSession] = useState(null);
	const [me, setMe] = useState(null);
	const [name, setName] = useState("");
	const [password, setPassword] = useState("");
	const [roomCode, setRoomCode] = useState("");
	const [authPhase, setAuthPhase] = useState("login");
	const [joinMode, setJoinMode] = useState(null);
	const [confirmPassword, setConfirmPassword] = useState("");
	const [availableSaves, setAvailableSaves] = useState([]);
	const [authSubmitting, setAuthSubmitting] = useState(false);
	const [authError, setAuthError] = useState("");
	const [isNewAccount, setIsNewAccount] = useState(false);
	const [joining, setJoining] = useState(false);
	const [joinError, setJoinError] = useState("");

	const meRef = React.useRef(null);
	const roomCodeRef = React.useRef("");
	const joinTimerRef = React.useRef(null);

	const backendUrl =
		(typeof import.meta !== "undefined" && import.meta.env?.VITE_BACKEND_URL) ||
		"";

	// ── Socket Listeners for Auth ──────────────────────────────────────────
	useEffect(() => {
		const handleJoinError = (msg) => {
			setJoinError(msg);
			setJoining(false);
			setMe(null);
			try {
				window.localStorage.removeItem("cashballSession");
			} catch {
				/* ignore */
			}
			if (joinTimerRef.current) clearTimeout(joinTimerRef.current);
		};

		const handleJoinSuccess = (data) => {
			const { roomCode, roomName } = data;
			setRoomCode(roomCode);
			setMe((prev) => {
				if (!prev) return null;
				const updated = { ...prev, roomCode, roomName };
				try {
					window.localStorage.setItem(
						"cashballSession",
						JSON.stringify({
							name: updated.name,
							password: updated.password,
							roomCode: updated.roomCode,
						}),
					);
				} catch {
					/* ignore */
				}
				return updated;
			});
			setJoining(false);
			setJoinError("");
			if (joinTimerRef.current) clearTimeout(joinTimerRef.current);
		};

		socket.on("joinGameSuccess", handleJoinSuccess);
		socket.on("joinError", handleJoinError);

		return () => {
			socket.off("joinGameSuccess", handleJoinSuccess);
			socket.off("joinError", handleJoinError);
		};
	}, []);

	// ── Load saved session after cache check ───────────────────────────────
	useEffect(() => {
		if (!cacheReady) return;
		const session = loadSavedSession();
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setSavedSession(session);
		if (session) {
			setMe({
				name: session.name,
				password: session.password,
				roomCode: session.roomCode,
			});
			setName(session.name);
			setPassword(session.password);
			setRoomCode(session.roomCode);
			setJoining(true);
		}
	}, [cacheReady]);

	// ── Auto-join when savedSession is loaded ──────────────────────────────
	useEffect(() => {
		if (!savedSession || me?.teamId) return;
		if (joinTimerRef.current) clearTimeout(joinTimerRef.current);

		const joinWithRetry = () => {
			console.log(
				"[App] Auto-join attempt, socket.connected:",
				socket.connected,
			);
			socket.emit("joinGame", {
				name: savedSession.name,
				password: savedSession.password,
				roomCode: savedSession.roomCode.toUpperCase(),
			});

			joinTimerRef.current = setTimeout(() => {
				setMe((prev) => (prev && !prev.teamId ? null : prev));
				setJoining(false);
				setJoinError(
					"Sem resposta do servidor. Certifica-te que o servidor está ligado.",
				);
			}, 6000);
		};

		if (socket.connected) {
			joinWithRetry();
		} else {
			// Socket not ready yet — wait for connection then join
			const onConnect = () => {
				console.log("[App] Socket connected, joining with saved session");
				socket.off("connect", onConnect);
				joinWithRetry();
			};
			socket.on("connect", onConnect);
			return () => {
				socket.off("connect", onConnect);
				if (joinTimerRef.current) clearTimeout(joinTimerRef.current);
			};
		}
	}, [savedSession, me?.teamId]);

	// ── Re-fetch saved rooms for this coach ────────────────────────────────
	useEffect(() => {
		if (joinMode === "saved-game" && name) {
			const timeout = setTimeout(() => {
				fetch(`${backendUrl}/saves?name=${encodeURIComponent(name)}`)
					.then((r) => r.json())
					.then((data) => {
						setAvailableSaves(data);
						if (data.length > 0 && !roomCode) setRoomCode(data[0].code);
					})
					.catch(() => {});
			}, 400);
			return () => clearTimeout(timeout);
		} else if (joinMode === "saved-game" && !name) {
			startTransition(() => setAvailableSaves([]));
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [name, joinMode]);

	// ── Keep refs in sync ──────────────────────────────────────────────────
	useEffect(() => {
		meRef.current = me;
	}, [me]);
	useEffect(() => {
		roomCodeRef.current = me?.roomCode || "";
	}, [me?.roomCode]);

	// ── Persist session to localStorage ────────────────────────────────────
	useEffect(() => {
		if (!me?.name || !me?.password || !me?.roomCode) return;
		try {
			window.localStorage.setItem(
				"cashballSession",
				JSON.stringify({
					name: me.name,
					password: me.password,
					roomCode: me.roomCode,
				}),
			);
		} catch {
			/* ignore */
		}
	}, [me]);

	// ── Auth handlers ──────────────────────────────────────────────────────
	const selectJoinMode = (mode) => {
		setJoinMode(mode);
		setRoomCode("");
		setJoinError("");
	};

	const resetAuthFlow = () => {
		setAuthPhase("login");
		setJoinMode(null);
		setRoomCode("");
		setJoinError("");
		setAuthError("");
		setAuthSubmitting(false);
		setIsNewAccount(false);
	};

	const handleAuthenticate = async (mode) => {
		if (!name || !password || authSubmitting) return;
		setAuthSubmitting(true);
		setAuthError("");
		try {
			const response = await fetch(`${backendUrl}/auth/${mode}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: name.trim(), password }),
			});
			const data = await response.json().catch(() => ({}));
			if (!response.ok) {
				setAuthError(data.error || "Não foi possível autenticar a conta.");
				return;
			}
			setName(name.trim());
			setConfirmPassword("");
			setJoinMode(null);
			setRoomCode("");
			setJoinError("");
			setIsNewAccount(mode === "register");
			setAuthPhase("mode");
		} catch {
			setAuthError("Sem ligação ao servidor. Tenta novamente.");
		} finally {
			setAuthSubmitting(false);
		}
	};

	const handleLogout = () => {
		try {
			window.localStorage.removeItem("cashballSession");
		} catch {
			/* ignore */
		}
		window.location.reload();
	};

	const handleJoin = () => {
		if (name && password && roomCode && !joining) {
			if (me?.roomCode) socket.emit("leaveRoom");
			setJoinError("");
			setJoining(true);
			socket.emit("joinGame", {
				name,
				password,
				roomCode: joinMode === "new-game" ? "" : roomCode.toUpperCase(),
				roomName: joinMode === "new-game" ? roomCode.toUpperCase() : "",
				joinMode,
			});
			setMe({ name, password, roomCode: "" });
			joinTimerRef.current = setTimeout(() => {
				setMe((prev) => (prev && !prev.teamId ? null : prev));
				setJoining(false);
				setJoinError(
					"Sem resposta do servidor. Certifica-te que o servidor está ligado.",
				);
			}, 6000);
		}
	};

	// ── Loading screen ─────────────────────────────────────────────────────
	if (!cacheReady) {
		return (
			<div className="min-h-screen bg-surface text-on-surface flex items-center justify-center">
				<div className="text-center space-y-3">
					<p className="text-3xl font-headline font-black text-primary tracking-tight">
						CashBall <span className="text-on-surface">26/27</span>
					</p>
					<p className="text-xs text-on-surface-variant uppercase tracking-[0.3em] font-bold animate-pulse">
						A carregar...
					</p>
				</div>
			</div>
		);
	}

	// ── Landing page (no me at all) ────────────────────────────────────────
	if (!me) {
		return (
			<LandingPage
				authPhase={authPhase}
				setAuthPhase={setAuthPhase}
				name={name}
				setName={setName}
				password={password}
				setPassword={setPassword}
				confirmPassword={confirmPassword}
				setConfirmPassword={setConfirmPassword}
				roomCode={roomCode}
				setRoomCode={setRoomCode}
				authSubmitting={authSubmitting}
				authError={authError}
				setAuthError={setAuthError}
				isNewAccount={isNewAccount}
				joining={joining}
				joinError={joinError}
				setJoinError={setJoinError}
				handleAuthenticate={handleAuthenticate}
				handleJoin={handleJoin}
				resetAuthFlow={resetAuthFlow}
				selectJoinMode={selectJoinMode}
				joinMode={joinMode}
				handleLogout={handleLogout}
				me={me}
				availableSaves={availableSaves}
				setAvailableSaves={setAvailableSaves}
				backendUrl={backendUrl}
			/>
		);
	}

	// ── Game (always mounted once me is set — catches teamAssigned early) ──
	return (
		<GameProvider
			me={me}
			setMe={setMe}
			setRoomCode={setRoomCode}
			setJoining={setJoining}
			setJoinError={setJoinError}
			meRef={meRef}
			roomCodeRef={roomCodeRef}
			joinTimerRef={joinTimerRef}
			backendUrl={backendUrl}
		>
			{!me.teamId ? (
				<div className="min-h-screen bg-surface text-on-surface flex items-center justify-center">
					<div className="text-center space-y-3">
						<p className="text-3xl font-headline font-black text-primary tracking-tight">
							CashBall <span className="text-on-surface">26/27</span>
						</p>
						<p className="text-xs text-on-surface-variant uppercase tracking-[0.3em] font-bold animate-pulse">
							A entrar na sala...
						</p>
					</div>
				</div>
			) : (
				<TacticsProvider>
					<GameLayout
						handleLogout={handleLogout}
						setAuthPhase={setAuthPhase}
					/>
				</TacticsProvider>
			)}
		</GameProvider>
	);
}

export default App;
