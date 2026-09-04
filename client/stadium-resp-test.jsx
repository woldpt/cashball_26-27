// StadiumTab mobile responsiveness harness — renders the REAL StadiumTab
// with edge-case fixture data and self-reports overflow measurements.
// NOT part of the app; used only for verification.
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { StadiumTab } from "./src/views/StadiumTab.jsx";

// ── Fixture: edge cases ────────────────────────────────────────────────────
// - nome de estádio longo (hero) + capacidade 30k (imagem intermédia)
// - saldo < custo de expansão → botão desativado + texto "faltam X"
// - assistência média calculada de ticketBreakdown (5 jogos em casa)
const teamInfo = {
  id: 1,
  name: "União Desportiva de São João da Talha",
  color_primary: "#e11d48",
  color_secondary: "#ffffff",
  division: 1,
  stadium_name: "Estádio Municipal de São João da Talha",
  stadium_capacity: 30000,
};

const financeData = {
  homeMatchesPlayed: 5,
  ticketBreakdown: [
    { name: "Bancada Norte", price: 15, attendance: 27450 },
    { name: "Bancada Sul", price: 15, attendance: 29120 },
    { name: "Cadeira Descoberta", price: 15, attendance: 30500 },
    { name: "Bancada Norte", price: 15, attendance: 28890 },
    { name: "Cadeira Coberta", price: 15, attendance: 31200 },
  ],
};

const root = createRoot(document.getElementById("root"));
root.render(
  <div className="min-h-screen bg-surface text-on-surface">
    <div className="p-4">
      <StadiumTab
        teamInfo={teamInfo}
        currentBudget={250000}
        capacityRevPerGame={450000}
        financeData={financeData}
        setGameDialog={() => {}}
      />
    </div>
  </div>,
);

function measure() {
  const vw = window.innerWidth;
  const doc = document.documentElement;
  const pageOverflow = doc.scrollWidth - vw;

  const rows = [...document.querySelectorAll("div.flex.overflow-hidden")];
  const clippedRows = rows
    .filter((el) => el.scrollWidth > el.clientWidth + 1)
    .map((el) => ({
      name: el.querySelector("p.uppercase")?.textContent || el.className.toString().slice(0, 60),
      scrollW: el.scrollWidth,
      clientW: el.clientWidth,
    }));

  const all = [...document.querySelectorAll("*")].filter((el) => {
    const ov = getComputedStyle(el).overflowX;
    return (ov === "hidden" || ov === "auto") && el.scrollWidth > el.clientWidth + 1;
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
