// ClubTab mobile responsiveness harness — renders the REAL ClubTab
// with edge-case fixture data and self-reports overflow measurements.
// NOT part of the app; used only for verification.
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { ClubTab } from "./src/views/ClubTab.jsx";

// ── Fixture: edge cases ────────────────────────────────────────────────────
// - saldo negativo (DÉFICE, cores error) + dívida ativa
// - moral baixa (BAIXO) + nome de equipa longo
// - palmarés com títulos longos (wrap) + jornal em 2 épocas
const teamInfo = {
  id: 1,
  name: "FC Porto de Leixões",
  color_primary: "#e11d48",
  color_secondary: "#ffffff",
  division: 1,
  morale: 32,
  stadium_name: "Estádio do Dragão Norte",
  stadium_capacity: 15000,
};

const me = { id: "coach-1", teamId: 1, name: "Treinador Teste" };

const palmares = {
  trophies: [
    {
      achievement: "Campeão da Primeira Liga",
      season: "2024/25",
      coach_name: "João Silva Ferreira",
      is_human_coach: true,
    },
    { achievement: "Melhor Marcador", season: "2023/24" },
    { achievement: "Taça de Portugal", season: "2022/23" },
  ],
};

const clubNews = [
  {
    id: "n1",
    year: 2026,
    type: "transfer_in",
    title: "Contratado: Miguel Ângelo Sousa de Matos (extremo ofensivo)",
    related_team_name: "SL Benfica de Lisboa",
    amount: 450000,
  },
  {
    id: "n2",
    year: 2026,
    type: "transfer_out",
    title: "Venda: Rui Ferreira (defesa central)",
    related_team_name: "Sporting Clube de Portugal",
    amount: 320000,
  },
  { id: "n3", year: 2026, type: "prize", title: "Prémio de presença na Taça", matchweek: 4, amount: 75000 },
  { id: "n4", year: 2026, type: "weekly_income", title: "Rendimento semanal aplicado", matchweek: 6, amount: 180000 },
  {
    id: "n5",
    year: 2025,
    type: "transfer_in",
    title: "Contratado: André Vasconcelos (médio centro)",
    related_team_name: "SC Braga de Guimarães",
    amount: 280000,
  },
  { id: "n6", year: 2025, type: "prize", title: "Prémio de campeão", matchweek: 14, amount: 500000 },
];

const root = createRoot(document.getElementById("root"));
root.render(
  // Mimics the GameLayout mobile container: <main> > div.p-4 > tab content
  <div className="min-h-screen bg-surface">
    <div className="p-4 lg:p-6">
      <ClubTab
        teamInfo={teamInfo}
        seasonYear={2026}
        me={me}
        currentBudget={-125000}
        totalWeeklyWage={320000}
        loanAmount={450000}
        palmaresTeamId={1}
        palmares={palmares}
        clubNews={clubNews}
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
