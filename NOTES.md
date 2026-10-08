## FARMACIA3: jornada perdida + logout no telemóvel (2026-10-08)
- Crash: `setTactic` de um socket sem sala → `getPlayerBySocket(null)` → `fatalShutdown` fechou a BD a meio do `persistMatchResults` (época 2, J1 sem linhas em `matches`; classificação OK). Guarda de `null` na função partilhada.
- Logout: `cacheVersion.js` (versão = arranque do servidor) fazia `localStorage.clear()` sem preservar `cashball_auth/rooms/device` — cada restart deslogava no reload seguinte.
- `DELETE FROM matches` do replay passa a filtrar `season`. Testado: typecheck, connect-smoke, lint, check:types.

## Deploy v26.10.34 no rick (2026-10-08)
- Push + tag `v26.10.34` + rebuild no rick (`docker compose up --build -d`); backend Healthy, frontend arrancado.
- `APP_VERSION` bumpado para `v26.10.34` (rodapé da landing).
- Mudanças desta ronda: robustez de sessão/presença (lease, `presencePing`, gate de join, join passivo sem roubo de assento) e utilitário de posições táticas (`tacticPositions.js`).

## Robustez de sessão/presença (2026-10-07)
- Lease começa na queda do socket; janelas de decisão nunca decidem `auto` por quem só tem lease; join passivo (separador oculto) não rouba o assento; `presencePing` + gate de join no cliente; contra-proposta/convite sobrevivem à queda. Plano: `docs/plans/2026-10-07-sessao-presenca-mobile.md`.
- Porquê: bloqueios de ecrã do telemóvel congelavam/descongelavam a sala e a lista `players` tratava a equipa como NPC.
- Testado: `test:session-freeze` (novos F13–F15), `test:segment-barrier`, `test:connect-smoke`, `test:crash-recovery`, typecheck, lint, check:types. Telemóvel real com bloqueio de ecrã por testar.

## Deploy v26.10.33 no rick (2026-10-07)
- Push + tag `v26.10.33` + rebuild no rick (`docker compose up --build -d`); backend Healthy, frontend arrancado.
- O pull travou por `HEAD.lock` de um `git gc` em curso e por ficheiros staged duplicados (idênticos ao origin) — descartados com OK do utilizador.
- Mudanças desta ronda: journal em coluna estreita à esquerda, contraste do header (`readableInk`), linha jogos/golos/ordenado dos leilões, subs sem truncate (2 linhas) e crest nos cards de transferência.

## Deploy v26.10.32 no rick (2026-10-06)
- Push + tag `v26.10.32` + rebuild no rick (`docker compose up --build -d`); backend Healthy, frontend arrancado.
- `APP_VERSION` bumpado para `v26.10.32` (rodapé da landing).
- Mudanças desta ronda: nova `BriefingView` (rota + `GameRoutes`), CTA de jogo (`usePlayCta`, `PrepCtaCard`, `MatchBriefing`, `PrimaryCTA`), táticas (`TacticsView`/`TacticsContext`), jornal (`ArticleBody`, `NewsMedia`, `tones`) e `hooks/socket/match.js`.

## RoomHub + WaitingCoachesModal — redesign (2026-10-06)
- RoomHub: bugs (mensagem perdida no gap, convites presos, kick sem confirmação), mensagens agrupadas + sistema intercalado + scroll inteligente, split (`RoomHub` casca + `RoomHubPanel` só aberto, `CoachRow`, `ChatMessages`, `ChatComposer`, `useRoomInvites`), layout novo (cabeçalho único, folha inferior no mobile). `chatMessagesRef` saiu do GameContext.
- WaitingCoachesModal: hero "À espera de X" + barra segmentada, banner de pausa com coaches offline, reutiliza `ChatMessages`/`ChatComposer`. Planos em `docs/plans/2026-10-06-*`.
- Testado: lint, check:types, build; harnesses `roomhub-resp-test` e `waiting-coaches-test` PASS em 375×667, 667×375, 768×1024, 1280×800 + capturas revistas (lista de coaches do modal subiu a 40 % da altura no mobile). Fluxo real com 2 sessões por testar.

## Deploy v26.10.31 no rick (2026-10-06)
- Push + tag `v26.10.31` + rebuild no rick (`docker compose up --build -d`); backend Healthy, frontend arrancado.
- `APP_VERSION` bumpado para `v26.10.31` (rodapé da landing).
- Mudações desta ronda: botão «Jogar!» no cabeçalho (sai o «Jogar Jornada» da página), limpeza do `TacticsView`/`IntervencaoView`, `LiveClock` e `commentary.ts`/`engine.ts`.

## Deploy v26.10.30 no rick (2026-10-06)
- Push + tag `v26.10.30` + rebuild no rick (`docker compose up --build -d`); backend Healthy, frontend arrancado.
- `APP_VERSION` bumpado para `v26.10.30` (rodapé da landing).
- Mudações desta ronda: página Admin nova (`AdminPage`), jornal com novas notícias/progresso (`progressNewsHelpers`), narração LLM (`commentary.ts` + scripts), meteo (raios do sol, nevoeiro), relvados alinhados com o pitch das Táticas.

## Deploy v26.10.29 no rick (2026-10-06)
- Push + tag `v26.10.29` + rebuild no rick (`docker compose up --build -d`); backend Healthy, frontend arrancado.
- `APP_VERSION` bumpado para `v26.10.29` (rodapé da landing).
- Mudações desta ronda: redesign `RoomHub` (split em `RoomHubPanel`/`CoachRow`/`ChatMessages`/`ChatComposer`/`useRoomInvites`) e `WaitingCoachesModal`.

## Deploy v26.10.28 no rick (2026-10-06)
- Push + tag `v26.10.28` + rebuild no rick (`docker compose up --build -d`); backend Healthy, frontend arrancado.
- `APP_VERSION` bumpado para `v26.10.28` (rodapé da landing).
- Mudações desta ronda: `GameHeader`, `CupBracketPage`, `LeagueStandings`, `CalendarioTab`, `FinancesTab`, `TrainingTab`, `TransferChrome`, `STYLE.md`.

## Deploy v26.10.27 no rick (2026-10-06)
- Push + tag `v26.10.27` + rebuild no rick (`docker compose up --build -d`); backend Healthy, frontend arrancado.
- `APP_VERSION` bumpado para `v26.10.27` (rodapé da landing).
- Sem mudanças de código além do bump — deploy de rotina.

## Deploy v26.10.26 no rick (2026-10-06)
- Push + tag `v26.10.26` + rebuild no rick (`docker compose up --build -d`); backend Healthy, frontend arrancado.
- `APP_VERSION` bumpado para `v26.10.26` (rodapé da landing).
- Teto do NOTES.md: 13 apontamentos antigos movidos para `NOTES_arquivo.md`.

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

## Deploy v26.10.25 no rick (2026-10-06)
- Shell do jogo (GameLayout) passa a CSS grid; barra da jornada com o próximo jogo e JOGAR com estado.
- Corrigidos: tabela de equipas reenviada no resync; scroll próprio da lista e do artigo no Jornal (desktop); selo de posição colorido no táticas.
- Plano do shell documentado no STYLE.md; `backend Healthy`.

## Deploy v26.10.24 no rick (2026-10-06)
- Jornal com nova UI/UX: lista com ícones de categoria agrupados por semana, faixa única de pendências, artigo com kicker e manchete maior, vista de detalhe no mobile.
- Direto: comentário na cor aclarada da equipa com contorno legível à chuva; meteorologia em ecrã inteiro só com o jogo vivo.
- Corrigidos: lesionados/expulsos filtrados por id do plantel; moral e agressividade nos cartões das substituições forçadas; `backend Healthy`.

## Deploy v26.10.23 no rick (2026-10-06)
- Redesenho da landing: estádio em festa no hero, montra com golo ao vivo, cartão de auth, montra em três blocos e «como funciona» com CTA final.
- Estádio procedural: bancadas laterais em perspetiva, identidade por clube via seed, nuvens por clube e focos noturnos, meteo da jornada no céu; chuva em mosaico SVG (perf).
- Briefing destaca equipas com treinador humano; aviso de meteo em resistência baixa; nome da sala nas notificações; `backend Healthy`.

## Deploy v26.10.22 no rick (2026-10-05)
- Estádio: cabeçalho em duas colunas com foto e nome longo a quebrar; campo em perspetiva com poças onduladas, neve acumulada e topo desvanecido.
- Finanças: bilheteiras líquidas, saldo previsto semana a semana, Resultado da Época com rubricas reais e gráfico de 25 semanas.
- Taça: amigáveis em todas as semanas restantes com adversário imediato; pulse no anel de destaque do tutorial; `backend Healthy`.

## Deploy v26.10.21 no rick (2026-10-05)
- Ligas de 10 equipas e 32 avos da Taça com Distritais em produção; sala sem criador deixa de tornar todos admin; compatibilidade antiga removida.
- Transferências: +8 de moral ao mudar de clube; BadgeSkills no cromo (mercado/leilões), sem a agressividade antiga.
- 112 saves de salas de teste desregistados do projeto; `backend Healthy`.

## Ligas de 10 equipas + 32 avos da Taça (2026-10-05)
- 10 equipas/divisão, 18 jornadas, época de 25 semanas; final da Taça = ronda 6 (`CUP_FINAL_ROUND`). Salas antigas são para apagar (sem migração).
- 32 avos com Distritais; isentas = D1 + top-4 da D2 (`last_season_rank`). Plano em `docs/plans/2026-10-05-ligas-10-equipas.md`.
- Testado: typecheck, lint/check:types, engine-unit, fansmood, sponsor, contratos, skillhistory, connect-smoke + verificação da regra de isenção sobre a base.db.

## Deploy v26.10.20 no rick (2026-10-05)
- Treino: jogadores muito abaixo da média sobem depressa até 70% da média; NPCs não renovam esses jogadores.
- Campo em perspetiva fixo no fundo no lugar da navegação mobile; anúncio de prolongamento só no 91'; `backend Healthy`.

## Deploy v26.10.19 no rick (2026-10-05)
- Campo em perspetiva no mobile com o tempo ao fundo; pausa pré-jogo de 7s com a análise de volta e anúncio de fase animado no placar.
- Casaco do adjunto na cor do clube; staff contratado com nome, papel e nível à medida da tesouraria; mentalidade em 3 botões no mobile; `backend Healthy`.

## Deploy v26.10.18 no rick (2026-10-05)
- Barra de notícias junta as pendentes numa só tira; pill «AO VIVO» e o espaço reservado saem do mobile.
- Indicador do separador ativo passa para baixo no mobile; parcelas de patrocínio só no resumo financeiro semanal; `backend Healthy`.

## Deploy v26.10.17 no rick (2026-10-05)
- Direto com suspense no penálti (popup animado em paralelo com o festejo), golo novo substitui o festejo em curso, meteorologia em ecrã inteiro com vento novo; ritmo de golos afinado (sem golo de bola corrida no minuto após golo).
- Barra de notícias entra pela direita e mais baixa no mobile, sem contador nem dispensar; convite de clube pendente sobrevive ao restart; amigáveis pedem confirmação acima de 3 substituições; `backend Healthy`.

## Deploy v26.10.16 no rick (2026-10-05)
- Nomes de clubes e jogadores passam a abrir a página do clube e o histórico do jogador; treino com spinner, níveis no relatório e grupos com cabeçalho único; meteorologia animada no hero do direto.
- Posse por estilo corrigida (ofensivo tem a bola, defensivo cede-a); jornal sem tabela duplicada na classificação final; brasão na árvore da Taça; `backend Healthy`.

## Briefing: relvado do adversário visível em mobile (2026-10-11)
- Bug: no Briefing pré-jogo (<`lg`) o cartão «Confronto tático em campo» só mostrava o cabeçalho — o wrapper do `OpponentFormation` só tinha `min-h` e o `PitchFormation` é `h-full` com conteúdo `absolute` (colapsava a 0px; em `lg` o cartão é flex column e `flex-1` dava altura).
- Fix (plano `docs/plans/briefing-pitch-mobile.md`): wrapper passa a `h-80 short:h-56` em mobile e `lg:h-auto lg:flex-1` em desktop — altura definida → `h-full` do filho resolve. `PitchFormation` e `MatchBriefing` intactos.
- Verificação: `check:types` 0 · `lint` 0 no ficheiro (3 erros pré-existentes noutros) · `build` OK · `test:mobile -- briefing-resp-test` PASS 360/390 · screenshots full-page 360/390 lidos (relvado com os 11 nas 4 linhas; desktop CSS idêntico ao anterior).

## Push: avisos com contexto, duráveis e com interruptor (2026-10-11)
- `push.ts` ganha tipos (`waiting|auction|matchday|invite`), sempre só para ausentes, cooldown de 5 min por `(treinador, tipo, sala)` na BD (`push_throttle`), preferências em `push_prefs` (rotas `/api/push/prefs`, nome pela sessão/Bearer), 1 retry em falha transitória (respeita `Retry-After`), tecto de 10 subscrições por treinador + purga aos 180 dias, contadores em `/health`.
- Gatilhos novos: sala parada à tua espera (`maybeNotifyWaiting` no `checkAllReady`, na barreira dos minutos, no intervalo, no prolongamento e no `waitForMatchAction`), ultrapassado num leilão, fim de jornada com resultado + posição, e convite para quem está offline (antes o socket falhava com «já não está online»).
- Cliente: `sw.v10.js` (tag `<tipo>:<sala>`, navega para o deep link `/?room=`, `pushsubscriptionchange`), re-registo da subscrição no arranque, interruptores por tipo no painel Avisos; o painel passa a mudar o texto-base (antes só falava do lobby).
- Verificação: `test:push` 12 testes · server `typecheck` + `test:connect-smoke` + `test:session-freeze` + `test:engine-unit` + `test:segment-barrier` + `cupLobbyAdvanceRegression` + `audit:socketio` 0 erros · client `lint` + `check:types` · `test:mobile` 185/185 + screenshots do painel · `audit:gamestate` sem sala viva fica para a próxima.

## Consistência de estado no frontend (2026-10-08)
- Limpar a tática mantém a formação; contagens ignoram ids fora do plantel; subs voltam do servidor após reload ao intervalo; plantel/finanças/standings emitidos em ordem; reconexão em lobby limpa o resultado parcial; leilão reaberto, lance offline, Pronto com patrocinador, tabs e guardas de sala; estado de leilão legado removido. Plano: `docs/plans/2026-10-08-consistencia-estado-frontend.md`.
- Porquê: o que o cliente mostrava/enviava divergia do servidor (11 que nunca chegava, subs a mais, plantel com segundos de atraso).
- Testado: client `lint` (só o `landing-resp-test.jsx`, já falhava) + `check:types` + `test:tacticpositions` (novo) + `build`; server `typecheck` + `test:finalize` + `audit:socketio`. Reload/rede/Taça por testar à mão.
