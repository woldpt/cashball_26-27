import { useState } from "react";
import { formatCurrency } from "../../utils/formatters.js";

/**
 * Formata um valor monetário de forma compacta para os rótulos do eixo Y
 * (ex.: 1,2M€ · 800K€ · −150K€ · 0€).
 * @param {number} value
 * @returns {string}
 */
function compactCurrency(value) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1000000) {
    return `${sign}${(abs / 1000000).toLocaleString("pt-PT", {
      maximumFractionDigits: 1,
    })}M€`;
  }
  if (abs >= 1000) {
    return `${sign}${Math.round(abs / 1000).toLocaleString("pt-PT")}K€`;
  }
  return `${sign}${Math.round(abs)}€`;
}

/**
 * Gráfico de linhas mostrando a evolução do saldo financeiro por jornada.
 * O eixo Y é dinâmico (inclui sempre o zero) e a linha muda de cor conforme o
 * saldo é positivo (primary) ou negativo (error).
 * @param {{ data: Array<{matchweek: number, balance: number}> }} props
 */
export function BalanceLineChart({ data = [] }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const clean = (data || [])
    .filter(
      (p) => p.balance != null && Number.isFinite(p.balance),
    )
    .sort((a, b) => a.matchweek - b.matchweek);

  if (clean.length === 0) {
    return (
      <div className="py-8 flex items-center justify-center">
        <p className="text-xs text-on-surface-variant italic">
          Sem dados suficientes. O saldo será registado à medida que as
          jornadas avançam.
        </p>
      </div>
    );
  }

  const pointCount = clean.length;
  const firstMW = clean[0].matchweek;
  const lastMW = clean[pointCount - 1].matchweek;
  const mwRange = Math.max(lastMW - firstMW, 1);

  // ── Eixo Y dinâmico — inclui sempre o zero ──
  const rawValues = clean.map((p) => p.balance);
  const rawMin = Math.min(...rawValues);
  const rawMax = Math.max(...rawValues);
  const rawSpan = rawMax - rawMin;
  const pad = rawSpan > 0 ? Math.max(Math.ceil(rawSpan * 0.12), 1) : 1;
  const axisMin = Math.floor(Math.min(0, rawMin) - pad);
  const axisMax = Math.ceil(Math.max(0, rawMax) + pad);
  const axisSpan = Math.max(axisMax - axisMin, 1);

  // Linhas de grelha (4 níveis, com valores redondos)
  const GRID_STEPS = 4;
  const yLevels = Array.from(
    { length: GRID_STEPS },
    (_, i) => Math.round(axisMin + (axisSpan / (GRID_STEPS - 1)) * i),
  ).filter((v, i, arr) => arr.indexOf(v) === i);

  // ── Coordenadas ──
  const padding = { top: 12, right: 12, bottom: 18, left: 34 };
  const chartWidth = 320;
  const chartHeight = 140;
  const graphWidth = chartWidth - padding.left - padding.right;
  const graphHeight = chartHeight - padding.top - padding.bottom;

  const getX = (mw) =>
    padding.left + ((mw - firstMW) / mwRange) * graphWidth;
  const getY = (balance) =>
    padding.top +
    graphHeight -
    ((balance - axisMin) / axisSpan) * graphHeight;

  const zeroY = getY(0);

  // ── Caminhos SVG — linha partida em positivos (primary) e negativos (error) ──
  let posPathD = "";
  let negPathD = "";
  let posMoved = false;
  let negMoved = false;
  for (let i = 0; i < pointCount; i += 1) {
    const x = getX(clean[i].matchweek);
    const y = getY(clean[i].balance);
    if (clean[i].balance >= 0) {
      posPathD += `${posMoved ? "L" : "M"} ${x} ${y}`;
      posMoved = true;
    } else {
      negPathD += `${negMoved ? "L" : "M"} ${x} ${y}`;
      negMoved = true;
    }
  }

  const hovered =
    hoveredIdx != null ? clean[hoveredIdx] : null;
  const hoveredX = hovered
    ? (getX(hovered.matchweek) / chartWidth) * 100
    : 0;
  const hoveredY = hovered
    ? (getY(hovered.balance) / chartHeight) * 100
    : 0;
  const tooltipBelow = hovered
    ? getY(hovered.balance) < 42
    : false;
  const lastIdx = pointCount - 1;

  return (
    <div className="relative">
      <svg
        width="100%"
        height={chartHeight}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="overflow-visible"
      >
        {/* Grelha + rótulos Y */}
        {yLevels.map((level) => (
          <g key={level}>
            <line
              x1={padding.left}
              y1={getY(level)}
              x2={chartWidth - padding.right}
              y2={getY(level)}
              stroke="currentColor"
              className="text-outline-variant/30"
              strokeWidth="0.5"
              strokeDasharray="3,3"
            />
            <text
              x={padding.left - 6}
              y={getY(level) + 3}
              textAnchor="end"
              fontSize="7"
              className="fill-on-surface-variant/70"
            >
              {compactCurrency(level)}
            </text>
          </g>
        ))}

        {/* Baseline zero (mais destacada) */}
        {zeroY >= padding.top &&
          zeroY <= chartHeight - padding.bottom && (
            <line
              x1={padding.left}
              y1={zeroY}
              x2={chartWidth - padding.right}
              y2={zeroY}
              className="text-on-surface-variant/50"
              stroke="currentColor"
              strokeWidth="0.75"
              strokeDasharray="5,4"
            />
          )}

        {/* Rótulos X */}
        {clean.map((p, i) => {
          const every = pointCount > 16 ? Math.ceil(pointCount / 8) : 1;
          if (i % every !== 0 && i !== lastIdx) return null;
          return (
            <text
              key={`${p.matchweek}-${i}`}
              x={getX(p.matchweek)}
              y={chartHeight - 5}
              textAnchor="middle"
              fontSize="6"
              className="fill-on-surface-variant/70"
            >
              {p.matchweek === 0 ? "Início" : `J${p.matchweek}`}
            </text>
          );
        })}

        {/* Linha por segmentos (positiva / negativa) */}
        {posPathD && (
          <path
            d={posPathD.trim()}
            fill="none"
            className="stroke-primary"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {negPathD && (
          <path
            d={negPathD.trim()}
            fill="none"
            className="stroke-error"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Pontos */}
        {clean.map((point, i) => {
          const isLast = i === lastIdx;
          const cx = getX(point.matchweek);
          const cy = getY(point.balance);
          const isHovered = hoveredIdx === i;
          const positive = point.balance >= 0;

          return (
            <g key={`${point.matchweek}-${i}`}>
              <circle
                cx={cx}
                cy={cy}
                r={isHovered ? 7 : isLast ? 5 : 3.5}
                className={positive ? "fill-primary" : "fill-error"}
                stroke="#000"
                strokeOpacity="0.35"
                strokeWidth={isHovered || isLast ? 1.5 : 0.75}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
              {isLast && (
                <circle
                  cx={cx}
                  cy={cy}
                  r="10"
                  fill="none"
                  className={positive ? "stroke-primary" : "stroke-error"}
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hovered && (
        <div
          className="absolute z-10 pointer-events-none px-2 py-1 rounded bg-surface-container-high border border-outline-variant/40 shadow-lg text-center -translate-x-1/2"
          style={{
            left: `${hoveredX}%`,
            top: `${hoveredY}%`,
            transform: tooltipBelow
              ? "translate(-50%, 14px)"
              : "translate(-50%, calc(-100% - 12px))",
          }}
        >
          <div className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant whitespace-nowrap">
            {hovered.matchweek === 0
              ? "Início de época"
              : `Fim da Jornada ${hovered.matchweek}`}
          </div>
          <div
            className={`text-xs font-black font-headline leading-none mt-0.5 tabular-nums ${hovered.balance >= 0 ? "text-primary" : "text-error"}`}
          >
            {formatCurrency(hovered.balance)}
          </div>
        </div>
      )}

      {/* Legenda */}
      <div className="flex items-center gap-4 mt-2 text-[9px] text-on-surface-variant">
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-primary rounded-full" />
          <span>Saldo positivo</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-error rounded-full" />
          <span>Saldo negativo</span>
        </div>
      </div>
    </div>
  );
}
