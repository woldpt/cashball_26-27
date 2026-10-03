// ClubTab mobile responsiveness harness — renders the REAL ClubTab
// with edge-case fixture data and self-reports overflow measurements.
// NOT part of the app; used only for verification.
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { ClubTab } from "./src/views/ClubTab.jsx";

// ── Fixture: edge cases ────────────────────────────────────────────────────
// - saldo negativo (DÉFICE, cores error) + dívida ativa
// - moral baixa (BAIXO) + nome de equipa longo
// - palmarés com títulos longos (wrap) + jornal em 2 épocas
const teamInfo = {
  id: 1,
  name: "FC Porto de Leixões",
  color_primary: "#e11d48",
  color_secondary: "#ffffff",
  division: 1,
  morale: 32,
  fans_mood: 45, // banda alta: exercita tochas + bandeiras na imagem
  stadium_name: "Estádio do Dragão Norte",
  stadium_capacity: 15000,
  // Camisola clara + nome de patrocinador no pior caso (25 caracteres) para
  // medir o patch do `TeamKit` no tamanho real.
  crest: "/logos/estoril.png",
  sponsorBrand: {
    sponsorId: "irmaos-unidos",
    name: "Serralharia Irmãos Unidos",
    short: "Irmãos Unidos",
    bg: "#475569",
    fg: "#ffffff",
    glyph: "IU",
    shape: 0,
  },
};

const me = { id: "coach-1", teamId: 1, name: "Treinador Teste" };

// Funcionários: pior caso do layout — 3 papéis (um deles sem catálogo no
// cliente, a exercer o fallback), 1 contratado com nome comprido, lugares
// livres e saldo para contratar (rótulo longo no botão).
const staff = {
  roles: ["auxiliar", "fisico", "medico"],
  slots: 3,
  used: 1,
  maxLevel: 5,
  salaries: [3000, 6000, 12000, 24000, 48000],
  signingWeeks: 4,
  severanceWeeks: 2,
  budget: 1000000,
  salaryWeekly: 48000,
  previews: {
    auxiliar: [{ trainingPct: 8 }, { trainingPct: 16 }, { trainingPct: 24 }, { trainingPct: 32 }, { trainingPct: 40 }],
    fisico: [
      { restedForm: 0, resistance: 0.5, decayPct: 8 },
      { restedForm: 1, resistance: 1, decayPct: 16 },
      { restedForm: 1, resistance: 1.5, decayPct: 24 },
      { restedForm: 2, resistance: 2, decayPct: 32 },
      { restedForm: 2, resistance: 2.5, decayPct: 40 },
    ],
  },
  members: [
    {
      role: "auxiliar",
      level: 5,
      name: "Prof. Doutor Joaquim Cabrita da Silva",
      salaryWeekly: 48000,
      hiredSlot: 3,
      effect: { trainingPct: 40 },
      severance: 96000,
    },
  ],
};

const palmares = {
  trophies: [
    {
      achievement: "Campeão da Primeira Liga",
      season: "2024/25",
      coach_name: "João Silva Ferreira",
      is_human_coach: true,
    },
    { achievement: "Melhor Marcador", season: "2023/24" },
    { achievement: "Taça de Portugal", season: "2022/23" },
  ],
};

const clubNews = [
  {
    id: "n1",
    year: 2026,
    type: "transfer_in",
    title: "Contratado: Miguel Ângelo Sousa de Matos (extremo ofensivo)",
    related_team_name: "SL Benfica de Lisboa",
    amount: 450000,
  },
  {
    id: "n2",
    year: 2026,
    type: "transfer_out",
    title: "Venda: Rui Ferreira (defesa central)",
    related_team_name: "Sporting Clube de Portugal",
    amount: 320000,
  },
  { id: "n3", year: 2026, type: "prize", title: "Prémio de presença na Taça", matchweek: 4, amount: 75000 },
  { id: "n4", year: 2026, type: "weekly_income", title: "Rendimento semanal aplicado", matchweek: 6, amount: 180000 },
  {
    id: "n5",
    year: 2025,
    type: "transfer_in",
    title: "Contratado: André Vasconcelos (médio centro)",
    related_team_name: "SC Braga de Guimarães",
    amount: 280000,
  },
  { id: "n6", year: 2025, type: "prize", title: "Prémio de campeão", matchweek: 14, amount: 500000 },
];

const root = createRoot(document.getElementById("root"));
root.render(
  // Mimics the GameLayout mobile container: <main> > div.p-4 > tab content
  <div className="min-h-screen bg-surface">
    <div className="p-4 lg:p-6">
      <ClubTab
        teamInfo={teamInfo}
        seasonYear={2026}
        me={me}
        currentBudget={-125000}
        totalWeeklyWage={320000}
        loanAmount={450000}
        palmaresTeamId={1}
        palmares={palmares}
        clubNews={clubNews}
        staff={staff}
        staffPending={false}
        onHireStaff={() => {}}
        onFireStaff={() => {}}
      />
    </div>
  </div>,
);

// Pior caso dos botões: sobe o nível do papel por preencher ao 5 (o rótulo
// "Contratar · 192.000 €" é o mais comprido) antes de medir.
setTimeout(() => {
  const groups = [...document.querySelectorAll('[role="group"][aria-label^="Nível do"]')];
  const buttons = groups[0]?.querySelectorAll("button");
  buttons?.[buttons.length - 1]?.click();
}, 800);

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
