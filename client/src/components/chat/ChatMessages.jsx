import { useState, useEffect, useRef, useMemo, startTransition } from "react";
import { socket } from "../../socket.js";
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
    roomRoster,
    teams,
  } = useGame();
  const myName = me?.name ?? "";
  const stickRef = useRef(true);
  const [hasNew, setHasNew] = useState(false);
  // Histórico a caminho: evita piscar "sem mensagens" antes da resposta.
  const [loaded, setLoaded] = useState(false);

  // Cor do clube por coach (só conhecemos os da sala; os do Global ficam neutros).
  const colorByCoach = useMemo(() => {
    const colorByTeam = new Map(
      (teams || []).map((t) => [String(t.id), t.color_primary]),
    );
    return new Map(
      (roomRoster || []).map((c) => [c.name, colorByTeam.get(String(c.teamId))]),
    );
  }, [roomRoster, teams]);

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

  // Ao trocar de canal volta a colar ao fundo e espera o histórico (máx. 3 s).
  useEffect(() => {
    stickRef.current = true;
    startTransition(() => {
      setHasNew(false);
      setLoaded(false);
    });
    const done = (res) => {
      if (!res || res.channel === channel) startTransition(() => setLoaded(true));
    };
    socket.on("chatHistory", done);
    const t = setTimeout(done, 3000);
    return () => {
      socket.off("chatHistory", done);
      clearTimeout(t);
    };
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
          loaded ? (
            <div className="flex flex-col items-center gap-2 mt-10 text-on-surface-variant/60">
              <span className="material-symbols-outlined text-[36px] leading-none">
                {channel === "room" ? "forum" : "public"}
              </span>
              <p className="text-xs">
                {channel === "room"
                  ? "Ainda ninguém falou nesta sala."
                  : "Ainda ninguém falou no chat global."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 pt-2" aria-hidden="true">
              {[60, 40, 70].map((w, i) => (
                <div
                  key={i}
                  className={`h-8 rounded-xl bg-surface-container-high/60 animate-pulse ${i === 1 ? "self-end" : ""}`}
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>
          )
        ) : (
          merged.map((msg, i) => {
            const prev = merged[i - 1];
            const next = merged[i + 1];
            const isNewDay = !prev || !isSameDay(prev.timestamp, msg.timestamp);
            const dayDivider = isNewDay && (
              <div className="flex items-center gap-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
                <span className="h-px flex-1 bg-outline-variant/20" />
                <span className="truncate">{formatChatDay(msg.timestamp)}</span>
                <span className="h-px flex-1 bg-outline-variant/20" />
              </div>
            );
            if (msg.system) {
              return (
                <div key={msg.id}>
                  {dayDivider}
                  <div className="flex items-center justify-center gap-1 py-1 text-[10px] text-on-surface-variant/60">
                    <span className="material-symbols-outlined text-[12px] leading-none">
                      info
                    </span>
                    <span className="italic">{msg.message}</span>
                    <span className="text-[10px]">
                      · {formatChatTime(msg.timestamp)}
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
                    <span
                      className="text-[10px] text-on-surface-variant font-black px-1"
                      style={
                        colorByCoach.get(msg.coachName)
                          ? { color: colorByCoach.get(msg.coachName) }
                          : undefined
                      }
                    >
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
                          ? `bg-primary text-on-primary ${isLast ? "rounded-br-sm" : ""}`
                          : `bg-surface-container-high text-on-surface ${isLast ? "rounded-bl-sm" : ""}`
                      }`}
                    >
                      {msg.message}
                    </div>
                  </div>
                  {isLast && (
                    <span className="text-[10px] text-on-surface-variant px-1">
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
