/**
 * Helpers partilhados para scrape do zerozero — usados pela TUI e pelos scripts antigos.
 * Só faz GET a HTML público, com throttle e cache em .cache/zerozero.
 */
import fs from "fs";
import path from "path";

export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
export const BASE = "https://www.zerozero.pt";
export const SEASON_DEFAULT = "156";

const CACHE_DIR = path.join(process.cwd(), ".cache", "zerozero");

function ensureCache() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchHtml(url: string, cacheKey?: string): Promise<string> {
  ensureCache();
  if (cacheKey) {
    const p = path.join(CACHE_DIR, cacheKey + ".html");
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf-8");
  }
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "pt-PT,pt;q=0.9" },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
  const html = await res.text();
  if (html.includes("Suspenso") || html.includes("Just a moment")) {
    throw new Error("zerozero em manutenção / Cloudflare challenge — tenta mais tarde");
  }
  if (cacheKey) {
    fs.writeFileSync(path.join(CACHE_DIR, cacheKey + ".html"), html);
  }
  return html;
}

export function extractOgImage(html: string): string | null {
  let m = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/);
  if (!m) m = html.match(/content="([^"]+)"[^>]*property="og:image"/);
  const og = m ? m[1] : null;
  if (!og) return null;
  if (og.startsWith("//")) return "https:" + og;
  if (og.startsWith("/")) return BASE + og;
  return og;
}

export function extractHeaderColor(html: string): string | null {
  const m = html.match(/#page_header_container[^}]*background-color:\s*([^;}\s]+)/i)
    || html.match(/page_header[^>]*style="[^"]*background-color:\s*([^;"]+)/i);
  return m ? m[1].trim() : null;
}

export function extractCoach(html: string): { name: string; href: string } | null {
  const start = html.indexOf('<div id="team_staff"');
  if (start === -1) return null;
  const body = html.slice(start);
  const secIdx = body.indexOf('<div class="section">Treinador</div>');
  if (secIdx === -1) return null;
  const staffIdx = body.indexOf('<div class="staff">', secIdx);
  if (staffIdx === -1) return null;
  const seg = body.slice(staffIdx, staffIdx + 3000);
  const m = seg.match(/\/treinador\/([a-z0-9-]+)\/([0-9]+)[^"]*"[^>]*>([^<]+)<\/a>/);
  return m ? { name: m[3].trim(), href: `/treinador/${m[1]}/${m[2]}` } : null;
}

export function extractPlayers(html: string): Array<{ name: string; href: string; id: string }> {
  const start = html.indexOf('<div id="team_squad"');
  if (start === -1) return [];
  const body = html.slice(start, html.indexOf('<div id="team_staff"', start) !== -1 ? html.indexOf('<div id="team_staff"', start) : undefined);
  const re = /\/jogador\/([a-z0-9-]+)\/([0-9]+)[^"]*"[^>]*>([^<]+)<\/a>/g;
  const out: Array<{ name: string; href: string; id: string }> = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    if (seen.has(m[2])) continue;
    seen.add(m[2]);
    out.push({ name: m[3].trim(), href: `/jogador/${m[1]}/${m[2]}`, id: m[2] });
  }
  return out;
}

export async function downloadImage(url: string, dest: string): Promise<boolean> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1500) return false;
  // skip placeholder
  if (buf.length < 5000 && url.includes("zerozero_og-default")) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  return true;
}

export function flagFromCountry(countryEmoji: string): string | null {
  // emoji -> ISO, já mapeado nas fixtures; aqui placeholder
  return null;
}
