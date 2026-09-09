// Briefing harness — renders the REAL briefing blocks (populated view-model
// with edge-case fixture data: long names, cup penalties LC, volcano stadium)
// with the same composition as MatchBriefing. The orchestrator itself reads
// live socket state, so the harness composes the pure blocks directly.
// NOT part of the app; used only for mobile responsiveness verification
// (see .pi/skills/mobile-resp-check).
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { PrimaryCTA } from "./src/components/shared/PrimaryCTA.jsx";
import {
  buildBriefingViewModel,
  NextMatchCard,
  DifficultyGauge,
  StadiumCard,
  OpponentFormation,
  ThreatGrid,
  PrepStepper,
} from "./src/components/live/briefing/index.js";

const noop = () => {};

const summaryFixture = {
  venue: "Fora",
  isCup: true,
  cupRoundName: "Meias-finais da Taça de Portugal",
  headline:
    "Dérbi escaldante no Jamor com casa cheia: tudo em aberto nesta eliminatória longa e imprevisível.",
  stakes: "Um lugar na final em jogo",
  difficulty: { score: 88, label: "Infernal" },
  team: {
    id: 1,
    name: "Clube Desportivo de Vila Nova de Famalicão do Sul",
    position: 3,
    points: 41,
    avgSkill: 73,
    last5: "VVEVD",
    wins: 12,
    draws: 5,
    losses: 3,
  },
  opponent: {
    id: 9,
    name: "Associação Recreativa e Cultural de São Martinho do Campo",
    position: 1,
    points: 47,
    goalsFor: 52,
    goalsAgainst: 19,
    color_primary: "#b91c1c",
    morale: 91,
    wins: 15,
    draws: 2,
    losses: 1,
    avgSkill: 79,
    last5: "VVVVV",
    lastConfrontation: {
      result: "E",
      competition: "cup",
      cupRoundName: "Quartos-de-final",
      goalsFor: 2,
      goalsAgainst: 2,
      penalties: { goalsFor: 5, goalsAgainst: 4 },
      venue: "Jamor",
      season: 2,
    },
    threats: [
      { role: "goleador", name: "Cristiano Alexandre Barbosa de Almeida", skill: null, form: null, goals: 23 },
      { role: "qualidade", name: "João Pedro", skill: 88, form: 81, goals: null },
      { role: "forma", name: "Miguel Ângelo", skill: 76, form: 97, goals: null },
    ],
    probableFormation: {
      formation: "4-3-3",
      players: [
        { name: "Guarda Redes Longo", position: "GR", skill: 80 },
        { name: "Defesa Um", position: "DEF", skill: 78 },
        { name: "Defesa Dois", position: "DEF", skill: 79 },
        { name: "Defesa Três", position: "DEF", skill: 77 },
        { name: "Defesa Quatro", position: "DEF", skill: 81 },
        { name: "Médio Um", position: "MED", skill: 82 },
        { name: "Médio Dois", position: "MED", skill: 80 },
        { name: "Médio Três", position: "MED", skill: 79 },
        { name: "Avançado Esquerdo", position: "ATA", skill: 86 },
        { name: "Avançado Centro", position: "ATA", skill: 88 },
        { name: "Avançado Direito", position: "ATA", skill: 84 },
      ],
    },
  },
  odds: { home: "1.85", draw: "3.60", away: "4.20" },
  referee: { name: "Artur Manuel Ribeiro Soares Dias" },
  weatherForecast: { condition: "chuva_forte", emoji: "⛈️" },
  stadium: {
    expectedAttendance: 38250,
    capacity: 39000,
    occupancyPct: 98,
    revenue: 287500,
    reasons: ["Dérbi regional", "Bom momento da equipa"],
  },
};

const teamInfoFixture = {
  id: 1,
  name: "Clube Desportivo de Vila Nova de Famalicão do Sul",
  points: 41,
  goals_for: 44,
  goals_against: 21,
  morale: 66,
  wins: 12,
  draws: 5,
  losses: 3,
  avgSkill: 73,
};

const vm = buildBriefingViewModel(summaryFixture, teamInfoFixture);

createRoot(document.getElementById("root")).render(
  <div className="min-h-screen bg-surface p-4">
    {/* Mesma composição do MatchBriefing (herói + confronto + scouting) */}
    <div className="space-y-3">
      <div className="bg-surface-container border border-outline-variant/25 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-outline-variant/15">
          <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">
            📋 Briefing da Jornada
          </span>
          <PrepStepper current="briefing" />
        </div>
        <div className="px-4 py-3 flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-6">
          <div className="flex-1 min-w-0">
            <p className="text-sm lg:text-base font-bold text-white leading-snug line-clamp-4 lg:line-clamp-2">
              {vm.headline}
            </p>
            {vm.stakes && (
              <span className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/5 border border-outline-variant/25 text-gray-300">
                🎯 {vm.stakes}
              </span>
            )}
          </div>
          <div className="lg:w-44 shrink-0">
            <DifficultyGauge score={vm.difficulty.score} label={vm.difficulty.label} />
          </div>
          <div className="flex flex-col items-center gap-1">
            <PrimaryCTA onClick={noop}>Avançar para a Tática</PrimaryCTA>
            <span className="text-[9px] text-gray-600 font-bold">
              Podes voltar atrás a qualquer momento
            </span>
          </div>
        </div>
      </div>
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:flex-1">
        <div className="flex-1 min-w-0 lg:flex lg:flex-col">
          <NextMatchCard vm={vm} onOpenTeamSquad={noop} />
        </div>
        <div className="lg:w-72 shrink-0 flex flex-col gap-3 lg:h-full">
          <StadiumCard stadium={vm.stadium} />
          <OpponentFormation formation={vm.formation} teamColor={vm.opponentColor} />
          <ThreatGrid threats={vm.threats} />
        </div>
      </div>
    </div>
  </div>,
);

function measure() {
  const vw = window.innerWidth;
  const doc = document.documentElement;
  const pageOverflow = doc.scrollWidth - vw;
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
