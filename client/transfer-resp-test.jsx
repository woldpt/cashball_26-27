// TransferHub mobile responsiveness harness — renders the REAL TransferHub
// with edge-case fixture data (long names, every badge/status state) and
// self-reports overflow measurements into #report.
// NOT part of the app; used only for verification.
//
// Contract (read by client/scripts/mobileRespCheck.mjs):
//   - render into #root
//   - after ~2500 ms write "REPORT:<json>" into <pre id="report"> and set
//     data-status="done"
//   - json must include: viewport, pageOverflowPx, clippedRows,
//     clippingElements, verdict ("PASS" | "FAIL")
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { TransferHub } from "./src/components/ui/TransferHub.jsx";

// ── Fixture data: edge cases ─────────────────────────────────────────────────
// Longest realistic names (2-line clamp target), star, injured, suspended,
// unaffordable price, no club, ex-club, every position.
const players = [
  {
    id: 1,
    name: "GIANLUCA PRANDELLI-MORETTI",
    position: "ATA",
    skill: 39,
    team_id: 1,
    team_name: "FC Longoname",
    color_primary: "#c0392b",
    nationality: "Itália",
    marketPrice: 868500,
    transfer_status: "fixed",
    auction_seller_team_id: null,
    suspension_until_matchweek: 0,
    injury_until_matchweek: 0,
    is_star: true,
    isExClub: false,
    aggressiveness: 70,
    goals: 12,
    form: 110,
    resistance: 80,
    games_played: 20,
    red_cards: 0,
    wage: 5000,
  },
  {
    id: 2,
    name: "RICARDO ESGARRAZ-BENÍTEZ",
    position: "DEF",
    skill: 38,
    team_id: 2,
    team_name: "SC Ultramarinos",
    color_primary: "#2980b9",
    nationality: "Argentina",
    marketPrice: 828000,
    transfer_status: "fixed",
    auction_seller_team_id: null,
    suspension_until_matchweek: 0,
    injury_until_matchweek: 0,
    is_star: false,
    isExClub: false,
    aggressiveness: 55,
    goals: 2,
    form: 95,
    resistance: 75,
    games_played: 18,
    red_cards: 1,
    wage: 4500,
  },
  {
    id: 3,
    name: "ALBERTO CONSTITUINTE",
    position: "DEF",
    skill: 35,
    team_id: 3,
    team_name: "AD Beiramar",
    color_primary: "#16a085",
    nationality: "Brasil",
    marketPrice: 999999999,
    transfer_status: "fixed",
    auction_seller_team_id: null,
    suspension_until_matchweek: 0,
    injury_until_matchweek: 4,
    is_star: false,
    isExClub: true,
    aggressiveness: 40,
    goals: 1,
    form: 85,
    resistance: 70,
    games_played: 15,
    red_cards: 2,
    wage: 3000,
  },
  {
    id: 4,
    name: "JEAN-PIERRE",
    position: "MED",
    skill: 28,
    team_id: 4,
    team_name: null,
    color_primary: null,
    nationality: "França",
    marketPrice: 120000,
    transfer_status: "fixed",
    auction_seller_team_id: null,
    suspension_until_matchweek: 6,
    injury_until_matchweek: 0,
    is_star: true,
    isExClub: false,
    aggressiveness: 90,
    goals: 5,
    form: 115,
    resistance: 60,
    games_played: 10,
    red_cards: 3,
    wage: 2000,
  },
  {
    id: 5,
    name: "GUARDIÃO",
    position: "GR",
    skill: 33,
    team_id: 5,
    team_name: "UD Horizonte",
    color_primary: "#8e44ad",
    nationality: "Portugal",
    marketPrice: 450000,
    transfer_status: "fixed",
    auction_seller_team_id: null,
    suspension_until_matchweek: 0,
    injury_until_matchweek: 0,
    is_star: false,
    isExClub: false,
    aggressiveness: 20,
    goals: 0,
    form: 100,
    resistance: 65,
    games_played: 20,
    red_cards: 0,
    wage: 2500,
  },
  {
    id: 6,
    name: "AVANÇADO EXTREMAMENTE LONGO QUE NÃO CABE EM LINHA ALGUMA",
    position: "ATA",
    skill: 42,
    team_id: 1,
    team_name: "FC Longoname",
    color_primary: "#c0392b",
    nationality: "Itália",
    marketPrice: 1500000,
    transfer_status: "fixed",
    auction_seller_team_id: null,
    suspension_until_matchweek: 0,
    injury_until_matchweek: 0,
    is_star: true,
    isExClub: false,
    aggressiveness: 85,
    goals: 25,
    form: 120,
    resistance: 88,
    games_played: 22,
    red_cards: 0,
    wage: 9000,
  },
];

const me = { teamId: 10 };

// Mini-brasão inline (data-URI) para cobrir o ramo <img> do TeamMark.
const CREST =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#166534"/><circle cx="16" cy="16" r="9" fill="none" stroke="#fff" stroke-width="2"/></svg>',
  );

const HIST_NAMES = [
  ["Pedro Virgínia", "GR"],
  ["Gonçalo Cardoso", "DEF"],
  ["Gleison Borges", "DEF"],
  ["Beni Settat", "MED"],
  ["Alonso Tedeschi", "GR"],
  ["David Monteiro", "DEF"],
  ["André Rodrigues", "ATA"],
  ["Juan Muñoz", "ATA"],
  ["Arturo Badic", "MED"],
  ["Anatoly Trubin", "GR"],
  ["Davy Qui", "MED"],
  ["Gerry Catalino", "ATA"],
];
const HIST_SELLERS = [
  "São João de Ver",
  "Aljustrelense",
  "Fabril Barreiro",
  "U. Leiria",
  "Amora",
  "Paredes",
];
// 38 registos como em produção (a lista faz scroll em max-h-80) + brasões
// reais nas equipas (ramo <img> do TeamMark, não as iniciais).
const transferHistory = Array.from({ length: 38 }, (_, i) => {
  const [baseName, position] = HIST_NAMES[i % HIST_NAMES.length];
  const sources = ["fixed", "npc", "proposal"];
  return {
    id: 101 + i,
    player_id: 1000 + i,
    player_name: i < HIST_NAMES.length ? baseName : `${baseName} ${i}`,
    position,
    is_star: i % 4 === 2,
    seller_team_id: 20 + (i % 6),
    seller_team_name: HIST_SELLERS[i % HIST_SELLERS.length],
    buyer_team_id: 10,
    buyer_team_name: "Louletano",
    amount: 52500 + ((i * 7919) % 800000),
    source: sources[i % sources.length],
  };
});

const historyTeams = Array.from({ length: 6 }, (_, i) => ({
  id: 20 + i,
  name: HIST_SELLERS[i],
  crest: CREST,
  color_primary: "#166534",
  color_secondary: "#ffffff",
}));
const allTeams = [
  { id: 1, color_primary: "#c0392b" },
  { id: 2, color_primary: "#2980b9" },
  { id: 3, color_primary: "#16a085" },
  { id: 4, color_primary: "#2c3e50" },
  { id: 5, color_primary: "#8e44ad" },
  { id: 10, name: "Louletano", crest: CREST, color_primary: "#b91c1c", color_secondary: "#ffffff" },
  ...historyTeams,
];

const root = createRoot(document.getElementById("root"));
root.render(
  // Mimics the GameLayout mobile container: <main> > div.p-4 > tab content
  <div className="min-h-screen bg-surface">
    <div className="p-4 lg:p-6">
      <Harness />
    </div>
  </div>,
);

function Harness() {
  const [marketPositionFilter, setMarketPositionFilter] = useState("all");
  const [marketSort, setMarketSort] = useState("quality-desc");
  return (
    <TransferHub
      players={players}
      teams={allTeams}
      transferHistory={transferHistory}
      budget={1000000}
      me={me}
      marketPositionFilter={marketPositionFilter}
      setMarketPositionFilter={setMarketPositionFilter}
      marketSort={marketSort}
      setMarketSort={setMarketSort}
      isSameTeamId={(a, b) => a === b}
      buyPlayer={() => {}}
      openAuctionBid={() => {}}
      onOpenPlayerHistory={() => {}}
      setGameDialog={() => {}}
      matchweekCount={1}
    />
  );
}

function measure() {
  const vw = window.innerWidth;
  const doc = document.documentElement;
  const pageOverflow = doc.scrollWidth - vw;

  // Rows/cards with overflow-hidden (content clipping risk) — horizontal
  // (classic) AND vertical (history rows were cut top/bottom in prod).
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

  // Vertical clipping: history rows cut at top/bottom (prod bug 2026-09-28).
  // scrollHeight sums in-flow children; a flex row shorter than its content
  // means the middle column collapsed or overflows (both fail).
  const vClipped = rows
    .filter((el) => el.scrollHeight > el.clientHeight + 1)
    .map((el) => ({
      name:
        el.querySelector("button")?.textContent?.slice(0, 30) ||
        el.className.toString().slice(0, 60),
      scrollH: el.scrollHeight,
      clientH: el.clientHeight,
    }));

  return {
    viewport: vw,
    pageOverflowPx: pageOverflow,
    clippedRows,
    verticallyClippedRows: vClipped,
    clippingElements,
    verdict:
      pageOverflow <= 0 &&
      clippedRows.length === 0 &&
      vClipped.length === 0
        ? "PASS"
        : "FAIL",
  };
}

setTimeout(() => {
  const report = measure();
  const el = document.getElementById("report");
  el.setAttribute("data-status", "done");
  el.textContent = "REPORT:" + JSON.stringify(report, null, 2);
}, 2500);
