// LiveMatchHero mobile responsiveness harness — renders the REAL LiveMatchHero
// (scoreboard broadcast do "meu jogo") com fixture edge-case e auto-report.
// NOT part of the app; used only for design screenshots/verification.
//
// Contract (read by client/scripts/mobileRespCheck.mjs):
//   - render into #root
//   - after ~2500 ms write "REPORT:<json>" into <pre id="report"> and set
//     data-status="done"
//   - json must include: viewport, pageOverflowPx, clippedRows,
//     clippingElements, verdict ("PASS" | "FAIL")
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { LiveMatchHero } from "./src/components/live/LiveMatchHero.jsx";

/* ── Fixture: nomes longos (edge case truncation) + coaches nos dois lados ── */
const teams = [
  {
    id: 7,
    name: "União Desportiva de Viana do Castelo",
    color_primary: "#facc15",
    color_secondary: "#111827",
    stadium_name: "Estádio Municipal José Bento Pessoa",
    division: 4,
  },
  {
    id: 9,
    name: "Atlético Clube de Operários do Porto",
    color_primary: "#22c55e",
    color_secondary: "#ffffff",
    stadium_name: "Estádio Municipal",
    division: 4,
  },
];

const players = [
  { id: 1001, teamId: 7, name: "Fábio" },
  { id: 1002, teamId: 9, name: "Rui Costa" },
];

const myMatch = {
  homeTeamId: 7,
  awayTeamId: 9,
  attendance: 2530,
  homeLineup: [
    { id: 2001, name: "Baboucarr Gaye" },
    { id: 2002, name: "Hélder Silva" },
  ],
  awayLineup: [
    { id: 2003, name: "Vasco Guimarães" },
    { id: 2004, name: "Lucas Moreira da Silva" },
  ],
  events: [
    { minute: 0, type: "weather", team: null, text: "[0'] ☀️ Sol", emoji: "☀️" },
    { minute: 0, type: "betting", team: null, text: "[0'] 4.64 / 3.41 / 1.85" },
    { minute: 11, type: "goal", team: "home", playerId: 2001, playerName: "Baboucarr Gaye", text: "[11'] GOLO Baboucarr Gaye" },
    { minute: 22, type: "yellow", team: "away", playerId: 2003, playerName: "Vasco Guimarães", text: "[22'] Amarelo Vasco Guimarães" },
    { minute: 30, type: "substitution", team: "home", playerId: 2002, playerName: "Hélder Silva", outPlayerName: "Hélder Silva", text: "[30'] Substituição" },
  ],
};

const root = createRoot(document.getElementById("root"));
root.render(
  // Mimics the GameLayout mobile container: <main> > div.p-4 > tab content
  <div className="min-h-screen bg-surface">
    <div className="p-4 lg:p-6">
      <LiveMatchHero
        myMatch={myMatch}
        teams={teams}
        players={players}
        me={{ teamId: 7 }}
        liveMinute={33}
        isPlayingMatch
        isMatchActionPending={false}
        isCupMatch={false}
        cupMatchRoundName={undefined}
        substitutionPause={null}
        goalFlashRef={{}}
        isCupExtraTime={false}
        matchResults={{ matchweek: 4 }}
        onScoreClick={() => {}}
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
