# Plano — Race conditions no flow do jogo (janelas × modais)

> Origem: auditoria de 2026-10-07 (corridas C1–C23). Executar por fases, **um
> commit por fase** (só os ficheiros tocados, sem push). pt-PT em tudo
> (mensagens, comentários). Fase a fase: ler o código real antes de editar —
> as linhas abaixo são referência, podem ter deslizado.

## Regras para quem executa

- **Âmbito fechado:** só o que está aqui. Algo fora do plano → parar e reportar.
- **Mínimo que funciona:** sem abstrações novas além das listadas; reutilizar
  helpers existentes (`serializeRoomTask`, `isMatchInProgress`, `resetAllReady`,
  `clearSeatPositions`, `currentSlot`, `upcomingMatchweek`).
- **Verificação por fase** (obrigatória antes do commit, saída verificada):
  - server: `cd server && npm run typecheck`
  - tocou em `server/index.ts` → `npm run test:connect-smoke`
  - novo evento socket → `npm run audit:socketio` (regenera `socketEventRegistry.json`)
  - client: `cd client && npm run lint && npm run check:types`
  - testes da fase (indicados em cada uma)
- Se um teste existente falhar e não for por causa da fase → **não corrigir**,
  reportar com a saída.
- Mensagem de commit no estilo do repo (`fix(flow): …`), foco no porquê.
- No fim: apontamento em `NOTES.md` (máx. 5 linhas, regras do `AGENTS.md`).

---

## Fase 1 — Transações SQLite sem colisões (C1, C2) · ALTA

Problema: a sala usa uma única ligação SQLite; transações concorrentes
interferem. Um `BEGIN` falhado dentro de `try` faz `ROLLBACK` da transação
**de outro** fluxo. Na Taça/amigável o `BEGIN`/`COMMIT` ignoram erro.

**1a. `BEGIN` fora do `try`** (um `BEGIN` falhado nunca faz `ROLLBACK`):
- `server/socketFinanceHandlers.ts` (`buildStadium`, ~l.61): mover
  `await runExec(game.db, "BEGIN")` para antes do `try`, com o seu próprio
  `try/catch` que só emite "Erro ao construir estádio." e `return` (sem ROLLBACK).
- `server/staffHelpers.ts` `hireStaff` (~l.254) e `fireStaff` (~l.316): idem;
  falha do `BEGIN` → `return { ok: false, error: "db" }` sem ROLLBACK.
- Grep por `BEGIN` em `server/*.ts` e confirmar que nenhum outro sítio tem o
  `BEGIN` dentro de um `try` cujo `catch` faz `ROLLBACK`; corrigir os que houver.

**1b. Taça/amigável rejeitam erro de `BEGIN`/`COMMIT`:**
- `server/cupFlowHelpers.ts` ~l.1974 (`commitCupRoundResults`), ~l.2743 e
  ~l.2760 (`finalizeFriendly`): trocar
  `new Promise((resolve) => game.db.run("BEGIN TRANSACTION", () => resolve()))`
  por `await dbRunOn(game, "BEGIN TRANSACTION")` (já existe, rejeita no erro);
  idem para o `COMMIT`. Garantir que a falha cai no caminho de falha existente
  (Taça: `return null`; amigável: ver Fase 3).

**1c. Fila de transações por sala:**
- `server/coreHelpers.ts`: acrescentar ao lado de `serializeRoomTask`
  `runRoomTask<T>(roomCode, task: () => Promise<T>): Promise<T>` — mesma cadeia
  `roomTaskChains` (a fila é partilhada), devolve o resultado/erro ao chamador
  e nunca parte a fila. Reescrever `serializeRoomTask` por cima dela
  (`void runRoomTask(...).catch(log)`), sem mudar comportamento.
- Envolver em `runRoomTask` **apenas o bloco `BEGIN … COMMIT/ROLLBACK`** (nunca
  código que chame outra função envolvida → deadlock; nunca `waitForPresence`
  lá dentro):
  - `weeklyFlowHelpers.ts`: `applyWeeklyFinancesOnce` (do `BEGIN` ao `COMMIT`),
    `finalizeLeagueEvent` (do `BEGIN` ao `COMMIT`; o pós-COMMIT fica fora);
  - `cupFlowHelpers.ts`: `commitCupRoundResults`, transação de
    `finalizeFriendly`, `applyPromotionsAndRelegations`, `resetPlayerSeasonStats`;
  - `socketTransferHandlers.ts`: `buyPlayer`, `makeTransferProposal`;
  - `socketFinanceHandlers.ts`: `buildStadium`; `staffHelpers.ts`: `hireStaff`,
    `fireStaff` (o `ensureNpcStaff` chama `hireStaff` — **não** envolver o
    `ensureNpcStaff`);
  - `socketSessionHandlers.ts`: `chooseSponsor`;
  - `auctionHelpers.ts` `finalizeAuction` e o fecho inline em `gameManager.ts`
    já usam `serializeRoomTask` → ficam na mesma fila automaticamente.
  - Atenção ao `finalizeLeagueEvent`: o `COMMIT` é feito por callback
    (`game.db.run("COMMIT", async (err) => …)`); passar a `await dbRun(...COMMIT)`
    dentro da tarefa e continuar o pós-COMMIT fora dela, mantendo a ordem atual.
- Teste novo `server/scripts/roomTxRegression.mts` (`tsx --test`, script npm
  `test:room-tx`), sqlite3 em memória:
  1. duas tarefas `runRoomTask` com `BEGIN`/awaits/`COMMIT` lançadas em
     paralelo → ambas comitam, sem `SQLITE_ERROR`;
  2. uma tarefa que rejeita não parte a fila (a seguinte corre) e o erro chega
     ao chamador;
  3. padrão 1a: com uma transação aberta por outra tarefa, um `BEGIN` falhado
     não fecha essa transação (`db` continua em transação até ao COMMIT dela).

Verificação: typecheck, `test:room-tx`, `test:crash-recovery`, `test:staff`,
`test:sponsor`, `test:connect-smoke`.

---

## Fase 2 — Guardas de fase nas ações de modal (C3, C9, C15, C6) · ALTA/MÉDIA

- `socketTransferHandlers.ts` `makeTransferProposal` (~l.701): no início,
  `if (isMatchInProgress(game))` → `transferProposalResult { ok:false,
  message:"Não é possível fazer propostas durante uma partida." }`.
- `socketGameplayHandlers.ts` `acceptJobOffer` (~l.488): mesma guarda →
  `systemMessage` "Responde ao convite depois do jogo."
- `coachDismissalHelpers.ts` `MATCH_RUNNING_PHASES` (~l.1250): acrescentar
  `"match_finalizing"`.
- `auctionHelpers.ts` `runFinalizeAuction` (~l.262): no topo,
  `if (auction.status !== "open" || isMatchInProgress(game)) return;` (a pausa/
  retoma volta a armar). No rearm do `finalizeAuction` (~l.251) só rearmar se
  `status === "open"`.
- **Janela de fim de época (C6):** `matchFlowHelpers.ts` `isMatchInProgress`
  passa a devolver `true` também quando
  `game.calendarIndex >= SEASON_CALENDAR.length` (fim de época a correr). Rever
  as mensagens que dizem "durante uma partida" — aceitável; não criar outras.
- Cliente `client/src/contexts/GameContext.jsx`, efeito de `isPlayingMatch`
  (~l.385): quando passa a `true`, também `setTransferProposalModal(null)`.

Verificação: typecheck, lint/check:types, `test:session-freeze`.

---

## Fase 3 — Falha do fecho nunca repete o jogo (C4, C19, C18) · ALTA

- `weeklyFlowHelpers.ts`: função local `revertWeekToLobby(game)` que espelha o
  caminho de falha da Taça (`cupFlowHelpers.ts` ~l.2502-2510):
  `gamePhase="lobby"`, `currentFixtures=[]`, `lastHalftimePayload=null`,
  `resetAllReady`, `clearSeatPositions`, `emitPresence`, `saveGameState`.
  Usar nos dois caminhos de erro de `finalizeLeagueEvent` (~l.1343-1359) e no
  watchdog de `match_finalizing` (~l.1105-1120, mantendo
  `segmentRunning=false`).
- `cupFlowHelpers.ts` `finalizeFriendly` (~l.2768): em `friendlyTxFailed`, em vez
  de `return` com a fase presa, fazer o mesmo revert (extrair o bloco de falha
  de `continueFromEtGate` para `revertRoundToLobby(game)` e usá-lo nos dois).
- Resultado esperado: falha de transação → lobby do **mesmo** slot, sem Prontos,
  fixtures regeneradas no próximo arranque (rejoga do 0, como no crash).
- Teste: acrescentar um passo ao `crashRecoveryRegression.mts` (ou teste curto
  novo) que força a falha (ex.: `BEGIN` já aberto na `game.db` antes do fecho)
  e verifica fase `lobby`, `currentFixtures` vazio e nenhum assento pronto.

Verificação: typecheck, `test:crash-recovery`, `test:finalize` (E2E longo — no
fim da fase).

---

## Fase 4 — Fim de época recuperável e idempotente (C5) · ALTA

- `cupFlowHelpers.ts`: helper `seasonStepOnce(game, kind, fn)` — lê
  `applied_weeks (season, slot = SEASON_CALENDAR.length, kind)`; se existir,
  salta; senão corre `fn` e insere o marcador (`INSERT OR IGNORE`). Nos passos
  com transação própria (`applyPromotionsAndRelegations`,
  `resetPlayerSeasonStats`) inserir o marcador **dentro** da transação. Nos
  outros, depois (`// ponytail: marcador pós-passo, janela de crash entre o passo e o marcador`).
- Passos marcados em `applySeasonEnd` (~l.974): `last_season_rank` (idempotente,
  pode ficar sem marcador), `payChampionPrizes`, `paySponsorRevenue`,
  `payTopScorerPrize`, `applyPromotionsAndRelegations`, `evolveFanbase`,
  `persistAvgAttendance`, `resetPlayerSeasonStats` (inclui o decay).
  Passos cujo resultado é usado depois (`payChampionPrizes` → `iLigaWinner`,
  `payTopScorerPrize` → `topScorers`, `applyPromotionsAndRelegations` →
  `promotions`/`relegatedFromDiv4`): gravar o resultado em JSON na tabela
  `game_state` (chave `seasonEnd:<kind>`) junto com o marcador e, ao saltar o
  passo, ler daí. O `byDiv` (classificação) tem de ser lido **antes** do reset
  de pontos — se o reset já correu, usar o JSON gravado.
- Single-flight: `game._seasonEndRunning` (memória) em `applySeasonEnd`; segunda
  chamada concorrente → `return`.
- Recuperação: `weeklyFlowHelpers.ts` `checkAllReady`, ramo `!entry` (~l.2228):
  se `game.calendarIndex >= SEASON_CALENDAR.length` → correr `applySeasonEnd`
  + `refreshMarket` + `seasonState` (como `recoverFinalizedSlot` ~l.2112) em vez
  de só `return`. Também disparar isto no load da sala em `gameManager.ts`
  quando o estado carregado tem `calendarIndex >= length`.
- Reset de `last_auctioned_matchweek = 0` no `UPDATE players` de
  `resetPlayerSeasonStats` (bug lateral: leilões bloqueados na época nova).
- Teste: passo novo no `crashRecoveryRegression.mts`: sala com
  `calendarIndex = SEASON_CALENDAR.length` em lobby → `checkAllReady` → época
  +1, índice 0; correr `applySeasonEnd` duas vezes (simulando quebra após os
  prémios) não paga os prémios em dobro (orçamento do campeão igual).

Verificação: typecheck, `test:crash-recovery`, `test:topscorer`,
`test:relegation-coach`, `test:sponsor`.

---

## Fase 5 — Prontidão e barreira do 11 (C7, C8, C12, C13, C14) · MÉDIA-ALTA

- **C7** `socketGameplayHandlers.ts` `setReady` (~l.145): a barreira aplica-se
  também quando não há fixtures e o evento atual é liga (todas as equipas
  jogam): `isLobbyStarter(fixtures, teamId) || (currentEvent?.type === "league"
  && !fixtures?.length)`.
- **C8** `roomStateHelpers.ts` `setSeatTeamId` (~l.277): **só quando o `teamId`
  muda**, `seat.intent.ready=false`, `seat.intent.positions={}` e na projeção
  (`game.playersByName[name]`) `ready=false` e `tactic.positions={}`. (O join
  chama com a mesma equipa — não pode limpar.) Confirmar os 3 chamadores.
- **C12** helper `unreadyTeam(game, teamId)` em `roomStateHelpers.ts`: se um
  assento membro dessa equipa estiver pronto e a fase for `lobby` → `ready=false`
  (assento + projeção, persistir). Chamar quando um jogador **sai** de uma
  equipa humana: `buyPlayer` (vendedor) e `runFinalizeAuction`
  (`auction.sellerTeamId`), seguido de `emitPresence` e `systemMessage` ao
  vendedor "Um jogador do teu plantel saiu — confirma o Pronto outra vez."
- **C13** `setReady`: contador em memória por assento (`seat.readySeq`),
  incrementado em cada `setReady`; o callback assíncrono do `true` só aplica se
  o contador ainda for o capturado.
- **C14** `checkAllReady`: extrair o cálculo dos assentos em falta para uma
  função local e voltar a avaliá-lo no callback do `db.get` (~l.2239) antes do
  `startWeekOnce`; se já não estiver tudo pronto → `segmentRunning=false` e
  `return`.
- Testes no `sessionFreezeRegression.mts`: F16 `setSeatTeamId` com equipa nova
  limpa ready/posições e com a mesma equipa não; F17 `unreadyTeam`.

Verificação: typecheck, `test:session-freeze`, `test:coach-dismissal-league`,
`test:relegation-coach`.

---

## Fase 6 — Concorrência entre treinadores (C10, C11) · MÉDIA

- **C11** `buyPlayer` (~l.151): `UPDATE players … WHERE id = ? AND team_id IS ?
  AND transfer_status != 'none'` (com o `team_id` lido no SELECT); `changes===0`
  → `throw` → ROLLBACK + `systemMessage` "Este jogador já foi vendido."
- **C10** `handleAcceptJobOffer` e `handleSwapDismissalClub`: reserva síncrona
  `game._teamClaims` (Set em memória) antes do primeiro `await`: se o clube já
  estiver reservado ou tiver humano → recusar; `finally` liberta.

Verificação: typecheck, `test:coach-dismissal-league`.

---

## Fase 7 — `matchweek` → slot nas ações (C21) · MÉDIA

Trocar `game.matchweek` por `currentSlot(game)` em `joined_matchweek` e
`transfer_cooldown_until_matchweek` (igual ao `buyPlayer`):
- `auctionHelpers.ts` ~l.431-433; fecho inline em `gameManager.ts` ~l.788-790;
- `socketTransferHandlers.ts` ~l.401 e ~l.576 (`joined_matchweek`);
- `npcTransferHelpers.ts` ~l.118-121; `contractHelpers.ts` ~l.388-392 e ~l.614.
- `socketGameplayHandlers.ts` `requestTeamSquad` (~l.244-247):
  `game.matchweek || 1` → `upcomingMatchweek(game)`.
- `contract_until_matchweek = getSeasonEndMatchweek(...)` fica como está.

Verificação: typecheck, `test:contractrenewal`, `test:contractyear`,
`test:training-report`.

---

## Fase 8 — Popups do servidor vs fase no cliente (C16, C17, C20, C22, C23) · MÉDIA/BAIXA

- **C16** ack do prolongamento: `socketCupHandlers.ts` `cupExtraTimeDone`
  (~l.215) — sem handler armado, guardar o `socket.id` em
  `game._cupETEarlyAcks` (Set). `cupFlowHelpers.ts`: criar o Set vazio quando
  emite `cupExtraTimeStart`; em `cupETAnimGate`, logo após armar o handler,
  re-aplicar os acks guardados e limpar o Set.
- **C17** `client/src/hooks/socket/core.js` `seasonEnd` (~l.60): o listener só
  faz `setSeasonEndModal(data)`. Os resets (`setAllMatchResults({})`,
  `setMatchweekCount(0)`, `setMatchResults(null)`, `setCalendarData(null)`)
  passam para o `onClose` do `SeasonEndModal` em `GameOverlays.jsx` (confirmar
  que os setters vêm do `useGame()`). `season`/`year` já chegam por
  `seasonState`.
- **C20** evento novo `contractOfferExpired { playerId }`: emitido em
  `acceptCounterOffer` quando não há pendente e em `renewContract` quando o
  jogador já não está no plantel. Cliente (`market.js`): se o `gameDialog`
  atual é `kind:"contract"` desse `playerId` → fechar + toast "A proposta
  expirou." Correr `audit:socketio`.
- **C22** `ctx.inRoom()` nos listeners sem guarda de `market.js` e `cup.js`.
- **C23** `cupFlowHelpers.ts` `emitSeasonEndSummary`: guardar o payload em
  `game.lastSeasonEndPayload` + `game.seasonEndSeenBy` (nomes ligados no
  emit); limpar ao avançar do índice 0 (`advanceCalendarToLobby`). Em
  `emitCurrentPhaseToSocket` (lobby): reemitir `seasonEnd` a quem ainda não
  viu e marcar como visto. Só memória (não persistir).

Verificação: typecheck, lint, check:types, `audit:socketio`,
`test:connect-smoke`.

---

## Fase 9 — Audit da sala

`server/scripts/gameStateAudit.ts`: três verificações novas —
(1) lobby com `calendarIndex >= SEASON_CALENDAR.length`; (2) jogadores com
`transfer_cooldown_until_matchweek > SEASON_WEEKS`; (3) dois assentos
`member` (`room_seats`) com o mesmo `team_id`.

Verificação: `npm run audit:gamestate <ROOM>` numa sala local existente.

---

## Fora do âmbito (deliberado)

- Reemitir `coachMarketReport` no rejoin (informativo).
- Flag de "fecho abortado" para o caso do watchdog com fecho só lento (C18 fica
  coberto pelo revert da Fase 3; o resto é raro).
- Revalidar o 11 na expiração de contratos/NPC (C12 cobre compra e leilão).
