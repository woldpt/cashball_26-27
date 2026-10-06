import { useState, useEffect, useRef, useMemo, startTransition } from "react";
import { useGame } from "../../contexts/GameContext.jsx";
import { isSameDay, formatChatDay } from "../../utils/formatters.js";
import { CoachAvatar } from "../shared/CoachAvatar.jsx";
import { coachAvatarSeed } from "../../utils/coachAvatar.js";

// Mensagens do mesmo coach até este intervalo agrupam-se (sem repetir nome/avatar).
const GROUP_GAP_MS = 2 * 60 * 1000;
// Distância ao fundo (px) até à qual o scroll "cola" às mensagens novas.
const STICK_PX = 80;

const timeFmt = new Intl.DateTimeFormat("pt-PT", {
  hour: "2-digit",
  minute: "2-digit",
});
const formatChatTime = (ts) => timeFmt.format(ts);

const sameGroup = (a, b) =>
  a &&
  b &&
  !a.system &&
  !b.system &&
  a.coachName === b.coachName &&
  b.timestamp - a.timestamp < GROUP_GAP_MS &&
  isSameDay(a.timestamp, b.timestamp);

/**
 * Lista de mensagens do canal (agrupadas, com separador de dia, mensagens de
 * sistema intercaladas na sala) e scroll que só cola ao fundo se o utilizador já lá estava.
 * @param {Object} props
 * @param {"room"|"global"} props.channel - Canal visível.
 * @param {Array<{id: string, system: true, message: string, timestamp: number}>} props.systemMessages - Anúncios da sala.
 * @returns {JSX.Element}
 */
export function ChatMessages({ channel, systemMessages }) {
  const {
    me,
    roomMessages,
    globalMessages,
    avatarSeed,
    coachAvatars,
    coachAvatarSeeds,
    backendUrl,
    chatMessagesRef,
  } = useGame();
  const myName = me?.name ?? "";
  const stickRef = useRef(true);
  const [hasNew, setHasNew] = useState(false);

  const activeMessages = channel === "room" ? roomMessages : globalMessages;

  // Mensagens de sistema só existem na sala; intercaladas por hora.
  const merged = useMemo(
    () =>
      channel === "room" && systemMessages.length > 0
        ? [...activeMessages, ...systemMessages].sort(
            (a, b) => a.timestamp - b.timestamp,
          )
        : activeMessages,
    [channel, activeMessages, systemMessages],
  );

  // Ao trocar de canal volta a colar ao fundo.
  useEffect(() => {
    stickRef.current = true;
    startTransition(() => setHasNew(false));
  }, [channel]);

  // Só salta para o fim se o utilizador já lá estava (ou se a mensagem é sua);
  // caso contrário mostra o pill "Novas mensagens" em vez de roubar o scroll.
  useEffect(() => {
    const el = chatMessagesRef?.current;
    if (!el) return;
    const last = merged[merged.length - 1];
    if (stickRef.current || last?.coachName === myName) {
      el.scrollTo({ top: el.scrollHeight });
      startTransition(() => setHasNew(false));
    } else if (last) {
      startTransition(() => setHasNew(true));
    }
  }, [merged, myName, chatMessagesRef]);

  const onScroll = (e) => {
    const el = e.currentTarget;
    stickRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < STICK_PX;
    if (stickRef.current) setHasNew(false);
  };

  const scrollToEnd = () => {
    const el = chatMessagesRef?.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      <div
        ref={chatMessagesRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5"
      >
        {merged.length === 0 ? (
          <p className="text-center text-on-surface-variant text-xs italic mt-8">
            {channel === "room"
              ? "Nenhuma mensagem nesta sala ainda."
              : "Nenhuma mensagem global ainda."}
          </p>
        ) : (
          merged.map((msg, i) => {
            const prev = merged[i - 1];
            const next = merged[i + 1];
            const isNewDay = !prev || !isSameDay(prev.timestamp, msg.timestamp);
            const dayDivider = isNewDay && (
              <div className="flex justify-center py-2">
                <span className="px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-surface-container text-on-surface-variant truncate max-w-full">
                  {formatChatDay(msg.timestamp)}
                </span>
              </div>
            );
            if (msg.system) {
              return (
                <div key={msg.id}>
                  {dayDivider}
                  <div className="text-center text-[10px] italic text-on-surface-variant/50 py-1">
                    {msg.message} —{" "}
                    <span className="text-[9px]">
                      {formatChatTime(msg.timestamp)}
                    </span>
                  </div>
                </div>
              );
            }
            const isOwn = msg.coachName === myName;
            const isFirst = !sameGroup(prev, msg);
            const isLast = !sameGroup(msg, next);
            return (
              <div
                key={msg.id}
                className={`flex flex-col gap-0.5 ${isFirst ? "pt-1.5" : ""}`}
              >
                {dayDivider}
                <div
                  className={`flex flex-col gap-0.5 ${isOwn ? "items-end" : "items-start"}`}
                >
                  {!isOwn && isFirst && (
                    <span className="text-[10px] text-on-surface-variant font-semibold px-1">
                      {msg.coachName}
                    </span>
                  )}
                  <div
                    className={`flex items-start gap-1.5 ${isOwn ? "justify-end" : ""}`}
                  >
                    {!isOwn &&
                      (isFirst ? (
                        <CoachAvatar
                          name={msg.coachName}
                          seed={coachAvatarSeed(
                            msg.coachName,
                            myName,
                            avatarSeed,
                            coachAvatarSeeds,
                          )}
                          size="w-6 h-6"
                          coachAvatars={coachAvatars}
                          backendUrl={backendUrl}
                        />
                      ) : (
                        <span className="w-6 shrink-0" />
                      ))}
                    <div
                      className={`max-w-[80%] px-3 py-1.5 rounded-xl text-sm leading-snug break-words ${
                        isOwn
                          ? "bg-primary text-on-primary rounded-br-sm"
                          : "bg-surface-container-high text-on-surface rounded-bl-sm"
                      }`}
                    >
                      {msg.message}
                    </div>
                  </div>
                  {isLast && (
                    <span className="text-[9px] text-on-surface-variant px-1">
                      {formatChatTime(msg.timestamp)}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      {hasNew && (
        <button
          onClick={scrollToEnd}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[10px] font-black uppercase tracking-widest text-on-primary shadow-md shadow-black/50 active:scale-95"
        >
          ↓ Novas mensagens
        </button>
      )}
    </div>
  );
}
