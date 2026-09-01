// Mobile responsiveness harness — renders the REAL RoomHub with edge-case
// fixture data and self-reports horizontal overflow measurements into #report.
// Measures both sub-tabs (Sala + Global). NOT part of the app; verification only.
import { createRoot } from "react-dom/client";
import { createRef } from "react";
import "./src/index.css";
import { RoomHub } from "./src/components/chat/RoomHub.jsx";

const noop = () => {};
const now = Date.now();

// Edge cases: long names, self (tu) + admin badge, kick button (matchweek 0),
// offline coach (awaitingCoaches), day separator, long message wrap.
const me = { name: "Cobra", roomName: "Sala Invernal Extremamente Longa", roomCode: "TESTE1" };

const teams = [
  { id: 1, name: "FC Porto Grande Desportivo", color_primary: "#e63946" },
  { id: 2, name: "SL Benfica Atlântico CF", color_primary: "#06d6a0" },
  { id: 3, name: "SC Braga Azul Marinho FC", color_primary: "#3a86ff" },
];

const players = [
  { name: "Cobra", teamId: 1, ready: true }, // self + admin
  { name: "Rui Filipe Alexandre Amoroso", teamId: 2, ready: false }, // long name
  { name: "P. Pochettino Silva", teamId: 3, ready: true },
];

const awaitingCoaches = ["Cristiano Ronaldo Jr"]; // offline entry

const roomMessages = [
  { id: 0, coachName: "Rui Filipe Alexandre Amoroso", message: "Ontem já falámos disto, mas vou repetir.", timestamp: now - 86400e3 },
  { id: 1, coachName: "Rui Filipe Alexandre Amoroso", message: "Boa sorte a todos!", timestamp: now - 3600e3 },
  { id: 2, coachName: "Cobra", message: "Obrigado! Mensagem própria longa para testar o quebra de linha no painel estreito do telemóvel sem overflow.", timestamp: now - 3590e3 },
  { id: 3, coachName: "P. Pochettino Silva", message: "🧠 Pensando nas táticas… alguém tem propostas para a defesa? Mensagem de teste bem comprida mesmo.", timestamp: now - 3000e3 },
  { id: 4, coachName: "Cobra", message: "Vou comprar defesa.", timestamp: now - 60e3 },
];

const globalMessages = [
  { id: 10, coachName: "Treinador Longo Do Chat Global", message: "Olá chat global! Mensagem de teste do canal geral.", timestamp: now - 5000e3 },
  { id: 11, coachName: "Cobra", message: "Resposta própria no global.", timestamp: now - 4990e3 },
];

const globalPlayers = ["Cobra", "Rui Filipe Alexandre Amoroso", "P. Pochettino Silva"];

function hub(extra) {
  return (
    <RoomHub
      me={me}
      roomHubRef={createRef()}
      roomHubOpen
      setRoomHubOpen={noop}
      roomMessages={roomMessages}
      globalMessages={globalMessages}
      globalPlayers={globalPlayers}
      players={players}
      teams={teams}
      roomCreator="Cobra"
      matchweekCount={0} // lobby: kick button visible
      chatInput=""
      setChatInput={noop}
      avatarSeed="seed-teste-123"
      unreadRoom={2}
      unreadGlobal={0}
      chatMessagesRef={createRef()}
      addToast={noop}
      awaitingCoaches={awaitingCoaches}
      chatOpenRef={{ current: true }}
      activeChatTabRef={{ current: "room" }}
      {...extra}
    />
  );
}

const root = createRoot(document.getElementById("root"));
root.render(
  <div className="min-h-screen bg-surface">
    {/* Mimics GameLayout chrome the panel floats over */}
    <div className="h-14 border-b border-outline-variant/30" />
    <div className="p-4 lg:p-6">{hub({})}</div>
  </div>
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

  // Vertical fit: the panel is fixed at top-14, so it must fit below the
  // viewport bottom (landscape phones) — otherwise the chat input / close
  // button are unreachable (no page scroll to recover them).
  const input = document.querySelector("input[type=text]");
  const panel = input ? input.closest("div.fixed") : null;
  let vertical = null;
  if (panel) {
    const pr = panel.getBoundingClientRect();
    const ir = input.getBoundingClientRect();
    const close = [...document.querySelectorAll("button")].find(
      (b) => b.textContent.trim().endsWith("Fechar"),
    );
    const cr = close ? close.getBoundingClientRect() : null;
    vertical = {
      panelBottom: Math.round(pr.bottom),
      viewportH: window.innerHeight,
      cutOffPx: Math.max(0, Math.round(pr.bottom - window.innerHeight)),
      inputReachable: ir.bottom <= window.innerHeight + 1,
      closeReachable: !cr || cr.bottom <= window.innerHeight + 1,
    };
  }

  return {
    pageOverflowPx: pageOverflow,
    clippedRows,
    clippingElements,
    vertical,
  };
}

let roomTab = null;
let globalTabClicked = false;

// Measure the default (Sala) tab first…
setTimeout(() => {
  roomTab = measure();
}, 1200);

// …then switch to the Global sub-tab so both layouts are checked.
setTimeout(() => {
  const btn = [...document.querySelectorAll("button")].find(
    (b) => b.textContent.trim() === "Global",
  );
  if (btn) {
    btn.click();
    globalTabClicked = true;
  }
}, 1600);

setTimeout(() => {
  const finalTab = measure();
  const report = {
    viewport: window.innerWidth,
    pageOverflowPx: finalTab.pageOverflowPx,
    clippedRows: finalTab.clippedRows,
    clippingElements: finalTab.clippingElements,
    roomTab, // overflow state before tab switch (Sala)
    globalTabClicked,
    verticalCutOffPx: Math.max(
      0,
      (roomTab && roomTab.vertical?.cutOffPx) || 0,
      finalTab.vertical?.cutOffPx || 0,
    ),
    inputReachable:
      (roomTab && roomTab.vertical?.inputReachable !== false) &&
      finalTab.vertical?.inputReachable !== false,
    closeReachable:
      (roomTab && roomTab.vertical?.closeReachable !== false) &&
      finalTab.vertical?.closeReachable !== false,
    verdict:
      roomTab &&
      roomTab.pageOverflowPx <= 0 &&
      finalTab.pageOverflowPx <= 0 &&
      finalTab.clippedRows.length === 0 &&
      (roomTab.vertical?.cutOffPx ?? 0) === 0 &&
      (finalTab.vertical?.cutOffPx ?? 0) === 0 &&
      finalTab.vertical?.inputReachable !== false &&
      finalTab.vertical?.closeReachable !== false
        ? "PASS"
        : "FAIL",
  };
  const el = document.getElementById("report");
  el.setAttribute("data-status", "done");
  el.textContent = "REPORT:" + JSON.stringify(report, null, 2);
}, 2500);
