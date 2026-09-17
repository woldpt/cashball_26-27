# Hattrick.org — Segredos da Engine (guia para o CashBall)

> Pesquisa web (2026-09-17). Fontes principais: `wiki.hattrick.org` (Manual,
> Match engine, Tactics, Rating, HatStats, Special Events) e o devblog oficial
> (série "New match engine odyssey", 2017). Números exatos de fórmulas internas
> são estimativas da comunidade (reverse engineering) — a lógica está
> documentada, as constantes nem sempre. Onde houver dúvida, está marcado.
> Última secção ("O que roubar") é extrapolação nossa, não facto do Hattrick.

## 1. A ideia-mãe: ratings por setor, não equipa contra equipa

O Hattrick nunca resolve "ataque 80 vs defesa 75". Resolve **7 duelos de
setor**, sempre espelhados:

| O meu setor de ataque | Ataca contra |
|---|---|
| Ataque esquerdo | Defesa direita deles |
| Ataque central | Defesa central deles |
| Ataque direito | Defesa esquerda deles |

Mais, do outro lado do boletim: **meio-campo** (disputa única, ver §2),
**defesa esq/central/dir** e **bolas paradas** (ataque e defesa). O boletim
de fim de jogo mostra estes ratings em níveis (de "inexistente" a "divino"),
convertidos em estrelas.

Isto é exatamente o "duelo espelhado" de que falámos para os flancos — o
Hattrick faz isto desde 1997, para os 3 corredores. **Lição nº 1: o lado vem
do slot da formação, o jogador só empresta skills ao setor onde está.**

## 2. Posse → chances → conversão (o pipeline de 3 andares)

**Andar 1 — Posse.** Os dois meio-campos comparam-se e produzem a % de posse
(50/50 se iguais; cada nível de diferença empurra alguns pontos percentuais).
Só o meio-campo conta aqui. Nada de golos neste andar.

**Andar 2 — Distribuição das chances.** Cada jogo tem um bolo de chances
regulares (~15, número citado na wiki). Reparte-se em dois tipos:

- **Chances exclusivas: 5 fixas para cada equipa**, independentemente da
  posse. É o chão anti-frustração: mesmo dominado, tens sempre 5 tiros.
- **Chances abertas:** o resto, distribuídas pela posse. Ganhar o meio-campo
  dá *mais remates*, não *melhores remates*.

Cada chance sorteia ainda o corredor (esq/centro/dir) com pesos vindos dos
ataques laterais vs centrais.

**Andar 3 — Conversão.** Cada chance resolve-se como duelo de setor
(§1): o meu ataque esquerdo vs a defesa direita deles, com o guarda-redes
a pesar na defesa central. **Lição nº 2: separar volume (posse) de
eficiência (duelos) — é isto que permite "dominar e não marcar".**

## 3. Táticas: 6 + Normal, cada uma com preço e moeda próprios

Não há "mentalidade" genérica. Há 6 táticas, e cada uma é uma troca
explícita com requisitos de skill — o Hattrick mostra o nível da tática
(fraco→excelente) antes do jogo:

| Tática | O que faz | Moeda (requisito) | Preço |
|---|---|---|---|
| **Pressing** | Reduz as chances *dos dois* | Defesa + resistência do plantel | Menos chances para ti também; se fores melhor, nivelas por baixo |
| **Contra-ataque** | Converte chances falhadas deles em contras tuas | Defesa (criar o falhanço) + ataque para finalizar | Inútil se dominares (sem falhanços deles, sem contras) |
| **Ataque pelo meio** | Puxa ratings de ataque para o centro | Interiores/médios | Alas nuas |
| **Ataque pelas alas** | Puxa ratings para os lados | Extremos | Centro nu |
| **Remates de longe** | Médios/avançados rematam sem entrar na área | Remate/distância + ... | Contorna defesas fortes, ignora o teu próprio jogo interior |
| **Jogo criativo** | Mais eventos especiais *para os dois* | Especialistas | Caos simétrico — dás e recebes |

**Lição nº 3: tática boa é tática com preço visível.** Cada uma diz "ganho X,
pago Y, preciso de Z". Nada de bónus grátis — é isto que torna as escolhas
legíveis e impede a tática dominante.

## 4. Ordens individuais: a micro-tática dentro da macro

Cada jogador, em cada posição, pode levar ordem **Normal / Ofensivo /
Defensivo / Para o meio** (laterais e extremos têm variantes próprias).
Cada ordem reescreve a matriz de contribuição do jogador. Exemplo real da
wiki — lateral:

- **Ofensivo:** mais extremo, algum jogo interior a mais, menos defesa.
- **Defensivo:** mais defesa, menos extremo, algum jogo interior a menos.
- **Para o meio:** mais defesa/interior, menos extremo.

Isto multiplica a profundidade sem multiplicar as posições: 4 ordens × 11
jogadores é o "segundo ecrã de tática" do Hattrick. **Lição nº 4: antes de
criar posições novas, espremer ordens por posição.**

## 5. Matriz de contribuição: cada posição empresta skills a vários setores

Nenhuma skill "pertence" a um setor. Cada posição contribui com % diferentes
de cada skill para vários ratings. A forma canónica (valores ilustrativos,
a tabela exata está em `Skill_contribution` na wiki):

- **Guarda-redes:** baliza → defesa central (+ bolas paradas defensivas).
- **Defesas centrais:** defesa → defesa central; passe → ataques.
- **Laterais:** defesa → defesa lateral; extremo → ataque lateral.
- **Médios interiores:** construção → meio-campo (quase tudo); passe/defesa
  respingam para ataques/defesas.
- **Extremos:** extremo → ataque lateral; construção/passe respingam.
- **Avançados:** finalização → ataque central; passe → ataques; cabeça em
  cantos.

**Lição nº 5: ratings são somas ponderadas de skills através da formação.**
Mudar a formação muda *que skills contam*, não um multiplicador abstrato.
É por isto que no Hattrick nenhuma formação "parece igual": um 5-4-1 soma
muita defesa real e pouco ataque real.

## 6. HatStats: a métrica única que a comunidade inventou

`HatStats = 3 × Meio-campo + Ataque + Defesa` (ataque/defesa = soma dos 3
setores, com os níveis convertidos para números). O meio-campo pesa o triplo
porque dá *volume* de chances. Há variantes (LoddarStats pondera a conversão
esperada). **Lição nº 6: uma métrica pública e simples orienta todo o
mercado e conversa.** O CashBall não tem equivalente.

## 7. Eventos especiais: o caos controlado por especialistas

Para além das chances regulares, há eventos especiais (EE), puxados por
**especialidades** dos jogadores (Técnico, Rápido, Poderoso, Imprevisível,
Cabeça…). Exemplos: ala que fura e cruza, canto para o homem de cabeça,
sprint de rápido, erro cómico do imprevisível, veterano que decide com
experiência, defesa cansado que cede (liga à resistência!).

Regras de desenho (pós-reforma 2017, "New Framework"):

- Cada especialista no plantel compra "lotaria" de EE; sem especialistas,
  quase sem EE.
- "Jogo criativo" aumenta EE para os dois lados.
- Os EE ignoram parcialmente os ratings — é a válvula anti-determinismo:
  o favorito ganha ~70-80%, nunca 100%.

**Lição nº 7: o azar tem de ser comprável e visível.** Especialistas e
"jogo criativo" transformam sorte em decisão de plantel.

## 8. O contexto que mexe nos ratings (a "meteorologia")

- **Espírito de equipa:** afeta o meio-campo. Gerido por atitude (jogar
  tranquilo/motivado), treinador (liderança), contratações.
- **Confiança:** afeta o ataque (sobe com golos, cai com derrotas).
- **Forma:** cada jogador tem forma (0-8); multiplica as skills no jogo.
- **Resistência:** cai durante o jogo; plantel cansado rende menos no fim;
  pressing custa resistência a todos.
- **Experiência de formação:** jogar sempre na mesma formação dá XP; formação
  nova com XP baixo → **confusão** (jogadores fora do sítio, ratings cortados
  nesse jogo). É o nosso `tacticFamiliarity`, mas punitivo em vez de bónus.
- **Clima:** chuva favorece Poderosos, sol favorece Técnicos. Sim, o tempo
  entra na engine.
- **Casa/fora:** bónus da casa (crowd), dérbis dividem.
- **Cartões/lesões:** jogar com 10 ou com lesionado sem substituição corta o
  setor correspondente — substituições são ordens programadas (minuto,
  resultado, posição).

**Lição nº 8: meia dúzia de modificadores pequenos e legíveis > um
modificador grande e opaco.** Cada um mexe ±pouco e tem dono (treinador,
atitude, clima, crowd).

## 9. O que roubar para o CashBall (extrapolação nossa)

Por ordem de custo/benefício, dado o estado atual:

1. **Separar volume de eficiência** (§2): posse dá mais chances, duelos
   convertem. Hoje o nosso ataque faz as duas coisas — é por isso que tudo
   se parece. *(Custo: médio; toca `computeSidePower` + geração de chances.)*
2. **Chances exclusivas** (§2): 5 fixas por equipa matam os 0-0 de tédio e os
   jogos sem remates. *(Custo: baixo.)*
3. **Táticas com preço visível** (§3): cada opção futura (pressing, linha,
   largura, ritmo) devia dizer ganho/preço/requisito no próprio ecrã.
   *(Custo: desenho, não engine.)*
4. **Ordens por posição antes de posições novas** (§4): um lateral
   ofensivo/defensivo dá 80% do sabor de LAT/ALA a 20% do custo. *(Custo:
   médio-baixo; sem migração.)*
5. **Duelos espelhados por corredor** (§1): a nossa conversa dos flancos,
   validada pelo Hattrick — mas só depois de (4) ou de LAT/ALA. *(Custo:
   médio-alto; ver conversa de 2026-09-17.)*
6. **HatStats nosso** (§6): uma métrica pública única ("Força: 214") para
   comparar equipas, alimentar mercado e narração. *(Custo: baixo.)*
7. **Confusão em vez de só bónus** (§8): familiaridade que também pune
   troca constante — trava o "meta-hopping" de táticas. *(Custo: baixo.)*
8. **Especialistas/eventos compráveis** (§7): a válvula de caos, para quando
   o resto estiver estável. *(Custo: alto; deixar para o fim.)*

## Fontes

- https://wiki.hattrick.org/wiki/Match_engine
- https://wiki.hattrick.org/wiki/Scoring_opportunities
- https://wiki.hattrick.org/wiki/Regular_chances
- https://wiki.hattrick.org/wiki/Midfield
- https://wiki.hattrick.org/wiki/Attack
- https://wiki.hattrick.org/wiki/Rating
- https://wiki.hattrick.org/wiki/Tactics (+ Pressing, Counter-attacks,
  Attack_in_the_middle, Attack_on_Wings, Man_marking_in_Hattrick)
- https://wiki.hattrick.org/wiki/Skill_contribution
- https://wiki.hattrick.org/wiki/Match_order
- https://wiki.hattrick.org/wiki/HatStats
- https://wiki.hattrick.org/wiki/Special_Event + Specialty +
  New_Framework_for_Specialities_&_Special_Events
- https://wiki.hattrick.org/wiki/Formation_experience
- https://wiki.hattrick.org/wiki/Team_Spirit (+ Stamina, Experience)
- https://devblog.hattrick.org/2017/05/specialties-and-special-events/
- https://devblog.hattrick.org/2017/12/a-new-match-engine-odyssey/
- https://www.hattrick.org/en/Community/Press/?ArticleID=18310
- https://arxiv.org/pdf/2504.09499 (análise comunitária da engine)
