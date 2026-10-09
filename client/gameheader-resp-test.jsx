/* eslint-disable react-refresh/only-export-components -- harness de teste sem exports */
// GameHeader (barra de topo) harness — renderiza o GameHeader REAL em todas as
// situações de jogo (antes do jogo, 1.ª parte, urgência 75'+, intervalo, taça
// pré-jogo, prolongamento, chat com mensagem, menu do utilizador aberto, sem
// clube) com os nomes mais compridos. Mede overflow e colisões entre as 3 zonas
// do header (clube | centro | direita). NOT part of the app.
//
// Contract (read by client/scripts/mobileRespCheck.mjs): render into #root,
// after ~2500 ms write "REPORT:<json>" into <pre id="report"> and set
// data-status="done".
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { GameContext, GameProvider, useGame } from "./src/contexts/GameContext.jsx";
import { TacticsProvider } from "./src/contexts/TacticsContext.jsx";
import { GameHeader } from "./src/components/layout/GameHeader.jsx";

const noop = () => {};
const meFixture = {
  name: "Rui Filipe Alexandre Amoroso da Silva",
  teamId: 1,
  roomCode: "TEST01",
  roomName: "Sala Invernal Extremamente Longa",
};

const LONG_CLUB = "Associação Recreativa e Cultural de São João da Madeira";
const teams = [
  { id: 1, name: LONG_CLUB, division: 1, points: 20, goals_for: 20, goals_against: 8 },
  { id: 2, name: "FC Belenense da Marginal", division: 1, points: 18, goals_for: 12, goals_against: 9 },
];
const teamInfo = {
  id: 1,
  name: LONG_CLUB,
  color_primary: "#e8c200", // amarelo: tinta escura sobre fundo claro
  color_secondary: "#111111",
  budget: 123456789,
};
const opponent = {
  id: 2,
  name: "Sociedade Desportiva Atlético Clube de Vila Nova de Famalicão",
  color_primary: "#0f9d58",
};
const summary = {
  isCup: false,
  matchweek: 12,
  venue: "Fora",
  opponent,
};
const myMatch = {
  homeTeamId: 1,
  awayTeamId: 2,
  events: [
    { type: "goal", team: "home", minute: 10 },
    { type: "goal", team: "away", minute: 30 },
    { type: "goal", team: "away", minute: 40 },
  ],
};
const base = {
  teams,
  seasonYear: 2026,
  calendarIndex: 11,
  currentJornada: 12,
  nextMatchSummary: summary,
  me: meFixture,
  teamInfo,
  avatarSeed: "x",
  coachAvatars: {},
  coachAvatarSeeds: {},
  backendUrl: "",
  isMatchInProgress: false,
  isPlayingMatch: false,
  showHalftimePanel: false,
  liveMinute: 90,
  isCupMatch: false,
  cupPreMatch: false,
  cupMatchRoundName: "",
  cupExtraTimeBadge: false,
  roomHubOpen: false,
  unreadRoom: 0,
  unreadGlobal: 0,
  chatPeek: null,
  userDropdownOpen: false,
  setRoomHubOpen: noop,
  setRoomSettingsOpen: noop,
  setUserDropdownOpen: noop,
  financeData: null,
  myMatch: null,
  navigateTab: noop,
  resetGameState: noop,
  leaveToMenu: noop,
};

const SCENARIOS = [
  ["lobby", { unreadRoom: 3 }],
  ["1aparte", { isMatchInProgress: true, isPlayingMatch: true, liveMinute: 38, myMatch }],
  ["urgente", { isMatchInProgress: true, isPlayingMatch: true, liveMinute: 78, unreadRoom: 12, unreadGlobal: 4, myMatch }],
  ["intervalo", { isMatchInProgress: true, isPlayingMatch: true, showHalftimePanel: true, liveMinute: 45, myMatch }],
  ["taca-pre", { isMatchInProgress: true, isCupMatch: true, cupPreMatch: true, cupMatchRoundName: "Meias-finais da Taça de Portugal", nextMatchSummary: { ...summary, isCup: true, cupRoundName: "Meias-finais da Taça de Portugal" } }],
  ["prolongamento", { isMatchInProgress: true, isPlayingMatch: true, isCupMatch: true, cupExtraTimeBadge: true, liveMinute: 105, myMatch }],
  ["sem-jogo", { nextMatchSummary: { isCup: true, cupRoundName: "Taça", opponent: null } }],
  ["sem-clube", { teamInfo: null, nextMatchSummary: null }],
  ["chat", { chatPeek: { coachName: "P. Pochettino Silva Fernandes", preview: "Mensagem de teste bem comprida mesmo para forçar mais do que uma linha no balão do telemóvel." }, unreadGlobal: 2 }],
  ["menu", { userDropdownOpen: true }],
];

function Override({ over, children }) {
  const value = { ...useGame(), ...base, ...over };
  return (
    <GameContext.Provider value={value}>
      <TacticsProvider>{children}</TacticsProvider>
    </GameContext.Provider>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      {SCENARIOS.map(([id, over]) => (
        <div key={id} data-inst={id} className={`mb-2 ${id === "menu" ? "pb-80" : id === "chat" ? "pb-40" : ""}`}>
          <p className="px-2 text-[9px] uppercase text-on-surface-variant">{id}</p>
          <Override over={over}>
            <GameHeader handleLogout={noop} setAuthPhase={noop} scrollToTop={noop} replayTutorial={noop} />
          </Override>
        </div>
      ))}
    </div>
  );
}

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
    <App />
  </GameProvider>,
);

const overlap = (a, b) =>
  Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
  Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;

/** Largura visível do texto de um elemento (o `truncate` corta no próprio elemento). */
function textRect(el) {
  const r = document.createRange();
  r.selectNodeContents(el);
  const t = r.getBoundingClientRect();
  const e = el.getBoundingClientRect();
  return { left: e.left, right: Math.min(t.right, e.right), top: e.top, bottom: e.bottom };
}

function measure() {
  const vw = window.innerWidth;
  const doc = document.documentElement;
  const pageOverflow = doc.scrollWidth - vw;
  const collisions = [];
  const heights = {};
  for (const inst of document.querySelectorAll("[data-inst]")) {
    const id = inst.getAttribute("data-inst");
    const header = inst.querySelector("header");
    if (!header) continue;
    const h = header.getBoundingClientRect();
    heights[id] = Math.round(h.height);
    const left = header.querySelector("h1")?.parentElement;
    const centre = header.querySelector('[role="timer"]') || header.querySelector(".md\\:flex.absolute");
    const right = header.querySelector(".ml-auto");
    const zones = {
      clube: left && (() => {
        const hh = textRect(left.querySelector("h1"));
        const pp = textRect(left.querySelector("p"));
        return { left: hh.left, right: Math.max(hh.right, pp.right), top: hh.top, bottom: pp.bottom };
      })(),
      centro: centre?.getBoundingClientRect(),
      direita: right?.getBoundingClientRect(),
    };
    const pairs = [["clube", "centro"], ["centro", "direita"], ["clube", "direita"]];
    for (const [a, b] of pairs)
      if (zones[a] && zones[b] && overlap(zones[a], zones[b]))
        collisions.push(`${id}: ${a} × ${b} (${Math.round(Math.min(zones[a].right, zones[b].right) - Math.max(zones[a].left, zones[b].left))}px)`);
    // Nada pode sair do header na horizontal.
    for (const [name, r] of Object.entries(zones))
      if (r && (r.right > vw + 1 || r.left < -1)) collisions.push(`${id}: ${name} fora do ecrã`);
  }

  const clippingElements = [...document.querySelectorAll("header *")]
    .filter((el) => {
      const ov = getComputedStyle(el).overflowX;
      return (ov === "hidden" || ov === "auto") && el.scrollWidth > el.clientWidth + 1 && !el.className.toString().includes("truncate");
    })
    .map((el) => ({
      cls: (el.className?.toString() || el.tagName).slice(0, 80),
      excess: el.scrollWidth - el.clientWidth,
    }))
    .slice(0, 10);

  return {
    viewport: vw,
    pageOverflowPx: pageOverflow,
    clippedRows: [],
    clippingElements,
    collisions,
    heights,
    verdict: pageOverflow <= 0 && collisions.length === 0 ? "PASS" : "FAIL",
  };
}

setTimeout(() => {
  const report = measure();
  const el = document.getElementById("report");
  el.setAttribute("data-status", "done");
  el.textContent = "REPORT:" + JSON.stringify(report, null, 2);
}, 2500);
