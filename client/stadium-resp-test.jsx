// StadiumIllustration mobile responsiveness harness — renders the REAL
// StadiumIllustration across the 4 capacity tiers (incl. extreme team colors)
// and self-reports overflow measurements into #report.
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
import { StadiumIllustration } from "./src/components/shared/StadiumIllustration.jsx";

// ── Fixture data: os 4 escalotes de lotação + cores extremas ────────────────
const cases = [
  { capacity: 8000, primary: "#111827", secondary: "#f8fafc", label: "8k (equipa escura)" },
  { capacity: 20000, primary: "#f8fafc", secondary: "#111827", label: "20k (equipa clara)" },
  { capacity: 40000, primary: "#e11d48", secondary: "#fbbf24", label: "40k" },
  { capacity: 100000, primary: "#2563eb", secondary: "#0f172a", label: "100k" },
];

const root = createRoot(document.getElementById("root"));
root.render(
  // Mimics the StadiumTab hero container (h-32 sm:h-56 + overlay)
  <div className="min-h-screen bg-surface">
    <div className="p-4 lg:p-6 space-y-4">
      {cases.map((c) => (
        <div
          key={c.label}
          className="rounded-lg border border-outline-variant/25 overflow-hidden relative bg-surface-container"
        >
          <div className="h-32 sm:h-56 relative flex items-end overflow-hidden">
            <StadiumIllustration
              capacity={c.capacity}
              primary={c.primary}
              secondary={c.secondary}
              className="absolute inset-0 h-full w-full"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
            <div className="relative px-5 pb-4 w-full">
              <p className="text-white text-sm font-black uppercase tracking-widest drop-shadow">{c.label}</p>
            </div>
          </div>
        </div>
      ))}
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
