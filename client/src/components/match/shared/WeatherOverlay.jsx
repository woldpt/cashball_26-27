import { useMemo } from "react";

/* Emoji do evento `weather` → condição (o evento só transporta o emoji). */
const EMOJI_TO_CONDITION = {
  "☀️": "sol",
  "🌧️": "chuva",
  "⛈️": "chuva_forte",
  "💨": "vento",
  "🥶": "frio",
  "🌫️": "nevoeiro",
  "❄️": "neve",
};

/* Partículas por condição: n = quantidade, kind = classe CSS base. */
const PARTICLES = {
  chuva: { n: 40, kind: "wx-rain" },
  chuva_forte: { n: 80, kind: "wx-rain wx-rain-heavy" },
  neve: { n: 46, kind: "wx-snow" },
  frio: { n: 14, kind: "wx-snow wx-snow-sparse" },
  vento: { n: 16, kind: "wx-gust" },
  nevoeiro: { n: 5, kind: "wx-fog" },
};

/** Pseudo-aleatório determinístico (evita saltos entre renders). */
function seeded(i, salt) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Camada visual de meteorologia sobre o relvado (só CSS, pointer-events none).
 * Animação ligada apenas sem prefers-reduced-motion (ver index.css).
 * @param {Object} props
 * @param {string} [props.emoji] Emoji do evento `weather`.
 * @param {string} [props.condition] Condição direta (sobrepõe o emoji).
 * @returns {JSX.Element|null}
 */
export function WeatherOverlay({ emoji, condition }) {
  const cond = condition || EMOJI_TO_CONDITION[emoji];
  const spec = PARTICLES[cond];
  const items = useMemo(() => {
    if (!spec) return [];
    return Array.from({ length: spec.n }, (_, i) => ({
      left: `${(seeded(i, 1) * 100).toFixed(1)}%`,
      top: `${(seeded(i, 4) * 100).toFixed(1)}%`,
      delay: `${(-seeded(i, 2) * 6).toFixed(2)}s`,
      dur: `${(0.5 + seeded(i, 3) * 0.6).toFixed(2)}`,
      size: (0.6 + seeded(i, 5) * 0.8).toFixed(2),
    }));
  }, [spec]);

  if (!cond) return null;

  return (
    <div
      aria-hidden="true"
      className={`wx-layer wx-${cond} absolute inset-0 pointer-events-none overflow-hidden z-20`}
    >
      {items.map((p, i) => (
        <span
          key={i}
          className={spec.kind}
          style={{
            left: p.left,
            top: p.top,
            animationDelay: p.delay,
            "--wx-dur": p.dur,
            "--wx-size": p.size,
          }}
        />
      ))}
    </div>
  );
}
