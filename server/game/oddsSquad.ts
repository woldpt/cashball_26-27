// Força do plantel para as odds: média da skill dos 14 melhores jogadores
// disponíveis (sem lesão/suspensão). Uma query cobre todas as equipas.
export function loadSquadRatings(db: any): Promise<Map<number, number>> {
  return new Promise((resolve) => {
    db.all(
      `SELECT team_id, AVG(skill) AS rating FROM (
         SELECT team_id, skill,
                ROW_NUMBER() OVER (PARTITION BY team_id ORDER BY skill DESC) AS r
         FROM players
         WHERE team_id IS NOT NULL AND id > 0
           AND COALESCE(injury_weeks, 0) = 0 AND COALESCE(suspension_games, 0) = 0
       ) WHERE r <= 14 GROUP BY team_id`,
      (err: any, rows: any[]) =>
        resolve(
          new Map(err || !rows ? [] : rows.map((x) => [Number(x.team_id), Number(x.rating)])),
        ),
    );
  });
}
