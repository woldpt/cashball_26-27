import { motion, AnimatePresence } from "framer-motion";

/**
 * @param {{ dismissalModal: {reason: string, teamName: string}|null, onContinue: function }} props
 */
export function DismissalModal({ dismissalModal, onContinue }) {
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
              "radial-gradient(ellipse at center, rgba(127,29,29,0.18) 0%, rgba(10,10,10,0.97) 70%)",
            backdropFilter: "blur(8px)",
          }}
        >
          <motion.div
            className="relative w-full max-w-sm bg-zinc-900/90 border border-red-900/40 rounded-xl shadow-2xl overflow-hidden flex flex-col items-center gap-6 p-8"
            initial={{ scale: 0.93, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.93, y: 24 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
          >
            <span
              className="material-symbols-outlined text-red-500"
              style={{ fontSize: "3.5rem" }}
            >
              person_off
            </span>

            <div className="text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-2">
                Despedido
              </p>
              <h2 className="font-black text-2xl text-white tracking-tight leading-tight mb-1">
                {dismissalModal.teamName}
              </h2>
              <p className="text-zinc-400 text-sm leading-relaxed">
                {dismissalModal.reason === "budget"
                  ? "Insolvência financeira."
                  : "Má série de resultados."}
              </p>
            </div>

            <p className="text-zinc-500 text-xs text-center leading-relaxed">
              O sistema atribuiu-te um novo clube.
            </p>

            <button
              onClick={onContinue}
              className="w-full font-black py-4 rounded-lg text-sm uppercase tracking-widest transition-all active:scale-95 hover:-translate-y-px shadow-lg bg-red-900/60 hover:bg-red-800/70 text-red-100 border border-red-700/40"
            >
              Ver novo clube
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
