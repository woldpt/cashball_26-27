/**
 * Regression test — regras de substituições da partida.
 *
 * Invariantes implementados (ver gameConstants.ts):
 *   1. `MAX_SUBSTITUTIONS === 3` — máximo de substituições por equipa/partida,
 *      incluindo lesões com reposição e substituições de intervalo/alongamento.
 *   2. `MAX_BENCH_SIZE === 5` — máximo de suplentes no banco.
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
assert(MAX_BENCH_SIZE === 5, "MAX_BENCH_SIZE === 5");

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
assert(
  engine.includes(
    "if (isLastLeagueMinute) {\n          // Pedido consumido sem janela: termina o banner de pausa dos outros\n          // treinadores (senão ficava à mostra até à próxima substituição).\n          io.to(game.roomCode).emit(\"substitutionPauseEnded\", { teamId });\n          continue;\n        }",
  ),
  "user_substitution: último minuto consome o pedido e termina a pausa",
);

// Substituição de utilizador no limite: consome o pedido sem abrir a janela,
// avisa o treinador (substitutionCapReached) e termina o banner de pausa.
// Distinto da lesão (emit → `const idx`): aqui vem `emit` → `continue`.
assert(
  engine.includes(
    "{\n          io.to(game.roomCode).emit(\"substitutionCapReached\", { teamId });\n          // O pedido foi consumido sem abrir a janela: termina o banner de pausa.\n          io.to(game.roomCode).emit(\"substitutionPauseEnded\", { teamId });\n          continue;",
  ),
  "user_substitution: esgotou subs — consome pedido e termina a pausa",
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

// ── 6. Toast quando o limite é atingido ao vivo ─────────────────────────────
// O servidor avisa (uma vez por equipa) sempre que a equipa esgota as 3
// substituições — seja na 4ª tentativa de mudança, seja numa lesão sem reposição.
assert(
  engine.match(/io\.to\(game\.roomCode\)\.emit\("substitutionCapReached"/g)
    ?.length === 2,
  "engine: emite substitutionCapReached (mudança + lesão)",
);

const listeners = readFileSync(
  path.join(__dirname, "../../client/src/hooks/useSocketListeners.js"),
  "utf8",
);
assert(
  listeners.includes("\"substitutionCapReached\"") &&
    listeners.includes("addToast") &&
    listeners.includes("myTeamId !== teamId"),
  "frontend: ouve substitutionCapReached e faz toast só da própria equipa",
);

console.log("\n✅ substitutionsRegression: all checks passed");
