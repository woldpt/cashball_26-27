import { PitchFormation } from "./PitchFormation.jsx";

/* ── MatchPitch — Fit-to-parent pitch box (9:16, never overflows) ──────
 *
 * Dimensionamento:
 *   - mobile: width-driven (w-full, max 300px) → height vem do aspect-ratio.
 *   - desktop: height-driven (h-full) → width = height × 9/16, limitado por
 *     max-w-full. Sem max-w-full, o pitch extravasa a coluna e é cortado
 *     pelo overflow-hidden do wrapper (pitch "desformatado" em janelas md).
 *   - O SVG usa preserveAspectRatio="none", por isso linhas e jogadores
 *     mantêm-se alinhados mesmo quando a caixa é clampada por max-w-full.
 */
export function MatchPitch({ rows, posColors, starColor, emptyLabel, className = "", showFatigue = true }) {
  const isEmpty =
    !rows || Object.values(rows).every((arr) => !arr || arr.length === 0);

  return (
    <div
      className={`relative w-full max-w-[280px] mx-auto md:mx-0 md:w-auto md:h-full md:max-w-full rounded-md overflow-hidden border border-outline-variant/25 bg-[linear-gradient(180deg,#05430e_0%,#0b5e1a_50%,#05430e_100%)] shadow-[0_0_30px_rgba(5,67,14,0.3)] ${className}`}
      style={{ aspectRatio: "9/16" }}
    >
      {isEmpty ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-on-surface-variant/60 text-xs font-bold text-center px-4">
            {emptyLabel || "Sem escalação disponível"}
          </p>
        </div>
      ) : (
        <PitchFormation rows={rows} posColors={posColors} starColor={starColor} showFatigue={showFatigue} />
      )}
    </div>
  );
}
