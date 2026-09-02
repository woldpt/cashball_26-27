// AdminPanel REAL mobile responsiveness harness — renders o <AdminPanel/> de
// verdade (shell ModalShell + barra superior + UserList em cartões + footer),
//
// ⚠️ O nome NÃO pode começar por "admin", "/auth", "/saves" ou "/api": o proxy
// do vite dev faz prefix-matching e encaminharia os harnesses para o backend.
// dentro do backdrop real do modal `xl`, com o socket patcheado para responder
// a `adminListUsers` com fixtures de edge-case. Auto-reporta medições de
// overflow horizontal em #report.
// NOT part of the app; used only for verification.
//
// Complementar ao useradmin-resp-test.jsx (que testa as secções do detalhe):
// este garante que o SHELL do painel nunca volta a renderizar 2 colunas /
// larguras forçadas em mobile.
//
// Contract (read by client/scripts/mobileRespCheck.mjs):
//   - render into #root
//   - after ~2500 ms write "REPORT:<json>" into <pre id="report"> and set
//     data-status="done"
//   - json must include: viewport, pageOverflowPx, clippedRows,
//     clippingElements, verdict ("PASS"/"FAIL")
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { GameProvider } from "./src/contexts/GameContext.jsx";
import { AdminPanel } from "./src/components/admin/AdminPanel.jsx";
import { socket } from "./src/socket.js";

// ── Fixture: edge-case users ─────────────────────────────────────────────────
const EDGE_LONG_NAME = "x".repeat(40); // sem espaços — o caso mais hostil
const users = [
  { name: EDGE_LONG_NAME, online: true, rooms: ["ABCDEFGH1234567890ABCDEF", "QWE456"] },
  { name: "Alexandros Konstantinopoulos", online: true, rooms: ["ABC123", "XYZ789"] },
  { name: "fabio", online: true, rooms: ["ABC123"] }, // badge ADMIN
  { name: "João", online: false, rooms: [] },
  { name: "Maria Fernanda dos Santos", online: false, rooms: ["XYZ789", "QWE456", "RTY111"] },
];

// ── Shim de matchMedia (só nesta página de teste) ─────────────────────────────
// Quirk do Chromium headless 151: os @media CSS seguem o viewport, mas o JS
// window.matchMedia fica congelado nas métricas iniciais — queries max-width
// nunca chegam a `true` e o useIsMobile() renderizaria o layout DESKTOP aqui.
// O shim re-avalia as queries de largura contra innerWidth em cada acesso;
// não afeta a aplicação (só o `window` da página do harness).
const realMatchMedia = window.matchMedia;
window.matchMedia = (query) => {
  const maxW = /max-width:\s*([\d.]+)px/.exec(query);
  const minW = /min-width:\s*([\d.]+)px/.exec(query);
  if (!maxW && !minW) return realMatchMedia(query); // prefers-*, orientation, etc.
  let matches = true;
  const recompute = () => {
    matches =
      (!maxW || window.innerWidth <= Number(maxW[1])) &&
      (!minW || window.innerWidth >= Number(minW[1]));
  };
  return {
    media: query,
    onchange: null,
    get matches() {
      recompute();
      return matches;
    },
    addEventListener(_t, cb) {
      window.addEventListener("resize", cb);
    },
    removeEventListener(_t, cb) {
      window.removeEventListener("resize", cb);
    },
    addListener(cb) {
      window.addEventListener("resize", cb);
    },
    removeListener(cb) {
      window.removeEventListener("resize", cb);
    },
    dispatchEvent() {
      return true;
    },
  };
};

// Patch do socket ANTES do render: `adminListUsers` resolve com as fixtures.
// (Sem backend o callback nunca disporia e a lista ficaria em "A carregar…".)
socket.emit = function patchedEmit(event, ...rest) {
  const cb = rest[rest.length - 1];
  if (event === "adminListUsers") {
    setTimeout(() => cb?.({ ok: true, users }), 0);
  } else {
    setTimeout(() => cb?.({ ok: true }), 0); // eventos de mutação: ACK genérico
  }
};

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
    {/* Backdrop idêntico ao ModalShell xl (non-fullscreen): p-3 abaixo de sm */}
    <div className="fixed inset-0 bg-zinc-950/90 backdrop-blur-sm flex items-center justify-center p-3">
      <AdminPanel open onClose={noop} />
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
      name: el.querySelector("p.uppercase")?.textContent || el.className.toString().slice(0, 60),
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

  // Regra do painel: NUNCA scroll horizontal — nem ao nível da página, nem em
  // nenhum container com overflow auto dentro do sheet.
  const ovContainers = [...document.querySelectorAll(".overflow-y-auto, .overflow-x-auto")];
  const ovChecks = ovContainers.map((el) => ({
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
