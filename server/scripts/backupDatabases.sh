#!/usr/bin/env bash
# backupDatabases.sh — Backup de todas as bases SQLite do Cashball.
# Uso: server/scripts/backupDatabases.sh [BACKUP_DIR]
#
# Por omissão guarda em /backups/cashball (cria se não existir).
# Retenção: 7 dias (configurável via RETENTION_DAYS).
#
# Cron sugerido (diário às 03:00):
#   0 3 * * * /home/woldpt/git/cashball/server/scripts/backupDatabases.sh >> /var/log/cashball-backup.log 2>&1

set -euo pipefail

BACKUP_DIR="${1:-${BACKUP_DIR:-/backups/cashball}}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
DB_DIR="$(cd "$(dirname "$0")/../db" && pwd)"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_SUBDIR="${BACKUP_DIR}/${TIMESTAMP}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# Verificar que sqlite3 existe
if ! command -v sqlite3 &>/dev/null; then
  log "ERRO: sqlite3 não encontrado. Instala com: apt install sqlite3"
  exit 1
fi

# Criar diretório de backup
mkdir -p "$BACKUP_SUBDIR"
log "Backup para: $BACKUP_SUBDIR"

# Backup de cada .db (usa .backup para consistência — SQLite online backup API)
shopt -s nullglob
for db in "$DB_DIR"/*.db; do
  name="$(basename "$db")"
  if [ ! -s "$db" ]; then
    log "A ignorar (vazio): $name"
    continue
  fi
  log "A fazer backup: $name"
  sqlite3 "$db" ".backup '${BACKUP_SUBDIR}/${name}'"
done

# Verificar integridade dos backups (integrity_check rápido)
FAILED=0
for backup in "$BACKUP_SUBDIR"/*.db; do
  result=$(sqlite3 "$backup" "PRAGMA integrity_check;" 2>&1)
  if [ "$result" != "ok" ]; then
    log "ERRO: integrity_check falhou em $(basename "$backup"): $result"
    FAILED=1
  fi
done

if [ "$FAILED" -ne 0 ]; then
  log "ERRO: Alguns backups não passaram integrity_check."
  exit 1
fi

# Limpar backups antigos
log "A remover backups com mais de ${RETENTION_DAYS} dias..."
find "$BACKUP_DIR" -maxdepth 1 -type d -name "20*" -mtime +"$RETENTION_DAYS" -exec rm -rf {} + 2>/dev/null || true

COUNT=$(ls -1 "$BACKUP_SUBDIR"/*.db 2>/dev/null | wc -l)
SIZE=$(du -sh "$BACKUP_SUBDIR" | cut -f1)
log "Concluído: $COUNT ficheiros, $SIZE"
