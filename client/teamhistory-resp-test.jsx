// TeamHistoryView mobile responsiveness harness — renders the REAL
// TeamHistoryView with edge-case fixture data and self-reports overflow
// measurements. NOT part of the app; used only for verification.
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { TeamHistoryView } from "./src/views/TeamHistoryView.jsx";

// ── Fixture: edge cases ────────────────────────────────────────────────────
// - Nome de clube longo + sem emblema (monograma) para testar truncate
// - 3 épocas (1º com troféu, 3º, 8º) para testar destaque da melhor
// - Jogos dos 3 tipos: goleada, empate, derrota, taça com penáltis,
//   amigável, adversários com nomes longos
// - Todos os 6 tipos de evento + prémio com valor alto
const selectedTeam = {
  id: 1,
  name: "Sporting Clube de Portugal Oriental",
  division: 1,
  crest: null,
  color_primary: "#16a34a",
  color_secondary: "#ffffff",
};

const clubHistory = {
  seasonRecords: [
    { year: 2026, season: 3, position: 1, wins: 11, draws: 2, losses: 1, goalsFor: 34, goalsAgainst: 9, points: 35 },
    { year: 2025, season: 2, position: 3, wins: 8, draws: 3, losses: 3, goalsFor: 27, goalsAgainst: 15, points: 27 },
    { year: 2024, season: 1, position: 8, wins: 3, draws: 4, losses: 7, goalsFor: 12, goalsAgainst: 24, points: 13 },
  ],
  games: [
    { kind: "league", season: 3, year: 2026, matchweek: 14, round: null, roundName: null, homeTeamId: 1, awayTeamId: 2, homeName: "Sporting Clube de Portugal Oriental", awayName: "Vitória de Guimarães Futebol Clube", homeScore: 5, awayScore: 0, homePenalties: 0, awayPenalties: 0, winnerTeamId: null },
    { kind: "league", season: 3, year: 2026, matchweek: 13, round: null, roundName: null, homeTeamId: 3, awayTeamId: 1, homeName: "Futebol Clube do Porto de Leixões", awayName: "Sporting Clube de Portugal Oriental", homeScore: 2, awayScore: 2, homePenalties: 0, awayPenalties: 0, winnerTeamId: null },
    { kind: "cup", season: 3, year: 2026, matchweek: null, round: 4, roundName: "Meias-finais", homeTeamId: 4, awayTeamId: 1, homeName: "Sport Lisboa e Benfica de Lisboa", awayName: "Sporting Clube de Portugal Oriental", homeScore: 1, awayScore: 1, homePenalties: 3, awayPenalties: 5, winnerTeamId: 1 },
    { kind: "cup", season: 2, year: 2025, matchweek: null, round: 2, roundName: "Oitavos de final", homeTeamId: 1, awayTeamId: 5, homeName: "Sporting Clube de Portugal Oriental", awayName: "Boavista Futebol Clube do Bessa", homeScore: 0, awayScore: 2, homePenalties: 0, awayPenalties: 0, winnerTeamId: 5 },
    { kind: "friendly", season: 3, year: 2026, matchweek: null, round: 0, roundName: "Amigável de pré-época", homeTeamId: 1, awayTeamId: 6, homeName: "Sporting Clube de Portugal Oriental", awayName: "Clube Desportivo Nacional da Madeira", homeScore: 3, awayScore: 3, homePenalties: 0, awayPenalties: 0, winnerTeamId: null },
  ],
  trophies: [
    { season: 2026, achievement: "Campeão Nacional", coach_name: "Rúben Amorim da Silva Santos", is_human_coach: 1 },
    { season: 2026, achievement: "Vencedor da Taça de Portugal", coach_name: "Rúben Amorim da Silva Santos", is_human_coach: 1 },
    { season: 2025, achievement: "Melhor Marcador (31 golos)", coach_name: "Viktor Gyökeres Johansson", is_human_coach: 1 },
  ],
  events: [
    { id: 1, type: "transfer_in", title: "Contratação de extremo internacional", player_name: "Francisco Conceição Rodrigues", related_team_name: "Futebol Clube do Porto", amount: 25000000, matchweek: 3, year: 2026 },
    { id: 2, type: "transfer_out", title: "Venda ao estrangeiro", player_name: "Ousmane Diomande Tiago", related_team_name: "Manchester City", amount: 60000000, matchweek: 2, year: 2026 },
    { id: 3, type: "auction_won", title: "Leilão ganho", player_name: "João Neves Pereira", related_team_name: null, amount: 18000000, matchweek: 5, year: 2025 },
    { id: 4, type: "prize", title: "Prémio de Campeão Nacional", player_name: null, related_team_name: null, amount: 2000000, matchweek: 1, year: 2026 },
    { id: 5, type: "manager_hired", title: "Novo treinador", player_name: null, related_team_name: "Rúben Amorim da Silva Santos", amount: 0, matchweek: 1, year: 2024 },
    { id: 6, type: "manager_dismissed", title: "Despedimento de treinador", player_name: null, related_team_name: "António Oliveira de Sousa", amount: 0, matchweek: 10, year: 2024 },
  ],
};

const root = createRoot(document.getElementById("root"));
root.render(
  // Mimics the GameLayout mobile container: <main> > div.p-4 > tab content
  <div className="min-h-screen bg-surface">
    <div className="p-4 lg:p-6">
      <TeamHistoryView
        selectedTeam={selectedTeam}
        clubHistory={clubHistory}
        clubHistoryTeamId={1}
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
