# NOTES.md — Estado corrente do projeto

> **Regra (1 ficheiro, nunca um por sessão):**
> - Atualizar no fim de cada tarefa/funcionalidade — e antes de fechar a sessão.
> - Bullets curtos em pt-PT. Blocos antigos (> ~2 semanas) já refletidos em commits: apagar.
> - Regra permanente descoberta → mover para `AGENTS.md`/`CLAUDE.md`/`STYLE.md` e remover daqui.
> - Ao iniciar uma sessão nova: ler este ficheiro + `git log --oneline -10`.

## JournalTab — robustez + acessibilidade + UX mobile

- Robustez: `compareRows` local removido → `compareStandingsRows` de `utils/standingsRank.js` (fonte única com servidor e tabela); `gameKey` e todos os lookups `teamById` com `Number()` (IDs do SQLite vs contexto); memos `teamById`/`humanTeamIds`/`coachByTeamId` juntos numa só passagem; parse da rota de transferências (`"{jogador} · {vendedor} → {comprador}"`) extraído para `transferRoute()` com fallback para o título intacto; `onOpenPlayerHistory` agora sempre `{id}` (o GameRoutes só usa `playerId`).
- Acessibilidade: classificação e artilheiros em `<ol>/<li>`; `MiniFormDots` com `role="img"` + etiqueta textual (antes só cor); zona de subida/descida com texto `sr-only` (antes só borda colorida); botões de histórico com `aria-label`.
- UX mobile: carimbo em fluxo ao lado do kicker no telemóvel (antes `absolute top-9` tapava o título a 320px), absoluto só no `sm+` (um legível por breakpoint); coluna "J" da mini-tabela escondida abaixo de 420px para dar espaço aos nomes; placar com gaps/padding mais apertados no telemóvel; limiares de `fans_mood` (70/45/25) unificados em `fansMoodTone()`.
- Não mexido: sistema `.jp-*` do `index.css`, tapes/rotações/nódoas, `journalHeadlines.js`, ordem das tiras (sequência narrativa preservada para leitores de ecrã).
- Checks: eslint limpo em `JournalTab.jsx`; `check:types` OK; harness pré-existente `journal-resp-test` portrait 5/5 + landscape 6/6 PASS (`clipEls=0`, screenshots 360 e 667 verificados). `npm run lint` global falha em `client/journal-cup-diagnostic.jsx` (ficheiro untracked de outra sessão, `import ... assert` — não tocado).

## StadiumTab — painel Expansão com aspeto de estaleiro (novo)

- Só o bloco Expansão (`StadiumTab.jsx`): fita de sinalização amarelo/preto no topo (repeating-linear-gradient com `var(--color-amber-400)`/`--color-zinc-950` + fallback hex, sem imagens), ícone do header `stadium`→`construction`, meta "Estaleiro aberto"/"Obra concluída".
- Barra de capacidade virou viga (borda âmbar + risca diagonal sobre o progresso), label "Frente de obra — capacidade", resto "Faltam +N obra(s) para concluir o estaleiro"; cartões custo/ganho como placas (borda tracejada âmbar + 🧾/🧱); botão `primary`→`accent` com ícone `construction`.
- Voz de placa de obra: máxima "Obra concluída — lotação máxima", sem saldo "Obra em espera · faltam materiais". Lógica, emits (`buildStadium`) e dialog intactos; resto da tab intocado.
- Checks: client `lint` + `check:types` OK. Sem mobile-resp-check (mesma estrutura/grid, só decoração).

## FinancesTab — Empréstimos como cartão de crédito "CashBall Bank" (novo)

- Bloco "Empréstimos" (coluna Centro de Controlo) redesenhado como face de cartão: cabeçalho emissor `CashBall Bank` + ícone contactless/NFC, chip geométrico dourado, linha "época {seasonYear}", valor da dívida grande (`text-error`/branco quando dívida; verde-esmeralda + "Sem juros · liquidado" quando pago), aviso "Juros 1,5%/jornada", e barra de plafond (% de `LOAN_MAX` 2.500.000€; thresholds 75/40 → rose/amber/emerald). Botões e dialogs (`payLoan`/`takeLoan`/`payAllLoan`) intactos — só `FinancesTab.jsx`.
- Armadilha: bolhas decorativas `absolute` com offsets negativos que estouravam a caixa `overflow-hidden` do cartão inflavam `scrollWidth` → `clipEls=+40px` no harness; reposicionadas para `-top-16 right-0` / `-bottom-16 left-0` (só overflow vertical, já clippado) — report limpo.
- Checks: client `lint` + `check:types` OK; portrait (320–430) e landscape (568–1023) do harness `finances-resp-test` PASS, `clipEls=0`, + variante local com `loanAmount=0` (estado liquidado) PASS.
- **Workaround mobile-resp-check (infra quebrada — ver nota abaixo):** `node_modules` é root/musl e o host é glibc → rolldown não arranca. Solução: `rsync -a --exclude node_modules --exclude dist ./ /tmp/cb-client-test/ && cd /tmp/cb-client-test && npm ci` e correr `node scripts/mobileRespCheck.mjs <harness> ...` de lá (chromium em `/usr/bin/chromium`; servidor próprio: `npx vite --port 5199 --strictPort`). Testes unitários com `playwright-core` + `executablePath: "/usr/bin/chromium"`.

## Pitches broadcast com avatares + badges live (novo)

- `PitchFormation.jsx` redesenhado (transmissão TV): relvado com faixas de corte + foco de luz + vinheta, linhas SVG mais nítidas (marcas de penálti, ponto central), `PlayerMarker` com cara (`PlayerAvatar`, anel na cor da posição via `POSITION_ACCENT_HEX`, camisola na cor da equipa) + sigla da posição + placard nome/skill + badges de eventos (⚽×n, 🟨/🟥 via `filterMatchEvents(events, liveMinute)`).
- `MatchPitch.jsx` passa a moldura (relvado vive no `PitchFormation`) e repassa `events`/`liveMinute`/`teamColor`; `MatchView.jsx` (spectate + jogo próprio) liga os destaques live; `MatchBriefing.jsx` (`OpponentFormation`) reutiliza o mesmo `PitchFormation` (map local `POS_STYLES` removido) com `teamColor={opponent.color_primary}`.
- Fix pós-push: o barrel `match/shared/index.js` reexporta `PlayerMarker`/`PlayerRow` e o rewrite tinha-lhes tirado o `export` → `MISSING_EXPORT` no `vite build` (docker). Repostos os exports (assinaturas novas, retrocompatíveis); verificação por script de re-exports do barrel OK.
- Checks: client `lint` + `check:types` OK; eslint limpo nos 4 ficheiros. **mobile-resp-check BLOQUEADO pela infra**: `vite dev` não arranca (`@rolldown/binding-linux-x64-gnu` em falta, `node_modules` owned by root, sem sudo) — falha pré-existente, anterior a carregar qualquer código. Rerun `test:mobile` + `test:mobile:landscape` quando o `node_modules` for reparado (ex. `sudo npm install` ou docker).

## Jornal Global + Jogador do Jogo (MOM) (novo)

- **Tab "Jornal" = landing** (pós-login/choque de sala E pós-jogo): `GameContext` mudou o `activeTab` por defeito de `"club"` para `"jornal"` (allowlist `sessionStorage` +fallbacks); `JournalTab.jsx` (nova view) com dois painéis — "Resultados" (Liga por jornada + Taça por ronda, com ⭐ MOM por equipa em cada jogo) e "Jornal da época" (linha do tempo: `club_news` de todos os clubes + `transfer_history`, agrupadas por jornada, jogadores clicáveis → `requestPlayerHistory`). Navegação: `constants/navigation.js` — `jornal` no grupo "Competição" (sidebar desktop + fly-up mobile; destaque automático via `getGroupTabKeys`).
- **MOM sem tocar no engine:** `server/game/mom.ts` (`computeMoms`, função pura) pontua eventos persistidos em `matches.narrative`/payload da ronda — goal/penalty_goal +30, near_miss +8, emergency_gk +5, penalty_miss −5, injury −5, own_goal −15, yellow −10, red/gk_red_card −25; tiebreak determinístico (score → golos → cartões → ID); juniores (ID < 0) excluídos. `server/momHelpers.ts` (`persistMoms`) grava na tabela `match_moms` (idempotente `DELETE ... WHERE matchweek IS ? AND round IS ?` + INSERT — segura em replay crash-recovery) com a dupla migração padrão (schema.sql + gameManager por sala + index.ts one-shot).
- **Wiring servidor:** `matchSummaryHelpers` (liga, pós-INSERT) e `cupFlowHelpers.continueFromEtGate` (Taça, pós-UPDATE cup_matches) persistem; `weeklyFlowHelpers` inclui `mom: computeMoms(...)` no emit `matchResults`; `cupFlowHelpers` inclui `mom` no payload `cupRoundResults` (Taça não persiste eventos — só em memória). Broadcast `globalNewsUpdated` em 4 pontos: `recordTransfer`, fim de jornada (weeklyFlow), fim de ronda Taça e fim de época (cupFlow).
- **Socket:** `server/socketNewsHandlers.ts` — `getGlobalNews` devolve `{news (club_news + transfer_history fundidos, cap 200), results (liga+taça com momHome/momAway), year, season}`; `globalNews` emit. Registo no `socketEventRegistry.json` + registo em `index.ts` (`registerNewsSocketHandlers`). Cliente: `globalNews`/`setGlobalNews` no GameContext; listeners `globalNews`/`globalNewsUpdated` (refetch) em `useSocketListeners` + `getGlobalNews` no `gameState` (join/reconnect).
- **Landing pós-jogo:** effect em `GameOverlays` — quando a partida terminou (chave `league:season:jornada` ou `cup:season:ronda`) e nenhum modal pós-jogo está ativo e `activeTab === "live"` → `navigateTab("jornal")`; dispara UMA vez por partida (ref `postMatchLandedKeyRef`) para o utilizador poder voltar ao tab "Jogar" sem ser devolvido.
- **MOM na view pós-jogo:** strip "⭐ Jogador do Jogo" no `LiveMatchHero` (tab live; `mom` vem de `myMatch` na liga ou lookup em `cupRoundResults.results` na Taça — GameRoutes passa) e `MomStrip` no `MatchView` (modo detail/painel; `mom` prop do MatchPage com o mesmo lookup Taça).
- **Armadilhas:** o `audit:socketio` só escaneia `socket*Handlers.ts` — emits dos helpers (`globalNewsUpdated`, como `standingsUpdated`) não aparecem no registry (ciego pré-existente); o registry é reescrito a cada audit. `club_news.matchweek` = jornada da liga (`game.matchweek`), NÃO calendarIndex (comentário da schema enganoso). O mood modal pós-jogo só é definido quando `activeTab` é "standings"/"cup"/"bracket" — com o utilizador em "live" o landing dispara de imediato (comportamento existente).
- **Checks:** server `typecheck` OK; client `lint` + `check:types` OK; `audit:socketio` 0 erros; `audit:gamestate 445WU8` 0 erros (2QXOJY/E22RZ9 têm erro pré-existente `POOL_SAMPLING` de 60 equipas); mobile portrait 150/150 + landscape 180/180 PASS (harness novo `journal-resp-test.html/.jsx`). Nota: `base.db` será re-seedada no próximo arranque (hash da schema mudou — comportamento normal do `ensureSeeded`, só afeta o template de salas novas).

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

## Jornal: sem salto no pontapé de saída + filtro Relevante (novo)

- **Salto indevido ao carregar Jogar (fix):** o landing pós-jogo (`GameOverlays.jsx`) disparava com qualquer `matchResults` + `activeTab === "live"` — mas o `matchResults` já existe no pontapé de saída e ao intervalo, por isso o utilizador era atirado para o Jornal ao iniciar a partida. Agora só aterra com jogo **terminado** (`!isPlayingMatch`, sem intervalo/ação/pausa, `liveMinute >= 90`) **e** com jogo decorrido antes (`hadMatchInProgressRef` — evita aterrar no lobby/revisão), uma vez por partida. Aprovado pelo utilizador: só segue para o jornal **após concluídos todos os modais pós-jogo** — a gate inclui os estados brutos todos (`gameDialog` de agentes, `coachMarketReport`, propostas, celebrações, sorteio da Taça, suspense, histórico de jogador), não só a sequência central.
- **Filtro Relevante/Tudo (`JournalTab.jsx`):** queixa de "demasiada informação irrelevante" — por defeito mostra só notícias do próprio clube + transferências (todos) + resultados da própria divisão (Taça completa por ser curta); chips Relevante/Tudo no topo + contadores e empty state adaptados. Sem identidade (sem equipa) mostra tudo.
- Checks: client `lint` + `check:types` OK; mobile portrait 150/150 + landscape 180/180 PASS.

## Jornal como capa (reescrita)

- `JournalTab.jsx` reescrito: capa com 7 quadros, todos limitados à jornada anterior — Manchete (teu jogo da jornada, ou o teu jogo da Taça mais recente), A tua série (restantes jogos da divisão, sem duplicar a manchete), Humanos (jogos de `coach_is_human === 1` ∪ `players.teamId` noutras divisões, com etiqueta Série/coach), Classificação (mini-tabela: líder + zona do clube + descida, com ⋮ nos cortes, J/Pts/pontinhos de forma), Artilheiros (top 5 de `topScorers`, clicáveis), Mercado (5 transferências mais valiosas da época por `amount` desc, jogador clicável) e Bancadas (mood com `getFansMoodLabel` + barra, preço do bilhete, melhor casa da série). Filtro Relevante/Tudo removido — a relevância é estrutural. `GameRoutes.jsx` passa `topScorers`/`teamForms`/`players`.
- Servidor: `getGlobalNews` (`socketNewsHandlers.ts`) devolve `attendance` + `homeCapacity` por jogo (liga e Taça; colunas já migradas no `gameManager`, sem migração nova) para o quadro Bancadas.
- Armadilhas: eslint `preserve-manual-memoization` rejeita deps derivados de `Map` construído com `.set` (`teamById.get(...)` → `myDivision` "may be mutated later") — derivar `myTeam` de `teams.find` dentro de `useMemo`; `headline = a ?? b` precisa do seu próprio `useMemo` senão invalida a cadeia.
- Checks: server `typecheck` OK; client `lint` + `check:types` OK; `audit:socketio` 0 erros; `audit:gamestate 445WU8` 0 erros; harness `journal-resp-test.jsx` atualizado (8 equipas na série p/ exercitar o ⋮, humanos, artilheiros, assistências). mobile-resp-check NÃO correu — `vite dev` não arranca (binding `rolldown` gnu em falta, `npm install` sem permissões; bloqueio pré-existente já registado).

## Em curso

- **Mentalidade com reset intencional a Neutro por jornada (novo):** `useSocketListeners.js` — `matchResults` (liga) e `cupRoundResults` (Taça) repõem `style: "Balanced"` além de limpar `positions` (emite `setTactic`, sem tocar no servidor). O intervalo não é afetado (só dispara a jogo terminado). Checks: client `lint` + `check:types` OK.

- **Jornal fanzine — papel por divisão (novo):** `JournalTab.jsx` + `index.css` (seção `JORNAL — "papel" (JP)`). A tab virou uma FOLHA DE PAPEL clara pousada no fundo escuro (tokens redefinidos SCOPED em `.jp-paper` — Tailwind usa `var(--color-…)`, logo os componentes herdam tinta escura sobre papel sem tocar no resto da app; hex só na paleta de impressão). Evolução com o clube via `journalTier(division)`: **1.ª → `.jp-pro`** (quase branca, grelha direita: sem tapes/rotações/padrão de pontos; voz/emoji mantêm-se), **2.ª → `.jp-semi`** (creme, pouca rotação, sem nódoas), **3.ª-4.ª → `.jp-amador`** (fotocópia: granulado forte `--jp-grain`, nódoas de café `.jp-stain`, dobra `.jp-crease`, tapes `.jp-tape`, rotações, **masthead a preto-e-branco** `.jp-photocopy`). 5.ª divisão NÃO é jogável — irrelevante. Masthead variável por época: pool `MASTHEADS` agora com **6** pares nome+slogan banais sem "cashball" (removidos "Feito na Bancada" e "O Pingo da Bancada"; A Voz da Bancada, O Correio da Bancada, Do Alto da Bancada, O Grito da Bancada, O Boletim do Adepto, Notícias da Tasca), determinístico por `seasonYear`. Resto igual: manchete gigante com cartoon-burst, carimbo (CABAZADA/GALA/…), voz de `journalHeadlines.js`, tiras recortadas (série, classificação 👑/TU/✂️, humanos 🧢, artilheiros, mercado 🏷️, bancadas). `PaperSheet` = envoltório (nódoas/dobra só amador). STYLE.md §11 documenta o tema.
  - Checks: client `lint` + `check:types` OK. **mobile-resp-check PENDENTE** — harness não arranca neste ambiente (`vite dev` sem binding `@rolldown/binding-linux-x64-gnu`, só existe o musl; `npm install` sem permissões; falha pré-existente já registada). Correr `test:mobile` + `test:mobile:landscape` noutro ambiente antes de considerar fechado.

- **PlayerHistoryModal reinventado (novo):** características deixaram de estar espalhadas (header com Agr/Res/For inline + Qualidade no Financeiro). Agora: header só identidade (avatar, nome, posição, clube, badge de disponibilidade); nova secção **Atributos** (Qualidade + Agressividade 1–5 com `AggBadge` + Resistência + Forma, tudo em `SkillBar`); nova tabela **Desempenho** (4 linhas Jogos/Golos/Vermelhos/Lesões × colunas Época|Carreira, substitui as duas grelhas de 4 cards); Financeiro só Valor/Ordenado; Mercado/Contrato, Prémios, Transferências e `SkillLineChart` intactos. Só `client/src/components/modals/PlayerHistoryModal.jsx`.
  - Checks: client `lint` + `check:types` OK. **mobile-resp-check PENDENTE** — harness não arranca neste ambiente (`vite dev` sem binding `@rolldown/binding-linux-x64-gnu`, só existe o musl; `npm install` sem permissões; falha pré-existente já registada para o `build`). Correr `test:mobile` + `test:mobile:landscape` noutro ambiente antes de considerar fechado.

- **Comparador da mesma posição no modal do agente (novo):** `contractRequest` (renovação + renegociação) e `renewContractCounterOffer` anexam `positionPeers` (colegas da mesma posição no próprio plantel, sem o próprio, ordenados por skill desc) derivados do `mySquadRef` (`useSocketListeners.js` → `buildPositionPeers`); `GameDialog.jsx` renderiza secção mínima (nome, skill, salário/sem, scroll `max-h-40`) ou "É o único X do plantel". Checks: client `lint` + `check:types` OK.

- **Duração de lesão/castigo no Mercado + Leilões (novo):** selos `Suspenso`/`Lesionado` passaram a `🟥 nJ` / `🩹 nJ` (fórmula do plantel `until - matchweekCount + 1`, sem tooltip por decisão do utilizador) em `TransferHub.jsx` (`MarketCard`) e `AuctionCard.jsx`. Checks: lint + check:types OK.

- **Finanças por época (fix):** `requestFinanceData` somava vendas/compras/obras de **todas** as épocas (`club_news` sem filtro de ano); agora filtra `year = game.year`. Bilheteira já era por época (`season`), patrocínio anual e folha/juros (`completedJornada % 14`) já renovavam, gráfico mantém 2 épocas (decisão do utilizador).
- **Bilheteira ao preço faturado (novo):** o painel recalculava `attendance × 15` fixo, errado com preço dinâmico e inconsistente com saldo/gráfico. Nova coluna `ticket_revenue` em `matches`/`cup_matches` (schema.sql + migração por sala em gameManager + one-shot base.db em index.ts; sem DEFAULT → histórico antigo fica NULL), escrita na finalização com a mesma fórmula do crédito (`_ticketPrice`, liga em matchSummaryHelpers, Taça em cupFlowHelpers) e lida com `COALESCE(ticket_revenue, attendance × 15)` + fallback sem coluna para DBs muito antigas. Histórico nunca recalculado ao preço atual (cada jornada tem o seu preço).

- **Crash-loop do backend (fix):** `getGlobalNews` (`server/socketNewsHandlers.ts`) fazia `[...league, ...cup].map(mkResults)` mas `mkResults(rows)` espera o array inteiro → `rows.map is not a function` → uncaught → `fatalShutdown` com segfault do sqlite3 (exit 139, restart em loop). Fix de 1 linha: `mkResults([...])`. Rebuild + restart: `/health` 200 e estável; typecheck + `audit:socketio` 0 erros + `audit:gamestate 445WU8` 0 erros.

- **Cards dos outros jogos das divisões (`LiveFixtureRow`):** sem relógio (tudo simulado em simultâneo) — `memo` + lookups/golos/eventos em `useMemo` (golos num só passe), `isFlashing` sem `Date.now()` no render, treinador humano desduplicado (só a faixa do topo), nomes 11–12 px, eventos 10 px com `title` + fallback "—", `aria-label` no botão e `role="status"` no marcador, sem `translate` no hover. `GameRoutes.jsx`: `key` estável (`home-away`), `humanTeamIds` em `Set` memorizado, contador de jogos no cabeçalho da divisão, comentário do filtro da Taça em pt-PT. Checks: lint + check:types OK; mobile-resp-check portrait 150/150 + landscape 180/180 PASS.
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

- **Jornal: tira "Os outros humanos" → "Outros treinadores":** só a prop `sticker` do `FanzineCard` em `JournalTab.jsx` (1 ocorrência). Checks: eslint do ficheiro OK; sem mobile-resp-check (tweak de texto pontual).

- **Fila pós-jogo rígida inclui o Aguardar Coaches (novo):** `computePostMatchFlow` recebe `waitingWantsShow` e devolve `showWaiting` (só com a fila drenada); helper `isPostMatchQueueActive` para portões fora do GameOverlays. `GameOverlays` (espera do intervalo passa por `showWaiting` + gate do landing inclui-a) e `TacticsView` (espera pré-jogo suprimida com fila ativa) — os dados ficam guardados, só ordena. Histórico continua a furar; popups em jogo, lobby e mercado livres (decisão do utilizador). Checks: client `lint` + `check:types` OK. Sem audits/mobile (só visibilidade UI).


- **Cancelar do WaitingCoachesModal pré-jogo agora é unilateral (fix loop):** `TacticsView.jsx` passava `onCancel={handleReady}` (toggle `setReady(!isReady)`) — duplo clique emitia false e logo true, religando e reabrindo o modal. Agora emite `setReady(false)` direto, igual ao do intervalo (`GameOverlays.jsx`). Botão principal Pronto mantém o toggle (correto aí). Checks: client `lint` + `check:types` OK. Sem mobile-resp-check (só handler).


- **PostMatchMoodModal já não abre ao início do jogo (fix):** o effect do mood (`GameContext.jsx`, ramo da Liga) disparava sobre qualquer `matchResults` com o meu jogo — mas esse estado é reutilizado para o direto (`matchSegmentStart`/`matchReplay` com 0-0, `matchMinuteUpdate`, intervalos, incluindo fixtures da Taça), por isso o modal abria ao pontapé de saída sempre com empate e ainda consumia a chave anti-repetição, bloqueando o humor real no apito final. Guarda: só constrói o mood se `myMatch.mom != null` (só os finais trazem `mom`; `referee` não serve, vai também ao intervalo). Ramo da Taça intacto (`cupRoundResults` só chega no fim da ronda). Checks: client `lint` + `check:types` OK; `audit:socketio` 0 erros; `audit:gamestate 445WU8` 0 erros. Sem mobile-resp-check (zero layout). **Pendente:** teste manual até aos 90' numa sala real.

- **Surpresas da Taça como notícia do Jornal, sem modal (novo):** `CupUpsetModal.jsx` apagado; a finalização da ronda grava `club_news` tipo `cup_upset` por tomba-gigantes (título + ronda/divisões/resultado na description, sem amount → sem efeito no gráfico de saldo; dentro da transação com marker `finalized` → replay-safe; sem migração nem eventos novos). Cliente: `GameOverlays` (import, ack, pending, gate do landing, render), `postMatchFlow` (etapa upset) e `MODAL_Z.cupUpset` limpos; `JournalTab` ganha tira fanzine "Tomba-gigantes" (parse defensivo + fallback). Efeito lateral: o landing para o Jornal deixa de esperar pelas surpresas — participantes e espetadores eliminados aterram no fim da ronda.
  - Checks: server `typecheck` OK; `audit:gamestate 445WU8` 0 erros; client `lint` + `check:types` OK. Sem `audit:socketio` (sem handlers/emits novos). **mobile-resp-check PENDENTE** — harness bloqueado neste ambiente (binding nativo `rolldown` em falta, falha pré-existente). **Teste manual:** ronda com upset → sem modal, tira no Jornal, landing de participante e de eliminado.

- **Fim de jogo cai no Jornal, não na Classificação (fix):** cadeia em 3 peças — o relógio forçava `setActiveTab("standings")` aos 90'+3s (herança pré-Jornal), o mood exigia tab Classificação/Taça, e o landing exige tab Jogo: o salto final ficava bloqueado para sempre. Removidos os saltos forçados (relógio 2 ramos + pós-penáltis); mood abre sobre o tab atual mal chegam os resultados; chaves anti-repetição passam a incluir a época (`league:{época}:{jornada}`, `taça:{época}:{ronda}` — antes colidiam entre épocas, o mood só aparecia na 1.ª). Fluxo: Jogo → modais → Jornal, igual na Liga e na Taça. Só `client/src/contexts/GameContext.jsx` (navegação; `GameOverlays.jsx` intacto).
  - Checks: client `lint` + `check:types` OK. Sem audits de servidor/mobile-resp-check (só navegação). **Pendente:** teste manual numa sala real até aos 90' (Liga e Taça), não reproduzível neste ambiente.

- **LandingPage com tema de balneário/quadro tático (novo):** só camada visual, sem mexer em layout nem lógica — fundo com faixas de relva + linha lateral/círculo central em giz + grelha de giz (partículas 55→32), etiqueta "placar de balneário" (Treinador · Época 26/27 · 90') com fita-cola no título, cartão com linha de giz no topo e crachá `badge` nos headers, features com ícones material (`stadium`/`group`/`payments`/`live_tv`). Só `client/src/components/auth/LandingPage.jsx`.
  - Checks: client `lint` + `check:types` OK. Sem mobile-resp-check (sem mudança de grid/flex/larguras).

- **Treinos: posição mais imediata + decay de resistência a metade (novo):** `server/trainingHelpers.ts` — ganho base de posição `2,5 → 5` (skill 30 passa de ~1-2 semanas para ~1 semana por ponto; travão perto do potencial intacto); decay sem treino `jogado −1,84 → −0,92`, `descansado −0,61 → −0,30` (ganho `+4,9` intacto). Só afeta treinos futuros (acumuladores existentes mantêm-se).
  - Checks: server `typecheck` OK; `audit:gamestate 445WU8` 0 erros; `audit:socketio` 0 erros. Sem toque no cliente → sem lint/mobile-resp-check.

- **Palco de gala da Final da Taça (novo):** a final era um card pequeno isolado quando não participavas (`myMatch` nulo → hero com `return null`). Novo `CupFinalStage.jsx` (faixa 🏆 Final · Jamor, frente-a-frente das finalistas com crests `lg` + treinadores, medalhão VS com minuto, cenografia dourada + marca de água do troféu) com o `LiveMatchHero` em destaque dentro. A final tem SEMPRE palco: participas → intervenção normal; és espetador → hero em `readOnly` (marcador não clicável). `GameRoutes.jsx`: condição `isCupMatch && roundName === "Final"`, multiview de 1 card suprimida na final, MOM da final via lookup em `cupRoundResults`.
  - **Ritmo de gala:** final sem humanos corria a 100 ms/min (sprint NPC). Nova constante `CUP_FINAL_SPECTATOR_MS_PER_MINUTE = 500` (`gameConstants.ts`): aplica-se no tempo regulamentar (`weeklyFlowHelpers`, via `entry.roundName`) e no prolongamento (`engine.simulateExtraTime` via `ctx.cupFinalSpectator`, posto em `cupFlowHelpers`). Com humanos mantém 1000 ms.
  - Armadilhas: `edit` do pi com erro de serialização num ficheiro (contornado com python); badge de treinador do `TeamCrest` sobrepunha o minuto no palco → palco não passa `coach` (nomes já estão por baixo, em âmbar).
  - Checks: server `typecheck` OK; client `lint` 0 erros + `check:types` OK; `audit:socketio` 0 erros; `audit:gamestate 445WU8` 0 erros; mobile portrait 150/150 + landscape 180/180 PASS (harness novo `cupfinal-resp-test.html/.jsx` com os dois regimes). Falta teste manual numa sala real na semana da final.

- **Classificação virtual com seletor de divisão (novo):** o `LiveStandingsPanel` (coluna virtual na simulação) mostrava só a tua divisão. Agora tem um dropdown compacto no header com as divisões existentes em `teams` — abre sempre na tua por defeito (estado local, sem persistência), e nas outras divisões o destaque são os selos de treinador humano (iniciais) para seguir um amigo; "TU", cores de subida/descida e legenda seguem a divisão visível. Só tocado `LiveStandings.jsx` (`GameRoutes.jsx` já passa tudo).
  - Checks: client `lint` 0 erros + `check:types` OK. Só um controlo dentro do header existente → sem mobile-resp-check (vista ao vivo fora do harness).
  - Follow-up: selo `AO VIVO`/`FINAL` removido do header (pedido do utilizador) + Distritais (div 5) excluídos do dropdown — humanos nunca disputam Distritais. `applyLiveResults` mantém-se como prop (ainda alimenta o `computeVirtualStandings`).

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

- **WaitingCoachesModal — só limite vertical (2.ª tentativa):** a 1.ª tentativa (9 classes: flex/alturas/quebra de palavra) piorou o layout → revert total (`e4d9f12`). Nova abordagem mínima: só `cardClassName` `max-h-full`→`max-h-[90dvh]` (1 classe); a cadeia `min-h-0`/`overflow-y-auto` interior já existia. Checks: lint + check:types OK.

- **PlayersTab — refatoração completa (novo):** import morto `FLAG_TO_COUNTRY` removido; `posColorHex` local → `POSITION_ACCENT_HEX` (STYLE §10); `POS_ORDER`/`POS_GROUP_LABEL` extraídos (literal triplicado); agrupamento + salários + stagger num só `useMemo` sobre `annotatedSquad` (fonte única — antes o gráfico somava `mySquad` mas a lista renderizava `annotatedSquad`); prop `mySquad` removida da assinatura e do chamador (`GameRoutes.jsx`, linha do PlayersTab — a do FinancesTab fica); `|| 0`→`?? 0`; `mt-1 first:mt-0` inoperante removido (header é sempre first-child; pai já tem `gap-1.5`); contraste dos cabeçalhos `/50`→cheio e `/30`→`/70`; grupos como `section`+`h3` e lista `ul`/`motion.li`; gráfico em `Panel` canónico com `role="img"`+`aria-label` e barras `aria-hidden`; `EmptyState` com descrição; meta com pluralização. Aspeto visual pixel-idêntico.
  - Checks: eslint limpo nos 2 ficheiros + `check:types` OK. `npm run lint` global falha só em `client/journal-cup-diagnostic.jsx` (untracked, de outra sessão — pré-existente). Sem mobile-resp-check (sem mudança de grid/flex/larguras).
