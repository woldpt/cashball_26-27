/**
 * Ilustração paramétrica do estádio (vista frontal panorâmica,
 * como uma foto de transmissão: de longe e câmara baixa).
 * Céu e horizonte em cima, bancada completa com multidão ao
 * centro e relvado em primeiro plano — composto para continuar
 * legível dentro de faixas largas e baixas (slice).
 *
 * O número de anéis, a cobertura, os camarotes e o telão crescem
 * com a lotação; bancadas e multidão usam as cores da equipa.
 *
 * Escalões:
 * - < 15k: 1 anel, sem cobertura, 2 postes de luz
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
  // Crescimento subtil do corpo acima dos 50k (até +15% aos 120k).
  const bulk =
    capacity > 50000 ? 1 + ((Math.min(capacity, 120000) - 50000) / 70000) * 0.15 : 1;

  // ── Geometria da bancada (vista frontal) ──────────────────────
  const TIER_H = 36;
  const BOX_H = 15;
  const WALL_TOP = 250;
  const PITCH_TOP = 272;
  const STAND_X0 = 84;
  const STAND_X1 = 716;
  /** Topo do anel i (0 = o de baixo). */
  const tierTop = (i) =>
    WALL_TOP - (i + 1) * TIER_H - (boxes && i >= 1 ? BOX_H : 0);
  const topY = tierTop(tiers - 1);
  const roofBaseY = topY - (grandRoof ? 20 : 14);
  const roofTopY = roofBaseY - (10 + (bulk - 1) * 40);

  /** Pseudo-aleatório determinístico (multidão estável entre renders). */
  const hash01 = (n) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  /** Multidão de um anel: cabeças nas cores da equipa + neutros. */
  const crowdDots = (yTop, yBot, seed) => {
    const dots = [];
    const rows = 4;
    let k = 0;
    for (let r = 0; r < rows; r += 1) {
      const y = yTop + 5 + ((yBot - yTop - 9) * (r + 0.5)) / rows;
      for (let x = STAND_X0 + 6 + (r % 2) * 4; x < STAND_X1 - 5; x += 8) {
        const h = hash01(seed + k * 12.9898);
        const fill =
          h < 0.58 ? home : h < 0.8 ? away : h < 0.94 ? "#fcd9b8" : "#1e293b";
        dots.push(
          <circle
            key={`${seed}-${k}`}
            cx={x + (hash01(seed + k * 3.7) - 0.5) * 3}
            cy={y}
            r={1.7 + hash01(seed + k * 7.3) * 0.9}
            fill={fill}
            opacity={0.75 + hash01(seed + k * 5.1) * 0.25}
          />,
        );
        k += 1;
      }
    }
    return dots;
  };

  /** Bandeirolas alternadas no corrimão do topo. */
  const pennants = [];
  for (let x = STAND_X0 + 10; x < STAND_X1 - 8; x += 34) {
    pennants.push(
      <polygon
        key={`pen-${x}`}
        points={`${x},${topY + 3} ${x + 14},${topY + 3} ${x + 7},${topY + 12}`}
        fill={Math.round(x / 34) % 2 === 0 ? home : away}
        opacity="0.95"
      />,
    );
  }

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
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="70%" stopColor="#bae6fd" />
          <stop offset="100%" stopColor="#e0f2fe" />
        </linearGradient>
        <linearGradient id="cash-stand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={home} stopOpacity="0.9" />
          <stop offset="100%" stopColor={home} stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id="cash-roof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f1f5f9" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>
        <linearGradient id="cash-concrete" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>
      </defs>

      {/* Céu diurno */}
      <rect x="0" y="0" width="800" height="360" fill="url(#cash-sky)" />
      {/* Sol */}
      <circle cx={690} cy={42} r={32} fill="#fef9c3" opacity="0.5" />
      <circle cx={690} cy={42} r={20} fill="#fde047" />
      {/* Nuvens */}
      <g fill="#ffffff" opacity="0.9">
        <ellipse cx={140} cy={52} rx={42} ry={13} />
        <ellipse cx={172} cy={44} rx={28} ry={11} />
        <ellipse cx={430} cy={30} rx={34} ry={10} />
        <ellipse cx={456} cy={24} rx={22} ry={8} />
      </g>
      {/* Pássaros */}
      <g stroke="#334155" strokeWidth="2" fill="none" opacity="0.7" strokeLinecap="round">
        <path d="M 250 66 q 6 -6 12 0 q 6 -6 12 0" />
        <path d="M 292 82 q 5 -5 10 0 q 5 -5 10 0" />
        <path d="M 560 58 q 5 -5 10 0 q 5 -5 10 0" />
      </g>

      {/* Serra ao longe, na linha do horizonte */}
      <ellipse cx={130} cy={205} rx={230} ry={34} fill="#8fa8bf" opacity="0.6" />
      <ellipse cx={690} cy={208} rx={250} ry={38} fill="#93a88f" opacity="0.6" />
      {/* Árvores nas bermas, assentes no horizonte */}
      <g>
        {[
          [30, 168, 11], [58, 174, 9], [742, 172, 10], [770, 166, 12],
        ].map(([x, y, r]) => (
          <g key={`${x}-${y}`}>
            <rect x={x - 2} y={y} width={4} height={12} fill="#654321" />
            <circle cx={x} cy={y - 4} r={r} fill="#15803d" />
            <circle cx={x - r * 0.5} cy={y} r={r * 0.7} fill="#16a34a" />
          </g>
        ))}
      </g>

      {/* Torres de luz (só nos pequenos, sem cobertura) */}
      {!roofed &&
        [56, 744].map((x) => (
          <g key={x}>
            <rect x={x - 3} y={92} width={6} height={PITCH_TOP - 92} fill="#475569" />
            <rect x={x - 32} y={66} width={64} height={26} rx={3} fill="#1e293b" stroke={away} strokeOpacity="0.5" />
            {[-20, -7, 7, 20].map((dx) => (
              <circle key={dx} cx={x + dx} cy={79} r={6} fill="#e2e8f0" stroke="#64748b" strokeWidth="1" />
            ))}
          </g>
        ))}

      {/* Telão por cima da cobertura (só nos grandes) */}
      {screen && (
        <g>
          <rect x={336} y={roofBaseY - 40} width={128} height={40} rx={4} fill="#0f172a" stroke={away} strokeOpacity="0.7" strokeWidth="2" />
          <rect x={343} y={roofBaseY - 34} width={114} height={21} fill={home} opacity="0.92" />
          <text x={400} y={roofBaseY - 18} textAnchor="middle" fontSize="13" fontWeight="900" fill="#020617">
            {`${Math.round(capacity / 1000)}K`}
          </text>
        </g>
      )}

      {/* Cobertura */}
      {roofed && (
        <g>
          {/* postes de suporte */}
          {[140, 260, 540, 660].map((x) => (
            <rect key={x} x={x} y={roofBaseY} width={5} height={topY - roofBaseY} fill="#64748b" />
          ))}
          {/* pala superior (profundidade) */}
          <polygon
            points={`60,${roofBaseY} 740,${roofBaseY} 706,${roofTopY} 94,${roofTopY}`}
            fill="url(#cash-roof)"
            stroke={away}
            strokeOpacity="0.55"
            strokeWidth="2"
          />
          {/* testeira com a cor do clube */}
          <rect x={60} y={roofBaseY - (grandRoof ? 9 : 7)} width={680} height={grandRoof ? 9 : 7} fill={home} opacity="0.92" />
        </g>
      )}

      {/* Anéis das bancadas + multidão */}
      {Array.from({ length: tiers }).map((_, i) => {
        const boxTop = tierTop(i);
        const seatTop = boxTop + (boxes && i >= 1 ? BOX_H : 0);
        const seatBottom = i === 0 ? WALL_TOP : tierTop(i - 1);
        return (
          <g key={`tier-${i}`}>
            {/* faixa de camarotes por baixo dos anéis superiores */}
            {boxes && i >= 1 && (
              <g>
                <rect x={STAND_X0} y={boxTop} width={STAND_X1 - STAND_X0} height={BOX_H} fill="#0f172a" stroke={away} strokeOpacity="0.45" />
                {Array.from({ length: 24 }).map((__, w) => (
                  <rect
                    key={`box-${i}-${w}`}
                    x={STAND_X0 + 10 + w * 25}
                    y={boxTop + 3}
                    width={16}
                    height={BOX_H - 6}
                    fill="#cfe4f7"
                    stroke="#0f172a"
                    strokeOpacity="0.5"
                    opacity={0.75 + hash01(i * 91 + w * 7) * 0.25}
                  />
                ))}
              </g>
            )}
            <polygon
              points={`${STAND_X0 - 24},${seatTop} ${STAND_X0},${seatTop} ${STAND_X0},${seatBottom} ${STAND_X0 - 24},${seatBottom + 10}`}
              fill={home}
              opacity="0.45"
            />
            <polygon
              points={`${STAND_X1 + 24},${seatTop} ${STAND_X1},${seatTop} ${STAND_X1},${seatBottom} ${STAND_X1 + 24},${seatBottom + 10}`}
              fill={home}
              opacity="0.45"
            />
            <rect
              x={STAND_X0}
              y={seatTop}
              width={STAND_X1 - STAND_X0}
              height={seatBottom - seatTop}
              fill="url(#cash-stand)"
              stroke="#020617"
              strokeOpacity="0.4"
              strokeWidth="1.5"
            />
            {crowdDots(seatTop, seatBottom, 100 + i * 1000)}
            {/* passadeira de betão entre anéis */}
            <rect x={STAND_X0 - 24} y={seatBottom - 3} width={STAND_X1 - STAND_X0 + 48} height={4} fill="url(#cash-concrete)" opacity="0.9" />
          </g>
        );
      })}

      {/* Corrimão do topo + bandeirolas */}
      <rect x={STAND_X0 - 24} y={topY - 2} width={STAND_X1 - STAND_X0 + 48} height={4} fill={away} opacity="0.9" />
      {pennants}

      {/* Muro base com portões */}
      <rect x={STAND_X0 - 24} y={WALL_TOP} width={STAND_X1 - STAND_X0 + 48} height={PITCH_TOP - WALL_TOP} fill="url(#cash-concrete)" />
      <rect x={STAND_X0 - 24} y={WALL_TOP} width={STAND_X1 - STAND_X0 + 48} height={5} fill={home} />
      {Array.from({ length: 8 }).map((_, g) => (
        <rect
          key={`gate-${g}`}
          x={STAND_X0 + 14 + g * 78}
          y={WALL_TOP + 7}
          width={30}
          height={PITCH_TOP - WALL_TOP - 7}
          rx={7}
          fill="#0f172a"
          opacity="0.85"
        />
      ))}

      {/* Relvado em primeiro plano, com faixas de corte */}
      {Array.from({ length: 12 }).map((_, s) => (
        <rect
          key={`stripe-${s}`}
          x={(800 / 12) * s}
          y={PITCH_TOP}
          width={800 / 12 + 1}
          height={348 - PITCH_TOP}
          fill={s % 2 === 0 ? "#22c55e" : "#16a34a"}
        />
      ))}
      {/* linha de fundo + balizas */}
      <line x1={0} y1={PITCH_TOP + 6} x2={800} y2={PITCH_TOP + 6} stroke="#f8fafc" strokeWidth="2" opacity="0.9" />
      {[
        [150, 210],
        [590, 650],
      ].map(([x0, x1]) => (
        <g key={`${x0}`}>
          <rect x={x0} y={PITCH_TOP - 12} width={x1 - x0} height={18} fill="#ffffff" opacity="0.22" />
          <rect x={x0} y={PITCH_TOP - 12} width={x1 - x0} height={18} fill="none" stroke="#f8fafc" strokeWidth="3" />
        </g>
      ))}
      {/* linha de meio-campo + círculo central */}
      <line x1={400} y1={PITCH_TOP + 6} x2={400} y2={348} stroke="#f8fafc" strokeWidth="2" opacity="0.8" />
      <ellipse cx={400} cy={318} rx={62} ry={17} fill="none" stroke="#f8fafc" strokeWidth="2" opacity="0.85" />
      <circle cx={400} cy={318} r={3} fill="#f8fafc" />

      {/* Faixa inferior com as cores do clube */}
      <rect x={0} y={348} width={800} height={12} fill={home} />
      <rect x={0} y={348} width={800} height={4} fill={away} opacity="0.85" />
    </svg>
  );
}
