/**
 * fetchZerozeroLogos — descarrega os emblemas das 60 equipas do zerozero.pt
 * e guarda-os em client/public/logos/<slug>.png
 *
 * Fonte: meta property="og:image" da página da equipa (/equipa/<slug>[/id]?epoca_id=156)
 * Gera também server/db/fixtures/teamLogos.json (map nome -> /logos/<slug>.png)
 *
 * Uso: npx tsx server/scripts/fetchZerozeroLogos.ts [--refresh]
 * Salta ficheiros já descarregados; --refresh ignora o cache de HTML.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { TEAMS } from "./lib/teamsSource";
import {
  BASE,
  SEASON_DEFAULT as SEASON,
  THROTTLE_EQUIPA,
  jitter,
  fetchHtml,
  extractOgImage,
  downloadImage,
  sleep,
} from "./lib/zerozeroScrape";

async function main() {
  const refresh = process.argv.includes("--refresh");
  const outDir = path.join(__dirname, "..", "..", "client", "public", "logos");
  fs.mkdirSync(outDir, { recursive: true });
  const map: Record<string, string> = {};
  for (let i = 0; i < TEAMS.length; i++) {
    const t = TEAMS[i];
    const destPng = path.join(outDir, `${t.slug}.png`);
    const destSvg = path.join(outDir, `${t.slug}.svg`);
    if (!refresh && (fs.existsSync(destPng) || fs.existsSync(destSvg))) {
      const existing = fs.existsSync(destPng) ? destPng : destSvg;
      map[t.name] = `/logos/${path.basename(existing)}`;
      process.stdout.write(`[${i + 1}/${TEAMS.length}] ${t.name} ... já existe, salto\n`);
      continue;
    }
    const sep = t.url.includes("?") ? "&" : "?";
    const pageUrl = `${BASE}${t.url}${sep}epoca_id=${SEASON}`;
    const cacheKey = `team_${t.url.replace(/[^a-z0-9]/gi, "_")}`;
    process.stdout.write(`[${i + 1}/${TEAMS.length}] ${t.name} ... `);
    try {
      const html = await fetchHtml(pageUrl, cacheKey, refresh);
      const logoUrl = extractOgImage(html);
      if (!logoUrl || !logoUrl.includes("/img/logos/equipas/")) { console.log("sem og:image de equipa"); continue; }
      // destino por content-type real (downloadImage valida placeholder, tipo e tamanho)
      const tmp = path.join(outDir, `.${t.slug}.tmp`);
      const okPng = await downloadImage(logoUrl, logoUrl.includes(".svg") ? path.join(outDir, `${t.slug}.svg`) : tmp);
      if (!okPng) { console.log("placeholder/sem imagem"); try { fs.unlinkSync(tmp); } catch {} continue; }
      let dest = destPng;
      if (logoUrl.includes(".svg")) {
        dest = path.join(outDir, `${t.slug}.svg`);
      } else {
        // downloadImage já validou; move tmp para o destino final
        fs.renameSync(tmp, destPng);
      }
      const buf = fs.readFileSync(dest);
      const hash = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 8);
      map[t.name] = `/logos/${path.basename(dest)}`;
      console.log(`${path.extname(dest).slice(1)} ${buf.length}B hash ${hash}`);
    } catch (e: any) {
      console.log(`erro ${e?.message || e}`);
    }
    if (i < TEAMS.length - 1) await sleep(THROTTLE_EQUIPA + jitter());
  }
  const jsonPath = path.join(__dirname, "..", "db", "fixtures", "teamLogos.json");
  fs.writeFileSync(jsonPath, JSON.stringify({ generatedAt: new Date().toISOString(), map }, null, 2));
  console.log(`\nGuardado ${Object.keys(map).length} logos em ${outDir}`);
  console.log(`Mapa: ${jsonPath}`);
}
main().catch(e=>{ console.error(e); process.exit(1); });
