# Leilões NPC: compras fracas e leilões a mais

Origem: sala PYG2GT (Vit. Setúbal): 16 compras em leilão com qualidade média 20 (divisão: 32); 58 leilões numa só jornada.

## 1. Piso de qualidade das compras NPC
- Hoje (`npcTransferHelpers.ts` ~l.422 e ~l.168): o NPC só compra se `skill >= média dos seus 14 melhores − NPC_BUY_FLOOR_MARGIN (10)`. Plantel fraco ⇒ piso baixo ⇒ só compra fracos (espiral).
- Proposta: piso = `max(média própria, média da divisão) − 10`. A média da divisão sai de uma query (top 14 de cada equipa da mesma divisão), calculada uma vez por leilão.
- Aplicar nos dois sítios (leilão e compra a lista) via uma função partilhada.

## 2. Leilões a mais (contratos que acabam)
- Hoje (`contractHelpers.ts` ~l.380): ao acabar o contrato, o NPC só renova se a posição estiver **abaixo do mínimo** e for bom e caber no orçamento. Todos os outros vão a leilão ⇒ dezenas de leilões ao mesmo tempo ⇒ outros NPC compram sem necessidade.
- Proposta: tirar a condição `isNeeded`. Renova quem for bom (≥ 85% da média do plantel) e o orçamento aguentar. Só os fracos/excedentes vão a leilão.
- Os leilões por corte salarial (`NPC_WAGE_CUT_PER_EVENT = 2`) ficam como estão.

## Verificação
- `cd server && npm run typecheck`, `npm run audit:socketio`, `npm run audit:gamestate PYG2GT` (cópia local), testes `test:*` de contratos (`test:contractrenewal`, `test:contractyear`).
- Comparar nº de leilões por jornada e qualidade média das compras antes/depois, numa cópia da sala.

## Riscos
- NPC com mais renovações ⇒ folha salarial maior; vigiar orçamentos negativos (`npcNegativeBudgetStreak`).
- Menos leilões ⇒ menos oferta para os humanos; ver se continua a haver mercado suficiente.
