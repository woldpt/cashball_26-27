// MatchView (modo spectate) harness — renders the REAL MatchView with
// spectate=true (jogo alheio: placar broadcast + dual-pitch, sem bancos).
// NOT part of the app; used only for design screenshots/verification.
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { MatchView } from "./src/components/match/tabs/MatchView.jsx";

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
    matchMinutes: 58,
    fatigue: 61,
    fatigueLoss: 0,
    ...extra,
  };
}

/* ── Casa (id 7) — 4-3-3, nomes longos a propósito (edge case truncation) ── */
const homeSquad = [
  mk(101, "GR", "Rui Costa", 38),
  mk(102, "DEF", "Miguel Ferreira", 44),
  mk(103, "DEF", "João Pedro Fernandes dos Santos", 46, { is_star: true }),
  mk(104, "DEF", "Pedro Alves", 42),
  mk(105, "DEF", "Diogo Rocha", 43),
  mk(106, "MED", "Rui Oliveira", 48, { is_star: true }),
  mk(107, "MED", "Tiago Pereira", 45),
  mk(108, "MED", "Bruno Costa", 47),
  mk(109, "ATA", "Ricardo Gomes", 52, { is_star: true }),
  mk(110, "ATA", "Vasco Pinto", 49),
  mk(111, "ATA", "Ivo Cardoso", 47),
  mk(112, "GR", "Tomás Silva", 33),
  mk(113, "DEF", "André Lopes", 39),
  mk(114, "MED", "Fábio Nunes", 46),
  mk(115, "ATA", "Duarte Faria", 48),
];

/* ── Fora (id 8) — 4-4-2 ─────────────────────────────────────────────── */
const awaySquad = [
  mk(201, "GR", "Marcos Vieira", 37),
  mk(202, "DEF", "Rui Barros", 44),
  mk(203, "DEF", "Tiago Neves", 42),
  mk(204, "DEF", "Paulo Cruz", 41),
  mk(205, "DEF", "Sérgio Dias", 40),
  mk(206, "MED", "Filipe Amaral", 46),
  mk(207, "MED", "Gonçalo Reis", 44),
  mk(208, "MED", "Vitor Hugo", 43),
  mk(209, "MED", "Duarte Melo", 42),
  mk(210, "ATA", "Renato Sousa", 49),
  mk(211, "ATA", "Igor Machado", 47),
  mk(212, "DEF", "Hugo Furtado", 38),
  mk(213, "MED", "Nuno Baptista", 40),
  mk(214, "ATA", "Mário Lopes", 45),
];

const starterFlag = (i) => i < 11;

const fixture = {
  homeTeamId: 7,
  awayTeamId: 8,
  homeScore: null, // o placar deriva dos eventos até liveMinute
  awayScore: null,
  homePossession: 54,
  awayPossession: 46,
  attendance: 18240,
  referee: { refereeName: "João Tavares", balance: 55 },
  _t1: { formation: "4-3-3", style: "Equilibrado" },
  _t2: { formation: "4-4-2", style: "Defensivo" },
  homeLineup: homeSquad.map((p, i) => ({
    ...p,
    is_starter: starterFlag(i),
    matchMinutes: starterFlag(i) ? 58 : 0,
    fatigue: starterFlag(i) ? 61 : 42,
  })),
  awayLineup: awaySquad.map((p, i) => ({
    ...p,
    is_starter: starterFlag(i),
    matchMinutes: starterFlag(i) ? 58 : 0,
    fatigue: starterFlag(i) ? 64 : 39,
  })),
  events: [
    { minute: 0, type: "phase_start", text: "A 1.ª parte começou!" },
    { minute: 2, type: "weather", text: "A chover a pingas no estádio." },
    { minute: 18, type: "goal", team: "home", playerName: "Ricardo Gomes", playerId: 109 },
    { minute: 24, type: "yellow", team: "away", playerName: "Paulo Cruz", playerId: 204 },
    { minute: 39, type: "goal", team: "away", playerName: "Renato Sousa", playerId: 210 },
    { minute: 45, type: "phase_start", text: "Intervalo." },
    {
      minute: 47,
      team: "home",
      type: "substitution",
      playerName: "Fábio Nunes",
      playerId: 114,
      subOutName: "Ivo Cardoso",
      subOutId: 111,
    },
    { minute: 51, type: "goal", team: "away", playerName: "Mário Lopes", playerId: 214 },
  ],
};

const teams = [
  { id: 7, name: "SC Ultramarino de Portimão", color_primary: "#e11d48" },
  { id: 8, name: "FC Belenense da Marginal", color_primary: "#2563eb" },
];

createRoot(document.getElementById("root")).render(
  // Replica a estrutura vertical real do MatchPage (header 57px + painel).
  <div className="h-screen w-screen flex flex-col overflow-hidden bg-surface-container-low">
    <div className="h-[57px] shrink-0 border-b border-outline-variant/40 bg-surface px-4 flex items-center gap-2 lg:h-[73px]">
      <span className="material-symbols-outlined !text-lg text-brand-primary">
        sports_soccer
      </span>
      <div className="min-w-0">
        <p className="font-headline font-bold uppercase leading-tight truncate">
          Jogo Alheio
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant leading-tight truncate">
          Matchweek 58
        </p>
      </div>
      <span className="ml-auto flex items-center gap-1 rounded-md border border-brand-primary/40 bg-brand-primary/10 px-2 py-1 text-[11px] font-black uppercase tracking-wider text-brand-primary">
        <span className="w-2 h-2 rounded-full animate-pulse bg-brand-primary" />
        Ao Vivo · 58'
      </span>
    </div>

    <MatchView
      fixture={fixture}
      liveMinute={58}
      teams={teams}
      isCupMatch={false}
      cupMatchRoundName={null}
      showFatigue={false}
      spectate
    />
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
