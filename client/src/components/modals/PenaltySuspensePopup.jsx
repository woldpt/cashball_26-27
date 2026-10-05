import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ModalShell } from "../shared/ModalShell.jsx";
import { MODAL_Z, PENALTY_SUSPENSE_REVEAL_MS } from "../../constants/index.js";

/**
 * @param {Object} props
 * @param {{ playerName: string, result: string, isGoal: boolean }|null} props.penaltySuspense
 * @returns {JSX.Element|null}
 */
export function PenaltySuspensePopup({ penaltySuspense }) {
  // Em vez de reset síncrono dentro do useEffect (cascading render), comparamos
  // a referência para a qual o timer já disparou. Quando `penaltySuspense` muda,
  // `revealedFor` ainda aponta para o valor antigo → showResult fica false até
  // o timer do novo valor disparar.
  const [revealedFor, setRevealedFor] = useState(null);

  useEffect(() => {
    if (!penaltySuspense) return;
    const timer = setTimeout(
      () => setRevealedFor(penaltySuspense),
      PENALTY_SUSPENSE_REVEAL_MS,
    );
    return () => clearTimeout(timer);
  }, [penaltySuspense]);

  // Último penálti mostrado: mantém o conteúdo durante a animação de saída
  // (o pai passa a null no mesmo tick em que dispara o festejo do golo).
  const [shown, setShown] = useState(penaltySuspense);
  if (penaltySuspense && penaltySuspense !== shown) setShown(penaltySuspense);
  const data = penaltySuspense ?? shown;
  if (!data) return null;
  const showResult = revealedFor === data;

  return (
    <ModalShell
      visible={!!penaltySuspense}
      z={MODAL_Z.penalty}
      variant="transparent"
    >
      <motion.div
        exit={{ scale: 0.85, opacity: 0 }}
        transition={{ duration: 0.18 }}
        role="status"
        aria-live="assertive"
        className={`bg-surface-container border-2 border-amber-500/50 rounded-xl px-8 py-6 text-center shadow-2xl ${
          showResult ? "" : "motion-safe:animate-bounce"
        }`}
      >
        <p className="text-xs text-amber-400 uppercase font-black tracking-widest mb-2">
          Penálti
        </p>
        <p className="text-on-surface-variant text-sm font-bold mb-1">
          {data.playerName}
        </p>
        {showResult ? (
          <p
            className={`text-3xl font-black ${
              data.isGoal ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {data.result}
          </p>
        ) : (
          <p className="text-3xl font-black text-amber-300 motion-safe:animate-pulse">
            ...
          </p>
        )}
      </motion.div>
    </ModalShell>
  );
}