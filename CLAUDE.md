# CLAUDE.md — CashBall · Arquitetura & Padrões

> Operações/comandos/regressões: `AGENTS.md` · Design/tokens: `STYLE.md` · UI de referência: `client/src/views/PlayersTab.jsx`.

## 🛠️ Stack

| Layer | Tech | Notas |
|---|---|---|
| Frontend | React 19 + Vite 8 | **JavaScript only** (sem TypeScript); tipos via JSDoc |
| Estilo | Tailwind CSS 4 | Ícones: Material Symbols Outlined · design system em `STYLE.md` |
| Backend | Node.js + Express 5 | TypeScript (`strict: false`) |
| Real-time | Socket.io 4 | Listeners centralizados em `client/src/hooks/useSocketListeners.js` |
| BD | SQLite 3 | `server/db/base.db` (template) + `game_*.db` (salas); sem tipos PostgreSQL |
| Infra | Docker Compose | |

### JSDoc (frontend)

- Componentes: `@param {Object} props` + um `@param` por prop + `@returns {JSX.Element}`.
- Funções async: `@returns {Promise<User>}`.
- Arrays de objetos: `@param {Array<{id: number, name: string}>} players`.
- Validar sempre: `npm run check:types`.

## 🏗️ Estado & Sincronização

- **Truth da época:** `game.calendarIndex` (nunca `matchweek` em lógica de progresso).
- **Máquina de fases:** `lobby` → `match_first_half` → `match_halftime` → `match_second_half` → `[match_et_gate → match_extra_time]` → `match_finalizing` → `lobby`. Fases transitórias resetam para `lobby` no restart (anti-deadlock).
- **Memória vs BD:** `activeGames` em `gameManager.ts` é o estado runtime primário; sincronização com a BD é **seletiva** — stats/finanças persistem; minuto de jogo/lineups são transitórios.
- **Coordenação de fase:** `phaseToken` (UUID) + `phaseAcks` (Set de nomes de coaches confirmados).
- **Segment guard:** `segmentRunning[roomCode]` impede dupla execução de segmento de jogo.

## 🏭 Padrões de backend

- **Factory:** `createXxxHelpers(deps)` com `deps = { io, db, game }`; nunca instanciar helpers diretamente.
- **Socket handlers:** um ficheiro por domínio (`*Handlers.ts`), registados em `index.ts` via `registerXxxSocketHandlers(socket, deps)`.
- **Engine:** `game/engine.ts` usa CommonJS (`module.exports`) por compatibilidade; o resto de `game/` usa ESM.

## 📁 Estrutura

**`/server`**

- `index.ts` — entry (Express + Socket.io)
- `gameManager.ts` — ciclo de vida de salas/estado
- `game/` — simulação (`engine.ts`, `commentary.ts`, `playerUtils.ts`)
- `*Handlers.ts` / `*Helpers.ts` — socket por domínio / lógica de negócio (factory)
- `db/` — schema, seeds, migrations

**`/client/src`**

- `App.jsx` — root (auth state, sessão, providers de topo)
- `contexts/` — `GameContext.jsx` (estado do jogo), `TacticsContext.jsx` (UI de táticas)
- `hooks/useSocketListeners.js` — eventos de socket
- `GameLayout.jsx` — container principal (consome os contextos)
- `views/` — tabs do jogo · `pages/` — páginas fora das tabs (`AuctionsPage.jsx`, `UserSettingsPage.jsx`)
- `components/` — `modals/`, `ui/`, `shared/` · `utils/` — áudio, formatters, cache

## 🎨 Workflow de design (Stitch)

Não inventar designs — usar o fluxo **Stitch AI MCP**:

1. Prototipar/editar no projeto Stitch (`projects/2994088005927103850`).
2. Fornecer o Screen ID.
3. Implementar com `stitch_get_screen` (spec → React/Tailwind).
4. Respeitar cores de posição e offsets do sidebar (`lg:left-14` / `lg:left-64`) — valores em `STYLE.md`.
