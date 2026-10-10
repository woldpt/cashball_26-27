# Plano — Posse de bola em percentagem (2026-10-10)

## Objetivo

A posse passa a medir a diferença entre os médios das duas equipas em
**percentagem**, e não em pontos. Hoje 1 ponto de diferença vale o mesmo entre
jogadores de 10 e de 45 — por isso o mesmo desnível relativo quase não se nota
nas divisões de baixo, e a Pressão Alta sai mais barata lá.

Fecha o que ficou por fazer em
`2026-10-10-contra-ataque-cansaco-proporcional.md`.

## A mudança

`computePossession` (`server/game/matchCalculations.ts`):

- Hoje: `(médiosA − médiosB) × possePerPoint` (0,014 por ponto).
- Depois: `(médiosA − médiosB) ÷ média dos dois × posseRelative` (0,42).

0,42 mantém o meio da escala igual ao de hoje (jogadores de 30: 0,014 × 30).
Sem médios nos dois lados (média 0) → sem inclinação. O resto (estilo,
médios a mais, pressão, limites 30%–70%) não muda.

| Mesma diferença de 10% entre médios | Hoje | Depois |
|---|---|---|
| Jogadores de 10 (4.ª divisão) | +1,4 pontos de posse | +4,2 |
| Jogadores de 30 | +4,2 | +4,2 |
| Jogadores de 44 (1.ª divisão) | +6,2 | +4,2 |

## Medições (simulação com o código atual + esta fórmula)

Pressão Alta contra Média, frente a frente, em pontos por jogo:

| Qualidade | Hoje | Depois |
|---|---|---|
| 10 | +0,10 | −0,03 |
| 25 | +0,06 | −0,03 |
| 44 | −0,13 | −0,03 |

Média por pressão (todos contra todos): Baixa 1,36 · Média 1,40 · Alta 1,33 —
igual em todas as divisões. Melhor / pior tática: 1,48 / 1,25.

Ligas com os plantéis iniciais (30 épocas, 22 jogos):

| Divisão | Campeão / último hoje | Depois | Golos por jogo |
|---|---|---|---|
| 1.ª | 41 / 20 | 41 / 20 | 2,47 → 2,49 |
| 2.ª | 41 / 19 | 41 / 19 | 2,50 → 2,46 |
| 3.ª | 40 / 20 | 41 / 20 | 2,41 → 2,43 |
| 4.ª | 41 / 20 | 43 / 17 | 2,63 → 2,63 |

Só a 4.ª divisão mexe: fica um pouco menos nivelada (o melhor plantel ganha
mais vezes).

## Ficheiros a tocar

- `server/gameConstants.ts` — `possePerPoint` sai, entra `posseRelative: 0.42`.
- `server/game/matchCalculations.ts` — `computePossession` (e o comentário).
- `server/scripts/engineUnitRegression.mts` — teste novo: 10 contra 8 dá a
  mesma posse que 40 contra 32; sem médios não rebenta.
- `NOTES.md` — apontamento.

Sem mudanças no cliente nem na base de dados.

## Verificação

- `cd server && npm run typecheck` · `npm run test:engine-unit`
- `npx tsx scripts/engineCalibration.mts new` (golos por jogo ~2,5)
- Repetir a simulação e confirmar as tabelas acima.
- `npm run audit:socketio` · `npm run audit:gamestate <SALA>`

## Efeito a ter em conta

- **Na 1.ª divisão, cada ponto de diferença entre médios passa a valer menos
  posse** (0,95 em vez de 1,4 pontos de posse por ponto). Com os plantéis
  iniciais não se nota na tabela, mas um treinador que monte um meio-campo
  muito acima da concorrência ganha um pouco menos de bola do que hoje.
- Alternativa: `posseRelative: 0.5` devolve parte disso à 1.ª divisão, mas
  deixa a Pressão Alta a perder para a Média (−0,12) em todas as divisões.
