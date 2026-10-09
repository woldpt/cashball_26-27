## Deploy v26.10.37 no rick (2026-10-09)
Push, tag e rebuild feitos; backend Healthy.
Inclui os últimos commits do master (odds, PAUSA, jornal, amigáveis).

## Transição do PAUSA no marcador (2026-10-09)
- `LiveMatchHero.jsx`: ao passar o rato, o resultado esbate/encolhe e o "PAUSA" sobe com brilho (300ms; só esbater com movimento reduzido), em vez de trocar de repente.
- Testado: lint, check:types.

## Jornal: castigo duplicado e leitor com altura fixa (2026-10-09)
- Amarelo + vermelho do mesmo jogador na mesma semana davam 2 notícias (sala TVV6WB): `logMedicalNews` atualiza a linha existente para o castigo mais longo e o cliente (`newsRowsToItems`) mostra só o mais longo (limpa também as já duplicadas). Leitor do Jornal: sem rodapé Recente/Antiga/Ler próxima, cartão com altura da área livre e scroll interno (só desktop).
- Testado: server typecheck, client lint + check:types, test:mobile (195/195).

## Mini classificação do cabeçalho (2026-10-09)
- Tirado o scroll da lista e adicionado crachá âmbar com o nome do treinador humano ("TU" na própria linha), como na `LiveStandings`. Plano em `docs/plans/2026-10-09-mini-classificacao.md`.
- Testado: lint, check:types.

## Tática: aviso e Força do onze (2026-10-09)
- Aviso "Faltam: 11 titulares…" passou para debaixo das Formações (e aparece também no telemóvel); Força do onze estica até à altura da linha de topo, por cima do campo.
- Testado: lint, check:types, test:mobile (195/195).

## Guardas financeiras 2 (2026-10-09)
- Re-auditoria → `docs/plans/2026-10-09-guardas-financas-2.md`: patrocínio perfil B já não conta a época inteira como receita; clube sem treinador humano escolhe patrocinador sozinho na renda semanal; empréstimos/investimento NPC/crédito NPC de patrocínio passam pela fila da sala; erros de escrita dos prémios da Taça fazem ROLLBACK; leilão restaurado fecha pelo caminho único (`auctionHooks`) com guarda de dono e saldo; renda relê o marcador na fila; Finanças mostram amigáveis 50/50.
- Por decidir (não mexido): lances ao sair da sala, cláusula sobre jogador sem clube, marca de patrocinador duplicada em cliques simultâneos (cosmético).
- Testado: `test:finance-guards` (F7–F11 novos, cada um falha sem a correção), typecheck, crash-recovery, topscorer, staff, sponsor, room-tx, connect-smoke, npc-bid-window, finalize, `audit:gamestate` (4 verificações novas, sala local 0 erros), client lint + check:types.

## Guardas financeiras contra pagamentos duplos (2026-10-09)
- Auditoria (`docs/plans/2026-10-09-auditoria-financas-economia.md`) → plano `2026-10-09-guardas-financas.md`, aplicado todo: leilão já pago não volta a pagar após reinício (guarda `transfer_status='auction'` + `saveGameState` no fecho), `chooseSponsor`/`fireStaff` sem duplo crédito, `buyPlayer` só listagem fixa e com `budget >= ?`, compras NPC numa transação na fila da sala, prémios de fim de época atómicos com o marcador.
- Pontas: renda semanal não cobra se o marcador não se lê; teto de empréstimo 2,5M real (+ botão); lances do treinador despedido retirados; `audit:gamestate` com 4 verificações novas.
- Testado: novo `test:finance-guards` (F1–F6, cada um falha no código antigo), typecheck, crash-recovery, topscorer, sponsor, staff, connect-smoke, npc-bid-window, room-tx, testes de despedimento, finalize E2E; client lint + check:types.

## Camisola do adversário sem patrocinador (2026-10-09)
- Bug: no Briefing o logótipo do patrocinador aparecia na nossa camisola mas não na do adversário, porque o resumo do adversário (`buildOpponentSummary` em `matchSummaryHelpers.ts`) não levava `sponsorBrand`.
- Fix: `withSponsorBrand` (coreHelpers.ts, agora exportada) aplicado ao adversário; cobre liga e taça.
- Testado: server `typecheck` OK. Visual no briefing por confirmar após reiniciar o servidor.

## Lances dos NPCs só na janela final do leilão (2026-10-09)
- Antes: NPCs licitavam 2–18 s após cada lance (rajadas no início), com valor fixo que muitas vezes já não passava o mínimo (rejeição silenciosa). Agora: entram numa fila por leilão, só nos últimos 30 s, com 6–10 s entre lances de NPCs; o lance é recalculado (preço atual + 10 000 €) quando sai, e desiste se não couber no limite.
- Constantes em `gameConstants.ts` (`AUCTION_NPC_*`); `npcTransferHelpers.ts` (`pumpNpcQueue`/`releaseNpcBid`); plano `docs/plans/2026-10-09-lances-npc-janela-final.md`.
- Testado: typecheck, `test:npc-bid-window` (5/5), connect-smoke, audit:socketio (registo inalterado), audit:gamestate numa sala local (0 erros). Simulação com dados reais de PYG2GT: preço mediano 1,04 (real 1,09; antes 1,58).

## Vento mais realista (2026-10-09)
- Rajadas (`WeatherOverlay.jsx` + `wx-blow`): comprimento, inclinação e intensidade próprios, trajetória com ondulação; faixas de luz a deslizar pelo relvado (`.wx-vento`, só com movimento). Estádio (`StadiumIllustration.jsx`): bandeiras a bater com vento em qualquer mood; nuvens a deslizar (cópia para o ciclo não saltar).
- Porquê: as rajadas eram riscos retos e iguais, e nada no estádio reagia ao vento.
- Testado: client `lint`, `check:types`, `test:stadium`, `test:weather` e `test:mobile stadium-resp-test` (PASS nos 5 widths; aviso de consola `resErr` variável também no HEAD). Captura antes/depois do Chromium; movimento das nuvens e bandeiras só verificado pelo CSS, não numa captura em vídeo.

## Versão do build na barra lateral (2026-10-09)
- `Sidebar.jsx`: `APP_VERSION` no fundo da barra (`text-outline-variant`, 10px); escondida com a barra encolhida (não cabe em 3.5rem).
- Porquê: ver a versão em uso sem ir à página de entrada.
- Testado: client `lint` e `check:types` (saída 0). Visual no ecrã de desktop por confirmar.

## Deploy v26.10.36 no rick (2026-10-09)
- Contenção de crashes e sessão/convites, varrimento pt-PT e equipa de agentes (desde v26.10.35); `backend Healthy`.

## Equipa de agentes + varrimento pt-PT (2026-10-09)
- Equipa removida no mesmo dia (gastava créditos demais); fica só o atalho `.claude/skills`.
- Equipa no Claude Code: orquestrador/revisor (Opus), `coder` (Sonnet), `scout` e `ops` (Haiku) em `.claude/agents/`; `.claude/skills` → `.pi/skills`; `CLAUDE.md` importa `AGENTS.md`.
- Varrimento pt-PT (scout → coder → revisão): «Técnicos»→«Treinadores», coluna «Gol»→«Golos», narração sem «marcar contra»/«sacou o cartão»; mensagens de testes sem «placares»/«chute».
- Testado: server typecheck + test:engine-unit + test:own-goal; client check:types; lint só com o erro antigo do `landing-resp-test.jsx`.

## Contenção de "buracos negros" (2026-10-08)
- Linhas de `matches` da liga passam a ser gravadas na transação do fecho (com classificação + marker 'finalized', `leagueMatchRowWrites`); `persistMatchResults` fica só com forma/notas/MOM/rescaldo.
- `socket.on` envolvido por ligação (index.ts): erro/rejeição num handler é registado e não chega ao `fatalShutdown`.
- `cacheVersion.js` preserva todas as chaves com prefixo `cashball` (lista fixa esquecia chaves novas).
- Testado: novo S6b em `test:crash-recovery` (falha sem a correção), typecheck, connect-smoke, session-freeze, segment-barrier, lint, check:types.

## FARMACIA3: jornada perdida + logout no telemóvel (2026-10-08)
- Crash: `setTactic` de um socket sem sala → `getPlayerBySocket(null)` → `fatalShutdown` fechou a BD a meio do `persistMatchResults` (época 2, J1 sem linhas em `matches`; classificação OK). Guarda de `null` na função partilhada.
- Logout: `cacheVersion.js` (versão = arranque do servidor) fazia `localStorage.clear()` sem preservar `cashball_auth/rooms/device` — cada restart deslogava no reload seguinte.
- `DELETE FROM matches` do replay passa a filtrar `season`. Testado: typecheck, connect-smoke, lint, check:types.

## Consistência de estado no frontend (2026-10-08)
- Limpar a tática mantém a formação; contagens ignoram ids fora do plantel; subs voltam do servidor após reload ao intervalo; plantel/finanças/standings emitidos em ordem; reconexão em lobby limpa o resultado parcial; leilão reaberto, lance offline, Pronto com patrocinador, tabs e guardas de sala; estado de leilão legado removido. Plano: `docs/plans/2026-10-08-consistencia-estado-frontend.md`.
- Porquê: o que o cliente mostrava/enviava divergia do servidor (11 que nunca chegava, subs a mais, plantel com segundos de atraso).
- Testado: client `lint` (só o `landing-resp-test.jsx`, já falhava) + `check:types` + `test:tacticpositions` (novo) + `build`; server `typecheck` + `test:finalize` + `audit:socketio`. Reload/rede/Taça por testar à mão.

## Robustez de sessão/presença (2026-10-07)
- Lease começa na queda do socket; janelas de decisão nunca decidem `auto` por quem só tem lease; join passivo (separador oculto) não rouba o assento; `presencePing` + gate de join no cliente; contra-proposta/convite sobrevivem à queda. Plano: `docs/plans/2026-10-07-sessao-presenca-mobile.md`.
- Porquê: bloqueios de ecrã do telemóvel congelavam/descongelavam a sala e a lista `players` tratava a equipa como NPC.
- Testado: `test:session-freeze` (novos F13–F15), `test:segment-barrier`, `test:connect-smoke`, `test:crash-recovery`, typecheck, lint, check:types. Telemóvel real com bloqueio de ecrã por testar.

## RoomHub + WaitingCoachesModal — redesign (2026-10-06)
- RoomHub: bugs (mensagem perdida no gap, convites presos, kick sem confirmação), mensagens agrupadas + sistema intercalado + scroll inteligente, split (`RoomHub` casca + `RoomHubPanel` só aberto, `CoachRow`, `ChatMessages`, `ChatComposer`, `useRoomInvites`), layout novo (cabeçalho único, folha inferior no mobile). `chatMessagesRef` saiu do GameContext.
- WaitingCoachesModal: hero "À espera de X" + barra segmentada, banner de pausa com coaches offline, reutiliza `ChatMessages`/`ChatComposer`. Planos em `docs/plans/2026-10-06-*`.
- Testado: lint, check:types, build; harnesses `roomhub-resp-test` e `waiting-coaches-test` PASS em 375×667, 667×375, 768×1024, 1280×800 + capturas revistas (lista de coaches do modal subiu a 40 % da altura no mobile). Fluxo real com 2 sessões por testar.

## Redesign Ficha do jogador · Perfil de clube (2026-10-06)
- Ficha: cabeçalho tipo carta (cores do clube, skills no topo), faixa Valor/Ordenado/Contrato/Nota, desempenho em mosaicos, prémios em medalhas, transferências em linha do tempo. Gráfico da skill novo (área, crosshair + tooltip, setas no teclado, tabela para leitores de ecrã). Perfil de clube: chips no cabeçalho, próximo jogo em "duelo", resultado em pastilha colorida, top 3 com medalhas, Clube em mosaicos com logótipo do patrocinador, Jogos separados em Resultados/Por jogar.
- Fix: capacidade do estádio no perfil caía sempre em 10 000; harness `teamsquad` partia (`useGame` sem provider).
- Fix global: o CSS da Google (sem layer) impunha 24px a todos os `material-symbols-outlined` e `text-[Npx]` era ignorado na app inteira; a fonte passou do `<link>` do `index.html` para `@import … layer(base)` no `index.css` (as utilities voltam a mandar). test:mobile 33/38 = mesmas 5 falhas antigas que no HEAD (assistant, journal, landing, stadiumtab, topwidgets) + mosaico de capturas revisto.
- Testado: lint (só o erro antigo do landing-resp-test), check:types, test:mobile playerhistory/teamsquad PASS 320–430 + capturas 390/1280 com a fonte dos ícones.

## Redesign Scout · Mercado · Leilões (2026-10-06)
- Topo comum `TransferHeader` (saldo grande + chips) e cabeça de cromo partilhada (`components/transfers/TransferChrome.jsx`); Mercado com selo preço vs valor e barra de % do saldo.
- Leilões ordenados pelo fim, fita a liderar/superado (`utils/auctionStanding.js` + teste), lance numa linha com Mín./+5%/+10%. Scout: consola de pesquisa, atalhos, ação com preço; `PlayerRow` com `actions` põe-nas na linha de baixo em mobile.
- Testado: lint (só o erro antigo do landing-resp-test), check:types, `node src/utils/auctionStanding.test.mjs`, test:mobile scout/transfer/auctions/mobile 320–1440 + capturas lidas.

## Redesign Clube · Finanças · Treino (2026-10-06)
- Treino: foco em 2 grupos (Posições/Físico) com ícone por cima, topo sem cartão órfão, «Como funciona?» em `<details>`, relatório com chip de variação compacto. Finanças: topo 1+2 no telemóvel, Receitas/Despesas em `Panel` com ponto da cor da barra e %, painéis do topo esticam à mesma altura. Clube: hero com faixa Moral/Adeptos/Salários/Saldo (sai o cartão de saldo), Estádio/Equipamento/Palmarés à mesma altura, lugares de funcionários em pontos.
- Fix: diálogo «Liquidar» mostrava `{interestPct}` literal; `ClubTab` recebe `homeWeather` por prop (o `useTactics` partia o harness do Clube, que volta a passar).
- Testado: lint, check:types, test:mobile club/finances/training PASS 320–430 + capturas 320/390/1440 com a fonte dos ícones; falhas restantes da suite já existiam (assistant, journal, landing, stadiumtab, teamsquad, topwidgets ← `useTactics` do StadiumTab) ou são da outra sessão (zz-ph).
- Plano em `docs/plans/2026-10-06-clube-financas-treino-redesign.md`.

## Redesign da vista ao vivo (2026-10-06)
- `LiveView.jsx` (sai do GameRoutes): botão Substituições, posse/remates/cansaço, feed de lances, Multiplex de golos, outras divisões recolhidas, marcador fixo ao descer; sem marcas de água/vinheta no hero.
- Fix: `MatchView` passava props erradas ao `PossessionBar` (a posse nunca aparecia).
- Testado: lint, check:types, test:livehelpers, harness novo `liveview-resp-test` + livehero PASS, capturas 390/1440; falhas de test:mobile noutros harnesses já existiam no HEAD (transfer: obra da outra sessão).
- Plano em `docs/plans/2026-10-06-live-view-redesign.md`.

## Redesign do shell do jogo (2026-10-06)
- Shell em CSS grid (`.game-shell`), header passa a barra da jornada (clube, próximo jogo, orçamento, posição, JOGAR com estado via `usePlayCta`); JOGAR sai da sidebar.
- Fix: `requestResync` reenvia `teamsData` (o jogo ficava sem equipas se o provider montasse depois do join); setinhas da classificação só re-snapshot quando a tabela muda.
- Testado: lint, check:types, typecheck, capturas reais desktop/mobile (playwright, sala local); test:mobile 150/185 — as 35 falhas (assistant, club, journal, landing, stadiumtab, teamsquad, topwidgets) já existiam antes (confirmado com stash).
- Plano e passos adiados em `docs/plans/2026-10-06-gamelayout-redesign.md`.

## Amigáveis em todas as semanas da Taça (2026-10-05)
- Eliminado pode marcar amigável em qualquer semana da Taça ainda por jogar (exceto a final); isenta dos 32 avos marca para a ronda 1.
- Adversário logo na inscrição: junta-se a uma inscrição humana sem par ou sorteia um NPC que folga (eliminado/isento); sem candidatos, emparelha no fecho como antes.
- Testado: typecheck, lint/check:types, connect-smoke + script sobre BD de sala (duplicados, final, par humano, NPC).

## Ligas de 10 equipas + 32 avos da Taça (2026-10-05)
- 10 equipas/divisão, 18 jornadas, época de 25 semanas; final da Taça = ronda 6 (`CUP_FINAL_ROUND`). Salas antigas são para apagar (sem migração).
- 32 avos com Distritais; isentas = D1 + top-4 da D2 (`last_season_rank`). Plano em `docs/plans/2026-10-05-ligas-10-equipas.md`.
- Testado: typecheck, lint/check:types, engine-unit, fansmood, sponsor, contratos, skillhistory, connect-smoke + verificação da regra de isenção sobre a base.db.

## Briefing: relvado do adversário visível em mobile (2026-10-04)
- Bug: no Briefing pré-jogo (<`lg`) o cartão «Confronto tático em campo» só mostrava o cabeçalho — o wrapper do `OpponentFormation` só tinha `min-h` e o `PitchFormation` é `h-full` com conteúdo `absolute` (colapsava a 0px; em `lg` o cartão é flex column e `flex-1` dava altura).
- Fix (plano `docs/plans/briefing-pitch-mobile.md`): wrapper passa a `h-80 short:h-56` em mobile e `lg:h-auto lg:flex-1` em desktop — altura definida → `h-full` do filho resolve. `PitchFormation` e `MatchBriefing` intactos.
- Verificação: `check:types` 0 · `lint` 0 no ficheiro (3 erros pré-existentes noutros) · `build` OK · `test:mobile -- briefing-resp-test` PASS 360/390 · screenshots full-page 360/390 lidos (relvado com os 11 nas 4 linhas; desktop CSS idêntico ao anterior).

## Push: avisos com contexto, duráveis e com interruptor (2026-10-04)
- `push.ts` ganha tipos (`waiting|auction|matchday|invite`), sempre só para ausentes, cooldown de 5 min por `(treinador, tipo, sala)` na BD (`push_throttle`), preferências em `push_prefs` (rotas `/api/push/prefs`, nome pela sessão/Bearer), 1 retry em falha transitória (respeita `Retry-After`), tecto de 10 subscrições por treinador + purga aos 180 dias, contadores em `/health`.
- Gatilhos novos: sala parada à tua espera (`maybeNotifyWaiting` no `checkAllReady`, na barreira dos minutos, no intervalo, no prolongamento e no `waitForMatchAction`), ultrapassado num leilão, fim de jornada com resultado + posição, e convite para quem está offline (antes o socket falhava com «já não está online»).
- Cliente: `sw.v10.js` (tag `<tipo>:<sala>`, navega para o deep link `/?room=`, `pushsubscriptionchange`), re-registo da subscrição no arranque, interruptores por tipo no painel Avisos; o painel passa a mudar o texto-base (antes só falava do lobby).
- Verificação: `test:push` 12 testes · server `typecheck` + `test:connect-smoke` + `test:session-freeze` + `test:engine-unit` + `test:segment-barrier` + `cupLobbyAdvanceRegression` + `audit:socketio` 0 erros · client `lint` + `check:types` · `test:mobile` 185/185 + screenshots do painel · `audit:gamestate` sem sala viva fica para a próxima.
