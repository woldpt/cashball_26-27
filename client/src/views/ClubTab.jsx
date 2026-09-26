import { useState, useMemo, useEffect } from "react";
import { StadiumIllustration } from "../components/shared/StadiumIllustration.jsx";
import { DIVISION_NAMES, WAGE_CAP } from "../constants/index.js";
import { formatCurrency } from "../utils/formatters.js";
import { getMoraleLabel, getMoraleClasses } from "../utils/morale.js";
import { SummaryWidget } from "../components/shared/SummaryWidget.jsx";
import { Panel } from "../components/shared/Panel.jsx";
import { EmptyState } from "../components/shared/EmptyState.jsx";

/**
 * Apresentação das notícias por tipo — mapa único.
 * `credit` = caixa entra (+ verde); `label` = rótulo do montante.
 * O ícone descreve o movimento de plantel, não de caixa:
 * `transfer_out` é vermelho (jogador sai) mas `credit: true` (dinheiro entra).
 */
const NEWS_TYPES = {
  transfer_in: {
    credit: false,
    label: "Compra",
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    icon: "trending_up",
  },
  transfer_out: {
    credit: true,
    label: "Venda",
    bg: "bg-error/15",
    text: "text-error",
    icon: "trending_down",
  },
  weekly_income: { credit: true },
  ticket_revenue: { credit: true },
  loan_take: { credit: true },
  prize: { credit: true },
  default: {
    credit: false,
    bg: "bg-surface-container-high",
    text: "text-on-surface-variant",
    icon: "info",
  },
};

function NewsRow({ news }) {
  const t = { ...NEWS_TYPES.default, ...NEWS_TYPES[news?.type] };
  return (
    <div className="px-4 short:px-3 py-3 short:py-1.5 flex items-center gap-3 short:gap-2 hover:bg-white/[0.03] transition-colors">
      {/* Icon */}
      <div className={`w-8 h-8 short:w-6 short:h-6 rounded flex items-center justify-center shrink-0 ${t.bg}`}>
        <span className={`material-symbols-outlined text-sm ${t.text}`}>
          {t.icon}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black text-on-surface truncate">
          {news.title}
        </p>
        <p className="text-[10px] text-on-surface-variant truncate">
          {news.related_team_name &&
          (news.type === "transfer_in" || news.type === "transfer_out")
            ? `${news.type === "transfer_in" ? "de" : "para"} ${news.related_team_name}`
            : `Jornada ${news.matchweek || "?"}${news.year ? ` · ${news.year}` : ""}`}
        </p>
      </div>

      {/* Amount */}
      {news.amount > 0 && (
        <div className="text-right shrink-0">
          <p
            className={`font-headline font-black text-xs tabular-nums ${
              t.credit ? "text-emerald-400" : "text-error"
            }`}
          >
            {t.credit ? "+" : "-"}
            {formatCurrency(news.amount)}
          </p>
          {t.label && (
            <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-widest">
              {t.label}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * @param {{
 *   teamInfo: object,
 *   seasonYear: number,
 *   me: object,
 *   onReplayTutorial?: () => void,
 *   currentBudget: number,
 *   totalWeeklyWage: number,
 *   loanAmount: number,
 *   palmaresTeamId: number|null,
 *   palmares: { trophies: Array },
 *   clubNews: Array,
 * }} props
 */
export function ClubTab({
  teamInfo,
  seasonYear,
  me,
  onReplayTutorial,
  currentBudget,
  totalWeeklyWage,
  loanAmount,
  palmaresTeamId,
  palmares,
  clubNews,
}) {
  // Guarda o URL que falhou (não um booleano) para o fallback fazer reset
  // sozinho quando o escudo mudar — sem useEffect dedicado.
  const [failedCrest, setFailedCrest] = useState(null);
  const crestFailed =
    teamInfo?.crest != null && failedCrest === teamInfo.crest;

  const morale = teamInfo?.morale ?? 50;
  const moraleLabel = getMoraleLabel(morale).toUpperCase();
  const moraleTone = getMoraleClasses(morale);

  // ── Agrupamento do histórico por ano ───────────────────────────────
  const groupedNews = useMemo(() => {
    const map = new Map();
    for (const n of clubNews || []) {
      // year 0 / null vem de DBs antigas — agrupa no seasonYear para não perder
      const raw = Number(n.year);
      const yearKey = raw > 0 ? String(raw) : String(seasonYear);
      if (!map.has(yearKey)) map.set(yearKey, []);
      map.get(yearKey).push(n);
    }
    // Ordena anos descendente (mais recente primeiro)
    return [...map.entries()].sort((a, b) => Number(b[0]) - Number(a[0]));
  }, [clubNews, seasonYear]);

  // Ano(s) expandido(s) — por defeito só o mais recente fica aberto
  const [expandedYears, setExpandedYears] = useState(() => new Set([String(seasonYear)]));
  const [showAllYears, setShowAllYears] = useState(false);

  // Quando o histórico ganha um novo ano (virada de época), expande-o automaticamente
  useEffect(() => {
    if (groupedNews.length === 0) return;
    const mostRecent = groupedNews[0][0];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- virada de época deve expandir o novo ano
    setExpandedYears((prev) => {
      if (prev.has(mostRecent)) return prev;
      // Se só havia o ano anterior expandido, troca para o novo ano
      // mas mantém os restantes colapsados para não poluir a vista
      if (prev.size === 1) return new Set([mostRecent]);
      const next = new Set(prev);
      next.add(mostRecent);
      return next;
    });
  }, [groupedNews]);

  const toggleYear = (year) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedYears(new Set(groupedNews.map(([y]) => y)));
    setShowAllYears(true);
  };
  const collapseAll = () => {
    const mostRecent = groupedNews[0]?.[0] || String(seasonYear);
    setExpandedYears(new Set([mostRecent]));
    setShowAllYears(false);
  };

  // Detecta se há transferências para o badge "Foco em Transferências"
  const hasTransfers = useMemo(
    () =>
      clubNews?.some(
        (n) => n.type === "transfer_in" || n.type === "transfer_out",
      ) ?? false,
    [clubNews],
  );

  return (
    <div className="space-y-4 short:space-y-2">

      {/* ── ROW 1: HERO + BUDGET ─────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 short:gap-2">

        {/* Club hero card */}
        <div className="md:col-span-2 rounded-md border border-outline-variant/25 overflow-hidden relative bg-surface-container">
          {/* Team colour wash */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: teamInfo?.color_primary
                ? `linear-gradient(135deg, ${teamInfo.color_primary}22 0%, transparent 60%)`
                : "linear-gradient(135deg, #2d6a4f22 0%, transparent 60%)",
            }}
          />
          <div className="relative p-3 sm:p-4 short:p-2 short:gap-2 flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center">
            {/* Badge — crest com fallback para inicial */}
            {teamInfo?.crest ? (
              <img
                src={teamInfo.crest}
                alt={teamInfo?.name || "crest"}
                onError={() => setFailedCrest(teamInfo.crest)}
                className={`w-12 h-12 sm:w-16 sm:h-16 short:w-10 short:h-10 rounded-lg object-contain bg-white p-1.5 short:p-1 shrink-0 border border-white/10 ${
                  crestFailed ? "hidden" : "inline"
                }`}
                loading="lazy"
              />
            ) : null}
            <div
              className={`w-12 h-12 sm:w-16 sm:h-16 short:w-10 short:h-10 rounded-lg flex items-center justify-center text-xl sm:text-2xl short:text-base font-black shrink-0 border border-white/10 ${
                !teamInfo?.crest || crestFailed ? "flex" : "hidden"
              }`}
              style={{
                background: teamInfo?.color_primary || "#2a2a2a",
                color: teamInfo?.color_secondary || "#fff",
              }}
            >
              {teamInfo?.name?.[0] || "?"}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h1
                className="font-headline text-lg sm:text-2xl short:text-base font-black tracking-tight leading-none mb-1 short:mb-0.5 truncate text-on-surface"
              >
                {teamInfo?.name || "—"}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mb-3 short:mb-1.5">
                <span
                  className="text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-widest"
                  style={{
                    background: teamInfo?.color_primary
                      ? `${teamInfo.color_primary}33`
                      : "var(--color-surface-container-high)",
                    color: teamInfo?.color_primary || "var(--color-on-surface-variant)",
                  }}
                >
                  {DIVISION_NAMES[teamInfo?.division] ||
                    `Divisão ${teamInfo?.division}`}
                </span>
                <span className="text-[10px] text-on-surface-variant">{seasonYear}</span>
                {onReplayTutorial && (
                  <button
                    type="button"
                    onClick={onReplayTutorial}
                    className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-on-surface-variant hover:text-primary border border-outline-variant/25 hover:border-primary/50 rounded px-2 py-0.5 transition-colors"
                    title="Rever o tutorial passo a passo"
                  >
                    <span className="material-symbols-outlined text-[13px] leading-none">
                      school
                    </span>
                    Rever tutorial
                  </button>
                )}
              </div>

              {/* Morale bar */}
              <div className="max-w-xs sm:max-w-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">
                    Moral do Plantel
                  </span>
                  <span className={`text-[9px] font-black ${moraleTone.text}`}>
                    {moraleLabel}
                  </span>
                </div>
                <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${moraleTone.bar}`}
                    style={{ width: `${morale}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Manager */}
            <div className="shrink-0 text-right hidden sm:block">
              <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-0.5">
                Manager
              </p>
              <p className="font-headline font-black text-on-surface text-base tracking-tight">
                {me?.name}
              </p>
            </div>
          </div>
        </div>

        {/* Budget widget */}
        <SummaryWidget
          label="Saldo Disponível"
          value={formatCurrency(currentBudget)}
          valueClass="text-xl"
          valueColorClass={
            currentBudget >= 0 ? "text-on-surface" : "text-error"
          }
          className="h-auto"
          accentStyle={{
            borderLeftColor: teamInfo?.color_primary || "#4ade80",
          }}
        >
          <div className="flex justify-between items-start mb-2">
            <span
              className="material-symbols-outlined text-2xl"
              style={{ color: teamInfo?.color_primary || "#4ade80" }}
            >
              payments
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-on-surface-variant">Salários / jornada</span>
              <span className="tabular-nums font-black text-on-surface">
                {formatCurrency(totalWeeklyWage)}
              </span>
            </div>
            <div className="w-full bg-surface-container-high h-1 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, (totalWeeklyWage / WAGE_CAP) * 100)}%`,
                  background: teamInfo?.color_primary || "#4ade80",
                }}
              />
            </div>
            <div className="flex justify-between text-[9px] pt-0.5">
              <span
                className={`font-black ${
                  currentBudget >= 0 ? "text-emerald-400" : "text-error"
                }`}
              >
                {currentBudget >= 0 ? "ESTÁVEL" : "DÉFICE"}
              </span>
              {loanAmount > 0 && (
                <span className="text-error/70">
                  Dívida: {formatCurrency(loanAmount)}
                </span>
              )}
            </div>
          </div>
        </SummaryWidget>
      </div>

      {/* ── ROW 2: ESTÁDIO + PALMARÉS ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 short:gap-2">

        {/* Estádio */}
        <div className="bg-surface-container rounded-md border border-outline-variant/25 overflow-hidden flex flex-col">
          <div className="h-24 sm:h-28 short:h-16 relative flex items-end overflow-hidden">
            <StadiumIllustration
              capacity={teamInfo?.stadium_capacity || 10000}
              primary={teamInfo?.color_primary}
              secondary={teamInfo?.color_secondary}
              className="absolute inset-0 h-full w-full"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            <div className="relative px-4 pb-3 short:px-3 short:pb-2">
              <h3 className="font-headline text-base font-black text-white leading-tight drop-shadow">
                {teamInfo?.stadium_name || "Estádio Municipal"}
              </h3>
              <p
                className="text-[10px] font-black tracking-widest drop-shadow"
                style={{ color: teamInfo?.color_primary || "#4ade80" }}
              >
                Recinto Principal
              </p>
            </div>
          </div>
          <div className="p-3 short:p-2 grid grid-cols-2 gap-2 short:gap-1.5">
            <div className="bg-surface-container-high p-2.5 rounded text-center border border-outline-variant/25">
              <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-0.5">
                Capacidade
              </p>
              <p className="font-headline font-black text-on-surface text-base tabular-nums">
                {(teamInfo?.stadium_capacity || 10000).toLocaleString("pt-PT")}
              </p>
            </div>
            <div className="bg-surface-container-high p-2.5 rounded text-center border border-outline-variant/25">
              <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-0.5">
                Divisão
              </p>
              <p
                className="font-headline font-black text-sm leading-tight mt-0.5"
                style={{ color: teamInfo?.color_primary || "#4ade80" }}
              >
                {DIVISION_NAMES[teamInfo?.division] || "Liga"}
              </p>
            </div>
          </div>
        </div>

        {/* Palmarés */}
        <div className="bg-surface-container rounded-lg border border-outline-variant/25 p-4 short:p-2.5 flex flex-col">
          <div className="flex justify-between items-center mb-4 short:mb-2">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
              Palmarés
            </h3>
            <span
              className="material-symbols-outlined text-amber-400"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              military_tech
            </span>
          </div>

          {palmaresTeamId === me?.teamId && palmares.trophies?.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {palmares.trophies.map((trophy, idx) => {
                const isTopScorer = trophy.achievement.includes("Melhor Marcador");
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-2 px-3 py-2 rounded border border-amber-500/20 bg-amber-500/5"
                  >
                    <span
                      className="material-symbols-outlined text-amber-400 text-base"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {isTopScorer ? "sports_soccer" : "emoji_events"}
                    </span>
                    <div>
                      <p className="text-amber-400 font-black text-xs">
                        {trophy.achievement}
                      </p>
                      {trophy.season ? (
                        <p className="text-on-surface-variant text-[10px] font-bold">
                          {trophy.season}
                        </p>
                      ) : null}
                      {trophy.coach_name && trophy.is_human_coach && (
                        <p className="text-on-surface-variant/60 text-[9px] mt-0.5">
                          Treinador: {trophy.coach_name}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              emoji="🏆"
              title="Nenhum título conquistado."
              description="Constrói o teu legado hoje"
              className="flex-1"
            />
          )}
        </div>
      </div>

      {/* ── ROW 3: HISTÓRICO DO CLUBE (agregado por ano) ───────────── */}
      <Panel
        title="Histórico do Clube"
        icon="newspaper"
        meta={
          <div className="flex items-center gap-2">
            {hasTransfers && (
              <span className="text-[9px] text-amber-400 font-black tracking-[0.2em] uppercase hidden sm:inline">
                Foco em Transferências
              </span>
            )}
            {clubNews?.length > 0 && (
              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-surface-container-high border border-outline-variant/20 text-on-surface-variant tabular-nums">
                {clubNews.length} · {groupedNews.length} época{groupedNews.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        }
        padded={false}
      >
        {clubNews && clubNews.length > 0 ? (
          <>
            {/* Barra de controlo quando há mais do que um ano */}
            {groupedNews.length > 1 && (
              <div className="flex justify-end px-3 py-2 border-b border-outline-variant/10 bg-surface-container-high/30">
                <button
                  type="button"
                  onClick={showAllYears ? collapseAll : expandAll}
                  className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-xs">
                    {showAllYears ? "unfold_less" : "unfold_more"}
                  </span>
                  {showAllYears ? "Recolher anos" : "Expandir tudo"}
                </button>
              </div>
            )}

            <div className="divide-y divide-outline-variant/10">
              {groupedNews.map(([year, items]) => {
                const isExpanded = expandedYears.has(year);
                const isCurrentYear = String(year) === String(seasonYear);
                return (
                  <div key={year}>
                    {/* Cabeçalho do ano */}
                    <button
                      type="button"
                      onClick={() => toggleYear(year)}
                      className={`w-full flex items-center justify-between px-4 short:px-3 py-2.5 short:py-1.5 text-left transition-colors ${
                        isExpanded
                          ? "bg-surface-container-high/60"
                          : "bg-surface-container-high/20 hover:bg-surface-container-high/40"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`text-xs font-black tabular-nums ${isCurrentYear ? "text-primary" : "text-on-surface"}`}
                        >
                          {year}
                        </span>
                        {isCurrentYear && (
                          <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/20">
                            Época actual
                          </span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-container-high border border-outline-variant/20 text-on-surface-variant font-black tabular-nums">
                          {items.length}
                        </span>
                      </div>
                      <span className="flex items-center gap-1 shrink-0 ml-2">
                        {!isExpanded && items[0] && (
                          <span className="text-[10px] text-on-surface-variant/60 truncate max-w-[140px] sm:max-w-[220px] hidden sm:inline">
                            {items[0].title}
                          </span>
                        )}
                        <span className="material-symbols-outlined text-sm text-on-surface-variant">
                          {isExpanded ? "expand_less" : "expand_more"}
                        </span>
                      </span>
                    </button>

                    {/* Notícias do ano */}
                    {isExpanded && (
                      <div className="divide-y divide-outline-variant/10">
                        {items.map((news, idx) => (
                          <NewsRow key={news.id || `${year}-${idx}`} news={news} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <EmptyState emoji="📰" title="Nenhuma notícia ainda." />
        )}
      </Panel>
    </div>
  );
}
