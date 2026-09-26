import { useEffect, useRef } from "react";
import { registerCoreListeners } from "./socket/core.js";
import { registerMarketListeners } from "./socket/market.js";
import { registerNewsListeners } from "./socket/news.js";
import { registerCupListeners } from "./socket/cup.js";
import { registerSessionListeners } from "./socket/session.js";
import { registerMatchListeners } from "./socket/match.js";
import { registerCoachListeners } from "./socket/coach.js";
import { registerChatListeners } from "./socket/chat.js";

/**
 * Registers all socket.io listeners for the game.
 * Compositor fino: cada domínio vive em `./socket/<dominio>.js`
 * (helpers partilhados em `./socket/helpers.js`).
 *
 * @param {Object} handlers - All state setters and callbacks needed by the listeners.
 * @param {Object} refs - All refs needed by the listeners.
 */
export function useSocketListeners(handlers, refs) {
	// Timers pendentes da fila de penáltis (cancelados quando chega tick novo).
	const penaltyTimersRef = useRef([]);
	useEffect(() => {
		// Guarda de sala: rejeita eventos de jogo quando não há sala activa.
		// Evita que broadcasts da sala anterior contaminem o estado após "Sair".
		const inRoom = () => !!refs.roomCodeRef?.current;
		const ctx = { inRoom, penaltyTimers: penaltyTimersRef };

		const cleanups = [
			registerCoreListeners(handlers, refs, ctx),
			registerMarketListeners(handlers, refs, ctx),
			registerNewsListeners(handlers, refs, ctx),
			registerCupListeners(handlers, refs, ctx),
			registerSessionListeners(handlers, refs, ctx),
			registerMatchListeners(handlers, refs, ctx),
			registerCoachListeners(handlers, refs, ctx),
			registerChatListeners(handlers, refs, ctx),
		];

		return () => {
			cleanups.forEach((cleanup) => cleanup());
		};
	}, []); // eslint-disable-line react-hooks/exhaustive-deps
}
