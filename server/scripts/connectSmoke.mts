/**
 * Smoke de ligação — arranca o servidor e fala com ele por socket.io.
 *
 * Porque existe: `server/index.ts` tem `// @ts-nocheck` (linha 1), por isso o
 * `typecheck` NÃO vê identificadores inexistentes lá dentro. Um nome mal
 * qualificado nos deps dos handlers (`emitPresencePause` em vez de
 * `roomState.emitPresencePause`) só rebentava em runtime — e rebentava em
 * TODAS as ligações, deixando o cliente sem entrar em sala nenhuma.
 * Este smoke é o que falha nesse caso.
 *
 * Não cria salas nem contas: liga, envia um `joinGame` sem token válido e
 * exige a resposta `joinError` (prova que os handlers estão registados e que
 * o callback de `connection` não lançou).
 *
 * Uso: cd server && npm run test:connect-smoke
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.join(scriptDir, "..");
// O cliente já tem socket.io-client; o servidor não precisa da dependência só
// para um smoke de dev.
const clientRequire = createRequire(
  path.join(serverDir, "..", "client", "package.json"),
);
const { io } = clientRequire("socket.io-client");

/** Porta livre escolhida pelo SO — uma porta fixa deixava um servidor órfão
 *  de uma corrida anterior a servir as seguintes (falso PASS silencioso). */
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

const PORT = Number(process.env.SMOKE_PORT) || (await freePort());
const BASE = `http://127.0.0.1:${PORT}`;
const BOOT_TIMEOUT_MS = 45_000;

function fail(msg: string): never {
  console.error(`❌ connect-smoke: ${msg}`);
  process.exit(1);
}

const server = spawn("npx", ["tsx", "index.ts"], {
  cwd: serverDir,
  env: { ...process.env, PORT: String(PORT) },
  stdio: ["ignore", "pipe", "pipe"],
  // Grupo próprio: matar só o `npx` deixava o node filho vivo com a porta.
  detached: true,
});

let serverOutput = "";
server.stdout.on("data", (d) => (serverOutput += String(d)));
server.stderr.on("data", (d) => (serverOutput += String(d)));

const cleanup = () => {
  try {
    // Grupo inteiro (npx + node filho).
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

async function waitForHealth(): Promise<void> {
  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      fail(`o servidor saiu no arranque (código ${server.exitCode})\n${serverOutput}`);
    }
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return;
    } catch {
      /* ainda a arrancar */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  fail(`o servidor não respondeu a /health em ${BOOT_TIMEOUT_MS} ms\n${serverOutput}`);
}

async function checkConnection(): Promise<void> {
  return new Promise<void>((resolve) => {
    const socket = io(BASE, { transports: ["websocket"], timeout: 8000 });
    let settled = false;
    const finish = (ok: boolean, detail: string, then?: () => void) => {
      if (settled) return;
      settled = true;
      socket.disconnect();
      if (!ok) fail(detail);
      console.log(`ok   — ${detail}`);
      if (then) then();
      else resolve();
    };

    socket.on("connect", () => {
      // Token inválido de propósito: o servidor tem de responder joinError.
      socket.emit("joinGame", {
        name: "smoke",
        token: "0".repeat(64),
        roomCode: "ZZZZZZ",
        deviceId: "smoke-device",
      });
    });
    socket.on("joinError", (msg) => {
      if (settled) return;
      console.log(`ok   — ligação viva (joinError: ${msg})`);
      // Um throw a meio do callback de `connection` deixa os handlers
      // registados DEPOIS dele por registar — os últimos (treino) morrem em
      // silêncio e o cliente fica sem resposta. Perguntar a um deles é a
      // prova direta de que o registo chegou ao fim.
      const timer = setTimeout(
        () =>
          finish(
            false,
            `handler de treino não respondeu — registo de handlers interrompido?\n${serverOutput}`,
          ),
        8000,
      );
      socket.emit("getTrainingFocus", (focus: unknown) => {
        clearTimeout(timer);
        finish(true, `handlers registados até ao fim (getTrainingFocus → ${focus})`);
      });
    });
    socket.on("connect_error", (err) =>
      finish(false, `connect_error — ${err?.message ?? err}\n${serverOutput}`),
    );
    setTimeout(
      () => finish(false, `sem resposta ao joinGame em 12s\n${serverOutput}`),
      12_000,
    );
  });
}

await waitForHealth();
console.log(`ok   — servidor de pé em ${BASE}`);
await checkConnection();
// Dar tempo ao stdout do servidor antes de o varrer.
await new Promise((r) => setTimeout(r, 800));

// Qualquer erro de runtime nos handlers é a falha que este smoke existe para
// apanhar — o @ts-nocheck esconde-os do typecheck.
if (/ReferenceError|is not defined|Uncaught/.test(serverOutput)) {
  fail(`erro de runtime no servidor:\n${serverOutput}`);
}

console.log("\n✅ connect-smoke: ligação e handlers OK");
process.exit(0);
