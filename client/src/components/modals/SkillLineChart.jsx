import { useState } from "react";
import { POSITION_ACCENT_HEX } from "../../constants/index.js";
import { buildSkillChartPoints } from "../../utils/skillHistory.js";

/**
 * Gráfico de linhas mostrando a evolução da skill do jogador.
 * O número de pontos no gráfico depende dos dados disponíveis.
 * O eixo Y é dinâmico (mín/máx dos dados) para tornar a evolução legível.
 *
 * `matchweek` nos snapshots é o slot de calendário (1..25: amigável, 18
 * jornadas, 6 rondas da Taça). `buildSkillChartPoints` trata do epoch global
 * `(season - 1) * SEASON_WEEKS + slot` (para pontos de épocas diferentes não colidirem
 * nos mesmos X), dos rótulos do calendário (J4 / T2 / Pré) e da janela: as
 * últimas SEASON_WEEKS semanas (1 temporada) — os pontos mais antigos ficam ocultos.
 *
 * @param {{ skillHistory: Array<{matchweek: number, season?: number, skill: number}>, skill: number, position: string }} props
 */
export function SkillLineChart({ skillHistory = [], skill = 0, position = "MED" }) {
  const barColor = POSITION_ACCENT_HEX[position] || POSITION_ACCENT_HEX.MED;
  const [hoveredIdx, setHoveredIdx] = useState(null);

  // Época mais recente do histórico = a "atual" para os rótulos: só os pontos
  // de épocas anteriores levam o ano à frente (2027·J4).
  const currentSeason = (skillHistory || []).reduce(
    (max, p) => Math.max(max, Number(p?.season) || 1),
    1,
  );
  // Ordenado por epoch global, sem pontos sem skill e já limitado à última
  // temporada (janela de SEASON_WEEKS slots do calendário).
  const cleanHistory = buildSkillChartPoints(skillHistory, currentSeason);
  // Rótulos largos (com ano) ⇒ espaçar mais o eixo X.
  const multiSeason = cleanHistory.some((p) => p.label.includes("·"));

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
  // Use actual data range for X axis; pad minimally to avoid edge clipping.
  // O eixo X é baseado no EPOCH global, não no matchweek por época.
  const firstEpoch = cleanHistory[0].x;
  const lastEpoch = cleanHistory[pointCount - 1].x;
  const epochRange = Math.max(lastEpoch - firstEpoch, 1);

  // Rótulos do eixo X — com muitas épocas, espaçar para não sobreporem
  // ("2027·J14" é mais largo que "J14"). 1 época ⇒ todos os rótulos (como antes).
  const maxXLabels = multiSeason ? 8 : pointCount;
  const xLabelStep = Math.max(1, Math.ceil(pointCount / maxXLabels));

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

  const getX = (epoch) => padding + ((epoch - firstEpoch) / epochRange) * graphWidth;
  const getY = (skillValue) =>
    padding + graphHeight - ((skillValue - axisMin) / axisSpan) * graphHeight;

  // Criar caminho SVG
  let pathD = "";

  cleanHistory.forEach((point, i) => {
    const x = getX(point.x);
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
  const hoveredXRaw = hovered ? (getX(hovered.x) / chartWidth) * 100 : 0;
  // Contenção lateral: com -translate-x-1/2 o tooltip cortava nas margens.
  const hoveredX = Math.min(80, Math.max(20, hoveredXRaw));
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
            className="overflow-visible text-zinc-600"
          >
            {/* Grid lines + Y-axis labels */}
            {yLevels.map((level) => (
              <g key={level}>
                <line
                  x1={padding}
                  y1={getY(level)}
                  x2={chartWidth - padding}
                  y2={getY(level)}
                  stroke="currentColor"
                  strokeWidth="0.5"
                  strokeDasharray="2,2"
                />
                <text
                  x={padding - 6}
                  y={getY(level) + 3}
                  textAnchor="end"
                  fontSize="6"
                  fill="currentColor"
                >
                  {level}
                </text>
              </g>
            ))}

            {/* X-axis labels — show actual matchweek numbers (epoch key avoids
                duplicate React keys when matchweeks repeat across seasons) */}
            {cleanHistory.map((p, i) => {
              if (i % xLabelStep !== 0 && i !== pointCount - 1) return null;
              return (
                <text
                  key={`xlabel-${p.x}`}
                  x={getX(p.x)}
                  y={chartHeight - 4}
                  textAnchor="middle"
                  fontSize="6"
                  fill="currentColor"
                >
                  {p.label}
                </text>
              );
            })}

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
              const cx = getX(point.x);
              const cy = getY(point.skill);
              const isHovered = hoveredIdx === i;

              return (
                <g key={`${point.x}-${i}`}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHovered ? 7 : isLast ? 6 : 4}
                    fill={barColor}
                    stroke="currentColor"
                    strokeWidth={isHovered || isLast ? 2 : 1}
                    className="cursor-pointer text-zinc-950"
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    onClick={() => setHoveredIdx(hoveredIdx === i ? null : i)}
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
                {hovered.label}
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
          <span>Atual ({cleanHistory.length} ponto{cleanHistory.length !== 1 ? "s" : ""})</span>
        </div>
      </div>
    </div>
  );
}
