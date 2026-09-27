// RotateOverlay mobile responsiveness harness — renders the REAL overlay
// over placeholder content and self-reports overflow measurements into
// #report. NOT part of the app.
//
// The overlay only mounts in mobile landscape (orientation: landscape AND
// width < lg): at portrait widths this harness renders just the placeholder
// (trivial PASS); at landscape widths it renders the overlay itself.
// Contract (read by client/scripts/mobileRespCheck.mjs): same as templates/.
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { RotateOverlay } from "./src/components/shared/RotateOverlay.jsx";

const root = createRoot(document.getElementById("root"));
root.render(
  // Mimics the app root: fixed overlay over normal content.
  <div className="h-dvh overflow-hidden bg-surface text-on-surface">
    <div className="p-4 lg:p-6">
      <div className="h-40 rounded-xl bg-surface-container" />
    </div>
    <RotateOverlay />
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
