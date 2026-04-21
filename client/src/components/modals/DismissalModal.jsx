// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from "framer-motion";
import { DIVISION_NAMES } from "../../constants/index.js";
import { formatCurrency } from "../../utils/formatters.js";

/**
 * @param {{ dismissalModal: {reason: string, teamName: string, newTeam: object}|null, onContinue: function }} props
 */
export function DismissalModal({ dismissalModal, onContinue }) {
  const newTeam = dismissalModal?.newTeam;

  return (
    <AnimatePresence>
      {dismissalModal && (
        <motion.div
          key="dismissal-backdrop"
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(127,29,29,0.15) 0%, rgba(10,10,10,0.97) 70%)",
            backdropFilter: "blur(8px)",
          }}
        >
          <motion.div
            className="relative w-full max-w-sm bg-zinc-900/90 border border-zinc-700/40 rounded-xl shadow-2xl overflow-hidden flex flex-col"
            initial={{ scale: 0.93, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.93, y: 24 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
          >
            {/* Dismissal section */}
            <div className="flex flex-col items-center gap-3 px-8 pt-8 pb-6 border-b border-zinc-800">
              <span
                className="material-symbols-outlined text-red-500"
                style={{ fontSize: "2.5rem" }}
              >
                person_off
              </span>
              <div className="text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-1">
                  Despedido
                </p>
                <p className="text-white font-bold text-base">
                  {dismissalModal.teamName}
                </p>
                <p className="text-zinc-500 text-xs mt-1">
                  {dismissalModal.reason === "budget"
                    ? "Insolvência financeira"
                    : "Má série de resultados"}
                </p>
              </div>
            </div>

            {/* New team section */}
            {newTeam && (
              <div
                className="flex flex-col items-center gap-4 px-8 pt-6 pb-7"
                style={{
                  background: newTeam.colorPrimary
                    ? `linear-gradient(160deg, ${newTeam.colorPrimary}18 0%, transparent 100%)`
                    : undefined,
                }}
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                  Novo clube atribuído
                </p>

                {/* Colour swatch */}
                <div className="relative flex items-center justify-center">
                  <div
                    className="absolute w-20 h-20 rounded-full blur-2xl opacity-25"
                    style={{ backgroundColor: newTeam.colorPrimary || "#2d6a4f" }}
                  />
                  <div
                    className="relative w-14 h-14 rounded-lg border-2 border-white/20 shadow-xl flex items-center justify-center text-2xl"
                    style={{ backgroundColor: newTeam.colorPrimary || "#2d6a4f" }}
                  >
                    ⚽
                  </div>
                </div>

                <div className="text-center">
                  <h2 className="font-black text-xl text-white tracking-tight leading-tight">
                    {newTeam.teamName}
                  </h2>
                  {newTeam.division != null && (
                    <span
                      className="inline-block mt-1 px-2 py-0.5 rounded border text-[10px] font-black tracking-widest uppercase"
                      style={{
                        borderColor: (newTeam.colorPrimary || "#2d6a4f") + "60",
                        color: newTeam.colorPrimary || "#95d4b3",
                        backgroundColor: (newTeam.colorPrimary || "#2d6a4f") + "18",
                      }}
                    >
                      {DIVISION_NAMES[newTeam.division] || `Divisão ${newTeam.division}`}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 w-full text-center">
                  <div className="bg-zinc-800/60 rounded-lg p-2.5 border border-zinc-700/30">
                    <p className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider mb-0.5">
                      Orçamento
                    </p>
                    <p className="text-white font-black text-sm">
                      {formatCurrency(newTeam.budget ?? 0)}
                    </p>
                  </div>
                  <div className="bg-zinc-800/60 rounded-lg p-2.5 border border-zinc-700/30">
                    <p className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider mb-0.5">
                      V / E / D
                    </p>
                    <p className="text-white font-black text-sm">
                      {newTeam.wins ?? 0} / {newTeam.draws ?? 0} / {newTeam.losses ?? 0}
                    </p>
                  </div>
                </div>

                <button
                  onClick={onContinue}
                  className="w-full font-black py-3.5 rounded-lg text-sm uppercase tracking-widest transition-all active:scale-95 hover:-translate-y-px shadow-lg"
                  style={{
                    backgroundColor: newTeam.colorPrimary || "#95d4b3",
                    color: newTeam.colorSecondary || "#003824",
                    boxShadow: `0 8px 24px ${newTeam.colorPrimary || "#95d4b3"}30`,
                  }}
                >
                  Assumir o comando
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
