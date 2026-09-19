# CRASH.md — Crash Recovery & Backups

> Referência on-demand (ver `AGENTS.md`). Teste E2E: `cd server && npm run test:crash-recovery` — clona uma sala real para `game_CRASHT.db` (descartável, limpa ao final); origem via `CRASHTEST_ROOM=XXXX`. Valida cobrança única do `weekly_finance` com reaplicação pós-restart, `recoverFinalizedSlot`/`checkAllReady` a avançar sem re-simular/re-cobrar em slots de liga e Taça já finalizados, e a volta ao lobby sem tática após quebra a meio do jogo.

## Volta ao lobby pós-restart

- **Quebra a meio do jogo:** o jogo parado é sempre descartado. Qualquer fase de jogo (`match_first_half`, `match_halftime`, `match_second_half`, `match_et_gate`, `match_extra_time`, `match_finalizing`) volta ao `lobby` do mesmo slot depois do replay de eventos — sem retoma no minuto, sem tática gravada (`resetAllReady` + `clearSeatPositions`). A ronda rejoga-se do minuto 0 quando todos derem Pronto, igual para liga, Taça e amigável. Chaves legadas `matchCheckpoint` são limpas no load e nunca lidas.
- `applied_weeks` (em cada `game_*.db`) limita a aplicação por `(season, slot)`:
  - `weekly_finance` — rendimentos/salários/empréstimo aplicados no máximo 1×.
  - `finalized` — slot da liga/Taça já liquidado: o restart **avança o calendário** em vez de re-simular/re-cobrar (`recoverFinalizedSlot`).
- Uma quebra numa janela estreita entre COMMITs pode deixar só as linhas do jogo/evolução pós-jogo dessa semana por persistir — `audit:gamestate <ROOM_CODE>` surfaceia isso.

## Localização das salas

- `server/db/` guarda só as bases globais (`base.db`, `accounts.db`,
  `global_chat.db`); cada sala vive em `server/saves/<criador>/game_<ROOM>.db`
  (pasta pelo nome do criador, sanitizado; `_sem-dono` quando desconhecido).
  O arranque migra automaticamente o que ainda estiver no `db/` legado
  (nunca sobrescreve).
- Todo o acesso passa pelo `findRoomDbFile` (`server/db/roomPaths.js`) —
  `saves/` + legado — por isso restauros planos de backup voltam a ser
  arquivados sozinhos no arranque seguinte.

## Garantias

- DBs de sala e global correm em **WAL** + `busy_timeout=5000` (`base.db` mantém journal DELETE para poder ser copiada via `fs.copyFileSync`).
- SIGTERM/SIGINT e erros fatais fazem flush do estado in-flight (`flushAllGameStates`) antes de fechar as DBs; o Docker reinicia limpo (`restart: unless-stopped`) e o replay acima torna o restart replay-safe.

## Backups (proteção contra perda de disco — complementam o WAL)

- **Automático em produção:** serviço `backups` do docker-compose (diário por omissão; intervalos/retenção via `BACKUP_INTERVAL_HOURS`/`RETENTION_COUNT`; snapshots em `./backups/YYYYMMDD_HHMMSS/`).
- **Manual:** `cd server && node scripts/backupDatabases.js` (Online Backup API — seguro com o server ativo).
