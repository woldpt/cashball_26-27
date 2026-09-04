// CalendarioTab mobile responsiveness harness — renders the REAL CalendarioTab
// with edge-case fixture data and self-reports overflow measurements.
// NOT part of the app; used only for verification.
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { CalendarioTab } from "./src/views/CalendarioTab.jsx";

// ── Fixture: edge cases ────────────────────────────────────────────────────
// - 8 equipas na divisão do utilizador (nomes longos pt para testar truncate)
// - 6 jornadas jogadas (vítórias, derrota, empates) + Taça R1 perdida
//   → 4 linhas "Eliminado da Taça" (rounds 2-5) no timeline
// - calendarIndex 7 → Taça R2 "current" (eliminada), Liga MW7 é o próximo jogo
const teams = [
  { id: 1, name: "FC Porto de Leixões", division: 1, color_primary: "#e11d48", color_secondary: "#ffffff", stadium_name: "Estádio do Dragão Norte" },
  { id: 2, name: "SL Benfica de Lisboa", division: 1, color_primary: "#dc2626", color_secondary: "#fbbf24", stadium_name: "Estádio da Luz Sul" },
  { id: 3, name: "Sporting Clube de Portugal", division: 1, color_primary: "#16a34a", color_secondary: "#ffffff", stadium_name: "Estádio José Alvalade" },
  { id: 4, name: "SC Braga de Guimarães", division: 1, color_primary: "#7c3aed", color_secondary: "#ffffff", stadium_name: "Estádio Municipal 1º de Maio" },
  { id: 5, name: "Vitória de Guimarães FC", division: 1, color_primary: "#f59e0b", color_secondary: "#111827", stadium_name: "Estádio D. Afonso Henriques" },
  { id: 6, name: "Boavista Futebol Clube", division: 1, color_primary: "#0ea5e9", color_secondary: "#ffffff", stadium_name: "Estádio do Bessa Século XXI" },
  { id: 7, name: "FC Paços de Ferreira", division: 1, color_primary: "#475569", color_secondary: "#facc15", stadium_name: "Estádio Capital do Móvel" },
  { id: 8, name: "CD Nacional da Madeira", division: 1, color_primary: "#0f766e", color_secondary: "#fecaca", stadium_name: "Estádio da Chouvis" },
];

const me = { id: "coach-1", teamId: 1, name: "Treinador Teste" };

const calendarData = {
  calendarIndex: 7,
  year: 2026,
  leagueMatches: [
    { matchweek: 1, home_team_id: 1, away_team_id: 2, home_score: 2, away_score: 1 },
    { matchweek: 2, home_team_id: 4, away_team_id: 1, home_score: 0, away_score: 2 },
    { matchweek: 3, home_team_id: 1, away_team_id: 5, home_score: 1, away_score: 1 },
    { matchweek: 4, home_team_id: 6, away_team_id: 1, home_score: 2, away_score: 0 },
    { matchweek: 5, home_team_id: 1, away_team_id: 7, home_score: 3, away_score: 1 },
    { matchweek: 6, home_team_id: 8, away_team_id: 1, home_score: 2, away_score: 2 },
  ],
  cupMatches: [
    {
      round: 1,
      home_team_id: 2,
      away_team_id: 1,
      played: true,
      home_score: 2,
      away_score: 1,
      winner_team_id: 2,
      home_penalties: 0,
      away_penalties: 0,
    },
  ],
};

const root = createRoot(document.getElementById("root"));
root.render(
  // Mimics the GameLayout mobile container: <main> > div.p-4 > tab content
  <div className="min-h-screen bg-surface">
    <div className="p-4 lg:p-6">
      <CalendarioTab
        calendarData={calendarData}
        me={me}
        teams={teams}
        seasonYear={2026}
        calFilter="all"
        setCalFilter={() => {}}
        handleOpenTeamSquad={() => {}}
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
