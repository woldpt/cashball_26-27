# CRASH.md — Crash Recovery & Backups

> Referência on-demand (ver `AGENTS.md`). Teste E2E: `cd server && npm run test:crash-recovery` — clona uma sala real para `game_CRASHT.db` (descartável, limpa ao final); origem via `CRASHTEST_ROOM=XXXX`. Valida cobrança única do `weekly_finance` com reaplicação pós-restart e `recoverFinalizedSlot`/`checkAllReady` a avançar sem re-simular/re-cobrar em slots de liga e Taça já finalizados.

## Replay seguro pós-restart

- `applied_weeks` (em cada `game_*.db`) limita a aplicação por `(season, slot)`:
  - `weekly_finance` — rendimentos/salários/empréstimo aplicados no máximo 1×.
  - `finalized` — slot da liga/Taça já liquidado: o restart **avança o calendário** em vez de re-simular/re-cobrar (`recoverFinalizedSlot`).
- Uma quebra numa janela estreita entre COMMITs pode deixar só as linhas do jogo/evolução pós-jogo dessa semana por persistir — `audit:gamestate <ROOM_CODE>` surfaceia isso.

## Garantias

- DBs de sala e global correm em **WAL** + `busy_timeout=5000` (`base.db` mantém journal DELETE para poder ser copiada via `fs.copyFileSync`).
- SIGTERM/SIGINT e erros fatais fazem flush do estado in-flight (`flushAllGameStates`) antes de fechar as DBs; o Docker reinicia limpo (`restart: unless-stopped`) e o replay acima torna o restart replay-safe.

## Backups (proteção contra perda de disco — complementam o WAL)

- **Automático em produção:** serviço `backups` do docker-compose (diário por omissão; intervalos/retenção via `BACKUP_INTERVAL_HOURS`/`RETENTION_COUNT`; snapshots em `./backups/YYYYMMDD_HHMMSS/`).
- **Manual:** `cd server && node scripts/backupDatabases.js` (Online Backup API — seguro com o server ativo).
- **Alternativa no host sem Docker:** cron + `server/scripts/backupDatabases.sh` (requer CLI sqlite3).
