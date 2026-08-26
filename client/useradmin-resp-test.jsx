// AdminPanel mobile responsiveness harness — renders the REAL admin section
// components (UserList, UserProfileSection, UserRoomsSection, UserTeamsSection)
// inside the panel's actual grid container, with edge-case fixture data, and
// self-reports horizontal overflow measurements into #report.
// NOT part of the app; used only for verification.
//
// Nota: o AdminPanel em si é um shell (ModalShell + grid); a parte densa é
// nas secções, que é o que este harness testa. O fetch de socket não resolve
// sem backend, por isso as secções recebem fixtures diretamente.
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { GameProvider } from "./src/contexts/GameContext.jsx";
import { UserList } from "./src/components/admin/UserList.jsx";
import { UserProfileSection } from "./src/components/admin/UserProfileSection.jsx";
import { UserRoomsSection } from "./src/components/admin/UserRoomsSection.jsx";
import { UserTeamsSection } from "./src/components/admin/UserTeamsSection.jsx";

// ── Fixture data: edge cases ─────────────────────────────────────────────────
const users = [
  {
    name: "Alexandros Konstantinopoulos",
    online: true,
    rooms: ["ABC123", "XYZ789", "QWE456", "RTY111", "UIO222", "PLM333"],
  },
  { name: "fabio", online: true, rooms: ["ABC123", "XYZ789"] },
  { name: "João", online: false, rooms: [] },
  { name: "Maria Fernanda dos Santos", online: false, rooms: ["ABC123"] },
  { name: "Nuno", online: true, rooms: ["XYZ789", "QWE456", "RTY111"] },
  { name: "Sofia", online: false, rooms: ["UIO222"] },
  { name: "Pedro", online: true, rooms: [] },
  { name: "Inês", online: false, rooms: ["PLM333", "ABC123"] },
];

const selectedUser = users[0];

const noop = () => {};

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
    {/* Mimica o container do AdminPanel: grid 1 col mobile / 2 col md+ */}
    <div className="min-h-screen bg-surface">
      <div className="p-4 lg:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="min-w-0">
            <UserList
              users={users}
              loading={false}
              selectedName={selectedUser.name}
              onSelect={noop}
            />
          </div>
          <div className="min-w-0 space-y-6">
            <UserProfileSection
              user={selectedUser}
              onRenamed={noop}
              onDeleted={noop}
            />
            <div className="border-t border-outline-variant/15" />
            <UserRoomsSection
              user={selectedUser}
              rooms={selectedUser.rooms}
              onChanged={noop}
            />
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
