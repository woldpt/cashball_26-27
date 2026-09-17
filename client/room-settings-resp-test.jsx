// Mobile responsiveness harness — renders the REAL RoomSettings with
// edge-case fixture data (admin view + vista de não-admin com nome de admin
// longo no rodapé) e self-reports horizontal overflow measurements into
// #report. NOT part of the app; verification only.
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { RoomSettings } from "./src/components/room/RoomSettings.jsx";

const noop = () => {};

const adminMe = { name: "Cobra" };
// Não-admin + admin com nome longo (rodapé com break-words).
const guestMe = { name: "Treinador Convidado" };
const longAdmin = "Rui Filipe Alexandre Amoroso da Silva Sauro";

function shell(panel) {
  return (
    <div className="min-h-screen bg-surface">
      {/* Mimics GameLayout chrome the panel floats over */}
      <div className="h-14 border-b border-outline-variant/30" />
      <div className="p-4 lg:p-6">{panel}</div>
    </div>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(
  shell(
    <RoomSettings
      open
      onClose={noop}
      me={adminMe}
      roomCreator="Cobra"
      simSpeed="calm"
    />,
  ),
);

function measure() {
  const vw = window.innerWidth;
  const doc = document.documentElement;
  const pageOverflow = doc.scrollWidth - vw;

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

  const all = [...document.querySelectorAll("*")].filter((el) => {
    const ov = getComputedStyle(el).overflowX;
    return (
      (ov === "hidden" || ov === "auto") &&
      el.scrollWidth > el.clientWidth + 1
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
  };
}

let adminView = null;

// Measure the admin view first…
setTimeout(() => {
  adminView = measure();
  // …then switch to the non-admin view (long admin name in footer).
  root.render(
    shell(
      <RoomSettings
        open
        onClose={noop}
        me={guestMe}
        roomCreator={longAdmin}
        simSpeed="fast"
      />,
    ),
  );
}, 1200);

setTimeout(() => {
  const guestView = measure();
  const worstOverflow = Math.max(
    adminView?.pageOverflowPx ?? 0,
    guestView.pageOverflowPx,
  );
  const clippedRows = [
    ...(adminView?.clippedRows ?? []),
    ...guestView.clippedRows,
  ];
  const report = {
    viewport: guestView.viewport,
    pageOverflowPx: worstOverflow,
    clippedRows,
    clippingElements: guestView.clippingElements,
    adminView,
    guestMeasured: true,
    verdict: worstOverflow <= 0 && clippedRows.length === 0 ? "PASS" : "FAIL",
  };
  const pre = document.getElementById("report");
  pre.textContent = `REPORT:${JSON.stringify(report)}`;
  pre.dataset.status = "done";
}, 2500);
