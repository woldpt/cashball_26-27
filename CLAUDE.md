# CLAUDE.md — CashBall · Arquitetura & Padrões

> Operações/comandos/regressões: `AGENTS.md` · Design/tokens: `STYLE.md` · UI de referência: `client/src/views/PlayersTab.jsx`.

## 🛠️ Stack

| Layer | Tech | Notas |
|---|---|---|
| Frontend | React 19 + Vite 8 | **JavaScript only** (sem TypeScript); tipos via JSDoc |
| Estilo | Tailwind CSS 4 | Ícones: Material Symbols Outlined · design system em `STYLE.md` |
| Backend | Node.js + Express 5 | TypeScript (`strict: false`) |
| Real-time | Socket.io 4 | Listeners centralizados em `client/src/hooks/useSocketListeners.js` |
| BD | SQLite 3 | `server/db/base.db` (template) + `server/saves/<criador>/game_*.db` (salas, via `db/roomPaths.js`); sem tipos PostgreSQL |
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
- **Assentos & presença:** `roomStateHelpers.ts` — `room_seats` (equipa/`ready`/tática/`seat_epoch`/`deviceId`) é a fonte durável; `playersByName` é a projeção. Presença = socket ligado **ou** lease dentro da grace (`PRESENCE_GRACE_MS`), por isso um flape não conta como ausência.
- **Congelamento (regra central):** com um treinador da ronda ausente, `computeAbsentees` > 0 e `waitForPresence` bloqueia o minuto, as janelas de decisão (`waitForMatchAction`), o intervalo, o prolongamento e o fecho da jornada. Não há fallback automático para humanos. Só `leaveRoom`/kick/despedida/`adminReleaseRoom` libertam o assento.
- **Durabilidade:** `room_events` (append-only, `seq`) + volta ao `lobby` do slot depois do replay — a quebra a meio descarta o jogo (sem tática gravada) e a ronda rejoga-se do 0; só um slot já finalizado avança (`recoverFinalizedSlot`). Cliente: `seq` no `gameState` + `requestResync` quando deteta um salto.
- **Segment guard:** `segmentRunning[roomCode]` impede dupla execução de segmento de jogo.

## 🧩 Sistemas transversais (1 linha cada)

- **MOM:** `game/mom.ts` (puro) + `momHelpers.ts` (persiste em `match_moms`).
- **Adeptos:** `teams.fans_mood` + `coreHelpers.computeAttendance/explainAttendance` (mood, preço, meteo).
- **Barreira do 11:** `game/lineupReady.ts` valida 11 + banco antes do pontapé de saída.
- **Presença:** canal `__presence__` + convites de sala (`presenceHelpers.ts`, `InviteRoomModal.jsx`).

## 🏭 Padrões de backend

- **Helpers:** funções simples por defeito (deps por chamada); factory `createXxxHelpers(deps)` com `deps = { io, db, game }` só quando o objeto viaja entre módulos (regra em `AGENTS.md`).
- **Socket handlers:** um ficheiro por domínio (`*Handlers.ts`), registados em `index.ts` via `registerXxxSocketHandlers(socket, deps)`; eventos espelhados em `socketEventRegistry.json` (regenerado pelo `audit:socketio`).
- **Engine:** `game/engine.ts` (ESM) consome `matchCalculations.ts`, `playerUtils.ts` e `commentary.ts` (narração só aqui).

## 📁 Estrutura

**`/server`**

- `index.ts` — entry (Express + Socket.io)
- `gameManager.ts` — ciclo de vida de salas/estado
- `game/` — simulação: `engine.ts`, `commentary.ts`, `playerUtils.ts`, `matchCalculations.ts`, `mom.ts`, `lineupReady.ts`, `tacticFamiliarity.ts`
- `*Handlers.ts` / `*Helpers.ts` — socket por domínio / lógica de negócio (`weeklyFlow`, `cupFlow`, `matchFlow`, `matchSummary`, `training`, `contract`, `mom`, `presence`, …)
- `db/` — schema, seeds, migrations + `roomPaths.js` (salas em `saves/<criador>/`, fallback legado)

**`/client/src`**

- `App.jsx` — root (auth state, sessão, providers de topo)
- `contexts/` — `GameContext.jsx` (estado do jogo), `TacticsContext.jsx` (UI de táticas)
- `hooks/useSocketListeners.js` — eventos de socket
- `GameLayout.jsx` — container principal (consome os contextos)
- `views/` — tabs do jogo · `pages/` — páginas fora das tabs (`AuctionsPage.jsx`, `UserSettingsPage.jsx`)
- `GameRoutes.jsx` — roteamento das tabs · `GameOverlays.jsx` — modais globais · `constants/` — navegação, tuning
- `components/` — `modals/`, `ui/` (incl. `TransferHub.jsx`, o hub de transferências), `shared/` · `utils/` — áudio, formatters, cache
