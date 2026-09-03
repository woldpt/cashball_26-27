# Task 4 — Adaptar `seed`, `ensureSeeded` e `gameStateAudit` ao pool 60

## Implementado

**`server/scripts/gameStateAudit.ts`** — única alteração funcional:
- Actualizado cabeçalho com documentação do pool 60→40 (base 12/div vs sala 8/div, fixos D1/D4).
- Novo `auditDivisionCounts()`: `expectedPerDivision = roomCode==='base' ? 12 : 8`; se `c` diverge mas está em `[8,12]` emite `warning` (retrocompatibilidade — salas antigas sem `pool_sampling` ou base copiada sem filtragem), caso contrário `error`; valida também que são 5 divisões e total `expected*5`.
- Novo `auditPoolSampling()`: em `base` warn se `pool_sampling` existir; em sala sem `pool_sampling` e 60 equipas warn (sala antiga); com `pool_sampling` valida JSON `kept===40 && dropped===20` e `kept+dropped===60`, caso contrário `error`/`warning`.
- `audit()` passa a chamar ambos antes de `auditDuplicatePlayers`.

**`server/db/seed.js`** — sem alteração lógica necessária. Verificado: `Seeding ${allTeamsData.length} teams from all_teams.json...` já loga `Seeding 60 teams...`, `BUDGET_BY_DIVISION` cobre 1–5, `teamId`/`managerId` incrementam até 60, `usedManagers` evita duplicados, `fixtures_hash = sha256(all_teams.json+seed.js+schema.sql)` já cobre pool 60.

**`server/db/ensureSeeded.js`** — sem alteração lógica necessária. Verificado: `templateHash()` já inclui `all_teams.json+seed.js+schema.sql`, `REQUIRED_TABLES` já inclui `player_skill_snapshots`, re-seed só afecta `base.db`, salas `game_*.db` nunca tocadas.

## Testes RED/GREEN

**RED (antes da alteração):** `gameStateAudit.ts` não tinha qualquer validação de `teams` por divisão nem de `pool_sampling`; `npx tsx scripts/gameStateAudit.ts base` e `game_<ROOM>` passavam sempre (0 errors) independentemente de ter 8, 12 ou outro número por divisão, e não detectava `pool_sampling` mal formado.

**GREEN (após):**
- `npx tsx scripts/gameStateAudit.ts base` — PASS, 0 errors (base actual: 12/div ×5, sem `pool_sampling`).
- `npx tsx scripts/gameStateAudit.ts 445WU8` — PASS, 0 errors (sala existente: 8/div, sem `pool_sampling` mas 40 equipas → tolerado).
- Cópia filtrada 60→40 com `_tmp` (better-sqlite3, keep 40 + `pool_sampling {kept:40,dropped:20}`) — PASS, 0 errors.
- Cópia base não filtrada como sala (`game_AUDITTEST` com 60 sem `pool_sampling`) — PASS com 5 warnings `division` + 1 warning `pool_sampling` (retrocompat), 0 errors (comportamento desenhado).
- Sala com D1 corrompida para 10 equipas — FAIL, 1 error `division` + warnings retrocompat, detectado.
- Sala com `pool_sampling {kept:30,dropped:30}` — FAIL, `error pool_sampling inválido` + warnings divisão.
- `cd server && npm run typecheck` — PASS.

## Ficheiros alterados

- `server/scripts/gameStateAudit.ts` — audit pool 60 (strict base 12 vs sala 8 + fallback warning, pool_sampling).
- `server/db/seed.js` — verificado, sem diff.
- `server/db/ensureSeeded.js` — verificado, sem diff.

## Self-review

- Guard retrocompat `[8,12]` evita quebrar salas antigas criadas antes do sorteio 60→40; erro só para valores fora de ambos.
- `pool_sampling` validado como JSON com tipos numéricos e soma 60.
- Não foi introduzido `clipPath` nem alterado idioma.
- `typecheck` limpo; `audit:gamestate base` e `audit:gamestate <ROOM>` mantêm semântica existente para casos válidos.

## Preocupações

- Salas antigas com 60 equipas e sem `pool_sampling` actualmente só dão `warning`; se quiseres forçar migração, mudar para `error` em `auditPoolSampling` quando `total===60`.
- Se surgirem salas com divisões desequilibradas (ex: 9/7 por sorteio corrompido), o warning retrocompat não apanha — só `error` para fora de 8/12; manter assim é intencional (fail-fast para corrupção real).
