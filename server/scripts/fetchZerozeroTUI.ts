/**
 * TUI para apanhar dados do zerozero — corre com: npm run fetch:tui
 * Permite escolher equipas (por divisão ou URL nova) e que info ir buscar,
 * descarregando para o repo com cache, retoma e throttle devagarinho.
 */
import * as p from "@clack/prompts";
import fs from "fs";
import path from "path";
import { loadTeams, saveTeams, parseZerozeroUrl, teamLabel } from "./lib/teamRegistry";
import {
  BASE,
  SEASON_DEFAULT,
  fetchHtml,
  extractPlayers,
  extractCoach,
  extractOgImage,
  extractHeaderColor,
  downloadImage,
  sleep,
} from "./lib/zerozeroScrape";

const STATE_PATH = path.join(process.cwd(), ".cache", "zerozero", "tui_state.json");

function saveState(s: unknown) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
}

async function main() {
  p.intro("CashBall · zerozero TUI");

  const data = loadTeams();
  const teams = data.teams;

  // 1) Escolher equipas
  const teamOptions = teams.map((t, i) => ({
    value: String(i),
    label: teamLabel(t, i),
  }));
  teamOptions.push({ value: "__new__", label: "＋ Adicionar equipa nova por URL zerozero" });

  const selected = (await p.multiselect({
    message: "Equipas a actualizar (espaço = seleccionar)",
    options: teamOptions,
    required: false,
  })) as unknown as string[] | symbol;
  if (p.isCancel(selected)) return p.cancel("Cancelado.");

  let targetIndices: number[] = (selected as string[]).filter((v) => v !== "__new__").map(Number);
  let newUrls: string[] = [];

  if ((selected as string[]).includes("__new__")) {
    const urlInput = (await p.text({
      message: "URL zerozero da nova equipa (ex: https://www.zerozero.pt/equipa/fc-alverca/1?search=1)",
      validate: (v) => (!v ? "Indica um URL" : !parseZerozeroUrl(v) ? "URL não parece ser /equipa/..." : undefined),
    })) as unknown as string | symbol;
    if (p.isCancel(urlInput)) return p.cancel("Cancelado.");
    newUrls.push(parseZerozeroUrl(urlInput as string)!);
    // pergunta divisão para a nova
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
    // cria placeholder; será preenchido no scrape
    const placeholder: (typeof teams)[number] = {
      name: `Nova ${(urlInput as string).split("/").pop()?.slice(0, 20) || "equipa"}`,
      division: Number(div),
      skillRange: [20, 35] as [number, number],
      colors: { primary: "#1ba84a", secondary: "#ffffff" },
      stadium: { name: "Estádio Municipal", capacity: 2500 },
      manager: { name: "Treinador" },
      crest: null,
      players: [],
    };
    (placeholder as unknown as Record<string, unknown>).zerozeroUrl = newUrls[0];
    teams.push(placeholder);
    targetIndices.push(teams.length - 1);
  }

  if (targetIndices.length === 0) return p.cancel("Nada seleccionado.");

  // 2) Que info ir buscar
  const infos = (await p.multiselect({
    message: "Que informação queres recolher?",
    options: [
      { value: "plantel", label: "Plantel (22 jogadores)" },
      { value: "cores", label: "Cor principal (#page_header_container)" },
      { value: "emblema", label: "Emblema (og:image equipa)" },
      { value: "fotoJogadores", label: "Fotos jogadores (og:image /jogador/...)" },
      { value: "fotoTreinador", label: "Foto treinador (/treinador/...)" },
      { value: "estadio", label: "Estádio (nome/capacidade se disponível)" },
    ],
    required: true,
  })) as unknown as string[] | symbol;
  if (p.isCancel(infos)) return p.cancel("Cancelado.");

  const want = new Set(infos as string[]);

  const dryRun = (await p.confirm({
    message: "Fazer dry-run (só mostrar o que faria, sem gravar)?",
    initialValue: false,
  })) as unknown as boolean | symbol;
  if (p.isCancel(dryRun)) return p.cancel("Cancelado.");

  const throttleEquipa = 1200;
  const throttleJogador = 900;

  // Mapa de URLs por equipa (a partir de fetchZerozeroSquads TEAMS ou do que está em .cache)
  // Para simplificar, usamos o URL guardado em teamRegistry se existir, senão tenta /equipa/<slug>
  const TEAM_URL_MAP: Record<string, string> = {};
  // tenta carregar do fetchZerozeroSquads se existir
  try {
    const txt = fs.readFileSync(path.join(process.cwd(), "scripts", "fetchZerozeroSquads.ts"), "utf-8");
    const re = /\{\s*name:\s*"([^"]+)"[\s\S]*?url:\s*"([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(txt))) TEAM_URL_MAP[m[1]] = m[2];
  } catch {}

  const s = p.spinner();
  s.start(`A preparar ${targetIndices.length} equipa(s)…`);

  let ok = 0;
  let errors: string[] = [];

  for (const idx of targetIndices) {
    const team = teams[idx];
    const urlPath = (team as unknown as Record<string, string>).zerozeroUrl
      || TEAM_URL_MAP[team.name]
      || `/equipa/${team.name.toLowerCase().replace(/\s+/g, "-")}`;
    const sep = urlPath.includes("?") ? "&" : "?";
    const teamUrl = `${BASE}${urlPath}${sep}epoca_id=${SEASON_DEFAULT}`;

    s.message(`${team.name} — ${teamUrl}`);
    try {
      const html = await fetchHtml(teamUrl);
      // plantel
      if (want.has("plantel")) {
        const players = extractPlayers(html);
        if (players.length >= 12 && !(dryRun as boolean)) {
          // mantém 22, mapeia para fixtures com zerozeroId/photo placeholder (fotos vêm a seguir)
          // por agora só nomes; fotos tratadas abaixo
          team.players = players.slice(0, 22).map((pl) => ({
            name: pl.name,
            country: "🇵🇹",
            position: "MED" as const,
            age: null,
            zerozeroId: Number(pl.id),
            photo: null,
          }));
          // tenta preservar posições reais re-extraindo com POS_MAP se disponível no HTML
        }
      }
      if (want.has("cores")) {
        const col = extractHeaderColor(html);
        if (col && !(dryRun as boolean)) team.colors.primary = col;
      }
      if (want.has("emblema")) {
        const og = extractOgImage(html);
        if (og && og.includes("/img/logos/equipas/") && !(dryRun as boolean)) {
          const dest = path.join(process.cwd(), "..", "client", "public", "logos", `${team.name.toLowerCase().replace(/\s+/g, "-")}.png`);
          if (!dryRun) await downloadImage(og, dest);
          team.crest = `/logos/${path.basename(dest)}`;
        }
      }
      if (want.has("fotoTreinador")) {
        const coach = extractCoach(html);
        if (coach) {
          if (!(dryRun as boolean)) team.manager.name = coach.name;
          // fetch foto treinador
          const coachHtml = await fetchHtml(`${BASE}${coach.href}`, `coach_${coach.href.replace(/\W/g, "_")}`);
          const og = extractOgImage(coachHtml);
          const cid = coach.href.match(/\/([0-9]+)$/)?.[1];
          if (og && og.includes("/img/") && cid && !(dryRun as boolean)) {
            const ext = og.includes(".png") ? ".png" : ".jpg";
            const dest = path.join(process.cwd(), "..", "client", "public", "coaches", `${cid}${ext}`);
            await downloadImage(og, dest);
            team.manager.zerozeroId = Number(cid);
            team.manager.photo = `/coaches/${path.basename(dest)}`;
          }
          await sleep(throttleJogador);
        }
      }
      if (want.has("fotoJogadores")) {
        const players = extractPlayers(html);
        // mapeia para fixtures: para cada player da equipa alvo, procura href por nome
        const byNorm = new Map(players.map((pl) => [pl.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, ""), pl]));
        for (const fp of team.players) {
          const key = fp.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
          const hit = byNorm.get(key);
          if (!hit) continue;
          fp.zerozeroId = Number(hit.id);
          const ph = await fetchHtml(`${BASE}${hit.href}`, `player_${hit.id}`);
          const og = extractOgImage(ph);
          if (og && og.includes("/img/jogadores/") && !og.includes("zerozero_og-default")) {
            const ext = og.includes(".png") ? ".png" : ".jpg";
            const dest = path.join(process.cwd(), "..", "client", "public", "players", `${hit.id}${ext}`);
            if (!(dryRun as boolean)) {
              await downloadImage(og, dest);
              fp.photo = `/players/${path.basename(dest)}`;
            }
          }
          await sleep(throttleJogador);
        }
      }
      ok++;
      saveState({ lastTeam: team.name, ok, errors, at: new Date().toISOString() });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${team.name}: ${msg}`);
      p.log.warn(`${team.name}: ${msg}`);
      // se for Suspenso/Cloudflare, pára e sugere retomar mais tarde
      if (msg.includes("Suspenso") || msg.includes("Cloudflare") || msg.includes("Just a moment")) {
        s.stop(`Pausa — zerozero em protecção. Retoma mais tarde com o mesmo comando.`);
        break;
      }
    }
    await sleep(throttleEquipa);
  }

  s.stop(`Feito: ${ok}/${targetIndices.length} equipa(s) OK${errors.length ? `, ${errors.length} erro(s)` : ""}.`);

  if (!(dryRun as boolean) && ok > 0) {
    saveTeams({ teams });
    p.log.success(`Gravado em db/fixtures/all_teams.json + imagens em client/public/{logos,players,coaches}`);
    p.log.info("A correr typecheck + seed de verificação…");
    const { execSync } = await import("child_process");
    try {
      execSync("npm run typecheck", { stdio: "inherit" });
      execSync("DB_PATH=/tmp/tui_verify.db node db/seed.js", { stdio: "inherit" });
      execSync("npx tsx scripts/gameStateAudit.ts /tmp/tui_verify.db 2>&1 | tail -20", { stdio: "inherit" });
    } catch {}
  } else if (dryRun as boolean) {
    p.log.info("Dry-run — nada foi gravado. Corre de novo sem dry-run para aplicar.");
  }

  if (errors.length) p.log.warn(errors.join("\n"));
  p.outro("TUI concluída. Corre `npm run fetch:tui` de novo para retomar.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
