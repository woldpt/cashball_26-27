# AGENTS.md — CashBall · Operações & Regras

> **pt-PT (europeu) SEMPRE** — UI, mensagens, narração, comentários. "Auto-golo" (nunca "golo de contra"/"contra" — pt-BR); "marcador"/"resultado" (nunca "placar").
> **Leia antes de trabalhar:** arranque de sessão → `NOTES.md` · backend/arquitetura → `CLAUDE.md` · UI/estilo → `STYLE.md` · UI de referência: `client/src/views/PlayersTab.jsx`.

## 🤝 Protocolo antes de editar (sempre)

1. **Perceber:** analisar o pedido a fundo; leitura/investigação livres (ficheiros, git, auditorias) — mas **zero edições**.
2. **Clarificar:** o utilizador não é expert em prompts — assumir que o pedido pode ser incompleto; se ambíguo ou com decisões em aberto, perguntar (máx. 3–4 perguntas com opções) em vez de presumir.
3. **Planear:** apresentar plano curto — objetivo, ficheiros a tocar, abordagem, verificação/audits aplicáveis.
4. **Aguardar OK:** nenhuma criação/edição/apagar de ficheiros sem aprovação explícita do utilizador (1 OK vale para o plano aprovado). Surgiu algo fora do plano → parar e perguntar de novo.

## ⚡ Comandos

| Tarefa | Comando |
|---|---|
| Backend dev · typecheck · build+start | `cd server && npm run dev` · `npm run typecheck` · `npm run build && npm run start` |
| Seed | `cd server && npm run seed` |
| Frontend dev · lint · JSDoc check | `cd client && npm run dev` · `npm run lint` · `npm run check:types` |
| Mobile (obrigatório após mudar layout/estilo) | `cd client && npm run test:mobile` |
| Audit socket.io · audit de sala | `cd server && npm run audit:socketio` · `npm run audit:gamestate <ROOM_CODE>` |
| Repair job offer | `cd server && npm run repair:joboffer <ROOM_CODE> [--fix]` |
| Crash-restart E2E (clona p/ `game_CRASHT.db`, limpa ao fim) | `cd server && npm run test:crash-recovery` (origem: `CRASHTEST_ROOM=XXXX`) |
| Stack completa | `docker compose up --build` |

**Reseed no arranque:** `entrypoint.sh` → `db/ensureSeeded.js` re-seeda só o `base.db` (template de salas novas) se ausente, com schema antigo ou fixtures alteradas (hash em `game_state.fixtures_hash`). Salas (`game_*.db`) nunca são afetadas. Produção: `git pull && docker compose up --build` refresca fixtures.

## 🚫 Regressões proibidas (já corrigidas — não recriar)

- **Transferências:** sempre `TransferHub.jsx` (o `MarketTab.jsx` foi removido); leilões filtrados com `p.transfer_status !== "auction"`.
- **Leilões:** guard `bids[npcTeam.id] != null` evita lances NPC duplicados; em queries de `playerRows[0]` nunca prefixo `p.` (pode ser `null` sem JOIN).
- **Histórico de jogador:** abrir via `PlayerRow` (prop `onOpenPlayerHistory`) → `socket.emit("requestPlayerHistory")`.
- **PlayerAvatar.jsx:** proibido `clipPath` — apenas caminhos geométricos puros.
- **ModalShell:** `visible={false}` **não** impede a avaliação dos `children` — guardar props nuláveis (ex. `data.teamName`) com early-return/short-circuit, senão `TypeError`.
- **Progresso da época:** fonte da verdade `game.calendarIndex` — nunca `matchweek`.
- **Contextos frontend:** `GameContext` = estado do jogo (players, finanças, fase); `TacticsContext` = UI de táticas (drag-and-drop/selection), consome `GameContext`; auth state vive em `App.jsx` e passa por props ao `GameLayout`.
- **Não persistir `game.lockedCoaches` em BD.**

## 📏 Padrões obrigatórios

- **Helpers (factory):** nunca instanciar diretamente — `const helpers = createXxxHelpers({ io, db, game });`
- **Juniors (banco de suplentes), ordem fixa:** 1) `withJuniorGRs(squad, teamId, matchweek)` (1 GR no 11 inicial); 2) `ensureFullBench(squad, teamId, matchweek)` (2 GR + 14 campo). IDs de juniores negativos.
- **Frontend JavaScript só** (tipos via JSDoc) · **Backend TypeScript** (`strict: false`) · **SQLite** sem `SERIAL`/`JSONB` · **Narração** só em `server/game/commentary.ts`.

## ✅ Antes de "feito" / commit

- Checks verdes aplicáveis: server `npm run typecheck` · client `npm run lint` + `npm run check:types` · layout/estilo → `npm run test:mobile`. **Nunca reportar sucesso sem saída verificada.**
- Alterou lógica de jogo/comunicações → correr `audit:gamestate <ROOM>` (budgets vs salários, squad mínimo, jogadores duplicados, fases) e `audit:socketio` (orphaned/duplicate handlers).
- Debug por evidência: reproduzir → isolar causa → só então fixar. Nunca corrigir por hipótese (ex.: `min-w-0` "porque costuma resolver").

## 🧯 Crash recovery & backups

Replay seguro pós-restart (`applied_weeks`, `recoverFinalizedSlot`), WAL e backups: ver `docs/CRASH.md`.

## 📌 Workflow

- **Commit automático** após cada alteração verificada — skill `.pi/skills/auto-commit/SKILL.md`. Mensagem foca no **porquê** (ex. `fix: prevent duplicate NPC bids in auctions`). Nunca push sem pedido explícito.
- **Memória entre sessões:** ao fim de cada tarefa atualizar `NOTES.md` (em curso, último estado, decisões, armadilhas) antes de commitar/terminar. Regra permanente → mover para os docs acima e remover de `NOTES.md`.
- **Mudança de layout/estilo** → skill `mobile-resp-check` antes de terminar/commitar.
- **Design:** seguir `STYLE.md` (tokens, tipografia, cards, badges); referência: `client/src/views/PlayersTab.jsx`.
