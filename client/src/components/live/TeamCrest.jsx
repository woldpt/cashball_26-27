/* ── TeamCrest — crest colorido + badge do treinador ─────────────────────
 *
 * Crest quadrado (3 letras do clube na cor primary/secondary do team) com
 * badge do treinador por baixo: primary se for o clube do utilizador, amber
 * para os outros treinadores humanos.
 */

/**
 * @param {Object} props
 * @param {{color_primary?: string, color_secondary?: string, name?: string}|undefined} props.team
 * @param {boolean} [props.isMine]  - se o clube pertence ao utilizador
 * @param {{name?: string}|null|undefined} [props.coach] - treinador humano (se houver)
 * @param {"md"|"lg"} [props.size]
 */
export function TeamCrest({ team, isMine = false, coach = null, size = "md" }) {
  const dims =
    size === "lg"
      ? "w-14 h-14 sm:w-20 sm:h-20 text-base sm:text-xl rounded-xl"
      : size === "sm"
        ? "w-9 h-9 sm:w-11 sm:h-11 text-xs sm:text-sm rounded-lg"
        : "w-11 h-11 sm:w-12 sm:h-12 text-sm sm:text-base rounded-lg";
  return (
    <div className="relative shrink-0">
      <span
        className={`${dims} flex items-center justify-center font-black border-2 ${
          isMine ? "border-primary" : "border-outline-variant/20"
        }`}
        style={{
          backgroundColor: team?.color_primary || "#333",
          color: team?.color_secondary || "#fff",
        }}
      >
        {(team?.name || "").substring(0, 3).toUpperCase()}
      </span>
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
