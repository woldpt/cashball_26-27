import { socket } from "../../socket.js";

/**
 * Listeners de Chat de sala e global.
 *
 * @param {Object} handlers setters de estado e callbacks.
 * @param {Object} refs refs partilhados.
 * @param {Object} ctx contexto ({ inRoom, penaltyTimers }).
 * @returns {Function} cleanup (remove os listeners).
 */
export function registerChatListeners(handlers, refs) {
	socket.on("chatMessage", (msg) => {
		const isOwn = msg.coachName === refs.meRef.current?.name;
		const viewing =
			refs.chatOpenRef?.current &&
			refs.activeChatTabRef?.current === msg.channel;
		if (msg.channel === "room") {
			handlers.setRoomMessages((prev) => [...prev.slice(-199), msg]);
			if (!isOwn) {
				handlers.setUnreadRoom((prev) => (viewing ? 0 : prev + 1));
			}
		} else if (msg.channel === "global") {
			handlers.setGlobalMessages((prev) => [...prev.slice(-199), msg]);
			if (!isOwn) {
				handlers.setUnreadGlobal((prev) => (viewing ? 0 : prev + 1));
			}
		}
		// Balão de banda desenhada junto ao botão do chat (substitui o toast).
		if (!isOwn && !viewing) {
			const preview =
				msg.message.length > 80 ? msg.message.slice(0, 80) + "…" : msg.message;
			handlers.setChatPeek({
				id: msg.id ?? Date.now(),
				coachName: msg.coachName,
				preview,
				channel: msg.channel,
			});
		}
	});

	socket.on("chatHistory", ({ channel, messages }) => {
		if (channel === "room") handlers.setRoomMessages(messages || []);
		else if (channel === "global") handlers.setGlobalMessages(messages || []);
	});

	return () => {
		socket.off("chatMessage");
		socket.off("chatHistory");
	};
}
