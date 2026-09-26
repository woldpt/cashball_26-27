/**
 * fetchZerozeroSquads — extrai os plantéis 2026/27 do zerozero.pt para as 60
 * equipas das fixtures e guarda-os em candidates_2026_27.json.
 *
 * Fonte: página principal de cada equipa (`/equipa/<slug>[/<id>]?epoca_id=156`),
 * secção `#team_squad`, que lista o plantel agrupado por posição com idade e
 * valor de mercado.
 *
 * Uso: npx tsx server/scripts/fetchZerozeroSquads.ts [--out path] [--refresh]
 *
 * NOTA: scraping para uso próprio; respeitar um atraso polido entre pedidos.
 */
import { TEAMS } from "./lib/teamsSource";
import {
  BASE,
  SEASON_DEFAULT as SEASON,
  THROTTLE_EQUIPA,
  jitter,
  fetchHtml,
  extractPlayers,
  extractCoach,
} from "./lib/zerozeroScrape";

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

async function fetchTeam(
  team: { name: string; division: number; url: string },
  refresh: boolean,
): Promise<TeamCandidate> {
  if (!team.url) {
    return { name: team.name, division: team.division, zerozeroUrl: team.url, coach: null, players: [], coverage: "low" };
  }
  const sep = team.url.includes("?") ? "&" : "?";
  const url = `${BASE}${team.url}${sep}epoca_id=${SEASON}`;
  const cacheKey = `team_${team.url.replace(/[^a-z0-9]/gi, "_")}`;
  let html: string;
  try {
    html = await fetchHtml(url, cacheKey, refresh);
  } catch {
    return { name: team.name, division: team.division, zerozeroUrl: team.url, coach: null, players: [], coverage: "error" };
  }
  const players: ZerozeroPlayer[] = extractPlayers(html)
    .filter((pl) => pl.position)
    .map((pl) => ({ name: pl.name, position: pl.position!, flag: pl.flag, age: pl.age, value: pl.value }));
  const coach = extractCoach(html)?.name ?? null;
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
  const refresh = process.argv.includes("--refresh");

  const results: TeamCandidate[] = [];
  for (let i = 0; i < TEAMS.length; i++) {
    const t = TEAMS[i];
    process.stdout.write(`[${i + 1}/${TEAMS.length}] ${t.name} ... `);
    try {
      const r = await fetchTeam(t, refresh);
      results.push(r);
      process.stdout.write(
        `${r.coverage} (${r.players.length} jogadores, treinador: ${r.coach || "-"})\n`,
      );
    } catch (err: any) {
      results.push({ name: t.name, division: t.division, zerozeroUrl: t.url, coach: null, players: [], coverage: "error" });
      process.stdout.write(`error (${err?.message || err})\n`);
    }
    if (i < TEAMS.length - 1) await new Promise((r) => setTimeout(r, THROTTLE_EQUIPA + jitter()));
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
