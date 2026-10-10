# Plano — Correções à economia (2026-10-10)

## Objetivo

Fechar as cinco falhas da auditoria à economia (nota 4/10): venda a NPC por
qualquer preço, bilhete a 30 € sem custo, dinheiro a amontoar-se, NPC a
construir bancadas vazias e prémio de melhor marcador desproporcionado.
Só lógica e números: sem mudanças na base de dados nem nos eventos de socket.
Vale para salas novas e para as que já existem.

## O que está mal hoje (medido numa sala local)

| # | Falha | Medida |
|---|---|---|
| 1 | Humano vende a NPC por várias vezes o valor | Médio de qualidade 14 (valor 156 mil) pedido a 780 mil: 8 NPC compravam |
| 2 | Bilhete a 30 € é sempre o melhor | Receita +58% face a 15 €; só afasta 21% dos adeptos |
| 3 | Todos os clubes lucram sempre | +49 M por época num jogo que arranca com 72 M; os ordenados dos NPC ignoram a bilheteira (47% da receita na 1.ª) |
| 4 | NPC rico constrói sem adeptos para encher | Em 15 clubes, +5 000 lugares renderam zero; cada obra custa 300 mil + 187 mil/época |
| 5 | Melhor marcador vale 500 mil em todas as divisões | Na 4.ª o campeão recebe 250 mil |

## As mudanças

### 1. NPC recusa preços acima do valor

- O NPC só compra na lista se o preço pedido for no máximo 1,4 × o valor do
  jogador.
- Porquê 1,4 e não 1,3: é o sobrepreço que os próprios NPC pedem na venda de
  oportunidade; abaixo disso deixavam de comprar uns aos outros.
- Sem limite para o que o humano pode pedir — simplesmente ninguém compra.

### 2. Bilhete caro com custo a sério

- Cada euro acima de 15 € passa a afastar 3% dos adeptos (hoje 1,4%); o piso
  desce de 70% para 50% da procura.

| Preço | Receita hoje | Receita nova | Adeptos (novo) |
|---|---|---|---|
| 10 € | 0,71 | 0,77 | +15% |
| 15 € | 1,00 | 1,00 | — |
| 20 € | 1,24 | 1,13 | −15% |
| 25 € | 1,43 | 1,17 | −30% |
| 30 € | 1,58 | 1,10 | −45% |

- O dilema passa a existir: 25 € dá mais 17% de receita mas esvazia o estádio
  (perde-se o bónus de casa cheia e arrisca-se o castigo de casa vazia);
  10 € enche-o e custa um quarto da receita.
- Estádio com mais procura do que lugares continua a poder cobrar mais sem
  perder gente — é assim na vida real.

### 3. Ordenados dos NPC passam a contar com a bilheteira

- O teto da folha de cada NPC soma metade da bilheteira semanal média do
  clube nesta época (jogos em casa já feitos, parte do visitado).
- Efeito esperado na 1.ª divisão (clube mediano): teto de 144 mil para cerca
  de 207 mil por semana; até 1,4 M dos 1,8 M de lucro anual passam a
  ordenados.
- A subida continua lenta (6% de hipótese por jogador por semana, +15% de
  cada vez) e só para clubes ricos ou em boa forma.
- O corte forçado de custos fica igual: só com o orçamento negativo.

### 4. NPC só constrói quando tem adeptos para encher

- A obra só avança se a massa adepta for maior do que a lotação.
- Sem isso, o excedente vai para a academia (como já acontece quando o
  estádio está no máximo).

### 5. Prémio de melhor marcador proporcional à divisão

- 1.ª 500 mil (igual) · 2.ª 250 mil · 3.ª 125 mil · 4.ª 60 mil — um quarto do
  prémio de campeão em cada divisão.

## Ficheiros

- `server/gameConstants.ts` — números novos (1,4; 3% e piso 50%; metade da
  bilheteira; tabela do prémio).
- `server/npcSquadPlanning.ts` — regra do preço máximo nas compras.
- `server/coreHelpers.ts` — piso da procura por preço lido da constante.
- `server/contractHelpers.ts` — teto da folha com a bilheteira; condição da
  obra.
- `server/cupFlowHelpers.ts` — prémio por divisão (pagamento, notícia e
  texto).
- Testes: `scripts/npcSquadPlanningRegression.mts` (caso novo),
  `scripts/attendanceRegression.mts`, `scripts/topScorerPrizeRegression.mts`
  (valores atualizados).
- `NOTES.md` — apontamento.

Sem mudanças no cliente (não mostra estes números).

## Ordem de trabalho (um commit por passo)

1. Preço máximo nas compras NPC — a falha grave, entra primeiro.
2. Bilhete.
3. Prémio de melhor marcador.
4. Obras dos NPC.
5. Ordenados dos NPC com a bilheteira.

## Verificação

- Casos novos ou atualizados:
  - jogador listado a 1,4 × valor compra-se; a 1,5 × não;
  - repetir a medição da falha 1: zero NPC a comprar acima de 1,4 ×;
  - assistência a 30 € = 55% da de 15 € (sem estádio cheio);
  - NPC com 12 M e adeptos ≤ lotação não constrói; com adeptos > lotação
    constrói;
  - teto da folha sobe com a bilheteira e fica igual sem jogos em casa;
  - prémio de melhor marcador da 4.ª = 60 mil.
- `cd server && npm run typecheck` · `test:npc-squad-planning` ·
  `test:attendance` · `test:topscorer` · `test:finance-guards` ·
  `test:fans-mood` · `test:connect-smoke`
- Repetir a projeção de uma época por divisão (script temporário) e comparar
  com a tabela da auditoria.
- `npm run audit:gamestate <SALA>` · `npm run audit:socketio`.

## Limites conhecidos

- Não há simulador de épocas: o efeito dos passos 3 a 5 ao fim de várias
  épocas fica projetado, não medido. Para medir é preciso uma cópia de uma
  sala de produção.
- O passo 5 abranda o amontoar de dinheiro nos NPC, não o elimina; os
  humanos continuam a lucrar todas as épocas (é o que lhes permite crescer).
- Fica de fora: os NPC continuam sempre a 15 € de bilhete; a diferença de
  estádios dentro da 1.ª–3.ª divisões; o aviso ao humano de que a obra não
  rende sem adeptos.

## Efeito a ter em conta

- Quem joga com o bilhete a 30 € perde receita de um dia para o outro: de
  +58% para +10% face aos 15 €. Nas salas em curso isto nota-se logo.
- Deixa de ser possível vender jogadores a NPC muito acima do valor; quem
  contava com isso fica com os jogadores na lista.
- Os NPC ricos passam a pagar melhor: jogadores deles ficam mais caros de
  manter para quem os comprar (o ordenado vem com o jogador).
- O melhor marcador das divisões de baixo deixa de valer mais do que o
  título.
