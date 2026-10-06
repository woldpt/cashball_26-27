// LiveView mobile responsiveness harness — renders the REAL LiveView (tab live:
// hero + dados + feed, classificação virtual, Multiplex, divisões recolhidas)
// com um GameContext falso e auto-report. NOT part of the app.
//
// Contract (read by client/scripts/mobileRespCheck.mjs):
//   - render into #root
//   - after ~2500 ms write "REPORT:<json>" into <pre id="report"> and set
//     data-status="done"
//   - json must include: viewport, pageOverflowPx, clippedRows,
//     clippingElements, verdict ("PASS" | "FAIL")
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { GameContext } from "./src/contexts/GameContext.jsx";
import { LiveView } from "./src/components/live/LiveView.jsx";

const COLORS = ["#facc15", "#22c55e", "#3b82f6", "#ef4444", "#a855f7", "#f97316", "#14b8a6", "#e11d48"];
const LONG = ["União Desportiva de Viana do Castelo", "Atlético Clube de Operários do Porto"];

// 4 divisões × 6 equipas; a minha (id 1) na Div 4.
const teams = [];
for (let div = 1; div <= 4; div++) {
  for (let i = 0; i < 6; i++) {
    const id = (4 - div) * 6 + i + 1;
    teams.push({
      id,
      name: id <= 2 ? LONG[id - 1] : `Clube ${id} da Divisão ${div}`,
      division: div,
      color_primary: COLORS[id % COLORS.length],
      color_secondary: "#ffffff",
      stadium_name: "Estádio Municipal",
      wins: i, draws: 1, losses: 5 - i, goals_for: 8 + i, goals_against: 9, points: i * 3 + 1,
    });
  }
}

const goal = (minute, team, name) => ({ minute, type: "goal", team, playerName: name, text: `[${minute}'] ⚽ Golo de ${name}!` });
const lineup = (base, tired) =>
  Array.from({ length: 11 }, (_, i) => ({
    id: base + i,
    name: i === 0 ? "Baboucarr Gaye" : `Jogador ${base + i}`,
    is_starter: true,
    matchMinutes: 67,
    fatigueLoss: tired && i < 3 ? 4 - i : 1,
  }));

const myMatch = {
  homeTeamId: 1,
  awayTeamId: 2,
  attendance: 2530,
  homePossession: 57,
  awayPossession: 43,
  homeLineup: lineup(100, true),
  awayLineup: lineup(200, false),
  events: [
    { minute: 1, type: "weather", team: null, emoji: "🌧️", text: "[1'] 🌧️ Chuva miudinha sobre o relvado." },
    { minute: 1, type: "betting", team: null, text: "[1'] 2.10 / 3.20 / 3.50" },
    { minute: 8, type: "chance", team: "home", text: "[8'] 🧤 Grande defesa do guarda-redes a remate de longe." },
    { ...goal(11, "home", "Baboucarr Gaye"), playerId: 100 },
    { minute: 22, type: "yellow", team: "away", playerId: 203, playerName: "Jogador 203", text: "[22'] 🟨 Amarelo por entrada dura a meio-campo." },
    { minute: 34, type: "near_miss", team: "away", text: "[34'] 🥅 Ao poste! Por um triz não dava o empate." },
    { minute: 51, type: "own_goal", team: "away", playerId: 105, playerName: "Jogador 105", text: "[51'] ⚽ Auto-golo infeliz após cruzamento tenso." },
    { minute: 63, type: "chance", team: "home", text: "[63'] 💨 Remate cruzado a passar ao lado do poste mais distante." },
    { ...goal(66, "home", "Jogador 109"), playerId: 109 },
  ],
};

const others = [];
for (let div = 1; div <= 4; div++) {
  const ids = teams.filter((t) => t.division === div && t.id > 2).map((t) => t.id);
  for (let i = 0; i + 1 < ids.length; i += 2) {
    others.push({
      homeTeamId: ids[i],
      awayTeamId: ids[i + 1],
      events: i === 0 ? [goal(17 + div, "home", "Avançado Muito Comprido"), goal(55 + div, "away", "Rui")] : [],
    });
  }
}

const gameValue = {
  matchResults: { matchweek: 7, results: [myMatch, ...others] },
  matchAction: null,
  cupMatchRoundName: undefined,
  substitutionPause: null,
  liveMinute: 67,
  isPlayingMatch: true,
  isMatchActionPending: false,
  isMatchInProgress: true,
  showHalftimePanel: false,
  isLiveSimulation: true,
  standingsStale: false,
  goalFlashRef: {},
  finalWhistle: null,
  teams,
  teamForms: {},
  players: [{ id: 1, teamId: 1, name: "Fábio" }, { id: 2, teamId: 9, name: "Rui Costa" }],
  me: { teamId: 1 },
  myMatch,
  isCupMatch: false,
  isCupExtraTime: false,
  cupRoundResults: null,
  setShowMatchDetail: () => {},
  setMatchDetailFixture: () => {},
};

createRoot(document.getElementById("root")).render(
  <GameContext.Provider value={gameValue}>
    {/* Imita o GameLayout: <main> com o contentor de scroll p-4 */}
    <div id="scroller" className="h-screen overflow-y-auto bg-surface p-4 lg:p-6">
      <LiveView />
    </div>
  </GameContext.Provider>,
);

function measure() {
  const vw = window.innerWidth;
  const pageOverflow = document.documentElement.scrollWidth - vw;
  const rows = [...document.querySelectorAll("div.flex.overflow-hidden")];
  const clippedRows = rows
    .filter((el) => el.scrollWidth > el.clientWidth + 1)
    .map((el) => ({ name: el.className.toString().slice(0, 60), scrollW: el.scrollWidth, clientW: el.clientWidth }));
  const clippingElements = [...document.querySelectorAll("*")]
    .filter((el) => {
      const ov = getComputedStyle(el).overflowX;
      return (ov === "hidden" || ov === "auto") && el.scrollWidth > el.clientWidth + 1;
    })
    .map((el) => ({
      cls: (el.className && el.className.toString().slice(0, 80)) || el.tagName,
      excess: el.scrollWidth - el.clientWidth,
    }))
    .sort((a, b) => b.excess - a.excess)
    .slice(0, 10);
  return { viewport: vw, pageOverflowPx: pageOverflow, clippedRows, clippingElements };
}

setTimeout(async () => {
  const report = measure();
  // Marcador fixo: ausente no topo, presente depois de descer.
  const scroller = document.getElementById("scroller");
  const stickyAtTop = !!document.querySelector(".sticky");
  if (!new URLSearchParams(location.search).has("top")) {
    scroller.scrollTop = scroller.scrollHeight;
    await new Promise((r) => setTimeout(r, 400));
  }
  const stickyAfterScroll = !!document.querySelector(".sticky");
  report.sticky = { atTop: stickyAtTop, afterScroll: stickyAfterScroll };
  report.verdict =
    report.pageOverflowPx <= 0 && report.clippedRows.length === 0 && !stickyAtTop && stickyAfterScroll
      ? "PASS"
      : "FAIL";
  const el = document.getElementById("report");
  el.setAttribute("data-status", "done");
  el.textContent = "REPORT:" + JSON.stringify(report, null, 2);
}, 2500);
