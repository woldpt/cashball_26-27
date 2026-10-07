# Plano — Consistência de estado no frontend (GameContext ↔ servidor)

> Origem: auditoria de 2026-10-08 ao `GameContext.jsx`, `TacticsContext.jsx` e
> listeners em `client/src/hooks/socket/*.js`. Objetivo: o que o cliente mostra
> (e envia) tem de bater com o que o servidor tem.
>
> **Invariantes (não quebrar):** `buildGameStatePayload` é o payload único do
> join E do `requestResync`; ordem `mySquad` → `gameState` no join; `setReady`
> NUNCA é sticky na outbox; lances com `emitComAck` + `__actionId`; progresso da
> época por `calendarIndex` (nunca `matchweek` em lógica nova); chaves
> anti-repetição por competição (humor/apito); dreno único da Taça. Ler a secção
> de regressões proibidas do `AGENTS.md` antes de começar.
>
> **Regras de execução:** uma fase = um commit (só os ficheiros da fase; a working
> tree pode ter alterações alheias). Mensagem no estilo do repo (`fix(state): …`)
> com o porquê. Sem push. Se um passo não bater com o código (linha/forma
> diferente), adaptar ao código real; se a premissa for falsa, saltar o passo e
> registar no relatório final — nunca inventar.

## Fase 1 — "Limpar" a tática desliga a sincronização (ALTA)

**Bug:** `handleClearTactic` (`client/src/contexts/TacticsContext.jsx:~154-163`)
envia `formation: ""`. O servidor (`server/socketGameplayHandlers.ts:70-84`)
descarta qualquer `setTactic` cuja formação não esteja em `VALID_FORMATIONS`.
Todos os drags seguintes herdam `""` → nenhuma alteração do 11 chega ao servidor;
no rejoin o merge do `gameState` (`hooks/socket/session.js:117-122`) repõe o 11
antigo.

1. Criar `client/src/utils/tacticPositions.js` (puro, JSDoc) com
   `buildClearedTactic(prev, squad)` → `{ ...prev, positions: <todos "Excluído"> }`
   **mantendo `prev.formation`** (fallback `"4-4-2"` se vier vazia/inválida).
2. `handleClearTactic` passa a usar o helper.
3. `client/src/views/TacticsView.jsx:~872`: a dica "Arrasta jogadores…" passa a
   depender só de `titulares.length === 0` (o realce da formação já exige
   `titulares.length > 0`, por isso nada mais muda visualmente).
4. Teste `client/src/utils/tacticPositions.test.mjs` (padrão de
   `finalWhistle.test.mjs`, `node:assert/strict`): formação preservada; formação
   vazia → `"4-4-2"`; todas as posições `"Excluído"`; ids do plantel cobertos.
   Acrescentar script `test:tacticpositions` ao `client/package.json`.

## Fase 2 — Jogadores que saíram ficam em `tactic.positions` (MÉDIA)

**Bug:** se um titular sai do plantel (leilão, cláusula) com o 11 montado, as
contagens em `handleSetPlayerStatus` (`~346-349`, `~361-364`, `~377-379`) e
`handleDropToSection` (`~484-487`, `~517-520`) percorrem `Object.entries(positions)`
e contam o fantasma → UI mostra 10 titulares mas recusa o 11.º.

1. Em `tacticPositions.js`: `countStatus(positions, status, squadIds, excludeId)`
   — conta só ids presentes em `squadIds` (Set de `Number(id)`), excluindo
   `excludeId`.
2. No `TacticsProvider`: `const squadIds = useMemo(() => new Set(mySquad.map((p) => Number(p.id))), [mySquad])`
   e substituir as contagens de Titular/Suplente por `countStatus`. As contagens
   "por posição" (máx. 5) já resolvem via `mySquad.find` → ficam.
3. Testes no mesmo `.test.mjs`: fantasma não conta; `excludeId` respeitado.

## Fase 3 — Substituições não ressincronizam após reload ao intervalo (MÉDIA)

**Bug:** `subsMade`/`subbedOut` só existem no cliente. Reload ao intervalo → 0;
a UI deixa fazer 3 trocas, o `applyHalftimeSubs` do servidor
(`server/weeklyFlowHelpers.ts:~339-345`) aplica só as restantes, em silêncio.
Os eventos `substitution` só trazem quem entra, por isso o servidor tem de
mandar o estado.

1. Servidor: onde se constroem os fixtures do payload de intervalo
   (`halfTimeResults` ~1082 e `cupHalfTimeResults` ~1066 em `weeklyFlowHelpers.ts`;
   confirmar que `game.lastHalftimePayload` é o mesmo objeto/forma — é o que o
   `gameState` reenvia), acrescentar por fixture:
   `subsUsed: { ...(fx._subCountByTeam || {}) }` e
   `subbedOutIds: [...(fx._subbedOut || [])]` (Set → array). Não mexer nos
   eventos.
2. Cliente: em `tacticPositions.js` (ou `utils/subsState.js`)
   `subsStateFromFixture(fixture, myTeamId, mySquadIds)` →
   `{ subsMade: Number(fixture?.subsUsed?.[myTeamId] ?? 0), subbedOut: ids ∩ mySquadIds }`;
   devolve `null` se o fixture não tiver `subsUsed` (servidor antigo → não mexer).
3. `hooks/socket/match.js` handler `halfTimeResults` (~375): manter os novos
   campos no map de `results`; depois de montar, se houver o fixture da minha
   equipa (`refs.meRef.current?.teamId`, `refs.mySquadRef.current`), aplicar
   `setSubsMade`/`setSubbedOut` com o valor do servidor. Igual no ramo halftime
   do `onGameState` (`session.js:~170-175`, payload `data.lastHalfTimePayload`).
   Se o `cupHalfTimeResults`/`cupETHalfTime` (`cup.js`) mapearem fixtures,
   aplicar o mesmo.
4. Teste do helper (contagem, interseção com o plantel, `null` sem campo).
5. `cd server && npm run typecheck && npm run test:substitutions && npm run test:segment-barrier`.

## Fase 4 — Plantel chega segundos depois do avanço do calendário (MÉDIA)

**Bug:** `finalizeLeagueEvent` emite `seasonState` (calendarIndex+1, ~1448) e
`teamsData` (~1484) cedo, mas o `mySquad` só no fim da cadeia
(evolução/treino/contratos/NPCs, ~1638). Nessa janela a disponibilidade e o
auto-pick usam o plantel antigo (um expulso aparece disponível).

1. Em `weeklyFlowHelpers.ts`, extrair o bloco que lê os plantéis dos humanos
   ligados e emite `mySquad` (`emitSquadsAndFinish` + query, ~1617-1675) para uma
   função local `emitHumanSquads(game): Promise<void>` (sem `resolveOuter`
   dentro; o chamador faz `emitPresence` + `resolveOuter` como hoje).
2. Chamar `emitHumanSquads(game)` também logo a seguir ao broadcast de
   `teamsData` no callback do `persistMatchResults` (fire-and-forget com
   `.catch`). Manter a chamada final (evolução muda skills).
3. Verificar `cupFlowHelpers.ts` (`mySquad` ~898 vs `seasonState` ~1599/2667): se
   tiver a mesma janela, emitir o plantel antes do `seasonState` ou logo a
   seguir; se não tiver, não mexer.
4. `npm run typecheck && npm run test:finalize`.

## Fase 5 — Finanças misturam fontes com idades diferentes (MÉDIA)

1. Servidor, `startWeekOnce` (`weeklyFlowHelpers.ts:~1953`): depois de
   `applyWeeklyFinancesOnce` devolver `true`, emitir
   `getTeamsWithCoachNames(game.db).then((t) => io.to(game.roomCode).emit("teamsData", t)).catch(() => {})`.
2. Cliente, `GameContext.jsx:~937-940`: o efeito do `requestFinanceData` passa a
   depender também de `calendarIndex` e `disconnected` (com `if (disconnected) return;`)
   → refaz após Taça/amigável e ao voltar a ligar.
3. Mesmo tratamento ao efeito do calendário (`~968-971`): deps
   `[activeTab, matchweekCount, calendarIndex, disconnected]`, guard
   `disconnected`.

## Fase 6 — Resultado parcial congelado no tab Jogo após reconexão (MÉDIA)

**Bug:** socket cai na 2.ª parte e volta já em lobby; o ramo idle do
`onGameState` (`session.js:~190-197`) só desliga as flags — `matchResults` fica
com o direto parcial (sem `mom`) e o tab continua em `"live"`.

1. Nesse ramo `else` (idle), se `refs.liveMinuteRef.current < 90`:
   `handlers.setMatchResults((prev) => prev?.results?.some((r) => r.mom != null) ? prev : null)`
   e `handlers.setActiveTab((t) => (t === "live" ? "jornal" : t))`.
   A guarda `< 90` protege o ecrã final normal (relógio parado aos 90'/120').
2. Confirmar à mão que o `MatchPage` não rebenta com `matchResults === null`
   fora do tab live (só é montado nesse tab — verificar em `GameOverlays.jsx`).

## Fase 7 — Correções pequenas (BAIXA)

Cada item é pequeno; podem ir num só commit `fix(state): …` ou dois.

1. **Jornada errada no MatchPage:** `components/match/MatchPage.jsx:~424` usa
   `matchResults?.matchweek ?? currentJornada` (após o apito mostrava J+1).
2. **`standingsUpdated` antes do `teamsData`:** `weeklyFlowHelpers.ts:~1481-1496`
   → `Promise.all([getTeamsWithCoachNames, getAllTeamForms, fetchTopScorers])`,
   emitir os três e só depois `standingsUpdated` + `globalNewsUpdated`. Em erro,
   emitir `standingsUpdated` na mesma (o cliente tem timeout, mas não piorar).
3. **Leilão reaberto ignorado:** `hooks/socket/market.js:~37-39` — se `exists`
   e `exists.closed`, substituir a entrada pelo leilão novo. `GameContext.jsx:~961-966`
   limpa os fechados por `calendarIndex` (não `matchweekCount`).
4. **Lance offline enviado mais tarde:** `components/auctions/BidForm.jsx:~51-55`
   — com `!socket?.connected`, mostrar "Sem ligação — tenta quando voltares a
   estar online." e `return` (não chamar `emitComAck`).
5. **Tab perdida no refresh:** `GameContext.jsx:101` — acrescentar à lista
   `calendario`, `leiloes`, `scout`, `training`, `stadium` (ver tabs reais em
   `GameRoutes.jsx`; `admin` fica de fora).
6. **Respostas sem guarda de sala:** `hooks/socket/news.js` — `inRoom()` em
   `financeData`, `palmaresData`, `clubHistoryData`, `playerHistoryData`.
7. **Pronto com patrocinador por escolher:** `TacticsContext.jsx` `handleReady`
   (~542-555) — tratar `sponsorState?.pending` como as renovações (ir ao Jornal
   em vez de emitir). `sponsorState` vem do `useGame()`.
8. **Comentários desatualizados:** `TacticsContext.jsx:68-70` (o `calendarIndex`
   avança por `seasonState`); `CLAUDE.md` linha da Durabilidade — o `seq` só
   numera `calendar_advanced`/`week_started`, não todos os eventos.

## Fase 8 — Limpeza do estado de leilão legado (BAIXA)

`selectedAuctionPlayer`, `auctionBid`, `isAuctionExpanded`, `myAuctionBid`,
`auctionResult` (+ setters) em `GameContext.jsx` e `hooks/socket/market.js`
(`~49-63`, `~86-117`, também `cup.js` e o `drainPendingCupDraw`/efeito de
`isPlayingMatch`) não têm consumidores nas views.

1. `grep -rn` de cada nome em `client/src` fora de `contexts/` e `hooks/socket/`.
   Se algum tiver consumidor real, **não apagar esse** e registar.
2. Apagar o resto (estado, setters, entradas no `value`/deps do `useMemo`,
   handlers, chamadas). Os handlers `auctionBidConfirmed`/`auctionClosed` ficam
   só com a parte de `activeAuctions`.

## Fora de âmbito (registado, não fazer agora)

- Id de pedido em `playerHistoryData`/`nextMatchSummary`/`financeData`
  (respostas cruzadas) — `requestPlayerHistory` é emitido de muitos sítios.
- Desbloqueio de `contractAnswering` quando o servidor recusa só com
  `systemMessage` (exige `emitComAck` no `renewContract` do servidor).
- `marketUpdate` no `requestResync` (raro: o reconnect faz `joinGame` completo).

## Verificação final

- Client: `npm run lint && npm run check:types && npm run test:tacticpositions`
  + testes existentes tocados (`test:postmatchflow`, `test:finalwhistle`,
  `test:livehelpers`).
- Server: `npm run typecheck && npm run test:substitutions && npm run test:segment-barrier && npm run test:finalize && npm run audit:socketio`.
- Nenhuma mudança estrutural de layout → `mobile-resp-check` não é necessário.
- `NOTES.md`: um apontamento (≤5 linhas) com o quê/porquê/como foi testado,
  respeitando o teto de 30.

## Testes manuais a fazer depois (utilizador)

1. "Limpar" → arrastar 11 → Pronto; refresh a meio.
2. Lesão na 1.ª parte → reload ao intervalo → contador de subs.
3. Vender titular em leilão com o 11 montado → completar o 11.
4. Cortar a rede na 2.ª parte e voltar em lobby.
5. Ficar no tab Finanças durante uma ronda da Taça.
6. Abrir a Tática logo após um jogo com um vermelho meu.
