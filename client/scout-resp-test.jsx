// Mobile responsiveness harness — renders the REAL PlayerSearchView (Scout)
// with edge-case fixture data and self-reports horizontal overflow measurements
// into #report. NOT part of the app; used only for verification.
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { PlayerSearchView } from "./src/views/PlayerSearchView.jsx";

function mk(id, position, teamId, teamName, extra = {}) {
  return {
    id,
    position,
    name: "Jogador",
    nationality: "🇵🇹",
    skill: 40,
    prev_skill: 38,
    age: 24,
    form: 100,
    resistance: 3,
    aggressiveness: 50,
    value: 200000,
    wage: 8000,
    goals: 5,
    games_played: 12,
    career_games: 40,
    career_goals: 18,
    red_cards: 1,
    career_reds: 2,
    injuries: 0,
    career_injuries: 1,
    is_star: false,
    isJunior: false,
    isUnavailable: false,
    transfer_status: "none",
    transfer_price: null,
    team_id: teamId,
    team_name: teamName,
    division: 1,
    contract_start_epoch: 0,
    contract_request_pending: false,
    suspension_until_matchweek: 0,
    injury_until_matchweek: 0,
    transfer_cooldown_until_matchweek: 0,
    ...extra,
  };
}

const ME_TEAM_ID = 1;

// Edge cases: long names, every action variant, badges, star, deltas
const results = [
  mk(1, "GR", ME_TEAM_ID, "FC Longuíssimo Clube Desportivo do Bairro Alto", {
    name: "Manuel José Carlos Ferreira",
    skill: 36,
    wage: 7200,
    value: 180000,
  }),
  mk(2, "DEF", 2, "Atlético", {
    name: "Alexandros Konstantinopoulos",
    skill: 45,
    wage: 9800,
    value: 250000,
    is_star: true,
    form: 118,
    transfer_status: "auction",
    division: 2,
  }),
  mk(3, "MED", 3, "Sporting", {
    name: "André",
    skill: 48,
    wage: 10500,
    value: 300000,
    transfer_status: "fixed",
    transfer_price: 90000,
    division: 1,
  }),
  mk(4, "ATA", 4, "Benfica", {
    name: "Ricardo",
    skill: 50,
    wage: 11500,
    value: 400000,
    transfer_status: "fixed",
    transfer_price: 500000,
    division: 1,
  }),
  mk(5, "MED", 5, "Boavista", {
    name: "Miguel",
    skill: 44,
    wage: 9400,
    value: 255000,
    division: 3,
  }),
  mk(6, "DEF", 6, "FC Porto", {
    name: "Pedro",
    skill: 34,
    wage: 6900,
    value: 150000,
    division: 4,
    injury_until_matchweek: 99,
    suspension_until_matchweek: 99,
  }),
  mk(7, "ATA", 7, "V. Setúbal", {
    name: "Hugo",
    skill: 46,
    wage: 10100,
    value: 280000,
    nationality: "🇧🇷",
    resistance: 1,
    transfer_cooldown_until_matchweek: 99,
    division: 5,
  }),
  mk(8, "GR", 8, "Braga", {
    name: "Ivan",
    skill: 43,
    wage: 9200,
    value: 260000,
    nationality: "🇦🇷",
    prev_skill: 45,
    isJunior: true,
    division: 2,
  }),
  mk(9, "MED", 9, "Farense", {
    name: "Vasco",
    skill: 41,
    wage: 8600,
    value: 220000,
    form: 80,
    division: 3,
  }),
  mk(10, "DEF", 10, "Estrela", {
    name: "Sérgio",
    skill: 39,
    wage: 8000,
    value: 200000,
    division: 4,
  }),
];

const root = createRoot(document.getElementById("root"));
root.render(
  // Mimics the GameLayout mobile container: <main> > div.p-4 > tab content
  <div className="min-h-screen bg-surface">
    <div className="p-4 lg:p-6">
      <PlayerSearchView
        me={{ teamId: ME_TEAM_ID }}
        players={[
          { teamId: ME_TEAM_ID, name: "FC Longuíssimo" },
          { teamId: 5, name: "Boavista" },
        ]}
        myBudget={150000}
        matchweekCount={8}
        playerSearchData={{ results, total: results.length, truncated: false }}
        playerSearchLoading={false}
        setPlayerSearchLoading={() => {}}
        setTransferProposalModal={() => {}}
        setGameDialog={() => {}}
        buyPlayer={() => {}}
        openAuctionBid={() => {}}
        onOpenPlayerHistory={() => {}}
      />
    </div>
  </div>,
);

function measure() {
  const vw = window.innerWidth;
  const doc = document.documentElement;
  const pageOverflow = doc.scrollWidth - vw;

  // PlayerRow roots: flex rows with overflow-hidden (content clipping risk)
  const rows = [
    ...document.querySelectorAll("div.p-4 div.flex.overflow-hidden"),
  ];
  const clippedRows = rows
    .filter((el) => el.scrollWidth > el.clientWidth + 1)
    .map((el) => ({
      name: el.querySelector("p.uppercase")?.textContent || "?",
      scrollW: el.scrollWidth,
      clientW: el.clientWidth,
    }));

  // Filter inputs: detect squashed inputs (placeholder unusable)
  const filterInputs = [...document.querySelectorAll("input, select")].map(
    (el) => ({
      tag: el.tagName.toLowerCase(),
      ph: el.placeholder || el.value || el.className.slice(0, 20),
      w: el.clientWidth,
    }),
  );
  const squashedInputs = filterInputs.filter((f) => f.w < 70);

  // Filter grid cells: content wider than cell = inputs clipped by panel
  const cells = [...document.querySelectorAll("div.flex.items-center.gap-2")].map(
    (el) => ({
      cellW: el.clientWidth,
      contentW: el.scrollWidth,
      inputs: [...el.querySelectorAll("input")].map((i) => i.clientWidth),
    }),
  );

  // Action buttons: detect clipped labels
  const buttons = [...document.querySelectorAll("button")];
  const clippedButtons = buttons
    .filter((el) => el.scrollWidth > el.clientWidth + 1)
    .map((el) => ({
      label: el.textContent.trim().slice(0, 30),
      scrollW: el.scrollWidth,
      clientW: el.clientWidth,
    }));

  // Any hidden-overflow element clipping content (top 10 by excess)
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
    filterInputWidths: filterInputs.map((f) => f.w).join(","),
    squashedInputs: squashedInputs,
    filterCells: cells,
    clippedButtons: clippedButtons,
    clippingElements: clipping,
    verdict:
      pageOverflow <= 0 &&
      clippedRows.length === 0 &&
      clippedButtons.length === 0
        ? "PASS"
        : "FAIL",
  };
}

// Click "Pesquisar" so the results list (PlayerRow rows) renders
setTimeout(() => {
  const btn = [...document.querySelectorAll("button")].find(
    (b) => b.textContent.trim() === "Pesquisar",
  );
  btn?.click();
}, 600);

setTimeout(() => {
  const report = measure();
  const el = document.getElementById("report");
  el.setAttribute("data-status", "done");
  el.textContent = "REPORT:" + JSON.stringify(report, null, 2);
}, 2500);
