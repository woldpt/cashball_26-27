# Plano — Estádios iguais na 4.ª divisão (2026-10-10)

## Objetivo

Fechar a última desigualdade com peso entre as equipas que podem calhar a um
treinador humano: a lotação do estádio.

## Causa

A assistência de um jogo é `lotação útil × ocupação × multiplicadores`
(`coreHelpers.ts`), e a lotação útil é o menor entre o estádio e a massa
adepta. Na 4.ª divisão a massa adepta inicial é igual à lotação
(`db/seed.js`), por isso a bilheteira é **proporcional ao estádio**.

| Equipa | Lotação hoje | Bilheteira face a um estádio de 5000 |
|---|---|---|
| Bragança, Vianense, Rebordosa, Leça, Vit. Sernache, Louletano, Juventude | 5000 | 100% |
| O Elvas | 3500 | 70% |
| Oliv. Hospital, Malveira | 3000 | 60% |
| Sintrense | 2800 | 56% |
| Alcochetense | 2500 | 50% |

Quem ficar com o Alcochetense recebe metade da bilheteira de quem ficar com o
Bragança, com o mesmo plantel e os mesmos ordenados. E ampliar o estádio não
resolve logo: a massa adepta dessas equipas também começa mais baixa.

## A mudança

- `server/db/fixtures/all_teams.json` — lotação das 5 equipas acima passa a
  5000 (os nomes dos estádios ficam). A massa adepta acompanha sozinha.
- `server/scripts/gameStateAudit.ts` — a verificação `balanced_draw` (modo
  `base`) passa a exigir também lotação e massa adepta iguais nas divisões de
  baralho igual.
- `NOTES.md` — apontamento.

Sem código de jogo novo.

## Verificação

- `cd server && npm run seed` · `npm run audit:gamestate base`
- Confirmar na base: 12 equipas da 4.ª com lotação 5000 e massa adepta 5000.
- `npm run typecheck` · `npm run test:connect-smoke` · `npm run test:attendance`

## Limites conhecidos

- **Só vale para salas novas.**
- As lotações deixam de ser as reais desses cinco estádios.
- A 5.ª divisão não muda (lotações de 1000 a 5000), tal como no plano do
  baralho igual.
