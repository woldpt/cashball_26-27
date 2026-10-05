import { WeatherOverlay, EMOJI_TO_CONDITION } from "../match/shared/WeatherOverlay.jsx";

/* Tinta por condição: céu (topo), duas tonalidades de relva, véu por cima. */
const TINT = {
  default: { sky: "#0b1a2e", g1: "#1f6b2a", g2: "#24782f", veil: "transparent" },
  sol: { sky: "#3a5f8a", g1: "#2f8a35", g2: "#36993c", veil: "rgba(255,200,90,0.12)" },
  chuva: { sky: "#1a2433", g1: "#175a24", g2: "#1b6629", veil: "rgba(20,30,50,0.25)" },
  chuva_forte: { sky: "#0d131c", g1: "#124a1d", g2: "#155422", veil: "rgba(10,15,30,0.4)" },
  neve: { sky: "#9aa8b8", g1: "#a9bfae", g2: "#c3d3c6", veil: "rgba(230,240,255,0.15)" },
  frio: { sky: "#2a3d55", g1: "#22654a", g2: "#277055", veil: "rgba(150,190,255,0.12)" },
  nevoeiro: { sky: "#59626b", g1: "#2c5e33", g2: "#326638", veil: "rgba(200,210,220,0.35)" },
  vento: { sky: "#2b4560", g1: "#21702c", g2: "#267c32", veil: "transparent" },
};

/**
 * Faixa decorativa (só mobile): relvado em perspetiva tingido pela meteorologia.
 * @param {Object} props
 * @param {string} [props.emoji] Emoji do evento `weather`.
 * @returns {JSX.Element}
 */
export function LivePitchStrip({ emoji }) {
  const t = TINT[EMOJI_TO_CONDITION[emoji]] || TINT.default;
  const line = "rgba(255,255,255,0.55)";
  return (
    <div
      aria-hidden="true"
      className="md:hidden relative h-16 mt-3 overflow-hidden rounded-md pointer-events-none"
      style={{ perspective: "220px", background: `linear-gradient(${t.sky}, ${t.g1} 45%)` }}
    >
      <svg
        viewBox="0 0 680 525"
        preserveAspectRatio="none"
        className="absolute left-[-30%] w-[160%] bottom-0 h-[220%]"
        style={{ transform: "rotateX(62deg)", transformOrigin: "bottom" }}
      >
        {Array.from({ length: 7 }, (_, i) => (
          <rect key={i} x="0" y={i * 75} width="680" height="75" fill={i % 2 ? t.g1 : t.g2} />
        ))}
        <g fill="none" stroke={line} strokeWidth="4">
          <rect x="20" y="10" width="640" height="530" />
          <line x1="20" y1="10" x2="660" y2="10" />
          <circle cx="340" cy="10" r="92" />
          <rect x="138" y="360" width="404" height="180" />
          <rect x="248" y="480" width="184" height="60" />
          <path d="M 266 360 A 92 92 0 0 1 414 360" />
        </g>
        <circle cx="340" cy="10" r="5" fill={line} />
        <circle cx="340" cy="420" r="5" fill={line} />
      </svg>
      <div className="absolute inset-0" style={{ background: t.veil, boxShadow: "inset 0 10px 18px rgba(0,0,0,0.35)" }} />
      <WeatherOverlay emoji={emoji} />
    </div>
  );
}
