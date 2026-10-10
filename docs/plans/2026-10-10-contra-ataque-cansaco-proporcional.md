# Plano — Contra-ataque e cansaço proporcional (2026-10-10)

## Objetivo

Acabar com a "tática que ganha sempre" (Ofensivo + Pressão Alta) sem mexer no
realismo dos resultados (golos por jogo, casa/empate/fora).

1. **Contra-ataque:** quem joga Defensivo finaliza melhor contra quem se
   expõe (estilo Ofensivo e/ou Pressão Alta). Cria o ciclo
   Defensivo > Ofensivo > Equilibrado > Defensivo.
2. **Cansaço proporcional:** cada golpe de cansaço tira uma percentagem da
   qualidade do jogador (hoje tira sempre 1 ponto, que pesa 10% num jogador de
   10 e 2% num de 45). A Pressão Alta passa a cansar mais por golpe.

## Valores propostos (medidos por simulação, a confirmar na implementação)

| Afinação (`MATCH_TUNING`) | Valor | Efeito |
|---|---|---|
| `counterVsOffensive` | 0.25 | +25% de finalização do Defensivo contra Ofensivo |
| `counterVsHighPress` | 0.10 | +10% de finalização do Defensivo contra Pressão Alta (soma) |
| `fatigueLossShare` | 0.04 | cada golpe de cansaço tira 4% da qualidade base |
| `pressure.ALTA.fatigueLoss` | 1.3 | Pressão Alta: cada golpe tira 30% mais (MEDIA/BAIXA = 1) |

Medições (equipas iguais, todos contra todos, pontos por jogo):

| | Hoje | Depois |
|---|---|---|
| Estilo: Defensivo / Equilibrado / Ofensivo | 1,29 / 1,36 / 1,43 | 1,38 / 1,35 / 1,35 |
| Defensivo contra Ofensivo (frente a frente) | −0,25 a −0,31 | +0,16 a +0,24 |
| Ofensivo contra Equilibrado | +0,13 | +0,11 a +0,17 (igual) |
| Equilibrado contra Defensivo | +0,16 a +0,19 | +0,12 a +0,21 (igual) |
| Pressão Alta contra Média (jogadores de 44) | +0,15 | −0,03 a −0,09 |
| Pressão Alta contra Média (jogadores de 10) | +0,08 | +0,11 |
| Melhor / pior tática | 1,57 / 1,19 | 1,48 / 1,23 |
| Golos por jogo (sem fator casa) | 2,33 | 2,42 |

## Ficheiros a tocar

- `server/gameConstants.ts` — as 4 afinações acima.
- `server/game/matchCalculations.ts` — função pura nova
  `counterAttackConvMult(estiloAtacante, estiloDefensor, pressaoDefensor)`.
- `server/game/engine.ts`
  - `resolveOpenPlayGoal`: multiplicar a probabilidade de golo pelo
    contra-ataque (antes do cálculo do "golo esperado", para as estatísticas
    baterem) e marcar o evento do golo com `counter: true`.
  - `applyFatigueToPlayer` / `trackFatigue` / `applyMinuteFatigue`: golpe =
    qualidade base × `fatigueLossShare` × fator da pressão.
  - `syncFatigueSnapshot` / `getMatchFatigueSnapshot`: arredondar a qualidade e
    a perda só para mostrar (por dentro ficam com casas decimais).
- `server/game/commentary.ts` — 3 ou 4 frases de golo em contra-ataque (pt-PT),
  para o treinador perceber porque é que resultou.
- `server/scripts/engineUnitRegression.mts` — testes novos (contra-ataque só
  para Defensivo; jogador de 10 e de 40 perdem a mesma percentagem; Pressão
  Alta perde mais por golpe) e ajuste dos testes que assumem "−1 por golpe".
- `NOTES.md` — apontamento.

Sem mudanças no cliente nem na base de dados.

## Verificação

- `cd server && npm run typecheck`
- `npm run test:engine-unit` · `test:substitutions` · `test:emergency-gk` ·
  `test:own-goal` · `test:penalty-ordering`
- `npx tsx scripts/engineCalibration.mts new` (golos por jogo continuam ~2,5)
- Repetir a simulação de todos-contra-todos e confirmar a tabela acima.
- `npm run audit:socketio` e `npm run audit:gamestate <SALA>`.

## Limites conhecidos (ficam de fora)

- **A Pressão Alta continua a compensar um pouco mais nas divisões de baixo.**
  A causa é a posse de bola, que conta a diferença de qualidade dos médios em
  pontos e não em percentagem. Corrigir isso mexe no equilíbrio de todas as
  ligas — fica para um plano próprio.
- **O 3-5-2 continua a ser a melhor formação** (por pouco). Não faz parte
  deste plano.
- Os NPC não mudam: já passam a Defensivo quando são mais fracos ou estão a
  ganhar perto do fim, por isso passam a beneficiar do contra-ataque sem
  alterações.
