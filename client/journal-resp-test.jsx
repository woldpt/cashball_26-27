// JournalTab mobile responsiveness harness — renders the REAL JournalTab
// (inbox hub estilo CM2001) with edge-case fixture data and self-reports
// overflow measurements into #report. NOT part of the app; used only for
// verification.
//
// Contract (read by client/scripts/mobileRespCheck.mjs):
//   - render into #root
//   - after ~2500 ms write "REPORT:<json>" into <pre id="report"> and set
//     data-status="done"
//   - json must include: viewport, pageOverflowPx, clippedRows,
//     clippingElements, verdict ("PASS" | "FAIL")
//
// Além do layout, verifica um contrato de comportamento: o badge do Jornal
// (GameLayout) e a lista (JournalTab) são duas instâncias de `useInbox` e têm
// de ver as mesmas leituras — abrir uma notícia baixa o número nos dois.
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { GameContext } from "./src/contexts/GameContext.jsx";
import { JournalTab } from "./src/views/JournalTab.jsx";
import { useInbox } from "./src/hooks/useInbox.js";

const noop = () => {};

// ── Fixture data: edge cases ────────────────────────────────────────────────
// Nomes compridos, todas as categorias do hub, duas bandeiras vermelhas
// (renovação + convite) que bloqueiam o Pronto, aviso da direção, sorteio
// da Taça com o meu jogo, humor pós-jogo, lesionado + castigado, mercado.
const me = {
  name: "Treinador Principal Joaquim Fernando Alves",
  teamId: 1,
  roomCode: "TEST01",
};

const contractQueue = [
  {
    mode: "confirm",
    kind: "contract",
    playerId: 11,
    phase: "proposal",
    title: "Agente do Jogador — Rui Figueiredo do Nascimento e Silva",
    description:
      "📞 Jorge Mendes dos Santos Pereira ligou em pânico: Rui Figueiredo do Nascimento e Silva anda a olhar para vitrinas de troféus que não são as tuas! Exige €12.500/sem.",
  },
  {
    mode: "confirm",
    kind: "contract",
    playerId: 22,
    phase: "proposal",
    title: "Contra-proposta — Abel Moniz Barreto de Vasconcelos e Sá",
    description:
      "🤨 O agente diz que a tua oferta é \"um insulto à profissão\". Abel Moniz Barreto de Vasconcelos e Sá exige €18.750/sem. Aceitas ou vai brilhar no leilão?",
  },
];

const jobOfferModal = {
  toTeam: {
    id: 5,
    name: "Real Desportivo Atlético de Santa Maria da Feira",
    division: 1,
    points: 30,
    wins: 10,
    draws: 0,
    losses: 2,
  },
  toTeamDivisionPosition: 1,
};

const boardWarning = { level: 3, budget: -1250000, streak: 3 };

const cupDraw = {
  season: 2026,
  roundName: "Oitavos de final",
  // Sorteio foi na semana 5 (a semana atual da fixture é a 13): a data do
  // item tem de ficar na semana do sorteio, não na atual.
  drawWeek: 4,
  drawMatchweek: 5,
  year: 2026,
  humanInCup: true,
  fixtures: [
    {
      homeTeam: { id: 1, name: "Real Desportivo Atlético de Santa Maria da Feira" },
      awayTeam: { id: 4, name: "F.C. Atlântico Norte" },
    },
    {
      homeTeam: { id: 2, name: "Sporting Clube do Alentejo Central" },
      awayTeam: { id: 5, name: "Clube Desportivo do Litoral" },
    },
  ],
};

const postMatchMood = {
  key: "league:2026:12",
  outcome: "loss",
  variant: "loss_shameful",
  opponentName: "Associação Desportiva do Farol da Barra de Aveiro",
  myGoals: 0,
  oppGoals: 3,
  source: "league",
  roundLabel: "Liga · Jornada 12",
  ticketRevenue: 123456,
};

const mySquad = [
  { id: 11, name: "Rui Figueiredo do Nascimento e Silva", injury_until_matchweek: 0, suspension_until_matchweek: 0 },
  { id: 31, name: "Sérgio Andrade", injury_until_matchweek: 14, suspension_until_matchweek: 0 },
  { id: 44, name: "Pedro Lameira e Costa Pereira", injury_until_matchweek: 0, suspension_until_matchweek: 13 },
];

const globalNews = {
  news: [
    {
      id: 1,
      source: "transfer",
      type: "market",
      player_id: 701,
      player_name: "Joaquim Fernando Alves da Silva Camara Pereira",
      player_position: "ATA",
      seller_team_id: 101,
      seller_team_name: "Real Desportivo Atlético de Santa Maria da Feira",
      buyer_team_id: 202,
      buyer_team_name: "Sporting Clube do Alentejo Central",
      title:
        "Joaquim Fernando Alves da Silva Camara Pereira · Real Desportivo Atlético de Santa Maria da Feira → Sporting Clube do Alentejo Central",
      description: "Avançado",
      amount: 4850000,
      matchweek: 12,
    },
    {
      id: 5,
      source: "club",
      type: "prize",
      title: "Prémio de Melhor Marcador",
      description: "Abel Moniz Barreto de Vasconcelos e Sá",
      amount: 500000,
      matchweek: 12,
    },
    {
      id: 6,
      source: "club",
      type: "cup_upset",
      title: "Tomba-gigantes: F.C. Atlântico Norte elimina Sporting Clube do Alentejo Central",
      description: "Oitavos de final · 3.ª divisão vence 1.ª divisão · 2–1",
      amount: null,
      matchweek: 12,
    },
    {
      id: 7,
      source: "club",
      type: "manager_dismissed",
      title: "Clube Desportivo do Litoral despediu o seu treinador",
      description: "",
      amount: null,
      matchweek: 11,
    },
    {
      id: 9,
      source: "club",
      type: "postmatch",
      team_id: 1,
      team_name: "União Desportiva do Vale",
      title: "Rescaldo: União Desportiva do Vale 2–1 F.C. Atlântico Norte",
      description: JSON.stringify({
        v: 1,
        key: "league:2026:11",
        source: "league",
        outcome: "win",
        myGoals: 2,
        oppGoals: 1,
        opponentTeamId: 4,
        opponentName: "F.C. Atlântico Norte",
        roundLabel: "Liga · Jornada 11",
        ticketRevenue: 98765,
        myDivision: 2,
        opponentDivision: 2,
        opponentRank: 5,
        opponentTeamCount: 8,
      }),
      related_team_id: 4,
      related_team_name: "F.C. Atlântico Norte",
      amount: 98765,
      matchweek: 11,
      year: 2026,
    },
    {
      id: 8,
      source: "club",
      type: "loan_take",
      title: "Empréstimo Bancário",
      description: "€500.000 a 1,5%/semana",
      amount: 500000,
      matchweek: 10,
    },
  ],
  results: [],
};

const gameValue = {
  seasonYear: 2026,
  me,
  contractQueue,
  focusContractDialog: noop,
  jobOfferModal,
  setJobOfferModal: noop,
  boardWarning,
  setBoardWarning: noop,
  cupDraw,
  setShowCupDrawPopup: noop,
  postMatchMood,
  globalNews,
  mySquad,
  calendarIndex: 12,
};

/** Segundo consumidor de `useInbox` — faz de badge do Jornal no GameLayout. */
// eslint-disable-next-line react-refresh/only-export-components -- harness, não app
function BadgeProbe() {
  const { unreadCount } = useInbox();
  return (
    <span data-testid="inbox-badge" className="font-black">
      {unreadCount}
    </span>
  );
}

// Leituras guardadas de corridas anteriores tornariam a contagem inicial
// imprevisível (o browser do teste pode reutilizar o perfil).
try {
  for (const k of Object.keys(window.localStorage)) {
    if (k.startsWith("cashball_inbox_read:")) window.localStorage.removeItem(k);
  }
} catch {
  /* sem armazenamento: o store arranca vazio de qualquer forma */
}

const root = createRoot(document.getElementById("root"));
root.render(
  // Mimics the GameLayout mobile container: <main> > div.p-4 > tab content
  <GameContext.Provider value={gameValue}>
    <div className="min-h-screen bg-surface">
      <div className="p-4 lg:p-6">
        <BadgeProbe />
        <JournalTab />
      </div>
    </div>
  </GameContext.Provider>,
);

const badgeText = () =>
  Number(document.querySelector('[data-testid="inbox-badge"]')?.textContent);

/** A pesquisa deve filtrar a lista enquanto se escreve. */
async function checkQuickSearch() {
  const input = document.querySelector("#journal-topic-search");
  const setValue = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  ).set;
  const initialCount = document.querySelectorAll("ol button").length;
  setValue.call(input, "Contas bancárias");
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
  const filteredRows = [...document.querySelectorAll("ol button")];
  const filtered =
    filteredRows.length === 1 &&
    filteredRows[0].textContent.includes("Contas bancárias");
  setValue.call(input, "");
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
  return {
    initialCount,
    filteredCount: filteredRows.length,
    ok: !!input && initialCount > 1 && filtered,
  };
}

/** Texto completo do detalhe (o corpo sai em vários <p> desde o redesign). */
const detailBody = () =>
  [...
    document.querySelectorAll('section[aria-label="Corpo da notícia"] p'),
  ]
    .map((p) => p.textContent)
    .join("\n\n");

/** A reacção pós-jogo deve ter contexto editorial completo. */
async function checkMoodArticle() {
  const row = [...document.querySelectorAll("ol button")].find((b) =>
    b.textContent.includes("Derrota Vergonhosa 0–3"),
  );
  row?.click();
  // O detalhe anima saída+entrada (~180ms cada, AnimatePresence mode="wait")
  await new Promise((r) => setTimeout(r, 500));
  const body = detailBody();
  const transientOk =
    !!row &&
    (body?.length || 0) > 500 &&
    body?.includes("Associação Desportiva do Farol") &&
    body?.includes("bilheteira") &&
    body?.includes("apito final");
  // Rescaldo persistido de jogo anterior: tem de aparecer na lista com o
  // editorial reconstruído (o histórico já não se apaga a cada jogo).
  const savedRow = [...document.querySelectorAll("ol button")].find((b) =>
    b.textContent.includes("Vitória! 2–1"),
  );
  savedRow?.click();
  await new Promise((r) => setTimeout(r, 500));
  const savedBody = detailBody();
  const savedOk =
    !!savedRow &&
    (savedBody?.length || 0) > 500 &&
    savedBody?.includes("F.C. Atlântico Norte") &&
    savedBody?.includes("Jornada 11");
  return {
    bodyLength: body?.length || 0,
    savedBodyLength: savedBody?.length || 0,
    ok: transientOk && savedOk,
  };
}

/** O sorteio mostra a semana em que saiu + a listagem de todos os pares. */
async function checkDrawDate() {
  const row = [...document.querySelectorAll("ol button")].find((b) =>
    b.textContent.includes("Sorteio:"),
  );
  const date = row?.querySelector("span")?.textContent;
  row?.click();
  await new Promise((r) => setTimeout(r, 500));
  const body = detailBody();
  const listsAll =
    (body || "").includes("O seu jogo:") &&
    (body || "").includes("Sporting Clube do Alentejo Central") &&
    (body || "").includes("Clube Desportivo do Litoral");
  return {
    date: date || null,
    listsAll,
    ok: !!row && date === "S5/2026" && listsAll,
  };
}

/** Abrir uma notícia no JournalTab tem de baixar o badge no outro consumidor. */
async function checkSharedReads() {
  const before = badgeText();
  const initialRow = [...document.querySelectorAll("ol button")].find((b) =>
    b.textContent.includes("Contas bancárias"),
  );
  // A notícia mais antiga começa seleccionada mas continua por ler
  // (só o clique marca como lida).
  const initialIsUnread = initialRow
    ?.querySelector("span.min-w-0")
    ?.className.includes("font-black");
  // Uma linha seguinte sem bandeira vermelha — clicar nela deve baixar o
  // badge partilhado entre o Jornal e o GameLayout.
  const row = [...document.querySelectorAll("ol button")].find((b) =>
    b.textContent.includes("Clube Desportivo do Litoral despediu"),
  );
  row?.click();
  await new Promise((r) => setTimeout(r, 60));
  const after = badgeText();
  return {
    before,
    after,
    initialIsUnread,
    clicked: !!row,
    ok: initialIsUnread && !!row && before > 0 && after === before - 1,
  };
}

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
      excess: el.scrollWidth - el.clientWidth,
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

setTimeout(async () => {
  const report = measure();
  report.quickSearch = await checkQuickSearch();
  report.moodArticle = await checkMoodArticle();
  report.drawDate = await checkDrawDate();
  report.inboxBadge = await checkSharedReads();
  if (
    !report.quickSearch.ok ||
    !report.moodArticle.ok ||
    !report.drawDate.ok ||
    !report.inboxBadge.ok
  )
    report.verdict = "FAIL";
  const el = document.getElementById("report");
  el.setAttribute("data-status", "done");
  el.textContent = "REPORT:" + JSON.stringify(report, null, 2);
}, 2500);
