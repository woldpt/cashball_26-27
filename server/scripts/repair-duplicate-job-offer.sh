#!/usr/bin/env bash
# =============================================================================
# repair-duplicate-job-offer.sh — TUI de reparação para o bug de convites duplicados
#
# Usa apenas sqlite3 CLI (já instalado no projeto). Zero dependências extra.
#
# Uso:
#   bash server/scripts/repair-duplicate-job-offer.sh <ROOM_CODE>
#
# A TUI mostra o estado atual e permite escolher o treinador + equipa destino.
# =============================================================================

set -euo pipefail

ROOM_CODE="${1:-}"
if [ -z "$ROOM_CODE" ]; then
  echo "Uso: bash server/scripts/repair-duplicate-job-offer.sh <ROOM_CODE>"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DB_PATH="$SCRIPT_DIR/../db/game_${ROOM_CODE}.db"

if [ ! -f "$DB_PATH" ]; then
  echo "❌ Base de dados não encontrada: $DB_PATH"
  exit 1
fi

clear_screen() { printf "\033[2J\033[H"; }
bold() { printf "\033[1m%s\033[0m" "$1"; }
green() { printf "\033[32m%s\033[0m" "$1"; }
yellow() { printf "\033[33m%s\033[0m" "$1"; }
red() { printf "\033[31m%s\033[0m" "$1"; }

sql() { sqlite3 "$DB_PATH" "$@"; }

# =============================================================================
# SCREEN 1 — Diagnóstico
# =============================================================================
clear_screen
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          🛠️  REPARAÇÃO DE CONVITES DUPLICADOS                ║"
echo "║          Sala: $(printf '%-47s' "$ROOM_CODE")║"
echo "╚══════════════════════════════════════════════════════════════╝"

# Load coaches
echo ""
echo "┌── TREINADORES HUMANOS ──────────────────────────────────────┐"
sql -separator '|' "
  SELECT m.id, m.name, t.id, t.name, t.division, t.points
  FROM managers m
  LEFT JOIN teams t ON t.manager_id = m.id
  WHERE m.is_human = 1
  ORDER BY m.name;
" | while IFS='|' read -r mgr_id coach_name team_id team_name division points; do
  num=$(sql "SELECT COUNT(*) FROM managers m2 WHERE m2.is_human = 1 AND m2.name <= '$coach_name';")
  if [ -n "$team_id" ] && [ "$team_id" != "" ]; then
    printf "│ %2s. %-20s → %-22s (D%s) Pts:%-3s │\n" "$num" "$coach_name" "$team_name" "$division" "$points"
  else
    printf "│ %2s. %-20s → %-41s │\n" "$num" "$coach_name" "$(red '⚠️  SEM EQUIPA')"
  fi
done
echo "└────────────────────────────────────────────────────────────┘"

# Find orphaned teams (NULL manager with match history)
echo ""
echo "┌── EQUIPAS ÓRFÃS (manager_id = NULL, com jogos) ─────────────┐"
ORPHAN_COUNT=0
# Bug 9 fix: use process substitution < <(...) so the while runs in the current
# shell — a piped while-loop runs in a subshell and ORPHAN_COUNT++ would be lost.
while IFS='|' read -r id name division points wins draws losses; do
  if [ -n "$id" ]; then
    printf "│ %2s. %-25s D%s Pts:%-3s V%-2s E%-2s D%-2s │\n" \
      "$((ORPHAN_COUNT + 1))" "$name" "$division" "$points" "$wins" "$draws" "$losses"
    ORPHAN_COUNT=$((ORPHAN_COUNT + 1))
  fi
done < <(sql -separator '|' "
  SELECT DISTINCT t.id, t.name, t.division, t.points, t.wins, t.draws, t.losses
  FROM teams t
  WHERE t.manager_id IS NULL
    AND t.id IN (
      SELECT home_team_id FROM matches WHERE played = 1
      UNION
      SELECT away_team_id FROM matches WHERE played = 1
    )
  ORDER BY t.division, t.name;
")
echo "└────────────────────────────────────────────────────────────┘"

# Diagnosis
COACHLESS=$(sql "SELECT COUNT(*) FROM managers m WHERE m.is_human = 1 AND m.id NOT IN (SELECT manager_id FROM teams WHERE manager_id IS NOT NULL);")
ORPHAN_TOTAL=$(sql "
  SELECT COUNT(DISTINCT t.id) FROM teams t
  WHERE t.manager_id IS NULL
    AND t.id IN (
      SELECT home_team_id FROM matches WHERE played = 1
      UNION
      SELECT away_team_id FROM matches WHERE played = 1
    );
")

echo ""
echo "┌── DIAGNÓSTICO ──────────────────────────────────────────────┐"
if [ "$COACHLESS" -eq 0 ] && [ "$ORPHAN_TOTAL" -eq 0 ]; then
  echo "│ ✅ Nenhum problema detetado. DB consistente.                │"
  echo "└────────────────────────────────────────────────────────────┘"
  echo ""
  echo "Se o bug ocorreu, o servidor foi reiniciado e o estado em"
  echo "memória foi limpo — a DB ficou consistente."
  exit 0
fi

if [ "$COACHLESS" -gt 0 ]; then
  echo "│ $(yellow "⚠️  $COACHLESS treinador(es) sem equipa")                              │"
  sql "SELECT m.name FROM managers m WHERE m.is_human = 1 AND m.id NOT IN (SELECT manager_id FROM teams WHERE manager_id IS NOT NULL);" | while read name; do
    printf "│    → %-54s │\n" "$name"
  done
fi
if [ "$ORPHAN_TOTAL" -gt 0 ]; then
  echo "│ 🕳️  $ORPHAN_TOTAL equipa(s) órfã(s) (manager_id = NULL)              │"
fi
if [ "$COACHLESS" -eq "$ORPHAN_TOTAL" ]; then
  echo "│ $(green '✅ Treinadores sem equipa = órfãs. Reparação possível.')      │"
else
  echo "│ $(yellow '⚠️  Números diferentes — escolha manual necessária.')           │"
fi
echo "└────────────────────────────────────────────────────────────┘"

# =============================================================================
# SCREEN 2 — Ação
# =============================================================================
echo ""
echo "┌── AÇÕES ────────────────────────────────────────────────────┐"
echo "│ [1] Reparação automática (coachless → órfãs, por ordem)     │"
echo "│ [2] Reparação manual (escolher treinador + equipa destino)  │"
echo "│ [3] Atribuir treinador a equipa NPC livre                   │"
echo "│ [4] Apenas mostrar estado da tabela teams (raw)             │"
echo "│ [q] Sair sem alterar                                        │"
echo "└────────────────────────────────────────────────────────────┘"
echo ""
read -r -p "👉 Ação: " ACTION

case "$ACTION" in
  q|Q)
    echo "👋 A sair sem alterações."
    exit 0
    ;;

  1)
    if [ "$COACHLESS" -ne "$ORPHAN_TOTAL" ]; then
      echo "❌ Reparação automática impossível: $COACHLESS coachless vs $ORPHAN_TOTAL orphans."
      exit 1
    fi

    echo ""
    echo "🔧 REPARAÇÃO AUTOMÁTICA"

    # Get coachless coaches (ordered by name)
    COACHLESS_LIST=$(sql "SELECT m.id || '|' || m.name FROM managers m WHERE m.is_human = 1 AND m.id NOT IN (SELECT manager_id FROM teams WHERE manager_id IS NOT NULL) ORDER BY m.name;")
    ORPHAN_LIST=$(sql "
      SELECT DISTINCT t.id || '|' || t.name || ' (D' || t.division || ')'
      FROM teams t
      WHERE t.manager_id IS NULL
        AND t.id IN (
          SELECT home_team_id FROM matches WHERE played = 1
          UNION
          SELECT away_team_id FROM matches WHERE played = 1
        )
      ORDER BY t.division, t.name;
    ")

    # Show pairs
    paste -d ' → ' <(echo "$COACHLESS_LIST" | cut -d'|' -f2) <(echo "$ORPHAN_LIST" | cut -d'|' -f2) | while read line; do
      echo "   $line"
    done

    echo ""
    read -r -p "⚠️  Confirmar? [s/N]: " CONFIRM
    if [ "$CONFIRM" != "s" ] && [ "$CONFIRM" != "S" ]; then
      echo "   ❌ Cancelado."
      exit 0
    fi

    # Apply fixes
    while IFS='|' read -r mgr_id coach_name; do
      IFS='|' read -r team_id team_label < <(echo "$ORPHAN_LIST" | head -n 1)
      ORPHAN_LIST=$(echo "$ORPHAN_LIST" | tail -n +2)
      sql "UPDATE teams SET manager_id = $mgr_id WHERE id = $team_id;"
      echo "   ✅ $coach_name → $team_label"
    done <<< "$COACHLESS_LIST"

    echo ""
    echo "$(green '✅ REPARAÇÃO CONCLUÍDA. Reinicia o servidor para aplicar.')"
    ;;

  2)
    echo ""
    echo "🔧 REPARAÇÃO MANUAL — Escolhe o treinador"

    echo ""
    echo "Treinadores disponíveis:"
    sql -separator '|' "
      SELECT m.id, m.name, t.id, t.name
      FROM managers m
      LEFT JOIN teams t ON t.manager_id = m.id
      WHERE m.is_human = 1
      ORDER BY m.name;
    " | nl -w2 -s'. ' | while read line; do
      # Extract the name and team info from the line after the number
      name=$(echo "$line" | sed 's/^[[:space:]]*[0-9]*\. //' | cut -d'|' -f2)
      team_name=$(echo "$line" | sed 's/^[[:space:]]*[0-9]*\. //' | cut -d'|' -f4)
      team_id=$(echo "$line" | sed 's/^[[:space:]]*[0-9]*\. //' | cut -d'|' -f3)
      if [ -n "$team_name" ] && [ "$team_name" != "" ]; then
        echo "   $name (atual: $team_name)"
      else
        echo "   $name $(red '(⚠️ SEM EQUIPA)')"
      fi
      # Save for later use
    done

    TOTAL_COACHES=$(sql "SELECT COUNT(*) FROM managers WHERE is_human = 1;")
    echo ""
    read -r -p "👉 Nº do treinador: " COACH_NUM
    if ! [[ "$COACH_NUM" =~ ^[0-9]+$ ]] || [ "$COACH_NUM" -lt 1 ] || [ "$COACH_NUM" -gt "$TOTAL_COACHES" ]; then
      echo "❌ Número inválido."
      exit 1
    fi

    # Get coach info by offset
    SELECTED_COACH=$(sql -separator '|' "
      SELECT m.id, m.name, t.id, t.name
      FROM managers m
      LEFT JOIN teams t ON t.manager_id = m.id
      WHERE m.is_human = 1
      ORDER BY m.name
      LIMIT 1 OFFSET $((COACH_NUM - 1));
    ")
    MGR_ID=$(echo "$SELECTED_COACH" | cut -d'|' -f1)
    COACH_NAME=$(echo "$SELECTED_COACH" | cut -d'|' -f2)
    CURRENT_TEAM_ID=$(echo "$SELECTED_COACH" | cut -d'|' -f3)
    CURRENT_TEAM_NAME=$(echo "$SELECTED_COACH" | cut -d'|' -f4)

    echo "   Selecionado: $COACH_NAME"

    # Show team options
    echo ""
    echo "Equipas disponíveis para atribuir:"

    # Orphaned teams
    echo "  ── Órfãs (prioridade) ──"
    sql -separator '|' "
      SELECT DISTINCT t.id, t.name, t.division, t.points
      FROM teams t
      WHERE t.manager_id IS NULL
        AND t.id IN (
          SELECT home_team_id FROM matches WHERE played = 1
          UNION
          SELECT away_team_id FROM matches WHERE played = 1
        )
      ORDER BY t.division, t.name;
    " | nl -w2 -s'. ' | while read line; do
      echo "  $line" | sed 's/|/  /g'
    done

    ORPHAN_COUNT_TOTAL=$(sql "
      SELECT COUNT(DISTINCT t.id) FROM teams t
      WHERE t.manager_id IS NULL
        AND t.id IN (
          SELECT home_team_id FROM matches WHERE played = 1
          UNION
          SELECT away_team_id FROM matches WHERE played = 1
        );
    ")

    # Other NPC free teams
    echo "  ── Outras NPC livres ──"
    ORPHAN_IDS=$(sql "
      SELECT DISTINCT t.id FROM teams t
      WHERE t.manager_id IS NULL
        AND t.id IN (
          SELECT home_team_id FROM matches WHERE played = 1
          UNION
          SELECT away_team_id FROM matches WHERE played = 1
        );
    " | paste -sd, -)

    if [ -n "$ORPHAN_IDS" ]; then
      sql -separator '|' "
        SELECT t.id, t.name, t.division, t.points
        FROM teams t
        WHERE t.manager_id IS NULL AND t.id NOT IN ($ORPHAN_IDS)
        ORDER BY t.division, t.name
        LIMIT 20;
      " | cat -n | while read line; do
        num=$(echo "$line" | awk '{print $1}')
        newnum=$((num + ORPHAN_COUNT_TOTAL))
        rest=$(echo "$line" | cut -d' ' -f2- | sed 's/|/  /g')
        echo "  $newnum. $rest"
      done
    fi

    TOTAL_TEAMS=$((ORPHAN_COUNT_TOTAL + $(sql "
      SELECT COUNT(*) FROM teams t
      WHERE t.manager_id IS NULL AND t.id NOT IN ($ORPHAN_IDS);
    ")))
    echo ""
    read -r -p "👉 Nº da equipa: " TEAM_NUM
    if ! [[ "$TEAM_NUM" =~ ^[0-9]+$ ]] || [ "$TEAM_NUM" -lt 1 ] || [ "$TEAM_NUM" -gt "$TOTAL_TEAMS" ]; then
      echo "❌ Número inválido."
      exit 1
    fi

    # Get the selected team
    if [ "$TEAM_NUM" -le "$ORPHAN_COUNT_TOTAL" ]; then
      SELECTED_TEAM=$(sql -separator '|' "
        SELECT DISTINCT t.id, t.name
        FROM teams t
        WHERE t.manager_id IS NULL
          AND t.id IN (
            SELECT home_team_id FROM matches WHERE played = 1
            UNION
            SELECT away_team_id FROM matches WHERE played = 1
          )
        ORDER BY t.division, t.name
        LIMIT 1 OFFSET $((TEAM_NUM - 1));
      ")
    else
      OFFSET_NUM=$((TEAM_NUM - ORPHAN_COUNT_TOTAL - 1))
      SELECTED_TEAM=$(sql -separator '|' "
        SELECT t.id, t.name FROM teams t
        WHERE t.manager_id IS NULL AND t.id NOT IN ($ORPHAN_IDS)
        ORDER BY t.division, t.name
        LIMIT 1 OFFSET $OFFSET_NUM;
      ")
    fi

    TEAM_ID=$(echo "$SELECTED_TEAM" | cut -d'|' -f1)
    TEAM_NAME=$(echo "$SELECTED_TEAM" | cut -d'|' -f2)

    echo "   Selecionado: $TEAM_NAME"

    # Free old team if needed
    if [ -n "$CURRENT_TEAM_ID" ] && [ "$CURRENT_TEAM_ID" != "" ]; then
      echo ""
      echo "   ℹ️  A libertar equipa atual: $CURRENT_TEAM_NAME"
      sql "UPDATE teams SET manager_id = NULL WHERE id = $CURRENT_TEAM_ID;"
    fi

    # Assign new team
    sql "UPDATE teams SET manager_id = $MGR_ID WHERE id = $TEAM_ID;"
    echo ""
    echo "$(green "✅ $COACH_NAME → $TEAM_NAME")"
    echo "$(green '✅ REPARAÇÃO CONCLUÍDA. Reinicia o servidor para aplicar.')"
    ;;

  3)
    echo ""
    echo "🔧 ATRIBUIR A EQUIPA NPC LIVRE"

    COACHLESS_LIST2=$(sql "SELECT m.id || '|' || m.name FROM managers m WHERE m.is_human = 1 AND m.id NOT IN (SELECT manager_id FROM teams WHERE manager_id IS NOT NULL) ORDER BY m.name;")
    COACHLESS_COUNT2=$(echo "$COACHLESS_LIST2" | grep -c . || echo 0)

    if [ "$COACHLESS_COUNT2" -eq 0 ]; then
      echo "   Nenhum treinador sem equipa. Nada a fazer."
      exit 0
    fi

    echo "$COACHLESS_LIST2" | nl -w2 -s'. ' | while IFS='|' read -r num mgr_id_and_name; do
      name=$(echo "$mgr_id_and_name" | cut -d'|' -f2)
      echo "   $name"
    done

    echo ""
    read -r -p "👉 Nº do treinador: " C_NUM
    if ! [[ "$C_NUM" =~ ^[0-9]+$ ]] || [ "$C_NUM" -lt 1 ] || [ "$C_NUM" -gt "$COACHLESS_COUNT2" ]; then
      echo "❌ Número inválido."
      exit 1
    fi

    SEL_COACH_LINE=$(echo "$COACHLESS_LIST2" | sed -n "${C_NUM}p")
    SEL_MGR_ID=$(echo "$SEL_COACH_LINE" | cut -d'|' -f1)
    SEL_COACH_NAME=$(echo "$SEL_COACH_LINE" | cut -d'|' -f2)

    echo "   Selecionado: $SEL_COACH_NAME"
    echo ""
    echo "Equipas NPC disponíveis (primeiras 20):"

    sql -separator '|' "
      SELECT t.id, t.name, t.division, t.points
      FROM teams t
      LEFT JOIN managers m ON m.id = t.manager_id
      WHERE t.manager_id IS NULL OR (m.is_human = 0)
      ORDER BY t.division, t.name
      LIMIT 20;
    " | nl -w2 -s'. ' | while read line; do
      echo "  $line" | sed 's/|/  /g'
    done

    TOTAL_AVAIL=$(sql "
      SELECT COUNT(*) FROM teams t
      LEFT JOIN managers m ON m.id = t.manager_id
      WHERE t.manager_id IS NULL OR (m.is_human = 0);
    ")
    echo ""
    read -r -p "👉 Nº da equipa: " T_NUM
    if ! [[ "$T_NUM" =~ ^[0-9]+$ ]] || [ "$T_NUM" -lt 1 ] || [ "$T_NUM" -gt "$TOTAL_AVAIL" ]; then
      echo "❌ Número inválido."
      exit 1
    fi

    SEL_TEAM_LINE=$(sql -separator '|' "
      SELECT t.id, t.name, t.division
      FROM teams t
      LEFT JOIN managers m ON m.id = t.manager_id
      WHERE t.manager_id IS NULL OR (m.is_human = 0)
      ORDER BY t.division, t.name
      LIMIT 1 OFFSET $((T_NUM - 1));
    ")
    SEL_TEAM_ID=$(echo "$SEL_TEAM_LINE" | cut -d'|' -f1)
    SEL_TEAM_NAME=$(echo "$SEL_TEAM_LINE" | cut -d'|' -f2)
    SEL_TEAM_DIV=$(echo "$SEL_TEAM_LINE" | cut -d'|' -f3)

    # Clear existing non-human manager if any
    sql "UPDATE teams SET manager_id = NULL WHERE id = $SEL_TEAM_ID AND manager_id IN (SELECT id FROM managers WHERE is_human = 0);" 2>/dev/null || true

    sql "UPDATE teams SET manager_id = $SEL_MGR_ID WHERE id = $SEL_TEAM_ID;"
    echo ""
    echo "$(green "✅ $SEL_COACH_NAME → $SEL_TEAM_NAME (D$SEL_TEAM_DIV)")"
    echo "$(green '✅ REPARAÇÃO CONCLUÍDA. Reinicia o servidor para aplicar.')"
    ;;

  4)
    echo ""
    echo "┌── TABELA teams (raw) ───────────────────────────────────────┐"
    sql -header -column "
      SELECT t.id, t.name, t.division, t.manager_id, m.name as coach_name
      FROM teams t
      LEFT JOIN managers m ON m.id = t.manager_id
      ORDER BY t.division, t.name;
    "
    echo "└────────────────────────────────────────────────────────────┘"
    echo ""
    echo "┌── TABELA managers (humanos) ────────────────────────────────┐"
    sql -header -column "
      SELECT id, name, is_human FROM managers WHERE is_human = 1 ORDER BY name;
    "
    echo "└────────────────────────────────────────────────────────────┘"
    ;;

  *)
    echo "❌ Ação inválida."
    exit 1
    ;;
esac

echo ""
