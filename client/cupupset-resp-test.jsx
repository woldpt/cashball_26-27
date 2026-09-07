// CupUpsetModal mobile responsiveness harness — renders the REAL CupUpsetModal
// with edge-case fixture data and self-reports overflow measurements into #report.
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
import { CupUpsetModal } from "./src/components/modals/CupUpsetModal.jsx";

// ── Fixture data: 2 surpresas, nomes longos, crest a falhar (fallback) ───
const teams = [
  {
    id: 1,
    name: "Associação Desportiva Recreativa e Cultural de São João Ver",
    color_primary: "#123456",
    color_secondary: "#ffffff",
    crest: null,
  },
  {
    id: 2,
    name: "FC Porto",
    color_primary: "#d40000",
    color_secondary: "#ffffff",
    crest: "/crests/fcporto-404.png",
  },
  {
    id: 3,
    name: "Grupo Desportivo de Portel",
    color_primary: "#0a4b2e",
    color_secondary: "#ffffff",
    crest: null,
  },
  {
    id: 4,
    name: "Belenenses SAD",
    color_primary: "#f5c518",
    color_secondary: "#111111",
    crest: "/crests/belenenses-404.png",
  },
];

const cupRoundResults = {
  round: 2,
  roundName: "Oitavos de final",
  season: 2,
  isFinal: false,
  upsets: [
    {
      winnerName: "Grupo Desportivo de Portel",
      winnerDiv: 4,
      loserName: "FC Porto",
      loserDiv: 1,
      winnerId: 3,
      loserId: 2,
    },
    {
      winnerName:
        "Associação Desportiva Recreativa e Cultural de São João Ver",
      winnerDiv: 5,
      loserName: "Belenenses SAD",
      loserDiv: 3,
      winnerId: 1,
      loserId: 4,
    },
  ],
  results: [
    {
      homeTeamId: 3,
      awayTeamId: 2,
      homeTeam: teams[2],
      awayTeam: teams[1],
      homeGoals: 2,
      awayGoals: 1,
      winnerId: 3,
    },
    {
      homeTeamId: 1,
      awayTeamId: 4,
      homeTeam: teams[0],
      awayTeam: teams[3],
      homeGoals: 1,
      awayGoals: 0,
      winnerId: 1,
    },
  ],
};

const root = createRoot(document.getElementById("root"));
root.render(
  <div className="min-h-screen bg-surface">
    <CupUpsetModal cupRoundResults={cupRoundResults} teams={teams} />
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
