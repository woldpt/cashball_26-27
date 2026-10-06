# Plano — novas notícias do Jornal

> Decidido com o utilizador em 2026-10-06. Cada fase é um commit.

## Âmbito

| Ideia | Decisão |
|---|---|
| Resumo da jornada | não |
| Homem do Jogo | **dentro do rescaldo** (linha + cartão do jogador) |
| Marcos de jogadores | sim: **hat-trick** (3+ golos num jogo) e **golos de carreira** (50, 100, 150…) |
| Evolução do treino | sim, semanal, **só o atributo `skill`** (ganhos e perdas) |
| Avisos (contratos/suspensão) | não |
| Eliminação/passagem na Taça | **dentro do rescaldo** (+ «nos penáltis») |
| Rival no mercado | não |

## Fase 1 — servidor: notícias `training_report` e `milestone`

- Novo `server/progressNewsHelpers.ts` com `logProgressNews(game, fixtures, completedCalendarIndex)`, chamado logo a seguir ao `applyTrainingBonuses` (liga em `weeklyFlowHelpers`, Taça/amigável em `cupFlowHelpers`).
- `training_report`: compara `players.skill` com o `player_skill_snapshots` da semana anterior (só equipas humanas, só `skill`); uma notícia por equipa e semana (`logClubNewsOnce`, slot explícito). Factos em JSON `v:1`.
- `milestone`: hat-trick a partir de `fixture.events`; golos de carreira a partir de `players.career_goals` (limiares múltiplos de 50, idempotente por `(player_id, amount)`).
- Funções puras exportadas + `scripts/progressNewsRegression.mts`.

## Fase 2 — servidor: rescaldo com MOM e desfecho da Taça

- `PostMatchRecap` ganha `mom` (do `computeMoms`) e `penalties`; entram no JSON do rescaldo (campos omitidos quando vazios → notícias antigas intactas).
- 3 blocos de chamada (liga, Taça, amigável).

## Fase 3 — cliente

- `inboxItems.js`: artigos `training_report` e `milestone` (categoria Plantel); rescaldo com linha «Homem do Jogo» (cartão do jogador) e frase de desfecho da Taça.
- Tabela do treino com `JournalTable` (sobem/descem), alinhada ao resto.
