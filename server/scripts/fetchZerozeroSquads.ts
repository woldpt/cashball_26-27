/**
 * fetchZerozeroSquads — extrai os plantéis 2026/27 do zerozero.pt para as 40
 * equipas das fixtures e guarda-os em candidates_2026_27.json.
 *
 * Fonte: página principal de cada equipa (`/equipa/<slug>[/<id>]?epoca_id=156`),
 * secção `#team_squad`, que lista o plantel agrupado por posição com idade e
 * valor de mercado.
 *
 * Uso: npx tsx server/scripts/fetchZerozeroSquads.ts [--out path]
 *
 * NOTA: scraping para uso próprio; respeitar um atraso polido entre pedidos.
 */

const SEASON = "156"; // zerozero epoca_id da época 2026/27
const BASE = "https://www.zerozero.pt";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0 Safari/537.36";

interface ZerozeroPlayer {
  name: string;
  position: "GR" | "DEF" | "MED" | "ATA";
  flag: string | null; // código ISO (ex.: PT)
  age: number | null;
  value: number | null; // valor de mercado em € (0 = sem valor)
}

interface TeamCandidate {
  name: string;
  division: number;
  zerozeroUrl: string;
  coach: string | null; // treinador principal da época 2026/27
  players: ZerozeroPlayer[];
  coverage: "complete" | "low" | "error";
}

const TEAMS: Array<{ name: string; division: number; url: string }> = [
  { name: "Sporting", division: 1, url: "/equipa/sporting" },
  { name: "Porto", division: 1, url: "/equipa/fc-porto" },
  { name: "Benfica", division: 1, url: "/equipa/benfica" },
  { name: "Sp. Braga", division: 1, url: "/equipa/sc-braga" },
  { name: "Famalicão", division: 1, url: "/equipa/fc-famalicao/2175" },
  { name: "Gil Vicente", division: 1, url: "/equipa/gil-vicente" },
  { name: "Estoril", division: 1, url: "/equipa/estoril-praia/1734" },
  { name: "Moreirense", division: 1, url: "/equipa/moreirense/6" },
  { name: "Marítimo", division: 2, url: "/equipa/maritimo" },
  { name: "Ac.Viseu", division: 2, url: "/equipa/academico/2181" },
  { name: "Torreense", division: 2, url: "/equipa/torreense/2178" },
  { name: "U. Leiria", division: 2, url: "/equipa/ud-leiria/17" },
  { name: "Vizela", division: 2, url: "/equipa/fc-vizela/2197" },
  { name: "Lus. Lourosa", division: 2, url: "/equipa/lusitania-de-lourosa/3599" },
  { name: "Feirense", division: 2, url: "/equipa/feirense/1728" },
  { name: "Chaves", division: 2, url: "/equipa/gd-chaves/20" },
  { name: "Amarante", division: 3, url: "/equipa/amarante-fc/4330" },
  { name: "Belenenses", division: 3, url: "/equipa/belenenses/3" },
  { name: "Académica", division: 3, url: "/equipa/academica-oaf/19" },
  { name: "Varzim", division: 3, url: "/equipa/varzim/36" },
  { name: "Mafra", division: 3, url: "/equipa/cd-mafra/3696" },
  { name: "U. Santarém", division: 3, url: "/equipa/u-santarem/3947" },
  { name: "Trofense", division: 3, url: "/equipa/trofense/3664" },
  { name: "Atlético", division: 3, url: "/equipa/atletico-cp/2170" },
  { name: "Bragança", division: 4, url: "/equipa/braganca/3565" },
  { name: "Vianense", division: 4, url: "/equipa/vianense/3672" },
  { name: "Rebordosa", division: 4, url: "/equipa/rebordosa-ac/3634" },
  { name: "Leça", division: 4, url: "/equipa/leca-fc/24" },
  { name: "Vit. Sernache", division: 4, url: "/equipa/vitoria-sernache/5659" },
  { name: "Louletano", division: 4, url: "/equipa/louletano/3596" },
  { name: "Juventude", division: 4, url: "/equipa/juventude-sc/3594" },
  { name: "Portel", division: 5, url: "/equipa/gd-portel/6803" },
  { name: "U. Montemor", division: 5, url: "/equipa/grupo-uniao-sport/3712" },
  { name: "Monte do Trigo", division: 5, url: "/equipa/monte-trigo/3613" },
  { name: "Vendas Novas", division: 5, url: "/equipa/estrela-fc/3581" },
  { name: "At. Reguengos", division: 5, url: "/equipa/at-reguengos/6808?search=1" },
  { name: "Sp. Viana", division: 5, url: "/equipa/sp-viana/10574" },
  { name: "Arcoense", division: 5, url: "/equipa/arcoense/6809" },
  { name: "Redondense", division: 5, url: "/equipa/redondense/6807" },
  // D1 novas (4)
  { name: "Arouca", division: 1, url: "/equipa/fc-arouca/3555?search=1" },
  { name: "Vitória SC", division: 1, url: "/equipa/vitoria-sc" },
  { name: "Alverca", division: 1, url: "/equipa/fc-alverca/1?search=1" },
  { name: "Rio Ave", division: 1, url: "/equipa/rio-ave/31?search=1" },
  // D2 novas (4)
  { name: "Leixões", division: 2, url: "/equipa/leixoes/1727?search=1" },
  { name: "Felgueiras", division: 2, url: "/equipa/fc-felgueiras/11129?search=1" },
  { name: "Penafiel", division: 2, url: "/equipa/fc-penafiel/30?search=1" },
  { name: "Portimonense", division: 2, url: "/equipa/portimonense/13" },
  // D3 novas (4)
  { name: "Vit. Setúbal", division: 3, url: "/equipa/vitoria-fc/35?search=1" },
  { name: "São João Ver", division: 3, url: "/equipa/s-joao-ver/3642?search=1" },
  { name: "Fafe", division: 3, url: "/equipa/ad-fafe/3570" },
  { name: "Lusitano Évora", division: 3, url: "/equipa/lusitano-gc/2173?search=1" },
  // D4 novas (5)
  { name: "Oliv. Hospital", division: 4, url: "/equipa/fc-oliv-hospital/3618?search=1" },
  { name: "Malveira", division: 4, url: "/equipa/at-malveira/3558?search=1" },
  { name: "Alcochetense", division: 4, url: "/equipa/alcochetense/3548?search=1" },
  { name: "O Elvas", division: 4, url: "/equipa/o-elvas/2180?search=1" },
  { name: "Sintrense", division: 4, url: "/equipa/sintrense/3590" },
  // D5 distritais novas (4) — sem zerozero fiável, marcar coverage low
  { name: "Cabrela", division: 5, url: "/equipa/gd-cabrela/11054?search=1" },
  { name: "Escouralense", division: 5, url: "/equipa/escouralense/6806?search=1" },
  { name: "Aljustrelense", division: 5, url: "/equipa/aljustrelense/4327?search=1" },
  { name: "Castrense", division: 5, url: "/equipa/fc-castrense/5657?search=1" },
];

const POS_MAP: Record<string, "GR" | "DEF" | "MED" | "ATA"> = {
  "Guarda Redes": "GR",
  Defesa: "DEF",
  Médio: "MED",
  Avançado: "ATA",
};

/** "6.50 M €" / "850 mil €" / "-" -> euros (int). Aceita a entidade &euro;. */
function parseValue(text: string): number | null {
  const m = text.match(/([\d.,]+)\s*(M|mil)?\s*(?:€|&euro;)/);
  if (!m) return null;
  // PT usa vírgula ou ponto como separador decimal (ex.: "6.50 M")
  const num = parseFloat(m[1].replace(",", "."));
  if (!isFinite(num)) return null;
  return m[2] === "M" ? Math.round(num * 1_000_000) : Math.round(num * 1000);
}

/** "32 anos" -> 32 */
function parseAge(text: string): number | null {
  const m = text.match(/(\d+)\s*anos/);
  return m ? parseInt(m[1], 10) : null;
}

function extractPlayers(html: string): ZerozeroPlayer[] {
  const start = html.indexOf('<div id="team_squad"');
  if (start === -1) return [];
  const body = html.slice(start);

  // Percorre o corpo recolhendo eventos: secções (posição) e staff (jogador).
  const events: Array<{ index: number; isSection: boolean; value: string | null }> = [];
  const re = /<div class="section">([^<]+)<\/div>|<div class="staff">/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    events.push({ index: m.index, isSection: !!m[1], value: m[1] || null });
  }

  const players: ZerozeroPlayer[] = [];
  let currentPos: "GR" | "DEF" | "MED" | "ATA" | null = null;
  const STAFF_TAG = '<div class="staff">';

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.isSection) {
      const mapped = POS_MAP[e.value!];
      if (mapped) currentPos = mapped;
      continue;
    }
    if (!currentPos) continue;
    const bodyStart = e.index + STAFF_TAG.length;
    const bodyEnd = i + 1 < events.length ? events[i + 1].index : body.length;
    const s = body.slice(bodyStart, bodyEnd);
    const nameM = s.match(/\/jogador\/[a-z0-9-]+\/[0-9]+[^"]*"[^>]*>([^<]+)<\/a>/);
    if (!nameM) continue;
    const flagM = s.match(/class="flag:([A-Z]{2})"/);
    const infoM = s.match(/<span>(\d+ anos[^<]*)<\/span>/);
    const info = infoM ? infoM[1] : "";
    players.push({
      name: nameM[1].trim(),
      position: currentPos,
      flag: flagM ? flagM[1] : null,
      age: parseAge(info),
      value: parseValue(info),
    });
  }
  return players;
}

/**
 * Extrai o treinador principal da secção `#team_staff` ("Treinador").
 * Pode não existir (clubes amadores sem dados) — nesse caso devolve null.
 */
function extractCoach(html: string): string | null {
  const start = html.indexOf('<div id="team_staff"');
  if (start === -1) return null;
  const body = html.slice(start);
  const secIdx = body.indexOf('<div class="section">Treinador</div>');
  if (secIdx === -1) return null;
  const staffIdx = body.indexOf('<div class="staff">', secIdx);
  if (staffIdx === -1) return null;
  const seg = body.slice(staffIdx, staffIdx + 2000);
  const m = seg.match(/\/treinador\/[a-z0-9-]+\/[0-9]+[^"]*"[^>]*>([^<]+)<\/a>/);
  return m ? m[1].trim() : null;
}

async function fetchTeam(
  team: { name: string; division: number; url: string },
): Promise<TeamCandidate> {
  if (!team.url) {
    return { name: team.name, division: team.division, zerozeroUrl: team.url, coach: null, players: [], coverage: "low" };
  }
  const sep = team.url.includes("?") ? "&" : "?";
  const url = `${BASE}${team.url}${sep}epoca_id=${SEASON}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "pt-PT,pt;q=0.9" },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    return { name: team.name, division: team.division, zerozeroUrl: team.url, coach: null, players: [], coverage: "error" };
  }
  const html = await res.text();
  const players = extractPlayers(html);
  const coach = extractCoach(html);
  const coverage: TeamCandidate["coverage"] =
    players.length >= 16 ? "complete" : players.length > 0 ? "low" : "error";
  return { name: team.name, division: team.division, zerozeroUrl: team.url, coach, players, coverage };
}

async function main() {
  const outArg = process.argv.indexOf("--out");
  const outPath =
    outArg !== -1 && process.argv[outArg + 1]
      ? process.argv[outArg + 1]
      : require("path").join(__dirname, "..", "db", "fixtures", "candidates_2026_27.json");

  const results: TeamCandidate[] = [];
  for (let i = 0; i < TEAMS.length; i++) {
    const t = TEAMS[i];
    process.stdout.write(`[${i + 1}/${TEAMS.length}] ${t.name} ... `);
    try {
      const r = await fetchTeam(t);
      results.push(r);
      process.stdout.write(
        `${r.coverage} (${r.players.length} jogadores, treinador: ${r.coach || "-"})\n`,
      );
    } catch (err: any) {
      results.push({ name: t.name, division: t.division, zerozeroUrl: t.url, coach: null, players: [], coverage: "error" });
      process.stdout.write(`error (${err?.message || err})\n`);
    }
    if (i < TEAMS.length - 1) await new Promise((r) => setTimeout(r, 1200));
  }

  require("fs").writeFileSync(
    outPath,
    JSON.stringify({ season: "2026/27", generatedAt: new Date().toISOString(), teams: results }, null, 2),
  );

  const counts = { complete: 0, low: 0, error: 0 };
  for (const r of results) counts[r.coverage]++;
  console.log(`\nFicheiro: ${outPath}`);
  console.log(
    `Cobertura: complete=${counts.complete} low=${counts.low} error=${counts.error}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
