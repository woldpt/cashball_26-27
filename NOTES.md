# NOTES.md — Estado corrente do projeto

> **Regra (1 ficheiro, nunca um por sessão):**
> - Atualizar no fim de cada tarefa/funcionalidade — e antes de fechar a sessão.
> - Bullets curtos em pt-PT. Blocos antigos (> ~2 semanas) já refletidos em commits: apagar.
> - Regra permanente descoberta → mover para `AGENTS.md`/`CLAUDE.md`/`STYLE.md` e remover daqui.
> - Ao iniciar uma sessão nova: ler este ficheiro + `git log --oneline -10`.

## Em curso

- (nada)

## Leilões concluídos persistem 2 jornadas

- "Recentes" vivia só em memória do browser (evento `auctionClosed`); refresh recarregava só abertos via `serializeActiveAuctions` e limpava tudo.
- Agora `finalizeAuction` grava em `game.recentAuctions` (`closedMatchweek`, vendidos e não vendidos); `serializeActiveAuctions` anexa-os filtrados (`matchweek - closedMatchweek <= 2`); `gameManager` persiste/restaura em `game_state.recentAuctions` (inclui finalização inline pós-restart).
- Checks: `server` typecheck OK.

## Tutorial de Coach (novo)

- Tour guiado em 8 balões spotlight (Clube → Plantel → Treino → Finanças → Mercado → 11 → Confirmar → Simulação); arranca ao fechar o WelcomeModal de conta nova, 1x por treinador+sala (localStorage), com Saltar e "Rever tutorial" no Clube.
- Ficheiros novos: `client/src/components/tutorial/{CoachTutorial.jsx,coachTutorialSteps.js}`, `client/src/hooks/useCoachTutorial.js`; âncoras `data-tour` em GameLayout/TacticsView.
- Checks: lint + check:types OK; landscape PASS 168/168; portrait só falha pré-existente `transfer-resp-test` 320 (falha igual sem estas alterações). `client/transform-fixed-test.html` é órfão (sem .jsx) e ficou fora do commit.

## Último estado

- **Finanças — desktop demasiado grande (ajustado):** no hero, valores `lg:text-4xl`→`lg:text-3xl` e ícones de marca de água `text-8xl`→`text-6xl`; o `BalanceLineChart` (viewBox 640×210, `w-full h-auto`) esticava à largura total do painel no desktop (~490px de altura) — agora envolto em `mx-auto max-w-3xl` (centrado, ~252px de altura). Só tocou em classes `sm:`/`md:`/`lg:` + cap >768px → mobile portrait/landscape intacto (sem mobile-resp-check).

- **Join "A entrar na sala..." já não fica bloqueado para sempre:** o `handleJoinSuccess` limpava o timer de segurança de 10s; se o `teamAssigned` se perdesse nesse intervalo (socket cai/reconecta), não havia timeout, erro nem retry — só o refresh resolvia (auto-join com a sessão guardada). Agora: `armJoinTimeout()` (App.jsx) re-arma o timer após o `joinGameSuccess`, e o `onConnect` do `useSocketListeners` re-joina também no estado "à espera do teamAssigned" (`roomCode` definido, sem `teamId`) — o servidor re-emite o `teamAssigned`. Checks: lint + check:types OK.
- **CupUpsetModal sequenciado com PostMatchMoodModal:** sem auto-fecho (só botão "Continuar"); a revelação agora aguarda `postMatchMood === null` (gate nas deps do effect, timer de 250 ms rearmado) — modais já não sobrepõem. Se o jogo do utilizador não foi dessa ronda (sem mood modal), a surpresa revela diretamente.
- **Mentalidade alterável a meio do jogo:** o engine já adotava `setTactic` ao vivo (`applyLiveTacticAdoption` em `engine.ts`, efeito no minuto seguinte + evento `tactic_change` na cronologia) — a restrição era só UI. `IntervencaoView.jsx`: `MentalidadeColumn` (desktop) já sem gate de `isHalftime`; mobile vertical mostra o bloco recolhível também em modo `action`; landscape phone ganhou o chip "Mentalidade" na barra minimalista do topo (abre a linha de botões de estilo). Mobile-resp-check: portrait + landscape PASS (harness `intervencao-test`).
- **Penalti falhado na vista ao vivo:** o engine já emite `penalty_miss` (e a timeline/narração já o tratavam), mas a lista de eventos das colunas por equipa no `LiveMatchHero` filtrava-o fora. Adicionado `"penalty_miss"` aos filtros `homeEvents`/`awayEvents` + cor âmbar em `TeamEvents` + ícone `❌` em `matchEventIcon` (`liveHelpers.js`).
- **Compra de NPCs no Mercado (lote semanal):** `processNpcTransferActivity` (`server/npcTransferHelpers.ts`) só comprava com probabilidades baixas (40% por equipa / 55% por jogador) e tecto de 55% do orçamento — parecia que os NPCs só compravam em leilões (que são reativos). Ajustado para 65% / 75% e tecto de 70%.
- Nota: o Mercado só tem oferta via listagens "fixed" (humanos) ou excedentes listados pelos próprios NPCs; nas salas ativas o mercado estava vazio (`transfer_status='none'` em todos).

## Próximos passos

- Push de `d0c24d2` (crest nos icones + nomes legíveis no popup do sorteio da Taça) — só com pedido explícito do utilizador.
