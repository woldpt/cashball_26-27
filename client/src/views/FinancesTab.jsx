import { useMemo } from "react";
import { PlayerLink } from "../components/shared/PlayerLink.jsx";
import { socket } from "../socket.js";
import { TeamLink } from "../components/shared/TeamLink.jsx";
import { formatCurrency } from "../utils/formatters.js";
import { TransferHeader } from "../components/transfers/TransferChrome.jsx";
import { Button } from "../components/shared/Button.jsx";
import { Panel } from "../components/shared/Panel.jsx";
import { BalanceLineChart } from "../components/shared/BalanceLineChart.jsx";
import { SponsorLogo } from "../components/shared/SponsorLogo.jsx";
import {
  LOAN_MAX,
  LOAN_STEP,
  LOAN_INTEREST_RATE,
  STADIUM_EXPANSION_COST,
  SEASON_JORNADAS,
  SEASON_WEEKS,
  SEASON_HOME_MATCHES,
  TICKET_ESTIMATE_FACTOR,
} from "../constants/index.js";

// Uma cor por rubrica: a mesma no ponto da linha e no segmento da barra.
const INCOME_COLORS = {
  tickets: "bg-primary",
  sponsor: "bg-tertiary",
  base: "bg-emerald-500",
  prizes: "bg-violet-400",
  sales: "bg-sky-500",
};
const EXPENSE_COLORS = {
  wages: "bg-error",
  staff: "bg-orange-300",
  interest: "bg-amber-500",
  upkeep: "bg-yellow-700",
  purchases: "bg-fuchsia-500",
  works: "bg-red-800",
};

/**
 * Rubrica financeira: ponto da cor da barra · rótulo + detalhe · % do total
 * · valor. Com `onToggle`, a linha é um botão (alvo de 44px) que expande a
 * lista em `children`.
 * @param {{
 *   label: string,
 *   sub: import("react").ReactNode,
 *   value: number,
 *   total: number,
 *   color: string,
 *   leading?: import("react").ReactNode,
 *   expanded?: boolean,
 *   onToggle?: (() => void)|null,
 *   children?: import("react").ReactNode,
 * }} props
 * @returns {JSX.Element}
 */
function LedgerRow({
  label,
  sub,
  value,
  total,
  color,
  leading = null,
  expanded = false,
  onToggle = null,
  children = null,
}) {
  const clickable = !!onToggle;
  const Row = clickable ? "button" : "div";
  const pct = total > 0 ? Math.round((value / total) * 100) : null;
  return (
    <li>
      <Row
        {...(clickable
          ? { type: "button", onClick: onToggle, "aria-expanded": expanded }
          : {})}
        className={`w-full min-h-11 flex items-center gap-2.5 py-2 short:py-1 text-left rounded-sm ${
          clickable
            ? "group cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
            : ""
        }`}
      >
        <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-[3px] ${color}`} />
        {leading}
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-bold text-on-surface leading-tight ${
              clickable ? "group-hover:text-primary transition-colors" : ""
            }`}
          >
            {label}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-on-surface-variant/70 leading-tight mt-0.5">
            {sub}
          </p>
        </div>
        {pct != null && (
          <span className="w-9 shrink-0 text-right text-[10px] font-black tabular-nums text-on-surface-variant/60">
            {pct}%
          </span>
        )}
        <span className="shrink-0 text-right font-headline text-sm font-black tabular-nums text-on-surface">
          {formatCurrency(value)}
        </span>
        <span
          aria-hidden
          className={`material-symbols-outlined w-5 shrink-0 text-[18px] text-on-surface-variant transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        >
          {clickable ? "expand_more" : ""}
        </span>
      </Row>
      {expanded && children && (
        <ul className="mb-2 ml-[4px] space-y-1.5 border-l border-outline-variant/25 pl-4 pr-[30px]">
          {children}
        </ul>
      )}
    </li>
  );
}

/**
 * Linha do detalhe de uma rubrica (jogo, transferência…).
 * @param {{ label: import("react").ReactNode, sub?: import("react").ReactNode, value: number }} props
 * @returns {JSX.Element}
 */
function DetailItem({ label, sub = null, value }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-xs text-on-surface">{label}</p>
        {sub && (
          <p className="text-[10px] uppercase tracking-wide text-on-surface-variant/60">{sub}</p>
        )}
      </div>
      <span className="shrink-0 text-xs font-bold tabular-nums text-on-surface-variant">
        {formatCurrency(value)}
      </span>
    </li>
  );
}

/**
 * Barra segmentada de composição (proporção). A legenda são as próprias
 * linhas (ponto da mesma cor + %).
 * @param {{segments: Array<{label: string, bg: string, pct: number}>}} props
 * @returns {JSX.Element|null}
 */
function SegmentBar({ segments }) {
  if (segments.length === 0) return null;
  return (
    <div
      className="flex h-2 w-full overflow-hidden rounded-full gap-px mb-1"
      role="img"
      aria-label={segments.map((s) => `${s.label} ${Math.round(s.pct)}%`).join(", ")}
    >
      {segments.map((s) => (
        <div key={s.label} className={`h-full ${s.bg}`} style={{ width: `${s.pct}%` }} />
      ))}
    </div>
  );
}

/**
 * Cor da folha salarial pelo peso nas receitas (verde · amarelo · vermelho).
 * @param {number} pct
 */
function wageTone(pct) {
  if (pct > 75) return { text: "text-error", bar: "bg-error" };
  if (pct > 50) return { text: "text-tertiary", bar: "bg-tertiary" };
  return { text: "text-primary", bar: "bg-primary" };
}

/**
 * @param {{
 *   financeData: object|null,
 *   totalWeeklyWage: number,
 *   completedJornada: number,
 *   elapsedWeeks?: number,
 *   loanInterestPerWeek: number,
 *   loanAmount: number,
 *   currentBudget: number,
 *   seasonYear: number,
 *   capacityRevPerGame: number,
 *   mySquad: Array,
 *   staff?: {salaryWeekly: number, members: Array<{salaryWeekly: number, hiredSlot: number}>}|null,
 *   showTransferSales: boolean,
 *   setShowTransferSales: function,
 *   showTransferPurchases: boolean,
 *   setShowTransferPurchases: function,
 *   showTicketBreakdown: boolean,
 *   setShowTicketBreakdown: function,
 *   setGameDialog: function,
 * }} props
 */
export function FinancesTab({
  financeData,
  totalWeeklyWage,
  completedJornada,
  elapsedWeeks,
  loanInterestPerWeek,
  loanAmount,
  currentBudget,
  seasonYear,
  capacityRevPerGame,
  mySquad,
  staff,
  showTransferSales,
  setShowTransferSales,
  showTransferPurchases,
  setShowTransferPurchases,
  showTicketBreakdown,
  setShowTicketBreakdown,
  setGameDialog,
}) {
  const weeksElapsed = elapsedWeeks ?? completedJornada;
  const interestPct = (LOAN_INTEREST_RATE * 100).toLocaleString("pt-PT");
  const loanStepK = `${LOAN_STEP / 1000}K`;
  const staffMembers = staff?.members || [];
  const staffWeeklyWage = staff?.salaryWeekly || 0;
  // Semanas pagas desde a contratação; hiredSlot acima do índice actual = época anterior.
  // Rubricas reais da época (resumos semanais do Jornal); sem elas, estimativa.
  const weekly = financeData?.weekly || null;
  const staffSeasonCost = weekly
    ? weekly.staff
    : staffMembers.reduce((sum, m) => {
        const from = m.hiredSlot > weeksElapsed ? 0 : m.hiredSlot || 0;
        return sum + m.salaryWeekly * Math.max(0, weeksElapsed - from);
      }, 0);
  const wagesSeasonCost = weekly ? weekly.wages : totalWeeklyWage * weeksElapsed;
  const interestSeasonCost = weekly
    ? weekly.interest
    : loanInterestPerWeek * weeksElapsed;
  const {
    totalSeasonIncome,
    totalSeasonExpenses,
    seasonResult,
    loanPct,
    wageSharePct,
  } = useMemo(() => {
    const totalSeasonIncome =
      (financeData?.totalTicketRevenue || 0) +
      (financeData?.awayTicketRevenue || 0) +
      (financeData?.sponsorRevenue || 0) +
      (financeData?.prizeRevenue || 0) +
      (weekly?.baseIncome || 0) +
      (financeData?.totalTransferIncome || 0);
    const totalSeasonExpenses =
      wagesSeasonCost +
      staffSeasonCost +
      interestSeasonCost +
      (weekly?.upkeep || 0) +
      (financeData?.totalTransferExpenses || 0) +
      (financeData?.totalStadiumExpenses || 0);
    const seasonResult = totalSeasonIncome - totalSeasonExpenses;
    const loanPct = Math.min(100, (loanAmount / LOAN_MAX) * 100);
    const wageSharePct =
      totalSeasonIncome > 0
        ? Math.min(
            100,
            Math.round(
              (wagesSeasonCost / totalSeasonIncome) * 100,
            ),
          )
        : 0;
    return {
      totalSeasonIncome,
      totalSeasonExpenses,
      seasonResult,
      loanPct,
      wageSharePct,
    };
  }, [
    financeData,
    weekly,
    wagesSeasonCost,
    staffSeasonCost,
    interestSeasonCost,
    loanAmount,
  ]);

  // Saldo previsto: simula as semanas que faltam como o servidor as cobra
  // (receita base + patrocínio − salários − funcionários − manutenção − juros
  // − prestação do empréstimo, que abate a dívida e baixa os juros seguintes)
  // e soma as bilheteiras de liga ainda por jogar (casa + 15% fora).
  // Prémios e Taça futura ficam de fora: não são previsíveis.
  const projection = useMemo(() => {
    const fc = financeData?.forecast || null;
    const weeksCharged = weekly ? weekly.weeks : weeksElapsed;
    const remainingWeeks = Math.max(0, SEASON_WEEKS - weeksCharged);

    const homePlayed = financeData?.homeMatchesPlayed || 0;
    const avgHome =
      homePlayed > 0
        ? (financeData?.leagueTicketRevenue || 0) / homePlayed
        : capacityRevPerGame * TICKET_ESTIMATE_FACTOR;
    const awayPlayed = financeData?.awayLeagueMatchesPlayed || 0;
    const avgAway =
      awayPlayed > 0 ? (financeData?.awayLeagueTicketRevenue || 0) / awayPlayed : 0;
    const tickets =
      avgHome * Math.max(0, SEASON_HOME_MATCHES - homePlayed) +
      avgAway * Math.max(0, SEASON_JORNADAS - SEASON_HOME_MATCHES - awayPlayed);

    let budget = currentBudget + tickets + (fc?.sponsorSecondPending || 0);
    let loan = loanAmount;
    for (let w = 0; w < remainingWeeks; w += 1) {
      const interest = loan > 0 ? Math.floor(loan * LOAN_INTEREST_RATE) : 0;
      const installment = Math.min(fc?.loanInstallment || 0, loan);
      budget +=
        (fc?.baseIncome || 0) +
        (fc?.sponsorWeekly || 0) -
        totalWeeklyWage -
        staffWeeklyWage -
        (fc?.upkeep || 0) -
        interest -
        installment;
      loan -= installment;
    }
    return { remainingWeeks, projectedEndBudget: Math.round(budget), projectedLoan: loan };
  }, [
    financeData,
    weekly,
    weeksElapsed,
    capacityRevPerGame,
    totalWeeklyWage,
    staffWeeklyWage,
    loanAmount,
    currentBudget,
  ]);

  // Composição das receitas (proporção) para a barra segmentada do painel.
  const incomeSegments = useMemo(() => {
    if (totalSeasonIncome <= 0) return [];
    const parts = [
      {
        label: "Bilheteira",
        v:
          (financeData?.totalTicketRevenue || 0) +
          (financeData?.awayTicketRevenue || 0),
        bg: INCOME_COLORS.tickets,
      },
      {
        label: "Patrocinadores",
        v: financeData?.sponsorRevenue || 0,
        bg: INCOME_COLORS.sponsor,
      },
      { label: "Receita base", v: weekly?.baseIncome || 0, bg: INCOME_COLORS.base },
      { label: "Prémios", v: financeData?.prizeRevenue || 0, bg: INCOME_COLORS.prizes },
      { label: "Vendas", v: financeData?.totalTransferIncome || 0, bg: INCOME_COLORS.sales },
    ].filter((p) => p.v > 0);
    return parts.map((p) => ({ ...p, pct: (p.v / totalSeasonIncome) * 100 }));
  }, [totalSeasonIncome, financeData, weekly]);

  // Composição das despesas, no mesmo formato (tons quentes).
  const expenseSegments = useMemo(() => {
    if (totalSeasonExpenses <= 0) return [];
    return [
      { label: "Salários", v: wagesSeasonCost, bg: EXPENSE_COLORS.wages },
      { label: "Funcionários", v: staffSeasonCost, bg: EXPENSE_COLORS.staff },
      { label: "Juros", v: interestSeasonCost, bg: EXPENSE_COLORS.interest },
      { label: "Manutenção", v: weekly?.upkeep || 0, bg: EXPENSE_COLORS.upkeep },
      { label: "Compras", v: financeData?.totalTransferExpenses || 0, bg: EXPENSE_COLORS.purchases },
      { label: "Obras", v: financeData?.totalStadiumExpenses || 0, bg: EXPENSE_COLORS.works },
    ]
      .filter((p) => p.v > 0)
      .map((p) => ({ ...p, pct: (p.v / totalSeasonExpenses) * 100 }));
  }, [totalSeasonExpenses, wagesSeasonCost, staffSeasonCost, interestSeasonCost, weekly, financeData]);

  // O ponto mais recente do gráfico é sempre o saldo actual: se divergir do
  // último snapshot (transfers/obras a meio da semana), acrescenta um ponto
  // sintético "Agora" — sem tocar no histórico persistido.
  const chartData = useMemo(() => {
    const hist = financeData?.balanceHistory || [];
    const last = hist[hist.length - 1];
    if (!last || last.balance === currentBudget) return hist;
    return [
      ...hist,
      {
        x: (last.x ?? last.matchweek ?? 0) + 1,
        matchweek: (last.matchweek ?? 0) + 1,
        label: "Agora",
        balance: currentBudget,
      },
    ];
  }, [financeData, currentBudget]);

  const wage = wageTone(wageSharePct);
  const signed = (v) => `${v >= 0 ? "+" : ""}${formatCurrency(v)}`;
  const payDisabledReason =
    loanAmount < LOAN_STEP
      ? "Sem dívida para pagar"
      : currentBudget < LOAN_STEP
        ? "Saldo insuficiente"
        : undefined;
  const homeGames =
    financeData?.totalHomeMatchesPlayed ?? financeData?.homeMatchesPlayed ?? 0;
  const stadiumWorks = Math.round(
    (financeData?.totalStadiumExpenses || 0) / STADIUM_EXPANSION_COST,
  );

  return (
    <div className="space-y-4 short:space-y-2">
      <TransferHeader
        icon="account_balance_wallet"
        kicker={`Clube · Época ${seasonYear}`}
        title="Finanças"
        budget={currentBudget}
        chips={[
          {
            label: `resultado · ${weeksElapsed}/${SEASON_WEEKS} sem.`,
            value: signed(seasonResult),
            tone: seasonResult >= 0 ? "good" : "bad",
            icon: "trending_up",
          },
          {
            label: `previsão fim de época · faltam ${projection.remainingWeeks} sem.`,
            value: signed(projection.projectedEndBudget),
            tone: projection.projectedEndBudget >= 0 ? "good" : "bad",
            icon: "query_stats",
          },
          ...(loanAmount > 0
            ? [{ label: "dívida", value: formatCurrency(loanAmount), tone: "warn", icon: "account_balance" }]
            : []),
        ]}
      />

      {/* lg: 6 colunas — gráfico (4) + salários/empréstimos (2) em cima, a
          esticar à mesma altura; Receitas e Despesas a 50/50 por baixo. No
          telemóvel, order-*: gráfico → receitas → despesas → controlo. */}
      <div className="grid grid-cols-1 gap-4 short:gap-2 lg:grid-cols-6">
        <Panel
          title="Evolução do Saldo"
          icon="show_chart"
          className="order-1 lg:col-span-4 lg:row-start-1"
        >
          <BalanceLineChart data={chartData} />
        </Panel>

        {/* ── Receitas ── */}
        <Panel
          title="Receitas"
          icon="south_west"
          className="order-2 lg:col-start-1 lg:col-span-3 lg:row-start-2"
          meta={
            <span className="font-headline text-sm text-primary tabular-nums">
              {formatCurrency(totalSeasonIncome)}
            </span>
          }
        >
          <SegmentBar segments={incomeSegments} />
          <ul className="divide-y divide-outline-variant/10">
            <LedgerRow
              label="Bilheteiras"
              color={INCOME_COLORS.tickets}
              total={totalSeasonIncome}
              value={financeData?.totalTicketRevenue || 0}
              sub={
                <>
                  {homeGames} {homeGames === 1 ? "jogo" : "jogos"} em casa
                  {(financeData?.cupHomeMatchesPlayed || 0) > 0 &&
                    ` · ${financeData?.homeMatchesPlayed || 0} Liga + ${financeData.cupHomeMatchesPlayed} Taça`}
                </>
              }
              expanded={showTicketBreakdown}
              onToggle={
                (financeData?.ticketBreakdown?.length || 0) > 0
                  ? () => setShowTicketBreakdown((v) => !v)
                  : null
              }
            >
              {financeData?.ticketBreakdown?.map((t) => {
                const isCup = t.competition === "cup";
                return (
                  <DetailItem
                    key={isCup ? `cup-${t.round}` : `league-${t.matchweek}`}
                    label={
                      <>
                        {isCup ? (t.roundName === "Amigável" ? t.roundName : `Taça · ${t.roundName}`) : `J${t.matchweek}`}
                        <span className="text-on-surface-variant"> · vs </span>
                        <TeamLink teamId={t.away_team_id}>{t.away_team_name || "—"}</TeamLink>
                      </>
                    }
                    sub={`${t.attendance.toLocaleString("pt-PT")} espectadores`}
                    value={t.revenue}
                  />
                );
              })}
            </LedgerRow>
            {(financeData?.awayTicketRevenue || 0) > 0 && (
              <LedgerRow
                label="Bilheteiras fora"
                sub="15% da receita do visitado"
                color={INCOME_COLORS.tickets}
                total={totalSeasonIncome}
                value={financeData.awayTicketRevenue}
              />
            )}
            <LedgerRow
              label="Patrocinadores"
              color={INCOME_COLORS.sponsor}
              total={totalSeasonIncome}
              value={financeData?.sponsorRevenue || 0}
              leading={
                financeData?.sponsorId ? (
                  <SponsorLogo
                    brand={{ sponsorId: financeData.sponsorId, name: financeData?.sponsorName }}
                    className="h-8 w-8 shrink-0 rounded-md"
                  />
                ) : null
              }
              sub={
                financeData?.sponsorName
                  ? `${financeData.sponsorName}${financeData?.sponsorProfile ? ` · perfil ${financeData.sponsorProfile}` : ""}`
                  : "Receita anual por divisão"
              }
            />
            {(weekly?.baseIncome || 0) > 0 && (
              <LedgerRow
                label="Receita base"
                sub="Por divisão · semanal"
                color={INCOME_COLORS.base}
                total={totalSeasonIncome}
                value={weekly.baseIncome}
              />
            )}
            {(financeData?.prizeRevenue || 0) > 0 && (
              <LedgerRow
                label="Prémios"
                sub="Taça, campeonato e individuais"
                color={INCOME_COLORS.prizes}
                total={totalSeasonIncome}
                value={financeData.prizeRevenue}
              />
            )}
            {(financeData?.totalTransferIncome || 0) > 0 && (
              <LedgerRow
                label="Vendas de jogadores"
                sub={`${financeData?.transferOutList?.length || 0} transferência(s)`}
                color={INCOME_COLORS.sales}
                total={totalSeasonIncome}
                value={financeData.totalTransferIncome}
                expanded={showTransferSales}
                onToggle={() => setShowTransferSales((v) => !v)}
              >
                {financeData?.transferOutList?.map((t) => (
                  <DetailItem
                    key={`${t.player_name || "jogador"}-${t.amount}-${t.matchweek ?? "x"}`}
                    label={
                      <>
                        <PlayerLink playerId={t.player_id}>{t.player_name || "Jogador"}</PlayerLink>
                        <span className="text-on-surface-variant/60 mx-1">→</span>
                        <TeamLink teamId={t.related_team_id}>{t.related_team_name || "—"}</TeamLink>
                      </>
                    }
                    sub={t.matchweek != null ? `J${t.matchweek}` : null}
                    value={t.amount}
                  />
                ))}
              </LedgerRow>
            )}
          </ul>
        </Panel>

        {/* ── Despesas ── */}
        <Panel
          title="Despesas"
          icon="north_east"
          className="order-3 lg:col-start-4 lg:col-span-3 lg:row-start-2"
          meta={
            <span className="font-headline text-sm text-error tabular-nums">
              {formatCurrency(totalSeasonExpenses)}
            </span>
          }
        >
          <SegmentBar segments={expenseSegments} />
          <ul className="divide-y divide-outline-variant/10">
            <LedgerRow
              label="Folha salarial"
              sub={`${mySquad.length} atletas · pago por jornada`}
              color={EXPENSE_COLORS.wages}
              total={totalSeasonExpenses}
              value={wagesSeasonCost}
            />
            {staffMembers.length > 0 && (
              <LedgerRow
                label="Funcionários"
                sub={`${staffMembers.length} contratado(s) · ${formatCurrency(staffWeeklyWage)}/jornada`}
                color={EXPENSE_COLORS.staff}
                total={totalSeasonExpenses}
                value={staffSeasonCost}
              />
            )}
            {loanAmount > 0 && (
              <LedgerRow
                label="Juros bancários"
                sub={`${interestPct}% da dívida / jornada`}
                color={EXPENSE_COLORS.interest}
                total={totalSeasonExpenses}
                value={interestSeasonCost}
              />
            )}
            {(weekly?.upkeep || 0) > 0 && (
              <LedgerRow
                label="Manutenção do estádio"
                sub="Lugares acima da isenção · semanal"
                color={EXPENSE_COLORS.upkeep}
                total={totalSeasonExpenses}
                value={weekly.upkeep}
              />
            )}
            {(financeData?.totalTransferExpenses || 0) > 0 && (
              <LedgerRow
                label="Compras de jogadores"
                sub={`${financeData?.transferInList?.length || 0} transferência(s)`}
                color={EXPENSE_COLORS.purchases}
                total={totalSeasonExpenses}
                value={financeData.totalTransferExpenses}
                expanded={showTransferPurchases}
                onToggle={() => setShowTransferPurchases((v) => !v)}
              >
                {financeData?.transferInList?.map((t) => (
                  <DetailItem
                    key={`${t.player_name || "jogador"}-${t.amount}-${t.matchweek ?? "x"}`}
                    label={
                      <>
                        <PlayerLink playerId={t.player_id}>{t.player_name || "Jogador"}</PlayerLink>
                        <span className="text-on-surface-variant/60 mx-1">←</span>
                        <TeamLink teamId={t.related_team_id}>{t.related_team_name || "—"}</TeamLink>
                      </>
                    }
                    sub={t.matchweek != null ? `J${t.matchweek}` : null}
                    value={t.amount}
                  />
                ))}
              </LedgerRow>
            )}
            {(financeData?.totalStadiumExpenses || 0) > 0 && (
              <LedgerRow
                label="Obras no estádio"
                sub={`${formatCurrency(STADIUM_EXPANSION_COST)} × ${stadiumWorks} obra(s)`}
                color={EXPENSE_COLORS.works}
                total={totalSeasonExpenses}
                value={financeData.totalStadiumExpenses}
              />
            )}
          </ul>
        </Panel>

        {/* ── Controlo: salários + empréstimos (esticam até à altura do gráfico) ── */}
        <div className="order-4 lg:col-start-5 lg:col-span-2 lg:row-start-1 flex flex-col gap-4 short:gap-2">
          <Panel title="Folha Salarial" icon="payments" meta={`${mySquad.length} atletas`}>
            <div className="flex items-start justify-between gap-2">
              <p className="font-headline text-2xl short:text-lg font-black tracking-tight tabular-nums text-on-surface">
                {formatCurrency(totalWeeklyWage)}
                <span className="ml-1 text-xs font-bold text-on-surface-variant">/ jornada</span>
              </p>
              {wageSharePct > 75 && (
                <span
                  className="material-symbols-outlined text-error"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                  title="Os salários pesam demasiado nas receitas"
                >
                  warning
                </span>
              )}
            </div>
            <div className="mt-3 short:mt-1.5 space-y-1.5">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                <span>% das receitas</span>
                <span className={`tabular-nums ${wage.text}`}>{wageSharePct}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-bright">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${wage.bar}`}
                  style={{ width: `${wageSharePct}%` }}
                />
              </div>
              {staffWeeklyWage > 0 && (
                <p className="text-[10px] uppercase tracking-wide text-on-surface-variant/70">
                  + Funcionários {formatCurrency(staffWeeklyWage)} / jornada
                </p>
              )}
            </div>
          </Panel>

          <Panel
            title="Empréstimos"
            icon="account_balance"
            className="flex-1"
            meta={`Juros ${interestPct}%`}
          >
            {/* Face do cartão */}
            <div
              className={`relative overflow-hidden rounded-xl p-4 short:p-2.5 shadow-lg shadow-black/40 ring-1 ${
                loanAmount > 0
                  ? "bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 ring-white/10"
                  : "bg-gradient-to-br from-zinc-900 via-zinc-800 to-emerald-950 ring-emerald-400/25"
              }`}
            >
              <div className="pointer-events-none absolute -top-16 right-0 h-32 w-32 rounded-full bg-rose-500/10 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-16 left-0 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />

              <div className="relative flex items-center justify-between gap-2">
                <span className="font-headline text-[11px] font-black uppercase tracking-widest text-white/90 truncate">
                  CashBall Bank
                </span>
                <span aria-hidden className="material-symbols-outlined text-lg text-white/40">
                  nfc
                </span>
              </div>

              <div className="relative mt-3 short:mt-2 flex items-end justify-between gap-3">
                {/* chip do cartão */}
                <div
                  aria-hidden
                  className="h-8 w-11 shrink-0 rounded-md bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 p-[3px] shadow-inner ring-1 ring-black/25"
                >
                  <div className="flex h-full w-full items-stretch justify-center gap-[3px] rounded-[4px] bg-gradient-to-b from-white/25 to-transparent">
                    <span className="w-px bg-black/25" />
                    <span className="w-px bg-black/25" />
                    <span className="w-px bg-black/25" />
                  </div>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/45">
                    Dívida atual
                  </p>
                  <p
                    className={`font-headline text-2xl short:text-lg font-black tracking-tight tabular-nums leading-tight ${
                      loanAmount > 0 ? "text-white" : "text-emerald-300"
                    }`}
                  >
                    {formatCurrency(loanAmount)}
                  </p>
                </div>
              </div>

              {/* plafond utilizado */}
              <div className="relative mt-3 short:mt-2">
                <div className="mb-1 flex items-baseline justify-between gap-2 text-[9px] font-black uppercase tracking-widest text-white/45">
                  <span className="truncate">Plafond</span>
                  <span className="tabular-nums shrink-0">
                    {loanPct.toFixed(0)}% de {formatCurrency(LOAN_MAX)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      loanPct > 75 ? "bg-rose-400" : loanPct > 40 ? "bg-amber-400" : "bg-emerald-400"
                    }`}
                    style={{ width: `${loanPct}%` }}
                  />
                </div>
                <p
                  className={`mt-1.5 text-[9px] font-black uppercase tracking-wider ${
                    loanAmount > 0 ? "text-rose-300" : "text-emerald-300/90"
                  }`}
                >
                  {loanAmount > 0
                    ? projection.projectedLoan > 0
                      ? `No fim da época: ${formatCurrency(projection.projectedLoan)}`
                      : "Liquidado até ao fim da época"
                    : "Sem dívida · sem juros"}
                </p>
              </div>
            </div>

            {/* operações */}
            <div className="mt-3 short:mt-2 grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                onClick={() => socket.emit("payLoan")}
                disabled={!!payDisabledReason}
                title={payDisabledReason}
              >
                Pagar {loanStepK}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setGameDialog({
                    mode: "confirm",
                    title: `Pedir Empréstimo de ${formatCurrency(LOAN_STEP)}`,
                    description: `Juros semanais: ${formatCurrency(Math.round((loanAmount + LOAN_STEP) * LOAN_INTEREST_RATE))}. Dívida total após: ${formatCurrency(loanAmount + LOAN_STEP)}.`,
                    confirmLabel: "Confirmar Empréstimo",
                    danger: true,
                    onConfirm: () => socket.emit("takeLoan"),
                    onCancel: () => {},
                  });
                }}
                disabled={loanAmount + LOAN_STEP > LOAN_MAX}
                title={loanAmount + LOAN_STEP > LOAN_MAX ? "Plafond esgotado" : undefined}
              >
                Pedir {loanStepK}
              </Button>
              {loanAmount > 0 && (
                <Button
                  variant="dangerSoft"
                  className="col-span-2"
                  onClick={() => {
                    setGameDialog({
                      mode: "confirm",
                      title: "Liquidar a Dívida Bancária",
                      description: `Vais pagar o valor total em dívida: ${formatCurrency(loanAmount)}. Ficas com saldo de ${formatCurrency(currentBudget - loanAmount)} e deixas de pagar juros (${interestPct}%/jornada).`,
                      confirmLabel: "Pagar Dívida",
                      danger: true,
                      onConfirm: () => socket.emit("payAllLoan"),
                      onCancel: () => {},
                    });
                  }}
                  disabled={currentBudget < loanAmount}
                  title={currentBudget < loanAmount ? "Saldo insuficiente para liquidar" : undefined}
                >
                  Liquidar dívida · {formatCurrency(loanAmount)}
                </Button>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
