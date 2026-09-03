/**
 * Game State Audit — validates game state invariants during play.
 * Checks for budget inconsistencies, invalid squad compositions,
 * duplicate players, broken match phase transitions.
 *
 * Pool 60→40:
 *   - base.db é o template completo com 60 equipas (12/divisão, 5 divisões).
 *   - cada sala game_<ROOM>.db é filtrada para 40 equipas (8/divisão) via
 *     sorteio que preserva fixos (D1: Sporting/Porto/Benfica, D4: Juventudes).
 *   - o audit distingue os dois casos: base espera 12/divisão, sala espera 8/divisão.
 *     Para retrocompatibilidade aceita 8 ou 12 em sala com warning (salas antigas
 *     sem pool_sampling). Valida também pool_sampling JSON (kept:40, dropped:20).
 *
 * Usage:
 *   npx tsx server/scripts/gameStateAudit.ts <roomCode>   # game_<roomCode>.db
 *   npx tsx server/scripts/gameStateAudit.ts base         # base.db (60 equipas)
 */

const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

interface AuditIssue {
  severity: "error" | "warning" | "info";
  category: string;
  message: string;
  details?: Record<string, any>;
}

/**
 * Squad composition targets — Confortável plantel (21-22 jogadores).
 * Each team must be able to field any formation with a full bench (5 subs)
 * plus at least one spare player per line to absorb injuries/suspensions.
 */
const SQUAD_MIN = { GR: 3, DEF: 6, MED: 6, ATA: 5 } as const;
const SQUAD_MAX = 22;

class GameStateAuditor {
  private issues: AuditIssue[] = [];
  private db: any;
  private roomCode: string;

  constructor(db: any, roomCode: string) {
    this.db = db;
    this.roomCode = roomCode;
  }

  private addIssue(
    severity: "error" | "warning" | "info",
    category: string,
    message: string,
    details?: Record<string, any>,
  ) {
    this.issues.push({ severity, category, message, details });
  }

  private async runQuery<T>(
    sql: string,
    params: any[] = [],
  ): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err: Error | null, rows: T[]) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  private async getTeams() {
    return this.runQuery<any>("SELECT id, name, division, budget FROM teams");
  }

  private async getPlayers() {
    return this.runQuery<any>(
      "SELECT id, name, team_id, value, wage, contract_until_matchweek FROM players",
    );
  }

  private async getMatches() {
    return this.runQuery<any>(
      "SELECT id, home_team_id, away_team_id, played, home_score, away_score FROM matches",
    );
  }

  async audit() {
    console.log(
      `\n📋 Auditing game state for room ${this.roomCode}...\n`,
    );

    try {
      await this.auditTeamBudgets();
      await this.auditSquadComposition();
      await this.auditDivisionCounts();
      await this.auditPoolSampling();
      await this.auditDuplicatePlayers();
      await this.auditContractExpiry();
      await this.auditMatchPhases();
      await this.auditTransfersIntegrity();

      return this.reportIssues();
    } catch (err) {
      console.error("❌ Audit failed:", err);
      process.exit(1);
    }
  }

  private async auditTeamBudgets() {
    const teams = await this.getTeams();

    for (const team of teams) {
      const players = await this.runQuery<any>(
        "SELECT SUM(wage) as total_salary FROM players WHERE team_id = ?",
        [team.id],
      );

      const totalSalary = players[0]?.total_salary || 0;

      if (totalSalary > 0 && team.budget < 0 && Math.abs(team.budget) > totalSalary * 10) {
        this.addIssue(
          "error",
          "budget",
          `Team ${team.name} has massive negative budget (${team.budget}) vs salary obligations (${totalSalary})`,
          { teamId: team.id, budget: team.budget, totalSalary },
        );
      }

      if (totalSalary > 0 && team.budget < totalSalary * 0.5) {
        this.addIssue(
          "warning",
          "budget",
          `Team ${team.name} budget (${team.budget}) may be insufficient for salaries (${totalSalary})`,
          { teamId: team.id, budget: team.budget, totalSalary },
        );
      }
    }
  }

  private async auditSquadComposition() {
    const teams = await this.getTeams();

    for (const team of teams) {
      const players = await this.runQuery<any>(
        "SELECT position, COUNT(*) as count FROM players WHERE team_id = ? GROUP BY position",
        [team.id],
      );

      const positions: Record<string, number> = {};
      for (const row of players) {
        positions[row.position] = row.count;
      }

      for (const [pos, minCount] of Object.entries(SQUAD_MIN)) {
        if ((positions[pos] || 0) < minCount) {
          this.addIssue(
            "error",
            "squad",
            `Team ${team.name} has insufficient ${pos} players (${positions[pos] || 0} < ${minCount})`,
            { teamId: team.id, position: pos, count: positions[pos] || 0 },
          );
        }
      }

      const totalPlayers = Object.values(positions).reduce((a, b) => a + b, 0);
      if (totalPlayers > SQUAD_MAX) {
        this.addIssue(
          "warning",
          "squad",
          `Team ${team.name} has too many players (${totalPlayers} > ${SQUAD_MAX})`,
          { teamId: team.id, totalPlayers },
        );
      }
    }
  }

  private async auditDuplicatePlayers() {
    const duplicates = await this.runQuery<any>(
      "SELECT team_id, name, COUNT(*) as count FROM players WHERE team_id IS NOT NULL GROUP BY team_id, name HAVING count > 1",
    );

    for (const dup of duplicates) {
      this.addIssue(
        "error",
        "duplicates",
        `Player '${dup.name}' appears ${dup.count} times in the same squad (team ${dup.team_id})`,
        { teamId: dup.team_id, playerName: dup.name, count: dup.count },
      );
    }
  }

  private async auditContractExpiry() {
    const state = await this.runQuery<any>(
      "SELECT value FROM game_state WHERE key = 'matchweek'",
    );
    const currentMatchweek = parseInt(state[0]?.value ?? "1", 10) || 1;

    const expiredContracts = await this.runQuery<any>(
      "SELECT id, name, team_id, contract_until_matchweek FROM players WHERE contract_until_matchweek > 0 AND contract_until_matchweek <= ?",
      [currentMatchweek],
    );

    if (expiredContracts.length > 0) {
      this.addIssue(
        "warning",
        "contracts",
        `${expiredContracts.length} players have contracts expiring at or before matchweek ${currentMatchweek}`,
        { count: expiredContracts.length, currentMatchweek },
      );
    }
  }

  private async auditMatchPhases() {
    const invalidPlayed = await this.runQuery<any>(
      "SELECT id, played FROM matches WHERE played NOT IN (0, 1)",
    );

    for (const match of invalidPlayed) {
      this.addIssue(
        "error",
        "match_phase",
        `Match ${match.id} has invalid 'played' value '${match.played}'`,
        { matchId: match.id, played: match.played },
      );
    }

    const playedWithoutScore = await this.runQuery<any>(
      "SELECT id, home_score, away_score FROM matches WHERE played = 1 AND (home_score IS NULL OR away_score IS NULL)",
    );

    for (const match of playedWithoutScore) {
      this.addIssue(
        "error",
        "match_phase",
        `Match ${match.id} is played but missing a score (${match.home_score}-${match.away_score})`,
        { matchId: match.id, homeScore: match.home_score, awayScore: match.away_score },
      );
    }
  }

  private async auditDivisionCounts() {
    const counts = await this.runQuery<any>(
      "SELECT division, COUNT(*) c FROM teams GROUP BY division ORDER BY division",
    );
    const expectedPerDivision = this.roomCode === "base" ? 12 : 8;
    for (const r of counts) {
      if (r.c !== expectedPerDivision) {
        if ([8, 12].includes(r.c)) {
          this.addIssue(
            "warning",
            "division",
            `D${r.division} tem ${r.c} equipas, esperado ${expectedPerDivision} (aceite por retrocompatibilidade)`,
            { division: r.division, count: r.c, expected: expectedPerDivision },
          );
        } else {
          this.addIssue(
            "error",
            "division",
            `D${r.division} tem ${r.c} equipas, esperado ${expectedPerDivision}`,
            { division: r.division, count: r.c, expected: expectedPerDivision },
          );
        }
      }
    }
    if (counts.length !== 5) {
      this.addIssue(
        "error",
        "division",
        `Número de divisões inesperado: ${counts.length} (esperado 5)`,
        { count: counts.length },
      );
    }
    const total = counts.reduce((a: number, b: any) => a + (b.c || 0), 0);
    const expectedTotal = expectedPerDivision * 5;
    // Só reporta total se não houver já erro/warning por divisão (evita duplicar)
    const hasDivIssue = this.issues.some((i) => i.category === "division");
    if (!hasDivIssue && total !== expectedTotal) {
      this.addIssue(
        "error",
        "division",
        `Total de equipas ${total} != esperado ${expectedTotal}`,
        { total, expected: expectedTotal },
      );
    }
  }

  private async auditPoolSampling() {
    const rows = await this.runQuery<any>(
      "SELECT value FROM game_state WHERE key='pool_sampling'",
    );
    const hasPool = rows.length > 0;
    if (this.roomCode === "base") {
      if (hasPool) {
        this.addIssue(
          "warning",
          "pool_sampling",
          "base.db não deve ter pool_sampling (só salas filtradas 60→40)",
          { value: String(rows[0]?.value || "").slice(0, 120) },
        );
      }
      return;
    }
    // Sala game_*.db
    if (!hasPool) {
      const cnt = await this.runQuery<any>("SELECT COUNT(*) c FROM teams");
      const total = cnt[0]?.c ?? 0;
      if (total === 60 && this.roomCode !== "base") {
        this.addIssue(
          "error",
          "pool_sampling",
          "Sala com 60 equipas mas sem pool_sampling (estado quebrado — devia ter sido filtrada 60→40)",
          { total },
        );
      }
      return;
    }
    const raw = rows[0]?.value;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed.kept !== "number" || typeof parsed.dropped !== "number") {
        this.addIssue("error", "pool_sampling", "pool_sampling com tipos inválidos", parsed);
      } else if (parsed.kept !== 40 || parsed.dropped !== 20) {
        this.addIssue(
          "error",
          "pool_sampling",
          `pool_sampling inválido: kept=${parsed.kept}, dropped=${parsed.dropped} (esperado 40/20)`,
          parsed,
        );
      }
      if (Number.isFinite(parsed.kept) && Number.isFinite(parsed.dropped) && parsed.kept + parsed.dropped !== 60) {
        this.addIssue(
          "warning",
          "pool_sampling",
          `pool_sampling kept+dropped=${parsed.kept + parsed.dropped} != 60`,
          parsed,
        );
      }
    } catch (e: any) {
      this.addIssue(
        "error",
        "pool_sampling",
        `pool_sampling JSON inválido: ${e.message}`,
        { value: String(raw || "").slice(0, 120) },
      );
    }
  }

  private async auditTransfersIntegrity() {
    const listedWithoutPrice = await this.runQuery<any>(
      "SELECT id, name, team_id, transfer_status, transfer_price FROM players WHERE transfer_status IS NOT NULL AND transfer_status != 'none' AND (transfer_price IS NULL OR transfer_price <= 0)",
    );

    for (const player of listedWithoutPrice) {
      this.addIssue(
        "warning",
        "transfers",
        `Player '${player.name}' is on transfer_status '${player.transfer_status}' without a price`,
        { playerId: player.id, teamId: player.team_id, status: player.transfer_status },
      );
    }
  }

  private reportIssues() {
    const byCategory = this.issues.reduce(
      (acc, issue) => {
        if (!acc[issue.category]) acc[issue.category] = [];
        acc[issue.category].push(issue);
        return acc;
      },
      {} as Record<string, AuditIssue[]>,
    );

    const errors = this.issues.filter((i) => i.severity === "error");
    const warnings = this.issues.filter((i) => i.severity === "warning");
    const infos = this.issues.filter((i) => i.severity === "info");

    console.log("─".repeat(60));

    for (const [category, issues] of Object.entries(byCategory)) {
      console.log(`\n📁 ${category.toUpperCase()}`);
      for (const issue of issues) {
        const icon =
          issue.severity === "error"
            ? "❌"
            : issue.severity === "warning"
              ? "⚠️ "
              : "ℹ️ ";
        console.log(`  ${icon} ${issue.message}`);
        if (issue.details) {
          console.log(`     ${JSON.stringify(issue.details)}`);
        }
      }
    }

    console.log("\n─".repeat(60));
    console.log(
      `\n📊 Summary: ${errors.length} errors, ${warnings.length} warnings, ${infos.length} infos\n`,
    );

    return {
      success: errors.length === 0,
      errors: errors.length,
      warnings: warnings.length,
      infos: infos.length,
      issues: this.issues,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────

async function main() {
  const roomCode = process.argv[2];
  if (!roomCode) {
    console.error("Usage: npx tsx server/scripts/gameStateAudit.ts <roomCode>");
    process.exit(1);
  }

  const dbPath =
    roomCode === "base"
      ? path.join(__dirname, "..", "db", "base.db")
      : path.join(__dirname, "..", "db", `game_${roomCode}.db`);
  if (!fs.existsSync(dbPath)) {
    console.error(`❌ Database not found: ${dbPath}`);
    process.exit(1);
  }

  const db = new sqlite3.Database(dbPath);
  const auditor = new GameStateAuditor(db, roomCode);

  const result = await auditor.audit();
  db.close();

  process.exit(result.success ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
