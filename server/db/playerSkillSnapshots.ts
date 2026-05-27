export function insertSkillSnapshot(
  db: any,
  playerId: number,
  matchweek: number,
  season: number,
  skill: number,
) {
  db.run(
    `INSERT OR IGNORE INTO player_skill_snapshots (player_id, matchweek, season, skill) VALUES (?, ?, ?, ?)`,
    [playerId, matchweek, season, skill],
    (err: any) => {
      if (err) console.error(`[skillSnapshot] insert error:`, err.message);
    },
  );
}
