# 📂 Estrutura do Repositório CashBall 26/27

Este ficheiro fornece uma visão detalhada da organização de ficheiros e diretórios do projeto.

## 🏠 Raiz do Projeto

| Ficheiro/Pasta       | Descrição                                                   |
| :------------------- | :---------------------------------------------------------- |
| `AGENTS.md`          | Manual de operações e prevenção de regressões para agentes. |
| `CLAUDE.md`          | Documentação técnica e padrões de engenharia.               |
| `DESIGN.md`          | Diretrizes de design e workflow com Stitch AI.              |
| `README.md`          | Descrição geral do produto.                                 |
| `docker-compose.yml` | Orquestração de containers (Frontend + Backend + DB).       |
| `package.json`       | Dependências e scripts do workspace/root.                   |
| `SUMMARY.md`         | Resumo do progresso e estado atual.                         |

---

## 🖥️ Frontend (`/client`)

Aplica React 19 com Vite. Gerencia a interface do utilizador e a comunicação em tempo real.

### 📁 `/src` (Código Fonte)

| Pasta/Ficheiro          | Descrição                                                                                                                                                                                                                                                                                                |
| :---------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `App.jsx`               | Orquestrador principal (Autenticação e Providers).                                                                                                                                                                                                                                                       |
| `GameLayout.jsx`        | Container principal da interface de jogo (Stateless).                                                                                                                                                                                                                                                    |
| `main.jsx`              | Entry point do React.                                                                                                                                                                                                                                                                                    |
| `socket.js`             | Singleton para conexão Socket.io.                                                                                                                                                                                                                                                                        |
| `contexts/`             | **Gestão de estado global**                                                                                                                                                                                                                                                                              |
| └─ `GameContext.jsx`    | Core game state (players, finances, match phase, etc.).                                                                                                                                                                                                                                                  |
| └─ `TacticsContext.jsx` | UI state e lógica de táticas.                                                                                                                                                                                                                                                                            |
| `views/`                | **Componentes de abas principais**                                                                                                                                                                                                                                                                       |
| ├─ `BracketTab.jsx`     | Visualização de chaves de copas.                                                                                                                                                                                                                                                                         |
| ├─ `CalendarioTab.jsx`  | Calendário de jogos.                                                                                                                                                                                                                                                                                     |
| ├─ `ClubTab.jsx`        | Informações do clube.                                                                                                                                                                                                                                                                                    |
| ├─ `CupTab.jsx`         | Visão das copas.                                                                                                                                                                                                                                                                                         |
| ├─ `FinancesTab.jsx`    | Gestão financeira.                                                                                                                                                                                                                                                                                       |
| ├─ `MarketTab.jsx`      | Mercado de jogadores.                                                                                                                                                                                                                                                                                    |
| ├─ `PlayersTab.jsx`     | Lista de jogadores do plantel.                                                                                                                                                                                                                                                                           |
| ├─ `StandingsTab.jsx`   | Tabela de classificação.                                                                                                                                                                                                                                                                                 |
| ├─ `TacticsView.jsx`    | Interface de configuração tática.                                                                                                                                                                                                                                                                        |
| ├─ `TeamSquadView.jsx`  | Visualização do plantel atual.                                                                                                                                                                                                                                                                           |
| ├─ `TrainingTab.jsx`    | Gestão de treinos.                                                                                                                                                                                                                                                                                       |
| `components/`           | **Componentes de UI e Modais**                                                                                                                                                                                                                                                                           |
| ├─ `auth/`              | `LandingPage.jsx`                                                                                                                                                                                                                                                                                        |
| ├─ `chat/`              | `RoomHub.jsx`                                                                                                                                                                                                                                                                                            |
| ├─ `match/`             | `MatchPage.jsx`, `MatchTabs.jsx`                                                                                                                                                                                                                                                                         |
| ├─ `modals/`            | `CupDrawPopup.jsx`, `DismissalModal.jsx`, `JobOfferModal.jsx`, `MatchPanel.jsx`, `PenaltyShootoutPopup.jsx`, `PenaltySuspensePopup.jsx`, `PlayerHistoryModal.jsx`, `RefereePopup.jsx`, `SeasonEndModal.jsx`, `SkillLineChart.jsx`, `TeamSquadModal.jsx`, `TransferProposalModal.jsx`, `WelcomeModal.jsx` |
| ├─ `shared/`            | `AggBadge.jsx`, `GameDialog.jsx`, `PlayerAvatar.jsx`, `PlayerLink.jsx`                                                                                                                                                                                                                                   |
| ├─ `ui/`                | `AuctionNotification.jsx`, `CupBracketPage.jsx`, `LeagueStandings.jsx`, `NewsTicker.jsx`, `PageTransition.jsx`, `TrainingPage.jsx`, `TransferHub.jsx`                                                                                                                                                    |
| `hooks/`                | Hooks personalizados (ex: `useSocketListeners.js`).                                                                                                                                                                                                                                                      |
| `constants/`            | Constantes de negócio e configuração.                                                                                                                                                                                                                                                                    |
| `utils/`                | Helpers de formatação e utilitários.                                                                                                                                                                                                                                                                     |
| `pages/`                | `AuctionsPage.jsx`, `UserSettingsPage.jsx`                                                                                                                                                                                                                                                               |

---

## ⚙️ Backend (`/server`)

Aplicação Node.js com TypeScript. Gerencia a simulação do jogo, base de dados e sockets.

### 📁 `/game` (Motor de Simulação)

| Ficheiro               | Descrição                                                   |
| :--------------------- | :---------------------------------------------------------- |
| `engine.ts`            | O coração da simulação (processamento de minutos, eventos). |
| `commentary.ts`        | Gerador de narração de jogo.                                |
| `playerUtils.ts`       | Lógica de cálculo de atributos e performance de jogadores.  |
| `matchCalculations.ts` | Cálculos complexos de resultados e estatísticas de jogo.    |
| `tacticFamiliarity.ts` | Lógica de familiaridade tática.                             |

### 📁 `/db` (Base de Dados)

| Ficheiro      | Descrição                                         |
| :------------ | :------------------------------------------------ |
| `schema.sql`  | Definição das tabelas SQLite.                     |
| `database.js` | Conexão e pool de base de dados.                  |
| `seed.js`     | Scripts para popular a base de dados para testes. |

### 📁 Lógica de Negócio e Sockets

| Ficheiro         | Descrição                                                                                      |
| :--------------- | :--------------------------------------------------------------------------------------------- |
| `gameManager.ts` | Ciclo de vida das salas e gestão de estados.                                                   |
| `*Handlers.ts`   | Registos de domínios de socket (ex: `socketTransferHandlers.ts`, `socketGameplayHandlers.ts`). |
| `*Helpers.ts`    | Lógica de negócio via Factory Pattern (ex: `auctionHelpers.ts`, `trainingHelpers.ts`).         |
| `auth.js`        | Lógica de autenticação e proteção de rotas.                                                    |

### 📁 `/scripts` (Ferramentas de Auditoria)

| Ficheiro                       | Descrição                                              |
| :----------------------------- | :----------------------------------------------------- |
| `gameStateAudit.ts`            | Auditoria de integridade da base de dados e orçamento. |
| `socketioContractValidator.ts` | Validador de contratos de eventos socket.              |

---

## 🛠️ Ferramentas de Desenvolvimento

- **Auditorias**: Scripts integrados para garantir que o estado do jogo e os contratos de socket permanecem consistentes.
- **Docker**: Ambiente completo para desenvolvimento e deployment.
- **Stitch AI**: Fluxo de trabalho para prototipagem de UI de alta fidelidade.
