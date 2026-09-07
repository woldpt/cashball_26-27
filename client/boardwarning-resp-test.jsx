// BoardWarningModal mobile responsiveness harness — renders the REAL
// BoardWarningModal with edge-case fixture data and self-reports overflow
// measurements into #report.
// NOT part of the app; used only for verification.
//
// Contract (read by client/scripts/mobileRespCheck.mjs):
//   - render into #root
//   - after ~2500 ms write "REPORT:<json>" into <pre id="report"> and set
//     data-status="done"
//   - json must include: viewport, pageOverflowPx, clippedRows,
//     clippingElements, verdict ("PASS" | "FAIL")
//
// Severidade via `?level=1|3` ou `#1`/`#3` (default 3 — "último aviso").
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { BoardWarningModal } from "./src/components/modals/BoardWarningModal.jsx";

const paramLevel = Number(
  new URLSearchParams(location.search).get("level") ??
    (location.hash ? location.hash.slice(1) : 3),
);
const level = Number.isFinite(paramLevel) && paramLevel === 1 ? 1 : 3;

// ── Fixture data: nome longo, crest 404 (fallback iniciais), orçamento
//    muito negativo ────────────────────────────────────────────────────────
const boardWarning =
  level === 1
    ? {
        level: 1,
        budget: -125000,
        streak: 1,
        teamId: 7,
        teamName:
          "Clube Desportivo e Recreativo União Desportiva de Montemor-o-Velho",
        division: 3,
        crest: "/crests/boardwarning-404.png",
        colorPrimary: "#0a4b2e",
        colorSecondary: "#ffffff",
      }
    : {
        level: 3,
        budget: -1250000,
        streak: 3,
        teamId: 8,
        teamName: "FC Porto",
        division: 1,
        crest: "/crests/boardwarning-404b.png",
        colorPrimary: "#d40000",
        colorSecondary: "#ffffff",
      };

const root = createRoot(document.getElementById("root"));
root.render(
  <div className="min-h-screen bg-surface">
    <BoardWarningModal boardWarning={boardWarning} onClose={() => {}} />
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
