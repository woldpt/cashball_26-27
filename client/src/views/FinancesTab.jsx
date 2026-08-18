import { socket } from "../socket.js";
import { formatCurrency } from "../utils/formatters.js";
import { SummaryWidget } from "../components/shared/SummaryWidget.jsx";
import { Button } from "../components/shared/Button.jsx";
import { BalanceLineChart } from "../components/shared/BalanceLineChart.jsx";

/**
 * @param {{
 *   financeData: object|null,
 *   totalWeeklyWage: number,
 *   completedJornada: number,
 *   loanInterestPerWeek: number,
 *   loanAmount: number,
 *   currentBudget: number,
 *   seasonYear: number,
 *   capacityRevPerGame: number,
 *   mySquad: Array,
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
  loanInterestPerWeek,
  loanAmount,
  currentBudget,
  seasonYear,
  capacityRevPerGame,
  mySquad,
  showTransferSales,
  setShowTransferSales,
  showTransferPurchases,
  setShowTransferPurchases,
  showTicketBreakdown,
  setShowTicketBreakdown,
  setGameDialog,
}) {
  const totalSeasonIncome =
    (financeData?.totalTicketRevenue || 0) +
    (financeData?.sponsorRevenue || 0) +
    (financeData?.totalTransferIncome || 0);
  const totalSeasonExpenses =
    totalWeeklyWage * completedJornada +
    loanInterestPerWeek * completedJornada +
    (financeData?.totalTransferExpenses || 0) +
    (financeData?.totalStadiumExpenses || 0);
  const seasonResult =
    totalSeasonIncome - totalSeasonExpenses;
  const loanPct = Math.min(
    100,
    (loanAmount / 2500000) * 100,
  );
  const wageSharePct =
    totalSeasonIncome > 0
      ? Math.min(
          100,
          Math.round(
            ((totalWeeklyWage * completedJornada) /
              totalSeasonIncome) *
              100,
          ),
        )
      : 0;

  return (
    <div className="space-y-4">
      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-0.5 bg-outline-variant/10 overflow-hidden rounded-xl">
        {/* Saldo Actual */}
        <SummaryWidget
          flat
          label="Saldo Actual"
          value={formatCurrency(currentBudget)}
          valueClass="text-4xl font-bold"
          valueColorClass={currentBudget >= 0 ? "text-primary" : "text-error"}
          className="relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none select-none">
            <span className="material-symbols-outlined text-8xl">
              payments
            </span>
          </div>
          <div className="mt-6 flex items-end gap-2">
            <div className="flex gap-1 h-8 items-end">
              <div className="w-1 bg-primary/20 h-2 rounded-t-sm" />
              <div className="w-1 bg-primary/40 h-4 rounded-t-sm" />
              <div className="w-1 bg-primary/60 h-3 rounded-t-sm" />
              <div className="w-1 bg-primary/80 h-6 rounded-t-sm" />
              <div className="w-1 bg-primary h-8 rounded-t-sm" />
            </div>
            <span className="text-[10px] text-primary font-bold font-label">
              época {seasonYear}
            </span>
          </div>
        </SummaryWidget>
        {/* Resultado da Época */}
        <SummaryWidget
          flat
          label="Resultado da Época"
          value={`${seasonResult >= 0 ? "+" : ""}${formatCurrency(seasonResult)}`}
          valueClass="text-4xl font-bold"
          valueColorClass={seasonResult >= 0 ? "text-tertiary" : "text-error"}
        >
          <div className="mt-6 flex items-center gap-2">
            <span
              className={`material-symbols-outlined text-sm ${seasonResult >= 0 ? "text-tertiary" : "text-error"}`}
            >
              {seasonResult >= 0
                ? "trending_up"
                : "trending_down"}
            </span>
            <span className="text-[10px] text-on-surface-variant font-medium font-label uppercase">
              {completedJornada} / 14 jornadas concluídas
            </span>
          </div>
        </SummaryWidget>
        {/* Saldo previsto */}
        {(() => {
          const remainingJornadas = 14 - completedJornada;
          const remainingHomeMatches = Math.max(
            0,
            7 - (financeData?.homeMatchesPlayed || 0),
          );
          const avgTicketRevenue =
            (financeData?.homeMatchesPlayed || 0) > 0
              ? (financeData?.totalTicketRevenue || 0) /
                financeData.homeMatchesPlayed
              : capacityRevPerGame * 0.8;
          const projectedTicketRevenue =
            avgTicketRevenue * remainingHomeMatches;
          const projectedSalaries =
            totalWeeklyWage * remainingJornadas;

          const projectedEndBudget = Math.round(
            currentBudget +
              projectedTicketRevenue -
              projectedSalaries,
          );
          return (
            <SummaryWidget
              flat
              label="Saldo previsto fim de época"
              value={`${projectedEndBudget >= 0 ? "+" : ""}${formatCurrency(projectedEndBudget)}`}
              valueClass="text-3xl font-bold"
              valueColorClass={projectedEndBudget >= 0 ? "text-tertiary" : "text-error"}
              className="relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none select-none">
                <span className="material-symbols-outlined text-8xl">
                  savings
                </span>
              </div>
              <div className="mt-6">
                <p className="text-[10px] text-on-surface-variant uppercase mb-1">
                  Bilheteiras previstas - salários (
                  {remainingJornadas} jornadas)
                </p>
              </div>
            </SummaryWidget>
          );
        })()}
      </div>

      {/* ── EVOLUÇÃO DO SALDO ─────────────────────────────────────────── */}
      <div className="bg-surface-container-low rounded-lg p-5">
        <div className="flex justify-between items-center pb-3 border-b border-outline-variant/15 mb-3">
          <h3 className="font-headline text-base uppercase tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-base">
              show_chart
            </span>
            Evolução do Saldo
          </h3>
          <span
            className={`font-headline text-sm font-bold ${currentBudget >= 0 ? "text-primary" : "text-error"}`}
          >
            {formatCurrency(currentBudget)}
          </span>
        </div>
        <BalanceLineChart data={financeData?.balanceHistory || []} />
      </div>

      {/* ── RECEITAS / DESPESAS / CONTROLO ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Receitas */}
        <div className="bg-surface-container-low rounded-lg p-5 flex flex-col space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-outline-variant/15">
            <h3 className="font-headline text-base uppercase tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-base">
                arrow_downward
              </span>
              Receitas
            </h3>
            <span className="font-headline text-primary font-bold text-sm">
              {formatCurrency(totalSeasonIncome)}
            </span>
          </div>
          <ul className="space-y-3">
            {(financeData?.ticketBreakdown?.length || 0) > 0 ? (
              <li className="space-y-1">
                <div
                  className="flex justify-between items-center cursor-pointer group"
                  onClick={() =>
                    setShowTicketBreakdown((v) => !v)
                  }
                >
                  <div>
                    <p className="text-sm text-on-surface-variant group-hover:text-on-surface transition-colors">
                      Bilheteiras
                    </p>
                    <p className="text-[10px] opacity-40 uppercase flex items-center gap-1">
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: "10px" }}
                      >
                        {showTicketBreakdown
                          ? "expand_less"
                          : "expand_more"}
                      </span>
                      {financeData.homeMatchesPlayed || 0}{" "}
                      jogos em casa
                    </p>
                  </div>
                  <span className="font-headline text-sm font-bold">
                    {formatCurrency(
                      financeData.totalTicketRevenue || 0,
                    )}
                  </span>
                </div>
                {showTicketBreakdown &&
                  (financeData.ticketBreakdown?.length || 0) > 0 && (
                    <ul className="pl-3 space-y-1 border-l-2 border-primary/20 ml-1 mt-1">
                      {financeData.ticketBreakdown.map(
                        (t, i) => (
                          <li
                            key={i}
                            className="flex justify-between items-center"
                          >
                            <div>
                              <p className="text-xs text-on-surface-variant/80">
                                J{t.matchweek}
                              </p>
                              <p className="text-[10px] opacity-30 uppercase">
                                vs {t.away_team_name || "—"} · {t.attendance.toLocaleString("pt-PT")} esp.
                              </p>
                            </div>
                            <span className="text-xs font-bold">
                              {formatCurrency(t.revenue)}
                            </span>
                          </li>
                        ),
                      )}
                    </ul>
                  )}
              </li>
            ) : (
              <li className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-on-surface-variant">
                    Bilheteiras
                  </p>
                  <p className="text-[10px] opacity-40 uppercase">
                    {financeData?.homeMatchesPlayed || 0}{" "}
                    jogos em casa
                  </p>
                </div>
                <span className="font-headline text-sm font-bold">
                  {formatCurrency(
                    financeData?.totalTicketRevenue || 0,
                  )}
                </span>
              </li>
            )}
            <li className="flex justify-between items-center">
              <div>
                <p className="text-sm text-on-surface-variant">
                  Patrocinadores
                </p>
                <p className="text-[10px] opacity-40 uppercase">
                  Receita anual por divisão
                </p>
              </div>
              <span className="font-headline text-sm font-bold">
                {formatCurrency(
                  financeData?.sponsorRevenue || 0,
                )}
              </span>
            </li>
            {(financeData?.totalTransferIncome || 0) >
              0 && (
              <li className="space-y-1">
                <div
                  className="flex justify-between items-center cursor-pointer group"
                  onClick={() =>
                    setShowTransferSales((v) => !v)
                  }
                >
                  <div>
                    <p className="text-sm text-on-surface-variant group-hover:text-on-surface transition-colors">
                      Vendas de Jogadores
                    </p>
                    <p className="text-[10px] opacity-40 uppercase flex items-center gap-1">
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: "10px" }}
                      >
                        {showTransferSales
                          ? "expand_less"
                          : "expand_more"}
                      </span>
                      {financeData.transferOutList
                        ?.length || 0}{" "}
                      transferência(s)
                    </p>
                  </div>
                  <span className="font-headline text-sm font-bold">
                    {formatCurrency(
                      financeData.totalTransferIncome,
                    )}
                  </span>
                </div>
                {showTransferSales &&
                  (financeData.transferOutList?.length ||
                    0) > 0 && (
                    <ul className="pl-3 space-y-1 border-l-2 border-primary/20 ml-1 mt-1">
                      {financeData.transferOutList.map(
                        (t, i) => (
                          <li
                            key={i}
                            className="flex justify-between items-center"
                          >
                            <div>
                              <p className="text-xs text-on-surface-variant/80">
                                {t.player_name || "Jogador"}
                                <span className="opacity-40 mx-1">
                                  →
                                </span>
                                {t.related_team_name || "—"}
                              </p>
                              {t.matchweek != null && (
                                <p className="text-[10px] opacity-30 uppercase">
                                  J{t.matchweek}
                                </p>
                              )}
                            </div>
                            <span className="text-xs font-bold">
                              {formatCurrency(t.amount)}
                            </span>
                          </li>
                        ),
                      )}
                    </ul>
                  )}
              </li>
            )}
          </ul>
        </div>

        {/* Despesas */}
        <div className="bg-surface-container-low rounded-lg p-5 flex flex-col space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-outline-variant/15">
            <h3 className="font-headline text-base uppercase tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-error text-base">
                arrow_upward
              </span>
              Despesas
            </h3>
            <span className="font-headline text-error font-bold text-sm">
              {formatCurrency(totalSeasonExpenses)}
            </span>
          </div>
          <ul className="space-y-3">
            <li className="flex justify-between items-center">
              <div>
                <p className="text-sm text-on-surface-variant">
                  Folha Salarial
                </p>
                <p className="text-[10px] opacity-40 uppercase">
                  {mySquad.length} atletas · pago por
                  jornada
                </p>
              </div>
              <span className="font-headline text-sm font-bold">
                {formatCurrency(
                  totalWeeklyWage * completedJornada,
                )}
              </span>
            </li>
            {loanAmount > 0 && (
              <li className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-on-surface-variant">
                    Juros Bancários
                  </p>
                  <p className="text-[10px] opacity-40 uppercase">
                    2,5% da dívida / jornada
                  </p>
                </div>
                <span className="font-headline text-sm font-bold">
                  {formatCurrency(
                    loanInterestPerWeek * completedJornada,
                  )}
                </span>
              </li>
            )}
            {(financeData?.totalTransferExpenses || 0) >
              0 && (
              <li className="space-y-1">
                <div
                  className="flex justify-between items-center cursor-pointer group"
                  onClick={() =>
                    setShowTransferPurchases((v) => !v)
                  }
                >
                  <div>
                    <p className="text-sm text-on-surface-variant group-hover:text-on-surface transition-colors">
                      Compras de Jogadores
                    </p>
                    <p className="text-[10px] opacity-40 uppercase flex items-center gap-1">
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: "10px" }}
                      >
                        {showTransferPurchases
                          ? "expand_less"
                          : "expand_more"}
                      </span>
                      {financeData.transferInList?.length ||
                        0}{" "}
                      transferência(s)
                    </p>
                  </div>
                  <span className="font-headline text-sm font-bold">
                    {formatCurrency(
                      financeData.totalTransferExpenses,
                    )}
                  </span>
                </div>
                {showTransferPurchases &&
                  (financeData.transferInList?.length ||
                    0) > 0 && (
                    <ul className="pl-3 space-y-1 border-l-2 border-error/20 ml-1 mt-1">
                      {financeData.transferInList.map(
                        (t, i) => (
                          <li
                            key={i}
                            className="flex justify-between items-center"
                          >
                            <div>
                              <p className="text-xs text-on-surface-variant/80">
                                {t.player_name || "Jogador"}
                                <span className="opacity-40 mx-1">
                                  ←
                                </span>
                                {t.related_team_name || "—"}
                              </p>
                              {t.matchweek != null && (
                                <p className="text-[10px] opacity-30 uppercase">
                                  J{t.matchweek}
                                </p>
                              )}
                            </div>
                            <span className="text-xs font-bold">
                              {formatCurrency(t.amount)}
                            </span>
                          </li>
                        ),
                      )}
                    </ul>
                  )}
              </li>
            )}
            {(financeData?.totalStadiumExpenses || 0) >
              0 && (
              <li className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-on-surface-variant">
                    Obras no Estádio
                  </p>
                  <p className="text-[10px] opacity-40 uppercase">
                    300.000€ ×{" "}
                    {Math.round(
                      (financeData.totalStadiumExpenses ||
                        0) / 300000,
                    )}{" "}
                    obra(s)
                  </p>
                </div>
                <span className="font-headline text-sm font-bold">
                  {formatCurrency(
                    financeData.totalStadiumExpenses,
                  )}
                </span>
              </li>
            )}
          </ul>
        </div>

        {/* Centro de Controlo */}
        <div className="space-y-4">
          {/* Folha Salarial */}
          <div
            className={`bg-surface-container rounded-lg p-5 border-l-4 ${wageSharePct > 75 ? "border-error" : wageSharePct > 50 ? "border-tertiary" : "border-primary"} relative overflow-hidden`}
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-headline text-xs uppercase tracking-widest text-on-surface-variant">
                  Folha Salarial
                </h3>
                <p className="font-headline text-xl font-bold mt-1">
                  {formatCurrency(totalWeeklyWage)}{" "}
                  <span className="text-xs font-normal opacity-50">
                    / jornada
                  </span>
                </p>
              </div>
              {wageSharePct > 75 && (
                <span
                  className="material-symbols-outlined text-error"
                  style={{
                    fontVariationSettings: "'FILL' 1",
                  }}
                >
                  warning
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                <span>% das receitas</span>
                <span
                  className={
                    wageSharePct > 75
                      ? "text-error"
                      : wageSharePct > 50
                        ? "text-tertiary"
                        : "text-primary"
                  }
                >
                  {wageSharePct}%
                </span>
              </div>
              <div className="h-2 w-full bg-surface-bright rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${wageSharePct > 75 ? "bg-error" : wageSharePct > 50 ? "bg-tertiary" : "bg-primary"}`}
                  style={{ width: `${wageSharePct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] opacity-50 uppercase">
                <span>
                  {formatCurrency(totalWeeklyWage)}/jornada
                </span>
                <span>{mySquad.length} atletas</span>
              </div>
            </div>
          </div>

          {/* Dívida Bancária */}
          <div className="bg-surface-container rounded-lg p-5 border-t border-outline-variant/10">
            <h3 className="font-headline text-xs uppercase tracking-widest text-on-surface-variant mb-3">
              Empréstimos
            </h3>
            <div className="mb-4">
              <p className="text-[10px] opacity-50 uppercase mb-0.5">
                Dívida Actual
              </p>
              <p
                className={`font-headline text-2xl font-bold tracking-tight ${loanAmount > 0 ? "text-error" : "text-primary"}`}
              >
                {formatCurrency(loanAmount)}
              </p>
              {loanAmount > 0 && (
                <p className="text-[10px] text-error font-medium mt-0.5">
                  JUROS: 2,5% / JORNADA
                </p>
              )}
              <div className="mt-2 h-1.5 w-full bg-surface-bright rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${loanPct > 75 ? "bg-error" : loanPct > 40 ? "bg-tertiary" : "bg-amber-400"}`}
                  style={{ width: `${loanPct}%` }}
                />
              </div>
              <p className="text-[10px] opacity-40 text-right mt-0.5">
                {loanPct.toFixed(0)}% de 2.500.000€
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                onClick={() => socket.emit("payLoan")}
                disabled={loanAmount < 500000 || currentBudget < 500000}
              >
                Pagar -500K
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setGameDialog({
                    mode: "confirm",
                    title: "Pedir Empréstimo de 500.000€",
                    description: `Juros semanais: ${formatCurrency(Math.round((loanAmount + 500000) * 0.025))}. Dívida total após: ${formatCurrency(loanAmount + 500000)}.`,
                    confirmLabel: "Confirmar Empréstimo",
                    danger: true,
                    onConfirm: () => socket.emit("takeLoan"),
                    onCancel: () => {},
                  });
                }}
                disabled={loanAmount >= 2500000}
                className="bg-surface-bright hover:brightness-110 border border-outline-variant/30"
              >
                Pedir +500K
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
