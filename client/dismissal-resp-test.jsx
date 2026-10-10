// DismissalModal harness — renders the REAL modal de despedimento com a escolha
// de 3 clubes (pior caso: nomes longos, números grandes) e mede overflow em
// retrato. NOT part of the app; used only for verification.
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { DismissalModal } from "./src/components/modals/DismissalModal.jsx";

// ── Fixture data: cobre os casos extremos ───────────────────────────────────
const dismissalModal = {
  reason: "results",
  teamName: "Clube Desportivo e Recreativo da Freguesia de Santa Maria Maior",
  detail: "após 5 derrotas nos últimos 5 jogos",
  clubs: [
    {
      teamId: 1,
      teamName: "Associação Desportiva e Cultural de Vila Nova do Pinhal Grande",
      division: 4,
      budget: 1234567890,
      wins: 12,
      draws: 4,
      losses: 22,
      colorPrimary: "#1e3a8a",
    },
    {
      teamId: 2,
      teamName: "Sporting Clube Curto",
      division: 3,
      budget: -250000,
      wins: 3,
      draws: 1,
      losses: 1,
      colorPrimary: "#b91c1c",
    },
    {
      teamId: 3,
      teamName: "União Recreativa do Sul da Ilha de São Miguel e Arredores",
      division: 2,
      budget: 500000,
      wins: 8,
      draws: 6,
      losses: 10,
      colorPrimary: "#065f46",
    },
  ],
};

const root = createRoot(document.getElementById("root"));
root.render(
  // Mimics the GameLayout mobile container: <main> > div.p-4 > tab content
  <div className="min-h-screen bg-surface">
    <div className="p-4 lg:p-6">
      <DismissalModal dismissalModal={dismissalModal} onChoose={() => {}} />
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
