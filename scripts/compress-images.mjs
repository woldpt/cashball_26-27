#!/usr/bin/env node
// Comprime as imagens de jogadores, treinadores e logotipos para WebP.
// Uso: node scripts/compress-images.mjs [--dry-run] [--keep-originals] [--skip-fixtures] [--migrate-rooms]
//   --dry-run         só calcula e mostra a poupança, sem alterar nada
//   --keep-originals  mantém os PNG/JPG após converter (por defeito apaga)
//   --skip-fixtures   não reescreve as extensões em server/db/fixtures/all_teams.json
//   --migrate-rooms   atualiza photo/crest nas BDs das salas existentes (game_*.db)
import { readdir, stat, unlink, writeFile, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const DRY = args.has("--dry-run");
const KEEP = args.has("--keep-originals");
const SKIP_FIX = args.has("--skip-fixtures");
const MIGRATE = args.has("--migrate-rooms");

// Fotos (100×100, fotográficas) → WebP com perda invisível ao olho.
// Logos (500×500, gráficos planos) → WebP lossless: texto e arestas ficam intactos.
const PASTAS = {
  players: { dir: "client/public/players", webp: { quality: 82, effort: 4 } },
  coaches: { dir: "client/public/coaches", webp: { quality: 82, effort: 4 } },
  logos: { dir: "client/public/logos", webp: { lossless: true, effort: 4 } },
};
const EXTENSOES = new Set([".png", ".jpg", ".jpeg"]);

const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;
let antes = 0;
let depois = 0;
let convertidas = 0;

// Converte uma imagem; devolve [bytesOrigem, bytesWebp]. Só escreve em disco fora de dry-run.
async function converte(origem, destino, opcoes) {
  const bytesOrigem = (await stat(origem)).size;
  const pipeline = sharp(origem).webp(opcoes);
  if (DRY) return [bytesOrigem, (await pipeline.toBuffer()).length];
  await pipeline.toFile(destino);
  return [bytesOrigem, (await stat(destino)).size];
}

// Lotes de 16 em paralelo: sequencial demorava >10 min para ~1370 ficheiros.
async function emLotes(itens, tamanho, fn) {
  for (let i = 0; i < itens.length; i += tamanho) {
    const res = await Promise.all(itens.slice(i, i + tamanho).map(fn));
    for (const [a, d] of res) {
      antes += a;
      depois += d;
      convertidas++;
    }
    if ((i / tamanho) % 10 === 0 || i + tamanho >= itens.length)
      process.stdout.write(`\r  ${Math.min(i + tamanho, itens.length)}/${itens.length}`);
  }
  process.stdout.write("\n");
}

for (const [nome, cfg] of Object.entries(PASTAS)) {
  const dir = path.join(root, cfg.dir);
  const tarefas = (await readdir(dir))
    .filter((f) => EXTENSOES.has(path.extname(f).toLowerCase()))
    .map((f) => ({
      origem: path.join(dir, f),
      destino: path.join(dir, `${path.basename(f, path.extname(f))}.webp`),
    }));
  console.log(`[${nome}] ${tarefas.length} imagens`);
  await emLotes(tarefas, 16, async ({ origem, destino }) => {
    const r = await converte(origem, destino, cfg.webp);
    if (!DRY && !KEEP) await unlink(origem);
    return r;
  });
}

const pct = antes > 0 ? ` (${Math.round((1 - depois / antes) * 100)}% menos)` : "";
console.log(`Convertidas: ${convertidas} | ${mb(antes)} → ${mb(depois)}${pct}`);

// As extensões vivem na BD via fixtures: reescreve .png/.jpg → .webp.
if (!SKIP_FIX) {
  const fixPath = path.join(root, "server/db/fixtures/all_teams.json");
  const texto = await readFile(fixPath, "utf8");
  const atualizado = texto
    .replace(/(\/(?:players|coaches|logos)\/[^"']+?)\.(png|jpg|jpeg)(?=["'])/gi, "$1.webp");
  if (atualizado !== texto && !DRY) await writeFile(fixPath, atualizado);
  console.log(
    atualizado !== texto
      ? DRY
        ? "[fixtures] all_teams.json seria atualizado"
        : "[fixtures] all_teams.json atualizado"
      : "[fixtures] all_teams.json já está atualizado",
  );
}

// Salas existentes: atualiza photo/crest para .webp (nada parte sem isto,
// mas as fotos caíam para o avatar procedural por o ficheiro antigo sumir).
if (MIGRATE) {
  const { readdir: ls } = await import("node:fs/promises");
  const dbDir = path.join(root, "server/db");
  const bds = (await ls(dbDir)).filter((f) => /^game_.*\.db$/.test(f) && !f.endsWith("-wal") && !f.endsWith("-shm") && !f.endsWith("-journal"));
  const sql =
    "UPDATE players SET photo=REPLACE(REPLACE(photo,'.png','.webp'),'.jpg','.webp') WHERE photo LIKE '/players/%';" +
    "UPDATE managers SET photo=REPLACE(REPLACE(photo,'.png','.webp'),'.jpg','.webp') WHERE photo LIKE '/coaches/%';" +
    "UPDATE teams SET crest=REPLACE(REPLACE(crest,'.png','.webp'),'.jpg','.webp') WHERE crest LIKE '/logos/%';";
  for (const bd of bds) {
    if (DRY) {
      console.log(`[salas] ${bd} seria migrada`);
      continue;
    }
    await new Promise((ok, falha) =>
      execFile("sqlite3", [path.join(dbDir, bd), sql], (erro) =>
        erro ? falha(erro) : ok(),
      ),
    );
    console.log(`[salas] ${bd} migrada`);
  }
  if (bds.length === 0) console.log("[salas] nenhuma BD de sala encontrada");
}
