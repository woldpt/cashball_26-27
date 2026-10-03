// TrainingTab mobile responsiveness harness — renders the REAL TrainingTab
// with fixture data and self-reports overflow measurements.
// NOT part of the app; used only for verification.
// Nota: o socket não responde em headless → histórico fica em EmptyState
// (estado real de montagem). O foco pré-definido via localStorage testa o
// badge "Ativo" (card mais alto) na grelha de opções.
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { TrainingTab } from "./src/views/TrainingTab.jsx";

localStorage.setItem("cashball_training_focus", "Defesas");

const me = { id: "coach-1", teamId: 1, name: "Treinador Teste" };

// Equipa técnica contratada (pior caso do texto: nome de papel + efeito
// compridos) — exercita a menção nova no card «Como funciona?».
const staff = {
  roles: ["auxiliar", "fisico"],
  slots: 3,
  used: 2,
  maxLevel: 5,
  salaries: [3000, 6000, 12000, 24000, 48000],
  signingWeeks: 4,
  severanceWeeks: 2,
  budget: 1000000,
  salaryWeekly: 60000,
  previews: {},
  members: [
    { role: "auxiliar", level: 5, name: "Prof. Cabrita", salaryWeekly: 48000, hiredSlot: 3, effect: { trainingPct: 40 }, severance: 96000 },
    { role: "fisico", level: 2, name: "Sargento Brás", salaryWeekly: 6000, hiredSlot: 4, effect: { restedForm: 1, resistance: 1, decayPct: 16 }, severance: 12000 },
    { role: "medico", level: 3, name: "Dr. Ossos", salaryWeekly: 12000, hiredSlot: 5, effect: { injuryPct: 18, weeksCut: 1, skillSaved: 3 }, severance: 24000 },
  ],
};

const root = createRoot(document.getElementById("root"));
root.render(
  <div className="min-h-screen bg-surface text-on-surface">
    <div className="p-4">
      <TrainingTab me={me} matchweek={7} staff={staff} />
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
