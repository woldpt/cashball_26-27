import { socket } from "../../socket.js";
import { ModalShell } from "../shared/ModalShell.jsx";
import { SIM_SPEED_PRESETS } from "../../constants/index.js";

const SPEED_KEYS = Object.keys(SIM_SPEED_PRESETS);

/**
 * RoomSettings — definições da sala (ritmo da simulação ao vivo).
 *
 * Visível a todos os treinadores da sala; só o admin (roomCreator) pode
 * mudar o preset. A mudança vale do próximo jogo em diante e chega a
 * todos via `simSpeedUpdated` (+ `msPerMinute` no `gameState` no join).
 *
 * @param {{ open: boolean, onClose: () => void, me: object|null, roomCreator: string, simSpeed: string }} props
 */
export function RoomSettings({ open, onClose, me, roomCreator, simSpeed }) {
  const isRoomAdmin =
    !!me?.name && !!roomCreator && me.name === roomCreator;

  return (
    <ModalShell visible={open} onClose={onClose} variant="card">
      <div className="px-5 short:px-4 py-4 short:py-3 border-b border-outline-variant/15 flex items-center gap-3 min-w-0">
        <span className="material-symbols-outlined text-primary text-2xl shrink-0">
          speed
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-black font-headline tracking-tight text-on-surface uppercase truncate">
            Definições da sala
          </h2>
          <p className="text-[10px] text-on-surface-variant uppercase tracking-widest truncate">
            Ritmo da simulação
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Fechar"
          aria-label="Fechar definições da sala"
          className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10 transition-colors"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      <div className="p-3 short:p-2 space-y-1 min-w-0">
        {SPEED_KEYS.map((key) => {
          const preset = SIM_SPEED_PRESETS[key];
          const selected = simSpeed === key;
          return (
            <button
              key={key}
              type="button"
              disabled={!isRoomAdmin}
              title={
                isRoomAdmin ? preset.hint : "Só o admin da sala pode mudar"
              }
              onClick={() => socket.emit("setSimSpeed", { speed: key })}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors min-w-0 ${
                selected
                  ? "bg-emerald-500/15 border border-emerald-500/40"
                  : "border border-transparent hover:bg-surface-bright"
              } ${isRoomAdmin ? "" : "opacity-60 cursor-not-allowed"}`}
            >
              <span
                className={`material-symbols-outlined text-[22px] shrink-0 ${selected ? "text-emerald-400" : "text-on-surface-variant"}`}
              >
                {key === "calm"
                  ? "slow_motion_video"
                  : key === "fast"
                    ? "fast_forward"
                    : "play_arrow"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-on-surface truncate">
                  {preset.label}
                </span>
                <span className="block text-xs text-on-surface-variant truncate">
                  {preset.hint}
                </span>
              </span>
              {selected && (
                <span className="material-symbols-outlined text-emerald-400 text-[20px] shrink-0">
                  check_circle
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="px-5 short:px-4 py-3 short:py-2 border-t border-outline-variant/15">
        <p className="text-[11px] text-on-surface-variant break-words">
          {isRoomAdmin
            ? "Vale do próximo jogo em diante."
            : `Só ${roomCreator || "o admin"} pode mudar o ritmo.`}
        </p>
      </div>
    </ModalShell>
  );
}
