/**
 * Regression — Jornal 100% em BD: todas as notícias têm data fixa (a semana
 * do evento, guardada na linha) e identidade estável (o «lido» não reverte).
 *
 * Cobre os 6 tipos novos persistidos (contract_request, job_offer,
 * board_warning, cup_draw, injury, suspension): data fixa, categoria, id
 * estável e cobertura do transitório correspondente.
 *
 * Run: cd client && npm run test:journaldb
 */

const m = await import("../src/utils/inboxItems.js");
const {
  newsRowsToItems,
  newsCategory,
  contractCovered,
  jobCovered,
  boardCovered,
  cupDrawCovered,
  medicalCovered,
  parseNewsFacts,
} = m;

let failures = 0;
function check(cond, msg) {
  if (cond) {
    console.log(`  ok   — ${msg}`);
  } else {
    failures += 1;
    console.error(`  FAIL — ${msg}`);
  }
}

const FALLBACK = "S9/2026";
const row = (over = {}) => ({
  id: 1,
  source: "club",
  type: "contract_request",
  title: "Pedido",
  description: JSON.stringify({ v: 1 }),
  team_id: 10,
  team_name: "Meu Clube",
  player_id: null,
  player_name: null,
  player_photo: null,
  player_position: null,
  related_team_id: null,
  related_team_name: null,
  amount: null,
  matchweek: 4,
  year: 2026,
  created_at: "2026-01-01",
  ...over,
});

console.log("R1 data fixa: a linha dita a data, nunca a semana atual");
{
  const items = newsRowsToItems(
    [row({ id: 7, player_id: 9, player_name: "Renovável" })],
    FALLBACK,
  );
  check(items.length === 1, "um evento = uma notícia");
  check(items[0].date === "S4/2026", `data da linha (${items[0].date})`);
  check(items[0].id === "news-club-7", `id estável (${items[0].id})`);
}

console.log("R2 categorias dos 6 tipos novos");
{
  check(newsCategory(row({ type: "contract_request" })) === "club", "renovação → club");
  check(newsCategory(row({ type: "job_offer" })) === "club", "convite → club");
  check(newsCategory(row({ type: "board_warning" })) === "club", "direção → club");
  check(newsCategory(row({ type: "cup_draw" })) === "competitions", "sorteio → competitions");
  check(newsCategory(row({ type: "injury" })) === "squad", "lesão → squad");
  check(newsCategory(row({ type: "suspension" })) === "squad", "castigo → squad");
}

console.log("R3 artigo de renovação com entidade e factos");
{
  const [it] = newsRowsToItems(
    [
      row({
        id: 7,
        player_id: 9,
        player_name: "Renovável",
        description: JSON.stringify({
          v: 1,
          wage: 1000,
          requestedWage: 1500,
          agent: "Agente X",
          position: "ATA",
          skill: 70,
          contractEndLabel: "J3",
          isRenegotiation: false,
        }),
      }),
    ],
    FALLBACK,
  );
  check(it.title.includes("Renovável"), "título com o jogador");
  check(
    (it.titleParts || []).some((p) => p.type === "player" && p.id === 9),
    "jogador clicável no título",
  );
  check(it.media?.player?.id === 9, "media com o jogador");
  check(it.facts?.requestedWage === 1500, "factos anexados");
  check(it.newsType === "contract_request", "tipo anexado");
}

console.log("R4 sorteio: o jogo do treinador com ambas as equipas");
{
  const draw = row({
    id: 11,
    type: "cup_draw",
    team_id: 10,
    matchweek: 6,
    description: JSON.stringify({
      v: 1,
      round: 2,
      roundName: "Oitavos",
      season: 3,
      fixtures: [
        { homeTeamId: 10, homeName: "Meu Clube", awayTeamId: 20, awayName: "Rival" },
        { homeTeamId: 30, homeName: "Outro A", awayTeamId: 40, awayName: "Outro B" },
      ],
    }),
  });
  const [mine] = newsRowsToItems([draw], FALLBACK, 10);
  check(mine.date === "S6/2026", `data do sorteio (${mine.date})`);
  check(mine.title === "🏆 Sorteio: Oitavos", `título (${mine.title})`);
  check(mine.body.includes("Rival"), "corpo com o meu jogo");
  check((mine.media?.teams || []).length === 2, "duas equipas na media");
  check(mine.facts?.fixtures?.length === 2, "pares nos factos");
  check(mine.body.includes("O seu jogo:"), "destaque do meu jogo");
  check(mine.body.includes("Outro A"), "corpo lista os restantes pares");
  const [other] = newsRowsToItems([draw], FALLBACK, 99);
  check(
    other.body.includes("Outro A") &&
      other.body.includes("Outro B") &&
      other.body.includes("Meu Clube") &&
      !other.body.includes("O seu jogo:"),
    "sem o meu jogo: listagem completa sem destaque",
  );
}

console.log("R5 lesão/castigo com until e jornada de regresso");
{
  const [inj] = newsRowsToItems(
    [
      row({
        id: 21,
        type: "injury",
        player_id: 5,
        player_name: "Mancilho",
        amount: 12,
        matchweek: 8,
        description: JSON.stringify({ v: 1, until: 12, position: "DEF", skill: 65 }),
      }),
    ],
    FALLBACK,
  );
  check(inj.date === "S8/2026", `data do jogo (${inj.date})`);
  check(inj.body.includes("jornada 13"), "regresso = until + 1");
  check(
    (inj.titleParts || []).some((p) => p.type === "player" && p.id === 5),
    "jogador clicável",
  );
}

console.log("R6 cobertura: transitório esconde-se com par gravado");
{
  const rows = [
    row({ type: "contract_request", player_id: 9 }),
    row({ type: "job_offer", related_team_id: 77, related_team_name: "Rico" }),
    row({
      type: "board_warning",
      description: JSON.stringify({ v: 1, level: 1, budget: -5, streak: 2 }),
    }),
    row({
      type: "cup_draw",
      description: JSON.stringify({ v: 1, round: 2, season: 3, fixtures: [] }),
    }),
    row({ type: "injury", player_id: 5, amount: 12 }),
  ];
  check(contractCovered(rows, 9), "renovação coberta");
  check(!contractCovered(rows, 10), "outro jogador não");
  check(jobCovered(rows, 77), "convite coberto");
  check(!jobCovered(rows, 78), "outro clube não");
  check(boardCovered(rows, 10, 1, 2), "aviso coberto");
  check(!boardCovered(rows, 10, 1, 3), "outra sequência não");
  check(cupDrawCovered(rows, 3, 2), "sorteio coberto");
  check(!cupDrawCovered(rows, 3, 3), "outra ronda não");
  check(medicalCovered(rows, "injury", 5, 12), "lesão coberta");
  check(!medicalCovered(rows, "injury", 5, 13), "prolongamento é evento novo");
  check(!medicalCovered(rows, "suspension", 5, 12), "outro tipo não");
}

console.log("R7 factos estragados não partem o artigo");
{
  check(parseNewsFacts(row({ description: "texto cru" })) === null, "JSON inválido → null");
  const [it] = newsRowsToItems([row({ description: "texto cru" })], FALLBACK);
  check(typeof it.title === "string" && typeof it.body === "string", "artigo genérico intacto");
}

console.log("R8 classificação final: tabela da divisão pesquisável");
{
  const table = row({
    id: 31,
    type: "league_final",
    team_id: 10,
    matchweek: 14,
    description: JSON.stringify({
      v: 1,
      season: 19,
      year: 2026,
      matchweek: 14,
      divId: 2,
      divName: "Segunda Liga",
      champion: "Meu Clube",
      rows: [
        { pos: 1, id: 10, name: "Meu Clube", p: 32, j: 14, v: 10, e: 2, d: 2, gf: 28, gs: 12 },
        { pos: 2, id: 20, name: "Rival", p: 28, j: 14, v: 9, e: 1, d: 4, gf: 24, gs: 16 },
      ],
    }),
  });
  const [it] = newsRowsToItems([table], FALLBACK, 10);
  check(it.date === "S14/2026", `data da última jornada (${it.date})`);
  check(it.title === "📊 Classificação final — Segunda Liga", `título (${it.title})`);
  check(newsCategory(table) === "competitions", "tabela → competitions");
  check(it.body.includes("Meu Clube") && it.body.includes("Rival"), "corpo lista a tabela");
  check(it.facts?.rows?.length === 2, "linhas nos factos para a tabela");
  check(
    (it.bodyParts || []).some((p) => p.type === "team" && p.id === 10),
    "campeão clicável",
  );
  check(it.newsType === "league_final", "tipo anexado");
}

if (failures > 0) {
  console.error(`\n${failures} falha(s)`);
  process.exit(1);
}
console.log("\njournaldb: tudo OK");
