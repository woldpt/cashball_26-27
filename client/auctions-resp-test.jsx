// AuctionsPage mobile responsiveness harness — renders the REAL AuctionsPage
// (full-bleed, single scroll) with edge-case fixture data and self-reports
// overflow measurements into #report.
// NOT part of the app; used only for verification.
//
// Contract (read by client/scripts/mobileRespCheck.mjs):
//   - render into #root
//   - after ~2500 ms write "REPORT:<json>" into <pre id="report"> and set
//     data-status="done"
//   - json must include: viewport, pageOverflowPx, clippedRows,
//     clippingElements, verdict ("PASS" | "FAIL")
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { AuctionsPage } from "./src/pages/AuctionsPage.jsx";

// ── Fixture data: cover edge cases ──────────────────────────────────────────
// Todos os estados do AuctionCard (aberto com liderança/venda/pausa/urgente,
// encerrado vendido/sem lances, estrela, suspenso, lesionado), nomes e valores
// extremos, orçamento de 9 dígitos (testa o truncate do widget "Caixa").
const me = { teamId: 5 };

const teams = [
  { id: 1, name: "Dragões de Oliveira do Hospital", color_primary: "#f97316" },
  { id: 2, name: "Fúria de Vila Nova de Santo André", color_primary: "#3b82f6" },
  { id: 3, name: "Águias de São Pedro do Sul", color_primary: "#10b981" },
  { id: 4, name: "Leões do Castelo de Paiva", color_primary: "#eab308" },
  { id: 5, name: "Tubarões da Praia de Mira", color_primary: "#ef4444" },
  { id: 6, name: "Corvos de Albergaria-a-Velha", color_primary: "#8b5cf6" },
  { id: 7, name: "Lobos da Serra da Estrela", color_primary: "#14b8a6" },
  { id: 8, name: "Panteras de Pombal", color_primary: "#ec4899" },
];

const teamInfo = { budget: 987654321 }; // "987 654 321 €" — caixa no limite

const now = Date.now();

const auctions = [
  // Abertos — todos os estados
  { playerId: 101, position: "GR", name: "Alexandre Konstantinopoulos Martinez", nationality: "PT", team_name: "Dragões de Oliveira do Hospital", isExClub: true, skill: 74, is_star: false, endsAt: now + 10_000, closed: false, paused: false, currentHighBidTeamId: 5, currentHighBid: 1250000, startingPrice: 800000, wage: 65000, form: 44, games_played: 38, goals: 0, aggressiveness: 3, suspension_until_matchweek: 0, injury_until_matchweek: 0 },
  { playerId: 102, position: "DEF", name: "Zé", nationality: "BR", team_name: "Sem clube", isExClub: false, is_star: true, skill: 88, endsAt: now + 3_600_000, closed: false, paused: false, currentHighBidTeamId: 2, currentHighBid: 9800000, startingPrice: 5000000, wage: 210000, form: 18, games_played: 12, goals: 2, aggressiveness: 5, suspension_until_matchweek: 15, injury_until_matchweek: 0 },
  { playerId: 103, position: "MED", name: "João Maria da Conceição Fonseca", nationality: "PT", team_name: "Fúria de Vila Nova de Santo André", isExClub: false, is_star: true, skill: 99, endsAt: now + 360_000, closed: false, paused: false, currentHighBidTeamId: 1, currentHighBid: 15400000, startingPrice: 12000000, wage: 340000, form: 41, games_played: 30, goals: 9, aggressiveness: 4, suspension_until_matchweek: 0, injury_until_matchweek: 14 },
  { playerId: 104, position: "ATA", name: "Lukas van der Bergen", nationality: "NL", team_name: "Sem clube", isExClub: false, is_star: false, skill: 82, endsAt: now + 5_400_000, closed: false, paused: false, currentHighBidTeamId: null, currentHighBid: 0, startingPrice: 2500000, wage: 95000, form: 30, games_played: 25, goals: 14, aggressiveness: 2, suspension_until_matchweek: 0, injury_until_matchweek: 0 },
  { playerId: 105, position: "DEF", name: "António Francisco de Assis", nationality: "PT", team_name: "Tubarões da Praia de Mira", isExClub: false, is_star: false, skill: 77, endsAt: now + 60_000, closed: false, paused: false, currentHighBidTeamId: 3, currentHighBid: 3100000, startingPrice: 3000000, wage: 120000, form: 25, games_played: 22, goals: 1, aggressiveness: 5, suspension_until_matchweek: 0, injury_until_matchweek: 0 },
  { playerId: 106, position: "MED", name: "Rúben Miguel Soares Peixoto", nationality: "PT", team_name: "Sem clube", isExClub: false, is_star: false, skill: 69, endsAt: now + 86_400_000, closed: false, paused: true, currentHighBidTeamId: null, currentHighBid: 0, startingPrice: 600000, wage: 30000, form: 33, games_played: 5, goals: 0, aggressiveness: null, suspension_until_matchweek: 0, injury_until_matchweek: 0 },
  { playerId: 107, position: "GR", name: "Diogo Filipe Costa Neves", nationality: "PT", team_name: "Lobos da Serra da Estrela", isExClub: false, is_star: false, skill: 85, endsAt: now + 9_500, closed: false, paused: false, currentHighBidTeamId: 4, currentHighBid: 4200000, startingPrice: 4000000, wage: 150000, form: 45, games_played: 33, goals: 0, aggressiveness: 3, suspension_until_matchweek: 0, injury_until_matchweek: 0 },
  { playerId: 108, position: "ATA", name: "Nuno Miguel Tavares de Sousa Ribeiro", nationality: "PT", team_name: "Panteras de Pombal", isExClub: false, is_star: true, skill: 91, endsAt: now + 7_200_000, closed: false, paused: false, currentHighBidTeamId: 5, currentHighBid: 21800000, startingPrice: 20000000, wage: 450000, form: 40, games_played: 35, goals: 27, aggressiveness: 4, suspension_until_matchweek: 0, injury_until_matchweek: 0 },
  { playerId: 109, position: "DEF", name: "Guilherme Alexandre Barbosa Chaves", nationality: "PT", team_name: "Sem clube", isExClub: false, is_star: false, skill: 73, endsAt: now + 30_000, closed: false, paused: false, currentHighBidTeamId: null, currentHighBid: 0, startingPrice: 900000, wage: 40000, form: 19, games_played: 9, goals: 0, aggressiveness: 5, suspension_until_matchweek: 0, injury_until_matchweek: 0 },
  // Encerrados — vendido e sem lances
  { playerId: 201, position: "GR", name: "Custódio Manuel Vaz Pimentel", nationality: "PT", team_name: "Sem clube", isExClub: false, skill: 78, is_star: false, endsAt: null, closed: true, paused: false, currentHighBidTeamId: 6, currentHighBid: 1700000, startingPrice: 1500000, wage: 70000, form: 26, games_played: 20, goals: 0, aggressiveness: 3, suspension_until_matchweek: 0, injury_until_matchweek: 0, result: { sold: true, buyerTeamName: "Corvos de Albergaria-a-Velha", finalBid: 1700000 } },
  { playerId: 202, position: "MED", name: "Bernardo Xavier de Andrade Freitas", nationality: "BR", team_name: "Sem clube", isExClub: false, skill: 71, is_star: true, endsAt: null, closed: true, paused: false, currentHighBidTeamId: null, currentHighBid: 0, startingPrice: 450000, wage: 25000, form: 22, games_played: 4, goals: 0, aggressiveness: null, suspension_until_matchweek: 0, injury_until_matchweek: 0, result: { sold: false, finalBid: 0 } },
  { playerId: 203, position: "ATA", name: "Hélder Gaspar Cunha Bernardes", nationality: "PT", team_name: "Sem clube", isExClub: false, skill: 87, is_star: true, endsAt: null, closed: true, paused: false, currentHighBidTeamId: 2, currentHighBid: 12500000, startingPrice: 9000000, wage: 280000, form: 37, games_played: 28, goals: 19, aggressiveness: 4, suspension_until_matchweek: 0, injury_until_matchweek: 0, result: { sold: true, buyerTeamName: "Fúria de Vila Nova de Santo André", finalBid: 12500000 } },
];

const root = createRoot(document.getElementById("root"));
root.render(
  // Mimics o shell real (GameLayout): raiz com altura fixa + wrapper
  // full-bleed com overflow-hidden; a AuctionsPage gere o próprio scroll.
  <div className="h-dvh bg-surface text-on-surface font-body tracking-tight flex flex-col">
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <AuctionsPage
        activeAuctions={auctions}
        me={me}
        teams={teams}
        teamInfo={teamInfo}
        matchweekCount={10}
        socket={{ emit: () => {} }}
      />
    </div>
  </div>,
);

function measure() {
  const vw = window.innerWidth;
  const doc = document.documentElement;
  const pageOverflow = doc.scrollWidth - vw;

  // Rows/cards com overflow-hidden (risco de conteúdo cortado)
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

  // Elementos hidden/auto a cortar conteúdo (top 10 por excesso)
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