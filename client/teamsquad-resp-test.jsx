// OtherSquadsTab mobile responsiveness harness — renders the REAL
// OtherSquadsTab (perfil de clube: Resumo / Plantel / Jogos / História)
// with edge-case fixture data and reports overflow per tab.
// NOT part of the app; used only for verification.
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { OtherSquadsTab } from "./src/views/OtherSquadsTab.jsx";

function mk(id, position, name, extra = {}) {
  return {
    id,
    position,
    name,
    nationality: "🇵🇹",
    skill: 40,
    prev_skill: 38,
    age: 24,
    form: 100,
    resistance: 3,
    morale: 5 + ((id * 17) % 41),
    aggressiveness: 50,
    value: 200000,
    wage: 8000,
    goals: 5,
    games_played: 12,
    career_games: 40,
    career_goals: 18,
    red_cards: 1,
    career_reds: 2,
    injuries: 0,
    career_injuries: 1,
    is_star: false,
    isJunior: false,
    isUnavailable: false,
    transfer_status: "none",
    contract_start_epoch: 0,
    contract_request_pending: false,
    suspension_until_matchweek: 0,
    injury_until_matchweek: 0,
    transfer_cooldown_until_matchweek: 0,
    ...extra,
  };
}

// Clube visto de fora (perfil de adversário): sem emblema (monograma),
// nome comprido, treinador humano, estádio próprio.
const selectedTeam = {
  id: 7,
  name: "Futebol Clube do Porto de Leixões",
  division: 1,
  crest: "/logos/estoril.webp",
  color_primary: "#1d4ed8",
  color_secondary: "#ffffff",
  stadium_capacity: 15000,
  stadium_name: "Estádio do Dragão Norte",
  fans_mood: 12, // banda baixa: exercita faroeste na imagem do rival
  coach_name: "Treinador Adversário da Silva",
  coach_is_human: 1,
  coach_photo: null,
  // Camisola clara + nome de patrocinador no pior caso (mede o patch).
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

const teams = [
  { id: 1, points: 28, wins: 9, draws: 1, losses: 2, goals_for: 21, goals_against: 9, crest: "/logos/estoril.webp", name: "Sporting Clube de Portugal Oriental", division: 1, color_primary: "#16a34a", color_secondary: "#ffffff", stadium_name: "Estádio José Alvalade Oriental" },
  { id: 2, points: 26, wins: 8, draws: 2, losses: 2, goals_for: 22, goals_against: 10, crest: "/logos/academica.webp", name: "Sport Lisboa e Benfica de Lisboa", division: 1, color_primary: "#dc2626", color_secondary: "#ffffff", stadium_name: "Estádio da Luz" },
  { id: 3, points: 22, wins: 7, draws: 1, losses: 4, goals_for: 23, goals_against: 11, crest: "/logos/alverca.webp", name: "Club de Fútbol Universidad de Chile Andina", division: 1, color_primary: "#0ea5e9", color_secondary: "#ffffff", stadium_name: "Estádio Nacional de Chile" },
  { id: 4, points: 19, wins: 6, draws: 1, losses: 5, goals_for: 24, goals_against: 12, crest: "/logos/boavista.webp", name: "Boavista Futebol Clube do Bessa", division: 1, color_primary: "#111827", color_secondary: "#ffffff", stadium_name: "Estádio do Bessa" },
  { id: 5, points: 17, wins: 5, draws: 2, losses: 5, goals_for: 25, goals_against: 13, crest: "/logos/nacional.webp", name: "Clube Desportivo Nacional da Madeira", division: 1, color_primary: "#0369a1", color_secondary: "#ffffff", stadium_name: "Estádio da Madeira" },
  { id: 6, points: 15, wins: 4, draws: 3, losses: 5, goals_for: 26, goals_against: 14, crest: "/logos/vitoria.webp", name: "Vitória de Guimarães Futebol Clube", division: 1, color_primary: "#ffffff", color_secondary: "#000000", stadium_name: "Estádio D. Afonso Henriques" },
  { id: 7, points: 32, wins: 10, draws: 2, losses: 0, goals_for: 27, goals_against: 15, crest: "/logos/estoril.webp", name: "Futebol Clube do Porto de Leixões", division: 1, color_primary: "#1d4ed8", color_secondary: "#ffffff", stadium_name: "Estádio do Dragão Norte", sponsorBrand: { sponsorId: "irmaos-unidos", name: "Serralharia Irmãos Unidos", short: "Irmãos Unidos", bg: "#475569", fg: "#ffffff", glyph: "IU", shape: 0 } },
  { id: 8, points: 12, wins: 3, draws: 3, losses: 6, goals_for: 28, goals_against: 16, crest: "/logos/ac-viseu.webp", name: "Grupo Desportivo Estoril Praia da Linha", division: 1, color_primary: "#eab308", color_secondary: "#1f2937", stadium_name: "Estádio António Coimbra da Mota" },
];

// 3 jornadas jogadas; calendarIndex 7 = jornada 6 concluída (liga).
const calendarData = {
  year: 2026,
  calendarIndex: 7,
  fixtureSeeds: { 1: teams.map((t) => t.id) },
  leagueMatches: [
    { matchweek: 1, home_team_id: 7, away_team_id: 2, home_score: 2, away_score: 1 },
    { matchweek: 2, home_team_id: 3, away_team_id: 7, home_score: 0, away_score: 2 },
    { matchweek: 3, home_team_id: 7, away_team_id: 4, home_score: 1, away_score: 1 },
    { matchweek: 4, home_team_id: 6, away_team_id: 7, home_score: 2, away_score: 0 },
    { matchweek: 5, home_team_id: 7, away_team_id: 5, home_score: 3, away_score: 1 },
    { matchweek: 6, home_team_id: 8, away_team_id: 7, home_score: 2, away_score: 2 },
  ],
  cupMatches: [
    { round: 0, home_team_id: 7, away_team_id: 5, home_score: 3, away_score: 1, home_penalties: 0, away_penalties: 0, winner_team_id: 7, played: 1 },
    { round: 1, home_team_id: 4, away_team_id: 7, home_score: 1, away_score: 1, home_penalties: 3, away_penalties: 4, winner_team_id: 7, played: 1 },
  ],
};

const selectedTeamSquad = [
  mk(101, "GR", "Manuel José Carlos Ferreira da Conceição", { skill: 36, wage: 7200, value: 180000 }),
  mk(102, "GR", "Rui Pinto", { skill: 28, wage: 5200, isJunior: true }),
  mk(103, "DEF", "Alexandros Konstantinopoulos", { skill: 45, wage: 9800, value: 250000, is_star: true, form: 118 }),
  mk(104, "DEF", "Tiago", { skill: 38, wage: 7900, suspension_until_matchweek: 99 }),
  mk(105, "DEF", "Rui", { skill: 36, wage: 7400, transfer_cooldown_until_matchweek: 99 }),
  mk(106, "DEF", "Pedro", { skill: 34, wage: 6900, resistance: 5, form: 82, prev_skill: 41, last_rating: 1 }),
  mk(107, "MED", "André", { skill: 48, wage: 10500, value: 255000, is_star: true, goals: 14 }),
  mk(108, "MED", "Filipe", { skill: 40, wage: 8200, injury_until_matchweek: 99, red_cards: 3 }),
  mk(109, "MED", "Nuno", { skill: 38, wage: 7700, isJunior: true }),
  mk(110, "ATA", "Ricardo", { skill: 50, wage: 11500, value: 255000, is_star: true, goals: 21, form: 115, last_rating: 4 }),
  mk(111, "ATA", "Hugo", { skill: 46, wage: 10100, nationality: "🇧🇷", goals: 12 }),
  mk(112, "ATA", "Ousmane Diomande Tiago", { skill: 42, wage: 9200, transfer_status: "transfer" }),
];

// Histórico do clube (tab História) — copiado do teamhistory-resp-test para
// a tab não ficar vazia no harness.
const clubHistory = {
  seasonRecords: [
    { year: 2026, season: 3, position: 1, wins: 11, draws: 2, losses: 1, goalsFor: 34, goalsAgainst: 9, points: 35, divisionSize: 18, championName: "Futebol Clube do Porto de Leixões", championPoints: 35 },
    { year: 2025, season: 2, position: 3, wins: 8, draws: 3, losses: 3, goalsFor: 27, goalsAgainst: 15, points: 27, divisionSize: 18, championName: "Sport Lisboa e Benfica de Lisboa", championPoints: 39 },
  ],
  games: [
    { kind: "league", season: 3, year: 2026, matchweek: 14, round: null, roundName: null, homeTeamId: 7, awayTeamId: 2, homeName: "Futebol Clube do Porto de Leixões", awayName: "Sport Lisboa e Benfica de Lisboa", homeScore: 5, awayScore: 0, homePenalties: 0, awayPenalties: 0, winnerTeamId: null },
    { kind: "cup", season: 3, year: 2026, matchweek: null, round: 4, roundName: "Meias-finais", homeTeamId: 4, awayTeamId: 7, homeName: "Boavista Futebol Clube do Bessa", awayName: "Futebol Clube do Porto de Leixões", homeScore: 1, awayScore: 1, homePenalties: 3, awayPenalties: 5, winnerTeamId: 7 },
  ],
  trophies: [
    { season: 2026, achievement: "Campeão Nacional", coach_name: "Treinador Adversário da Silva", is_human_coach: 1, player_id: null },
    { season: 2025, achievement: "Melhor Marcador (31 golos)", coach_name: "Viktor Gyökeres Johansson", is_human_coach: 1, player_id: 110 },
  ],
  events: [
    { id: 1, type: "transfer_in", title: "Contratação de extremo internacional", player_name: "Francisco Conceição Rodrigues", player_id: 11, related_team_name: "Sport Lisboa e Benfica de Lisboa", amount: 25000000, matchweek: 3, year: 2026 },
    { id: 2, type: "prize", title: "Prémio de Campeão Nacional", player_name: null, player_id: null, related_team_name: null, amount: 2000000, matchweek: 1, year: 2026 },
  ],
};

const root = createRoot(document.getElementById("root"));
root.render(
  <div className="h-screen flex flex-col bg-surface">
    <OtherSquadsTab
      selectedTeam={selectedTeam}
      selectedTeamSquad={selectedTeamSquad}
      selectedTeamLoading={false}
      me={{ teamId: 1, name: "Treinador Teste" }}
      avatarSeed="seed"
      coachAvatars={{}}
      backendUrl=""
      players={[]}
      palmares={{ trophies: [] }}
      palmaresTeamId={null}
      clubHistory={clubHistory}
      clubHistoryTeamId={selectedTeam.id}
      setTransferProposalModal={() => {}}
      myBudget={125000}
      currentMatchweek={7}
      calendarData={calendarData}
      teams={teams}
      teamForms={{ 7: "VVEDE" }}
      onBack={() => {}}
      onOpenTeamSquad={() => {}}
      onOpenPlayerHistory={() => {}}
    />
  </div>,
);

function measure() {
  const vw = window.innerWidth;
  const doc = document.documentElement;
  const pageOverflow = doc.scrollWidth - vw;

  // O conteúdo das tabs vive num scroller interno (overflow-y-auto); um
  // painel mais largo do que a coluna só aparece aqui, não no documento.
  const scroller = [...document.querySelectorAll("div")].find(
    (d) =>
      d.className.includes("overflow-y-auto") &&
      d.scrollHeight > d.clientHeight + 50,
  );
  const innerOverflowPx = scroller
    ? scroller.scrollWidth - scroller.clientWidth
    : 0;

  // PlayerRow roots (linhas com overflow-hidden) — risco de corte.
  const rows = [...document.querySelectorAll("div.flex.overflow-hidden")];
  const clippedRows = rows
    .filter((el) => el.scrollWidth > el.clientWidth + 1)
    .map((el) => ({
      name: el.querySelector("p.uppercase")?.textContent || "?",
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
    innerOverflowPx,
    playerRows: rows.length,
    clippedRows,
    clippingElements,
  };
}

const TAB_LABELS = ["Resumo", "Plantel", "Jogos", "História"];

// Passa por todas as tabs (as colapsadas não seriam medidas) e soma os
// problemas de cada uma.
setTimeout(async () => {
  const perTab = {};
  let pageOverflowPx = 0;
  let innerOverflowPx = 0;
  const clippedRows = [];

  for (const label of TAB_LABELS) {
    const button = [...document.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === label,
    );
    if (!button) continue;
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 400));
    const result = measure();
    perTab[label] = result;
    pageOverflowPx = Math.max(pageOverflowPx, result.pageOverflowPx);
    innerOverflowPx = Math.max(innerOverflowPx, result.innerOverflowPx);
    clippedRows.push(...result.clippedRows.map((r) => ({ tab: label, ...r })));
  }

  const report = {
    viewport: window.innerWidth,
    pageOverflowPx,
    innerOverflowPx,
    clippedRows,
    clippingElements: Object.fromEntries(
      Object.entries(perTab).map(([k, v]) => [k, v.clippingElements]),
    ),
    perTab,
    verdict:
      pageOverflowPx <= 0 && innerOverflowPx <= 0 && clippedRows.length === 0
        ? "PASS"
        : "FAIL",
  };
  const el = document.getElementById("report");
  el.setAttribute("data-status", "done");
  el.textContent = "REPORT:" + JSON.stringify(report, null, 2);
}, 1500);
