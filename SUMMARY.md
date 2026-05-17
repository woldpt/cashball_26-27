# Project Directory Summary

**Data de geração:** 2026-05-13  
**Projeto:** wsball_26-27 — Football Manager Game (React + Node.js)

---

## Contagem Total

| Categoria | Contagem |
|---|---|
| **Ficheiros (sem node_modules)** | 198 |
| **Pastas (sem node_modules)** | 37 |
| **Ficheiros TypeScript (.ts)** | 31 |
| **Ficheiros JavaScript (.js)** | 59 |
| **Ficheiros JSX (.jsx)** | 41 |
| **Ficheiros JSON (.json)** | 13 |
| **Ficheiros Markdown (.md)** | 12 |
| **Ficheiros SQL (.sql)** | 1 |
| **Ficheiros DB (.db)** | 6 |
| **Ficheiros HTML (.html)** | 2 |
| **Ficheiros CSS (.css)** | 3 |
| **Ficheiros Imagens (.png/.jpg/.svg)** | 16 |
| **Ficheiros Shell (.sh)** | 1 |
| **Ficheiros YML/YAML (.yml)** | 1 |
| **Ficheiros Log (.log)** | 1 |
| **Ficheiros Env (.env*)** | 2 |
| **Ficheiros Config (.config.*)** | 4 |
| **Ficheiros Dockerfile** | 2 |
| **Ficheiros .dockerignore** | 1 |
| **Ficheiros .gitignore** | 2 |
| **Ficheiros tsconfig** | 1 |
| **Ficheiros Screenshot** | 1 |
| **Ficheiros Outros** | 1 |
| | |
| **Total (sem node_modules)** | **198** |
| **Total (com node_modules)** | **~8,725** |

---

## Resumo por Secção

| Secção | Ficheiros (sem nm) | Descrição |
|---|---|---|
| `client/` | ~100 | Frontend React + Vite |
| `server/` | ~60 | Backend Node.js + Express + Socket.IO |
| `server/dist/` | 37 | JavaScript compilado (TypeScript) |
| `server/node_modules/` | 2,342 | Dependências do servidor |
| `client/node_modules/` | 5,757 | Dependências do cliente |
| `.opencode/` | ~10 | Planos e configurações de IA |
| `node_modules/` | 1 | Dependência raiz |

---

## Árvore de Ficheiros e Pastas

### 📁 Raiz do Projeto (`/`)

```
.
├── AGENTS.md                          # Documentação de agentes
├── CLAUDE.md                          # Configuração Claude
├── README.md                          # Documentação principal
├── SKILLS.md                          # Skills do projeto
├── docker-compose.yml                 # Configuração Docker
├── package.json                       # Dependências raiz
├── package-lock.json                  # Lockfile raiz
├── .gitignore                         # Regras de ignorar do Git
├── .skillsrc                          # Configuração de skills
├── .schema players                    # Schema de jogadores
├── Screenshot_2026-05-12-22-10-54-118_com.brave.browser.jpg  # Screenshot
│
├── 📁 .claude/
│   └── settings.local.json            # Configurações locais Claude
│
├── 📁 .opencode/
│   ├── .gitignore
│   ├── package.json
│   ├── package-lock.json
│   └── 📁 plans/
│       ├── fix-halftime-black-screen.md    # Plano: corrigir ecrã preto no intervalo
│       └── tactic-start-and-bench.md       # Plano: tática início e banco
│
├── 📁 .vscode/
│   └── mcp.json                         # Configuração MCP (Model Context Protocol)
│
├── 📁 node_modules/                     # Dependências raiz (1 ficheiro)
│
├── 📁 client/                           # FRONTEND — React + Vite
│   ├── Dockerfile                       # Imagem Docker do cliente
│   ├── eslint.config.js                 # Configuração ESLint
│   ├── .gitignore
│   ├── index.html                       # HTML principal
│   ├── nginx.conf                       # Configuração Nginx
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.js                   # Configuração Vite
│   ├── README.md
│   │
│   ├── 📁 dist/                         # Build de produção (9 ficheiros)
│   │   ├── favicon.svg
│   │   ├── icons.svg
│   │   ├── index.html
│   │   └── 📁 assets/
│   │       ├── index-ChrzorAd.js        # JS compilado
│   │       ├── index-Cv5l5bs3.css       # CSS compilado
│   │       ├── estadio5000.jpg
│   │       ├── estadio15000.jpg
│   │       ├── estadio30000.jpg
│   │       └── estadio50000.jpg
│   │
│   ├── 📁 node_modules/                 # Dependências do cliente (5,757 ficheiros)
│   │
│   ├── 📁 public/                       # Ficheiros públicos estáticos
│   │   ├── favicon.svg
│   │   └── icons.svg
│   │
│   ├── 📁 scripts/                      # Scripts auxiliares
│   │   ├── README.md
│   │   └── jsDocTypeChecker.js          # Verificador de tipos JSDoc
│   │
│   └── 📁 src/                          # Código-fonte do cliente
│       ├── App.css                      # Estilos globais
│       ├── App.jsx                      # Componente raiz da aplicação
│       ├── index.css                    # CSS base
│       ├── main.jsx                     # Ponto de entrada React
│       ├── countryFlags.js              # Bandeiras dos países
│       ├── socket.js                    # Configuração Socket.IO
│       │
│       ├── 📁 assets/                   # Recursos estáticos
│       │   ├── hero.png
│       │   ├── react.svg
│       │   ├── vite.svg
│       │   ├── estadio5000.jpg
│       │   ├── estadio15000.jpg
│       │   ├── estadio30000.jpg
│       │   └── estadio50000.jpg
│       │
│       ├── 📁 components/               # Componentes React
│       │   │
│       │   ├── 📁 chat/                 # Componentes de chat
│       │   │   └── RoomHub.jsx          # Hub de salas de chat
│       │   │
│       │   ├── 📁 match/                # Componentes de partida
│       │   │   ├── MatchPage.jsx        # Página principal da partida
│       │   │   └── MatchTabs.jsx        # Tabs da partida
│       │   │
│       │   ├── 📁 modals/               # Modais e popups
│       │   │   ├── CupDrawPopup.jsx     # Sorteio da taça
│       │   │   ├── DismissalModal.jsx   # Modal de despedida
│       │   │   ├── JobOfferModal.jsx    # Modal de oferta de emprego
│       │   │   ├── MatchPanel.jsx       # Painel da partida
│       │   │   ├── PenaltyShootoutPopup.jsx  # Penalty shootout
│       │   │   ├── PenaltySuspensePopup.jsx  # Suspense de penalty
│       │   │   ├── PlayerHistoryModal.jsx    # Histórico do jogador
│       │   │   ├── positionConstants.js    # Constantes de posições
│       │   │   ├── RefereePopup.jsx       # Modal de árbitro
│       │   │   ├── SeasonEndModal.jsx     # Fim de temporada
│       │   │   ├── SkillLineChart.jsx     # Gráfico de skills
│       │   │   ├── TeamSquadModal.jsx     # Elenco da equipa
│       │   │   ├── TransferProposalModal.jsx  # Proposta de transferência
│       │   │   └── WelcomeModal.jsx       # Modal de boas-vindas
│       │   │
│       │   ├── 📁 shared/               # Componentes partilhados
│       │   │   ├── AggBadge.jsx         # Badge agregado
│       │   │   ├── GameDialog.jsx       # Diálogo de jogo
│       │   │   ├── PlayerAvatar.jsx     # Avatar do jogador
│       │   │   └── PlayerLink.jsx       # Link do jogador
│       │   │
│       │   └── 📁 ui/                   # Componentes de interface
│       │       ├── AuctionNotification.jsx  # Notificação de leilão
│       │       ├── CMTV.md              # Documentação CMTV
│       │       ├── CupBracketPage.jsx   # Página do bracket da taça
│       │       ├── LeagueStandings.jsx  # Classificação da liga
│       │       ├── LOL.md               # Documentação LOL
│       │       ├── NewsTicker.jsx       # Ticker de notícias
│       │       ├── PageTransition.jsx   # Transição de página
│       │       ├── REDCARPET.md         # Documentação Red Carpet
│       │       ├── TrainingPage.jsx     # Página de treino
│       │       └── TransferHub.jsx      # Hub de transferências
│       │
│       ├── 📁 constants/                # Constantes globais
│       │   └── index.js
│       │
│       ├── 📁 hooks/                    # Custom hooks
│       │   └── useSocketListeners.js    # Listeners de Socket.IO
│       │
│       ├── 📁 pages/                    # Páginas da aplicação
│       │   ├── AuctionsPage.jsx         # Página de leilões
│       │   └── UserSettingsPage.jsx     # Definições do utilizador
│       │
│       ├── 📁 utils/                    # Funções utilitárias
│       │   ├── audio.js                 # Utilitários de áudio
│       │   ├── cacheVersion.js          # Versão de cache
│       │   ├── fixtures.js              # Utilitários de fixtures
│       │   ├── formatters.js            # Formatadores
│       │   ├── localStorage.js          # localStorage helpers
│       │   ├── playerHelpers.js         # Helpers de jogadores
│       │   └── teamHelpers.js           # Helpers de equipas
│       │
│       └── 📁 views/                    # Views principais (tabs)
│           ├── BracketTab.jsx           # Tab do bracket
│           ├── CalendarioTab.jsx        # Tab do calendário
│           ├── ClubTab.jsx              # Tab do clube
│           ├── CupTab.jsx               # Tab da taça
│           ├── FinancesTab.jsx          # Tab de finanças
│           ├── MarketTab.jsx            # Tab do mercado
│           ├── PlayersTab.jsx           # Tab de jogadores
│           ├── StandingsTab.jsx         # Tab de classificações
│           ├── TeamSquadView.jsx        # Visualização do elenco
│           └── TrainingTab.jsx          # Tab de treino
│
├── 📁 server/                           # BACKEND — Node.js + Express + Socket.IO
│   ├── Dockerfile                       # Imagem Docker do servidor
│   ├── entrypoint.sh                    # Script de entrada Docker
│   ├── .dockerignore
│   ├── .env                             # Variáveis de ambiente
│   ├── .env.example                     # Exemplo de variáveis de ambiente
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json                    # Configuração TypeScript
│   ├── server.log                       # Log do servidor
│   │
│   ├── 📁 node_modules/                 # Dependências do servidor (2,342 ficheiros)
│   │
│   ├── 📁 dist/                         # JavaScript compilado (37 ficheiros)
│   │   ├── index.js                     # Ponto de entrada
│   │   ├── adminRoutes.js
│   │   ├── auctionHelpers.js
│   │   ├── auth.js
│   │   ├── coachDismissalHelpers.js
│   │   ├── contractHelpers.js
│   │   ├── coreHelpers.js
│   │   ├── cupFlowHelpers.js
│   │   ├── cupHelpers.js
│   │   ├── gameConstants.js
│   │   ├── gameManager.js
│   │   ├── logBootstrap.js
│   │   ├── matchFlowHelpers.js
│   │   ├── matchSummaryHelpers.js
│   │   ├── npcTransferHelpers.js
│   │   ├── presenceHelpers.js
│   │   ├── socketChatHandlers.js
│   │   ├── socketCupHandlers.js
│   │   ├── socketFinanceHandlers.js
│   │   ├── socketGameplayHandlers.js
│   │   ├── socketSessionHandlers.js
│   │   ├── socketTrainingHandlers.js
│   │   ├── socketTransferHandlers.js
│   │   ├── trainingHelpers.js
│   │   ├── types.js
│   │   ├── weeklyFlowHelpers.js
│   │   ├── 📁 db/                       # DB compilado
│   │   │   ├── database.js
│   │   │   ├── globalDatabase.js
│   │   │   ├── init.js
│   │   │   └── seed.js
│   │   ├── 📁 game/                     # Game engine compilado
│   │   │   ├── commentary.js
│   │   │   ├── engine.js
│   │   │   ├── matchCalculations.js
│   │   │   ├── playerUtils.js
│   │   │   └── tacticFamiliarity.js
│   │   └── 📁 scripts/                  # Scripts compilados
│   │       ├── gameStateAudit.js
│   │       └── socketioContractValidator.js
│   │
│   ├── 📁 db/                           # Base de dados SQLite
│   │   ├── database.js                  # Módulo de base de dados
│   │   ├── globalDatabase.ts            # Base de dados global
│   │   ├── init.js                      # Inicialização da BD
│   │   ├── seed.js                      # Seed da BD
│   │   ├── schema.sql                   # Esquema SQL
│   │   ├── accounts.db                  # Base de dados de contas
│   │   ├── base.db                      # Base de dados base
│   │   ├── global_chat.db               # Chat global
│   │   ├── game_50W89M.db               # Base de dados de jogo (partida)
│   │   ├── game_YAH2SH.db               # Base de dados de jogo (partida)
│   │   ├── test-room.db                 # Base de dados de teste
│   │   │
│   │   └── 📁 fixtures/                 # Dados de fixtures
│   │       ├── all_teams.json           # Todas as equipas
│   │       └── referees.json            # Árbitros
│   │
│   ├── 📁 game/                         # Motor do jogo
│   │   ├── engine.ts                    # Motor principal do jogo
│   │   ├── commentary.ts                # Comentários em direto
│   │   ├── gameConstants.ts             # Constantes do jogo
│   │   ├── gameManager.ts               # Gestor de jogos
│   │   ├── matchCalculations.ts         # Cálculos de partidas
│   │   ├── playerUtils.ts               # Utilitários de jogadores
│   │   └── tacticFamiliarity.ts         # Familiaridade tática
│   │
│   ├── 📁 scripts/                      # Scripts auxiliares do servidor
│   │   ├── README.md
│   │   ├── gameStateAudit.ts            # Auditoria do estado do jogo
│   │   └── socketioContractValidator.ts # Validador de contrato Socket.IO
│   │
│   ├── index.ts                         # Ponto de entrada do servidor
│   ├── auth.js                          # Autenticação
│   ├── logBootstrap.js                  # Bootstrap de logs
│   │
│   ├── types.ts                         # Tipos TypeScript globais
│   │
│   ├── auctionHelpers.ts                # Helpers de leilões
│   ├── coachDismissalHelpers.ts         # Helpers de despedida de treinadores
│   ├── contractHelpers.ts               # Helpers de contratos
│   ├── coreHelpers.ts                   # Helpers centrais
│   ├── cupFlowHelpers.ts                # Helpers do fluxo da taça
│   ├── cupHelpers.ts                    # Helpers de taça
│   ├── matchFlowHelpers.ts              # Helpers do fluxo de partidas
│   ├── matchSummaryHelpers.ts           # Helpers de resumo de partidas
│   ├── npcTransferHelpers.ts            # Helpers de transferências NPC
│   ├── presenceHelpers.ts               # Helpers de presença
│   ├── trainingHelpers.ts               # Helpers de treino
│   ├── weeklyFlowHelpers.ts             # Helpers de fluxo semanal
│   │
│   ├── socketChatHandlers.ts            # Handlers de chat (Socket.IO)
│   ├── socketCupHandlers.ts             # Handlers de taça (Socket.IO)
│   ├── socketFinanceHandlers.ts         # Handlers de finanças (Socket.IO)
│   ├── socketGameplayHandlers.ts        # Handlers de gameplay (Socket.IO)
│   ├── socketSessionHandlers.ts         # Handlers de sessão (Socket.IO)
│   ├── socketTrainingHandlers.ts        # Handlers de treino (Socket.IO)
│   └── socketTransferHandlers.ts        # Handlers de transferências (Socket.IO)
```

---

## Tecnologias Utilizadas

### Frontend (`client/`)
- **React 19** com JSX
- **Vite** como bundler
- **Socket.IO Client** para comunicação em tempo real
- **Framer Motion** para animações
- **ESLint** para linting
- **Nginx** como servidor de produção

### Backend (`server/`)
- **Node.js** com TypeScript
- **Express** como framework web
- **Socket.IO** para WebSockets
- **SQLite** (via `better-sqlite3`) para base de dados
- **WS** para WebSockets
- **tsx** para execução TypeScript

### Infraestrutura
- **Docker** + **Docker Compose** para containerização
- **Nginx** para reverse proxy do frontend

---

## Arquitetura do Jogo

O projeto é um **Football Manager Online** com as seguintes funcionalidades:

| Módulo | Descrição |
|---|---|
| **Partidas** | Motor de simulação de jogos em tempo real com comentários |
| **Transferências** | Mercado de transferências com NPCs e leilões |
| **Contratos** | Gestão de contratos de jogadores e treinadores |
| **Finanças** | Gestão financeira do clube |
| **Taça** | Bracket e fluxo de competições |
| **Treino** | Sistema de treino de jogadores |
| **Chat** | Chat global em tempo real |
| **Sessões** | Gestão de sessões de jogo |

---

## Notas

- `node_modules/` foi excluído da contagem principal (total ~8,725 ficheiros com node_modules)
- `server/dist/` contém o JavaScript compilado a partir de TypeScript
- `client/dist/` contém o build de produção do frontend
- `server/db/*.db` são ficheiros de base de dados SQLite em uso
- `.opencode/plans/` contém planos de desenvolvimento gerados por IA
