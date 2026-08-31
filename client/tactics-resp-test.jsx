// TacticsView harness — renders the REAL TacticsView (prep phase, empty game
// state) inside the real GameProvider + TacticsProvider. NOT part of the app;
// used only for mobile responsiveness verification (see .pi/skills/mobile-resp-check).
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { GameProvider } from "./src/contexts/GameContext.jsx";
import { TacticsProvider } from "./src/contexts/TacticsContext.jsx";
import { TacticsView } from "./src/views/TacticsView.jsx";

const noop = () => {};

/* Minimal auth bridge — no backend in the harness, so state stays at its
 * initial (empty) values. All context accesses to `me` are optional-chained. */
const meFixture = { name: "", teamId: 1, roomCode: "TEST01" };

createRoot(document.getElementById("root")).render(
  <GameProvider
    me={meFixture}
    setMe={noop}
    setRoomCode={noop}
    setJoining={noop}
    setJoinError={noop}
    meRef={{ current: meFixture }}
    roomCodeRef={{ current: "TEST01" }}
    joinTimerRef={{ current: null }}
    backendUrl="http://127.0.0.1:9"
  >
    <TacticsProvider>
      <div className="min-h-screen bg-surface p-4 lg:p-6">
        <TacticsView />
      </div>
    </TacticsProvider>
  </GameProvider>
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
  // Reproduce the PRODUCTION mobile row: in-game the Mentalidade card sits
  // side-by-side with the MORAL card (both flex-1). The harness has no
  // nextMatchSummary, so inject a look-alike MORAL card to get the same
  // ~50/50 split before measuring.
  const header = [...document.querySelectorAll("span")].find(
    (s) => s.textContent?.trim().toLowerCase() === "mentalidade",
  );
  const card = header?.parentElement?.parentElement;
  const row = card?.parentElement;
  if (card && row) {
    const morale = document.createElement("div");
    morale.className =
      "flex-1 min-w-0 flex flex-col bg-[#111] border border-[#1e1e1e] rounded-2xl overflow-hidden";
    morale.innerHTML =
      '<div class="shrink-0 flex items-center justify-between px-3 py-2 border-b border-[#1a1a1a]"><span class="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Moral</span><span class="text-[9px] font-black uppercase text-red-400">Baixa</span></div><div class="flex flex-1 flex-col items-center justify-center gap-2.5 px-4 pb-3"><span class="text-[38px] leading-none font-black tabular-nums text-red-400">32</span><div class="h-2 w-full bg-[#1a1a1a] rounded-full overflow-hidden"><div class="h-full w-[32%] bg-red-500 rounded-full"></div></div></div>';
    row.insertBefore(morale, card);
  }

  setTimeout(() => {
    const report = measure();
    const el = document.getElementById("report");
    el.setAttribute("data-status", "done");
    el.textContent = "REPORT:" + JSON.stringify(report, null, 2);
  }, 400);
}, 2500);
