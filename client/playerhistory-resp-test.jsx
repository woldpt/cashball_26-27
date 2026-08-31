// PlayerHistoryModal mobile responsiveness harness — renders the REAL
// PlayerHistoryModal with edge-case fixture data (the reported clipped
// header case + worst-case header height) and self-reports overflow
// measurements into #report.
// NOT part of the app; used only for verification.
//
// Contract (read by client/scripts/mobileRespCheck.mjs):
//   - render into #root
//   - after ~2500 ms write "REPORT:<json>" into <pre id="report"> and set
//     data-status="done"
//   - json must include: viewport, pageOverflowPx, clippedRows,
//     clippingElements, verdict ("PASS" | "FAIL")
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { PlayerHistoryModal } from "./src/components/modals/PlayerHistoryModal.jsx";

// ── Fixture data: edge cases ─────────────────────────────────────────────────
// Case "screenshot": exact shape of the reported bug (short name, ex-club,
// Fair Play, resistance + form → club row wraps and the wrapped line was
// clipped by the header).
// Case "worst": longest realistic name (wraps to 2 lines) + star + suspended
// badge + resistance + form → tallest possible header.
// Case "injured": injured badge + low form (😩) + long club name.
const base = {
  id: 1,
  position: "GR",
  skill: 42,
  team_id: 1,
  team_name: "Porto",
  color_primary: "#d04423",
  team_color_primary: "#d04423",
  nationality: "🇵🇹",
  aggressiveness: 3,
  resistance: 65,
  form: 100,
  value: 996000,
  wage: 6503,
  games_played: 7,
  goals: 0,
  red_cards: 0,
  injuries: 0,
  career_games: 0,
  career_goals: 0,
  career_reds: 0,
  career_injuries: 0,
  suspension_until_matchweek: 0,
  injury_until_matchweek: 0,
  is_star: false,
  isExClub: true,
  transfer_status: null,
  last_auctioned_matchweek: 0,
  contract_start_epoch: 0,
};

const CASES = [
  {
    label: "screenshot",
    player: { ...base, name: "João Afonso" },
  },
  {
    label: "worst",
    player: {
      ...base,
      id: 2,
      name: "AVANÇADO EXTREMAMENTE LONGO QUE NÃO CABE EM LINHA ALGUMA",
      position: "ATA",
      is_star: true,
      isExClub: false,
      team_name: "FC Longoname",
      suspension_until_matchweek: 9,
      resistance: 99,
      form: 120,
      nationality: "Itália",
    },
  },
  {
    label: "injured",
    player: {
      ...base,
      id: 3,
      name: "Ricardo Esgarraz-Benítez",
      position: "DEF",
      isExClub: false,
      team_name: "SC Ultramarinos Extremos",
      injury_until_matchweek: 9,
      form: 80,
      resistance: 75,
    },
  },
];

const skillHistory = [
  { matchweek: 1, skill: 41 },
  { matchweek: 2, skill: 42 },
  { matchweek: 3, skill: 42 },
  { matchweek: 4, skill: 42 },
  { matchweek: 5, skill: 42 },
  { matchweek: 6, skill: 42 },
];

// ── Measurement ──────────────────────────────────────────────────────────────
function measureCase(label) {
  const vw = window.innerWidth;
  const doc = document.documentElement;
  const pageOverflow = doc.scrollWidth - vw;

  // Vertical clipping: non-scrollable element (overflow-y hidden) whose
  // content is taller than the box. The scrollable body (overflow-y auto)
  // is expected to have scrollHeight > clientHeight and is NOT a defect.
  const vClipped = [...document.querySelectorAll("*")]
    .filter((el) => {
      const cs = getComputedStyle(el);
      if (cs.overflowY !== "hidden") return false;
      if (el.clientHeight <= 0) return false;
      return el.scrollHeight > el.clientHeight + 1;
    })
    .map((el) => ({
      cls: (el.className && el.className.toString().slice(0, 80)) || el.tagName,
      scrollH: el.scrollHeight,
      clientH: el.clientHeight,
      excess: el.scrollHeight - el.clientHeight,
    }));

  // Horizontal clipping in overflow-hidden rows (contract field).
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

  return { label, viewport: vw, pageOverflowPx: pageOverflow, clippedRows, vClipped };
}

function Harness() {
  const [caseIdx, setCaseIdx] = useState(0);
  const [setPlayerHistoryModal] = useState(null);
  const c = CASES[caseIdx];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const reports = [];
      for (let i = 0; i < CASES.length; i++) {
        setCaseIdx(i);
        await new Promise((r) => setTimeout(r, 450)); // let render + layout settle
        if (cancelled) return;
        reports.push(measureCase(CASES[i].label));
      }
      if (cancelled) return;
      const pageOverflowPx = Math.max(...reports.map((r) => r.pageOverflowPx));
      const clippedRows = reports.flatMap((r) => r.clippedRows);
      const vClipped = reports.flatMap((r) => r.vClipped);
      const report = {
        viewport: reports[0].viewport,
        pageOverflowPx,
        clippedRows,
        clippingElements: vClipped,
        cases: reports,
        verdict:
          pageOverflowPx <= 0 && clippedRows.length === 0 && vClipped.length === 0
            ? "PASS"
            : "FAIL",
      };
      const el = document.getElementById("report");
      el.setAttribute("data-status", "done");
      el.textContent = "REPORT:" + JSON.stringify(report, null, 2);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PlayerHistoryModal
      playerHistoryModal={{
        player: c.player,
        transfers: [],
        awards: [],
        skillHistory,
      }}
      setPlayerHistoryModal={setPlayerHistoryModal}
      myTeamId={99}
      matchweekCount={6}
      season={1}
    />
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<Harness />);
