import { motion, AnimatePresence } from "framer-motion";
import { useGame } from "../../contexts/GameContext.jsx";

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
  const { teams, lockedCoaches, awaitingCoaches, me } = useGame();

  // Só mostrar se lockedCoaches >= 2 (multiplayer) e visible
  if (!visible || lockedCoaches.length < 2) return null;

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
    <AnimatePresence>
      {visible && (
        <motion.div
          key="waiting-backdrop"
          className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          style={{
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
            className="relative w-full max-w-sm bg-[#111] border border-[#1e1e1e] rounded-2xl shadow-2xl overflow-hidden my-auto"
            initial={{ scale: 0.93, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.93, y: 24 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
          >
            {/* Cabeçalho */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
              <div className="flex items-center gap-2">
                <span className="text-lg">⏳</span>
                <div>
                  <h2 className="text-sm font-black text-white uppercase tracking-wide">
                    A Aguardar Coaches
                  </h2>
                  <p className="text-[10px] text-gray-500 font-bold">
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
                  <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">
                    Aguardando
                  </span>
                </div>
              )}
            </div>

            {/* Lista de coaches */}
            <div className="divide-y divide-[#1a1a1a] max-h-80 overflow-y-auto">
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
                            : "bg-[#1e1e1e]"
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
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#111] ${st.dot}`}
                      />
                    </div>

                    {/* Nome + equipa */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-white truncate">
                          {coach.name}
                        </span>
                        {coach.isMe && (
                          <span className="shrink-0 text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                            Tu
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-500 font-bold truncate block">
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

            {/* Rodapé */}
            <div className="px-4 py-2.5 border-t border-[#1a1a1a] space-y-2">
              <p className="text-[10px] text-gray-600 font-bold text-center">
                {allReady
                  ? "Todos prontos! O jogo vai começar..."
                  : "O jogo começa quando todos estiverem Ready."}
              </p>
              <button
                onClick={onCancel}
                className="w-full py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl bg-[#1a1a1a] text-gray-500 hover:bg-[#222] hover:text-gray-300 active:scale-[0.97] transition-all"
              >
                ✕ Cancelar e refazer táctica
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
