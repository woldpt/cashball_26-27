const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'base.db');
const db = new sqlite3.Database(dbPath);
db.run('PRAGMA foreign_keys = ON', (err) => {
  if (err) console.error('[db] Failed to enable foreign keys:', err.message);
});
module.exports = db;
