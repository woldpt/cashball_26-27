# Capitães de Equipa (2026-10-09)

## Objetivo
Cada equipa tem um capitão, mas a vantagem depende de **quem** é: um veterano
respeitado puxa pela equipa; um miúdo recém-chegado ou um jogador descontente
quase não ajuda (ou até prejudica). Assim a escolha conta, mesmo com todos a ter capitão.

## Decisões do utilizador
- Efeito real no jogo, mas diferenciado pela qualidade do capitão (não um bónus igual para todos).
- O treinador escolhe; se não escolher, é automático (NPCs sempre automático).
- O capitão **não** passa a bater os penáltis por defeito.

## Regras
- **Liderança (0–100)**, calculada (sem coluna nova na BD) a partir de:
  idade, jogos de carreira (`career_games`) e tempo no clube (`joined_matchweek`/`contract_start_epoch`).
  Fórmula exata a afinar com simulação.
- **Efeito em campo:** fator extra no ataque/defesa em `computeTeamPower`
  (`matchCalculations.ts`), ao lado da moral: `1 + (liderança-50)/50 × 2%` aprox.
  A moral do capitão multiplica: capitão com moral baixa (< neutro) dá efeito
  negativo. Teto pequeno (±2–3%) — ajusta, não decide.
- **Sai de campo** (sub, lesão, expulsão): a braçadeira passa ao titular com maior
  liderança; narração anuncia. Um capitão expulso também baixa a moral da equipa (efeito existente do vermelho).
- **Automático:** titular com maior liderança.

## Ficheiros
- `server/game/matchCalculations.ts` — fator do capitão + função `leadershipOf(player)`.
- `server/gameConstants.ts` — constantes em `MATCH_TUNING` (peso, teto).
- `server/game/engine.ts` — ler `tactic.captainId`, validar (titular?), passagem em `removeFromPitch`/`swapOnPitch`.
- `server/socketGameplayHandlers.ts` — `setTactic` aceita/valida `captainId` (vai com a tática no assento, sobrevive a restarts).
- `server/game/commentary.ts` — frases (braçadeira passa, capitão puxa pela equipa).
- `client/src/views/TacticsView.jsx` (+ `TacticsContext.jsx`) — braçadeira "C" num titular, toque para escolher; mostrar liderança.
- Jogo ao vivo: "C" junto ao nome do capitão.

## Verificação
- server `typecheck`, `test:engine-unit`, `test:connect-smoke`, `audit:socketio`, `audit:gamestate <sala>`.
- client `lint`, `check:types`, `test:mobile` (táticas).
- Simulação: % de vitórias com capitão forte vs fraco (alvo: diferença pequena, ~1–3 pp).
