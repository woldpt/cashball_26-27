const fs = require("fs");
const path = require("path");
const db = require("./database");

// Single source of truth for teams, players, managers, stadiums and colours.
// Edit server/db/fixtures/all_teams.json and rebuild Docker to update the game.
const allTeamsFile = path.join(__dirname, "fixtures", "all_teams.json");
if (!fs.existsSync(allTeamsFile)) {
  console.error("[seed] fixtures/all_teams.json not found — aborting.");
  process.exit(1);
}
const allTeams = JSON.parse(fs.readFileSync(allTeamsFile, "utf8")).teams;

const aggressivenessLevels = ["Low", "Medium", "Medium", "Medium", "High"];
const skillRanges = {
  1: [40, 50],
  2: [30, 40],
  3: [20, 30],
  4: [5, 20],
  5: [1, 10],
};
const divisionBudgets = {
  1: 10000000,
  2: 5000000,
  3: 2500000,
  4: 1500000,
  5: 500000,
};

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

db.on("error", (err) => {
  console.error("[seed] DB error:", err.message);
});

db.serialize(() => {
  db.run("DELETE FROM players");
  db.run("DELETE FROM teams");
  db.run("DELETE FROM managers");
  db.run("DELETE FROM game_state");
  db.run("DELETE FROM sqlite_sequence WHERE name='players'");
  db.run("DELETE FROM sqlite_sequence WHERE name='teams'");
  db.run("DELETE FROM sqlite_sequence WHERE name='managers'");
  db.run("BEGIN");

  console.log(`[seed] Seeding ${allTeams.length} teams from all_teams.json…`);

  const insertManager = db.prepare(
    "INSERT INTO managers (name, reputation) VALUES (?, ?)",
  );
  const insertTeam = db.prepare(
    "INSERT INTO teams (name, manager_id, division, stadium_capacity, budget, color_primary, color_secondary) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const insertPlayer = db.prepare(
    "INSERT INTO players (name, position, skill, age, form, aggressiveness, nationality, value, wage, goals, is_star, team_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)",
  );

  let teamId = 1;
  let managerId = 1;
  const usedManagerNames = new Set();

  for (const team of allTeams) {
    const div = team.division || 5;
    const [minS, maxS] = skillRanges[div] || [1, 10];
    const budget = divisionBudgets[div] || 500000;

    // Manager — ensure unique name (managers.name is UNIQUE in schema)
    let managerName =
      team.manager && team.manager.name
        ? team.manager.name
        : `Treinador ${teamId}`;
    if (usedManagerNames.has(managerName)) {
      let suffix = 2;
      while (usedManagerNames.has(`${managerName} (${suffix})`)) suffix++;
      managerName = `${managerName} (${suffix})`;
    }
    usedManagerNames.add(managerName);
    insertManager.run(managerName, 50);

    // Team
    const primary =
      team.colors && team.colors.primary ? team.colors.primary : "#333333";
    const secondary =
      team.colors && team.colors.secondary ? team.colors.secondary : "#ffffff";
    const capacity =
      team.stadium && team.stadium.capacity ? team.stadium.capacity : 5000;
    insertTeam.run(
      team.name,
      managerId,
      div,
      capacity,
      budget,
      primary,
      secondary,
    );

    // Players — use fixture list, always exactly 20 per team
    const fixtureList = Array.isArray(team.players) ? team.players : [];
    for (let i = 0; i < 20; i++) {
      const fp = fixtureList[i];
      const name = fp && fp.name ? fp.name : `Jogador ${teamId}-${i + 1}`;
      const pos =
        fp && fp.position ? fp.position : pick(["GK", "DEF", "MID", "ATK"]);
      const nat = fp && fp.country ? fp.country : "POR";
      const skill = rand(minS, maxS);
      const age = rand(18, 33);
      const form = rand(80, 99);
      const agg = pick(aggressivenessLevels);
      const value = skill * 5000;
      const wage = skill * 50;
      const isStar =
        (pos === "MID" || pos === "ATK") && Math.random() < 0.18 ? 1 : 0;
      insertPlayer.run(
        name,
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
    }

    teamId++;
    managerId++;
  }

  // Free agents (no team)
  for (let i = 0; i < 30; i++) {
    const pos = pick(["GK", "DEF", "DEF", "MID", "MID", "MID", "ATK", "ATK"]);
    const skill = rand(0, 15);
    const age = rand(18, 33);
    const form = rand(80, 99);
    const agg = pick(aggressivenessLevels);
    const value = skill * 5000;
    const wage = skill * 50;
    const isStar =
      (pos === "MID" || pos === "ATK") && Math.random() < 0.12 ? 1 : 0;
    insertPlayer.run(
      `Agente Livre ${i + 1}`,
      pos,
      skill,
      age,
      form,
      agg,
      "POR",
      value,
      wage,
      isStar,
      null,
    );
  }

  // Game state defaults
  db.run("INSERT INTO game_state (key, value) VALUES ('matchweek', '1')");
  db.run("INSERT INTO game_state (key, value) VALUES ('matchState', 'idle')");
  db.run("INSERT INTO game_state (key, value) VALUES ('season', '1')");
  db.run("INSERT INTO game_state (key, value) VALUES ('cupRound', '0')");
  db.run("INSERT INTO game_state (key, value) VALUES ('cupState', 'idle')");

  insertManager.finalize();
  insertTeam.finalize();
  insertPlayer.finalize();

  db.run("COMMIT");
});

db.close(() => {
  console.log("[seed] Done.");
});
