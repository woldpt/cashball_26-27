// Mobile responsiveness harness — renders the REAL CupTab (results + draw)
// and CupBracketPage (bracket tree + match list) with edge-case fixture data,
// and self-reports horizontal overflow measurements into #report.
// NOT part of the app; used only for verification.
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { CupTab } from "./src/views/CupTab.jsx";
import { CupBracketPage } from "./src/components/ui/CupBracketPage.jsx";

// ── Fixture data (edge cases: black-primary teams, longest names) ─────────
const TEAMS = [
  { id: 1, name: "Benfica", color_primary: "#e32219", color_secondary: "#000", stadium_name: "Estádio da Luz" },
  { id: 2, name: "Académica de Coimbra", color_primary: "#000", color_secondary: "#fff", stadium_name: "Estádio Cidade de Coimbra" },
  { id: 3, name: "Porto", color_primary: "#1b4d9e", color_secondary: "#fff", stadium_name: "Estádio do Dragão" },
  { id: 4, name: "Gil Vicente", color_primary: "#c8102e", color_secondary: "#fff", stadium_name: "Estádio D. Afonso Henriques" },
  { id: 5, name: "Feirense", color_primary: "#2244cc", color_secondary: "#fff", stadium_name: "Estádio Marcolino de Castro" },
  { id: 6, name: "Chaves", color_primary: "#1133aa", color_secondary: "#fff", stadium_name: "Estádio Municipal Eng. Manuel Branco Teixeira" },
];

const ME = { teamId: 1, name: "Coach A" };

const CUP_ROUND_RESULTS = {
  round: 3,
  roundName: "Quartos de final",
  season: "26/27",
  isFinal: false,
  results: [
    {
      homeTeamId: 1,
      awayTeamId: 4,
      homeTeam: TEAMS[0],
      awayTeam: TEAMS[3],
      homeGoals: 0,
      awayGoals: 2,
      winnerId: 4,
      wentToET: false,
      decidedByPenalties: false,
    },
    {
      homeTeamId: 5,
      awayTeamId: 2,
      homeTeam: TEAMS[4],
      awayTeam: TEAMS[1],
      homeGoals: 1,
      awayGoals: 2,
      winnerId: 2,
      wentToET: true,
      decidedByPenalties: false,
    },
    {
      homeTeamId: 3,
      awayTeamId: 2,
      homeTeam: TEAMS[2],
      awayTeam: TEAMS[1],
      homeGoals: 2,
      awayGoals: 3,
      winnerId: 2,
      wentToET: false,
      decidedByPenalties: true,
      penaltyHomeGoals: 4,
      penaltyAwayGoals: 5,
    },
    {
      homeTeamId: 6,
      awayTeamId: 5,
      homeTeam: TEAMS[5],
      awayTeam: TEAMS[4],
      homeGoals: 2,
      awayGoals: 1,
      winnerId: 6,
      wentToET: false,
      decidedByPenalties: false,
    },
  ],
};

const CUP_DRAW = {
  season: "26/27",
  roundName: "Oitavos de final",
  fixtures: [
    { homeTeam: TEAMS[0], awayTeam: TEAMS[1] },
    { homeTeam: TEAMS[2], awayTeam: TEAMS[5] },
  ],
};

const BRACKET = {
  season: "26/27",
  rounds: [
    {
      round: 3,
      roundName: "Quartos de final",
      matches: [
        {
          id: 1,
          homeTeam: TEAMS[0],
          awayTeam: TEAMS[3],
          homeScore: 0,
          awayScore: 2,
          homeEtScore: 0,
          awayEtScore: 0,
          homePenalties: 0,
          awayPenalties: 0,
          winnerId: 4,
          played: true,
        },
        {
          id: 2,
          homeTeam: TEAMS[4],
          awayTeam: TEAMS[1],
          homeScore: 1,
          awayScore: 2,
          homeEtScore: 0,
          awayEtScore: 0,
          homePenalties: 0,
          awayPenalties: 0,
          winnerId: 2,
          played: true,
        },
        {
          id: 3,
          homeTeam: TEAMS[2],
          awayTeam: TEAMS[1],
          homeScore: 2,
          awayScore: 3,
          homeEtScore: 0,
          awayEtScore: 0,
          homePenalties: 4,
          awayPenalties: 5,
          winnerId: 2,
          played: true,
        },
        {
          id: 4,
          homeTeam: TEAMS[5],
          awayTeam: TEAMS[4],
          homeScore: 2,
          awayScore: 1,
          homeEtScore: 0,
          awayEtScore: 0,
          homePenalties: 0,
          awayPenalties: 0,
          winnerId: 6,
          played: true,
        },
      ],
    },
    {
      round: 4,
      roundName: "Meias-finais",
      matches: [
        {
          id: 5,
          homeTeam: TEAMS[3],
          awayTeam: TEAMS[1],
          homeScore: null,
          awayScore: null,
          homeEtScore: null,
          awayEtScore: null,
          homePenalties: null,
          awayPenalties: null,
          winnerId: null,
          played: false,
        },
        {
          id: 6,
          homeTeam: TEAMS[1],
          awayTeam: TEAMS[6],
          homeScore: null,
          awayScore: null,
          homeEtScore: null,
          awayEtScore: null,
          homePenalties: null,
          awayPenalties: null,
          winnerId: null,
          played: false,
        },
      ],
    },
    {
      round: 5,
      roundName: "Final",
      matches: [
        {
          id: 7,
          homeTeam: TEAMS[3],
          awayTeam: TEAMS[1],
          homeScore: null,
          awayScore: null,
          homeEtScore: null,
          awayEtScore: null,
          homePenalties: null,
          awayPenalties: null,
          winnerId: null,
          played: false,
        },
      ],
    },
  ],
};

const PLAYERS = [
  { teamId: 1, name: "Coach A" },
  { teamId: 2, name: "Coach B" },
  { teamId: 3, name: "Coach C" },
  { teamId: 4, name: "Coach D" },
  { teamId: 5, name: "Coach E" },
  { teamId: 6, name: "Coach F" },
];

const app = createRoot(document.getElementById("root"));
app.render(
  <div className="min-h-screen bg-surface text-on-surface">
    <div className="p-4 lg:p-6 space-y-8">
      <CupTab
        cupRoundResults={CUP_ROUND_RESULTS}
        cupDraw={null}
        me={ME}
        teams={TEAMS}
        cupResultsFilter="all"
        setCupResultsFilter={() => {}}
      />
      <CupTab
        cupRoundResults={null}
        cupDraw={CUP_DRAW}
        me={ME}
        teams={TEAMS}
        cupResultsFilter="all"
        setCupResultsFilter={() => {}}
      />
      <CupBracketPage
        bracketData={BRACKET}
        me={ME}
        players={PLAYERS}
        onRequestRefresh={() => {}}
      />
    </div>
  </div>,
);

function measure() {
  const vw = window.innerWidth;
  const doc = document.documentElement;
  const pageOverflow = doc.scrollWidth - vw;

  const rows = [
    ...document.querySelectorAll(
      "main div.flex.overflow-hidden, div.p-4 div.flex.overflow-hidden",
    ),
  ];
  const clippedRows = rows
    .filter((el) => el.scrollWidth > el.clientWidth + 1)
    .map((el) => ({
      name: el.querySelector("p.uppercase")?.textContent || "?",
      scrollW: el.scrollWidth,
      clientW: el.clientWidth,
    }));

  const all = [...document.querySelectorAll("*")].filter((el) => {
    const ov = getComputedStyle(el).overflowX;
    return (
      (ov === "hidden" || ov === "auto") && el.scrollWidth > el.clientWidth + 1
    );
  });
  const clipping = all
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
    playerRows: rows.length,
    clippedPlayerRows: clippedRows,
    clippingElements: clipping,
    verdict: pageOverflow <= 0 && clippedRows.length === 0 ? "PASS" : "FAIL",
  };
}

setTimeout(() => {
  const report = measure();
  const el = document.getElementById("report");
  el.setAttribute("data-status", "done");
  el.textContent = "REPORT:" + JSON.stringify(report, null, 2);
}, 2500);
