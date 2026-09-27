/**
 * Repro E2E do hang no finalize da liga (sala 034IM2, produção).
 *
 * Sobe o servidor real (tsx index.ts), regista um treinador, entra numa sala
 * nova, monta o 11, joga o amigável + a jornada 1 da liga até ao fim e exige
 * `matchResults` da liga. Resolve janelas de decisão e patrocinador sozinho.
 *
 * PASS = matchResults da liga recebido. FAIL = timeout sem matchResults
 * (sintoma do hang: 90' parado, menus livres, sala em match_finalizing).
 *
 * Uso: cd server && npx tsx scripts/finalizeRepro.mts
 * Env: REPRO_PORT (default: porta livre), REPRO_TIMEOUT_MS (default: 12min).
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.join(scriptDir, "..");
const clientRequire = createRequire(
  path.join(serverDir, "..", "client", "package.json"),
);
const { io } = clientRequire("socket.io-client");

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

const PORT = Number(process.env.REPRO_PORT) || (await freePort());
const BASE = `http://127.0.0.1:${PORT}`;
const TIMEOUT_MS = Number(process.env.REPRO_TIMEOUT_MS) || 12 * 60 * 1000;
const NAME = `Repro${Math.random().toString(36).slice(2, 6)}`;
const PASSWORD = "repro123456";

function fail(msg: string): never {
  console.error(`❌ finalize-repro: ${msg}`);
  process.exit(1);
}

// ── servidor ────────────────────────────────────────────────────────────────
const server = spawn("npx", ["tsx", "index.ts"], {
  cwd: serverDir,
  env: { ...process.env, PORT: String(PORT) },
  stdio: ["ignore", "pipe", "pipe"],
  detached: true,
});
let serverOutput = "";
server.stdout.on("data", (d) => (serverOutput += String(d)));
server.stderr.on("data", (d) => (serverOutput += String(d)));
const cleanup = () => {
  try {
    process.kill(-server.pid, "SIGKILL");
  } catch {
    try {
      server.kill("SIGKILL");
    } catch {
      /* já morreu */
    }
  }
};
process.on("exit", cleanup);
process.on("SIGINT", () => process.exit(2));

// Espera o HTTP do servidor acordar (página serve sempre, mesmo sem frontend).
async function waitForBoot(timeoutMs = 45_000): Promise<void> {
  const t0 = Date.now();
  for (;;) {
    try {
      const res = await fetch(`${BASE}/socket.io/?EIO=4&transport=polling`);
      if (res.ok || res.status === 400) return;
    } catch {
      /* ainda a arrancar */
    }
    if (Date.now() - t0 > timeoutMs) fail("servidor não arrancou a tempo");
    await new Promise((r) => setTimeout(r, 500));
  }
}
await waitForBoot();
console.log(`ok   — servidor de pé em ${BASE}`);

// ── registo + sessão ────────────────────────────────────────────────────────
const regRes = await fetch(`${BASE}/auth/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: NAME, password: PASSWORD }),
});
if (!regRes.ok) fail(`registo falhou: HTTP ${regRes.status}`);
const { token } = (await regRes.json()) as any;
if (!token) fail("registo sem token");
console.log(`ok   — treinador ${NAME} registado`);

// ── cliente socket ──────────────────────────────────────────────────────────
const socket = io(BASE, { transports: ["websocket"] });
let teamId: number | null = null;
let roomCode = "";
let tacticSent = false;
let leagueDone = false;
let resultsSeen = false;
let advancedSeen = false;
let lastMinute = -1;

function sendReady() {
  if (!leagueDone) socket.emit("setReady", true);
}

socket.on("connect", () => {
  console.log("ok   — socket ligado, a entrar em sala nova…");
  socket.emit("joinGame", {
    name: NAME,
    token,
    joinMode: "new-game",
    deviceId: "finalize-repro",
  });
});
socket.on("joinGameSuccess", ({ roomCode: rc }: any) => {
  roomCode = rc;
  console.log(`ok   — sala ${roomCode} criada`);
  socket.emit("setSimSpeed", { speed: "fast" });
});
socket.on("joinError", (msg: any) => fail(`joinError: ${msg}`));
socket.on("teamAssigned", ({ teamId: tid, teamName }: any) => {
  teamId = tid;
  console.log(`ok   — equipa ${teamName} (id=${tid})`);
  socket.emit("requestTeamSquad", tid);
});
socket.on("teamSquadData", ({ squad }: any) => {
  if (tacticSent || !Array.isArray(squad)) return;
  tacticSent = true;
  const grs = squad.filter((p: any) => p.position === "GR");
  const field = squad.filter((p: any) => p.position !== "GR");
  const titulars = [grs[0], ...field.slice(0, 10)].filter(Boolean);
  const subs = [grs[1], ...field.slice(10, 16)].filter(Boolean);
  const positions: Record<number, string> = {};
  for (const p of titulars) positions[p.id] = "Titular";
  for (const p of subs) positions[p.id] = "Suplente";
  console.log(
    `ok   — tática enviada (${titulars.length} titulares, ${subs.length} suplentes)`,
  );
  socket.emit("setTactic", {
    formation: "4-4-2",
    style: "Balanced",
    positions,
  });
  sendReady();
});
// Janelas de decisão (penálti, lesão, GR, subs): fallback imediato.
socket.on("matchActionRequired", ({ actionId, teamId: tid }: any) => {
  console.log(`     … ação ${actionId} → fallback imediato`);
  socket.emit("resolveMatchAction", { actionId, teamId: tid });
});
socket.on("matchMinuteUpdate", ({ minute }: any) => {
  if (minute !== lastMinute && minute % 15 === 0) {
    lastMinute = minute;
    console.log(`     … minuto ${minute}`);
  }
});
socket.on("halfTimeResults", () => {
  console.log("ok   — intervalo, a confirmar Pronto");
  sendReady();
});
socket.on("cupHalfTimeResults", () => {
  console.log("ok   — intervalo (taça/amigável), a confirmar Pronto");
  sendReady();
});
socket.on("seasonState", (st: any) => {
  if (leagueDone) return;
  // Prova de avanço: a jornada só conta se o calendário andar (evitar matar o
  // servidor a meio da finalização como se estivesse tudo bem).
  if (resultsSeen && st && (st.calendarIndex > 1 || st.matchweek > 1)) {
    console.log(
      `… sala avançou (calendarIndex=${st.calendarIndex} matchweek=${st.matchweek} season=${st.season}) — a aguardar escrita final…`,
    );
    advancedSeen = true;
  }
  sendReady();
});
// Só sair depois do mySquad pós-jogo + margem: garante persist + lobby
// gravados em disco antes de matar o servidor.
function gracefulExit() {
  if (leagueDone) return;
  leagueDone = true;
  setTimeout(() => {
    console.log("✅ sala avançada e persistida!");
    socket.disconnect();
    process.exit(0);
  }, 8000);
}
socket.on("mySquad", () => {
  if (advancedSeen) gracefulExit();
});
// Patrocinador bloqueante: pede ofertas e escolhe a primeira.
socket.on("sponsorState", (st: any) => {
  if (st?.pending) {
    console.log("     … patrocinador pendente, a pedir ofertas");
    socket.emit("requestSponsorOffers", { teamId });
  }
});
socket.on("sponsorOffers", ({ offers }: any) => {
  const first = Array.isArray(offers) ? offers[0] : null;
  if (first) {
    console.log(`     … a escolher patrocinador ${first.id ?? first.name}`);
    socket.emit("chooseSponsor", {
      teamId,
      sponsorId: first.id ?? first.sponsorId,
    });
    sendReady();
  }
});
socket.on("systemMessage", (msg: any) => {
  const text = typeof msg === "string" ? msg : msg?.text;
  if (text) console.log(`     … sistema: ${String(text).slice(0, 100)}`);
});
socket.on("matchResults", (data: any) => {
  const hasMom = (data?.results || []).some((r: any) => r.mom != null);
  console.log(
    `… matchResults da liga recebido (mw=${data?.matchweek} resultados=${data?.results?.length} mom=${hasMom}) — a aguardar avanço…`,
  );
  resultsSeen = true;
  setTimeout(() => {
    if (!leagueDone) {
      clearInterval(beat);
      fail("matchResults recebido mas a sala não avançou em 120s");
    }
  }, 120_000);
});

// Heartbeat: re-armar o Pronto (idempotente) até ao fim da liga.
const beat = setInterval(sendReady, 8000);

setTimeout(() => {
  clearInterval(beat);
  fs.writeFileSync("/tmp/finalize-repro-server.log", serverOutput);
  const tail = serverOutput.split("\n").slice(-25).join("\n");
  if (process.env.REPRO_KEEP_ALIVE) {
    console.log(
      `⏸ wedged — servidor mantido vivo em ${BASE} sala ${roomCode} (log: /tmp/finalize-repro-server.log)`,
    );
    setInterval(() => {}, 60_000);
    return;
  }
  fail(
    `timeout sem matchResults da liga. Último minuto visto: ${lastMinute}. Log completo em /tmp/finalize-repro-server.log.\n--- cauda do servidor ---\n${tail}`,
  );
}, TIMEOUT_MS);
