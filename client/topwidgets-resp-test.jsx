// Topo mobile responsiveness harness — renderiza os blocos de topo (SummaryWidgets /
// heróis) das páginas TrainingPage, ClubTab, FinancesTab, StadiumTab e CalendarioTab
// com fixture data de edge cases, e auto-reporta overflow/clipping em #report.
// NOT part of o app; usado apenas para verificação.
//
// Contract (read by client/scripts/mobileRespCheck.mjs):
//   - render into #root
//   - after ~2500 ms write "REPORT:<json>" into <pre id="report"> and set
//     data-status="done"
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { TrainingPage } from "./src/components/ui/TrainingPage.jsx";
import { ClubTab } from "./src/views/ClubTab.jsx";
import { FinancesTab } from "./src/views/FinancesTab.jsx";
import { StadiumTab } from "./src/views/StadiumTab.jsx";
import { CalendarioTab } from "./src/views/CalendarioTab.jsx";

// Foco de treino pré-definido (TrainingPage lê do localStorage no init)
try {
  localStorage.setItem("cashball_training_focus", "Defesas");
} catch {}

const noop = () => {};

// ── Fixtures: nomes longos, valores extremos, estados negativos ─────────────
const me = { teamId: 1, name: "Alexandros Konstantinopoulos" };

const teams = [
  { id: 1, name: "FC Dragões do Norte", division: 1, color_primary: "#2d6a4f", color_secondary: "#ffffff", stadium_name: "Estádio das Aves Gigantes", stadium_capacity: 30000 },
  { id: 2, name: "SL Real Meridiano", division: 1, color_primary: "#7c2d92", color_secondary: "#ffd" , stadium_name: "Estádio do Meridiano", stadium_capacity: 15000 },
  { id: 3, name: "Os Maravilhosos de Vila Franca", division: 1, color_primary: "#b45309", color_secondary: "#fff", stadium_name: "Campo da Vila", stadium_capacity: 5000 },
  { id: 4, name: "UD Estrela do Mar", division: 1, color_primary: "#0e7490", color_secondary: "#fff", stadium_name: "Marquês do Sul", stadium_capacity: 15000 },
  { id: 5, name: "SC Falcões Dourados", division: 1, color_primary: "#b91c1c", color_secondary: "#ffd700", stadium_name: "Ninho de Aço", stadium_capacity: 50000 },
  { id: 6, name: "AD Trovão Azul", division: 1, color_primary: "#1d4ed8", color_secondary: "#fff", stadium_name: "Arena do Trovão", stadium_capacity: 30000 },
  { id: 7, name: "GD Serpentes Verdes", division: 1, color_primary: "#15803d", color_secondary: "#fff", stadium_name: "Covil Central", stadium_capacity: 5000 },
  { id: 8, name: "CF Muralha de Ferro", division: 1, color_primary: "#4b5563", color_secondary: "#fca5a5", stadium_name: "Fortaleza Norte", stadium_capacity: 15000 },
];

const teamInfo = {
  ...teams[0],
  morale: 75,
  division: 1,
};

const seasonYear = 2026;

// J1–J3 jogados (calendarIndex=4 → idx<4 done). Resultados do meu jogo por jornada.
const leagueMatches = [
  { matchweek: 1, home_team_id: 1, away_team_id: 8, home_score: 2, away_score: 1 },
  { matchweek: 2, home_team_id: 2, away_team_id: 1, home_score: 0, away_score: 3 },
  { matchweek: 3, home_team_id: 1, away_team_id: 3, home_score: 4, away_score: 4 },
];

const cupMatches = [
  { round: 1, home_team_id: 1, away_team_id: 5, played: true, winner_team_id: 1, home_score: 2, away_score: 0, home_penalties: 0, away_penalties: 0 },
];

const calendarData = {
  calendarIndex: 4,
  year: seasonYear,
  leagueMatches,
  cupMatches,
  fixtureSeeds: { 1: [1, 2, 3, 4, 5, 6, 7, 8] },
};

const ticketBreakdown = [
  { matchweek: 1, attendance: 18000, revenue: 270000 },
  { matchweek: 3, attendance: 24500, revenue: 367500 },
  { matchweek: 5, attendance: 9000, revenue: 135000 },
];

const financeData = {
  totalTicketRevenue: 772500,
  sponsorRevenue: 600000,
  totalTransferIncome: 900000,
  totalTransferExpenses: 450000,
  totalStadiumExpenses: 900000,
  homeMatchesPlayed: 3,
  ticketBreakdown,
  transferOutList: [
    { player_name: "João Alexandre Fernandes", related_team_name: "SL Real Meridiano", amount: 500000, matchweek: 3 },
    { player_name: "Kévin Dubois", related_team_name: "SC Falcões Dourados", amount: 400000, matchweek: 2 },
  ],
  transferInList: [
    { player_name: "Mateus Henrique da Silva Costa", related_team_name: "UD Estrela do Mar", amount: 450000, matchweek: 1 },
  ],
  balanceHistory: [
    { matchweek: 1, balance: 2800000 },
    { matchweek: 2, balance: 1900000 },
    { matchweek: 3, balance: -120000 },
  ],
};

const mySquad = [
  { name: "GR Silva", position: "GR" },
  { name: "DEF Costa", position: "DEF" },
];

const clubNews = [
  { id: 1, type: "transfer_in", title: "Compra de Mateus Henrique da Silva Costa (longo nome de teste)", related_team_name: "UD Estrela do Mar", amount: 450000, matchweek: 1, year: seasonYear },
  { id: 2, type: "transfer_out", title: "Venda de João Alexandre Fernandes", related_team_name: "SL Real Meridiano", amount: 500000, matchweek: 3, year: seasonYear },
  { id: 3, type: "weekly_income", title: "Rendimentos semanais de bilheteira e patrocinadores processados com sucesso", related_team_name: null, amount: 0, matchweek: 2, year: seasonYear },
];

const Section = ({ label, children }) => (
  <div className="border-b border-outline-variant/30">
    <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/50 mb-2">
      {label}
    </p>
    {children}
  </div>
);

const root = createRoot(document.getElementById("root"));
root.render(
  // Mimica o container mobile do GameLayout: <main> > div.p-4 > conteúdo do tab
  <div className="min-h-screen bg-surface">
    <div className="p-4 lg:p-6 space-y-8">
      <Section label="TrainingPage (topo)">
        <TrainingPage me={me} matchweek={5} />
      </Section>

      <Section label="ClubTab (topo)">
        <ClubTab
          teamInfo={teamInfo}
          seasonYear={seasonYear}
          me={me}
          currentBudget={-120000}
          totalWeeklyWage={480000}
          loanAmount={1500000}
          palmaresTeamId={1}
          palmares={{
            trophies: [
              { achievement: "Campeão Nacional", season: "2024/25", coach_name: null, is_human_coach: false },
              { achievement: "Melhor Marcador", season: "2023/24" },
            ],
          }}
          clubNews={clubNews}
        />
      </Section>

      <Section label="FinancesTab (topo)">
        <FinancesTab
          financeData={financeData}
          totalWeeklyWage={480000}
          completedJornada={3}
          loanInterestPerWeek={22500}
          loanAmount={1500000}
          currentBudget={-120000}
          seasonYear={seasonYear}
          capacityRevPerGame={450000}
          mySquad={mySquad}
          showTransferSales={false}
          setShowTransferSales={noop}
          showTransferPurchases={false}
          setShowTransferPurchases={noop}
          showTicketBreakdown={false}
          setShowTicketBreakdown={noop}
          setGameDialog={noop}
        />
      </Section>

      <Section label="StadiumTab (topo)">
        <StadiumTab
          teamInfo={teamInfo}
          currentBudget={-120000}
          capacityRevPerGame={450000}
          financeData={{ homeMatchesPlayed: 3, ticketBreakdown, totalStadiumExpenses: 900000 }}
          setGameDialog={noop}
        />
      </Section>

      <Section label="CalendarioTab (topo)">
        <CalendarioTab
          calendarData={calendarData}
          me={me}
          teams={teams}
          seasonYear={seasonYear}
          calFilter="all"
          setCalFilter={noop}
          handleOpenTeamSquad={noop}
        />
      </Section>
    </div>
  </div>,
);

function measure() {
  const vw = window.innerWidth;
  const doc = document.documentElement;
  const pageOverflow = doc.scrollWidth - vw;

  // Rows/cards com overflow-hidden (risco de clipping)
  const rows = [...document.querySelectorAll("div.flex.overflow-hidden")];
  const clippedRows = rows
    .filter((el) => el.scrollWidth > el.clientWidth + 1)
    .map((el) => ({
      name: el.querySelector("p.uppercase")?.textContent || el.className.toString().slice(0, 60),
      scrollW: el.scrollWidth,
      clientW: el.clientWidth,
    }));

  // Elementos overflow-hidden/auto a cortar conteúdo (top 10 por excesso)
  const all = [...document.querySelectorAll("*")].filter((el) => {
    const ov = getComputedStyle(el).overflowX;
    return (ov === "hidden" || ov === "auto") && el.scrollWidth > el.clientWidth + 1;
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
