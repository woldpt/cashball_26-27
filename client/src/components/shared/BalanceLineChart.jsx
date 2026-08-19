import { useEffect, useState } from "react";
import { formatCurrency } from "../../utils/formatters.js";
import { EmptyState } from "./EmptyState.jsx";

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
 * Gráfico de área mostrando a evolução do saldo financeiro por jornada.
 * O eixo Y é dinâmico (inclui sempre o zero), a linha muda de cor conforme o
 * saldo é positivo (primary) ou negativo (error) e a área preenche até à
 * baseline zero com gradiente.
 * @param {{ data: Array<{matchweek: number, balance: number}> }} props
 */
export function BalanceLineChart({ data = [] }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const clean = (data || [])
    .filter((p) => p.balance != null && Number.isFinite(p.balance))
    .sort((a, b) => a.matchweek - b.matchweek);

  if (clean.length === 0) {
    return (
      <EmptyState
        emoji="📊"
        title="Sem dados suficientes"
        description="O saldo será registado à medida que as jornadas avançam."
      />
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
  const padding = { top: 16, right: 16, bottom: 26, left: 44 };
  const chartWidth = 640;
  const chartHeight = 210;
  const graphWidth = chartWidth - padding.left - padding.right;
  const graphHeight = chartHeight - padding.top - padding.bottom;

  const getX = (mw) =>
    padding.left + ((mw - firstMW) / mwRange) * graphWidth;
  const getY = (balance) =>
    padding.top +
    graphHeight -
    ((balance - axisMin) / axisSpan) * graphHeight;

  const zeroY = getY(0);

  // Ponto interpolado de cruzamento do zero (área não extravasa a baseline)
  const extended = [];
  for (let i = 0; i < pointCount; i += 1) {
    const p = clean[i];
    if (i > 0) {
      const prev = clean[i - 1];
      const crosses =
        (prev.balance < 0 && p.balance >= 0) ||
        (prev.balance >= 0 && p.balance < 0);
      if (crosses) {
        const t = (0 - prev.balance) / (p.balance - prev.balance);
        extended.push({
          x: getX(prev.matchweek + (p.matchweek - prev.matchweek) * t),
          y: zeroY,
          balance: 0,
        });
      }
    }
    extended.push({ x: getX(p.matchweek), y: getY(p.balance), balance: p.balance });
  }

  /**
   * Caminho SVG da linha ou da área para um sinal (pos = >=0, neg = <0).
   * @param {"pos"|"neg"} sign
   * @param {boolean} fill - se true fecha a área na baseline zero
   * @returns {string}
   */
  const buildPath = (sign, fill) => {
    let d = "";
    let inRun = false;
    const matches = (balance) => (sign === "pos" ? balance >= 0 : balance < 0);
    for (let i = 0; i < extended.length; i += 1) {
      const { x, y, balance } = extended[i];
      if (matches(balance)) {
        d += `${inRun ? "L" : "M"} ${x} ${y}`;
        inRun = true;
      } else if (inRun) {
        if (fill) d += ` L ${x} ${zeroY} Z`;
        inRun = false;
      }
    }
    if (inRun && fill) {
      const last = extended[extended.length - 1];
      d += ` L ${last.x} ${zeroY} Z`;
    }
    return d;
  };

  const posLineD = buildPath("pos", false);
  const negLineD = buildPath("neg", false);
  const posAreaD = buildPath("pos", true);
  const negAreaD = buildPath("neg", true);

  const hovered = hoveredIdx != null ? clean[hoveredIdx] : null;
  const hoveredX = hovered ? (getX(hovered.matchweek) / chartWidth) * 100 : 0;
  const hoveredY = hovered ? (getY(hovered.balance) / chartHeight) * 100 : 0;
  const tooltipBelow = hovered ? getY(hovered.balance) < 64 : false;
  const lastIdx = pointCount - 1;

  // ── Estatísticas de rodapé ──
  const firstBalance = clean[0].balance;
  const lastBalance = clean[lastIdx].balance;
  const maxBalance = rawMax;
  const minBalance = rawMin;
  const variation = lastBalance - firstBalance;
  const stats = [
    { label: "Máximo", value: maxBalance, color: "text-primary" },
    { label: "Mínimo", value: minBalance, color: "text-error" },
    {
      label: "Variação",
      value: variation,
      color: variation >= 0 ? "text-primary" : "text-error",
    },
  ];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full h-auto overflow-visible"
      >
        <defs>
          <linearGradient id="gradPos" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              style={{ stopColor: "var(--color-primary)" }}
              stopOpacity="0.28"
            />
            <stop
              offset="100%"
              style={{ stopColor: "var(--color-primary)" }}
              stopOpacity="0"
            />
          </linearGradient>
          <linearGradient id="gradNeg" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              style={{ stopColor: "var(--color-error)" }}
              stopOpacity="0"
            />
            <stop
              offset="100%"
              style={{ stopColor: "var(--color-error)" }}
              stopOpacity="0.28"
            />
          </linearGradient>
        </defs>

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
              strokeWidth="0.75"
              strokeDasharray="3,3"
            />
            <text
              x={padding.left - 8}
              y={getY(level) + 3}
              textAnchor="end"
              fontSize="9"
              className="fill-on-surface-variant/70 tabular-nums"
            >
              {compactCurrency(level)}
            </text>
          </g>
        ))}

        {/* Baseline zero (mais destacada) */}
        {zeroY >= padding.top && zeroY <= chartHeight - padding.bottom && (
          <line
            x1={padding.left}
            y1={zeroY}
            x2={chartWidth - padding.right}
            y2={zeroY}
            className="text-on-surface-variant/50"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="5,4"
          />
        )}

        {/* Área (fade-in após a linha) */}
        {posAreaD && (
          <path
            d={posAreaD}
            fill="url(#gradPos)"
            style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.7s ease 0.35s" }}
          />
        )}
        {negAreaD && (
          <path
            d={negAreaD}
            fill="url(#gradNeg)"
            style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.7s ease 0.35s" }}
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
              y={chartHeight - 6}
              textAnchor="middle"
              fontSize="9"
              className="fill-on-surface-variant/70"
            >
              {p.matchweek === 0 ? "Início" : `J${p.matchweek}`}
            </text>
          );
        })}

        {/* Linha por segmentos (positiva / negativa) — animada a desenhar */}
        {posLineD && (
          <path
            d={posLineD}
            fill="none"
            className="stroke-primary"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={mounted ? 0 : 1}
            style={{ transition: "stroke-dashoffset 0.9s ease-out" }}
          />
        )}
        {negLineD && (
          <path
            d={negLineD}
            fill="none"
            className="stroke-error"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={mounted ? 0 : 1}
            style={{ transition: "stroke-dashoffset 0.9s ease-out" }}
          />
        )}

        {/* Crosshair vertical no hover */}
        {hovered && (
          <line
            x1={getX(hovered.matchweek)}
            y1={padding.top}
            x2={getX(hovered.matchweek)}
            y2={chartHeight - padding.bottom}
            className="text-outline-variant/50"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="3,3"
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
                r={isHovered ? 8 : isLast ? 5.5 : 4}
                className={positive ? "fill-primary" : "fill-error"}
                stroke="#131313"
                strokeOpacity="0.85"
                strokeWidth={isHovered || isLast ? 2 : 1.25}
                style={{ cursor: "pointer", transition: "r 0.15s ease" }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
              {isLast && (
                <circle
                  cx={cx}
                  cy={cy}
                  r="11"
                  fill="none"
                  className={positive ? "stroke-primary" : "stroke-error"}
                  strokeWidth="1.25"
                  strokeDasharray="2,3"
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hovered && (
        <div
          className="absolute z-10 pointer-events-none px-2.5 py-1.5 rounded-md bg-surface-container-high border border-outline-variant/40 shadow-lg shadow-black/40 text-center -translate-x-1/2"
          style={{
            left: `${hoveredX}%`,
            top: `${hoveredY}%`,
            transform: tooltipBelow
              ? "translate(-50%, 16px)"
              : "translate(-50%, calc(-100% - 14px))",
          }}
        >
          <div className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant whitespace-nowrap">
            {hovered.matchweek === 0
              ? "Início de época"
              : `Fim da Jornada ${hovered.matchweek}`}
          </div>
          <div
            className={`text-sm font-black font-headline leading-none mt-0.5 tabular-nums ${hovered.balance >= 0 ? "text-primary" : "text-error"}`}
          >
            {formatCurrency(hovered.balance)}
          </div>
        </div>
      )}

      {/* Legenda + estatísticas */}
      <div className="mt-3 pt-3 border-t border-outline-variant/15">
        <div className="flex items-center gap-4 text-[10px] text-on-surface-variant">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-1 rounded-full bg-gradient-to-r from-primary/40 to-primary" />
            <span className="font-bold uppercase tracking-wider">Saldo positivo</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-1 rounded-full bg-gradient-to-r from-error/40 to-error" />
            <span className="font-bold uppercase tracking-wider">Saldo negativo</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-md bg-surface-container px-3 py-2 flex flex-col items-center"
            >
              <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/70">
                {s.label}
              </span>
              <span
                className={`font-headline font-black text-sm tabular-nums mt-0.5 ${s.color}`}
              >
                {compactCurrency(s.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
