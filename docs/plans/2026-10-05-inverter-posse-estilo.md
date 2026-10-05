# Inverter inclinação de posse por estilo

## Contexto
DEFENSIVO ganha posse (+chances) além de +15% defesa → domina. Inverter: OFENSIVO fica com a bola.

## Alteração
`server/game/matchCalculations.ts:341-346`:
```ts
/** Inclinação de posse por estilo: OFENSIVO tem a bola, DEFENSIVO cede-a. */
export const STYLE_POSSESSION_FACTORS = { DEFENSIVO: -1, EQUILIBRADO: 0, OFENSIVO: 1 };
```
Atualizar docstring de `computePossession` (~l.460) e comentário em `server/gameConstants.ts:595` (`OFENSIVO + / DEFENSIVO −`).
Também gravar cópia do plano em `docs/plans/2026-10-05-inverter-posse-estilo.md`.

## Verificação
- `grep` testes que esperem posse DEFENSIVO > OFENSIVO e ajustar.
- Correr testes do server + `scripts/engineCalibration.mts`.
- Commit.
