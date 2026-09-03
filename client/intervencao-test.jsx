// IntervencaoView harness — renders the REAL IntervencaoView (halftime mode,
// 1 sub already confirmed) with mock data. NOT part of the app; used only
// for design screenshots/verification.
// Measure the Substituições tab: its mobile layout is a stack of two
// overlapping pages (Titulares/Suplentes) with a flip-3D transition.
/* eslint-disable react-refresh/only-export-components -- harness de teste sem exports */
import { createRoot } from "react-dom/client";
import { useState } from "react";
import "./src/index.css";
import { IntervencaoView } from "./src/components/match/tabs/IntervencaoView.jsx";

const noop = () => {};

function mk(id, position, name, skill, extra = {}) {
  return {
    id,
    name,
    position,
    skill,
    prev_skill: Math.max(1, skill - 2),
    form: 100,
    resistance: 3,
    is_star: false,
    matchMinutes: 45,
    fatigueLoss: 0,
    ...extra,
  };
}

/* ── My team (home, id 1) — 11 starters + 8 bench ─────────────────────── */
const squad = [
  mk(1, "GR", "Rui Costa", 38),
  mk(2, "DEF", "Miguel Ferreira", 44),
  mk(3, "DEF", "João Santos", 46, { is_star: true }),
  mk(4, "DEF", "Pedro Alves", 42),
  mk(5, "DEF", "Diogo Rocha", 43),
  mk(6, "DEF", "Nuno Martins", 41),
  mk(7, "MED", "Rui Oliveira", 48, { is_star: true }),
  mk(8, "MED", "Tiago Pereira", 45),
  mk(9, "MED", "Bruno Costa", 47),
  mk(10, "MED", "Hélio Ramos", 44),
  mk(11, "ATA", "Ricardo Gomes", 52, { is_star: true }),
  mk(12, "ATA", "Vasco Pinto", 49),
  mk(13, "ATA", "Ivo Cardoso", 47),
  mk(14, "GR", "Tomás Silva", 33),
  mk(15, "DEF", "André Lopes", 39),
  mk(16, "MED", "Fábio Nunes", 46),
  mk(17, "MED", "Sérgio Tavares", 43),
  mk(18, "ATA", "Duarte Faria", 48),
  mk(19, "ATA", "Leandro Moura", 45),
];

/* Post-sub state: 8 (Tiago Pereira) → 16 (Fábio Nunes) already confirmed. */
const starterIds = [1, 2, 3, 4, 5, 7, 8, 9, 11, 12, 13];
const positions = {};
for (const p of squad) positions[p.id] = starterIds.includes(p.id) ? "Titular" : "Suplente";
positions[8] = "Suplente";
positions[16] = "Titular";

const tactic = { positions, style: "Equilibrado" };

/* ── Opponent (away, id 2) — 11 starters + 5 bench ────────────────────── */
const oppSquad = [
  mk(101, "GR", "Marcos Vieira", 37),
  mk(102, "DEF", "Rui Barros", 44),
  mk(103, "DEF", "Tiago Neves", 42),
  mk(104, "DEF", "Paulo Cruz", 41),
  mk(105, "DEF", "Sérgio Dias", 40),
  mk(106, "MED", "Filipe Amaral", 46),
  mk(107, "MED", "Gonçalo Reis", 44),
  mk(108, "MED", "Vitor Hugo", 43),
  mk(109, "MED", "Duarte Melo", 42),
  mk(110, "ATA", "Renato Sousa", 49),
  mk(111, "ATA", "Igor Machado", 47),
  mk(112, "DEF", "Hugo Furtado", 38),
  mk(113, "MED", "Nuno Baptista", 40),
  mk(114, "MED", "Carlos Esteves", 39),
  mk(115, "ATA", "Mário Lopes", 45),
  mk(116, "ATA", "Pedro Xavier", 43),
];
const fixture = {
  homeTeamId: 1,
  awayTeamId: 2,
  homeScore: 2,
  awayScore: 0,
  homePossession: 58,
  awayPossession: 42,
  attendance: 12480,
  referee: { refereeName: "João Tavares", balance: 55 },
  _t1: { formation: "4-3-3", style: "Equilibrado" },
  _t2: { formation: "4-4-2", style: "Defensivo" },
  homeLineup: squad.map((p) => ({
    ...p,
    is_starter: starterIds.includes(p.id),
    matchMinutes: starterIds.includes(p.id) ? 45 : 0,
    fatigueLoss: starterIds.includes(p.id) ? 2 : 0,
  })),
  awayLineup: oppSquad.map((p, i) => ({
    ...p,
    is_starter: i < 11,
    matchMinutes: i < 11 ? 45 : 0,
  })),
  events: [
    { minute: 0, type: "phase_start", text: "A 1.ª parte começou!" },
    { minute: 12, type: "yellow", playerName: "João Santos", playerId: 3 },
    { minute: 23, type: "goal", playerName: "Ricardo Gomes", playerId: 11 },
    { minute: 31, type: "goal", playerName: "Vasco Pinto", playerId: 12 },
    { minute: 38, type: "injury", playerName: "Bruno Costa", playerId: 9 },
    { minute: 45, type: "phase_start", text: "Intervalo." },
  ],
};

const teams = [
  { id: 1, name: "FC Atlântico", color_primary: "#e11d48" },
  { id: 2, name: "SC Foz do Douro", color_primary: "#2563eb" },
];

/* ── GR improvisado (emergency_gk) — último GR sai sem GR no banco ───── */
// O GR titular (1) é expulso; sem GR no banco: escolhe-se em campo quem vai
// para a baliza (onPitch = 10 jogadores de campo; banco informativo, sem GR).
const emergencyOnPitch = squad.filter(
  (p) => starterIds.includes(p.id) && p.id !== 1,
);
const emergencyBench = squad.filter(
  (p) => !starterIds.includes(p.id) && p.id !== 14,
);
const emergencyAction = {
  type: "emergency_gk",
  actionId: "emg-1",
  teamId: 1,
  injuredPlayer: mk(1, "GR", "Rui Costa", 38),
  onPitch: emergencyOnPitch,
  benchPlayers: emergencyBench,
};

/* ── Lesão do último GR com reposição (incomingBecomesGK) ─────────────── */
// O GR titular lesionado sai e o substituto escolhido calça as luvas — a UI
// avisa com o badge de GR improvisado.
const injuryBecomesGKAction = {
  type: "injury",
  actionId: "inj-1",
  teamId: 1,
  injuredPlayer: mk(1, "GR", "Rui Costa", 38),
  incomingBecomesGK: true,
  benchPlayers: emergencyBench,
};

const SCENARIOS = {
  halftime: {
    label: "Intervalo",
    mode: "halftime",
    matchAction: null,
    injuryCountdown: null,
  },
  emergency: {
    label: "GR improvisado",
    mode: "live",
    matchAction: emergencyAction,
    injuryCountdown: 37,
  },
  injuryBecomesGK: {
    label: "Lesão → GR",
    mode: "live",
    matchAction: injuryBecomesGKAction,
    injuryCountdown: 24,
  },
};

function Harness() {
  const [scenario, setScenario] = useState("halftime");
  const s = SCENARIOS[scenario];
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-surface-container-low">
      {/* Seletor de cenários (só para o harness) — não faz parte da app. */}
      <div className="shrink-0 flex gap-1 px-2 py-1 bg-surface-container-high border-b border-outline-variant/20">
        {Object.entries(SCENARIOS).map(([key, { label }]) => (
          <button
            key={key}
            type="button"
            onClick={() => setScenario(key)}
            className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors ${
              scenario === key
                ? "bg-emerald-500/20 text-emerald-300"
                : "text-on-surface-variant/60 hover:text-on-surface-variant"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <IntervencaoView
        mode={s.mode}
        fixture={fixture}
        liveMinute={s.mode === "halftime" ? 45 : 63}
        teams={teams}
        myTeamId={1}
        isCupMatch={false}
        isCupExtraTime={false}
        matchAction={s.matchAction}
        injuryCountdown={s.injuryCountdown}
        tactic={tactic}
        onUpdateTactic={noop}
        annotatedSquad={squad}
        subbedOut={[8]}
        confirmedSubs={[{ out: 8, in: 16 }]}
        subsMade={1}
        swapSource={null}
        swapTarget={null}
        onSelectOut={noop}
        onSelectIn={noop}
        onConfirmSub={noop}
        onResetSub={noop}
        onUndoSub={noop}
        onResetAllSubs={noop}
        redCardedHalftimeIds={new Set()}
        injuredHalftimeIds={new Set()}
        onResolveAction={noop}
      />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Harness />);

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
  // Click the Substituições tab, then pick an out-player so the bench page
  // comes to the front (stack flip) — measuring the richer state.
  const buttons = document.querySelectorAll("button");
  const subsTab = [...buttons].find((b) => b.textContent?.trim() === "Substituições");
  if (subsTab) subsTab.click();
  setTimeout(() => {
    const card = [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Bruno Costa"),
    );
    if (card) card.click();
    setTimeout(() => {
      const report = measure();
      const el = document.getElementById("report");
      el.setAttribute("data-status", "done");
      el.textContent = "REPORT:" + JSON.stringify(report, null, 2);
    }, 900);
  }, 600);
}, 2500);
