/**
 * Regression test — regras de substituições da partida.
 *
 * Invariantes implementados (ver gameConstants.ts):
 *   1. `MAX_SUBSTITUTIONS === 3` — máximo de substituições por equipa/partida,
 *      incluindo lesões com reposição e substituições de intervalo/alongamento.
 *   2. `MAX_BENCH_SIZE === 7` — máximo de suplentes no banco.
 *   3. Cartões vermelhos NÃO contam como substituição (expulsão retira um
 *      jogador sem repor ninguém).
 *   4. Ao atingir o limite, uma lesão obriga a jogar com menos um jogador.
 *
 * O teste valida (a) as funções/constantes partilhadas e (b) que a execução do
 * motor liga essas regras nos sítios certos (lesão, substituição de utilizador,
 * intervalo, alongamento e validação de banco no setTactic).
 *
 * Run: cd server && npm run test:substitutions
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const {
  MAX_SUBSTITUTIONS,
  MAX_BENCH_SIZE,
  getSubCount,
  incrementSubCount,
  canMakeSubstitution,
  remainingSubstitutions,
} = require("../gameConstants.ts") as {
  MAX_SUBSTITUTIONS: number;
  MAX_BENCH_SIZE: number;
  getSubCount: (fixture: any, teamId: number) => number;
  incrementSubCount: (fixture: any, teamId: number) => void;
  canMakeSubstitution: (fixture: any, teamId: number) => boolean;
  remainingSubstitutions: (fixture: any, teamId: number) => number;
};

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`ok  - ${msg}`);
}

// ── 1. Constantes ──────────────────────────────────────────────────────────
assert(MAX_SUBSTITUTIONS === 3, "MAX_SUBSTITUTIONS === 3");
assert(MAX_BENCH_SIZE === 7, "MAX_BENCH_SIZE === 7");

// ── 2. Contador por equipa/partida ─────────────────────────────────────────
const fixture: any = {};
const HOME = 1001;
const AWAY = 1002;

assert(getSubCount(fixture, HOME) === 0, "contador inicial é 0");
assert(canMakeSubstitution(fixture, HOME) === true, "pode substituir com 0");

incrementSubCount(fixture, HOME);
incrementSubCount(fixture, HOME);
assert(getSubCount(fixture, HOME) === 2, "2 substituições feitas");
assert(
  canMakeSubstitution(fixture, HOME) === true,
  "ainda pode substituir com 2",
);

incrementSubCount(fixture, HOME);
assert(getSubCount(fixture, HOME) === 3, "3 substituições feitas (limite)");
assert(
  canMakeSubstitution(fixture, HOME) === false,
  "não pode substituir ao atingir o limite",
);
assert(remainingSubstitutions(fixture, HOME) === 0, "0 substituições restantes");

// ── 3. Contador isolado por equipa ─────────────────────────────────────────
incrementSubCount(fixture, AWAY);
assert(getSubCount(fixture, HOME) === 3, "contador da home intacto");
assert(getSubCount(fixture, AWAY) === 1, "contador away independente");

// ── 4. Persiste em `_subCountByTeam` (estrutura de dados do fixture) ───────
assert(
  typeof fixture._subCountByTeam === "object" && fixture._subCountByTeam !== null,
  "contador vive em fixture._subCountByTeam",
);

// ── 5. Ligação das regras aos sítios de execução no motor ───────────────────
const engine = readFileSync(
  path.join(__dirname, "../game/engine.ts"),
  "utf8",
);

// Lesão: bloqueia a janela quando o limite é atingido e conta a reposição.
assert(
  /if\s*\(\s*!canMakeSubstitution\(fixture,\s*teamId\)\s*\)/.test(engine),
  "applyInjuryEvent: bloqueia substituição ao atingir o limite",
);
assert(
  /incrementSubCount\(fixture,\s*teamId\)/.test(engine),
  "lesão/reposição incrementa o contador de substituições",
);

// Substituição de utilizador no último minuto regulamentar: o pedido é
// consumido sem abrir a janela — e o banner de pausa dos outros treinadores
// termina (senão ficaria à mostra até à próxima substituição).
// Regex (e não o bloco literal): a indentação mudou quando o passo do minuto
// foi extraído para `resolveUserSubs` e a guarda estava a medir espaços.
assert(
  /if \(shared\.isLastLeagueMinute\) \{[\s\S]{0,320}?emit\("substitutionPauseEnded", \{ teamId \}\);[\s\S]{0,80}?continue;/.test(
    engine,
  ),
  "user_substitution: último minuto consome o pedido e termina a pausa",
);

// Substituição de utilizador no limite: avisa o treinador
// (substitutionCapReached) mas NÃO fecha a janela — abre-a sem banco, para
// ele ainda poder mexer na mentalidade (que não consome substituição).
// Regex (e não o bloco literal): a indentação mudou quando o passo do minuto
// foi extraído para `resolveUserSubs`.
assert(
  /const cappedForMentality = !canMakeSubstitution\(fixture, teamId\);[\s\S]{0,220}?emit\("substitutionCapReached", \{ teamId \}\)/.test(
    engine,
  ) &&
    /cappedForMentality \? onPitch\.length > 0 : onPitch\.length > 0 && availableBench\.length > 0/.test(
      engine,
    ),
  "user_substitution: esgotou subs — avisa e abre a janela só para a mentalidade",
);

// Intervalo: limita e conta substituições de segunda parte.
const weekly = readFileSync(
  path.join(__dirname, "../weeklyFlowHelpers.ts"),
  "utf8",
);
assert(
  weekly.includes("remainingSubstitutions(") &&
    weekly.includes("incrementSubCount("),
  "applyHalftimeSubs: limita e conta substituições ao intervalo",
);

// Alongamento (taça): limita e conta substituições de prolongamento.
const cup = readFileSync(
  path.join(__dirname, "../cupFlowHelpers.ts"),
  "utf8",
);
assert(
  cup.includes("remainingSubstitutions(") &&
    cup.includes("incrementSubCount("),
  "applyETSubs: limita e conta substituições no prolongamento",
);

// Banco: setTactic impõe o limite de suplentes no servidor.
const handlers = readFileSync(
  path.join(__dirname, "../socketGameplayHandlers.ts"),
  "utf8",
);
assert(
  handlers.includes("MAX_BENCH_SIZE") &&
    /subIds\.slice\(\s*MAX_BENCH_SIZE\s*\)/.test(handlers),
  "setTactic: aplica o limite de banco (MAX_BENCH_SIZE)",
);

// O sanitizador não restringe GRs suplentes — só demote quem passar do teto.
assert(
  !/position\s*===\s*"GR"/.test(handlers),
  "setTactic: não impede múltiplos GRs no banco (só aplica o teto)",
);

// ── 6. Toast quando o limite é atingido ao vivo ─────────────────────────────
// O servidor avisa sempre que a equipa esgota as 3 substituições, em três vias
// distintas (a guarda mede os três contextos, não a contagem total — um sítio
// novo legítimo não deve chumbar o teste por aritmética):
//   1. lesão sem reposição (a equipa joga com menos um);
//   2. 4.ª tentativa de mudança (a janela abre só para a mentalidade);
//   3. a meio de um lote de trocas (o cliente pode acumular várias na pausa).
assert(
  /if \(!canMakeSubstitution\(fixture, teamId\)\) \{[\s\S]{0,200}?emit\("substitutionCapReached"/.test(
    engine,
  ),
  "engine: avisa na lesão sem reposição",
);
assert(
  /cappedForMentality = !canMakeSubstitution\(fixture, teamId\);[\s\S]{0,220}?emit\("substitutionCapReached"/.test(
    engine,
  ),
  "engine: avisa na mudança sem substituições (janela de mentalidade)",
);
assert(
  /for \(const userChoice of batch\) \{[\s\S]{0,200}?emit\("substitutionCapReached"/.test(
    engine,
  ),
  "engine: avisa a meio de um lote de trocas",
);

// Frontend: o toast do limite foi removido de propósito em `d968a61f`
// ("cap/expiry/copy toasts removed") — o aviso passou a ser inline na janela
// de intervenção (hint junto ao botão de confirmar), que é o que se mede agora.
// O evento do servidor continua a existir (os três emits acima).
const intervencao = readFileSync(
  path.join(
    __dirname,
    "../../client/src/components/match/tabs/IntervencaoView.jsx",
  ),
  "utf8",
);
assert(
  intervencao.includes("Limite de substituições atingido.") &&
    intervencao.includes("Sem suplentes disponíveis"),
  "frontend: limite de substituições explicado inline (toast removido de propósito)",
);

console.log("\n✅ substitutionsRegression: all checks passed");
