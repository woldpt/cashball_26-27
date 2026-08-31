 
import { motion } from "framer-motion";
import { DIVISION_NAMES, MODAL_Z } from "../../constants/index.js";
import { formatCurrency } from "../../utils/formatters.js";
import { ModalShell } from "../shared/ModalShell.jsx";
import {
  markWelcomeSeen,
  markWelcomeSeenThisSession,
} from "../../utils/localStorage.js";

/**
 * @param {{ welcomeModal: object, me: object, setWelcomeModal: function }} props
 */
export function WelcomeModal({ welcomeModal, me, setWelcomeModal }) {
  return (
    <ModalShell
      visible={!!welcomeModal && !!me?.teamId}
      z={MODAL_Z.default}
      variant="fullscreen"
      backdropStyle={{
        background:
          "radial-gradient(ellipse at center, rgba(45,106,79,0.18) 0%, rgba(10,10,10,0.97) 70%)",
        backdropFilter: "blur(8px)",
      }}
    >
      {welcomeModal && me?.teamId && (
      <>
      {/* Technical grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 2px 2px, rgba(45,106,79,0.25) 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Modal card — two-column layout */}
      <motion.div
        className="relative w-full max-w-2xl bg-surface-container border border-primary/20 rounded-xl shadow-2xl overflow-hidden flex flex-col sm:flex-row my-auto short:max-h-[calc(100dvh-2rem)] short:overflow-y-auto"
        initial={{ scale: 0.93, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.93, y: 24 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
      >
            {/* ── Left column: team identity ── */}
            <div
              className="sm:w-2/5 flex flex-col items-center justify-center gap-3 short:gap-2 p-5 sm:p-8 short:p-4 border-b sm:border-b-0 sm:border-r border-emerald-900/30"
              style={{
                background: welcomeModal.colorPrimary
                  ? `linear-gradient(160deg, ${welcomeModal.colorPrimary}22 0%, rgba(10,10,10,0.6) 100%)`
                  : "linear-gradient(160deg, rgba(45,106,79,0.15) 0%, rgba(10,10,10,0.6) 100%)",
              }}
            >
              {/* Colour swatch / crest placeholder */}
              <div className="relative flex items-center justify-center">
                <div
                  className="absolute w-20 h-20 sm:w-28 sm:h-28 rounded-full blur-3xl opacity-30"
                  style={{
                    backgroundColor: welcomeModal.colorPrimary || "#2d6a4f",
                  }}
                />
                <div
                  className="relative w-14 h-14 sm:w-20 sm:h-20 short:w-14 short:h-14 rounded-lg border-2 border-white/20 shadow-xl flex items-center justify-center text-3xl sm:text-4xl short:text-3xl"
                  style={{
                    backgroundColor: welcomeModal.colorPrimary || "#2d6a4f",
                  }}
                >
                  ⚽
                </div>
              </div>

              {/* Team name */}
              <div className="text-center">
                <h2 className="font-black text-2xl short:text-lg text-white tracking-tight leading-tight uppercase">
                  {welcomeModal.teamName}
                </h2>
                <p className="text-amber-400 text-sm short:text-xs font-bold mt-2 short:mt-1.5 uppercase tracking-widest">
                  Treinador: {me.name}
                </p>
                {welcomeModal.division != null && (
                  <span
                    className="inline-block mt-2 px-3 py-1 rounded border text-[10px] font-black tracking-widest uppercase"
                    style={{
                      borderColor:
                        (welcomeModal.colorPrimary || "#2d6a4f") + "60",
                      color: welcomeModal.colorPrimary || "#95d4b3",
                      backgroundColor:
                        (welcomeModal.colorPrimary || "#2d6a4f") + "18",
                    }}
                  >
                    {DIVISION_NAMES[welcomeModal.division] ||
                      `Divisão ${welcomeModal.division}`}
                  </span>
                )}
              </div>
            </div>

            {/* ── Right column: content ── */}
            <div className="sm:w-3/5 flex flex-col justify-center p-5 sm:p-8 short:p-3">
              {/* Eyebrow tag */}
              <p
                className={`text-[10px] font-black uppercase tracking-widest mb-2 short:mb-1 ${welcomeModal.isNew ? "text-amber-400" : "text-emerald-400"}`}
              >
                {welcomeModal.isNew ? "🎲 Sorteio" : "👋 Bem-vindo de volta"}
              </p>

              {/* Headline */}
              <h1 className="font-black text-2xl sm:text-4xl short:text-lg text-white leading-tight tracking-tight mb-3 short:mb-2">
                {welcomeModal.isNew ? (
                  <>
                    A TUA JORNADA
                    <br />
                    <span className="text-emerald-400">COMEÇA AGORA</span>
                  </>
                ) : (
                  <>
                    CONTINUA
                    <br />
                    <span className="text-emerald-400">A MISSÃO</span>
                  </>
                )}
              </h1>

              <p className="text-zinc-400 text-sm short:text-xs mb-4 short:mb-2 leading-relaxed short:leading-snug">
                {welcomeModal.isNew
                  ? `Foste sorteado para liderar o ${welcomeModal.teamName}. O sucesso do clube está nas tuas mãos.`
                  : `Retoma o comando do ${welcomeModal.teamName} e continua a lutar por mais.`}
              </p>

              {/* Bento stats grid */}
              {welcomeModal.isNew ? (
                <div className="grid grid-cols-2 gap-2 mb-3 short:mb-2">
                  <div className="bg-zinc-800/60 rounded-lg p-2.5 short:p-1.5 border border-emerald-900/20 hover:border-emerald-500/30 transition-colors">
                    <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">
                      Orçamento Inicial
                    </p>
                    <p className="text-white font-black text-sm short:text-xs short:tracking-tight">
                      {formatCurrency(welcomeModal.budget ?? 0)}
                    </p>
                  </div>
                  {welcomeModal.stadiumCapacity > 0 && (
                    <div className="bg-zinc-800/60 rounded-lg p-2.5 short:p-1.5 border border-emerald-900/20 hover:border-emerald-500/30 transition-colors">
                      <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">
                        Estádio
                      </p>
                      <p className="text-white font-black text-sm short:text-xs short:tracking-tight">
                        {(welcomeModal.stadiumCapacity ?? 0).toLocaleString(
                          "pt-PT",
                        )}{" "}
                        lug.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 short:grid-cols-4 gap-2 short:gap-1.5 mb-3 short:mb-2">
                  <div className="bg-zinc-800/60 rounded-lg p-2.5 short:p-1.5 border border-emerald-900/20 hover:border-emerald-500/30 transition-colors">
                    <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">
                      Pontos
                    </p>
                    <p className="text-white font-black text-sm short:text-xs short:tracking-tight">
                      {welcomeModal.points ?? 0} pts
                    </p>
                  </div>
                  <div className="bg-zinc-800/60 rounded-lg p-2.5 short:p-1.5 border border-emerald-900/20 hover:border-emerald-500/30 transition-colors">
                    <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">
                      V / E / D
                    </p>
                    <p className="text-white font-black text-sm short:text-xs short:tracking-tight">
                      {welcomeModal.wins ?? 0} / {welcomeModal.draws ?? 0} /{" "}
                      {welcomeModal.losses ?? 0}
                    </p>
                  </div>
                  <div className="bg-zinc-800/60 rounded-lg p-2.5 short:p-1.5 border border-emerald-900/20 hover:border-emerald-500/30 transition-colors">
                    <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">
                      Golos
                    </p>
                    <p className="text-white font-black text-sm short:text-xs short:tracking-tight">
                      {welcomeModal.goalsFor ?? 0} –{" "}
                      {welcomeModal.goalsAgainst ?? 0}
                    </p>
                  </div>
                  <div className="bg-zinc-800/60 rounded-lg p-2.5 short:p-1.5 border border-emerald-900/20 hover:border-emerald-500/30 transition-colors">
                    <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">
                      Orçamento
                    </p>
                    <p className="text-white font-black text-sm short:text-xs short:tracking-tight">
                      {formatCurrency(welcomeModal.budget ?? 0)}
                    </p>
                  </div>
                </div>
              )}

              {/* Invite code */}
              {welcomeModal.coaches && welcomeModal.coaches.length > 0 && (
                <div className="w-full bg-zinc-800/60 rounded-lg p-2.5 short:p-2 border border-emerald-900/30 mb-3 short:mb-2">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block mb-1">
                    Outros Treinadores:
                  </span>
                  <span className="font-bold text-amber-400 text-xs">
                    {welcomeModal.coaches.join(", ")}
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(me.roomCode);
                }}
                className="w-full flex items-center justify-between gap-3 bg-zinc-800/60 rounded-lg p-2.5 short:p-2 border border-emerald-900/30 hover:border-emerald-500/50 transition-colors mb-3 short:mb-2 cursor-pointer"
              >
                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                  Código de Convite:
                </span>
                <span className="font-black text-emerald-400 text-lg tracking-widest">
                  {me.roomCode}
                </span>
              </button>

              {/* Action button */}
              <button
                onClick={() => {
                  if (welcomeModal.isNew) {
                    markWelcomeSeen(me.name, me.roomCode);
                  } else {
                    markWelcomeSeenThisSession(me.name, me.roomCode);
                  }
                  setWelcomeModal(null);
                }}
                className="w-full font-black py-2.5 short:py-2 rounded-lg text-sm uppercase tracking-widest transition-all active:scale-95 hover:-translate-y-px shadow-lg"
                style={{
                  backgroundColor: welcomeModal.colorPrimary || "#95d4b3",
                  color: welcomeModal.colorSecondary || "#003824",
                  boxShadow: `0 8px 24px ${welcomeModal.colorPrimary || "#95d4b3"}30`,
                }}
              >
                {welcomeModal.isNew ? "Vamos lá! 🚀" : "Continuar 🎯"}
              </button>
            </div>
          </motion.div>
      </>
      )}
    </ModalShell>
  );
}
