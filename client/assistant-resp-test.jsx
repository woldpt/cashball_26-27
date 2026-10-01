// Harness do treinador-adjunto: rende a vista pura com o pior caso
// (texto mais longo + CTA mais comprida) sobre o shell real (header fixo,
// bottom-nav h-16) e reporta overflow. NOT part of the app.
//
// Contract (read by client/scripts/mobileRespCheck.mjs):
//   - render into #root
//   - after ~2500 ms write "REPORT:<json>" into <pre id="report"> and set
//     data-status="done"
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { AssistantCoachView } from "./src/components/shared/AssistantCoach.jsx";

// Pior caso: texto mais longo das 6 dicas + CTA mais comprida.
const tip = {
  id: "redflag",
  mood: "worried",
  text: "Tens pendências no Jornal que bloqueiam o Pronto.",
  tab: "jornal",
  cta: "Ver Jornal",
};

const root = createRoot(document.getElementById("root"));
root.render(
  <div className="h-dvh overflow-hidden bg-surface text-on-surface">
    <div className="p-4 lg:p-6">
      <div className="h-40 rounded-xl bg-surface-container" />
    </div>
    {/* Barra do bottom-nav mobile (h-16), como no GameLayout. */}
    <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-container-high/95" />
    <AssistantCoachView tip={tip} onGo={() => {}} onDismiss={() => {}} />
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
