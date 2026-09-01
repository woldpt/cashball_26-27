import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./src/index.css";
import LandingPage from "./src/components/auth/LandingPage.jsx";

const noop = () => {};

const FIX_SAVES = [
  { code: "SALA-ALFA", name: "Sala Alfa", createdAt: "2026-07-14T12:00:00Z" },
  { code: "SALA-BETA", name: "Sala Beta", createdAt: "2026-07-14T11:00:00Z" },
  { code: "SALA-GAMMA", name: "Sala Gama", createdAt: "2026-07-14T10:00:00Z" },
];

function base(over = {}) {
  return {
    authPhase: "login",
    setAuthPhase: noop,
    name: "",
    setName: noop,
    password: "",
    setPassword: noop,
    confirmPassword: "",
    setConfirmPassword: noop,
    roomCode: "",
    setRoomCode: noop,
    authSubmitting: false,
    authError: "",
    setAuthError: noop,
    isNewAccount: false,
    joining: false,
    disconnected: false,
    joinError: "",
    setJoinError: noop,
    handleAuthenticate: noop,
    handleJoin: noop,
    resetAuthFlow: noop,
    selectJoinMode: noop,
    joinMode: null,
    handleLogout: noop,
    me: null,
    token: "",
    availableSaves: [],
    setAvailableSaves: noop,
    backendUrl: "",
    ...over,
  };
}

function inst(id, props) {
  return (
    <div data-inst={id}>
      <LandingPage {...base(props)} {...props} />
    </div>
  );
}

export function App() {
  return (
    <div className="font-body">
      {inst("login", {
        authPhase: "login",
        name: "Cobra",
        password: "1234",
        authError: "",
      })}
      {inst("register", {
        authPhase: "register",
        name: "Amorim",
        password: "12",
        confirmPassword: "1234",
      })}
      {inst("mode-saved", {
        authPhase: "mode",
        joinMode: "saved-game",
        availableSaves: FIX_SAVES,
        roomCode: "SALA-ALFA",
        isNewAccount: false,
      })}
      {inst("mode-newgame", {
        authPhase: "mode",
        joinMode: "new-game",
        roomCode: "INVERNO",
      })}
      {inst("reconnect", { me: { name: "Cobra", roomCode: "SALA-ALFA", teamId: null } })}
    </div>
  );
}

const measure = () => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const out = { vw, vh, instances: {}, sticky: {}, horizontal: {}, errors: [] };

  const horizontalOverflow = Math.max(0, document.documentElement.scrollWidth - vw);
  const clippedRows = [...document.querySelectorAll("div.flex")]
    .filter((el) => el.scrollWidth > el.clientWidth + 1)
    .filter((el) => [...el.children].length > 4)
    .slice(0, 8)
    .map((el) => ({ tag: el.tagName.toLowerCase(), w: el.scrollWidth, cls: (el.className || "").slice(0, 80) }));
  const clippingEls = [...document.querySelectorAll("div,section,main")]
    .filter((el) => el.scrollWidth > el.clientWidth + 1)
    .slice(0, 10)
    .map((el) => ({ tag: el.tagName.toLowerCase(), w: el.scrollWidth, cls: (el.className || "").slice(0, 90) }));

  out.horizontal = { pageOverflow: horizontalOverflow, clippedRows, clippingEls };

  const wrap = (id) => document.querySelector(`[data-inst="${id}"]`);

  // ---- login / register: form placement (scrollable page) ----
  const authInsts = [
    { id: "login", ctaMatch: "ENTRAR", inputs: 2 },
    { id: "register", ctaMatch: "CRIAR CONTA", inputs: 3 },
  ];
  for (const a of authInsts) {
    const w = wrap(a.id);
    if (!w) {
      out.errors.push(`missing instance ${a.id}`);
      continue;
    }
    const cta = w.querySelector('button[class*="bg-green-500"]');
    const card = cta ? cta.closest('div[class*="max-w-md"]') : null;
    if (!card || !cta) {
      out.errors.push(`${a.id}: auth card/CTA not found`);
      continue;
    }
    const instRect = w.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    out.instances[a.id] = {
      cardTopPx: Math.round(cardRect.top - instRect.top),
      foldPx: Math.round(cardRect.top),
      inputCount: card.querySelectorAll("input").length,
      ctaVisible: cta.textContent.includes(a.ctaMatch),
    };
  }

  // sticky header check: scroll each auth instance 400px into view; header must pin at top
  for (const a of authInsts) {
    const w = wrap(a.id);
    const hdr = w ? w.querySelector("header") : null;
    if (!hdr) {
      out.sticky[a.id] = "missing header";
      continue;
    }
    const top = w.getBoundingClientRect().top + window.scrollY;
    const target = Math.min(top + 400, Math.max(0, document.documentElement.scrollHeight - vh));
    window.scrollTo(0, target);
    void document.body.offsetHeight; // force layout
    const t = hdr.getBoundingClientRect().top;
    out.sticky[a.id] = { headerTop: Math.round(t), scrollY: Math.round(window.scrollY) };
  }
  window.scrollTo(0, 0);

  // ---- mode instances: fixed-height window must fit without page scroll ----
  for (const id of ["mode-saved", "mode-newgame"]) {
    const w = wrap(id);
    if (!w) {
      out.errors.push(`missing instance ${id}`);
      continue;
    }
    const root = w.querySelector('[class*="100dvh-4rem"]');
    const body = root ? root.querySelector('[class*="overflow-y-auto"]') : null;
    const bar = root ? root.lastElementChild : null;
    const rec = {
      rootFound: Boolean(root),
      modeRootPx: root ? root.parentElement.offsetHeight : null,
      bodyPx: body ? body.clientHeight : 0,
      barOverflow:
        bar && root
          ? Math.round(bar.getBoundingClientRect().bottom - root.getBoundingClientRect().bottom)
          : null,
      bodyInputs: body ? body.querySelectorAll("input").length : 0,
      bodyCards: body ? body.querySelectorAll('[class*="rounded-2xl"]').length : 0,
    };
    out.instances[id] = rec;
    if (!root) out.errors.push(`${id}: room-select root not found`);
  }

  // ---- reconnect ----
  const wrc = wrap("reconnect");
  if (wrc) {
    out.instances.reconnect = { textFound: /A reconectar/i.test(wrc.textContent) };
  } else {
    out.errors.push("missing instance reconnect");
  }

  // ---- verdict ----
  const fail = [];
  if (out.horizontal.pageOverflow > 0) fail.push("horizontal overflow");
  if (out.horizontal.clippedRows.length) fail.push("clipped flex rows");
  for (const a of authInsts) {
    const s = out.sticky[a.id];
    if (s && typeof s === "object" && Math.abs(s.headerTop) > 2)
      fail.push(`header not pinned (${a.id}: headerTop=${s.headerTop})`);
    const i = out.instances[a.id];
    if (i) {
      if (i.inputCount !== a.inputs) fail.push(`${a.id}: expected ${a.inputs} inputs, got ${i.inputCount}`);
      if (!i.ctaVisible) fail.push(`${a.id}: CTA missing`);
    }
  }
  for (const id of ["mode-saved", "mode-newgame"]) {
    const m = out.instances[id];
    if (!m || !m.rootFound) continue;
    if (m.bodyPx < 100) fail.push(`${id}: body height ${m.bodyPx}px < 100px (content unreachable)`);
    if (m.barOverflow > 1) fail.push(`${id}: action bar overflows window by ${m.barOverflow}px`);
    if (m.modeRootPx > vh + 1) fail.push(`${id}: mode page scrolls (${m.modeRootPx}px > ${vh}px)`);
  }
  const ms = out.instances["mode-saved"];
  if (ms && ms.rootFound && ms.bodyCards < 1) fail.push("mode-saved: no save cards rendered");
  const mn = out.instances["mode-newgame"];
  if (mn && mn.rootFound && mn.bodyInputs < 1) fail.push("mode-newgame: code form missing");
  if (out.instances.reconnect && !out.instances.reconnect.textFound) fail.push("reconnect: text missing");
  if (out.errors.length) fail.push("sanity errors");

  return { ...out, verdict: fail.length ? "FAIL" : "PASS", fail: fail.length ? fail : null };
};

setTimeout(async () => {
  let data = null;
  try {
    // Wait for the Material Symbols font (same Google Fonts link as the app's
    // index.html): tab icons are 24px glyph boxes; without the font they render
    // as literal text and skew the measured layout.
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    data = measure();
  } catch (e) {
    data = { error: String(e) };
  }
  const el = document.getElementById("report");
  el.dataset.status = "done";
  el.textContent = `REPORT: ${JSON.stringify(data, null, 2)}`;
}, 2500);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
