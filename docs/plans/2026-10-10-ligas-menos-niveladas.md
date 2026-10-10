# Plano — Ligas menos niveladas (2026-10-10)

## Objetivo

As ligas terem favoritos e aflitos à partida, como no futebol a sério. Hoje,
em 22 jogos, o campeão faz ~41 pontos e o último ~19, e o título calha a
qualquer um.

## Causa (medida)

No arranque, **todos os jogadores de uma divisão são sorteados do mesmo
intervalo** de qualidade (`db/seed.js`; 1.ª: 36–50, 2.ª: 26–35, 3.ª: 16–25).
As médias das equipas só diferem por acaso (na 1.ª: 42,3 a 46,2). Os três
grandes têm intervalo próprio (39–54), mas o teto é 50 e ganham só +2.

O mecanismo para dar força diferente a cada clube já existe (`skillRange` por
equipa em `db/fixtures/all_teams.json`); só três equipas o usam.

## A mudança

Só dados: dar `skillRange` às 36 equipas das **1.ª, 2.ª e 3.ª divisões**, em
4 escalões de 3 equipas, pela ordem em que já estão no ficheiro.

| Escalão | 1.ª divisão | 2.ª divisão | 3.ª divisão |
|---|---|---|---|
| 1 (candidatos) | 44–50 | 31–37 | 20–26 |
| 2 | 41–48 | 29–34 | 19–24 |
| 3 | 38–45 | 27–32 | 17–22 |
| 4 (aflitos) | 35–42 | 24–30 | 15–21 |

| Escalão | 1.ª divisão | 2.ª divisão | 3.ª divisão |
|---|---|---|---|
| 1 | Sporting, Porto, Benfica | Marítimo, Ac. Viseu, Torreense | Amarante, Belenenses, Académica |
| 2 | Sp. Braga, Famalicão, Gil Vicente | U. Leiria, Vizela, Lus. Lourosa | Varzim, Mafra, U. Santarém |
| 3 | Estoril, Moreirense, Arouca | Feirense, Chaves, Leixões | Trofense, Atlético, Vit. Setúbal |
| 4 | Vitória SC, Alverca, Rio Ave | Felgueiras, Penafiel, Portimonense | São João Ver, Fafe, Lusitano Évora |

**A 4.ª e a 5.ª divisões não mudam.** Os treinadores humanos começam todos na
4.ª, com equipa sorteada: se lá houvesse escalões, ganhava quem tivesse sorte
no sorteio.

## Resultado esperado (simulação, 40 épocas de 22 jogos)

| | Hoje | Depois |
|---|---|---|
| Pontos do campeão | 41 | ~44 |
| Pontos do último | 19 | ~16 |
| Título para um dos 3 do escalão 1 | 38% | ~75% |
| Média do escalão 1 / escalão 4 | 30 / 30 | ~38 / ~24 |
| Golos por jogo | 2,43 | 2,46 |

## Ficheiros a tocar

- `server/db/fixtures/all_teams.json` — `skillRange` nas 36 equipas.
- `NOTES.md` — apontamento.

Sem código novo. O `base.db` (modelo das salas) refaz-se sozinho no arranque,
porque o ficheiro das equipas mudou.

## Verificação

- `cd server && npm run seed` e confirmar as médias por equipa na base.
- Repetir a simulação de ligas com os plantéis novos.
- Criar uma sala nova e correr `npm run audit:gamestate <SALA>` (orçamentos
  contra salários: os clubes do escalão 1 passam a pagar mais ordenados com o
  mesmo orçamento de divisão — é o ponto a vigiar).
- `npm run typecheck` · `npm run test:connect-smoke` e os `test:*` que leem o
  `base.db`.

## Limites conhecidos

- **Só vale para salas novas.** As salas já criadas ficam como estão.
- **Fica a meio caminho do futebol real** (campeão ~52, último ~14). Com os
  intervalos de qualidade de cada divisão não dá mais: mesmo usando o
  intervalo todo, o campeão não passa dos 44–45. Chegar lá obriga a o motor
  pesar mais a diferença de qualidade (medido: a dobrar esse peso dá campeão
  49, último 12, título para os grandes 95%) — mas isso amplifica tudo o
  resto (cansaço, forma, moral) e desfaz parte do equilíbrio das táticas.
  Fica de fora; se se quiser, é um plano próprio.
- A ordem dos escalões é a do ficheiro das equipas. Se algum clube estiver
  no escalão errado, troca-se à mão.
