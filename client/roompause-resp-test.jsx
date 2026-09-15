// RoomPauseBar mobile responsiveness harness — renders the REAL bar with the
// pior caso (vários treinadores ausentes, nomes longos) and self-reports
// overflow measurements into #report. NOT part of the app.
//
// Contract (read by client/scripts/mobileRespCheck.mjs):
//   - render into #root
//   - after ~2500 ms write "REPORT:<json>" into <pre id="report"> and set
//     data-status="done"
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { RoomPauseBar } from "./src/components/shared/RoomPauseBanner.jsx";

// Pior caso: nomes de treinador longos e vários ausentes (a faixa tem de
// quebrar linha em vez de estourar a largura em 320px).
const fixtures = {
  paused: true,
  reason: "coach_absent",
  coaches: ["Bernardo Figueiredo Almeida", "Rui", "Maria da Conceição"],
  since: Date.now() - 20 * 60 * 1000,
  phase: "match_halftime",
  minute: 45,
};

const root = createRoot(document.getElementById("root"));
root.render(
  // Mimics the GameLayout container: the bar is fixed at the top over content.
  <div className="h-dvh overflow-hidden bg-surface text-on-surface">
    <RoomPauseBar pause={fixtures} />
    <div className="p-4 lg:p-6">
      <div className="h-40 rounded-xl bg-surface-container" />
    </div>
  </div>,
);

function measure() {
  const vw = window.innerWidth;
  const doc = document.documentElement;
  const pageOverflow = doc.scrollWidth - vw;

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
    clippedRows: [],
    clippingElements,
    verdict: pageOverflow <= 0 ? "PASS" : "FAIL",
  };
}

setTimeout(() => {
  const report = measure();
  const el = document.getElementById("report");
  el.setAttribute("data-status", "done");
  el.textContent = "REPORT:" + JSON.stringify(report, null, 2);
}, 2500);
