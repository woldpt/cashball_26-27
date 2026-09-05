/**
 * fetchZerozeroLogos — descarrega os emblemas das 60 equipas do zerozero.pt
 * e guarda-os em client/public/logos/<slug>.png
 *
 * Fonte: meta property="og:image" da página da equipa (/equipa/<slug>[/id]?epoca_id=156)
 * Gera também server/db/fixtures/teamLogos.json (map nome -> /logos/<slug>.png)
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";

const SEASON = "156";
const BASE = "https://www.zerozero.pt";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const TEAMS: Array<{ name: string; url: string; slug: string }> = [
  { name: "Sporting", url: "/equipa/sporting", slug: "sporting" },
  { name: "Porto", url: "/equipa/fc-porto", slug: "porto" },
  { name: "Benfica", url: "/equipa/benfica", slug: "benfica" },
  { name: "Sp. Braga", url: "/equipa/sc-braga", slug: "sp-braga" },
  { name: "Famalicão", url: "/equipa/fc-famalicao/2175", slug: "famalicao" },
  { name: "Gil Vicente", url: "/equipa/gil-vicente", slug: "gil-vicente" },
  { name: "Estoril", url: "/equipa/estoril-praia/1734", slug: "estoril" },
  { name: "Moreirense", url: "/equipa/moreirense/6", slug: "moreirense" },
  { name: "Marítimo", url: "/equipa/maritimo", slug: "maritimo" },
  { name: "Ac.Viseu", url: "/equipa/academico/2181", slug: "ac-viseu" },
  { name: "Torreense", url: "/equipa/torreense/2178", slug: "torreense" },
  { name: "U. Leiria", url: "/equipa/ud-leiria/17", slug: "u-leiria" },
  { name: "Vizela", url: "/equipa/fc-vizela/2197", slug: "vizela" },
  { name: "Lus. Lourosa", url: "/equipa/lusitania-de-lourosa/3599", slug: "lus-lourosa" },
  { name: "Feirense", url: "/equipa/feirense/1728", slug: "feirense" },
  { name: "Chaves", url: "/equipa/gd-chaves/20", slug: "chaves" },
  { name: "Amarante", url: "/equipa/amarante-fc/4330", slug: "amarante" },
  { name: "Belenenses", url: "/equipa/belenenses/3", slug: "belenenses" },
  { name: "Académica", url: "/equipa/academica-oaf/19", slug: "academica" },
  { name: "Varzim", url: "/equipa/varzim/36", slug: "varzim" },
  { name: "Mafra", url: "/equipa/cd-mafra/3696", slug: "mafra" },
  { name: "U. Santarém", url: "/equipa/u-santarem/3947", slug: "u-santarem" },
  { name: "Trofense", url: "/equipa/trofense/3664", slug: "trofense" },
  { name: "Atlético", url: "/equipa/atletico-cp/2170", slug: "atletico" },
  { name: "Bragança", url: "/equipa/braganca/3565", slug: "braganca" },
  { name: "Vianense", url: "/equipa/vianense/3672", slug: "vianense" },
  { name: "Rebordosa", url: "/equipa/rebordosa-ac/3634", slug: "rebordosa" },
  { name: "Leça", url: "/equipa/leca-fc/24", slug: "leca" },
  { name: "Vit. Sernache", url: "/equipa/vitoria-sernache/5659", slug: "vit-sernache" },
  { name: "Louletano", url: "/equipa/louletano/3596", slug: "louletano" },
  { name: "Juventude", url: "/equipa/juventude-sc/3594", slug: "juventude" },
  { name: "Portel", url: "/equipa/gd-portel/6803", slug: "portel" },
  { name: "U. Montemor", url: "/equipa/grupo-uniao-sport/3712", slug: "u-montemor" },
  { name: "Monte do Trigo", url: "/equipa/monte-trigo/3613", slug: "monte-do-trigo" },
  { name: "Vendas Novas", url: "/equipa/estrela-fc/3581", slug: "vendas-novas" },
  { name: "At. Reguengos", url: "/equipa/at-reguengos/6808?search=1", slug: "at-reguengos" },
  { name: "Sp. Viana", url: "/equipa/sp-viana/10574", slug: "sp-viana" },
  { name: "Arcoense", url: "/equipa/arcoense/6809", slug: "arcoense" },
  { name: "Redondense", url: "/equipa/redondense/6807", slug: "redondense" },
  { name: "Arouca", url: "/equipa/fc-arouca/3555?search=1", slug: "arouca" },
  { name: "Vitória SC", url: "/equipa/vitoria-sc", slug: "vitoria-sc" },
  { name: "Alverca", url: "/equipa/fc-alverca/1?search=1", slug: "alverca" },
  { name: "Rio Ave", url: "/equipa/rio-ave/31?search=1", slug: "rio-ave" },
  { name: "Leixões", url: "/equipa/leixoes/15", slug: "leixoes" },
  { name: "Felgueiras", url: "/equipa/felgueiras-1932/3682", slug: "felgueiras" },
  { name: "Penafiel", url: "/equipa/penafiel/14", slug: "penafiel" },
  { name: "Portimonense", url: "/equipa/portimonense/13", slug: "portimonense" },
  { name: "Vit. Setúbal", url: "/equipa/vitoria-fc/35?search=1", slug: "vit-setubal" },
  { name: "São João Ver", url: "/equipa/s-joao-ver/3642?search=1", slug: "sao-joao-ver" },
  { name: "Fafe", url: "/equipa/ad-fafe/3570", slug: "fafe" },
  { name: "Lusitano Évora", url: "/equipa/lusitano-evora/4270", slug: "lusitano-evora" },
  { name: "Oliv. Hospital", url: "/equipa/oliveira-hospital/3598", slug: "oliv-hospital" },
  { name: "Malveira", url: "/equipa/at-malveira/3558?search=1", slug: "malveira" },
  { name: "Alcochetense", url: "/equipa/alcochetense/3592", slug: "alcochetense" },
  { name: "O Elvas", url: "/equipa/o-elvas/3604", slug: "o-elvas" },
  { name: "Sintrense", url: "/equipa/sintrense/3590", slug: "sintrense" },
  { name: "Cabrela", url: "/equipa/gd-cabrela/11054?search=1", slug: "cabrela" },
  { name: "Escouralense", url: "/equipa/escouralense/6806?search=1", slug: "escouralense" },
  { name: "Aljustrelense", url: "/equipa/aljustrelense/4327?search=1", slug: "aljustrelense" },
  { name: "Castrense", url: "/equipa/fc-castrense/5657?search=1", slug: "castrense" },
];

function extractLogo(html: string): string | null {
  const m = html.match(/property="og:image"\s+content="([^"]+)"/);
  if (!m) return null;
  let url = m[1].replace("https://www.zerozero.pt//", "https://www.zerozero.pt/");
  // zerozero por vezes usa //sem host
  if (url.startsWith("//")) url = "https:" + url;
  return url;
}

async function main() {
  const outDir = path.join(__dirname, "..", "..", "client", "public", "logos");
  fs.mkdirSync(outDir, { recursive: true });
  const map: Record<string, string> = {};
  for (let i = 0; i < TEAMS.length; i++) {
    const t = TEAMS[i];
    const sep = t.url.includes("?") ? "&" : "?";
    const pageUrl = `${BASE}${t.url}${sep}epoca_id=${SEASON}`;
    process.stdout.write(`[${i + 1}/${TEAMS.length}] ${t.name} ... `);
    try {
      const res = await fetch(pageUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) });
      if (!res.ok) { console.log(`http ${res.status}`); continue; }
      const html = await res.text();
      const logoUrl = extractLogo(html);
      if (!logoUrl) { console.log("sem og:image"); continue; }
      // download
      const imgRes = await fetch(logoUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) });
      if (!imgRes.ok) { console.log(`img http ${imgRes.status}`); continue; }
      const buf = Buffer.from(await imgRes.arrayBuffer());
      // detect ext
      const ct = imgRes.headers.get("content-type") || "";
      const ext = ct.includes("svg") ? "svg" : "png";
      // simple placeholder detection: if content length < 5k or contains generic silhouette, mark but still save
      const hash = crypto.createHash("sha256").update(buf).digest("hex").slice(0,8);
      const dest = path.join(outDir, `${t.slug}.${ext}`);
      fs.writeFileSync(dest, buf);
      map[t.name] = `/logos/${t.slug}.${ext}`;
      console.log(`${ext} ${buf.length}B hash ${hash}`);
    } catch (e: any) {
      console.log(`erro ${e?.message || e}`);
    }
    if (i < TEAMS.length - 1) await new Promise(r=>setTimeout(r, 900));
  }
  const jsonPath = path.join(__dirname, "..", "db", "fixtures", "teamLogos.json");
  fs.writeFileSync(jsonPath, JSON.stringify({ generatedAt: new Date().toISOString(), map }, null, 2));
  console.log(`\nGuardado ${Object.keys(map).length} logos em ${outDir}`);
  console.log(`Mapa: ${jsonPath}`);
}
main().catch(e=>{ console.error(e); process.exit(1); });
