// Standings mobile responsiveness harness — renders the REAL LeagueStandings
// (view StandingsTab) with edge-case fixture data and self-reports overflow
// measurements into #report. NOT part of the app; used only for verification.
//
// Contract (read by client/scripts/mobileRespCheck.mjs):
//   - render into #root
//   - after ~2500 ms write "REPORT:<json>" into <pre id="report"> and set
//     data-status="done"
//   - json must include: viewport, pageOverflowPx, clippedRows,
//     clippingElements, verdict ("PASS" | "FAIL")
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { LeagueStandings } from "./src/components/ui/LeagueStandings.jsx";

// ── Fixture data: cover edge cases ──────────────────────────────────────────
// Team names: longest realistic, with accents. Coach names: very long (initials
// on mobile), single-word (Pelé), and missing (AI teams -> no badge at all).
const teams = [
  // ── Divisão 1 ──
  {
    id: 1,
    name: "Associação Desportiva de São João da Madeira SAD",
    division: 1,
    coach_name: "Alexandre José de Sousa Fernandes da Costa",
    color_primary: "#00a859",
    points: 24,
    goals_for: 21,
    goals_against: 8,
    wins: 8,
    draws: 0,
    losses: 1,
  },
  {
    id: 2,
    name: "SL Benfica",
    division: 1,
    coach_name: "João Pedro Almeida",
    color_primary: "#e63946",
    points: 22,
    goals_for: 19,
    goals_against: 7,
    wins: 7,
    draws: 1,
    losses: 1,
  },
  {
    id: 3,
    name: "FC Porto",
    division: 1,
    coach_name: "Maria do Céu Ferreira Magalhães",
    color_primary: "#1c2b7d",
    points: 20,
    goals_for: 17,
    goals_against: 9,
    wins: 6,
    draws: 2,
    losses: 1,
  },
  {
    id: 4,
    name: "Sporting de Braga",
    division: 1,
    coach_name: "Pelé",
    color_primary: "#d69d0a",
    points: 18,
    goals_for: 15,
    goals_against: 10,
    wins: 5,
    draws: 3,
    losses: 1,
  },
  {
    id: 5,
    name: "Vitória SC",
    division: 1,
    coach_name: null,
    color_primary: "#8a8a8a",
    points: 16,
    goals_for: 13,
    goals_against: 11,
    wins: 5,
    draws: 1,
    losses: 3,
  },
  {
    id: 6,
    name: "Estrela da Amadora",
    division: 1,
    coach_name: null,
    color_primary: "#7a3b2e",
    points: 14,
    goals_for: 12,
    goals_against: 12,
    wins: 4,
    draws: 2,
    losses: 3,
  },
  {
    id: 7,
    name: "Rio Ave FC",
    division: 1,
    coach_name: null,
    color_primary: "#0057a8",
    points: 12,
    goals_for: 10,
    goals_against: 13,
    wins: 3,
    draws: 3,
    losses: 3,
  },
  {
    id: 8,
    name: "SC Farense",
    division: 1,
    coach_name: null,
    color_primary: "#1d1d1b",
    points: 10,
    goals_for: 9,
    goals_against: 14,
    wins: 3,
    draws: 1,
    losses: 5,
  },
  // ── Divisão 2 ──
  {
    id: 21,
    name: "CD Nacional",
    division: 2,
    coach_name: "Rui Miguel Soares Trindade",
    color_primary: "#233d7d",
    points: 19,
    goals_for: 16,
    goals_against: 6,
    wins: 6,
    draws: 1,
    losses: 2,
  },
  {
    id: 22,
    name: "Académico de Viseu FC",
    division: 2,
    coach_name: null,
    color_primary: "#e8b400",
    points: 17,
    goals_for: 14,
    goals_against: 9,
    wins: 5,
    draws: 2,
    losses: 2,
  },
  {
    id: 23,
    name: "União Desportiva de Leiria Futebol SAD",
    division: 2,
    coach_name: null,
    color_primary: "#d00027",
    points: 15,
    goals_for: 12,
    goals_against: 10,
    wins: 4,
    draws: 3,
    losses: 2,
  },
  // ── Divisão 3 (uma só equipa humana com coach de palavra única) ──
  {
    id: 31,
    name: "Académica de Coimbra",
    division: 3,
    coach_name: "Inês",
    color_primary: "#1d1d1b",
    points: 13,
    goals_for: 11,
    goals_against: 8,
    wins: 4,
    draws: 1,
    losses: 1,
  },
];

// Players de equipas humanas (a fonte de verdade para humanTeamIds).
const players = [
  { id: 1, name: "Jogador A", teamId: 1 },
  { id: 2, name: "Jogador B", teamId: 2 },
  { id: 3, name: "Jogador C", teamId: 3 },
  { id: 4, name: "Jogador D", teamId: 4 },
  { id: 5, name: "Jogador E", teamId: 21 },
  { id: 6, name: "Jogador F", teamId: 31 },
];

const teamForms = {
  1: "VVVDV",
  2: "VVEVD",
  3: "EVVDV",
  4: "DVVEE",
  5: "VDEVD",
  6: "EVDVD",
  7: "VDDVD",
  8: "VDVDV",
  21: "VVVED",
  22: "EVDVE",
  23: "VDEVV",
  31: "VEV",
};

const topScorers = [
  { id: 101, team_id: 1, color_primary: "#00a859", team_name: "Associação Desportiva de São João da Madeira SAD", name: "Rúben Gonçalves Pereira", goals: 12 },
  { id: 102, team_id: 2, color_primary: "#e63946", team_name: "SL Benfica", name: "Tiago Manuel da Silva Correia", goals: 10 },
  { id: 103, team_id: 3, color_primary: "#1c2b7d", team_name: "FC Porto", name: "Gonçalo Filipe Nunes Ribeiro", goals: 9 },
  { id: 104, team_id: 21, color_primary: "#233d7d", team_name: "CD Nacional", name: "André Filipe Martins Teixeira", goals: 7 },
  { id: 105, team_id: 22, color_primary: "#e8b400", team_name: "Académico de Viseu FC", name: "Bruno Alexandre Alves Portela", goals: 6 },
  { id: 106, team_id: 31, color_primary: "#1d1d1b", team_name: "Académica de Coimbra", name: "Nuno Miguel Rodrigues Campos", goals: 5 },
];

const allMatchResults = {
  1: [
    { homeTeamId: 1, awayTeamId: 2, homeGoals: 2, awayGoals: 1 },
    { homeTeamId: 3, awayTeamId: 4, homeGoals: 0, awayGoals: 0 },
    { homeTeamId: 5, awayTeamId: 6, homeGoals: 2, awayGoals: 1 },
    { homeTeamId: 7, awayTeamId: 8, homeGoals: 3, awayGoals: 1 },
    { homeTeamId: 21, awayTeamId: 22, homeGoals: 1, awayGoals: 0 },
    { homeTeamId: 23, awayTeamId: 21, homeGoals: 2, awayGoals: 2 },
  ],
  2: [
    { homeTeamId: 2, awayTeamId: 1, homeGoals: 1, awayGoals: 1 },
    { homeTeamId: 4, awayTeamId: 3, homeGoals: 2, awayGoals: 3 },
    { homeTeamId: 6, awayTeamId: 5, homeGoals: 0, awayGoals: 2 },
    { homeTeamId: 8, awayTeamId: 7, homeGoals: 1, awayGoals: 1 },
    { homeTeamId: 22, awayTeamId: 23, homeGoals: 1, awayGoals: 2 },
    { homeTeamId: 31, awayTeamId: 22, homeGoals: 2, awayGoals: 0 },
  ],
};

const prevStandings = teams.map((t) => ({
  id: t.id,
  name: t.name,
  division: t.division,
  points: t.points,
  goals_for: t.goals_for,
  goals_against: t.goals_against,
  wins: t.wins,
  draws: t.draws,
  losses: t.losses,
}));

const root = createRoot(document.getElementById("root"));
root.render(
  // Mimics the GameLayout mobile container: <main> > div.p-4 > tab content
  <div className="min-h-screen bg-surface">
    <div className="p-4 lg:p-6">
      <LeagueStandings
        teams={teams}
        teamForms={teamForms}
        topScorers={topScorers}
        myTeamId={2}
        completedJornada={2}
        matchweekCount={14}
        palmares={{
          allChampions: [
            { season: "2024/25", team_name: "SL Benfica", achievement: "Campeão Nacional" },
            { season: "2024/25", team_name: "CD Nacional", achievement: "Vencedor da Taça de Portugal" },
            { season: "2023/24", team_name: "FC Porto", achievement: "Campeão Nacional" },
          ],
        }}
        onTeamClick={() => {}}
        players={players}
        allMatchResults={allMatchResults}
        standingsStale={false}
        prevStandings={prevStandings}
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