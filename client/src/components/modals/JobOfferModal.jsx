import { socket } from "../../socket.js";
import {
  DIVISION_NAMES,
  POSITION_LABEL_MAP,
  POSITION_BADGE_BG_CLASS,
  POSITION_BADGE_TEXT_CLASS,
  POSITION_BADGE_BORDER_CLASS,
} from "../../constants/index.js";

import { ModalShell } from "../shared/ModalShell.jsx";
import { Button } from "../shared/Button.jsx";

/**
 * @param {{ jobOfferModal: object, setJobOfferModal: function }} props
 */
export function JobOfferModal({ jobOfferModal, setJobOfferModal }) {
  if (!jobOfferModal) return null;

  const to = jobOfferModal.toTeam;
  const gd = (to.goals_for ?? 0) - (to.goals_against ?? 0);
  const squad = jobOfferModal.toTeamSquad ?? [];

  return (
    <ModalShell visible={!!jobOfferModal} variant="card" z={200}>
      <div className="text-center">
        {/* Header */}
        <div className="px-5 py-4 border-b border-outline-variant/15">
          <p className="text-amber-400 text-[10px] uppercase font-black tracking-widest mb-1">
            Convite de Clube
          </p>
          <h2 className="text-xl font-black text-on-surface">{to.name}</h2>
          <p className="text-on-surface-variant text-xs font-bold">
            {DIVISION_NAMES[to.division] ?? `Divisão ${to.division}`}
          </p>
        </div>

          {/* Classification */}
          <div className="px-5 py-3 border-b border-outline-variant/15">
            <div className="flex items-center justify-center gap-4 text-sm">
              <div className="text-center">
                <p className="text-on-surface-variant/60 text-[10px] uppercase font-black">Pos</p>
                <p className="text-on-surface font-black text-lg leading-none">
                  {jobOfferModal.toTeamDivisionPosition}
                </p>
              </div>
              <div className="w-px h-8 bg-outline-variant/20" />
              <div className="text-center">
                <p className="text-on-surface-variant/60 text-[10px] uppercase font-black">Pts</p>
                <p className="text-on-surface font-black text-lg leading-none">
                  {to.points ?? "?"}
                </p>
              </div>
              <div className="w-px h-8 bg-outline-variant/20" />
              <div className="text-center">
                <p className="text-on-surface-variant/60 text-[10px] uppercase font-black">Dif</p>
                <p className={`font-black text-lg leading-none ${gd > 0 ? "text-emerald-400" : gd < 0 ? "text-rose-400" : "text-on-surface-variant/50"}`}>
                  {gd > 0 ? `+${gd}` : gd}
                </p>
              </div>
            </div>
            <p className="text-on-surface-variant/60 text-[10px] mt-1.5">
              {to.wins ?? 0}V {to.draws ?? 0}E {to.losses ?? 0}D — GF:{to.goals_for ?? 0} GA:{to.goals_against ?? 0}
            </p>
          </div>

          {/* Squad */}
          <div className="px-5 py-3 border-b border-outline-variant/15">
            <p className="text-[10px] text-on-surface-variant uppercase font-black tracking-widest mb-2">
              Plantel ({squad.length} jogadores)
            </p>
            <div className="max-h-40 overflow-y-auto space-y-0.5 pr-1 scrollbar-thin">
              {squad.length === 0 ? (
                <p className="text-on-surface-variant/50 text-xs py-2">Sem jogadores no plantel.</p>
              ) : (
                squad.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between px-2 py-1 rounded hover:bg-surface-container-high/60 text-xs"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-black border tracking-widest ${
                          POSITION_BADGE_BG_CLASS[player.position] || "bg-zinc-500/20 border-zinc-500/40"
                        } ${POSITION_BADGE_BORDER_CLASS[player.position] || "border-zinc-500/40"} ${
                          POSITION_BADGE_TEXT_CLASS[player.position] || "text-zinc-400"
                        }`}
                      >
                        {POSITION_LABEL_MAP[player.position] ?? player.position}
                      </span>
                      <span className="text-on-surface font-bold truncate">
                        {player.name}
                      </span>
                      {player.is_star && (
                        <span className="text-amber-400 font-black text-[9px]" title="Craque">*</span>
                      )}
                    </div>
                    <span className="text-on-surface-variant font-black text-[11px] shrink-0 ml-2">
                      {player.skill}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-outline-variant/15">
            <div className="flex gap-3 justify-center">
              <Button
                variant="accent"
                onClick={() => {
                  socket.emit("acceptJobOffer");
                  setJobOfferModal(null);
                }}
              >
                Aceitar
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  socket.emit("declineJobOffer");
                  setJobOfferModal(null);
                }}
              >
                Recusar
              </Button>
            </div>
          </div>
        </div>
    </ModalShell>
  );
}
