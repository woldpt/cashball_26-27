/**
 * Regression test — GR improvisado (jogador de campo na baliza).
 *
 * Regra (futebol profissional): quando o GR em campo sai (expulsão ou lesão)
 * e não há outro GR disponível (no banco ou para repor), um jogador de campo
 * calça as luvas — fica marcado como GR com skill no piso de emergência
 * (`EMERGENCY_GK_SKILL`) até ao fim do jogo. Tudo em memória: a posição real
 * na DB nunca muda.
 *
 * Invariantes:
 *   1. `EMERGENCY_GK_SKILL === 5` (piso júnior) — constante partilhada.
 *   2. `convertToEmergencyGK(player)` devolve um CLONE com
 *      position = "GR", skill = EMERGENCY_GK_SKILL, originalPosition e
 *      isEmergencyGK = true; o objeto original nunca é mutado.
 *   3. Expulsão do último GR sem GR no banco → ação `emergency_gk`
 *      (escolhe em campo quem vai para a baliza; fallback: o mais fraco),
 *      SEM gastar substituição.
 *   4. Lesão do último GR com subs → o substituto que entra é convertido
 *      (payload avisa a UI com `incomingBecomesGK`).
 *   5. Lesão do último GR sem subs → além de sair, abre `emergency_gk`
 *      para escolher em campo (fallback: o mais fraco).
 *   6. Comentário dedicado (pt-PT) com 🧤; evento visível na cronologia.
 *
 * Run: cd server && npm run test:emergency-gk
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const { EMERGENCY_GK_SKILL } = require("../gameConstants.ts") as {
  EMERGENCY_GK_SKILL: number;
};
const { convertToEmergencyGK } = require("../game/playerUtils.ts") as {
  convertToEmergencyGK: (player: any) => any;
};

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`ok  - ${msg}`);
}

// ── 1. Constante ──────────────────────────────────────────────────────────
assert(EMERGENCY_GK_SKILL === 5, "EMERGENCY_GK_SKILL === 5 (piso júnior)");

// ── 2. convertToEmergencyGK — clone, sem mutar o original ─────────────────
const original = {
  id: 42,
  name: "Zé Defesa",
  position: "DEF",
  skill: 78,
  team_id: 7,
  age: 25,
  is_star: 0,
};
const gk = convertToEmergencyGK(original);

assert(gk !== original, "conversão devolve um clone (referência nova)");
assert(gk.position === "GR", "conversão muda posição para GR");
assert(
  gk.skill === EMERGENCY_GK_SKILL,
  "conversão fixa skill no piso de emergência",
);
assert(
  gk.originalPosition === "DEF",
  "conversão preserva a posição original (originalPosition)",
);
assert(gk.isEmergencyGK === true, "conversão marca isEmergencyGK = true");
assert(
  original.position === "DEF" &&
    original.skill === 78 &&
    original.isEmergencyGK === undefined,
  "objeto original não é mutado (posição/skill/isEmergencyGK intactos)",
);
assert(
  gk.id === 42 && gk.name === "Zé Defesa" && gk.team_id === 7,
  "identidade preservada (id, nome, equipa)",
);

const med = convertToEmergencyGK({ ...original, id: 55, position: "MED" });
assert(
  med.originalPosition === "MED" && med.position === "GR",
  "conversão funciona para médio (originalPosition = MED)",
);
const ata = convertToEmergencyGK({ ...original, id: 66, position: "ATA" });
assert(
  ata.originalPosition === "ATA" && ata.position === "GR",
  "conversão funciona para avançado (originalPosition = ATA)",
);

// ── 3. Ligação das regras aos sítios de execução no motor ─────────────────
const engine = readFileSync(path.join(__dirname, "../game/engine.ts"), "utf8");

// Helper importado e usado no motor.
assert(
  engine.includes("convertToEmergencyGK"),
  "engine: importa e usa convertToEmergencyGK",
);

// Expulsão do último GR sem GR no banco → emergency_gk (escolha única em
// campo, fallback do mais fraco) — sem gastar substituição nesse caminho.
assert(
  engine.includes('type: "emergency_gk"'),
  "engine: abre ação emergency_gk (expulsão/lesão do último GR)",
);
assert(
  /if \(grBench\.length === 0\) \{/.test(engine),
  "engine: sem GR no banco decide pelo fluxo de emergência",
);
assert(
  /\[\.\.\.emergencyCandidates\]\.sort\(/.test(engine) ||
    /emergencyCandidates.*sort\(/.test(engine),
  "engine: fallback do mais fraco em campo (emergencyCandidates ordenados)",
);

// Lesão do último GR com subs disponíveis: o substituto que entra é
// convertido e a UI é avisada.
assert(
  engine.includes("incomingBecomesGK"),
  "engine: lesão do GR com subs avisa a UI (incomingBecomesGK)",
);

const commentary = readFileSync(
  path.join(__dirname, "../game/commentary.ts"),
  "utf8",
);
assert(
  commentary.includes("emergencyGkPhrase"),
  "commentary: emergencyGkPhrase exportada",
);
assert(
  engine.includes("emergencyGkPhrase"),
  "engine: usa emergencyGkPhrase no comentário",
);
assert(
  engine.includes("🧤"),
  "engine: evento emergency_gk com 🧤 no texto/emoji",
);

// ── 4. Frontend ───────────────────────────────────────────────────────────
const listeners = readFileSync(
  path.join(__dirname, "../../client/src/hooks/useSocketListeners.js"),
  "utf8",
);
assert(
  listeners.includes('normalizedAction.type === "injury"') &&
    listeners.includes('normalizedAction.type === "user_substitution"') &&
    listeners.includes('normalizedAction.type === "gk_red_card"') &&
    listeners.includes('normalizedAction.type === "emergency_gk"') &&
    listeners.includes('handlers.setInjuryCountdown(60)'),
  "frontend: emergency_gk entra no countdown de 60s",
);
assert(
  listeners.includes('normalizedAction.type === "emergency_gk"'),
  "frontend: emergency_gk é normalizado (candidatos em campo)",
);

const gameCtx = readFileSync(
  path.join(__dirname, "../../client/src/contexts/GameContext.jsx"),
  "utf8",
);
assert(
  gameCtx.includes('matchAction.type === "emergency_gk"'),
  "GameContext: resolveMatchAction trata emergency_gk (escolha única)",
);

const intervencao = readFileSync(
  path.join(__dirname, "../../client/src/components/match/tabs/IntervencaoView.jsx"),
  "utf8",
);
assert(
  intervencao.includes("isEmergencyGk"),
  "IntervencaoView: modo emergency_gk reconhecido",
);
assert(
  intervencao.includes("Vai para a baliza"),
  "IntervencaoView: botão/painel 'Vai para a baliza'",
);

const matchConstants = readFileSync(
  path.join(__dirname, "../../client/src/components/match/matchConstants.js"),
  "utf8",
);
assert(
  matchConstants.includes('"emergency_gk"'),
  "matchConstants: evento emergency_gk visível na cronologia",
);

console.log("\n✅ emergencyGkRegression: all checks passed");