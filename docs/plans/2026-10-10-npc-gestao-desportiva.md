# Plano — NPC a gerir como um diretor desportivo (2026-10-10)

## Objetivo

Subir a gestão dos NPC nas três áreas mais fracas da auditoria (compras 3/10,
vendas 3/10, onze e formação 5/10), sem mexer no motor de jogo nem na base de
dados. Vale para salas novas e para as que já existem (é lógica, não seed).

## O que está mal hoje (lido no código)

| Área | Hoje | Onde |
|---|---|---|
| Compras | Na lista de transferências compra o jogador de maior qualidade que cabe em 70% do orçamento. Não vê a posição nem o ordenado. | `npcTransferHelpers.ts` → `processNpcTransferActivity` |
| Vendas | Com mais de 12 jogadores, põe à venda o mais fraco do plantel, seja de que posição for, ao valor de tabela. Nunca vende ninguém com lucro. | idem, segunda metade |
| Renovações | O comentário diz "renova se a posição precisar", mas o código só olha à qualidade (85% da média). | `contractHelpers.ts` → `processContractExpiries` |
| Onze | Escolhe pela qualidade base. A forma conta no jogo (de 0,75 a 1,35) e é ignorada. | `game/matchCalculations.ts` → `generateAITactic` |
| Formação | Escolhe pela média de **todos** os jogadores de cada sector, suplentes incluídos. Na sala medida, 16 de 50 equipas jogam em 4-2-4, a formação mais fraca (1,31 pts/jogo). | idem |
| Estilo | Compara a média do plantel inteiro com a do adversário, não onze contra onze. | idem |

## As mudanças

### 1. Comprar por necessidade

- Contar o plantel principal por posição antes de comprar.
- Ordem de procura: primeiro a posição em falta (abaixo de GR 2 · DEF 4 ·
  MED 4 · ATA 3, os mínimos que já existem), depois a posição mais curta.
- Não comprar para uma posição já cheia (GR 3 · DEF 8 · MED 8 · ATA 7 — o
  máximo com que as equipas arrancam).
- Custo total em vez de só o preço: preço + ordenados até ao fim da época
  tem de caber em 50% do orçamento (70% se a posição estiver em falta).
- O piso de qualidade (nível da equipa − 10) fica igual.

### 2. Vender com critério

- Só vai à lista quem sobra: depois da venda a posição tem de ficar com pelo
  menos GR 2 · DEF 5 · MED 5 · ATA 4.
- Dentro dos que sobram, sai o mais fraco (como hoje).
- Preço: valor de tabela para os fracos; +25% se o jogador estiver ao nível
  da divisão (tem mercado).
- Venda de oportunidade: 5% de hipótese por semana de pôr à venda o melhor
  suplente de uma posição a sobrar, a +40%. Nunca um titular.
- Renovações: passa a renovar também quem está abaixo dos 85% se a posição
  ficar abaixo do mínimo sem ele (cumpre o que o comentário já prometia).

### 3. Onze pela forma, formação pelos melhores 11

- Valor de jogo de cada jogador = qualidade × forma (mesma escala do motor,
  0,75 a 1,35).
- Para cada formação: escolher os melhores disponíveis por posição e somar o
  valor desses 11. Ganha a formação com a soma mais alta. Suplentes deixam de
  contar.
- Estilo: comparar o onze escolhido com o melhor onze do adversário (os
  mesmos ±10% de hoje).
- Banco: os melhores que sobram, pela mesma medida.
- Trocas durante o jogo e ao intervalo ficam como estão.

## Ficheiros

- `server/npcSquadPlanning.ts` (novo) — três funções puras e testáveis:
  escolher alvo de compra, escolher quem vai à lista, escolher onze e
  formação. Os mínimos por posição passam para aqui (hoje estão repetidos em
  dois ficheiros).
- `server/npcTransferHelpers.ts` — compras e vendas passam a chamar essas
  funções.
- `server/contractHelpers.ts` — renovação com a regra da posição.
- `server/game/matchCalculations.ts` — `generateAITactic` usa a nova escolha.
- `server/gameConstants.ts` — os números novos (máximos por posição, 50%/70%,
  +25%/+40%, 5%).
- `server/scripts/npcSquadPlanningRegression.mts` (novo) + entrada
  `test:npc-squad-planning` em `server/package.json`.
- `NOTES.md` — apontamento.

Sem mudanças no cliente, na base de dados nem nos eventos de socket.

## Ordem de trabalho (um commit por passo)

1. Compras.
2. Vendas e renovações.
3. Onze, formação e estilo.

## Verificação

- Teste novo, casos mínimos:
  - plantel sem 2.º GR → compra GR mesmo havendo um avançado melhor na lista;
  - posição cheia → não compra;
  - preço cabe mas preço + ordenados não → não compra;
  - plantel com 4 defesas → nenhum defesa vai à lista;
  - melhor jogador em baixo de forma perde o lugar para um colega em forma;
  - plantel forte em médios → sai formação de 5 médios, não 4-2-4.
- `cd server && npm run typecheck` · `test:npc-squad-planning` ·
  `test:npc-bid-window` · `test:engine-unit` · `test:contractrenewal` ·
  `test:contractyear` · `test:substitutions`
- `npx tsx scripts/engineCalibration.mts new` (golos por jogo ~2,5).
- Medição do passo 3: mesmas equipas, escolha antiga contra escolha nova,
  pontos por jogo (script temporário, não fica no repositório). Se a nova não
  ganhar, não entra.
- `npm run audit:gamestate <SALA>` · `npm run audit:socketio`.

## Limites conhecidos

- Não existe simulador de épocas inteiras com mercado: as compras e vendas
  ficam provadas por testes de regras, não por épocas jogadas. Para medir a
  sério é preciso uma cópia de uma sala de produção.
- Os NPC continuam sem mexer no preço do bilhete, sem escolher patrocinador e
  sem rotação por cansaço entre jogos — fora deste plano.

## Efeito a ter em conta

- A lista de transferências fica com menos pechinchas: os NPC deixam de
  largar jogadores úteis ao valor de tabela e pedem mais pelos bons. Os
  humanos passam a pagar mais por reforços de qualidade.
- Aparecem de vez em quando bons suplentes de NPC à venda (a +40%), o que dá
  aos humanos alvos que hoje não existem.
- Os NPC ficam mais difíceis de bater: menos equipas em 4-2-4 e onzes em
  melhor forma. A distância para os humanos encurta.
- Menos compras nas equipas com o orçamento apertado, porque o ordenado
  passa a contar.
