import { useEffect, useState } from "react";
import { subscribeRoomNotice } from "../../socket.js";

/**
 * Aviso de sala persistente: uma falha que exige ação do treinador (finalização
 * da jornada presa, jogos por gerar, ronda da Taça por gravar). Ao contrário da
 * `GameNoticeBar` (transitória, 6s), esta fica no ecrã até ser fechada — quem a
 * vê tem de premir Pronto outra vez.
 *
 * O servidor distingue-a pelo `warning: true` do `systemMessage`.
 */
export function RoomNoticeBanner() {
  const [notice, setNotice] = useState(null);

  useEffect(() => subscribeRoomNotice(setNotice), []);

  return <RoomNoticeBar notice={notice} onDismiss={() => setNotice(null)} />;
}

/** Apresentação pura (testável sem socket — ver gamebar-resp-test.jsx). */
export function RoomNoticeBar({ notice, onDismiss }) {
  if (!notice?.text) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto relative shrink-0 z-40 bg-amber-400 text-black text-[13px] font-extrabold uppercase tracking-widest shadow-lg flex items-stretch"
    >
      <span className="flex-1 flex items-center gap-2 py-2.5 pl-3 pr-1 min-w-0">
        <span
          aria-hidden
          className="material-symbols-outlined text-[18px] leading-none shrink-0"
        >
          warning
        </span>
        <span className="break-words">{notice.text}</span>
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fechar aviso"
        className="shrink-0 w-11 flex items-center justify-center hover:bg-black/10"
      >
        <span className="material-symbols-outlined text-[18px] leading-none">
          close
        </span>
      </button>
    </div>
  );
}
