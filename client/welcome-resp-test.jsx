// WelcomeModal mobile responsiveness harness — renders the REAL WelcomeModal
// in both states (new coach / returning coach) inside the real ModalShell and
// self-reports overflow measurements into #report. NOT part of the app; used
// only for mobile responsiveness verification (see .pi/skills/mobile-resp-check).
//
// Contract (read by client/scripts/mobileRespCheck.mjs):
//   - render into #root
//   - write "REPORT:<json>" into <pre id="report"> and set data-status="done"
//   - json must include: viewport, pageOverflowPx, clippedRows,
//     clippingElements, verdict ("PASS" | "FAIL")
//
// Extra fields (landscape fit): each case reports modalFit with the card's
// scrollHeight vs. available height (fullscreen backdrop is 1rem-padded), so
// short landscape viewports (e.g. 932x430) reveal if the modal needs scrolling.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { WelcomeModal } from "./src/components/modals/WelcomeModal.jsx";

// ── Fixtures: longest realistic names, every data branch (stadium, coaches…) ─
const TEAM = "Sporting Clube Desportivo Vila Nova de Gaia FC";
const me = { name: "Fernando Manuel Santos Antunes", teamId: 1, roomCode: "TESTAV" };

const CASES = {
  new: {
    welcomeModal: {
      isNew: true,
      teamName: TEAM,
      division: 2,
      budget: 9750000,
      stadiumCapacity: 52312,
      coaches: ["José Carlos Silva", "Rui Ferreira"],
      colorPrimary: "#2d6a4f",
      colorSecondary: "#003824",
    },
  },
  returning: {
    welcomeModal: {
      isNew: false,
      teamName: TEAM,
      division: null,
      points: 24,
      wins: 7,
      draws: 3,
      losses: 2,
      goalsFor: 28,
      goalsAgainst: 12,
      budget: 10234567,
      coaches: ["José Carlos Silva", "Rui Manuel Ferreira", "Pedro Costa"],
      colorPrimary: "#95d4b3",
      colorSecondary: "#003824",
    },
  },
};

export function App() {
  const [active, setActive] = useState("new");
  return (
    <div className="min-h-screen bg-surface">
      <WelcomeModal
        welcomeModal={CASES[active].welcomeModal}
        me={me}
        setWelcomeModal={() => {}}
      />
      {/* hidden switcher — the harness timeline drives this */}
      <button
        id="case-switch"
        className="fixed -top-96 left-0 opacity-0 pointer-events-none"
        onClick={() => setActive((a) => (a === "new" ? "returning" : "new"))}
      >
        case: {active}
      </button>
    </div>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);

// ── Measurement (template contract + landscape vertical fit) ────────────────
function measure() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
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

  // Landscape fit: does the modal card (max-w-2xl) fit vertically inside the
  // fullscreen backdrop (inset-0 p-4 → available = vh - 32px)?
  const card = document.querySelector(".max-w-2xl");
  const availH = vh - 32;
  const cardScrollH = card ? card.scrollHeight : 0;
  const modalFit = {
    viewportH: vh,
    availableH: availH,
    cardScrollH,
    fits: cardScrollH <= availH + 1,
  };

  return {
    viewport: vw,
    viewportHeight: vh,
    pageOverflowPx: pageOverflow,
    clippedRows,
    clippingElements,
    modalFit,
    verdict:
      pageOverflow <= 0 && clippedRows.length === 0 && modalFit.fits
        ? "PASS"
        : "FAIL",
  };
}

// ── Timeline: measure case A, switch, measure case B, emit combined report ──
window.addEventListener("load", () => {
  setTimeout(() => {
    const newCase = measure();
    document.getElementById("case-switch").click(); // → returning
    setTimeout(() => {
      const returningCase = measure();
      const verdict =
        [newCase, returningCase].every((c) => c.verdict === "PASS")
          ? "PASS"
          : "FAIL";
      const report = {
        viewport: window.innerWidth,
        pageOverflowPx: Math.max(newCase.pageOverflowPx, returningCase.pageOverflowPx),
        clippedRows: [...newCase.clippedRows, ...returningCase.clippedRows],
        clippingElements: [
          ...newCase.clippingElements,
          ...returningCase.clippingElements,
        ],
        cases: { newCoach: newCase, returningCoach: returningCase },
        verdict,
      };
      const el = document.getElementById("report");
      el.setAttribute("data-status", "done");
      el.textContent = "REPORT:" + JSON.stringify(report, null, 2);
    }, 1700);
  }, 2500);
});
