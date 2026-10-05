# Links para a página do clube em todos os nomes de clubes

## Contexto
A página de clube já existe (`views/OtherSquadsTab.jsx`, aberta por `handleOpenTeamSquad` em `contexts/GameContext.jsx:1214`, com histórico do browser A→B→C). Hoje só está ligada em alguns sítios; noutros o nome do clube é texto morto. Objetivo: qualquer nome de clube relevante leva à página dele.

## Levantamento

**Já ligados (não mexer):** classificação (`LeagueStandings` linhas da tabela), `CupBracketPage`/`BracketTab`, `CalendarioTab`, `MatchBriefing` (DuelHero/CompareRadar), `TeamHistoryView`, `OtherSquadsTab` (adversários/histórico), jornal (`journal/ArticleTables.jsx`, `journal/NewsMedia.jsx`).

**Por ligar — bons candidatos:**
| Local | O que aparece |
|---|---|
| `components/ui/LeagueStandings.jsx:~509-522` e `~596` | nome do clube nos melhores marcadores e na lista de treinadores |
| `components/modals/PlayerHistoryModal.jsx:226` | clube atual do jogador |
| `components/modals/PlayerHistoryModal.jsx:604-605` | clubes de origem/destino no histórico de transferências |
| `components/ui/TransferHub.jsx:96-145` | vendedor / comprador |
| `components/auctions/AuctionCard.jsx:104,306` | clube vendedor, "Vendido a X" |
| `components/auctions/AuctionResultRow.jsx:66,129,138` | origem / comprador |
| `views/ClubTab.jsx:82` | notícias "de/para X" (`related_team_name`) |
| `views/FinancesTab.jsx:450,500,599` | adversário da bilheteira, clube nas transferências |
| `components/modals/SeasonEndModal.jsx:250,299,349` | campeões, vencedor da Taça, clube dos marcadores |
| `components/modals/CoachMarketModal.jsx:78,191` | clube que oferece / despediu |

**Excluídos de propósito:** jogo ao vivo (`MatchPage`, `MatchView`, `LiveFixtureRow`, `EventCard`, `PenaltyShootoutPopup`, `CupDrawPopup`) — navegar a meio do jogo/sorteio é disruptivo; `GameHeader`/`ClubTab` cabeçalho (é o próprio clube); `WelcomeModal`, `DismissalModal`, `WaitingCoachesModal`, `PenaltyTakerPopup`, auth/admin/settings (fora do contexto de sala ou fluxo bloqueante).

## Abordagem
1. Novo `components/shared/TeamLink.jsx`, espelho de `PlayerLink.jsx`:
   `TeamLink({ teamId, children, onNavigate })` → `useGame()` para `teams` + `handleOpenTeamSquad` + `me`; resolve `teams.find(t => isSameTeamId(t.id, teamId))` (`utils/teamHelpers.js`); sem id/equipa → `<>{children}</>`; equipa própria → `navigateTab("players")` (mesmo padrão de `GameRoutes.jsx:496`). `onNavigate` opcional para fechar o modal antes de navegar.
2. Envolver o nome em cada local da tabela com `<TeamLink teamId={…}>`. Onde só há nome (sem id), verificar se o payload do servidor já traz `*_team_id`; se não trouxer, adicionar o id ao SELECT respetivo (provável em histórico de transferências / `related_team_id`, season-end).
3. Modais: passar `onNavigate={onClose}`.
4. Gravar cópia deste plano em `docs/plans/2026-10-05-links-clubes.md`; commit por passo.

## Verificação
- `npm run check:types` e build do cliente.
- Manual (`/run`): clicar em cada local da tabela → abre página do clube certo; "Voltar" regressa; modais fecham; clicar no próprio clube vai para o plantel.
