# Plano — Equilíbrio das formações (3-5-2) (2026-10-10)

## Objetivo

O 3-5-2 deixar de ser a melhor formação contra tudo, sem mexer nos golos por
jogo nem no resto do motor.

## Causa (medida)

Não é o 3-5-2 em si: é **cada médio a mais valer demasiada posse**
(`duelPossePerMed: 0.025` — 2,5 pontos de posse por médio de diferença). Com
equipas iguais, a classificação das formações é quase só a contagem de
médios: as de 5 médios em cima, a de 2 médios em baixo.

Pontos por jogo, todas as táticas contra todas (média por formação):

| Formação | Médios | Hoje | Com 0,012 |
|---|---|---|---|
| 3-5-2 | 5 | 1,46 | 1,40 |
| 4-5-1 | 5 | 1,42 | 1,37 |
| 4-4-2 | 4 | 1,39 | 1,38 |
| 3-4-3 | 4 | 1,39 | 1,37 |
| 5-4-1 | 4 | 1,37 | 1,35 |
| 4-3-3 | 3 | 1,33 | 1,36 |
| 5-3-2 | 3 | 1,33 | 1,37 |
| 4-2-4 | 2 | 1,22 | 1,31 |
| **Distância entre a melhor e a pior** | | **0,24** | **0,09** |

Golos por jogo: 2,50 → 2,50.

Alternativas testadas e rejeitadas:

- Baixar só o ataque ou a defesa do 3-5-2: o 4-5-1 passa a ser a melhor e o
  4-2-4 continua no fundo — troca o problema de sítio.
- Tirar a posse por médio de todo (0): inverte — ganham as formações com
  menos médios.
- 0,015: melhora, mas a distância fica em 0,12; 0,010: igual a 0,012.

## A mudança

- `server/gameConstants.ts` — `duelPossePerMed: 0.025 → 0.012` (e o
  comentário).
- `NOTES.md` — apontamento.

Uma afinação só. Sem código novo, sem mudanças no cliente nem na base de
dados. O teste existente "5 médios contra 3 têm mais bola" continua válido.

## Verificação

- `cd server && npm run typecheck` · `npm run test:engine-unit`
- `npx tsx scripts/engineCalibration.mts new` (golos por jogo ~2,5)
- Repetir a simulação e confirmar a tabela acima.
- `npm run audit:gamestate <SALA>`

## Efeito a ter em conta

- Pôr mais médios continua a dar mais bola, mas metade do que dava: 5 contra
  4 médios passa de +2,5 para +1,2 pontos de posse.
- O 3-5-2 continua em primeiro por uma margem mínima (1,40 contra 1,38) e o
  4-2-4 em último (1,31): deixa de haver uma formação obrigatória ou
  proibida, mas não ficam todas iguais.
- A escolha passa a depender sobretudo de onde o plantel tem os melhores
  jogadores, que é o que se quer.
