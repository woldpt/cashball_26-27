# NOTES_arquivo.md — arquivo do caderno (ver regra do teto em AGENTS.md)

Apontamentos antigos movidos do NOTES.md para ele nunca pesar. Nada se apaga, só muda de casa.

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

## Deploy v26.10.35 no rick (2026-10-08)
- Push + tag `v26.10.35` + rebuild; J1 da época 2 de PYG2GT reposta em `matches` a partir de `allMatchResults` (só resultados; backup `game_PYG2GT.db.bak-20261008-J1`).

## Deploy v26.10.34 no rick (2026-10-08)
- Push + tag `v26.10.34` + rebuild no rick (`docker compose up --build -d`); backend Healthy, frontend arrancado.
- `APP_VERSION` bumpado para `v26.10.34` (rodapé da landing).
- Mudanças desta ronda: robustez de sessão/presença (lease, `presencePing`, gate de join, join passivo sem roubo de assento) e utilitário de posições táticas (`tacticPositions.js`).

## Deploy v26.10.33 no rick (2026-10-07)
- Push + tag `v26.10.33` + rebuild no rick (`docker compose up --build -d`); backend Healthy, frontend arrancado.
- O pull travou por `HEAD.lock` de um `git gc` em curso e por ficheiros staged duplicados (idênticos ao origin) — descartados com OK do utilizador.
- Mudanças desta ronda: journal em coluna estreita à esquerda, contraste do header (`readableInk`), linha jogos/golos/ordenado dos leilões, subs sem truncate (2 linhas) e crest nos cards de transferência.

## Deploy v26.10.32 no rick (2026-10-06)
- Push + tag `v26.10.32` + rebuild no rick (`docker compose up --build -d`); backend Healthy, frontend arrancado.
- `APP_VERSION` bumpado para `v26.10.32` (rodapé da landing).
- Mudanças desta ronda: nova `BriefingView` (rota + `GameRoutes`), CTA de jogo (`usePlayCta`, `PrepCtaCard`, `MatchBriefing`, `PrimaryCTA`), táticas (`TacticsView`/`TacticsContext`), jornal (`ArticleBody`, `NewsMedia`, `tones`) e `hooks/socket/match.js`.

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

## Lista de melhores marcadores cortada a 7 (2026-10-05)
- Pedido: harmonizar a altura da lista com a da classificação geral do campeonato.
- `LeagueStandings.jsx` (`GoldenBootSidebar`): `rows` passa a `.slice(0, 7)` — o servidor continua a enviar 10 por divisão; o corte é só na renderização. Os emblemas de posição usam o índice do array → continuam correctos (1–7).
- Checks: `lint` limpo no ficheiro (4 problemas pré-existentes noutros) · corte de 1 linha → sem `test:mobile`; sem lógica de jogo/sockets → sem audits.

## Deploy v26.10.15 no rick (2026-10-05)
- Amigáveis na semana da Taça (separador no Calendário, live view, cartão certo), clima variado, Jornal sem filtros + semana no cabeçalho mobile; `backend Healthy`.

## Deploy v26.10.14 no rick (2026-10-05)
- Amigáveis para eliminados da Taça na semana da ronda (com todos os suplentes utilizáveis); `backend Healthy`.

## Deploy v26.10.13 no rick (2026-10-05)
- LandingPage com props agrupadas em `form`/`room` + fallback de auth explícito para login; `backend Healthy`.

## LandingPage: props agrupadas em form/room (2026-10-05)
- Plano `docs/plans/2026-10-05-landing-page-melhorias.md` executado F1–F3 em 3 commits (`84cfc937`, `68bf231f`, `121a8b9e`): fallback de auth explícito para login, JSDoc no padrão do `CLAUDE.md`, `landingProps` com grupos `form`/`room` + topo de 7 (o plano dizia 6, mas o `createAccount` limpa o `joinError` — esse ficou no topo; `setAvailableSaves` manteve `{Function}` porque recebe updater). `RoomSelectScreen` intacto.
- Achado: `disconnected` nunca chega à landing (vive no `GameContext`, em jogo) — passa sempre `undefined`, antes e depois; documentado no JSDoc em vez de inventar valor.
- Checks: `check:types` 0 · `eslint` 0 erros nos 4 ficheiros (1 warning no `App.jsx` provado pré-existente com `stash`) · `build` OK · grep: só o `App.jsx` consome a landing. Sem `test:mobile` (mesmo DOM/classes, só canalização de props) nem audits (zero servidor/jogo/sockets). Fica para o utilizador: clicar login/registo/voltar/entrar em sala no browser (sem skill `run` neste ambiente).

## Sombra subtil nos logotipos dos crests (2026-10-05)
- Plano `docs/plans/2026-10-05-sombra-logotipos-crests.md`: a sombra desenhava-se à volta do tile, não do logótipo — o fundo colorido saiu do `<img>` para um wrapper `<span>` e o `<img>` ganhou `crest-shadow` (novo `@utility` em `index.css`, 2 `drop-shadow` curtos).
- Fase 1: `shared/TeamCrest` e `live/TeamCrest` (no live o `mediaStyle` de rotação passou para o wrapper — resolvido o bug latente dos dois atributos `style`, o 2.º anulava o 1.º).
- Fase 2: 9 sítios com `<img>` direto (PlayerHistoryModal, WelcomeModal, TransferHub, AuctionResultRow, CupFinalStage, LiveMatchHero, DuelHero, ClubTab, CalendarioTab) com o mesmo wrapper local; as 6 marcas de água têm `filter` inline (anula a classe) → drop-shadow mesclado no `filter`.
- Fallback de iniciais/⚽ intacto; `shadow-md` do tile mantido nos wrappers.
- Checks: `lint` limpo nos 12 ficheiros (3 pré-existentes noutros) · `check:types` 0 · `build` OK · `test:mobile` **185/185** + screenshots 360 lidos (Clube, Welcome, Classificações, Live, Briefing, Taça Final). Fica para o utilizador: ver no browser o crest real (logótipo escuro sobre cor escura), claro/escuro.

## Clima no relvado do jogo (2026-10-04)
- O relvado do `MatchView` mostra o clima do jogo: novo `WeatherOverlay.jsx` (chuva/neve/vento/nevoeiro/frio com partículas só em CSS, posições determinísticas) ligado ao emoji do evento `weather` que já existia; sem clima não pinta nada. Com movimento reduzido fica parado nas tintas estáticas.
- Checks: `eslint` limpo nos 4 ficheiros · `check:types` 0 · `test:mobile` **185/185** + `match-spectate` 5/5 com captura 390 vista (relvado inteiro, sem overflow).

## Deploy v26.10.10 no rick (2026-10-03)
- Funcionários completos (F1+F2+F3) com caricaturas SVG, clima no cartão do próximo jogo, gates por clube e não por presença, fadiga contínua com o clima; `backend Healthy`.

## Clima → fadiga: desgaste contínuo com a resistência como escudo (2026-10-03)
- Pedido: ligar a meteorologia ao **desgaste** dos jogadores de forma **contínua** (antes o clima só dava 1 golpe de fadiga ao minuto 60, e só neve/frio), com a **Resistência** como escudo. Decisões do utilizador: **só fadiga** (não tocar em lesões/golos) · **todas as condições graduadas** · **sutil**.
- `gameConstants.ts`: novo `MATCH_TUNING.weatherFatiguePerMinute` — probabilidade EXTRA por minuto de um golpe de fadiga, graduada por condição (`neve 0.02 · frio 0.015 · chuva_forte 0.01 · nevoeiro 0.008 · vento 0.005 · chuva 0.003`; `sol` ausente = 0). Sutil: neve ≈ +30% de desgaste no jogo, chuva ≈ +5%.
- `engine.ts` `applyMinuteFatigue`: substitui o tick único do minuto 60 (neve/frio) por um **rolo contínuo por minuto** — para cada jogador do XI, `if (rng() < wPerMin && rng() >= fatigueSkipChance(p)) applyFatigueToPlayer(…, 1)`. Reaproveita a via de fadiga existente (`fatigueSkipChance` = resistência + bónus GR; `applyFatigueToPlayer` → `_matchSkill`/`_fatigueLoss`, só memória) — zero código novo de fadiga, só o gatilho de clima. Subs entram sujeitos ao rolo desde o minuto em que jogam. Exporta `applyMinuteFatigue` para o teste.
- Removido: o guard `fixture._fatigue3Applied` (e o campo em `types.ts`) e a função `applyFatigue` (loop do onze inteiro — ficou morta com a remoção do tick 60).
- Determinístico: usa o `tick.rng` (seeded) → replay pós-crash idêntico; só estado em memória, **sem escrita em BD**.
- `engineUnitRegression.mts` **U20**: mesmo seed, `neve > sol` em fadiga total (lida em `fixture._fatigueLoss`, não no player); e em clima mau, resistência 1 > resistência 50.
- Checks: server `typecheck` OK · `test:engine-unit` **28/28** · `audit:socketio` 0 erros/104 warnings (sem eventos novos). Sem `test:mobile` (backend puro); sem `audit:gamestate` (não toca em budgets/squad/fases).

## Consentimento: gates por clube, não por presença (2026-10-04)
- Invariantes do utilizador: zero autorun — Pronto de 100% nos 2 gates (após a tática = todos os membros; intervalo/ET = só quem tem jogo); Taça sem humanos segue sem confirmação; admin kick é a saída do fugitivo.
- Bug real: o auto-avanço do intervalo (Taça/amigável) e o gate do prolongamento decidiam por `socketId` ("quem está ligado"), não por "quem tem jogo" — treinador com jogo offline perdia o Pronto e a 2.ª parte/ET arrancavam sozinhos quando voltava. Novo `hasHumanTeamInFixtures` (assentos member) decide nos 3 sítios (inclui aplicar as subs do ET, que também se perdiam).
- Cliente: fora os 2 auto-ready dos observadores em `cup.js` (consentimento fabricado); `MatchPage`/`TacticsView` mostram estado de espera a quem não tem jogo no gate (o botão era uma ação que não fazia nada).
- Verificação: `test:session-freeze` 12/12 (F12 novo) · `typecheck` OK · `lint` limpo nos ficheiros (4 pré-existentes) · `check:types` 0 · `audit:socketio` 0/104 · `audit:gamestate FGPQH6` 82/15 (baseline) · sem `test:mobile` (estados de botão, sem estrutura).

## Funcionários com cara: caricaturas SVG na linha do adjunto (2026-10-04)
- **Pedido:** «os funcionários têm avatar?» — não tinham: o cartão mostrava um ícone Material (`school`/`fitness_center`/`campaign`/`medical_services`). Decisões: **SVG desenhado à mão** (não arte raster gerada) · **1 cara por papel + adereços por escalão** · **cabeçalho do cartão** · **busto com braços cruzados** (a pose do adjunto).
- `client/src/components/shared/StaffAvatar.jsx` (novo): 4 personagens + 1 genérico de fallback, na linha do `docs/jj1.png` — traço fino escuro (`#151a24`, 1.6px num viewBox 120×120), cores planas sem gradientes, olhos ovais brancos enormes com pupila pequena, pálpebras carregadas, boca em ∩, busto de braços cruzados. **Sem RNG**: pele/cabelo/roupa fixos por papel (o médico é sempre o mesmo boneco), determinístico como o resto dos avatares.
- **Escalões** (nível 1-2 / 3-4 / 5 → `staffTier`): auxiliar = apito → prancheta → óculos · físico = toalha ao pescoço → colete · comunicação = gravata → megafone sob o braço → crachá de imprensa · médico = bata+teal → estetoscópio → óculos + maleta com cruz. Desvios do plano aprovado (por legibilidade): o micro na lapela virou **megafone** no nível 3-4 (com braços cruzados não há mão livre e um micro flutuante não se lia a 40px) e a **toalha é desenhada por baixo dos braços** (primeira versão parecia um colarinho de padre).
- `ClubTab`: o ícone do cabeçalho deu lugar ao avatar (`size="mdR"` = 48px mobile / 64px ≥sm) com rótulo + badge por baixo — no cartão **vazio** a cara segue o **stepper de nível** (escolhes 1→5 e vês quem vais contratar); no contratado é o nível dele. O `icon` saiu do `STAFF_ROLE_META` (ficou morto: só o ClubTab o usava; o Jornal tem ícones próprios).
- Verificação: `lint` no baseline (3 erros pré-existentes, 0 meus) · `check:types` 0 erros · **`test:mobile` 180/180 PASS** (3 passagens; uma passagem intermédia deu 2/180 — flake do runner paralelo, não reproduzido) · screenshots do painel a 320/390/1440 a olho (cartões a 1 coluna no telemóvel, 2 em desktop, nada cortado).

## Harnesses de regressão: 12 testes podres arranjados, suite do servidor toda verde (2026-10-04)
- Contexto: ao verificar o F2/F3 dei por 5 harnesses a falhar **no HEAD** (provado com `git stash`); a passagem completa mostrou **12**. Arranjados todos — a suite do servidor passou de 14/26 para **26/26** (o que ficou verde: `test:attendance`, `test:fansmood`, `test:morale`, `test:training-report`, `test:training-multiseason`, `test:contractyear`, `test:relegation-coach`, `test:coach-dismissal-league`, `test:substitutions`, `test:penalty-ordering`, `test:segment-barrier`, `test:emergency-gk`).
- **Stale por mudanças de API/módulos** (o código mudou e o teste ficou a apontar para o sítio velho): `training-report`/`training-multiseason` pediam `createTrainingHelpers()` (a factory saiu do `trainingHelpers`, agora exporta `applyTrainingBonuses`/`clearSeasonTrainingState` direto) · `contractyear` guardava `", Jornada "` num cliente que passou a "Semana N" (`contractWeekLabel`) e a guarda era auto-satisfeita (montava a string e comparava com a mesma literal) → reescrita para medir o produto (`contractEndInfo` + `seasonToYear`), com os rótulos a viverem em `hooks/socket/helpers.js`/`market.js` · `emergency-gk` lia `useSocketListeners.js` (os listeners mudaram para `hooks/socket/match.js`) e o texto "Vai para a baliza" (agora "Escolhe quem vai para a baliza") · `substitutions` media indentação literal (o passo do minuto saiu para `resolveUserSubs`) e contava 2 emits de `substitutionCapReached` quando já são 3 (lote de trocas).
- **Fixtures desatualizadas** (o fake game/schema não acompanhou a arquitetura): `relegation-coach`, `coach-dismissal-league`, `penalty-ordering` e `segment-barrier` não tinham `seats`/`seatSeenAt` (o `isSeatPresent`/`deleteSeat` dos assentos duráveis rebentava); `coach-dismissal-league` precisava de `npcNegativeBudgetStreak` e da coluna `wage`; os dois de despedimento precisavam das deps novas (`getCoachAvatars`, `forceNpcWageCut`).
- **Escalas antigas** (migrações de tuning): `morale` esperava os deltas antigos (V+25/E+5/D−20, neutro 50, escala 0–100) e faltava-lhe `division`/`fans_mood` — reescrito para a escala 1–50 (V+12/E+2/D−10, neutro 25) com valores recalculados à mão e confirmados (12 asserts) · `fansmood` tinha fixtures de mood 60/95 esmagados pelo `MIN(50, …)` → reescrito na escala 1–50 (12 asserts, incl. o travão do Director de Comunicação) · `attendance` tinha dois cenários saturados na capacidade (10000 vs 10000 no preço e na Taça) → contexto neutro para o que se compara ser só o fator em teste.
- **`crash-recovery` era dependente da sala:** passava na sala default e falhava na FGPQH6 porque o S4 injetava `ready` na projeção (`playersByName`) quando a fonte é o assento durável (`seat.intent.ready`) e a sala congela com um treinador da ronda ausente. Agora o S4 marca intenção+presença nos assentos (`setSeatIntent`) e passa nas duas salas — deixou de depender do estado dos assentos da sala copiada.
- **Achado real (não é do teste):** o `substitutionCapReached` é emitido em 3 sítios do servidor mas o cliente **já não o ouve** — foi removido de propósito em `d968a61f` ("cap/expiry/copy toasts removed"), com o aviso a passar a inline na `IntervencaoView` ("Limite de substituições atingido."). A guarda passou a medir isso em vez do toast.
- Verificação: `typecheck` OK · **26/26 harnesses do servidor PASS** (incl. `test:crash-recovery` com `CRASHTEST_ROOM=FGPQH6` e com a sala default) · o único ficheiro não meu na árvore é `client/src/views/TacticsView.jsx` (trabalho em curso noutra sessão — não tocado nem commitado).
- Nota: os harnesses que carregam salas deixaram três diretórios `saves/Repro*/` (artefactos de teste) — apagados; `git checkout -- server/saves` repôs o WAL tocado pelas auditorias.

## Tática: clima no cartão "Próximo jogo" sob o botão (2026-10-03)
- Pedido: preencher o espaço vazio sob o botão "Jogar Jornada" (vista Tática, coluna direita em desktop) com info extra — escolhido o **clima**.
- Descoberta: o clima **já existia e já chegava ao cliente** — `nextMatchSummary.weatherForecast` (`{condition, emoji}`) vem no resumo (liga **e** taça), é determinístico (`getWeatherForFixture`, a mesma semente alimenta a previsão do briefing e a simulação — o anunciado é sempre o jogado) e o briefing já o mostrava. Zero backend, zero componente novo.
- `TacticsView.jsx`: import de `WEATHER_LABELS` (`matchConstants.js`, chaveado por `condition`) + uma linha `{emoji} {label}` no cartão "Próximo jogo", sob a linha estádio/árbitro, guardada por `weatherForecast &&`.
- Checks: `eslint` limpo no ficheiro (4 problemas pré-existentes noutros) · `check:types` 0 erros. Tweak de texto/linha pontual → sem `test:mobile`; sem lógica de jogo/sockets → sem audits.

## Funcionários (F2+F3): comunicação, médico e o teto de 3 lugares a morder (2026-10-04)
- Continuação do F1 (`806ba1fd`): entram os 2 papéis que faltavam, com efeitos em sistemas que já existiam — **Director de Comunicação** (adeptos/bilheteira) e **Médico** (lesões). O catálogo é data-driven: bastou acrescentar a entrada em `STAFF_ROLES` + rótulos no cliente, sem migração de BD.
- **Comunicação** (por nível): +2% de lotação (nível 5 = +10%) lido em `coreHelpers.computeAttendance` (mais um fator na cadeia de multiplicadores + motivo «departamento de comunicação» no briefing) e −8% no decaimento do `fans_mood` (nível 5 trava a 60%), aplicado no UPDATE semanal do `game/evolution.ts`.
- **Médico** (por nível): −6% de probabilidade de lesão, −1 semana a cada 2 níveis (nunca abaixo de 1) e −1 de skill perdido nas lesões graves. Os modificadores são funções puras (`staffInjuryChanceMult/Weeks/SkillLoss` em `gameConstants`) e o nível é lido **uma vez por segmento** para o `fixture._staffInjury` (padrão do `_injuryLoadMult`): a engine não lê a BD durante a simulação e um replay pós-crash dá exatamente as mesmas lesões.
- **Efeitos agora testáveis a sério**: `test:staff` cresceu para **67 asserts** (preços, contratação/despedimento/`no_budget`/`role_taken`/`invalid_*`, **teto 3/3 com os 4 papéis** — o `no_slots` finalmente é alcançável, NPC por divisão/reserva/1 por semana, os 4 efeitos de treino, a **lotação** 53031→58335 (+10.0%) e o **ânimo** 42 vs 43) · `test:engine-unit` **27/27** com o U19 novo (rng constante + resistência 1: o gate 0.0013 cai entre a taxa base 0.0015 e a com médico 0.00105 — lesiona sem médico, poupa com ele; o U19b prova 3 semanas → 1 e 2 de skill poupados).
- Verificação: `typecheck` OK · `test:connect-smoke` OK · `audit:socketio` 0 erros/104 warnings (sem eventos novos) · `audit:gamestate FGPQH6` 82 erros/15 warnings (baseline) · `test:crash-recovery` só com o FAIL pré-existente do *dispatch* (todo o resto ok, incluindo «SEM re-cobrança») · `lint`/`check:types` OK · `test:mobile` **180/180** + harnesses `club-resp-test` (5 cartões: os 4 papéis + 1 sem catálogo a exercer o fallback, médico nível 5 = texto de efeito mais comprido) e `training-resp-test` (3 funcionários na nota) · screenshots 320/390/1440 lidos.
- **Harnesses podres encontrados (pré-existentes, provados com `git stash` no HEAD — não são desta mudança):** `test:fansmood` (falha no 1.º assert: mood 60 é clampado a 50 pelo `MIN(50, …)` do decaimento — os fixtures são da escala antiga), `test:attendance` (o caso do preço satura na capacidade: 10000 vs 10000), `test:morale` (`no such column: division` + moral 50), `test:training-report` e `test:training-multiseason` (`createTrainingHelpers is not a function` — a factory foi removida do `trainingHelpers` numa extração anterior). Por isso os efeitos novos de adeptos/lotação foram testados dentro do `test:staff` (auto-contido), em vez de depender destes.
- Notas: as auditorias voltaram a fazer checkpoint do WAL de `server/saves/gonfig1/game_FGPQH6.db` — restaurado com `git checkout -- server/saves` antes do commit.

## Funcionários (F1): equipa técnica no Clube, salário na folha semanal (2026-10-04)
- Pedido: função nova ao estilo Hattrick — contratar funcionários. Decisões do utilizador: **4 papéis na v1**, **3 lugares**, tabela fixa por nível, NPCs contratam sozinhos, **contratação no `ClubTab`** (dar vida à página), **passo novo no tutorial** e **menção no `TrainingTab`** quando há auxiliar.
- Regra central (do Hattrick): efeito **linear** no nível e salário a **dobrar** (3k/6k/12k/24k/48k por semana). É a própria curva salarial que faz o travão por divisão — um clube da D4 aguenta o nível 3 numa categoria, não nas três — por isso **não há teto por divisão**. Assinatura = 4 semanas de salário, despedimento = 2 semanas de indemnização (sem isto, trocar de funcionário todas as semanas saía de graça).
- F1 entrega **2 papéis com efeito a sério**: **Treinador Auxiliar** (+8%/nível no progresso de treino) e **Preparador Físico** (+1 forma a cada 2 níveis para quem descansa, +0.5 de resistência treinada por nível, −8%/nível no decaimento de resistência). Director de Comunicação (F2) e Médico (F3) ficam para depois: o catálogo é data-driven (`STAFF_ROLES`), um papel novo entra sem migração nem mudar a UI.
- Servidor: `team_staff` (schema + criação idempotente no `gameManager`), `staffHelpers.ts` (preços, nomes de humor por papel/nível, `hireStaff`/`fireStaff` com débito **condicional ao saldo** dentro de transação, `ensureNpcStaff`), `socketStaffHandlers.ts` (`requestStaff`/`hireStaff`/`fireStaff` respondem por **ack** — só o meu clube muda o meu staff, não há broadcast; para a sala sai só `teamsData`, porque o orçamento mudou). Efeitos em `trainingHelpers.ts` e a folha em `weeklyFlowHelpers.ts` (salário no UPDATE semanal + `staff` no `buildWeeklyFinanceFacts` + NPC uma vez por semana, junto do tick NPC das transferências).
- Cliente: secção nova no `ClubTab` (cartão por papel com stepper de nível 1–5, efeito/salário/assinatura, contratar/despedir, contador `n/3 lugares`) com `data-tour="club-staff"`; `constants/staff.js` só com rótulos/ícones — os **números vêm sempre do servidor** (incluindo `previews` por nível), para não haver duas fórmulas; `hooks/useStaffState.js` (estado por ack) montado no `GameRoutes`, para o `ClubTab` continuar puro (é o que os harnesses renderizam); menção da equipa técnica no card «Como funciona?» do `TrainingTab`; passo 2 do tutorial (mesma tab, sem navegação extra); notícias `staff_hire`/`staff_fire` com artigo próprio no Jornal e linha «Funcionários» na tabela semanal; a barra «Salários/jornada» do Clube passa a somar a equipa técnica.
- Verificação: `test:staff` **novo** (42 asserts — preços, contratação/despedimento, `no_budget`/`role_taken`/`invalid_*`, 3/3 lugares, despedimento sem saldo que **não** deixa o clube negativo, NPC por divisão/reserva/1 por semana, e os 4 efeitos de treino com valores exatos: 0.96 vs 0.40 de progresso, +4 vs +2 de forma, 33 vs 30 de resistência, 0.45 vs 0.08 de desgaste) · `typecheck` OK · `test:connect-smoke` OK · `audit:socketio` 0 erros / 104 warnings (baseline 101 + os 3 eventos client→servidor, o padrão de todos os pedidos do cliente) · `audit:gamestate FGPQH6` 82 erros/15 warnings (o baseline exato da sala) · `test:engine-unit` 25/25 · `test:trainingcap` 5/5 · `test:crash-recovery` com **1 FAIL pré-existente** provado por `git stash` (o mesmo FAIL no HEAD — a sala FGPQH6, época 8, não cumpre a expectativa de *dispatch* do teste) · `lint` limpo nos ficheiros (restam os 4 pré-existentes) · `check:types` 0 erros · `test:mobile` **180/180** com os harnesses `club-resp-test` (3 papéis, um sem catálogo no cliente a exercer o fallback, 1 contratado com nome comprido, pior caso do botão «Contratar») e `training-resp-test` (com equipa técnica) · screenshots 320/390/1440 lidos (cabeçalho numa linha, 0 overflow, 0 clipping).
- Notas: o teto de 3 lugares só passa a morder quando existir um 3.º papel (F2) — em F1 o máximo é 2. As auditorias fazem checkpoint do WAL e tocaram `server/saves/gonfig1/game_FGPQH6.db-{shm,wal}` — restaurados com `git checkout -- server/saves` antes do commit.

## Calendário: MOM, bilheteira e hero do próximo jogo (2026-10-03)
- Pedido: 3 ideias para o `CalendarioTab` — MOM por jogo jogado, receita de bilheteira nos jogos em casa e um hero do próximo jogo (adversário + forma + estádio + atalho p/ tática). Dados já existiam na BD (`matches`/`cup_matches`.`ticket_revenue`, `match_moms` com `player_name` por equipa) — só faltava expô-los no payload `calendarData`.
- Servidor (`socketSessionHandlers.ts` `requestCalendar`): `ticket_revenue` nos SELECTs de `leagueMatches` e `cupMatches`; query a `match_moms` (por época, `League`/`Cup`) anexa `home_mom`/`away_mom` (nome do jogador) a cada jogo.
- Cliente (`CalendarioTab.jsx`): helpers `myMomOf`/`myTicketRevenueOf` (a minha parte da bilheteira = `total − floor(total×0.15)`, só em casa — mesma fórmula do servidor); linhas `MOM: <jogador>` e `Bilheteira: €X` no `ScoreBlock` dos jogos jogados. Novo `NextMatchHero` no topo da lista: adversário (crest + nome clicável), `FormDots` da forma, estádio/Casa-Fora e botão **Preparar tática** → `navigateTab("tactic")`; escondido se a época terminou ou o adversário ainda não foi sorteado.
- `GameRoutes.jsx`: passa `teamForms` e `navigateTab` ao `CalendarioTab`.
- Checks: server `typecheck` OK · client `lint` limpo nos ficheiros (4 problemas pré-existentes noutros) + `check:types` 0 erros · `test:mobile` **180/180** (nova estrutura de layout) · `audit:socketio` 0 erros (101 warnings, baseline — sem emits/handlers novos, só payload alargado).

## Skill do jogador: reparar o que o `46b3fd06` (20 slots) deixou partido (2026-10-03)
- Sintoma: `playerhistory-resp-test` a falhar 5/5 (timeout) e **o `PlayerHistoryModal` a rebentar no browser** — `SyntaxError: does not provide an export named 'MATCHWEEKS_PER_SEASON'`. Pre-existente ao layout das classificações (confirmado com `git stash`).
- Não era só o nome do export: o módulo foi reescrito (epoch com ponto, 20 slots, `{x,y,label}`) e os consumidores não acompanharam.
- `client/src/utils/skillHistory.js`: `buildSkillChartPoints` volta a **descartar pontos sem `skill`/`matchweek`** (era o filtro antigo; sem ele, `y` null dava `NaN` no `d` do SVG).
- `client/src/components/modals/SkillLineChart.jsx`: passa a usar a API nova — `currentSeason` = época mais recente do histórico (para o ano só aparecer em pontos antigos), `p.x` em vez de `p.epoch`, rótulos vindos de `p.label` (`J4`/`T2`/`Pré`), fora o `skillLabel(p, multiSeason)` (2.º argumento mudou de boolean para número → punha o ano em **todos** os rótulos) e fora a janela duplicada (o módulo já corta nas últimas 20 semanas; a antiga cortava 14 e o `p.epoch` inexistente esvaziava o gráfico). `multiSeason` = "algum rótulo visível traz ano".
- `client/scripts/skillHistoryRegression.mjs`: reescrito para a API nova (é o check do módulo) — 22 asserts: clamp 1..20, epochs multi-época, dedupe no mesmo slot, pontos inválidos, janela de 20 slots, rótulos do calendário (slot 5 = `T1`) e ano só para épocas anteriores.
- Verificação: `npm run test:skillhistory` 22/22 (era `SyntaxError`) · medido no browser (não só no harness): SVG do gráfico com rótulos `Pré, J1, J2, J3, T1, J4`, 6 pontos, `d` sem `NaN`, legenda «Atual (6 pontos)» · `playerhistory-resp-test` PASS 5/5 (era 5/5 FAIL) · suite `test:mobile` **180/180** (a primeira verde desde o `46b3fd06`) · `eslint` limpo · `check:types` 0 erros.

## Classificações: hero da nossa divisão, brasões e os outros 3 lado a lado (2026-10-03)
- Pedido: destaque em cima para o nosso campeonato (bonito, com logos), melhores marcadores da nossa divisão ao lado, os outros 3 campeonatos por baixo. `StandingsTab.jsx` continua wrapper — tudo em `LeagueStandings.jsx`.
- Layout: grid `xl:grid-cols-12` → hero `col-span-8` + goleadores `col-span-4`; por baixo `sm:grid-cols-2 xl:grid-cols-3` com as divisões restantes. Abaixo de xl empilha (hero → goleadores → restantes). Div do hero = a da minha equipa; sem equipa (espectador/despedido) é a Primeira Liga.
- `DivisionTable` ganhou `variant="hero"|"compact"`: hero com ícone 🏆, título `sm:text-base`, borda/realce `tertiary` e `text-sm`; as 3 compactas sem a coluna Forma (é a mais larga e não cabe a 3 colunas) e com V/E/D só quando a tabela está sozinha (`sm:hidden` — lado a lado só Pos·Clube·Mov·J·DG·Pts). O ponto de cor deu lugar ao **`TeamCrest`** em todas as tabelas e nos goleadores (brasão do `teams` da sala; sem brasão cai na inicial sobre a cor).
- **Bug pré-existente encontrado por medição:** `max-w-22 sm:max-w-32 md:max-w-none` nunca chegava a `none` — no CSS gerado o bloco `sm` sai depois do `md`/`lg` (o `@theme` redefine os breakpoints), logo `sm:*` ganha. Os nomes dos clubes ficavam truncados a 128px no desktop e, quando o painel era mais estreito que a tabela, as últimas colunas ficavam atrás de scroll (`clipping +113px` a 2 colunas no baseline a 1440). Corrigido: teto explícito em todas as linhas (`max-w-22 sm:max-w-48` no hero, `sm:max-w-32` nas compactas) e `title` com o nome completo; a armadilha ficou documentada em `STYLE.md` §7.
- Harness `standings-resp-test.jsx`: os fixtures de `topScorers` não tinham `division` → o `GoldenBootSidebar` devolvia `null` e a lista nunca apareceu nos screenshots; adicionadas as divisões, `crest` às equipas (duas sem brasão, para exercer o fallback) e equipas/resultados da Divisão 4.
- Verificação: `test:mobile -- standings-resp-test` PASS a 320/360/390/430 + desktop 1024/1184/1280/1440/1920 (0 overflow, 0 clippings — 320 com +11px informativo), screenshots 390 e 1440/1920 lidos; suite completa 175/180 — os 5 FAIL são do `playerhistory-resp-test`, quebrado e **anterior a esta mudança** (confirmado com os ficheiros em stash: falha igual); `eslint` limpo nos ficheiros · `check:types` 0 erros.
- ⚠️ Aberto (não é meu): o commit `46b3fd06` renomeou o export para `SLOTS_PER_SEASON` (privado) e deixou `SkillLineChart.jsx:4` e `scripts/skillHistoryRegression.mjs:20` a importar `MATCHWEEKS_PER_SEASON` de `utils/skillHistory.js` — o `PlayerHistoryModal` rebenta no browser (`does not provide an export named`) e o `test:skillhistory` também. → **Corrigido no commit seguinte** (ver entrada acima).

## Melhor Marcador: 4 prémios (um por divisão) e o prémio vai a quem sofreu os golos (2026-10-03)
- Pedido: um prémio de Melhor Marcador por divisão (eram 4 divisões visíveis). "Grill" a seguir revelou o buraco: comprar o goleador na última jornada dava-lhe o prémio (dinheiro + troféu + notícia), porque `players.goals` é um contador único por jogador e viaja com ele — não existia em lado nenhum atribuição golo→clube. Decisões do utilizador: **500.000€ fixos por divisão**, **valor cheio a cada empatado**, divisão 5 fora, **prémio ao clube onde marcou**, palmarés com divisão, sidebar por divisão.
- **Atribuição (`player_season_goals`, tabela nova + migração idempotente em `getGame`)**: `recordMatchGoal(fixture, playerId, teamId)` (2 call sites no engine, ambos com o lado; autogolos não creditam jogador; penáltis em jogo têm `teamId`) → acumulador `goalsByTeam` → flush transacional do apito final com `INSERT … ON CONFLICT(player_id, team_id) DO UPDATE SET goals = goals + excluded.goals`. Limpa no `resetPlayerSeasonStats`, a par de `players.goals` (o prémio é pago antes).
- **Regra** (`cupFlowHelpers.ts`): ranking por divisão sobre a atribuição (não sobre o clube atual), sem `LIMIT` (todos os empatados), 500k a cada, palmarés `Melhor Marcador — <divisão> (N golos)` com `player_id`, notícia e 1 CM por divisão com todos os nomes. Sala sem atribuição nenhuma (época a decorrer no deploy) cai no contador do jogador + clube atual. Um jogador só leva um troféu por divisão (transferência interna: fica no clube onde fecha a época) — meia época em dois escalões pode dar dois prémios, quirk aceite e documentado.
- **Bugs corrigidos pelo caminho**: o `LEFT JOIN teams` + `if (team_id)` antigos deixavam o vencedor sair sem prémio se o líder global fosse agente livre (JOIN passa a filtrar por divisão); `is_human_coach = 1` com `coach_name` = nome do jogador fazia o museu escrever «Treinador: <jogador>» na conquista do jogador; `gameManager.ts` reparava slots por `title IN ('Prémio de Melhor Marcador')` → `LIKE 'Prémio de Melhor Marcador%'` (o título passa a levar a divisão); a query dos `topScorers` estava duplicada em **4 sítios** → `fetchTopScorers` em `coreHelpers.ts` (`ROW_NUMBER() PARTITION BY division`, top 10, div 1–4 — a div 5 invisível sai do ranking).
- **UI**: modal de fim de época lista os 4 vencedores (empates incluídos), com o `topScorer` único mantido no payload para a app mobile atrasada; sidebar «Corrida ao Título de Goleador» passa a tabs D1–D4 (default = a minha divisão) com o `TabBar` partilhado; `TrophyCabinet.trophyKind` agrupa por divisão (como «Campeão Liga 3»), sem os golos na chave do ×N.
- **Verificação**: `test:topscorer` novo (45 checks: venda na J14 paga ao vendedor · compra sem golos pelo clube novo não paga · empate a 2 = 2×500k + 2 palmarés · div 5 e agente livre fora · divisão sem golos não paga · NPC sem notícia mas com palmarés · legado → clube atual · ranking da sidebar e top 10 por divisão · mesmo jogador/2 clubes na mesma divisão → 1 troféu) · `test:engine-unit` 25/25 (U12c novo: o flush escreve a atribuição; fixtures de deltas ganharam `goalsByTeam`) · `test:crash-recovery` PASS (flush transacional) · `typecheck` OK · `audit:socketio` 0 erros (101 warnings baseline) · `lint` limpo nos ficheiros (4 problemas pré-existentes) · `check:types` OK · `build` OK · `test:mobile` **180/180** (35 harnesses) + harness novo `seasonend-resp-test` (pior caso: 4 divisões com empates + Taça + subidas) e screenshots 390 lidos — os ícones não renderizam no harness (fonte ausente, igual nos harnesses antigos), a *não ser* regressão.
- `audit:gamestate FGPQH6` numa sala guardada: 82 erros/15 warnings, todos de drift da sala (budgets negativos, plantéis) — o ficheiro não é escrito por esta mudança, o prémio só corre no fim de época de uma sala viva; fica em aberto na próxima época real.
- Nota: a auditoria/crash-test abrem DBs de sala e o SQLite faz checkpoint do WAL ao fechar (3 ficheiros de `server/saves/` apareceram modificados) — restaurados com `git checkout -- server/saves` antes do commit.
- Custo assumido: 2 M€/época (+1,5 M€), mais 500k por cada empatado. `base.db` re-seeda (o `schema.sql` entra no template hash); salas nunca.

## Gráfico de skill: escala de 20 semanas (slots de calendário) (2026-10-03)
- Pedido: o gráfico de evolução de skill usava escala de 14 (jornadas de liga) mas os snapshots eram escritos em 3 escalas diferentes (slot de calendário 1..20 no `evolution.ts`, 0..19 no `trainingHelpers.ts`, jornada de liga no `cupFlowHelpers.ts`/ponto atual) → eixo X mal rotulado e comprimido. Decisão do utilizador: **escala de 20 semanas (slots de calendário), mostrar as últimas 20**.
- Servidor (escala canónica = slot 1..20): `trainingHelpers.ts` passa a escrever `completedCalendarIndex + 1` (alinha com `evolution.ts`); `cupFlowHelpers.ts` (decaimento fim de época) e o ponto atual em `socketSessionHandlers.ts` passam a `game.calendarIndex + 1`.
- Cliente: `skillHistory.js` — `SLOTS_PER_SEASON = 20`, `skillEpoch` clamp 1..20, janela = últimas 20, labels via `SEASON_CALENDAR` (`J4` liga, `T2` Taça, `Pré` amigável) em vez de `J{n}` genérico. `SkillLineChart`/modal usam o default (20) — sem prop `weeks`.
- Dados antigos (épocas 1–6 em escala mista) ficam como estão — sem migração; a janela de 20 cobre sobretudo a época atual (escala correta).
- Checks: server `typecheck` OK · client `lint` (4 problemas pré-existentes noutros) + `check:types` OK · simulação node do pipeline com BD real: 20 pontos, labels corretos (`Pré`, `J1`–`J14`, `T1`–`T5`), multi-época com prefixo de ano. Sem `test:mobile` (geometria do SVG inalterada).

## Filtro «Cabe no saldo» passa ao servidor (2026-10-02)
- Bug: com 200+ resultados, o filtro dizia que nada cabia no saldo. Causa: o servidor limita a 200 (ordenados dos mais cotados para baixo) e o filtro só-cliente escondia tudo o que via — os acessíveis nem chegavam ao cliente.
- `socketScoutHandlers.ts`: novo `onlyAffordable` — saldo lido da BD (`teams.budget`, nunca do cliente) com `preço-aquisição <= saldo` no SQL (mesmo preço dos filtros mín/máx); leilões com lance ao vivo acima do saldo caem após o enriquecimento (total pode contar mais 1 ou 2 nesses casos raros).
- `ScoutView.jsx`: envia `onlyAffordable`; clicar na checkbox com pesquisa feita repesquisa logo; `meta` volta ao total do servidor; refinamento cá fora fica só para os lances ao vivo.
- Checks: server `typecheck` OK · `audit:socketio` 0 erros (101 warnings, baseline) · `eslint` limpo no ficheiro · `check:types` OK · mesma linha de checkboxes → sem `test:mobile`.
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

## Adjunto com as novas jj1/jj2 (2026-10-02)
- Pedido: usar `docs/jj1.png` (boca fechada) e `docs/jj2.png` (boca aberta) no Treinador Adjunto.
- Implementação: ambas já trazem alfa real e olham para a direita dele (sem espelhar); recorte quadrado cabeça+ombros do topo → `jj-fechada.webp`/`jj-aberta.webp` 512×512 (~39KB). Componente intocado (fala em loop, sem círculo, entrada/saída faseada e máquina de escrever se mantêm).
- Checks: confirmação visual dos recortes; sem código alterado → sem `lint`/`check:types`/`test:mobile`.

## Notícias CM em rodapé + erros só no log (2026-10-02)
- Pedido: eliminar os avisos de erro (só log do servidor); fim de época + treinadores/equipas num rodapé vermelho breaking-news "Notícias CM" (sucessor do antigo Alerta CM, removido em junho).
- Servidor: 11 `systemMessage broadcast` marcados com `cm: true` (5 de treinadores em `coachDismissalHelpers.ts`, 6 de fim de época em `cupFlowHelpers.ts`); 3 `warning: true` trocados por `console.error` (`weeklyFlowHelpers.ts` ×2, `cupFlowHelpers.ts` ×1).
- Cliente: `cmNews` + `pushCmNews` no `GameContext` (teto 50, limpo ao sair da sala); `core.js` encaminha `broadcast+cm` para o rodapé; `RoomHub` ignora `cm` (fica só com pausa/lesão/Admin); `CmTicker.jsx` novo (scroll infinito em CSS, escondido em direto, por cima da `MobileNav`); `RoomNoticeBanner.jsx` + `subscribeRoomNotice` apagados; harness `gamebar-resp-test` atualizado (testava o banner removido).
- Checks: server `typecheck` OK · `audit:socketio` 0 erros · client `lint` só com o erro pré-existente (react-refresh no GameContext, já no HEAD) · `check:types` OK · `test:mobile` 175/175.
- WIP de mercado (`TransferHub.jsx`, filtro `showOwnMarketPlayers`) já estava commitado no HEAD — nada por commitar além desta tarefa.

## Notícias automáticas do rodapé (2026-10-02)
- Pedido: inventar notícias de rodapé dependentes de resultados/classificações; tipos=todas, tom=estilo CM, cobertura=todas as divisões, condição=só mudanças.
- Implementação: helper novo `server/cmNews.ts` (`emitCmNews`, `readCmLeaders`/`diffCmLeaders` pela ordenação oficial, `pickCmGoleada` com margem mínima 4, templates CM + `Intl` pt-PT); hooks em `weeklyFlowHelpers.ts` (snapshot de líderes antes da transação de `finalizeLeagueEvent`, emite novo líder + goleada após o persist), `auctionHelpers.ts` (venda fechada; `BOMBA` se superar `_cmTopSale` em memória) e `cupFlowHelpers.ts` (tomba-gigantes via `upsets` já calculados). Cliente intocado (ticker já consome `cm: true`).
- Checks: `typecheck` OK (1 erro de scope `cmLeadersBefore` corrigido via `_cmLeadersBefore` no `game`) · funções puras verificadas com `tsx` (líder, goleada, limiares, templates) · `audit:socketio` 0 erros (sem eventos novos).
- Nota: o utilizador estava a editar em paralelo (ex. `reduced-motion` no `CmTicker`) — commit só dos 5 caminhos do servidor + NOTES; ficheiros dele intactos.

## Deploy v26.10.9 no rick (2026-10-02)
- Tag `v26.10.9` (bump de APP_VERSION); push + rebuild com `backend Healthy`.
- Inclui: rodapé Notícias CM (passagem única + saída a deslizar) + notícias automáticas de jornada/mercado/Taça + erros de sala só no log.
- Salas de produção intactas; seed só recria `base.db` se o esquema/fixtures mudarem.

## Ticker passa 1x e esconde-se (2026-10-02)
- Pedido: cada notícia passa uma vez; sem notícias a barra esconde-se com movimento bonito; etiqueta vermelha mais pequena no mobile.
- Implementação: `CmTicker.jsx` reescrito — pendentes derivados de `shownIds` (estado, sem `ref` em render nem `setState` em efeitos: o `react-hooks/refs` e o `set-state-in-effect` chumbaram as 1.as versões); tira com `pl-[100%]` + `translateX(-100%)` de 1 iteração, duração ∝ carateres (60ms/car, mín. 6s); fim via `onAnimationEnd`; saída/entrada com slide do `AnimatePresence`; `reduced-motion` com keyframes estáticos de 5s (mesmo `animationend`, sem movimento); etiqueta `px-2 text-[10px]` no mobile.
- Checks: `eslint` limpo · `check:types` OK · `test:mobile` 175/175 (uma 1.ª passagem com 3 falhas flake, dois reruns limpos).

## Redesign do artigo do Jornal (2026-10-02)
- Pedido: notícias feias, botões encostados à margem — polimento para todas, intensidade de redesign mantendo o registo de imprensa.
- `JournalTab.jsx`: coluna de leitura centrada (`max-w-prose`, `px-4`/`sm:px-6`); links de entidades em pílula (`bg-primary/10` + `box-decoration-break:clone`, nunca colam às margens nem partem mal); tabelas centradas (`mx-auto`); manchete maior (`text-2xl`) com links em tinta simples (a pílula em corpo grande virava tijolo — visto em screenshot); zona de ações com mais respiro (`mt-5 pt-4`); cai o `lg:px-6` ad hoc do corpo.
- Checks: `eslint` limpo no ficheiro · `check:types` OK · `test:mobile` só `journal-resp-test` PASS 5/5 + screenshot 390 verificado; sem lógica de jogo/sockets → sem audits.

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

## Deploy v26.10.7 no rick (2026-10-02)
- Redesign artigo do Jornal, resync pós-join, filtros «só os meus»/«cabe no saldo», débitos a negativo/vermelho, estádio sem zoom; `backend Healthy`.

## Débitos da semana a negativo e vermelho (2026-10-02)
- Pedido: na notícia das contas da semana, os valores de Débito a negativo e vermelho.
- `JournalTab.jsx` (`WeeklyFinanceTable`): Salários, Manutenção, Juros e Capital marcados como `debit` — valor com sinal negativo (`-X €`, guarda contra `-0 €`) e `text-error`; Rendimento e Saldo como estavam (Saldo já pintava negativo/positivo).
- Checks: `eslint` limpo no ficheiro (3 erros pré-existentes noutros) · `check:types` OK · só `className`/texto → sem `test:mobile`; sem lógica de jogo/sockets → sem audits.

## Checkbox do Mercado passa a filtrar "só os meus" (2026-10-02)
- Bug: a checkbox "Mostrar só os meus à venda" nunca filtrava — o predicado (`team_id !== mine || (show && fixed)`) com a caixa marcada ADICIONAVA os meus aos dos outros em vez de mostrar só os meus (a renomeação para "só" expôs a divergência).
- Fix (`GameContext.jsx` `filteredMarketPlayers` + `TransferHub.jsx` `posCounts`, mesmo ternário nos dois): marcada → só os meus; desmarcada → esconde os meus (comportamento anterior).
- Checks: prova de semântica em node (marcada só meus, desmarcada só outros) · `check:types` OK · `eslint` só o erro pré-existente `react-refresh` no `GameContext.jsx` (provado no HEAD) · só predicados, sem layout → sem `test:mobile`; sem sockets/jogo → sem audits.
## Confete das celebrações passa a futebol (2026-10-03)
- Pedido: substituir os emojis de champanhe do confete por emojis mais soccer-friendly.
- `CelebrationBurst.jsx` (componente partilhado por contratação, golo, vitória, diálogos): `PARTICLES` passa de 🍾/🥂/✨/🎉/💫/🎊 para ⚽ ×4, 🥅 ×3, 🏆 ×3, ✨ ×2, 🎉/🎊 ×1 (14 partículas, mesma contagem); as duas garrafas grandes dos cantos tornam-se ⚽; JSDoc "Explosão de champanhe" → "Explosão de futebol".
- Checks: `lint` limpo no ficheiro (4 problemas pré-existentes noutros, provado com `git stash`) · `check:types` OK · só texto de emoji em spans existentes → sem `test:mobile`; sem lógica de jogo/sockets → sem audits.

## Balões do adjunto redesenhados + tamanho estável (2026-10-02)
- Pedido: balões redesenhados; nascer já com o tamanho do texto completo em vez de crescer a cada linha da máquina de escrever. Decisões: banda desenhada polida, altura final desde o início, dica + tutorial, JJ intocado.
- Dica (`AssistantCoach.jsx`) e tutorial (`CoachTutorial.jsx`): bordo 3px, `rounded-3xl`, sombra suave, respiro `p-4`, rabicho alinhado à nova espessura; parágrafo em duas camadas (texto integral invisível reserva a altura, digitado sobreposto em absoluto).
- Checks: `eslint` limpo nos 2 ficheiros · `check:types` OK · só polimento + reserva de altura (mesmo DOM/flex) → sem `test:mobile`; sem lógica/sockets → sem audits.

## Deploy v26.10.8 no rick (2026-10-02)
- Rodapé CM breaking-news, notícias automáticas, mascote jj1/jj2, filtros «só os meus»/«cabe no saldo» no servidor, micro-efeitos; `backend Healthy`.

## Relógio: urgência aos 75'/110' + centro em mobile (2026-10-02)
- Urgência passa de 85' para 75'–90' e 110'+ no prolongamento (`LiveClock.jsx`); fora disso quieto.
- Descentragem em mobile: o keyframe animava `transform: translateX(-50%)`, que no Tailwind v4 compõe com a propriedade `translate` do `-translate-x-1/2` (duplo -50%) — passa a animar só `scale`, que compõe bem.
- Checks: `eslint` + `check:types` OK · `test:mobile` 175/175 · harness temporária (apagada após uso) com 33'/80'/115' confirmou centro e limiares em captura 390.
- Nota: `CmTicker.jsx` tem alterações de outra mão por commitar na árvore (passagem única) — commit só com os 2 ficheiros meus.

## Pacote «impressionar sem pesar» — micro-efeitos por zona (2026-10-02)
- Só `transform`/`opacity` (+1 `background-position`), durações curtas, tudo parado com movimento reduzido; zero deps novas (`CountUp` em rAF próprio, framer-motion já cá estava).
- Jogo: `goal-shake` no marcador do `LiveMatchHero`/`CupFinalStage` (remount via key nos golos) + `liveclock-urgent` no `LiveClock` (85'+/prolongamento). Leilões: anel SVG na contagem decrescente (`AuctionCard`, esvazia nos últimos 60 s). Saldo: `CountUp.jsx` novo nos 3 widgets do `FinancesTab`. Troféus: varrimento dourado por `background-position` (`TrophyCabinet`) — a 1.ª versão com filho a transbordar chumbou `club`+`topwidgets` (linhas cortadas), corrigido sem transbordo. Taça: `bracket-draw` nas linhas + `champion-glow` + esqueletos `skeleton-shimmer` no loading (`CupBracketPage`). Jornal: `flag-pulse` na faixa das pendências. Estádio: holofotes em gradiente + zoom ténue em hover. `CmTicker` pausa com movimento reduzido.
- Saltado de propósito: tática (arrasto já tem escala/opacidade) e transições globais (`GameLayout` já tem `AnimatePresence` + `MotionConfig reducedMotion="user"`). Sem lógica de jogo/sockets → sem audits; `audit:gamestate` sem sala viva fica para a próxima.
- Checks: `eslint` limpo nos ficheiros · `check:types` OK · `test:mobile` PASS 175/175 (a regressão do troféu foi provada minha via worktree no HEAD: 10/10 PASS) + capturas 390 verificadas (hero, leilões, finanças, estádio).

## Ticker Notícias CM: fila 1-a-1, sem barra vazia, recorde persistente (2026-10-03)
- Audit da barra (código 8, conteúdo 9, layout 9) → 3 fixes: (1) replay — notícia nova a meio da fornada remontava a tira e repetia tudo; agora a notícia ativa é derivada (`items.find` por id não visto) e a chave da tira é estável durante a passagem, novidades entram na fila sem reiniciar; (2) barra vazia — removido o `pl-[100%]`, o texto aparece já visível e sai a deslizar para a esquerda, `duration = max(8s, chars×90ms)` é agora tempo de leitura real; (3) "recorde da sala" — `_cmTopSale` em memória (morria no restart) trocado por `cmIsRecordSale` (1 query no `transfer_history`: >1 venda e nenhuma ≥ ao valor), persistente.
- Keyframes `cmTickerPass`/`cmTickerStill` movidos do `<style>` inline para `index.css`; sombra superior na barra.
- Checks: `eslint` limpo · `check:types` OK · `test:mobile` 175/175 · `typecheck` OK · `tsx` da `cmIsRecordSale` 5/5 (1.ª venda ≠ recorde, maior = recorde, empate ≠ recorde).

## Adjunto: balão deixa de tapar o chrome mobile, regras testáveis (2026-10-03)
- Pedido: avaliação do módulo do Treinador-adjunto (código/conteúdo/layout) e plano de melhoria em 4 fases, aprovado.
- **F1 layout:** o balão vivia a `bottom-16` com `z-110` — mesmo ancoradouro do fly-up do menu mobile (`z-39`) e do rodapé Notícias CM (`h-8`, 64–96px) — e tapava as últimas linhas do menu; como também está acima do overlay do fly-up, o toque dispensava a dica em vez de escolher o item. Cala-se com `mobileSubMenu` aberto (`invisible`, **sem desmontar**, para não reiniciar a máquina de escrever; `AssistantCoach` passa `menuOpen`) e sobe para `bottom-24` (folga exata sobre o rodapé).
- Verificação do F1: o harness `assistant-resp-test` passa a mockar rodapé + fly-up e a amostrar `elementFromPoint`; **provou a colisão (6/6 pontos nas 5 larguras) antes do fix** e PASS depois. `mobileRespCheck.mjs` imprime as colisões no detalhe.
- **F2 conteúdo:** a frase do onze estava incompleta («Queres matar o jogo como?»); a dica médica falava de enfermaria para jogadores **castigados** (`isPlayerAvailable` conta lesão+castigo+cooldown); a dica do teto lia como mensagem de sistema → passou a voz de adjunto. CTA da redflag «Despachar já» → «Resolver já» (destino `jornal` confirmado: contratos, proposta e patrocínio vivem todos no Jornal, `SponsorChooseModal` montado no `JournalTab`).
- **F3 código:** as 7 dicas + prioridade + vistos saíram do `useMemo` de 22 deps (com `eslint-disable` e `dismissTick` a forçar re-render) para `utils/assistantTips.js` (`pickAssistantTip`, catálogo ordenado, `seenKeyFor`), com `assistantTips.test.mjs` (8 grupos, `npm run test:assistant`): prioridade, gate do onze, anti-Clippy, limiares e **o formato das chaves de visto em assert** (mudá-lo faz reaparecer todas as dicas já vistas em produção). `ASSISTANT_UNAVAILABLE_MIN = 3` e `FANS_MOOD_LOW/HIGH = 23/38` em `constants` — o `StadiumIllustration` repetia o 23 à mão. Estado vazio/por carregar deixou de inventar dicas (linha, treino e salário disparavam com campos ausentes).
- **F4 verificação:** o harness media um texto escrito à mão que já não existia → passa a construir o pior caso do catálogo real e **reprova se alguma dica não acender** (foi o que aconteceu: plantel no teto só da Forma com foco em Resistência acendia 6 de 7). A vista pura foi para `AssistantCoachView.jsx` (`AssistantCoach.jsx` reexporta) — importar o wrapper puxava o hook → `socket.js`, e o harness abria uma ligação socket.io falhada por largura (`resErr` 7-9 → 0-1, só o 404 pré-existente).
- Checks: `test:assistant` 8/8 · `test:trainingcap` 5/5 · `eslint` limpo nos ficheiros da tarefa (restam 2 pré-existentes: warning do `App.jsx`, erro do `GameContext.jsx`) · `check:types` OK (227 ficheiros) · `npm run build` OK · `test:mobile` **175/175** (passagem completa: ficheiro partilhado) + screenshots 320/390 revistos · nada em `server/` nem lógica de jogo/sockets → sem `typecheck` nem audits.
- Fica em aberto (cosmético, 1 token): em desktop o balão (`lg:bottom-6`) ainda cobre os 8px de topo do rodapé CM — padding vazio e barra não interativa; `lg:bottom-10` fecharia. Não entrou porque a posição em desktop não estava no plano aprovado.

## Classificação final: linhas saem do parágrafo de entrada (2026-10-03)
- Pedido: verificar formatação/conteúdo da notícia de classificação final (`league_final`); as linhas da tabela no corpo corriam dentro do parágrafo de entrada (lead) — capitular + `text-lg` + `text-justify` — porque o corpo usava `\n` simples (não `\n\n`) entre as linhas.
- Fix (`inboxItems.js` `leagueFinalArticle`): separar a intro das linhas da classificação com `\n\n`, de modo que as linhas fiquem num parágrafo não-lead (`text-base`, sem capitular). A tabela visual (`LeagueFinalTable` no `JournalTab`) já aparecia separada abaixo; as linhas do corpo são o texto pesquisável.
- Checks: `eslint` limpo no ficheiro (3 erros pré-existentes noutros) · `check:types` OK · regressão `journalDbNewsRegression` R8 8/8 (os 2 fails são de outros tipos de notícia, pré-existentes) · só texto num util → sem `test:mobile`; sem lógica de jogo/sockets → sem audits.

## Adjunto: busto cortado no peito e olhar para fora do ecrã (2026-10-03)
- Pedido: verificar se o corpo do boneco estava a ser cortado no peito e para que lado estava virado.
- Corte (medido, não a olho): o alfa chegava à última linha do canvas — 431 dos 512 px opacos em `jj-fechada`, 412 deles casaco — uma linha recta a meio do peito; e o tufo de cabelo tocava `y=0` (7-11 px). **Não era CSS** (nenhum `overflow-hidden` no caminho, asset quadrado em caixa quadrada): era o recorte «cabeça+ombros» do próprio ficheiro. O material com torso e braços cruzados estava em `docs/jj1.png`/`docs/jj2.png`.
- Regenerado a partir dessas metades: alinhamento pelo alfa (98.7%, dx=0), canvas 336×512 com 12px de folga no topo e 5px nas laterais. O corte passa a ser nos antebraços — é onde o desenho original acaba. 27KB por asset (eram 39KB).
- Caixa com o **aspecto do asset** (o `img` usa `object-fit: fill`): `h-[128px] w-[84px]`, desktop `lg:h-[156px] lg:w-[102px]`, medalhão do tutorial `h-[76px] w-[50px]` — mantém a altura de cabeça em ecrã que a caixa quadrada dava. Tutorial não tem harness: verificado por aritmética do aspecto (0.658 vs 0.656).
- **Direcção do olhar:** a fonte já olhava à direita (desvio da pupila em fracção da largura do globo **+0.30**, igual ao asset de produção). A minha 1.ª versão espelhou-a e ficou a olhar à esquerda (−0.30) — corrigida sem espelho. Método com prova de sanidade (espelhar inverte o sinal); a olho, nestes assets, engana (li a pupila nos dois sentidos a olho).
- Em desktop a dica põe o balão à esquerda do retrato (`lg:flex-row-reverse`): o boneco ficava de costas para o balão e a olhar para fora do ecrã (visto no render 1440×900). Prop `flipOnDesktop` no `AssistantMascot`, usada **só na vista da dica** — o tutorial tem o balão sempre à direita e não se espelha.
- Checks: `test:mobile` **175/175** (`resErr=0` no harness do adjunto) + screenshots 360 e 1440 lidos · `eslint` limpo nos ficheiros da tarefa (restam os 2 pré-existentes: `App.jsx`, `GameContext.jsx`) · `check:types` OK · `build` OK · sem server/jogo/sockets → sem `typecheck` nem audits. Nota: a passagem correu com `client/src/utils/inboxItems.js` modificado (trabalho em curso noutra sessão, fora destes commits e não tocado).

## Glow vermelho nos botões de contrato com pedido de renovação pendente (2026-10-03)
- Pedido: destacar os 2 botões (Aceitar renovação / Enviar para leilão) do `PlayerHistoryModal` quando há pedido de renovação do agente pendente.
- `PlayerHistoryModal.jsx`: ramo `hasPendingRequest` — `shadow-[0_0_14px_rgba(239,68,68,0.55)]` nos 2 botões (o `Button` já concatena `className`).
- Checks: `lint` limpo no ficheiro (4 problemas pré-existentes noutros) · `check:types` OK · tweak de `className` → sem `test:mobile`; sem lógica de jogo/sockets → sem audits.

## Tutorial do adjunto: anel no sítio certo e balão que não tapa o alvo (2026-10-11)
- Bug real (reproduzido em harness antes de mexer): o anel media o alvo a meio das animações e congelava (desalinhado 14–26px, anel fora do viewport) e o balão, fixo ao centro, tapava o próprio destaque em `club-staff`, `player-skills`, `tactic-titulares` e `tactic-play`.
- Novo `client/src/hooks/useTargetRect.js`: escolhe a primeira instância do alvo dentro do viewport (senão a primeira, trazida com `scrollIntoView` instantâneo), re-mede por frame até o rect assentar (com teto) e fica preso a `ResizeObserver`/`scroll`/`resize`/`visualViewport`; o rect publicado leva o passo consigo, por isso um publish atrasado do passo anterior nunca pinta o anel errado.
- `CoachTutorial.jsx`: destaque passa a um único anel com `box-shadow: 0 0 0 100vmax` clampado ao viewport (transição suave entre passos), o balão escolhe o lado com mais folga (alvo em baixo → balão em cima; passo final centrado) e fica **um** boneco (saiu a prop `compact`, mesmos breakpoints da dica normal). O FAB mobile ganhou `data-tour="tactic-play-fab"` (era o 2.º `tactic-play`).
- Verificação: harness novo `client/tutorial-resp-test.{html,jsx}` (stub do shell + fly-up animado + os 11 passos à ida e à volta) — **antes** falhava 8 de 15 medições, agora PASS de 320 a 1440px; `test:mobile` **185/185** (3 passagens seguidas) · `lint` só os 4 pré-existentes · `check:types` 0 · screenshots a olho (320/390/414) — a 320 o balão estourava o ecrã e ganhou `min-w-0` + botões com `flex-wrap`.

## Jornal: plano de melhorias executado (F1–F5, só cliente) (2026-10-04)
- `JournalTab.jsx` (1288 linhas) partido em `views/journal/` (`tones`, `utils`, `ArticleBody`, `ArticleTables`, `ArticleActions`, `NewsMedia`, `TopicList`); `useInbox` ganha `preview` (selecionar sem marcar lida) e `inboxItems` passa `viewerTeamId` à `league_final` — zero backend.
- Uso: setas/j/k com roving tabindex, seleção cai sempre no visível, contadores por filtro, pesquisa mantém-se ao trocar de filtro e destaca no detalhe, rodapé Anterior/Seguinte + estado vazio, sem `mode="wait"`; texto à esquerda, capitular só com texto inicial, links `font-bold`; tabelas com zonas subida/descida (2/2, regra do servidor), equipa destacada, `caption`/`scope`, `vs` na Taça, finanças Receitas/Despesas + Saldo forte; barra de ação única sticky (2 passos no Recusar→leilão, busy em job/board, «Resolvido» nas respondidas).
- Saltado e porquê: blocos `list`/`quote`/`keyfacts` (servidor não emite) · navegação «Ver jogador/classificação/finanças» (exigia `onNavigate` novo) · mini-crests inline (peso visual) — tudo registado como decisão no plano.
- Checks: `lint` + `check:types` 0 · `test:mobile` **185/185** · `journalDbNewsRegression` com os mesmos 2 FAILs do HEAD (provado com `git stash`: R2 categoria + media do sorteio) · screenshots 390 lidos. Nota: a Fase 1 tinha largado a nota «Empréstimo liquidado» — reposta na Fase 4.

## Skills: diagnóstico de bugs e retrospetiva (2026-10-04)
- Avaliado o repo `mattpocock/skills` (40+ skills para Claude Code/Codex, assumem issue tracker e sub-agentes). Importadas **só 2**, escritas de raiz em pt-PT em vez de copiadas.
- `.pi/skills/diagnosing-bugs/SKILL.md` (dispara sozinha): **loop vermelho primeiro** com o catálogo de reprodutores cá (`audit:gamestate <ROOM_CODE>`, `audit:session`, `test:crash-recovery`, `test:session-freeze`, `test:connect-smoke`, `test:engine-unit`, harnesses mobile) → minimizar → 3–5 hipóteses falsificáveis → uma variável por vez (`[DEBUG-xxxx]`) → regressão no seam correto (sem seam = achado) → limpeza + hipótese no commit. Embutida a regra "jamais fixar por hipótese".
- `.pi/skills/retro/SKILL.md` (só `/skill:retro`): candidatos por categoria (navegação, checks que faltam, regra mecânica → check em vez de prosa, teto do `AGENTS.md`/`NOTES.md`, economia de ferramentas, no-ops, acesso a informação), ordenados por gravidade, aplicados só com OK.
- Verificação: frontmatter dos 2 SKILL.md parseado com o `yaml` do pi (nomes válidos; descrições 236 e 151 chars ≤1024) — markdown não leva `typecheck`/`lint`/`test:mobile`.

## Race conditions do flow: janelas × modais (2026-10-07)
- Fila de transações por sala (`runRoomTask`), fecho que falha volta ao lobby do mesmo slot, fim de época retomável por passos (`applied_weeks` + `game_state`), Pronto/barreira do 11 e concorrência entre treinadores, carências em slots, popups vs fase no cliente e 3 verificações novas no `audit:gamestate`. Plano: `docs/plans/2026-10-07-race-conditions-flow.md`.
- Porquê: uma só ligação SQLite fazia transações alheias colidirem; quebras a meio do fecho/fim de época repetiam prémios ou deixavam a sala presa.
- Testado: typecheck, lint, check:types, `test:room-tx` (novo), `test:crash-recovery` (S6/S7), `test:session-freeze` (F16/F17), `test:finalize` E2E, `test:connect-smoke`, `audit:socketio`. `test:staff` (NPC de D1 sem auxiliar) e lint do `landing-resp-test.jsx` já falhavam antes.
