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
