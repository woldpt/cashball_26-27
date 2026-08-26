// Mobile responsiveness harness — renders the REAL PlayersTab with edge-case
// fixture data and self-reports horizontal overflow measurements into #report.
// NOT part of the app; used only for verification.
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { PlayersTab } from "./src/views/PlayersTab.jsx";

function mk(id, position, name, extra = {}) {
  return {
    id,
    position,
    name,
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
    contract_start_epoch: 0,
    contract_request_pending: false,
    suspension_until_matchweek: 0,
    injury_until_matchweek: 0,
    transfer_cooldown_until_matchweek: 0,
    ...extra,
  };
}

const squad = [
  mk(1, "GR", "Manuel José Carlos Ferreira", {
    skill: 36,
    wage: 7200,
    value: 180000,
  }),
  mk(2, "GR", "Rui Pinto", { skill: 30, wage: 5800, isJunior: true }),
  mk(3, "GR", "Tomás Silva", {
    skill: 28,
    wage: 5200,
    injury_until_matchweek: 99,
  }),
  mk(4, "DEF", "Alexandros Konstantinopoulos", {
    skill: 45,
    wage: 9800,
    value: 250000,
    is_star: true,
    form: 118,
  }),
  mk(5, "DEF", "João", {
    skill: 42,
    wage: 9000,
    contract_start_epoch: 10,
    transfer_status: "auction",
  }),
  mk(6, "DEF", "Bruno", {
    skill: 40,
    wage: 8400,
    contract_request_pending: true,
  }),
  mk(7, "DEF", "Tiago", {
    skill: 38,
    wage: 7900,
    suspension_until_matchweek: 99,
  }),
  mk(8, "DEF", "Rui", {
    skill: 36,
    wage: 7400,
    transfer_cooldown_until_matchweek: 99,
  }),
  mk(9, "DEF", "Pedro", {
    skill: 34,
    wage: 6900,
    resistance: 5,
    form: 82,
    prev_skill: 41,
  }),
  mk(10, "MED", "André", {
    skill: 48,
    wage: 10500,
    value: 255000,
    is_star: true,
    goals: 14,
  }),
  mk(11, "MED", "Miguel", {
    skill: 44,
    wage: 9400,
    contract_start_epoch: 1,
    form: 120,
  }),
  mk(12, "MED", "Diogo", {
    skill: 42,
    wage: 8800,
    transfer_status: "transfer",
  }),
  mk(13, "MED", "Filipe", {
    skill: 40,
    wage: 8200,
    injury_until_matchweek: 99,
    red_cards: 3,
  }),
  mk(14, "MED", "Nuno", { skill: 38, wage: 7700, isJunior: true }),
  mk(15, "ATA", "Ricardo", {
    skill: 50,
    wage: 11500,
    value: 255000,
    is_star: true,
    goals: 21,
    form: 115,
  }),
  mk(16, "ATA", "Hugo", {
    skill: 46,
    wage: 10100,
    nationality: "🇧🇷",
    resistance: 1,
  }),
  mk(17, "ATA", "Ivan", {
    skill: 43,
    wage: 9200,
    nationality: "🇦🇷",
    prev_skill: 45,
  }),
  mk(18, "ATA", "Vasco", { skill: 41, wage: 8600, isJunior: true, form: 80 }),
  mk(19, "ATA", "Sérgio", {
    skill: 39,
    wage: 8000,
    transfer_cooldown_until_matchweek: 99,
  }),
];

const root = createRoot(document.getElementById("root"));
root.render(
  // Mimics the GameLayout mobile container: <main> > div.p-4 > tab content
  <div className="min-h-screen bg-surface">
    <div className="p-4 lg:p-6">
      <PlayersTab
        mySquad={squad}
        annotatedSquad={squad}
        matchweekCount={8}
        season={1}
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
