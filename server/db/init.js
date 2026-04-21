require("../logBootstrap");
const fs = require("fs");
const path = require("path");
const db = require("./database");

const schemaPath = path.join(__dirname, "schema.sql");
const schema = fs.readFileSync(schemaPath, "utf8");

db.exec(schema, (err) => {
  if (err) {
    console.error("Error initializing schema:", err);
  } else {
    console.log("Database schema created/verified.");
  }
  db.close();
});

// Ensure new tables exist in already-created game DBs via gameManager
// (handled via CREATE TABLE IF NOT EXISTS in schema.sql — no action needed here)
