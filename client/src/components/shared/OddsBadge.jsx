/* ── OddsBadge — mercado 1X2 pré-jogo ─────────────────────────────────────
 *
 * Badge estruturado em 3 segmentos (label em cima, valor em baixo) para
 * leitura rápida das odds. Os segmentos "1" e "2" carregam um dot na cor da
 * respetiva equipa (casa/fora) para mapear visualmente as odds às equipas.
 */

const SEGMENT_LABELS = ["1", "X", "2"];

/**
 * @param {Object} props
 * @param {Array<string>} props.odds — [home, draw, away] em "d.dd"
 * @param {string|undefined} props.hColor — cor primária da equipa da casa
 * @param {string|undefined} props.aColor — cor primária da equipa de fora
 */
export function OddsBadge({ odds, hColor, aColor }) {
  const colors = [hColor || "#6366f1", null, aColor || "#f43f5e"];

  return (
    <span className="inline-flex items-stretch overflow-hidden rounded-md border border-amber-400/25 bg-surface-container-low/60 shadow-sm shadow-black/50">
      {odds.map((value, i) => (
        <span
          key={SEGMENT_LABELS[i] || i}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1 ${
            i > 0 ? "border-l border-outline-variant/15" : ""
          }`}
        >
          <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-on-surface-variant/80">
            {colors[i] && (
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: colors[i] }}
              />
            )}
            {SEGMENT_LABELS[i]}
          </span>
          <span className="text-sm font-black tabular-nums leading-none text-amber-300/95">
            {value}
          </span>
        </span>
      ))}
    </span>
  );
}
