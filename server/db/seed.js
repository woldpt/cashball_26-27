require("../logBootstrap");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const db = require("./database");
// O sqlite3 emite 'error' no Database em falhas graves de abertura; sem
// listener isso crasha com stack fora do try/catch. Rede de segurança com
// mensagem limpa (erros de query vão às promises + ROLLBACK; sem COMMIT a
// transação reverte sozinha ao fechar).
db.on("error", (err) => {
  console.error("[seed] FATAL (db):", err && err.message ? err.message : err);
  process.exit(1);
});
const {
  BUDGET_BY_DIVISION,
  FANBASE_BY_DIVISION,
  SKILL_RANGE_BY_DIVISION,
  WAGE_SEED_SPREAD,
  recalcPlayerValue,
  fairWeeklyWage,
  createRng,
} = require("./seedEcon");

// ---------- Constantes da seed (antes espalhadas pelo código) ----------
const REPUTATION_DEFAULT = 50;
const MORALE_DEFAULT = 25;
const FORM_MIN_SEED = 19;
const FORM_MAX_SEED = 32;
const RESISTANCE_SET = [1, 13, 26, 38, 50];
const AGE_MIN_SEED = 18;
const AGE_SPAN_SEED = 16; // 18..33
const AGE_MIN_VALID = 15;
const AGE_MAX_VALID = 50;
const AGG_MIN = 10;
const AGG_MAX = 40;
const AGG_STEP = 10;
const STAR_CHANCE = 0.1; // MED/ATA com 10% de probabilidade
const STAR_POTENTIAL_BONUS = 4;
const STAR_POTENTIAL_SPAN = 5;
const BASE_POTENTIAL_SPAN = 4;
const SKILL_MAX = 50;
const FALLBACK_DIVISION = 4;
const VALID_POSITIONS = new Set(["GR", "DEF", "MED", "ATA"]);
const POSITION_MAP = {
  GK: "GR",
  MID: "MED",
  ATK: "ATA",
  DEF: "DEF",
  GR: "GR",
  MED: "MED",
  ATA: "ATA",
};

// RNG: determinístico com SEED=xxx, Math.random como antes sem SEED.
const { rng, label: rngLabel } = createRng(process.env.SEED);
const randInt = (min, max) => Math.floor(rng() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rng() * arr.length)];

// Nota: player_skill_snapshots (tabela + índices) é criada pelo schema.sql
// dentro de transação — não duplicar aqui.

function loadFixtures() {
  const fixturesDir = path.join(__dirname, "fixtures");
  const allTeamsFile = path.join(fixturesDir, "all_teams.json");
  try {
    if (!fs.existsSync(allTeamsFile)) return null;
    const data = JSON.parse(fs.readFileSync(allTeamsFile, "utf8"));
    if (data.teams && Array.isArray(data.teams) && data.teams.length > 0) {
      return { teams: data.teams, fixturesDir };
    }
    return null;
  } catch (e) {
    console.error("[seed] Erro a ler all_teams.json:", e.message);
    return null;
  }
}

// Promisificados mínimos (sqlite3 usa `this`, por isso helpers manuais).
const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
const exec = (sql) =>
  new Promise((resolve, reject) => {
    db.exec(sql, (err) => (err ? reject(err) : resolve()));
  });

// Valida e normaliza os jogadores do fixture; se inválido, corrige com
// fallback e conta avisos em vez de abortar a seed inteira.
function buildPlayers(providedPlayers, teamSkillRange, teamName, warnings) {
  const rows = [];
  for (const p of providedPlayers || []) {
    if (!p || !p.name) {
      warnings.nameless++;
      continue;
    }
    let pos = POSITION_MAP[p.position] || p.position || "MED";
    if (!VALID_POSITIONS.has(pos)) {
      warnings.position++;
      pos = "MED";
    }
    let skill = p.skill || randInt(teamSkillRange[0], teamSkillRange[1]);
    if (skill < 1 || skill > SKILL_MAX) {
      warnings.skill++;
      skill = Math.min(SKILL_MAX, Math.max(1, Math.round(skill)));
    }
    let age = p.age || randInt(AGE_MIN_SEED, AGE_MIN_SEED + AGE_SPAN_SEED - 1);
    if (age < AGE_MIN_VALID || age > AGE_MAX_VALID) {
      warnings.age++;
      age = randInt(AGE_MIN_SEED, AGE_MIN_SEED + AGE_SPAN_SEED - 1);
    }
    rows.push({
      name: p.name,
      pos,
      skill,
      age,
      form: p.form || randInt(FORM_MIN_SEED, FORM_MAX_SEED),
      res: pick(RESISTANCE_SET),
      agg: AGG_MIN + Math.floor(rng() * ((AGG_MAX - AGG_MIN) / AGG_STEP + 1)) * AGG_STEP,
      nat: p.nationality || p.country || "🇵🇹",
      value: recalcPlayerValue(skill),
      wage: Math.round(
        fairWeeklyWage(skill) * (1 - WAGE_SEED_SPREAD + rng() * 2 * WAGE_SEED_SPREAD),
      ),
      isStar: (pos === "MED" || pos === "ATA") && rng() < STAR_CHANCE ? 1 : 0,
      potential: 0, // calculado abaixo (depende de isStar)
      photo: p.photo || null,
      zerozeroId: p.zerozeroId || null,
    });
  }
  for (const r of rows) {
    r.potential = Math.min(
      SKILL_MAX,
      r.skill +
        (r.isStar
          ? STAR_POTENTIAL_BONUS + Math.floor(rng() * STAR_POTENTIAL_SPAN)
          : Math.floor(rng() * BASE_POTENTIAL_SPAN)),
    );
  }
  // Garantir pelo menos um craque por equipa: promover o melhor MED/ATA.
  if (rows.length > 0 && !rows.some((r) => r.isStar === 1)) {
    const eligibles = rows.filter((r) => r.pos === "MED" || r.pos === "ATA");
    if (eligibles.length > 0) {
      const best = eligibles.reduce((a, b) => (b.skill > a.skill ? b : a));
      best.isStar = 1;
      best.potential = Math.min(
        SKILL_MAX,
        best.skill + STAR_POTENTIAL_BONUS + Math.floor(rng() * STAR_POTENTIAL_SPAN),
      );
    } else {
      warnings.noStarEligible++;
    }
  }
  if (rows.length === 0) warnings.emptyTeam.push(teamName);
  return rows;
}

async function main() {
  // Falha rápida com mensagem limpa se a diretoria do DB não existir
  // (caso contrário o open falha em fundo e o processo saía com 0).
  const dbPath = process.env.DB_PATH || path.join(process.cwd(), "db", "base.db");
  if (!fs.existsSync(path.dirname(dbPath))) {
    console.error(`[seed] FATAL: diretoria inexistente: ${path.dirname(dbPath)}`);
    process.exit(1);
  }
  const loaded = loadFixtures();
  if (!loaded) {
    console.error("[seed] FATAL: all_teams.json em falta ou vazio. Seed abortada.");
    process.exit(1);
  }
  const { teams, fixturesDir } = loaded;

  const schemaPath = path.join(__dirname, "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");

  db.configure("busyTimeout", 10000);

  // Drop tables in dependency order so that the schema is always recreated
  // fresh (novas colunas aparecem mesmo ao re-seedar uma base antiga).
  const dropSchema = `
DROP TABLE IF EXISTS room_events;
DROP TABLE IF EXISTS room_seats;
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS player_tactic_history;
DROP TABLE IF EXISTS applied_weeks;
DROP TABLE IF EXISTS training_player_history;
DROP TABLE IF EXISTS player_skill_snapshots;
DROP TABLE IF EXISTS team_training;
DROP TABLE IF EXISTS club_news;
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS cup_matches;
DROP TABLE IF EXISTS palmares;
DROP TABLE IF EXISTS players;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS managers;
DROP TABLE IF EXISTS game_state;
`;

  // O BEGIN é a porta de entrada: se falhar, nada mais corre (antes, a falta
  // do gate deixava os drops/inserts correrem na mesma).
  await run("BEGIN EXCLUSIVE");
  try {
    await exec(dropSchema);
    await exec(schema);

    console.log(`[seed] Seeding ${teams.length} teams from all_teams.json (${rngLabel})...`);

    const warnings = {
      nameless: 0,
      position: 0,
      skill: 0,
      age: 0,
      noStarEligible: 0,
      emptyTeam: [],
    };
    const usedManagers = new Set();

    for (const teamData of teams) {
      // Treinador único (sufixo em colisão).
      const base = teamData.manager?.name || "Treinador";
      let managerName = base;
      for (let suffix = 1; usedManagers.has(managerName); suffix++) {
        managerName = `${base} #${suffix}`;
      }
      usedManagers.add(managerName);
      const managerRow = await run(
        "INSERT INTO managers (name, reputation, photo, zerozero_id) VALUES (?, ?, ?, ?)",
        [managerName, REPUTATION_DEFAULT, teamData.manager?.photo || null, teamData.manager?.zerozeroId || null],
      );

      const division =
        teamData.division && BUDGET_BY_DIVISION[teamData.division]
          ? teamData.division
          : FALLBACK_DIVISION;
      const stadium = teamData.stadium || {};
      const stadiumCapacity = stadium.capacity || 10000;
      const fanbase = Math.min(
        stadiumCapacity,
        FANBASE_BY_DIVISION[division] ?? FANBASE_BY_DIVISION[FALLBACK_DIVISION],
      );
      const teamRow = await run(
        "INSERT INTO teams (name, manager_id, division, stadium_capacity, stadium_name, budget, color_primary, color_secondary, crest, fanbase) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          teamData.name,
          managerRow.lastID,
          division,
          stadiumCapacity,
          stadium.name || "",
          BUDGET_BY_DIVISION[division] ?? BUDGET_BY_DIVISION[FALLBACK_DIVISION],
          teamData.colors?.primary || "#dc2626",
          teamData.colors?.secondary || "#ffffff",
          teamData.crest || null,
          fanbase,
        ],
      );

      // Intervalo de skill: o da divisão, salvo skillRange próprio no fixture
      // (ex.: Sporting/Benfica/Porto acima do resto da 1ª Liga).
      const teamSkillRange =
        Array.isArray(teamData.skillRange) && teamData.skillRange.length === 2
          ? teamData.skillRange
          : SKILL_RANGE_BY_DIVISION[division] || [5, 20];

      const players = buildPlayers(teamData.players, teamSkillRange, teamData.name, warnings);
      for (const pl of players) {
        await run(
          "INSERT INTO players (name, position, skill, age, form, resistance, aggressiveness, morale, nationality, value, wage, goals, is_star, potential, photo, zerozero_id, team_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)",
          [
            pl.name, pl.pos, pl.skill, pl.age, pl.form, pl.res, pl.agg,
            MORALE_DEFAULT, pl.nat, pl.value, pl.wage, pl.isStar,
            pl.potential, pl.photo, pl.zerozeroId, teamRow.lastID,
          ],
        );
      }
    }

    const warned =
      warnings.nameless + warnings.position + warnings.skill +
      warnings.age + warnings.noStarEligible + warnings.emptyTeam.length;
    if (warned > 0) {
      console.warn(
        `[seed] Fixtures com fallbacks — sem nome: ${warnings.nameless}, ` +
          `posição: ${warnings.position}, skill: ${warnings.skill}, ` +
          `idade: ${warnings.age}, sem craque elegível: ${warnings.noStarEligible}` +
          (warnings.emptyTeam.length > 0 ? `, equipas vazias: ${warnings.emptyTeam.join(", ")}` : ""),
      );
    }

    // Estado inicial do jogo.
    const initialState = {
      matchweek: "1",
      matchState: "idle",
      season: "1",
      cupRound: "0",
      cupState: "idle",
      // Sala nova arranca no amigável de pré-época (slot 0 do calendário v2).
      calendarIndex: "0",
      calendarVersion: "2",
      contractCutoverSeason: "1",
      // Escala 1–50 — evita que o gameManager re-migre salas já na escala nova.
      scale_v2: "1",
    };
    for (const [key, value] of Object.entries(initialState)) {
      await run("INSERT INTO game_state (key, value) VALUES (?, ?)", [key, value]);
    }
    // Marcador de versão das fixtures — usado pelo ensureSeeded.js para
    // detetar base.db desatualizado. Tem de cobrir os mesmos ficheiros que
    // templateHash() em ensureSeeded.js.
    const fixturesHash = crypto
      .createHash("sha256")
      .update(
        Buffer.concat([
          fs.readFileSync(path.join(fixturesDir, "all_teams.json")),
          fs.readFileSync(path.join(__dirname, "seed.js")),
          fs.readFileSync(path.join(__dirname, "seedEcon.js")),
          fs.readFileSync(schemaPath),
        ]),
      )
      .digest("hex");
    await run("INSERT OR REPLACE INTO game_state (key, value) VALUES ('fixtures_hash', ?)", [fixturesHash]);

    // Jogadores semeados entram na jornada 1 (renegociações de agentes após
    // 2 épocas) e com snapshot inicial de skill.
    await run("UPDATE players SET joined_matchweek = 1 WHERE team_id IS NOT NULL");
    await run(
      `INSERT OR IGNORE INTO player_skill_snapshots (player_id, matchweek, season, skill)
       SELECT id, 1, 1, skill FROM players WHERE team_id IS NOT NULL AND skill IS NOT NULL`,
    );

    await run("COMMIT");
    console.log("[seed] Base Seed complete.");
  } catch (err) {
    try {
      await run("ROLLBACK");
    } catch (rollbackErr) {
      console.error("[seed] ROLLBACK falhou:", rollbackErr.message);
    }
    console.error("[seed] FATAL:", err.message);
    process.exit(1);
  } finally {
    await new Promise((resolve) => db.close(() => resolve()));
  }
}

main();
