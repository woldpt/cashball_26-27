import { socket } from "../../socket.js";
import { useState, useRef, useEffect, useCallback } from "react";
import { useGame } from "../../contexts/GameContext.jsx";

const QUICK_MESSAGES = ["👍", "🖕", "Vamos!", "Boa sorte", "⚽", "😂"];

// Janela entre envios — alinhada com o rate limit do servidor (1 msg/s).
const SEND_GAP_MS = 1000;

/**
 * Input de chat + respostas rápidas (só na sala), partilhado pelo RoomHub e
 * pelo modal de espera. O texto vive no `chatInput` do GameContext, por isso
 * sobrevive a fechar/abrir qualquer um dos dois.
 * @param {Object} props
 * @param {"room"|"global"} props.channel - Canal de envio.
 * @param {boolean} [props.autoFocus] - Foca o input ao montar (só com rato/teclado: no telemóvel abriria o teclado).
 * @param {string} [props.placeholder]
 * @returns {JSX.Element}
 */
export function ChatComposer({
  channel,
  autoFocus = false,
  placeholder = "Escreve uma mensagem…",
}) {
  const { chatInput, setChatInput } = useGame();
  const [showQuick, setShowQuick] = useState(false);
  const lastSendRef = useRef(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoFocus && window.matchMedia("(pointer: fine)").matches)
      inputRef.current?.focus();
  }, [autoFocus]);

  const emitChat = useCallback(
    (text) => {
      const trimmed = text.trim();
      if (!trimmed) return false;
      const now = Date.now();
      if (now - lastSendRef.current < SEND_GAP_MS) return false;
      lastSendRef.current = now;
      socket.emit("sendChatMessage", { channel, message: trimmed });
      return true;
    },
    [channel],
  );

  const sendChat = () => {
    // Só limpa se foi enviada — senão o texto perdia-se no gap anti-spam.
    if (emitChat(chatInput)) setChatInput("");
  };

  const quickOpen = channel === "room" && showQuick;

  return (
    <>
      {quickOpen && (
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
      <div className="flex items-center gap-2 px-3 py-2.5 shrink-0 border-t border-outline-variant/20 bg-surface-container-low">
        {channel === "room" && (
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
          ref={inputRef}
          type="text"
          value={chatInput}
          aria-label="Escreve uma mensagem"
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) sendChat();
          }}
          placeholder={placeholder}
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
    </>
  );
}
