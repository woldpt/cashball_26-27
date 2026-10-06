import { socket } from "../../socket.js";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { useGame } from "../../contexts/GameContext.jsx";
import { panelRight } from "../../motion.js";
import { coachAvatarSeed } from "../../utils/coachAvatar.js";
import { CoachRow } from "./CoachRow.jsx";
import { ChatMessages } from "./ChatMessages.jsx";
import { InviteControls } from "./InviteControls.jsx";

const QUICK_MESSAGES = ["👍", "🖕", "Vamos!", "Boa sorte", "⚽", "😂"];

// Janela entre envios — alinhada com o rate limit do servidor (1 msg/s).
const SEND_GAP_MS = 1000;

/**
 * Painel aberto do RoomHub (coaches + chat). Só é montado com o hub aberto,
 * por isso os cálculos de roster/presença não correm com ele fechado.
 * @param {Object} props
 * @param {"room"|"global"} props.chatSubTab - Canal visível.
 * @param {function("room"|"global"): void} props.setChatSubTab
 * @param {Array<Object>} props.systemMessages - Anúncios da sala.
 * @param {Object} props.inviteState - Estado dos convites por `${sala}:${coach}`.
 * @param {function(string): void} props.sendRoomInvite
 * @returns {JSX.Element}
 */
export function RoomHubPanel({
  chatSubTab,
  setChatSubTab,
  systemMessages,
  inviteState,
  sendRoomInvite,
}) {
  const {
    me,
    setRoomHubOpen,
    globalPlayers,
    players,
    teams,
    roomCreator,
    calendarIndex,
    unreadRoom,
    unreadGlobal,
    chatInput,
    setChatInput,
    avatarSeed,
    coachAvatars,
    coachAvatarSeeds,
    backendUrl,
    awaitingCoaches,
    roomRoster,
  } = useGame();

  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef(null);
  const lastSendRef = useRef(0);

  const myName = me?.name ?? "";
  const myRoom = me?.roomCode ?? "";

  const copyRoomCode = useCallback(async () => {
    const code = (me?.roomCode || "").toUpperCase();
    if (!code) return;
    let ok = true;
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Fallback para contextos sem Clipboard API (HTTP).
      const ta = document.createElement("textarea");
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      ta.remove();
    }
    if (!ok) return;
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1500);
  }, [me?.roomCode]);

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  // Carregar histórico ao abrir o hub ou ao trocar de sub-tab.
  // O WaitingCoachesModal só pede histórico no lobby; sem isto, o RoomHub
  // fica vazio durante o jogo (só mostra mensagens recebidas ao vivo).
  useEffect(() => {
    socket.emit("getChatHistory", { channel: chatSubTab });
  }, [chatSubTab]);

  const emitChat = useCallback(
    (text) => {
      const trimmed = text.trim();
      if (!trimmed) return false;
      const now = Date.now();
      if (now - lastSendRef.current < SEND_GAP_MS) return false;
      lastSendRef.current = now;
      socket.emit("sendChatMessage", {
        channel: chatSubTab,
        message: trimmed,
      });
      return true;
    },
    [chatSubTab],
  );

  const sendChat = useCallback(() => {
    // Só limpa se foi enviada — senão o texto perdia-se no gap anti-spam.
    if (emitChat(chatInput)) setChatInput("");
  }, [emitChat, chatInput, setChatInput]);

  // Sala atual de cada coach online (presença global): nome → roomCode.
  const presenceRooms = useMemo(() => {
    const map = new Map();
    for (const p of globalPlayers || []) {
      if (p.name) map.set(p.name.toLowerCase(), p.roomCode);
    }
    return map;
  }, [globalPlayers]);

  // Membros desta sala (presentes + à espera): nomes em minúsculas.
  const memberNames = useMemo(() => {
    const set = new Set();
    for (const p of players || []) {
      if (p.name) set.add(p.name.toLowerCase());
    }
    for (const n of awaitingCoaches || []) {
      if (n) set.add(n.toLowerCase());
    }
    return set;
  }, [players, awaitingCoaches]);

  // Lista única de coaches: o roster do servidor (todos os registados,
  // online + offline, com equipa e estado). Fallback para a fusão local
  // players+awaitingCoaches enquanto o servidor ainda não enviou o roster.
  const coaches = useMemo(() => {
    if (roomRoster && roomRoster.length > 0) {
      return roomRoster.filter((c) => c.name);
    }
    return [
      ...(players || []).map((p) => ({
        name: p.name,
        teamId: p.teamId,
        online: true,
        submitted: p.ready,
      })),
      ...(awaitingCoaches || [])
        .filter((n) => n && !(players || []).some((p) => p.name === n))
        .map((n) => ({
          name: n,
          teamId: null,
          online: false,
          submitted: false,
        })),
    ].filter((c) => c.name);
  }, [roomRoster, players, awaitingCoaches]);

  const teamById = useMemo(() => {
    const map = new Map();
    for (const t of teams || []) map.set(String(t.id), t);
    return map;
  }, [teams]);

  // Candidato a convite: membro desta sala (o servidor rejeita os restantes),
  // online noutra sala, nunca a si próprio.
  const inviteCandidate = (coachName) => {
    if (!coachName || coachName === myName) return false;
    const lower = coachName.toLowerCase();
    if (!memberNames.has(lower)) return false;
    const room = presenceRooms.get(lower);
    return !!room && room !== myRoom;
  };

  const kickCoach = useCallback((targetName) => {
    if (!window.confirm(`Expulsar ${targetName}?`)) return;
    socket.emit("kickCoach", { targetName });
  }, []);

  const tabs = [
    { key: "room", label: "Sala", unread: unreadRoom },
    { key: "global", label: "Global", unread: unreadGlobal },
  ];

  const closeBtn = (
    <button
      onClick={() => setRoomHubOpen(false)}
      className="w-full py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-colors"
    >
      ✕ Fechar
    </button>
  );

  const canKickHere = myName === roomCreator && calendarIndex === 0;

  return (
    <motion.div
      key="room-hub-panel"
      role="dialog"
      aria-label="Sala e conversa"
      initial={panelRight.initial}
      animate={panelRight.animate}
      exit={panelRight.exit}
      transition={panelRight.transition}
      className="flex flex-col sm:flex-row rounded-xl shadow-2xl overflow-hidden border border-outline-variant/40 bg-surface-container text-on-surface h-[min(480px,calc(100dvh-5rem))]"
      style={{
        width: "min(580px, calc(100vw - 2rem))",
      }}
    >
      {/* ── Coluna Esquerda: Sala + Coaches ── */}
      <div className="w-full sm:w-[200px] shrink-0 flex flex-col border-b sm:border-b-0 sm:border-r border-outline-variant/20 bg-surface-container-low">
        {/* Room info */}
        <div className="px-3 py-2.5 flex flex-col gap-1 shrink-0 border-b border-outline-variant/20">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest font-black text-on-surface-variant truncate">
              {me.roomName || me.roomCode}
            </span>
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest shrink-0 ml-1">
              {coaches.filter((c) => c.online).length}/{coaches.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-mono text-[10px] font-black text-primary tracking-widest">
              {me.roomCode?.toUpperCase()}
            </span>
            <button
              onClick={copyRoomCode}
              className="text-[8px] font-black uppercase tracking-widest text-zinc-500 hover:text-primary transition-colors px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700"
              title="Copiar código de convite"
            >
              {copied ? "Copiado ✓" : "Copiar"}
            </button>
          </div>
        </div>

        {/* Players list */}
        {/* max-h proporcional (16dvh) em vez de 160px fixos: em alturas
          curtas (landscape, h=375) o painel tem só ~295px e 160px de
          lista deixavam o input fora do ecrã. */}
        <div className="flex-1 max-h-[16dvh] sm:max-h-none overflow-y-auto divide-y divide-outline-variant/10">
          {coaches.map((coach) => (
            <CoachRow
              key={coach.name}
              coach={coach}
              coachTeam={
                coach.teamId ? teamById.get(String(coach.teamId)) : null
              }
              seed={coachAvatarSeed(
                coach.name,
                myName,
                avatarSeed,
                coachAvatarSeeds,
              )}
              coachAvatars={coachAvatars}
              backendUrl={backendUrl}
              isMe={coach.name === myName}
              isAdmin={coach.name === roomCreator}
              canKick={canKickHere && coach.name !== myName}
              canInvite={inviteCandidate(coach.name)}
              invite={inviteState[`${myRoom}:${coach.name}`]}
              onInvite={sendRoomInvite}
              onKick={kickCoach}
            />
          ))}
        </div>

        {/* Close button — desktop: fundo da coluna esquerda (no mobile vai para o fundo do painel) */}
        <div className="hidden sm:block px-3 py-2 shrink-0 border-t border-outline-variant/20">
          {closeBtn}
        </div>
      </div>

      {/* ── Coluna Direita: Chat ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Room/Global sub-tabs */}
        <div className="flex shrink-0 border-b border-outline-variant/20 bg-surface-container-low">
          {tabs.map(({ key, label, unread }) => (
            <button
              key={key}
              onClick={() => setChatSubTab(key)}
              className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
                chatSubTab === key
                  ? "text-primary"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {label}
              {unread > 0 && (
                <span className="ml-1.5 inline-block min-w-4 px-1 rounded-full bg-primary text-on-primary text-[9px] font-black">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Global players online list */}
        {chatSubTab === "global" && globalPlayers.length > 0 && (
          <div className="shrink-0 border-b border-outline-variant/20 bg-surface-container-low">
            <div className="flex items-center gap-1.5 px-3 py-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                {globalPlayers.length} online
              </span>
            </div>
            <div
              className="flex flex-wrap gap-1.5 px-3 pb-2 overflow-y-auto"
              style={{ maxHeight: 72 }}
            >
              {globalPlayers.map((p) => (
                <span
                  key={p.name}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-container text-on-surface border border-outline-variant/30"
                >
                  <span className="truncate">{p.name}</span>
                  {inviteCandidate(p.name) && (
                    <span className="inline-flex items-center gap-1">
                      <InviteControls
                        coachName={p.name}
                        invite={inviteState[`${myRoom}:${p.name}`]}
                        onInvite={sendRoomInvite}
                      />
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {chatSubTab === "room" && (
          <div className="shrink-0 flex items-center gap-1.5 px-3 py-2 overflow-x-auto border-b border-outline-variant/20 bg-surface-container-low">
            {QUICK_MESSAGES.map((msg) => (
              <button
                key={msg}
                onClick={() => emitChat(msg)}
                className="shrink-0 px-2.5 py-1 rounded-full text-xs bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/20 transition-colors"
              >
                {msg}
              </button>
            ))}
          </div>
        )}

        <ChatMessages channel={chatSubTab} systemMessages={systemMessages} />

        {/* Input */}
        <div className="flex items-center gap-2 px-3 py-2.5 shrink-0 border-t border-outline-variant/20 bg-surface-container-low">
          <input
            type="text"
            value={chatInput}
            aria-label="Escreve uma mensagem"
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) sendChat();
            }}
            placeholder="Escreve uma mensagem…"
            maxLength={500}
            className="min-w-0 flex-1 bg-surface-container text-on-surface text-sm px-3 py-1.5 rounded-lg outline-none placeholder:text-on-surface-variant/50 border border-outline-variant/30 focus:border-primary/60 transition-colors"
          />
          <button
            onClick={sendChat}
            disabled={!chatInput.trim()}
            aria-label="Enviar mensagem"
            className="shrink-0 p-1.5 rounded-lg bg-primary text-on-primary disabled:opacity-30 hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-[18px] leading-none">
              send
            </span>
          </button>
        </div>

        {/* Close button — mobile: fundo do painel, abaixo do input */}
        <div className="sm:hidden px-3 py-2.5 shrink-0 border-t border-outline-variant/20 bg-surface-container-low">
          {closeBtn}
        </div>
      </div>
    </motion.div>
  );
}
