import { socket } from "../../socket.js";
import { formatCurrency } from "../../utils/formatters.js";
import {
  FLAG_TO_COUNTRY,
  POSITION_TEXT_CLASS,
  MODAL_Z,
} from "../../constants/index.js";
import { ModalShell } from "../shared/ModalShell.jsx";
import { Button } from "../shared/Button.jsx";

/**
 * @param {{
 *   transferProposalModal: { player: object, suggestedPrice: number }|null,
 *   setTransferProposalModal: function,
 * }} props
 */
export function TransferProposalModal({
  transferProposalModal,
  setTransferProposalModal,
}) {
  const player = transferProposalModal?.player;
  const suggestedPrice = transferProposalModal?.suggestedPrice;

  return (
    <ModalShell
      visible={!!transferProposalModal}
      onClose={() => setTransferProposalModal(null)}
      z={MODAL_Z.transferProposal}
      variant="md"
      dismissable
    >
      <div className="px-5 py-4 border-b border-outline-variant/15 bg-primary-container/20">
        <p className="text-xs uppercase tracking-widest font-black text-emerald-400 mb-1">
          Proposta de Transferência
        </p>
        <h3 className="text-xl font-black text-on-surface">
          {player?.nationality && (
            <span className="mr-2">{player.nationality}</span>
          )}
          {player?.name}
        </h3>
        <p className="text-sm text-on-surface-variant mt-0.5">
          <span
            className={`font-black ${POSITION_TEXT_CLASS[player?.position] || "text-zinc-300"}`}
          >
            {player?.position}
          </span>
          {" · "}
          <span className="font-black text-on-surface">
            Qualidade {player?.skill}
          </span>
          {" · "}
          <span className="text-on-surface-variant">
            {FLAG_TO_COUNTRY[player?.nationality] || ""}
          </span>
        </p>
      </div>
      <div className="px-5 py-5 space-y-4">
        <div className="bg-surface rounded-lg p-4 space-y-2 text-sm border border-outline-variant/15">
          <div className="flex justify-between items-center text-on-surface-variant">
            <span>Valor de mercado</span>
            <span className="font-bold text-on-surface">
              {formatCurrency(player?.value || 0)}
            </span>
          </div>
          <div className="flex justify-between items-center border-t border-outline-variant/15 pt-2">
            <span className="text-on-surface font-bold">
              Clausula de Rescisão
            </span>
            <span className="font-black text-emerald-400 text-base">
              {formatCurrency(suggestedPrice)}
            </span>
          </div>
          <p className="text-on-surface-variant/70 text-xs pt-1">
            A equipa adversária aceitará este prémio sobre o valor de
            mercado.
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setTransferProposalModal(null)}
          >
            Cancelar
          </Button>
          <Button
            variant="success"
            className="flex-1"
            onClick={() => {
              socket.emit("makeTransferProposal", {
                playerId: player.id,
              });
            }}
          >
            Confirmar Proposta
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
