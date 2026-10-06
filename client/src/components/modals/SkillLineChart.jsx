import { useId, useRef, useState } from "react";
import { POSITION_ACCENT_HEX } from "../../constants/index.js";
import { buildSkillChartPoints } from "../../utils/skillHistory.js";

// Geometria do viewBox (o SVG escala com a largura; o texto escala junto).
const W = 320;
const H = 128;
const PAD = { top: 10, right: 12, bottom: 20, left: 22 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

/**
 * Evolução da skill — linha com área, crosshair e tooltip.
 *
 * `matchweek` nos snapshots é o slot de calendário (1..25: amigável, 18
 * jornadas, 6 rondas da Taça). `buildSkillChartPoints` trata do epoch global
 * `(season - 1) * SEASON_WEEKS + slot` (para pontos de épocas diferentes não
 * colidirem nos mesmos X), dos rótulos do calendário (J4 / T2 / Pré) e da
 * janela: as últimas SEASON_WEEKS semanas (1 temporada).
 * O eixo Y é dinâmico (mín/máx dos dados) para tornar a evolução legível.
 * Sem título próprio: quem o usa dá-lhe o cabeçalho da secção.
 *
 * @param {Object} props
 * @param {Array<{matchweek: number, season?: number, skill: number}>} props.skillHistory
 * @param {number} props.skill
 * @param {string} props.position
 * @returns {JSX.Element}
 */
export function SkillLineChart({ skillHistory = [], skill = 0, position = "MED" }) {
  const color = POSITION_ACCENT_HEX[position] || POSITION_ACCENT_HEX.MED;
  const gradId = `skill-area-${useId().replace(/:/g, "")}`;
  const svgRef = useRef(null);
  const [activeIdx, setActiveIdx] = useState(null);

  // Época mais recente do histórico = a "atual" para os rótulos: só os pontos
  // de épocas anteriores levam o ano à frente (2027·J4).
  const currentSeason = (skillHistory || []).reduce(
    (max, p) => Math.max(max, Number(p?.season) || 1),
    1,
  );
  const points = buildSkillChartPoints(skillHistory, currentSeason);
  const count = points.length;

  if (count === 0) {
    return (
      <div className="flex items-center gap-4 rounded-lg border border-dashed border-outline-variant/30 px-4 py-5">
        <span className="font-headline text-3xl font-black tabular-nums leading-none text-on-surface">
          {skill}
        </span>
        <p className="text-[11px] font-bold leading-snug text-on-surface-variant/70">
          Ainda sem histórico. A evolução fica registada a partir desta época.
        </p>
      </div>
    );
  }

  // ── Escalas ──
  const firstX = points[0].x;
  const xRange = Math.max(points[count - 1].x - firstX, 1);
  const values = points.map((p) => p.skill).concat(skill);
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const span = dataMax - dataMin;
  const pad = span > 0 ? Math.max(Math.ceil(span * 0.15), 1) : 2;
  const axisMin = Math.max(0, dataMin - pad);
  const axisMax = Math.min(50, dataMax + pad);
  const axisSpan = Math.max(axisMax - axisMin, 1);
  const yLevels = [
    ...new Set([0, 1, 2, 3].map((i) => Math.round(axisMin + (axisSpan / 3) * i))),
  ];

  const sx = (epoch) =>
    PAD.left + (count === 1 ? PLOT_W / 2 : ((epoch - firstX) / xRange) * PLOT_W);
  const sy = (v) => PAD.top + PLOT_H - ((v - axisMin) / axisSpan) * PLOT_H;
  const baseY = PAD.top + PLOT_H;

  const linePath = points
    .map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(1)} ${sy(p.skill).toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${sx(points[count - 1].x).toFixed(1)} ${baseY} L${sx(firstX).toFixed(1)} ${baseY} Z`;

  // Rótulos do eixo X — espaçados para não colidirem (com ano são mais largos).
  const multiSeason = points.some((p) => p.label.includes("·"));
  const xStep = Math.max(1, Math.ceil(count / (multiSeason ? 4 : 7)));

  // ── Tendência na janela ──
  const delta = skill - points[0].skill;
  const trend =
    delta > 0
      ? { icon: "trending_up", text: `+${delta}`, cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25" }
      : delta < 0
        ? { icon: "trending_down", text: `${delta}`, cls: "text-red-400 bg-red-500/10 border-red-500/25" }
        : { icon: "trending_flat", text: "Estável", cls: "text-on-surface-variant bg-surface-bright/60 border-outline-variant/30" };

  // ── Interação: crosshair que encaixa no ponto mais próximo ──
  const pickNearest = (clientX) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const vx = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    for (let i = 1; i < count; i++) {
      if (Math.abs(sx(points[i].x) - vx) < Math.abs(sx(points[best].x) - vx)) best = i;
    }
    setActiveIdx(best);
  };
  const onKeyDown = (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const from = activeIdx ?? count - 1;
    setActiveIdx(Math.min(count - 1, Math.max(0, from + (e.key === "ArrowRight" ? 1 : -1))));
  };

  const active = activeIdx != null ? points[activeIdx] : null;
  const tipLeft = active ? Math.min(85, Math.max(15, (sx(active.x) / W) * 100)) : 0;
  const tipTop = active ? (sy(active.skill) / H) * 100 : 0;
  const tipBelow = active ? sy(active.skill) < PAD.top + 26 : false;
  const last = points[count - 1];

  return (
    <div>
      {/* Leitura: skill atual + tendência + amplitude */}
      <div className="mb-2 flex flex-wrap items-end justify-between gap-x-3 gap-y-1.5">
        <div className="flex items-baseline gap-2">
          <span className="font-headline text-3xl font-black tabular-nums leading-none text-on-surface">
            {skill}
          </span>
          <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/70">
            Skill atual
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold tabular-nums text-on-surface-variant/60">
            Mín {dataMin} · Máx {dataMax}
          </span>
          {count > 1 && (
            <span
              title={`Desde ${points[0].label}`}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black tabular-nums ${trend.cls}`}
            >
              <span aria-hidden className="material-symbols-outlined text-[14px] leading-none">
                {trend.icon}
              </span>
              {trend.text}
            </span>
          )}
        </div>
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full cursor-crosshair overflow-visible rounded-md text-on-surface-variant outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          style={{ touchAction: "pan-y" }}
          tabIndex={0}
          role="img"
          aria-label={`Evolução da skill: de ${points[0].skill} (${points[0].label}) a ${last.skill} (${last.label}). Setas para percorrer.`}
          onPointerMove={(e) => pickNearest(e.clientX)}
          onPointerDown={(e) => pickNearest(e.clientX)}
          onPointerLeave={() => setActiveIdx(null)}
          onKeyDown={onKeyDown}
          onBlur={() => setActiveIdx(null)}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grelha recessiva + eixo Y */}
          {yLevels.map((level) => (
            <g key={level}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={sy(level)}
                y2={sy(level)}
                stroke="currentColor"
                strokeOpacity="0.12"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={PAD.left - 6}
                y={sy(level) + 2.5}
                textAnchor="end"
                fontSize="7"
                fill="currentColor"
                fillOpacity="0.55"
                className="tabular-nums"
              >
                {level}
              </text>
            </g>
          ))}

          {/* Eixo X (rótulos do calendário) */}
          {points.map((p, i) =>
            i % xStep === 0 || i === count - 1 ? (
              <text
                key={`x-${p.x}`}
                x={sx(p.x)}
                y={H - 5}
                textAnchor={i === count - 1 && count > 1 ? "end" : i === 0 && count > 1 ? "start" : "middle"}
                fontSize="7"
                fill="currentColor"
                fillOpacity={activeIdx === i ? 0.95 : 0.55}
              >
                {p.label}
              </text>
            ) : null,
          )}

          {count > 1 && <path d={areaPath} fill={`url(#${gradId})`} />}
          {count > 1 && (
            <path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Crosshair */}
          {active && (
            <line
              x1={sx(active.x)}
              x2={sx(active.x)}
              y1={PAD.top}
              y2={baseY}
              stroke="currentColor"
              strokeOpacity="0.35"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Ponto final (sempre) com halo e anel na cor da superfície */}
          <circle cx={sx(last.x)} cy={sy(last.skill)} r="8" fill={color} fillOpacity="0.18" />
          <circle
            cx={sx(last.x)}
            cy={sy(last.skill)}
            r="4"
            fill={color}
            stroke="var(--color-bg)"
            strokeWidth="2"
          />
          {active && active !== last && (
            <circle
              cx={sx(active.x)}
              cy={sy(active.skill)}
              r="4"
              fill={color}
              stroke="var(--color-bg)"
              strokeWidth="2"
            />
          )}
        </svg>

        {active && (
          <div
            className="pointer-events-none absolute z-10 rounded-md border border-outline-variant/40 bg-surface-container-highest px-2 py-1 text-center shadow-lg shadow-black/40"
            style={{
              left: `${tipLeft}%`,
              top: `${tipTop}%`,
              transform: tipBelow ? "translate(-50%, 12px)" : "translate(-50%, calc(-100% - 12px))",
            }}
          >
            <div className="whitespace-nowrap text-[8px] font-black uppercase tracking-widest text-on-surface-variant">
              {active.label}
            </div>
            <div className="mt-0.5 flex items-center justify-center gap-1.5 font-headline text-sm font-black leading-none tabular-nums text-on-surface">
              <span aria-hidden className="inline-block h-0.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
              {active.skill}
            </div>
          </div>
        )}
      </div>

      {/* Vista em tabela para leitores de ecrã */}
      <table className="sr-only">
        <caption>Evolução da skill por semana</caption>
        <tbody>
          {points.map((p) => (
            <tr key={`t-${p.x}`}>
              <th scope="row">{p.label}</th>
              <td>{p.skill}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
