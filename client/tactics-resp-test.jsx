// TacticsView harness — renders the REAL TacticsView com um plantel de teste
// (11 titulares + banco + lesionado) dentro do GameProvider + TacticsProvider reais.
// NOT part of the app;
// used only for mobile responsiveness verification (see .pi/skills/mobile-resp-check).
import { createRoot } from "react-dom/client";
import { useEffect } from "react";
/* eslint-disable react-refresh/only-export-components -- harness de teste sem exports */
import "./src/index.css";
import { GameContext, GameProvider, useGame } from "./src/contexts/GameContext.jsx";
import { TacticsProvider } from "./src/contexts/TacticsContext.jsx";
import { TacticsView } from "./src/views/TacticsView.jsx";

const noop = () => {};

/* Minimal auth bridge — no backend in the harness, so state stays at its
 * initial (empty) values. All context accesses to `me` are optional-chained. */
const meFixture = { name: "", teamId: 1, roomCode: "TEST01" };

/* Fixture do próximo jogo (liga) — alimenta o cartão sob o botão JOGAR e o
 * Moral/Mentalidade do TOPO. Nome comprido para testar truncamento. */
const nextMatchFixture = {
  matchweek: 6,
  isCup: false,
  venue: "Casa",
  opponent: {
    name: "As Voadores Do Sportinguismax Da Póvoa",
    color_primary: "#0f9d58",
    // Forma real do servidor (objeto) — em string o duelo nunca aparecia em produção.
    probableFormation: { formation: "4-3-3", captain: { id: 900, name: "Capitão Deles", lead: 2 }, players: [] },
  },
  referee: { name: "Fábio Veríssimo (AF Leiria)" },
};

/** Sobreposição do GameContext com o próximo jogo — o Provider real não
 * expõe o setter (o resumo chega por socket), por isso aninhamos um Provider
 * com o valor atual + fixture. */
function SeedNextMatch({ children }) {
  const value = { ...useGame(), nextMatchSummary: nextMatchFixture, nextMatchSummaryLoading: false };
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}


/* Plantel de teste: 11 titulares + 7 suplentes + 2 de fora, com os nomes mais
 * compridos e os estados difíceis (lesão, suspensão, estrela, júnior). */
const NAMES = [
  "Manuel José Carlos Ferreira", "Rui Pinto", "Alexandros Konstantinopoulos", "João",
  "Bruno Miguel Fernandes da Silva", "Tiago", "Duarte Faria", "Hélio Ramos",
  "Sérgio Tavares", "André Lopes", "Leandro Moura", "Nuno Martins", "Ricardo Gomes",
  "Vasco Pinto", "Ivo Cardoso", "Tomás Silva", "Pedro Miguel Fernandes Alves",
  "Santos", "Rocha", "Alves",
];
const POS = ["GR", "GR", "DEF", "DEF", "DEF", "DEF", "MED", "MED", "MED", "MED", "ATA", "ATA", "ATA", "DEF", "MED", "GR", "ATA", "MED", "DEF", "ATA"];
const SQUAD = NAMES.map((name, i) => ({
  id: i + 1, name, position: POS[i], nationality: "🇵🇹", skill: 30 + i, age: 20 + i, career_games: i * 6,
  form: 100, resistance: 3, morale: 25, aggressiveness: 50, value: 200000, wage: 8000,
  goals: 2, games_played: 12, is_star: i === 2, isJunior: i === 1, isUnavailable: false,
  transfer_status: "none", contract_start_epoch: 0, suspension_until_matchweek: 0,
  injury_until_matchweek: i === 15 ? 99 : 0, transfer_cooldown_until_matchweek: 0,
}));
// Titulares: 1 GR, 4 DEF, 4 MED, 2 ATA (4-4-2); suplentes: os 7 seguintes disponíveis.
const TIT = [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const SUB = [2, 13, 14, 15, 17, 18, 19];

/** Semeia plantel + 11 inicial + banco no GameContext (o Provider real não expõe o estado de fora). */
function SeedSquad() {
  const { setMySquad, setTactic } = useGame();
  useEffect(() => {
    setMySquad(SQUAD);
    setTactic((t) => ({
      ...t,
      formation: "4-4-2",
      pressure: "ALTA",
      // Duas ordens: a linha mais longa (selects) tem de caber a 320px.
      orders: [
        { minute: 70, when: "LOSING", style: "Offensive", pressure: "ALTA" },
        { minute: 80, when: "WINNING", style: "Defensive", pressure: "BAIXA" },
      ],
      positions: Object.fromEntries([
        ...TIT.map((id) => [id, "Titular"]),
        ...SUB.map((id) => [id, "Suplente"]),
        ...SQUAD.filter((p) => !TIT.includes(p.id) && !SUB.includes(p.id)).map((p) => [p.id, "Excluído"]),
      ]),
    }));
  }, [setMySquad, setTactic]);
  return null;
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
    <SeedNextMatch>
      <TacticsProvider>
        <SeedSquad />
        <div className="min-h-screen bg-surface p-4 lg:p-6">
          <TacticsView />
        </div>
      </TacticsProvider>
    </SeedNextMatch>
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
  const report = measure();
  const el = document.getElementById("report");
  el.setAttribute("data-status", "done");
  el.textContent = "REPORT:" + JSON.stringify(report, null, 2);
}, 2900);
