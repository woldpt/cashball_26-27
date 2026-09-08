# NOTES.md — Estado corrente do projeto

> **Regra (1 ficheiro, nunca um por sessão):**
> - Atualizar no fim de cada tarefa/funcionalidade — e antes de fechar a sessão.
> - Bullets curtos em pt-PT. Blocos antigos (> ~2 semanas) já refletidos em commits: apagar.
> - Regra permanente descoberta → mover para `AGENTS.md`/`CLAUDE.md`/`STYLE.md` e remover daqui.
> - Ao iniciar uma sessão nova: ler este ficheiro + `git log --oneline -10`.

## Em curso

## Economia NPC — "supervisor" descentralizado (novo)

- Objectivo: travar os dois desequilíbrios NPC sem um árbitro central — (P1)
  NPC ricos a acumular saldos multimilionários e (P2) NPC em bancarrota sem
  consequência. Fecha lacunas que já existiam: NPCs não sofrem pressão de
  agente (só humanos, `contractHelpers`) e o loop de insolvência só tratava
  humanos (`coachDismissalHelpers` loop 4 só via forma).
- **P1 `processNpcAgentPressure`** (`contractHelpers.ts`, corre na cadeia
  semanal logo após as negociações humanas): sobe gradualmente (prob ~6%/sem,
  +15% máx) o salário de NPC subvalorizados rumo a `fairWage×(1+riqueza+forma)`
  — mas só enquanto a folha ≤ `npcSustainableWeeklyFolha` (nunca provoca
  insolvência). Ricos/formados pagam mais → a folha absorve o excedente.
- **P2 no loop NPC de `processCoachEvents`**: insolvência é **estrutural**, não
  saldo negativo transitório — só incrementa streak quando `budget<0` **E**
  folha > `npcStructuralBreakEvenFolha` (base semanal + patrocínio anual/19).
  Ao fim de N semanas seguidas (`NPC_NEGATIVE_BUDGET_CUT_STREAK`),
  `forceNpcWageCut` coloca à venda (leilão isExClub) os excedentários de maior
  ordenado, mantendo sempre o plantel ≥ mínimo por posição (`POS_MIN`).
- `npcStructuralBreakEvenFolha`/`npcSustainableWeeklyFolha` em `gameConstants`
  (promovi `WEEKLY_BASE_INCOME` para lá; `NPC_SEASON_WEEKS=19`
  = SEASON_CALENDAR.length). Patrocínio amortizado pela época inteira.
- Estado `npcNegativeBudgetStreak` (types + gameManager init/load/save + reset
  fim-de-época em cupFlowHelpers). Wiring em index.ts (contractHelpers antes de
  coachDismissal; helper passado a ambos).
- **Observabilidade:** os eventos (novo contrato/reestruturação) vão para o
  diário do clube NPC (`club_news`, `type:'renegotiation'`/`'cost_cut'`, sem
  `amount` → não distorcem o gráfico de saldo que é reconstruído por type). Mas
  esse diário é por-equipa e só visível ao próprio clube → o efeito
  *visível ao jogador* é o dos jogadores forçados a aparecer no mercado/leilões
  e no Histórico de Transferências. Registo no diário mantém-se (fonte canónica,
  coerente com wages/income NPC).
- Checks: server typecheck + build OK; `audit:gamestate 445WU8` 0 erros;
  `audit:socketio` 0 erros. Sem mudança de layout → sem mobile-resp-check.
- **Constantes são placeholder** (riqueza/forma caps, 2000000/0.25/0.15,
  prob 0.06, cap ratio 0.95, streaks 2/4/3, 2 por corte): validar e afinar em
  jogo real de 1–2 épocas (regra anti-overfit) — não verificado em runtime aqui.

- **Gráfico de saldo — prémios de fim de época:** o gráfico (2 épocas, reconstruído a partir do diário `club_news`) mostrava o valor dos prémios de fim de época *esmagado* nas semanas do ano anterior em vez de um salto limpo. Causa: `applySeasonEnd` creditava ao `budget` (via `UPDATE`) os prémios de Campeão (Liga/div 2-4), Melhor Marcador e o patrocínio anual, **sem** os registar em `club_news` — a reconciliação inversa da âncora empurrava esse rendimento invisível para toda a linha do ano anterior.
  - Fix: `logClubNews` ganhou override opcional `data.year`/`data.matchweek` (`coreHelpers.ts`); em `cupFlowHelpers.ts` os 4 créditos agora são registados como `type:'prize'` etiquetados em `year+1, matchweek:1` → salto único no início da nova época (decisão do utilizador: semana 1 do novo ano, não fim do ano anterior).
  - Só corrige dali em diante (sem backfill de histórico). Verificar num jogo real que passou pela viragem de época.


## Substituições — re-entrada de jogadores substituídos bloqueada

- Bug reportado: jogadores já substituídos reapareciam na lista de quem pode entrar em campo. Quatro causas:
  1. **Pausa a meio do jogo (user_substitution):** após confirmar uma troca, o jogador que saía ficava "Suplente" nas posições locais → voltava ao banco e era re-selecionável (a guarda `alreadyUsed` só valia no intervalo). Agora: o banco da pausa exclui `subbedOut` (`IntervencaoView.jsx`); `handleConfirmSub` bloqueia alvo em `subbedOut` ou já "entra" de outra troca pendente; o lote no servidor valida `playerIn` (tem de ser Suplente da tática, não em campo — incluindo trocas já aplicadas no mesmo lote — e nunca ter saído na partida).
  2. **Reposições automáticas (lesão/vermelho ao GR/GR improvisado por timeout/fallback) nunca chegavam ao cliente** — `matchActionResolved` agora inclui a `choice` aplicada e o cliente sincroniza `positions`/`subbedOut`/`subsMade` quando `source === "auto"` (dedup por `actionId` contra resolve próprio). Subs resolvidas pelo utilizador passam também a contar em `subbedOut`/`subsMade` (lesão consome uma das 3; vermelho ao GR é paragem → não consome).
  3. **Vermelho ao GR:** `availableBench`/`grCandidates` sem filtro `_subbedOut` — com tática sem labels "Suplente" um já-saído podia voltar (também via fallback) → filtro adicionado; o `benchList` do GR improvisado (lesão com limite esgotado) ficou igualmente filtrado.
  4. **`applyHalftimeSubs`** sem filtro `_subbedOut` em `toAddIds` (o `applyETSubs` tinha) → adicionado.
- Servidor continua a ser a fonte da verdade (`_subbedOut`/`_subCountByTeam` no fixture); re-entrada impossível na UI e na aplicação.
- Checks: server typecheck OK; client lint + check:types OK; `audit:gamestate 445WU8` 0 erros; `audit:socketio` 0 erros.
- Nota: a maior parte das alterações foi levada pelo commit paralelo `3407b2c` (tema finanças, feito a meio do trabalho); só o ajuste final `markSubbedOut` em `useSocketListeners.js` fica no commit próprio.


## Sequência central dos modais pós-jogo

- Os modais pós-jogo (mood, surpresas da Taça, avisos de direção, despedimentos, propostas) eram estados independentes preenchidos por eventos socket → podiam abrir empilhados (z-index só ordenava, não impedia sobreposição).
- Novo `client/src/utils/postMatchFlow.js` (`computePostMatchFlow`) = fonte única de verdade da ordem: **penalties → mood → cup upset → avisos/renovações → seasonEnd** (seasonEnd POR ÚLTIMO). Devolve booleans; o `GameLayout` passa `null` ao modal de menor prioridade enquanto um maior estiver presente — os dados ficam guardados e revelam quando o atual fecha (onClose/acks intactos).
- `CupUpsetModal` mantém auto-gate contra o mood; aqui recebe dados via `showCupRoundResults` (bloqueado nas fases penalties/mood) e ganhou `onDismiss` — o `GameLayout` guarda `cupUpsetAckKey` e passa `cupUpsetPending` para o sequenciador saber quando a surpresa da ronda já não bloqueia os avisos/fim de época.
- Armadilha: `jobOffer` sem expiração no servidor → seguro atrasá-lo; `seasonEndModal` é terminal (reload no fecho) mas só aparece quando nada mais está pendente.
- Checks: client lint + check:types OK. Não é mudança estrutural de layout → sem mobile-resp-check. Verificar ordem em runtime num jogo real (não reproduzível aqui).

## Histórico de Transferências no Mercado (novo)

- Painel **"Histórico de Transferências"** no `TransferHub.jsx` (Mercado) lista os negócios concluídos da **época atual**, de **todos os clubes** — origem → destino (brasão + nome), jogador clicável (abre página do jogador) e valor; estilo de leitura rápida (sem cards), análogo aos "Recentes" dos leilões.
- **Backend:** tabela `transfer_history` (definida em `server/db/schema.sql` + criação idempotente por sala em `gameManager.ts` + migração one-time em `index.ts`); helper `recordTransfer` (`server/coreHelpers.ts`) chamado nos 4 pontos de conclusão (`buyPlayer` fixo, aceitação de cláusula/proposta, compra NPC, venda em leilão) — nunca interfere com a transação (fire-and-forget); socket `getTransferHistory` (época `game.year`, `ORDER BY id DESC LIMIT 40`) + broadcast `transferCompleted`.
- **Frontend:** estado `transferHistory` em `GameContext` (setter no handlers object + reset em `resetGameState`), listeners `transferHistory`/`transferCompleted` em `useSocketListeners.js`, pedido `getTransferHistory` no evento `gameState` (join/reconnect).
- **Armadilha:** o payload do broadcast `transferCompleted` é **snake_case** — a mesma forma das linhas DB devolvidas por `getTransferHistory` — para o cliente tratar uma única forma (não usar camelCase no emit).
- **Fix pré-existente incluído:** a falha de 320px do harness `transfer-resp-test` (header do `MarketCard` com muitos selos a estourar `overflow-hidden`) era baseline; resolvida com `flex-wrap` no header.
- Checks: server typecheck OK; client lint + check:types OK; portrait 140/140 PASS; landscape 168/168 PASS; `audit:socketio` 0 erros.

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
