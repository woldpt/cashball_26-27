import { motion } from "framer-motion";
import { DIVISION_NAMES } from "../../constants/index.js";
import { computeVirtualStandings } from "./liveHelpers.js";
import { TrendArrow } from "../shared/TrendArrow.jsx";

/* Template de colunas (espelha as larguras da tabela original):
 * Pos | Clube | Mov | J | DG | Pts | Forma */
const GRID_COLS =
  "grid-cols-[1.75rem_minmax(0,1fr)_1.5rem_1.25rem_2rem_1.75rem_3.5rem]";

/* Transição de troca de posição: as linhas deslizam suavemente entre si. */
const SWAP_TRANSITION = { type: "spring", stiffness: 320, damping: 32, mass: 0.9 };

/* ── LiveStandings — Classificação virtual da minha divisão ──────────────
 *
 * A classificação persistida (teams) só é atualizada no servidor depois de a
 * jornada terminar. Este painel projeta a tabela em tempo real: pega nos
 * dados persistidos e aplica por cima os resultados da jornada em curso
 * (marcadores ao vivo derivados dos eventos de cada partida) — ver
 * `computeVirtualStandings` em liveHelpers.js.
 *
 * `applyLiveResults` (do contexto) decide se os resultados da jornada devem
 * ser aplicados — true durante o jogo ao vivo e na janela pós-jogo, false
 * depois de o servidor reenviar teamsData com a classificação final (evita
 * contar a jornada duas vezes).
 */

/* ── FormDots (compacto, estilo LeagueStandings) ───────────────────────── */

function FormDots({ form = "" }) {
  const chars = form.split("").slice(-5);
  while (chars.length < 5) chars.unshift(null);
  return (
    <div className="flex justify-end gap-0.75">
      {chars.map((r, i) => {
        let cls = "w-1.5 h-1.5 rounded-full ";
        if (r === "V") cls += "bg-emerald-500";
        else if (r === "E") cls += "bg-amber-500";
        else if (r === null) cls += "bg-surface-container-high";
        else cls += "bg-red-500";
        return <span key={i} className={cls} />;
      })}
    </div>
  );
}

/* Iniciais do nome do treinador (ex.: "João Silva" → "JS", "Paulo" → "P"). */
/**
 * @param {string} name
 * @returns {string}
 */
function coachInitials(name) {
  const clean = String(name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (!clean) return "";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ── LiveStandingsPanel ─────────────────────────────────────────────────── */

/**
 * @param {Object} props
 * @param {Array} props.teams
 * @param {Object|null} props.matchResults
 * @param {number} props.liveMinute
 * @param {number|string} props.myTeamId
 * @param {Object} props.teamForms
 * @param {boolean} props.applyLiveResults - se os resultados da jornada devem ser projetados
 */
export function LiveStandingsPanel({
  teams,
  matchResults,
  liveMinute,
  myTeamId,
  teamForms = {},
  applyLiveResults,
}) {
  const myDiv = teams.find((t) => String(t.id) === String(myTeamId))?.division;
  if (myDiv == null) return null;

  const divTeams = teams.filter((t) => t.division === myDiv);
  const rows = computeVirtualStandings({
    teams: divTeams,
    matchResults,
    liveMinute,
    teamForms,
    applyLiveResults,
  });
  const matchweek = matchResults?.matchweek ?? "—";
  const divLabel = DIVISION_NAMES[myDiv] || `Div ${myDiv}`;

  return (
    <div className="flex flex-col min-h-0 h-full rounded-lg bg-surface-container-low border border-outline-variant/10 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-2.5 py-1.5 border-b border-outline-variant/10 bg-surface-container-high flex items-center justify-between gap-2">
        <h3 className="font-headline font-extrabold text-[10px] sm:text-[11px] tracking-tighter uppercase text-primary truncate">
          Classificação virtual · {divLabel} · J{matchweek}
        </h3>
        <span
          className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[8px] font-black uppercase tracking-widest border ${
            applyLiveResults
              ? "bg-error/10 border-error/30 text-error"
              : "bg-surface-container-low border-outline-variant/25 text-on-surface-variant/60"
          }`}
        >
          {applyLiveResults && <span className="w-1 h-1 rounded-full bg-error animate-pulse" />}
          {applyLiveResults ? "AO VIVO" : "FINAL"}
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div
          className={`grid ${GRID_COLS} items-center px-0 text-[7px] sm:text-[8px] uppercase text-on-surface-variant/50 font-bold`}
        >
          <div className="pl-2.5 pr-1 py-1">Pos</div>
          <div className="px-1 py-1">Clube</div>
          <div className="px-1 py-1 text-center" title="Movimento de posição">
            Mov
          </div>
          <div className="px-1 py-1 text-center">J</div>
          <div className="px-1 py-1 text-center">DG</div>
          <div className="px-1 py-1 text-center text-tertiary/70">Pts</div>
          <div className="pr-2.5 pl-1 py-1 text-right">Forma</div>
        </div>

        {/* Body — linhas animadas (layout spring) */}
        <div className="flex flex-col gap-y-px">
          {rows.map((row, idx) => {
            const t = row.team;
            const isMe = String(t.id) === String(myTeamId);
            const gd = row.goalsFor - row.goalsAgainst;
            const isPromo = myDiv > 1 && idx < 2;
            const isRelegate = idx >= rows.length - 2;
            const leftBorder = isPromo
              ? "border-l-2 border-l-emerald-500"
              : isRelegate
                ? "border-l-2 border-l-red-500"
                : "border-l-2 border-l-transparent";
            return (
              <motion.div
                key={t.id}
                layout
                transition={SWAP_TRANSITION}
                className={`relative grid ${GRID_COLS} items-center ${
                  isMe ? "bg-primary/10" : "bg-surface-container-lowest"
                } ${leftBorder}`}
              >
                {/* Flash quando a equipa muda de posição (remount via curPos) */}
                {row.movement !== 0 && (
                  <motion.span
                    key={row.curPos}
                    initial={{ opacity: 0.45 }}
                    animate={{ opacity: 0 }}
                    transition={{ duration: 1.4, ease: "easeOut" }}
                    className={`pointer-events-none absolute inset-0 ${
                      row.movement > 0 ? "bg-emerald-500/20" : "bg-red-500/20"
                    }`}
                  />
                )}
                <div
                  className={`relative pl-2.5 pr-1 py-1.5 font-black text-[9px] ${
                    isPromo
                      ? "text-emerald-400"
                      : isRelegate
                        ? "text-red-400"
                        : isMe
                          ? "text-primary"
                          : "text-on-surface-variant/50"
                  }`}
                >
                  {String(idx + 1).padStart(2, "0")}
                </div>
                <div className="relative px-1 py-1.5">
                  <div className="flex items-center gap-1 min-w-0">
                    <span
                      className="shrink-0 w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: t.color_primary || "#666" }}
                    />
                    <span
                      className={`flex-1 min-w-0 truncate text-[9px] sm:text-[10px] font-bold ${
                        isMe ? "text-primary" : "text-on-surface/80"
                      }`}
                    >
                      {t.name}
                    </span>
                    {isMe && (
                      <span className="shrink-0 px-1 py-px bg-tertiary text-on-tertiary text-[7px] font-black rounded-sm leading-tight">
                        TU
                      </span>
                    )}
                    {!isMe && t.coach_is_human === 1 && t.coach_name && (
                      <span
                        title={t.coach_name}
                        className="shrink-0 px-1 py-px bg-amber-400/15 text-amber-400 text-[7px] font-black rounded-sm border border-amber-400/30 leading-tight"
                      >
                        {coachInitials(t.coach_name)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="relative px-1 py-1.5 text-center">
                  <TrendArrow movement={row.movement} />
                </div>
                <div className="relative px-1 py-1.5 text-center text-[9px] text-on-surface-variant/60 tabular-nums">
                  {row.played}
                </div>
                <div
                  className={`relative px-1 py-1.5 text-center text-[9px] font-bold tabular-nums ${
                    gd > 0
                      ? "text-emerald-400"
                      : gd < 0
                        ? "text-red-400"
                        : "text-on-surface-variant/40"
                  }`}
                >
                  {gd > 0 ? `+${gd}` : gd}
                </div>
                <div className="relative px-1 py-1.5 text-center text-[9px] font-black font-headline text-on-surface tabular-nums">
                  {row.points}
                </div>
                <div className="relative pr-2.5 pl-1 py-1.5">
                  <FormDots form={row.form} />
                </div>
              </motion.div>
            );
          })}
          {rows.length === 0 && (
            <div className="py-4 text-center text-[10px] text-on-surface-variant/30 font-bold">
              Sem dados
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="shrink-0 flex items-center gap-3 px-2.5 py-1 border-t border-outline-variant/10 bg-surface-container-low/40">
        {myDiv > 1 && (
          <span className="flex items-center gap-1 text-[8px] text-on-surface-variant/40 font-bold uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/70 inline-block" />
            Subida
          </span>
        )}
        <span className="flex items-center gap-1 text-[8px] text-on-surface-variant/40 font-bold uppercase tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500/60 inline-block" />
          Descida
        </span>
      </div>
    </div>
  );
}
