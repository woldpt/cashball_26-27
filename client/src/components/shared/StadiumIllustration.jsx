import { memo, useId } from "react";

/**
 * Ilustração paramétrica do estádio ("câmara de transmissão" baixa:
 * vista frontal com o relvado a recuar para as bancadas e a baliza
 * assente na linha frontal).
 * Formato baixo (800×272) para as faixas curtas apanharem
 * bancada E relvado; céu compacto em cima.
 *
 * O número de anéis, a cobertura, os camarotes e o telão crescem
 * com a lotação; os acentos arquitectónicos e a multidão usam
 * as cores da equipa.
 *
 * Escalões:
 * - < 15k: 1 anel, sem cobertura, 2 postes de luz baixos
 * - 15–30k: 1 anel + cobertura + 4 postes de suporte
 * - 30–50k: 2 anéis + faixa de camarotes
 * - ≥ 50k: 3 anéis + cobertura maior + telão
 * Acima de 50k o desenho escala ligeiramente até aos 120k.
 *
 * @param {{
 *   capacity?: number,
 *   primary?: string|null,
 *   secondary?: string|null,
 *   className?: string,
 * }} props
 */

// ── Helpers de cor (determinísticos, sem dependências) ──────────────
const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));

/** "#rrggbb" ou "#rgb" → [r, g, b] (ou null se não for parseável). */
const parseColor = (hex) => {
  if (typeof hex !== "string") return null;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

const toHex = (rgb) =>
  `#${rgb.map((v) => clamp255(v).toString(16).padStart(2, "0")).join("")}`;

/** Mistura dois hex (t=0 → a, t=1 → b); devolve `a` se parsing falhar. */
const mix = (a, b, t) => {
  const A = parseColor(a);
  const B = parseColor(b);
  if (!A || !B) return a;
  return toHex(A.map((v, i) => v + (B[i] - v) * t));
};

/** amt > 0 clareia (em branco); amt < 0 escurece (em preto). */
const shade = (hex, amt) =>
  amt >= 0 ? mix(hex, "#ffffff", amt) : mix(hex, "#000000", -amt);

/** Pseudo-aleatório determinístico em [0,1) (multidão estável entre renders). */
const hash01 = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// ── Geometria (viewBox 800×272) ──────────────────────────────────────
const W = 800;
const H = 272;
const TIER_H = 28;
const BOX_H = 12;
const WALL_TOP = 146;
const PITCH_TOP = 164;
const PITCH_BOT = 260;
const PITCH_H = PITCH_BOT - PITCH_TOP;
const STAND_X0 = 84;
const STAND_X1 = 716;
const CAP_INSET = 24; // profundidade das faces laterais das bancadas
const PITCH_FAR_HALF = 380; // meia-largura do relvado na linha frontal
const PITCH_NEAR_HALF = 400; // meia-largura na borda próxima
const STRIPES = 8;
const GOAL_TOP = 146;
const GOAL_BOT = 166;
const GOAL_HALF_BOT = 34;
const GOAL_HALF_TOP = 30;

export const StadiumIllustration = memo(function StadiumIllustration({
  capacity = 10000,
  primary = null,
  secondary = null,
  className = "",
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const gid = (n) => `s${uid}-${n}`;
  const url = (n) => `url(#${gid(n)})`;

  const home = parseColor(primary) ? primary : "#4ade80";
  const away = parseColor(secondary) ? secondary : "#f8fafc";

  const tiers = capacity >= 50000 ? 3 : capacity >= 30000 ? 2 : 1;
  const roofed = capacity >= 15000;
  const grandRoof = capacity >= 50000;
  const boxes = capacity >= 30000;
  const screen = capacity >= 50000;
  // Crescimento subtil do corpo acima dos 50k (até +15% aos 120k).
  const bulk =
    capacity > 50000 ? 1 + ((Math.min(capacity, 120000) - 50000) / 70000) * 0.15 : 1;

  // ── Geometria da bancada (vista frontal) ──────────────────────
  /** Topo do anel i (0 = o de baixo). */
  const tierTop = (i) =>
    WALL_TOP - (i + 1) * TIER_H - (boxes && i >= 1 ? BOX_H : 0);
  const topY = tierTop(tiers - 1);
  const roofBaseY = topY - 12;
  const roofEdgeY = roofBaseY - 5; // aresta inferior da cobertura
  const roofTopY = roofEdgeY - (16 + (bulk - 1) * 40); // pico do arco

  /** Y do arco da cobertura na abcissa x (Bézier quadrática simétrica). */
  const roofY = (x) => {
    const t = (x - 60) / (740 - 60);
    const h = roofEdgeY - roofTopY;
    return roofEdgeY - 2 * t * (1 - t) * h;
  };

  /** Meia-largura do relvado na profundidade y (perspectiva em fuga). */
  const pitchHalf = (y) =>
    PITCH_FAR_HALF +
    ((y - PITCH_TOP) / PITCH_H) * (PITCH_NEAR_HALF - PITCH_FAR_HALF);

  /** Topo da faixa de corte s (foreshortening quadrático p/ a linha frontal). */
  const stripeTop = (i) => PITCH_TOP + PITCH_H * Math.pow(i / STRIPES, 2);

  /** Portão arquivado (path d) entre (x, bot) e (x+w, bot). */
  const gatePath = (x, w, top, bot) =>
    `M ${x} ${bot} L ${x} ${top + 4} Q ${x} ${top} ${x + w / 2} ${top} Q ${x + w} ${top} ${x + w} ${top + 4} L ${x + w} ${bot} Z`;

  /** Meia-largura do emolduramento da baliza na altura y. */
  const goalHalf = (y) =>
    GOAL_HALF_BOT -
    ((GOAL_BOT - y) / (GOAL_BOT - GOAL_TOP)) * (GOAL_HALF_BOT - GOAL_HALF_TOP);

  // ── Multidão ─────────────────────────────────────────────────────
  /** Multidão de um anel: manchas de cor (equipa + neutros) com jitter. */
  const crowdDots = (yTop, yBot, seed) => {
    const dots = [];
    const rows = Math.max(3, Math.floor((yBot - yTop - 6) / 7));
    let k = 0;
    for (let r = 0; r < rows; r += 1) {
      const yBase = yTop + 3 + ((yBot - yTop - 6) * (r + 0.5)) / rows;
      for (let x = STAND_X0 + 4 + (r % 2) * 2.5; x < STAND_X1 - 4; x += 5) {
        const zone = hash01(seed + Math.floor(x / 34) * 4.7 + r * 0.8);
        const h = hash01(seed + k * 12.9898);
        const fill =
          zone < 0.52
            ? h < 0.8
              ? home
              : shade(home, 0.3)
            : zone < 0.74
              ? h < 0.75
                ? away
                : shade(away, -0.25)
              : zone < 0.88
                ? h < 0.5
                  ? "#f7d7b6"
                  : "#e0b98f"
                : h < 0.5
                  ? "#1e293b"
                  : "#3b4a61";
        dots.push(
          <circle
            key={`${seed}-${k}`}
            cx={x + (hash01(seed + k * 3.7) - 0.5) * 2.4}
            cy={yBase + (hash01(seed + k * 9.1) - 0.5) * 1.6}
            r={1.1 + hash01(seed + k * 7.3) * 0.9}
            fill={fill}
            opacity={0.7 + hash01(seed + k * 5.1) * 0.3}
          />,
        );
        k += 1;
      }
    }
    return dots;
  };

  /** Fileiras de assentos (linhas finas) dentro de um anel. */
  const rowLines = (yTop, yBot) => {
    const lines = [];
    for (let y = yTop + 3; y < yBot - 1; y += 3.5) {
      lines.push(
        <line
          key={`row-${y.toFixed(1)}`}
          x1={STAND_X0 + 2}
          x2={STAND_X1 - 2}
          y1={y}
          y2={y}
          stroke="#020617"
          strokeWidth="0.7"
          opacity="0.12"
        />,
      );
    }
    return lines;
  };

  // ── Relvado ─────────────────────────────────────────────────────
  const stripePolys = Array.from({ length: STRIPES }, (_, s) => {
    const y0 = stripeTop(s);
    const y1 = stripeTop(s + 1);
    return (
      <path
        key={`stripe-${s}`}
        d={`M ${400 - pitchHalf(y0)} ${y0} L ${400 + pitchHalf(y0)} ${y0} L ${400 + pitchHalf(y1)} ${y1} L ${400 - pitchHalf(y1)} ${y1} Z`}
        fill={s % 2 === 0 ? "#22c55e" : "#16a34a"}
      />
    );
  });

  const netLines = [];
  for (let dx = -30; dx <= 30; dx += 5) {
    netLines.push(
      <line
        key={`net-v${dx}`}
        x1={400 + dx}
        y1={GOAL_TOP + 3}
        x2={400 + dx}
        y2={GOAL_BOT - 1.5}
        stroke="#f8fafc"
        strokeWidth="0.9"
        opacity="0.35"
      />,
    );
  }
  [153, 159].forEach((y) => {
    netLines.push(
      <line
        key={`net-h${y}`}
        x1={400 - goalHalf(y)}
        y1={y}
        x2={400 + goalHalf(y)}
        y2={y}
        stroke="#f8fafc"
        strokeWidth="0.9"
        opacity="0.3"
      />,
    );
  });

  // ── Cobertura ────────────────────────────────────────────────────
  const canopyD = `M 60 ${roofBaseY} L 60 ${roofEdgeY} Q 400 ${roofTopY} 740 ${roofEdgeY} L 740 ${roofBaseY} Z`;
  const fasciaD = `M 60 ${roofEdgeY} Q 400 ${roofTopY} 740 ${roofEdgeY}`;
  const ribs = [128, 196, 264, 332, 400, 468, 536, 604, 672].map((x) => (
    <line
      key={`rib-${x}`}
      x1={x}
      y1={roofBaseY}
      x2={x}
      y2={roofY(x) + 2}
      stroke="#64748b"
      strokeWidth="1.2"
      opacity="0.45"
    />
  ));

  // ── Telão ────────────────────────────────────────────────────────
  const screenTop = roofTopY - 10;
  const screenLabel = `${Math.round(capacity / 1000)}K`;

  // ── Bandeirolas no corrimão do topo ──────────────────────────────
  const pennants = [];
  for (let x = STAND_X0 + 10; x < STAND_X1 - 8; x += 34) {
    pennants.push(
      <polygon
        key={`pen-${x}`}
        points={`${x},${topY + 3} ${x + 14},${topY + 3} ${x + 7},${topY + 10}`}
        fill={Math.round(x / 34) % 2 === 0 ? home : away}
        opacity="0.9"
      />,
    );
  }

  const sideGates = [96, 164, 232, 300, 476, 544, 612, 680];

  return (
    <svg
      viewBox="0 0 800 272"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role="img"
      aria-label={`Estádio com ${tiers} ${tiers === 1 ? "anel" : "anéis"}`}
    >
      <defs>
        <linearGradient id={gid("sky")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="70%" stopColor="#bae6fd" />
          <stop offset="100%" stopColor="#e0f2fe" />
        </linearGradient>
        <radialGradient id={gid("sun")}>
          <stop offset="0%" stopColor="#fef9c3" stopOpacity="0.9" />
          <stop offset="55%" stopColor="#fde047" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#fde047" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={gid("lamp")}>
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={gid("haze")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id={gid("stand")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={mix(home, "#1b2438", 0.66)} />
          <stop offset="100%" stopColor={mix(home, "#0d1424", 0.9)} />
        </linearGradient>
        <linearGradient id={gid("endcap")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={shade(home, -0.42)} />
          <stop offset="100%" stopColor={shade(home, -0.72)} />
        </linearGradient>
        <linearGradient id={gid("roof")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f1f5f9" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>
        <linearGradient id={gid("concrete")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>
        <linearGradient id={gid("pitchDepth")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.2" />
          <stop offset="45%" stopColor="#000000" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={gid("standShadow")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.24" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={gid("sheen")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={gid("screenGlow")}>
          <stop offset="0%" stopColor={home} stopOpacity="0.4" />
          <stop offset="100%" stopColor={home} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={gid("stripShade")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.18" />
        </linearGradient>
        <radialGradient id={gid("vignette")} cx="50%" cy="42%" r="75%">
          <stop offset="55%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.12" />
        </radialGradient>
        <filter id={gid("blur")}>
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
      </defs>

      {/* Céu diurno */}
      <rect x="0" y="0" width={W} height={H} fill={url("sky")} />
      {/* Sol com halo */}
      <circle cx={688} cy={46} r={30} fill={url("sun")} />
      <circle cx={688} cy={46} r={12} fill="#fde047" opacity="0.95" />
      {/* Nuvens (suaves) */}
      <g fill="#ffffff" opacity="0.85" filter={url("blur")}>
        <ellipse cx={140} cy={38} rx={36} ry={10} />
        <ellipse cx={168} cy={32} rx={24} ry={8} />
        <ellipse cx={430} cy={34} rx={30} ry={8} />
        <ellipse cx={452} cy={29} rx={20} ry={7} />
        <ellipse cx={620} cy={44} rx={26} ry={7} />
      </g>
      {/* Serra ao longe (duas camadas) + haze no horizonte */}
      <ellipse cx={130} cy={94} rx={230} ry={34} fill="#aebfd0" opacity="0.38" />
      <ellipse cx={690} cy={94} rx={250} ry={36} fill="#a8bda4" opacity="0.38" />
      <ellipse cx={130} cy={97} rx={230} ry={28} fill="#8fa8bf" opacity="0.6" />
      <ellipse cx={690} cy={99} rx={250} ry={30} fill="#93a88f" opacity="0.6" />
      <rect x="0" y="64" width={W} height="32" fill={url("haze")} />
      {/* Pinheiros nas bermas, assentes no horizonte */}
      <g>
        {[
          [30, 86, 7],
          [56, 91, 5.5],
          [744, 89, 6],
          [770, 83, 7.5],
        ].map(([x, y, r]) => (
          <g key={`tree-${x}-${y}`}>
            <rect x={x - 1.5} y={y + 3} width={3} height={6} fill="#5b4632" />
            <path d={`M ${x - r} ${y + 4} L ${x + r} ${y + 4} L ${x} ${y - 3} Z`} fill="#166534" />
            <path d={`M ${x - r * 0.62} ${y - 0.5} L ${x + r * 0.62} ${y - 0.5} L ${x} ${y - r - 2} Z`} fill="#15803d" />
          </g>
        ))}
      </g>
      {/* Pássaros */}
      <g stroke="#334155" strokeWidth="1.5" fill="none" opacity="0.55" strokeLinecap="round">
        <path d="M 250 62 q 6 -6 12 0 q 6 -6 12 0" />
        <path d="M 560 56 q 5 -5 10 0 q 5 -5 10 0" />
      </g>

      {/* Torres de luz baixas (só nos pequenos, sem cobertura) */}
      {!roofed &&
        [56, 744].map((x) => (
          <g key={`light-${x}`}>
            <rect x={x - 3} y={70} width={6} height={PITCH_TOP - 70} fill="#475569" />
            <rect x={x - 28} y={48} width={56} height={22} rx={3} fill="#1e293b" stroke={away} strokeOpacity="0.5" />
            {[-18, -6, 6, 18].map((dx) => (
              <g key={`lamp-${x}-${dx}`}>
                <circle cx={x + dx} cy={59} r={10} fill={url("lamp")} opacity="0.5" />
                <circle cx={x + dx} cy={59} r={5} fill="#e2e8f0" stroke="#64748b" strokeWidth="1" />
              </g>
            ))}
          </g>
        ))}

      {/* Anéis das bancadas com perspectiva */}
      {Array.from({ length: tiers }).map((_, i) => {
        const boxTop = tierTop(i);
        const seatTop = boxTop + (boxes && i >= 1 ? BOX_H : 0);
        const seatBottom = i === 0 ? WALL_TOP : tierTop(i - 1);
        return (
          <g key={`tier-${i}`}>
            {/* Faces laterais (profundidade) */}
            <polygon
              points={`${STAND_X0},${seatTop} ${STAND_X0 - CAP_INSET},${seatTop - 6} ${STAND_X0 - CAP_INSET},${seatBottom + 8} ${STAND_X0},${seatBottom}`}
              fill={url("endcap")}
            />
            <polygon
              points={`${STAND_X1},${seatTop} ${STAND_X1 + CAP_INSET},${seatTop - 6} ${STAND_X1 + CAP_INSET},${seatBottom + 8} ${STAND_X1},${seatBottom}`}
              fill={url("endcap")}
            />
            {/* Faixa de camarotes por baixo dos anéis superiores */}
            {boxes && i >= 1 && (
              <g>
                <rect x={STAND_X0} y={boxTop} width={STAND_X1 - STAND_X0} height={BOX_H} fill="#0f172a" stroke={away} strokeOpacity="0.45" />
                {Array.from({ length: 24 }).map((__, w) => (
                  <rect
                    key={`box-${i}-${w}`}
                    x={STAND_X0 + 10 + w * 25}
                    y={boxTop + 2}
                    width={16}
                    height={BOX_H - 4}
                    fill="#cfe4f7"
                    stroke="#0f172a"
                    strokeOpacity="0.5"
                    opacity={0.6 + hash01(i * 91 + w * 7) * 0.35}
                  />
                ))}
              </g>
            )}
            {/* Assentos */}
            <rect
              x={STAND_X0}
              y={seatTop}
              width={STAND_X1 - STAND_X0}
              height={seatBottom - seatTop}
              fill={url("stand")}
              stroke="#020617"
              strokeOpacity="0.35"
              strokeWidth="1.5"
            />
            {rowLines(seatTop, seatBottom)}
            {crowdDots(seatTop, seatBottom, 100 + i * 1000)}
            {/* Passadeira de betão entre anéis + sombra ambiente */}
            <rect x={STAND_X0 - CAP_INSET} y={seatBottom - 3} width={STAND_X1 - STAND_X0 + CAP_INSET * 2} height={6} fill={url("concrete")} opacity="0.9" />
            <rect x={STAND_X0 - CAP_INSET} y={seatBottom + 1} width={STAND_X1 - STAND_X0 + CAP_INSET * 2} height={2.5} fill="#000000" opacity="0.2" />
          </g>
        );
      })}

      {/* Corrimão do topo + bandeirolas */}
      <rect x={STAND_X0 - CAP_INSET} y={topY - 2} width={STAND_X1 - STAND_X0 + CAP_INSET * 2} height={3} fill={away} opacity="0.9" />
      {pennants}

      {/* Muro base com portões */}
      <rect x={STAND_X0 - CAP_INSET} y={WALL_TOP} width={STAND_X1 - STAND_X0 + CAP_INSET * 2} height={PITCH_TOP - WALL_TOP} fill={url("concrete")} />
      <rect x={STAND_X0 - CAP_INSET} y={WALL_TOP} width={STAND_X1 - STAND_X0 + CAP_INSET * 2} height={4} fill={home} opacity="0.95" />
      <path d={gatePath(372, 56, WALL_TOP + 4, PITCH_TOP)} fill="#0f172a" opacity="0.92" stroke="#e2e8f0" strokeOpacity="0.25" />
      {sideGates.map((x) => (
        <path key={`gate-${x}`} d={gatePath(x, 22, WALL_TOP + 7, PITCH_TOP)} fill="#0f172a" opacity="0.85" />
      ))}

      {/* Cobertura */}
      {roofed && (
        <g>
          {/* postes de suporte */}
          {[140, 260, 540, 660].map((x) => (
            <rect key={`post-${x}`} x={x - 2.5} y={roofBaseY} width={5} height={topY - roofBaseY} fill="#64748b" />
          ))}
          {/* Pala superior curvada */}
          <path d={canopyD} fill={url("roof")} stroke="#64748b" strokeOpacity="0.4" strokeWidth="1.5" />
          {ribs}
          {/* Testeira com a cor do clube, a acompanhar o arco */}
          <path d={fasciaD} fill="none" stroke={home} strokeWidth={grandRoof ? 9 : 7} opacity="0.95" />
          <path d={fasciaD} fill="none" stroke={shade(home, 0.3)} strokeWidth={grandRoof ? 2 : 1.5} opacity="0.6" />
        </g>
      )}

      {/* Telão assente na cobertura (só nos grandes) */}
      {screen && (
        <g>
          <ellipse cx={400} cy={screenTop + 13} rx={95} ry={30} fill={url("screenGlow")} />
          <rect x={336} y={screenTop} width={128} height={26} rx={4} fill="#0f172a" stroke={away} strokeOpacity="0.7" strokeWidth="2" />
          <rect x={343} y={screenTop + 5} width={114} height={16} rx={2} fill={home} opacity="0.95" />
          <rect x={343} y={screenTop + 5} width={114} height={16} rx={2} fill={url("sheen")} />
          <text x={400} y={screenTop + 16.5} textAnchor="middle" fontSize="11" fontWeight="900" fill="#020617">
            {screenLabel}
          </text>
        </g>
      )}

      {/* Relvado em primeiro plano, a recuar para a linha frontal */}
      <rect x="0" y={PITCH_TOP} width={W} height={PITCH_H} fill="#14532d" />
      {stripePolys}
      <rect x="0" y={PITCH_TOP} width={W} height={PITCH_H} fill={url("pitchDepth")} />
      {/* Sombra das bancadas projetada no relvado */}
      <rect x="0" y={PITCH_TOP} width={W} height={18} fill={url("standShadow")} />
      {/* Linha de fundo */}
      <line x1={20} y1={PITCH_TOP + 1.5} x2={780} y2={PITCH_TOP + 1.5} stroke="#f8fafc" strokeWidth="1.8" opacity="0.85" />
      {/* Baliza na linha frontal (emolduramento + rede) */}
      <g>
        <polygon
          points={`${400 - GOAL_HALF_TOP},${GOAL_TOP} ${400 + GOAL_HALF_TOP},${GOAL_TOP} ${400 + GOAL_HALF_BOT},${GOAL_BOT} ${400 - GOAL_HALF_BOT},${GOAL_BOT}`}
          fill="#ffffff"
          opacity="0.07"
        />
        {netLines}
        <line x1={400 - GOAL_HALF_BOT} y1={GOAL_BOT} x2={400 - GOAL_HALF_TOP} y2={GOAL_TOP} stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" />
        <line x1={400 + GOAL_HALF_BOT} y1={GOAL_BOT} x2={400 + GOAL_HALF_TOP} y2={GOAL_TOP} stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" />
        <line x1={400 - GOAL_HALF_TOP} y1={GOAL_TOP} x2={400 + GOAL_HALF_TOP} y2={GOAL_TOP} stroke="#f8fafc" strokeWidth="3.5" strokeLinecap="round" />
      </g>
      {/* Linha de meio-campo + círculo central */}
      <line x1={10} y1={212} x2={790} y2={212} stroke="#f8fafc" strokeWidth="1.8" opacity="0.7" />
      <ellipse cx={400} cy={212} rx={52} ry={11} fill="none" stroke="#f8fafc" strokeWidth="1.8" opacity="0.8" />
      <circle cx={400} cy={212} r={2.5} fill="#f8fafc" opacity="0.9" />

      {/* Faixa inferior com as cores do clube */}
      <rect x="0" y={PITCH_BOT} width={W} height={H - PITCH_BOT} fill={home} />
      <rect x="0" y={PITCH_BOT} width={W} height={H - PITCH_BOT} fill={url("stripShade")} />
      <rect x="0" y={PITCH_BOT} width={W} height={4} fill={away} opacity="0.85" />

      {/* Vignette subtil de transmissão */}
      <rect x="0" y="0" width={W} height={H} fill={url("vignette")} />
    </svg>
  );
});
