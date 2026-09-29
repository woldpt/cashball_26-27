/**
 * generateKits — gera client/public/kits/<slug>.svg a partir de db/fixtures/kits.json.
 *
 * Molde único de camisola + 7 padrões paramétricos (solid, stripes, hoops,
 * halves, sash, band, shoulders). As cores/padrões foram classificados a olho
 * a partir das fotos de equipamento do zerozero.pt (ver fetchZerozeroKits.ts).
 *
 * Uso: cd server && npx tsx scripts/generateKits.ts
 */
import fs from "fs";
import path from "path";
import { TEAMS } from "./lib/teamsSource";

interface Kit {
  base: string;
  secondary: string;
  pattern: "solid" | "stripes" | "hoops" | "halves" | "sash" | "band" | "shoulders";
  source?: string;
}

const SHIRT =
  "M42,10 L28,15 L12,30 L22,35 L28,26 L28,88 L72,88 L72,26 L78,35 L88,30 L72,15 L58,10 C55,15 45,15 42,10 Z";
const COLLAR = "M42,10 C45,15 55,15 58,10 L58,13.5 C55,18.5 45,18.5 42,13.5 Z";

function patternRects(k: Kit): string {
  const { base, secondary: s } = k;
  switch (k.pattern) {
    case "stripes": {
      // 5 listas verticais, base nas pontas (simétrico)
      let r = "";
      const xs = [8, 25, 42, 59, 76];
      xs.forEach((x, i) => {
        r += `<rect x="${x}" y="0" width="17" height="100" fill="${i % 2 ? s : base}"/>`;
      });
      return r;
    }
    case "hoops": {
      // 5 arcos horizontais, base em cima e em baixo (simétrico)
      let r = "";
      for (let i = 0; i < 5; i++) {
        r += `<rect x="0" y="${(10 + i * 15.6).toFixed(1)}" width="100" height="15.6" fill="${i % 2 ? s : base}"/>`;
      }
      return r;
    }
    case "halves":
      return `<rect x="0" y="0" width="50" height="100" fill="${base}"/><rect x="50" y="0" width="50" height="100" fill="${s}"/>`;
    case "sash":
      return `<rect x="0" y="0" width="100" height="100" fill="${base}"/><rect x="-20" y="32" width="140" height="17" fill="${s}" transform="rotate(-25 50 50)"/>`;
    case "band":
      return `<rect x="0" y="0" width="100" height="100" fill="${base}"/><rect x="0" y="38" width="100" height="18" fill="${s}"/>`;
    case "shoulders":
      return `<rect x="0" y="0" width="100" height="100" fill="${base}"/><rect x="0" y="0" width="100" height="28" fill="${s}"/>`;
    default:
      return `<rect x="0" y="0" width="100" height="100" fill="${base}"/>`;
  }
}

function shirtSvg(name: string, k: Kit): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="Camisola do ${name}">
<defs><clipPath id="k"><path d="${SHIRT}"/></clipPath></defs>
<g clip-path="url(#k)">${patternRects(k)}</g>
<path d="${COLLAR}" fill="${k.secondary}"/>
<path d="M12,30 L22,35" stroke="${k.secondary}" stroke-width="3.5"/>
<path d="M88,30 L78,35" stroke="${k.secondary}" stroke-width="3.5"/>
<path d="${SHIRT}" fill="none" stroke="#ffffff59" stroke-width="4" stroke-linejoin="round"/>
<path d="${SHIRT}" fill="none" stroke="#00000059" stroke-width="1.5" stroke-linejoin="round"/>
</svg>
`;
}

function main() {
  const kitsPath = path.join(__dirname, "..", "db", "fixtures", "kits.json");
  const { kits } = JSON.parse(fs.readFileSync(kitsPath, "utf-8")) as { kits: Record<string, Kit> };
  const outDir = path.join(__dirname, "..", "..", "client", "public", "kits");
  fs.mkdirSync(outDir, { recursive: true });
  const missing = TEAMS.filter((t) => !kits[t.slug]).map((t) => t.slug);
  if (missing.length) {
    console.error(`Em falta no kits.json: ${missing.join(", ")}`);
    process.exit(1);
  }
  for (const t of TEAMS) {
    const svg = shirtSvg(t.name, kits[t.slug]);
    fs.writeFileSync(path.join(outDir, `${t.slug}.svg`), svg);
  }
  console.log(`Gerados ${TEAMS.length} SVGs em ${outDir}`);
}
main();
