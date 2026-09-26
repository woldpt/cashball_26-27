/**
 * fetchZerozeroKits — descarrega a foto do equipamento principal das 60 equipas
 * do zerozero.pt para server/.cache/kits/<slug>.<png|jpg> (só referência visual
 * para classificar db/fixtures/kits.json; não é servida ao cliente).
 *
 * Fonte: <img src="..._shirt_..."> na página da equipa (/equipa/<slug>, época 156).
 * O Escouralense não tem foto de equipamento no zerozero (fallback: cores do brasão).
 *
 * Uso: cd server && npx tsx scripts/fetchZerozeroKits.ts [--refresh]
 */
import fs from "fs";
import path from "path";
import { TEAMS } from "./lib/teamsSource";
import {
  BASE,
  SEASON_DEFAULT as SEASON,
  THROTTLE_EQUIPA,
  jitter,
  fetchHtml,
  downloadImage,
  sleep,
} from "./lib/zerozeroScrape";

function extractShirt(html: string): string | null {
  const m = html.match(/"([^"]*_shirt_[^"]*)"/);
  if (!m) return null;
  const src = m[1];
  if (src.startsWith("//")) return "https:" + src;
  if (src.startsWith("/")) return BASE + src;
  return src;
}

async function main() {
  const refresh = process.argv.includes("--refresh");
  const outDir = path.join(process.cwd(), ".cache", "kits");
  fs.mkdirSync(outDir, { recursive: true });
  let ok = 0;
  for (let i = 0; i < TEAMS.length; i++) {
    const t = TEAMS[i];
    const existing = fs.readdirSync(outDir).find((f) => f.startsWith(t.slug + "."));
    if (!refresh && existing) {
      process.stdout.write(`[${i + 1}/${TEAMS.length}] ${t.name} ... já existe, salto\n`);
      ok++;
      continue;
    }
    const sep = t.url.includes("?") ? "&" : "?";
    const pageUrl = `${BASE}${t.url}${sep}epoca_id=${SEASON}`;
    const cacheKey = `team_${t.url.replace(/[^a-z0-9]/gi, "_")}`;
    process.stdout.write(`[${i + 1}/${TEAMS.length}] ${t.name} ... `);
    try {
      const html = await fetchHtml(pageUrl, cacheKey, refresh);
      const shirtUrl = extractShirt(html);
      if (!shirtUrl) {
        console.log("sem foto de equipamento");
        continue;
      }
      const ext = shirtUrl.includes(".jpg") ? ".jpg" : ".png";
      const dest = path.join(outDir, `${t.slug}${ext}`);
      // downloadImage valida tipo e tamanho mínimo (1500B) — o do Leça é um
      // JPEG minúsculo mas real, por isso aceita-se aqui o que ele recusar
      const good = await downloadImage(shirtUrl, dest);
      if (!good) {
        const res = await fetch(shirtUrl, {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(30000),
        });
        const buf = Buffer.from(await res.arrayBuffer());
        if (!res.ok || buf.length < 500) {
          console.log("placeholder/sem imagem");
          continue;
        }
        fs.writeFileSync(dest, buf);
      }
      console.log(`${shirtUrl.split("/").pop()} ${fs.statSync(dest).size}B`);
      ok++;
    } catch (e: unknown) {
      console.log(`erro ${e instanceof Error ? e.message : e}`);
    }
    if (i < TEAMS.length - 1) await sleep(300 + jitter() / 4);
  }
  console.log(`\n${ok}/${TEAMS.length} equipamentos em ${outDir}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
