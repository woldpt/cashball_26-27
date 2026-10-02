## Deploy v26.10.7 no rick (2026-10-02)
- Desde a v26.10.6: redesign do artigo do Jornal, resync pós-join contra S1 fantasma, filtros «só os meus» (mercado + leilões) e «cabe no saldo» (scout), débitos da semana a negativo/vermelho, hero do estádio sem zoom.
- Push master + tag v26.10.7 publicadas; `docker compose up --build -d` no rick com `backend Healthy`; seed não toca salas.
- Rick fica exatamente na tag; este registo vai em commit local sem push.

## Débitos da semana a negativo e vermelho (2026-10-02)
- Pedido: na notícia das contas da semana, os valores de Débito a negativo e vermelho.
- `JournalTab.jsx` (`WeeklyFinanceTable`): Salários, Manutenção, Juros e Capital marcados como `debit` — valor com sinal negativo (`-X €`, guarda contra `-0 €`) e `text-error`; Rendimento e Saldo como estavam (Saldo já pintava negativo/positivo).
- Checks: `eslint` limpo no ficheiro (3 erros pré-existentes noutros) · `check:types` OK · só `className`/texto → sem `test:mobile`; sem lógica de jogo/sockets → sem audits.

## Filtro «Cabe no saldo» na Scout (2026-10-02)
- Pedido: terceira checkbox ao lado de «Só craques» e «Disponível p/ compra» para filtrar só os jogadores que o saldo cobre.
- Decisões do utilizador: filtro só no cliente (instantâneo, sem nova pesquisa) e nos leilões compara com o lance mínimo atual (igual ao botão Licitar/Sem saldo).
- `ScoutView.jsx`: estado `onlyAffordable` + `filteredResults` (`useMemo`, mesma regra dos botões: `fixed` → preço de lista, `auction` → lance mínimo atual, resto → cláusula `valor × 1.35`); `meta` mostra «N de M» com o filtro ligado e vazio dedicado («Nenhum cabe no teu saldo…»). Só frontend, servidor intocado.
- Checks: `eslint` limpo no ficheiro (3 erros pré-existentes noutros) · `check:types` OK · mesma linha `flex-wrap` existente → sem `test:mobile`; sem lógica de jogo/sockets → sem audits.

## Resync de segurança pós-join contra S1 fantasma (2026-10-02)
- Bug (sala X4Z1BI, após reboot/deploy): entrada manual mostrou Semana 1 com plantel vazio e tática morta, estando a sala em S5; refresh curou. Vilão: a rajada do join (`mySquad` → `gameState`) chegou antes da montagem tardia do `GameProvider` (transição `mode="wait"`), perdeu-se sem listeners, e o `teamAssigned` (cadeia lenta) chegou depois, abriu o jogo e cancelou o retry de 10 s — preso nos defaults (`matchweekCount 0` bloqueia o briefing).
- Fix só-cliente: `joinStateSeenRef` (falso por join: reset em mudança de `me.roomCode` e no rejoin do `onConnect`); `gameState` marca visto; `teamAssigned`/`coachDismissed` emitem `requestResync` (handler de servidor existente, sem loop: a resposta traz `gameState` e o sinal seguinte já não reemite). Toca `GameContext.jsx` + `socket/session.js` + `socket/coach.js` (+32 linhas).
- Checks: `eslint` só os 3 erros pré-existentes · `check:types` OK · `audit:socketio` 0 erros (101 warnings, contagem igual) · sem layout → sem `test:mobile`; sem lógica de jogo → sem `audit:gamestate`.

## Zoom do estádio removido (2026-10-02)
- Pedido: estádio via-se cortado no hero do `StadiumTab`; retirar o zoom.
- `StadiumTab.jsx`: removida a prop `shot="close"` (volta ao `wide` por defeito, sem zoom/crop da bancada).
- Checks: `eslint` limpo nos ficheiros tocados · `check:types` OK · só enquadramento da ilustração → sem `test:mobile`; sem lógica de jogo/sockets → sem audits.

## Filtro "só os meus" nos leilões (2026-10-02)
- Pedido: checkbox como a do mercado no `AuctionsTab` — "os meus" = vendo ou licito (inclui licitações superadas), em curso + recentes.
- `AuctionsTab.jsx`: estado local `showOwnOnly` (como o `positionFilter`); `matchesOwn` via `sellerTeamId`, `auction_bid_history` e `result.buyerTeamId` (recentes não trazem histórico, só o comprador); widgets contam totais, painéis filtram; empty-state sugere desmarcar o filtro.
- Checks: `eslint` limpo no ficheiro · `check:types` OK · 1 controlo na zona de filtros existente → sem `test:mobile`; sem lógica de jogo/sockets → sem audits.

## Label do filtro "só os meus" no mercado (2026-10-02)
- Pedido: a label "Mostrar os meus à venda" passava a "Mostrar só os meus à venda" (a checkbox filtra, não adiciona — o "só" evita a leitura errada).
- `TransferHub.jsx`: só 1 string; nota: o pedido indicava `MarketPanel.jsx`, mas o texto vive no `TransferHub.jsx:549` (o `MarketPanel` só tem Mercado 1X2 + Árbitro).
- Checks: `eslint` limpo no ficheiro · `check:types` OK · só texto → sem `test:mobile`; sem lógica de jogo/sockets → sem audits.

## Redesign do artigo do Jornal (2026-10-02)
- Pedido: notícias feias, botões encostados à margem — polimento para todas, intensidade de redesign mantendo o registo de imprensa.
- `JournalTab.jsx`: coluna de leitura centrada (`max-w-prose`, `px-4`/`sm:px-6`); links de entidades em pílula (`bg-primary/10` + `box-decoration-break:clone`, nunca colam às margens nem partem mal); tabelas centradas (`mx-auto`); manchete maior (`text-2xl`) com links em tinta simples (a pílula em corpo grande virava tijolo — visto em screenshot); zona de ações com mais respiro (`mt-5 pt-4`); cai o `lg:px-6` ad hoc do corpo.
- Checks: `eslint` limpo no ficheiro · `check:types` OK · `test:mobile` só `journal-resp-test` PASS 5/5 + screenshot 390 verificado; sem lógica de jogo/sockets → sem audits.

## Sorteio da Taça com parágrafo antes da tabela (2026-10-02)
- Pedido: no detalhe da notícia do sorteio, um parágrafo a dizer o que nos calhou, só depois a tabela completa (antes era só a tabela seca).
- `JournalTab.jsx`: novo `CupDrawIntro` antes do `CupDrawTable` — ronda (`facts.roundName` ou título), adversário clicável + casa/fora, em jogo o lugar na próxima eliminatória (final, nas meias) e uma linha de favoritismo pela divisão (`teams` já traz `division`); sem jogo próprio (eliminado), genérico da ronda. Só frontend, corpo/snippet inalterados.
- Checks: `eslint` limpo no ficheiro (3 erros pré-existentes noutros) · `check:types` OK · só texto num painel existente → sem `test:mobile`; sem lógica de jogo/sockets → sem audits.

## Renovação com red flag: modal restrito + venda NPC garantida (2026-10-02)
- Pedido (2 pontos): com pedido de renovação pendente, o `PlayerHistoryModal` mostrava 4 botões (renovação manual com salário arbitrário contornava o exigido; venda fixa contornava a decisão forçada); leilão de recusa podia fechar deserto (lances NPC probabilísticos).
- Ponto 1 (`PlayerHistoryModal.jsx` + `GameOverlays.jsx`): se `player.contract_request_pending` (payload fresco do `requestPlayerHistory` a cada abertura), a faixa mostra só **Aceitar renovação** (via `respondContractRequest(id, true, requestedWage)`, = red flag) e **Enviar para leilão** (`(id, false)`); `respondContractRequest` passa do contexto via `GameOverlays` (guarda anti-duplo já lá dentro).
- Ponto 2 (servidor): `sendToAuction` da recusa marca `auction.guaranteed = true` (1 edição cobre os 3 caminhos: `declineContractRequest`, contra-proposta `renewContract`, `acceptCounterOffer` rejeitada); `runFinalizeAuction` sem vencedor + `guaranteed` sintetiza comprador NPC (não-humano, ≠ vendedor, ±2 divisões, orçamento ≥ preço-base, o mais rico) pelo preço-base e o fluxo de venda corre intocado; sem NPC capaz de pagar, mantém o deserto (sem inventar dinheiro); `gameManager.ts` preserva o flag no restore pós-restart (snapshot já o serializava).
- Checks: server `typecheck` OK · client `eslint` limpo nos ficheiros tocados (3 erros pré-existentes noutros) · `check:types` OK · `audit:socketio` 0 erros (101 warnings, baseline) · sem layout novo → sem `test:mobile` · `audit:gamestate` fica para sala viva.

## Tutorial com treinador fixo no centro (2026-10-02)
- Pedido: balão do adjunto sempre no meio do ecrã; só o retângulo de destaque se move.
- `CoachTutorial.jsx`: balão centrado com flex, sem cálculo de posição (saem `BALLOON_W`/`WRAP_W`/`GAP`, `balloon`/`below`, medição de altura e seta para o alvo; rabicho para o retrato fica). Spotlight, scroll até ao alvo, Escape, progresso e `data-tour`/aria-labels inalterados.
- `AssistantCoach.jsx`: prop opcional `compact` no `AssistantMascot` (76px); tutorial rende medalhão compacto só no telemóvel, 108px no desktop.
- Checks: `eslint` limpo nos 2 ficheiros · `check:types` OK · `test:mobile` 175/175 PASS + screenshot da tática vista; nenhuma harness rende o tutorial, por isso a confirmação visual do balão centrado fica para sala viva.

## Adjunto: nome único + dica dos adeptos + dica do teto (2026-10-02)
- Pedido: corrigir 3 pontos da lista do adjunto — nome, adeptos e teto de treino.
- Nome único `Treinador-adjunto`: revertidos os 3 `O Mister` do `AssistantCoach.jsx` (cabeçalho + 2 aria-labels); tutorial já dizia `Treinador-adjunto`.
- Adeptos (`useAssistantCoach.js`): texto sem meme ("precisam de uma vitória. Prepara o onze e vai buscá-la.") e destino `club` → `tactic`, para o CTA "Ganhar já" aterrar onde se ganha.
- Teto (`trainingCapAdvice.js`): volta `A ${focusName} já está no teto — este treino não rende.` + CTA `Mudar foco`; a versão JJ (`Muda o chip, Forma!`) partia o teste (foco em vocativo) — `trainingCapAdvice.test.mjs` volta a passar sem lhe tocar.
- Checks: teste do teto 5/5 OK · `eslint` limpo nos 3 ficheiros · `check:types` OK · só strings + 1 tab de destino → sem `test:mobile`; audits saltam (sem lógica de jogo/sockets).
## Estabilização da Taça F4+F5 — penáltis por eliminatória + reconnect e reset tático (2026-10-02)
- F4: `PenaltyShootoutPopup` com chave por `(round, home-away)` — um 2.º shootout da mesma ronda remonta limpo; log `penáltis a abrir` com nº de cantos.
- F5a (`cupFlowHelpers.ts`, `emitCurrentPhaseToSocket`): reconnect em `match_finalizing` com `cupResultsPayload` pronto também recebe `cupRoundResults` (aditivo, `gameState` segue) — sem replay fantasma de ET acabado.
- F5b: reset tático pós-Taça (11 limpo + Equilibrado) sai do handler de chegada (a meio do replay) para o dreno pós-apito em `GameContext`.
- Checks: server `typecheck` OK · `audit:socketio` 0 erros (101 warnings, contagem igual à F0) · regressão `cupLobbyAdvanceRegression` PASS · client `eslint` só o pré-existente · `check:types` OK.
- `test:finalize` (E2E 12 min, liga) não correu até ao fim — timeout da ferramenta aos 5 min com o servidor do repro a meio; processos do repro limpos, produção intocada. Diff do servidor é só logs + 1 emit aditivo no caminho da Taça (que o repro nem cobre); `audit:gamestate` fica para o ensaio com sala viva.

## Estabilização da Taça F2 — sorteio na fila pós-jogo (2026-10-02)
- `postMatchFlow.js`: o sorteio passa a passo da fila — penáltis → sorteio → despedimento → fim de época; `showWaiting` e `isPostMatchQueueActive` contam com ele. `GameOverlays.jsx` só mostra o `CupDrawPopup` quando a fila o autoriza (o raw continua a bloquear o landing).
- Sem mudança visual quando não há penáltis; com penáltis + sorteio na mesma ronda, o sorteio espera em vez de sobrepor.
- Checks: `eslint` limpo nos 2 ficheiros · `check:types` OK · sem layout novo → sem `test:mobile`.

## Estabilização da Taça F1+F3 — dreno único e fim de relógio único (2026-10-02)
- F1 (`GameContext.jsx`): o dreno do `pendingCupRoundResults` passa a regra explícita — drena se (parado E relógio no fim) OU (parado E nunca viu o jogo); tabela de verdade idêntica, mas o `return` silencioso virou log `cupRoundResults a aguardar dreno` com o motivo (idle/halftime/ação/minuto).
- F3 (`GameContext.jsx`): os 4 ramos de fim de jogo (live/replay × 90'/120') colapsam num `finishClock` único; tempos intactos (2 s aos 120', 3 s aos 90'), ordem de setters intacta, acks continuam no-ops intencionais.
- Checks: `eslint` só o erro pré-existente `react-refresh` · `check:types` OK · sem lógica de jogo/layout → sem audits/mobile.

## Estabilização da Taça F0 — instrumentação das transições (2026-10-02)
- Plano aprovado: estabilizar sorteio→jogo→ET→penáltis→resultados→Jornal. F0 primeiro (só logs, zero lógica), fixes (F1–F5) só após ensaio com evidência.
- Cliente (`utils/cupFlowLog.js` novo, `[CUPFLOW +ms]`): `cupDrawStart` recebido/pendente/aberto, `cupExtraTimeStart` (espectador ou não), `cupRoundResults` recebido + drenado, relógio parado nos 90'/120' (live vs replay), landing → Jornal.
- Servidor (`cupFlowHelpers.ts`): gate de animação do ET regista resolução por acks (ms + nº treinadores) vs timeout integral; `cupRoundResults` regista ronda/ET/nº resultados.
- Checks: server `typecheck` OK · `audit:socketio` 0 erros (101 warnings, sem emits/handlers novos — pré-existentes) · client `eslint` só o erro pré-existente `react-refresh` no `GameContext.jsx` (prova: HEAD já exporta 3 símbolos; diff só adiciona linhas) · `check:types` OK · sem lógica/layout → sem `test:mobile`, sem `audit:gamestate` (sem sala viva; fica para o ensaio).
- Incidente git: `git stash push -- <path> -m ...` comeu as flags como pathspec e o `pop` a seguir aplicou um stash antigo sobre a árvore (conflitos em .db binários). Resolvido a favor da árvore (saves locais de dev; produção no rick intacta). Lição: nunca `stash` para prova de pré-existência — usar `git show HEAD:<path>` + `git diff` em vez disso. Stack de stashes antigas deixada intacta.
- Próximo passo: ensaio com sala viva (pedir roomCode + ronda + nº humanos) e cruzar `[CUPFLOW]` do browser com logs do servidor antes de fixar (F1–F5).

## Espectador vê o prolongamento alheio em ritmo de gala (2026-10-02)
- Pedido: após o jogo da Taça decidido aos 90', o observador ficava a olhar para o minuto 90 durante ~48 s+ (ET escondido de outro jogo + gate de animação em timeout integral) — queria-se ver o ET sem humanos com o relógio acelerado, como no B016.
- Servidor (`server/game/engine.ts`, `simulateExtraTime`): ET só-NPC com humanos ligados passa de 100 ms/min para o ritmo de gala (`CUP_FINAL_SPECTATOR_MS_PER_MINUTE`, 500 ms → ~15 s de ET); 100 ms só quando ninguém está a ver. Tempo real com humano em campo, inalterado.
- Cliente (`client/src/hooks/socket/cup.js`, `cupExtraTimeStart`): quem não está em `drawnTeamIds` segue como espectador (`isCupExtraTime` + badge, relógio 90→120, `isPlayingMatch`, limpa `waitingForResults` da corrida dos 3 s) em vez de `return`. Sidebar «Outros jogos» atualiza em direto; hero do jogo decidido já se escondia sozinho; aos 120' o `cupExtraTimeDone` resolve o gate sem timeout. Sem popup de penáltis para espectadores (só resultado).
- Checks: server `typecheck` OK · `audit:socketio` 0 erros · client `eslint` limpo no ficheiro (3 erros + 1 warning pré-existentes noutros) · `check:types` OK · só fluxo de estado/badge existente → sem `test:mobile`.

## Adjunto fala JJ meme total (2026-10-01)
- Pedido: Treinador-adjunto passa a falar na linguagem meme do Jorge Jesus, intensidade meme total, textos + CTAs + alcunha.
- 7 dicas reescritas em `useAssistantCoach.js` (6) + `trainingCapAdvice.js` (1, mantém interpolação do foco); etiqueta `Treinador-adjunto` → `O Mister` (cabeçalho + aria-labels) em `AssistantCoach.jsx`. Só strings, zero lógica/tabs/keys.
- Checks: `eslint` limpo nos 3 ficheiros · `check:types` OK · só texto → sem `test:mobile`; audits saltam (sem lógica de jogo/sockets).

## Deploy v26.10.5 no rick (2026-10-01)
- Tag `v26.10.5` (bump de `APP_VERSION` em `client/src/constants/index.js`); rebuild com `backend Healthy`.
- Inclui: adjunto JJ de braços cruzados (`mister.webp` servido, bundle novo a referenciá-lo).
- Salas de produção intactas; seed só recria `base.db` se o esquema/fixtures mudarem.

## Adjunto passa a JJ de braços cruzados (2026-10-01)
- O retrato vetorizado confundia-se com o antigo; o adjunto passa a ser o JJ de braços cruzados (imagem do utilizador).
- Recorte `rembg` (estádio + assinatura `.acho` fora), enquadramento cabeça+ombros, `mister.webp` 512px/52 KB com alfa; SVG seria MBs, ficou raster. `assistant.svg` (206 KB) apagado.
- Checks: `eslint` + `check:types` OK · confirmação visual do medalhão · sem mudança de layout → sem `test:mobile`.

## Deploy v26.10.4 no rick (2026-10-01)
- Tag `v26.10.4` (bump de `APP_VERSION` em `client/src/constants/index.js`); rebuild com `backend Healthy`.
- Inclui: tutorial ensinado pelo adjunto + retrato do adjunto em SVG sem fundo.
- Salas de produção intactas; seed só recria `base.db` se o esquema/fixtures mudarem.

## Retrato do adjunto vetorizado sem fundo (2026-10-01)
- Pedido: retirar a relva do `assistant.webp` e passar a SVG; escolhido o SVG fiel de 16 cores (206 KB).
- Recorte por matiz verde (`PIL/numpy`, cantinho branco do topo incluído) sobre o disco; `vtracer` segfaulta neste ambiente, venci com `imagetracerjs` (12→44 KB preterido, 16 cores vence). SVG só com paths preenchidos, sem `clipPath`/máscaras.
- `AssistantCoach.jsx` (e o tutorial via `AssistantMascot`) passam a `/coaches/assistant.svg`; `.webp` apagado. Fundo do SVG é o verde-escuro do disco — funde-se com o medalhão.
- Checks: `eslint` + `check:types` OK · confirmação visual do medalhão · sem mudança de layout → sem `test:mobile`.

## Tutorial passa para o treinador-adjunto (2026-10-01)
- Pedido: o tutorial passa a ser ensinado pelo adjunto.
- Spotlight, ordem, tabs/alvos, arranque (WelcomeModal conta nova) e «Rever tutorial» inalterados; só o balão ganha a cara do adjunto (medalhão `assistant.webp` + balão com rabicho, etiqueta «Treinador-adjunto · Passo N de 10») e os 10 textos passam à 1.ª pessoa («Mister, eu mostro-te…»).
- `AssistantMascot` exportado de `AssistantCoach.jsx` para reutilização sem duplicar; dicas normais calam-se enquanto `tutorial.active` (`GameLayout` não monta o `AssistantCoach`, sem tocar nos `seenKey` 1x/semana).
- Checks: `eslint` limpo nos ficheiros tocados (3 erros pré-existentes noutros ficheiros) · `check:types` OK · `test:mobile` PASS (175/175).

## Jornal sem S16 por cima de S18 (sorteio transitório) (2026-10-01)
- Bug (sala P9XFLJ, Leça): a linha «Sorteio: Meias-finais» datada de S16 aparecia no topo por cima de notícias S18.
- Causa: transitórios iam todos para o topo sem ordenar por data; o transitório do sorteio leva a data da semana do sorteio e, para equipa já eliminada (Leça caiu na ronda 1 — o espelho `cup_draw` só é gravado a `cupTeamIds`, equipas ainda em prova), nunca chega linha gravada que o esconda (`cupDrawCovered`), por isso envelhecia no topo. Ordem das linhas gravadas verificada correta na BD (slot desc, sem inversões).
- Fix: em `client/src/hooks/useInbox.js`, só `redFlag` fica fixo no topo; o resto (incluindo transitórios com data passada) desce para a posição cronológica via `inboxWeekKey` (`S<semana>/<ano>` → ano * 100 + semana, sort estável).
- Checks: `eslint` limpo no ficheiro · `check:types` OK · prova de semântica em node (redFlag primeiro, resto desc, estável em empate) · mesma lista/componentes, só ordem → sem `test:mobile`.

## Patrocinador atualiza camisola e gráfico sem refresh (2026-10-01)
- Bug (Ano 2 S1): após `chooseSponsor`, o logotipo da camisola e o gráfico de saldo só atualizavam com refresh.
- Causa: o handler `chooseSponsor` (`server/socketSessionHandlers.ts`) só emitia `sponsorState` ao próprio + `globalNewsUpdated` — sem `teamsData` (fonte do `sponsorBrand` do TeamKit e do budget) nem `financeData` (fonte do gráfico e de `sponsorRevenue`).
- Fix: no sucesso do `chooseSponsor`, broadcast de `teamsData` para a sala (via `getTeamsWithCoachNames`, já importado) + `clubNewsUpdated { teamId }`; no cliente (`client/src/hooks/socket/news.js`), `sponsorState` com `chosen` volta a pedir `requestFinanceData` (mesmo padrão do `stadiumBuilt`).
- Checks: server `typecheck` OK · `audit:socketio` 0 erros · client `eslint` + `check:types` OK · sem mudança de layout → sem `test:mobile`.

## Final da Taça em harmonia com os match heros (2026-10-01)
- Pedido: `CupFinalStage.jsx` destoava dos outros heros — sem camisolas nem logotipos de fundo; manter a taça, agora ao centro (SVG da Taça de Portugal).
- Frente-a-frente passa a usar o `ScoreKit` do `LiveMatchHero` (camisola `TeamKit` + badge do treinador, fallback para `TeamCrest`; fora veste alterna via `useKitClash`) em vez do `TeamCrest` rodado; nomes dos treinadores vivem no badge, como no hero.
- Fundo com marcas de água dos emblemas laterais iguais às do `LiveMatchHero`; troféu-emoji de canto removido, Taça em SVG (`client/public/trophies/taca-portugal.svg`, da Wikimedia Commons) centrada atrás do marcador com brilho dourado.
- `ScoreKit` exportado do `LiveMatchHero.jsx` (1 palavra) para reutilização sem duplicar.
- Checks: `lint` limpo nos ficheiros tocados (3 erros + 1 warning pré-existentes noutros ficheiros) · `check:types` OK · `test:mobile` PASS (175/175).

## Deploy v26.10.3 no rick (2026-10-01)
- Tag `v26.10.3` (bump de `APP_VERSION` em `client/src/constants/index.js`); rebuild com `backend Healthy`.
- Inclui: dica do adjunto sobre teto de treino (Forma/Resistência) + testes `trainingCapAdvice`.
- Salas de produção intactas; seed só recria `base.db` se o esquema/fixtures mudarem.

## Adjunto avisa quando o treino bate no teto (Forma/Resistência) (2026-10-01)
- Pedido: o JJ deve avisar quando o treino já chegou ao limiar e os jogadores não avançam (Forma e Resistência).
- Factos do motor (`server/trainingHelpers.ts`, `gameConstants.ts`): Forma +6/semana até `FORM_MAX=50`, Resistência +4.9/semana até `RES_MAX=50` — bónus só para quem jogou; no teto o ganho é zero e o acumulador de resistência é zerado, ou seja, continuar nesse foco perde a semana.
- Decisão do utilizador: avisa com **≥70% do plantel no teto**, **1x por semana** até o foco mudar (usa a chave semanal normal — a dica extingue-se sozinha quando trocas de foco).
- Implementação: util puro novo `client/src/utils/trainingCapAdvice.js` (foco → campo/teto) + dica `trainingcap` no `useAssistantCoach.js`, logo a seguir à do «foco não definido» e antes da enfermaria. Foco ativo lido do `localStorage` (caminho rápido) com o fallback de BD que já existia; foco de skill ou desconhecido nunca avisa.
- Constantes novas em `client/src/constants/index.js` a espelhar o servidor (`FORM_MAX`/`RES_MAX`) + `TRAINING_CAP_TARGETS` e `TRAINING_CAP_SQUAD_RATIO` (limiar num só sítio).
- Checks: `npm run test:trainingcap` (novo, 5 grupos de asserções) PASS · `lint` limpo nos ficheiros tocados · `check:types` OK · sem mudança de layout → sem `test:mobile`.


## Contratos em semanas, não jornadas (2026-10-01)
- Pedido: duração/fim do contrato aparecia em jornadas; passa a semanas.
- Fix: `contractWeekLabel(slot)` → `Semana N` (server `coreHelpers.ts` + client `utils/slotLabel.js`); `contractEndInfo()` devolve `slot` + `label: Semana N`; renomeado `CONTRACT_LENGTH_MATCHWEEKS` → `CONTRACT_LENGTH_WEEKS` (alias antigo mantido), `contractEndMatchweek` → `contractEndSlot` no fio (cliente aceita o antigo em fallback); mensagens de bloqueio de leilão usam `end.label`; fallback `Jornada ${n}` no `market.js` e variáveis no `PlayerHistoryModal.jsx`/`helpers.js` atualizados.
- Checks: server `typecheck` OK · client `eslint` limpo nos ficheiros tocados (3 erros pré-existentes noutros ficheiros) · `check:types` OK · sem mudança de layout → sem `test:mobile`.

## Adjunto com cara nova e a falar (2026-10-02)
- Pedido: converter a caricatura `docs/jj.png` (2 poses: boca fechada/aberta) num avatar que simula fala, espelhado (a olhar para a direita dele), maior em desktop, a substituir o avatar anterior do Treinador Adjunto.
- Descobertas: o `jj.png` (1536×1024, RGB) traz o xadrez cozido (sem alfa) — corte limpo ao meio (x=768); o avatar anterior era `/coaches/mister.webp` (512×512 com alfa) no `AssistantMascot` (`AssistantCoach.jsx`, também usado no `CoachTutorial.jsx`).
- Decisões do utilizador: reutilizar o PNG (não vetorizar) · recorte apertado (não remoção de fundo) · loop da boca enquanto a dica está visível.
- Implementação: `client/public/coaches/jj-fechada.webp` + `jj-aberta.webp` (metades 768×1024 → quadrado 668×668 cabeça+ombros → espelhar → 512×512, ~25KB cada); `AssistantMascot` sobrepõe as duas (aberta em `absolute` com `opacity`) e alterna a cada 420ms, parado em boca fechada com `prefers-reduced-motion`; desktop 108px → 132px (`lg:`); `mister.webp` fica no disco mas sem referências.
- Checks: `eslint` limpo no ficheiro · `check:types` OK · mudança só no breakpoint `lg` (mobile portrait se alterado) → sem `test:mobile`.

## Balões do adjunto com máquina de escrever (2026-10-02)
- Pedido: efeito de máquina de escrever no texto dos balões (dica + tutorial); 1.º clique a meio completa o texto, 2.º dispensa.
- Implementação: hook novo `client/src/hooks/useTypewriter.js` (letra/18ms, recomeça ao mudar o texto, `complete()` revela tudo, `prefers-reduced-motion` devolve tudo de imediato; cadeia de `setTimeout` para cumprir a regra `set-state-in-effect` do eslint).
- `AssistantCoachView`: 1.º clique completa, 2.º dispensa; parágrafo digitado com `aria-hidden` (texto integral já no `aria-label`, evita spam do `aria-live`); CTA/X/2.º clique mantêm o comportamento. `CoachTutorial`: digita `step.text` (título e botões estáticos), texto integral no `aria-label`; cursor `▌` com `animate-pulse` em ambos.
- Checks: `eslint` limpo nos 3 ficheiros · `check:types` OK · overlay sem mudança estrutural → sem `test:mobile`.

## Boneco entra/sai de baixo em fases (2026-10-02)
- Pedido: o boneco surge de baixo e esconde-se para baixo; o balão só surge quando o boneco chega e desaparece primeiro; tutorial entra/sai 1x (sem animar entre passos), com movimento ao Saltar/Concluir.
- Implementação: `AssistantCoachView` separa boneco e balão em dois `motion.div` (boneco `y:120%→0` 0,3s, `exit` atrasado 0,15s; balão entra com atraso 0,3s e sai só em opacidade 0,15s); `AssistantCoach` envolve a dica em `AnimatePresence` (chave `tip.id` na vista). `CoachTutorial` com raiz `motion.div` (entra/sai `y:120`+opacidade 1x) e `AnimatePresence` no `GameLayout.jsx`; `reduced-motion` mantém tudo estático.
- Checks: `eslint` limpo nos 3 ficheiros · `check:types` OK · só animação (DOM/classes iguais) → sem `test:mobile`.

## Dica do 11 só após inatividade (2026-10-02)
- Pedido: a frase do onze por fechar não aparece logo no início da semana (maçador); só com a janela aberta e parada 1–2 min.
- Implementação: hook novo `client/src/hooks/useIdle.js` (qualquer rato/toque/tecla/scroll rearma; `true` após `LINEUP_IDLE_MS = 90_000`); `useAssistantCoach.js` só candidata `lineup` com `lineupIdle`. Trava `shown` 1x/semana depois de aparecer (senão escondia-se ao ir clicar no CTA) e rearma ao fechar o 11 ou mudar de semana; resto das dicas imediato como antes.
- Checks: `eslint` limpo nos 2 ficheiros · `check:types` OK · sem mudança visual/estrutural → sem `test:mobile`.

## Deploy v26.10.6 no rick (2026-10-02)
- Tag `v26.10.6` (APP_VERSION já estava em `v26.10.6`, sem commit de bump); rebuild com `backend Healthy`.
- Inclui: adjunto com caricatura JJ a falar (boca em loop, medalhão maior em desktop) + máquina de escrever nos balões + entrada/saída faseada de baixo + dica do 11 só após 90s de inatividade.
- Salas de produção intactas; seed só recria `base.db` se o esquema/fixtures mudarem.

## Adjunto sem círculo, fundo transparente (2026-10-02)
- Pedido: boneco sem o círculo verde, com fundo transparente.
- Implementação: fundo xadrez removido por inundação a partir das bordas (limiar >=225, contornos pretos fechados protegem olhos/dentes/brilhos; penugem 0.6px) e busto a 93% em tela transparente — `jj-fechada.webp`/`jj-aberta.webp` regenerados com alfa (~30KB); `AssistantMascot` sem disco/argolas, busto a encher a caixa com `drop-shadow` (acumula com o filtro `sad`); tutorial herda por partilhar o componente.
- Checks: `eslint` limpo · `check:types` OK · mesma caixa, só estilo → sem `test:mobile`.
