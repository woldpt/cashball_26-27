/**
 * Simulador de épocas — corre o jogo verdadeiro, só com NPCs, sem relógio.
 *
 * Carrega o servidor real no mesmo processo (index.ts → simBridge), cria uma
 * sala nova a partir do base.db e chama o `checkAllReady` de produção até
 * jogar N épocas. As esperas (pausas, minutos de jogo, leilões) passam num
 * instante pelo relógio virtual (lib/virtualClock.ts). Nada é reimplementado:
 * finanças, mercado, contratos, treino, Taça e fim de época são os de produção.
 *
 * Serve para auditar o efeito de uma regra ao fim de várias épocas — dinheiro
 * em jogo, plantéis, mercado, equilíbrio das ligas — e para apanhar salas que
 * ficam presas ou erros que só aparecem tarde.
 *
 * Uso: cd server && npm run sim:seasons -- [opções]
 *   --seasons N    épocas a jogar (default 3)
 *   --runs N       salas independentes; o relatório mostra a média (default 1)
 *   --seed N       semente do acaso: fixa o ponto de partida (equipas sorteadas);
 *                  o desenrolar ainda varia de corrida para corrida, porque a
 *                  ordem das escritas em disco mexe na ordem dos sorteios
 *   --lobby S      segundos virtuais entre jornadas, para os leilões fecharem (default 180)
 *   --json FICH    grava todas as medições em JSON (para comparar antes/depois)
 *   --keep         não apaga as salas (saves/_sim/) — dá para correr audit:gamestate
 *   --verbose      mostra o log do servidor
 *
 * Para comparar antes/depois de uma mudança: correr com --runs 3 (ou mais) dos
 * dois lados e comparar as médias — uma sala só varia uns 5% por si.
 *
 * Limites: sem treinadores humanos (bilhete, empréstimos e táticas humanas não
 * são exercitados). As medições de cada época são tiradas na última jornada,
 * antes dos prémios de fim de época (esses aparecem na época seguinte).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { installVirtualClock } from "./lib/virtualClock";

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const opt = (name: string, def: number) => {
  const i = argv.indexOf(`--${name}`);
  const v = i >= 0 ? Number(argv[i + 1]) : NaN;
  return Number.isFinite(v) ? v : def;
};
const SEASONS = Math.max(1, opt("seasons", 3));
const RUNS = Math.max(1, opt("runs", 1));
const LOBBY_MS = Math.max(0, opt("lobby", 180)) * 1000;
const SEED = opt("seed", NaN);
const JSON_OUT = argv.includes("--json") ? argv[argv.indexOf("--json") + 1] : null;

// ── Acaso com semente (antes de carregar o servidor) ────────────────────────
if (Number.isFinite(SEED)) {
  let a = SEED >>> 0 || 1;
  Math.random = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const out = (line = "") => process.stdout.write(line + "\n");
installVirtualClock();
process.env.PORT = String(39000 + Math.floor(Math.random() * 900));

const errors = new Map<string, number>();
function silence() {
  if (flag("verbose")) return;
  console.log = () => {};
  console.warn = () => {};
  console.info = () => {};
  console.error = (...args: any[]) => {
    const msg = args
      .map((a) => (a instanceof Error ? a.message : typeof a === "string" ? a : JSON.stringify(a)))
      .join(" ")
      .replace(/\[SIM\w+\]/g, "")
      .replace(/\d+/g, "#")
      .trim()
      .slice(0, 140);
    errors.set(msg, (errors.get(msg) ?? 0) + 1);
  };
}
silence();
const { simBridge } = await import("../index");
silence(); // o logBootstrap do servidor volta a ligar a consola
errors.clear(); // o arranque do servidor escreve avisos que não são do jogo
const { checkAllReady, getGame } = simBridge;
const { SEASON_CALENDAR, NPC_POS_MIN } = await import("../gameConstants");
const { savesDirFor } = await import("../db/roomPaths");

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const simDir = path.join(savesDirFor(path.join(scriptDir, "..", "db")), "_sim");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const turn = () => new Promise((r) => setImmediate(r));

type Metrics = Record<string, number>;
type Snapshot = { label: string; metrics: Metrics; notes: Record<string, string> };

const all = (db: any, sql: string, params: any[] = []) =>
  new Promise<any[]>((res, rej) => db.all(sql, params, (e: any, r: any[]) => (e ? rej(e) : res(r || []))));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Fotografia da sala: números por divisão (d1..d5) e globais (all). */
async function snapshot(game: any, label: string): Promise<Snapshot> {
  const db = game.db;
  const m: Metrics = {};
  const notes: Record<string, string> = {};
  const teams = await all(db, "SELECT * FROM teams");
  const players = await all(db, "SELECT id, team_id, position, skill, wage, value FROM players");
  const byTeam = new Map<number, any[]>();
  for (const p of players) {
    if (p.team_id == null) continue;
    (byTeam.get(p.team_id) ?? byTeam.set(p.team_id, []).get(p.team_id)!).push(p);
  }
  const staff = await all(db, "SELECT team_id, COUNT(*) AS n FROM team_staff GROUP BY team_id");
  const staffBy = new Map(staff.map((s) => [s.team_id, s.n]));
  const games = await all(
    db,
    `SELECT t.division AS d, COUNT(*) AS n, SUM(m.home_score + m.away_score) AS goals,
            AVG(m.attendance) AS att, AVG(m.ticket_revenue) AS gate
     FROM matches m JOIN teams t ON t.id = m.home_team_id
     WHERE m.played = 1 AND m.season = ? AND m.competition = 'League' GROUP BY t.division`,
    [game.season],
  );

  let shortTeams = 0;
  for (let d = 1; d <= 5; d++) {
    const T = teams.filter((t) => t.division === d);
    if (!T.length) continue;
    const squads = T.map((t) => (byTeam.get(t.id) ?? []).filter((p) => p.id > 0));
    const k = (name: string) => `d${d}.${name}`;
    m[k("orçamento médio")] = mean(T.map((t) => t.budget));
    m[k("orçamento mínimo")] = Math.min(...T.map((t) => t.budget));
    m[k("orçamento máximo")] = Math.max(...T.map((t) => t.budget));
    m[k("clubes no vermelho")] = T.filter((t) => t.budget < 0).length;
    m[k("dívida média")] = mean(T.map((t) => t.loan_amount || 0));
    m[k("folha semanal")] = mean(squads.map((s) => s.reduce((a, p) => a + (p.wage || 0), 0)));
    m[k("plantel médio")] = mean(squads.map((s) => s.length));
    m[k("plantel mínimo")] = Math.min(...squads.map((s) => s.length));
    m[k("plantel máximo")] = Math.max(...squads.map((s) => s.length));
    m[k("qualidade (14 melhores)")] = mean(
      squads.map((s) => mean(s.map((p) => p.skill || 0).sort((a, b) => b - a).slice(0, 14))),
    );
    m[k("valor do plantel")] = mean(squads.map((s) => s.reduce((a, p) => a + (p.value || 0), 0)));
    m[k("lotação")] = mean(T.map((t) => t.stadium_capacity || 0));
    m[k("massa adepta")] = mean(T.map((t) => t.fanbase || 0));
    m[k("funcionários")] = mean(T.map((t) => staffBy.get(t.id) ?? 0));
    const g = games.find((r) => r.d === d);
    m[k("golos por jogo")] = g?.n ? g.goals / g.n : 0;
    m[k("assistência média")] = g?.att ?? 0;
    m[k("bilheteira por jogo")] = g?.gate ?? 0;
    const table = [...T].sort((a, b) => b.points - a.points);
    m[k("pontos do 1.º")] = table[0].points;
    m[k("pontos do último")] = table[table.length - 1].points;
    notes[k("líder")] = table[0].name;
    const short = squads.filter((s) =>
      Object.entries(NPC_POS_MIN).some(([pos, min]) => s.filter((p) => p.position === pos).length < (min as number)),
    ).length;
    m[k("clubes com posição em falta")] = short;
    shortTeams += short;
  }
  m["all.dinheiro em jogo"] = teams.reduce((a, t) => a + t.budget, 0);
  m["all.clubes no vermelho"] = teams.filter((t) => t.budget < 0).length;
  m["all.clubes com posição em falta"] = shortTeams;
  m["all.jogadores"] = players.filter((p) => p.id > 0).length;
  m["all.jogadores sem clube"] = players.filter((p) => p.team_id == null).length;
  const tr = await all(db, "SELECT source, COUNT(*) AS n, SUM(amount) AS total FROM transfer_history GROUP BY source");
  m["all.transferências (acumulado)"] = tr.reduce((a, r) => a + r.n, 0);
  m["all.volume de transferências (acumulado)"] = tr.reduce((a, r) => a + (r.total || 0), 0);
  for (const r of tr) m[`all.transferências «${r.source}» (acumulado)`] = r.n;
  const formations: Record<string, number> = {};
  for (const v of Object.values(game.tacticFamiliarity ?? {}) as any[]) {
    const f = v?.history?.[v.history.length - 1]?.first;
    if (f) formations[f] = (formations[f] ?? 0) + 1;
  }
  for (const [f, n] of Object.entries(formations)) m[`all.formação ${f}`] = n;
  return { label, metrics: m, notes };
}

type RunResult = { code: string; snapshots: Snapshot[]; stuck: string | null; seconds: number };

async function runOnce(index: number): Promise<RunResult> {
  // O código da sala entra nas sementes do motor: com --seed tem de ser fixo.
  const code = Number.isFinite(SEED)
    ? `SIM${SEED}R${index}`
    : `SIM${Date.now().toString(36).slice(-3).toUpperCase()}${index}`;
  const game: any = await new Promise((res, rej) =>
    getGame(code, (g: any, e: any) => (e || !g ? rej(e ?? new Error("sala não criada")) : res(g)), "_sim"),
  );
  // Sala descartável: sem sincronização de disco (10× mais rápido).
  await new Promise((r) =>
    game.db.exec("PRAGMA synchronous = OFF; PRAGMA journal_mode = MEMORY; PRAGMA temp_store = MEMORY;", r),
  );
  game.simLobbyHoldMs = LOBBY_MS; // tempo de lobby para os leilões fecharem
  const t0 = performance.now();
  const firstSeason = game.season;
  const snapshots: Snapshot[] = [await snapshot(game, "início")];
  let pending: Snapshot | null = null; // última fotografia da época em curso
  let slot = `${game.season}:${game.calendarIndex}`;
  let seen = "";
  let same = 0;
  let stuck: string | null = null;

  while (game.season < firstSeason + SEASONS) {
    const state = `${game.season}:${game.calendarIndex}:${game.gamePhase}`;
    if (state === seen) {
      // ~1 h virtual sem sair do sítio: sala presa.
      if (++same > 3600) {
        stuck = `presa na época ${game.season}, semana ${game.calendarIndex}, fase ${game.gamePhase}`;
        break;
      }
    } else {
      seen = state;
      same = 0;
    }
    const nowSlot = `${game.season}:${game.calendarIndex}`;
    if (nowSlot !== slot) {
      slot = nowSlot;
      // Jornada fechada: fotografia (a última de cada época é a que conta).
      if (game.calendarIndex > 0) pending = await snapshot(game, `época ${game.season - firstSeason + 1}`);
    }
    // A sala anda sozinha sem humanos; isto só dá o primeiro empurrão e
    // volta a empurrar se alguma coisa a deixar parada no lobby.
    await checkAllReady(game).catch((e: any) => console.error("checkAllReady:", e?.message ?? e));
    await turn();
    await sleep(1000);
    if (pending && game.season - firstSeason + 1 > Number(pending.label.split(" ")[1])) {
      snapshots.push(pending);
      process.stderr.write(`  sala ${index + 1}: ${pending.label} feita (${((performance.now() - t0) / 1000).toFixed(0)} s)\n`);
      pending = null;
    }
  }
  if (pending) snapshots.push(pending);
  // Deixa a sala assentar num lobby (o fim de época e o amigável seguinte
  // arrancam sozinhos sem humanos) antes de a auditar.
  game.simLobbyHoldMs = 3_600_000; // segura a sala no próximo lobby
  for (let i = 0; i < 900 && (game._seasonEndRunning || game.gamePhase !== "lobby"); i++) await sleep(1000);
  simBridge.saveGameState(game);
  await sleep(2000);
  return { code, snapshots, stuck, seconds: (performance.now() - t0) / 1000 };
}

// ── Relatório ───────────────────────────────────────────────────────────────
const fmt = (key: string, v: number) => {
  if (!Number.isFinite(v)) return "—";
  if (/orçamento|dinheiro|volume|valor do plantel|dívida/.test(key)) return `${(v / 1e6).toFixed(2)} M`;
  if (/folha|bilheteira/.test(key)) return `${Math.round(v / 1000)} mil`;
  if (/golos|qualidade|plantel médio|funcionários/.test(key)) return v.toFixed(1);
  return String(Math.round(v));
};

function report(results: RunResult[]) {
  const labels = results[0].snapshots.map((s) => s.label);
  const keys = [...new Set(results.flatMap((r) => r.snapshots.flatMap((s) => Object.keys(s.metrics))))];
  const avg = (key: string, label: string) =>
    mean(
      results
        .map((r) => r.snapshots.find((s) => s.label === label)?.metrics[key])
        .filter((v): v is number => v != null),
    );
  const table = (title: string, prefix: string) => {
    const rows = keys.filter((k) => k.startsWith(prefix));
    if (!rows.length) return;
    out(`\n${title}`);
    const w = Math.max(...rows.map((k) => k.length - prefix.length)) + 2;
    out(" ".repeat(w) + labels.map((l) => l.padStart(11)).join(""));
    const rank = (k: string) => (k.includes("formação") ? 2 : k.includes("«") ? 1 : 0);
    for (const k of [...rows].sort((a, b) => rank(a) - rank(b))) {
      // Contadores acumulados mostram-se por época (diferença para a coluna anterior).
      const cumulative = k.endsWith("(acumulado)");
      const cells = labels.map((l, i) => {
        const v = avg(k, l);
        return fmt(k, cumulative && i > 0 ? v - avg(k, labels[i - 1]) : v);
      });
      out(k.slice(prefix.length).replace(" (acumulado)", "").padEnd(w) + cells.map((c) => c.padStart(11)).join(""));
    }
  };
  const NAMES = ["", "1.ª divisão", "2.ª divisão", "3.ª divisão", "4.ª divisão", "5.ª divisão (distritais)"];
  table("Jogo inteiro", "all.");
  for (let d = 1; d <= 5; d++) table(NAMES[d], `d${d}.`);

  const money = labels.map((l) => avg("all.dinheiro em jogo", l));
  if (money.length > 1 && money[0] > 0) {
    out("\nDinheiro em jogo, variação por época: " +
      money.slice(1).map((v, i) => `${(((v - money[i]) / money[i]) * 100).toFixed(0)}%`).join(" · "));
  }
  if (results.length === 1) {
    out("\nLíderes na última jornada:");
    for (const s of results[0].snapshots.slice(1)) {
      out(`  ${s.label}: ` + [1, 2, 3, 4].map((d) => s.notes[`d${d}.líder`]).join(" · "));
    }
  }
}

fs.rmSync(simDir, { recursive: true, force: true });
const started = performance.now();
const results: RunResult[] = [];
for (let i = 0; i < RUNS; i++) results.push(await runOnce(i));

out(`Simulador de épocas — ${RUNS} sala(s) × ${SEASONS} época(s)` +
  (Number.isFinite(SEED) ? ` · semente ${SEED}` : "") +
  ` · ${((performance.now() - started) / 1000).toFixed(0)} s` +
  (RUNS > 1 ? " · valores = média das salas" : ""));
report(results);

const stuck = results.filter((r) => r.stuck);
out("\nSalas presas: " + (stuck.length ? stuck.map((r) => `${r.code} ${r.stuck}`).join("; ") : "nenhuma"));
out(`Erros no registo do servidor: ${[...errors.values()].reduce((a, b) => a + b, 0)}`);
for (const [msg, n] of [...errors].sort((a, b) => b[1] - a[1]).slice(0, 12)) out(`  ${n}× ${msg}`);

// Auditoria de estado de cada sala (budgets vs salários, plantéis, duplicados, fases).
let auditFailed = false;
for (const r of results) {
  const res = spawnSync("npx", ["tsx", path.join(scriptDir, "gameStateAudit.ts"), r.code], {
    cwd: path.join(scriptDir, ".."),
    encoding: "utf8",
  });
  const lines = (res.stdout || "").split("\n").map((l) => l.trim());
  const errs = lines.filter((l) => l.startsWith("❌"));
  // Composição de plantel (mínimos/máximos da seed) é esperada numa sala com
  // mercado a funcionar: conta-se à parte e não chumba a simulação.
  const squadShape = errs.filter((l) => /insufficient|too many/.test(l));
  const other = errs.filter((l) => !squadShape.includes(l));
  if (other.length) auditFailed = true;
  out(`audit:gamestate ${r.code}: ${errs.length} erro(s), ${squadShape.length} de composição de plantel`);
  for (const l of other.slice(0, 8)) out(`  ${l}`);
}

if (JSON_OUT) {
  fs.writeFileSync(
    JSON_OUT,
    JSON.stringify({ seasons: SEASONS, runs: RUNS, seed: Number.isFinite(SEED) ? SEED : null, results, errors: Object.fromEntries(errors) }, null, 1),
  );
  out(`Medições gravadas em ${JSON_OUT}`);
}
if (flag("keep")) out(`Salas guardadas em ${simDir}`);
else fs.rmSync(simDir, { recursive: true, force: true });
process.exit(stuck.length || auditFailed ? 1 : 0);
