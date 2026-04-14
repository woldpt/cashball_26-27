const fs = require("fs");
const path = require("path");
const db = require("./database");

// Ensure schema exists before seeding
const schemaPath = path.join(__dirname, "schema.sql");
const schema = fs.readFileSync(schemaPath, "utf8");

// Always load team fixtures from server/db/fixtures/all_teams.json
const fixturesDir = path.join(__dirname, "fixtures");

let allTeamsData = null;

try {
  const allTeamsFile = path.join(fixturesDir, "all_teams.json");
  if (fs.existsSync(allTeamsFile)) {
    const data = JSON.parse(fs.readFileSync(allTeamsFile, "utf8"));
    if (data.teams && Array.isArray(data.teams)) {
      allTeamsData = data.teams;
    }
  }
} catch (e) {
  console.error("Error loading all_teams.json:", e);
  allTeamsData = null;
}

if (!allTeamsData || allTeamsData.length === 0) {
  console.error("FATAL: all_teams.json not found or empty. Cannot seed.");
  process.exit(1);
}

function randomAggressiveness() {
  return 1 + Math.floor(Math.random() * 5);
}
const skillRanges = {
  1: [42, 50],
  2: [32, 42],
  3: [20, 32],
  4: [8, 20],
  5: [1, 7],
};

function randomSkill(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

db.configure("busyTimeout", 10000);

db.serialize(() => {
  // Create tables if they don't exist yet
  db.exec(schema, (schemaErr) => {
    if (schemaErr) {
      console.error("[seed] Schema init failed:", schemaErr.message);
      process.exit(1);
    }
  });

  db.run("BEGIN EXCLUSIVE", (err) => {
    if (err) {
      console.error("[seed] Failed to start transaction:", err.message);
      process.exit(1);
    }
  });
  db.run("DELETE FROM players");
  db.run("DELETE FROM teams");
  db.run("DELETE FROM managers");
  db.run("DELETE FROM game_state");
  db.run("DELETE FROM cup_matches", () => {});
  db.run("DELETE FROM palmares", () => {});
  // reset sqlite autoincrement sequences so inserted IDs start predictable at 1
  db.run("DELETE FROM sqlite_sequence WHERE name='players'");
  db.run("DELETE FROM sqlite_sequence WHERE name='teams'");
  db.run("DELETE FROM sqlite_sequence WHERE name='managers'");
  db.run("DELETE FROM sqlite_sequence WHERE name='cup_matches'", () => {});
  db.run("DELETE FROM sqlite_sequence WHERE name='palmares'", () => {});

  console.log(`Seeding ${allTeamsData.length} teams from all_teams.json...`);

  const insertManager = db.prepare(
    "INSERT INTO managers (name, reputation) VALUES (?, ?)",
  );
  const insertTeam = db.prepare(
    "INSERT INTO teams (name, manager_id, division, stadium_capacity, stadium_name, budget, color_primary, color_secondary) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertPlayer = db.prepare(
    "INSERT INTO players (name, position, skill, age, form, aggressiveness, nationality, value, wage, goals, is_star, team_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)",
  );

  let teamId = 1;
  let managerId = 1;
  const usedManagers = new Set();

  const teamsToSeed = allTeamsData;

  teamsToSeed.forEach((teamData) => {
    // Insert manager
    let managerName = teamData.manager?.name || "Treinador";
    const base = managerName;
    let candidate = base;
    let suffix = 1;
    while (usedManagers.has(candidate)) {
      candidate = `${base} #${suffix}`;
      suffix++;
    }
    managerName = candidate;
    usedManagers.add(managerName);

    insertManager.run(managerName, 50);

    // Colors from fixture or fallback
    const colors = teamData.colors || {
      primary: "#dc2626",
      secondary: "#ffffff",
    };
    const primaryColor = colors.primary || "#dc2626";
    const secondaryColor = colors.secondary || "#ffffff";

    // Stadium from fixture
    const stadium = teamData.stadium || {
      name: "Generic Stadium",
      capacity: 10000,
    };
    const stadiumCapacity = stadium.capacity || 10000;
    const budget = 1500000; // default budget for all

    const stadiumName = stadium.name || "";

    insertTeam.run(
      teamData.name,
      managerId,
      teamData.division || 4,
      stadiumCapacity,
      stadiumName,
      budget,
      primaryColor,
      secondaryColor,
    );

    // Load all players from fixture — no random names, no fixed limit
    const providedPlayers = teamData.players || [];

    // Map fixture positions to spec positions (GK→GR, MID→MED, ATK→ATA)
    const POSITION_MAP = {
      GK: "GR",
      MID: "MED",
      ATK: "ATA",
      DEF: "DEF",
      GR: "GR",
      MED: "MED",
      ATA: "ATA",
    };

    const division = teamData.division || 4;

    providedPlayers.forEach((p) => {
      if (!p || !p.name) return; // skip entries without a name

      const pos = POSITION_MAP[p.position] || p.position || "MED";
      const skill =
        p.skill ||
        randomSkill(
          (skillRanges[division] || [5, 20])[0],
          (skillRanges[division] || [5, 20])[1],
        );
      const age = p.age || Math.floor(Math.random() * 16) + 18;
      const form = p.form || Math.floor(Math.random() * 20) + 80;
      const agg = randomAggressiveness();
      const nat = p.nationality || p.country || "🇵🇹";
      const value = skill * 20000;
      const wage = skill * 200;
      const isStar =
        (pos === "MED" || pos === "ATA") && Math.random() < 0.1 ? 1 : 0;

      insertPlayer.run(
        p.name,
        pos,
        skill,
        age,
        form,
        agg,
        nat,
        value,
        wage,
        isStar,
        teamId,
      );
    });

    teamId++;
    managerId++;
  });

  // Initialize game state defaults
  db.run("INSERT INTO game_state (key, value) VALUES ('matchweek', '1')");
  db.run("INSERT INTO game_state (key, value) VALUES ('matchState', 'idle')");
  db.run("INSERT INTO game_state (key, value) VALUES ('season', '1')");
  db.run("INSERT INTO game_state (key, value) VALUES ('cupRound', '0')");
  db.run("INSERT INTO game_state (key, value) VALUES ('cupState', 'idle')");

  insertManager.finalize();
  insertTeam.finalize();
  insertPlayer.finalize((err) => {
    if (err) {
      console.error("[seed] Error finalizing players:", err.message);
      db.run("ROLLBACK", () => process.exit(1));
      return;
    }
    db.run("COMMIT", (commitErr) => {
      if (commitErr) {
        console.error("[seed] COMMIT failed:", commitErr.message);
        process.exit(1);
      }
      console.log("Base Seed complete.");
      db.close(() => process.exit(0));
    });
  });
});
