/**
 * roomPaths.js — Localização dos ficheiros de sala (`game_<ROOM>.db`).
 *
 * Layout: `saves/<criador>/game_<ROOM>.db` (pasta por criador da sala).
 * Ficheiros antigos no `db/` legado continuam a ser encontrados
 * (compatibilidade + migração) — o `findRoomDbFile` procura no diretório
 * dado: raiz primeiro, depois subpastas (um nível).
 *
 * CommonJS de propósito: é exigido tanto por TypeScript (`gameManager`,
 * `index`, scripts via tsx) como por JS puro (`auth.js`).
 */
"use strict";

const fs = require("fs");
const path = require("path");

// Pasta de salas cujo criador é desconhecido (salas legado sem `roomCreator`).
const OWNERLESS_DIR = "_sem-dono";

/**
 * Diretório de saves (`saves/`, irmão do diretório das bases).
 * Cria-o quando necessário; as bases globais continuam em `db/`.
 */
function savesDirFor(dbDir) {
  const dir = path.normalize(path.join(dbDir, "..", "saves"));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function roomFileName(roomCode) {
  return `game_${roomCode}.db`;
}

/**
 * Normaliza um nome de treinador para nome de pasta, sem permitir
 * path traversal (`../`, barras, caracteres de controlo). Devolve o nome
 * exato sempre que seguro; caso contrário `_sem-dono`.
 */
function sanitizeCreatorName(name) {
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) return OWNERLESS_DIR;
  let safe = trimmed.replace(/[\0-\x1f<>:"/\\|?*]/g, "_").trim();
  safe = safe.replace(/[. ]+$/, "");
  if (!safe || safe === "." || safe === "..") return OWNERLESS_DIR;
  return safe.slice(0, 64);
}

/** Caminho de destino de uma sala na pasta do criador (não verifica existência). */
function creatorDbPath(dbDir, roomCode, creatorName) {
  return path.join(
    dbDir,
    sanitizeCreatorName(creatorName),
    roomFileName(roomCode),
  );
}

/**
 * Localiza o ficheiro de uma sala: raiz primeiro (legado), depois
 * subpastas (um nível, ordem alfabética para determinismo).
 * Devolve o caminho completo ou `null`.
 */
function findRoomDbFile(dbDir, roomCode) {
  const file = roomFileName(roomCode);
  const atRoot = path.join(dbDir, file);
  if (fs.existsSync(atRoot)) return atRoot;
  let entries;
  try {
    entries = fs.readdirSync(dbDir, { withFileTypes: true });
  } catch {
    return null;
  }
  const dirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  for (const dir of dirs) {
    const candidate = path.join(dbDir, dir, file);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/** Lista códigos de sala em `dbDir` (raiz + um nível de subpastas). */
function listRoomCodes(dbDir) {
  const codes = new Set();
  const collect = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return;
    }
    for (const f of entries) {
      if (f.startsWith("game_") && f.endsWith(".db")) {
        codes.add(f.replace("game_", "").replace(".db", ""));
      }
    }
  };
  collect(dbDir);
  let subdirs;
  try {
    subdirs = fs
      .readdirSync(dbDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => path.join(dbDir, e.name));
  } catch {
    subdirs = [];
  }
  for (const sub of subdirs) collect(sub);
  return [...codes];
}

module.exports = {
  OWNERLESS_DIR,
  savesDirFor,
  roomFileName,
  sanitizeCreatorName,
  creatorDbPath,
  findRoomDbFile,
  listRoomCodes,
};
