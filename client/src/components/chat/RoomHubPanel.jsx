import { socket } from "../../socket.js";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { CoachAvatar } from "../shared/CoachAvatar.jsx";
import { useGame } from "../../contexts/GameContext.jsx";
import { panelRight, sheetUp } from "../../motion.js";
import { coachAvatarSeed } from "../../utils/coachAvatar.js";
import { CoachRow } from "./CoachRow.jsx";
import { ChatMessages } from "./ChatMessages.jsx";
import { InviteControls } from "./InviteControls.jsx";

const QUICK_MESSAGES = ["👍", "🖕", "Vamos!", "Boa sorte", "⚽", "😂"];

// Mobile (< sm): folha inferior; desktop: painel que entra da direita.
const isMobileViewport = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(max-width: 639px)").matches;

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
  const [showCoaches, setShowCoaches] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const [anim] = useState(() => (isMobileViewport() ? sheetUp : panelRight));
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

  const canKickHere = myName === roomCreator && calendarIndex === 0;
  const onlineCount = coaches.filter((c) => c.online).length;

  return (
    <motion.div
      key="room-hub-panel"
      role="dialog"
      aria-label="Sala e conversa"
      initial={anim.initial}
      animate={anim.animate}
      exit={anim.exit}
      transition={anim.transition}
      className="flex flex-col w-full h-[85dvh] rounded-t-2xl sm:w-[640px] sm:max-w-[calc(100vw-2rem)] sm:h-[min(520px,calc(100dvh-5rem))] sm:rounded-xl shadow-2xl overflow-hidden border border-outline-variant/40 bg-surface-container text-on-surface"
    >
      {/* ── Cabeçalho: sala, código, fechar ── */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-surface-container-high/50 border-b border-outline-variant/20">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-black font-headline tracking-tight text-tertiary uppercase truncate">
            {me.roomName || me.roomCode}
          </h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
            <span className="text-emerald-400 tabular-nums">
              {onlineCount}/{coaches.length}
            </span>{" "}
            online
          </p>
        </div>
        <button
          onClick={copyRoomCode}
          title="Copiar código de convite"
          aria-label="Copiar código de convite"
          className="shrink-0 flex items-center gap-1 rounded-md border border-outline-variant/30 bg-surface-container px-2 py-1 font-mono text-[11px] font-black tracking-widest text-primary hover:border-primary/50 transition-colors"
        >
          {copied ? "Copiado" : me.roomCode?.toUpperCase()}
          <span className="material-symbols-outlined text-[14px] leading-none">
            {copied ? "check" : "content_copy"}
          </span>
        </button>
        <button
          onClick={() => setRoomHubOpen(false)}
          aria-label="Fechar"
          className="shrink-0 grid place-items-center size-7 rounded-md text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined text-[20px] leading-none">
            close
          </span>
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col sm:flex-row">
        {/* ── Coaches ── */}
        <div className="shrink-0 flex flex-col sm:w-[220px] sm:min-h-0 border-b sm:border-b-0 sm:border-r border-outline-variant/20 bg-surface-container-low">
          {/* Mobile: faixa de avatares que expande a lista */}
          <button
            onClick={() => setShowCoaches((v) => !v)}
            aria-expanded={showCoaches}
            className="sm:hidden flex items-center gap-2 px-4 py-2"
          >
            <div className="flex -space-x-2 min-w-0">
              {coaches.slice(0, 8).map((c) => (
                <span
                  key={c.name}
                  className={`relative rounded-full ring-2 ring-surface-container-low ${c.online ? "" : "opacity-50"}`}
                >
                  <CoachAvatar
                    name={c.name}
                    seed={coachAvatarSeed(
                      c.name,
                      myName,
                      avatarSeed,
                      coachAvatarSeeds,
                    )}
                    teamColor={
                      c.teamId
                        ? teamById.get(String(c.teamId))?.color_primary
                        : undefined
                    }
                    size="w-7 h-7"
                    coachAvatars={coachAvatars}
                    backendUrl={backendUrl}
                  />
                </span>
              ))}
            </div>
            <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
              Coaches
            </span>
            <span className="material-symbols-outlined text-[18px] leading-none text-on-surface-variant">
              {showCoaches ? "expand_less" : "expand_more"}
            </span>
          </button>

          <div
            className={`${showCoaches ? "block" : "hidden"} sm:block max-h-[30dvh] sm:max-h-none sm:flex-1 overflow-y-auto divide-y divide-outline-variant/10`}
          >
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
        </div>

        {/* ── Chat ── */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Sala / Global */}
          <div
            role="tablist"
            className="flex shrink-0 border-b border-outline-variant/20 bg-surface-container-low"
          >
            {tabs.map(({ key, label, unread }) => (
              <button
                key={key}
                role="tab"
                aria-selected={chatSubTab === key}
                onClick={() => setChatSubTab(key)}
                className={`relative flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
                  chatSubTab === key
                    ? "text-primary"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {label}
                {key === "global" && globalPlayers.length > 0 && (
                  <span className="ml-1 font-bold tabular-nums text-on-surface-variant">
                    · {globalPlayers.length}
                  </span>
                )}
                {unread > 0 && (
                  <span className="ml-1.5 inline-block min-w-4 px-1 rounded-full bg-primary text-on-primary text-[9px] font-black">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
                {chatSubTab === key && (
                  <motion.span
                    layoutId="room-hub-tab-underline"
                    className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary"
                  />
                )}
              </button>
            ))}
          </div>

          {/* Coaches online (Global) — convidar quem está noutra sala */}
          {chatSubTab === "global" && globalPlayers.length > 0 && (
            <div className="shrink-0 max-h-[72px] overflow-y-auto flex flex-wrap gap-1.5 px-3 py-2 border-b border-outline-variant/20 bg-surface-container-low">
              {globalPlayers.map((p) => (
                <span
                  key={p.name}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-container text-on-surface border border-outline-variant/30"
                >
                  <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="truncate">{p.name}</span>
                  {inviteCandidate(p.name) && (
                    <InviteControls
                      coachName={p.name}
                      invite={inviteState[`${myRoom}:${p.name}`]}
                      onInvite={sendRoomInvite}
                    />
                  )}
                </span>
              ))}
            </div>
          )}

          <ChatMessages channel={chatSubTab} systemMessages={systemMessages} />

          {/* Respostas rápidas (só na sala) — abertas a pedido para poupar altura */}
          {chatSubTab === "room" && showQuick && (
            <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto border-t border-outline-variant/20 bg-surface-container-low">
              {QUICK_MESSAGES.map((msg) => (
                <button
                  key={msg}
                  onClick={() => emitChat(msg)}
                  className="shrink-0 px-2.5 py-0.5 rounded-full text-xs bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/20 transition-colors"
                >
                  {msg}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-2.5 shrink-0 border-t border-outline-variant/20 bg-surface-container-low">
            {chatSubTab === "room" && (
              <button
                onClick={() => setShowQuick((v) => !v)}
                aria-label="Respostas rápidas"
                aria-pressed={showQuick}
                className={`shrink-0 grid place-items-center size-8 rounded-lg transition-colors ${
                  showQuick
                    ? "bg-primary/20 text-primary"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                <span className="material-symbols-outlined text-[20px] leading-none">
                  add_reaction
                </span>
              </button>
            )}
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
        </div>
      </div>
    </motion.div>
  );
}
