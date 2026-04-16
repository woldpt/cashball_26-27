import { socket } from "../../socket.js";
import { DIVISION_NAMES } from "../../constants/index.js";

/**
 * @param {{ jobOfferModal: object, setJobOfferModal: function }} props
 */
export function JobOfferModal({ jobOfferModal, setJobOfferModal }) {
  if (!jobOfferModal) return null;

  return (
    <div className="fixed inset-0 z-200 bg-zinc-950/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-surface-container border border-amber-500/40 rounded-lg shadow-2xl p-6 text-center">
        <p className="text-amber-400 text-xs uppercase font-black tracking-widest mb-2">
          Convite de Clube
        </p>
        <h2 className="text-xl font-black text-white mb-1">
          {jobOfferModal.toTeam.name}
        </h2>
        <p className="text-zinc-400 text-sm mb-4">
          Quer contratar-te para a{" "}
          {DIVISION_NAMES[jobOfferModal.toTeam.division] ??
            `Divisão ${jobOfferModal.toTeam.division}`}
          .
          <br />A oferta expira na jornada {jobOfferModal.expiresAtMatchweek}.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => {
              socket.emit("acceptJobOffer");
              setJobOfferModal(null);
            }}
            className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-5 py-2 rounded-lg transition-colors"
          >
            Aceitar
          </button>
          <button
            onClick={() => {
              socket.emit("declineJobOffer");
              setJobOfferModal(null);
            }}
            className="bg-zinc-700 hover:bg-zinc-600 text-white px-5 py-2 rounded-lg transition-colors"
          >
            Recusar
          </button>
        </div>
      </div>
    </div>
  );
}
