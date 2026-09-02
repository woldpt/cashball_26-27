// AdminPanel mobile responsiveness harness — renders the REAL admin components
// (UserList em modo cartões, UserProfileSection, UserRoomsSection,
// UserTeamsSection) dentro de um container que replica o sheet mobile do
// painel (barra superior + corpo com scroll vertical), com edge-case fixture
// data, e auto-reporta medições de overflow horizontal em #report.
// NOT part of the app; used only for verification.
//
// Nota: o AdminPanel em si é um shell (ModalShell); a parte densa está nas
// secções + lista. O fetch de socket não resolve sem backend, por isso as
// secções recebem fixtures diretamente — idêntico ao painel real, onde os
// dados vêm do GameContext.
//
// Contract (read by client/scripts/mobileRespCheck.mjs):
//   - render into #root
//   - after ~2500 ms write "REPORT:<json>" into <pre id="report"> and set
//     data-status="done"
//   - json must include: viewport, pageOverflowPx, clippedRows,
//     clippingElements, verdict ("PASS" | "FAIL")
/* eslint-disable react-refresh/only-export-components -- harness de teste sem exports */
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { GameProvider } from "./src/contexts/GameContext.jsx";
import { UserList } from "./src/components/admin/UserList.jsx";
import { UserProfileSection } from "./src/components/admin/UserProfileSection.jsx";
import { UserRoomsSection } from "./src/components/admin/UserRoomsSection.jsx";
import { UserTeamsSection } from "./src/components/admin/UserTeamsSection.jsx";

// ── Fixture data: edge cases ─────────────────────────────────────────────────
const LONG_UNBREAKABLE = "x".repeat(40); // nome sem espaços — o caso mais hostil
const users = [
  {
    name: LONG_UNBREAKABLE,
    online: true,
    rooms: [
      "ABCDEFGH1234567890ABCDEF", // código longo (mono + tracking-wider)
      "QWE456",
      "RTY111",
      "UIO222",
      "PLM333",
      "MNO789",
      "IJK012",
      "ABC789",
      "DEF321",
      "GHI654",
      "JKL987",
      "ZXC321", // 12 salas — plural do chip
    ],
  },
  { name: "Alexandros Konstantinopoulos", online: true, rooms: ["ABC123", "XYZ789"] },
  { name: "fabio", online: true, rooms: ["ABC123"] }, // badge ADMIN na lista
  { name: "João", online: false, rooms: [] }, // 0 salas — singular do chip
  { name: "Maria Fernanda dos Santos", online: false, rooms: ["XYZ789", "QWE456", "RTY111"] },
  { name: "Nuno", online: true, rooms: ["UIO222"] }, // 1 sala — singular
];

const selectedUser = users[0];
const noop = () => {};

// Barra superior do sheet (modos lista e detalhe) — réplica exata das classes
// de AdminPanel.jsx (mobile). Se divergir, o harness deixa de ser fiel.
function TopBar({ mode, name, count }) {
  return (
    <header className="shrink-0 px-4 py-3 border-b border-outline-variant/15 bg-surface-container-high/50 flex items-center gap-2 min-w-0">
      {mode === "detail" && (
        <button type="button" className="shrink-0 -ml-1 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
          <span className="material-symbols-outlined text-base">arrow_back</span>
        </button>
      )}
      {mode === "list" && (
        <span className="material-symbols-outlined text-amber-400 text-2xl shrink-0">admin_panel_settings</span>
      )}
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-black font-headline tracking-tight text-on-surface uppercase truncate" title={name}>
          {mode === "detail" ? name : "Gestão de Utilizadores"}
        </h2>
        <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">
          {mode === "detail" ? "Gestão de utilizador" : `${count} utilizadores registados`}
        </p>
      </div>
      <button type="button" className="shrink-0 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
        <span className="material-symbols-outlined text-base">close</span>
      </button>
    </header>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(
  <GameProvider
    me={{ name: "fabio" }}
    setMe={noop}
    setRoomCode={noop}
    setJoining={noop}
    setJoinError={noop}
    meRef={{ current: { name: "fabio" } }}
    roomCodeRef={{ current: "" }}
    joinTimerRef={{ current: null }}
    backendUrl=""
  >
    <div className="min-h-screen bg-zinc-950 p-3">
      {/* ── Sheet 1: estado LISTA (UserList isMobile) ── */}
      <div className="w-full max-w-5xl h-[calc(100dvh-24px)] rounded-xl border border-outline-variant/20 bg-surface-container overflow-hidden flex flex-col">
        <TopBar mode="list" count={users.length} />
        <div data-ov-check className="flex-1 min-h-0 overflow-y-auto">
          <UserList users={users} loading={false} selectedName={null} onSelect={noop} isMobile />
        </div>
      </div>

      {/* ── Sheet 2: estado DETALHE (secções empilhadas) ── */}
      <div className="w-full max-w-5xl h-[calc(100dvh-24px)] rounded-xl border border-outline-variant/20 bg-surface-container overflow-hidden flex flex-col mt-3">
        <TopBar mode="detail" name={selectedUser.name} />
        <div data-ov-check className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-4 space-y-6">
            <UserProfileSection user={{ ...selectedUser, email: "um.endereco.de.email.extremamente.longo.comprimento@exemplo-de-dominio.muito-longo.tld" }} onRenamed={noop} onDeleted={noop} />
            <div className="border-t border-outline-variant/15" />
            <UserRoomsSection user={selectedUser} rooms={selectedUser.rooms} onChanged={noop} />
            <div className="border-t border-outline-variant/15" />
            <UserTeamsSection rooms={selectedUser.rooms} />
          </div>
        </div>
      </div>
    </div>
  </GameProvider>,
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

  // Check estrito (regra do painel: NUNCA scroll horizontal): os containers
  // marcados com data-ov-check devem ter fit exato em qualquer viewport.
  const ovChecks = [...document.querySelectorAll("[data-ov-check]")].map((el) => ({
    cls: (el.className && el.className.toString().slice(0, 80)) || el.tagName,
    excess: Math.max(0, el.scrollWidth - el.clientWidth),
  }));

  return {
    viewport: vw,
    pageOverflowPx: pageOverflow,
    clippedRows,
    clippingElements,
    ovChecks,
    verdict:
      pageOverflow <= 0 &&
      clippedRows.length === 0 &&
      ovChecks.every((c) => c.excess === 0)
        ? "PASS"
        : "FAIL",
  };
}

setTimeout(() => {
  const report = measure();
  const el = document.getElementById("report");
  el.setAttribute("data-status", "done");
  el.textContent = "REPORT:" + JSON.stringify(report, null, 2);
}, 2500);
