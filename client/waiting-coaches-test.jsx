// WaitingCoachesModal harness — renders the REAL modal (estado de espera
// multiplayer, pré-jogo e intervalo) com contexto fabricado e mede a geometria
// do card vs. viewport em retrato e landscape. NOT part of the app.
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { GameContext } from "./src/contexts/GameContext.jsx";
import { WaitingCoachesModal } from "./src/components/modals/WaitingCoachesModal.jsx";

const COACHES = [
  "Coach Longuitudesupergrande Almeida",
  "Ricardo",
  "Miguel",
  "Diogo",
  "Filipe",
  "Nuno",
  "Vasco",
  "Sérgio",
  "Rui",
  "Bruno",
];

const players = COACHES.map((name, i) => ({
  name,
  teamId: i + 1,
  ready: i === 0,
  socketId: i === 0 ? "sock-me" : i === 1 ? "sock-2" : null,
}));

const teams = COACHES.map((name, i) => ({
  id: i + 1,
  name: `Equipa FC ${name.split(" ")[0]}`,
  color_primary: `hsl(${(i * 40) % 360} 60% 45%)`,
}));

const roomMessages = Array.from({ length: 30 }, (_, i) => ({
  id: i,
  coachName: COACHES[i % COACHES.length],
  message: `Mensagem de teste numero ${i} — texto suficientemente comprido para ocupar varias linhas e forçar o scroll do chat.`,
  timestamp: Date.now() - (30 - i) * 60000,
}));

const ctxValue = {
  teams,
  lockedCoaches: COACHES,
  awaitingCoaches: [],
  me: { name: "Coach Longuitudesupergrande Almeida" },
  roomMessages,
  chatInput: "",
  setChatInput: () => {},
  avatarSeed: "seed",
  coachAvatars: {},
  backendUrl: "",
};

createRoot(document.getElementById("root")).render(
  <GameContext.Provider value={ctxValue}>
    {/* Mimics GameLayout: modais fixos sobre um fundo com conteúdo */}
    <div className="min-h-screen bg-surface text-on-surface font-body">
      <div className="p-4">
        <p className="text-sm text-on-surface-variant">Fundo (espelho GameLayout)</p>
      </div>
      <WaitingCoachesModal
        players={players}
        visible
        onCancel={() => {}}
        canCancel
      />
    </div>
  </GameContext.Provider>,
);

const q = (s) => document.querySelector(s);
const rect = (el) => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    top: Math.round(r.top),
    bottom: Math.round(r.bottom),
    left: Math.round(r.left),
    right: Math.round(r.right),
    width: Math.round(r.width),
    height: Math.round(r.height),
  };
};

function measure() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // O backdrop do modal é o elemento fixed que contém o input do chat;
  // o card é o primeiro filho div desse backdrop.
  const backdrop = [...document.querySelectorAll("div")].find(
    (el) =>
      getComputedStyle(el).position === "fixed" &&
      el.querySelector('input[placeholder="Conversa rápida…"]'),
  );
  const card = backdrop?.querySelector("div");
  const cardR = rect(card);

  // Input do chat + botão enviar
  const input = q('input[placeholder="Conversa rápida…"]');
  const inputR = rect(input);

  // Cabeçalho (título) e rodapé (botão cancelar)
  const title = q("h2");
  const footerBtn = q("button");
  const titleR = rect(title);
  const footerR = rect(footerBtn);

  // Lista de coaches e área de mensagens
  const coachList = card?.querySelector(".divide-y");
  const chatList = q('input[placeholder="Conversa rápida…"]')?.closest("div")?.parentElement?.parentElement?.querySelector(".flex-1");
  const isFullyVisible = cardR && cardR.top >= -1 && cardR.bottom <= vh + 1;
  const inputVisible = !!inputR && inputR.top >= 0 && inputR.bottom <= vh + 1;
  const headerVisible = !!titleR && titleR.top >= 0 && titleR.bottom <= vh + 1;
  const footerVisible = !!footerR && footerR.top >= 0 && footerR.bottom <= vh + 1;

  return {
    viewport: { w: vw, h: vh },
    modalCard: cardR,
    modalFitsViewport: isFullyVisible,
    overflowTopPx: cardR && cardR.top < 0 ? Math.round(-cardR.top) : 0,
    overflowBottomPx: cardR && cardR.bottom > vh ? Math.round(cardR.bottom - vh) : 0,
    chatInputRect: inputR,
    chatInputVisible: inputVisible,
    modalHeaderVisible: headerVisible,
    modalFooterVisible: footerVisible,
    footerRect: footerR,
    chatListRect: rect(chatList),
    coachListRect: rect(coachList),
    pageOverflowPx: document.documentElement.scrollWidth - vw,
    verdict:
      isFullyVisible && inputVisible && headerVisible && footerVisible && cardR.width <= vw + 1
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