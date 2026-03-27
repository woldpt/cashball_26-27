#!/bin/sh
set -e

DB_PATH="/app/db/base.db"

# Always regenerate base.db from fixtures so that any change to
# all_teams.json (or other fixtures) takes effect after a Docker rebuild.
# Per-game DBs (game_<code>.db) are separate and are NOT touched here.
echo "[entrypoint] Seeding base.db from fixtures/all_teams.json…"
node db/init.js
node db/seed.js
echo "[entrypoint] Seed complete."

exec node index.js
