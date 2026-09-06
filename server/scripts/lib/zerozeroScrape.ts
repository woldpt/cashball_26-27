/**
 * Helpers partilhados para scrape do zerozero — usados pela TUI e scripts.
 * Só faz GET a HTML público, com throttle, cache em .cache/zerozero e
 * detecção de placeholder/Cloudflare.
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

export function isPlaceholderImage(url: string | null | undefined): boolean {
  if (!url) return true;
  return /zerozero_og-default|cdn-files\.staticzz/i.test(url);
}

export async function fetchHtml(url: string, cacheKey?: string, noCache = false): Promise<string> {
  ensureCache();
  const p = cacheKey ? path.join(CACHE_DIR, cacheKey + ".html") : null;
  if (p && !noCache && fs.existsSync(p)) return fs.readFileSync(p, "utf-8");
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "pt-PT,pt;q=0.9" },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
  const html = await res.text();
  if (html.includes("Suspenso") || html.includes("Just a moment")) {
    throw new Error("zerozero em manutenção / Cloudflare challenge — tenta mais tarde");
  }
  if (p) fs.writeFileSync(p, html);
  return html;
}

export function cachedHtml(key: string): string | null {
  const p = path.join(CACHE_DIR, key + ".html");
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, "utf-8");
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
  if (!m) return null;
  let raw = m[1].trim().replace(/!important/g, "").trim();
  // rgb(39,62,124) -> #273E7C
  const rgb = raw.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (rgb) {
    const toHex = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();
    return `#${toHex(Number(rgb[1]))}${toHex(Number(rgb[2]))}${toHex(Number(rgb[3]))}`;
  }
  if (/^#[0-9a-f]{3,8}$/i.test(raw)) return raw.toUpperCase();
  return raw;
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

export type Pos = "GR" | "DEF" | "MED" | "ATA";

export interface ScrapePlayer {
  name: string;
  href: string;
  id: string;
  position: Pos | null;
  flag: string | null; // ISO 2 (ex.: PT)
  age: number | null;
  value: number | null; // euros
}

const POS_MAP: Record<string, Pos> = {
  "Guarda Redes": "GR",
  "Guarda-Redes": "GR",
  "Defesa": "DEF",
  "Médio": "MED",
  "Meio-Campo": "MED",
  "Avançado": "ATA",
};

function parseValue(text: string): number | null {
  const m = text.match(/([\d.,]+)\s*(M|mil)?\s*(?:€|&euro;)/);
  if (!m) return null;
  const num = parseFloat(m[1].replace(",", "."));
  if (!isFinite(num)) return null;
  return m[2] === "M" ? Math.round(num * 1_000_000) : Math.round(num * 1000);
}

export function extractPlayers(html: string): ScrapePlayer[] {
  const start = html.indexOf('<div id="team_squad"');
  if (start === -1) return [];
  const endIdx = html.indexOf('<div id="team_staff"', start);
  const body = html.slice(start, endIdx !== -1 ? endIdx : undefined);

  // percorre secções (posição) + staff (jogador) em ordem
  const events: Array<{ index: number; isSection: boolean; value: string | null }> = [];
  const re = /<div class="section">([^<]+)<\/div>|<div class="staff">/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    events.push({ index: m.index, isSection: !!m[1], value: m[1] || null });
  }

  const players: ScrapePlayer[] = [];
  const seen = new Set<string>();
  let currentPos: Pos | null = null;
  const STAFF_TAG = '<div class="staff">';

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.isSection) {
      currentPos = POS_MAP[e.value!.trim()] || null;
      continue;
    }
    const bodyStart = e.index + STAFF_TAG.length;
    const bodyEnd = i + 1 < events.length ? events[i + 1].index : body.length;
    const s = body.slice(bodyStart, bodyEnd);
    const nameM = s.match(/\/jogador\/([a-z0-9-]+)\/([0-9]+)[^"]*"[^>]*>([^<]+)<\/a>/);
    if (!nameM) continue;
    if (seen.has(nameM[2])) continue;
    seen.add(nameM[2]);
    const flagM = s.match(/class="flag:([A-Z]{2})"/);
    const infoM = s.match(/<span>(\d+\s*anos[^<]*)<\/span>/);
    const info = infoM ? infoM[1] : "";
    const ageM = info.match(/(\d+)\s*anos/);
    players.push({
      name: nameM[3].trim(),
      href: `/jogador/${nameM[1]}/${nameM[2]}`,
      id: nameM[2],
      position: currentPos,
      flag: flagM ? flagM[1] : null,
      age: ageM ? parseInt(ageM[1], 10) : null,
      value: parseValue(info),
    });
  }
  return players;
}

export async function downloadImage(url: string, dest: string): Promise<boolean> {
  // skip placeholder ANTES de bater no CDN
  if (isPlaceholderImage(url)) return false;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return false;
  const ct = res.headers.get("content-type") || "";
  if (!ct.startsWith("image/")) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1500) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  return true;
}

export function isoToEmoji(cc: string | null | undefined): string | null {
  if (!cc || cc.length !== 2) return null;
  try {
    return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));
  } catch {
    return null;
  }
}

export function normName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}
