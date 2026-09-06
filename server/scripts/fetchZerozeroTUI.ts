/**
 * TUI para apanhar dados do zerozero — corre com: `npm run fetch:tui`
 *
 * Modo interativo: escolhe equipas (por divisão ou URL nova) e que info
 * recolher (plantel, cores, emblema, fotos jogadores/treinador).
 *
 * Modo CLI (sem prompts):
 *   npm run fetch:tui -- --equipas="Marítimo,Porto" --info=fotoJogadores --dry-run
 *   --equipas=<nomes>  equipas por nome (ex: "Marítimo")
 *   --info=<keys>      plantel|cores|emblema|fotoJogadores|fotoTreinador
 *   --dry-run          só mostrar o que faria
 *   --refresh          ignora o cache de HTML (bate novamente no zerozero)
 *
 * Cache: .cache/zerozero (HTML) · retoma: tui_state.json + ficheiros já em
 * client/public/{logos,players,coaches} são saltados automaticamente.
 */
import * as p from "@clack/prompts";
import fs from "fs";
import path from "path";
import { loadTeams, saveTeams, parseZerozeroUrl, teamLabel } from "./lib/teamRegistry";
import {
  BASE,
  SEASON_DEFAULT,
  fetchHtml,
  cachedHtml,
  extractPlayers,
  extractCoach,
  extractOgImage,
  extractHeaderColor,
  downloadImage,
  sleep,
  isoToEmoji,
  normName,
  type Pos,
} from "./lib/zerozeroScrape";

const PUBLIC = path.join(process.cwd(), "..", "client", "public");
const STATE_PATH = path.join(process.cwd(), ".cache", "zerozero", "tui_state.json");
const SQUAD_MIN: Record<Pos, number> = { GR: 3, DEF: 6, MED: 6, ATA: 5 };
const SQUAD_TOTAL = 22;
const THROTTLE_EQUIPA = 2800; // anti-ban — não baixar sem necessidade
const THROTTLE_JOGADOR = 1600;
const jitter = () => 400 + Math.floor(Math.random() * 900); // 400-1300ms extra

const ALL_INFO = ["plantel", "cores", "emblema", "fotoJogadores", "fotoTreinador"] as const;
type InfoKey = (typeof ALL_INFO)[number];

interface CliOpts {
  equipas: string[] | null;
  info: InfoKey[] | null;
  dryRun: boolean;
  refresh: boolean;
}

function parseArgs(argv: string[]): CliOpts {
  const opts: CliOpts = { equipas: null, info: null, dryRun: false, refresh: false };
  for (const a of argv) {
    if (a === "--help" || a === "-h") {
      console.log(USAGE);
      process.exit(0);
    }
    if (a.startsWith("--equipas=")) opts.equipas = a.slice(10).split(",").map((s) => s.trim()).filter(Boolean);
    else if (a.startsWith("--info=")) {
      const raw = a.slice(7).split(",").map((s) => s.trim()).filter(Boolean);
      const keys: InfoKey[] = [];
      const bad: string[] = [];
      for (const r of raw) {
        const hit = ALL_INFO.find((k) => k.toLowerCase() === r.toLowerCase());
        if (hit) keys.push(hit);
        else bad.push(r);
      }
      if (bad.length) throw new Error(`--info inválido: ${bad.join(", ")} (válido: ${ALL_INFO.join("|")})`);
      opts.info = keys;
    } else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--refresh") opts.refresh = true;
  }
  return opts;
}

const USAGE = `Uso: npm run fetch:tui [-- --equipas="A,B" --info=a,b --dry-run --refresh]
  --equipas=<nomes>  equipas por nome, ex: "Marítimo,Porto" (salta a TUI)
  --info=<keys>       ${ALL_INFO.join("|")}
  --dry-run           só mostrar o que faria, sem gravar
  --refresh           ignora o cache de HTML em .cache/zerozero
Sem flags abre a TUI interativa.`;

function loadState(): { lastTeam?: string; ok: number; errors: string[]; at: string; dryRun?: boolean } | null {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf-8"));
  } catch {
    return null;
  }
}

function saveState(s: unknown) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
}

/** Mapa de URLs por equipa, lido de fetchZerozeroSquads.ts (TEAMS) + fixtures. */
function buildTeamUrlMap(teams: ReturnType<typeof loadTeams>["teams"]): Map<string, string> {
  const map = new Map<string, string>();
  for (const t of teams) {
    const tAny = t as unknown as Record<string, unknown>;
    if (typeof tAny.zerozeroUrl === "string") map.set(normName(t.name), tAny.zerozeroUrl);
  }
  try {
    const txt = fs.readFileSync(path.join(process.cwd(), "scripts", "fetchZerozeroSquads.ts"), "utf-8");
    const re = /\{\s*name:\s*"([^"]+)"[\s\S]*?url:\s*"([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(txt))) {
      if (!map.has(normName(m[1]))) map.set(normName(m[1]), m[2]);
    }
  } catch {}
  return map;
}

function resolveTeamUrl(team: ReturnType<typeof loadTeams>["teams"][number], urlMap: Map<string, string>): string {
  const tAny = team as unknown as Record<string, unknown>;
  if (typeof tAny.zerozeroUrl === "string") return tAny.zerozeroUrl;
  const fromScript = urlMap.get(normName(team.name));
  if (fromScript) return fromScript;
  return `/equipa/${team.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function countsOf(players: Array<{ position: string }>) {
  const c: Record<Pos, number> = { GR: 0, DEF: 0, MED: 0, ATA: 0 };
  for (const pl of players) if (pl.position in c) (c as Record<string, number>)[pl.position]++;
  return c;
}

/** A1: merge do plantel — actualiza posições/idade/flag/zerozeroId dos jogadores
 *  existentes e só acrescenta candidatos quando faltam mínimos ou 22 jogadores.
 *  Nunca substitui um plantel curado por `slice(0, 22)`. */
function mergePlantel(team: ReturnType<typeof loadTeams>["teams"][number], html: string): string[] {
  const scraped = extractPlayers(html);
  if (!scraped.length) return ["plantel: 0 jogadores na página (URL errada?)"];
  const byNorm = new Map(scraped.map((pl) => [normName(pl.name), pl]));
  const byId = new Map(scraped.map((pl) => [pl.id, pl]));

  // 1) actualiza os existentes por nome (ID como fallback)
  let updated = 0;
  for (const fp of team.players) {
    const hit = byNorm.get(normName(fp.name)) || (fp.zerozeroId ? byId.get(String(fp.zerozeroId)) : null);
    if (!hit) continue;
    fp.zerozeroId = Number(hit.id);
    if (hit.position && fp.position !== hit.position) fp.position = hit.position;
    if (hit.age != null && fp.age !== hit.age) fp.age = hit.age;
    if (hit.flag) {
      const emoji = isoToEmoji(hit.flag);
      if (emoji && fp.country !== emoji) fp.country = emoji;
    }
    updated++;
  }

  // 2) top-up só quando faltam mínimos ou total
  const c = countsOf(team.players);
  const isShort = () => team.players.length < SQUAD_TOTAL || (Object.keys(SQUAD_MIN) as Pos[]).some((pos) => c[pos] < SQUAD_MIN[pos]);
  if (isShort()) {
    const inSquad = new Set(team.players.map((pl) => normName(pl.name)));
    const candidates = [...scraped]
      .filter((pl) => pl.position && !inSquad.has(normName(pl.name)))
      .sort((a, b) => {
        // posições mais carentes primeiro; empate → mais novos
        const da = a.position ? SQUAD_MIN[a.position] - c[a.position] : 0;
        const db = b.position ? SQUAD_MIN[b.position] - c[b.position] : 0;
        if (db !== da) return db - da;
        return (a.age ?? 99) - (b.age ?? 99);
      });
    for (const pl of candidates) {
      if (!isShort()) break;
      if (!pl.position) continue;
      // quando o total já está cheio, só preenchemos posições em falta
      if (team.players.length >= SQUAD_TOTAL && c[pl.position] >= SQUAD_MIN[pl.position]) continue;
      team.players.push({
        name: pl.name,
        country: isoToEmoji(pl.flag) || "🇵🇹",
        position: pl.position,
        age: pl.age,
        zerozeroId: Number(pl.id),
        photo: null,
      });
      c[pl.position]++;
    }
  }

  const after = countsOf(team.players);
  return [`plantel: ${updated}/${scraped.length} actualizados → ${after.GR}/${after.DEF}/${after.MED}/${after.ATA} (total ${team.players.length})`];
}

async function main() {
  const argv = process.argv.slice(2);
  let cli: CliOpts;
  try {
    cli = parseArgs(argv);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }

  p.intro("CashBall · zerozero TUI");
  const prev = loadState();
  if (prev) p.log.info(`Última execução: ${prev.at} · ${prev.ok} OK · ${prev.errors.length} erro(s)${prev.lastTeam ? ` · última: ${prev.lastTeam}` : ""}`);

  const data = loadTeams();
  const teams = data.teams;
  const urlMap = buildTeamUrlMap(teams);

  // 1) Equipas
  let targetIndices: number[] = [];
  if (cli.equipas) {
    for (const name of cli.equipas) {
      const n = normName(name);
      const idxs = teams.map((t, i) => ({ t, i })).filter(({ t }) => normName(t.name) === n);
      if (idxs.length !== 1) throw new Error(`--equipas: "${name}" não corresponde exactamente a 1 equipa`);
      targetIndices.push(idxs[0].i);
    }
  } else {
    const teamOptions = teams.map((t, i) => ({ value: String(i), label: teamLabel(t, i) }));
    teamOptions.push({ value: "__new__", label: "＋ Adicionar equipa nova por URL zerozero" });

    const selected = (await p.multiselect({
      message: "Equipas a actualizar (espaço = seleccionar)",
      options: teamOptions,
      initialValues: [],
      required: false,
    })) as unknown as string[] | symbol;
    if (p.isCancel(selected)) return p.cancel("Cancelado.");
    targetIndices = (selected as string[]).filter((v) => v !== "__new__").map(Number);

    if ((selected as string[]).includes("__new__")) {
      const urlInput = (await p.text({
        message: "URL zerozero da nova equipa (ex: https://www.zerozero.pt/equipa/fc-alverca/1?search=1)",
        validate: (v) => (!v ? "Indica um URL" : !parseZerozeroUrl(v) ? "URL não parece ser /equipa/..." : undefined),
      })) as unknown as string | symbol;
      if (p.isCancel(urlInput)) return p.cancel("Cancelado.");
      const url = parseZerozeroUrl(urlInput as string)!;
      const div = (await p.select({
        message: "Divisão para a nova equipa",
        options: [
          { value: "1", label: "D1 — Primeira Liga" },
          { value: "2", label: "D2" },
          { value: "3", label: "D3" },
          { value: "4", label: "D4" },
          { value: "5", label: "D5 — Distrital" },
        ],
      })) as unknown as string | symbol;
      if (p.isCancel(div)) return p.cancel("Cancelado.");
      const slug = url.match(/\/equipa\/([a-z0-9-]+)\/?/i)?.[1] || "equipa";
      const placeholder: (typeof teams)[number] = {
        name: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 24),
        division: Number(div),
        skillRange: [20, 35] as [number, number],
        colors: { primary: "#1ba84a", secondary: "#ffffff" },
        stadium: { name: "Estádio Municipal", capacity: 2500 },
        manager: { name: "Treinador" },
        crest: null,
        players: [],
      };
      (placeholder as unknown as Record<string, unknown>).zerozeroUrl = url;
      teams.push(placeholder);
      targetIndices.push(teams.length - 1);
    }
  }

  if (targetIndices.length === 0) return p.cancel("Nada seleccionado.");

  // 2) Info a recolher
  let want: Set<InfoKey>;
  if (cli.info) want = new Set(cli.info);
  else {
    const infos = (await p.multiselect<InfoKey>({
      message: "Que informação queres recolher?",
      options: [
        { value: "plantel", label: "Plantel (posições/idade/flag + top-up a 22)" },
        { value: "cores", label: "Cor principal (#page_header_container)" },
        { value: "emblema", label: "Emblema (og:image equipa)" },
        { value: "fotoJogadores", label: "Fotos jogadores (og:image /jogador/...)" },
        { value: "fotoTreinador", label: "Foto treinador (/treinador/...)" },
      ],
      initialValues: [],
      required: true,
    })) as unknown as string[] | symbol;
    if (p.isCancel(infos)) return p.cancel("Cancelado.");
    want = new Set(infos as InfoKey[]);
  }

  // 3) Dry-run
  let dryRun = cli.dryRun;
  if (!cli.equipas && !cli.info) {
    const d = (await p.confirm({
      message: "Fazer dry-run (só mostrar o que faria, sem gravar)?",
      initialValue: false,
    })) as unknown as boolean | symbol;
    if (p.isCancel(d)) return p.cancel("Cancelado.");
    dryRun = d as boolean;
  }

  const names = targetIndices.map((i) => teams[i].name).join(", ");
  p.log.info(`Equipas: ${names}`);
  p.log.info(`Info: ${[...want].join(", ")} · dry-run: ${dryRun ? "SIM" : "não"}`);

  const s = p.spinner();
  s.start(`A processar ${targetIndices.length} equipa(s)…`);

  let ok = 0;
  const errors: string[] = [];

  const logWarn = (msg: string) => {
    s.stop();
    p.log.warn(msg);
    s.start(`A processar ${targetIndices.length} equipa(s)…`);
  };

  for (const idx of targetIndices) {
    const team = teams[idx];
    const urlPath = resolveTeamUrl(team, urlMap);
    // persiste a URL resolvida para runs futuros (A4)
    (team as unknown as Record<string, unknown>).zerozeroUrl = urlPath;
    const sep = urlPath.includes("?") ? "&" : "?";
    const teamUrl = `${BASE}${urlPath}${sep}epoca_id=${SEASON_DEFAULT}`;
    const teamCacheKey = `team_${urlPath.replace(/[^a-z0-9]/gi, "_")}`;

    s.message(`${team.name} — ${teamUrl}${cli.refresh ? " (refresh)" : ""}`);
    try {
      const html = await fetchHtml(teamUrl, teamCacheKey, cli.refresh);
      const teamNotes: string[] = [];

      if (want.has("plantel")) {
        teamNotes.push(...mergePlantel(team, html));
      }
      if (want.has("cores")) {
        const col = extractHeaderColor(html);
        if (col) {
          if (dryRun) teamNotes.push(`cores: ${team.colors.primary} → ${col}`);
          else {
            team.colors.primary = col;
            teamNotes.push(`cores: → ${col}`);
          }
        }
      }
      if (want.has("emblema")) {
        const og = extractOgImage(html);
        const crestPath = team.crest || `/logos/${team.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.png`;
        if (og && og.includes("/img/logos/equipas/")) {
          const dest = path.join(PUBLIC, crestPath);
          if (dryRun) {
            teamNotes.push(`emblema: ${og} → ${crestPath}`);
          } else if (await downloadImage(og, dest)) {
            team.crest = crestPath;
            teamNotes.push(`emblema: → ${crestPath}`);
          } else {
            teamNotes.push("emblema: download falhou (placeholder/sem imagem?)");
          }
        } else {
          teamNotes.push("emblema: sem og:image de equipa");
        }
      }
      if (want.has("fotoTreinador")) {
        const coach = extractCoach(html);
        if (coach) {
          if (dryRun) {
            teamNotes.push(`treinador: ${coach.name}`);
          } else {
            if (team.manager.name !== coach.name) team.manager.name = coach.name;
            const cid = coach.href.match(/\/([0-9]+)$/)?.[1];
            if (cid) {
              const coachHtml = await fetchHtml(`${BASE}${coach.href}`, `coach_${coach.href.replace(/\W/g, "_")}`, cli.refresh);
              const cog = extractOgImage(coachHtml);
              const ext = cog && cog.includes(".png") ? ".png" : ".jpg";
              const mAny = team.manager as Record<string, unknown>;
              const photoPath = typeof mAny.photo === "string" && mAny.photo ? mAny.photo : `/coaches/${cid}${ext}`;
              const dest = path.join(PUBLIC, photoPath);
              if (cog && /\/img\//.test(cog)) { // downloadImage filtra o placeholder por URL
                if (await downloadImage(cog, dest)) {
                  mAny.zerozeroId = Number(cid);
                  mAny.photo = photoPath;
                  teamNotes.push(`treinador: ${coach.name} → ${photoPath}`);
                } else {
                  teamNotes.push(`treinador: ${coach.name} (sem foto/placeholder)`);
                }
              } else {
                teamNotes.push(`treinador: ${coach.name} (sem og:image)`);
              }
              await sleep(THROTTLE_JOGADOR + jitter());
            }
          }
        } else {
          teamNotes.push("treinador: não encontrado");
        }
      }
      if (want.has("fotoJogadores")) {
        const scraped = extractPlayers(html);
        const byId = new Map(scraped.map((pl) => [pl.id, pl]));
        const byNorm = new Map(scraped.map((pl) => [normName(pl.name), pl]));
        let photos = 0;
        let skipped = 0;
        for (const fp of team.players) {
          // A5: ID primeiro, nome só como fallback
          let hit = fp.zerozeroId ? byId.get(String(fp.zerozeroId)) : null;
          if (!hit) hit = byNorm.get(normName(fp.name)) || null;
          if (!hit) continue;
          fp.zerozeroId = Number(hit.id);
          if (fp.photo && fs.existsSync(path.join(PUBLIC, fp.photo))) { skipped++; continue; } // já descarregado

          const pkey = `player_${hit.id}`;
          const ph = dryRun ? cachedHtml(pkey) : await fetchHtml(`${BASE}${hit.href}`, pkey, cli.refresh);
          if (!ph) continue; // dry-run só conta o que está em cache
          const ppg = extractOgImage(ph);
          if (!ppg || !ppg.includes("/img/jogadores/")) continue;
          const ext = ppg.includes(".png") ? ".png" : ".jpg";
          const pDest = path.join(PUBLIC, fp.photo || `/players/${hit.id}${ext}`);
          if (dryRun) {
            photos++;
          } else {
            if (await downloadImage(ppg, pDest)) {
              fp.photo = `/players/${path.basename(pDest)}`;
              photos++;
            }
            await sleep(THROTTLE_JOGADOR + jitter()); // throttle mesmo quando falha
          }
        }
        teamNotes.push(`fotos jogadores: ${photos} novas + ${skipped} já tinham (${scraped.length} na página)`);
      }

      ok++;
      if (!dryRun) saveTeams({ teams }); // grava progressivamente — retoma real
      saveState({ lastTeam: team.name, ok, errors, at: new Date().toISOString(), dryRun });
      s.message(`${team.name} ✓ ${teamNotes.join(" · ")}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${team.name}: ${msg}`);
      logWarn(`${team.name}: ${msg}`);
      if (msg.includes("Suspenso") || msg.includes("Cloudflare") || msg.includes("Just a moment")) {
        s.stop("Pausa — zerozero em protecção. Gravação parcial já salva; retoma com o mesmo comando.");
        saveState({ lastTeam: teams[idx]?.name, ok, errors, at: new Date().toISOString(), dryRun });
        break;
      }
    }
    await sleep(THROTTLE_EQUIPA + jitter());
  }

  s.stop(`Feito: ${ok}/${targetIndices.length} equipa(s) OK${errors.length ? `, ${errors.length} erro(s)` : ""}.`);

  if (!dryRun && ok > 0) {
    p.log.success(`Gravado em db/fixtures/all_teams.json + imagens em client/public/{logos,players,coaches}`);
    p.log.info("A correr typecheck + seed de verificação…");
    const { execSync } = await import("child_process");
    try {
      execSync("npm run typecheck", { stdio: "inherit" });
      execSync("DB_PATH=/tmp/tui_verify.db node db/seed.js", { stdio: "inherit" });
      execSync("npx tsx scripts/gameStateAudit.ts /tmp/tui_verify.db 2>&1 | tail -20", { stdio: "inherit" });
    } catch {}
  } else if (dryRun) {
    p.log.info("Dry-run — nada foi gravado. Corre de novo sem --dry-run para aplicar.");
  }

  if (errors.length) p.log.warn(errors.join("\n"));
  p.outro("TUI concluída. Corre `npm run fetch:tui` de novo para retomar.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
