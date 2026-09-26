/**
 * useJoinSession — entrada e permanência na sala (extraído do `App`).
 *
 * Dono de: `me`, `savedSession`, `joining`, `joinError` e todos os refs do
 * fluxo de join (`meRef`, `roomCodeRef`, `joinTimerRef`, retry, último
 * payload). O `App` fica só com composição; o `GameProvider` recebe deste
 * hook a ponte de auth (refs + setters).
 *
 * Rede de segurança: se o `teamId` não chegar em 10s, re-tenta o join com
 * o último payload (máx. 5) em vez de limpar o estado. `me` nunca é limpo
 * aqui — era isso que transformava um único `teamAssigned` perdido num
 * bloqueio permanente.
 */
import { useEffect, useRef, useState } from "react";
import { socket } from "../socket.js";
import {
	clearRoomPointer,
	clearSavedAuth,
	getDeviceId,
	saveRoomPointer,
	saveSavedAuth,
} from "../utils/localStorage.js";
import {
	isAuthError,
	isRoomUnavailable,
	isTransientError,
} from "../utils/joinErrors.js";

const JOIN_TIMEOUT_MS = 10000;
const MAX_JOIN_RETRIES = 5;

/**
 * @typedef {Object} JoinRoomParams
 * @property {string} name nome do treinador
 * @property {string} token sessão
 * @property {string} roomCode código/nome da sala (texto do formulário)
 * @property {string|null} joinMode "new-game" | "saved-game" | null
 */

/**
 * @typedef {Object} JoinSession
 * @property {Object|null} me treinador atual (ponte para o GameProvider)
 * @property {function} setMe
 * @property {Object|null} savedSession sessão guardada em localStorage
 * @property {boolean} joining a entrar na sala
 * @property {function} setJoining
 * @property {string} joinError último erro de join
 * @property {function} setJoinError
 * @property {Object} meRef espelho de `me` para closures de socket
 * @property {Object} roomCodeRef código da sala (síncrono, para o GameProvider)
 * @property {Object} joinTimerRef temporizador da rede de segurança
 * @property {function} joinRoom entrada manual (formulário)
 * @property {function} switchRoom troca de sala (convite)
 * @property {function} restoreSession repõe sessão guardada (após cacheReady)
 */

/**
 * @param {Object} options
 * @param {function} options.setRoomCode setter do código (vive no `App`)
 * @param {function} [options.onRoomGone] sala inexistente → o `App` repõe a seleção
 * @returns {JoinSession}
 */
export function useJoinSession({ setRoomCode, onRoomGone }) {
	const [savedSession, setSavedSession] = useState(null);
	const [me, setMe] = useState(null);
	const [joining, setJoining] = useState(false);
	const [joinError, setJoinError] = useState("");

	const meRef = useRef(null);
	const savedSessionRef = useRef(null);
	const roomCodeRef = useRef("");
	const joinTimerRef = useRef(null);
	const joinRetryRef = useRef(0);
	// Último payload de join emitido: a re-tentativa reenvia-o sem depender de
	// estado (evita dependências novas nos efeitos e payloads obsoletos).
	const lastJoinRef = useRef(null);
	// Último nome usado num join: fallback do clearRoomPointer quando `me`
	// já caiu (o nome do formulário vive no useAuth, fora daqui).
	const lastNameRef = useRef("");

	// ── Rede de segurança do join ──────────────────────────────────────────
	const armJoinTimeout = () => {
		if (joinTimerRef.current) clearTimeout(joinTimerRef.current);
		joinTimerRef.current = setTimeout(() => {
			setJoining(false);
			const payload = lastJoinRef.current;
			if (payload && joinRetryRef.current < MAX_JOIN_RETRIES) {
				joinRetryRef.current += 1;
				console.warn(
					"[join] sem teamAssigned — a re-tentar o join (%d/%d)",
					joinRetryRef.current,
					MAX_JOIN_RETRIES,
				);
				setJoinError(
					"A ligar à sala… (tentativa " +
						joinRetryRef.current +
						"/" +
						MAX_JOIN_RETRIES +
						")",
				);
				socket.emit("joinGame", payload);
				armJoinTimeout();
				return;
			}
			setJoinError(
				"Sem resposta do servidor. Certifica-te que o servidor está ligado.",
			);
		}, JOIN_TIMEOUT_MS);
	};

	// ── Listeners de join ──────────────────────────────────────────────────
	useEffect(() => {
		const handleJoinError = (msg) => {
			setJoinError(msg);
			setJoining(false);

			if (isAuthError(msg)) {
				// Só uma credencial inválida termina a sessão. Um erro de rede,
				// rate-limit ou carregamento da sala não pode desmontar o jogo.
				if (joinTimerRef.current) {
					clearTimeout(joinTimerRef.current);
					joinTimerRef.current = null;
				}
				clearSavedAuth();
				setSavedSession(null);
				setMe(null);
				return;
			}

			if (isTransientError(msg)) {
				// Manter sessão e `me`; re-armar a rede de segurança para o
				// próximo retry recuperar sem intervenção do treinador.
				armJoinTimeout();
				return;
			}

			if (joinTimerRef.current) {
				clearTimeout(joinTimerRef.current);
				joinTimerRef.current = null;
			}

			if (isRoomUnavailable(msg)) {
				// A conta continua válida; apenas esta sala deixou de ser uma opção.
				clearRoomPointer(meRef.current?.name || lastNameRef.current);
				setSavedSession(null);
				setMe(null);
				if (onRoomGone) onRoomGone();
				return;
			}

			// Durante um rejoin, manter o jogo montado permite ao socket recuperar
			// sem transformar um erro transitório num logout aparente. No primeiro
			// join manual, voltar à seleção é a resposta correcta.
			const canRecover = Boolean(
				savedSessionRef.current?.roomCode ||
					meRef.current?.teamId ||
					meRef.current?.roomCode,
			);
			if (!canRecover) setMe(null);
		};

		const handleJoinSuccess = (data) => {
			const { roomCode, roomName } = data;
			// Atualiza o ref SINCRONICAMENTE (antes do re-render) para que a
			// guarda inRoom() já passe nos eventos gameState/playerListUpdate
			// iniciais — caso contrário roomCreator (e o botão Kick do admin)
			// são descartados e nunca chegam ao client.
			roomCodeRef.current = roomCode;
			// Depois do sucesso, futuras tentativas devem reentrar nesta sala —
			// nunca repetir `new-game` e criar outra sala.
			if (lastJoinRef.current) {
				lastJoinRef.current = {
					...lastJoinRef.current,
					roomCode,
					roomName: "",
					joinMode: "saved-game",
				};
			}
			setRoomCode(roomCode);
			setMe((prev) => {
				// Reconstruir da sessão guardada se `me` tiver caído entretanto: um
				// joinGameSuccess atrasado não pode perder-se por causa disso.
				// Último recurso: o payload em voo (nome+token do join emitido).
				const saved = savedSessionRef.current;
				const inFlight = lastJoinRef.current;
				const base =
					prev ||
					(saved ? { name: saved.name, token: saved.token } : null) ||
					(inFlight ? { name: inFlight.name, token: inFlight.token } : null);
				if (!base) return prev;
				const updated = { ...base, roomCode, roomName };
				saveRoomPointer(updated.name, updated.roomCode);
				return updated;
			});
			joinRetryRef.current = 0;
			setJoining(false);
			setJoinError("");
			// Re-armar a rede de segurança: o teamAssigned ainda pode demorar ou
			// perder-se (socket cai neste intervalo) — sem isto o ecrã ficava
			// bloqueado em "A entrar na sala..." para sempre.
			armJoinTimeout();
		};

		socket.on("joinGameSuccess", handleJoinSuccess);
		socket.on("joinError", handleJoinError);

		return () => {
			socket.off("joinGameSuccess", handleJoinSuccess);
			socket.off("joinError", handleJoinError);
		};
		// armJoinTimeout só usa refs/setters — estável de propósito.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// ── Auto-join com a sessão guardada ─────────────────────────────────────
	useEffect(() => {
		if (!savedSession || me?.teamId) return;

		const joinWithRetry = () => {
			const payload = {
				name: savedSession.name,
				token: savedSession.token,
				roomCode: savedSession.roomCode.toUpperCase(),
				deviceId: getDeviceId(),
			};
			lastJoinRef.current = payload;
			lastNameRef.current = savedSession.name;
			socket.emit("joinGame", payload);

			armJoinTimeout();
		};

		if (socket.connected) {
			joinWithRetry();
		} else {
			// Socket ainda não pronto — esperar pela ligação e depois entrar.
			const onConnect = () => {
				socket.off("connect", onConnect);
				joinWithRetry();
			};
			socket.on("connect", onConnect);
			return () => {
				socket.off("connect", onConnect);
				if (joinTimerRef.current) clearTimeout(joinTimerRef.current);
			};
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [savedSession, me?.teamId]);

	// ── Espelhos para closures ──────────────────────────────────────────────
	useEffect(() => {
		meRef.current = me;
	}, [me]);
	useEffect(() => {
		savedSessionRef.current = savedSession;
	}, [savedSession]);
	useEffect(() => {
		roomCodeRef.current = me?.roomCode || "";
	}, [me?.roomCode]);

	// ── Persistir sessão ────────────────────────────────────────────────────
	useEffect(() => {
		if (!me?.name || !me?.token) return;
		saveSavedAuth({ name: me.name, token: me.token });
		if (me.roomCode) saveRoomPointer(me.name, me.roomCode);
	}, [me]);

	// ── Entrada manual (formulário) ─────────────────────────────────────────
	/** @param {JoinRoomParams} params */
	const joinRoom = ({ name, token, roomCode, joinMode }) => {
		if (!name || !token || !roomCode || joining) return;
		if (me?.roomCode) socket.emit("leaveRoom");
		setJoinError("");
		setJoining(true);
		const payload = {
			name,
			token,
			roomCode: joinMode === "new-game" ? "" : roomCode.toUpperCase(),
			roomName: joinMode === "new-game" ? roomCode.toUpperCase() : "",
			joinMode,
			deviceId: getDeviceId(),
		};
		lastJoinRef.current = payload;
		lastNameRef.current = name;
		socket.emit("joinGame", payload);
		setMe({ name, token, roomCode: "" });
		armJoinTimeout();
	};

	// Troca de sala (aceitar convite de outro treinador): sai da sala actual e
	// entra na sala convidada, reutilizando o fluxo de join existente.
	const switchRoom = ({ name, token, roomCode }) => {
		if (!name || !token || joining) return;
		const target = (roomCode || "").toUpperCase();
		if (!target) return;
		if (me?.roomCode) socket.emit("leaveRoom");
		setJoinError("");
		setJoining(true);
		const payload = {
			name,
			token,
			roomCode: target,
			joinMode: "saved-game",
			deviceId: getDeviceId(),
		};
		lastJoinRef.current = payload;
		lastNameRef.current = name;
		socket.emit("joinGame", payload);
		setMe({ name, token, roomCode: "" });
		armJoinTimeout();
	};

	// Repõe a sessão guardada após o cacheReady (chamado uma vez pelo `App`).
	const restoreSession = (session) => {
		if (!session) return;
		setSavedSession(session);
		setMe({
			name: session.name,
			token: session.token,
			roomCode: session.roomCode,
		});
		setRoomCode(session.roomCode);
		lastNameRef.current = session.name;
		setJoining(true);
	};

	return {
		me,
		setMe,
		savedSession,
		joining,
		setJoining,
		joinError,
		setJoinError,
		meRef,
		roomCodeRef,
		joinTimerRef,
		joinRoom,
		switchRoom,
		restoreSession,
	};
}
