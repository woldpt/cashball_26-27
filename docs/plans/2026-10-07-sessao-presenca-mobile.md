# Plano — Robustez de sessão/presença (troca de dispositivo + telemóvel)

> Origem: revisão de 2026-10-07 (sessões/presença socket.io). Perfil-alvo: cliente
> móvel com bloqueio de ecrã / multitarefa de poucos em poucos segundos, e troca
> telemóvel ↔ PC a meio de uma sala.
>
> **Invariantes (não quebrar):** assento durável (`room_seats`), presença = socket
> ligado OU lease dentro da grace, ausência congela a sala, o servidor nunca decide
> por um ausente (`source:"auto"` só em saída explícita: leave/kick/despedida/
> `adminReleaseRoom`), não persistir `game.lockedCoaches`. Regressões proibidas do
> `AGENTS.md` são absolutas.

## Fase 1 — Presença no servidor (crítico)

### 1.1 Lease começa na queda, não no último pacote
- `server/gameManager.ts` `unbindSocket` (~1151): dentro do `if (name)`, chamar
  `markSeatSeen(game, name)` (já importado).
- Porquê: hoje `seatSeenAt` só renova em bind/pacotes recebidos; um treinador a
  ver o jogo sem clicar há >90 s fica ausente no próprio instante da queda →
  congela/descongela a sala a cada bloqueio de ecrã.

### 1.2 Janela de decisão: nunca `auto` com presença só por lease; libertação = consentimento
- `server/game/engine.ts` `waitForMatchAction` (~505-640):
  - Helper local `const released = () => !game.playersByName[humanCoach.name] || (game.seats[humanCoach.name] && game.seats[humanCoach.name].status !== "member");`
  - Pré-verificação (~536-543): depois do `await waitForPresence`, se `released()` →
    `return { choice: fallback(), source: "auto" }`.
  - Callback do `arm()` (~577-601), por esta ordem:
    1. `const entry = getPendingMatchActions(game).get(actionId); if (!entry) return;`
    2. `if (released()) { finalize(fallback(), "auto"); return; }`
    3. Presente só por lease (`isSeatPresent` true mas `!game.playersByName[name]?.socketId`):
       **não** finalizar — `entry.expiresAt = Date.now() + timeoutMs; entry.timer = arm(); return;`
       (o rejoin em `assignPlayer` já reenvia `matchActionRequired` com o prazo).
    4. Ramo ausente existente (`matchActionBlocked` + `waitForPresence`): depois do
       `await`, se `released()` → `finalize(fallback(), "auto"); return;` antes de re-armar.
    5. Só então o `finalize(fallback(), "auto")` de timeout com socket ligado.
- Corrige também o ciclo infinito do `adminReleaseRoom` com janela pendente (não
  mexer em `socketAdminHandlers.ts`).

### 1.3 Reavaliar presença quando a grace expira
- `server/socketGameplayHandlers.ts` handler `disconnect` (~403): guardar `name`
  do `playerState` e, no fim, `setTimeout(() => { if (game.purged) return; if (game.playersByName[name]?.socketId) return; emitPresence(game); emitPresencePause(game, io); }, PRESENCE_GRACE_MS + 1000)`.
  Importar `PRESENCE_GRACE_MS` de `./roomStateHelpers`.

### 1.4 Lista `players` com a mesma definição de presença do roster
- `server/gameManager.ts` `emitPresence` (~1194): o payload `players` passa a
  `Object.values(game.playersByName).filter((p) => p.socketId || isSeatPresent(game, p.name))`.
  **Não** mudar `getPlayerList` (os fluxos de Taça/semana usam-no para emitir a sockets).
- Porquê: `OtherSquadsTab.jsx:411`, `ScoutView.jsx:218`, `CupDrawPopup.jsx:37`
  tratam a equipa como NPC a cada bloqueio de ecrã do treinador móvel.

### 1.5 `resolveMatchAction` só pelo dono da equipa
- `server/socketGameplayHandlers.ts` (~275-287): `const ps = getPlayerBySocket(game, socket.id); if (!ps || pendingAction.teamId !== ps.teamId) return;` (substitui a comparação com o `teamId` do cliente).

### 1.6 Testes (em `server/scripts/sessionFreezeRegression.mts`)
- F13: `seatSeenAt` antigo (5 min) → `bindSocket` → `unbindSocket` → `isSeatPresent` true; com `Date.now` além da grace → false. Importar `bindSocket`/`unbindSocket` do `gameManager` (CommonJS via `require`); se a importação não for viável sem efeitos colaterais, parar e reportar.
- F14: `waitForMatchAction` (acrescentar `export`) com `timeoutMs` curto (ex.: 50 ms), assento `member`, `playersByName` sem `socketId` e lease fresco → depois de ~150 ms a ação **continua pendente** (não resolveu `auto`).
- F15: igual, mas `releaseSeat(game, name, "left")` → resolve com `source: "auto"` e o mapa de pendentes fica vazio.

**Verificação:** `cd server && npm run typecheck && npm run test:session-freeze && npm run test:segment-barrier`. Commit.

## Fase 2 — Cliente móvel

### 2.1 Cliente deslocado não volta a entrar sozinho
- `client/src/hooks/socket/session.js`: variável `let displaced = false;` posta a
  `true` no callback de `subscribeSessionDisplaced`; em `onConnect`, `if (displaced) return;` antes do `joinGame`. O botão «Retomar aqui» (reload) continua a ser a saída.

### 2.2 `socket.off(evento)` sem handler apaga listeners de outros módulos
- Em `client/src/hooks/socket/*.js`, guardar a referência e fazer `socket.off(evt, handler)` pelo menos para: `gameState` (tem listener de módulo em `socket.js:87`), `globalPlayersUpdate` (`RoomSelectScreen.jsx`), `systemMessage` (`RoomHub.jsx`), `chatHistory` (`ChatMessages.jsx`).

### 2.3 Socket "zombie" ao voltar do segundo plano + janela pós-reconnect
- `client/src/socket.js`, `visibilitychange`: guardar `hiddenAt` ao ficar `hidden`; ao ficar `visible`: se `!socket.connected` → `forceReconnect()`; senão, se esteve oculto >5 s → `socket.timeout(2500).emit("presencePing", (err) => { if (err) socket.io.engine?.close(); })` (confirmar em `node_modules/socket.io-client` que fechar o engine dispara a reconexão automática).
- Servidor `server/socketSessionHandlers.ts`: `socket.on("presencePing", (ack) => { if (typeof ack === "function") ack({ ok: true }); });` (o `socket.use` já renova o lease).
- Gate de join: em `socket.js`, `let joined = false;` — `true` nos listeners de módulo de `gameState` e de um novo `socket.on("teamAssigned", ...)` de módulo; `false` em `socket.on("disconnect")`. `queueEmit`/`emitComAck` só fazem `sendNow` se `socket.connected && joined`; caso contrário vão para a fila (o `flushOutbox` existente esvazia-a).
- Correr `cd server && npm run audit:socketio` (regista `presencePing` no `socketEventRegistry.json`).

**Verificação:** `cd client && npm run lint && npm run check:types`; `cd server && npm run typecheck && npm run audit:socketio && npm run test:connect-smoke`. Commit.

## Fase 3 — Troca de dispositivo / tabs (servidor)

### 3.1 Reconexão em segundo plano não rouba o assento a outro dispositivo vivo
- Cliente: enviar `visible: document.visibilityState === "visible"` no `joinGame` do `onConnect` (`hooks/socket/session.js`) e do auto-join (`hooks/useJoinSession.js` ~225). Joins manuais não precisam (são sempre visíveis; `undefined` = não passivo).
- Servidor `socketSessionHandlers.ts`: ler `visible` do payload; passar `passive = visible === false` só à chamada `assignPlayer` da linha ~702 (manager com equipa). Em `assignPlayer`, antes de `setSeatTeamId`/`claimSeat`: se `passive` e o assento está ligado a outro socket vivo (`io.sockets.sockets.get(cur)?.connected`) com `deviceId` diferente → `socket.leave(roomCode); socket.emit("sessionDisplaced", { reason: "another_device" }); return;`.

### 3.2 Aviso de deslocamento coerente (tabs e despedidos)
- `assignPlayer` (~316): emitir `sessionDisplaced` sempre que o socket deslocado estiver vivo (`io.sockets.sockets.get(id)?.connected`), com `reason` `"another_device"` (deviceId diferente) ou `"another_tab"` (igual). Um socket antigo morto do mesmo telemóvel não recebe nada → sem falso deslocamento.
- Caminho do despedido (~716-721): mesma regra de "socket vivo".

### 3.3 Expulso / sala cheia não ficam no canal da sala
- `doJoinContinue` (ramo `kickedCoaches`) e o ramo «Sala cheia» em `doJoin`: `socket.leave(finalRoomCode)` antes do `joinError`.

**Verificação:** `cd server && npm run typecheck && npm run test:connect-smoke && npm run audit:socketio`; `cd client && npm run lint && npm run check:types`. Commit.

## Fase 4 — Estado que não se pode perder + ruído

- 4.1 `socketGameplayHandlers.ts` disconnect (~429-438): **remover** o bloco que apaga `pendingRenewalCounterOffers` — uma queda de rede não pode matar a contra-proposta.
- 4.2 `coachDismissalHelpers.ts` `offerJobToCoach` (~532): `if (!player) return;` e guardar só o `io.to(player.socketId).emit("jobOffer", …)` com `if (player.socketId)`. O pendente é criado sempre; o `resendPendingJobOffer` entrega-o no rejoin.
- 4.3 `assignPlayer` (~328-330): `teamsData` para a sala só se `isNew`; caso contrário `socket.emit` (cada desbloqueio do telemóvel deixava de inundar a sala).
- 4.4 `weeklyFlowHelpers.ts` `checkAllReady` (~2139): um só waiter por sala — `if (game._readyWaitArmed) return; game._readyWaitArmed = true;` e repor `false` no `.then` antes de re-chamar `checkAllReady`.
- 4.5 `socketGameplayHandlers.ts` disconnect (~463-467): apagar o `clearTimeout(game.phaseTimer)` (o timer nunca é atribuído — código morto).

**Verificação:** `cd server && npm run typecheck && npm run test:session-freeze && npm run test:crash-recovery`. Commit. Atualizar `NOTES.md` (máx. 5 linhas) e commit.

## Fora deste plano (com motivo)

- Recuperação silenciosa via `connectionStateRecovery` (`socket.recovered` → rebind sem `joinGame`): ganho real em bloqueios curtos, mas maior; avaliar depois da 4.3 se a carga do rejoin ainda pesar.
- Corrida de dois joins novos na mesma equipa (`generateRandomTeam`): o fallback escolhe equipas com manager, por isso o `AND manager_id IS NULL` não é trivial; raro.
- `trimmedName` vs `session.name`: só com cliente adulterado (login é `COLLATE BINARY`).
- `socket.connecting` em `forceReconnect`: inofensivo (backoff máx. 3 s).
