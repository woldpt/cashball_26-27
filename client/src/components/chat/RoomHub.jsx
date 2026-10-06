import { socket } from "../../socket.js";
import { useState, useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { useGame } from "../../contexts/GameContext.jsx";
import { RoomHubPanel } from "./RoomHubPanel.jsx";
import { useRoomInvites } from "./useRoomInvites.js";

// Teto das mensagens de sistema (só vivem em memória enquanto o hub existe).
const MAX_SYSTEM_MESSAGES = 50;

/**
 * RoomHub — casca sempre montada: mantém o que tem de sobreviver com o painel
 * fechado (anúncios da sala, convites, refs de não-lidas); o painel
 * (`RoomHubPanel`) só existe aberto. O GameOverlays só monta `<RoomHub />`.
 */
export function RoomHub() {
  const {
    me,
    roomHubRef,
    roomHubOpen,
    setRoomHubOpen,
    setUnreadRoom,
    setUnreadGlobal,
    chatOpenRef,
    activeChatTabRef,
  } = useGame();

  const [chatSubTab, setChatSubTab] = useState("room");
  const [systemMessages, setSystemMessages] = useState([]);
  const systemSeqRef = useRef(0);
  const { inviteState, sendRoomInvite } = useRoomInvites(me);

  // Sync RoomHub state → parent refs for unread logic
  useEffect(() => {
    chatOpenRef && (chatOpenRef.current = roomHubOpen);
    activeChatTabRef && (activeChatTabRef.current = chatSubTab);
  }, [roomHubOpen, chatSubTab, chatOpenRef, activeChatTabRef]);

  // Limpar as não-lidas do canal visível (o outro canal mantém o badge).
  useEffect(() => {
    if (!roomHubOpen) return;
    if (chatSubTab === "room") setUnreadRoom(0);
    else setUnreadGlobal(0);
  }, [roomHubOpen, chatSubTab, setUnreadRoom, setUnreadGlobal]);

  // Fechar com Esc.
  useEffect(() => {
    if (!roomHubOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setRoomHubOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [roomHubOpen, setRoomHubOpen]);

  useEffect(() => {
    const onSystemMessage = (data) => {
      // Only show broadcast system messages (sent to the whole room)
      if (typeof data === "string") return;
      if (!data.broadcast) return;
      // Notícias CM (cm:true) vivem no rodapé, não no chat.
      if (data.cm) return;
      const text = data.text;
      if (!text) return;
      setSystemMessages((prev) => [
        ...prev.slice(-(MAX_SYSTEM_MESSAGES - 1)),
        {
          id: `sys-${systemSeqRef.current++}`,
          system: true,
          message: text,
          timestamp: Date.now(),
        },
      ]);
    };

    socket.on("systemMessage", onSystemMessage);

    return () => {
      socket.off("systemMessage", onSystemMessage);
    };
  }, []);

  if (!me) return null;

  return (
    <div
      ref={roomHubRef}
      className="fixed inset-x-0 bottom-0 sm:inset-x-auto sm:bottom-auto sm:top-[var(--header-h)] sm:right-4 z-[160] flex flex-col items-end"
    >
      <AnimatePresence initial={false}>
        {roomHubOpen && (
          <RoomHubPanel
            key="room-hub-panel"
            chatSubTab={chatSubTab}
            setChatSubTab={setChatSubTab}
            systemMessages={systemMessages}
            inviteState={inviteState}
            sendRoomInvite={sendRoomInvite}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
