## PlayerHistoryModal: paleta central + insígnias partilhadas (2026-09-26)
- Review pedida (código + UI/UX) → plano completo aprovado e executado. 6 ficheiros: `PlayerHistoryModal.jsx`, `SkillLineChart.jsx`, `PlayerStatusBadges.jsx`, `constants/index.js` (+`POSITION_FULL_LABEL_MAP`), `utils/skillHistory.js` (comentário), `modals/positionConstants.js` apagado.
- Fixes: `POS_LABEL`/`POS_FULL`/`POS_BAR` locais → `POSITION_*` central (o `20 vs 14` não era defeito: `SEASON_WEEKS=20` contratos vs `SEASON_JORNADAS=14` liga — só o `20` hardcoded, agora `SEASON_WEEKS` no modal e nas insígnias); barra da agressividade com `maxValue` 5 em escala de etiqueta (antes 2–10% sempre vazia); `★`→`StarMark`, disponibilidade→`PlayerStatusBadges`, vazios→`EmptyState`; hex hardcoded→classes (`formHex`/`#22d3ee`/`#333`/`#888`/`#000`); gráfico com `onClick` (toque), tooltip contido 20–80% e «Actual»→«Atual»; botão `← Voltar` vira `✕` no móvel + `title` nos nomes truncados.
- Checks: eslint limpo nos ficheiros tocados (`lint` global só os 2 erros pré-existentes, confirmados via stash) · `check:types` OK · `test:mobile` 160/160 + `test:mobile:landscape` 192/192 (2 corridas portrait falharam antes por flakiness do harness — `Execution context was destroyed`/`PENDING is not valid JSON`, sem falhas de layout).
- Peripécia: `git reset --hard` corrido 5× por outra sessão `pi` (reflog 07:06–07:19) apagou as 6 fontes da árvore; o commit só levou o NOTES. Reaplicadas as mesmas edições em cima do HEAD (sem colisões — a scout só tocou TransferHub/NOTES) e re-corridos lint/tipos.
## Scout — race de pesquisa + contrato decidido no servidor (2026-09-26)
- `PlayerSearchView` avaliado (código 7.5, UI/UX 8) → 2 correções planeadas e aprovadas.
- **Race anti-flash**: resposta A de uma pesquisa antiga chegava depois da pesquisa B e substituía resultados frescos. Fix: client gera `searchId` incremental (`playerSearchIdRef`/`nextPlayerSearchId` no `GameContext`), envia no `requestPlayerSearch`, servidor ecoa; listener em `useSocketListeners.js` descarta respostas com `searchId` ≠ ref atual.
- **Lógica de contrato duplicada (e divergente)**: o client recalculava `contractLocked` com fórmula própria (branch `currentSlot > 0` com 14/20) que divergia do servidor (`coreHelpers.currentEpoch` usa `contractCutoverSeason` com 14 jornadas para épocas antigas). Fix: servidor calcula `contract_locked` (CAST 0/1) no SELECT da pesquisa, mesmo `currentEpoch` do filtro `onlyAvailable`; client apagou as ~12 linhas de matemática (imports `SEASON_*` e props `season`/`currentSlot` removidos do `PlayerSearchView`).
- "Licitar" → navegação para tab leilões mantida (padrão consistente no repo: TransferHub e PlayerHistoryModal fazem igual); `tabular-nums`/filtros colapsáveis ficam para tarefa própria.
- Checks: server `typecheck` OK; client `lint` (2 erros pré-existentes, confirmados via stash) + `check:types` OK; `audit:socketio` 0 erros (warning `playerSearchResults` pré-existente — listener dinâmico invisível ao analisador).
## StadiumTab: review 7/10 → correções (2026-09-26)

- Avaliação 1–10 pedida (código 7,5 · UX 7). Fixes no diálogo de expansão: usava `SEATS_PER_BUILD * 15` (preço hardcodado, mentia com bilhete ≠15€) e título/descrição com «300.000€»/«5.000» fixos — agora `ticketPrice` + `formatCurrency(EXPANSION_COST)`/`SEATS_PER_BUILD`. Fallback hex `#4ade80` → classe `text-primary`. pt-PT: «Actual»→«Atual» (AO90), «Mood»→«Moral dos adeptos».
- UX decidido por perguntas: 3º KPI (Assistência Média) full-width no mobile via `className="col-span-2 lg:col-span-1"` no SummaryWidget (era órfão a meia largura); «· X lugares» removido do hero (estava em 3 sítios); `aria-label` + `aria-pressed` nos botões de preço. Re-indentados os blocos das 2 colunas (filhos abaixo do pai — colados de um layout flat antigo). Declarado fora: helper das 3 barras (YAGNI), pending do botão Expandir (trava no servidor).
- **stadiumtab-resp-test** novo (`client/stadiumtab-resp-test.{html,jsx}`): o harness `stadium-resp-test` só cobria `StadiumIllustration` — StadiumTab não era renderizado por nenhum. Fixture com extremos (nome longo, divisão 4, 115k lugares, mood 30, bilhete 30€).
- Checks: `lint` só os 2 erros pré-existentes · `check:types` OK · `test:mobile`/`:landscape` 5/5 + 6/6 no harness novo (screenshots vistos: 320/390 portrait, 667 landscape — ligaduras de ícones tipo "CONFIRMATION_NUMBER" são artefacto do harness, a fonte Material não carrega lá).

## TrainingPage: timeout-fallback nos emits + agrupamento único (2026-09-26)

- Review 8/10 do `client/src/components/ui/TrainingPage.jsx` → dois fixes de código (UI intocada). Novo helper `emitWithTimeout(event, args, ms)` local: se o servidor nunca ackar, resolve `null` em vez de pendurar — usado nos 3 emits (`getTrainingFocus`, `getTrainingHistory`, `setTrainingFocus`), apagando o fallback ad-hoc de 4 s que só existia no set. Os dois gets tinham esse buraco: servidor morto = página eterna em «Nenhum»/vazio sem erro.
- Agrupamento do histórico numa só passagem: `orderedGroups` (posição → players via `groupByPlayer`, ordenado GR→ATA + desconhecidas no fim); `visiblePlayerCount` = soma dos players de `orderedGroups` — relatório e widget derivam da mesma estrutura, nunca divergem. Fora as 3 estruturas paralelas (`historyByPosition` fica, mas `orderedPositions` + Set/filter duplicado desaparecem; −8 linhas líquidas).
- Checks: `lint` só os 2 erros pré-existentes (`landing-resp-test.jsx`, `GameContext.jsx` — confirmado por stash) · `check:types` OK. Só JS/lógica → sem mobile-resp-check.

## Limpeza do JournalTab (2026-09-26)

- Plano `docs/plans/journaltab-cleanup.md` executado na íntegra. Só `client/src/views/JournalTab.jsx` (1038→990 linhas): fora `estimateReadTime`, `ReadingProgressBar`, `animate-pulse`, `aria-live` e emojis 📅⏱️; `LINK_CLS` + `TABLE_WRAP/CLS` + `THEAD_ROW_CLS` eliminam as classes repetidas; `RichParagraphs` com um só ramo de fallback; `getSnippet` sem corte aos 80; `selected` desestruturado em todo o detalhe.
- Filtros `role="tablist"`→`role="group"` (sem `TabBar`: perdia as cores por categoria). Atalho passa a só Enter (Espaço volta ao scroll) e ignora com modal aberto (`[aria-modal="true"]`); `ModalShell` + `InviteRoomModal` (montado no `GameOverlays`, cobre qualquer tab) ganham `role="dialog" aria-modal="true"`. Mobile: tocar na linha faz `scrollIntoView` do detalhe.
- Morto removido: secção JP do `index.css` (−104 linhas), §11 do `STYLE.md` reescrito como caixa de entrada, linha 278 deste NOTES apagada.
- Checks: `lint` só os 2 erros pré-existentes · `check:types` OK · `test:journaldb` 2 falhas pré-existentes (confirmadas via `stash`: «renovação → club», «duas equipas na media» — lado dos dados, fora do âmbito) · `test:mobile` 155/155 + landscape 186/186 · build OK.

## Radar: moral só com etiqueta (2026-09-26)

- Pedido: no `CompareRadar` (briefing pré-jogo), o eixo «Moral do balneário» ficava `72 · Bom` — pedido para ficar só a etiqueta («Bom»), oculto o valor.
- `client/src/components/live/briefing/CompareRadar.jsx`: `homeDisplay`/`awayDisplay` do `DualBar` da moral passam a só `label` (o valor 0–100 continua a alimentar a largura da barra e o dot no rodapé, que já mostrava só etiqueta).
- Checks: `lint` só os 2 erros pré-existentes (`landing-resp-test.jsx`, `GameContext.jsx`) · `check:types` OK. Tweaks de texto → sem mobile-resp-check.

## Convite no RoomHub para membros noutra sala (2026-09-25)

- Pedido: botão de convite como no `RoomSelectScreen` junto aos nomes no `RoomHub`, quando estão a jogar noutras salas. Decisões via perguntas: âmbito sala + tab Global, com os mesmos estados (`A convidar…`/`Convite enviado`/`Aceitou ✓`/`Recusou`).
- Só `client/src/components/chat/RoomHub.jsx`: `inviteState` + listener de `roomInviteResult` (cópia do `RoomSelectScreen`, com limpeza por temporizador) + `sendRoomInvite` com `me.name/token/roomCode/roomName`; `presenceRoomOf` cruza `globalPlayers` (`{name, roomCode}`, chega em direto via `__global__`); candidato = membro desta sala (`players` ∪ `awaitingCoaches`) online com `roomCode` diferente, nunca a si próprio (o servidor rejeitaria não-membros, por isso só esses veem botão). Coluna da sala: badge "Noutra Sala" + botão sob o estado do coach; tab Global: pills de candidatos ganham os mesmos controlos inline.
- Checks: `lint` só os 2 erros pré-existentes (`landing-resp-test.jsx`, `GameContext.jsx` — não tocados) · `check:types` OK. Botão pontual em linhas existentes → sem mobile-resp-check.

## Narração: mais humor e variedade de lances (2026-09-25)

- Pools finos de `server/game/commentary.ts` reforçados com humor e lances concretos: `bettingPhrase` 8→18, `emergencyGkPhrase` 15→25, `chanceSavedPhrase` 12→28 (cabeçadas, livres, cantos, contra-ataques, apanhas de primeira, chapéus), `chancePostPhrase` 8→19, `chanceOffTargetPhrase` 10→22, `subPhrase` 44→56. Export/assinaturas intactos; chaves `missType` idênticas (`DEFENDEU!`, `AO POSTE!`, `AO LADO!`, `PANENKA FALHADO!`).
- Nota: o rebase de trabalho paralelo tinha apagado a 1.ª ronda desta melhoria (ficheiro byte-idêntico ao `8dd1b1c3`), por isso o trabalho foi redito em cima do estado atual. Um backtick fechado como `"` num dos newTexts quebrou o typecheck com cascata em linha distante (`finalEndPhrase`) — correção de 1 carácter.
- Verificado: `npm run typecheck` no server OK.

## Logout fantasma após escolha do save (2026-09-25)

- Queixa: por vezes, após escolher o save, cair no ecrã de login (vários treinadores, sem mensagem visível).
- Causa (só leitura, sem hipótese): um único `joinError` de sessão apagava logo a credencial válida — o `verifySession` tratava erro de BD como token inválido; o retry dos 10s ficava inutilizado (o `joinGameSuccess` seguinte era descartado com `me` a null); o ecrã «A entrar…» nem mostrava o erro.
- Fix (3 ficheiros): `server/auth.js` — `verifySession` distingue falha transitória de BD (`transient: true`); `server/socketSessionHandlers.ts` — transitório e token-em-falta emitem mensagens fora do vocabulário de `isAuthError`; `client/src/App.jsx` — ramo transitório re-arma o retry sem limpar nada, `joinGameSuccess` reconstrói do payload em voo (`lastJoinRef`), e a espera mostra o `joinError`.
- Checks: server `typecheck` OK · `audit:socketio` 0 erros (97 avisos pré-existentes) · `test:connect-smoke` OK (exercitou «Sessão expirada» com token inválido — a invalidez real continua a limpar) · client `lint` limpo no ficheiro + `check:types` OK. Sem layout → sem mobile-resp-check.
- Por confirmar em produção (`ssh rick`): frequência de «Sessão expirada» vs `[auth] verifySession error` nos logs — diz se o gatilho era BD ou expiração real.

## Golos de todo o campo: MED e DEF marcam em jogo corrido (2026-09-25)

- Queixa: só os avançados apareciam nos comentários das chances. Causa: a pool do rematador em `server/game/engine.ts` era `position === "ATA"` (o mesmo jogador marca ou falha); o near-miss 🥅 era `ATA+MED`. Decisões via perguntas: pool todos os jogadores de campo, ATA domina, mesma pool nas falhadas.
- Fix (só servidor, 3 ficheiros): `engine.ts` — pool do marcador e do near-miss passam a `position !== "GR"`; `playerUtils.ts` — `weightedPickScorer` ganha peso raro para DEF (`MATCH_TUNING.scorerDefWeight ?? 0.3`); `gameConstants.ts` — novo `scorerDefWeight: 0.3` (ATA mantém 2, MED 1). Total de golos intocado (só o nome no lance muda); penáltis e auto-golos como antes.
- Sonda determinística (4-3-3 neutro, 20000 sorteios): 58,7% ATA / 29,7% MED / 11,7% DEF / 0 GR — o melhor marcador continua a ser quase sempre avançado.
- Checks: server `typecheck` OK · `test:engine-unit` 19/19 · `audit:socketio` 0 erros (97 avisos pré-existentes). Sem sala viva → `audit:gamestate` fica para a próxima. Sem cliente → sem lint/mobile.

## Estrelas estilo Hattrick: contributo 0–10 com meias (2026-09-25)

- Queixa: skill 10 fazia 4★ e skill 40 fazia 3★ — as estrelas eram prémio de eventos (base 3★ + pesos MOM: golo→5★). Decisões via perguntas: híbrido contributo+eventos, escala 0–10 com meias, fatores skill+forma+posição, MOM por eventos intocado.
- `server/game/ratings.ts` (único sítio de lógica): base = skill efetiva do snapshot (com fadiga) × forma (`form/32`, clamp 0,75–1,35, curva do motor) × posição (1,0 na origem, 0,7 fora — cobre GR improvisado) / 5 → skill 40 neutro ≈ 8, skill 10 neutro ≈ 2. Temperos próprios `RATING_EVENT_ADJ` (golo +1, flagrante +0,5, amarelo −0,5, auto-golo −1, vermelho/lesão −2 — `mom.ts` intocado); arredonda a meias, clamp 0–10. `persistLastRatings` agrupa por nota (≤21 valores/equipa).
- Migração (`server/gameManager.ts`): coluna `last_rating` INTEGER→REAL (só def p/ salas novas — SQLite aceita REAL em coluna INTEGER) + rescale ×2 do histórico (5→10) com marcador `rating_scale_v3`, idempotente (prova sintética node:sqlite OK: 5→10, NULL intacto, 2.ª passagem no-op, 7,5 grava).
- Cliente: `Stars.jsx` 0–10 com valor exato ao lado (`7,5`, vírgula pt-PT) + `hideValue` p/ o marcador do pitch (104px); `PitchFormation` usa `hideValue`. Notícias antigas (1–5) são snapshot, sem conversão. Comentários "1–5★" atualizados (`PostMatchPitch`, `inboxItems`, `JournalTab`, `coreHelpers`, `cupFlowHelpers`, `matchSummaryHelpers`).
- Checks: `test:ratings` 21/21 (inclui a propriedade Hattrick: skill 10 limpo < skill 40 apagado) · server `typecheck` OK · client `lint` só os 2 erros pré-existentes · `check:types` OK · `audit:socketio` 0 erros (97 avisos pré-existentes) · `audit:gamestate 6MXK7A` 0/0/0 · portrait 155/155 + landscape 186/186.

## Fluxo Taça: fim de jogo suave + ET só para envolvidos (2026-09-25)

- Levantamento semana a semana (Liga vs Taça) + 4 correções mínimas, só lógica (sem layout):
  1. Fim da Taça sem ET cortava o direto: `cupRoundResults` chega mal o servidor simula o 90' e o efeito limpava `isPlayingMatch` + `matchResults` de imediato (sem os 3 s de apito, `live` vazio antes do Jornal). Agora a limpeza espera pelo apito do cliente (`idle` + minuto ≥90) e mantém o `matchResults` até ao landing, como na liga. Com tudo parado e minuto <45 (recovery por reconnect que recebe `cupRoundResults` sem ter visto o jogo) drena de imediato para não prender estado.
  2. Arranque da 2.ª parte emitia `cupSecondHalfStart` + `matchSegmentStart(46)` seguidos: o 1.º dispensava o painel (relógio local contava até ao snap aos 45) e sobrescrevia o `matchResults` sem equipas/posse. Agora não dispensa o painel (o 46 fá-lo com live ligada) e só preenche `matchResults` se `prev` for null.
  3. `cupExtraTimeStart` punha toda a gente no relógio 90→120. Agora só quem tem equipa empatada (`drawnTeamIds` novo no payload, com fallback para o par primário); os outros ficam nos 90' (minutos do ET já eram ignorados sem `isCupExtraTime`).
  4. Pausa pré-ET (`cupETHalfTime`) com `isPlayingMatch=false` divergia do intervalo e rearmava o efeito do sorteio pendente; agora `true` + guarda `!showHalftimePanel` nos dois ramos do apito dos 90' no Match clock.
  5. Sorteio pendente abria no commit seguinte ao apito (o landing, efeito filho, corria antes e saltava para o Jornal por baixo do modal): novo `drainPendingCupDraw()` chamado no mesmo batch do apito; o efeito de `isPlayingMatch` fica como fallback.
  6. Higiene: listener morto `cupPreMatch` removido (servidor nunca emite); `cupHalfTimeResults` ganhou guarda `inRoom()` + `setActiveTab("live")` como o da liga.
- Ficheiros: `client/src/contexts/GameContext.jsx` + `client/src/hooks/useSocketListeners.js` + `server/cupFlowHelpers.ts` (`SkillBadge.jsx` modificado na árvore é WIP alheio, não tocado).
- Checks: client `lint` só o erro pré-existente + `check:types` OK · server `typecheck` OK · `audit:socketio` 0 erros (97 avisos pré-existentes). `audit:gamestate` sem sala viva — fica para a próxima. Sem mudança estrutural de layout → sem mobile-resp-check.
- Peripécia: após o 1.º `git diff` de confirmação, os 3 ficheiros-fonte apareceram revertidos ao HEAD (mesmo mtime 13:26:20, sem stash pendente; só o `NOTES.md` foi commitado) — reaplicadas as mesmas edições e re-corridos os checks sem `git stash`. Se voltar a acontecer, suspeitar de processo externo a mexer na árvore.

## Badge único de skills SKILL·RES·FORMA (2026-09-25)

- Queixa (3 screenshots): Plantel, Tática e Intervalo mostravam skills com valores/nomes diferentes (QUALIDADE vs n.º grande vs SKILL, cada ecrã com as suas cores). Decisões via perguntas: âmbito todo o lado, conteúdo SKILL·RES·FORMA, pulse dourado sempre ligado, número principal dourado fixo.
- Novo `client/src/components/shared/SkillBadge.jsx`: retângulo de cantos arredondados, ordem fixa SKILL (âmbar, negrito, glow estático) | RES | FORMA (semáforo ≥38/≥26), `delta` ▲▼, `hideResForm`, `size md/sm`, tooltip. Pulse reutiliza o `animate-fam-glow` existente — sem keyframes novos.
- Aplicado em 9 ficheiros: `PlayerRow` (skill+RES+FOR colapsam no badge; AGR e ★ intactos), linha local da `TacticsView`, `MatchPlayerCard`, `CompactPlayerCard`, `OpponentGridCard` (respeita `hideResForm`), herói do `TransferHub` (skill dourado + coluna RES nova nas mini-stats) + `BenchPlayers`/`PitchFormation`/`SwapControls` (só skill dourado, sem espaço para o triplo). `PlayerHistoryModal` (barras) intocado.
- Peripécia (por evidência, não hipótese): keyframes novos `skill-gold-pulse` no `index.css` chumbavam o `briefing-resp-test` em paisagem (4/4 FAIL, clipping +5–14px no CompareRadar; baseline 4/4 PASS em 8 corridas) sem nenhum elemento do briefing usar a classe; removidos e tudo fica verde. Mecanismo por explicar.
- Checks: `lint` só os 2 erros pré-existentes · `check:types` OK · portrait 155/155 + landscape 186/186.

## BadgeSkills — nome + tricolor sem label SKILL, número maior, glow só no dígito (2026-09-25)

- Pedido: o badge único chama-se `BadgeSkills`, sem a label `SKILL` e com o número da skill maior; glow dourado só no número, se possível.
- Novo `client/src/components/shared/BadgeSkills.jsx`: tricolor dourado/azul/verde (skill 18px, 19px em `sm` — era 16/17 — `font-black font-headline`, sem label `SKILL` na célula dourada; delta ▲▼ mantém-se ao lado), `textShadow` mais forte só no `<span>` da skill (`0 0 10px 0.9 + 22px 0.45 + 36px 0.20`, era `12px 0.55 + 22px 0.22`). Sem `@keyframes` novos — os `skill-gold-pulse` anteriores chumbavam o `briefing` em paisagem (4/4 FAIL vs 4/4 PASS baseline). `SkillBadge.jsx` virou re-export (`export { BadgeSkills, SkillBadge }`) para não quebrar os 7 imports existentes. `cellCls` mantém `px-2 py-0.5` para não chumbar o `topwidgets` a 320px (tentativa 20/22 + `px-2.5 py-1` deu 1 FAIL em 155).
- Checks: `lint` só os 2 erros pré-existentes · `check:types` OK · portrait 155/155 + landscape 186/186.

## Taça bloqueada: ronda 3 com 5 vencedores (U7ZARI, 2026-09-25)

- Sintoma (produção): `Cup round 4 expected 4 winners, got 5` no slot 15 (Meias-finais) → revert para lobby, sala presa. Diagnóstico cego (sem acesso à BD de produção): a ronda 3 (Quartos, slot 12) ficou com 5 linhas `played=1` em `cup_matches` em vez de 4.
- Causa raiz: em `continueFromEtGate` (`server/cupFlowHelpers.ts`) o UPDATE dos penáltis (com `played=1`) e o do ET-score corriam em autocommit ANTES do `BEGIN TRANSACTION` da Fase 3. Um crash/restart entre os penáltis e o COMMIT deixava 1 linha `played=1` sem marker `finalized`; a recuperação colapsa a fase transitória para lobby com `currentFixtures=[]` e o `startWeekOnce` re-sortearia a ronda — e o `DELETE` idempotente do `generateCupDraw` só apaga `played=0`, mantendo a órfã → 1 + 4 = 5 vencedores.
- Fix (só `server/cupFlowHelpers.ts`): escritas adiadas para dentro da transação — golos do ET em memória (`_etGoalsHome/_etGoalsAway`), `played=1` sai só no UPDATE do resultado da Fase 3; guard no `generateCupDraw` recusa re-sortear ronda que já tenha linhas `played=1` (falha alto em vez de duplicar em silêncio). Prova estrutural: únicos `played=1` da Taça entre BEGIN/COMMIT (1685 entre 1545/1924; amigável 2114 entre 2089/2219).
- Reparação da sala viva: save encontrado em `server/saves/Fabio/game_U7ZARI.db` (veio no pull, commit `4ddff77e saves`). Dump confirmou tudo: ronda 3 com 5 linhas — a órfã é a `rowid 52` (Penafiel 0-0 Mafra, ET 0-0, penáltis 3-2), a ÚNICA da ronda decidida nos penáltis, i.e. o caminho que escrevia `played=1` fora da transação. As 4 canónicas (53-56) cobrem as 8 equipas distintas; vencedores finais: 21, 41, 46, 1. `DELETE WHERE rowid=52` aplicado; ronda 3 com 4/4; `game_state` lobby/calIdx 15 intacto; `applied_weeks` slot 12 `finalized` + slot 15 só `weekly_finance` (sem double-charge no retry).
- `audit:gamestate U7ZARI`: 37 erros + 22 avisos, TODOS de plantel (baseline) — idênticos antes/depois do DELETE (confirmado via `git stash`); zero erros de Taça/duplicados/fases/orçamentos.
- Peripécia: o `git stash` de confirmação + o backend local com a BD aberta deixou o `E3AQ4G.db` em conflito binário (resolvido: manter local) e dobrou o WAL para dentro do `.db` (commit inclui o `.db` + remoção dos `-shm/-wal` já inexistentes em disco). Com backend vivo, `audit:gamestate` pode dobrar o WAL — repetir audits encadeados com stash pelo meio é pedir sarilho; fazer o confirm-baseline ANTES de qualquer escrita seria o ideal.
- Checks: server `typecheck` OK · `audit:socketio` 0 erros (97 avisos pré-existentes) · `test:crash-recovery` PASS. `audit:gamestate U7ZARI` fica para a próxima (sala de produção, sem acesso local). Só servidor → sem lint/mobile.

## Fundo de balneário no ecrã de intervenção (2026-09-25)

- Pedido: foto de balneário como fundo do ecrã de pausas. 3 ficheiros: `client/public/backgrounds/intervencao.webp` (novo, 56KB — fila de cacifos com camisolas, Unsplash livre) + camada `aria-hidden` no root do `IntervencaoView.jsx` (só pausas; relato em direto intacto) + `.intervencao-backdrop` no `index.css` (receita escura das tabs com véu mais leve para a foto respirar; SEM o `scale(1.03)` do `.group-backdrop` — a escala rebentava o scrollWidth do contentor e chumbava o `intervencao-test`). Captura desktop 1280 comprova ambiente + leitura; no mobile as folhas sobrepostas são sólidas (folha transparente causava texto-sobre-texto — testado e revertido), a foto sussurra pelos translúcidos.
- Checks: eslint limpo no ficheiro · `check:types` OK · `test:mobile` 155/155 + `test:mobile:landscape` 186/186.
- Toque final: véu 55/35/70 → 60/42/75 (foto um pouco menos presente, captura 1280 verificada).

## Dropdown de divisão na classificação ao vivo (2026-09-25)

- Queixa: o `<select>` nativo do header do painel de classificação virtual (`client/src/components/live/LiveStandings.jsx`) ignorava o tema escuro (popup branco do browser, cortado em baixo, saltava da largura do painel) e truncava a label a `max-w-[7.5rem]`.
- Fix (1 ficheiro): o `<select>` virou dropdown próprio — button (mesmos tokens: `bg-surface-container-lowest`, `border-primary/30`, `text-primary`, `text-[9px] font-black uppercase`) com caret ▼ e **sem truncagem** (mostra o nome completo da divisão; o título `Virtual · J{n}` já tem `truncate` e cede espaço) + lista `absolute right-0 top-full z-20 w-max min-w-full` no tema (fundo `bg-surface-container`, item ativo `text-primary bg-primary/10`, hover `bg-surface-container-high`) + overlay `fixed inset-0 z-10` para fechar ao clicar fora. Estado `divOpen` (useState); a lógica `selectedDiv`/`viewDiv`/`availableDivs` (sem divisão 5) é intocada.
- Keyboard mínimo: Escape fecha, Enter/espaço no item focado (`tabIndex=0`) escolhe; `aria-haspopup`/`aria-expanded`/`role=listbox`/`role=option`.
- Nota: nenhum harness renderiza o `LiveStandingsPanel` (`livehero` só renderiza `LiveMatchHero`) — as 2 passagens mobile não cobrem diretamente esta mudança.
- Checks: eslint limpo no ficheiro · `check:types` OK · portrait/landscape corridos: tudo PASS exceto 5 falhas em `intervencao-test.html` (clipping +5/+6px no container do `IntervencaoView`) — **WIP de outra feature na árvore** (`IntervencaoView.jsx`, `index.css`, `intervencao.webp` untracked), esse harness não importa o ficheiro alterado.

## Tática desktop: Moral + Mentalidade empilhadas, JOGAR no topo (2026-09-24)

- Pedido: na mesma célula da Moral, por baixo, a Mentalidade; no slot da Mentalidade, o botão JOGAR JORNADA; o pitch sobe por consequência. Decisões via perguntas: Moral simplificada (sem etiqueta no header, sem N/100, com brilho) + botão com altura própria ao topo + dois sub-cabeçalhos.
- Só `client/src/views/TacticsView.jsx` (transplantes, lógica intocada): TOPO 2 (`flex-1`) vira célula dupla sempre renderizada — secção Moral (header só «Moral», etiqueta grande com `textShadow currentColor` + barra `h-2.5` com `drop-shadow currentColor`, tudo no tom do escalão; sem etiqueta no header nem número) sob guard `nextMatchSummary`, divisor `border-b`, e secção Mentalidade verbatim (pill + blurb); TOPO 3 (`xl:w-72.5`, `self-start`) recebe o botão verbatim da COL 3 (`data-tour="tactic-play"`, `playLabel`, legendas); COL 3 fica só com o pitch.
- Harness `tactics-resp-test.jsx`: o fake MORAL desktop saiu (a célula existe sempre — a moral só acrescenta altura, nunca largura); o fake mobile mantém-se (cartão separado, afeta a largura da linha).
- Peripécias: cirurgia por script python por âncoras (`edit` falha match com backtick/`${}`); o intervalo TOPO2→LINHA engoliu o `</div>` de fecho da faixa (esbuild/eslint apanhou, reposto); o 1.º assert do script estava errado (contava um comentário removido — a cirurgia estava certa).
- Checks: eslint limpo nos 2 ficheiros · `check:types` OK · portrait **155/155** + landscape **186/186** · screenshot 1280 revisto (Mentalidade no meio, JOGAR em cima à direita, pitch em baixo).

## StadiumTab: mood dos adeptos só com etiqueta (2026-09-24)

- Pedido: eliminar o valor numérico do cabeçalho do mood dos adeptos, ficando só a etiqueta textual.
- Fix (1 linha, `client/src/views/StadiumTab.jsx`): o span da direita passou de `{fansMoodLabel} · {fansMood}` → `{fansMoodLabel}`. O valor continua comunicado pela barra de progresso e pelas cores por escalão (≥70/≥45/abaixo).
- Checks: eslint limpo no ficheiro tocado (`lint` global só os 2 erros pré-existentes) · `check:types` OK. Tweak de texto → sem mobile-resp-check.

## Assistência Média histórica, sem reset (2026-09-24)

- Pedido: contar todos os jogos em casa (liga + Taça + amigáveis) e sem reset no fim da época. Decisões via perguntas: histórico total acumulado + sub só com o total de jogos.
- Servidor (`server/socketSessionHandlers.ts`, `requestFinanceData`): 2 campos novos `allTimeHomeMatches` + `allTimeTotalAttendance` (COUNT+SUM sem filtro de época em `matches` + `cup_matches`; o amigável vive em `cup_matches` round 0 e já conta). Campos por época intactos — o `FinancesTab` não muda. Fallback: DB antiga sem coluna `attendance` mantém a média da época atual; erro global emite os novos campos a 0.
- Cliente (`client/src/views/StadiumTab.jsx`): média = `round(allTimeTotalAttendance / allTimeHomeMatches)` com fallback para `totalHomeMatchesPlayed`/`homeMatchesPlayed` + soma do `ticketBreakdown`; sub = `N jogo(s) em casa`. De passagem, corrige o divisor antigo (somava liga+Taça e dividia só pela liga).
- Checks: server `typecheck` OK · client `lint` só os 2 erros pré-existentes · `check:types` OK · `audit:socketio` 0 erros (97 avisos pré-existentes) · prova sintética sqlite: época atual 2 jogos/9500 vs all-time 6 jogos/6667 (inclui amigável) + fallback sem coluna OK. Sem sala viva com jogos → `audit:gamestate` fica para a próxima. Só números → sem mobile-resp-check.

## Pitch do rescaldo: fotos reais em vez de SVG (2026-09-24)

- Queixa: o pitch do artigo de rescaldo no Jornal desenhava os rostos SVG (avatar gerado) em vez das fotos reais dos jogadores.
- Causa: `computeSideRatings` (`server/game/ratings.ts`) persistia `RatingRow` **sem** `photo` — o `PlayerAvatar` do `PostMatchPitch` cai no SVG quando `photo` é `null`.
- Fix (só `ratings.ts`): `RatingRow` ganhou `photo: string | null`; titulares `p.photo ?? rosterById.get(p.id)?.photo ?? null`, suplentes entrados/saídos `rosterById.get(id)?.photo ?? null` (roster = `SELECT * FROM players`, já traz `photo`).
- Cliente intocado: o `photo` já flui por spread no `PostMatchPitch` → `PitchFormation` → `PlayerMarker` → `PlayerAvatar`.
- Notas antigas (já persistidas sem `photo`) continuam com SVG — snapshot histórico, sem lookup global de fotos no cliente.
- Checks: server `typecheck` OK · `test:ratings` PASS. Só server → sem lint/mobile client.

## Uma única notícia semanal de finanças por equipa (2026-09-24)

- Pedido: as 2 notícias de empréstimo (`loan_interest` + `loan_principal`) viram 1 resumo semanal de finanças, com receitas + gastos além do empréstimo. Escolhas: só equipas com treinador humano; rubricas pormenorizadas; sem `amount` (tudo na `description`); menção "Empréstimo liquidado esta semana." quando a prestação zera a dívida.
- Fix (`server/weeklyFlowHelpers.ts`, `applyWeeklyFinancesOnce`):
  - O SELECT pré-atualização (antes `id, loan_amount, division`) agora traz também `stadium_capacity`, `is_human` (JOIN `managers`) e salários por equipa — e a segunda query `SELECT id FROM teams` foi removida (o loop de notícias vive no mesmo callback).
  - Os 2 `logClubNews` de empréstimo viram 1 `logClubNews(game, "weekly_finance", "Resumo Financeiro da Semana", …, { description })` por equipa com `is_human=1`. O builder puro `buildWeeklyFinanceSummary` (exportado, no topo do ficheiro) formata com o mesmo `Intl` pt-PT EUR do cliente: `Receitas · Salários · Manutenção do estádio [· Juros · Capital do empréstimo] · Saldo da semana [· Empréstimo liquidado esta semana.]`.
  - Valores idênticos ao UPDATE (mesmas fórmulas: juros 1,5% `floor`, prestação `loanInstallment(div)`, manutenção `trunc((seats-3000)×1.5)`); idempotência mantém-se pela `applied_weeks` (o INSERT da notícia corre dentro da mesma transação, antes do marker).
- Cliente (`client/src/utils/inboxItems.js`): novo ramo `weekly_finance` no `newsArticle` (3 variantes, usa a `description` como detalhe, sem `value`). Ramos legados `loan_interest`/`loan_principal` mantidos para linhas antigas em BDs existentes.
- Sem `amount` → o `ClubTab` mostra a linha sem valor (o `INCOME_TYPES` só pinta `amount > 0`); o feed do Jornal já não filtra `weekly_finance` (não está no `NOT IN` de ruído).
- Checks: server `typecheck` OK · self-check do builder (3 casos: sem dívida, com dívida, liquidação) OK · client `lint` só os 2 erros pré-existentes · `check:types` OK · `test:connect-smoke` OK · `audit:socketio` 0 erros · `audit:gamestate E3AQ4G` 45/20 idênticos ao baseline (pré-existentes na save). Layout intocado → sem mobile-resp-check.

## Prémios da época anterior presos no topo do Jornal (2026-09-24)

- Queixa: notícias dos prémios da época anterior no topo das recentes, semana após semana.
- Causa: `applySeasonEnd` (`server/cupFlowHelpers.ts`) gravava os 5 prémios (Campeão Nacional, Campeões de divisão, Patrocinadores, Melhor Marcador, Bónus de Subida) com `year+1/matchweek 1` mas sem `slot` — o `logClubNews` herdava o slot da última semana da época velha (20). O Jornal ordena por ano/slot desc, por isso na época nova os prémios (ano atual, slot 20) ficavam acima de tudo a época inteira.
- Fix: `slot: 1` nas 5 chamadas + `UPDATE club_news SET slot = 1 ...` idempotente no arranque de sala (`gameManager.ts`, só `type='prize'` + `matchweek=1` + títulos de fim de época — prémios da Taça a meio da época usam o slot corrente e ficam intactos). Na semana 1 os prémios caem para o fundo (created_at mais antigo) e descem naturalmente.
- Checks: server `typecheck` OK · prova sqlite da ordenação antes/depois OK. Cliente intocado → sem lint/mobile.

## Tática desktop: cartões Moral/Mentalidade sem espaço morto (2026-09-24)

- Queixa (screenshot 1578×729): os cartões MORAL e MENTALIDADE da faixa de topo esticavam à altura da Formação com o conteúdo (1 linha) colado ao topo — ~80% espaço morto; 3 estruturas de header diferentes lado a lado; pill da Mentalidade em gradiente "fantasma"; barra da Moral com 6px e sem número.
- Fix (só `client/src/views/TacticsView.jsx`, ambos os cartões `hidden xl:flex`):
  - MORAL: header unificado (label + border-b, como os outros) + corpo `flex-1` centrado: label a `text-lg`, barra `h-2`, valor `N/100` em baixo — espelha o cartão mobile.
  - MENTALIDADE: pill com fill sólido (alpha 0.28, border 0.55–0.6 — sem gradiente fantasma), texto inativo `gray-500→gray-400`, e 1 linha de blurb do estilo ativo ("Bloco baixo, sair a contragolpe." / "Equilíbrio no meio, sem extremos." / "Pressão alta, campo todo a favor.") — preenche a vertical com informação, como o blurb da Formação. As 3 cores semânticas mantêm-se (padrão já usado no mobile e em `TacticsButtons.jsx` do dia de jogo).
  - Ambos os wrappers ganharam `flex flex-col` para o corpo `flex-1` preencher.
- Harness `tactics-resp-test.jsx`: a injeção do cartão MORAL look-alike (o fixture não tem `nextMatchSummary`) agora corre nas 2 linhas (mobile + desktop `hidden xl:flex`), com fake desktop fiel ao cartão real — a 1280 a linha de 3 cartões verifica-se por fim.
- Checks: client `lint` só os 2 erros pré-existentes · `check:types` OK · harness tactics portrait 5/5 PASS + 1280 PASS (overflow=0, clippedRows=0) · screenshot 1280 visto. Só `xl:` (a faixa é `hidden xl:flex`) + tweaks de conteúdo/className → sem passagem de paisagem obrigatória.

## Pitch do rescaldo: plantel inteiro no relvado (2026-09-24)

- Queixa (screenshot): o pitch do artigo de rescaldo no Jornal mostrava 17 jogadores (2 GR, 6 DEF, 5 MED, 4 ATA) e a linha "Entramedos" vazia.
- Causa: `computeSideRatings` (`server/game/ratings.ts`) marcava **todo** o snapshot do lineup (11 titulares + 7 suplentes) com `starter: true`; o `PostMatchPitch` põe no relvado quem tem `starter === true`.
- Fix (só `ratings.ts`): o snapshot final é `[...em campo agora, ...banco]` — as trocas substituem no lugar (o suplente herda o slot do titular, o saído some). O XI original agora se reconstrói: 11 primeiros do snapshot, menos quem entrou (`playerId` de `substitution`/`halftime_sub`), mais quem saiu (`outPlayerId`, já tratado no ramo de eventos). `starter = inXI && !cameOn`.
- Efeito colateral (a boa): o banco que não entrou já não recebe 3★ nem `last_rating = 3` — mantinha o que tinha, como a doc do módulo sempre disse.
- Cobre liga + Taça + amigáveis (todas chamam `computeMatchRatings`). `test:ratings` +3 asserts (XI no relvado, suplente entrado não-titular, banco sem classificação) · server `typecheck` OK. Só server → sem lint/mobile client.

## Briefing: botão «Avançar para a Tática» em largura cheia (2026-09-24)

- Queixa: o botão de avançar estava feio e descentrado no cartão do briefing.
- Causa: o `PrimaryCTA` tinha `w-full lg:w-60` — no desktop encolhia para 240px fixos e, dentro do contentor `flex-col items-stretch` do `PrepCtaCard`, encostava à esquerda. O `lg:w-60` era um resto de um contexto antigo; o componente hoje só é usado neste cartão, cuja intenção original era largura cheia.
- Fix (1 classe, só `client/src/components/shared/PrimaryCTA.jsx`): sai o `lg:w-60`, fica `w-full` sempre.
- Animação (pedido seguinte): classe `animate-heartbeat` existente (a mesma do botão Jogar) no `PrimaryCTA` — pulsar em ciclo, sem CSS novo.
- Checks: eslint limpo nos ficheiros tocados (`lint` global só os 2 erros pré-existentes), `check:types` OK. Tweaks pontuais → sem mobile-resp-check.

## Tática desktop: Moral ↔ Mentalidade trocadas de coluna (2026-09-23)

- Pedido (screenshot anotado): o Moral vai para o meio (sobre os Suplentes), a Mentalidade para a 3.ª coluna (sobre o JOGAR/Campo), e o JOGAR sobe para o topo da 3.ª coluna.
- Só `client/src/views/TacticsView.jsx`: na faixa de topo desktop (`hidden xl:flex`) trocados os blocos TOPO 2/TOPO 3, mantendo a largura de cada slot (meio `flex-1`, direita `xl:w-72.5`) — o JOGAR já estava no topo da COL 3 e sobe sozinho. Mobile intocado (o mobile já era Moral | Mentalidade, o desktop fica consistente).
- Checks: eslint do ficheiro limpo (os 2 erros do `lint` são pré-existentes noutros ficheiros), `check:types` OK, portrait 155/155 + landscape 186/186.

## Tática desktop: controlos em faixa de topo + botão Jogar centrado (2026-09-23)

- Pedido: em `xl`, os elementos da 1.ª coluna (Moral + Formação + Mentalidade) passam para o topo em linha, um cartão por coluna (Titulares | Suplentes | Pitch); redesenhar o botão Jogar (descentrado/feio).
- Só `client/src/views/TacticsView.jsx`: COL1 passa a `xl:hidden` (mobile intocado); nova faixa `hidden xl:flex` com TOPO 1 Formação (reutiliza os chips horizontais + estrelas do mobile, mais o blurb da ativa), TOPO 2 Mentalidade (pill, verbatim) e TOPO 3 Moral (verbatim); linha de baixo `flex-1 flex-col md:flex-row xl:gap-3` com Titulares (`flex-1`) | Suplentes (`flex-1`) | COL3 (`xl:w-72.5`) — mesmos fatores flex + mesmo `gap-3` => colunas alinhadas; `data-tour="tactic-lineup"` e `animate-heartbeat-border` mudam para o TOPO 1. Botão Jogar: `inline-flex items-center justify-center` + ícone ▶ (só quando clicável) + label em `span.relative` por cima do overlay.
- Armadilhas: `edit` falha match com backtick/`${` no `oldText` (sonda com `X` revertida a seguir) — cirurgia via script python por âncoras; faltou 1 fecho `</div>` do contentor exterior (esbuild apanhou); bloco mobile da Formação foi movido em vez de duplicado na 1.ª tentativa (mobile sem seletor) — revertido e refeito a duplicar.
- Checks: eslint limpo no ficheiro (os 2 erros do `lint` são pré-existentes noutros ficheiros, confirmado via stash) · `check:types` OK · portrait **155/155** + landscape **186/186** (harness `tactics-resp-test` incluído) · screenshots vistos (390, 667 e 1280; a Moral não aparece a 1280 porque o harness não tem `nextMatchSummary` — injeta uma carta look-alike só no mobile; TOPO 3 é transplante verbatim do bloco que renderizava).

## Classificação 1–5★ pós-jogo: modal, Plantel e pitch no rescaldo (2026-09-23)

- Pedido: estrelas da **última classificação** visíveis no modal do jogador, na lista do Plantel e no fim do corpo da notícia de rescaldo (pitch com titulares + entrados). Escala 1–5 inteiros; quem não joga mantém a última nota.
- Backend: novo `server/game/ratings.ts` — base 3★ + pesos `MOM_WEIGHTS` (agora exportado de `mom.ts`), conversão `score/15` → clamp 1–5; participantes = snapshot do lineup ∪ entrados (`substitution`/`halftime_sub`) ∪ saídos ao intervalo (`outPlayerId`); juniores (id<0) excluídos. `persistLastRatings` grava `players.last_rating` (coluna nova, migração no loop do `gameManager.ts`) em ≤5 UPDATEs por equipa, idempotente → replay-safe. Amigáveis também gravam (modal/notícia coerentes), apesar de fora das estatísticas de jogador.
- Rescaldo: campo opcional `ratings` no JSON `v:1` de `logPostMatchRecap` (`coreHelpers.ts`); 6 call sites (2 liga em `matchSummaryHelpers`, 2 taça + 2 amigável em `cupFlowHelpers`). Notícias antigas sem `ratings` → artigo simples, sem pitch.
- Frontend: `Stars.jsx` (novo, partilhado) · `PlayerHistoryModal` linha "Última classificação" em Atributos · `PlayerRow.showLastRating` ativado só em `PlayersTab` · `PostMatchPitch.jsx` (novo) reusa `PitchFormation` (mostra `player.rating` no placard quando definido) + linha "Entraram: …" · `JournalTab` renderiza `article.pitch` após o corpo como campo separado (o splitter de parágrafos engoliria uma part).
- Harnesses: `journal-resp-test` — expectativa pré-existente obsoleta corrigida (título "Contas bancárias" → variante atual "Crédito"; falhava já no HEAD, confirmado via stash) e `inboxBadge` movido para antes dos checks que clicam (clique marca como lida); fixture de postmatch ganhou `ratings` (exercita o pitch). `mobile-resp-test`: fixture com `last_rating` 5/1/4/ausente.
- Checks: server `typecheck` exit 0 · novo `npm run test:ratings` (12 asserts) PASS · `audit:socketio` 0 erros (97 warnings pré-existentes) · `audit:gamestate TST148` 0 erros · client `check:types` OK · `lint` só os 2 erros pré-existentes (`landing-resp-test.jsx`, `GameContext.jsx` — não tocados, eslint é por-ficheiro) · mobile retrato **155/155** + paisagem **186/186** · screenshots vistos (Plantel ★★★★★, pitch em retrato e paisagem).

## Lesões no Jornal: gravidade + total de semanas (2026-09-23)

- As notícias de lesão agora indicam gravidade (grave = 3+ sem, leve = 1) e o total de semanas de baixa, com regresso previsto (`until + 1`).
- Fórmula: `semanas = until - slot` (slot = semana em que a lesão aconteceu; engine grava `injury_until = currentMatchweek + injuryWeeks` e `currentMatchweek = slot`).
- `server/coreHelpers.ts` (`logMedicalNews`): `slot: slot ?? currentSlot(game)` — lesões de semanas de Taça guardavam slot NULL e o total não era derivável.
- `client/src/utils/inboxItems.js`: helper `injuryTexts` (3 pares título/corpo, `newsVariant(n, 3)`); `medicalArticle` usa-o quando `until - slot >= 1`, senão fallback ao texto antigo (linhas legadas sem slot).
- Item transitório (`squadToMedicalItems`): acrescenta "N semanas de baixa" (semanas restantes, sempre verdadeiro).
- Suspensões intocadas (castigo fixo de 2 jornadas, nada a acrescentar).
- Checks: server `typecheck` OK, client `lint` só os 2 erros pré-existentes, `check:types` OK, smoke test node (grave/leve/legado/variantes/suspensão/transitório) OK.

## Eliminado da Taça: sem briefing, só cartão 🏆 (2026-09-23)

- Queixa: em semana de Taça sem jogo próprio, o JOGAR mostrava o briefing espião antes do cartão de eliminado.
- Só `client/src/views/TacticsView.jsx`: `showBriefing` e `showBackToBriefing` perderam a exceção `|| hasSpyGames` (variável removida, só lá era usada) — o espectador eliminado cai direto no cartão 🏆 + "Ver jogos da Taça".
- Checks: client `lint` só os 2 erros pré-existentes (confirmado via `git stash`), `check:types` OK. Sem mudança estrutural → sem `mobile-resp-check`.

## Fix crash Taça: `roundLabel` indefinido em `continueFromEtGate` (2026-09-23)

- Erro no docker (`backend-1`): `ReferenceError: roundLabel is not defined` em `continueFromEtGate` (via `finalizeCupRound`), transação da Taça rebentava a meio.
- Causa: a função define `roundName` mas 4 usos referenciam `roundLabel` (prémio da Taça 2x + shorthand `roundLabel` em 2x `logPostMatchRecap`). O `typecheck` não apanhou (check frouxo no ficheiro).
- Fix (1 linha, só `server/cupFlowHelpers.ts`): `const roundLabel = roundName;` a seguir a `roundName` — corrige os 4 usos de uma vez, incluindo o shorthand esperado pelo `logPostMatchRecap`.
- Checks: server `typecheck` OK, `build` OK (`dist/cupFlowHelpers.js` com `roundLabel` definido). Sem sala viva → `audit:gamestate`/`audit:socketio` ficam para a próxima sala. Sem cliente → sem lint/mobile.

## Textos do Jornal: mais variação por notícia (2026-09-23)

- Pedido: melhorar todos os textos que aparecem no Jornal (`JournalTab.jsx`) e acrescentar mais variações para as mesmas notícias.
- Só `client/src/utils/inboxItems.js` (as notícias são geradas no cliente; o servidor só grava `type`/`title`/`description`/`amount`).
- `MOOD_COPY`: 2 → 4 parágrafos por mood (16 textos novos, tom editorial CM2001). `buildMoodNewsBody` agora escolhe 2 parágrafos diferentes por seed determinística (`roundLabel|variant|marcador`) em vez de `copy[0]+copy[1]` fixos; frase final também varia. Sem seed aleatória → o mesmo rescaldo persistido mantém o mesmo texto.
- `newsVariant(n, count)` (seed `Math.abs(id) % count`) estendido a todos os ramos de `newsArticle` que tinham texto único: financeiros semanais (3 títulos + 3 corpos), empréstimos (3), estádio/academia/renegociação/corte/taça/prémio/bem-vindo/fallback (3 corpos cada). `transfer_in` (4), `transfer_out` (3) e `auction_failed` (2) já variavam.
- `useInbox.js` intocado: os itens transitórios (pedido de contrato, convite, aviso) são prompts funcionais curtos ligados a botões, sem id estável para variação — ficam como estão.
- Checks: client `lint` limpo no ficheiro (só os 2 erros pré-existentes em `GameContext.jsx`), `check:types` OK, smoke test: variantes determinísticas por id, ciclo correto, todos os ramos novos exercitados.

## Treino posicional mais rápido só para humanos (2026-09-22)

- Pedido: fazer do treino uma fonte de receita (viveirismo) com treino posicional mais rápido. Diagnóstico: o travão real é o teto de potencial (seed: skill +0..3, craques +4..8 — um miúdo 5→8 numa semana e depois para), não a velocidade; decidido via perguntas: só velocidade (ganho 5→8), todo o plantel, só humanos, teto intocado.
- Só `server/trainingHelpers.ts`: `humanTeamIds` (via `playersByName`, mesma técnica do foco NPC) e `gainBase` 8 vs 5 no ganho posicional; Forma/Resistência e tetos iguais para todos.
- Checks: server `typecheck` OK, `audit:socketio` 0 erros (97 avisos pré-existentes). Sem cliente → sem lint/mobile. Nota: com o teto mantido, cada jogador chega ao mesmo teto ~1 semana mais cedo — o lucro por jogador não muda; viveirismo a sério exigiria margem de potencial nos jovens.

## Economia das divisões baixas: tese + 5 medidas (2026-09-22)

- Tese pedida pelo dono: números reais da `base.db` mostravam a D5 como única divisão em défice estrutural (−120k€/época, colchão inicial de 500k), com os mesmos custos da D4 (mesma skill, mesmos salários, mesmo estádio 5k) mas metade da receita; campeão distrital ganhava 0€ (CHAMPION_PRIZE só 1–4); Taça winner-takes-all; visitante com 0€; prestação fixa 35k/sem = 3 mesadas na D5; manutenção 1,5€/lugar = 62% da mesada D5.
- Medidas (só servidor, sem cliente/layout): 1) mesada D5 12k→20k + patrocínio D5 250k→400k (`gameConstants`); 2) `CHAMPION_PRIZE[5]=125k` (loops `[2,3,4]`→`[2,3,4,5]`, resumo `[1..5]`) + bónus de subida 100k por promovida (mesma transação + notícia `prize` + systemMessage); 3) `CUP_ROUND_PRIZE` 25k/50k/100k/200k (R1–R4, a final mantém 500k) a quem avança; 4) `AWAY_TICKET_SHARE=0,15` na liga (`weeklyFlowHelpers` + rescaldo `matchSummaryHelpers`) e na Taça; 5) `STADIUM_UPKEEP_EXEMPT_SEATS=3000` + `LOAN_INSTALLMENT_BY_DIVISION` 50k/40k/30k/20k/15k (CASE no SQL, diário via `loanInstallment`). `npcStructuralBreakEvenFolha` herda as receitas novas sem mexer.
- Novo balanço garantido/época (antes de bilheteira/prémios): D1 −95k, D2 +254k, D3 +404k, D4 +517k, D5 +325k — hierarquia preservada, D5 viável mas ainda a mais pobre a seguir à D1 (que vive da bilheteira gigante).
- Espelho do `crashRecoveryRegression.mts` atualizado (mesada D5, CASE do empréstimo, isenção) — sem isto o E2E falhava.
- Checks: server `typecheck` OK, `audit:socketio` 0 erros (97 avisos pré-existentes), `test:crash-recovery` OK. `audit:gamestate` fica para a próxima sala viva. Cliente intocado → sem lint/mobile-resp-check.

## Corpo do Jornal em Newsreader + sorteio da Taça em tabela (2026-09-22)

- Queixa: o corpo das notícias parecia feio (serif por defeito, sem justificação, a tocar as bordas) e o mail do sorteio da Taça mostrava uma lista seca.
- `index.css`: importa Newsreader (serif do Google para leitura longa) + token `--font-newsreader` no `@theme` (o build gera a utility `font-newsreader`).
- `JournalTab.jsx`: wrapper do corpo + `RichParagraphs` passam a `font-newsreader` + `text-justify` + `lg:px-6` (margens laterais de 1.5rem só no desktop); capitular também em Newsreader (`first-letter:`).
- Novo `CupDrawTable` no `JournalTab.jsx`: colunas Jogo · Casa · Fora, equipas clicáveis, linha do jogo do treinador destacada (📍 + tinta dourada), mesmo padrão da `LeagueFinalTable`; renderiza no detalhe em vez da lista quando `facts.fixtures` existe — o texto do corpo fica guardado para a pesquisa.
- `useInbox.js`: o item live do sorteio passa a carregar `facts: { fixtures, viewerTeamId }` (mesmo shape do item persistido) para a tabela saber qual é o jogo do treinador.
- Harness `journal-resp-test`: `checkDrawDate` atualizado para o contrato novo (tabela com 2 linhas, 4 nomes, 📍) — o antigo assertava a lista no corpo.
- Checks: `lint` só os 2 erros pré-existentes, `check:types` OK, portrait 155/155, landscape 186/186, build Vite OK.

## Datas do Jornal = semana do calendário, não jornada da liga (2026-09-21)

- Queixa: datas erradas nas notícias. Levantamento: `club_news.matchweek`/`transfer_history.matchweek` é a jornada da liga — só avança nas jornadas e só no fim delas (`weeklyFlowHelpers.ts`), por isso a semana de Taça herda o número da jornada seguinte. Evidência em `game_FGPQH6.db` (`weekly_income`, época 2031): `1,2,3,4,4,5,6,7,7,8,9,10,10,11,12,12,13,14,15` — Taça dos 16 avos e J4 ambas «S4», final da Taça em «S15»; 718 linhas com `matchweek=15`. A UI misturava ainda escalas: persistidas `S{matchweek}` vs transitórias + cabeçalho (`GameLayout`) `S{calendarIndex+1}`.
- Fix (plano A aprovado): coluna `slot` (semana 1..20) em `club_news` e `transfer_history` (`db/schema.sql` + 2 `ALTER TABLE` em `gameManager.continueAfterMigrations`), gravada com `currentSlot(game)` por `logClubNews`/`logClubNewsOnce`/`logMedicalNews`/`logPostMatchRecap`/`recordTransfer` e nos inserts crus (`welcome`, `stadium_build`). O fecho da jornada passa o slot explícito (`slotForLeagueMatchweek` em `matchSummaryHelpers` e `logLeagueFinalStandings`) porque o calendário já avançou quando a notícia é gravada. `logClubNewsOnce` desduplica por slot — o `matchweek` repetido fundia dois avisos de semanas diferentes (`slot IS NULL AND matchweek = ?` mantém a compatibilidade com linhas antigas). `getGlobalNews` expõe e ordena por `slot`; cliente `formatNewsDate` mostra `S{slot}` com fallback para `matchweek` (linhas antigas ficam com a data antiga — irrecuperável).
- Teste novo: `server/scripts/newsSlotRegression.mts` (`npm run test:newsslot`, 5/5 — mapeamento jornada→semana, gravação na semana da Taça, desduplicação Taça vs jornada, compatibilidade legado, `transfer_history`).
- Checks: server `typecheck` OK + `test:newsslot` 5/5; client `lint` só os 2 erros pré-existentes, `check:types` OK. Sem sala viva → `audit:gamestate` fica para a próxima; sem mudança de layout → sem `mobile-resp-check`.

## Zebras: skill e forma máxima pesam mais no motor (2026-09-21)

- Queixa: equipas de skill mais baixa venciam com facilidade, mesmo com forma e resistência no máximo. Sonda sintética (`/tmp/sonda-baseline.mts`, 4000 jogos, removida) confirmou: skill 35 vs 25 dava só 55,7% de vitórias; forma máxima vs neutra (skill igual) só +4pp (39,8% vs 32,9% derrotas). Causas: ataque = só média dos avançados, forma com teto 0,85–1,15 (+15% no máximo), resistência sem efeito direto na força (só escape de fadiga/lesão), 30 chances com conversão estreita.
- Fix só com pesos (âmbito aprovado: sem rever o modelo ATA-vs-DEF): `formFactor` 0,85–1,15 → 0,75–1,35 (`matchCalculations.ts`); `MATCH_TUNING` (`gameConstants.ts`): `possePerPoint` 0,0075 → 0,014 (gap de médios vira chances), `chanceDefWeight` 1,2 → 1,6 + `chanceGoalBase` 0,175 → 0,21 (gap abre o marcador, total parado), `fatigueSkipPerResPoint` 0,00816 → 0,012 (resistência máxima evita ~60% do desgaste, antes ~40%).
- Depois: skill 35 + forma máxima vs 25 → 72,1% V; gap puro → 65,3% V; forma máxima (skill igual) → 46,5% V / 26,9% D (+19,6pp de spread, era +6,9pp); gap pequeno 35 vs 30 fica ~50% (moeda honesta). Total de golos estável (~2,4–2,8/jogo, banda-alvo 2,5–3,5).
- Checks: server `typecheck` OK, `test:engine-unit` 19/19, `audit:socketio` 0 erros (97 avisos pré-existentes). `audit:gamestate` fica para a próxima sala viva (sem código de sala no reporte). Sonda era temporária em /tmp (removida).

## Kick do admin a meio do jogo destrava congelamento (2026-09-19)

- Decisão de brainstorming: treinador desaparecido de vez a meio da simulação deixava a sala congelada sem prazo (kick só valia em lobby). Agora o `kickCoach` vale em qualquer fase — desbloqueio sempre por decisão humana explícita. Tolerância 25s e espera sem limite no intervalo mantêm-se.
- Só `server/socketGameplayHandlers.ts`: saiu o gate `gamePhase !== "lobby"`; janelas de decisão pendentes da equipa finalizadas com fallback `"auto"` (sem isto, o relógio da janela rearmava-se para sempre porque a presença de um expulso nunca volta); `checkAllReady` pós-kick alargado a `match_halftime`/`match_et_gate` (a barreira de minuto já destravava via `emitPresencePause`).
- Teste: `sessionFreezeRegression` ganha F10 (assento libertado resolve `waitForPresence` pendente + persiste `kicked`).
- Checks: `typecheck` OK, `test:session-freeze` 10/10, `test:connect-smoke` OK, `audit:socketio` 0 erros (97 avisos pré-existentes).

## Quebra do servidor volta sempre ao lobby, sem tática (2026-09-19)

- Decisão por brainstorming: a retoma no minuto era a maior fonte de instabilidade (checkpoint/segmento a meio, payloads de intervalo, ready+tática partidos). Quebra a meio → lobby do slot, jogo descartado, sem tática; rejoga-se do 0. Igual para liga/Taça/amigável; só slot já finalizado avança (`recoverFinalizedSlot`).
- Servidor: `gameManager` dobra qualquer fase de jogo para lobby DEPOIS do replay de eventos (o replay podia repor `match_first_half`), com `resetAllReady` + `clearSeatPositions` + `saveGameState`; removidos `resumeInterruptedMatch` (+ fiação em `index.ts`/`socketSessionHandlers.ts`), `save/applyMatchCheckpoint` e `lastSimulatedMinute`; chaves legadas limpas no load. Congelamento por ausência (`waitForPresence`) intocado.
- Testes: `crashRecoveryRegression` ganha S5 (quebra em `match_second_half` com Pronto+11 → lobby, minuto/fixtures/payloads limpos, 11 apagado no assento e na projeção, fase persistida); `sessionFreezeRegression` F8 passa a `clearSeatPositions`, F9/F10 do checkpoint saem, `resetAllReady` vira F9. Docs: `CRASH.md` + `CLAUDE.md`.
- Checks: server `typecheck` OK, `test:session-freeze` 9/9, `test:crash-recovery` OK (S0–S5), `test:connect-smoke` OK, `audit:socketio` 0 erros (97 avisos pré-existentes), `audit:gamestate TST148` 0/0/0. Cliente intocado → sem lint/mobile-resp-check.

## Corpo das notícias em registo de imprensa clássica (2026-09-19)

- Queixa: o corpo parecia «jornal da escola primária» — manchete com o mesmo tamanho do texto corrido, parágrafos todos iguais, sem hierarquia. Decisões via perguntas: imprensa clássica sem texturas, detalhe completo (media+tabela+ações), entrada com capitular, emojis 📅⏱️ mantidos.
- Só `client/src/views/JournalTab.jsx`: manchete `text-base tertiary` → `text-xl on-surface` com `text-balance`; primeiro parágrafo vira entrada (`text-lg` + capitular `first-letter:` na cor da categoria via novo `cap` em `FILTER_TONES`, só com ≥140 carateres — avisos de uma linha ficam uniformes); `space-y-3` → `space-y-4`; filetes (`border-t`) entre media/corpo e antes das ações (o bloco de ações só renderiza com `kind` acionável — acaba a `div` vazia); media como cartão-figura (avatar `mdR`→`md` 64px, crest `sm`→`md`, legendas `text-xs`); tabela com cabeçalho em caps + `tabular-nums`.
- Peripécias: a edição ao comentário de topo comeu o `*/` (45 erros `no-undef`, imports dentro do comentário — fix de uma linha); `text-on-surface` + cor da categoria no mesmo `<p>` anulava a capitular colorida (o token vencia no cascade — saiu o `text-on-surface` do lead; `all` já resolve para `text-on-surface` via `cap`). Captura enganadora despistada por evidência: o harness auto-clica linhas (~2.5s), por isso screenshots tardios mostram a seleção dele e não a do script — cliques cedo ou leitura do `h2` para despistar.
- Checks: eslint limpo, `check:types` OK, build gera `first-letter:` + `text-balance`, harness retrato `5/5` + paisagem `6/6`, screenshots 390/1024 revistos (entrada âmbar com capitular, cartão-jogador, ações sob filete).

## Jornal: entrar seleciona a mais antiga sem a marcar como lida (2026-09-19)

- Queixa: após o jogo, o Jornal abria na notícia mais recente com tudo marcado como lido. Pretendido: entrar seleciona a não-lida mais antiga e as não-lidas ficam por ler até seleção explícita.
- Causa: o efeito de montagem (`initialReadRef` no `JournalTab.jsx`, regra "notícia inicial fica logo lida" de 2026-09-15) chamava `select(selected.id)` sem clique; cada entrada na tab consumia uma não-lida em silêncio e o fallback caía em `items[0]` (mais recente) quando já não havia não-lidas.
- Fix só no cliente: removido o efeito + destruturados mortos (`isUnread`, `select`, `initialReadRef`); a seleção derivada (mais antiga por ler) mantém-se como apresentação. Decisões via perguntas: "Ler próxima"/Enter-Espaço continuam a marcar atual+próxima; 🚩 sem exceção (mais antiga por ler, com o aviso no topo a denunciar a pendência). `useInbox.js` intocado.
- Harness `journal-resp-test` estava vermelho no master desde o redesign/paginação (confirmado com stash): fixture sem `seasonYear` excluía as linhas sem ano; asserts liam só o primeiro `<p>` (corpo agora multi-parágrafo); esperas de 60ms perdiam para a animação do detalhe (~180ms saída+entrada). Reparação mínima: `seasonYear: 2026` na fixture, helper `detailBody()` (todos os `<p>`), esperas 60→500ms nos cliques de detalhe, `checkSharedReads` a exigir selecionada-mas-por-ler (`font-black`, badge só baixa no clique).
- Checks: client `lint` só os 2 erros pré-existentes, `check:types` OK, harness Jornal retrato `5/5` + paisagem `6/6`. Sem mudança de layout → sem `mobile-resp-check` completo (o runner do harness cobre-o).

## Skill verify-before-done (2026-09-19)

- Nova skill `.pi/skills/verify-before-done/SKILL.md`: matriz mínima mudança → checks (typecheck, connect-smoke p/ `index.ts`, audits, session-freeze, lint, check:types, mobile-resp-check, regressões) + regras (só saída real conta, salto legítimo regista-se, falha pré-existente confirma-se com stash, NOTES.md antes do commit). Escolhida via perguntas: verificação pré-feito primeiro, âmbito mínimo, com NOTES.md.
- Só docs → sem typecheck/lint.

## Auditoria e fixes ao redesign do Jornal (2026-09-18)

- Auditoria ao `e704a01b` (redesign do `JournalTab.jsx`): 5 bugs + 4 menores, fix em `6ef53d68` (só `JournalTab.jsx`).
- `select(null)` no Esc não limpa — `useInbox.selected` recai sempre para a mais antiga por ler/`items[0]`; removidos atalho Esc e `EmptyState` inalcançável.
- `RichParagraphs` sem `whitespace-pre-line` colapsava os `\n` simples do sorteio (`cupDrawListParts`) e da classificação final (`leagueFinalArticle`); reposta a classe.
- Highlight divergia do filtro nos acentos (`camara` casava `Câmara` sem pintar); agora índice normalizado→original sem regex (reproduzido em node antes/depois).
- Enter/Espaço global com `preventDefault` sequestrava botões (Espaço no Aceitar saltava de notícia); agora ignora focos interativos e Ctrl/Meta/Alt; `selectNextUnread` desestruturado (deps estáveis, sem re-subscrição por render).
- `ArticleMeta` mostrava id cru (`⚽ club`); passa a label (`O Meu Clube`); variantes do Badge corrigidas (squad→`sold`, competitions→`cooldown`); progresso `sticky`; removida animação ineficaz da lista (`initial`+`layout` sem efeito, custo por render); cruft fora (`formatDateRelative`, `listRef`, `selectedId`).
- Checks: eslint limpo no ficheiro, `check:types` OK; mobile portrait/landscape iguais ao baseline (falhas pré-existentes: tablist + `label sr-only`).

## Renovações com cor verde do filtro Plantel (2026-09-18)

- Pedido: as notícias de renovação de contrato (pedidos + confirmadas) devem ter a cor verde do filtro Plantel.
- `newsCategory()` (`inboxItems.js`): `contract_request` e `renegotiation` saem do ramo "club" (âmbar) para "squad" (esmeralda); itens transitórios de renovação em `useInbox.js` passam de `cat: "club"` para `cat: "squad"`. Pendentes 🚩 continuam vermelhos até serem respondidos (o `redFlag` tem prioridade sobre o tom).
- Checks: client `check:types` OK, `lint` só os 2 erros pré-existentes. Tweaks de cor/filtro → sem mobile-resp-check.

## Briefing: chip de pts fora do topo do herói (2026-09-18)

- Pedido: remover a menção aos pontos do topo do briefing (ex. `(▼ 6 pts)`).
- `DuelHero.jsx`: chip `ptsChip` (▲/▼ N pts) eliminado da barra de etiquetas. `briefingViewModel.js`: campo morto `ptsDiff` removido (`myPts`/`oppPts` continuam em `compare.points` — o radar mostra os pontos). Check `S2: ptsDiff` removido do `briefingViewModelRegression.mjs` (S2b intacto).
- Checks: client `check:types` OK, `lint` só os 2 erros pré-existentes, regression do view-model íntegra. Sem mobile-resp-check (remoção pontual num chip, sem mudança estrutural de layout).

## Final da Taça espera por todos; classificação final no Jornal (2026-09-18)

- Queixa: após o 14.º jogo da liga (fim da S19) o jogo saltava logo para a final da Taça e ninguém via a classificação final. Causa em cadeia: o lobby da final só contava as 2 finalistas (`requiredTeamIds`), por isso com final só-NPC o primeiro clique em «Avançar para Taça» arrancava logo o jogo; a final corre a ritmo de espetador e o `applySeasonEnd` faz reset aos pontos — a tabela desaparecia em ~1 min.
- Fix 1 (quórum): `requiredTeamIds` (`server/roomStateHelpers.ts`) no lobby da final (ronda 5) devolve todos os assentos `member` com equipa — quórum e congelamento passam a esperar por todos; liga, meias e jogo corrido intactos (sonda tsx 4/4).
- Fix 2 (Jornal): `logLeagueFinalStandings` (`server/weeklyFlowHelpers.ts`) grava no fecho da jornada 14 uma linha `league_final` por equipa (tabela da divisão em JSON, idempotente via `logClubNewsOnce`); cliente com artigo novo em `inboxItems.js` + tabela `LeagueFinalTable` no detalhe (`JournalTab.jsx`), `club_news` persiste entre épocas.
- Sem mobile-resp-check: sem view/tab/modal nem componente partilhado novo (tabela contida no detalhe com `overflow-x-auto`).
- Checks: server `typecheck` OK, `audit:socketio` 0 erros (97 avisos pré-existentes), `audit:gamestate TST148` 0/0/0, `test:session-freeze` 11/11; client `lint` só os 2 erros pré-existentes, `check:types` OK, `test:journaldb` (R8 novo, 7/7), `test:inboxreads`, `test:boardnewsid`, build Vite OK.

## Renovação responde-se na notícia, sem modal de apresentação (2026-09-18)

- Pedido: sem modal a saltar ao ecrã; só a notícia com 🚩 no título e botões Aceitar/Recusar no corpo; a festa/contra-proposta continuam em modal.
- `useSocketListeners`: evento `contractRequest` ignorado (a fila serve só desfechos); a linha `contract_request` chega pelo `globalNewsUpdated` do log.
- `useInbox`: pendência via `contract_request_pending` do plantel (antes: fila de modais); `answerContract(ref, accepted)` emite `renewContract`/`declineContractRequest` com `requestedWage` dos factos; transitórios só para BDs sem linha gravada.
- `GameContext`: novo `respondContractRequest` + `contractAnswering` (botões desativam com «A falar com o agente…» — o aceitar do servidor não tem guarda anti-duplo; poda quando o pendente sai do plantel); removido `focusContractDialog`.
- `JournalTab`: Aceitar/Recusar (recusar → leilão, com tooltip); `TacticsContext`: gate do Pronto passa da fila para o pendente do plantel.
- Checks: eslint limpo (1 erro pré-existente `react-refresh` no GameContext), `check:types` OK, `audit:socketio` 0 erros/97 avisos (igual), `test:inboxreads`/`test:journaldb` OK; prova: linha `contract_request` expõe `newsType`+`requestedWage`+jogador para os botões.

## Jornal com histórico entre épocas, paginado por época (2026-09-18)

- Queixa: ao mudar de época o Jornal esvaziava. Causa: a BD guarda tudo, mas o `getGlobalNews` (`server/socketNewsHandlers.ts`) filtrava `cn.year`/`th.year` do ano corrente — parecia eliminação, era filtro.
- Servidor: sem filtro de ano, ordenação ano desc primeiro, `NEWS_LIMIT` 200 → 600 (várias épocas num só fetch; paginação local, sem protocolo novo).
- Cliente: `useInbox` deriva `newsYears` das linhas (sem ano cai na época atual, como o `ClubTab`), mostra a mais recente e revela uma a pedido (`hasOlderSeasons`/`showOlderSeason`, reinicia ao trocar de treinador/sala); `JournalTab` ganha botão «Mostrar época XXXX ↓» no rodapé dos tópicos.
- Colisões entre épocas corrigidas: `dealKey`/id do negócio inclui o ano (mesmo jogador/jornada em anos distintos fundia em 1 — provado: agora 2 itens); `medicalCovered` só cobre na época corrente (year 0/null de BDs antigas conta como coringa).
- Checks: server `typecheck` OK, `audit:socketio` 0 erros (97 avisos pré-existentes), client eslint limpo + `check:types` OK, `test:journaldb`/`test:inboxreads`/`test:boardnewsid` OK. `audit:gamestate` fica para a próxima sala viva (sem sala). Botão pontual sem mudança de grelha → sem mobile-resp-check.

## Opções da sala no dropdown do utilizador (2026-09-17)

- O botão `speed` no header não agradou: saiu da barra e as definições da sala passaram a um item «Opções» no dropdown do utilizador (`GameLayout.jsx`, a seguir a «A minha conta», abre o mesmo `RoomSettings`). Efeito lateral: o dropdown bloqueia durante o direto, por isso o ritmo só se muda fora de jogo — coerente com "vale do próximo jogo em diante".
- Checks: eslint dos ficheiros limpo, `check:types` OK, portrait `155/155`, landscape `186/186`.

## Ritmo da simulação escolhido pelo admin da sala (2026-09-17)

- Pedido: o admin da sala escolhe o tempo de jogo nas settings. Decisões: painel de definições novo, presets (Calmo 3s / Normal 2s / Rápido 1s por minuto), vale do próximo jogo em diante.
- Servidor: `SIM_SPEED_PRESETS` + default em `server/gameConstants.ts`; `msPerMinute` no `ActiveGame` (`types.ts`, load/save `game_state` em `gameManager.ts`, salas antigas caem no default); `runMatchSegment` (`weeklyFlowHelpers.ts`) e prolongamento (`engine.ts`) leem `game.msPerMinute`; evento `setSimSpeed` com guard de `roomCreator` (`socketGameplayHandlers.ts`) + broadcast `simSpeedUpdated`; `msPerMinute` nos dois payloads de `gameState` (`socketSessionHandlers.ts`).
- Cliente: presets espelhados em `constants/index.js`; `simSpeed` + `roomSettingsOpen` no `GameContext`; `useSocketListeners` hidrata do `gameState` e ouve `simSpeedUpdated`; novo `RoomSettings.jsx` (props como o `RoomHub`, ModalShell card — todos veem, só o admin edita) montado no `GameOverlays` + botão `speed` no header (`GameLayout.jsx`); harness novo `room-settings-resp-test` (mede vista admin + não-admin).
- Checks: server `typecheck` OK, `audit:socketio` 0 erros (1 aviso novo benigno `setSimSpeed` "ouvido mas nunca emitido" — a audit não vê emits do cliente, igual ao `kickCoach`), client `lint` só os 2 erros pré-existentes, `check:types` OK, portrait `155/155`, landscape `186/186`, screenshots 390/667 revistos. `audit:gamestate` fica para a próxima sala com jogo (sem sala viva; mudança aditiva com default).

## Ritmo da simulação: 1 min de jogo = 2s reais (2026-09-17)

- Pedido: abrandar o direto (estava 1 min = 1s real). Decisão: 2s/min só em jogos com humanos; só-NPC (100ms) e final-espetador (500ms) intactos.
- Fix: `MS_PER_GAME_MINUTE` 1000 → 2000 (`server/weeklyFlowHelpers.ts`, tempo regulamentar) + ramo `anyHumanInET` 1000 → 2000 (`server/game/engine.ts`, prolongamento) + comentário do ritmo em `server/gameConstants.ts`. Cliente intocado (só reage a `matchMinuteUpdate`).
- Checks: server `typecheck` OK, `audit:socketio` 0 erros (96 avisos pré-existentes).

## Guia da engine do Hattrick (2026-09-17)

- Adiado o motor de flancos para futuro próximo; a pedido, pesquisa web sobre os segredos do Hattrick.org guardada em `docs/HATTRICK_ENGINE.md` (pt-PT): duelos espelhados por setor, pipeline posse→chances→conversão (5 exclusivas + abertas), 6 táticas com preço visível, ordens individuais, matriz de contribuição, HatStats, eventos especiais, meteorologia (espírito/confiança/forma/resistência/confusão/clima) + secção "o que roubar" ordenada por custo/benefício p/ o CashBall. Wiki bloqueou fetch direto (403) — conteúdo via sínteses de pesquisa + fontes linkadas; fórmulas exatas marcadas como estimativas da comunidade.

## Táticas com cara própria: selos + pesos alargados (2026-09-17)

- Queixa: as 8 formações pareciam todas iguais. Sonda sintética confirmou: 4-2-4 vs 5-4-1 diferiam só ~1.5pp em golos pró e ~2.2pp contra por chance; o meio colado ao 4-4-2 (7.95%/7.95%).
- Pesos (`server/game/matchCalculations.ts`, fonte única): distâncias ao neutro alargadas ~1.4x, produto ataque×defesa preservado por formação (0.87–1.02, como antes) — total de golos estável por construção. Extremos agora: 4-2-4 8.82%/9.45% vs 5-4-1 6.51%/6.50% (diferença pró +48%, contra +33%); 4-4-2 intacto. `FORMATION_WEIGHTS` da IA intocado (escolhe pelo plantel, continua válido).
- Identidade (`client/src/constants/index.js` + `TacticsView.jsx`): cada formação ganha selo + frase + pendor (`edge` deriva dos pesos reais); selo sob o número no mobile e no desktop (cor por pendor: ataque rosa, defesa azul, equilibrado cinzento; ativa usa verde-escuro sobre o fundo verde), frase da formação ativa sob o cabeçalho no desktop. Sem mudança estrutural de grelha.
- Checks: server `typecheck` OK, eslint dos ficheiros + `check:types` OK, `test:engine-unit` 19/19, `audit:socketio` 0 erros (96 avisos pré-existentes), `audit:gamestate TST148` 0/0/0, mobile portrait `150/150` + landscape `180/180`. Sonda de medição era temporária em /tmp (removida).

## Briefing: forma recente redesenhada (2026-09-17)

- Pedido: o bloco «Forma recente (últimos 5)» estava feio. Cada equipa tem agora um mini-cartão: emblema + nome + rótulo do momento derivado dos resultados (`Invencível`/`Sem vencer`/`Irregular` com contagens) + chips maiores com borda + registo colorido. `FormChips` maiores só vivem no briefing.
- Correção: a 320/360px chips + registo não cabiam lado a lado na meia-coluna (clip +24px) — linha com `flex-wrap`.
- Checks: eslint limpo, `check:types` OK, briefing portrait `5/5` + landscape `6/6`, screenshot 390 revisto.

## Briefing: tempo fora do relvado (2026-09-17)

- Pedido direto: retirar a previsão meteorológica do `OpponentFormation` (rodapé + prop `weather` + chamadas no `MatchBriefing` e no harness). O tempo continua na linha flash do herói (`DuelHero`).
- Checks: eslint limpo, `check:types` OK, harness do briefing `5/5`. Tweak pontual → sem passagens mobile completas.

## Briefing: mercado na 3ª coluna e relvado flexível (2026-09-17)

- Pedido (screenshot anotado): mercado 1X2 + árbitro para a 3ª coluna; vazio sob o relvado eliminado a esticar o campo. Decisões via pergunta: destino «na 3ª coluna», vazio «esticar o relvado».
- Implementação: novo `MarketPanel.jsx` (mercado + árbitro) no fundo da 3ª coluna (estádio → ameaças → mercado → árbitro); `CompareRadar` sem esses tiles; `OpponentFormation` com pitch `flex-1` + altura mínima (enche o cartão em desktop, mínimos iguais em mobile).
- Checks: eslint limpo, `check:types` OK, portrait `155/155`, landscape `186/186`, screenshots 390/1023/1280 revistos (skills dos avançados todas visíveis).

## Briefing: estádio sob o CTA, fora adjunto, odds na col 1, relvado alto (2026-09-17)

- Pedido (screenshot anotado): lotação prevista para baixo do botão Avançar; eliminar conselho do adjunto; odds + árbitro para baixo da Forma; forma em duas colunas; relvado mais alto (skill dos avançados cortada).
- Implementação: `StadiumCard` para a 3ª coluna (sob o CTA); `ScoutMarket.jsx` dissolvido — `ThreatGrid` direto (fora `AssistantAdvice`); `CompareRadar` com `FormBlock` vertical em `grid-cols-2` + tiles mercado 1X2 e árbitro por baixo da forma; `OpponentFormation` `h-72→h-80` / `lg 320→360px` e rodapé só com tempo (árbitro agora na col 1, sem duplicar).
- Checks: eslint limpo, `check:types` OK, portrait `155/155`, landscape `186/186`, screenshots 390/1023 revistos.

## Briefing: herói span-2 + cartão de ação na 3ª coluna (2026-09-17)

- Pedido (nova maqueta): herói só no topo das duas primeiras colunas; botão «Avançar para a Tática» sobe para cima da terceira coluna. Decisões: stepper passa para o cartão do botão; no mobile o CTA fica logo após o herói; sem adversário não há herói (só ação + jogos da ronda).
- Implementação: novo `PrepCtaCard.jsx` («Briefing concluído» + `PrepStepper` + «Prepara a estratégia» + `PrimaryCTA` em largura cheia); `DuelHero` sem stepper; `MatchBriefing` em `grid lg:grid-cols-3` (herói `lg:col-span-2` + CTA; radar + campo + scout por baixo), sem rodapé; harness atualizado.
- Peripécia: `PrepCtaCard` importou `../shared/PrimaryCTA` (aponta para `live/shared`, inexistente) em vez de `../../shared` — partiu os harnesses briefing + tactics (ambos importam o barrel) com timeout no `waitForSelector`. Fix de uma linha.
- Checks: eslint limpo, `check:types` OK, portrait `150/150`, landscape `180/180`, screenshots 390/1023 revistos.

## Briefing estilo emissão em 3 colunas (2026-09-17)

- Pedido: aproximar o `MatchBriefing` da maqueta broadcast (herói de duelo + radar + campo + scout + CTA). Decisões do utilizador: só dados reais do view-model (1A), aspeto rico também no mobile (2B), herói novo substitui o atual (3A), evoluir a formação existente (4A).
- Implementação: novo `DuelHero.jsx` (etiquetas + nomes gigantes casa/fora + VS + dificuldade/stepper + linha flash com manchete/contexto real); novo `CompareRadar.jsx` (barras duplas ataque/defesa/moral/qualidade derivadas de golos/moral/avgSkill + forma + registo + último confronto + ambiente); novo `ScoutMarket.jsx` (reutiliza `ThreatGrid` + conselho do adjunto em template fixo preenchido com a ameaça real + mercado 1X2 + árbitro); `OddsTiles.jsx` extraído; `OpponentFormation` com cabeçalho «Confronto tático em campo» + rodapé árbitro/tempo; `MatchBriefing` recomposto em grelha 3 colunas + rodapé CTA. Apagados `NextMatchCard.jsx`, `VersusHero.jsx` e `CompareStat` (órfãos). Sem countdown/hot-zone/cards de árbitro — não existem no servidor.
- Checks: eslint limpo nos ficheiros tocados (`lint` global só os 2 erros pré-existentes), `check:types` OK, portrait `150/150`, landscape `180/180`, screenshots 390/844 revistos. Harness `briefing-resp-test.jsx` atualizado para a nova composição. View-model e servidor intocados → sem regressão nem audits.

## Amigável conta para a familiaridade tática (2026-09-17)

- O `finalizeFriendly` (`server/cupFlowHelpers.ts`) não tocava na memória tática: o amigável dava ritmo mas zero estrelas, enquanto liga (`matchSummaryHelpers.ts`) e Taça (`finalizeCupRound`) dão +1 por jogo.
- Fix: bloco `recordFriendlyFamiliarity` no loop do amigável — `updateTacticFamiliarity` com `fixture._t1/_t2` (preenchidos pelo `runMatchSegment`, como na liga/Taça) para todas as equipas incl. NPCs, e linha de auditoria em `player_tactic_history` só para humanos com `socketId` (`competition='friendly'`, resultado `V/E/D` pois o amigável admite empate). Comentário do helper atualizado («liga, Taça ou amigável»). Sem retroativo: só próximos amigáveis.
- Checks: server `typecheck` OK, `audit:socketio` 0 erros (96 avisos pré-existentes). Sem toque no cliente → sem lint/mobile-resp-check. `audit:gamestate` fica para a próxima sala com amigável.

## Boas-vindas para cada treinador que entra na sala (2026-09-17)

- Sintoma: a notícia de boas-vindas só aparecia ao fundador — os outros jogadores entravam e o Jornal vinha vazio até surgirem eventos próprios.
- Causa: o `assignPlayer` (`server/socketSessionHandlers.ts`) só gravava a `welcome` com `isNew && calendarIndex === 0 && roomCreator === name`, e o `getGlobalNews` filtra por `team_id` — cada equipa só vê o seu Jornal.
- Fix: guard passa a `if (isNew)` — cada treinador recebe a sua `welcome` do seu clube ao assumir equipa pela primeira vez, em qualquer altura da época. Reentradas (`isNew=false`) não duplicam; convites aceites mantêm a via própria («Novo treinador»). Descrição neutralizada (antes falava em «as portas da sala acabam de abrir»).
- Checks: server `typecheck` OK, `audit:socketio` 0 erros (96 avisos pré-existentes). Sem toque no cliente → sem lint/mobile-resp-check.

## Reconexão em popup central + reload automático pós-restart (2026-09-17)

- O `OfflineBanner` deixou de ser faixa de topo: agora é popup centrado (`ModalShell` card, `z=99998`, não dispensável) com o mesmo texto/condições («Sem ligação» / «A reconectar…» + `N em fila`) e o botão «Tentar agora» só quando o browser está online.
- O aviso inline «Desligado — a reconectar...» saiu da `TacticsView` (mensagem dupla com o popup global); o `disconnected` do contexto continua a alimentar a landing.
- O restart do servidor voltou ao automático com guarda anti-corrida: `socket.js` marca `_pendingRestartReload` no `serverStartTime` novo e só faz `location.reload()` no `gameState` seguinte (prova de auth/DB pronta), em vez do reload imediato que gerava `joinError` e apagava a sessão. O `ServerRestartBanner.jsx` (manual) foi removido e saiu da montagem do `GameLayout`.
- Checks: `lint` só os 2 erros pré-existentes, `check:types` OK, mobile portrait `150/150` e landscape `180/180`.

## Estrelas de familiaridade com centro dourado sólido (2026-09-17)

- Sintoma: as estrelas cheias da familiaridade tática mostravam só o contorno dourado, sem preenchimento ao centro.
- Causa: o `fill="url(#famStarGrad)"` no `<svg>` apontava para um gradiente dentro de um `<svg width="0" height="0">` com `id` duplicado (uma instância por formação) — referência frágil que falha e deixa o centro vazio, restando só o `stroke` dourado.
- Fix: `fill="#fbbf24"` sólido diretamente no `<path>` da estrela cheia (mantém `stroke="#fde68a"` + `drop-shadow`); removido o `<svg>` de 0px com `<defs>` (~9 linhas). Só `client/src/views/TacticsView.jsx` (`FamiliarityStars`).
- Checks: eslint do ficheiro limpo (`lint` global só os 2 erros pré-existentes em `GameContext.jsx`, confirmados com a alteração em stash), `check:types` OK. Só apresentação → sem audits, sem mobile-resp-check.

## Festejo de golo nos cards de jogos com humano (2026-09-17)

- Pedido: levar «esse tipo de efeito» (festejo de golo) aos cards de jogos com treinador humano. Decisões do utilizador: festejo dentro do card, para qualquer golo do jogo, sempre em direto (mesmo durante o próprio jogo).
- Implementação: `GoalFlashOverlay` ganhou `variant="card"` — reutiliza a fila `{ ts, n }` já provada, mas renderiza inline (`absolute inset-0`, sem portal) e em ponto pequeno: wash verde + carimbo «GOLO!» quando marca o lado do humano, variante sóbria vermelha quando marca o NPC (humano vs humano: ambos festejam). Sem confete (`CelebrationBurst` voa 90–210px, grande para um card de ~60px). **Corrigido 2026-09-23:** o burst era renderizado inline dentro do botão do card, que tem `overflow-hidden` → cortado/invisível. Agora o `CelebrationBurst` do `card` variant vai por `createPortal` para o `<body>` (`fixed inset-0 z-[200]`), como a variante `page`; o wash + «GOLO!» ficam contidos no card, só o confete escapa. Confete já dispara no minuto de penalty-suspense (timeout 3s de revelação em `useSocketListeners.js`). Commit `3bdac817`. `LiveFixtureRow` monta-o só com `isHumanMatch` (+ `relative` no botão para o conter; sem mudança de layout) e `GameRoutes` passa `isPlayingMatch` nos dois sítios.
- Checks: e2e com dois treinadores (sala + sonda temporária, removidas): golo do humano → 1 flash `GOLO!`; golo do NPC → 1 variante sóbria; par no mesmo minuto → 2 momentos; screenshot revisto sem quebra de layout. Client lint só os 2 erros pré-existentes, `check:types` OK, `test:goalflash` OK. Sem mudança estrutural → sem mobile-resp-check.
- Nota lateral (pré-existente, fora de âmbito): `TeamEvents` (`LiveMatchHero.jsx`) mete `[nameEl, icon, minuteEl]` em array sem `key` — warning no console.

## GoalFlashOverlay: um festejo por golo, mesmo no mesmo minuto (2026-09-17)

- Sintoma: overlay nem sempre renderizava no próprio jogo, jornada normal da liga.
- Causa (confirmada por reprodução e2e com Playwright + sonda temporária, já removida): o produtor colapsava golos do mesmo lado na mesma chave `goalFlashRef[fixture_lado]` (só timestamp) e o overlay consumia só o `bestTs` máximo — 2 golos no mesmo minuto, de qualquer combinação de lados, davam 1 festejo. Medido antes: A(1 golo)=1, B(casa+fora)=1, C(2 do mesmo lado)=1 episódios no DOM.
- Fix: valor `{ ts, n }` por chave (contador monótono; `readGoalFlashEntry` normaliza o formato legado); overlay drena fila via `freshGoalFlashes()` (um momento por golo, ~2s cada, ordem por ts); reveal do suspense de penálti num timeout único por fixture que festeja penálti + golos retidos do mesmo minuto (antes o golo aberto entrava em silêncio, sem flash nem som). `isFlashing` (placar) aceita os dois formatos.
- Por desenho (inalterado): sem festejo fora do tab Jogo (frescura 2200ms), em final neutra, ou com `isPlayingMatch` falso.
- Checks: e2e A=1 B=2 C=2; `test:goalflash` (novo, 12/12); client lint só os 2 erros pré-existentes; `check:types` OK; `audit:socketio` 0 erros. Sem mudança estrutural de layout → sem mobile-resp-check. Salas/contas probe apagadas.

## Intervalo vazio após crash no lobby-wait (2026-09-17)

- O `gameState` em lobby apagava as `positions` da tática (`positions: {}`); o `ready` sobrevivia no assento, por isso após um restart o jogo arrancava e o painel de intervalo (`IntervencaoView`, que filtra Titulares/Suplentes por `tactic.positions`) ficava vazio com o plantel intacto.
- Fix: a tática viaja tal como está em qualquer fase (`buildGameStatePayload`); novo `clearSeatPositions()` (`roomStateHelpers.ts`) limpa o 11 só em fronteira de ronda (finalize liga/taça/amigável + `recoverFinalizedSlot`); no load em fase lobby, `resetAllReady` invalida o Pronto pré-crash — o treinador reconfirma o 11 (gate do 11+7) com um clique. Intervalo e gate do prolongamento intocados (precisam das positions).
- Checks: server `typecheck`, `test:session-freeze` 11/11, `test:connect-smoke`, `audit:socketio` 0 erros (96 avisos, sem eventos novos). Sem toque no cliente → sem lint/mobile-resp-check. Sala do reporte apagada — `audit:gamestate` fica para a próxima sala.

## Calendário sem Invencibilidade nem Próximo Jogo (2026-09-17)

- O `CalendarioTab.jsx` perdeu os dois cartões de topo (`SummaryWidget` «Invencibilidade» e «Próximo Jogo»); fica só cabeçalho + filtros + timeline de jogos.
- Saiu também a lógica órfã (série sem derrota, próximo jogo/adversário/recinto) e o import do `SummaryWidget`.
- Nota: a etiqueta «Próximo Jogo» dentro da linha da jornada atual (VS · Ativo) mantém-se — faz parte da timeline, não era um dos cartões.
- Checks: eslint do ficheiro limpo (`lint` global só os 2 erros pré-existentes), `check:types` OK. Remoção de secção sem alterar grelha → sem mobile-resp-check.

## Notícia do sorteio lista todos os pares; botão abre o Quadro da Taça (2026-09-17)

- A notícia `cup_draw` mostrava só o jogo do treinador (ou «N eliminatórias»). Novo `cupDrawListParts()` em `inboxItems.js`: o jogo do treinador em destaque no topo («O seu jogo: Casa – Fora») e todos os pares por ordem do sorteio, cada equipa clicável; o item transitório do `useInbox` usa o mesmo helper.
- O botão deixou de abrir o popup (`openCupDraw` removido do `useInbox` e dos setters só dele): agora é «Ver quadro da Taça» via prop `onOpenCupBracket` (`JournalTab` → `GameRoutes`: `navigateTab("bracket")` + `requestCupBracket`, igual à sidebar). O popup ao vivo do `cupDrawStart` fica intacto.
- Sem toque no servidor: os pares completos já viajavam no JSON da linha. A pesquisa do Jornal passa a encontrar qualquer equipa do sorteio (ganho lateral).
- Checks: eslint dos ficheiros + `check:types` OK, `test:journaldb` (assert atualizado para listagem), `test:inboxreads`, `test:boardnewsid`, `build` Vite, harness Jornal retrato `5/5` e paisagem `6/6` (assert da listagem no `checkDrawDate`).

## Jornal 100% em BD: data fixa, lido no servidor, sem reaparecer (2026-09-17)

- Todas as notícias passam a viver em `club_news` com `matchweek/year` do evento: `contract_request` (no trigger, online ou não), `job_offer` (na oferta, equipa de origem), `board_warning` (na emissão, idempotente por semana via `logClubNewsOnce`), `cup_draw` (uma linha por equipa da Taça com os pares em JSON), `injury`/`suspension` (na finalização liga/taça/amigável via `logMatchMedicalNews`, idempotente por jogador+until no `amount`). O `logClubNews` com `io` passa a emitir também `globalNewsUpdated`, por isso cada linha nova refresca o Jornal.
- Leituras na BD (`inbox_reads`, PK sala+treinador+chave): `getGlobalNews` devolve `reads`, novo evento `markInboxRead`; o `useInbox` hidrata a cache local, emite ao marcar e sobe uma vez as leituras antigas do localStorage. Abrir uma notícia marca-a sempre como lida (mesmo 🚩 — continua a contar como não lida até ser respondida, mas ao resolver já não ressuscita como novidade).
- Fim dos bugs: o aviso calculava o id com a semana atual (`boardNewsId(seasonYear, calendarIndex, …)` → id novo por semana, «lido» perdido); o `cupDraw` transitório sobrevivia à ronda e era re-emitido no reconnect. Agora os transitórios escondem-se quando há par gravado (`contractCovered`/`jobCovered`/`boardCovered`/`cupDrawCovered`/`medicalCovered` em `inboxItems.js`) e o sorteio abre o popup a partir do JSON da linha (`openCupDraw(item)`).
- Decisão assumida (desvio do «tudo via BD»): a notícia é 100% BD, mas a resposta continua pelos fluxos vivos (diálogo do agente, modal de convite) — reconstruir a ação só da linha seria reescrever a negociação sem ganho visível. Quando a pendência existe, a linha fica 🚩/acionável; ao resolver vira histórico já lido.
- Teto conhecido: `logClubNewsOnce`/`logMedicalNews` são check-then-act (SELECT+INSERT) — duas emissões no mesmo tick duplicariam; sem caminho real para isso (cada emissão é guardada por flags em memória e o guardião cobre replays entre restarts).
- Checks: server `typecheck`, `audit:socketio` 0 erros (1 aviso novo benigno da classe «ouvido mas nunca emitido», que não vê emits do cliente), `audit:gamestate FRT6QI` 0/0/0, regressão SQL direta em BD sintética (migração + idempotência + dedup de leituras), client `lint` (só os 2 erros pré-existentes), `check:types`, `test:journaldb` (novo, 30/30), `test:inboxreads`, `test:boardnewsid`, build Vite. Sem mudança de layout → sem mobile-resp-check. `setCupDraw` exposto no `GameContext` (o popup do sorteio a partir da linha precisa dele).

## Gate único do 11+7 no setReady; checkAllReady só conta readys (2026-09-17)

- O avanço tinha duas validações do 11+7: o gate do `setReady` (`socketGameplayHandlers.ts`, recusa com `systemMessage` sem marcar ready) e uma 2.ª barreira no ramo lobby do `checkAllReady` (`weeklyFlowHelpers.ts`) que revalidava todos no arranque e **retirava** readys já dados — o `ready` deixava de significar "cliquei Ir a jogo e validei".
- Fix: removida a 2.ª barreira (query por equipa + `checkLineupReady` + strip de ready + aviso de arranque) e os imports mortos (`lineupReady`, `dbAllAsync`, `setSeatIntent`); o `checkAllReady` fica só com congelamento/quórum/single-flight/recovery/arranque. Inbox por responder e espetadores livres continuam no gate único, como decidido.
- Checks: server `typecheck` limpo, `audit:socketio` (0 erros / 95 avisos pré-existentes), `test:session-freeze` 11/11. Sem toque no cliente → sem `check:types`/lint/mobile-resp-check. `audit:gamestate` fica para quando houver código de sala.

## Convite aceite deixava Jornal e briefing no clube antigo (2026-09-17)

- O `handleAcceptJobOffer` (`coachDismissalHelpers.ts`) atualizava a BD (`manager_id`) e a memória (`player.teamId`), mas nunca o assento (`room_seats`): após restart o `loadSeats` ressuscitava o treinador no clube antigo. E o rejoin (`assignPlayer`) só criava a entrada de `playersByName`, nunca reconciliava — com a memória obsoleta, `getGlobalNews`, `requestNextMatchSummary` (memória ganha ao pedido) e `requestResync` devolviam o clube antigo, imunes a refresh.
- Fix: `setSeatTeamId` no aceite; `assignPlayer` reconcilia `teamId` com a BD (via `managers`, cura salas já partidas no próximo join); `warn` nos `return` silenciosos do aceite (sem convite/sessão/manager). Cliente: no `teamAssigned` com clube diferente (via `meRef`), limpa `nextMatchSummary` e emite `getGlobalNews` — o refetch do briefing segue pelo `me.teamId`.
- Checks: server `typecheck`, `audit:socketio` (0 erros / 95 avisos pré-existentes), `test:connect-smoke`, `test:session-freeze` 11/11, `build`; client eslint do ficheiro + `check:types`. Sem mudança de layout → sem mobile-resp-check. Sem acesso à sala do reporte — `audit:gamestate` fica para quando houver código.

## Amigável 0–0 contado como «Derrota Esperada» no Jornal (2026-09-16)

- O amigável de pré-época (ronda 0) viaja no fio da Taça (`cupRoundResults`), e o bloco da Taça no `GameContext.jsx` tratava tudo como eliminatória: `outcome` só por `winnerId` (sem ramo de empate) e `source: "cup"`. Num 0–0 sem `winnerId` saía sempre `loss` + `loss_expected` (adversário de escalão superior) — título de derrota com marcador de empate — e a chave `cup:época:0` não fundia com o rescaldo persistido `friendly:época:1`, duplicando a notícia.
- Fix só no cliente: ronda 0 → `outcome` pelos golos, `source: "friendly"`, chave `friendly:época:1` (igual à do servidor, `game.matchweek = 1` no slot 0). O transitório passa a «Empate» e esconde-se quando chega o persistido.
- Checks: eslint (só o erro Fast Refresh pré-existente do `GameContext.jsx`), `check:types` OK, build Vite OK, ramo verificado em node (amigável 0–0 → `draw`, taça 0–0 perdida vs superior → `loss_expected`). Lógica de cliente — sem `audit:gamestate`/`audit:socketio`, sem disparo de `test:mobile`.

## Cronologia: fundo ténue por equipa do evento (2026-09-16)

- No separador Cronologia (Intervenções), as chances/eventos eram todos neutros. O `EventCard` ganhou a prop opcional `tint`: com `accent` definido, aplica um gradiente subtil `linear-gradient(90deg, ${accent}14, ${accent}05)` sobre o fundo — cor tenue, não viva.
- `EventList` (Panels.jsx) deriva `accent` de `e.team` (home → `hInfo.color_primary`, away → `aInfo.color_primary`); eventos sem equipa (clima, fases) ficam neutros. O uso do `EventCard` no `MatchView` ficou inalterado.
- Checks: eslint dos ficheiros (limpo; os 2 erros globais são pré-existentes em `landing-resp-test.jsx`/`GameContext.jsx`), `check:types` OK. Tweak de cor → sem mobile-resp-check.

## Balão de mensagem com avatar do remetente (2026-09-16)

- O balão de banda desenhada da última mensagem não-lida (`chatPeek` no `GameLayout.jsx`) mostrava só nome + excerto. O cabeçalho passa a linha `avatar + nome` com o `CoachAvatar` do remetente (seed via `coachAvatarSeed`, mesma convenção do `RoomHub.jsx`; foto carregada com fallback procedural).
- Checks: eslint do ficheiro, `check:types`. Retoque pontual — sem disparo de `test:mobile`.

## Label «Taça» sobre o score no amigável (2026-09-16)

- O hero live (`LiveMatchHero.jsx`) testava o amigável com `/amigavel/i` (sem acento), que nunca casa com o nome canónico do servidor `Amigável de pré-época` (`FRIENDLY_ROUND_NAME`): `isFriendly` ficava `false` e a meta strip mostrava «Taça · Amigável de pré-época» acima do marcador (e 🏆 em vez de 🤝). Corrigida a regex para `/amigável/i` — é o único sítio com a variante des-acentuada; `MatchPage.jsx` já fazia bem.
- Checks: eslint (só os 2 erros pré-existentes `GameContext.jsx`/`landing-resp-test.jsx`), `check:types`. Tweaks de 1 char — sem disparo de `test:mobile`.

## Cabeçalho na História da equipa (2026-09-16)

- O `TeamHistoryView.jsx` arrancava logo nas secções, sem cabeçalho. Nova faixa no topo nas cores do clube (gradiente `color_primary`/`color_secondary`, como o header do `TeamSquadView`): emblema com fallback de monograma, nome, divisão e 3 contadores (Épocas, Melhor posição, Troféus) em pastilhas escuras para contraste.
- Checks: eslint do ficheiro, `check:types`, mobile portrait `150/150` e landscape `180/180`.

## Juniores sem caps nas listas de jogadores (2026-09-16)

- O `PlayerRow.jsx` (listas de Jogadores e Táticas) aplicava `uppercase` a todos os nomes (regra do STYLE.md). A pedido do utilizador, os nomes de juniores (`player.isJunior`) agora saem em case mista; os restantes mantêm caps. Exceção documentada em `STYLE.md`.
- Checks: eslint do ficheiro (limpo; só os 2 erros pré-existentes de `landing-resp-test.jsx`/`GameContext.jsx`), `check:types`. Tweaks de `className` — sem disparo de `test:mobile`.

## StadiumTab compacto em duas colunas no desktop (2026-09-16)

- O `StadiumTab.jsx` passou a duas colunas em `lg` (esquerda: ocupação + mood + bilhetes; direita: expansão); hero `sm:h-56` → `sm:h-40 lg:h-44`, valores `sm:text-2xl` → `lg:text-xl`, paddings `sm:p-5` → `md:p-4` (STYLE.md), botão Expandir `lg` → `md`, cartões custo/ganho em `grid-cols-2` fixa. Mobile intacto (tudo com prefixo `lg:`/inalterado).
- Checks: eslint do ficheiro, `check:types`, mobile portrait `150/150` e landscape `180/180`.

## Corpo das notícias em text-base (2026-09-16)

- O corpo da notícia no `JournalTab.jsx` subiu mais um degrau (`text-sm` → `text-base`, `short:text-sm`); serif e restante estilo mantidos.
- Checks: eslint do ficheiro, `check:types`, build Vite, harness Jornal retrato `5/5` e paisagem `6/6`, screenshots 390/667 revistos.

## Convite e aviso da direção sobrevivem ao refresh (2026-09-16)

- Eram os únicos itens do Jornal sem durabilidade: com refresh/reconnect sumiam (o convite bloqueando o Pronto sem se mostrar; o aviso sem voltar). O servidor reenvia ambos no reconnect com o mesmo payload/ids — voltam ao Jornal, o «lido» do localStorage vale e nada duplica; o aviso só volta se o orçamento continuar no vermelho.
- Checks: typecheck servidor, `audit:socketio` (0 erros), `test:connect-smoke`, cliente intocado.

## Sorteio e humor com data do evento, não da semana atual (2026-09-16)

- O sorteio da Taça (e o humor pós-jogo transitório) eram datados com a semana atual, por isso «mudavam» de semana ao avançar. O servidor carimba `drawWeek`/`drawMatchweek`/`year` no payload do sorteio e o cliente carimba `weekIdx`/`year` no humor; o `useInbox` data os itens por esses carimbos.
- Checks: typecheck servidor, eslint (só o erro Fast Refresh pré-existente do `GameContext.jsx`), `check:types`, regressões inbox, build Vite, harness Jornal retrato `5/5` e paisagem `6/6` (com assert S5/2026 no sorteio), screenshots 390/667 revistos.

## Rescaldos guardados no histórico da época (2026-09-16)

- O rescaldo pós-jogo era só estado transitório e cada jogo apagava o anterior. Agora cada jogo da equipa (liga, taça, amigáveis) grava uma linha `postmatch` em `club_news` na finalização, com factos + foto do contexto em JSON; o cliente reconstrói o editorial exacto (variante incluída) e o item transitório esconde-se quando chega a linha gravada.
- Idempotente (`DELETE` do mesmo jogo antes de inserir, como os resultados); só a época atual, só a perspetiva da própria equipa.
- Checks: typecheck servidor, eslint, `check:types`, build Vite, harness Jornal retrato `5/5` e paisagem `6/6` (com nova fixture/assert de rescaldo persistido), screenshots 390/667 revistos.

## Aviso da direção repetido já não herda o «lido» (2026-09-16)

- O id do aviso era `board-<nível>-<semanas>` e repetia-se quando o orçamento voltava ao vermelho: o aviso novo chegava já lido. Passou a `board-<época>-<semana>-<nível>-<semanas>` via novo `boardNewsId()` em `inboxItems.js`, usado pelo `useInbox.js`.
- Checks: eslint, `check:types`, regressões `test:boardnewsid` (nova) e `test:inboxreads`, build Vite, harness Jornal retrato `5/5` e paisagem `6/6`, screenshots 390/667 revistos.

## Corpo das notícias maior com serif de imprensa (2026-09-16)

- O corpo da notícia no `JournalTab.jsx` subiu um degrau (`text-xs` → `text-sm`, `short:text-xs`) e passou a `font-serif` (Georgia/sistema, sem nova fonte).
- Checks: eslint do ficheiro, `check:types`, build Vite, harness Jornal retrato `5/5` e paisagem `6/6`, screenshots 390/667 revistos.

## Gestão contratual entre cabeçalho e atributos (2026-09-16)

- A «Gestão Contratual» do `PlayerHistoryModal.jsx` saiu do fundo da coluna esquerda para uma faixa de largura total logo abaixo do cabeçalho (só o bloco contratual; «Mercado» fica onde estava). Empilha no telemóvel, horizontal (`flex-row`, botões `flex-1`) em desktop; lógica/handlers inalterados.
- Checks: eslint do ficheiro OK (2 erros do `lint` global são pré-existentes noutros ficheiros), `check:types` OK, mobile portrait `150/150` e landscape `180/180`.

## Fundo próprio por tab (17 fotos, 2026-09-16)

- Cada tab tem a sua foto (`TAB_BG` no `GroupBackdrop.jsx`, fallback por grupo); as 4 anteriores foram remapeadas (gestao→club, competicao→live, transferencias→tactic) e entraram 13 novas (22–185 KB cada, ~1,3 MB no total mas lazy por visita).
- 6 das primeiras escolhas saíram erradas ao rever visualmente (futebol americano no plantel/squad, prédio industrial na taça, menorá nas classificações, hall no bracket, pernas/bola no estádio) e foram trocadas por futebol a sério (plantel em linha à noite, equipa de braços dados, holofotes, troféus Champions/Mundial, Wembley com FA Cup).
- Com 17 fotos a pilha pré-carregada virou uma só `<img>` com fade-in na troca (`key`); fundo sempre visível, inclusive no direto (saiu a prop `hidden`).
- Checks: eslint dos ficheiros, `check:types` OK, build OK (17 no `dist`), mobile portrait `150/150` e landscape `180/180`.

## Fundo fotográfico por grupo de navegação (2026-09-16)

- Uma foto livre (Unsplash, WebP 41–185 KB em `client/public/backgrounds/`) por grupo — jornal (noite/holofotes), gestão (Bernabéu), competição (estádio à noite), transferências (linha de relva) — montada no `GameLayout.jsx` atrás do `.ambient` via novo `GroupBackdrop.jsx` (escolha por `getTabGroupId`, `tactic`/`squad` caem em competição, escondido no jogo ao vivo).
- Tratamento escuro + desfocado só em CSS (`brightness(0.32) + blur(3px)` e overlay em tokens, crossfade por opacidade, sem transição com `prefers-reduced-motion`).
- Checks: `check:types` OK, eslint só com os 2 erros pré-existentes noutros ficheiros, mobile portrait `150/150` e landscape `180/180`, screenshots 390/667 revistos, build Vite OK com imagens no `dist`.

## Sidebar desktop volta a encolher com bola na linha direita (2026-09-16)

- A barra lateral desktop (`lg`) volta a colapsar para `3.5rem` (só ícones centrados, etiquetas e cabeçalhos escondidos → divisores, badges em canto, JOGAR só com ícone); o comando é uma bola (`h-6 w-6`, `chevron_left/right`) sobreposta ao centro da linha direita (`-right-3 top-1/2`). O bloco fixo do Jornal no topo foi mantido (só colapsa para ícone) em vez de voltar ao scroller.
- Estado `sidebarCollapsed` + preferência em `localStorage` + auto-encolher durante o direto (guarda a preferência, repõe ao sair); offsets do conteúdo e do `MatchPage` acompanham a largura real. A bola fica inativa durante o jogo (`disabled` + `aria-disabled`, como os restantes botões da barra). A preferência só muda no clique da bola: o efeito de auto-encolher deixou de a re-guardar à entrada do jogo, senão um restauro adiado (`startTransition`) ainda por aplicar era gravado como preferência no ciclo seguinte (oscilações de fim de jogo com penáltis/VAR) e a barra ficava presa no estado transitório.
- A barra some por completo durante o jogo (`isMatchInProgress`): `nav` embrulhada em `hidden`/`contents` (sem remontar nem repetir animações), `MatchPage` a largura total (`lg:left-0`) e `main` com `lg:ml-0`. O efeito de auto-encolher/restauro e o `sidebarUserPrefRef` saíram — o estado passa a ser sempre a preferência (só a bola o muda, e está inativa no jogo).
- Checks: eslint dos ficheiros (só o erro Fast Refresh pré-existente do `GameContext.jsx`), `check:types`, `git diff --check`, mobile portrait `150/150` e landscape `180/180`.

## Golos com notificação dupla (2026-09-16)

- Penáltis com suspense tocavam som + flash duas vezes: no reveal de 3s (`useSocketListeners.js`) e de novo no efeito genérico por minuto (`GameContext.jsx`) ao adicionar os eventos ao `matchResults`. O efeito ainda repetia som/flash de golos já notificados sempre que `matchResults` mudava no mesmo `liveMinute` (reveal do VAR, adds atómicos).
- Fix só no efeito: ignora eventos com `penaltySuspense` (reveal de 3s é o dono) e guard de chaves já notificadas (`minuto+fixture+tipo+lado+jogador`, limpo a cada minuto) para golo, VAR e outros eventos. VAR anulado mantém golo + VAR, por decisão do utilizador.
- Checks: eslint do ficheiro (só o erro Fast Refresh pré-existente), `check:types` OK, simulação das 4 sequências (golo normal, suspense, VAR, updates repetidos) 7/7. Sem mudança de layout → sem mobile-resp-check.

## Jornal: links em todas as notícias (2026-09-16)

- Renovação, convite, direção, sorteio, adeptos e lesão/castigo chegavam ao Jornal só com `title`/`body` em texto puro, por isso o `RichNewsText` não tinha entidades para ligar. Passam a trazer `titleParts`/`bodyParts`/`media`: jogador da renovação (via plantel, com recurso ao nome no título), equipa do convite, equipa própria no aviso da direção, ambas as equipas do jogo do treinador no sorteio, adversário na reação dos adeptos e jogador na lesão/castigo.
- Novo `linkFirstMention` (primeira menção vira entidade clicável, resto fica texto) e `buildMoodNewsArticle`; textos visíveis e pesquisa do Jornal inalterados (o corpo do convite passa a nomear o clube em vez de "Um clube"). Sem mexer no `JournalTab` — equipa própria continua a abrir a gestão do plantel.
- Checks: eslint dos 2 ficheiros, `check:types`, prova funcional dos 6 tipos (entidades presentes, texto intacto, sem crash sem entidade). Sem mudança de layout → sem mobile-resp-check.

## Submenu mobile fechado ao sair do tutorial (2026-09-15)

- Após o `WelcomeModal` de conta nova, o tutorial abre sozinho o fly-up (`gestao` no passo 1) e o overlay de ecrã cheio bloqueia o dedo até o submenu ser enrolado; `skipTutorial`/`finishTutorial` nunca limpavam o `mobileSubMenu`, por isso saltar o tutorial deixava o submenu estendido a bloquear a navegação.
- Fix só em `GameLayout.jsx`: `onSkip` e o ramo final do `onNext` fazem `setMobileSubMenu(null)` antes de fechar o tutorial; passos intermédios intactos (o `onNavigate` continua a abrir o submenu de cada passo).
- Checks: eslint do ficheiro, `check:types`, mobile portrait `150/150` e landscape `180/180`; screenshots 390 (welcome) e 667 (landscape) revistos.

## Jornal: reacções dos adeptos com conteúdo editorial (2026-09-15)

- As notícias pós-jogo deixaram de mostrar apenas uma frase: cada uma das 9 variantes de humor tem agora dois parágrafos editoriais próprios, além do contexto do resultado, adversário, jornada/ronda, apito final e bilheteira.
- O texto usa apenas dados reais disponíveis no resultado e mantém a variação determinística; as quebras de parágrafo são visíveis no detalhe do Jornal.
- Checks: eslint/JSDoc, `check:types`, teste directo das 9 variantes (>500 caracteres), build Vite, harness Jornal retrato `5/5`, paisagem `6/6`, screenshots 390/667 revistos.

## Sidebar desktop fixa com Jornal no topo (2026-09-15)

- Removido o botão/estado de recolha da sidebar desktop; fica sempre expandida, agora com `14rem` para aproveitar melhor o espaço.
- O Jornal saiu da zona com scroll e ocupa um bloco fixo no topo; os restantes grupos continuam a percorrer apenas a área inferior.
- Offsets do conteúdo e do `MatchPage` usam sempre a largura fixa, incluindo durante o direto.
- Checks: ESLint dos ficheiros tocados (o erro Fast Refresh de `GameContext.jsx` é pré-existente), `check:types`, `git diff --check`, mobile portrait `150/150` e landscape `180/180`; screenshots portrait/landscape revistos.

## Jornal fixo no topo da barra desktop (2026-09-15)

- O grupo do Jornal na sidebar desktop fica `sticky` no topo do contentor de navegação, mantendo o acesso visível enquanto os restantes itens fazem scroll.
- Mobile e a ordem dos grupos permanecem inalterados.
- Checks: ESLint, `check:types`, `git diff --check`, mobile portrait `150/150` e landscape `180/180`; screenshots portrait/landscape revistos.

## Jornal: pesquisa rápida nos tópicos (2026-09-15)

- O cabeçalho `Tópicos` foi substituído por uma pesquisa rápida que filtra imediatamente a lista enquanto se escreve.
- A pesquisa ignora maiúsculas/minúsculas e acentos, procura no título e corpo da notícia e é limpa ao mudar de categoria.
- O harness confirma que um termo reduz a lista à notícia correspondente.
- Checks: eslint/JSDoc, `check:types`, build Vite, harness Jornal retrato `5/5`, paisagem `6/6`, screenshots 390/667 revistos.

## Jornal: acções juntas no rodapé dos tópicos (2026-09-15)

- Os botões `Marcar tudo como lido` e `Ler próxima` ficam juntos no rodapé da coluna Tópicos, em vez de ocuparem linhas separadas.
- Mantêm os mesmos estados, acções e comportamento responsivo.
- Checks: eslint/JSDoc, `check:types`, build Vite, harness Jornal retrato `5/5`, paisagem `6/6`, screenshots 390/667 revistos.

## Jogos de outras equipas sem eventos de chances (2026-09-15)

- `LiveFixtureRow` deixa de mostrar eventos `chance` no resumo inferior dos jogos, mantendo golos, cartões, lesões e substituições.
- A cronologia e os detalhes do jogo principal continuam a receber todos os eventos.
- Checks: ESLint do ficheiro, `check:types` e `git diff --check` OK.

## Efeitos de golo sem texto extra (2026-09-15)

- O overlay de golo mantém apenas `GOLO!` nos golos próprios; equipa, marcador e todos os textos do golo adversário foram removidos.
- O golo próprio usa um wash verde mais forte e confete; o golo adversário usa wash/flash vermelho mais intenso com shake do artefacto.
- Checks: ESLint dos ficheiros tocados, `check:types` e `git diff --check` OK.

## Jornal: notícia inicial fica logo lida (2026-09-15)

- Ao abrir o Jornal, a notícia não lida mais antiga continua seleccionada e passa imediatamente a lida; o contador/badge baixa sem exigir um segundo clique.
- A excepção mantém-se para bandeiras vermelhas, que continuam não lidas até serem respondidas.
- O harness verifica a leitura inicial e depois a sincronização da leitura de uma segunda notícia entre Jornal e badge.
- Checks: eslint/JSDoc, `check:types`, harness Jornal retrato `5/5` e paisagem `6/6`, screenshots 390/667 revistos.

## Jornal: filtros e tópicos com cores por categoria (2026-09-15)

- A coluna de tópicos ganhou um fundo ligeiramente mais claro para se separar do fundo da página.
- Os filtros têm cores ténues próprias: neutro, âmbar (clube), azul (competições), verde (plantel) e violeta (mercado); as linhas da lista repetem a cor da categoria da notícia.
- Notícias seleccionadas mantêm destaque e as bandeiras vermelhas continuam a ter prioridade visual.
- Checks: eslint/JSDoc, `check:types`, build Vite, harness Jornal retrato `5/5`, paisagem `6/6`, desktop `1280x900` e screenshots 390/667/1280 revistos.

## Jornal: colunas desktop preenchem a altura disponível (2026-09-15)

- A partir de `lg`, o Jornal usa a altura disponível abaixo do cabeçalho: as colunas de tópicos e corpo ficam esticadas, a lista ocupa o espaço livre e faz scroll interno quando necessário.
- Mobile mantém o layout empilhado e os limites de altura anteriores.
- O harness passou a procurar o título actual `Contas bancárias` depois dos últimos commits editoriais do Jornal.
- Checks: eslint/JSDoc, `check:types`, build Vite, harness Jornal retrato `5/5`, paisagem `6/6`, teste desktop `1280x900` e screenshots 390/667/1280 revistos.

## Amigáveis sem etiqueta de Taça no intervalo (2026-09-15)

- O indicador técnico `isCupMatch` também cobre amigáveis, mas o `MatchPage` tratava-os como Taça na etiqueta e no botão de avançar; a ronda `0`/nome amigável passa a excluir esses ramos.
- `IntervencaoView` deixa de preparar prolongamento para amigáveis; a lógica de Taça mantém-se nos jogos eliminatórios.
- Checks: `check:types` OK; ESLint dos 3 ficheiros tocados OK. `npm run lint` global mantém os 2 erros pré-existentes (`landing-resp-test.jsx`, `GameContext.jsx`).

## Jornal: títulos de transferências variados e normais (2026-09-15)

- As entradas de mercado deixam de usar sempre `reforça`: quatro títulos editoriais determinísticos alternam entre chegada, aposta, novo rosto e reforço.
- O título do artigo deixou de forçar `uppercase`, mantendo nomes e frases em capitalização normal.
- Checks: eslint/JSDoc, teste directo de quatro títulos distintos, harness Jornal retrato 5/5 + paisagem 6/6.

## Jornal: corpos editoriais mais ricos (2026-09-15)

- As notícias do Jornal passam a ter corpos mais desenvolvidos, com contexto e consequência para transferências, saídas, leilões, academia, finanças, estádio, prémios, renegociações, empréstimos e boas-vindas; as entidades continuam clicáveis nos segmentos originais.
- Notícias genéricas sem entidade associada (por exemplo, despensas de treinadores) também recebem contexto editorial, em vez de mostrarem apenas a descrição crua.
- A variedade usa o identificador da notícia, mantendo o texto estável entre renders e reloads, sem aleatoriedade.
- Checks: eslint/JSDoc, teste directo dos 16 tipos de notícia com corpo mínimo de 100 caracteres e `git diff --check`.

## Jornal: leitura começa na notícia mais antiga (2026-09-15)

- Ao abrir o Jornal, a selecção inicial é a notícia não lida mais antiga; o feed do servidor vem do mais recente para o mais antigo, por isso `Ler próxima` avança uma posição para cima nessa lista.
- Foram removidos os botões `Anterior` e `Seguinte` do corpo; `Ler próxima` fica no fundo da coluna de tópicos e desactiva quando não há outra notícia por ler.
- Checks: eslint dos ficheiros tocados, `check:types`, harness Jornal retrato `5/5`, paisagem `6/6`, screenshots 390/667 revistos e avanço automático testado no browser.

## Jornal: rescaldo inclui bilheteira sem ruído financeiro (2026-09-15)

- O Jornal deixa de receber linhas de `Rendimento Semanal`, `Folha Salarial`, `Manutenção do Estádio` e `Bilheteiras`; as contas continuam a ser aplicadas, mas as linhas antigas também são filtradas do feed.
- O rescaldo pós-jogo passa a mostrar a receita exacta da bilheteira, incluindo Liga, Taça e amigáveis; a divisão do amigável respeita a parte recebida por cada equipa.
- Checks: server `typecheck`, crash-recovery E2E, `audit:gamestate TST148` (0 erros/avisos), `audit:socketio` (0 erros/95 avisos pré-existentes), regressão de bilheteira, eslint/JSDoc/build client e harness Jornal retrato 5/5.

## Jornal: duas colunas no desktop (2026-09-15)

- Em desktop, o Jornal organiza os tópicos/notícias numa coluna esquerda e o corpo da notícia seleccionada numa coluna direita; cabeçalho, manchete, avisos e filtros continuam em largura total. Em mobile mantém-se empilhado.
- Checks: eslint de `JournalTab.jsx`, `check:types`, harness Jornal retrato 5/5 + paisagem 6/6, screenshot desktop revisto e build Vite OK.

## Jornal: marcar como lido e boas-vindas no clube

- O botão `Marcar tudo como lido` reutiliza `markAllRead` e marca apenas itens sem `redFlag`, deixando contratos/ofertas pendentes por ler.
- Notícias `welcome` passam a ficar em **O Meu Clube**, em vez de **Competições**.
- A Manchete da Semana foi anulada a pedido; o Jornal mantém o layout recente de tópicos/detalhe.
- Checks: eslint dos ficheiros tocados, `check:types`, `test:inboxreads`, harness Jornal retrato 5/5 + paisagem 6/6; screenshots 360 e 667 revistos. `npm run lint` global mantém os 2 erros pré-existentes (`landing-resp-test.jsx`, `GameContext.jsx`).

## Tutorial: balão com fundo claro

- O balão e a seta do tutorial usam fundo branco, texto escuro e progresso vazio em cinzento claro para melhor leitura sobre o overlay escuro.
- Checks: `npx eslint src/components/tutorial/CoachTutorial.jsx` e `npm run check:types` OK.

## Jornal: equipa própria abre gestão do plantel (2026-09-15)

- Os nomes e emblemas da própria equipa nas notícias do Jornal passam a abrir `players` (Gestão → Plantel), em vez de consultar `TeamSquadView`/História. As equipas adversárias continuam a abrir a consulta do plantel em `TeamSquadView`.
- Checks: eslint de `GameRoutes.jsx`, `check:types`, `test:squadnav` e build Vite OK.

## Jornal: transferência com percurso visual (2026-09-15)

- Notícias de negócios passam a apresentar a foto do jogador em cima e, por baixo, os emblemas da equipa de origem e da equipa de destino lado a lado, com seta vendedor → comprador. As restantes notícias mantêm a media genérica.
- O harness do Jornal passou a incluir IDs de jogador/vendedor/comprador para cobrir este percurso no detalhe.
- Checks: eslint dos ficheiros tocados, `check:types`, `test:inboxreads`, harness do Jornal retrato 5/5 e paisagem 6/6; screenshots revistos.

## Jornal: mudança de clube cria contexto novo

- `handleAcceptJobOffer` grava no novo `team_id` a notícia `welcome` “👋 Novo treinador no [Clube]”, com o nome do treinador e o texto editorial; após o insert emite `globalNewsUpdated`, o cliente troca o feed e a notícia fica não lida/seleccionada naturalmente.
- O histórico antigo não é apagado: o filtro por clube deixa de o mostrar, preservando a BD.
- Checks: server `typecheck` OK; `audit:socketio` 0 erros / 95 avisos pré-existentes.

## Jornal: notícia de boas-vindas em salas novas

- Ao atribuir a primeira equipa ao fundador de uma sala recém-criada, é gravada uma notícia `welcome` persistente: “📰 Bem-vindo ao [Clube]”, sobre a bancada, o plantel e a época. Reentradas e treinadores convidados não criam duplicados.
- Checks: server `typecheck` OK; `audit:socketio` 0 erros / 95 avisos pré-existentes.

## Jornal: leituras sobrevivem ao restart

- `checkCacheVersion` limpava o `localStorage` quando o servidor reiniciava, mas tratava as leituras (`cashball_inbox_read:*`) como cache descartável. Os prefixos das leituras passam a ser preservados, mantendo notícias já lidas ao voltar à sala.
- Checks: self-check de preservação, `npx eslint src/utils/cacheVersion.js` e `npm run check:types` OK.

## Jornal: filtrar pela equipa do treinador

- `getGlobalNews` identifica a equipa pelo `socket.id` e filtra `club_news` por `team_id`; `transfer_history` fica limitado a compras/vendas da mesma equipa. Sem sessão com equipa, devolve Jornal vazio em vez de expor notícias globais.
- Checks: server `typecheck` OK; `audit:socketio` 0 erros / 95 avisos pré-existentes.

## Briefing: mais altura no campo do adversário (fix)
- Avançados cortados: linha ATA a 80% + marcador com ~70px transbordava do contentor (`h-64`/`lg:h-[280px]`). Só `OpponentFormation.jsx`: `h-72`/`lg:h-[320px]` (curtos `h-44`/`lg:h-[200px]`); relvado partilhado intacto.
- Checks: `eslint` no ficheiro + `check:types` OK. Tweak de altura, sem mobile-resp-check.

## Jornal: notícias ricas, entidades e imagens

- O `globalNews` passa a transportar `team_id`, `player_photo`/posição e os IDs vendedor/comprador; `inboxItems` cria artigos locais variados por tipo, com segmentos clicáveis para jogadores/equipas e media de foto/brasões.
- O detalhe do Jornal usa o histórico do jogador e o plantel da equipa, com `PlayerAvatar`/`TeamCrest`; a lista mantém-se compacta.
- Checks: lint dos ficheiros tocados, `check:types`, server `typecheck` e self-check dos modelos — OK. `npm run lint` global continua bloqueado pelos 2 erros pré-existentes (`landing-resp-test.jsx`, `GameContext.jsx`).

## Jornal: datas em semana/ano

- As linhas do Jornal passam a mostrar `S<semana>/<ano>` (por exemplo, `S1/2026`), incluindo avisos locais; notícias históricas usam a semana/ano guardada e linhas incompletas usam a semana actual.
- Checks: `npx eslint src/hooks/useInbox.js src/utils/inboxItems.js`; `npm run check:types`; self-check de formatação — todos OK.

## Rejoin mobile não desmonta a sessão (novo)

- **Causa:** `joinError` fazia `setMe(null)` para qualquer erro e o timeout armado no `joinGameSuccess` nunca era cancelado no `teamAssigned`; um flape móvel podia desmontar o jogo e repetir joins até ao rate-limit, parecendo logout.
- **Fix:** erros transitórios preservam o jogo durante rejoin; só credencial inválida/expirada termina a sessão; sala apagada/expulsão limpa apenas o ponteiro da sala. `teamAssigned` cancela o timeout, e o join manual guarda `deviceId` + payload; retries de uma sala nova passam a reentrar na sala criada, sem criar outra.
- **Checks:** `npx eslint src/App.jsx src/hooks/useSocketListeners.js` OK; `check:types` OK; `test:mobile` 150/150; `test:mobile:landscape` 180/180. `npm run lint` global continua nos 2 erros pré-existentes (`landing-resp-test.jsx`, `GameContext.jsx`).

## Badge do Jornal = itens por ler (não só as 🚩)

- O botão Jornal (sidebar + nav mobile) mostrava só as **bandeiras vermelhas** (`inboxRedFlags`): uma caixa de entrada com notícias por ler ficava sem badge nenhum. Passa a mostrar **`unreadCount`** (tudo o que está por ler, bandeiras incluídas) — o mesmo número do cabeçalho do Jornal ("N novas") e o mesmo badge do Mercado (pill `bg-red-500`, teto `99+`).
- **Estado de leitura partilhado:** o `readIds` vivia dentro do `useInbox`, ou seja por instância — o badge (GameLayout, que nunca desmonta) e a lista (JournalTab) tinham Sets separados e o badge só se corrigia num reload. Novo `client/src/utils/inboxReadStore.js` (Map de módulo por sala+treinador, persistido em localStorage, observável) e o `useInbox` lê-o com `useSyncExternalStore`; abrir uma notícia baixa o badge na hora, em todos os consumidores.
- **Verificação:** `scripts/inboxReadStoreRegression.mjs` (`npm run test:inboxreads`) cobre aviso aos subscritores, isolamento entre chaves, persistência sobre um reload, reler o que já está lido (sem escrita/aviso — evita ciclo de render do badge), teto de 400 e **estabilidade da referência do snapshot** (contrato do `useSyncExternalStore`: referência nova a cada chamada = render infinito). O harness `journal-resp-test` ganhou um segundo consumidor de `useInbox` que faz de badge e clica uma notícia: `verdict` falha se o número não baixar em todos — provado por mutação (com `before - 2` falha, com `before - 1` passa).
- Pré-existentes (não desta alteração, confirmado com `git stash` das minhas mudanças): `npm run test:calendarsquad` falha em "MW7 = current" e `npm run test:skillhistory` rebenta (`skillHistory.js` já não exporta `skillEpoch`).

## Sala apagada fecha mesmo + template alinhado com o schema (dois OKs do utilizador)

- **`purgeGame(roomCode)` (novo, `gameManager.ts`)** e chamado no `DELETE /saves/:roomCode`: a sala deixa de ficar viva em memória depois de o ficheiro ser apagado. Fecha o `phaseTimer`, os timers de `pendingMatchActions`, resolve os `pauseWaiters` (sem `io` — não há ninguém para avisar), limpa o `socketRoomIndex`, marca a fase como `lobby` (um segmento em curso sai no tick seguinte), apaga de `activeGames` e fecha a DB. Sem isto: timers da semana a correr, `saveGameState` a escrever para um inode já desligado e um código reutilizado a devolver a sala antiga de memória.
- O `connected > 0` do delete passou a ler `activeGames[roomCode]` em vez de `getGame(roomCode)` — o `getGame` **criava** a sala do zero quando o ficheiro já não existia (apagar uma sala inexistente copiava o base.db para logo o apagar).
- **E2E verificado** (script descartável com servidor real + socket + HTTP): com treinador ligado → **409**; depois de desligar → `200 {ok:true,deleted:true}`, ficheiro apagado e `🗑 Sala … fechada em memória` no log; reentrada com `saved-game` → `joinError "Sala não encontrada"` (não ressuscita). Limpei a conta/saves do teste do checkout.
- **`connect-smoke`** ganhou a asserção `typeof gameManager.purgeGame === "function"`: o `index.ts` é `@ts-nocheck` e chama-o no delete, por isso um export renomeado só rebentava no dia em que alguém apagasse uma sala.
- **Template alinhado com o schema:** `schema.sql` passou a criar `room_seats`, `room_events` (+ índice), `chat_messages`, `player_tactic_history` e `applied_weeks` (DDL copiada do `ensureRoomStateTables`/`getGame`, sem divergir); `dropSchema` do `seed.js` inclui-as; e o `REQUIRED_TABLES` do `ensureSeeded.js` verifica-as — assim um base.db atrás do schema é detetado em vez de compensado em runtime. O `base.db` local foi re-semeado: **19 tabelas, 60 equipas, 1320 jogadores**, e o segundo arranque já diz `base.db atualizado — a saltar seed.` (re-seed é uma vez só).
- **Nota para o deploy:** no próximo `docker compose up --build` aparece **uma vez** `[ensureSeeded] base.db desatualizado (…) — a fazer seed...` — é esperado e não toca em salas existentes.
- Checks: `build` OK; `typecheck` OK; `test:session-freeze` 11/11; `test:engine-unit` 19/19; `test:crash-recovery` ✅; `test:connect-smoke` ✅; `audit:socketio` 0 erros.

## Log limpo no arranque + checkpoint com identidade obrigatória (fix)

- **`player_tactic_history delete falhou` / `chat_messages delete falhou` (stack traces a cada sala nova):** o pool sampling apaga as 20 equipas descartadas **antes** de o `getGame` criar essas duas tabelas (`CREATE TABLE IF NOT EXISTS` mais abaixo), e o `base.db` do template não as tem (`player_tactic_history`, `chat_messages` e `room_seats`/`room_events` estão ausentes do template local de 14/09). Efeito real: zero (sem tabela não há linhas a limpar) — só log de alarme. Fix: os dois `DELETE` só correm se a tabela existir (`sqlite_master`), com o try/catch a manter-se para erros a sério. Verificado com o caminho real de criação de sala: **antes 2 avisos, depois 0**, 40 equipas e tabelas criadas a seguir.
- **`Checkpoint descartado (... época undefined slot undefined vs 1/3)`:** era o guard a funcionar (checkpoint de outra jornada). Aproveitei para **exigir identidade**: um checkpoint sem `season`/`calendarIndex` é de uma build anterior e passa a ser recusado mesmo que os jogos coincidam — o sorteio repete pares entre jornadas, e aceitá-lo reintroduzia o dilúvio de "minuto N já simulado". Preferimos recomeçar 0-0 a marcar uma jornada inteira (F9 cobre este caso). Log passou a dizer `época=— slot=—`.
- **`liveMinute` residual em lobby:** o cursor persistido (ex.: 41 num lobby) era restaurado tal e qual e era o valor que fazia `from = max(1, liveMinute+1)` saltar minutos. Passa a ser descartado (com log) quando a fase é `lobby`. Verificado no `game_FGPQH6.db` real.
- **`🪑 0 assento(s) | eventSeq=0` seguido de `Backfill de 2 assento(s)`:** o log corria antes do backfill e dizia 0 assentos numa sala com 2. Passou para depois do backfill.
- Checks: server `typecheck` OK; `test:session-freeze` 11/11; `test:engine-unit` 19/19; `test:crash-recovery` ✅; `test:connect-smoke` ✅; `audit:socketio` 0 erros.
- **Ceiling conhecido (não tocado):** apagar uma sala em `/saves` remove o ficheiro e os acessos, mas **não** limpa `activeGames[roomCode]` — a sala continua viva em memória até ao restart (sem sockets ligados, o endpoint recusa se houver). Consequência teórica: `generateUniqueRoomCode` só verifica ficheiros, por isso um código reutilizado no mesmo processo devolveria a sala antiga de memória (probabilidade ~1/2×10⁹). Se quiseres, adiciono `purgeGame(roomCode)` ao delete.

## `resetAllReady`: o mesmo bug do intervalo existia em mais 6 sítios (fix)

- **Padrão (bug real):** o `checkAllReady` lê `seat.intent.ready`, mas **sete** sítios limpavam só `playersByName[x].ready`. Um `intent.ready` obsoleto a `true` fazia a sala avançar **sem ninguém clicar Pronto**: fim de liga (`weeklyFlowHelpers` → arranque da jornada seguinte), erro de geração de fixtures, `recoverFinalizedSlot` (crash recovery), entrada no `match_et_gate` (prolongamento automático!), fim de taça e fim do amigável. O intervalo já tinha sido corrigido em `f162c1d` — a causa era a lógica duplicada à mão em cada sítio.
- **Fix na raiz:** novo `resetAllReady(game)` em `roomStateHelpers.ts` (limpa o intent de todos os assentos + a projeção, persistindo só os que mudam) e os 7 sítios passam a chamá-lo — incl. o do intervalo, que assim usa a mesma implementação. Sítios que limpam a projeção e logo libertam/apagam o assento (`leaveRoom`, despedimento) ficam como estão; o gate do 11 já escrevia os dois.
- **Teste:** `test:session-freeze` 11/11 (F11: limpa intent + projeção, preserva a tática, persiste só o alterado, e a invariante "nenhum membro pronto depois do reset").
- Checks: server `typecheck` OK; `test:engine-unit` 19/19; `test:crash-recovery` ✅; `audit:socketio` 0 erros.

## Dilúvio de "minuto N já simulado" (fix): checkpoint sem identidade

- **Sintoma:** centenas de `⚠ minuto 1 já simulado nesta fixture — ignorado` durante o intervalo. A conta bate certo: **16 jogos × 45 minutos = 720 linhas** para UMA chamada de `runMatchSegment(1,45)` em que todos os minutos já estavam marcados — o jogo "jogava" 45 minutos em ~0 ms e fechava a jornada a 0-0.
- **Causa (minha, do commit da retoma):** o `matchCheckpoint` era guardado/restaurado **sem identidade** e aplicado por posição no array. Um checkpoint de uma jornada anterior colava `_simulatedMinutes` (1..45) às fixtures NOVAS no load (`gamePhase` restaurado = `lobby`), e o `startWeekOnce` seguinte marcava tudo como já simulado. O cursor `liveMinute` em falta agravava: `from = max(1, 0+1) = 1`.
- **Fix (3 guardas independentes):**
  1. `saveMatchCheckpoint` grava `season` + `calendarIndex` + casa/fora de cada jogo; `applyMatchCheckpoint` (puro, testável) **recusa** o que não for desta jornada e destes jogos — e não toca nas fixtures quando recusa.
  2. `clearMatchCheckpoint` no arranque de cada semana (`startWeekOnce`) e no fim de liga/taça/amigável: o checkpoint não sobrevive à substituição das fixtures.
  3. Retoma com fallback: `from = max(1, (liveMinute ?? lastSimulatedMinute(game)) + 1)` — nunca recomeça em 1 com o segmento marcado.
  Aviso do motor deduplicado por minuto/fixture e com o segmento (`segmento 1-45`) para identificar quem re-simula.
- **Regressão evitada:** ao reescrever `saveMatchCheckpoint` revertei sem dar por isso o fix `bf88da0` (`_yellowCards` é objeto no engine, não Set) — `[...f._yellowCards]` rebentava em todos os jogos. Restaurado (`{...}` na escrita; leitura tolerante a objeto/array legado) e **F8 passou a testar os dois formatos reais** (`_yellowCards` objeto, `_subbedOut` Set).
- **Testes:** `test:session-freeze` 10/10 (F9 recusa checkpoint de outro slot/época/jogos; F10 fallback do cursor). `test:engine-unit` 19/19, `test:crash-recovery` ✅, `test:connect-smoke` ✅.
- **Nota:** `saves/gonfig1/game_FGPQH6.db` (deste checkout) mostra o padrão `fase=lobby` com `minuto=41` residual — rooms escritos antes deste fix podem ter um checkpoint envenenado na DB; a partir daqui é recusado no load. Uma jornada já fechada a 0-0 por este bug não se recupera sozinha (os resultados ficaram gravados).

## Causa raiz do "não consigo entrar": identificador mal qualificado em index.ts (fix, meu)

- **Bug (meu, produção):** no commit do congelamento adicionei `emitPresencePause,` aos deps de `registerAdminSocketHandlers`, mas o `const`/namespace ficou por qualificar (`roomState.emitPresencePause`). `server/index.ts` tem `// @ts-nocheck` na linha 1 → **nem `typecheck` nem `build` viram nada**. Em runtime, o callback de `connection` rebentava (`ReferenceError: emitPresencePause is not defined`) e o socket.io fechava a ligação: nenhum cliente entrava em sala nenhuma. Corrigido no `1489e51` (não por mim).
- **Porque não reproduzi:** o tree já tinha esse fix quando testei, e `git status` limpo fez-me assumir que não havia nada de novo entre o meu commit e o teste.
- **Guarda nova (`test:connect-smoke`):** arranca o servidor numa porta livre (SO), liga um socket de verdade, faz `joinGame` com token inválido (exige `joinError`) e pergunta a um handler registado **depois** do admin (`getTrainingFocus`) — se o registo de handlers for interrompido a meio, a resposta nunca chega. Processo morto por grupo (`detached`), porta por corrida: uma porta fixa deixava um servidor órfão a dar **falso PASS**. Provado nos dois sentidos: código bom → exit 0; bug reintroduzido de propósito → exit 1.
- **Regra:** mudanças em `server/index.ts` (ou em qualquer ficheiro com `@ts-nocheck`) exigem `npm run test:connect-smoke` antes de "feito".

## Join auto-recuperável: fim da espiral de timeout (fix)

- **Reportado:** depois de reiniciar o servidor, "já não consigo entrar" com "Sem resposta do servidor". Logs do backend mostravam `assignPlayer reconnect` + `emitCurrentPhaseToSocket` (o servidor respondia) e o cliente a repetir o join em ciclo (~10s).
- **Causa (cliente):** `armJoinTimeout` fazia `setMe(prev => prev && !prev.teamId ? null : prev)`. Com `me` a null, o `handleJoinSuccess` (`if (!prev) return null`) e o `teamAssigned` (`if (!currentMe?.name) return`) eram **descartados**; o efeito de auto-join re-corria (dep `me?.teamId`) e repetia o ciclo — um único `teamAssigned` perdido bloqueava o cliente **para sempre**.
- **Fix:** o timeout já não limpa `me`; reenvia o último payload de join (`lastJoinRef`) com contador (máx. 5) e mensagem de progresso. `joinGameSuccess`/`teamAssigned` reconstroem `me` a partir da sessão guardada (`savedSessionRef`/`loadSavedSession()`) em vez de descartar. `joinRetryRef` é reposto em cada `joinGameSuccess`.
- **Verificação servidor:** instância própria em `PORT=3111` (`process.env.PORT`, antes hardcoded) — sala nova, restart do processo, e 3 reentradas seguidas no mesmo código (incl. `deviceId` diferente): `teamAssigned` recebido nas 3, sem `joinError`.
- **Aviso de ambiente (não é código):** existe um `tsx index.ts` **de ontem (set 14)** a ocupar `*:3000` no host, fora do docker — o container `cashball-backend-1` não publica a porta. Quem ligue a `localhost:3000` fala com esse processo de código antigo. `ss -ltnp | grep 3000` + `kill <pid>` quando não estiver a ser usado.
- Checks: client `lint` (só os 2 pré-existentes) + `check:types` OK; `test:mobile` 155/155 + landscape 186/186; server `typecheck` OK.

## Banner de reload manual após restart (novo)
- Pedido do utilizador; o reload automático tinha sido removido de propósito (ecbdbde: join na janela de arranque apagava a sessão). Solução manual: `subscribeServerRestart` no `socket.js` + `ServerRestartBanner.jsx` (fixo no topo, não bloqueante, dispensável) montado no `GameLayout`; o `requestResync` automático continua.
- Checks: `eslint` + `check:types` OK; `test:mobile` 155/155 + `test:mobile:landscape` 186/186 PASS.

## Intervalo vazio após refresh + avanço sem Pronto (fix YX5CZE)
- Painel vazio: no (re)join o `mySquad` (query async) perdia sempre a corrida contra `gameState`/`halfTimeResults` (síncronos) — o painel abria com o plantel por chegar (adversário vinha no payload, por isso OK). Com o event loop ocupado a simular, eram segundos de painel vazio. Fix: `gameState` + fase + presença + ações pendentes só emitem dentro do callback do `mySquad` (`assignPlayer` e `requestResync`; este com ramo `else` para sem-equipa).
- Avanço sem Pronto: a entrada no intervalo só limpava `playersByName.ready`, não o `intent.ready` do assento — o rejoin herdava ready obsoleto e o `checkAllReady` do join avançava no mesmo segundo (log 12:21:33). Fix: limpa ambos, igual ao precedente do lobby.
- Checks: server `typecheck` OK; `audit:socketio` 0 erros. **Por ativar:** prod corre de `dist/` → `build` + restart.

## Crash 1.ª parte: `_yellowCards is not iterable` (fix)
- Causa: `saveMatchCheckpoint` (`roomStateHelpers.ts`) fazia `[...f._yellowCards]`, mas o engine guarda amarelos como objeto (`Record<number,number>`, não iterável) — crash em todos os jogos à primeira gravação do checkpoint. Escrita passa a `{ ...f._yellowCards }`; restauro (`gameManager.ts`) repõe objeto com tolerância ao formato array legado.
- Checks: server `typecheck` OK; harness tsx roundtrip escrita→restauro OK (populado/vazio/legado). **Por ativar:** prod corre de `dist/` → `build` + restart.

## ClubTab: "Jornal do Clube" → "Histórico do Clube"
- A secção do ClubTab fazia confusão com a página Jornal (`JournalTab.jsx`, tab global da bancada). Renomeado só o visível (título do Panel + comentários + texto do tutorial); props/variáveis (`clubNews`, `groupedNews`, `NewsRow`) intactas para diff mínimo.
- Checks: `eslint` nos ficheiros tocados OK + `check:types` OK (`lint` global só os 2 erros pré-existentes).

## Hotfix prod: emitPresencePause is not defined (crash à conexão)
- **Causa:** `server/index.ts:1220` passava `emitPresencePause` como nome nu para o `registerAdminSocketHandlers`, mas o ficheiro só importa o namespace `roomState` — `ReferenceError` em cada conexão (vinha do `ecbdbde`). Fix de 1 token: `roomState.emitPresencePause`.
- **Porque passou os checks:** `index.ts` tem `// @ts-nocheck` na linha 1 — `typecheck` e `build` nunca o verificam. Lição: toques no `index.ts` exigem prova de runtime. Também visto de caminho: o processo não sai após `listen EADDRINUSE` fatal (fica pendurado) e a `PORT` está hardcoded a 3000.
- **Prova:** `build` OK + smoke local com cliente socket.io real → `serverStartTime` recebido, 0 exceções; `dist` reconstruído limpo (só `server/index.ts` no commit).
- **Falta:** `git pull && docker compose up --build` na prod (o `dist` de lá tem de ser reconstruído).

## Audit ecbdbde+f8580c2 — coerência assento↔projeção (fix)
- **Bug real (novo, do próprio ecbdbde):** `kickCoach` (`socketGameplayHandlers.ts`, lobby) nunca libertava o assento — `computeAbsentees` mantinha o expulso como ausente e a sala congelava para sempre (só `adminReleaseRoom` safava). Agora `releaseSeat(..., "kicked")` + `emitPresencePause`.
- **Divergência ready:** disconnect em lobby limpava `playersByName.ready` sem tocar no assento (servidor contava pronto, UI mostrava por confirmar) — reset removido (flape não apaga ready; a ausência bloqueia via `computeAbsentees`). Barreira do 11 no arranque e `isSeatPresent` alinhados no mesmo sentido (`setSeatIntent ready:false` na falha de lineup; presença falsa para `status !== "member"`).
- **Admin remove:** janelas pendentes (lesão/substituição) do removido resolvem com fallback como no `leaveRoom` (antes bloqueavam até ao timeout). `kickCoach` é só-lobby, sem pendentes possíveis.
- **Cliente:** `useSocketListeners` passa a usar `subscribeSessionDisplaced` (o pub/sub do `socket.js` estava sem subscritores).
- Checks: server `typecheck` OK; `test:session-freeze` 8/8; `test:engine-unit` 19/19; `audit:socketio` 0 erros; client `eslint` + `check:types` OK; `roompause-resp-test` portrait 5/5 + landscape 6/6 com screenshots 360 e 667 verificados.

## Sessão/estado de sala reescritos: assentos duráveis + congelamento (novo)

- **Bug real:** com um cliente offline, o jogo **avançava sozinho para a jornada seguinte** e as decisões dele eram tomadas pelo servidor. Duas causas, ambas explícitas no código: `engine.ts` `waitForMatchAction` fazia `return fallback()` para "treinador conhecido mas sem socket" (`source:"auto"`); e `checkAllReady` contava só os **ligados** (`getPlayerList`), pelo que o intervalo/fecho da jornada avançava sem o ausente.
- **Modelo novo:** `room_seats` (equipa/`ready`/tática/`seat_epoch`/`deviceId`) é a fonte durável; `playersByName` é projeção. Presença = socket ligado **ou** lease (`seatSeenAt`) dentro de `PRESENCE_GRACE_MS` (25s) — um flape deixa de apagar `ready`/tática. Novo módulo `server/roomStateHelpers.ts`; `presenceHelpers` deriva offline dos assentos.
- **Congelamento:** `computeAbsentees` (assentos com equipa na ronda sem presença) + `waitForPresence` (Promise resolvida na volta). Gates: barreira por minuto, `waitForMatchAction` (janela re-arma em vez de resolver), `checkAllReady` (todas as fases, por assento), `advanceFromHalftime`, `continueFromEtGate`, `resumeInterruptedMatch`. O disconnect **deixou de** consumir/finalizar `pendingMatchActions`. Saídas explícitas: `leaveRoom`, kick, despedida, **novo `adminReleaseRoom`** (obrigatório — senão uma sala abandonada morre).
- **Durabilidade:** `room_events` (append-only + `seq`) e `matchCheckpoint` por minuto (golos/eventos/lineups/posse/subs). O load já **não** repõe fases transitórias a `lobby`; `resumeInterruptedMatch` retoma no minuto seguinte. `resetPartialMatchState` **removido** (código morto + teste U14). `replayEventsSince` reaplica a janela `seq > snapshotSeq`.
- **Cliente:** `cashball_auth` ≠ `cashball_rooms` (um erro de auth já não apaga o ponteiro da sala); `deviceId` persistido e `sessionDisplaced` só com dispositivo diferente (e **nunca** desliga `reconnection`); fim do `window.location.reload()` no `serverStartTime` (passa a `requestResync`); `connectionStateRecovery` do socket.io ligado; `seq` + `requestResync` em `socket.js`; novo `RoomPauseBanner.jsx` montado no `GameLayout`.
- **Nota (desvio assumido):** o log de eventos é write-ahead para sequência/auditoria/resync — a projeção do snapshot continua autoritária (`applyRoomEvent` cobre só fase/cursor). Event sourcing puro fica para quando o snapshot deixar de chegar.
- **Corrigidos de caminho (pré-existentes, bloqueavam verificações):** `crashRecoveryRegression.mts` rebentava em `savesDirFor is not defined` (regressão do `9852f8b`) e a fórmula esperada das finanças semanais não incluía `STADIUM_UPKEEP_PER_SEAT_WEEK` (teste nunca corria). `test:substitutions` falha "último minuto" **antes e depois** (pré-existente, não tocado).
- **Checks:** server `typecheck` OK; `test:session-freeze` 8/8; `test:engine-unit` 19/19; `test:crash-recovery` ✅ (todos os cenários); `audit:socketio` 0 erros; `audit:gamestate TST148` 0/0/0; client `lint` (só os 2 pré-existentes: `landing-resp-test.jsx`, `GameContext.jsx`) + `check:types` OK; `test:mobile` 155/155 + `test:mobile:landscape` 186/186 (novo harness `roompause-resp-test`) com screenshot 360 e 667 verificados.


## Chances com descrição rica e curta na Cronologia (novo)

- `commentary.ts`: `chanceSavedPhrase` 5→12, `chancePostPhrase` 3→8, `chanceOffTargetPhrase` 4→10 — frases de 1 oração com cor de lance (cabeceamento, de primeira, contra-ataque, livre, canto); nomes mantidos porque o ticker do `LiveMatchHero` mostra o texto isolado.
- `EventCard.jsx`: nas `chance`, a frase aparece a seguir ao nome (atenuada, `truncate`) — antes o `text` era ignorado quando havia `playerName`. Sufixo deriva do texto (fora prefixo `[NN']` emoji + nome, com arranjo de `de/por` órfãos); verificado 30/30 frases via script.
- Checks: server `typecheck` OK; client `eslint` + `check:types` OK. Tweak de texto/`className` → sem mobile-resp-check.

## Cooldown/contratos: unidades de matchweek unificadas (fix)

- **Bug real (alta):** `transfer_cooldown_until_matchweek` misturava unidades — os escritores por slot (`currentSlot`, 1..20: venda de leilão, compra NPC, prospeto da academia e `joined_matchweek` da renovação NPC) escreviam slots, mas o leitor `isPlayerAvailable` compara com `game.matchweek` (1..14). Jogador adquirido na Taça (slots 15–20 = mw 12–14) ficava com `mw > cooldown` nunca verdadeiro → indisponível o resto da época (o comprador humano pagava por um jogador que não jogava). Fix: todos os escritores passam a `game.matchweek` (`auctionHelpers.ts`, `npcTransferHelpers.ts`, `contractHelpers.ts` ×2); a limpeza de fim-de-época (`cupFlowHelpers`) já era matchweek. `joined_matchweek` dos escritores de compra já era matchweek; só a renovação NPC era slot (tolerância do grace do enferrugamento em `engine.ts` fica ±1–2 — impacto desprezável).
- **Inconsistência NPC/NPC:** `processContractExpiries` não filtrava `transfer_status` — um jogador já listado como "fixed" na semana anterior podia ser renovado (e tirado do mercado) na mesma semana em que expirava. Fix: `AND p.transfer_status NOT IN ('fixed', 'auction')` na query de expirados; os candidatos à venda continuam a ser re-listados pela venda semanal NPC como antes.
- **Endurecimento:** `maybeTriggerContractRequest` — com `wage = 0`, `cap = 0` e o pedido ficava preso (`contract_requested_wage = 0` nunca é re-emitido pelo resend; `processContractExpiries` pula pendentes). Fix: `cap = max(cálculo, wage + 100)` (piso; o caminho não é atingível hoje — seed/renovação/pressão dão sempre salário > 0).
- Checks: server `typecheck` OK; `audit:socketio` 0 erros; `audit:gamestate TST148` 0/0/0. Sem mobile-resp-check (zero cliente).

## Pitch do 11 provável invisível no briefing (fix)

- **Causa real: colapso de altura, não faltam dados.** Servidor inocente provado em todos os saves/ramos (liga, taça, amigável — `getOpponentProbableFormation` devolve sempre 11; `dist/` atual). View-model cliente ok com payload real. O card "Formação provável" renderizava as rows mas o relvado media **0px no desktop**.
- **Mecânica:** wrapper do relvado usava `lg:h-auto lg:flex-1 lg:min-h-[280px]` — altura indefinida (`h-auto` + só `min-height`) → o filho `h-full` do `PitchFormation` resolve 100% de indefinido = 0. Mobile escapava porque `h-64`/`h-40` são alturas definidas.
- **Fix:** alturas definidas em todos os breakpoints — `lg:h-[280px] short:lg:h-[180px]` (1 linha, `OpponentFormation.jsx`). Corte de ~26px da linha ATA é pré-existente do mobile (h-64 cortava igual) — consistente agora.
- **Evidência:** harness `briefing-resp-test.html` no Chromium — pitch 0→280px no desktop; 256px no mobile (intacto).
- **Regra permanente:** altura definida (fixa ou esticada por flex de pai com altura definida) sempre que um filho `h-full` vive dentro de `flex-1` — `min-height` não dá base para percentagens.

## Auditoria engine.ts: reset parcial incompleto + fallback de lesão (fix)

- **Auditoria proativa ao `server/game/engine.ts`** (3784 linhas + chamadores + testes): typecheck OK, `test:engine-unit` 19/19, `test:segment-barrier` OK. Um bug real:
- **`resetPartialMatchState` descartava só golos/eventos/lineups/`_simulatedMinutes`** — deixava `_deltas` (golos/vermelhos/lesões da passagem interrompida contavam a dobrar no flush do apito final), `_subbedOut`/`_yellowCards` (banido/cartão do jogo velho), `_homeSquad`/`_awaySquad`/rosters/moral/fadiga cacheados e os flags de comentários (`_firstHalfStartComment` etc. → replay sem eventos de introdução). Agora apaga tudo o residual e mantém ambiente pré-jogo (`_occupancy`/`_ticketPrice` fixados na preparação da jornada).
- **Fallback de lesão:** validação do substituto passou a usar `substituteCandidates` (a lista enviada ao cliente) em vez de `availableBench` — quando o lesionado é GR com GR no banco, um choice fora da lista deixava a equipa sem GR em campo.
- **Não-bugs verificados:** prolongamento sem janelas de ação (fallback do timeout resolve, aceitável); guarda anti-replay das presenças com `calendarIndex` correto (slot 0 excluído por desenho); 2 golos no mesmo minuto impossível numa passagem (penálti falhado + open play do outro lado é o único par possível).
- Checks: server `typecheck` OK; `test:engine-unit` 20/20 (novo U14); `audit:socketio` 0 erros; `audit:gamestate FGPQH6` 53 (pré-existentes de mínimos de plantel). Sem mobile-resp-check (zero cliente). Prod corre de `dist/` → `build` + restart.

## Saída sem pedido de renovação (fix)

- **Fuga na cláusula de rescisão:** `makeTransferProposal` (`server/socketTransferHandlers.ts`) bloqueava propostas só contra equipas com treinador **ligado** (`p.socketId`) — o resto do servidor usa "esteve na sala = humano, mesmo offline". Contrato expirado + dono offline + agente ainda sem ligar (1.ª semana pós-lock excluída + 25%/semana) → outro humano comprava por cláusula sem a janela de renovação aparecer; com `contract_request_pending` também passava. Guarda agora sem `socketId` + rejeição explícita se `contract_request_pending`.
- **`buyPlayer` sem validação de mercado:** só a UI filtrava `transfer_status != 'none'` — socket direto comprava qualquer jogador. Guarda server-side adicionada.
- Checks: server `typecheck` OK; `audit:socketio` 0 erros. Sem mobile-resp-check (zero cliente). **Pendente:** teste manual com contrato expirado e dono offline.

## Motor: banco a marcar, 2 golos no mesmo minuto, lesão sem ecrã (fix)

- **Suplente a marcar (era real, não do motor):** `swapOnPitch` (`server/game/engine.ts`) escrevia a entrada de lineup do jogador que entra **sem `is_starter`** e deixava lá a entrada antiga de banco → o cliente (`MatchView.jsx` separa XI/banco por `is_starter`) mostrava-o no Banco enquanto o motor o tinha em campo. Agora a entrada leva `is_starter: true` e a antiga de banco é removida (sem duplicados). Varredura das 1495 partidas em `server/saves`: 252 entradas sem flag (todas com id duplicado no mesmo lineup) e 8 partidas em que o autor do golo constava como banco.
- **2 golos no mesmo minuto da mesma equipa:** impossível numa passagem (`goalScoredThisMinute` fecha os dois lados + penálti); 800 jogos completos (1-45 + 46-90 + 91-120) no motor atual → 0 casos e 0 divergências marcador↔eventos. Só acontecia com a mesma fixture a correr dois segmentos (duplo arranque da semana, fechado a 13/14-set). Guarda nova: `fixture._simulatedMinutes` — minuto já simulado é saltado com `console.warn`.
- **Lesão sem ecrã:** três rotas silenciosas fechadas — treinador sem socket e limite de 3 substituições passam a emitir `systemMessage` broadcast; a reemissão da ação pendente no reconnect passou a vir **depois** de `emitCurrentPhaseToSocket` (o `matchReplay` limpava o modal). Cliente: o fallback de lesão deixou de oferecer o plantel inteiro (quem está em campo não pode entrar) e, sem banco, mostra o hint + botão "Continuar sem substituição" (equipa joga com menos um).
- **Restart a meio de jogo (reiniciar limpo, decisão do utilizador):** `resetPartialMatchState` (engine, puro) é chamado no `startWeekOnce` e descarta golos/eventos/lineups parciais antes de re-simular, com aviso broadcast. Antes, o replay somava golos por cima e punha um plantel de 17-18 (snapshot starters+suplentes) em campo — harness reproduziu 28% de jogos com suplente a marcar.
- **Prolongamento:** `getGoalTimeMultiplier` devolvia 1.62 a todos os minutos >86, incluindo 91-120. Nova chave `MATCH_TUNING.extraTimeChanceMult: 1` — 1500 jogos: 1.62 → 1.19 golos/ET e 70% dos ET decididos; 1.0 → 0.72 e 51% (49% para penáltis).
- Checks: server `typecheck` OK; client `lint` (só os 2 pré-existentes) + `check:types` OK; `audit:socketio` 0 erros; `audit:gamestate FGPQH6` 53 (só os pré-existentes de mínimos de plantel); `test:mobile` + `test:mobile:landscape` no harness `intervencao-test` PASS (5/5 e 6/6, screenshot landscape 667 visto). Harness tsx temporário (em `/tmp`, apagável): lineup sem duplicados/flags após sub, 2.º segmento não repete minutos, reset limpa estado.
- **Por ativar:** restart do backend (produção corre de `dist/`).

## Fotos no campo da Tática + restart prod (novo)
- O campo da Tática mostrava só a inicial (por desenho); os marcadores usam agora o `PlayerAvatar` local (foto com anel da posição, fallback SVG), mesma medida `w-10 h-10`, badge de indisponível intacto. Só cliente.
- Cartão “Formação Provável” vazio + fotos em falta no direto: backend corria imagem com 44h (anterior ao fix das fotos `e0cc1c3` — o resumo do adversário seguia sem `id`/`photo`). `docker compose up --build -d backend` com as 35 salas em lobby; verificado listening + socket. Falta o Fabio re-picar a formação e confirmar o cartão.
- Checks: client `eslint` + `check:types` OK. Sem mobile-resp-check (mesma medida/estrutura, só conteúdo do círculo).

## 11+7 verde no cliente, recusado no servidor (fix FGPQH6)
- Causa: três bases de disponibilidade divergentes com `calendarIndex=16, matchweek=12` — `mySquad` (6 emits) e auto-pick/handlers usavam `matchweek(+1)` = 12/13 (Pedro Santos lesionado até 16 → indisponível → 1 júnior-fantasma no pool), mas a validação (cliente `annotatedSquad` + servidor `checkLineupReady`) usa `calendarIndex+1` = 17 (Pedro disponível, sem júnior). A tática marcava o fantasma no banco + Pedro excluído → servidor contava 6 suplentes reais. Botão verde porque o cliente conta o fantasma como válido.
- Fix: base única `upcomingBase = (calendarIndex ?? matchweekCount) + 1` no `TacticsContext` (contagens, auto-pick, 3 handlers); 6 emits `mySquad` passam a `upcomingMatchweek(game)` (`auction`, `coachDismissal` ×2, `socketSession`, `socketTransfer` ×2; `weeklyFlow` já estava certo). Teto manual de suplentes `5` → `MAX_BENCH_SIZE` (2 handlers; o teto 5 de titulares por posição está correto). Vistas só-leitura (`teamSquadData`, job offers, scouting adversário) intactas.
- Reparação Fabio: voltar a picar a formação (auto-pick reconstrói 11+7 reais na base certa). Produção corre de `dist/` → `build` + restart com timing dos jogadores.
- Checks: server `typecheck` exit 0; client `eslint` + `check:types` OK; `audit:socketio` 0 erros; `audit:gamestate FGPQH6` só os 53 pré-existentes de mínimos de plantel. Sem mobile-resp-check (zero layout).

## Double-start semanal + landing do amigável (fix duplo)
- **Finanças `cannot start a transaction within a transaction` (KKHTGJ):** dois "Pronto" quase simultâneos passavam a barreira do 11 (awaits) antes de `segmentRunning=true` → dois `startWeekOnce` sobrepostos → segundo BEGIN dentro da transação do primeiro. Fix: single-flight síncrono no ramo lobby do `checkAllReady` (reclama à entrada; repõe nas saídas antecipadas: barreira, `!entry`, `recoverFinalizedSlot`). `startWeekOnce` tem um só chamador.
- **Sem aterragem ao Jornal após amigável:** a chave `cup:época:ronda` derivava de `isCupMatch`, morto pelo efeito de limpeza no commit seguinte aos resultados — se o direto ainda não tinha terminado, a chave nascia morta. Fix (`GameOverlays.jsx`): latch em estado à chegada dos resultados (só com jogo visto; Taça/amigável sobrescrevem; Liga só com `mom`, que o direto não traz). Viajem/gate intactos.
- Checks: server `typecheck` OK; client `eslint` + `check:types` OK; `audit:socketio` 0 erros; `audit:gamestate 445WU8` 0/0/0 (KKHTGJ só existe em prod). Sem mobile-resp-check (zero layout).
- **Por fazer (observado, fora do plano):** empate no amigável mostra humor de derrota (`winnerId null → "loss"` no efeito Taça do `GameContext.jsx`).
- Enxugado 5881→5636 bytes (mobile 2 linhas→1, Reseed/Workflow/Protocolo §2 comprimidos); dups com CLAUDE.md mantidos (reforço intencional). Fix factual: `ensureFullBench` = 2 GR + 16 campo (estava 14). Política de poda nas Regressões (teto ~10). Só markdown → sem checks.

## CLAUDE.md factual (novo)
- 6 retoques: BD → `saves/<criador>/` via `roomPaths.js`; `game/` com os 7 ficheiros; cliente com `TransferHub`/`GameRoutes`/`GameOverlays`; regra helpers alinhada com AGENTS.md; removida nota falsa do CommonJS (`engine.ts` é ESM); secção nova "Sistemas transversais" (MOM, adeptos, barreira do 11, presença, 1 linha cada). Só markdown → sem checks.

## README reescrito para jogadores (novo)
- Reescrita completa do `README.md`: pitch Elifoot 98 + multiplayer assíncrono 1–8, como se joga (tática → Pronto → direto), visão do jogo (plantel/craques, Liga 4 divisões, Taça 5 rondas, mercado/leilões, finanças/despedimento, carreira) e bloco curto para programadores (stack + 4 comandos + links para AGENTS/CLAUDE/STYLE/docs). Sem código tocado → sem checks/audits.

## Briefing + 11 no amigável (fix)
- Causa: o sorteio do amigável só corria no fim de época ou no pontapé de saída — sala nova chegava ao lobby do slot 0 sem fixtures; o cliente lia `isCup && !opponent` como "eliminado da Taça" e escondia briefing + editor do 11 (jogo com auto-pick).
- Fix: lazy-prepare idempotente no ramo friendly do `buildNextMatchSummary` (`matchSummaryHelpers.ts`, nova dep `prepareFriendlyFixtures` ligada em `index.ts` via closure diferida); guard `gamePhase === "lobby"` para nunca reescrever `currentFixtures` live.
- Checks: server `typecheck` OK; harness tsx temporário (cópia fresca do `base.db`, 0 pares) → briefing com adversário + 2.ª chamada sem duplicar (30 pares); `audit:socketio` 0 erros. Harness apagado após verificação.

## Sala nova arranca no amigável (fix)
- Causa: `base.db` não traz `calendarIndex`/`calendarVersion` → `getGame` caía no `deriveCalendarIndex(1,0,idle)` = liga jornada 1, saltando o slot 0.
- Fix: na cópia de sala nova (`gameManager.ts`, transação do pool 60→40) grava `calendarIndex=0, calendarVersion=2, contractCutoverSeason=1` (só salas novas; contratos da época 1 como até aqui); `seed.js` semeia as mesmas 3 chaves (muda o `fixtures_hash` → reseed automático do `base.db` no arranque).
- Checks: server `typecheck` OK; `node --check seed.js` OK; simulação da leitura (cópia + INSERT) → `calendarIndex=0, currentEvent=friendly`. Sem client/audits (zero handlers).

## Badge Transferências sem piscar (fix)
- O destino (soma no TRANSF / sub-badges no fly-up) só fazia fade-in após a remoção do flyer → ~150 ms sem nada visível. Novo `transferLanded` (`GameLayout.jsx`) antecipa o fade-in 100 ms antes da aterragem (crossfade no mesmo ponto); flyer parte de `scale: 1` (antes 0.85, salto na descolagem).
- Checks: `eslint` no ficheiro + `check:types` OK. Tweak de animação, sem mobile-resp-check.

## SQLite: node:sqlite (recoloca better-sqlite3) — 2026-09-12
- As duas ilhas sync em `server/gameManager.ts` (migração de saves + pool 60→40) usam `require("node:sqlite").DatabaseSync` — stdlib, zero dependência nativa.
- `better-sqlite3` removido de `server/package.json` (menos um native a compilar em prod).
- Diffs de API: `pragma()` → `exec("PRAGMA ...")`; `transaction()` → `exec("BEGIN")`/`COMMIT"` + ROLLBACK no finally.
- Requisito: Node ≥ 22.13 (Dockerfile `node:22-alpine` e local v26 OK).
## Plantel sem médias por posição (novo)
- A força na simulação é a média dos titulares em campo, não do plantel — as médias `skill` por posição no cabeçalho de cada grupo do Plantel (`PlayersTab.jsx`) induziam em erro. Removidas (cálculo `skillSums`/`avgSkill` incluído); ficam contagem + massa salarial.
- Checks: `lint` no ficheiro + `check:types` OK.

## Barreira do 11 + banco no servidor (novo)
- Bug FGPQH6 (intervalo vazio no Chaves): o `setReady` aceitava tudo e o engine fazia auto-pick silencioso — o `IntervencaoView` lê só `tactic.positions`, daí as listas vazias. Garantia nova: sem 11 + banco não se avança.
- Novo `server/game/lineupReady.ts` (puro): `checkLineupReady` (11 disponíveis = 1 GR + 10 campo; banco = 7 com 1 GR, via `MAX_BENCH_SIZE`; pool com juniores como o cliente) + `isLobbyStarter` (espectadores sem jogo na ronda passam; sem fixtures → fail-open) + `upcomingMatchweek` (mesma base do cliente).
- `socketGameplayHandlers.ts`: `setReady(true)` em lobby valida (só titulares da ronda); rejeita com `systemMessage` ⛔ e ready fica `false`. Intervalo/prolongamento isentos.
- `weeklyFlowHelpers.ts` (`checkAllReady`, ramo lobby): revalida antes do pontapé de saída; se invalidou depois do ready, `ready=false` + aviso e o arranque trava.
- Cliente espelha: `isLineupComplete` (TacticsContext) exige banco completo; hint do botão passa a "11 titulares (1 GR + 10) + 7 suplentes (1 GR)". FAB herdou (esconde-se).
- Checks: server `typecheck` OK; helper testado via tsx (ok / banco sem GR / titular lesionado); client `lint` nos 2 ficheiros + `check:types` OK (`lint` global só nos 2 erros pré-existentes); `audit:socketio` 0 erros; `audit:gamestate FGPQH6` só os 53 pré-existentes de mínimos de plantel.
- **POR ATIVAR:** restart do servidor (corre de `tsx`/fonte há dias — confirmar antes de reiniciar a meio de jogo).

## Familiaridade táctica com estrelas SVG (novo)
- `FamiliarityStars` (`TacticsView.jsx`) trocou a barra de 5 segmentos por 5 estrelas SVG com contorno (gradiente âmbar + brilho nas ativas, cinzento nas vazias); mantém `title`, prop `fill`, glow + shimmer no 5/5 e tamanhos compactos (mobile + desktop).
- Checks: `eslint` no ficheiro + `check:types` OK (`lint` global só os 2 erros pré-existentes).

# NOTES.md — Estado corrente do projeto

## Apagar sala a meio do jogo já não corre o segmento fantasma (fix SQLITE_MISUSE)
- **Cadeia:** disconnect a meio da 1.ª parte congela a sala no minuto 23 → apagar em /saves (`purgeGame`) resolvia os `pauseWaiters` e **acordava** o segmento; o `return` do tick saltava o sleep e os minutos 23→45 corriam à velocidade máxima, com a transição HALFTIME + `saveGameState` a escrever na BD já fechada (~40 erros `SQLITE_MISUSE`).
- **Fix:** flag `game.purged` (tipos) marcada primeiro no `purgeGame`; `onTick` da barreira faz `barrier.abort()` quando purgada; `runMatchSegment` retorna após o `Promise.all` sem transitar/gravar/finalizar; `saveGameState` + `persistSeat` ignoram sala purgada.
- Checks: server `typecheck` OK. Sem mobile-resp-check (zero layout). **Prova funcional em falta:** apagar sala a meio do jogo e confirmar silêncio nos logs (sem `Segment completed` nem `SQLITE_MISUSE`).

## Rejoin deixava de fabricar Pronto e avançar jogos sozinho (fix RKHWIS)
- **Causa:** o `queueEmit("setReady", true)` ficava em `stickyIntents` (`socket.js`) e o `flushOutbox()` (no `teamAssigned` e no `gameState`) reenviava-o em cada rejoin — 2–3 emits no mesmo segundo. O comentário que o justificava ("o servidor faz reset do ready no disconnect") está desatualizado: o disconnect preserva `seat.intent.ready` de propósito e só as fronteiras (fim de jornada, intervalo) fazem reset. Resultado: um Pronto da jornada N valia como consentimento para a N+1 — cada flape arrancava um jogo (log 20:05:18) e o `week_end | absent=[]` mostra que a presença estava bem, o consentimento é que era fabricado.
- **Fix:** `setReady` fora das stickies (novo `STICKY_EVENTS = {setTactic}`); cliques offline continuam na `outbox` one-shot e a tática continua sticky (durável, idempotente). Comentário do flush em `useSocketListeners` alinhado.
- Checks: `eslint` nos 2 ficheiros + `check:types` OK. Sem mobile-resp-check (zero layout). **Prova funcional em falta:** repetir Pronto → fim de jogo → disconnect → reconnect e confirmar que o `checkAllReady` fica `blocked (lobby)` até ao clique real.

> **Regra (1 ficheiro, nunca um por sessão):**
> - Atualizar no fim de cada tarefa/funcionalidade — e antes de fechar a sessão.
> - Bullets curtos em pt-PT. Blocos antigos (> ~2 semanas) já refletidos em commits: apagar.
> - Regra permanente descoberta → mover para `AGENTS.md`/`CLAUDE.md`/`STYLE.md` e remover daqui.

## Cleanup zero-risk — audit ponytail (2026-09-11)
- Morto removido: 4 exports `constants/index.js` (ENABLE_ROW_BG, POSITION_BG_CLASS, ADMIN_SESSION_KEY, FRIENDLY_ROUND_NAME) + POSITION_RING_CLASS (órfã com posRingClass, removida de `colorHelpers.js`); des-export (uso interno): AVATAR_TARGET_SIZE, MAX_AVATAR_FILE_BYTES, startOfDay, getFormationRequirements, skillEpoch. 3 dials mortos de MATCH_TUNING: fansMarginMax, ticketTiers, crowdBonusDefense. `TrainingTab.jsx` inlined em `GameRoutes.jsx` (delegava 1:1 para TrainingPage).
- `@sentry/node` removido do server (zero imports); `server/socketEventRegistry.json` untracked (gerado a cada audit → gitignore); `client/journal-cup-diagnostic.{jsx,html}` apagados (untracked, resto de diagnóstico).
- Pendente (decisão do utilizador, audit): 53 MB de `game_*.db` em git — `.gitignore` tem a linha comentada e o commit `59c4589` adicionou-os → parece intencional (backups), deixar; root `package.json` MCP (deps + `main: mcp-proxy.js` inexistente) — uso externo pelo pi, intenção incerta; unificação sqlite3/better-sqlite3 — arriscado, trabalho próprio.
- Pendente (dificuldade): alavancas anti-bola-de-neve A+B+C (evolução vs desempenho, inflação económica anual, custo de estádio) — diagnóstico feito, utilizador ainda não escolheu.
> - Ao iniciar uma sessão nova: ler este ficheiro + `git log --oneline -10`.

## Toasts 3/4/5/7 removidos; 6 virou balão, 5 virou flash (novo)
- **Eliminados (silenciosos):** 3 (`substitutionCapReached` — handler cliente removido, servidor continua a emitir sem efeito), 4 (`matchActionExpired` — só saiu o `addToast`, limpeza de estado intacta), 7 (`"Código copiado!"` — botão passa a `"Copiado ✓"` 1,5s via estado local).
- **6 → balão de banda desenhada:** `chatPeek` no `GameContext` (auto-limpa 6s, limpa ao abrir o hub), exposto pelo `chatMessage` do `useSocketListeners` (só quando não se está a ver o canal); render no `GameLayout` ancorado ao botão chat (cauda, clique abre o hub); listener de toast do `RoomHub` removido; badge rose de não-lidas mantém-se.
- **5 → flash modal:** `flashReconnect()` no `onConnect`; overlay centrado não-bloqueante (`pointer-events-none`, `role=status`, ícone sync) que desvanece em 3s. `GameDialog` não serve (é prompt/confirm com botões).
- **Prop `addToast` removida** do `RoomHub` + `GameOverlays`; o `addToast` em si fica (systemMessage, transferProposalResult, admin).
- Checks: `eslint` só o erro pré-existente (`GameContext.jsx` fast-refresh); `check:types` OK; `test:mobile` 150/150 + landscape 180/180; esbuild compila os 5 ficheiros (harnesses não montam o `GameLayout` real — estados transitórios sem cobertura visual).

## Engine: chances discretas estilo hatrick (novo)

- O engine deixou de jogar por **probabilidade contínua de golo por minuto** e passa a **chances discretas** (modelo hatrick.org): (1) **posse** fixada 1× no início do 1.º segmento — `computePossession(midHome, midAway, estiloA, estiloB)` em `matchCalculations.ts`: `clamp(0.30, 0.70, 0.5 + Δmed×0.0075 + tilt estilo)`, guardado em `_homePossession`/`_awayPossession` (+ totais `_homeChances`/`_awayChances` = `chancesTotal × posse`); (2) **chances por minuto**: `binomial(nChances, taxaChance(minuto))` com a curva de tempo existente (`getGoalTimeMultiplier`); (3) cada chance resolve `pGoal = clamp(0.06, 0.32, 0.175 × ATA/(ATA + 1.2×DEFGR))` — `computeChanceGoalProbability`.
- **Médios saem do ataque**: `attack` = só média ATA; médios afetam o jogo exclusivamente via posse (decisão do utilizador). **Eventos `chance` no log**: cada chance sem golo é um evento (🧤 defesa do GR [55%] / 🥅 poste/trave [15%] / 💨 ao lado [30%]) — o utilizador escolheu logging estilo hatrick em vez do mínimo. Narração nova em `commentary.ts` (`chanceSavedPhrase`/`chancePostPhrase`/`chanceOffTargetPhrase`); cliente: `chance` em `MATCH_EVENT_TYPES` + atenuado em `EventCard` (emoji do servidor via fallback, sem ícone novo).
- **Calibração** (`scripts/engineCalibration.mts`, seed fixa, 20k+20k jogos): baseline antigo 2.385 golos/jogo, 0-0 a 9.1%, sensibilidade +5pts = 50.1%; novo com `chanceGoalBase 0.175`: 2.360, 9.3%, 51.9% — paridade de golos + um pouco mais de qualidade que vence. Parâmetros novos em `MATCH_TUNING`: `chancesTotal:30, possePerPoint:0.0075, posseStyleDefensiva:0.02, chanceGoalBase:0.175, chanceDefWeight:1.2, chanceGoalMin:0.06, chanceGoalMax:0.32, chanceSaveShare:0.55, chancePostShare:0.7`.
- Inalterados: penáltis, auto-golos, VAR, cartões, clima, casa/clima/ego, PRM, `near_miss` (o evento pré-existente), `weightedPickScorer` (agora pool só ATA). `computeOpenPlayGoalProbability` mantida no ficheiro (usada só pela simulação antiga do script de calibração — remover quando o script for aposentado).
- Checks: server `typecheck` OK; `test:engine-unit` 3/3 OK; `audit:socketio` 0 erros; `audit:gamestate 2QXOJY` só o erro pré-existente `POOL_SAMPLING` (dados antigos do room, alheio); client lint (ficheiros tocados) + `check:types` OK. Sem mobile-resp-check (linha de evento existente, só emoji/atenuação, zero layout). **Pendente:** sentir em partida real se as ~30 chances/jogo (55% defesas) não encherem demasiado o log — `chancesTotal` é o dial.

## LandingPage — refactor em componentes + a11y + tokens (novo)

- `LandingPage.jsx` era um componente-deus (809 linhas, 28 props, 3 ecrãs). Agora é composition root sem estado próprio; extraídos `ParticleCanvas`, `LandingBackground`, `LandingHeader`, `LandingFooter`, `HeroSection`, `ReconnectScreen`, `AuthCard` (moldura com `children`), `LoginForm`, `RegisterForm`, `AuthField` (campo partilhado) e `FeaturesStrip` + `landingContent.js` (frases/tamanho do hero/features). API pública do `LandingPage` mantida (o harness e o `App` não mudaram).
- Design: 9 hex hardcoded (`#060b08/#080d0a/#0a1410/#0e1a12`) → tokens novos no `@theme` (`--color-landing-bg/-surface/-panel/-panel-alt`), tema marketing deliberadamente fora da paleta de jogo. `SEASON_LABEL` novo em `constants/index.js` substitui 5× "26/27" no landing + 2× no `App`; classes `short:*` mortas (dentro de `short:hidden`) limpas.
- A11y/motion: `prefers-reduced-motion` movido para `hooks/usePrefersReducedMotion.js`; o `ParticleCanvas` passou a respeitá-lo (uma frame estática em vez de rAF contínuo) e a escalar o buffer por DPR (máx. 2). Login/registo passaram a `<form onSubmit>` (Enter em qualquer campo, password managers, tecla de submissão no teclado mobile), labels associados por `htmlFor`/`id`, e o toggle de palavra-passe é focável com `aria-label`/`aria-pressed` (antes `tabIndex={-1}` e só `title`).
- Checks: `eslint` limpo nos ficheiros tocados; `check:types` OK; harness `landing-resp-test` portrait 5/5 + landscape 6/6; **suites completas `test:mobile` 150/150 e `test:mobile:landscape` 180/180 PASS**; screenshots 390 e 1440 verificados (aparência preservada). `npm run lint` global continua a falhar só em `client/journal-cup-diagnostic.jsx` (untracked, pré-existente). (`vite build` não corre neste ambiente — ver infra.)
- **Infra mobile-resp-check (agravada):** os symlinks de `/home/woldpt/node_modules/` criados em sessões anteriores apontam para `/tmp/cb-journal`, que já não existe → `@rolldown/binding-linux-x64-gnu`, `lightningcss-linux-x64-gnu` e `@tailwindcss/oxide-linux-x64-gnu` ficam QUEBRADOS e o `vite` não arranca (nem dev nem build). Receita usada nesta sessão, sem sudo e sem sair do workspace: (1) instalar os TRÊS no mesmo comando (senão o npm poda os anteriores) `npm install --prefix .tmp-rolldown --cache .tmp-rolldown/npm-cache --no-save @rolldown/binding-linux-x64-gnu@1.0.0 lightningcss-linux-x64-gnu@1.32.0 @tailwindcss/oxide-linux-x64-gnu@4.3.0`; (2) `export NODE_PATH=$PWD/../.tmp-rolldown/node_modules` (ESM e `node -e` não respeitam NODE_PATH — scripts de diagnóstico têm de viver dentro de `client/`); (3) `vite.config` temporário com `cacheDir` dentro do workspace (o `node_modules` não é gravável, o default `.vite` faz 504 "Outdated Optimize Dep"); (4) correr `node scripts/mobileRespCheck.mjs <harness> --port 5311` com esse servidor JÁ a correr (o script reutiliza a porta). **A porta 5199 tem um servidor stale fora do PID namespace** que serve código antigo — usar `--port` explícito e confirmar o código servido. Temporários removidos no fim; a reparação dos symlinks para um caminho persistente continua por fazer.
- **Visual — direção "esmeralda refinada" implementada:** acento novo escopado ao landing (`--color-landing-accent` #34d399 / `--color-landing-accent-strong` #10b981 no `@theme`) e remap de `green-200/300/400/500` → esses tokens + `rgba(74,222,128,*)` → `rgba(52,211,153,*)` em `components/auth/*`. **Não** se redefine o `--color-green-*` global (mudaria o verde em toda a app); o `emerald-400` do `RoomSelectScreen` (estado válido de input) ficou intacto. Correções de ofício: grelha de giz do fundo removida, fita-cola do hero removida (não tinha "folha" que a justificasse), cantos do cartão 4/4, contrastes do rodapé/labels/descrições subidos (`white/15→45`, `/30→50`, `/40→55`) e dourado (`text-tertiary`) reservado ao `90'` como único detalhe quente.
- `landing-resp-test.jsx`: o CTA era farejado por `button[class*="bg-green-500"]` — seletor preso à paleta, que quebrou o harness no remap. Passou a `button[type="submit"]` (intenção preservada, robusto a mudanças de cor).
- Checks do visual: `eslint` + `check:types` OK; `landing-resp-test` 5/5 + 6/6 e `roomselect-resp-test` 5/5 + 6/6; **suites completas 150/150 e 180/180 PASS**; capturas final a 390px e 1440px confirmam paridade com o mockup aprovado.
- Pendente (fora do plano aprovado): o CTA "Continuar Jogo" do `RoomSelectScreen` é `bg-cyan-500` por estado (`joinMode === "saved-game"`, pré-existente) — agora destoa mais do acento esmeralda; decidir se passa a esmeralda ou se mantém a distinção "continuar vs criar". Nota: `roomselect-resp-test` reporta `resErr=1` (404 de asset estático no console) a algumas larguras — pré-existente e fora do veredicto do harness.

## MatchBriefing — refactor total (view-model + pasta briefing/)

- `MatchBriefing.jsx` virou orquestrador fino (memo do VM + composição); lógica pura em `live/briefing/briefingViewModel.js` (`orderedPair`, odds/probs/favorito, último confronto, atmosfera, slots) + 11 blocos (`Tile`/`CompareStat`, `VersusHero`, `NextMatchCard`, `DifficultyGauge`, `StadiumCard`, `OpponentFormation`, `ThreatGrid`, `FormChips`, `RecordText`, `PrepStepper`, `BriefingSkeleton`). Novo `shared/PrimaryCTA.jsx` (CTA verde canónico).
- Visual: GM/GS fundidos em "Golos M:S" (5 tiles), moral com dot + valor em tooltip (`getMoraleColor` novo em `morale.js`), qualidade com /100, barra do estádio na cor da atmosfera + label "Receita", favorito nas odds (ring) + ⓘ "iguais às das apostas", stepper "1 Briefing → 2 Tática", microcopy "Podes voltar atrás", skeleton (`nextMatchSummaryLoading` do GameContext) + `EmptyState` em vez de `null`.
- `WEATHER_LABELS` + `THREAT_ROLE_META` mudados para `matchConstants.js`; hex `#111/#1e1e1e/#161616` → tokens (`surface-container`, `outline-variant/25`); labels 7px→8px; `rounded-2xl` mantido (linguagem do módulo live, desvio consciente do §3).
- A11y: gauge e barra de ocupação com `role="progressbar"`, chips de forma com `role="img"`, botões de plantel com `aria-label`, emojis decorativos com `aria-hidden`.
- Armadilhas (bugs pré-existentes expostos pela fixture de nomes longos, corrigidos): filhos de `Tile` sem `w-full` (OddsTiles/FormRow/Registo) + botão do nome sem `min-w-0` → overflow horizontal; score do LC lado a lado com o badge → agora empilhado com `whitespace-nowrap`.
- Testes: `npm run test:briefing` (29 asserts S1–S8) OK; harness novo `briefing-resp-test.html/.jsx` (fixture extrema: nomes longos, LC de taça com penáltis, vulcão) PASS portrait 320–430 + landscape 568–1023; resto da suite igual (só falha `cupupset-resp-test`, harness stale que importa `CupUpsetModal.jsx` inexistente — pré-existente, não mexido).
- Infra mobile (mesmo bloqueio do `node_modules` root/musl): sem `pkill -f vite` (mata servidores alheios!) — corri em cópia `/tmp/cb-brief-check` (tar sem node_modules + symlink para `/tmp/cb-journal/node_modules`). Reparos fora do repo (manter): symlinks em `/home/woldpt/node_modules/` para `@rolldown/binding-linux-x64-gnu`, `lightningcss-linux-x64-gnu`, `@tailwindcss/oxide-linux-x64-gnu` (apontam p/ `/tmp/cb-journal`) — sem eles o `vite` local nem arranca.
- Por fazer (fora do plano aprovado): migrar os CTAs inline do `TacticsView.jsx` para `PrimaryCTA`; tabs "Confronto|Scouting" em mobile; corrigir/apagar harness `cupupset` stale.

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

## Mercado mostra os próprios jogadores à venda (novo)

- Pedido: os meus jogadores também no Mercado. Implementado como interruptor desligado por defeito (decisão do utilizador: só à venda/leilão, com toggle, gerindo a listagem no card).
- `GameContext.jsx`: estado novo `showOwnMarketPlayers` (default false); `filteredMarketPlayers` inclui os próprios com `transfer_status === "fixed"` quando ligado. Servidor já os enviava (`globalMarket` = todos os listados) — era só o filtro `team_id !== marketTeamId` que os escondia.
- `GameRoutes.jsx`: passa flag + setter e as ações existentes (`listPlayerAuction`, `removeFromTransferList`) ao `TransferHub`.
- `TransferHub.jsx`: checkbox "Mostrar os meus à venda" na linha de filtros; selo "Teu" (`Badge info`) nos próprios; rodapé dos próprios troca Comprar por Retirar + Leiloar (reutiliza dialogs do Plantel). Próprios em leilão continuam só nos Leilões.
- Checks: eslint limpo nos 3 ficheiros (`lint` global só falha no untracked pré-existente `journal-cup-diagnostic.jsx`); `check:types` OK. Sem mobile-resp-check (toggle + rodapé condicional, sem mudança estrutural) e sem audits (zero servidor/lógica de jogo).

## EACCES noutro backend + hardening do join (novo)

- O crash colado (`EACCES mkdir /app/saves/Fabio` → exit 1) **não** é deste contentor: o `cashball-backend-1` está saudável desde as 12:57, sem esse erro nos logs, com mounts e escrita OK. É outro backend (pasta `saves/` criada como root pelo daemon ou noutro checkout) — aí, criar `server/saves/` antes do `up` e acertar dono/escrita resolve.
- Endurecimento: `getGame` no `joinGame` agora em try/catch → falha de sala emite `joinError` só para esse join em vez de rejection não tratada que derrubava o servidor inteiro.
- Checks: server typecheck OK. Sem client.

## Migração em prod OK — 35 salas (novo)

- O log colado era da corrida antiga (mensagem sem detalhe = imagem pré-fix); o contentor estava ainda mais atrás (sem mount `saves/`, `dist` sem `movePath`).
- Desbloqueio do build: `client/.npmrc` (`legacy-peer-deps=true`, intenção já declarada no commit dos bumps) + `COPY .npmrc` no `client/Dockerfile` (só copiava `package*.json`, o flag nunca chegava à imagem).
- `docker compose up --build -d`: backend+backups recriados e a correr; frontend não arranca por rede externa `cftunnel` sem subnet para o IP fixo (pré-existente, já não corria antes).
- `[migração] 35 sala(s) movida(s)`; `server/db/` sem `game_*.db`; `server/saves/<criador>/` populado (incl. `_sem-dono`); `/health` ok.
- `audit:gamestate FGPQH6` = 53 erros — os mesmos pré-existentes de mínimos de plantel (confirmados em stash anteriormente), não da migração. `audit:socketio` 0 erros.

## Migração falhou em prod — diagnóstico fechado (novo)

- O log das 09:24 mostra `falha ao mover` SEM detalhe → imagem construída da árvore pré-fix (corrida com o commit 33aae36 das 09:21:22). Sem `movePath`, todo o `renameSync` dá EXDEV entre os volumes `/app/db` e `/app/saves` (confirmado: réplica em contentor `node:22-alpine` com volumes separados falha sem o fix e passa com ele).
- Melhoria: avisos da migração incluem agora o código/mensagem do erro (`e.code || e.message`).
- Armadilha de teste: ler um destino inexistente sem `readOnly` cria um `.db` vazio (de 배터리 "no such table" fantasma) — sempre `readOnly` em leituras de verificação.

## Migração falhou — diagnóstico + fixes (novo)

- Causa 1 (principal): o contentor corria imagem de antes dos commits (`dist` sem a migração) — rebuild com `docker compose up --build` por fazer.
- Causa 2 (latente, corrigida): `/app/db` e `/app/saves` são volumes separados → `renameSync` dá EXDEV. Novo `movePath` em `roomPaths.js` (rename com fallback copiar+apagar), usado na migração e no rename; EXDEV real verificado entre filesystems distintos.
- Causa 3 (perda de dados, corrigida): o `node:sqlite` em readonly apagava o `-wal` no close. A migração abre agora em leitura+escrita com `wal_checkpoint(TRUNCATE)` antes de mover (funde resíduo de crash no `.db`); verificado com `-wal` de `kill -9` (marker=42 intacto).
- Checks: typecheck OK; `audit:socketio` 0 erros; `audit:gamestate 445WU8` 0 erros; `run-saves.mts` 16/16 OK. Sem client.
- **POR ATIVAR:** `docker compose up --build` + restart (com o timing dos jogadores).

## Saves em server/saves/<criador>/ (novo, substitui db/<criador>/)

- `db/` só com globais (`base.db`, `accounts.db`, `global_chat.db`); salas em `server/saves/<criador>/`. Novo `savesDirFor` em `roomPaths.js` (irmão de `db/`, com mkdir); gameManager/index/auth/scripts com fallback duplo (saves/ → legado db/); migração recolhe raiz + antigas subpastas e remove pastas esvaziadas; backup cobre saves+globals; docker monta `./server/saves` (backend+backups); `server/saves/` no `.gitignore`.
- **Bug apanhado à posteriori:** o commit anterior deixava `auth.js` a usar `roomDbPath`/`moveRoomToCreatorFolder` sem as definir (`ReferenceError` em rename/admin) — reposto e verificado em runtime.
- Checks: typecheck OK; `audit:socketio` 0 erros; `audit:gamestate 445WU8` 0 erros; `/tmp/cb-mig-test/run-saves.mts` 16/16 OK. Sem client.
- **POR ATIVAR:** produção corre de `dist/` — `npm run build` + restart para migrar; após a migração, os `game_*.db` versionados aparecem como apagados no git (limpeza: `git rm` ou deixar).

## Salas em db/<criador>/ (novo)

- Saves em subpastas por criador: `server/db/<criador>/game_<ROOM>.db` (sanitizado; `_sem-dono` sem criador). Novo `server/db/roomPaths.js` (finder raiz+subpastas, usado em gameManager/index/auth/scripts); `resolveDbPaths` aceita hint de criador; `getGame` recebe-o em new-game; arranque migra a raiz (idempotente, nunca sobrescreve); rename de conta atualiza `roomCreator` em disco e move salas inativas (ativas movem no restart); DELETE limpa sidecars; backup recursivo com nomes planos (restauro re-arquiva no arranque).
- Checks: typecheck OK; `audit:socketio` 0 erros; `audit:gamestate 445WU8` 0 erros; teste funcional `/tmp/cb-mig-test/run.mts` 21/21 OK (sanitize, migração, sidecars, conflito, idempotência, criação, doesGameExist, limpeza). Sem client.
- **POR ATIVAR:** produção corre de `dist/` — é preciso `npm run build` + restart para migrar; combinar timing com os jogadores (há 36h+ de uptime).

## Em curso

## Pitch do 11 provável vazio no briefing (diagnóstico)
- Auditoria em sala nova (`WH2J0Q`, fábricas reais): 20 pares em 9ms, `probableFormation` "4-4-2" + 11 jogadores, agrupamento cliente com 0 descartados. Servidor inocente (fonte e `dist/` com a mesma lógica).
- `OpponentFormation.jsx`: fallback visível ("11 provável indisponível de momento.") + `console.warn` com a forma do payload quando a formação chega sem jogadores renderizáveis. Memoizado: só dispara por payload novo.
- Checks: eslint do ficheiro OK (2 erros do `lint` global são pré-existentes: `landing-resp-test.jsx`, `GameContext.jsx`); `check:types` OK; `test:briefing` OK.
- Falta evidência do browser: hard-refresh + consola/screenshot do utilizador.

## Lobby→jogo bloqueado em todas as salas (fix crítico)
- Causa: o single-flight do `7785baa` reclamava `segmentRunning=true` sem verificar antes e tinha um guard pós-barreira `if (segmentRunning)` — sempre verdade, porque fomos nós a pôr a `true`. Todo o arranque lobby→jogo morria aí, sem repor a flag (deadlock em memória até restart). O amigável foi só onde se notou (`8T3U4X`: dispatch com `segmentRunning=false` → `blocked: true`).
- Fix (`weeklyFlowHelpers.ts`, ramo lobby do `checkAllReady`): check-then-claim atómico à entrada (2.º "Pronto" simultâneo é rejeitado — a intenção original) + guard pós-barreira apagado. `startWeekOnce` não verifica a flag à entrada, só a reclama — compatível.
- Checks: server `typecheck` OK; `audit:socketio` 0 erros. Sem harness E2E (exigiria forjar socket/jogador/tática; evidência = log de prod + releitura do ramo).
- **POR ATIVAR:** `build` + restart — o restart limpa sozinho o deadlock atual (flag em memória).

## Amigável imediato em sala nova + sem rótulos de Taça (novo)
- Causa da espera: sala nova nascia sem sorteio — o `prepareFriendlyFixtures` só corria no 1.º `requestNextMatchSummary`, com ~20 INSERTs um-a-um + ~40 SELECTs de enrich em série a bloquear a resposta; sem guard em memória nem single-flight.
- Fix: sorteio na criação (`gameManager.ts`, na transação do pool 60→40, 1 INSERT com 20 VALUES, ronda 0 época 1); briefing lê o par direto da tabela e só corre o prepare como fallback para salas antigas sem pares (contagem prévia); `prepareFriendlyFixtures` com guard em memória + single-flight por sala e lote único (1 INSERT + 1 SELECT IN em vez de ~60 queries).
- Rótulos: stakes do amigável passa a "Amigável — sem pontos em disputa, só ritmo e testes."; badge do `NextMatchCard` mostra 🤝 Amigável quando `isCup && cupRound === 0` (cabeçalho já dizia "Amigável de pré-época" via `cupRoundName`).
- Checks: server `typecheck` OK; harness tsx 11/11 (sala nova com 20 pares/40 equipas, briefing com adversário em ~30ms sem lazy-prep, sem duplicar à 2.ª; harness apagado); `audit:socketio` 0 erros; `audit:gamestate NVDRW6` 19 erros = os mesmos pré-existentes em stash; client `lint` nos ficheiros + `check:types` OK (2 erros globais pré-existentes). Sem mobile-resp-check (badge condicional com as mesmas classes, zero layout).
- **POR ATIVAR:** produção corre de `dist/` — `build` + restart com timing dos jogadores.

- **Fotos nos pitches (fix):** os pitches mostravam sempre o SVG procedural porque o `PlayerMarker` (`PitchFormation.jsx`) não passava `photo` ao `PlayerAvatar` — e mesmo que passasse, o `buildLineupSnapshot` (`engine.ts`) descartava `photo`/`nationality`. Snapshot da liga + `lineupSnapshotET` da Taça (`cupFlowHelpers.ts`) passam a incluir `photo`/`nationality`; `getOpponentProbableFormation` (`matchSummaryHelpers.ts`) idem (júniores sem foto → fallback SVG, como decidido). Checks: server `typecheck` OK; client `eslint` no ficheiro + `check:types` OK.

- **Saldo semanal gravado na BD (fix gráfico de finanças):** o `balanceHistory` era reconstruído por reconciliação inversa do diário `club_news` (agrupado por `(year, matchweek)` — semanas de Taça/Liga colapsavam no mesmo ponto e tipos de movimento ficavam de fora → valores irreais). Nova tabela `team_balance_history (season, slot, team_id, year, matchweek, balance)` com `UNIQUE(season, slot, team_id)`: `snapshotBalanceHistory` (novo em `coreHelpers.ts`) corre após as finanças semanais e faz upsert do mesmo slot após a bilheteira da finalização (Liga em `weeklyFlowHelpers`, Taça + amigável em `cupFlowHelpers`) — o ponto final é o saldo real de fim de semana. `requestFinanceData` lê da tabela (2 épocas, mesmo formato `{x, year, matchweek, balance}` — cliente intocado). Migração padrão: `schema.sql` + criação por sala em `gameManager` + one-shot `base.db` em `index.ts`. Salas em curso arrancam do agora (sem backfill). Checks: typecheck OK; `audit:socketio` 0 erros; `audit:gamestate 78213E` 0 erros; teste funcional em cópia de sala (40 equipas: 1 linha/equipa/slot, upsert reflete bilheteira, último ponto = `teams.budget`).

- **Anti-bola-de-neve económica (novo, 6 sistemas):** queixa de jogo fácil ao fim de 3–4 épocas (estádio gigante + milhões). Auditoria FGPQH6 (época 7) confirmou: Chaves 32.4M€ bilheteira vs 17M€ salários e 6M€ em 20 obras; Porto NPC na 2.ª com 60M€ parados; só os 2 humanos têm linhas em `team_training` (médias 46–48 vs 33.6 do Porto). Sistemas: (1) **manutenção semanal** `STADIUM_UPKEEP_PER_SEAT_WEEK=1.5€` em `applyWeeklyFinancesOnce` (120k→3.6M€/época, com `applied_weeks` + diário `stadium_upkeep`); (2) **massa adepta** (`teams.fanbase`: schema + migração gameManager com backfill `MAX(avg_attendance, base)`, seed, teto `min()` em `computeAttendance`, evolução fim de época campeão/promovido +20% / meio +5% / despromovido −20% com `FANBASE_DIV_CAP`, display no StadiumTab); (3) **agentes farejam riqueza** (`wealthAgentMultiplier`: banco >5M€ → pedidos até ×1.5 em `maybeTriggerContractRequest`, cobre renovações + renegociações); (4) **direção NPC investe excedente** (`processNpcInvestment` na cadeia semanal: banco >10M€ → 1 obra 300k/sem ou academia 500k→prospeto real com ordenado, diário `stadium_build`/`academy`); (5) **piso de skill nas compras NPC** (nível = média dos 14 melhores, rejeita abaixo de nível−10, nos dois caminhos); (6) **NPCs treinam** (`ensureNpcTrainingFocus` no topo de `applyTrainingBonuses`: linha mais fraca, ou Resistência/Forma se o grupo está quebrado). Constantes calibradas por `server/scripts/economySim.mjs` (node puro).
  - Checks: server `typecheck` OK; client `lint` (StadiumTab) + `check:types` OK; `audit:socketio` 0 erros; `audit:gamestate 445WU8` 0 erros; FGPQH6 com 53 erros de mínimos de plantel = **pré-existente** (confirmado com as alterações em stash: mesmos 53). Sem mobile-resp-check (só 1 linha de texto no Estádio). **POR ATIVAR:** o servidor corre de `tsx` (fonte) há 36h — é preciso restart para pegar; FGPQH6 estava a meio de jogo, combinar timing com os jogadores.
  - Armadilha: `game_*.db`/`-wal` vivos são reescritos pelo servidor — nunca `git stash`/`checkout` com o servidor a correr (quase perdi o commit; recuperar só os ficheiros de código via `git checkout stash -- <paths>`).

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

- **Reset emocional na viragem de época (novo):** a moral atravessava épocas (campeão entrava a 90–100, equipa em crise a 0–10). O `applySeasonEnd` (`server/cupFlowHelpers.ts`, na mesma transação do reset de pontos) agora põe `morale = 50` para todos e `fans_mood` na base de fidelidade da nova divisão (`fansBaseByDivision`, após promoções). Sem mexer no efeito em campo (±10%/±5%). Decisões do utilizador: 50 para todos, adeptos incluídos, só reset.
  - Checks: server `typecheck` OK; `audit:socketio` 0 erros; `audit:gamestate 445WU8` 0 erros; reset validado com SQL numa cópia da sala (40 equipas a 50, adeptos a 65/60/55/50/45). Sem mobile-resp-check (zero UI). Só vale para transições futuras.

- **Crash ao passar da LandingPage — TDZ no GameProvider (fix):** `Cannot access '_i' before initialization` logo após o auto-join. Causa: o commit da fila de contratos (`271f764`) pôs `queueContractDialog` no objeto do `useSocketListeners` (linha ~847, avaliado durante o render) mas definiu o `const` 280 linhas abaixo → TDZ no primeiro render do provider. Fix: definição movida para antes dos listeners (só ordem, zero lógica) + bloco `eslint-disable` na bomba de fila intencional (erro `set-state-in-effect` herdado do mesmo commit). Checks: eslint do ficheiro + `check:types` OK (`lint` global só falha no untracked pré-existente `journal-cup-diagnostic.jsx`). Sem mobile-resp-check (zero layout). **Pendente:** `git pull && docker compose up --build` no servidor para servir o bundle novo (o erro vinha do bundle antigo `index-B39rYAJd.js`).

- **Modal pós-jogo trocado entre Taça e Liga (fix):** o effect do humor (`GameContext.jsx`) usava UMA chave anti-repetição partilhada para as duas provas, e `matchResults`/`cupRoundResults` mantêm os dados da prova anterior — após a jornada da Liga, o ramo da Taça recriava o modal da ronda antiga por cima (e vice-versa). Chaves separadas por competição (`ackedPostMatchKeysRef = {league, cup}`); decisão do utilizador: se o modal anterior ainda estiver por dispensar, o novo substitui (sem fila). Checks: eslint do ficheiro + `check:types` OK (`lint` global só falha no untracked pré-existente `journal-cup-diagnostic.jsx`). Sem mobile-resp-check (zero layout). **Pendente:** teste manual numa sala real (Taça → Liga, confirmar ordem).

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

- **TrainingTab — limpeza e coerência (novo):** prop `players` morta removida (tab + `GameRoutes`); tab passa a receber `matchweek={currentJornada}` (jornada da época com wrap %14, em vez do contador acumulado); grupos do relatório na ordem canónica GR→DEF→MED→ATA (servidor ordena alfabeticamente); widget "Jogadores Treinados" conta só mudanças reais (antes divergia do relatório); `DeltaCell` de subida `sold`→`info` (semântica); grelha de opções com `role="group"` + `aria-pressed` nos cartões; `localStorage` com chave por sala (`...:ROOM`, fallback à antiga).
  - Checks: eslint limpo nos 3 ficheiros + `check:types` OK. `npm run lint` global falha só em `client/journal-cup-diagnostic.jsx` (untracked, de outra sessão — pré-existente). Sem mobile-resp-check (sem mudança de grid/flex/larguras).

- **Treino — "centro de treino vivo" (cosmética):** widget Foco Atual com medalhão do ícone do foco (cor da opção) + descrição como `sub`; cabeçalhos das colunas do relatório com realce cruzado (atributo do foco na cor do foco via `FOCUS_ATTRIBUTE`, restantes a `/40`); pulso de confirmação `training-saved-pulse` no cartão guardado (keyframes em `index.css` ao lado do `score-pop`, gated por `prefers-reduced-motion`, replay via `key` com contador `savedTick` — padrão do `GoalFlashOverlay`).
  - Checks: eslint limpo nos ficheiros + `check:types` OK. Sem mobile-resp-check (só cor/texto/animação, sem mudança de grelha/flex/larguras — keyframes não mexem em layout).

- **PlayersTab — cabeçalhos ricos + filtro + ordenação (novo):** cabeçalho de cada posição com `count · massa salarial/sem · skill média` (do `useMemo` existente); `TabBar expand` com filtro Todos·N/GR·n/DEF·n/… e `select` nativo compacto (Base/Skill/Salário/Valor, descendente, só dentro de cada grupo — estrutura GR/DEF/MED/ATA se mantém); filtro sem jogadores → `EmptyState` 🔍. Estado local (reinicia ao sair da tab, que desmonta). Só `PlayersTab.jsx`.
  - Checks: eslint + `check:types` OK; mobile portrait 5/5 + landscape 6/6 PASS no `mobile-resp-test` (renderiza o PlayersTab real; `resErr=1` info, sem overflow/clipping).

- **IntervencaoView — refatoração em 3 commits (novo):** (1) `b28dcbb` fonte única das regras dos cartões (`getPitchCardState`/`getBenchCardState` + `cardCtx`, antes copiadas 3x em desktop/landscape/stack) + `useMemo` nos derivados caros + prop `confirmedSubs` duplicada removida; (2) `fb02ab1` partição do monolito de 2008 linhas em `tabs/intervencao/` (`SubsPanel` 696 + `SwapControls` 272 + `Panels` 272 + `PlayerLists` 206 + `subsSelection` 199 com `useSubsDrag`/`usePrefersReducedMotion`) — orquestrador fica com 586 linhas, corte byte-exato; (3) UX mobile: botões `h-6`→`h-9` na barra landscape e «Anular todas» compacto, `PEEK_W` 96→64, folha de trás com `inert`, banner marcador↔fase tocável (toque+Enter/Espaço, reinicia cadência 5s), tab «Substituições»→«Subs» <380px; comentários EN→pt-PT. Fadiga mantém-se escondida (`showFatigue={false}` — fora de âmbito, por decidir).
  - Checks: eslint + `check:types` OK nos 6 ficheiros; mobile portrait **150/150** + landscape **180/180** PASS. Retrocesso: tag `backup/intervencao-antes-20260909` (HEAD `60ff7cf`); reverter só estes ficheiros, nunca `reset --hard` (há trabalho não commitado de outras sessões na árvore).
  - Armadilha encontrada: `cupupset-resp-test.{html,jsx}` órfãos (modal apagado em `8ac06ea`) partiam o portão mobile (5/155 + 6/186 `waitForSelector` timeout) — apagados com aprovação do utilizador em commit separado.
  - Fix pós-push (`fcf6529`): os módulos novos ficaram com imports relativos à profundidade errada (copiados do `IntervencaoView` sem somar o nível `intervencao/`) → `vite build` partia com 8× `UNRESOLVED_IMPORT`. Lição: **o eslint não valida resolução de módulos** — após criar/mover ficheiros, correr sempre `cd client && npm run build` além de lint+tipos.

- **UX à prova de reconexões + browser morto (novo, fases 1+2+3):** antes, emits sem rede perdiam-se em silêncio (Pronto, tática, lance) e tab morta a meio do jogo voltava sem tática nem modal de ação.
  - **Fase 1 (rede):** `client/src/socket.js` ganha `queueEmit` (fila offline; `setTactic`/`setReady` coalescem + intenções sticky reenviadas no join — o reset de ready no disconnect do servidor é reposto automaticamente) e `emitComAck` (ack + retry ×2 para lances); `server/actionDedup.ts` (novo, `claimActionId` por sala) descarta `__actionId` repetidos no `placeAuctionBid` (ack `{ok:true, dedup:true}`); todos os pontos de `setTactic`/`setReady`/`resolveMatchAction`/`buyPlayer`/`renewContract`/propostas/convites passam pela fila; `OfflineBanner` mostra "N em fila" + botão "Tentar agora".
  - **Fase 2 (browser morto):** `client/src/utils/uiSnapshot.js` (novo) guarda a tática em `sessionStorage` (throttle 500ms); restauro no `gameState` SÓ a meio de jogo com posições vazias do servidor (no lobby o reset intencional prevalece); toast "Ligação restabelecida — a sincronizar…" no rejoin; `flushOutbox()` no `teamAssigned` + `gameState` (o socket só está ligado no servidor aí).
  - **Fase 3 (direto):** `engine.ts` guarda `payload`+`expiresAt` na ação pendente e emite `expiresAt`; rejoin re-emite o `matchActionRequired` REAL (antes só `matchActionExpired`) — sem flag no ramo vivo para cobrir 2.º rejoin/tab reaberta; countdown do cliente deriva de `expiresAt` (fallback 60s).
  - Armadilhas: `bindSocket` limpa o socket velho → o disconnect tardio já não auto-resolve (é o que torna o re-emit possível); `socket.timeout()` do cliente exige socket.io-client v4 (é ^4.8.3, OK); `AuctionCard` recebe socket por prop — usa `emitComAck` importado + `socket.connected` da prop.
  - Checks: server `typecheck` OK; client `lint` (só erro pré-existente `journal-cup-diagnostic.jsx` untracked) + `check:types` OK; `audit:socketio` 0 erros (registry atualizado com o novo emit); `audit:gamestate 445WU8` 0 erros; mobile portrait 150/150 + landscape 180/180 PASS.
  - **Pendente:** teste manual real — flape wifi a meio do jogo com modal de lesão aberto + matar a tab do telemóvel a meio do jogo e reabrir (não reproduzível neste ambiente).

- **Ponytail audit Fase 1 (cortes seguros):** removidas deps `@emotion/is-prop-valid` + override `uuid` de `client/package.json` (0 imports em src; framer-motion mantém cópia transitiva e o patch `patch-framer-motion` do vite.config continua válido; lockfile por regenerar em ambiente com npm funcional); apagados `repair-duplicate-job-offer.sh` + `repairDuplicateJobOfferTUI.ts` (canónico é o `.ts` do `repair:joboffer`) e `backupDatabases.sh` (canónico é o `.js` do compose/docs) + linhas em `FILES.md`/`CRASH.md`; `useIsMobile.js` (4 hooks) fundidos num `useMediaQuery` interno, API inalterada.
  - Excluído de propósito: untracked de outra sessão (`journal-cup-diagnostic.*`, `gen-fixture.mjs`, `journal-fixture.json`); fábricas `createXxxHelpers` vão à Fase 2 (utilizador aprovou mudar a regra do AGENTS.md).
  - Checks: eslint + `check:types` OK; lint global só falha no untracked alheio (pré-existente); sem typecheck/audits (zero `.ts` de jogo tocado), sem mobile-resp-check (sem mudança estrutural).

- **Ponytail audit Fase 2 (fábricas, mínima):** `momHelpers` virou `persistMoms(db, game, …)` direto (2 callsites já tinham `game.db` em scope); `trainingHelpers` virou 2 exports diretos (deps `io` nunca usadas — confirmado por grep); `index.ts` importa direto sem intermediários; regra do `AGENTS.md` agora prefere funções simples, factory só quando o objeto viaja entre módulos. Restantes 7 fábricas ficam (conversão total daria +linhas no núcleo weekly/cup — decisão do utilizador).
  - Checks: server `typecheck` exit 0; `audit:socketio` 0 erros (91 warnings pré-existentes, registry intacto); `audit:gamestate 445WU8` 0 erros. Sem client → sem lint/mobile.

- **Ponytail "sem risco" ABORTADO (Fase A):** `tsc --checkJs` dá 319 erros no client vs 0 do `jsDocTypeChecker` — o checker artesanal é leniente por desenho (convenção JSDoc, não tipos reais); a troca não é equivalente. Veredito: manter o atual; `tsc` a sério exigiria anotar o client todo (fora de "sem risco"). Fase B (fundir 4 utils, 10 importadores p/ ~40 linhas) também recusada — churn > ganho.

- **Jornal amador em sépia tabaco (novo):** `.jp-amador --jp-sheet` `#d6c9a8` → `#c19a5b` (opção A aprovada pelo utilizador; semi/pro intactos, tinta e granulado iguais). Só `client/src/index.css`.
  - Checks: `check:types` OK; `lint` global só falha no untracked alheio `journal-cup-diagnostic.jsx` (pré-existente). Sem mobile-resp-check (só cor, sem mudança de grelha/flex/larguras).

- **WaitingCoachesModal com altura limitada em desktop (fix):** as colunas tinham `min-[560px]:max-h-none` (sem limite) e o contentor interno sem `max-h` — com muitos coaches/mensagens o modal estendia e o topo ficava cortado. Agora: contentor interno `max-h-[90dvh]`, zona central `min-[560px]:max-h-[60vh]` e cada coluna com `max-h-[60vh]` + scroll interno (cabeçalho e rodapé sempre visíveis). Só `WaitingCoachesModal.jsx` (4 classes).
  - Checks: eslint do ficheiro + `check:types` OK. Sem mobile-resp-check (tweak pontual de classes, sem mudança estrutural).

- **Nome do treinador duplicado no marcador (fix):** o `LiveMatchHero` mostrava o coach 2x em `sm+` — badge por baixo do logotipo (`TeamCrest`) + texto por baixo do nome do clube. Removidos os dois `span`s sob o nome do clube; o badge fica como fonte única (visível também no mobile, distingue equipa própria das outras). `MatchScoreboard.jsx`/`CupFinalStage.jsx` intactos (já só tinham 1x). Só `LiveMatchHero.jsx` (-10 linhas).
  - Checks: eslint do ficheiro + `check:types` OK; `lint` global só falha no untracked alheio pré-existente `journal-cup-diagnostic.jsx`.

- **Época de 20 semanas com amigável + relógio único (novo):** slot 0 = amigável de pré-época (sorteio invisível divs 1–5, ronda 0 em `cup_matches`, viaja no fio como taça para live/jornal/calendário), depois 14 liga + 5 taça. Amigável: sem cartões/lesões (flag `isFriendly` no motor), bilheteira 50/50, com treino/evolução, tira Pré-época no jornal (só antes da L1). Contratos (20), castigos, lesões e cooldowns em slots 1–20 (`currentSlot`/`currentEpoch` com `contractCutoverSeason`); rótulos ficam em matchweek (`matches`, `last_auctioned`, táticas). Folhas cliente lêem `calendarIndex` do contexto com fallback (harnesses intactos); etiquetas via `slotLabel()`/`contractEndInfo().label`.
  - Migração v2: `calendarVersion` + backup `.pre20` + remap +1 (`applied_weeks`, `team_training` pendente) + sorteio de taça nunca redesenhado; `FLUXO-JOGO.md` atualizado.
  - Regressões atualizadas p/ o relógio novo: `contractRenewal` (harness em slots, verde) + `crashRecovery` (slots do mapa 20 + cenário S0 da migração, verde).
  - Checks: server `typecheck` OK; `audit:socketio` 0 erros (registry intacto, zero eventos novos); `audit:gamestate 445WU8` 0 erros; engine-unit 19/19, morale/attendance/fansmood/skillhistory/penalty/own-goal OK; mobile portrait 150/150 + landscape 180/180 PASS.
  - Vermelhos herdados (pré-existentes, ficheiros não tocados): `contractyear` (2× "da época" em comentários), `training-report/multiseason` (import de factory removida), `substitutions` (grep de indentação), `coach-dismissal` (schema do harness sem `wage`), `relegation-coach` (import `getCoachAvatars`).
  - Por fazer: época real de teste numa sala (amigável → L1 → taça → fim de época com migração de sala antiga).

- **Jornal por último evento + briefing espião (novo):** capa segue o jogo antecedente (`lastEvent` via `SEASON_CALENDAR`, só cliente): manchete = meu jogo do evento (taça passa a mandar pós-ronda; eliminado sem jogo cai na liga em vez de manchete velha), tira "Taça · {ronda}" só com jogos de humanos, "A tua série"/"Outros treinadores" só em semana de liga, Pré-época quando o evento é amigável, `bestHouse` do evento. Briefing: cabeçalho dinâmico (`Briefing · {prova}`), faixa de regras no amigável (`cupRound===0`), e modo espião p/ eliminados (`roundFixtures` no resumo do servidor → `spyGames` no VM → lista da ronda; `TacticsView` mostra o briefing nesse caso). Harness do jornal com cenário B (antecedente de taça).
- **Jornal quadro-negro (novo):** folha bege → ardósia escura (fanzine de bancada, identidade mantida). Só tokens scoped no bloco JORNAL do `index.css` (tiers, tinta giz, acentos claros, pó de giz) + remoção de nódoa/dobra do `JournalTab.jsx`; os 12 `text-zinc-950` são todos tinta de chips (mantêm-se, `--color-zinc-950` continua escuro). `STYLE.md` §11 atualizado.
- **Fix crash da Taça (FGPQH6, R1):** `ReferenceError: game is not defined` em `enrichFixturePair` (`server/cupFlowHelpers.ts`) — `game` fora de scope; nenhuma sala no código novo jogava taça nem amigável (loop no lobby). Fix: `game` como 1.º parâmetro + 2 call sites. Sweep sem `@ts-nocheck` apanhou 2.º bug vivo no mesmo ficheiro: import fantasma `fansBaseByDivision` (mora em `MATCH_TUNING`; rebentava no reset de `fans_mood` em fim de época) → `MATCH_TUNING.fansBaseByDivision`. Porque passou: `@ts-nocheck` no topo + `test:crash-recovery` faz mock de `startCupRound` (nunca corre o sorteio real).
  - Prova: smoke avulso (apagado depois) com o `startCupRound` REAL em BD scratch — falha no HEAD com o erro exato de produção, passa com o fix (16 pares enriquecidos + `cupDrawStart`). `typecheck` OK, `test:crash-recovery` verde (com `CRASHTEST_ROOM=game_445WU8.db` — o env quer o NOME DO FICHEIRO; a 1.ª sala alfabética `game_2QXOJY.db` é anterior a `applied_weeks` e falha S0 por ambiente, não pelo código). Salas presas (FGPQH6) recuperam sozinhas: o sorteio é idempotente, o próximo Pronto joga.
- **Barra de topo em semanas (novo):** `GameLayout.jsx` (desktop + menu mobile) mostra `S{(calendarIndex ?? 0) + 1}` (S1–S20) em vez de `J{currentJornada}` (escala 14, congelada na taça). `lint` + `check:types` OK.
- **Audit calendário velho (novo, 5 fixes):** (1) `gameManager.ts` restore de leilão usava `/14` → `getSeasonEndMatchweek()` (contrato acabava no fim da liga em vez da época); (2) `contractRequest` passa a incluir `contractEndLabel` (slot "Jornada N"/ronda/Pré-época) e o cliente usa-o com fallback; (3) cadeado "🔒 Contrato" do `PlayerSearchView` em escala 20 via nova prop `currentSlot` (+ `SEASON_WEEKS=20` nas constants); (4) `gameStateAudit.ts` compara contratos com `calendarIndex+1`; (5) `FinancesTab` estima salários/juros nas 20 semanas (`elapsedWeeks`, verificada cadência semanal por slot em `applyWeeklyFinancesOnce`) em vez das 14 jornadas. Checks: `typecheck` OK, `lint` OK nos ficheiros tocados (o erro global é do `journal-cup-diagnostic.jsx`, untracked e alheio), `audit:gamestate` 0/0/0 em 445WU8 e CUPRE, `audit:socketio` sem achados novos.
  - Checks: `test:briefing` S9 a–d OK; client `lint` (só untracked alheio) + `check:types` OK; server `typecheck` OK; `audit:gamestate 445WU8` 0 erros; mobile portrait 150/150 + landscape 180/180 PASS (cenário B incluído).

- **Diagrama do ciclo de jogo (novo):** `docs/FLUXO-JOGO.md` — calendário de 19 semanas, máquina de fases, lobby→jogo→intervalo→fim (liga vs taça com ET gate), fila pós-jogo + landing no jornal, jornal→lobby, fim de época, legenda de eventos socket por transição e 6 pontos quentes de incoerências. Só doc, sem código.

- **Pedidos do agente com jogador trocado (fix):**`gameDialog` era slot único — 2 `contractRequest` seguidos (rajada normal: o resend de pendentes não tem limite nem espaçamento) e o 2.º esmagava o 1.º sem o utilizador dar por isso (layout igual, agentes colidem em `id % 8`); o Aceitar renovava o visível no clique, não o lido. Agora `contractRequest` entra em fila FIFO (`contractQueue` no `GameContext`, dedup por `playerId`, promoção quando o modal liberta; X adia, Leilão recusa como antes) e os dois handlers ganharam a guarda `inRoom()` que faltava. Âmbito aprovado: só `contractRequest` (contra-proposta/prompts manuais intactos).
  - Checks: eslint dos 2 ficheiros + `check:types` OK. Sem audits (zero servidor) e sem mobile-resp-check (mesmo modal, zero layout). **Pendente:** teste manual com 2 pendentes numa sala real.

- **Festa e malas dentro do pedido de renovação (novo):** o modal do pedido já não fecha no clique — fica em espera ("A falar com o agente…") e transforma-se no sítio em festa (confete + avatar + som de contratação, copy 🥂 existente) ou malas (💼 com vaias, vai para leilão). Servidor emite `contractRenewed`/`contractDeclined` nos 4 caminhos (aceite agente, aceite contra-proposta, 2 recusas; a recusa de contra-proposta nem toast tinha) e os 4 toasts 🥂/💼 saem; `GameDialog` ganha fases `proposal→waiting→renewed|declined` (`awaitServer`, `hideCancel`); contra-proposta e renovação manual entram no mesmo circuito; desfecho com modal fechado cai na fila em vez de esmagar. Âmbito aprovado: modal próprio não, toast substituído, tudo o que renova.
  - Checks: server `typecheck` OK; `audit:socketio` 0 erros; `audit:gamestate 445WU8` 0 erros; client eslint + `check:types` OK. Sem mobile-resp-check (mesmo modal, padrões do `SigningCelebrationModal`). **Pendente:** teste manual numa sala real (aceitar → festa no sítio; recusar → malas; fila avança).

- **Aviso de pausa estendido a lesão/penálti/GR (novo):** os outros coaches só viam o banner por cima do marcador em substituições pedidas (`request_substitution`); lesão/penálti/GR improvisado/GR expulso abriam `matchActionRequired` que o cliente alheio descartava em silêncio. Agora o `waitForMatchAction` (`server/game/engine.ts`) emite `substitutionPauseStarted` com `{ teamId, coachName, type }` ao abrir ação de `injury`/`penalty`/`emergency_gk`/`gk_red_card` e `substitutionPauseEnded` ao resolver (antes só `user_substitution`); `request_substitution` passou a enviar `type: "user_substitution"`; `useSocketListeners.js` guarda o `type`; `LiveMatchHero.jsx` mostra texto por tipo (`PAUSE_TEXT`: substituições/lesão/penálti/reorganizar equipa). Banner continua oculto para o próprio (vê o modal).
  - Checks: server `typecheck` OK; eslint dos ficheiros + `check:types` OK (`lint` global só falha no untracked alheio `journal-cup-diagnostic.jsx`, pré-existente); `audit:socketio` 0 erros (emits via `io.to()` no engine não entram no registry — como antes).

## BalanceLineChart — eixo Y com zoom aos dados (fix)

- Eixo deixou de forçar o zero (`Math.min(0,…)`/`Math.max(0,…)` removidos): `axisMin`/`axisMax` = `rawMin/rawMax ± pad` (12% do span, mín. 1); 4 níveis igualmente espaçados mantidos. A escala segue a amplitude do histórico em vez de saltar ancorada ao zero.
- Área fecha em `fillY` (zero visível, senão bordo do gráfico) para não projetar para fora do SVG quando tudo é positivo/negativo; baseline zero e pontos de cruzamento mantêm o `zeroY` real. Só `BalanceLineChart.jsx`.
- Checks: eslint limpo + `check:types` OK. Sem mobile-resp-check (mesma estrutura SVG, só cálculo de escala).


## Audit MatchBriefing (2026-09-12)
- 4 ajustes menores: `nextMatchSummary` agora vem direto de `useGame()` (elimina indirection); `BriefingSkeleton` completado com faixa amigável e grelha de confronto; `console.warn` no guard `!vm` para detetar inconsistências de dados; `DifficultyGauge` verificado (já alinhado, não era bug). Checks: client `lint` + `check:types` OK.

## Táticas ≈ Briefing — tokens + faixa de fase (2026-09-15)
- `TacticsView.jsx` (único ficheiro): hex próprios (`bg-[#111]`, `border-[#1e1e1e]`, `border-[#1a1a1a]`, `bg-[#161616]`/`bg-[#1a1a1a]`) → tokens do briefing (`bg-surface-container`, `border-outline-variant/25`, divisores `/15`, interiores `bg-surface-container-low/60`); cabeçalhos de secção `font-bold`→`font-black` e `py-2.5`→`py-2` (Moral/Mentalidade/Formação mobile + Formação/Mentalidade/Titulares/Suplentes desktop).
- Botão solto "Voltar ao Briefing" → faixa de fase estilo herói do briefing (rótulo `🎯 Tática · Taça|Jornada N` + `PrepStepper current="tactics"` reutilizado, sem código novo) com o voltar integrado.
- Intocados (acordado): relvado, botão Jogar/FAB, `PlayerRow`, `FamiliarityStars`, drag-and-drop e lógica.
- Checks: `check:types` OK; `lint` só com os 2 erros pré-existentes (`GameContext.jsx`, `landing-resp-test.jsx` — confirmados com stash). Sem mobile-resp-check (só classes cosméticas + faixa com padrão existente).

## Jornal vira caixa de entrada estilo CM2001 (2026-09-15)
- `JournalTab.jsx` reescrito: barra azul "{treinador} News", separadores Todas/Mensagens/Competições/Lesões e Castigos + Contratos e Media/Transferências/Trabalhos/Recordes, lista (data+título) em cima, detalhe em baixo, Anterior/Seguinte e Próxima não lida. Lido/não lido em localStorage por sala+treinador.
- Renovações (`contractQueue`) e convites (`jobOfferModal`) entram como linhas 🚩 e bloqueiam o Pronto: `TacticsContext.handleReady` desvia para o Jornal; `setReady` no servidor recusa com systemMessage (usa o SELECT do plantel + `pendingJobOffers`, sem query extra). Direção vira linha com Ok, sorteio abre o popup existente, humor pós-jogo e lesões/castigos (do plantel) e mercado/prémios (do `globalNews`) são só leitura. Resposta de contrato continua no `GameDialog` (`focusContractDialog` no contexto).
- Apagados: `PostMatchMoodModal.jsx`, `BoardWarningModal.jsx`, `JobOfferModal.jsx`, `journalHeadlines.js`, harness `boardwarning-resp-test.*`; `postMatchFlow.js` só com penáltis→despedimento→fim de época; `GameOverlays.jsx` sem os 3 modais (landing pós-jogo já não espera por eles — o Jornal é o tab de aterragem). Novos: `utils/inboxItems.js` (puro), `hooks/useInbox.js`, harness `journal-resp-test.jsx` com provider fabricado. `docs/FLOW_JOGO.md` atualizado (cap. 4 e 7).
- Checks: server `typecheck` OK; `audit:socketio` 0 erros; client `lint` só os 2 erros pré-existentes (confirmados com stash); `check:types` OK; mobile portrait 150/150 + landscape 180/180 PASS, screenshots 390 e 667 verificados. **Pendente:** teste manual numa sala real (renovação → responder no Jornal → Pronto desbloqueia; convite aceitar/recusar).

## Jornal em sintonia Cashball (2026-09-15)
- Título passa a só "Notícias" (caiu o "{nome} News"); azuis do CM (`bg-blue-800`, `bg-indigo-950`, seleção `bg-red-800`) trocados por tokens (`surface-container`, `surface-container-low`, seleção `bg-primary/15`, título do detalhe `text-tertiary`); ações passam ao `Button` partilhado (`danger`/`success`/`secondary`/`primary`/`accent`, `sm`) — corrige ainda o contraste fraco do botão de resposta.
- Checks: eslint do ficheiro + `check:types` OK; harness `journal-resp-test` 5/5 PASS com screenshot 390 verificado. Sem mobile completo (só cores/texto/componente partilhado, sem estrutura).

## Jornal primeiro no menu + sidebar compacta (2026-09-15)
- Título da página passa a "Jornal do Clube" (no menu continua "Jornal", curto).
- `constants/navigation.js`: primeiro grupo passa a Jornal (tab única, sem cabeçalho como antes); Clube entra como primeira tab de Gestão; Competição perde o Jornal. Fly-ups/destaques mobile atualizam sozinhos (`getGroupTabs`/`getGroupTabKeys`); ninguém referenciava o id de grupo "clube".
- `GameLayout.jsx`: botão direto mobile Clube→Jornal (ícone `newspaper`, `data-tour="nav-jornal-mobile"`, badge vermelho com as bandeiras por responder via `useInbox`); badge igual na sidebar desktop; botões desktop `py-2.5`→`py-2` e cabeçalhos `pt-3`→`pt-2` (~60px poupados em ecrãs curtos).
- Tutorial: passo "club" passa a `submenu: "gestao"` + alvo `nav-club-sub` no mobile (o `nav-club-mobile` deixou de existir) — mesmo padrão dos passos de Plantel/Treino/Finanças.
- Checks: eslint dos 5 ficheiros + `check:types` OK; mobile retrato 150/150 + paisagem 180/180 PASS; screenshot 390 confirma o H1. `docs/FLOW_JOGO.md` cap. 4 com a nova ordem.

## Tutorial menciona o Jornal (2026-09-15)
- Novo passo "jornal" em `coachTutorialSteps.js` logo após o Clube: aponta para `nav-jornal`/`nav-jornal-mobile`, explica a caixa de entrada e que as linhas 🚩 bloqueiam o Jogar. Overlay genérico (`length`), sem código novo.
- Checks: eslint + `check:types` OK. Sem mobile-resp-check (só conteúdo, zero layout).

## Jornal: filtros O Meu Clube, 1 notícia por negócio, corpos ricos (2026-09-15)
- Filtros: uma só linha — Todas, O Meu Clube (renovações, convites, direção, humor), Competições (sorteio, tomba-gigantes, prémios, mexidas de treinadores), Plantel (lesões, castigos, academia), Mercado (negócios). `JournalTab` sem segunda faixa; `newsCategory` remapeado.
- Leilões: cada negócio funde transfer_in/transfer_out + histórico global num item ("X reforça Y") por jogador+jornada (`dealKey` em `inboxItems.js`); servidor cortou os 3 `systemMessage` do leilão (falhado, bloqueado por contrato, vendido) — o bloqueio por contrato agora grava `auction_failed` ("retirado do leilão") para nenhum evento ficar silencioso.
- Corpos: negócio = posição + skill + ⭐ + rota + valor + via (leilão/mercado/cláusula/clube NPC); genéricos = descrição + valor formatado sem duplicar "€"; lesões/castigos com posição + skill. Servidor passa `skill/is_star/vendedor` no SELECT de transfer_history.
- Checks: server typecheck OK, eslint + `check:types` OK, mobile retrato 150/150 + paisagem 180/180, harness 5/5 com screenshot visto.

## Hero sem "Taça" no amigável + fim do badge AO VIVO (2026-09-15)
- `LiveMatchHero.jsx`: `isFriendly` via `/amigavel/i` no `cupMatchRoundName` (ronda 0 chega como "Amigável de pré-época" pelo mesmo canal da taça) — meta strip mostra só o nome da ronda, sem prefixo "Taça ·"; pill pré-jogo passa de 🏆 a 🤝 no amigável. Badge vermelho AO VIVO eliminado em todos os jogos (liga/taça incluído, decisão do utilizador).
- Intocado: `MatchPage.jsx` (chip/título "Outros jogos" já sem prefixo), pill inferior AO VIVO e relógio do header no `GameLayout.jsx`.
- Checks: eslint do ficheiro + `check:types` OK; `lint` global só com os 2 erros pré-existentes. Sem mobile-resp-check (remoção pontual, sem estrutura).

## Amigável fora das estatísticas de jogador (2026-09-16)
- `finalizeFriendly` (`server/cupFlowHelpers.ts`) descarta `fixture._deltas` antes do flush: golos do amigável deixam de tocar `players.goals` (época → Melhores Marcadores + historial) e `career_goals` (carreira). Presenças/vermelhos/lesões já estavam excluídos (guard `calendarIndex > 0` + `isFriendly` na engine).
- Relato, eventos, jornal e resultado do amigável intactos — só os contadores de jogador ficam de fora. Só futuros (sem correção retroativa, decisão do utilizador).
- Checks: server typecheck OK.

## Imagens para WebP: players + logos + coaches (2026-09-16)
- Novo `scripts/compress-images.mjs` (`npm run compress:images`, dep `sharp`): fotos q82 / logos lossless, flags `--dry-run --keep-originals --skip-fixtures --migrate-rooms`, lotes de 16 em paralelo. Corrida única: 1370 imagens, 143 MB → ~31 MB (−79%). Originais PNG/JPG apagados.
- `all_teams.json` com 1370 refs reescritas para `.webp`; `base.db` regenera-se sozinha no próximo arranque (hash das fixtures em `ensureSeeded.js`). Sem salas `game_*.db` ativas para migrar (só WAL/SHM órfãos de salas apagadas — deixados intactos).
- Verificado: dry-run idempotente (0 ficheiros), foto e logo abertos visualmente OK, `node --check` OK. `dist/`/android/ios têm cópias antigas mas regeneram-se no build.

## Gráfico de saldo: eixo X = época completa, 20 pontos (2026-09-18)
- `financeData.balanceHistory`: agora só a época atual (máx. 20 pontos = calendário completo: 1 amigável + 14 liga + 5 taça), antes eram 2 épocas (até 40). `x` = slot do calendário (0..19); cada ponto tem `label` de `SEASON_CALENDAR[slot]`: `J1`…`J14`, `Amigável`, `16 avos`/`Oitavos`/`Quartos`/`Meias`/`Final` (antes a taça aparecia rotulada pela matchweek anterior — enganador).
- `BalanceLineChart.jsx`: ticks do eixo X e tooltip usam `p.label` (fallback `matchweek` para dados sem label); lógica de fronteira de ano eliminada (só 1 época). Gravação em BD inalterada — só o payload.
- Checks: server typecheck OK; client `check:types` OK; `lint` só com os 2 erros pré-existentes (verificados via stash). Sem mobile-resp-check (sem mudança estrutural de layout).

## Último confronto da Taça sem "(g.p. 0–0)" fantasma (2026-09-18)
- `getLastConfrontation` (`server/matchSummaryHelpers.ts`): `hasEt`/`hasPen` vinham de `!= null`, mas as colunas têm `DEFAULT 0` — logo todo o jogo da taça mostrava sufixo de penáltis (ex. briefing Malveira × Portimonense: "1–2 (g.p. 0–0)") e o `result` era decidido pelos penáltis (0–0 → sempre "D", vitórias nos 90' viravam "Derrota").
- Agora: `hasEt` só se empate nos 90'; `hasPen` só se empate após prolongamento + penáltis desiguais (shootout real nunca é 0–0). Sem migração de esquema.
- Caso que motivou: sala E3AQ4G — último confronto real era Portimonense 2–1 Malveira (90', época 1); o "0–0 após prolongamento" era a ficha do próximo jogo (época 2, `played=0`), não um resultado.
- Checks: server typecheck OK (exit 0); predicados validados por SQL em todas as salas — 0 jogos decididos nos 90' com g.p. restante, 0 shootouts reais sem sufixo.

## Festejo de golo em todos os golos (2026-09-19)
- `GoalFlashOverlay.jsx` (único ficheiro): removidas as portas `mine` do `<CelebrationBurst/>` e do carimbo "GOLO!" nas variantes `page` e `card`; o wash verde/vermelho (`color`) continua a distinguir quem marcou. Card leva burst compacto (`showChampagne={false}`, cortado pelo `overflow-hidden`). Motivo: diagnóstico mostrou que 1–2 confetes/partida era by-design (só golos próprios; motor dá ~30 oportunidades/jogo → 1–2 golos teus) — o utilizador quer festejo em todos os golos do seu jogo e nos cards de humanos.
- Checks: client `check:types` OK; `lint` só com os 2 erros pré-existentes (confirmados via stash); `test:mobile` 155/155 + `test:mobile:landscape` 186/186.

## Falso «eliminado da Taça» ao carregar JOGAR (2026-09-22)
- Corrida: `seasonState` (fim da liga) dispara `requestNextMatchSummary` antes do sorteio (`startCupRound` corre no fim da cadeia pós-jogo) → `buildNextMatchSummary` não encontra `cup_matches` da ronda → `opponent: null` → `TacticsView` mostra o cartão de eliminado. `cupDrawStart` não invalidava o resumo, ficava preso até ao refresh.
- Fix (`client/src/hooks/useSocketListeners.js`, handler `cupDrawStart`): após `setCupDraw`, emite `requestNextMatchSummary` com `meRef.current?.teamId` (sorteio já gravado nesse ponto; vale também com replay a correr, pois fica antes do early-return).
- Checks: `check:types` OK; `lint` só com os 2 erros pré-existentes (`landing-resp-test.jsx`, `GameContext.jsx` — ficheiros não tocados).

## Notícia de boas-vindas com adeptos + direção por escalão (2026-09-23)
- `client/src/utils/inboxItems.js` (único ficheiro): ramo `welcome` do `newsArticle` passa de 2 frases para abertura + expectativas dos adeptos + objetivos da direção + nota de timing. Novo helper `welcomeBrief(div)` com 4 perfis (D1 Europa/metade superior; D2/D3 luta pela subida; D4+ entrega total e subida de escalão, direção a pedir contas no verde). Timing via `matchweek` da linha: arranque (≤4) = margem para moldar; caso contrário = época em andamento, cada jornada conta a dobrar. A `division` já vinha no feed (`socketNewsHandlers.ts`), por isso notícias antigas ganham o texto sem migração; 3 variantes de abertura mantidas.
- Checks: `check:types` OK; `eslint src/utils/inboxItems.js` limpo; `lint` global só com os 2 erros pré-existentes (`landing-resp-test.jsx`, `GameContext.jsx` — ficheiros não tocados). Sem mobile-resp-check (só texto, sem layout).

## Marcas de água dos emblemas no hero do jogo (2026-09-24)
- `LiveMatchHero.jsx` (único ficheiro): duas marcas de água decorativas (`aria-hidden`, `pointer-events-none`) — emblema da casa à esquerda, de fora à direita, em zoom (`w-56/sm:w-72`), escuro (`brightness(0.45)`) e desvanecido (`opacity 0.13` + máscara em degradê para o centro). Só com `team.crest` (fallback de 3 letras inalterado), só em `sm+` e com `hideScoreboard=false` (Final fundida sem duplicação); `onError` esconde se o logo falhar.
- Checks: `check:types` OK; `lint` global só com os 2 erros pré-existentes (`landing-resp-test.jsx`, `GameContext.jsx` — confirmados via stash). Sem mobile-resp-check (fundo decorativo absoluto, sem grid/flex/larguras).

## Marcas de água no duelo do briefing (2026-09-24)
- `briefing/DuelHero.jsx` (único ficheiro): mesma receita do hero ao vivo — faixa do frente-a-frente passa a `relative overflow-hidden` com marcas de água dos emblemas (casa esq., fora dir., `brightness(0.45)`, `opacity 0.13`, máscara em degradê, `sm+`); `DuelSlot`s e bloco VS com `relative z-10` para ficarem por cima. `onError` esconde se o logo falhar.
- Checks: `check:types` OK; `eslint` limpo nos 2 ficheiros tocados (lint global mantém só os 2 erros pré-existentes). Sem mobile-resp-check (fundo decorativo absoluto).

## Intervalo: legibilidade do ecrã de substituições (2026-09-24)
- 6 ficheiros cliente, só UI (sem lógica de jogo): legenda «Skill · RES · Forma» nos cabeçalhos Titulares/Suplentes (`PlayerLists.jsx`); fluxo Sai→Entra numerado «1 · Sai»/«2 · Entra» + hint com ícone ⚠ e `role="status"` em `text-amber-200` (`SwapControls.jsx`); coluna Mentalidade/Substituições em fluxo contínuo sem `mt-auto` nem scroll interno (`SubsPanel.jsx`); contraste subido nos rótulos/placeholders (`MatchPlayerCard.jsx`, `CompactPlayerCard.jsx`, `Panels.jsx`, `SwapControls.jsx`). Motivo: avaliação 7/10 do ecrã da imagem (números sem legenda, Sai/Entra confuso, buraco na coluna direita, cinzento fraco).
- Checks: `check:types` OK; `lint` só com os 2 erros pré-existentes (`landing-resp-test.jsx`, `GameContext.jsx` — confirmados via stash); `test:mobile` 154/155 com a única falha no `useradmin-resp-test` a 320px (pré-existente, confirmada via stash); `intervencao-test` 5/5 portrait + 6/6 landscape, screenshots 390 e 667 verificados.

## Bancada viva no estádio (2026-09-24)
- `StadiumIllustration.jsx` (+1 prop no `StadiumTab.jsx`): nova prop opcional `occupancy` (0..1, `null` = cheia) com thinning determinístico da multidão (`hash01`, estável entre renders); núcleo de claques central na cor do clube que esvazia em último; 4 vomitórios/escadas por anel a dividir a bancada em sectores; topo do relvado agora acompanha a largura da bancada (`farHalf`, antes fixo em 380); fundo simplificado — sem pinheiros/pássaros, colinas em silhuetas com base escondida (antes elipses flutuantes). Propaga-se aos 4 usos (Estádio, Clube, planteis); ocupação real só no `StadiumTab` (único com `avgAttendance` — época nova/sem jogos em casa mostra cheia).
- Checks: `check:types` OK; `lint` só com os 2 erros pré-existentes (confirmados via stash); renders SSR rasterizados (3k/60k, cheia/esvaziada) verificados visualmente. Sem mobile-resp-check (só geometria interna do SVG, sem layout).

## Intervalo: sem barra Gestão, sem RES/setas, relógio com 45' (2026-09-24)
- 6 ficheiros cliente, só UI: `LiveClock.jsx` mostra `45'` + `Intervalo` no intervalo (antes ⏸ sem minuto); `IntervencaoView.jsx` sem barra de título em todas as vistas de intervenção (aviso de GR improvisado mantido como linha fina; «Anular todas» continua no `SubsPanel`); `MatchPlayerCard.jsx` + `CompactPlayerCard.jsx` sem coluna RES nem ícone de troca (só skill + forma); legendas `PlayerLists.jsx` passam a «Skill · Forma». Motivo: anotações do print — «Eliminar barra», caixas no RES/setas, «Intervalo» ao lado do relógio.
- Checks: `check:types` OK; `lint` só com os 2 erros pré-existentes (`landing-resp-test.jsx`, `GameContext.jsx` — confirmados via stash); `test:mobile` 155/155 + `test:mobile:landscape` 186/186.

## RES de volta no intervalo + fim dos contadores 11/7 (2026-09-25)
- Reversão cirúrgica da parte RES do `1b1e617d`: `MatchPlayerCard.jsx` volta a mostrar etiqueta RES + número cyan entre skill e forma; `CompactPlayerCard.jsx` volta a mostrar o número RES cyan; legenda dos cabeçalhos volta a «Skill · RES · Forma». Barra de título, setas de swap e relógio «45' Intervalo» do slim mantêm-se.
- `PlayerLists.jsx`: apagados os spans `{players.length}` — cabeçalhos Titulares/Suplentes sem «11»/«7». Contadores mobile/landscape (navegação) e `SUBS n/3` ficam.
- Checks: `eslint` limpo nos 3 ficheiros; `check:types` OK; `intervencao-test` 5/5 portrait + 6/6 landscape.

## Painéis com 10% de transparência (foto por trás) (2026-09-25)
- `client/src/index.css` (único ficheiro): 6 tokens surface do `@theme` + 6 do override `.jp-*` passam a `color-mix(... 90%, transparent)` — os ~352 usos herdam sem mexer em JSX. Sem `backdrop-blur` (performance) e sem mexer nas fotos (continuam escuras). Painéis sobrepostos acumulam (~81% efetivo), efeito «sugerido» como pedido.
- Checks: `test:mobile` 155/155 + `test:mobile:landscape` 186/186; screenshots intervencao/club 390 vistos (painéis intactos); CSS servido pelo vite verificado (os 6+5 mixes presentes). Nota: harnesses não renderizam `GroupBackdrop`, por isso o véu da foto só se aprecia na app (`npm run dev`).

## Intervenção a 95% de opacidade (2026-09-25)
- `IntervencaoView.jsx` (único ficheiro): raiz redefine os 6 tokens surface a 95% no `style` inline — toda a subárvore (colunas, cartões, controlos, cronologia, adversário) herda; resto do jogo fica nos 90% globais. Sem ancestral `.jp-*` nesta vista (verificado), hexes base seguros.
- Checks: `eslint` limpo; `check:types` OK; `intervencao-test` 5/5 portrait + 6/6 landscape, screenshot 667 visto.

## Lock de leilão: calendarIndex em vez de matchweek (2026-09-25)
- A guarda anti-releilão (`last_auctioned_matchweek`) era gravada/comparada com `game.matchweek`, que as semanas de Taça/Amigável **não** incrementam (por design) — jogador leiloado na jornada N de liga ficava bloqueado durante toda a semana de taça seguinte ("já foi a leilão nesta jornada"). Violava a regra permanente "fonte da verdade `game.calendarIndex` — nunca `matchweek`".
- Mudança (4 localizações, sem migração de BD — a coluna mantém o nome, só muda o valor gravado; stamps antigas desbloqueiam sozinhos porque `calendarIndex >= matchweek`): stamp em `startAuction` + guarda em `listPlayerOnMarket` (`auctionHelpers.ts`); guarda em `listPlayerForTransfer` (`socketTransferHandlers.ts`); badge `alreadyAuctionedThisWeek` no `PlayerHistoryModal.jsx` passa a usar `nowIdx` (=`calendarIndex ?? matchweekCount`). Semântica: 1 leilão por slot de calendário.
- Checks: `typecheck` OK; `lint` só com os 2 erros pré-existentes (confirmados via stash); `check:types` OK. Sem mobile-resp-check (só lógica, sem layout).

## Festejos de golo aos 45'/90' e após penálti (2026-09-25)
- `GoalFlashOverlay.jsx` (único ficheiro): removidos os dois guards `isPlayingMatch` (efeito + render). O `isPlayingMatch` passa a `false` logo aos 45' (intervalo) e aos 90'/120' (fim), e o reveal do penálti com suspense chega 3s depois via `setTimeout` — o golo entrava na fila mas o render devolvia `null`. A frescura do flash (`freshGoalFlashes` ignora >2,2s) já garante que não há festejos fora de jogo; chiamantes (`LiveMatchHero`, `LiveFixtureRow`) intocados — a prop extra é ignorada.
- Checks: `check:types` OK; `lint` só com os 2 erros pré-existentes (`landing-resp-test.jsx`, `GameContext.jsx` — confirmados via stash). Sem mobile-resp-check (só lógica, sem layout). Sem sala viva para `audit:gamestate`/`audit:socketio` (só cliente tocado).

## Comentário de chances na cor da equipa (2026-09-25)
- `liveHelpers.js`: novo `isDarkColor` (mudido do `CupDrawPopup.jsx` — fonte única) + `teamTextColor(team)` (primária se legível, secundária se escura; sem fallback branco). `CupDrawPopup.jsx` passa a importar de lá.
- `LiveMatchHero.jsx`: tier `chance` no `COMMENTARY_EFFECTS` (pulse, sem cor estática); no IIFE do comentário: chance → lado via `resolveSide`, cor de texto `teamTextColor(hInfo|aInfo)`, `text-left` (casa) / `text-right` (fora) e `--pulse-color` na cor da equipa a ~45% alpha (`${cor}73`). Demais eventos continuam centrados.
- Checks: `eslint` limpo nos 3 ficheiros; `check:types` OK; lint global mantém só os 2 erros pré-existentes (`landing-resp-test.jsx`, `GameContext.jsx`). Sem mobile-resp-check (tweak de className/cor, sem mudança de layout).

## Moral individual dos jogadores (2026-09-25)
- Nova coluna `players.morale` (0–100, neutro 50): `schema.sql` + migração `ALTER TABLE` idempotente em `gameManager.ts` (template `base.db` re-seeda sozinho via hash do schema; saves em curso via migração). Tuning em `MATCH_TUNING` (`moralePlayer*`: resultado +3/+1/−3, titular +1, banco −2, golo +2, auto-golo −3, vermelho −4, peso `0.001` = ±5%).
- `engine.ts`: bloco isolado em try/catch (precedente `fans_mood`) com decay para 50 + deltas por evento; lesionados/suspensos não mexem. `matchCalculations.ts` (média do plantel no ataque/defesa) + `ratings.ts` (`contributionBase`) aplicam o fator. Juniores com `morale: 50`.
- UI: `BadgeSkills` com 4.ª célula MOR violeta + `morale={player.morale}` nos 5 chamadores (PlayerRow, TacticsView, MatchPlayerCard, CompactPlayerCard, OpponentGridCard; BenchPlayers usa `hideResForm` e ficou fora); `STYLE.md §10` com a receita; padding do badge compacto abaixo de 360px (`px-1 min-[360px]:px-2`) — sem isto o topwidgets falhava a 320px (+25px, regressão confirmada via stash). Fixtures dos harnesses `mobile/topwidgets` com `morale` variada.
- Cortado do plano: comentário de narração por moral extrema; MOM como fonte de moral.
- Checks: `typecheck` OK; `lint` só 2 erros pré-existentes (stash); `check:types` OK; `audit:gamestate 78213E` 0/0/0; `audit:socketio` 0 erros; `test:mobile` 155/155 + `test:mobile:landscape` 186/186; screenshots 390 e 667 vistos. Fumo SQL (migração idempotente + CASE UPDATE) OK. Por verificar em sala viva: deltas aplicados após a próxima jornada.

## Moral em escala 1–50 (2026-09-25)
- Reescala 0–100 → 1–50, neutro 25 (escolhido pelo utilizador; meio exato). `MORALE_NEUTRAL=25`, deltas a metade (V+2/E+1/D−2, titular+1, banco−1, golo+1, auto-golo−2, vermelho−2), `moralePlayerPerPoint 0.002` (±5% preservados), clamp `1–50`, decay para 25.
- `schema.sql` DEFAULT 25; `gameManager.ts` migração idempotente (50/NULL→25, >50→metade; re-arranques seguros); `seed.js` e `contractHelpers.ts` (prospetos da academia) com `morale` explícito 25/`MORALE_NEUTRAL` — sem depender do default da coluna em saves antigos. Juniores 25; fixtures dos harnesses em gama 1–50.
- `matchCalculations.ts`/`ratings.ts`: só comentários (lêem as constantes).
- Árvore partilhada com outra sessão: 5 ficheiros alheios a meio (`commentary.ts` com erro de parse, `types.ts`+`matchSummaryHelpers.ts` com erro de aridade, `tacticFamiliarity.ts`, `weeklyFlowHelpers.ts`) — não tocados nem commitados; `typecheck` validado com esses 5 em stash (limpo) e com a árvore completa (falha alheia). `socketEventRegistry.json` é gitignored.
- Checks (só meus): `typecheck` OK; `lint` só 2 erros pré-existentes; `check:types` OK; `audit:gamestate 78213E` 0/0/0; `audit:socketio` 0 erros; harnesses afetados 10/10 portrait + 12/12 landscape (sem mudança de layout aplicacional — só números mais estreitos nas fixtures — por isso suite completa não repetida).

## Transparência local do IntervencaoView (2026-09-25)
- `IntervencaoView.jsx` (único ficheiro): removido o override inline que redefinia os 6 tokens `--color-surface*` a 95% — a vista herda os 90% do CSS geral, que é suficiente. Mantido o `background` radial com a cor primária da equipa da casa. Subcomponentes `intervencao/` intocados (escolha do utilizador).
- Checks: `eslint` limpo no ficheiro; `check:types` OK; lint global mantém só os 2 erros pré-existentes (`landing-resp-test.jsx`, `GameContext.jsx` — confirmados via stash). Sem mobile-resp-check (tweak, sem mudança de layout).

## Familiaridade táctica 50/50 por parte (2026-09-25)
- `server/game/tacticFamiliarity.ts`: `history` passa a guardar pares `{ first, second }` por jogo (strings legadas = 1 estrela, continuam válidas); contagem ponderada (0.5 + 0.5, passos de 0.5); nova `getSplitFamiliarity(game, teamId, first, second?)` devolve `{ first, second, stars, score, bonus }` com média 50/50 (só leitura, fórmula do bónus intacta). `updateTacticFamiliarity` recebe agora as duas táticas; sem 2.ª parte distinta equivale à estrela inteira de antes.
- Snapshot da 1.ª parte em `weeklyFlowHelpers.ts` (`runMatchSegment` aos 46': fotografia `fixture._t1/_t2` para `_firstHalfT1/_firstHalfT2` antes de reler as escolhas do intervalo — cobre liga, Taça e amigáveis). Finalizações (`matchSummaryHelpers.ts`, `cupFlowHelpers.ts` ×2 Taça + amigável) passam 1.ª/2.ª parte; linha de auditoria `player_tactic_history` mantém a tática final; sockets e UI inalterados (estrelas `x.5` fazem floor visual, sem crash).
- Checks: `typecheck` sem erros nos 5 ficheiros (o global falha em `commentary.ts`, partido antes desta tarefa — não tocado); teste `tsx` 6/6 (legado 1.0, meias-estrelas, mesma formação = 1.0, split 1.5★/30pts, fallback, formato sockets); `audit:socketio` 0 erros. Sem sala viva para `audit:gamestate`.

## Radar do briefing em ordem Casa/Fora (2026-09-25)
- `CompareRadar.jsx` (único ficheiro): fim do "eu sempre à esquerda" — barras e blocos de forma seguem a ordem do jogo (casa à esquerda, fora à direita), igual ao `DuelHero`. `vm.compare.*` já vinha ordenado `[casa, fora]`; forma/registo ordenam-se com o helper `orderedPair` existente. `splitGoals` devolve `{home, away}`; `DualBar` recebe `homeTeam/awayTeam`.
- Cores (pedido do utilizador): cada lado usa a cor principal da equipa — barras na `color_primary` (reserva esmeralda/azul), valores em `teamTextColor` reutilizado do `liveHelpers.js` (primária se legível, secundária se escura). Cabeçalho passa de "Tu vs X" para "{casa} vs {fora}"; `FormBlock` com etiqueta Casa/Fora; mosaico "Ambiente" mantém a moral da minha equipa.
- Checks: `eslint` limpo no ficheiro; `check:types` OK; lint global mantém só os 2 erros pré-existentes (`landing-resp-test.jsx`, `GameContext.jsx` — confirmados via stash). Sem mobile-resp-check (reordenação dentro da mesma grelha, sem mudança de layout). View-model intocado (regressão do briefing não afetada).

## Revisão da landing page (2026-09-26)
- Avaliação pedida: 8,5/10; corrigidos os 4 pontos (OK do utilizador).
- pt-PT: `landingContent.js` "Acompanhe"→"Acompanha"; `HeroSection.jsx` comentário "Placar"→"Marcador" (regra AGENTS.md).
- `constants/index.js`: nova `APP_VERSION = "v1.1a"`; `LandingFooter.jsx` usa-a em vez do literal fixo.
- `AuthField.jsx`: novo export nomeado `AuthErrorHint` (erro de auth ou aviso de ligação); `LoginForm`/`RegisterForm` usam-no — bloco de 7 linhas duplicado eliminado, sem ficheiro novo.
- Checks: `check:types` OK; `lint` só 2 erros pré-existentes (confirmados via stash); sem mobile-resp-check (saída renderizada idêntica, sem mudança de layout).

## Versão por data — rolling release (2026-09-26)
- Regra permanente (decisão do utilizador): CalVer `vAA.MM.N` para sempre, sem congelar em `v1.0`. Ex.: `v26.09.1` = ano 26, mês 09, 1.º build do mês.
- Fonte única: `APP_VERSION` em `client/src/constants/index.js`, visível no rodapé da landing (`LandingFooter.jsx`).
- Manutenção: a cada alteração commitada incrementa-se N; ao virar o mês, N volta a 1.
- Tags: cada versão leva tag anotada homónima no GitHub (`v26.09.1` criada e pushed em 2026-09-26). N incrementa em commits com código; docs-notas sozinhas não contam.

## Landing com cara de jogo (2026-09-26)
- Pedido: landing "muito distante do jogo". Decisões do utilizador: mesma pele + conteúdo real, montra estática, página toda.
- Novo `auth/landingShowcase.js`: plantel fictício (IDs negativos → `PlayerLink` desliga-se sozinho, montra só leitura), direto simulado, mini-tabela, manchetes, widgets.
- `HeroSection`: "O balneário é teu." + cartão de direto com minuto a tiquetaque (parado com reduced-motion). `ShowcaseSections` (ex-`FeaturesStrip`): `SummaryWidget` mini, `PlayerRow` reais, mini-tabela, jornal em Newsreader — tudo tokens do jogo.
- Apagados `ParticleCanvas.jsx`/`FeaturesStrip.jsx`/`landingContent.js`; `ReconnectScreen` sem partículas e com pele do jogo (tinha import pendurado do canvas — partia o harness).
- Auth (`AuthCard`, formulários, header, footer) com pele do jogo; lógica intacta. `RoomSelectScreen` continua com tokens `landing-*` (ficam no CSS) — follow-up.
- Checks: `eslint` limpo; `check:types` OK; `landing-resp-test` portrait 5/5 + landscape 6/6 PASS; screenshots 390/667/detalhe vistos. Versão → `v26.09.2`.

## RoomSelect com pele do jogo (2026-09-26)
- `RoomSelectScreen.jsx` (669 linhas): só classes — `landing-*`→0 ocorrências; primary no nome/modos/seleção, tertiary dourado no CTA "Continuar", error no Sair/erros, sky/amber de badges intactos (STYLE.md §5); `rounded-xl/2xl`→`rounded-md`; glows esmeralda removidos. Lógica, socket de presença e estrutura (harness valida) intactos.
- Harness `roomselect-resp-test.jsx`: fundo `bg-bg text-on-surface`.
- Checks: `eslint` limpo; `check:types` OK; `roomselect-resp-test` portrait 5/5 + landscape 6/6 PASS; screenshots 390/667 vistos. Versão → `v26.09.3`.

## RoomHub sem landing-* e tokens mortos removidos (2026-09-26)
- `RoomHub.jsx`: 5 pontos nos badges de convite (mesmo mapeamento do RoomSelect: primary/error/outline). `index.css`: bloco `--color-landing-*` e `.glass-card` mortos removidos — zero referências em JSX/JS.
- O re-skin partiu o `landing-resp-test`: contava cartões via `[class*="rounded-2xl"]`; passa a `[class*="cursor-pointer"]` (só os cartões têm).
- Checks: `eslint` limpo nos tocados (o erro do harness é o pré-existente); `check:types` OK; suite completa portrait 155/155 + landscape 186/186 PASS; screenshots roomhub 390/667 vistos. Versão → `v26.09.4`.

## coachDismissalHelpers — revisão 7/10 e correção (2026-09-26)
- Avaliação pedida do ficheiro: 7/10 (OK do utilizador para correção completa + helper de emits).
- Bug real: `dismissHumanCoach` apaga o assento e `autoAssignDismissedCoach` não o recriava — a sala não congelava na ausência do realocado e um restart perdia-lhe a equipa. Fix: `setSeatTeamId(game, coachName, team.id)` (`seatOf` recria com status member e pronto a false).
- `emitTeamAssigned(game, coachName, team, isNew)` extraído (auto-assign `true`, aceitar-convite `false`) — dois blocos de ~45 linhas eliminados.
- Folha salarial NPC: um `GROUP BY team_id` em vez de um `SUM` por clube; `warn` nos dois `catch` dos espelhos do Jornal (`board_warning`, `job_offer`).
- Não mexido: `db.run` fire-and-forget (o driver sqlite serializa por ordem de chamada; promisificar tudo fica para quando houver teste de crash dedicado) e `Db = any`/`io: any` (refactor de tipos à parte).
- Checks: `typecheck` OK; `test:session-freeze` 10/10; `audit:socketio` 0 erros (97 warnings pré-existentes).

## coachDismissalHelpers — follow-ups: escritas esperadas + tipos (2026-09-26)
- Escritas `game.db.run/all` fire-and-forget → `await execQuiet` (usa o `runExec` de `coreHelpers`, sem código novo de promisificação). Ordem garantida antes do `saveGameState`; `mySquad` passa a `runAll` com `try/catch`.
- Decisão de segurança: `unhandledRejection` faz `fatalShutdown`, por isso `execQuiet` regista `warn` em vez de propagar — um `SQLITE_BUSY` transitório não pode matar o servidor. Semântica de falha igual à anterior, mas visível.
- Tipos: `Db = any` → interface estrutural mínima (sem `@types/sqlite3`); `io`/`toSocket` com os tipos que o `socket.io` já traz. Zero dependências novas.
- Checks: `typecheck` OK; `test:session-freeze` 10/10; `audit:socketio` 0 erros.

## roomStateHelpers — sem conversão para await (2026-09-26)
- Pedido: aplicar o padrão `execQuiet` ao ficheiro. Investigação concluiu que NÃO se aplica: `persistSeat` é chamado em 14 sítios síncronos (5 ficheiros, hot paths de socket) e o ficheiro declara-se "best-effort" por desenho — o driver sqlite serializa por ordem e a janela de crash é coberta por snapshot+replay (`docs/CRASH.md`). Await total seria ripple sem ganho real.
- Feito em vez disso: os dois únicos callbacks silenciosos (`deleteSeat`, `clearMatchCheckpoint`) passam a registar erro como os irmãos (`persistSeat`, `appendRoomEvent`).
- Checks: `typecheck` OK; `test:session-freeze` 10/10.

## FinancesTab — review aplicada + layout desktop (2026-09-26)
- Review 6.5/10 código, 7.5/10 UX → correções todas aplicadas.
- Desktop: uma única grid `lg:grid-cols-6` — gráfico (span 4) + Controlo (span 2) em cima, Receitas/Despesas 50/50 por baixo; phone mantém ordem original via `order-*`. Wrapper `max-w-3xl` do gráfico removido (o span-4 nunca fica demasiado largo).
- `ExpandableRow` local (a11y: `role=button`, `tabIndex`, Enter/Espaço, `aria-expanded`) substitui as 3 rubricas expansíveis e a duplicação do "Bilheteiras" (fallback sem breakdown = `onToggle=null`). 821 → ~800 linhas.
- Constantes: `14`→`SEASON_JORNADAS`; "500K"→`LOAN_STEP/1000`; "1,5%"→`LOAN_INTEREST_RATE` (`interestPct`); Folha/Juros usam `weeksElapsed` (coerente com os totais); `key={i}`→chave composta; `title` redundante da barra segmentada removido.
- Pré-existente (não mexido): eixo Y mostra "undefined" com dados mock do harness (ponto sem `matchweek`); clipping do "jornadas concluídas" no hero do harness é artefato da fonte de ícones não carregada.
- Checks: eslint limpo no ficheiro (2 erros pré-existentes noutros); `check:types` OK; mobile portrait 160/160 + landscape 192/192 PASS; harness `finances-resp-test` 390 + 1023 + 1280 PASS, screenshots vistos.

## Migração v4 — agressividade e moral de equipa em 1–50 (2026-09-26)
- Pedido: fim da "salada de escalas" — unificar agressividade (1–5) e moral de equipa (0–100) na escala 1–50 dos atributos. Estrelas 0–10 mantêm-se (modelo de ratings à parte).
- Mapeamento: agressividade ×10 (1→10 … 5→50, âncora 3→30; strings de tiers/aliases → 10–50); moral ÷2 (neutro 50→25; NULL/50→25; <1→1; >50→ROUND(÷2) clamp 1–50).
- Migração v4 em `gameManager.ts` no arranque de cada sala, **idempotente via marcador `scale_v4` em `game_state`** — a prova sintética apanhou o defeito do padrão "só por valores" (moral 100→50 seria re-aliciado a 25 numa 2.ª passagem); o marcador resolve.
- Parâmetros preservam os efeitos: `cardAggPerPoint` 0.1→0.01 (âncora 30); `moraleAttackPerPoint` 0.002→0.004 / `moraleDefensePerPoint` 0.001→0.002 (±10% ataque / ±5% defesa em torno de 25); deltas de resultado 25/−20/5 → 12/−10/2; upset Taça `MIN(30, divDiff*10)` → `MIN(15, divDiff*5)`.
- Servidor: `gameConstants.ts`, `engine.ts` (cartões, decaimento/updates de moral, defaults `?? 25`), `matchCalculations.ts` (`getAggressivenessValue` com guard ×10 para restos 1–5), `playerUtils.ts` (juniores 3→30), `auctionHelpers.ts`, `matchSummaryHelpers.ts`, `cupFlowHelpers.ts` (reset de época 50→25), `gameManager.ts` (defaults schema, backfills, migração), `seed.js` (`randomAggressiveness` 10–50), `schema.sql`.
- Cliente: `utils/morale.js` (limiares antigos ÷2: 8/15/23/30/38/45), `utils/playerHelpers.js` (`aggLabel` com `value/10`), `ClubTab`/`TacticsView` (defaults `?? 25`, largura de barra `morale*2`), `briefingViewModel.js` (`?? 25`), `PlayerHistoryModal` (SkillBar `maxValue={50}`).
- `fans_mood` (0–100) fora do âmbito — mantido.
- Checks: `typecheck` OK; `eslint` OK nos tocados (2 erros pré-existentes em ficheiros não tocados); `check:types` OK. Prova sintética node:sqlite (17 valores de agressividade + 7 de moral, 2.ª passagem no-op) PASS. Sala real `game_TST148` copiada → migrada → `audit:gamestate V4AUDIT` 0 erros/0 warnings; `audit:socketio` 0 erros (97 warnings pré-existentes, nenhum em morale/aggressiveness).
- Versão → `v26.09.5`.

## Gestão de contratos & leilões — correções P0+P1 (2026-09-26)
- Auditoria ao trio `contractHelpers`/`auctionHelpers`/`npcTransferHelpers` → 6 correções, 4 commits.
- P0.1+P0.2 (`fcd3771d`): orçamento do vencedor de leilão passa a ser revalidado no fecho (percorre lances desc, vende ao 1.º com orçamento real, senão "não vendido"); dinheiro+transferência numa transação (padrão `runExec` BEGIN/COMMIT de `socketTransferHandlers`); `finalizeAuction` reescrito em async/await, nunca rejeita (wrapper catch).
- P0.3 (`050f14de`): `listPlayerOnMarket` rejeita listagem (leilão E fixa) de jogador com lock de agente — fechava bypass de compra humana por listagem; check no finalize mantido como rede (NPC wage-cut usa `startAuction` direto, não afetado).
- P0.4 (`5b0e400d`): contagens de necessidades NPC (renovação por posição, `hasModerateNeed`) filtram `id > 0` — juniores mascaravam carências.
- P1.5 (`f8fa240c`): `CONTRACT_REQUEST_RESET_SQL` (era duplicado em 6 UPDATEs) + helper `currentHighBidOf` (era duplicado 4×, um emitia -1 sem lances).
- P1.6 (`969017e2`): regras inline → constantes em `gameConstants.ts` (`AGENT_RENEGOTIATION_WAGE_FLOOR`, `NPC_RENEW_MIN_BUDGET`, `AUCTION_PRICE_FLOOR_*`, `NPC_LIST_SQUAD_THRESHOLDS`); fórmula de preço ex-clube extraída para `exClubAuctionPrice`.
- Segue fora de âmbito: `gameManager.ts` tem merge inline do finalize no crash-recovery SEM revalidação de orçamento nem lock cedo (mesma classe dos P0.1/0.3); `npcListings` NPC pode listar juniores (query sem `id>0`); cap `squad >= 24` inclui juniores. `makeTransferProposal` (97 warnings) é pré-existente.
- Checks: `typecheck` OK; `test:connect-smoke` OK (após P0.1+0.2, P0.3, P1.5, P1.6); `audit:gamestate TST148` 0/0; `audit:socketio` 0 erros (97 warnings pré-existentes).

## BalanceLineChart — "undefined" no eixo (2026-09-26)
- Causa real: fixture do `finances-resp-test.jsx` usava `jornada` em vez de `matchweek` (contrato do chart é `{x, matchweek, balance, label}`; produção envia sempre assim — `socketSessionHandlers.ts`). `px(p)`→undefined → NaN → dots colapsados em x=0 e rótulo "Jundefined".
- Fix: fixture corrigido + guard no `clean` do chart (`Number.isFinite(px(p))`) — dados malformados caem fora em vez de renderizar lixo; `px` movido para antes do filtro (TDZ).
- Checks: eslint + `check:types` OK; harness finances portrait 390 + landscape 6/6 + desktop 1280 PASS; screenshot 1280 confirma linha/área/rótulos corretos.

## Página de Leilões — filtros em chips + contexto temporal (2026-09-26)
- `AuctionsPage.jsx`: select de posição discreto → chips `TabBar` (padrão PlayersTab) com contagem por posição (`Todas · N`, `GR · N`, …); Recentes ordenados por `closedMatchweek` desc (defesa — ordem do servidor é de inserção); `(teams || [])` removido (`teams` é sempre array no GameContext; `teamInfo?.budget || 0` mantido — `teamInfo` pode ser `undefined` antes de `me` chegar).
- `playerHelpers.js`: `POSITIONS = ["GR","DEF","MED","ATA"]` exportado (fonte única); só o loop do lineup foi migrado — os literais restantes no codebase (PlayersTab `POS_ORDER`, TeamSquadModal/View, TrainingPage) ficam para outro passe.
- `AuctionResultRow.jsx`: mostra "fechou nesta jornada / há N jornada(s)" — usa `closedMatchweek` (game.matchweek no fecho) vs `currentMatchweek` = `matchweekCount + 1` (mapeamento verificado em `useSocketListeners.js`: gameState faz `matchweek - 1`).
- **Adiado (5-B):** `closedAt: Date.now()` no `recentBase` de `auctionHelpers.ts` para mostrar tempo real "terminou há Xh" — 1 linha + persistência do game state, quando se voltar ao leilões.
- Checks: `lint` + `check:types` + `test:mobile` portrait/landscape (a executar neste passe).

## FinancesTab — ponto "Agora" com saldo actual no gráfico (2026-09-26)
- Pedido: comprar jogador → o gráfico mostra a queda imediatamente (sem esperar pelo snapshot semanal).
- `chartData` useMemo no FinancesTab: se `currentBudget` divergir do último snapshot do `balanceHistory`, acrescenta ponto sintético "Agora" (`x = último.x + 1`, `label: "Agora"`, `balance: currentBudget`). Igual → sem ponto (sem ruído flat). Frontend-only; nada persistido; `BalanceLineChart` só é usado aqui.
- Snapshot de fim de semana (`team_balance_history`) fica preservado no ponto anterior.
- Checks: eslint + `check:types` OK; harness finances portrait 390/1280 + landscape 6/6 PASS; screenshot 1280 confirma o ponto "Agora" e VARIAÇÃO coerente.

## Contratos & leilões — crash-recovery endurecido + juniores efémeros (2026-09-26)
- `gameManager.ts` (restauro de leilões pós-crash): o merge inline do finalize ganhou as mesmas garantias do `auctionHelpers.finalizeAuction` — revalidação de orçamento por ordem de lance desc, lock do agente respeitado, dinheiro+transferência em transação (`runExec` BEGIN/COMMIT/ROLLBACK), close-unsold com `pushRecent` e nunca rejeita (`catch` no IIFE). Commit `3f6fb6fa`.
- **Juniores são efémeros (só em memória)**: `generateJuniorGR` (playerUtils) usa IDs negativos e nunca são INSERTed — a única inserção de players no server é o prospeto da academia. Logo os achados "NPC lista juniores" e "cap squad ≥ 24 inclui juniores" eram **falsos positivos** (queries à BD nunca devolvem juniores). Os filtros `id > 0` do P0.4 (`5b0e400d`) ficam como defesa passiva, não como fix real.
- Checks: `typecheck` OK; `CRASHTEST_ROOM=TST148 npm run test:crash-recovery` — todos os cenários PASS; `test:connect-smoke` OK; `audit:socketio` 0 erros.

## Scout — lance inline de leilão + filtros colapsáveis (2026-09-26)
- Filtros avançados (skill/idade/preço/estado/ordenar) colapsados via `<details>/<summary>` nativo (sem estado JS); nome/posição/divisão/checkboxes/Pesquisar ficam sempre visíveis. Commit `a7afb16a`.
- "Licitar" na pesquisa deixou de navegar para a tab de leilões: `AuctionBidModal` inline na scout.
  - Servidor: payload da pesquisa anexa estado ao vivo do leilão para `transfer_status='auction'` (`auction_starting_price`/`auction_high_bid`/`auction_high_bid_team_id`/`auction_paused`) via `currentHighBidOf(auction)` — agora exportado de `auctionHelpers.ts`; mesma fonte de verdade que `serializeActiveAuctions`.
  - Client: form de lance extraído do `AuctionCard` para `components/auctions/BidForm.jsx` (validação mín/orçamento + `emitComAck` anti-duplicado num só sítio); `AuctionCard` consome-o (−93 linhas).
  - Sem snapshot de leilão (pesquisa velha/fechado) ou `paused`: fallback "Abrir leilões" (openAuctionBid) / aviso de pausa.
- Nota: lance vencedor num leilão onde já se lidera é bloqueado? Não — AuctionCard esconde o form a quem lidera; o modal da scout mostra "tu lideras" mas permite sobre-lance (servidor valida). Diferença consciente, coerente com "modal = lance manual".
- WIP paralela noutra sessão tocou os mesmos ficheiros de constantes/imports — commits separados (`a7afb16a`, `1dbb12e2`) contêm só as mudanças da scout; ao fundir, confirmar que `POSITION_ACCENT_HEX`/`isSameTeamId` continuam nos paths usados.
- Checks: server typecheck + audit:socketio (0 erros, 97 warnings pré-existentes) + test:connect-smoke OK; client lint (2 erros pré-existentes) + check:types + JSDoc OK; test:mobile portrait 160/160 e landscape 12/12 (com `--concurrency 2` — a 10 dá flake ERR_CONNECTION_REFUSED com dev server paralelo).

## TransferHub — correções código + UX (2026-09-26)
- `TransferHub.jsx` (único ficheiro): `calendarIndex` elevado ao pai (1 subscrição em vez de N), `fmt` local → `formatCurrency`, `MarketCard` em `memo`.
- Ramo-morto de leilão apagado (Hipótese A): `visible` exclui `auction`, por isso `isAuction/isMyAuction/onBid/Licitar` nunca corriam; prop `openAuctionBid` removida (GameRoutes continua a passá-la — inofensiva).
- Acessibilidade: wrapper `div role="button"` → `article`; detalhes abrem só no botão do nome (teclado incluído, sem interativos aninhados).
- Forma sem emojis (só número + cor semântica; `BadgeSkills` completo duplicaria skill/RES já visíveis).
- UX: orçamento no `meta` do Panel; histórico limitado às últimas 12 com scroll (`max-h-80`).
- Checks: `check:types` OK; `lint` só os 2 erros pré-existentes (confirmado via `git stash`); `test:mobile` portrait 160/160 e landscape 192/192 PASS.

## TransferHub — filtros em chips TabBar (2026-09-26)
- 2.ª ronda: select de posição → `TabBar` (`expand`, padrão `PlayersTab`) com contagens (`Todas · N`, `GR · N`, …); contagens do `marketPairs` do contexto (não filtrado por posição) com as regras da lista (sem leilões + próprios à venda); grelha passa a TabBar full-width + pesquisa (span 2) + ordenação + checkbox.
- Select de ordenação mantido nativo (precedente `PlayersTab`: só posição é TabBar). `POSITIONS` local (o export de `playerHelpers.js` do NOTES não existe nesta árvore).
- Checks: `check:types` OK; `lint` limpo no ficheiro (2 erros pré-existentes noutros); portrait 160/160; landscape `transfer` 6/6 — o FAIL do `briefing` no passe completo foi flake (passa isolado com e sem a mudança; outra sessão edita ficheiros partilhados em paralelo).

## Migração v5 — fans_mood em 1–50 (2026-09-26)
- Pedido: unificar também o mood dos adeptos (ficou 0–100 na v4) na escala 1–50.
- Migração `scale_v5` em `gameManager.ts` (arranque de cada sala, mesmo padrão v4): `NULL→30`, `=50→25`, `<1→1`, `>50→÷2` clamp 1–50; marcador em `game_state`. A faixa ambígua 1–49 fica intacta (senão corria uma sala nova no 1.º load) e re-equilibra sozinha pelo decaimento semanal para a base da divisão — a prova sintética apanhou o defeito simétrico da v4: conversão integral sem guarda corria salas novas (mood 30 → 15).
- Parâmetros preservados (efeitos idênticos, valores ÷2): `fansMoodDefault` 60→30; `fansBaseByDivision` 65/60/55/50/45 → 33/30/28/25/23; deltas 9/-9/2 → 5/-5/1; bónus 1/-3/2/4/-5/5 → 1/-2/1/2/-3/3 (mult. dérbi/taça e taxa de decaimento 0.15 inalterados — multiplicativos/proporcionais); `attendanceDesertMoodMax` 25→13; "noite mágica" ≥85→≥43; entusiasmo `fansMood/100`→`/50` (ratio 0–1 idêntico).
- `cupFlowHelpers` (reset de época) lê `fansBaseByDivision` das constantes — sem改动 próprio. `schema.sql` + `ALTER TABLE` de BDs antigas: default 60→30.
- Cliente: `getFansMoodLabel` (morale.js) limiares 15/30/45/60/75/90 → 8/15/23/30/38/45; `StadiumTab` default 30, limiares 70→35 / 45→23, barra `mood*2`.
- Evidência: typecheck OK; lint/check:types OK (2 erros pré-existentes em ficheiros não tocados); prova sintética 3x (8 casos 0–100 + NULL, 2.ª passagem no-op, sala nova intangível no 1.º load, mood 50 protegido pelo marcador após restart); `audit:gamestate V5AUDIT` 0 erros/0 warnings; `audit:socketio` 0 erros (97 warnings pré-existentes).
- Nota: `constants/index.js` tem WIP de outra sessão (scout/TransferHub) — `APP_VERSION` não foi bumpada neste commit para não arrastar esse WIP.
