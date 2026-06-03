#!/usr/bin/env node
/**
 * TUI Repair Tool — Corrige atribuições de treinadores após o bug de convites duplicados.
 *
 * Interface interativa via terminal (readline) para:
 *   1. Ver o estado atual (treinadores humanos vs equipas)
 *   2. Identificar treinadores sem equipa e equipas órfãs
 *   3. Reatribuir treinadores às equipas corretas
 *
 * Uso:
 *   node server/scripts/repairDuplicateJobOffer.js <ROOM_CODE>
 *   npx tsx server/scripts/repairDuplicateJobOfferTUI.ts <ROOM_CODE>
 */

const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");
const readline = require("readline");

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

function ask(rl: any, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer: string) => resolve(answer.trim()));
  });
}

// ── TUI ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const roomCode = args[0];

  if (!roomCode) {
    console.error("Uso: node server/scripts/repairDuplicateJobOffer.js <ROOM_CODE>");
    process.exit(1);
  }

  const dbPath = path.join(__dirname, "..", "db", `game_${roomCode}.db`);
  if (!fs.existsSync(dbPath)) {
    console.error(`\n❌ Base de dados não encontrada: ${dbPath}`);
    process.exit(1);
  }

  const db = new sqlite3.Database(dbPath);

  try {
    // ===================================================================
    // SCREEN 1 — Diagnóstico
    // ===================================================================
    console.clear();
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║          🛠️  REPARAÇÃO DE CONVITES DUPLICADOS                ║");
    console.log("║          Sala: " + roomCode.padEnd(47) + "║");
    console.log("╚══════════════════════════════════════════════════════════════╝");

    // Load all human coaches with their teams
    const coaches = await runAll(db, `
      SELECT m.id AS mgr_id, m.name AS coach_name,
             t.id AS team_id, t.name AS team_name, t.division, t.budget,
             t.points, t.wins, t.draws, t.losses
      FROM managers m
      LEFT JOIN teams t ON t.manager_id = m.id
      WHERE m.is_human = 1
      ORDER BY m.name
    `);

    // Find orphaned teams (NULL manager, but with match history)
    const orphans = await runAll(db, `
      SELECT DISTINCT t.id, t.name, t.division, t.budget,
             t.points, t.wins, t.draws, t.losses,
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

    // Also find all NPC teams (no manager or non-human manager) as available
    const humanTeamIds = new Set(coaches.filter(c => c.team_id).map(c => c.team_id));

    // ── Show coaches ──
    console.log("\n┌── TREINADORES HUMANOS ──────────────────────────────────────┐");
    coaches.forEach((c, i) => {
      const num = String(i + 1).padStart(2);
      if (c.team_id) {
        console.log(`│ ${num}. ${c.coach_name.padEnd(20)} → ${c.team_name.padEnd(22)} (D${c.division}) Pts:${c.points ?? 0} │`);
      } else {
        console.log(`│ ${num}. ${c.coach_name.padEnd(20)} → ⚠️  SEM EQUIPA                      │`);
      }
    });
    console.log("└────────────────────────────────────────────────────────────┘");

    // ── Show orphaned teams ──
    if (orphans.length > 0) {
      console.log("\n┌── EQUIPAS ÓRFÃS (manager_id = NULL) ────────────────────────┐");
      orphans.forEach((t, i) => {
        const num = String(i + 1).padStart(2);
        console.log(`│ ${num}. ${t.name.padEnd(25)} D${t.division} Pts:${String(t.points ?? 0).padStart(3)} V${t.wins ?? 0} E${t.draws ?? 0} D${t.losses ?? 0} │`);
      });
      console.log("└────────────────────────────────────────────────────────────┘");
    }

    // ── Analysis ──
    const coachless = coaches.filter(c => !c.team_id);
    const allOk = coachless.length === 0 && orphans.length === 0;

    if (allOk) {
      console.log("\n✅ Nenhum problema detetado. Todos os treinadores têm equipa.");
      console.log("   Se o bug ocorreu, o servidor já deve ter sido reiniciado,");
      console.log("   limpando o estado em memória. A DB está consistente.");
      console.log();
      process.exit(0);
    }

    console.log("\n┌── DIAGNÓSTICO ──────────────────────────────────────────────┐");
    if (coachless.length > 0) {
      console.log(`│ ⚠️  ${coachless.length} treinador(es) sem equipa`);
      coachless.forEach(c => console.log(`│    → ${c.coach_name}`));
    }
    if (orphans.length > 0) {
      console.log(`│ 🕳️  ${orphans.length} equipa(s) órfã(s) (manager_id = NULL)`);
    }
    if (coachless.length === orphans.length) {
      console.log("│ ✅ Número de treinadores sem equipa = número de órfãs.");
      console.log("│    Reparação automática possível.");
    } else {
      console.log("│ ⚠️  Números diferentes — será preciso escolher manualmente.");
    }
    console.log("└────────────────────────────────────────────────────────────┘");

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    // ===================================================================
    // SCREEN 2 — Escolher ação
    // ===================================================================
    console.log("\n┌── AÇÕES ────────────────────────────────────────────────────┐");
    console.log("│ [R] Reparação automática (se coachless == orphans)          │");
    console.log("│ [M] Reparação manual (escolher treinador + equipa)          │");
    console.log("│ [A] Atribuir treinador a qualquer equipa NPC livre          │");
    console.log("│ [S] Sair sem alterar                                        │");
    console.log("└────────────────────────────────────────────────────────────┘");

    const action = await ask(rl, "\n👉 Ação: ");

    if (action.toUpperCase() === "S") {
      console.log("\n👋 A sair sem alterações.");
      rl.close();
      db.close();
      process.exit(0);
    }

    if (action.toUpperCase() === "R") {
      if (coachless.length !== orphans.length) {
        console.log("\n❌ Reparação automática impossível: número de treinadores sem equipa ≠ número de órfãs.");
        console.log("   Usa a opção [M] para reparação manual.");
        rl.close();
        db.close();
        process.exit(1);
      }

      console.log("\n🔧 REPARAÇÃO AUTOMÁTICA");
      const sortedCoaches = [...coachless].sort((a, b) => a.coach_name.localeCompare(b.coach_name));
      const sortedOrphans = [...orphans].sort((a, b) => a.name.localeCompare(b.name));

      for (let i = 0; i < sortedCoaches.length; i++) {
        const coach = sortedCoaches[i];
        const team = sortedOrphans[i];
        console.log(`   ${coach.coach_name} → ${team.name} (D${team.division})`);
      }

      const confirm = await ask(rl, "\n⚠️  Confirmar? [s/N]: ");
      if (confirm.toUpperCase() !== "S") {
        console.log("   ❌ Cancelado.");
        rl.close();
        db.close();
        process.exit(0);
      }

      for (let i = 0; i < sortedCoaches.length; i++) {
        const coach = sortedCoaches[i];
        const team = sortedOrphans[i];
        await runExec(db, "UPDATE teams SET manager_id = ? WHERE id = ?", [coach.mgr_id, team.id]);
        console.log(`   ✅ ${coach.coach_name} → ${team.name}`);
      }
      console.log("\n✅ REPARAÇÃO CONCLUÍDA. Reinicia o servidor para aplicar.");
    }

    if (action.toUpperCase() === "M") {
      console.log("\n🔧 REPARAÇÃO MANUAL — Escolhe o treinador a reatribuir");

      // Show coach options
      console.log("\nTreinadores disponíveis:");
      coaches.forEach((c, i) => {
        const status = c.team_id ? `(atual: ${c.team_name})` : "(⚠️ SEM EQUIPA)";
        console.log(`  ${i + 1}. ${c.coach_name} ${status}`);
      });

      const coachIdx = parseInt(await ask(rl, "\n👉 Nº do treinador: "), 10);
      if (isNaN(coachIdx) || coachIdx < 1 || coachIdx > coaches.length) {
        console.log("❌ Número inválido.");
        rl.close();
        db.close();
        process.exit(1);
      }
      const selectedCoach = coaches[coachIdx - 1];
      console.log(`   Selecionado: ${selectedCoach.coach_name}`);

      // Show team options
      console.log("\nEquipas disponíveis para atribuir:");

      // Priority 1: orphaned teams
      if (orphans.length > 0) {
        console.log("  ── Órfãs (prioridade) ──");
        orphans.forEach((t, i) => {
          console.log(`  ${i + 1}. ${t.name.padEnd(25)} D${t.division} Pts:${t.points ?? 0}`);
        });
      }

      // Priority 2: all NPC teams without managers
      const npcTeams = await runAll(db, `
        SELECT t.id, t.name, t.division, t.budget, t.points, t.wins, t.draws, t.losses
        FROM teams t
        WHERE t.manager_id IS NULL
          AND t.id NOT IN (${orphans.map(() => '?').join(',') || '0'})
        ORDER BY t.division, t.name
      `, orphans.map(o => o.id));

      if (npcTeams.length > 0) {
        const startIdx = orphans.length;
        console.log("  ── Outras NPC livres ──");
        npcTeams.forEach((t, i) => {
          console.log(`  ${startIdx + i + 1}. ${t.name.padEnd(25)} D${t.division} Pts:${t.points ?? 0}`);
        });
      }

      const allTeams = [...orphans, ...npcTeams];
      const teamIdx = parseInt(await ask(rl, "\n👉 Nº da equipa: "), 10);
      if (isNaN(teamIdx) || teamIdx < 1 || teamIdx > allTeams.length) {
        console.log("❌ Número inválido.");
        rl.close();
        db.close();
        process.exit(1);
      }
      const selectedTeam = allTeams[teamIdx - 1];
      console.log(`   Selecionado: ${selectedTeam.name} (D${selectedTeam.division})`);

      // If coach currently has a team, free it first
      if (selectedCoach.team_id) {
        console.log(`\n   ℹ️  A libertar equipa atual: ${selectedCoach.team_name}`);
        await runExec(db, "UPDATE teams SET manager_id = NULL WHERE id = ?", [selectedCoach.team_id]);
      }

      // Assign new team
      await runExec(db, "UPDATE teams SET manager_id = ? WHERE id = ?", [selectedCoach.mgr_id, selectedTeam.id]);
      console.log(`\n✅ ${selectedCoach.coach_name} → ${selectedTeam.name}`);
      console.log("✅ REPARAÇÃO CONCLUÍDA. Reinicia o servidor para aplicar.");
    }

    if (action.toUpperCase() === "A") {
      console.log("\n🔧 ATRIBUIR A EQUIPA NPC LIVRE");

      // Show all coachless coaches
      const coachless2 = coaches.filter(c => !c.team_id);
      if (coachless2.length === 0) {
        console.log("   Nenhum treinador sem equipa. Nada a fazer.");
        rl.close();
        db.close();
        process.exit(0);
      }

      coachless2.forEach((c, i) => {
        console.log(`  ${i + 1}. ${c.coach_name}`);
      });

      const cIdx = parseInt(await ask(rl, "\n👉 Nº do treinador: "), 10);
      if (isNaN(cIdx) || cIdx < 1 || cIdx > coachless2.length) {
        console.log("❌ Número inválido.");
        rl.close();
        db.close();
        process.exit(1);
      }
      const selCoach = coachless2[cIdx - 1];

      // Find available NPC teams (no manager, any division)
      const available = await runAll(db, `
        SELECT t.id, t.name, t.division, t.budget, t.points, t.wins, t.draws, t.losses
        FROM teams t
        LEFT JOIN managers m ON m.id = t.manager_id
        WHERE t.manager_id IS NULL OR (m.is_human = 0)
        ORDER BY t.division, t.name
      `);

      console.log(`\n${available.length} equipas NPC disponíveis. Mostrando primeiras 20:`);
      available.slice(0, 20).forEach((t, i) => {
        console.log(`  ${i + 1}. ${t.name.padEnd(25)} D${t.division} Pts:${t.points ?? 0}`);
      });
      if (available.length > 20) {
        console.log(`  ... e mais ${available.length - 20} equipas`);
      }

      const tIdx = parseInt(await ask(rl, "\n👉 Nº da equipa: "), 10);
      if (isNaN(tIdx) || tIdx < 1 || tIdx > available.length) {
        console.log("❌ Número inválido.");
        rl.close();
        db.close();
        process.exit(1);
      }
      const selTeam = available[tIdx - 1];

      // If the team has a non-human manager, clear it
      const existingMgr = await runAll(db,
        "SELECT manager_id FROM teams WHERE id = ?", [selTeam.id]
      );
      if (existingMgr[0]?.manager_id) {
        await runExec(db, "UPDATE teams SET manager_id = NULL WHERE id = ?", [selTeam.id]);
      }

      await runExec(db, "UPDATE teams SET manager_id = ? WHERE id = ?", [selCoach.mgr_id, selTeam.id]);
      console.log(`\n✅ ${selCoach.coach_name} → ${selTeam.name} (D${selTeam.division})`);
      console.log("✅ REPARAÇÃO CONCLUÍDA. Reinicia o servidor para aplicar.");
    }

    rl.close();
    console.log();
  } catch (err) {
    console.error("\n❌ Erro:", err);
    process.exit(1);
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
