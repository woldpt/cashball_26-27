/**
 * Regression — view-model do briefing pré-jogo
 * (`components/live/briefing/briefingViewModel.js` + `orderedPair.js`).
 *
 * Codifica o contrato da derivação pura (sem render):
 *   S1 — orderedPair: em casa [eu, adv], fora [adv, eu];
 *   S2 — diferença de pontos com sinal correto;
 *   S3 — odds: parsing string/número, inválidas excluídas, probabilidades
 *        normalizadas (~100%) e favorito = odd mais baixa;
 *   S4 — último confronto: rótulos V/E/D, sufixos de penáltis/prolongamento,
 *        null sem histórico;
 *   S5 — slots VS: casa à esquerda em casa, à direita fora, com id preservado
 *        para o modal de plantel;
 *   S6 — atmosfera do estádio nos limiares 90/70/40;
 *   S7 — tempo: etiqueta pt-PT com fallback para condição desconhecida;
 *   S8 — sem resumo → null; sem adversário → modelo parcial (hasOpponent false).
 *   S9 — prova no modelo: cupRound passa, competição do amigável etiqueta,
 *        roundFixtures viram spyGames (vazias por omissão).
 *
 * Run: cd client && npm run test:briefing
 */
import {
  buildBriefingViewModel,
  getAtmosphereKey,
} from "../src/components/live/briefing/briefingViewModel.js";
import { orderedPair } from "../src/components/live/briefing/orderedPair.js";

let failures = 0;
function check(cond, msg) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${msg}`);
  } else {
    console.log(`ok  - ${msg}`);
  }
}

const baseSummary = {
  venue: "Casa",
  isCup: false,
  matchweek: 7,
  headline: "Dérbi da jornada.",
  stakes: "Luta pelo título",
  difficulty: { score: 68, label: "Difícil" },
  team: {
    id: 1,
    name: "Os Meus",
    position: 2,
    points: 15,
    avgSkill: 72,
    last5: "VVEVD",
    wins: 5,
    draws: 0,
    losses: 1,
  },
  opponent: {
    id: 9,
    name: "Rivais FC",
    position: 1,
    points: 18,
    goalsFor: 20,
    goalsAgainst: 8,
    morale: 80,
    wins: 6,
    draws: 0,
    losses: 0,
    avgSkill: 75,
    last5: "VVVVV",
  },
  odds: { home: "2.10", draw: "3.40", away: "3.00" },
  referee: { name: "Artur Soares" },
  weatherForecast: { condition: "chuva", emoji: "🌧️" },
  stadium: {
    expectedAttendance: 9500,
    capacity: 10000,
    occupancyPct: 95,
    revenue: 47500,
    reasons: ["Bom momento", "Dérbi"],
  },
};
const teamInfo = {
  id: 1,
  name: "Os Meus",
  points: 15,
  goals_for: 18,
  goals_against: 9,
  morale: 60,
  wins: 5,
  draws: 0,
  losses: 1,
  avgSkill: 72,
};

/* ── S1: orderedPair ─────────────────────────────────────────────────── */
check(
  JSON.stringify(orderedPair(true, "eu", "adv")) === JSON.stringify(["eu", "adv"]),
  "S1a: em casa devolve [eu, adv]",
);
check(
  JSON.stringify(orderedPair(false, "eu", "adv")) === JSON.stringify(["adv", "eu"]),
  "S1b: fora devolve [adv, eu]",
);

/* ── S2: pontos ──────────────────────────────────────────────────────── */
const vmHome = buildBriefingViewModel(baseSummary, teamInfo);
check(vmHome.ptsDiff === -3, `S2: ptsDiff 15-18 = -3 (obteve ${vmHome?.ptsDiff})`);
check(
  vmHome.compare.points[0] === 15 && vmHome.compare.points[1] === 18,
  "S2b: pontos ordenados [eu, adv] em casa",
);
const vmAway = buildBriefingViewModel({ ...baseSummary, venue: "Fora" }, teamInfo);
check(
  vmAway.compare.points[0] === 18 && vmAway.compare.points[1] === 15,
  "S2c: pontos ordenados [adv, eu] fora",
);

/* ── S3: odds ────────────────────────────────────────────────────────── */
const probs = vmHome.odds.list.map((o) => o.prob);
const probSum = probs.reduce((a, p) => a + (p ?? 0), 0);
check(
  probSum >= 99 && probSum <= 101,
  `S3a: probabilidades normalizadas ≈100% (soma ${probSum})`,
);
check(
  vmHome.odds.favoriteKey === "home" &&
    vmHome.odds.list[0].isFavorite === true,
  "S3b: favorito = odd mais baixa (casa a 2.10)",
);
const vmNumOdds = buildBriefingViewModel(
  { ...baseSummary, odds: { home: 2.5, draw: "—", away: null } },
  teamInfo,
);
check(
  vmNumOdds.odds.list[0].display === "2.5" &&
    vmNumOdds.odds.list[1].display === "—" &&
    vmNumOdds.odds.list[1].prob === null,
  "S3c: odds numéricas aceites; inválidas mostram — sem probabilidade",
);
check(
  vmNumOdds.odds.favoriteKey === "home",
  "S3d: favorito calculado só com as odds válidas",
);

/* ── S4: último confronto ────────────────────────────────────────────── */
const withLc = (lc) =>
  buildBriefingViewModel(
    { ...baseSummary, opponent: { ...baseSummary.opponent, lastConfrontation: lc } },
    teamInfo,
  ).lastConfrontation;
const lcV = withLc({
  result: "V",
  competition: "league",
  matchweek: 3,
  goalsFor: 2,
  goalsAgainst: 0,
  venue: "Casa",
  season: 1,
});
check(
  lcV.label === "Vitória" && lcV.score === "2–0" && lcV.comp === "Liga · J3",
  `S4a: vitória de liga formatada (${lcV?.score} · ${lcV?.comp})`,
);
const lcP = withLc({
  result: "E",
  competition: "cup",
  cupRoundName: "Meias-finais",
  goalsFor: 1,
  goalsAgainst: 1,
  penalties: { goalsFor: 4, goalsAgainst: 2 },
  venue: "Jamor",
  season: 1,
});
check(
  lcP.score === "1–1 (g.p. 4–2)" && lcP.comp === "Meias-finais",
  `S4b: empate de taça com penáltis (${lcP?.score})`,
);
const lcET = withLc({
  result: "D",
  competition: "cup",
  goalsFor: 0,
  goalsAgainst: 1,
  extraTime: true,
  venue: "Fora",
  season: 1,
});
check(
  lcET.label === "Derrota" && lcET.score === "0–1 (pro.)",
  `S4c: derrota no prolongamento (${lcET?.score})`,
);
check(
  vmHome.lastConfrontation === null,
  "S4d: sem histórico → null (mostra «Sem histórico»)",
);

/* ── S5: slots VS ────────────────────────────────────────────────────── */
check(
  vmHome.slots[0].isMine === true && vmHome.slots[1].isMine === false,
  "S5a: em casa eu fico à esquerda",
);
check(
  vmAway.slots[0].isMine === false && vmAway.slots[1].isMine === true,
  "S5b: fora eu fico à direita",
);
check(
  vmHome.slots[0].id === 1 && vmHome.slots[1].id === 9,
  `S5c: ids preservados para o modal de plantel (${vmHome.slots[0]?.id}/${vmHome.slots[1]?.id})`,
);

/* ── S6: atmosfera ───────────────────────────────────────────────────── */
check(getAtmosphereKey(95) === "volcano", "S6a: 95% → vulcão");
check(getAtmosphereKey(90) === "volcano", "S6b: limiar 90% → vulcão");
check(getAtmosphereKey(89) === "loud", "S6c: 89% → grande ambiente");
check(getAtmosphereKey(70) === "loud", "S6d: limiar 70% → grande ambiente");
check(getAtmosphereKey(69) === "mild", "S6e: 69% → morno");
check(getAtmosphereKey(40) === "mild", "S6f: limiar 40% → morno");
check(getAtmosphereKey(39) === "morgue", "S6g: 39% → morgue");
check(
  vmHome.stadium.atmosphereKey === "volcano" && vmHome.stadium.reasons.length === 2,
  "S6h: estádio do cenário → vulcão com 2 motivos",
);

/* ── S7: tempo ───────────────────────────────────────────────────────── */
check(vmHome.weather.label === "Chuva", `S7a: «chuva» → «Chuva» (obteve «${vmHome.weather?.label}»)`);
const vmUnknownWeather = buildBriefingViewModel(
  {
    ...baseSummary,
    weatherForecast: { condition: "granizo", emoji: "🌨️" },
  },
  teamInfo,
);
check(
  vmUnknownWeather.weather.label === "granizo",
  "S7b: condição desconhecida mostra o valor original (fallback)",
);

/* ── S8: casos limite ────────────────────────────────────────────────── */
check(buildBriefingViewModel(null, teamInfo) === null, "S8a: sem resumo → null");
check(
  buildBriefingViewModel(undefined, teamInfo) === null,
  "S8b: resumo undefined → null",
);
const vmNoOpp = buildBriefingViewModel(
  { ...baseSummary, opponent: null },
  teamInfo,
);
check(
  vmNoOpp.hasOpponent === false &&
    vmNoOpp.slots.length === 0 &&
    vmNoOpp.headline === "Dérbi da jornada.",
  "S8c: sem adversário → modelo parcial (herói/estádio continuam)",
);
check(
  vmNoOpp.compare.quality[1] === null,
  "S8d: qualidade do adversário ausente → null (mostra —)",
);

/* ── S9: prova e espião ──────────────────────────────────────────────── */
const vmCup = buildBriefingViewModel(
  { ...baseSummary, isCup: true, cupRound: 2, cupRoundName: "Oitavos de final" },
  teamInfo,
);
check(
  vmCup.cupRound === 2 && vmCup.competition === "Oitavos de final",
  "S9a: ronda da taça passa e etiqueta a competição",
);
const vmFriendly = buildBriefingViewModel(
  { ...baseSummary, isCup: true, cupRound: 0, cupRoundName: "Amigável de pré-época" },
  teamInfo,
);
check(
  vmFriendly.cupRound === 0 &&
    vmFriendly.competition === "Amigável de pré-época" &&
    vmFriendly.spyGames.length === 0,
  "S9b: amigável etiqueta e sem espião",
);
check(
  vmHome.cupRound === null && vmHome.competition === "Jornada 7",
  "S9c: liga sem ronda e etiqueta Jornada N",
);
const vmSpy = buildBriefingViewModel(
  {
    ...baseSummary,
    opponent: null,
    roundFixtures: [
      { homeTeamId: 1, awayTeamId: 2, homeName: "A", awayName: "B" },
      { homeTeamId: 3, awayTeamId: 4, homeName: "C", awayName: "D" },
    ],
  },
  teamInfo,
);
check(
  vmSpy.hasOpponent === false &&
    vmSpy.spyGames.length === 2 &&
    vmSpy.spyGames[0].homeName === "A",
  "S9d: eliminado com ronda → 2 jogos espiões",
);

if (failures > 0) {
  console.error(
    `\n❌ briefingViewModelRegression: ${failures} falha(s) de invariante — ver acima`,
  );
  process.exit(1);
}
console.log(
  "\n✅ briefingViewModelRegression: view-model do briefing íntegro (ordem, odds, confronto, atmosfera)",
);
