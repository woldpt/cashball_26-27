import { useState, useEffect } from "react";
import { ModalShell } from "../shared/ModalShell.jsx";
import { MODAL_Z } from "../../constants/index.js";

/**
 * @param {{ penaltySuspense: object|null }} props
 */
export function PenaltySuspensePopup({ penaltySuspense }) {
  // Em vez de reset síncrono dentro do useEffect (cascading render), comparamos
  // a referência para a qual o timer já disparou. Quando `penaltySuspense` muda,
  // `revealedFor` ainda aponta para o valor antigo → showResult fica false até
  // o timer do novo valor disparar.
  const [revealedFor, setRevealedFor] = useState(null);

  useEffect(() => {
    if (!penaltySuspense) return;
    const timer = setTimeout(() => setRevealedFor(penaltySuspense), 2000);
    return () => clearTimeout(timer);
  }, [penaltySuspense]);

  if (!penaltySuspense) return null;
  const showResult = revealedFor === penaltySuspense;

  return (
    <ModalShell
      visible={!!penaltySuspense}
      z={MODAL_Z.penalty}
      variant="transparent"
    >
      <div className="bg-surface-container border-2 border-amber-500/50 rounded-xl px-8 py-6 text-center shadow-2xl animate-bounce">
        <p className="text-xs text-amber-400 uppercase font-black tracking-widest mb-2">
          Penálti
        </p>
        <p className="text-on-surface-variant text-sm font-bold mb-1">
          {penaltySuspense.playerName}
        </p>
        {showResult ? (
          <p
            className={`text-3xl font-black ${
              penaltySuspense.result === "GOLO!!!"
                ? "text-emerald-400"
                : "text-red-400"
            }`}
          >
            {penaltySuspense.result}
          </p>
        ) : (
          <p className="text-3xl font-black text-amber-300 animate-pulse">
            ...
          </p>
        )}
      </div>
    </ModalShell>
  );
}
