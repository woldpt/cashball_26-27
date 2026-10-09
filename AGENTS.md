# AGENTS.md — CashBall · Operações & Regras

> **pt-PT (europeu) SEMPRE** — UI, mensagens, narração, comentários. "Auto-golo" (nunca "golo de contra"/"contra" — pt-BR); "marcador"/"resultado" (nunca "placar").
> **Falar com o utilizador como se fosse não-programador:** sem jargão técnico, frases curtas, explicar por miúdos o que se passa e o que preciso de ti.
> **Leia antes de trabalhar:** arranque de sessão → `NOTES.md` · backend/arquitetura (stack, estado, padrões — não repetidos aqui) → `CLAUDE.md` · UI/estilo → `STYLE.md` · UI de referência: `client/src/views/MySquadTab.jsx`.

## 🤝 Protocolo antes de editar (sempre)

1. **Perceber:** analisar o pedido a fundo; leitura/investigação livres (ficheiros, git, auditorias) — mas **zero edições**.
2. **Clarificar:** pedidos podem vir incompletos; se ambíguo ou com decisões em aberto, perguntar (máx. 3–4 perguntas com opções) em vez de presumir.
3. **Planear:** apresentar plano curto — objetivo, ficheiros a tocar, abordagem, verificação/audits aplicáveis.
4. **Aguardar OK:** nenhuma criação/edição/apagar de ficheiros sem aprovação explícita do utilizador (1 OK vale para o plano aprovado). Surgiu algo fora do plano → parar e perguntar de novo.

## ⚡ Comandos

| Tarefa | Comando |
|---|---|
| Backend dev · typecheck · build+start | `cd server && npm run dev` · `npm run typecheck` · `npm run build && npm run start` |
| Seed | `cd server && npm run seed` |
| Frontend dev · lint · JSDoc check | `cd client && npm run dev` · `npm run lint` · `npm run check:types` |
| Mobile portrait (mudança estrutural de layout, obrigatório) | `cd client && npm run test:mobile` |
| Audit socket.io · audit de sala · audit de sessão | `cd server && npm run audit:socketio` · `npm run audit:gamestate <ROOM_CODE>` · `npm run audit:session <ROOM_CODE>` |
| Congelamento/presença (assentos) | `cd server && npm run test:session-freeze` |
| Regressão do push (web-push/auth mockados) | `cd server && npm run test:push` |
| Smoke de ligação (handlers registados) | `cd server && npm run test:connect-smoke` |
| Repair job offer | `cd server && npm run repair:joboffer <ROOM_CODE> [--fix]` |
| Crash-restart E2E (clona p/ `game_CRASHT.db`, limpa ao fim) | `cd server && npm run test:crash-recovery` (origem: `CRASHTEST_ROOM=XXXX`) |
| Stack completa | `docker compose up --build` |
| Saves produção | `ssh rick` → ver pasta `/srv/docker/cashball/server/saves/` |

**Reseed:** `entrypoint.sh` → `db/ensureSeeded.js` só re-seeda `base.db` (template) se ausente/esquema velho/fixtures mudadas (hash em `game_state.fixtures_hash`); salas nunca. Produção: `git pull && docker compose up --build`.

## 🚫 Regressões proibidas (já corrigidas — não recriar; teto ~10, arquivar as estáveis, nunca apagar sem substituto)

- **Transferências:** sempre `TransferHub.jsx` (o `MarketTab.jsx` foi removido); leilões filtrados com `p.transfer_status !== "auction"`.
- **Leilões:** guard `bids[npcTeam.id] != null` evita lances NPC duplicados; em queries de `playerRows[0]` nunca prefixo `p.` (pode ser `null` sem JOIN).
- **Histórico de jogador:** abrir via `PlayerRow` (prop `onOpenPlayerHistory`) → `socket.emit("requestPlayerHistory")`.
- **PlayerAvatar.jsx:** proibido `clipPath` — apenas caminhos geométricos puros.
- **ModalShell:** `visible={false}` **não** impede a avaliação dos `children` — guardar props nuláveis (ex. `data.teamName`) com early-return/short-circuit, senão `TypeError`.
- **Não persistir `game.lockedCoaches` em BD.**

## 📏 Padrões obrigatórios

- **Juniors (banco de suplentes), ordem fixa:** 1) `withJuniorGRs(squad, teamId, matchweek)` (1 GR no 11 inicial); 2) `ensureFullBench(squad, teamId, matchweek)` (2 GR + 16 campo; banco 7 = 1 GR + 6). IDs de juniores negativos.
- **Frontmatter YAML de skills** (`description`): scalar plain não pode conter `:` seguido de espaço (ex. "passes: portrait") — o parser `yaml` do pi falha com `BLOCK_AS_IMPLICIT_KEY`. Sempre entre aspas duplas quando há colones internos.

## ✅ Antes de "feito" / commit

- Checks verdes aplicáveis: server `npm run typecheck` · client `npm run lint` + `npm run check:types` · layout/estilo → `npm run test:mobile` · e os `test:*` de `server/package.json`/`client/package.json` cuja área foi mexida (ex. contratos → `test:contractrenewal`/`test:contractyear`). **Nunca reportar sucesso sem saída verificada.** `server/index.ts` tem `// @ts-nocheck` — o `typecheck` não vê identificadores inexistentes lá dentro; mudanças nesse ficheiro exigem `test:connect-smoke` (arranca o servidor e liga-lhe um socket).
- Alterou lógica de jogo/comunicações → correr `audit:gamestate <ROOM>` (budgets vs salários, squad mínimo, jogadores duplicados, fases) e `audit:socketio` (orphaned/duplicate handlers).
- Debug por evidência: reproduzir → isolar causa → só então fixar. Nunca corrigir por hipótese (ex.: `min-w-0` "porque costuma resolver").

## 🧯 Crash recovery & backups

Replay seguro pós-restart (`applied_weeks`, `recoverFinalizedSlot`), WAL e backups: ver `docs/CRASH.md`.

## 📌 Workflow

- **Commit automático** após cada alteração verificada — skill `.pi/skills/auto-commit/SKILL.md`. Mensagem foca no **porquê** (ex. `fix: prevent duplicate NPC bids in auctions`). Nunca push sem pedido explícito.
- **Memória:** ao fim de cada tarefa atualizar `NOTES.md` antes de commitar/terminar. Regra permanente → mover para os docs acima e remover de `NOTES.md`. **Teto: 30 apontamentos** — passou disso, os mais antigos mudam para `NOTES_arquivo.md` (nada se apaga). Apontamento novo: máx. 5 linhas (o quê, porquê, como foi testado); deploys: 1 linha.
- **Mudança estrutural de layout** (nova view/tab/modal, `GameLayout.jsx`, `index.css`, componente partilhado, grid/flex/larguras) → skill `mobile-resp-check` (passagem em retrato `test:mobile` + ver pelo menos um screenshot) antes de terminar/commitar. Tweaks (padding, cores, texto, `className` pontual) não disparam.
- **Design:** seguir `STYLE.md`; referência: `client/src/views/MySquadTab.jsx`.

## 👥 Equipa de agentes (Claude Code)

| Papel | Quem | Faz |
|---|---|---|
| Orquestrador + revisor | Sessão principal (Opus, esforço médio) | Protocolo antes de editar, plano, OK do utilizador, revisão do diff, commit (skill `auto-commit` fica aqui — sabe o porquê) |
| Coder | `.claude/agents/coder.md` (Sonnet, médio) | Implementa um plano **já aprovado** + corre os checks; não commita |
| Scout | `.claude/agents/scout.md` (Haiku, médio) | Só leitura: localizar código e fluxos, varrimento pt-PT; resumo com `ficheiro:linha` |
| Ops | `.claude/agents/ops.md` (Haiku, médio) | Skills `rick-upgrade` (só a pedido) e `mobile-resp-check` (teste + screenshots); testes/auditorias resumidos; estado do rick (só leitura); checks de marcas/camisolas; arrumar `NOTES.md`. Em FAIL reporta, o coder corrige |

- Delegar só tarefas grandes (vários ficheiros/áreas); mudanças pequenas o orquestrador faz direto — cada agente arranca sem contexto.
- O orquestrador revê sempre o diff do coder e confirma os checks antes de commitar.
- Skills: `.claude/skills` é atalho para `.pi/skills` (fonte única).
