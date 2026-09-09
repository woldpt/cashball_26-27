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
// (club_news + transfer_history), MOMs presentes/ausentes, liga + taça,
// classificação com corte (⋮), artilheiros, humanos noutra divisão,
// assistências e mood de adeptos.
const teams = [
  {
    id: 1,
    name: "Real Desportivo Atlético de Santa Maria da Feira",
    color_primary: "#1d4ed8",
    color_secondary: "#ffffff",
    crest: null,
    division: 1,
    points: 22,
    wins: 7,
    draws: 1,
    losses: 4,
    goals_for: 24,
    goals_against: 15,
    fans_mood: 82,
    ticket_price: 20,
    stadium_capacity: 25000,
    coach_is_human: 1,
    coach_name: "Treinador Principal Joaquim Fernando Alves",
  },
  {
    id: 2,
    name: "Sporting Clube do Alentejo Central",
    color_primary: "#b91c1c",
    color_secondary: "#fde68a",
    crest: null,
    division: 1,
    points: 25,
    wins: 8,
    draws: 1,
    losses: 3,
    goals_for: 26,
    goals_against: 14,
    fans_mood: 64,
    ticket_price: 15,
    stadium_capacity: 30000,
    coach_is_human: 0,
    coach_name: null,
  },
  {
    id: 3,
    name: "União Recreacionista de Vila Nova de Milharadas",
    color_primary: "#047857",
    color_secondary: "#e5e7eb",
    crest: null,
    division: 2,
    points: 18,
    wins: 5,
    draws: 3,
    losses: 4,
    goals_for: 17,
    goals_against: 16,
    fans_mood: 41,
    ticket_price: 10,
    stadium_capacity: 12000,
    coach_is_human: 1,
    coach_name: "Mister da Segunda Divisão Com Nome Longo",
  },
  {
    id: 4,
    name: "F.C. Atlântico Norte",
    color_primary: "#7c3aed",
    color_secondary: "#f1f5f9",
    crest: null,
    division: 3,
    points: 9,
    wins: 2,
    draws: 3,
    losses: 7,
    goals_for: 8,
    goals_against: 21,
    fans_mood: 12,
    ticket_price: 25,
    stadium_capacity: 8000,
    coach_is_human: 0,
    coach_name: null,
  },
  {
    id: 5,
    name: "Clube Desportivo do Litoral",
    color_primary: "#0ea5e9",
    color_secondary: "#0f172a",
    crest: null,
    division: 1,
    points: 30,
    wins: 10,
    draws: 0,
    losses: 2,
    goals_for: 31,
    goals_against: 9,
    fans_mood: 95,
    ticket_price: 30,
    stadium_capacity: 40000,
    coach_is_human: 0,
    coach_name: null,
  },
  {
    id: 6,
    name: "Grupo Desportivo da Serra",
    color_primary: "#65a30d",
    color_secondary: "#fefce8",
    crest: null,
    division: 1,
    points: 20,
    wins: 6,
    draws: 2,
    losses: 4,
    goals_for: 19,
    goals_against: 15,
    fans_mood: 58,
    ticket_price: 15,
    stadium_capacity: 15000,
    coach_is_human: 0,
    coach_name: null,
  },
  {
    id: 7,
    name: "Atlético do Vale",
    color_primary: "#ea580c",
    color_secondary: "#fff7ed",
    crest: null,
    division: 1,
    points: 10,
    wins: 3,
    draws: 1,
    losses: 8,
    goals_for: 11,
    goals_against: 24,
    fans_mood: 28,
    ticket_price: 10,
    stadium_capacity: 10000,
    coach_is_human: 0,
    coach_name: null,
  },
  {
    id: 8,
    name: "Sport União do Interior",
    color_primary: "#475569",
    color_secondary: "#f8fafc",
    crest: null,
    division: 1,
    points: 5,
    wins: 1,
    draws: 2,
    losses: 9,
    goals_for: 6,
    goals_against: 28,
    fans_mood: 8,
    ticket_price: 10,
    stadium_capacity: 9000,
    coach_is_human: 0,
    coach_name: null,
  },
  {
    id: 9,
    name: "Futebol Clube da Planície",
    color_primary: "#0891b2",
    color_secondary: "#ecfeff",
    crest: null,
    division: 1,
    points: 18,
    wins: 5,
    draws: 3,
    losses: 4,
    goals_for: 16,
    goals_against: 14,
    fans_mood: 55,
    ticket_price: 15,
    stadium_capacity: 14000,
    coach_is_human: 0,
    coach_name: null,
  },
  {
    id: 10,
    name: "Associação do Farol",
    color_primary: "#be123c",
    color_secondary: "#fff1f2",
    crest: null,
    division: 1,
    points: 2,
    wins: 0,
    draws: 2,
    losses: 10,
    goals_for: 4,
    goals_against: 33,
    fans_mood: 5,
    ticket_price: 10,
    stadium_capacity: 7000,
    coach_is_human: 0,
    coach_name: null,
  },
  {
    id: 12,
    name: "Clube Oriental da Segunda Com Nome Bastante Comprido",
    color_primary: "#4d7c0f",
    color_secondary: "#f7fee7",
    crest: null,
    division: 2,
    points: 15,
    wins: 4,
    draws: 3,
    losses: 5,
    goals_for: 14,
    goals_against: 17,
    fans_mood: 50,
    ticket_price: 15,
    stadium_capacity: 11000,
    coach_is_human: 0,
    coach_name: null,
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
  {
    id: 11,
    source: "transfer",
    type: "npc",
    title: "Vítor Baía dos Santos · Atlético do Vale → Clube Desportivo do Litoral",
    description: "Guarda-redes",
    player_id: 404,
    player_name: "Vítor Baía dos Santos",
    related_team_id: 5,
    related_team_name: "Clube Desportivo do Litoral",
    amount: 1200000,
    matchweek: 10,
    year: 2026,
    created_at: "2026-02-15 12:00:00",
    team_name: "Clube Desportivo do Litoral",
    division: 1,
  },
  {
    id: 12,
    source: "transfer",
    type: "market",
    title: "Tomás Leal · Sport União do Interior → Grupo Desportivo da Serra",
    description: "Médio",
    player_id: 505,
    player_name: "Tomás Leal",
    related_team_id: 6,
    related_team_name: "Grupo Desportivo da Serra",
    amount: 90000,
    matchweek: 8,
    year: 2026,
    created_at: "2026-02-01 12:00:00",
    team_name: "Grupo Desportivo da Serra",
    division: 1,
  },
  // club_news (tipologias financeiras)
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
];

const results = [
  // Liga — jornada 12 (a anterior)
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
    attendance: 22840,
    homeCapacity: 25000,
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
    homeTeamId: 5,
    awayTeamId: 6,
    homeName: "Clube Desportivo do Litoral",
    awayName: "Grupo Desportivo da Serra",
    homeDivision: 1,
    awayDivision: 1,
    homeScore: 4,
    awayScore: 0,
    attendance: 38512,
    homeCapacity: 40000,
    momHome: {
      playerId: 55,
      playerName: "Abel Moniz Barreto de Vasconcelos e Sá",
      score: 71,
    },
    momAway: null,
  },
  {
    competition: "League",
    matchweek: 12,
    round: null,
    homeTeamId: 7,
    awayTeamId: 9,
    homeName: "Atlético do Vale",
    awayName: "Futebol Clube da Planície",
    homeDivision: 1,
    awayDivision: 1,
    homeScore: 1,
    awayScore: 1,
    attendance: 3210,
    homeCapacity: 10000,
    momHome: null,
    momAway: null,
  },
  {
    competition: "League",
    matchweek: 12,
    round: null,
    homeTeamId: 3,
    awayTeamId: 12,
    homeName: "União Recreacionista de Vila Nova de Milharadas",
    awayName: "Clube Oriental da Segunda Com Nome Bastante Comprido",
    homeDivision: 2,
    awayDivision: 2,
    homeScore: 2,
    awayScore: 1,
    attendance: 9876,
    homeCapacity: 12000,
    momHome: null,
    momAway: null,
  },
  // Liga — jornada 11 (não deve aparecer em nenhum quadro)
  {
    competition: "League",
    matchweek: 11,
    round: null,
    homeTeamId: 2,
    awayTeamId: 5,
    homeName: "Sporting Clube do Alentejo Central",
    awayName: "Clube Desportivo do Litoral",
    homeDivision: 1,
    awayDivision: 1,
    homeScore: 2,
    awayScore: 4,
    attendance: 27000,
    homeCapacity: 30000,
    momHome: null,
    momAway: {
      playerId: 33,
      playerName: "Abel Moniz Barreto",
      score: 41,
    },
  },
  // Taça
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
    attendance: 24110,
    homeCapacity: 25000,
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
];

const topScorers = [
  { id: 901, name: "Abel Moniz Barreto de Vasconcelos e Sá", position: "ATA", goals: 14, team_id: 5, team_name: "Clube Desportivo do Litoral" },
  { id: 902, name: "Rui Figueiredo", position: "ATA", goals: 11, team_id: 1, team_name: "Real Desportivo Atlético de Santa Maria da Feira" },
  { id: 903, name: "Túlio Vasconcelos", position: "MED", goals: 9, team_id: 2, team_name: "Sporting Clube do Alentejo Central" },
  { id: 904, name: "Sérgio Andrade", position: "ATA", goals: 9, team_id: 1, team_name: "Real Desportivo Atlético de Santa Maria da Feira" },
  { id: 905, name: "Pedro Lameira", position: "DEF", goals: 4, team_id: 4, team_name: "F.C. Atlântico Norte" },
  { id: 906, name: "Bruno Cardoso", position: "DEF", goals: 1, team_id: 4, team_name: "F.C. Atlântico Norte" },
];

const teamForms = {
  1: "VVEVD",
  2: "DVVVE",
  3: "EDEV",
  5: "VVVVV",
  6: "DDEEV",
  7: "DDDED",
};

const players = [{ teamId: 3, name: "Mister da Segunda" }];

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
        topScorers={topScorers}
        teamForms={teamForms}
        players={players}
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
      excess: el.scrollWidth - el.clientWidth,
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
