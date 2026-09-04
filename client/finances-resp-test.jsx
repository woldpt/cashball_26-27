// FinancesTab mobile responsiveness harness — renders the REAL FinancesTab
// with edge-case fixture data and self-reports overflow measurements.
// NOT part of the app; used only for verification.
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { FinancesTab } from "./src/views/FinancesTab.jsx";

// ── Fixture: edge cases ────────────────────────────────────────────────────
// - saldo negativo (paths de cor error)
// - dívida alta (loanPct > 75 → border error) e folha > 75% (warning icon)
// - nomes longos em bilheteiras/transfers (risco de overflow)
const balanceHistory = [
  { jornada: 1, balance: 1500000 },
  { jornada: 2, balance: 1420000 },
  { jornada: 3, balance: -80000 },
  { jornada: 4, balance: 240000 },
  { jornada: 5, balance: 1150000 },
  { jornada: 6, balance: 980000 },
];

const financeData = {
  balanceHistory,
  totalTicketRevenue: 420000,
  leagueTicketRevenue: 420000,
  homeMatchesPlayed: 6,
  cupHomeMatchesPlayed: 1,
  totalHomeMatchesPlayed: 7,
  sponsorRevenue: 120000,
  totalTransferIncome: 850000,
  totalTransferExpenses: 600000,
  totalStadiumExpenses: 250000,
  ticketBreakdown: [
    { competition: "league", matchweek: 1, away_team_name: "SC Beira-Mar de Aver-o-Mar", attendance: 18500, revenue: 65500 },
    { competition: "league", matchweek: 3, away_team_name: "CF Estrela Vermelha", attendance: 21000, revenue: 78750 },
    { competition: "league", matchweek: 5, away_team_name: "UD Constança do Norte", attendance: 19800, revenue: 72300 },
    { competition: "league", matchweek: 6, away_team_name: "FC Porto de Leixões", attendance: 25000, revenue: 97500 },
    { competition: "league", matchweek: 8, away_team_name: "Benfica B", attendance: 23500, revenue: 91350 },
    { competition: "league", matchweek: 10, away_team_name: "Boavista Futebol Clube", attendance: 22000, revenue: 84800 },
    { competition: "cup", round: "1", roundName: "16 Avos de Final", away_team_name: "Atlético da Marginal", attendance: 15200, revenue: 53200 },
  ],
  transferOutList: [
    { player_name: "João Pedro Ferreira da Silva", related_team_name: "Real Madriz CF", matchweek: 4, amount: 850000 },
  ],
  transferInList: [
    { player_name: "Aleksandar Konstantinopoulos", related_team_name: "Olympiacos FC", matchweek: 2, amount: 400000 },
    { player_name: "Mamadou Diakhaby", related_team_name: "Stade Rennais", matchweek: 7, amount: 200000 },
  ],
};

// 18 atletas → wage share alto (warning) — apenas .length é usado
const mySquad = Array.from({ length: 18 }, (_, i) => ({ id: i, name: `Jogador ${i + 1}` }));

const root = createRoot(document.getElementById("root"));
root.render(
  // Mimics the GameLayout mobile container: <main> > div.p-4 > tab content
  <div className="min-h-screen bg-surface">
    <div className="p-4 lg:p-6">
      <FinancesTab
        financeData={financeData}
        totalWeeklyWage={125000}
        completedJornada={6}
        loanInterestPerWeek={28000}
        loanAmount={2100000}
        currentBudget={-42500}
        seasonYear={2026}
        capacityRevPerGame={130000}
        mySquad={mySquad}
        showTransferSales={true}
        setShowTransferSales={() => {}}
        showTransferPurchases={true}
        setShowTransferPurchases={() => {}}
        showTicketBreakdown={true}
        setShowTicketBreakdown={() => {}}
        setGameDialog={() => {}}
      />
    </div>
  </div>,
);

function measure() {
  const vw = window.innerWidth;
  const doc = document.documentElement;
  const pageOverflow = doc.scrollWidth - vw;

  // Rows/cards with overflow-hidden (content clipping risk)
  const rows = [...document.querySelectorAll("div.flex.overflow-hidden")];
  const clippedRows = rows
    .filter((el) => el.scrollWidth > el.clientWidth + 1)
    .map((el) => ({
      name:
        el.querySelector("p.uppercase")?.textContent ||
        el.className.toString().slice(0, 60),
      scrollW: el.scrollWidth,
      clientW: el.clientWidth,
    }));

  // Any hidden/auto-overflow element clipping content (top 10 by excess)
  const all = [...document.querySelectorAll("*")].filter((el) => {
    const ov = getComputedStyle(el).overflowX;
    return (
      (ov === "hidden" || ov === "auto") && el.scrollWidth > el.clientWidth + 1
    );
  });
  const clippingElements = all
    .map((el) => ({
      cls: (el.className && el.className.toString().slice(0, 80)) || el.tagName,
      scrollW: el.scrollWidth,
      clientW: el.clientWidth,
      excess: el.scrollWidth - el.clientWidth,
    }))
    .sort((a, b) => b.excess - a.excess)
    .slice(0, 10);

  return {
    viewport: vw,
    pageOverflowPx: pageOverflow,
    clippedRows,
    clippingElements,
    verdict: pageOverflow <= 0 && clippedRows.length === 0 ? "PASS" : "FAIL",
  };
}

setTimeout(() => {
  const report = measure();
  const el = document.getElementById("report");
  el.setAttribute("data-status", "done");
  el.textContent = "REPORT:" + JSON.stringify(report, null, 2);
}, 2500);
