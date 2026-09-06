#!/usr/bin/env node
/**
 * Mobile responsiveness check.
 *
 * Runs the client's *-test.html harnesses (mobile-resp-test, scout-resp-test,
 * intervencao-test, ...) at mobile viewport widths and verifies:
 *   1. No page-level horizontal overflow (document.scrollWidth <= innerWidth)
 *   2. No clipped content in overflow-hidden rows (harness-specific verdict)
 *   3. (info) elements clipping content, small tap targets (< 44px)
 *
 * Contract: each harness renders the REAL component with edge-case fixture
 * data, writes a JSON report into <pre id="report"> prefixed with "REPORT:"
 * and sets data-status="done" (see templates in .pi/skills/mobile-resp-check).
 *
 * Usage:
 *   node scripts/mobileRespCheck.mjs [harness ...] [options]
 *
 * Args:
 *   harness ...          Harness name (without .html) or path. Default: all
 *                        *-test.html at the client root.
 * Options:
 *   --port <n>           Vite dev port (default 5199). Reused if already serving.
 *   --widths <list>      Comma-separated viewport widths (default 320,360,390,414,430)
 *   --height <n>         Viewport height (default 844)
 *   --screenshots <dir>  Save a viewport PNG per harness×width
 *   --keep-server        Do not kill the vite server started by this script
 *   --concurrency <n>    How many pages to run in parallel (default 10)
 *
 * Env:
 *   CHROMIUM_PATH        Chromium executable (default: auto-detect)
 *
 * Exit code: 0 all PASS, 1 any FAIL, 2 setup error.
 */
import { readdirSync, existsSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { homedir } from "node:os";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";

const clientRoot = resolve(import.meta.dirname, "..");

// ── Args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const opts = {
  port: 5199,
  widths: [320, 360, 390, 414, 430],
  height: 844,
  screenshots: null,
  keepServer: false,
  concurrency: 10,
  harnesses: [],
};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--port") opts.port = Number(argv[++i]);
  else if (a === "--widths")
    opts.widths = argv[++i].split(",").map((s) => Number(s.trim()));
  else if (a === "--height") opts.height = Number(argv[++i]);
  else if (a === "--screenshots") opts.screenshots = argv[++i];
  else if (a === "--keep-server") opts.keepServer = true;
  else if (a === "--concurrency") opts.concurrency = Math.max(1, Number(argv[++i]));
  else opts.harnesses.push(a);
}

// ── Harness discovery ───────────────────────────────────────────────────────
function discoverHarnesses() {
  const all = readdirSync(clientRoot)
    .filter((f) => f.endsWith("-test.html"))
    .map((f) => f.replace(/\.html$/, ""));
  if (opts.harnesses.length === 0) return all;
  return opts.harnesses.map((h) => h.replace(/\.html$/, ""));
}

const harnesses = discoverHarnesses();
if (harnesses.length === 0) {
  console.error("No harnesses found (expected *-test.html at client root).");
  process.exit(2);
}

// ── Chromium ────────────────────────────────────────────────────────────────
function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const candidates = [
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  const cache = join(homedir(), ".cache", "ms-playwright");
  if (existsSync(cache)) {
    const dirs = readdirSync(cache)
      .filter((d) => d.startsWith("chromium-"))
      .sort()
      .reverse();
    for (const d of dirs) {
      const p = join(cache, d, "chrome-linux64", "chrome");
      if (existsSync(p)) return p;
    }
  }
  throw new Error(
    "No chromium found. Install chromium or set CHROMIUM_PATH.",
  );
}

// ── Vite server ─────────────────────────────────────────────────────────────
async function probe(base) {
  try {
    const res = await fetch(base, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForServer(base, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await probe(base)) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function ensureServer(port) {
  const base = `http://localhost:${port}`;
  if (await probe(base)) return { base, proc: null };
  const proc = spawn(
    "npm",
    ["run", "dev", "--", "--port", String(port), "--strictPort"],
    { cwd: clientRoot, stdio: ["ignore", "pipe", "pipe"] },
  );
  let log = "";
  proc.stdout.on("data", (d) => (log += d));
  proc.stderr.on("data", (d) => (log += d));
  const ok = await waitForServer(base);
  if (!ok) {
    proc.kill("SIGTERM");
    throw new Error(`vite dev did not start on port ${port}:\n${log}`);
  }
  return { base, proc };
}

// ── Generic in-page measurement (runner-side, harness-agnostic) ────────────
function genericMeasure() {
  const vw = window.innerWidth;
  const doc = document.documentElement;
  const pageOverflowPx = doc.scrollWidth - vw;
  // Intentional text truncation (class `truncate`) is not a defect.
  const clipping = [...document.querySelectorAll("*")]
    .filter((el) => {
      if (el.classList?.contains?.("truncate")) return false;
      const ov = getComputedStyle(el).overflowX;
      return (
        (ov === "hidden" || ov === "auto") &&
        el.scrollWidth > el.clientWidth + 1
      );
    })
    .map((el) => ({
      tag: el.tagName.toLowerCase(),
      cls: (el.className && el.className.toString().slice(0, 80)) || "",
      excess: el.scrollWidth - el.clientWidth,
    }))
    .sort((a, b) => b.excess - a.excess)
    .slice(0, 10);
  const interactive = [
    ...document.querySelectorAll(
      "button, a, [role='button'], input, select, textarea",
    ),
  ];
  const smallTargets = interactive.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && (r.height < 44 || r.width < 44);
  }).length;
  return { pageOverflowPx, clipping, smallTargets, interactiveCount: interactive.length };
}

// ── Main ────────────────────────────────────────────────────────────────────
const { base, proc } = await ensureServer(opts.port);
const failures = [];
const rows = [];

// Build the ordered task list (harness order, then width), flagging missing files
// up front so a missing harness cannot crash a worker pool.
const tasks = [];
const missing = [];
for (const harness of harnesses) {
  const file = `${harness}.html`;
  if (!existsSync(join(clientRoot, file))) {
    missing.push({ harness: file, width: "-", reason: "file not found" });
    continue;
  }
  for (const width of opts.widths) tasks.push({ harness, file, width });
}
for (const m of missing) {
  rows.push({ harness: m.harness, width: "-", fail: [m.reason], detail: {} });
}

async function runTask(browser, task) {
  const { harness, file, width } = task;
  let page;
  try {
    page = await browser.newPage({ viewport: { width, height: opts.height } });
    const pageErrors = [];
    const resourceErrors = [];
    page.on("console", (m) => {
      if (m.type() === "error") resourceErrors.push(m.text());
    });
    page.on("pageerror", (e) => pageErrors.push(String(e)));

    const entry = { harness: file, width, fail: [] };
    try {
      await page.goto(`${base}/${file}`, { waitUntil: "load", timeout: 30000 });
      await page.waitForSelector('#report[data-status="done"]', {
        timeout: 20000,
      });
      const raw = await page.textContent("#report");
      const report = JSON.parse(raw.replace(/^REPORT:/, ""));
      // Hide the report before the generic measure so it cannot skew layout.
      await page.evaluate(() => {
        const r = document.getElementById("report");
        if (r) r.style.display = "none";
      });
      const generic = await page.evaluate(genericMeasure);

      if (report.verdict !== "PASS") entry.fail.push("harness verdict FAIL");
      if (generic.pageOverflowPx > 0)
        entry.fail.push(`page overflow ${generic.pageOverflowPx}px`);
      if ((report.clippedPlayerRows || report.clippedRows || []).length > 0)
        entry.fail.push(
          `${(report.clippedPlayerRows || report.clippedRows).length} clipped row(s)`,
        );
      // JS exceptions are real defects; resource 404s (fonts/favicon) are not.
      if (pageErrors.length > 0)
        entry.fail.push(`page errors: ${pageErrors.slice(0, 3).join(" | ")}`);

      entry.detail = {
        pageOverflowPx: generic.pageOverflowPx,
        resourceErrors: resourceErrors.length,
        pageErrors: pageErrors.length,
        clippedRows: (report.clippedPlayerRows || report.clippedRows || []).length,
        clipEls: generic.clipping.length,
        smallTargets: `${generic.smallTargets}/${generic.interactiveCount}`,
        clipping: generic.clipping,
        extra: {
          clippedButtons: report.clippedButtons,
          squashedInputs: report.squashedInputs,
          filterInputWidths: report.filterInputWidths,
        },
      };
    } catch (err) {
      entry.fail.push(`error: ${err.message.split("\n")[0]}`);
      entry.detail = {};
    }
    if (opts.screenshots) {
      mkdirSync(opts.screenshots, { recursive: true });
      await page.screenshot({
        path: join(opts.screenshots, `${harness}-${width}.png`),
      });
    }
    return entry;
  } finally {
    if (page) await page.close();
  }
}

let browser;
try {
  browser = await chromium.launch({
    executablePath: findChromium(),
    args: ["--no-sandbox", "--disable-gpu"],
  });

  // Bound-concurrency pool over the task list. Each worker takes the next task
  // off the shared queue; results stay deterministic because we sort below.
  const results = [];
  let cursor = 0;
  const workers = Array.from(
    { length: Math.max(1, Math.min(opts.concurrency, tasks.length)) },
    async () => {
      while (true) {
        const task = tasks[cursor++];
        if (task === undefined) break;
        let entry;
        try {
          entry = await runTask(browser, task);
        } catch (err) {
          entry = {
            harness: task.file,
            width: task.width,
            fail: [`error: ${err.message.split("\n")[0]}`],
            detail: {},
          };
        }
        results.push(entry);
      }
    },
  );
  await Promise.all(workers);

  rows.push(...results);
  // Deterministic order: harness order, then width order.
  const rank = new Map(harnesses.map((h, i) => [h, i]));
  rows.sort(
    (a, b) =>
      (rank.get(a.harness.replace(/\.html$/, "")) ?? 0) -
        (rank.get(b.harness.replace(/\.html$/, "")) ?? 0) ||
      opts.widths.indexOf(a.width) - opts.widths.indexOf(b.width),
  );
  for (const entry of rows) if (entry.fail.length > 0) failures.push(entry);
} finally {
  if (browser) await browser.close();
  if (proc && !opts.keepServer) proc.kill("SIGTERM");
}

// ── Report ──────────────────────────────────────────────────────────────────
console.log("CashBall mobile responsiveness check");
console.log(`server: ${base}`);
console.log(
  `harnesses: ${harnesses.join(", ")} | widths: ${opts.widths.join(", ")} | height: ${opts.height}`,
);
console.log("");

for (const harness of harnesses) {
  console.log(harness + ".html");
  for (const r of rows.filter((x) => x.harness === harness + ".html")) {
    const status = r.fail.length === 0 ? "PASS" : "FAIL";
    const d = r.detail || {};
    console.log(
      `  ${String(r.width).padStart(4)}  ${status.padEnd(4)}  ` +
        `overflow=${d.pageOverflowPx ?? "?"}px  clippedRows=${d.clippedRows ?? "?"}  ` +
        `clipEls=${d.clipEls ?? "?"}  smallTargets=${d.smallTargets ?? "?"}  ` +
        `pageErr=${d.pageErrors ?? 0}  resErr=${d.resourceErrors ?? 0}`,
    );
    for (const f of r.fail) console.log(`        ✗ ${f}`);
    for (const c of d.clipping || [])
      console.log(
        `        · clipping: <${c.tag}${c.cls ? " " + c.cls : ""}> +${c.excess}px`,
      );
  }
  console.log("");
}

const total = rows.length;
const failed = failures.length;
if (failed === 0) {
  console.log(`RESULT: PASS (${total}/${total} checks)`);
  process.exit(0);
} else {
  console.log(`RESULT: FAIL (${failed}/${total} checks failed)`);
  process.exit(1);
}
