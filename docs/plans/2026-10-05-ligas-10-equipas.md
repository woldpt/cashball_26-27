# Ligas de 10 equipas + 32 avos da Taça (2026-10-05)

## Decisões
- 10 equipas por divisão (sorteio 60→50 da base.db) → 18 jornadas.
- Taça com nova ronda «32 avos de final» (ronda 1) que inclui os Distritais.
  - Isentas (entram nos 16 avos): D1 inteira + 4 melhores da D2 pela época anterior
    (`teams.last_season_rank`; 1.ª época: média de skill).
  - 32 avos: 36 equipas (6 da D2, D3, D4, D5) → 18 vencedores + 14 isentas = 32.
- Época = 25 semanas: amigável + 18 jornadas + 6 rondas (Taça após as jornadas 3, 6, 9, 12, 15 e 18).
- Final passa a ronda 6 (`CUP_FINAL_ROUND`).
- Salas antigas serão apagadas → sem migração.

## Mudanças
- `gameConstants.ts`: `TEAMS_PER_DIVISION`, `LEAGUE_MATCHWEEKS`, `SEASON_WEEKS`, `CUP_FINAL_ROUND`; calendário de 25; contratos/NPC em `SEASON_WEEKS`.
- `coreHelpers.getCupExemptTeamIds`; sorteio (`cupFlowHelpers.generateCupDraw`) e amigáveis (`socketCupHandlers`).
- `round === 5` → `CUP_FINAL_ROUND` em servidor e cliente; prémios por ronda e multiplicador de adeptos com uma ronda a mais.
- Patrocínio B pago em `SEASON_WEEKS`; 2.ª tranche C no slot 12.
- Cliente: calendário, `SEASON_JORNADAS=18`, `SEASON_WEEKS=25`, `SEASON_HOME_MATCHES=9`, bracket com 6 rondas.
