# 📋 Lista de Ficheiros — CashBall 26/27

Inventário de todos os ficheiros do projecto (sem `node_modules`/`.git`) com a função principal de cada um.

---

## 🏠 Raiz do Projecto

| Ficheiro | Função principal |
| :--- | :--- |
| `AGENTS.md` | Manual de operações rápidas para agentes: comandos, prevenção de regressões, padrões de lógica complexa e workflow de commits. |
| `CLAUDE.md` | Documentação técnica e padrões de engenharia (arquitetura). |
| `README.md` | Descrição geral do produto (jogo de gestão de futebol multiplayer assíncrono). |
| `STYLE.md` | Design system e diretrizes de estilo visual (tokens, tipografia, cards, badges). |
| `.skillsrc` | Referência rápida (fonte) dos skills de auditoria/validação. |
| `block.txt` | Fragmento de código (snippet do `LandingPage` no `App.jsx`). |
| `docker-compose.yml` | Orquestração de containers (Frontend + Backend + DB). ✅ Auditado |
| `package.json` | Workspace raiz (deps: pi-lens, MCP SDK, rpiv-btw). ✅ Auditado |
| `package-lock.json` | Lockfile do workspace raiz. |
| `.gitignore` | Ficheiros ignorados pelo git. ✅ Auditado |


### `.opencode/` (configuração OpenCode)
| Ficheiro | Função principal |
| :--- | :--- |
| `.opencode/.gitignore` | Ignora artefactos locais do OpenCode. |
| `.opencode/package.json` | Deps do OpenCode. |
| `.opencode/package-lock.json` | Lockfile do OpenCode. |
| `.opencode/plans/fix-halftime-black-screen.md` | Plano: fix do ecrã preto no intervalo. |
| `.opencode/plans/tactic-start-and-bench.md` | Plano: tática inicial e banco. |
| `.opencode/skills/auto-commit/SKILL.md` | Skill de commit automático (cópia local). |

---

## 🖥️ Client (`client/`)

### Configuração & Build
| Ficheiro | Função principal |
| :--- | :--- |
| `client/Dockerfile` | Imagem do frontend (nginx). ✅ Auditado |
| `client/nginx.conf` | Configuração do nginx (servir build + proxy). ✅ Auditado |
| `client/.gitignore` | Ignora artefactos do client. ✅ Auditado |
| `client/eslint.config.js` | Configuração do ESLint. ✅ Auditado |
| `client/index.html` | HTML de entrada do Vite. ✅ Auditado |
| `client/package.json` | Deps e scripts do frontend (Vite/React). ✅ Auditado |
| `client/package-lock.json` | Lockfile do frontend. |
| `client/vite.config.js` | Configuração do Vite. ✅ Auditado |

### Testes / Harness (fora da app)
| Ficheiro | Função principal |
| :--- | :--- |
| `client/intervencao-test.html` | Harness HTML para screenshots/verificação do `IntervencaoView`. ✅ Auditado |
| `client/intervencao-test.jsx` | Renderiza o `IntervencaoView` real com dados mock (modo intervalo). ✅ Auditado |
| `client/mobile-resp-test.html` | Harness HTML de responsividade mobile. ✅ Auditado |
| `client/mobile-resp-test.jsx` | Renderiza o `PlayersTab` real com fixtures de edge-case; reporta overflow horizontal. ✅ Auditado |
| `client/scout-resp-test.html` | Harness HTML de responsividade mobile (Scout). ✅ Auditado |
| `client/scout-resp-test.jsx` | Renderiza o `PlayerSearchView` real; reporta overflow horizontal. ✅ Auditado |

### `client/scripts/`
| Ficheiro | Função principal |
| :--- | :--- |
| `client/scripts/cupEtListRegression.mjs` | Teste de regressão: equipas com coach humano na lista de jogos do prolongamento da Taça. ✅ Auditado |
| `client/scripts/jsDocTypeChecker.cjs` | Verificador de anotações de tipo JSDoc nos componentes React. ✅ Auditado |
| `client/scripts/skillHistoryRegression.mjs` | Teste de regressão: gráfico de evolução da skill em jogos com várias épocas. ✅ Auditado |
| `client/scripts/teamSquadCalendarRegression.mjs` | Teste de regressão: calendário das outras equipas na aba Calendário do `TeamSquadView`. ✅ Auditado |

### `client/public/`
| Ficheiro | Função principal |
| :--- | :--- |
| `client/public/favicon.svg` | Favicon da app. ✅ Auditado |
| `client/public/icons.svg` | Sprite de ícones. ✅ Auditado |

### `client/src/` — Núcleo
| Ficheiro | Função principal |
| :--- | :--- |
| `client/src/main.jsx` | Ponto de entrada React (mount). ✅ Auditado |
| `client/src/App.jsx` | Componente raiz; gere o estado de autenticação (Auth State) e o `GameLayout`. ✅ Auditado |
| `client/src/GameLayout.jsx` | Layout principal do jogo (tabs, header, modais, sidebar, mobile nav). ✅ Auditado |
| `client/src/socket.js` | Cliente Socket.io (instância partilhada). ✅ Auditado |
| `client/src/index.css` | Estilos globais (Tailwind + tokens). ✅ Auditado |
| `client/src/countryFlags.js` | Mapeamento de bandeiras por país (emojis). ✅ Auditado |
| `client/src/constants/index.js` | Constantes partilhadas (`SEASON_CALENDAR`, cores, tiers, etc.). ✅ Auditado |

### `client/src/contexts/`
| Ficheiro | Função principal |
| :--- | :--- |
| `client/src/contexts/GameContext.jsx` | Fonte de verdade do estado do jogo (players, finances, match phase, etc.). ✅ Auditado |
| `client/src/contexts/TacticsContext.jsx` | Estado da UI de táticas (drag-and-drop, seleção); consome o `GameContext`. ✅ Auditado |

### `client/src/hooks/`
| Ficheiro | Função principal |
| :--- | :--- |
| `client/src/hooks/useSocketListeners.js` | Hook com os listeners Socket.io partilhados. ✅ Auditado |

### `client/src/utils/`
| Ficheiro | Função principal |
| :--- | :--- |
| `client/src/utils/audio.js` | Tons de notificação (Web Audio API). ✅ Auditado |
| `client/src/utils/cacheVersion.js` | Gestão de versão de cache/localStorage (limpeza com preservação de sessões). ✅ Auditado |
| `client/src/utils/colorHelpers.js` | Helpers de cor (normalização hex, anéis por posição). ✅ Auditado |
| `client/src/utils/fixtures.js` | Gerador de fixtures round-robin (espelha o `engine.ts` do servidor). ✅ Auditado |
| `client/src/utils/formatters.js` | Formatação de moeda/datas (pt-PT). ✅ Auditado |
| `client/src/utils/localStorage.js` | Leitura/escrita de sessões (admin) em localStorage. ✅ Auditado |
| `client/src/utils/playerHelpers.js` | Helpers de jogadores (stats, tiers AGG). ✅ Auditado |
| `client/src/utils/standingsRank.js` | Comparador de classificação (idêntico ao servidor) + tendência de posições. ✅ Auditado |
| `client/src/utils/teamHelpers.js` | Helpers de equipas (normalização de IDs, cores do ticker). ✅ Auditado |

### `client/src/pages/`
| Ficheiro | Função principal |
| :--- | :--- |
| `client/src/pages/AuctionsPage.jsx` | Página de leilões ativos e recentes. ✅ Auditado |
| `client/src/pages/UserSettingsPage.jsx` | Página de definições do utilizador. ✅ Auditado |

### `client/src/views/` (abas do jogo)
| Ficheiro | Função principal |
| :--- | :--- |
| `client/src/views/BracketTab.jsx` | Aba do bracket da Taça (usa `CupBracketPage`). ✅ Auditado |
| `client/src/views/CalendarioTab.jsx` | Aba do calendário da época (liga + taça). ✅ Auditado |
| `client/src/views/ClubTab.jsx` | Aba do clube (estádio, infraestruturas). ✅ Auditado |
| `client/src/views/CupTab.jsx` | Aba da Taça (resultados por ronda). |
| `client/src/views/FinancesTab.jsx` | Aba de finanças (orçamento, salários, receitas). |
| `client/src/views/PlayerSearchView.jsx` | Vista de pesquisa de jogadores (Scout). |
| `client/src/views/PlayersTab.jsx` | Aba de jogadores (referência de implementação do design system). |
| `client/src/views/StadiumTab.jsx` | Aba do estádio (capacidades, receitas). |
| `client/src/views/StandingsTab.jsx` | Aba da classificação (usa `LeagueStandings`). |
| `client/src/views/TacticsView.jsx` | Vista de táticas (formação, mentalidade, briefing). |
| `client/src/views/TeamHistoryView.jsx` | Histórico da equipa (transferências, eventos). |
| `client/src/views/TeamSquadView.jsx` | Vista em ecrã inteiro do plantel (abas: plantel, calendário, etc.). |
| `client/src/views/TrainingTab.jsx` | Aba de treino (usa `TrainingPage`). |

### `client/src/components/` — por subpasta

**`admin/`**
| Ficheiro | Função principal |
| :--- | :--- |
| `client/src/components/admin/AdminPanel.jsx` | Painel de administração. |

**`auctions/`**
| Ficheiro | Função principal |
| :--- | :--- |
| `client/src/components/auctions/AuctionCard.jsx` | Card de leilão (lances, estado). |

**`auth/`**
| Ficheiro | Função principal |
| :--- | :--- |
| `client/src/components/auth/LandingPage.jsx` | Página de entrada (login/criar conta/juntar sala). |

**`chat/`**
| Ficheiro | Função principal |
| :--- | :--- |
| `client/src/components/chat/RoomHub.jsx` | Chat da sala. |

**`live/`**
| Ficheiro | Função principal |
| :--- | :--- |
| `client/src/components/live/index.js` | Barrel de exports dos componentes live. |
| `client/src/components/live/LiveFixtureRow.jsx` | Linha de jogo em direto. |
| `client/src/components/live/liveHelpers.js` | Helpers dos componentes live. |
| `client/src/components/live/LiveMatchHero.jsx` | Hero do jogo em direto (resultado, fases). |
| `client/src/components/live/LiveStandings.jsx` | Classificação em direto. |
| `client/src/components/live/MatchBriefing.jsx` | Briefing pré-jogo (formações, odds). |
| `client/src/components/live/TeamCrest.jsx` | Escudo/crest da equipa. |

**`match/`**
| Ficheiro | Função principal |
| :--- | :--- |
| `client/src/components/match/matchConstants.js` | Constantes da vista de jogo. |
| `client/src/components/match/MatchPage.jsx` | Página do jogo (orquestra as tabs). |
| `client/src/components/match/MatchTabs.jsx` | Tabs do jogo (Jogo / Intervenção). |

**`match/shared/`**
| Ficheiro | Função principal |
| :--- | :--- |
| `client/src/components/match/shared/index.js` | Barrel de exports partilhados do match. |
| `client/src/components/match/shared/BenchPlayers.jsx` | Jogadores do banco. |
| `client/src/components/match/shared/Button.jsx` | Wrappers `PrimaryButton`/`GhostButton` do Button partilhado. |
| `client/src/components/match/shared/ConfirmedSubsStrip.jsx` | Faixa de substituições confirmadas. |
| `client/src/components/match/shared/EventCard.jsx` | Card de evento do jogo. |
| `client/src/components/match/shared/FatigueIndicator.jsx` | Indicador de fadiga. |
| `client/src/components/match/shared/MatchIcon.jsx` | Ícones SVG inline (chevron, swap, reset, etc.). |
| `client/src/components/match/shared/MatchPitch.jsx` | Campo de jogo. |
| `client/src/components/match/shared/MatchPlayerCard.jsx` | Linha de jogador (draggable). |
| `client/src/components/match/shared/PitchFormation.jsx` | Formação no campo. |
| `client/src/components/match/shared/PossessionBar.jsx` | Barra de posse de bola. |
| `client/src/components/match/shared/PreMatchIntro.jsx` | Introdução pré-jogo. |
| `client/src/components/match/shared/RefWeatherBar.jsx` | Barra de árbitro/clima. |
| `client/src/components/match/shared/TacticsButtons.jsx` | Botões de táticas. |

**`match/tabs/`**
| Ficheiro | Função principal |
| :--- | :--- |
| `client/src/components/match/tabs/index.js` | Barrel de exports das tabs do match. |
| `client/src/components/match/tabs/IntervencaoView.jsx` | Vista de intervenção (substituições, tática no intervalo). |
| `client/src/components/match/tabs/MatchView.jsx` | Vista do jogo em curso. |

**`modals/`**
| Ficheiro | Função principal |
| :--- | :--- |
| `client/src/components/modals/CoachMarketModal.jsx` | Mercado de treinadores. |
| `client/src/components/modals/CupDrawPopup.jsx` | Sorteio da Taça. |
| `client/src/components/modals/DismissalModal.jsx` | Demissão de treinador. |
| `client/src/components/modals/JobOfferModal.jsx` | Proposta de trabalho (treinador). |
| `client/src/components/modals/PenaltyShootoutPopup.jsx` | Prolongamento de penáltis. |
| `client/src/components/modals/PenaltySuspensePopup.jsx` | Suspense de penáltis. |
| `client/src/components/modals/PenaltyTakerPopup.jsx` | Escolha do marcador de penáltis. |
| `client/src/components/modals/PlayerHistoryModal.jsx` | Histórico do jogador. |
| `client/src/components/modals/positionConstants.js` | Constantes de posições. |
| `client/src/components/modals/PostMatchMoodModal.jsx` | Clima pós-jogo. |
| `client/src/components/modals/SeasonEndModal.jsx` | Fim de época. |
| `client/src/components/modals/SigningCelebrationModal.jsx` | Celebração de contratação. |
| `client/src/components/modals/SkillLineChart.jsx` | Gráfico de linha de skills. |
| `client/src/components/modals/TeamSquadModal.jsx` | Plantel da equipa (modal). |
| `client/src/components/modals/TransferProposalModal.jsx` | Proposta de transferência. |
| `client/src/components/modals/WaitingCoachesModal.jsx` | Espera de treinadores. |
| `client/src/components/modals/WelcomeModal.jsx` | Boas-vindas. |

**`shared/`**
| Ficheiro | Função principal |
| :--- | :--- |
| `client/src/components/shared/AggBadge.jsx` | Badge de tier AGG. |
| `client/src/components/shared/Badge.jsx` | Badge genérico. |
| `client/src/components/shared/BalanceLineChart.jsx` | Gráfico de linha do saldo. |
| `client/src/components/shared/Button.jsx` | Botão base (o "real" Button do design system). |
| `client/src/components/shared/CelebrationBurst.jsx` | Efeito de celebração. |
| `client/src/components/shared/EmptyState.jsx` | Estado vazio padronizado. |
| `client/src/components/shared/GameDialog.jsx` | Diálogo de jogo. |
| `client/src/components/shared/ModalShell.jsx` | Shell de modais (⚠️ `visible` não impede avaliação dos children). |
| `client/src/components/shared/OddsBadge.jsx` | Badge de odds. |
| `client/src/components/shared/Panel.jsx` | Card/painel base. |
| `client/src/components/shared/PlayerAvatar.jsx` | Avatar do jogador (⚠️ proibido `clipPath`). ✅ Auditado |
| `client/src/components/shared/PlayerLink.jsx` | Link para jogador (abre histórico). |
| `client/src/components/shared/PlayerRow.jsx` | Linha de jogador. |
| `client/src/components/shared/PlayerStatusBadges.jsx` | Badges de estado do jogador. |
| `client/src/components/shared/StatTile.jsx` | Tile de estatística. |
| `client/src/components/shared/SummaryWidget.jsx` | Widget de resumo. |
| `client/src/components/shared/TabBar.jsx` | Barra de tabs. |
| `client/src/components/shared/TrendArrow.jsx` | Seta de tendência (subida/descida). |

**`ui/`**
| Ficheiro | Função principal |
| :--- | :--- |
| `client/src/components/ui/CupBracketPage.jsx` | Página do bracket da Taça. |
| `client/src/components/ui/LeagueStandings.jsx` | Tabela de classificação. |
| `client/src/components/ui/TrainingPage.jsx` | Página de treino. |
| `client/src/components/ui/TransferHub.jsx` | Hub de transferências (mercado, leilões, propostas). |

### `client/src/assets/`
| Ficheiro | Função principal |
| :--- | :--- |
| `client/src/assets/estadio5000.jpg` | Imagem do estádio (capacidade 5000). |
| `client/src/assets/estadio15000.jpg` | Imagem do estádio (capacidade 15000). |
| `client/src/assets/estadio30000.jpg` | Imagem do estádio (capacidade 30000). |
| `client/src/assets/estadio50000.jpg` | Imagem do estádio (capacidade 50000). |

### `client/dist/` (build de produção — gerado)
| Ficheiro | Função principal |
| :--- | :--- |
| `client/dist/index.html` | HTML de produção. |
| `client/dist/assets/index-*.js` | Bundle JS de produção. |
| `client/dist/assets/index-*.css` | CSS de produção. |
| `client/dist/assets/estadio*.jpg` | Imagens de estádio (hashadas). |
| `client/dist/favicon.svg` | Favicon de produção. |
| `client/dist/icons.svg` | Sprite de ícones de produção. |

---

## 🖧 Server (`server/`)

### Configuração & Build
| Ficheiro | Função principal |
| :--- | :--- |
| `server/Dockerfile` | Imagem do backend. ✅ Auditado |
| `server/.dockerignore` | Ignora artefactos no Docker. |
| `server/entrypoint.sh` | Entrypoint do container (re-seed automático via `ensureSeeded.js`). |
| `server/.env` | Variáveis de ambiente (local). |
| `server/.env.example` | Exemplo de variáveis de ambiente. |
| `server/package.json` | Deps e scripts do backend (dev, build, seed, auditorias). ✅ Auditado |
| `server/package-lock.json` | Lockfile do backend. |
| `server/tsconfig.json` | Configuração do TypeScript. |

### Núcleo
| Ficheiro | Função principal |
| :--- | :--- |
| `server/index.ts` | Ponto de entrada do servidor (HTTP + Socket.io). |
| `server/auth.js` | Autenticação de treinadores (SQLite `accounts.db`). |
| `server/adminRoutes.js` | Rotas de administração (spawn, gestão de salas). |
| `server/gameManager.ts` | Gestão de jogos ativos (carga/persistência de salas). |
| `server/coreHelpers.ts` | Helpers centrais (form, notícias, lotação, etc.). |
| `server/gameConstants.ts` | Constantes do jogo (`SEASON_CALENDAR`, salários, leilões, etc.). |
| `server/types.ts` | Tipos TypeScript partilhados. |
| `server/logBootstrap.js` | Patch do console (logging padronizado). |

### `server/game/` (motor de simulação)
| Ficheiro | Função principal |
| :--- | :--- |
| `server/game/engine.ts` | Motor de simulação (jogadores, banco, juniores, fixtures). ✅ Auditado |
| `server/game/matchCalculations.ts` | Cálculos do jogo (táctica AI, multiplicadores de golo/clima, normalização de estilo). ✅ Auditado |
| `server/game/commentary.ts` | Narração em português (frases de golo/cartões/subs) + odds de apostas. ✅ Auditado |
| `server/game/playerUtils.ts` | Utilitários de jogadores (nomes de juniores, etc.). ✅ Auditado |
| `server/game/tacticFamiliarity.ts` | Memória táctica (estrelas por formação, janela rolante). ✅ Auditado |

### Helpers de domínio (raiz do server)
| Ficheiro | Função principal |
| :--- | :--- |
| `server/auctionHelpers.ts` | Lógica de leilões (lances, NPCs). |
| `server/coachDismissalHelpers.ts` | Demissão de treinadores. |
| `server/contractHelpers.ts` | Contratos (renovação, salários, agentes). |
| `server/cupFlowHelpers.ts` | Fluxo da Taça (sorteio, rondas, final, ET, penalties, season end). ✅ Auditado |
| `server/matchFlowHelpers.ts` | Fluxo do jogo (fases, simulação). |
| `server/matchSummaryHelpers.ts` | Resumo pós-jogo (táctica, lotação, odds). |
| `server/npcTransferHelpers.ts` | Transferências de NPCs. |
| `server/presenceHelpers.ts` | Presença de treinadores (awaiting coaches). |
| `server/trainingHelpers.ts` | Treino (progresso, resultados). |
| `server/weeklyFlowHelpers.ts` | Fluxo semanal (calendário, jornadas, halftime, finalização). ✅ Auditado |

### Handlers Socket.io
| Ficheiro | Função principal |
| :--- | :--- |
| `server/socketAdminHandlers.ts` | Eventos de administração. |
| `server/socketChatHandlers.ts` | Eventos de chat. |
| `server/socketCupHandlers.ts` | Eventos da Taça. |
| `server/socketFinanceHandlers.ts` | Eventos de finanças. |
| `server/socketGameplayHandlers.ts` | Eventos de gameplay. |
| `server/socketScoutHandlers.ts` | Eventos de scout/pesquisa. |
| `server/socketSessionHandlers.ts` | Eventos de sessão (auth, join). |
| `server/socketTrainingHandlers.ts` | Eventos de treino. |
| `server/socketTransferHandlers.ts` | Eventos de transferências. ✅ Auditado |
| `server/socketEventRegistry.json` | Mapa de eventos Socket.io (gerado pelo validator). |

### `server/db/`
| Ficheiro | Função principal |
| :--- | :--- |
| `server/db/database.js` | Conexão SQLite (resolve caminho relativo ao root). |
| `server/db/globalDatabase.ts` | Base de dados global (chat global). |
| `server/db/init.js` | Inicialização da base de dados. |
| `server/db/seed.js` | Seed da base de dados (fixtures, equipas, jogadores). |
| `server/db/ensureSeeded.js` | Decide se o `base.db` precisa de re-seed no arranque (hash de fixtures). |
| `server/db/schema.sql` | Schema SQL. |
| `server/db/accounts.db` | Base de contas (autenticação). |
| `server/db/base.db` | Template de novas salas. |
| `server/db/global_chat.db` | Chat global. |
| `server/db/game_445WU8.db` | Base de dados de uma sala específica. |
| `server/db/fixtures/all_teams.json` | Fixture: todas as equipas. |
| `server/db/fixtures/candidates_2026_27.json` | Plantéis 2026/27 (extraídos do zerozero). |
| `server/db/fixtures/referees.json` | Fixture: árbitros. |

### `server/scripts/`
| Ficheiro | Função principal |
| :--- | :--- |
| `server/scripts/fetchZerozeroSquads.ts` | Extrai plantéis 2026/27 do zerozero.pt para as fixtures. |
| `server/scripts/gameStateAudit.ts` | Auditoria de integridade do estado do jogo (budgets, squads, fases). |
| `server/scripts/socketioContractValidator.ts` | Validador de contratos Socket.io (orphaned/duplicate handlers). |
| `server/scripts/repairDuplicateJobOffer.ts` | Reparação de propostas de trabalho duplicadas. |
| `server/scripts/repairDuplicateJobOfferTUI.ts` | Variante TUI do reparador de propostas duplicadas. |
| `server/scripts/repair-duplicate-job-offer.sh` | Wrapper shell do reparador. |
| `server/scripts/attendanceRegression.mts` | Regressão: lotação do estádio reflete a forma da equipa. |
| `server/scripts/contractRenewalRegression.mts` | Regressão: renovação de contratos (modal obrigatório, 1 proposta/semana). |
| `server/scripts/contractYearRegression.mts` | Regressão: designação de contratos ("Ano 1, J1" → "2026, Jornada 1"). |
| `server/scripts/skillHistoryRegression.mts` | Regressão: histórico de skill preserva a época em jogos com várias épocas. |
| `server/scripts/trainingMultiSeasonRegression.mts` | Regressão: estado do treino corrompe em jogos multi-época. |
| `server/scripts/trainingReportRegression.mts` | Regressão: resultado do treino deixa de ser exibido. |

### `server/dist/` (build de produção — gerado)
| Ficheiro | Função principal |
| :--- | :--- |
| `server/dist/*.js` | Versões compiladas (JS) de todos os módulos `.ts` acima. |
| `server/dist/db/*.js` | Compilados dos módulos de base de dados. |
| `server/dist/game/*.js` | Compilados do motor de simulação. |
| `server/dist/scripts/*.js` | Compilados dos scripts de auditoria/regressão. |

---

> **Nota:** `client/dist/` e `server/dist/` são artefactos de build (gerados por `npm run build`), não código-fonte. Os ficheiros `*.db` em `server/db/` são bases de dados SQLite locais.
