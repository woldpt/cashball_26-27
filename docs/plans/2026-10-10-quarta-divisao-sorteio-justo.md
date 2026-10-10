# Plano — 4.ª divisão com sorteio justo (2026-10-10)

## Objetivo

Os treinadores humanos começam todos na 4.ª divisão com equipa sorteada.
Hoje a equipa que calha a cada um pode ser bastante melhor ou pior do que a
dos outros. O objetivo é partirem todos com as mesmas armas.

## Causa (medida)

Cada jogador da 4.ª recebe uma qualidade ao acaso entre 5 e 15 (`db/seed.js`).
É um intervalo muito largo em proporção (o melhor vale o triplo do pior), e o
ataque de uma equipa são só 2 avançados: basta calharem dois bons ou dois maus.

Em média, o melhor onze da divisão sai 24% mais forte do que o pior.

## A mudança

**Baralho igual por posição**, só na 4.ª divisão: em vez de um sorteio livre
por jogador, cada equipa recebe os mesmos valores (espalhados de 5 a 15) em
cada posição, e o sorteio decide apenas **que jogador fica com que valor**.

Exemplo: todas as equipas com 3 guarda-redes têm um de 7, um de 10 e um de 13
— muda só quem é quem. Continua a haver jogadores bons e fracos em cada
plantel, mas ninguém parte com mais do que os outros.

Força esperada de cada equipa (pontos em 22 jogos, média de 3 épocas):

| | Melhor equipa | Pior equipa | Melhor onze / pior onze |
|---|---|---|---|
| Hoje (sorteio livre 5–15) | 39 | 19 | 1,24× |
| **Baralho igual por posição** | **36** | **24** | **1,01×** |
| Referência: equipas exatamente iguais | 36 | 24 | 1,00× |

Fica igual à referência: a diferença que sobra é só a sorte dos jogos.

Alternativas testadas e rejeitadas:

- Apertar o intervalo (8–12): melhora pouco (37 / 23) e deixa os jogadores
  todos parecidos — o mercado e a evolução perdem graça.
- Baralho igual no plantel inteiro, sem olhar à posição: 38 / 22 — os
  valores altos podem calhar todos na defesa de uns e no ataque de outros.

## Ficheiros a tocar

- `server/db/seed.js` — em `buildPlayers`, modo de baralho por posição para
  as divisões indicadas; jogadores com qualidade fixa no ficheiro das equipas
  continuam a respeitá-la.
- `server/db/seedEcon.js` — constante com as divisões de baralho igual (`[4]`).
- `server/scripts/gameStateAudit.ts` — no modo `base`, verificação nova: na
  4.ª divisão a soma do melhor onze de cada equipa não difere mais de 2 pontos.
- `NOTES.md` — apontamento.

## Verificação

- `cd server && npm run seed` e `npm run audit:gamestate base` (com a
  verificação nova).
- Repetir a simulação com a base refeita.
- `npm run typecheck` · `npm run test:connect-smoke` · `test:own-goal` ·
  `test:penalty-ordering` · `test:segment-barrier`.

## Limites conhecidos

- **Só vale para salas novas.**
- **Fica alguma sorte de fora:** idade, resistência, forma e potencial
  continuam sorteados livremente. Um plantel pode ter os bons valores em
  jogadores novos e outro em veteranos.
- **A 5.ª divisão não muda** (nenhum humano começa lá). Se se quiser o mesmo
  para quem desce, é acrescentar o 5 à lista.
- Os ordenados seguem a qualidade, por isso as folhas salariais da 4.ª passam
  a ser praticamente iguais entre equipas.
