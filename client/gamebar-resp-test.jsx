// GameNoticeBar mobile responsiveness harness — reproduz o
// shell do GameLayout (header FIXO com fundo sólido + coluna de avisos + main
// com pt-[var(--header-h)]) com o pior caso: pausa da sala e 2 avisos
// transitórios empilhados, um deles com mensagem longa.
// Self-reporta overflow/clipping em #report. NOT part of the app.
//
// Contract (read by client/scripts/mobileRespCheck.mjs):
//   - render into #root
//   - after ~2500 ms write "REPORT:<json>" into <pre id="report"> and set
//     data-status="done"
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { GameNoticeBar } from "./src/components/layout/SystemOverlays.jsx";
import { RoomPauseBar } from "./src/components/shared/RoomPauseBanner.jsx";

// Pior caso: mensagem comprida sem espaços (nome de clube colado), emoji,
// vários avisos ao mesmo tempo — as barras têm de quebrar linha em 320px.
const notices = [
  { id: 1, msg: "⚠ Erro ao gerar jogos. Tenta novamente." },
  {
    id: 2,
    msg: "🔒 Zé do Boné riu-se: Alexandros Konstantinopoulos tem contrato até 2029, época 2028/2029. Ninguém mexe no menino dele.",
  },
  { id: 3, msg: "Não tens fundo de maneio suficiente!" },
];

const pause = {
  paused: true,
  reason: "coach_absent",
  coaches: ["Bernardo Figueiredo Almeida", "Rui"],
  since: Date.now() - 20 * 60 * 1000,
  phase: "match_halftime",
  minute: 45,
};

const root = createRoot(document.getElementById("root"));
root.render(
  // Mimics the GameLayout shell: coluna flex + header fixo + conteúdo.
  <div className="h-dvh overflow-hidden bg-surface text-on-surface flex flex-col relative isolate">
    <div className="fixed top-[var(--header-h)] left-0 right-0 z-100 flex flex-col pointer-events-none">
      <RoomPauseBar pause={pause} />
      <GameNoticeBar notices={notices} onDismiss={() => {}} />
    </div>
    {/* Header fixo (fundo sólido, como o GameHeader real) */}
    <div className="fixed top-0 left-0 right-0 z-160 h-[var(--header-h)] pt-[env(safe-area-inset-top,0px)] bg-surface-container-low border-b border-outline-variant/20 shadow-md flex items-center px-4">
      <span className="font-headline font-black text-base uppercase tracking-tighter">
        CashBall 26/27
      </span>
    </div>
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

  // A coluna de avisos é pointer-events-none: cada botão de fechar tem de
  // continuar alcançável (senão o aviso fica sem saída).
  const dismissButtons = [...document.querySelectorAll("button[aria-label='Fechar aviso']")];
  const unreachableDismiss = dismissButtons.filter((btn) => {
    const r = btn.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !(hit === btn || btn.contains(hit));
  }).length;

  return {
    viewport: vw,
    pageOverflowPx: pageOverflow,
    clippedRows: [],
    clippingElements,
    dismissButtons: dismissButtons.length,
    unreachableDismiss,
    verdict: pageOverflow <= 0 && unreachableDismiss === 0 ? "PASS" : "FAIL",
  };
}

setTimeout(() => {
  const report = measure();
  const el = document.getElementById("report");
  el.setAttribute("data-status", "done");
  el.textContent = "REPORT:" + JSON.stringify(report, null, 2);
}, 2500);
