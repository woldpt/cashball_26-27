/**
 * Repair script for the duplicate job offer bug.
 *
 * Bug: Two coaches received the same job offer for the same NPC team,
 * both accepted, and the second acceptance overwrote the first in the DB.
 *
 * Damage in DB:
 *   - toTeam.manager_id = Coach B (last writer won)
 *   - fromTeamA.manager_id = NULL  (Coach A's original team, orphaned)
 *   - fromTeamB.manager_id = NULL  (Coach B's original team, orphaned)
 *   - Coach A has NO team in the DB (but memory thinks they own toTeam)
 *
 * Usage:
 *   npx tsx server/scripts/repairDuplicateJobOffer.ts <ROOM_CODE>
 *   npx tsx server/scripts/repairDuplicateJobOffer.ts <ROOM_CODE> --fix
 *
 * Without --fix: diagnostic only (shows current state and anomalies)
 * With --fix:    repairs by restoring both coaches to their original teams
 */

const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

// ── Helpers ──────────────────────────────────────────────────────────────────

function runAll(db: any, sql: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err: Error | null, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function runExec(db: any, sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (this: any, err: Error | null) {
      if (err) reject(err);
      else resolve();
    });
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const roomCode = args[0];
  const fixMode = args.includes("--fix");

  if (!roomCode) {
    console.error("Usage: npx tsx server/scripts/repairDuplicateJobOffer.ts <ROOM_CODE> [--fix]");
    process.exit(1);
  }

  const dbPath = path.join(__dirname, "..", "db", `game_${roomCode}.db`);
  if (!fs.existsSync(dbPath)) {
    console.error(`❌ Database not found: ${dbPath}`);
    process.exit(1);
  }

  console.log(`\n🔍 Analysing room: ${roomCode}`);
  console.log(`📁 Database: ${dbPath}`);
  console.log(`🔧 Mode: ${fixMode ? "REPAIR" : "DIAGNOSTIC ONLY"}\n`);

  const db = new sqlite3.Database(dbPath);

  try {
    // ── 1. Show all human coaches and their assigned teams ──────────────────
    console.log("─".repeat(65));
    console.log("👤 HUMAN COACHES & CURRENT TEAMS");
    console.log("─".repeat(65));

    const coaches = await runAll(db, `
      SELECT m.id AS mgr_id, m.name AS coach_name,
             t.id AS team_id, t.name AS team_name, t.division
      FROM managers m
      LEFT JOIN teams t ON t.manager_id = m.id
      WHERE m.is_human = 1
      ORDER BY m.name
    `);

    for (const c of coaches) {
      const status = c.team_id
        ? `✅ ${c.team_name} (div ${c.division}, id=${c.team_id})`
        : "❌ SEM EQUIPA (NULL)";
      console.log(`  ${c.coach_name} → ${status}`);
    }

    // ── 2. Find teams with NULL manager that had recent activity ────────────
    console.log("\n─".repeat(65));
    console.log("🕳️  ORPHANED TEAMS (manager_id = NULL, recently active)");
    console.log("─".repeat(65));

    const orphaned = await runAll(db, `
      SELECT DISTINCT t.id, t.name, t.division,
        (SELECT COUNT(*) FROM matches WHERE home_team_id = t.id OR away_team_id = t.id) AS match_count
      FROM teams t
      WHERE t.manager_id IS NULL
        AND t.id IN (
          SELECT home_team_id FROM matches WHERE played = 1
          UNION
          SELECT away_team_id FROM matches WHERE played = 1
        )
      ORDER BY t.division, t.name
    `);

    if (orphaned.length === 0) {
      console.log("  ✅ No orphaned active teams found.");
    } else {
      for (const t of orphaned) {
        console.log(`  🕳️  ${t.name} (div ${t.division}, id=${t.id}) — ${t.match_count} matches played`);
      }
    }

    // ── 3. Team sharing check ───────────────────────────────────────────────
    console.log("\n─".repeat(65));
    console.log("🔁 DUPLICATE TEAM CHECK");
    console.log("─".repeat(65));

    const teamCounts = await runAll(db, `
      SELECT t.id, t.name, COUNT(*) as coach_count,
        GROUP_CONCAT(m.name, ', ') AS coaches
      FROM teams t
      JOIN managers m ON m.id = t.manager_id
      WHERE m.is_human = 1
      GROUP BY t.id
      HAVING coach_count > 1
    `);

    if (teamCounts.length === 0) {
      console.log("  ✅ No team has multiple human coaches in DB.");
      console.log("  ℹ️  The conflict was in-memory only (playersByName).");
    } else {
      for (const tc of teamCounts) {
        console.log(`  ❌ ${tc.name} (id=${tc.id}) has ${tc.coach_count} coaches: ${tc.coaches}`);
      }
    }

    // ── 4. Identify the two affected coaches ────────────────────────────────
    console.log("\n─".repeat(65));
    console.log("🧩 AFFECTED COACHES (no team + orphaned teams = probable victims)");
    console.log("─".repeat(65));

    const coachlessCoaches = coaches.filter((c) => !c.team_id);

    if (coachlessCoaches.length === 0 && orphaned.length === 0) {
      console.log("  ℹ️  No damage detected from duplicate job offer bug.");
      console.log("  ℹ️  If the bug happened, the server was restarted and state was cleared.");
    } else {
      console.log(`  Coaches without team: ${coachlessCoaches.length}`);
      for (const c of coachlessCoaches) {
        console.log(`    • ${c.coach_name}`);
      }
      console.log(`  Orphaned teams: ${orphaned.length}`);
      for (const t of orphaned) {
        console.log(`    • ${t.name} (id=${t.id}, div ${t.division})`);
      }
    }

    // ── 5. Attempt repair ───────────────────────────────────────────────────
    if (fixMode) {
      console.log("\n─".repeat(65));
      console.log("🔧 REPAIRING...");
      console.log("─".repeat(65));

      if (coachlessCoaches.length === 0 || orphaned.length === 0) {
        console.log("  ⚠️  Cannot auto-repair: need at least one coachless coach and one orphaned team.");
        console.log("  ℹ️  Manual repair required. Use the diagnostic above to identify the teams.");
      } else if (coachlessCoaches.length !== orphaned.length) {
        console.log(`  ⚠️  Mismatch: ${coachlessCoaches.length} coachless coaches vs ${orphaned.length} orphaned teams.`);
        console.log("  ℹ️  Manual repair required. Cannot auto-match coaches to teams.");
      } else {
        // Sort both lists by name for deterministic pairing
        const sortedCoaches = [...coachlessCoaches].sort((a, b) =>
          a.coach_name.localeCompare(b.coach_name),
        );
        const sortedOrphans = [...orphaned].sort((a, b) =>
          a.name.localeCompare(b.name),
        );

        for (let i = 0; i < sortedCoaches.length; i++) {
          const coach = sortedCoaches[i];
          const team = sortedOrphans[i];

          // Check if team already has another manager
          const currentOwner = await runAll(db,
            "SELECT m.name FROM teams t JOIN managers m ON m.id = t.manager_id WHERE t.id = ?",
            [team.id],
          );

          if (currentOwner.length > 0 && currentOwner[0].name) {
            console.log(`  ⚠️  Skipping ${coach.coach_name} → ${team.name}: team already has manager ${currentOwner[0].name}`);
            continue;
          }

          await runExec(db,
            "UPDATE teams SET manager_id = ? WHERE id = ?",
            [coach.mgr_id, team.id],
          );
          console.log(`  ✅ ${coach.coach_name} → ${team.name} (team id=${team.id})`);
        }

        console.log("\n  ✅ Repair complete. Restart the server for changes to take effect.");
        console.log("  ℹ️  Coaches will need to reconnect (refresh the page).");
      }
    } else {
      console.log("\n─".repeat(65));
      console.log("💡 To fix, run with --fix flag:");
      console.log(`   npx tsx server/scripts/repairDuplicateJobOffer.ts ${roomCode} --fix`);
      console.log("─".repeat(65));
    }
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
