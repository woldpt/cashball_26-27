// GameNoticeBar mobile responsiveness harness — renderiza a barra de avisos
// real com o pior caso (3 avisos empilhados, mensagem longa com nome de
// jogador e agente) sobre um header fixo, e auto-reporta overflow/clipping em
// #report. NOT part of the app; usado apenas para verificação.
//
// Contract (read by client/scripts/mobileRespCheck.mjs):
//   - render into #root
//   - after ~2500 ms write "REPORT:<json>" into <pre id="report"> and set
//     data-status="done"
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { GameNoticeBar } from "./src/components/layout/SystemOverlays.jsx";

// Pior caso: mensagem comprida sem espaços (nome de clube colado), emoji,
// vários avisos ao mesmo tempo — a barra tem de quebrar linha em 320px.
const notices = [
  {
    id: 1,
    msg: "🔒 Zé do Boné riu-se: Alexandros Konstantinopoulos tem contrato até 2029, época 2028/2029. Ninguém mexe no menino dele.",
  },
  {
    id: 2,
    msg: "⛔ Tens o patrocinador da época por escolher no Jornal.",
  },
  {
    id: 3,
    msg: "Não tens fundo de maneio suficiente!",
  },
];

const root = createRoot(document.getElementById("root"));
root.render(
  // Mimics the GameLayout container: header fixo + barra logo abaixo.
  <div className="h-dvh overflow-hidden bg-surface text-on-surface">
    <div className="fixed top-0 left-0 right-0 z-160 h-[var(--header-h)] bg-surface-container-high border-b border-outline-variant/20" />
    <GameNoticeBar notices={notices} onDismiss={() => {}} />
    <div className="pt-[var(--header-h)] p-4 lg:p-6">
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
