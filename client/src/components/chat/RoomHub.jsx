import { socket } from "../../socket.js";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../../contexts/GameContext.jsx";
import { panelRight } from "../../motion.js";
import { isSameDay, formatChatDay } from "../../utils/formatters.js";
import { CoachAvatar } from "../shared/CoachAvatar.jsx";
import { coachAvatarSeed } from "../../utils/coachAvatar.js";

const QUICK_MESSAGES = ["👍", "🖕", "Vamos!", "Boa sorte", "⚽", "😂"];

// Teto das mensagens de sistema (só vivem em memória enquanto o hub existe).
const MAX_SYSTEM_MESSAGES = 50;
// Janela anti-duplo-Enter no envio de mensagens.
const SEND_GAP_MS = 300;

// Objetos estáticos: getCoachStatus devolve referência sem alocar por linha.
const STATUS = {
  offline: {
    label: "Offline",
    color: "text-on-surface-variant/40",
    dotColor: "bg-surface-bright",
  },
  ready: {
    label: "Vamos! ⚡",
    color: "text-emerald-400",
    dotColor: "bg-emerald-400",
  },
  thinking: {
    label: "Queimando neurónios 🧠",
    color: "text-amber-400",
    dotColor: "bg-amber-400",
  },
};

/**
 * RoomHub — coluna da sala (coaches, kick, convites) + chat (Sala/Global).
 * Consome o GameContext diretamente; o GameOverlays só o monta (`<RoomHub />`).
 */
export function RoomHub() {
  const {
    me,
    roomHubRef,
    roomHubOpen,
    setRoomHubOpen,
    roomMessages,
    globalMessages,
    globalPlayers,
    players,
    teams,
    roomCreator,
    calendarIndex,
    unreadRoom,
    unreadGlobal,
    setUnreadRoom,
    setUnreadGlobal,
    chatInput,
    setChatInput,
    avatarSeed,
    coachAvatars,
    backendUrl,
    chatMessagesRef,
    awaitingCoaches,
    chatOpenRef,
    activeChatTabRef,
  } = useGame();

  const [chatSubTab, setChatSubTab] = useState("room");
  const [systemMessages, setSystemMessages] = useState([]);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef(null);
  const lastSendRef = useRef(0);
  // Convites de sala (como no RoomSelectScreen): `${roomCode}:${coach}` → { status, msg }
  const [inviteState, setInviteState] = useState({});
  const inviteTimersRef = useRef({});

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
      const text = data.text;
      if (!text) return;
      setSystemMessages((prev) => [
        ...prev.slice(-(MAX_SYSTEM_MESSAGES - 1)),
        { id: Date.now() + Math.random(), text, timestamp: Date.now() },
      ]);
    };

    socket.on("systemMessage", onSystemMessage);

    return () => {
      socket.off("systemMessage", onSystemMessage);
    };
  }, []);

  // Resposta do servidor a um convite enviado (aceite / recusa).
  useEffect(() => {
    const onResult = (res) => {
      if (!res || typeof res.roomCode !== "string") return;
      const key = `${res.roomCode}:${res.toCoach}`;
      setInviteState((prev) => ({
        ...prev,
        [key]: { status: res.accepted ? "accepted" : "declined" },
      }));
      // Volta a permitir convidar passados alguns segundos após resposta.
      const delay = res.accepted ? 8000 : 6000;
      const t = setTimeout(() => {
        setInviteState((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }, delay);
      inviteTimersRef.current[key] = t;
    };
    socket.on("roomInviteResult", onResult);
    return () => {
      socket.off("roomInviteResult", onResult);
      Object.values(inviteTimersRef.current).forEach(clearTimeout);
      inviteTimersRef.current = {};
    };
  }, []);

  // Carregar histórico ao abrir o hub ou ao trocar de sub-tab.
  // O WaitingCoachesModal só pede histórico no lobby; sem isto, o RoomHub
  // fica vazio durante o jogo (só mostra mensagens recebidas ao vivo).
  useEffect(() => {
    if (!roomHubOpen) return;
    socket.emit("getChatHistory", { channel: chatSubTab });
  }, [roomHubOpen, chatSubTab]);

  const activeMessages = chatSubTab === "room" ? roomMessages : globalMessages;

  const emitChat = useCallback(
    (text) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const now = Date.now();
      if (now - lastSendRef.current < SEND_GAP_MS) return;
      lastSendRef.current = now;
      socket.emit("sendChatMessage", {
        channel: chatSubTab,
        message: trimmed,
      });
    },
    [chatSubTab],
  );

  const sendChat = useCallback(() => {
    emitChat(chatInput);
    setChatInput("");
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

  // Lista única de coaches: presentes primeiro, depois os à espera offline.
  const coaches = useMemo(
    () =>
      [
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
      ].filter((c) => c.name),
    [players, awaitingCoaches],
  );

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

  const sendRoomInvite = useCallback(
    (toCoach) => {
      const key = `${myRoom}:${toCoach}`;
      setInviteState((prev) => ({ ...prev, [key]: { status: "sending" } }));
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
          setInviteState((prev) => {
            if (res && res.ok) {
              return { ...prev, [key]: { status: "sent" } };
            }
            return {
              ...prev,
              [key]: {
                status: "error",
                msg: res?.error || "Erro ao enviar o convite.",
              },
            };
          });
        },
      );
    },
    [myName, myRoom, me],
  );

  // Controlos de convite como no RoomSelectScreen (estados + botão).
  // O chamador envolve-os no contentor flex da linha/pill.
  const inviteControls = (coachName) => {
    const key = `${myRoom}:${coachName}`;
    const inv = inviteState[key];
    const busy =
      inv && ["sending", "sent", "accepted", "declined"].includes(inv.status);
    return (
      <>
        {inv?.status === "sending" && (
          <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-on-surface-variant/60">
            A convidar…
          </span>
        )}
        {inv?.status === "sent" && (
          <span className="shrink-0 rounded border border-primary/30 bg-primary/15 px-1 py-px text-[9px] font-black uppercase tracking-widest text-primary">
            Convite enviado
          </span>
        )}
        {inv?.status === "accepted" && (
          <span className="shrink-0 rounded border border-primary/40 bg-primary/20 px-1 py-px text-[9px] font-black uppercase tracking-widest text-primary">
            Aceitou ✓
          </span>
        )}
        {inv?.status === "declined" && (
          <span className="shrink-0 rounded border border-outline-variant/25 bg-surface-container-low px-1 py-px text-[9px] font-black uppercase tracking-widest text-on-surface-variant/60">
            Recusou
          </span>
        )}
        {inv?.status === "error" && (
          <span className="shrink-0 max-w-full truncate text-[9px] font-bold text-error/90">
            {inv.msg || "Erro"}
          </span>
        )}
        {!busy && (
          <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-amber-400/90">
            Noutra Sala
          </span>
        )}
        {!busy && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              sendRoomInvite(coachName);
            }}
            title={`Convidar ${coachName} para esta sala`}
            className="shrink-0 rounded-md border border-sky-500/30 bg-sky-500/15 px-1.5 py-px text-[9px] font-black uppercase tracking-widest text-sky-300 transition-colors hover:bg-sky-500/25 active:scale-95"
          >
            Convidar
          </button>
        )}
      </>
    );
  };

  const formatChatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getCoachStatus = (coach) => {
    if (!coach.online) return STATUS.offline;
    return coach.submitted ? STATUS.ready : STATUS.thinking;
  };

  if (!me) return null;

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

  return (
    <div
      ref={roomHubRef}
      className="fixed top-[var(--header-h)] right-4 z-[160] flex flex-col items-end gap-2"
    >
      <AnimatePresence initial={false}>
        {roomHubOpen && (
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
                    {players.length}
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
                {coaches.map((coach, i) => {
                  const coachTeam = coach.teamId
                    ? teamById.get(String(coach.teamId))
                    : null;
                  const status = getCoachStatus(coach);
                  return (
                    <div
                      key={coach.name || `coach-${i}`}
                      className="flex items-center gap-2 px-3 py-2"
                    >
                      {/* Avatar mini do coach + dot de estado sobreposto */}
                      <div className="relative shrink-0">
                        <CoachAvatar
                          name={coach.name}
                          seed={coachAvatarSeed(
                            coach.name,
                            myName,
                            avatarSeed,
                          )}
                          teamColor={coachTeam?.color_primary}
                          size="w-8 h-8"
                          coachAvatars={coachAvatars}
                          backendUrl={backendUrl}
                        />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface-container-low ${status.dotColor}`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-[10px] font-black truncate ${
                            coach.online
                              ? "text-on-surface"
                              : "text-on-surface-variant"
                          }`}
                        >
                          {coach.name}
                          {coach.name === myName && (
                            <span className="ml-1 text-[8px] font-bold text-on-surface-variant">
                              (tu)
                            </span>
                          )}
                          {coach.name === roomCreator && (
                            <span className="ml-1 text-[7px] font-black uppercase tracking-widest text-amber-400 bg-amber-400/10 px-1 py-0.5 rounded shrink-0">
                              Admin
                            </span>
                          )}
                        </p>
                        {coachTeam && (
                          <p
                            className="text-[9px] truncate"
                            style={{
                              color: coachTeam.color_primary || "#71717a",
                            }}
                          >
                            {coachTeam.name}
                          </p>
                        )}
                        {/* Estado de readiness: offline / táticas submetidas / a pensar */}
                        <p
                          className={`text-[8px] font-bold leading-tight ${status.color}`}
                        >
                          {status.label}
                        </p>
                        {/* Convite: membro desta sala a jogar noutra sala */}
                        {inviteCandidate(coach.name) && (
                          <div className="mt-0.5 flex flex-wrap items-center gap-1">
                            {inviteControls(coach.name)}
                          </div>
                        )}
                      </div>
                      {/* Botão kick: só Admin no lobby (calendarIndex 0),
                          não se pode expulsar a si mesmo */}
                      {myName === roomCreator &&
                        coach.name !== myName &&
                        calendarIndex === 0 && (
                          <button
                            onClick={() => {
                              socket.emit("kickCoach", {
                                targetName: coach.name,
                              });
                            }}
                            className="shrink-0 text-[8px] font-black uppercase tracking-widest text-rose-400 hover:text-rose-300 bg-rose-400/10 hover:bg-rose-400/20 px-1 py-0.5 rounded transition-colors"
                            title={`Expulsar ${coach.name}`}
                          >
                            Kick
                          </button>
                        )}
                    </div>
                  );
                })}
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
                    {(globalPlayers || []).map((p) => (
                      <span
                        key={p.name}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-container text-on-surface border border-outline-variant/30"
                      >
                        <span className="truncate">{p.name}</span>
                        {inviteCandidate(p.name) && (
                          <span className="inline-flex items-center gap-1">
                            {inviteControls(p.name)}
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

              {/* Messages */}
              <div
                ref={chatMessagesRef}
                className="flex-1 overflow-y-auto px-3 py-3 space-y-2"
                style={{ scrollBehavior: "smooth" }}
              >
                {chatSubTab === "room" &&
                  systemMessages.map((sm) => (
                    <div
                      key={sm.id}
                      className="text-center text-[10px] italic text-on-surface-variant/50 py-1"
                    >
                      {sm.text} —{" "}
                      <span className="text-[9px]">
                        {formatChatTime(sm.timestamp)}
                      </span>
                    </div>
                  ))}
                {activeMessages.length === 0 &&
                (chatSubTab !== "room" || systemMessages.length === 0) ? (
                  <p className="text-center text-on-surface-variant text-xs italic mt-8">
                    {chatSubTab === "room"
                      ? "Nenhuma mensagem nesta sala ainda."
                      : "Nenhuma mensagem global ainda."}
                  </p>
                ) : (
                  activeMessages.map((msg, i) => {
                    const isOwn = msg.coachName === myName;
                    const prev = activeMessages[i - 1];
                    const isNewDay =
                      !prev || !isSameDay(prev.timestamp, msg.timestamp);
                    return (
                      <div key={msg.id} className="flex flex-col gap-0.5">
                        {isNewDay && (
                          <div className="flex justify-center py-2">
                            <span className="px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-surface-container text-on-surface-variant truncate max-w-full">
                              {formatChatDay(msg.timestamp)}
                            </span>
                          </div>
                        )}
                        <div
                          className={`flex flex-col gap-0.5 ${isOwn ? "items-end" : "items-start"}`}
                        >
                          {!isOwn && (
                            <span className="text-[10px] text-on-surface-variant font-semibold px-1">
                              {msg.coachName}
                            </span>
                          )}
                          <div
                            className={`flex items-start gap-1.5 ${isOwn ? "justify-end" : ""}`}
                          >
                            {!isOwn && (
                              <CoachAvatar
                                name={msg.coachName}
                                seed={coachAvatarSeed(
                                  msg.coachName,
                                  myName,
                                  avatarSeed,
                                )}
                                size="w-6 h-6"
                                coachAvatars={coachAvatars}
                                backendUrl={backendUrl}
                              />
                            )}
                            <div
                              className={`max-w-[80%] px-3 py-1.5 rounded-xl text-sm leading-snug ${
                                isOwn
                                  ? "bg-primary text-on-primary rounded-br-sm"
                                  : "bg-surface-container-high text-on-surface rounded-bl-sm"
                              }`}
                            >
                              {msg.message}
                            </div>
                          </div>
                          <span className="text-[9px] text-on-surface-variant px-1">
                            {formatChatTime(msg.timestamp)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Input */}
              <div className="flex items-center gap-2 px-3 py-2.5 shrink-0 border-t border-outline-variant/20 bg-surface-container-low">
                <input
                  type="text"
                  value={chatInput}
                  aria-label="Escreve uma mensagem"
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") sendChat();
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
        )}
      </AnimatePresence>
    </div>
  );
}
