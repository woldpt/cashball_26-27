import { useState, useMemo, useEffect } from "react";
import { TeamLink } from "../components/shared/TeamLink.jsx";
import { StadiumIllustration } from "../components/shared/StadiumIllustration.jsx";
import { DIVISION_NAMES } from "../constants/index.js";
import { staffRoleMeta, staffLevelStars } from "../constants/staff.js";
import { formatCurrency } from "../utils/formatters.js";
import { getMoraleLabel, getMoraleClasses, getFansMoodLabel } from "../utils/morale.js";
import { TeamKit } from "../components/shared/TeamKit.jsx";
import { TrophyCabinet } from "../components/shared/TrophyCabinet.jsx";
import { Panel } from "../components/shared/Panel.jsx";
import { StaffAvatar } from "../components/shared/StaffAvatar.jsx";
import { EmptyState } from "../components/shared/EmptyState.jsx";
import { Button } from "../components/shared/Button.jsx";
import { Badge } from "../components/shared/Badge.jsx";

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
  staff_hire: {
    credit: false,
    label: "Assinatura",
    bg: "bg-primary/15",
    text: "text-primary",
    icon: "badge",
  },
  staff_fire: {
    credit: false,
    label: "Indemnização",
    bg: "bg-error/15",
    text: "text-error",
    icon: "person_remove",
  },
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
            ? <>{news.type === "transfer_in" ? "de" : "para"}{" "}<TeamLink teamId={news.related_team_id}>{news.related_team_name}</TeamLink></>
            : `Jornada ${news.matchweek || "?"}${news.year ? ` · ${news.year}` : ""}`}
        </p>
      </div>

      {/* Amount */}
      {news.amount > 0 && (
        <div className="text-right shrink-0 min-w-20">
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
 * Cartão de um papel da equipa técnica: mostra o funcionário contratado
 * (nome, nível, efeito e despedimento) ou o formulário de contratação
 * (nível, salário, assinatura e pré-visualização do efeito).
 *
 * Os números vêm todos do `board` (servidor) — incluindo a pré-visualização
 * por nível (`board.previews`), para o cliente nunca repetir as fórmulas.
 *
 * @param {{
 *   role: string,
 *   board: object,
 *   member: object|null,
 *   pending: boolean,
 *   onHire: (role: string, level: number) => void,
 *   onFire: (role: string) => void,
 * }} props
 * @returns {JSX.Element}
 */
function StaffRoleCard({ role, board, member, pending, onHire, onFire }) {
  const [level, setLevel] = useState(1);
  const meta = staffRoleMeta(role);
  const salaries = board?.salaries || [];
  const salary = Number(salaries[level - 1]) || 0;
  const fee = salary * (board?.signingWeeks || 0);
  const budget = Number(board?.budget) || 0;
  const noSlots = (board?.used ?? 0) >= (board?.slots ?? 0);
  const noBudget = budget < fee;
  const preview = board?.previews?.[role]?.[level - 1];
  const hireLabel = noSlots
    ? "Sem lugares livres"
    : noBudget
      ? "Sem saldo"
      : `Contratar · ${formatCurrency(fee)}`;

  return (
    <div
      className={`h-full rounded-md border p-3 short:p-2 flex flex-col gap-2 ${
        member
          ? "border-primary/30 bg-primary/5"
          : "border-outline-variant/25 bg-surface-container-high/40"
      }`}
    >
      {/* Identificação do papel: caricatura + nome + estado e a descrição por
          baixo. A cara segue o nível: no cartão vazio é o nível escolhido no
          stepper (pré-visualização de quem se vai contratar), no contratado é
          o nível dele. */}
      <div className="space-y-1">
        <div className="flex items-start gap-2">
          <StaffAvatar role={role} level={member ? member.level : level} size="mdR" />
          <div className="flex-1 min-w-0 space-y-0.5">
            <h3 className="font-headline font-black text-sm text-on-surface leading-tight">
              {meta.label}
            </h3>
            {member ? (
              <Badge variant="info" size="sm">
                Nível {member.level}
              </Badge>
            ) : (
              <Badge variant="neutral" size="sm">
                Vazio
              </Badge>
            )}
          </div>
        </div>
        <p className="text-[10px] text-on-surface-variant leading-tight">
          {meta.description}
        </p>
      </div>

      {member ? (
        <div className="mt-auto space-y-2">
          <div className="bg-surface-container rounded border border-outline-variant/20 p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black text-on-surface truncate">
                {member.name}
              </span>
              <span
                className="text-[10px] text-amber-400 tracking-tight shrink-0"
                title={`Nível ${member.level}`}
              >
                {staffLevelStars(member.level, board?.maxLevel || 5)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 mt-1">
              <span className="text-[10px] font-black text-tertiary truncate">
                {meta.effect(member.effect)}
              </span>
              <span className="text-[10px] text-on-surface-variant tabular-nums shrink-0">
                {formatCurrency(member.salaryWeekly)}/sem
              </span>
            </div>
          </div>
          <Button
            variant="dangerSoft"
            size="sm"
            full
            disabled={pending}
            title={`Indemnização: ${formatCurrency(member.severance)}`}
            onClick={() => onFire(role)}
          >
            Despedir · {formatCurrency(member.severance)}
          </Button>
        </div>
      ) : (
        <div className="mt-auto space-y-2">
          {/* Escolha do nível (o preço aparece logo abaixo) */}
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-black uppercase tracking-widest text-on-surface-variant">
              Nível
            </span>
            <span className="text-amber-400 tracking-tight" aria-hidden>
              {staffLevelStars(level, board?.maxLevel || 5)}
            </span>
          </div>
          <div className="flex items-center gap-1" role="group" aria-label={`Nível do ${meta.label}`}>
            {salaries.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setLevel(i + 1)}
                aria-pressed={level === i + 1}
                className={`flex-1 py-1.5 rounded text-[10px] font-black border transition-colors ${
                  level === i + 1
                    ? "bg-primary/20 border-primary/40 text-primary"
                    : "bg-surface-container border-outline-variant/25 text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="bg-surface-container rounded border border-outline-variant/20 p-2 text-[10px] space-y-1">
            <div className="flex justify-between gap-2">
              <span className="text-on-surface-variant">Efeito</span>
              <span className="font-black text-tertiary text-right">
                {preview ? meta.effect(preview) : "—"}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-on-surface-variant">Salário</span>
              <span className="font-black text-on-surface tabular-nums">
                {formatCurrency(salary)}/sem
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-on-surface-variant">Assinatura</span>
              <span className="font-black text-error tabular-nums">
                {formatCurrency(fee)}
              </span>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            full
            disabled={pending || noSlots || noBudget}
            title={
              noSlots
                ? `Equipa técnica cheia (${board?.slots ?? 0} lugares)`
                : noBudget
                  ? "Saldo insuficiente para a assinatura"
                  : undefined
            }
            onClick={() => onHire(role, level)}
          >
            {hireLabel}
          </Button>
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
 *   currentBudget: number,
 *   totalWeeklyWage: number,
 *   loanAmount: number,
 *   palmaresTeamId: number|null,
 *   palmares: { trophies: Array },
 *   clubNews: Array,
 *   staff?: object|null,
 *   staffPending?: boolean,
 *   onHireStaff?: (role: string, level: number) => void,
 *   onFireStaff?: (role: string) => void,
 *   homeWeather?: string|null,
 * }} props
 */
export function ClubTab({
  teamInfo,
  seasonYear,
  me,
  currentBudget,
  totalWeeklyWage,
  loanAmount,
  palmaresTeamId,
  palmares,
  clubNews,
  staff = null,
  staffPending = false,
  onHireStaff,
  onFireStaff,
  homeWeather = null,
}) {
  // Guarda o URL que falhou (não um booleano) para o fallback fazer reset
  // sozinho quando o escudo mudar — sem useEffect dedicado.
  const [failedCrest, setFailedCrest] = useState(null);
  const crestFailed =
    teamInfo?.crest != null && failedCrest === teamInfo.crest;

  const accent = teamInfo?.color_primary || "#4ade80";
  const morale = teamInfo?.morale ?? 25;
  const moraleTone = getMoraleClasses(morale);
  const fansMood = teamInfo?.fans_mood ?? 30;
  const fansTone =
    fansMood >= 35
      ? { text: "text-tertiary", bar: "bg-tertiary" }
      : fansMood >= 23
        ? { text: "text-primary", bar: "bg-primary" }
        : { text: "text-error", bar: "bg-error" };
  // Massa salarial = plantel + equipa técnica (o painel dos Funcionários
  // detalha a parte dos funcionários).
  const wageBill = (Number(totalWeeklyWage) || 0) + (Number(staff?.salaryWeekly) || 0);
  const divisionName =
    DIVISION_NAMES[teamInfo?.division] || `Divisão ${teamInfo?.division ?? "?"}`;

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

  // Números do clube na faixa do hero (moral e adeptos levam barra própria).
  const heroStats = [
    {
      label: "Moral do plantel",
      value: getMoraleLabel(morale),
      valueClass: moraleTone.text,
      bar: { pct: morale * 2, className: moraleTone.bar },
    },
    {
      label: "Adeptos",
      value: getFansMoodLabel(fansMood),
      valueClass: fansTone.text,
      bar: { pct: fansMood * 2, className: fansTone.bar },
    },
    {
      label: "Salários / semana",
      value: formatCurrency(wageBill),
      valueClass: "text-on-surface",
      sub: staff?.salaryWeekly > 0 ? "plantel + equipa técnica" : "plantel",
    },
    {
      label: "Saldo",
      value: formatCurrency(currentBudget),
      valueClass: currentBudget >= 0 ? "text-primary" : "text-error",
      sub: loanAmount > 0 ? `dívida ${formatCurrency(loanAmount)}` : "sem dívida",
    },
  ];

  return (
    <div className="space-y-4 short:space-y-2">
      {/* ── HERO: identidade + números do clube ─────────────────────────── */}
      <section className="relative rounded-md border border-outline-variant/25 overflow-hidden bg-surface-container">
        <div aria-hidden className="top-light" />
        {/* Lavagem com a cor do clube */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{ background: `linear-gradient(120deg, ${accent}2e 0%, transparent 55%)` }}
        />
        <div className="relative p-4 short:p-2.5 flex items-center gap-3 sm:gap-4">
          {/* Escudo com fallback para a inicial */}
          {teamInfo?.crest && !crestFailed ? (
            <span
              className="inline-flex w-14 h-14 sm:w-16 sm:h-16 short:w-10 short:h-10 rounded-lg shrink-0 border border-white/10 shadow-md"
              style={{ backgroundColor: accent }}
            >
              <img
                src={teamInfo.crest}
                alt={teamInfo?.name || "Escudo"}
                onError={() => setFailedCrest(teamInfo.crest)}
                className="crest-shadow w-full h-full object-contain p-1.5 short:p-1"
                loading="lazy"
              />
            </span>
          ) : (
            <div
              className="w-14 h-14 sm:w-16 sm:h-16 short:w-10 short:h-10 rounded-lg flex items-center justify-center text-2xl short:text-base font-black shrink-0 border border-white/10 shadow-md"
              style={{ background: accent, color: teamInfo?.color_secondary || "#fff" }}
            >
              {teamInfo?.name?.[0] || "?"}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h1 className="font-headline text-xl sm:text-3xl short:text-base font-black tracking-tight leading-tight truncate text-on-surface">
              {teamInfo?.name || "—"}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-black uppercase tracking-widest">
              <span
                className="px-2 py-0.5 rounded"
                style={{ background: `${accent}33`, color: accent }}
              >
                {divisionName}
              </span>
              <span className="text-on-surface-variant tabular-nums">Época {seasonYear}</span>
            </div>
          </div>

          <div className="shrink-0 text-right hidden sm:block">
            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
              Treinador
            </p>
            <p className="font-headline font-black text-on-surface text-base tracking-tight">
              {me?.name}
            </p>
          </div>
        </div>

        {/* Faixa de números: 2×2 no telemóvel, 4 em linha a partir de sm */}
        <dl className="relative grid grid-cols-2 sm:grid-cols-4 gap-px border-t border-outline-variant/15 bg-outline-variant/15">
          {heroStats.map((st) => (
            <div key={st.label} className="bg-surface-container/95 px-4 py-3 short:px-3 short:py-1.5 min-w-0">
              <dt className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant truncate">
                {st.label}
              </dt>
              <dd className={`mt-1 font-headline text-base sm:text-lg short:text-sm font-black tracking-tight tabular-nums truncate ${st.valueClass}`}>
                {st.value}
              </dd>
              {st.bar ? (
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-bright">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${st.bar.className}`}
                    style={{ width: `${Math.min(100, st.bar.pct)}%` }}
                  />
                </div>
              ) : (
                <dd className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-on-surface-variant/70 truncate">
                  {st.sub}
                </dd>
              )}
            </div>
          ))}
        </dl>
      </section>

      {/* ── ESTÁDIO · EQUIPAMENTO · PALMARÉS (mesma altura) ─────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 short:gap-2">
        <Panel
          title="Estádio"
          icon="stadium"
          className="flex flex-col"
          bodyClassName="flex-1 flex flex-col"
          padded={false}
          meta={`${(teamInfo?.stadium_capacity || 10000).toLocaleString("pt-PT")} lugares`}
        >
          {/* A ilustração estica até à altura dos vizinhos (sem buraco) */}
          <div className="relative flex-1 min-h-40 short:min-h-24 overflow-hidden">
            <StadiumIllustration
              seed={teamInfo?.id}
              weather={homeWeather}
              capacity={teamInfo?.stadium_capacity || 10000}
              primary={teamInfo?.color_primary}
              secondary={teamInfo?.color_secondary}
              mood={teamInfo?.fans_mood ?? null}
              className="absolute inset-0 h-full w-full"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 px-4 pb-3 short:px-3 short:pb-2">
              <h3 className="font-headline text-lg short:text-sm font-black text-white leading-tight drop-shadow">
                {teamInfo?.stadium_name || "Estádio Municipal"}
              </h3>
              <p className="text-[10px] font-black uppercase tracking-widest drop-shadow" style={{ color: accent }}>
                Recinto principal
              </p>
            </div>
          </div>
        </Panel>

        <Panel
          title="Equipamento"
          icon="checkroom"
          className="flex flex-col"
          bodyClassName="flex-1 flex items-center justify-center"
        >
          <TeamKit team={teamInfo} className="h-40 sm:h-44 short:h-24 object-contain" />
        </Panel>

        <Panel
          title="Palmarés"
          icon="military_tech"
          className="flex flex-col"
          bodyClassName="flex-1 flex flex-col"
          meta={
            palmaresTeamId === me?.teamId && palmares.trophies?.length > 0
              ? `${palmares.trophies.length} ${palmares.trophies.length === 1 ? "título" : "títulos"}`
              : undefined
          }
        >
          {palmaresTeamId === me?.teamId && palmares.trophies?.length > 0 ? (
            <TrophyCabinet trophies={palmares.trophies} />
          ) : (
            <EmptyState
              icon="trophy"
              title="Nenhum título conquistado."
              description="Constrói o teu legado hoje"
              className="flex-1"
            />
          )}
        </Panel>
      </div>

      {/* ── FUNCIONÁRIOS (equipa técnica) ─────────────────────────────────── */}
      <div data-tour="club-staff">
        <Panel
          title="Funcionários"
          icon="badge"
          meta={
            staff ? (
              <span className="flex items-center gap-2">
                {/* Lugares como pontos: ocupados a cheio, livres vazios */}
                <span
                  className="flex items-center gap-1"
                  role="img"
                  aria-label={`${staff.used} de ${staff.slots} lugares ocupados`}
                >
                  {Array.from({ length: staff.slots || 0 }, (_, i) => (
                    <span
                      key={i}
                      className={`h-2 w-2 rounded-full ${
                        i < staff.used ? "bg-primary" : "border border-outline-variant/60"
                      }`}
                    />
                  ))}
                </span>
                <span className="tabular-nums">
                  {staff.used}/{staff.slots}
                </span>
                {staff.salaryWeekly > 0 && (
                  // Em telemóvel o total empurrava o cabeçalho para 2 linhas.
                  <span className="hidden sm:inline tabular-nums">
                    · {formatCurrency(staff.salaryWeekly)}/sem
                  </span>
                )}
              </span>
            ) : undefined
          }
        >
          {staff ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 short:gap-2">
              {staff.roles.map((role) => (
                <StaffRoleCard
                  key={role}
                  role={role}
                  board={staff}
                  member={(staff.members || []).find((m) => m.role === role) || null}
                  pending={staffPending}
                  onHire={onHireStaff}
                  onFire={onFireStaff}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-on-surface-variant px-1 py-2">
              A carregar a equipa técnica…
            </p>
          )}
        </Panel>
      </div>

      {/* ── HISTÓRICO DO CLUBE (agregado por ano) ─────────────────────────── */}
      <Panel
        title="Histórico do Clube"
        icon="newspaper"
        meta={
          clubNews?.length > 0 ? (
            <span className="flex items-center gap-2">
              <span className="tabular-nums">
                {groupedNews.length} época{groupedNews.length !== 1 ? "s" : ""}
              </span>
              {groupedNews.length > 1 && (
                <button
                  type="button"
                  onClick={showAllYears ? collapseAll : expandAll}
                  aria-label={showAllYears ? "Recolher anos" : "Expandir todos os anos"}
                  title={showAllYears ? "Recolher anos" : "Expandir tudo"}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showAllYears ? "unfold_less" : "unfold_more"}
                  </span>
                </button>
              )}
            </span>
          ) : undefined
        }
        padded={false}
      >
        {clubNews && clubNews.length > 0 ? (
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
                    aria-expanded={isExpanded}
                    className={`w-full min-h-11 flex items-center justify-between px-4 short:px-3 py-2 short:py-1 text-left transition-colors ${
                      isExpanded
                        ? "bg-surface-container-high/60"
                        : "bg-surface-container-high/20 hover:bg-surface-container-high/40"
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className={`font-headline text-sm font-black tabular-nums ${isCurrentYear ? "text-primary" : "text-on-surface"}`}
                      >
                        {year}
                      </span>
                      {isCurrentYear && (
                        <Badge variant="info" size="sm">
                          Época atual
                        </Badge>
                      )}
                      <span className="text-[10px] font-bold text-on-surface-variant tabular-nums">
                        {items.length} {items.length === 1 ? "registo" : "registos"}
                      </span>
                    </span>
                    <span
                      className={`material-symbols-outlined text-[18px] text-on-surface-variant transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    >
                      expand_more
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
        ) : (
          <div className="p-3">
            <EmptyState icon="newspaper" title="Nenhuma notícia ainda." />
          </div>
        )}
      </Panel>
    </div>
  );
}
