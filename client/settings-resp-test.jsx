// Mobile responsiveness harness — renders the REAL UserSettingsPage with
// edge-case fixture data and self-reports horizontal overflow measurements
// into #report. Two instances are stacked: the no-photo state (Carregar
// foto + Gerar avatar) and the has-photo state (Trocar foto + Remover).
// NOT part of the app; verification only.
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { UserSettingsPage } from "./src/pages/UserSettingsPage.jsx";

const noop = () => {};

// Edge cases: longest realistic name, long room name, trophy with a very
// long competition name (truncate row), both avatar button states.
const me = {
  name: "Cobra",
  token: "tok-teste",
  roomName: "Sala Invernal Extremamente Longa",
  roomCode: "TESTE1",
  teamId: 1,
};

const teamInfo = {
  id: 1,
  name: "FC Porto Grande Desportivo",
  color_primary: "#e63946",
};

const palmares = {
  trophies: [
    {
      achievement:
        "Campeão Da Liga Portuguesa Dos Campeonatos Infinitos De Inverno",
      season: "25/26",
      team_name: "FC Porto Grande Desportivo",
    },
    {
      achievement: "Finalista Taça Nacional",
      season: "24/25",
      team_name: "FC Porto Grande Desportivo",
    },
  ],
};

function page(coachAvatars) {
  return (
    <UserSettingsPage
      me={me}
      teamInfo={teamInfo}
      palmares={palmares}
      backendUrl=""
      avatarSeed="seed-teste-123"
      coachAvatars={coachAvatars}
      setCoachAvatars={() => {}}
      onAvatarSeedChange={noop}
      onBack={noop}
      onLeaveRoom={noop}
    />
  );
}

const root = createRoot(document.getElementById("root"));
root.render(
  <div className="min-h-screen bg-surface">
    <div className="p-4 lg:p-6">
      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
        Estado: sem foto
      </p>
      {page({})}
      <p className="mb-2 mt-8 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
        Estado: com foto
      </p>
      {page({ Cobra: 1 })}
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

  return { pageOverflowPx: pageOverflow, clippedRows, clippingElements };
}

let baseline = null;

setTimeout(() => {
  baseline = measure();
  const el = document.getElementById("report");
  el.setAttribute("data-status", "done");
  const report = {
    viewport: window.innerWidth,
    pageOverflowPx: baseline.pageOverflowPx,
    clippedRows: baseline.clippedRows,
    clippingElements: baseline.clippingElements,
    verdict:
      baseline.pageOverflowPx <= 0 && baseline.clippedRows.length === 0
        ? "PASS"
        : "FAIL",
  };
  el.textContent = "REPORT:" + JSON.stringify(report, null, 2);
}, 2500);
