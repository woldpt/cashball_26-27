import { WeatherOverlay } from "../match/shared/WeatherOverlay.jsx";
import { EMOJI_TO_CONDITION } from "../match/shared/weatherConditions.js";

/* Tinta por condição: duas tonalidades de relva, véu por cima. */
const TINT = {
  default: { g1: "#1f6b2a", g2: "#24782f", veil: "transparent" },
  sol: { g1: "#2f8a35", g2: "#36993c", veil: "rgba(255,200,90,0.12)" },
  chuva: { g1: "#175a24", g2: "#1b6629", veil: "rgba(20,30,50,0.25)" },
  chuva_forte: { g1: "#124a1d", g2: "#155422", veil: "rgba(10,15,30,0.4)" },
  neve: { g1: "#5d8466", g2: "#688f71", veil: "rgba(230,240,255,0.15)" },
  frio: { g1: "#22654a", g2: "#277055", veil: "rgba(150,190,255,0.12)" },
  nevoeiro: { g1: "#2c5e33", g2: "#326638", veil: "rgba(200,210,220,0.35)" },
  vento: { g1: "#21702c", g2: "#267c32", veil: "transparent" },
};

/* Poças [cx, cy, rx, ry]: zonas de desgaste (áreas, meio-campo). Com chuva
 * só as 4 primeiras; com chuva forte todas, maiores. */
const PUDDLES = [
  [300, 455, 46, 20], [455, 300, 34, 14], [175, 250, 30, 12], [560, 470, 26, 11],
  [395, 505, 30, 12], [235, 375, 40, 15], [120, 430, 24, 10], [505, 175, 28, 11],
];

/* Montes de neve [cx, cy, rx, ry]: acumula junto às linhas laterais e
 * cantos; o miolo fica pisado (só polvilhado). */
const DRIFTS = [
  [10, 300, 70, 240], [670, 280, 70, 250], [40, 520, 120, 50], [640, 515, 110, 45],
  [90, 120, 60, 90], [600, 140, 55, 85], [340, 528, 160, 22],
];
const DUST = [
  [210, 200, 40, 14], [470, 240, 46, 16], [300, 330, 30, 10], [520, 400, 36, 12],
  [160, 470, 34, 12], [420, 150, 32, 10], [250, 90, 28, 9], [600, 330, 30, 11],
];

/**
 * Faixa decorativa (só mobile): relvado em perspetiva tingido pela meteorologia.
 * Fixa no fundo do ecrã, no lugar da MobileNav (escondida durante o jogo);
 * o espaçador evita que tape o fim da lista.
 * @param {Object} props
 * @param {string} [props.emoji] Emoji do evento `weather`.
 * @param {boolean} [props.inline] Desktop: preenche o fundo do cartão pai (absolute) em vez de ficar fixa no ecrã.
 * @returns {JSX.Element}
 */
export function LivePitchStrip({ emoji, inline = false }) {
  const cond = EMOJI_TO_CONDITION[emoji];
  const t = TINT[cond] || TINT.default;
  const wet = cond === "chuva" || cond === "chuva_forte";
  const heavy = cond === "chuva_forte";
  const snowy = cond === "neve" || cond === "frio";
  const line = "rgba(255,255,255,0.55)";
  return (
    <>
    {!inline && <div aria-hidden="true" className="lg:hidden h-16" />}
    <div
      aria-hidden="true"
      className={
        inline
          ? "hidden lg:block absolute bottom-0 left-0 right-0 z-0 h-40 overflow-hidden pointer-events-none"
          : "lg:hidden fixed bottom-0 left-0 right-0 z-40 h-[calc(4rem+env(safe-area-inset-bottom))] overflow-hidden border-t border-outline-variant/30 pointer-events-none"
      }
      style={{
        perspective: "220px",
        maskImage: "linear-gradient(transparent 40%, #000 90%)",
        WebkitMaskImage: "linear-gradient(transparent 40%, #000 90%)",
      }}
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

        <defs>
          {/* Bordas orgânicas: turbulência desloca o contorno das elipses. */}
          <filter id="lps-ragged" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="7" />
            <feDisplacementMap in="SourceGraphic" scale="22" />
          </filter>
          <filter id="lps-soft" x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="3" />
            <feDisplacementMap in="SourceGraphic" scale="40" />
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <radialGradient id="lps-water" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#9fb8d6" stopOpacity="0.75" />
            <stop offset="55%" stopColor="#3d5a78" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#1b2d22" stopOpacity="0.55" />
          </radialGradient>
          <radialGradient id="lps-snow" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="70%" stopColor="#eef4fb" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#dbe6f2" stopOpacity="0" />
          </radialGradient>
        </defs>

        {wet && (
          <g>
            {PUDDLES.slice(0, heavy ? 8 : 4).map(([cx, cy, rx, ry], i) => {
              const k = heavy ? 1.35 : 1;
              return (
                <g key={i}>
                  {/* orla de lama */}
                  <ellipse cx={cx} cy={cy + 2} rx={rx * k + 8} ry={ry * k + 5} fill="rgba(40,30,15,0.35)" filter="url(#lps-soft)" />
                  <g filter="url(#lps-ragged)">
                    <ellipse cx={cx} cy={cy} rx={rx * k} ry={ry * k} fill="url(#lps-water)" />
                    {/* reflexo do céu/holofotes */}
                    <ellipse cx={cx - rx * 0.25} cy={cy - ry * 0.3} rx={rx * k * 0.45} ry={ry * k * 0.18} fill="rgba(255,255,255,0.45)" />
                  </g>
                  <ellipse className="lps-ripple" cx={cx + rx * 0.2} cy={cy} rx={rx * 0.5} ry={ry * 0.5} fill="none" stroke="rgba(220,235,255,0.7)" strokeWidth="1.5" style={{ animationDelay: `${-i * 0.37}s` }} />
                  {heavy && (
                    <ellipse className="lps-ripple" cx={cx - rx * 0.3} cy={cy + ry * 0.2} rx={rx * 0.4} ry={ry * 0.4} fill="none" stroke="rgba(220,235,255,0.6)" strokeWidth="1.2" style={{ animationDelay: `${-i * 0.37 - 0.6}s` }} />
                  )}
                </g>
              );
            })}
          </g>
        )}

        {snowy && (
          <g>
            <g filter="url(#lps-soft)">
              {(cond === "neve" ? DRIFTS : DRIFTS.slice(0, 2)).map(([cx, cy, rx, ry], i) => (
                <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#lps-snow)" opacity={cond === "neve" ? 1 : 0.45} />
              ))}
            </g>
            <g filter="url(#lps-ragged)" opacity={cond === "neve" ? 0.75 : 0.35}>
              {DUST.map(([cx, cy, rx, ry], i) => (
                <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill="#f4f8fc" />
              ))}
            </g>
            {/* brilhos de gelo */}
            {cond === "neve" &&
              DUST.map(([cx, cy], i) => (
                <circle key={i} className="lps-glint" cx={cx + 12} cy={cy - 3} r="2.2" fill="#fff" style={{ animationDelay: `${-i * 0.9}s` }} />
              ))}
          </g>
        )}
      </svg>
      <div className="absolute inset-0" style={{ background: t.veil }} />
      <WeatherOverlay emoji={emoji} />
    </div>
    </>
  );
}
