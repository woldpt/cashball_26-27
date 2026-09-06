/**
 * Ilustração paramétrica do estádio (vista lateral em corte).
 * O número de anéis, a cobertura, os camarotes e o telão crescem
 * com a lotação; as bancadas usam as cores da equipa.
 *
 * Escalões:
 * - < 15k: 1 anel, sem cobertura, 2 postes de luz
 * - 15–30k: 1 anel + cobertura lateral + 4 torres
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
export function StadiumIllustration({
  capacity = 10000,
  primary = null,
  secondary = null,
  className = "",
}) {
  const home = primary || "#4ade80";
  const away = secondary || "#f8fafc";

  const tiers = capacity >= 50000 ? 3 : capacity >= 30000 ? 2 : 1;
  const roofed = capacity >= 15000;
  const grandRoof = capacity >= 50000;
  const boxes = capacity >= 30000;
  const screen = capacity >= 50000;
  const towerXs = capacity < 15000 ? [36, 764] : [36, 200, 600, 764];
  // Crescimento subtil do corpo acima dos 50k (até +15% aos 120k).
  const bulk =
    capacity > 50000 ? 1 + ((Math.min(capacity, 120000) - 50000) / 70000) * 0.15 : 1;

  const TIER_H = 52 * bulk;
  const BASE_Y = 302;
  const BOX_H = boxes ? 16 : 0;
  const tierTopY = BASE_Y - tiers * TIER_H - BOX_H;
  const roofY = tierTopY - (grandRoof ? 30 : 22);

  /** Cantos de um anel: dentro-baixo, dentro-topo, fora-topo, fora-baixo. */
  const tierCorners = (side, i) => {
    const boxOffset = boxes && i >= 1 ? BOX_H : 0;
    const yB = BASE_Y - i * TIER_H - boxOffset;
    const yT = yB - TIER_H;
    const spread = i * 26 * bulk;
    if (side === "L") {
      return {
        xInB: 302 - spread * 0.4, yB,
        xInT: 272 - spread * 0.4, yT,
        xOutT: 112 - spread, yT2: yT,
        xOutB: 152 - spread, yB2: yB,
      };
    }
    return {
      xInB: 498 + spread * 0.4, yB,
      xInT: 528 + spread * 0.4, yT,
      xOutT: 688 + spread, yT2: yT,
      xOutB: 648 + spread, yB2: yB,
    };
  };

  const tierPoints = (side, i) => {
    const c = tierCorners(side, i);
    return `${c.xInB},${c.yB} ${c.xInT},${c.yT} ${c.xOutT},${c.yT2} ${c.xOutB},${c.yB2}`;
  };

  /** 3 filas de assentos por anel. */
  const seatRows = (side, i) => {
    const c = tierCorners(side, i);
    const rows = [];
    for (let r = 0; r < 3; r += 1) {
      const t = (r + 1) / 4;
      const y = c.yB - TIER_H * t;
      const left = c.xOutB + (c.xOutT - c.xOutB) * t + 8;
      const right = c.xInB + (c.xInT - c.xInB) * t - 8;
      rows.push({
        key: `${side}${i}r${r}`,
        x1: Math.min(left, right),
        x2: Math.max(left, right),
        y,
      });
    }
    return rows;
  };

  return (
    <svg
      viewBox="0 0 800 360"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role="img"
      aria-label={`Estádio com ${tiers} ${tiers === 1 ? "anel" : "anéis"}`}
    >
      <defs>
        <linearGradient id="cash-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#020617" />
          <stop offset="70%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>
        <linearGradient id="cash-stand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={home} stopOpacity="0.95" />
          <stop offset="100%" stopColor={home} stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="cash-roof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="cash-grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#15803d" />
        </linearGradient>
        <radialGradient id="cash-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fefce8" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#fefce8" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Céu nocturno */}
      <rect x="0" y="0" width="800" height="360" fill="url(#cash-sky)" />
      {Array.from({ length: 26 }).map((_, i) => (
        <circle
          key={`star-${i}`}
          cx={(i * 137) % 800}
          cy={((i * 53) % 90) + 6}
          r={i % 5 === 0 ? 1.6 : 1}
          fill="#e2e8f0"
          opacity={i % 5 === 0 ? 0.9 : 0.45}
        />
      ))}

      {/* Torres de luz */}
      {towerXs.map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={roofY - 14} rx="46" ry="26" fill="url(#cash-glow)" opacity={tiers >= 2 ? 0.8 : 0.45} />
          <rect x={x - 3} y={roofY + 6} width={6} height={BASE_Y - roofY} fill="#475569" />
          <rect x={x - 26} y={roofY - 22} width={52} height={22} rx={3} fill="#1e293b" stroke={away} strokeOpacity="0.5" />
          {[-16, 0, 16].map((dx) => (
            <circle key={dx} cx={x + dx} cy={roofY - 11} r={5} fill="#fef9c3" />
          ))}
        </g>
      ))}

      {/* Telão central (só nos grandes) */}
      {screen && (
        <g>
          <rect x={368} y={roofY - 66} width={64} height={52} fill="#0f172a" stroke={away} strokeOpacity="0.6" />
          <rect x={374} y={roofY - 60} width={52} height={30} fill={home} opacity="0.9" />
          <text x={400} y={roofY - 40} textAnchor="middle" fontSize="11" fontWeight="900" fill="#020617">
            {`${Math.round(capacity / 1000)}K`}
          </text>
          <rect x={378} y={roofY - 14} width={8} height={20} fill="#475569" />
          <rect x={414} y={roofY - 14} width={8} height={20} fill="#475569" />
        </g>
      )}

      {/* Anéis das bancadas */}
      {Array.from({ length: tiers }).map((_, i) => {
        const tierKey = `tier-${i}`;
        const left = tierCorners("L", i);
        const right = tierCorners("R", i);
        return (
          <g key={tierKey}>
            <polygon points={tierPoints("L", i)} fill="url(#cash-stand)" stroke="#020617" strokeOpacity="0.55" strokeWidth="2" />
            <polygon points={tierPoints("R", i)} fill="url(#cash-stand)" stroke="#020617" strokeOpacity="0.55" strokeWidth="2" />
            {[...seatRows("L", i), ...seatRows("R", i)].map((row) => (
              <line
                key={row.key}
                x1={row.x1}
                y1={row.y}
                x2={row.x2}
                y2={row.y}
                stroke={away}
                strokeWidth={i === 0 ? 4 : 3}
                strokeLinecap="round"
                opacity="0.85"
              />
            ))}
            {/* Faixa da equipa no topo de cada anel */}
            <line x1={left.xOutT} y1={left.yT2 + 4} x2={left.xInT} y2={left.yT + 4} stroke={away} strokeWidth="4" opacity="0.9" />
            <line x1={right.xInT} y1={right.yT + 4} x2={right.xOutT} y2={right.yT2 + 4} stroke={away} strokeWidth="4" opacity="0.9" />
          </g>
        );
      })}

      {/* Camarotes entre anéis */}
      {boxes && (
        <g>
          <rect x={140} y={BASE_Y - TIER_H - 14} width={170} height={16} fill="#0f172a" stroke={away} strokeOpacity="0.45" />
          <rect x={490} y={BASE_Y - TIER_H - 14} width={170} height={16} fill="#0f172a" stroke={away} strokeOpacity="0.45" />
          {Array.from({ length: 8 }).map((_, i) => (
            <g key={`box-${i}`}>

              <rect x={148 + i * 20} y={BASE_Y - TIER_H - 11} width={13} height={10} fill="#fefce8" opacity="0.9" />
              <rect x={498 + i * 20} y={BASE_Y - TIER_H - 11} width={13} height={10} fill="#fefce8" opacity="0.9" />
            </g>
          ))}
        </g>
      )}

      {/* Cobertura */}
      {roofed && (
        <g>
          <polygon
            points={`88,${roofY} 296,${roofY} 272,${tierTopY} 60,${tierTopY}`}
            fill="url(#cash-roof)"
            stroke={away}
            strokeOpacity="0.55"
            strokeWidth="2"
          />
          <polygon
            points={`504,${roofY} 712,${roofY} 740,${tierTopY} 528,${tierTopY}`}
            fill="url(#cash-roof)"
            stroke={away}
            strokeOpacity="0.55"
            strokeWidth="2"
          />
          {grandRoof ? (
            <rect x={88} y={roofY - 6} width={624} height={8} rx={4} fill={home} opacity="0.9" />
          ) : (
            <g>
              <rect x={88} y={roofY - 4} width={208} height={6} rx={3} fill={home} opacity="0.85" />
              <rect x={504} y={roofY - 4} width={208} height={6} rx={3} fill={home} opacity="0.85" />
            </g>
          )}
        </g>
      )}

      {/* Relvado */}
      <ellipse cx={400} cy={318} rx={302} ry={30} fill="#052e16" opacity="0.9" />
      <ellipse cx={400} cy={312} rx={286} ry={26} fill="url(#cash-grass)" />
      <ellipse cx={400} cy={312} rx={120} ry={11} fill="none" stroke="#f8fafc" strokeWidth="2" opacity="0.9" />
      <line x1={400} y1={286} x2={400} y2={338} stroke="#f8fafc" strokeWidth="2" opacity="0.9" />
      <circle cx={400} cy={312} r={3} fill="#f8fafc" />
      <rect x={330} y={292} width={140} height={40} fill="none" stroke="#f8fafc" strokeWidth="2" opacity="0.7" />

      {/* Faixa inferior com as cores do clube */}
      <rect x={0} y={348} width={800} height={12} fill={home} />
      <rect x={0} y={348} width={800} height={4} fill={away} opacity="0.85" />
    </svg>
  );
}
