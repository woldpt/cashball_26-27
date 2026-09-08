import * as React from "react";

/* ── TeamCrest — crest colorido + badge do treinador ─────────────────────
 *
 * Crest quadrado (3 letras do clube na cor primary/secondary do team) com
 * badge do treinador por baixo: primary se for o clube do utilizador, amber
 * para os outros treinadores humanos.
 */

/**
 * @param {Object} props
 * @param {{color_primary?: string, color_secondary?: string, name?: string, crest?: string|null}|undefined} props.team
 * @param {boolean} [props.isMine]  - se o clube pertence ao utilizador
 * @param {{name?: string}|null|undefined} [props.coach] - treinador humano (se houver)
 * @param {"sm"|"md"|"lg"} [props.size]
 * @param {number} [props.rotate]  - rotação (graus) + zoom subtil aplicados ao quadrado do
 *   logótipo para destacar o centro; casa (esq.) positivo, fora (dir.) negativo para
 *   ambos se inclinarem para o placar central. Badge do treinador fica inalterado.
 */
export function TeamCrest({ team, isMine = false, coach = null, size = "md", rotate = 0 }) {
  const hasCrest = !!team?.crest;
  const [imgFailed, setImgFailed] = React.useState(false);
  const showImg = hasCrest && !imgFailed;
  const dims =
    size === "lg"
      ? "w-14 h-14 sm:w-20 sm:h-20 text-base sm:text-xl rounded-xl"
      : size === "sm"
        ? "w-9 h-9 sm:w-12 sm:h-12 text-xs sm:text-[15px] rounded-lg"
        : "w-11 h-11 sm:w-12 sm:h-12 text-sm sm:text-base rounded-lg";
  // Transformação centrada no quadrado do logótipo (sem afetar o badge do treinador).
  const mediaStyle = rotate
    ? { transform: `rotate(${rotate}deg) scale(1.06)`, transformOrigin: "center" }
    : undefined;
  return (
    <div className="relative shrink-0">
      {showImg ? (
        <img
          src={team.crest}
          alt={team.name || "crest"}
          onError={() => setImgFailed(true)}
          style={mediaStyle}
          className={`${dims} object-contain bg-white p-1.5 border-2 ${isMine ? "border-primary" : "border-outline-variant/20"}`}
          loading="lazy"
        />
      ) : (
        <span
          className={`${dims} flex items-center justify-center font-black border-2 ${
            isMine ? "border-primary" : "border-outline-variant/20"
          }`}
          style={{
            backgroundColor: team?.color_primary || "#333",
            color: team?.color_secondary || "#fff",
            ...mediaStyle,
          }}
        >
          {(team?.name || "").substring(0, 3).toUpperCase()}
        </span>
      )}
      {coach && (
        <span
          className={`absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-sm font-black text-[8px] tracking-widest uppercase whitespace-nowrap shadow-lg ${
            isMine ? "bg-primary text-on-primary" : "bg-amber-500 text-zinc-950"
          }`}
        >
          {coach.name}
        </span>
      )}
    </div>
  );
}
