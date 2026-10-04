/* ── OddsBadge — mercado 1X2 pré-jogo ─────────────────────────────────────
 *
 * Badge estruturado em 3 segmentos (label em cima, valor em baixo) para
 * leitura rápida das odds. "1" e "2" carregam um dot na cor da respetiva
 * equipa; o "X" leva um traço neutro. A menor odd (favorito) destaca-se com
 * fundo âmbar e as restantes ficam esbatidas.
 */

const SEGMENT_LABELS = ["1", "X", "2"];

/**
 * @param {Object} props
 * @param {Array<string>} props.odds — [home, draw, away] em "d.dd"
 * @param {string|undefined} props.hColor — cor primária da equipa da casa
 * @param {string|undefined} props.aColor — cor primária da equipa de fora
 * @param {string|undefined} props.hName — nome da equipa da casa
 * @param {string|undefined} props.aName — nome da equipa de fora
 * @returns {JSX.Element}
 */
export function OddsBadge({ odds, hColor, aColor, hName, aName }) {
  const colors = [hColor || "#6366f1", null, aColor || "#f43f5e"];
  const names = [hName || "Casa", "Empate", aName || "Fora"];
  const nums = odds.map(Number);
  const fav = nums.indexOf(Math.min(...nums));
  const summary = `Odds: ${names.map((n, i) => `${n} ${odds[i]}`).join(", ")}. Menor odd = favorito.`;

  return (
    <span
      role="group"
      aria-label={summary}
      title={summary}
      className="inline-flex items-stretch overflow-hidden rounded-md border border-amber-400/25 bg-surface-container-low/60 shadow-sm shadow-black/50"
    >
      {odds.map((value, i) => (
        <span
          key={SEGMENT_LABELS[i] || i}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1 ${
            i > 0 ? "border-l border-outline-variant/15" : ""
          } ${i === fav ? "bg-amber-400/15" : ""}`}
        >
          <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
            {colors[i] ? (
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: colors[i] }}
              />
            ) : (
              <span className="w-1.5 h-0.5 rounded-full bg-on-surface-variant/60" />
            )}
            {SEGMENT_LABELS[i]}
          </span>
          <span
            className={`text-sm font-black tabular-nums leading-none ${
              i === fav ? "text-amber-300" : "text-amber-300/60"
            }`}
          >
            {value}
          </span>
        </span>
      ))}
    </span>
  );
}
