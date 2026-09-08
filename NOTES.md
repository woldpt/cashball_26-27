# NOTES.md — Estado corrente do projeto

> **Regra (1 ficheiro, nunca um por sessão):**
> - Atualizar no fim de cada tarefa/funcionalidade — e antes de fechar a sessão.
> - Bullets curtos em pt-PT. Blocos antigos (> ~2 semanas) já refletidos em commits: apagar.
> - Regra permanente descoberta → mover para `AGENTS.md`/`CLAUDE.md`/`STYLE.md` e remover daqui.
> - Ao iniciar uma sessão nova: ler este ficheiro + `git log --oneline -10`.

## Adeptos dinâmicos: fans_mood + assistências vivas (novo)

- **Modelo**: `teams.fans_mood` (0–100, default 60) e `teams.ticket_price` (tiers 10/15/20/25/30, default 15) — schema + seed (defaults) + migração `gameManager.ts` (verificado numa cópia de sala antiga: 60 equipas a 60/15). Selects usam `SELECT *` + fallback para tolerar DBs sem as colunas.
- **Mood pós-jogo** (`engine.ts`, dentro de `applyPostMatchQualityEvolution`, logo após a moral — corre na liga E na Taça): decaimento para base de fidelidade por divisão (65/60/55/50/45) + delta com contexto (casa/fora, margem ±2/golo teto ±6, upset +4, vergonha −5, derrota esperada +5, ×2 dérbi mesma divisão, ×ronda Taça até 1.8). Bloco em try/catch próprio para nunca partir a evolução.
- **Assistência** (`coreHelpers.computeAttendance`): entusiasmo = mood 45% + forma com recência 35% + posição 20% sobre chão de fiéis por divisão (35/30/25/22/20%); bónus com teto (dérbi +12%, visita do líder, título, qualidade do adversário, goleada em casa); multiplicadores Taça (R1 0.85→R5 1.25), meteo determinística, preço (`1 − (preço−15)×0.014`); choques com RNG por jogo (jitter ±10%, noite mágica 5%, deserção 12% se mood≤25 e 3+ sem ganhar). `avg_attendance` deixou de ser piso — crises esvaziam mesmo. `calculateMatchAttendance` (número) e `explainAttendance` (número + ocupação + motivos pt-PT) partilham a semente.
- **Bónus casa** (`matchCalculations.crowdFactorForOccupancy` + 5.º param de `computeSidePower`): ocupação ≥90% → +4% ataque/+2% defesa; <40% → −3% ataque; resto neutro. Engine passa `fixture._occupancy` (fixada no `runMatchSegment`, que agora usa `explainAttendance` e guarda `_occupancy`/`_ticketPrice`); `refreshPowerIfDirty` preserva o fator. Fora sempre neutro.
- **Bilheteira**: receita = assistência × preço real (liga em `weeklyFlowHelpers`, Taça em `cupFlowHelpers`); socket `setTicketPrice` (`socketFinanceHandlers.ts` + `socketEventRegistry.json`); `capacityRevPerGame` no GameContext passou a preço real.
- **UI**: `StadiumTab` com termómetro de mood (etiquetas novas `getFansMoodLabel`: Furiosos→Em Êxtase) + seletor de 5 preços + receita/obra ao preço real; `MatchBriefing StadiumCard` com ambiente (Vulcão/Morgue) + até 2 motivos.
- **Testes**: `test:attendance` reescrito (7 cenários: gala, crise 2500–4500, preço, dérbi, determinismo, Taça, cap div5) + novo `test:fansmood` (8 asserts, deltas manuais confirmados) + U4b no `test:engine-unit` (vulcão/morgue/neutro). `crashRecoveryRegression` ganhou mock de `explainAttendance`.
- **Armadilhas**: tabelas de 1 equipa davam sempre "visita do líder" — guard `oppSorted.length > 2`; `edit` do pi falhou 2× com erro de serialização (contornado com python); `audit:socketio` regenera o registry (manter a entrada `setTicketPrice`); sala FHAPAM tem erro pré-existente `POOL_SAMPLING` (60 equipas, alheio).
- **Checks**: server `typecheck` OK; `test:attendance` + `test:fansmood` + `test:morale` + `test:engine-unit` (19 pass) OK; `audit:socketio` 0 erros; `audit:gamestate FHAPAM` só erro pré-existente; client `lint` + `check:types` OK; mobile portrait 140/140 + landscape 168/168 PASS.

## Moral por palavras com humor (novo)

- Novo helper `client/src/utils/morale.js` (`getMoraleLabel`): escala única 0–100 — Na Lama / De Rasto / Razoável / Animados / Bom / Em Chamas / Excelente. Cores da barra/texto inalteradas.
- `TacticsView.jsx` (mobile + desktop), `ClubTab.jsx` (etiqueta em maiúsculas) e `MatchBriefing.jsx` (tile comparativo passa a palavras, com `title` do valor numérico) usam o helper; número visível removido.
- Checks: client `lint` + `check:types` OK. Só texto/`className` pontual → sem mobile-resp-check.

## LiveMatchHero — cronómetro sob o marcador (novo)

- Barra de progresso removida da zona do comentário e colocada logo abaixo do scoreboard; labels `0'`/`90'`/`120'` e relógio `{liveMinute}'` eliminados (o minuto continua no botão do marcador).
- Barra embelezada: mais alta (`h-2`), preenchimento em gradiente primary→emerald com glow, verniz subtil e dots de eventos com rebordo e halo.
- Checks: client `lint` + `check:types` OK.

## Presença + convites de sala nas cartas multiplayer (novo)

- Nas cartas de "Continuar" (`RoomSelectScreen.jsx`) de uma sala **multiplayer tua**, cada colega (`save.coaches`) mostra agora o estado em tempo real: **Em jogo aqui** / **Em CODE** (noutra sala) / **Ausente**; se estiver noutra sala, botão **Convidar**.
- Transporte = presença real (escolha Q4): novo canal Socket.io `__presence__`. `emitGlobalPlayerUpdate` (index.ts) emite para `__global__` **e** `__presence__`; handlers novos `presenceSubscribe` (devolve snapshot `globalPlayersUpdate` + junta `__presence__`) / `presenceUnsubscribe`. No pré-jogo o socket não está ligado a sala nenhuma — presença = coaches com `socketId` nos `activeGames`.
- Convite: emissor (escolha de salas) envia `sendRoomInvite {name, token, roomCode, roomName, toCoach}` (valida sessão + ser membro + alvo membro e online e noutra sala; rate-limit por nome/IP); servidor procura o socket do alvo (`findOnlineCoachSocket` em index.ts) e faz `io.to(socketId).emit("roomInvite")`. Resposta `respondRoomInvite {inviteId, accepted}` volta ao emissor via `roomInviteResult`; mapa pendente em memória `pendingRoomInvites`.
- Destinatário (dentro do jogo): `useSocketListeners` ouve `roomInvite` → `pendingRoomInvite` (GameContext) → **`InviteRoomModal.jsx`** (novo, Aceitar/Recusar). Aceitar reutiliza o join do cliente: emite `respondRoomInvite accepted` e chama `switchToRoom` (App.jsx) = `leaveRoom`+`joinGame`, igual ao `handleJoin`.
- Armadilhas: `RoomSelectScreen` só ouve presença/convite quando `joinMode === "saved-game"`; cleanup desinscreve (`presenceUnsubscribe`) e limpa estado. Botão de convite tem `e.stopPropagation()` para não selecionar a carta. `busy` esconde o botão durante sent/accepted/declined (auto-limpa ~6–8 s). GameContext re-expõe `pendingRoomInvite`/`onAcceptRoomInvite` (prop `onAcceptRoomInvite` vem de App).
- NOTA: o estado de presença parte de `playersByName[].socketId` — "online" aqui = ligado a uma sala concreta; quem está na escolha de salas (me null) não aparece.
- Checks: server `typecheck`+`build` OK; `audit:socketio` 0 erros; client `lint`+`check:types` OK; portrait `test:mobile` 140/140 e landscape `test:mobile:landscape` 168/168 PASS. Falta teste E2E com 2 sockets reais (hard de automatizar).

## Efeitos visuais: golos ao vivo + cena de troféu (novo)

- **`GoalFlashOverlay`** (`client/src/components/match/shared/GoalFlashOverlay.jsx`, novo): overlay efémero (~2 s) DE PÁGINA INTEIRA quando um golo é revelado em direto no teu jogo. Reutiliza `CelebrationBurst` e o sinal `goalFlashRef` do `GameContext` (timestamp por fixture+lado, só atualizado durante `isPlayingMatch`) — o MESMO que já fazia o flash vermelho dos números. Marca TU → confete + "GOLO!" com glow na cor da equipa; golo adversário (e és participante) → flash sóbrio + shake, sem festejo. Renderiza via `createPortal` para o `<body>` como `fixed inset-0 z-[200]` — o `LiveMatchHero` tem `overflow-hidden`, que encerraria o festejo ao card. GPU-only, `pointer-events-none`, auto-dismiss, `prefers-reduced-motion` respeitado (framer). Armadilha: importar `CelebrationBurst` a partir de `match/shared/` é `../../shared/CelebrationBurst.jsx` (subir DOIS níveis), não `./`. Outra armadilha: com a simulação em direto rápida, o 2.º golo chegava com o overlay do 1.º ainda montado — os containers framer terminam em `opacity:0` e não recomeçam, deixando os golos seguintes invisíveis (só o número piscava). Corrigido pondo `key={`${moment.side}-${moment.ts}`}` no root do overlay, para cada golo remontar a árvore inteira e recomeçar as animações.
- **Pop do marcador:** dígitos do `MatchScoreboard` re-montam via `key` e disparam a animação CSS `score-pop` (`index.css`, guardada por `@media (prefers-reduced-motion: no-preference)`).
- **Cena de troféu:** `SeasonEndModal` ganha um bloco "levantar troféu 🏆" (confete `CelebrationBurst` + glow âmbar) antes dos prémios, quando a tua equipa é campeã da divisão (`divisionChampions`) ou vencedora da Taça (`cupWinner`) — `showTitleLift`.
- Checks: client lint + `check:types` OK; portrait `test:mobile` 140/140 PASS; landscape `test:mobile:landscape` 168/168 PASS. (Sem server typecheck: só alterações visuais no client, nenhuma lógica de jogo/comunicações tocada.)

## Mood pós-jogo com variações por contexto (novo)

- O `PostMatchMoodModal` só variava por resultado (vitória/derrota/empate). Agora diferencia pelo **contexto do adversário**: na Liga, perder com o líder = "Derrota Esperada" (respeito, sem vaia) e perder com o último classificado = "Derrota Vergonhosa" (furiosos); na Taça, perder com equipa de escalão superior (divisão menor) = derrota esperada (sem vaia); vencer um gigante/escalão superior = "Vitória Épica". Também `draw_honorable`/`draw_bitter`.
- **`client/src/utils/moodVariant.js`** (novo, função pura `computeMoodVariant`): recebe `outcome`, `source`, `myDivision`, `opponentDivision`, `opponentRank`, `opponentTeamCount` → devolve a variante. Liga usa posição na divisão (top = rank 1-2, bottom = rank ≥ total-1); Taça usa `opponentDivision < myDivision` (divisão menor = escalão superior; sem empates em knockout).
- **`GameContext.jsx`** (`buildMood` no effect do modal): calcula `variant` (posição via `rankStandings` filtrado pela divisão do adversário; divisões via `teams`) e acrescenta o campo `variant` ao objeto `mood`. Campo aditivo → não quebra `postMatchFlow.js`/`CupUpsetModal` (só leem `!!postMatchMood`).
- **`PostMatchMoodModal.jsx`**: mapa `MOOD_CONFIG` por variante (title, fans, subtitle, accent, gradient, sound, celebrate, fansRepeat); fallback seguro por `outcome` se a variante for desconhecida. Subtitle agora condicional por variante (antes só em derrota).
- Armadilha: a Taça usa divisões 1-4 (divisão menor = escalão superior); o `outcome` da Taça é sempre win/loss (via `winnerId`), nunca draw.
- Checks: client lint + check:types OK. `npm run build` falha no ambiente (binding nativo `rolldown` `MODULE_NOT_FOUND`) — pré-existente, não causado por esta alteração. Sem mudança estrutural de layout (mesma estrutura flex, só conteúdo/cor/texto) → sem mobile-resp-check; nenhum harness renderiza este modal.

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
- **Exclui vendas por leilão** (`source === 'auction'`) porque essas já aparecem no separador **Leilões → Recentes**; a lista mostra apenas Mercado/cláusula/NPC (`recordTransfer` grava tudo, o filtro é só na UI). Rótulo de origem NPC mostra "Transf.".
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

- **Classificação virtual com seletor de divisão (novo):** o `LiveStandingsPanel` (coluna virtual na simulação) mostrava só a tua divisão. Agora tem um dropdown compacto no header com as divisões existentes em `teams` — abre sempre na tua por defeito (estado local, sem persistência), e nas outras divisões o destaque são os selos de treinador humano (iniciais) para seguir um amigo; "TU", cores de subida/descida e legenda seguem a divisão visível. Só tocado `LiveStandings.jsx` (`GameRoutes.jsx` já passa tudo).
  - Checks: client `lint` 0 erros + `check:types` OK. Só um controlo dentro do header existente → sem mobile-resp-check (vista ao vivo fora do harness).

- **Header refinado (novo):** novo `LiveClock.jsx` unifica as 4 variantes do relógio num só pill horizontal (`38' · 2ªP`, `max-w-[38vw]` + truncagem anti-colisão, `role="timer"` com `aria-label` por extenso). Header com gradiente da cor do clube (`color-mix` …84 % black) + sombra; `--header-h` passa a incluir `env(safe-area-inset-top)` (offsets acompanham). Chat com badge único (não-lidas vencem; senão nº de coaches) + `aria-label`/`aria-expanded`. Dropdown com `AnimatePresence` (a saída agora toca), fecho com `Escape`, `aria-haspopup`/`aria-expanded`, `role="menu/menuitem"` e linha de contexto época·jornada·sala (único sítio visível no mobile).
  - Checks: client `lint` (0 erros; 3 warnings pré-existentes em `JournalTab.jsx`) + `check:types` OK; mobile portrait 140/140 + landscape 168/168 PASS.

- **Sidebar com secções + grupos de navegação canónicos (novo):** `constants/navigation.js` (NAV_GROUPS: Clube/Gestão/Competição/Transferências; `getGroupTabs`/`getGroupTabKeys`) é agora a fonte única — desktop e fly-ups mobile derivam daqui. Desktop ganha cabeçalhos de secção discretos (divisores em modo recolhido), ordem Scout→Mercado→Leilões e Classificações antes de Calendário; indicador ativo com `ring-primary/20`; `aria-label` nos navs, `aria-current="page"` e `focus-visible`. Corrige 2 bugs de destaque mobile (Estádio/Treino não acendiam Gestão; Taça não acendia Competição). JOGAR acalmado (fora o `shimmer-sweep`, ficam halo+heartbeat+ping). Larguras em vars (`--sidebar-w`/`--sidebar-w-collapsed`, MatchPage incluído; STYLE §7 atualizado).
  - Checks: client `lint` + `check:types` OK; `test:breakpoints` OK; mobile portrait 140/140 + landscape 168/168 PASS.

- **Visual — empty states carismáticos (eixo 4, início):** componente partilhado `EmptyState.jsx` ganhou (1) aurora ténue de `primary` no topo (`.empty-aurora`, imagem radial sobre o `background-color` token — molda-se aos cantos sem `overflow-hidden`) e (2) emoji num medalhão `surface-bright` com ring sutil + brilho interno + flutuação (`.empty-float`, gated `prefers-reduced-motion`). Aplica-se a todos os ~16 consumidores sem tocar layouts/textos. Checks: lint + check:types OK; mobile portrait 140/140 e landscape 168/168. Commit `027af1c`.
  - Pendentes no eixo 4: crestes/branding e onboarding/tutorial. `IntervencaoView` tem `EmptyState` local separado — não afetado.

- **Visual — dados premium em Finanças/Estádio (eixo 3):** estendida a linguagem das barras (já boa na folha salarial) a visualização real de composição/ocupação. Só aparece com dados reais; reusa tokens/cores. Checks: lint + check:types OK; mobile portrait PASS 140/140 e landscape PASS 168/168. Commit `b8de10b`.
  - `FinancesTab`: barra segmentada de composição das receitas (Bilheteira `primary` / Patrocinadores `tertiary` / Vendas `sky`) como proporção do total, + legenda com % — no topo da lista de Receitas, quando `totalSeasonIncome > 0`.
  - `StadiumTab`: barra de progresso capacidade→máximo (com "+N obra(s) até à máxima") no painel de Expansão; e medidor de ocupação média (assistência/capacidade, colorido por grau) sob os stats.
  - Nota: Finanças já tinha gráfico avançado (`BalanceLineChart`) — não tocado. `BalanceLineChart`/`StadiumIllustration` intocados.
  - Pendentes visuais: camadas de encanto (onboarding/empty states/crests) — eixo 4 por fazer.

- **Visual — hero do jogo ao vivo mais cinematográfico ("broadcast"):** o `LiveMatchHero` já tinha scoreboard broadcast, flash de golo a ecrã inteiro (GoalFlashOverlay) e narração; o pass acrescentou drama/tensão de transmissão, tudo reversível e mobile-safe:
  - Cenografia de luz bilateral (casa à esquerda, fora à direita, a convergir no marcador) + vinheta + "luz de estádio" a subir do chão — substitui o glow único que só usava a cor da casa. Cores das equipas com fallback estável (`hCol`/`aCol`).
  - Bug "AO VIVO" vermelho pulsante (capsule red + dot `animate-pulse`) na meta strip durante `isPlayingMatch`.
  - Scoreboard: hairline `top-light` + aura de liderança — halo `boxShadow` na cor da equipa em vantagem com pulso suave (keyframe `scoreLeadGlow`, guardado por `prefers-reduced-motion`).
  - Não mexeu no GoalFlashOverlay/MatchPage/TeamCrest. Checks: lint + check:types OK; livehero 5/5, mobile portrait PASS 140/140 e landscape PASS 168/168. Commit `817d86b`.
  - Pendentes visuais (não feitos): dados premium (Finanças/Estádio); camadas de encanto (onboarding/empty states).

- **Visual — atmosfera e profundidade no interior do jogo ("alimentar os olhos"):** a landing tinha vocabulário atmosférico (`pitch-glow`, hairline de luz, glass) que estava *morto* dentro do jogo. Foi levado para o interior, token-based e reversível:
  - `index.css`: nova `.ambient` (radial glows da cor primária/terciária via `color-mix` sobre os tokens, alpha baixo) e `.top-light` (fio de 1px de luz no topo derivado de `on-surface`).
  - `GameLayout.jsx` root: ganhou `relative isolate` + primeiro filho `pointer-events-none absolute inset-0 -z-10 ambient` (fica atrás de todo o conteúdo; sem interferir nos fixed/chrome).
  - `shared/Panel.jsx` + `SummaryWidget.jsx`: `relative` + filho `.top-light` no topo — como são os contentores canónicos (STYLE §3), a elevação propaga a todos os painéis de uma vez.
  - Armadilha: adicionar `overflow-hidden` ao `SummaryWidget` clipei conteúdo legítimo que já transbordava (finances/topwidgets reprovaram no harness) — mantido só `relative`, sem `overflow-hidden`. Checks: lint + check:types OK; mobile portrait PASS 140/140 e landscape PASS 168/168. Commit `a4a8a65`.
  - Próximos passos visuais possíveis (não feitos): hero do jogo ao vivo mais cinematográfico; dados premium (Finanças/Estádio); camadas de encanto (onboarding/empty states).

- **Refactor do GameLayout — rotas e overlays extraídos (Fase D da review):** `GameLayout` deixou de ser o monolito de ~2090 linhas para ~1310 (chrome puro).
  - `client/src/GameRoutes.jsx` (novo): o switch de `activeTab` (27 páginas/views) moveu-se verbatim; consome `useGame()` sozinho (só props `handleLogout`/`setAuthPhase`/`replayTutorial`).
  - `client/src/GameOverlays.jsx` (novo): os ~20 modais de evento + MatchPage + WaitingCoaches + RoomHub + AdminPanel; consome `useGame()` e é dono da sequenciação pós-jogo (`cupUpsetAckKey` + `postMatchFlow`, que saíram do GameLayout).
  - `GameLayout` mantém Welcome + CoachTutorial (dono do tutorial) e renderiza `<GameRoutes/>` + `<GameOverlays/>`.
  - Método: JSX movido byte-idêntico via slicing; o eslint valida completude (no-undef apanha campo em falta; no-unused-vars apanha excesso) — por isso as destructures de cada ficheiro estão exatas. Checks: lint + check:types OK; mobile portrait PASS 140/140 e landscape PASS 168/168. Commits `4f48c55` (GameRoutes), `8d541d7` (GameOverlays).
  - Nota: `npm run build` está quebrado neste ambiente (binding nativo `rolldown` em falta, `MODULE_NOT_FOUND`) — pré-existente, não relacionado.


- **Responsividade mobile — fonte de verdade de breakpoints + geometria do chrome (Fase A/B de uma review do GameLayout):**
  - Fase A: criado `client/src/constants/breakpoints.js` (BREAKPOINTS md=768/lg=1024, HEIGHTS short=560/compact=520) — `hooks/useIsMobile.js` constrói os `matchMedia` a partir daqui (fim dos literais 767/768/1023/519/520). `index.css` ganhou `--breakpoint-md/-lg` explícitos. Paridade verificada por `npm run test:breakpoints` (`scripts/breakpointParityRegression.mjs`), que também falha se algum `matchMedia` do src re-embutir esses px. Commit `477f91e`.
  - Fase B: geometria do shell centralizada em vars de `index.css`: `--header-h` (3.5rem; 2.5rem em telemóvel landscape via `@media (orientation:landscape) and (max-width:1023px)`) e `--rail-w` (4rem). `GameLayout.jsx` (header, rail, reservas `pt-`/`ml-` do `<main>`), `RoomHub.jsx` (`top-14`) e o container de toasts (`top-16`) passam a referenciar as vars — mudar a altura do header já não obriga a caçar offsets. MatchPage ficou intacto (o `lg:left-64/14` segue a largura da sidebar, não o header). Checks: lint + check:types OK; mobile portrait PASS 140/140 e landscape PASS 168/168. Commit `3c6ca6c`.
  - Pendente da review (Fases C/D, não executadas): arquitetura do contexto (split do GameContext / seletores) e redução do monólito GameLayout (extrair routing de páginas e orquestração de modais).
  - Follow-up (audit 22:10): o script de paridade excluía `useIsMobile.js` da verificação de literais — removida a exceção (só `constants/breakpoints.js` é ignorado); verificado com teste negativo (literal 767px injetado falha como esperado).


- **Timeout do ET gate da Taça removido:** o ecrã de intervalo aos 90' (`match_et_gate`, evento `cupETHalfTime`) tinha um fallback de 90s (`game._etGateTimer` em `finalizeCupRound`, `cupFlowHelpers.ts`) que forçava o prolongamento se o coach não premir Ready — removido; o gate agora aguarda indefinidamente. Segurança mantida: coach desliga → `checkAllReady` (só coaches conectados em jogo empatado) deixa o avanço em curso; crash/restart → `gameManager` trata `match_et_gate` como transitório (reset p/ `lobby`). O `cupETAnimGate` (45s, ack da animação `cupExtraTimeStart`) é de outra fase — intacto. Check: server typecheck OK.

- **Finanças — desktop demasiado grande (ajustado):** no hero, valores `lg:text-4xl`→`lg:text-3xl` e ícones de marca de água `text-8xl`→`text-6xl`; o `BalanceLineChart` (viewBox 640×210, `w-full h-auto`) esticava à largura total do painel no desktop (~490px de altura) — agora envolto em `mx-auto max-w-3xl` (centrado, ~252px de altura). Só tocou em classes `sm:`/`md:`/`lg:` + cap >768px → mobile portrait/landscape intacto (sem mobile-resp-check).

- **Join "A entrar na sala..." já não fica bloqueado para sempre:** o `handleJoinSuccess` limpava o timer de segurança de 10s; se o `teamAssigned` se perdesse nesse intervalo (socket cai/reconecta), não havia timeout, erro nem retry — só o refresh resolvia (auto-join com a sessão guardada). Agora: `armJoinTimeout()` (App.jsx) re-arma o timer após o `joinGameSuccess`, e o `onConnect` do `useSocketListeners` re-joina também no estado "à espera do teamAssigned" (`roomCode` definido, sem `teamId`) — o servidor re-emite o `teamAssigned`. Checks: lint + check:types OK.
- **CupUpsetModal sequenciado com PostMatchMoodModal:** sem auto-fecho (só botão "Continuar"); a revelação agora aguarda `postMatchMood === null` (gate nas deps do effect, timer de 250 ms rearmado) — modais já não sobrepõem. Se o jogo do utilizador não foi dessa ronda (sem mood modal), a surpresa revela diretamente.
- **Mentalidade alterável a meio do jogo:** o engine já adotava `setTactic` ao vivo (`applyLiveTacticAdoption` em `engine.ts`, efeito no minuto seguinte + evento `tactic_change` na cronologia) — a restrição era só UI. `IntervencaoView.jsx`: `MentalidadeColumn` (desktop) já sem gate de `isHalftime`; mobile vertical mostra o bloco recolhível também em modo `action`; landscape phone ganhou o chip "Mentalidade" na barra minimalista do topo (abre a linha de botões de estilo). Mobile-resp-check: portrait + landscape PASS (harness `intervencao-test`).
- **Penalti falhado na vista ao vivo:** o engine já emite `penalty_miss` (e a timeline/narração já o tratavam), mas a lista de eventos das colunas por equipa no `LiveMatchHero` filtrava-o fora. Adicionado `"penalty_miss"` aos filtros `homeEvents`/`awayEvents` + cor âmbar em `TeamEvents` + ícone `❌` em `matchEventIcon` (`liveHelpers.js`).
- **Compra de NPCs no Mercado (lote semanal):** `processNpcTransferActivity` (`server/npcTransferHelpers.ts`) só comprava com probabilidades baixas (40% por equipa / 55% por jogador) e tecto de 55% do orçamento — parecia que os NPCs só compravam em leilões (que são reativos). Ajustado para 65% / 75% e tecto de 70%.
- Nota: o Mercado só tem oferta via listagens "fixed" (humanos) ou excedentes listados pelos próprios NPCs; nas salas ativas o mercado estava vazio (`transfer_status='none'` em todos).

## Próximos passos

- Push de `d0c24d2` (crest nos icones + nomes legíveis no popup do sorteio da Taça) — só com pedido explícito do utilizador.

## Próximo trabalho dedicado: Fase C (arquitetura de contexto — NÃO feito, adiado)

Decisão: adiada para sessão dedicada com backend ativo + medição real de re-renders (React DevTools), porque:
  - `npm run build` está quebrado neste ambiente (binding nativo `rolldown` em falta, `MODULE_NOT_FOUND`) — sem full compile além de eslint/type.
  - o harness mobile NÃO cobre as rotas de jogo ao vivo/chat → um refactor profundo não é verificável aqui.
  - o alvo de perf (chat/toasts a re-renderizar o `MatchPage` ao vivo) é de ganho provavelmente pequeno: o servidor já re-renderiza `GameContext` constantemente durante o jogo (minuto, narração, eventos).

Plano C1+C2 (quando fizer):
  - **C1 — `UIContext`:** criar `client/src/contexts/UIContext.jsx` (UIProvider) e tirar do `GameContext` o estado efémero de shell. *Gatilho central:* os setters de chat/toasts vivem em listeners de socket dentro do `GameProvider` (misturados com dados de jogo num efeito gigante) → movê-los exige extrair essa lógica de socket e religar as transições (incl. `resetGameState` que limpa chat/unread).
  - **C2 — memoização:** como `GameLayout` é compositor único e ancestral de todo o conteúdo, mover estado de UI só reduz re-renders se a árvore pesada (rotas + `MatchPage`) for memoizada a consumir só dados — o split sozinho quase não ajuda (pai re-renderiza filhos).
  - Estados candidatos a mover: `toasts`/`addToast`/`dismissToast`, `roomMessages`/`globalMessages`/`globalPlayers`/`unreadRoom`/`unreadGlobal`/`chatInput`, `activeTab`/`navigateTab`, `mobileSubMenu`, `sidebarCollapsed`, `userDropdownOpen`, `roomHubOpen`, `avatarSeed`/`coachAvatars`.
  - Consumidores atuais (para atualizar): toasts em ~6 ficheiros; chat/unread em `GameContext` + `RoomHub` + header; `activeTab` em GameLayout/GameRoutes/TacticsContext/TacticsView/TeamSquadModal/TeamSquadView; `navigateTab` só GameLayout/GameRoutes/Tutorial.
  - Ordem: UIProvider à volta do GameProvider no App; mover primeiro os estados set por cliques (activeTab/nav/sidebar/dropdown — seguros), depois chat/toasts (com religação de socket). Validar em jogo ao vivo real antes de afirmar ganho.
