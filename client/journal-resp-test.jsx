// JournalTab mobile responsiveness harness — renders the REAL JournalTab with
// edge-case fixture data and self-reports overflow measurements into #report.
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
import { JournalTab } from "./src/views/JournalTab.jsx";

// ── Fixture data: edge cases ────────────────────────────────────────────────
// Longest realistic names, extreme values, todas as tipologias de notícia
// (club_news + transfer_history), MOMs presentes/ausentes, liga + taça.
const teams = [
  {
    id: 1,
    name: "Real Desportivo Atlético de Santa Maria da Feira",
    color_primary: "#1d4ed8",
    color_secondary: "#ffffff",
    crest: null,
    division: 1,
  },
  {
    id: 2,
    name: "Sporting Clube do Alentejo Central",
    color_primary: "#b91c1c",
    color_secondary: "#fde68a",
    crest: null,
    division: 1,
  },
  {
    id: 3,
    name: "União Recreacionista de Vila Nova de Milharadas",
    color_primary: "#047857",
    color_secondary: "#e5e7eb",
    crest: null,
    division: 2,
  },
  {
    id: 4,
    name: "F.C. Atlântico Norte",
    color_primary: "#7c3aed",
    color_secondary: "#f1f5f9",
    crest: null,
    division: 3,
  },
];

const news = [
  // Transferências (source 'transfer', todas as origens)
  {
    id: 1,
    source: "transfer",
    type: "market",
    title:
      "Joaquim Fernando Alves da Silva Camara Pereira · Real Desportivo Atlético de Santa Maria da Feira → Sporting Clube do Alentejo Central",
    description: "Avançado",
    player_id: 101,
    player_name: "Joaquim Fernando Alves da Silva Camara Pereira",
    related_team_id: 2,
    related_team_name: "Sporting Clube do Alentejo Central",
    amount: 4850000,
    matchweek: 12,
    year: 2026,
    created_at: "2026-03-01 10:00:00",
    team_name: "Sporting Clube do Alentejo Central",
    division: 1,
  },
  {
    id: 2,
    source: "transfer",
    type: "auction",
    title:
      "Miguel António Tavares Rocha · União Recreacionista de Vila Nova de Milharadas → F.C. Atlântico Norte",
    description: "Médio",
    player_id: 202,
    player_name: "Miguel António Tavares Rocha",
    related_team_id: 4,
    related_team_name: "F.C. Atlântico Norte",
    amount: 2150000,
    matchweek: 11,
    year: 2026,
    created_at: "2026-02-22 09:30:00",
    team_name: "F.C. Atlântico Norte",
    division: 3,
  },
  {
    id: 3,
    source: "transfer",
    type: "clause",
    title: "Bruno Cardoso · Sporting Clube do Alentejo Central → F.C. Atlântico Norte",
    description: "Defesa",
    player_id: 303,
    player_name: "Bruno Cardoso",
    related_team_id: 4,
    related_team_name: "F.C. Atlântico Norte",
    amount: 750000,
    matchweek: 9,
    year: 2026,
    created_at: "2026-02-08 18:12:00",
    team_name: "F.C. Atlântico Norte",
    division: 3,
  },
  // club_news (todas as tipologias)
  {
    id: 4,
    source: "club",
    type: "wages",
    title: "Pagamento de salários (época 2026)",
    description: "Total da folha salarial da jornada",
    player_id: null,
    player_name: null,
    related_team_id: null,
    related_team_name: null,
    amount: 1285000,
    matchweek: 12,
    year: 2026,
    created_at: "2026-03-01 08:00:00",
    team_name: "Real Desportivo Atlético de Santa Maria da Feira",
    division: 1,
  },
  {
    id: 5,
    source: "club",
    type: "prize",
    title: "Prémio de vencedor da Taça de Portugal (época 2025)",
    description: "Vencedor da Taça de Portugal",
    player_id: null,
    player_name: null,
    related_team_id: null,
    related_team_name: null,
    amount: 500000,
    matchweek: 1,
    year: 2026,
    created_at: "2026-01-10 21:00:00",
    team_name: "Sporting Clube do Alentejo Central",
    division: 1,
  },
  {
    id: 6,
    source: "club",
    type: "ticket_revenue",
    title: "Receita de bilheteira — jornada 11",
    description: "Afluência total",
    player_id: null,
    player_name: null,
    related_team_id: null,
    related_team_name: null,
    amount: 964000,
    matchweek: 11,
    year: 2026,
    created_at: "2026-02-22 20:45:00",
    team_name: "União Recreacionista de Vila Nova de Milharadas",
    division: 2,
  },
  {
    id: 7,
    source: "club",
    type: "loan_take",
    title: "Nova linha de crédito — 8% ao ano, 240 semanas",
    description: "Capital inicial",
    player_id: null,
    player_name: null,
    related_team_id: null,
    related_team_name: null,
    amount: 3000000,
    matchweek: 7,
    year: 2026,
    created_at: "2026-01-28 14:20:00",
    team_name: "F.C. Atlântico Norte",
    division: 3,
  },
  {
    id: 8,
    source: "club",
    type: "renegotiation",
    title: "Renegociou contratos (época 2026)",
    description: "Redução da massa salarial",
    player_id: null,
    player_name: null,
    related_team_id: null,
    related_team_name: null,
    amount: -150000,
    matchweek: 5,
    year: 2026,
    created_at: "2026-01-18 11:05:00",
    team_name: "Real Desportivo Atlético de Santa Maria da Feira",
    division: 1,
  },
  {
    id: 9,
    source: "club",
    type: "cost_cut",
    title: "Corte de custos do clube (época 2026)",
    description: "Ajuste estrutural",
    player_id: null,
    player_name: null,
    related_team_id: null,
    related_team_name: null,
    amount: -220000,
    matchweek: 3,
    year: 2026,
    created_at: "2026-01-12 09:00:00",
    team_name: "União Recreacionista de Vila Nova de Milharadas",
    division: 2,
  },
  // Pré-época (matchweek 0)
  {
    id: 10,
    source: "club",
    type: "weekly_income",
    title: "Renda semanal do estádio (pré-época)",
    description: "Sócio-adepto",
    player_id: null,
    player_name: null,
    related_team_id: null,
    related_team_name: null,
    amount: 45000,
    matchweek: 0,
    year: 2026,
    created_at: "2026-01-01 12:00:00",
    team_name: "F.C. Atlântico Norte",
    division: 3,
  },
];

const results = [
  // Liga — jornadas recentes
  {
    competition: "League",
    matchweek: 12,
    round: null,
    homeTeamId: 1,
    awayTeamId: 2,
    homeName: "Real Desportivo Atlético de Santa Maria da Feira",
    awayName: "Sporting Clube do Alentejo Central",
    homeDivision: 1,
    awayDivision: 1,
    homeScore: 3,
    awayScore: 1,
    momHome: {
      playerId: 11,
      playerName: "Rui Figueiredo",
      score: 58,
    },
    momAway: {
      playerId: 22,
      playerName: "Túlio Vasconcelos",
      score: 30,
    },
  },
  {
    competition: "League",
    matchweek: 12,
    round: null,
    homeTeamId: 3,
    awayTeamId: 4,
    homeName: "União Recreacionista de Vila Nova de Milharadas",
    awayName: "F.C. Atlântico Norte",
    homeDivision: 2,
    awayDivision: 3,
    homeScore: 0,
    awayScore: 0,
    momHome: null,
    momAway: null,
  },
  {
    competition: "League",
    matchweek: 11,
    round: null,
    homeTeamId: 2,
    awayTeamId: 3,
    homeName: "Sporting Clube do Alentejo Central",
    awayName: "União Recreacionista de Vila Nova de Milharadas",
    homeDivision: 1,
    awayDivision: 2,
    homeScore: 2,
    awayScore: 4,
    momHome: null,
    momAway: {
      playerId: 33,
      playerName: "Abel Moniz Barreto",
      score: 41,
    },
  },
  // Taça — rondas
  {
    competition: "Cup",
    matchweek: null,
    round: 4,
    homeTeamId: 1,
    awayTeamId: 4,
    homeName: "Real Desportivo Atlético de Santa Maria da Feira",
    awayName: "F.C. Atlântico Norte",
    homeDivision: 1,
    awayDivision: 3,
    homeScore: 2,
    awayScore: 1,
    momHome: {
      playerId: 15,
      playerName: "Sérgio Andrade",
      score: 38,
    },
    momAway: {
      playerId: 44,
      playerName: "Pedro Lameira",
      score: 13,
    },
  },
  {
    competition: "Cup",
    matchweek: null,
    round: 3,
    homeTeamId: 2,
    awayTeamId: 3,
    homeName: "Sporting Clube do Alentejo Central",
    awayName: "União Recreacionista de Vila Nova de Milharadas",
    homeDivision: 1,
    awayDivision: 2,
    homeScore: 1,
    awayScore: 0,
    momHome: null,
    momAway: null,
  },
];

const root = createRoot(document.getElementById("root"));
root.render(
  // Mimics the GameLayout mobile container: <main> > div.p-4 > tab content
  <div className="min-h-screen bg-surface">
    <div className="p-4 lg:p-6">
      <JournalTab
        globalNews={{ news, results }}
        teams={teams}
        me={{ teamId: 1 }}
        seasonYear={2026}
        onOpenPlayerHistory={() => {}}
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
