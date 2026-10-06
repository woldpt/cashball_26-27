import { useState, useRef, useCallback, useEffect } from "react";
import { socket } from "../../socket.js";

// Quanto tempo um estado de convite fica visível antes de voltar a "Convidar".
const INVITE_TTL_MS = {
  sent: 30000,
  error: 5000,
  accepted: 8000,
  declined: 6000,
};

/**
 * Convites de sala (como no RoomSelectScreen): estado por `${roomCode}:${coach}`
 * → { status, msg }, com expiração e resposta do servidor (aceite / recusa).
 * Vive no RoomHub (sempre montado) para não perder `roomInviteResult` com o painel fechado.
 * @param {Object} me - Sessão atual (name, token, roomCode, roomName).
 * @returns {{inviteState: Object, sendRoomInvite: function(string): void}}
 */
export function useRoomInvites(me) {
  const [inviteState, setInviteState] = useState({});
  const timersRef = useRef({});
  const myName = me?.name ?? "";
  const myRoom = me?.roomCode ?? "";

  // Define o estado do convite e agenda o regresso a "Convidar".
  const setInvite = useCallback((key, state) => {
    clearTimeout(timersRef.current[key]);
    setInviteState((prev) => ({ ...prev, [key]: state }));
    const ttl = INVITE_TTL_MS[state.status];
    if (!ttl) return;
    timersRef.current[key] = setTimeout(() => {
      setInviteState((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }, ttl);
  }, []);

  useEffect(() => {
    const onResult = (res) => {
      if (!res || typeof res.roomCode !== "string") return;
      const key = `${res.roomCode}:${res.toCoach}`;
      setInvite(key, { status: res.accepted ? "accepted" : "declined" });
    };
    socket.on("roomInviteResult", onResult);
    return () => {
      socket.off("roomInviteResult", onResult);
      Object.values(timersRef.current).forEach(clearTimeout);
      timersRef.current = {};
    };
  }, [setInvite]);

  const sendRoomInvite = useCallback(
    (toCoach) => {
      const key = `${myRoom}:${toCoach}`;
      setInvite(key, { status: "sending" });
      socket.emit(
        "sendRoomInvite",
        {
          name: myName,
          token: me.token,
          roomCode: myRoom,
          roomName: me.roomName || myRoom,
          toCoach,
        },
        (res) => {
          if (res && res.ok) setInvite(key, { status: "sent" });
          else
            setInvite(key, {
              status: "error",
              msg: res?.error || "Erro ao enviar o convite.",
            });
        },
      );
    },
    [myName, myRoom, me, setInvite],
  );

  return { inviteState, sendRoomInvite };
}
