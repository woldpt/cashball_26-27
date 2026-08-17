import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { useGame } from "../../contexts/GameContext.jsx";
import { socket } from "../../socket.js";
import { MODAL_Z } from "../../constants/index.js";
import { ModalShell } from "../shared/ModalShell.jsx";
import { Badge } from "../shared/Badge.jsx";

/**
 * Modal exibido após o coach confirmar a táctica (multiplayer),
 * mostrando o estado de todos os coaches da sala enquanto se aguarda.
 *
 * @param {{
 *   players: Array<{name: string, teamId: number|null, ready: boolean, socketId: string|null}>,
 *   visible: boolean,
 *   onCancel?: () => void
 * }} props
 */
export function WaitingCoachesModal({ players, visible, onCancel }) {
  const {
    teams,
    lockedCoaches,
    awaitingCoaches,
    me,
    roomMessages,
    chatInput,
    setChatInput,
  } = useGame();
  const chatScrollRef = useRef(null);

  // Refrescar histórico da sala ao abrir o modal
  useEffect(() => {
    if (!visible) return;
    socket.emit("getChatHistory", { channel: "room" });
  }, [visible]);

  // Autoscroll quando chegam novas mensagens
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [roomMessages]);

  // Só mostrar se lockedCoaches >= 2 (multiplayer) e visible
  if (!visible || lockedCoaches.length < 2) return null;

  const sendChat = () => {
    const trimmed = (chatInput || "").trim();
    if (!trimmed) return;
    socket.emit("sendChatMessage", { channel: "room", message: trimmed });
    setChatInput("");
  };

  const formatChatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  /** @param {string} coachName */
  const getCoachData = (coachName) => {
    const online = players.find((p) => p.name === coachName);
    if (online) {
      const team = teams.find(
        (t) => String(t.id) === String(online.teamId),
      );
      return {
        name: coachName,
        teamName: team?.name ?? "—",
        teamColor: team?.color_primary ?? null,
        status: online.ready ? "ready" : "thinking",
        isMe: coachName === me?.name,
      };
    }
    // Offline ou estado desconhecido (incluído em lockedCoaches mas não em players)
    return {
      name: coachName,
      teamName: awaitingCoaches.includes(coachName) ? "Desconectado" : "Ausente",
      teamColor: null,
      status: "offline",
      isMe: coachName === me?.name,
    };
  };

  const coaches = lockedCoaches
    .map(getCoachData)
    .filter(Boolean)
    // ordenar: ready primeiro, depois thinking, depois offline; tu no topo
    .sort((a, b) => {
      if (a.isMe !== b.isMe) return a.isMe ? -1 : 1;
      const order = { ready: 0, thinking: 1, offline: 2 };
      return (order[a.status] ?? 3) - (order[b.status] ?? 3);
    });

  const readyCount = coaches.filter((c) => c.status === "ready").length;
  const totalHuman = coaches.length;
  const allReady = readyCount === totalHuman;

  const STATUS_MAP = {
    ready: { label: "Ready ✅", dot: "bg-emerald-400", text: "text-emerald-400" },
    thinking: {
      label: "Queimando Neurónios 🧠",
      dot: "bg-amber-400",
      text: "text-amber-400",
    },
    offline: { label: "Offline ⚫", dot: "bg-gray-600", text: "text-gray-500" },
  };

  return (
    <ModalShell
      visible={visible && lockedCoaches.length >= 2}
      z={MODAL_Z.waitingCoaches}
      variant="card"
      backdropStyle={{
        background:
          "radial-gradient(ellipse at center, rgba(34,197,94,0.08) 0%, rgba(10,10,10,0.96) 70%)",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(circle at 2px 2px, rgba(34,197,94,0.15) 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      />

      <motion.div
        className="relative w-full bg-surface-container border border-outline-variant/20 rounded-xl shadow-2xl overflow-hidden"
        initial={{ scale: 0.93, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.93, y: 24 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
      >
            {/* Cabeçalho */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/15">
              <div className="flex items-center gap-2">
                <span className="text-lg">⏳</span>
                <div>
                  <h2 className="text-sm font-black text-on-surface uppercase tracking-wide">
                    A Aguardar Coaches
                  </h2>
                  <p className="text-[10px] text-on-surface-variant/60 font-bold">
                    {readyCount}/{totalHuman} prontos
                  </p>
                </div>
              </div>
              {/* Indicador de pulso enquanto espera */}
              {!allReady && (
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="text-[9px] text-on-surface-variant/50 font-bold uppercase tracking-widest">
                    Aguardando
                  </span>
                </div>
              )}
            </div>

            {/* Lista de coaches */}
            <div className="divide-y divide-outline-variant/10 max-h-80 overflow-y-auto">
              {coaches.map((coach) => {
                const st = STATUS_MAP[coach.status] || STATUS_MAP.thinking;
                return (
                  <div
                    key={coach.name}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Dot + avatar area */}
                    <div className="relative shrink-0">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-xs ${
                          coach.teamColor
                            ? ""
                            : "bg-surface-container-high"
                        }`}
                        style={
                          coach.teamColor
                            ? {
                                background: `radial-gradient(circle at 35% 28%, rgba(255,255,255,0.18) 0%, transparent 65%), ${coach.teamColor}`,
                                boxShadow: `0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)`,
                              }
                            : {}
                        }
                      >
                        {coach.name.charAt(0).toUpperCase()}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface ${st.dot}`}
                      />
                    </div>

                    {/* Nome + equipa */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-on-surface truncate">
                          {coach.name}
                        </span>
                        {coach.isMe && <Badge variant="sold">Tu</Badge>}
                      </div>
                      <span className="text-[10px] text-on-surface-variant/60 font-bold truncate block">
                        {coach.teamName}
                      </span>
                    </div>

                    {/* Status badge */}
                    <span
                      className={`shrink-0 text-[9px] font-black uppercase tracking-wide ${st.text}`}
                    >
                      {st.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Chat rápido da sala */}
            <div className="border-t border-outline-variant/15">
              <div className="flex items-center gap-1.5 px-4 pt-2 pb-1">
                <span className="text-xs">💬</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/70">
                  Chat da sala
                </span>
              </div>
              <div className="px-3 pb-1">
                <div
                  ref={chatScrollRef}
                  className="h-28 overflow-y-auto space-y-2 px-1"
                  style={{ scrollBehavior: "smooth" }}
                >
                  {roomMessages.length === 0 ? (
                    <p className="text-center text-[10px] italic text-on-surface-variant/50 mt-6">
                      Nenhuma mensagem nesta sala ainda.
                    </p>
                  ) : (
                    roomMessages.map((msg) => {
                      const isOwn = msg.coachName === me?.name;
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col gap-0.5 ${isOwn ? "items-end" : "items-start"}`}
                        >
                          {!isOwn && (
                            <span className="text-[9px] text-on-surface-variant/70 font-semibold px-1">
                              {msg.coachName}
                            </span>
                          )}
                          <div
                            className={`max-w-[85%] px-2.5 py-1 rounded-lg text-xs leading-snug ${
                              isOwn
                                ? "bg-primary text-on-primary rounded-br-sm"
                                : "bg-surface-container text-on-surface rounded-bl-sm"
                            }`}
                          >
                            {msg.message}
                          </div>
                          <span className="text-[8px] text-on-surface-variant/50 px-1">
                            {formatChatTime(msg.timestamp)}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="flex items-center gap-2 py-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") sendChat();
                    }}
                    placeholder="Conversa rápida…"
                    maxLength={500}
                    className="flex-1 bg-surface-container text-on-surface text-xs px-3 py-1.5 rounded-lg outline-none placeholder:text-on-surface-variant/50 border border-outline-variant/30 focus:border-primary/60 transition-colors"
                  />
                  <button
                    onClick={sendChat}
                    disabled={!(chatInput || "").trim()}
                    className="shrink-0 p-1.5 rounded-lg bg-primary text-on-primary disabled:opacity-30 hover:opacity-90 transition-opacity"
                  >
                    <span className="material-symbols-outlined text-[16px] leading-none">
                      send
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Rodapé */}
            <div className="px-4 py-2.5 border-t border-outline-variant/15 space-y-2">
              <p className="text-[10px] text-on-surface-variant/60 font-bold text-center">
                {allReady
                  ? "Todos prontos! O jogo vai começar..."
                  : "O jogo começa quando todos estiverem Ready."}
              </p>
              <button
                onClick={onCancel}
                className="w-full py-2.5 text-[10px] font-black uppercase tracking-widest rounded-md bg-surface-container-high text-on-surface-variant/70 hover:bg-surface-bright hover:text-on-surface active:scale-[0.97] transition-all"
              >
                ✕ Cancelar e refazer táctica
              </button>
            </div>
          </motion.div>
    </ModalShell>
  );
}
