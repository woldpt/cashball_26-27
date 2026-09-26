/**
 * useAuth — autenticação e escolha de sala (extraído do `App`).
 *
 * Dono de: nome/palavra-passe/token, fase de auth, modo de entrada,
 * saves disponíveis e erros de auth. O join em si vive no
 * `useJoinSession`; este hook só devolve `true/false` no authenticate
 * para o `App` limpar o erro de join em caso de sucesso.
 *
 * O fetch dos saves usa `AbortController`: trocar de modo a meio do
 * debounce já não assenta saves obsoletos.
 */
import { startTransition, useEffect, useRef, useState } from "react";
import {
	clearSavedSession,
	saveSavedAuth,
} from "../utils/localStorage.js";

/** Sala guardada mais recente (pelo `lastPlayedAt`); null se nenhuma tiver data. */
const mostRecentSave = (saves) =>
	saves.reduce(
		(best, s) =>
			s.lastPlayedAt &&
			(!best || new Date(s.lastPlayedAt) > new Date(best.lastPlayedAt))
				? s
				: best,
		null,
	);

/**
 * @typedef {Object} AuthState
 * @property {string} authPhase "login" | "register" | "mode"
 * @property {function} setAuthPhase
 * @property {string} name
 * @property {function} setName
 * @property {string} password
 * @property {function} setPassword
 * @property {string} confirmPassword
 * @property {function} setConfirmPassword
 * @property {string|null} token
 * @property {function} setToken
 * @property {string|null} joinMode "new-game" | "saved-game" | null
 * @property {Array} availableSaves
 * @property {function} setAvailableSaves
 * @property {boolean} authSubmitting
 * @property {string} authError
 * @property {function} setAuthError
 * @property {boolean} isNewAccount
 * @property {function} selectJoinMode
 * @property {function} resetAuthFlow
 * @property {function} handleAuthenticate devolve true em sucesso
 * @property {function} handleLogout
 * @property {function} restoreAuth repõe nome+token da sessão guardada
 */

/**
 * @param {Object} options
 * @param {string} options.backendUrl prefixo da API
 * @param {string} options.roomCode código atual (para o default dos saves)
 * @param {function} options.setRoomCode
 * @returns {AuthState}
 */
export function useAuth({ backendUrl, roomCode, setRoomCode }) {
	const [name, setName] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [token, setToken] = useState(null);
	const [authPhase, setAuthPhase] = useState("login");
	const [joinMode, setJoinMode] = useState(null);
	const [availableSaves, setAvailableSaves] = useState([]);
	const [authSubmitting, setAuthSubmitting] = useState(false);
	const [authError, setAuthError] = useState("");
	const [isNewAccount, setIsNewAccount] = useState(false);

	// Códigos por modo: trocar new-game ↔ saved-game não perde o que
	// já estava escrito em cada um.
	const joinCodesRef = useRef({});

	const selectJoinMode = (mode) => {
		if (joinMode && joinMode !== mode && roomCode) {
			joinCodesRef.current[joinMode] = roomCode;
		}
		setJoinMode(mode);
		setRoomCode(joinCodesRef.current[mode] || "");
	};

	// Espelho do joinMode para o guard da pré-seleção (leitura síncrona
	// dentro do fetch assíncrono, onde o estado já estaria obsoleto).
	const joinModeRef = useRef(null);
	useEffect(() => {
		joinModeRef.current = joinMode;
	}, [joinMode]);

	// ── Modo por omissão ao entrar na seleção de sala ─────────────────
	// Dispara na transição para a fase "mode" sem escolha do jogador: após
	// o login/registo e no regresso de sessão guardada cuja sala desapareceu
	// (onRoomGone). Continuar (sala mais recente ativa) se houver salas;
	// Novo Jogo caso contrário. Um join manual falhado não re-dispara — a
	// fase já era "mode" — nem "Mudar de Jogo" (setState com o mesmo valor).
	useEffect(() => {
		if (authPhase !== "mode" || !name || !token || joinMode !== null) {
			return;
		}
		const controller = new AbortController();
		const apply = async () => {
			let saves;
			try {
				const res = await fetch(
					`${backendUrl}/saves?name=${encodeURIComponent(name)}&token=${encodeURIComponent(token)}`,
					{ signal: controller.signal },
				);
				const data = await res.json();
				saves = Array.isArray(data) ? data : [];
			} catch {
				if (controller.signal.aborted) return;
				saves = [];
			}
			// Nunca pisar uma escolha que o jogador fez entretanto.
			if (joinModeRef.current !== null) return;
			const last = mostRecentSave(saves) || saves[0] || null;
			setAvailableSaves(saves);
			setJoinMode(last ? "saved-game" : "new-game");
			setRoomCode(last ? last.code : "");
		};
		apply();
		return () => controller.abort();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [authPhase, name, token]);

	const resetAuthFlow = () => {
		setAuthPhase("login");
		setToken(null);
		setJoinMode(null);
		setRoomCode("");
		setAuthError("");
		setAuthSubmitting(false);
		setIsNewAccount(false);
		joinCodesRef.current = {};
	};

	const handleAuthenticate = async (mode) => {
		if (!name || !password || authSubmitting) return false;
		if (mode === "register") {
			if (!confirmPassword) {
				setAuthError("Confirma a palavra-passe.");
				return false;
			}
			if (password !== confirmPassword) {
				setAuthError("As palavras-passe não coincidem.");
				return false;
			}
		}
		setAuthSubmitting(true);
		setAuthError("");
		try {
			const response = await fetch(`${backendUrl}/auth/${mode}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: name.trim(), password }),
			});
			const data = await response.json().catch(() => ({}));
			if (!response.ok || !data.token) {
				setAuthError(data.error || "Não foi possível autenticar a conta.");
				return false;
			}
			const trimmedName = name.trim();
			setName(trimmedName);
			setToken(data.token);
			setConfirmPassword("");
			setJoinMode(null);
			setRoomCode("");
			setIsNewAccount(mode === "register");
			setAuthPhase("mode");
			saveSavedAuth({ name: trimmedName, token: data.token });
			return true;
		} catch {
			setAuthError("Sem ligação ao servidor. Tenta novamente.");
			return false;
		} finally {
			setAuthSubmitting(false);
		}
	};

	const handleLogout = () => {
		try {
			if (token) {
				fetch(`${backendUrl}/auth/logout`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ token }),
				}).catch(() => {
					/* ignore */
				});
			}
		} catch {
			/* ignore */
		}
		clearSavedSession();
		window.location.reload();
	};

	const restoreAuth = (session) => {
		setName(session.name);
		setToken(session.token);
	};

	// ── Saves deste treinador (só no modo saved-game) ──────────────────────
	useEffect(() => {
		if (joinMode === "saved-game" && name && token) {
			const controller = new AbortController();
			const timeout = setTimeout(() => {
				fetch(
					`${backendUrl}/saves?name=${encodeURIComponent(name)}&token=${encodeURIComponent(token)}`,
					{ signal: controller.signal },
				)
					.then((r) => r.json())
					.then((data) => {
						setAvailableSaves(Array.isArray(data) ? data : []);
						if (data.length > 0 && !roomCode) {
							setRoomCode((mostRecentSave(data) || data[0]).code);
						}
					})
					.catch(() => {});
			}, 400);
			return () => {
				clearTimeout(timeout);
				controller.abort();
			};
		} else if (joinMode === "saved-game" && !name) {
			startTransition(() => setAvailableSaves([]));
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [name, joinMode, token]);

	return {
		authPhase,
		setAuthPhase,
		name,
		setName,
		password,
		setPassword,
		confirmPassword,
		setConfirmPassword,
		token,
		setToken,
		joinMode,
		availableSaves,
		setAvailableSaves,
		authSubmitting,
		authError,
		setAuthError,
		isNewAccount,
		selectJoinMode,
		resetAuthFlow,
		handleAuthenticate,
		handleLogout,
		restoreAuth,
	};
}
