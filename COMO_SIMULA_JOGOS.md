# Como são calculados os resultados dos jogos e as probabilidades

> Documento de leitura acessível para não-programadores. Explica, à "lupa",
> como a máquina de simulação do CashBall decide o resultado de um jogo e de
> onde vêm as probabilidades (odds) que aparecem nas apostas.
> Código-fonte de referência: `server/game/engine.ts`, `matchCalculations.ts`,
> `commentary.ts`, `tacticFamiliarity.ts`.

---

## A ideia-chave: o jogo é simulado minuto a minuto com sorte

Um jogo do CashBall **não tem um resultado pré-calculado**. Em vez disso, a
máquina percorre o jogo **minuto a minuto** (do minuto 1 ao 90, e ao 120 em
caso de taça) e, a cada minuto, **"lança os dados"** (gera números aleatórios)
para decidir se acontece ou não alguma coisa: um golo, uma grande defesa, um
cartão, uma lesão, etc.

A "sorte" não é cega: **as probabilidades mudam conforme a força das equipas**,
as táticas, o cansaço, o clima e o moral. Uma equipa melhor tem mais hipóteses,
mas nunca é certeza — e é isso que torna os jogos imprevisíveis.

Em resumo, ao longo do jogo existem vários "dados" que são lançados:

| Acontecimento | Com que frequência se tenta | Probabilidade aproximada por tentativa |
|---|---|---|
| **Golo** (jogo corrido) | todos os minutos, uma vez por equipa | varia muito (ver abaixo), tipicamente ~1–4% |
| **Penálti** | todos os minutos | 0,2% (1 em 500) por minuto |
| **Cartão amarelo** | todos os minutos, por equipa | ~1,5% (ajustado à agressividade) |
| **Cartão vermelho** | quando aparece um amarelo | ~0,5% direto ou 15% com 2º amarelo |
| **Lesão** | todos os minutos | ~0,3% (multiplicado pelo mau tempo) |
| **Falhanço / grande defesa** | todos os minutos | ~1,8% (comentário, não altera o placar) |
| **Golo anulado por VAR** | quando há um golo (5%) | 5% de o golo ser anulado |

> **Nota importante:** estes números são *tentativas por minuto*. Como o jogo
> tem 90 min e duas equipas, um golo "típico" não é de 3% × 90 — as equipas
> fortes chegam mesmo a marcar vários. O total real de golos depende da força.

---

## 1. A "força" de cada equipa: o número por de trás de tudo

Antes de qualquer minuto, a máquina calcula um valor de **ataque** e um valor de
**defesa** para cada equipa. Estes números são a "matéria-prima" das
probabilidades. A fórmula (em `getPower`) é:

```
ataque  = (média dos médios ×0.4 + média dos avançados ×0.6)
          × fator de formação (ataque)
          × fator de moral
          × fator de estilo
          × fator de forma
          × fator de familiaridade táctica

defesa  = (média dos defesas ×0.6 + média dos guarda-redes ×0.4)
          × fator de formação (defesa)
          × fator de moral
          × fator de forma
          × fator de familiaridade táctica
```

Ou seja, a força depende de seis ingredientes:

### a) Qualidade dos jogadores (skills)
- **Ataque:** pesa 40% os médios e 60% os avançados.
- **Defesa:** pesa 60% os defesas e 40% o guarda-redes.
- Quanto maior a média de `skill` dos titulares, maior a força. Jogadores com
  melhor `skill` também têm mais probabilidade de serem de facto escolhidos
  para o 11 inicial (auto-pick pelo melhor `skill`).

### b) Formação (ex.: 4-4-2, 3-5-2, 4-3-3)
Cada formação tem um "peso" ofensivo e defensivo. Formações atacantes ajudam
no ataque mas prejudicam a defesa, e vice-versa:

| Formação | Fator de ataque | Fator de defesa |
|---|---|---|
| 4-2-4 | 1.15 (muito atacante) | 0.75 (fraca) |
| 3-4-3 | 1.12 | 0.85 |
| 4-3-3 | 1.08 | 0.90 |
| 3-5-2 | 1.05 | 0.95 |
| 4-4-2 | 1.00 (neutra) | 1.00 |
| 4-5-1 | 0.90 | 1.10 |
| 5-3-2 | 0.85 | 1.20 |
| 5-4-1 | 0.80 (fraca) | 1.25 (muito sólida) |

### c) Estilo de jogo (instrução do treinador)
| Estilo | Fator de ataque | Fator de defesa |
|---|---|---|
| OFENSIVO | 1.15 | 0.85 |
| EQUILIBRADO | 1.00 | 1.00 |
| DEFENSIVO | 0.85 | 1.15 |

### d) Moral da equipa (0–100, começa em 50)
- O moral faz oscilar o **ataque ±25%** e a **defesa ±12.5%** em torno de 50.
  A cada 10 pontos acima de 50, o ataque cresce ~5%. Vitória sobe o moral (+25),
  derrota desce (−20), empate sobe pouco (+5). Semanalmente o moral "dói" 90
  da distância para 50, para refletir a forma recente e não o histórico antigo.

### e) Forma dos jogadores (form)
Usa-se a média da forma de toda a equipa, limitada entre 0.85 e 1.15
(forma 100 = fator 1.0; acima de 100, mais forte).

### f) Familiaridade táctica (memória da formação)
Regra fixa: cada jogo dá **uma estrela** à formação usada, dentro de uma janela
das últimas 5 formações (a formação repetida acumula). No pico (5 estrelas):
**+5% ataque e +2.5% defesa**. Quanto mais vezes usar a mesma formação, melhor
a equipa se entende em campo.

> **Dica prática:** os valores finais de ataque/defesa são apenas **proporções**.
> O que importa é a *diferença relativa* entre as duas equipas — não o número em
> absoluto.

---

## 2. Probabilidade de golo num dado minuto (jogo corrido)

Para cada equipa atacante, a máquina calcula a probabilidade de marcar naquele
minuto. A base vem da conhecida **fórmula de Bradley-Terry / Dixon-Coles**:

```
probabilidade de golo = razão × 0.03 × multiplicador do minuto

onde:  razão = ataque_ajustado / (ataque_ajustado + defesa_do_adversário × 2)
```

Depois, esta probabilidade-base é **ajustada por várias "regras de casa"**:

1. **Estilo do adversário:** o ataque é ajustado pelo estilo defensivo do rival
   (`ataque × (1 / fator_estilo_do_rival)`). Um rival defensivo reduz o teu ataque.
2. **Multiplicador do minuto (`getGoalTimeMultiplier`):** simula a distribuição
   real de golos no futebol. Há poucos golos no início, mais no fim:
   - Minutos 86–90: **1.62** (a maior parte dos golos)
   - Minutos 76–85: 1.28
   - Minutos 41–45 e 66–75: 1.11
   - Primeiros 10 min: 0.66 (o mais baixo)
   - Estes valores estão normalizados para a média de 90 min = 1.0.
3. **Vantagem caseira:** fora de jogos de taça (final), a equipa da casa
   multiplica por **1.08** e a visitante por **0.92**.
4. **Clima (`getWeatherGoalMultiplier`):** cada condição meteórica altera o
   golo. Neve reduz muito (0.8), chuva forte aumenta (1.15):

   | Meteo | Multiplicador |
   |---|---|
   | chuva_forte | 1.15 |
   | chuva | 1.08 |
   | vento | 1.05 |
   | sol | 1.00 |
   | frio | 0.90 |
   | nevoeiro | 0.85 |
   | neve | 0.80 |

5. **Posse de bola:** a posse é estimada pela força do meio-campo
   (`midStrength`). Quem domina o meio campo tem um ligeiro bónus no golo
   (fator entre 0.90 e 1.10) — e a posse também é mostrada ao cliente.
6. **Ego (muitos craques):** se houver **3 ou mais** craques (`is_star`) a
   médio ou avançado no 11 inicial, o golo diminui até 0,3 por minuto (cada
   craque extra além do 2º tira 10%). "Demasiados artistas em campo custam golos".

### Depois de um golo ser marcado...
- O jogador que marca é escolhido ponderadamente entre médios/avançados
  (`weightedPickScorer`), favorecendo os de maior `skill`.
- Há **5% de hipótese** de o golo ser **anulado pelo VAR** (fica sem contar).
- Golos em fases específicas (abertura, empate, virada, no fim, goleada) geram
  comentários diferentes. Jogos de taça (final) usam comentários especiais.

---

## 3. O suplício dos penáltis (grandes penalidades)

- A cada minuto há **0.2%** (1 em 500) de hipótese de penálti (durante o tempo
  regulamentar; nos minutos finais da liga **a janela fecha** para não abrir
  ações interativas após o apito).
- O marcador é escolhido (de preferência o melhor `skill` disponível).
- A probabilidade de golo é baseada no `skill` do marcador, em torno de 82%,
  mas limitada entre **74% e 92%**:

```
probabilidade = 0.82 + (skill - 30) / 250
```

- Se falhar, o tipo de falhanço é sorteado: 60% defesa do GR, 10% poste,
  10% ao lado, 20% panenka falhado.

### Desempate por penáltis (taça)
- Alternam-se 5 rondas de 5 penáltis cada.
- Probabilidade por remate: base 72%, ajustada pela diferença de `skill` entre
  o marcador e o guarda-redes (entre 55% e 88%):
  `0.72 + (skill_marcador - skill_gr) / 200`
- Se houver empate após 5 rondas, segue-se **morte súbita** até máximo de 20
  rondas; se persistir o empate, a máquina atribui um golo extra à casa.

---

## 4. Cartões (amarelo e vermelho)

- A cada minuto, cada equipa tem uma probabilidade de cartão que sobe com a
  **agressividade média** dos jogadores em campo:
  `probabilidade_base = 0.015 × (1 + (agressividade_média - 3) × 0.1)`
  Agressividade entre 1 (cordeirinho) e 5 (caceteiro).
- Se um jogador **já tem amarelo**, um novo cartão vira vermelho com 15% de
  probabilidade; também há 0.5% de vermelho "direto".
- **Vermelho:** o jogador é expulso e a equipa passa a jogar com 10 (menos um).
  Se o expulso for o **guarda-redes**, entra o GR suplente e o treinador tem de
  sacrificar um jogador de campo (se for NPC/automático, sacrifica-se o mais
  fraco). Expulsão também suspende o jogador (2 jogos).
- Nos últimos minutos da liga não há cartões, para evitar janelas obrigatórias
  após o fim do jogo.

---

## 5. Lesões

- A cada minuto há ~0.3% de probabilidade de lesão, **multiplicada pelo mau
  tempo**: neve 1.6×, chuva forte 1.4×, vento 1.3×, chuva 1.2×.
- A resistência do jogador dá a hipótese de "aguentar" e evitar a lesão
  (cada ponto de resistência acima de 1 dá 8% de escape).
- Se lesionado grave (10% dos casos): afasta-se **3–8 semanas** e perde skill.
  Leve: afasta-se 1 semana.
- Se não houver substituições, a equipa joga com menos um. Senão o treinador
  escolhe um substituto do banco (preferindo um GR se a lesão foi ao GR).

---

## 6. Cansaço / fadiga

- Cada jogador em campo acumula minutos. A cada **15 min** jogados, há um
  teste de **resistência**: quanto mais resistência, maior a hipótese de
  escapar. Quem falha, perde **1 ponto de skill** (em memória, apenas para o
  jogo — não se persiste na base).
- **Substitutos entram "frescos"** (começam a contar do zero), por isso pernas
  novas valem mais que titulares cansados.
- Com **neve/frio**, ao minuto 60 aplica-se um cansaço extra (−1 de skill a
  todos em campo).

---

## 7. O que acontece depois do jogo (evolução de skill e moral)

Depois do apito, a máquina atualiza o estado dos jogadores da jornada:

- **Moral:** Decai 10% da distância para 50 (forma recente). Depois aplica-se
  o resultado (W +25, D +5, L −20), limitado a 0–100.
- **Evolução de skill** — cada jogador pode subir ou descer 1 ponto, conforme
  a sorte e o contexto:
  - **Convivência:** quem está abaixo da média do plantel evoluir com colegas
    mais fortes (+1, probabilidade crescente com a diferença, até 75%).
  - **Vitória** reforça a evolução para os que estão abaixo da média.
  - **Derrota / derrota seguida** aumentam a pressão de perder skill.
  - **Golos:** 2+ golos = 25% de +1; 1 golo = 10% de +1.
  - **GR:** clean sheet com vitória = 15% de +1.
  - **Cartão vermelho:** 20% de −1.
  - **Presença consecutiva** ajuda (+1, 10%); **estagnação** (6+ jogos sem
    descanso) pode custar skill.
  - **Não jogar há muito** (3+ eventos sem aparecer) dá risco crescente de
    "enferrujar" (−1, 15%).
  - Tudo é limitado ao **teto de potencial** do jogador e à força mínima/máxima
    (`skill` entre 1 e 50).

> Os números de evolução são **escolhidos com sorte** (probabilidades), pelo
> que dois jogadores idênticos em circunstâncias idênticas podem evoluir de
> forma diferente.

---

## 8. As probabilidades das apostas (odds) — `computeMatchOdds`

As odds que aparecem no TacticsView e no evento de apostas do minuto 1 são
**determinísticas** (independentes da sorte): dependem apenas da **força das
equipas**, estimada por **divisão + posição na classificação**.

### Passo 1 — Força de cada equipa
```
força = base_da_divisão + (4.5 - posição) × 3
```
- Base da divisão: 1ª = 55, 2ª = 40, 3ª = 27, 4ª = 15, 5ª = 5.
- A posição (1º a 8º) ajusta: estar mais acima na tabela dá mais força.
- Fator de **vantagem caseira** = +3 pontos.

### Passo 2 — Probabilidade de vitória (eliminando o empate)
```
diferença = força_casa + 3 - força_fora
probabilidade_casa_win = 10^(diferença/45) / (10^(diferença/45) + 10^(-diferença/45))
```
É a mesma lógica "quanto mais forte, mais provável", só que em escala logística.

### Passo 3 — Empate
Como num jogo real, **o empate é mais provável quanto mais equilibradas as
equipas**. Quanto menor a diferença, maior a probabilidade de empate:
```
probabilidade_de_empate = 0.22 + 0.08 × exp(-|diferença| / 30)
```
Isto varia entre ~22% (equipas muito desiguais) e ~30% (equipas equilibradas).

### Passo 4 — Distribuição final
O empate "retira" uma fatia às probabilidades de vitória de cada lado:
```
probabilidade_casa = prob_casa_win × (1 - prob_empate)
probabilidade_fora = prob_fora_win × (1 - prob_empate)
```
Há um **teto para o azarão** (mínimo de ~1/67) para evitar odds absurdas
(ex.: 4ª divisão contra 1ª).

### Passo 5 — Converter em odds (cota)
```
odd = 1 / probabilidade × 1.05   (margem da casa de 5%)
```
É por ter esta margem de 1.05 que o produto das três cotas é > 100%, dando
"lucro" à casa de apostas. Um favorito a 60% aparece a ~1.59, e o azarão
aparece com cota alta.

> **Porque é que a previsão e o jogo não coincidem?** As odds usam uma *estimativa*
> simples de força (divisão+posição), enquanto o jogo usa a força *real*
> minuto a minuto (skills, tática, moral, cansaço...). Por isso o placar real
> pode divergir da previsão da casa — como no futebol verdadeiro.

---

## 9. Extra time e final de Taça (jogos de `round === 5`)

- Em jogos de taça empatados ao fim dos 90', há **prolongamento (91–120)** com
  a mesma simulação minuto a minuto (sem pausa ao intervalo).
- As probabilidades de golo continuam, com os multiplicadores de minuto
  estendidos (90+' é ainda maior).
- Se o prolongamento termina empatado, segue-se o **desempate por penáltis**
  (secção 3) quando se trata de killer/match tipo "final".

---

## 10. "Para leigos": como ler o resultado de um jogo

O processo inteiro é:

1. **Antes do jogo:** as equipas escolhem formação e estilo (o NPC escolhe a
   formação que melhor aproveita os seus jogadores e o estilo conforme se
   considera mais forte ou mais fraco que o adversário).
2. **Minuto a minuto (1→90; 91→120 em taça):** a máquina calcula a força atual
   de cada equipa (skills, cansaço, moral, tática, clima) e lança os dados
   para ver se há golo, cartão, lesão, penálti ou falhanço.
3. **Apita:** atualiza moral, evolução de skill dos jogadores, classificações.
4. **A previsão (odds):** é um cálculo separado, baseado apenas em
   divisão+posição, para dar as cotas de apostas.

A **sorte manda muito** — mas a **estratégia importa**: boas contratações
(skills), a formação certa para o teu plantel, o estilo ajustado ao rival, a
forma física, o moral e a consistência táctica (familiaridade) inclinam
seriamente o prato da balança a teu favor.