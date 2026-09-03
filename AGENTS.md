# AGENTS.md — Operational Manual & Regression Prevention

> **Nota:** Este ficheiro é o manual de operações rápidas. Ele complementa o `CLAUDE.md` (Arquitetura) e o `README.md` (Produto).

## ⚡ Quick Commands

| Contexto                 | Comando                                            |
| :----------------------- | :------------------------------------------------- |
| **Backend Dev**          | `cd server && npm run dev`                         |
| **Backend Typecheck**    | `cd server && npm run typecheck`                   |
| **Backend Build/Start**  | `cd server && npm run build && npm run start`      |
| **Backend Seed**         | `cd server && npm run seed`                        |
| **Frontend Dev**         | `cd client && npm run dev`                         |
| **Frontend Lint**        | `cd client && npm run lint`                        |
| **Frontend JSDoc Check** | `cd client && npm run check:types`                 |
| **Mobile Resp Check**    | `cd client && npm run test:mobile`                 |
| **Socket Audit**         | `cd server && npm run audit:socketio`              |
| **Game-State Audit**     | `cd server && npm run audit:gamestate <ROOM_CODE>` |
| **Repair Job Offer**     | `cd server && npm run repair:joboffer <ROOM_CODE> [--fix]` |
| **Full Stack**           | `docker compose up --build`                        |

> **Reseed automático no arranque:** o `entrypoint.sh` corre `db/ensureSeeded.js`,
> que re-seeda o `base.db` (template de novas salas) automaticamente se estiver
> ausente, com schema antigo ou com fixtures alteradas (hash em `game_state.fixtures_hash`).
> Salas existentes (`game_*.db`) nunca são afetadas. Para refrescar fixtures em
> produção basta `git pull && docker compose up --build`.

## ⚠️ REGRESSION PREVENTION (Crucial)

**NÃO cometer estes erros que já foram corrigidos em sessões anteriores:**

- **Idioma (pt-PT):** todo o UI, mensagens, narração e comentários são SEMPRE em português europeu. "Auto-golo" — nunca "golo de contra"/"contra" (expressão pt-BR); "marcador"/"resultado", nunca "placar".
- **Mercado/Transferências:**
  - Use sempre `TransferHub.jsx` (o antigo `MarketTab.jsx` foi removido).
  - Garanta que leilões são filtrados em `TransferHub` (`p.transfer_status !== "auction"`).
- **Leilões (Auctions):**
  - Verifique sempre o guard `bids[npcTeam.id] != null` para evitar lances duplicados de NPCs.
  - Não use o prefixo `p.` em queries de `playerRows[0]` (evita `null` sem JOIN).
- **Histórico de Jogadores:**
  - A abertura do modal deve seguir o fluxo: `PlayerRow (prop onOpenPlayerHistory)` $\rightarrow$ `socket.emit("requestPlayerHistory")`.
- **Visual/Avatar:**
  - **PROIBIDO** usar `clipPath` em `PlayerAvatar.jsx`. Use apenas caminhos geométricos puros.
- **Modais (`ModalShell`):**
  - A prop `visible` **NÃO** impede a avaliação dos `children`. Modais cujos children acedem a props nuláveis (ex.: `data.teamName`) têm de guardar essas props com early-return ou short-circuit nos children — senão rebentam com `TypeError` mesmo com `visible={false}`.
- **Estado do Jogo:**
  - A fonte da verdade é `game.calendarIndex`. Nunca use `matchweek` para lógica de progresso.
- **Contextos do Frontend:**
  - **GameContext:** Única fonte de verdade para o estado do jogo (players, finances, match phase, etc.).
  - **TacticsContext:** Gerencia o estado da UI de táticas (drag-and-drop, selection). Consome o `GameContext`.
  - **Auth State:** Gerenciado no `App.jsx` e passado para o `GameLayout` via props.
- **Não tente persistir `game.lockedCoaches` na base de dados.**

## 🔍 Auditing & Validation

**Sempre que alterar a lógica de jogo ou comunicações, execute estas auditorias:**

### 1. Game State Audit (`npm run audit:gamestate <ROOM_CODE>`)

Verifica a integridade da base de dados de uma sala:

- **Budgets:** Detecta orçamentos inconsistentes vs. salários.
- **Squad Composition:** Verifica se cada equipa tem o número mínimo de jogadores por posição.
- **Duplicate Players:** Identifica jogadores em equipas duplicadas (erro crítico).
- **Match Phases:** Valida se o estado da fase de jogo é válido.

### 2. Socket.io Contract Audit (`npm run audit:socketio`)

Valida se os eventos de comunicação respeitam os contratos:

- **Orphaned Emissions:** Eventos emitidos mas nunca escutados.
- **Orphaned Handlers:** Listeners para eventos que nunca são emitidos.
- **Duplicate Handlers:** Múltiplos listeners para o mesmo evento (conflito).

---

## 🔬 Verificação & Debugging

- **Antes de declarar "feito" (e antes de commit):** checks verdes aplicáveis —
  `npm run typecheck` (server), `npm run lint` + `npm run check:types` (client) e
  `npm run test:mobile` quando há impacto em layout/estilo. Nunca reportar
  sucesso sem saída verificada.
- **Debugging por evidência:** reproduzir o erro → isolar a causa → só então
  propor fix. Nunca corrigir "à hipótese" (ex.: adicionar `min-w-0` porque
  "costuma resolver").

## 🧯 Crash Recovery & Backups

**Replay após crash/restart é seguro graças a `applied_weeks`** (em cada `game_*.db`):
- `weekly_finance` — rendimentos/salários/empréstimo aplicados no máximo 1× por `(season, slot)`.
- `finalized` — slot da liga/Taça já liquidado: o restart **avança o calendário** em vez de re-simular/re-cobrar (`recoverFinalizedSlot`). Uma quebra numa janela estreita entre COMMITs pode deixar só as linhas do jogo/evolução pós-jogo dessa semana por persistir — `audit:gamestate` surfaceia isso.

**Outras garantias:**
- DBs de sala e global correm em **WAL** + `busy_timeout=5000` (a base.db mantém journal DELETE para poder ser copiada via `fs.copyFileSync`).
- SIGTERM/SIGINT e erros fatais fazem flush do estado in-flight (`flushAllGameStates`) antes de fechar as DBs; o Docker reinicia limpo (`restart: unless-stopped`) e a recuperação acima torna o restart replay-safe.

**Teste E2E de crash-restart:** `cd server && npm run test:crash-recovery` — clona uma sala real para `game_CRASHT.db` (descartável, limpa ao final) e valida os 4 cenários: cobrança única do `weekly_finance` com reaplicação pós-restart, e `recoverFinalizedSlot`/`checkAllReady` avançando sem re-simular/re-cobrar em slots de liga e Taça já finalizados. Opção: `CRASHTEST_ROOM=XXXX` para escolher a sala de origem.

**Backups** (proteção contra perda de disco — complementam o WAL):
- Automático em produção: serviço `backups` do docker-compose (diário por omissão; intervalos/retenção via `BACKUP_INTERVAL_HOURS`/`RETENTION_COUNT`; snapshots em `./backups/YYYYMMDD_HHMMSS/`).
- Manual: `cd server && node scripts/backupDatabases.js` (Online Backup API — seguro com o server ativo).
- Alternativa no host sem Docker: cron + `server/scripts/backupDatabases.sh` (requer CLI sqlite3).

---

## 🛠️ COMPLEX LOGIC PATTERNS

**Siga estes padrões para garantir a integridade do sistema:**

### 1. Sistema de Juniores (Banco de Suplentes)

Para garantir que uma equipa tem sempre jogadores disponíveis, siga esta ordem de execução obrigatória:

1. `withJuniorGRs(squad, teamId, matchweek)` (Garante 1 GR para o 11 inicial).
2. `ensureFullBench(squad, teamId, matchweek)` (Garante o resto do banco: 2 GR + 14 campo).
   _Atenção: Os IDs de juniores são negativos._

### 2. Backend Helpers (Factory Pattern)

Nunca instancie helpers diretamente. Use sempre:
`const helpers = createXxxHelpers({ io, db, game });`

## 🎨 DESIGN WORKFLOW

**Estilo visual:** Siga sempre o `STYLE.md` como referência de design system. Todas as páginas e componentes devem usar os tokens, tipografia, cards, badges e convenções definidos lá. Referência de implementação: `client/src/views/PlayersTab.jsx`.

## 🚀 Commit Workflow

- **Commit automático:** após cada alteração de código verificada (checks a passar), criar sempre um commit — ver skill `auto-commit` (`.pi/skills/auto-commit/SKILL.md`). Nunca fazer push sem pedido explícito.
- Mensagens de commit devem focar no **"porquê"** (ex: `fix: prevent duplicate NPC bids in auctions`) e não apenas no "o quê".
