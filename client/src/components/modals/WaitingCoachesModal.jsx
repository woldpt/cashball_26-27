import { motion } from "framer-motion";
import { useEffect } from "react";
import { useGame } from "../../contexts/GameContext.jsx";
import { socket } from "../../socket.js";
import { MODAL_Z } from "../../constants/index.js";
import { ModalShell } from "../shared/ModalShell.jsx";
import { CoachAvatar } from "../shared/CoachAvatar.jsx";
import { Badge } from "../shared/Badge.jsx";
import { Button } from "../shared/Button.jsx";
import { ChatMessages } from "../chat/ChatMessages.jsx";
import { ChatComposer } from "../chat/ChatComposer.jsx";
import { coachAvatarSeed } from "../../utils/coachAvatar.js";

// Estado → apresentação (objetos estáticos, sem alocar por linha).
const STATUS = {
  ready: {
    label: "Pronto ✅",
    variant: "success",
    ring: "ring-emerald-400/70",
    dot: "bg-emerald-400",
    seg: "bg-emerald-400",
  },
  thinking: {
    label: "A pensar 🧠",
    variant: "warning",
    ring: "ring-amber-400/60 animate-pulse",
    dot: "bg-amber-400",
    seg: "bg-amber-400/70 animate-pulse",
  },
  offline: {
    label: "Offline",
    variant: "error",
    ring: "ring-error/40",
    dot: "bg-error/70",
    seg: "bg-error/50",
  },
};
const STATUS_ORDER = { ready: 0, thinking: 1, offline: 2 };

// Referência estável (o chat da espera não mostra anúncios de sistema).
const NO_SYSTEM_MESSAGES = [];

/**
 * Modal exibido após o coach confirmar a táctica (multiplayer),
 * mostrando o estado de todos os coaches da sala enquanto se aguarda.
 *
 * @param {{
 *   players: Array<{name: string, teamId: number|null, ready: boolean, socketId: string|null}>,
 *   visible: boolean,
 *   onCancel?: () => void,
 *   // Quando false (ex.: espectador da Taça, eliminado, sem jogo na ronda),
 *   // o botão "Cancelar e refazer táctica" é substituído por um indicador de
 *   // observação — o cancelamento bloquearia o avanço do jogo para os outros.
 *   canCancel?: boolean
 * }} props
 */
export function WaitingCoachesModal({
  players,
  visible,
  onCancel,
  canCancel = true,
}) {
  const {
    teams,
    lockedCoaches,
    awaitingCoaches,
    me,
    avatarSeed,
    coachAvatars,
    coachAvatarSeeds,
    backendUrl,
  } = useGame();

  // Refrescar histórico da sala ao abrir o modal
  useEffect(() => {
    if (!visible) return;
    socket.emit("getChatHistory", { channel: "room" });
  }, [visible]);

  // Só mostrar se lockedCoaches >= 2 (multiplayer) e visible
  if (!visible || lockedCoaches.length < 2) return null;

  /** @param {string} coachName */
  const getCoachData = (coachName) => {
    const online = players.find((p) => p.name === coachName);
    if (online) {
      const team = teams.find((t) => String(t.id) === String(online.teamId));
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
      teamName: (awaitingCoaches ?? []).includes(coachName)
        ? "Desconectado"
        : "Ausente",
      teamColor: null,
      status: "offline",
      isMe: coachName === me?.name,
    };
  };

  // Tu no topo; depois prontos → a pensar → offline.
  const coaches = lockedCoaches.map(getCoachData).sort((a, b) => {
    if (a.isMe !== b.isMe) return a.isMe ? -1 : 1;
    return (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3);
  });

  const total = coaches.length;
  const readyCount = coaches.filter((c) => c.status === "ready").length;
  const allReady = readyCount === total;
  const pending = coaches.filter((c) => c.status !== "ready");
  const absent = coaches.filter((c) => c.status === "offline");

  const headline = allReady
    ? "Todos prontos!"
    : pending.length === 1
      ? `À espera de ${pending[0].name}`
      : `À espera de ${pending.length} coaches`;
  const subline = allReady
    ? "O jogo vai começar…"
    : pending.length === 1
      ? "O jogo começa quando estiver pronto."
      : pending.map((c) => c.name).join(", ");

  return (
    <ModalShell
      visible={visible && lockedCoaches.length >= 2}
      z={MODAL_Z.waitingCoaches}
      variant="wide"
      cardClassName="flex flex-col max-h-[90dvh] min-h-0"
      backdropStyle={{
        background:
          "radial-gradient(ellipse at center, rgba(34,197,94,0.08) 0%, rgba(10,10,10,0.96) 70%)",
        backdropFilter: "blur(8px)",
      }}
    >
      <motion.div
        className="relative flex flex-col w-full h-[min(560px,90dvh)] bg-surface-container border border-outline-variant/20 rounded-xl shadow-2xl overflow-hidden"
        initial={{ scale: 0.93, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.93, y: 24 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
      >
        {/* ── Hero: estado da espera + progresso ── */}
        <div
          role="status"
          aria-live="polite"
          className="shrink-0 px-4 pt-4 pb-3 bg-surface-container-high/50 border-b border-outline-variant/15"
        >
          <div className="flex items-center gap-3">
            <span
              className={`grid place-items-center size-10 shrink-0 rounded-full ${
                allReady
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-amber-500/15 text-amber-400"
              }`}
            >
              <span
                className={`material-symbols-outlined text-[24px] leading-none ${
                  allReady ? "" : "animate-pulse"
                }`}
              >
                {allReady ? "check_circle" : "hourglass_top"}
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-black font-headline tracking-tight text-on-surface uppercase truncate">
                {headline}
              </h2>
              <p className="text-[11px] font-bold text-on-surface-variant truncate">
                {subline}
              </p>
            </div>
            <div className="shrink-0 text-right font-headline font-black tabular-nums leading-none">
              <span
                className={`text-3xl ${allReady ? "text-emerald-400" : "text-tertiary"}`}
              >
                {readyCount}
              </span>
              <span className="text-lg text-on-surface-variant">/{total}</span>
            </div>
          </div>
          {/* Um segmento por coach */}
          <div className="mt-3 flex gap-1" aria-hidden="true">
            {coaches.map((c) => (
              <span
                key={c.name}
                className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${(STATUS[c.status] ?? STATUS.thinking).seg}`}
              />
            ))}
          </div>
        </div>

        {/* Regra do congelamento: com um coach ausente o jogo não avança. */}
        {absent.length > 0 && (
          <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-error-container/30 border-b border-error/20 text-[11px] font-bold text-error">
            <span className="material-symbols-outlined text-[16px] leading-none">
              wifi_off
            </span>
            <span className="min-w-0">
              {absent.map((c) => c.name).join(", ")} sem ligação — o jogo fica
              em pausa até regressar.
            </span>
          </div>
        )}

        {/* Coaches + chat: lado a lado a partir de 560 px (inclui telemóvel
            em landscape), empilhados em mobile vertical; cada coluna faz
            scroll interno. */}
        <div className="flex-1 min-h-0 flex flex-col min-[560px]:flex-row">
          {/* Coaches */}
          <div className="shrink-0 max-h-[40%] min-[560px]:max-h-none min-[560px]:w-[290px] overflow-y-auto divide-y divide-outline-variant/10 border-b min-[560px]:border-b-0 min-[560px]:border-r border-outline-variant/15">
            {coaches.map((coach) => {
              const st = STATUS[coach.status] ?? STATUS.thinking;
              return (
                <div
                  key={coach.name}
                  className={`relative flex items-center gap-3 py-2.5 pl-4 pr-3 ${
                    coach.status === "offline" ? "opacity-70" : ""
                  }`}
                >
                  <span
                    className="absolute inset-y-1.5 left-0 w-1 rounded-r bg-outline-variant/30"
                    style={
                      coach.teamColor
                        ? { backgroundColor: coach.teamColor }
                        : undefined
                    }
                  />
                  <span
                    className={`relative shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-surface-container ${st.ring}`}
                  >
                    <CoachAvatar
                      name={coach.name}
                      seed={coachAvatarSeed(
                        coach.name,
                        me?.name,
                        avatarSeed,
                        coachAvatarSeeds,
                      )}
                      teamColor={coach.teamColor}
                      size="w-9 h-9"
                      coachAvatars={coachAvatars}
                      backendUrl={backendUrl}
                    />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-black text-on-surface truncate">
                        {coach.name}
                      </span>
                      {coach.isMe && <Badge variant="info">Tu</Badge>}
                    </div>
                    <span
                      className="block text-[11px] font-bold truncate text-on-surface-variant"
                      style={
                        coach.teamColor ? { color: coach.teamColor } : undefined
                      }
                    >
                      {coach.teamName}
                    </span>
                  </div>
                  <Badge variant={st.variant}>{st.label}</Badge>
                </div>
              );
            })}
          </div>

          {/* Chat da sala */}
          <div className="flex-1 min-h-0 min-w-0 flex flex-col bg-surface-container-low">
            <div className="shrink-0 flex items-center gap-1.5 px-4 py-2 border-b border-outline-variant/15">
              <span className="material-symbols-outlined text-[16px] leading-none text-on-surface-variant">
                forum
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                Chat da sala
              </span>
            </div>
            <ChatMessages channel="room" systemMessages={NO_SYSTEM_MESSAGES} />
            <ChatComposer channel="room" placeholder="Conversa rápida…" />
          </div>
        </div>

        {/* Rodapé */}
        <div className="shrink-0 px-4 py-3 border-t border-outline-variant/15">
          {canCancel ? (
            <Button variant="secondary" full onClick={onCancel}>
              ✕ Cancelar e refazer táctica
            </Button>
          ) : (
            <p className="flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant bg-surface-container-high/40 border border-outline-variant/10 rounded-md">
              <span className="material-symbols-outlined text-[16px] leading-none">
                visibility
              </span>
              A observar o jogo
            </p>
          )}
        </div>
      </motion.div>
    </ModalShell>
  );
}
