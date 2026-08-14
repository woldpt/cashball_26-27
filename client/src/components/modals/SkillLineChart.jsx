import { useState } from "react";
import { POS_BAR } from "./positionConstants.js";

/**
 * Gráfico de linhas mostrando a evolução da skill do jogador.
 * O número de pontos no gráfico depende dos dados disponíveis.
 * O eixo Y é dinâmico (mín/máx dos dados) para tornar a evolução legível.
 * @param {{ skillHistory: Array<{matchweek: number, skill: number}>, skill: number, position: string }} props
 */
export function SkillLineChart({ skillHistory = [], skill = 0, position = "MED" }) {
  const barColor = POS_BAR[position] || "#eab308";
  const [hoveredIdx, setHoveredIdx] = useState(null);

  // Ordenar e filtrar dados válidos
  const cleanHistory = skillHistory
    .filter((p) => p.skill != null)
    .sort((a, b) => a.matchweek - b.matchweek);

  // Sem dados suficientes — mostrar estado mínimo
  if (cleanHistory.length === 0) {
    return (
      <div className="px-6 py-5">
        <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-3">
          Evolução da Skill
        </p>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="text-xs text-on-surface-variant italic">
              Sem dados históricos. A evolução será registada a partir desta época.
            </p>
          </div>
          <div className="text-center min-w-[80px]">
            <div className="text-2xl font-black font-headline" style={{ color: barColor }}>
              {skill}
            </div>
            <div className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">
              Skill Atual
            </div>
          </div>
        </div>
      </div>
    );
  }

  const pointCount = cleanHistory.length;
  // Use actual data range for X axis; pad minimally to avoid edge clipping
  const firstMW = cleanHistory[0].matchweek;
  const lastMW = cleanHistory[pointCount - 1].matchweek;
  const mwRange = Math.max(lastMW - firstMW, 1);

  // ── Eixo Y dinâmico (mín/máx dos dados + skill atual) ──
  const rawValues = cleanHistory
    .map((p) => p.skill)
    .concat(skill)
    .filter((v) => v != null);
  const dataMin = Math.min(...rawValues);
  const dataMax = Math.max(...rawValues);
  const rawSpan = dataMax - dataMin;
  const pad = rawSpan > 0 ? Math.max(Math.ceil(rawSpan * 0.1), 1) : 2;
  let axisMin = Math.max(0, dataMin - pad);
  let axisMax = Math.min(50, dataMax + pad);
  if (axisMax - axisMin < 1) {
    axisMin = Math.max(0, axisMin - 2);
    axisMax = Math.min(50, axisMax + 2);
  }
  if (axisMax === axisMin) axisMin = Math.max(0, axisMin - 1);
  const axisSpan = Math.max(axisMax - axisMin, 1);

  // Níveis do eixo Y (4 linhas de grelha com valores inteiros)
  const GRID_STEPS = 4;
  const yLevels = Array.from({ length: GRID_STEPS }, (_, i) =>
    Math.round(axisMin + (axisSpan / (GRID_STEPS - 1)) * i),
  ).filter((v, i, arr) => arr.indexOf(v) === i);
  if (yLevels.length < 2) yLevels.unshift(axisMin);

  // Calcular coordenadas
  const padding = 20;
  const chartWidth = 300;
  const chartHeight = 100;
  const graphWidth = chartWidth - padding * 2;
  const graphHeight = chartHeight - padding * 2;

  const getX = (mw) => padding + ((mw - firstMW) / mwRange) * graphWidth;
  const getY = (skillValue) =>
    padding + graphHeight - ((skillValue - axisMin) / axisSpan) * graphHeight;

  // Criar caminho SVG
  let pathD = "";

  cleanHistory.forEach((point, i) => {
    const x = getX(point.matchweek);
    const y = getY(point.skill);
    if (i === 0) {
      pathD = `M ${x} ${y}`;
    } else {
      pathD += ` L ${x} ${y}`;
    }
  });

  // Índice do último ponto (válido) para highlight
  const lastIdx = pointCount - 1;
  const hovered = hoveredIdx != null ? cleanHistory[hoveredIdx] : null;

  // Posição do tooltip em % do viewBox para funcionar com width="100%"
  const hoveredX = hovered ? (getX(hovered.matchweek) / chartWidth) * 100 : 0;
  const hoveredY = hovered ? (getY(hovered.skill) / chartHeight) * 100 : 0;
  // Se o ponto estiver perto do topo, mostra o tooltip por baixo
  const tooltipBelow = hovered ? getY(hovered.skill) < 34 : false;

  return (
    <div className="px-6 py-5">
      <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-3">
        Evolução da Skill
      </p>

      <div className="flex items-center gap-4">
        {/* Gráfico SVG */}
        <div className="flex-1 relative">
          <svg
            width="100%"
            height="100"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="overflow-visible"
          >
            {/* Grid lines + Y-axis labels */}
            {yLevels.map((level) => (
              <g key={level}>
                <line
                  x1={padding}
                  y1={getY(level)}
                  x2={chartWidth - padding}
                  y2={getY(level)}
                  stroke="#333"
                  strokeWidth="0.5"
                  strokeDasharray="2,2"
                />
                <text
                  x={padding - 6}
                  y={getY(level) + 3}
                  textAnchor="end"
                  fontSize="6"
                  fill="#888"
                >
                  {level}
                </text>
              </g>
            ))}

            {/* X-axis labels — show actual matchweek numbers */}
            {cleanHistory.map((p) => (
              <text
                key={p.matchweek}
                x={getX(p.matchweek)}
                y={chartHeight - 4}
                textAnchor="middle"
                fontSize="6"
                fill="#888"
              >
                J{p.matchweek}
              </text>
            ))}

            {/* Skill line */}
            {pathD && (
              <path
                d={pathD}
                fill="none"
                stroke={barColor}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Points */}
            {cleanHistory.map((point, i) => {
              const isLast = i === lastIdx;
              const cx = getX(point.matchweek);
              const cy = getY(point.skill);
              const isHovered = hoveredIdx === i;

              return (
                <g key={`${point.matchweek}-${i}`}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHovered ? 7 : isLast ? 6 : 4}
                    fill={barColor}
                    stroke="#000"
                    strokeWidth={isHovered || isLast ? 2 : 1}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  />
                  {isLast && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r="12"
                      fill="none"
                      stroke={barColor}
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
                J{hovered.matchweek}
              </div>
              <div className="text-xs font-black font-headline leading-none mt-0.5 tabular-nums" style={{ color: barColor }}>
                {hovered.skill}
              </div>
            </div>
          )}
        </div>

        {/* Skill atual */}
        <div className="text-center min-w-[80px]">
          <div
            className="text-2xl font-black font-headline"
            style={{ color: barColor }}
          >
            {skill}
          </div>
          <div className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">
            Skill Atual
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-[9px] text-on-surface-variant">
        <div className="flex items-center gap-1">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ backgroundColor: barColor }}
          />
          <span>Qualidade</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full border border-current" />
          <span>Actual ({cleanHistory.length} ponto{cleanHistory.length !== 1 ? "s" : ""})</span>
        </div>
      </div>
    </div>
  );
}
