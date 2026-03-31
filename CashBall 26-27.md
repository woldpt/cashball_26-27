# CashBall 26/27

## Conceito Central

Jogo de gestão de futebol baseado em texto/dados, fiel ao espírito minimalista e estatístico do **Elifoot 98**, mas correndo num browser moderno com suporte a **multiplayer assíncrono orientado à disponibilidade dos treinadores**. O jogo não tem horários fixos: a jornada avança assim que **todos os treinadores activos submetem a sua táctica**. Num mesmo dia podem realizar-se zero jogos ou várias jornadas completas — depende inteiramente da rapidez com que os participantes respondem. **As partidas decorrem e são visíveis em tempo real para todos os humanos assim que a jornada é simulada.**

---

## Género e Referências

- **Género**: Gestão desportiva, turn-based, estratégia leve

- **Tom**: Nostálgico mas moderno — interface limpa, dados densos, sem gráficos 3D

- **Referências principais**:
  - Elifoot 98 (mecânicas base, filosofia de jogo)
  - Football Manager (profundidade de elenco)
  - Lichess (UX limpo)

---

## Plataforma e Stack

### Frontend (`/client`)

- **React 19 com Vite 8** — SPA em JavaScript puro
- **Tailwind CSS 4** via plugin Vite
- **Socket.io-client 4** — comunicação em tempo real com o servidor
- **JSDoc** — type hints sem compilação (intellisense no VS Code)

### Backend (`/server`)

- **Node.js com Express 5** — API REST em TypeScript
- **Socket.io 4** — notificações em tempo real (submissões, resultados de jornada)
- **SQLite 3** — base de dados local em ficheiro
- **bcryptjs** — hashing de passwords
- **dotenv** — configuração por variáveis de ambiente
- **express-rate-limit** — protecção contra abuso da API

### Infraestrutura

- **Docker Compose** — orquestração de containers (client + server)
- **Deploy**: Web — desktop e mobile browser

### Notas de Arquitectura

- **TypeScript no Backend** — Express em TypeScript para lógica crítica (cálculos de jornadas, transferências, finanças); Frontend em JavaScript puro com JSDoc para type hints
- A base de dados é **SQLite** (ficheiro local), não PostgreSQL — adequado para desenvolvimento e para a escala actual do jogo (32 treinadores)
- **As partidas decorrem e são visíveis em tempo real para todos os humanos** assim que a jornada é simulada — não é necessário estar online em simultâneo para submeter a táctica, mas os jogos são transmitidos em directo (via Socket.io) para quem está online
- **JavaScript + JSDoc no Frontend** — sem compilação adicional, intellisense no VS Code, simples e rápido
- **Stack recomendado**: React 19 + Vite no frontend (JavaScript + JSDoc), Node.js + Express 5 no backend (TypeScript), SQLite como base de dados. Dependências principais: `socket.io-client` (frontend), `socket.io`, `bcryptjs`, `dotenv`, `express-rate-limit` (backend)

---

## Ciclo de Jogo

### Estrutura de uma Época

```
Pré-época
└── Definição de formação e táctica inicial
└── Novo ano fiscal

Época Regular
└── 19 jogos
└── 14 jornadas de campeonato por divisão
└── 5 rondas de Taça intercaladas (incluindo final no Jamor)
└── Cada semana avança quando todos os treinadores activos submetem a táctica
└── As partidas decorrem e são transmitidas em directo (via Socket.io) para todos os humanos online
└── Rondas da Taça: treinador ainda em competição submete a táctica. Treinadores já eliminados ficam só a observar as partidas.

Pós-época
└── Subidas / descidas apuradas (campeonato)
└── Vencedor do Campeonato e da Taça de Portugal proclamado
└── Atribuição de prémios de ambas as competições
└── Convites de clubes mais fortes emitidos aos treinadores em destaque
```

### O que faz o Treinador antes de Submeter

Antes de submeter a táctica para a próxima jornada, o treinador pode:

1. **Definir formação e táctica** para o próximo jogo
2. **Analisar próximo adversário** (ver últimos resultados, plantel, etc.)
3. **Escolher jogadores titulares e suplentes**
4. **Dar ordens de equipa** (Escolha de táctica. Ex: 4-4-2, 4-3-3, 5-3-2, etc.)
5. **Negociar transferências** (analisar mercado de transferências, colocar jogadores em leilão)
6. **Gerir finanças** (consultar balanço, renegociar contratos, pedir empréstimo bancário)
7. **Submeter** → A jornada simula quando o último treinador activo submete

---

## Mecânicas Principais

### Atributos dos Jogadores

Cada jogador tem os seguintes atributos:

`posição` - Posição em campo (G, D, M, A);
└── G - Guarda-Redes
└── D - Defesa
└── M - Médio
└── A - Avançado

`qualidade` - Qualidade geral (Valor de 1 a 50);

`salario` - Custo semanal para o clube (€);

`agressividade` - Agressividade (calmo ou agressivo);
└── 1 - Cordeirinho
└── 2 - Cavalheiro
└── 3 - Fair-Play
└── 4 - Caneleiro
└── 5 - Caceteiro

`craque` - Flag booleana — ver secção **Craques**.

### Craques

Aproximadamente **10% dos jogadores das posições Médios e Avançados** são considerados craques. São jogadores que se destacam claramente dos demais e têm impacto desproporcional na simulação de jogos. Todas as equipas devem começar com pelo menos 1 craque.

- A flag `craque` é visível no plantel e no mercado — é informação pública, e é definida por um \* sempre após o nome;
- Craques têm `qualidade` significativamente acima da média da sua posição;
- São mais caros (salário e valor de mercado mais elevados);
- Guarda-redes e Defesas **não têm flag de craque** — a distinção aplica-se apenas a Médios e Avançados;
- **Craques não afectam directamente a probabilidade de vitória**, mas têm **+20% de chance de marcar um golo decisivo** durante a simulação de um jogo;
- Ter demasiados craques numa equipa pode criar efeitos indesejados (conflitos de egos).

### Simulação de Jogos

- Simulação **estatística/probabilística**, não em tempo real;
- Resultado calculado com base em:
  - Atributos médios ponderados por posição;
  - Presença de craques em campo (+20% chance de golo decisivo por craque em campo);
  - Formação e táctica escolhidas
  - Moral da equipa
  - Factor casa/fora
  - Inclinação do árbitro (ver secção Árbitros)
  - Aleatoriedade controlada (seed por jornada)

- Após simulação, é gerado um **relatório de jogo** com eventos principais:
  - Golos (quem, minuto aproximado)
  - Cartões (amarelo/vermelho)
  - Estatísticas (posse de bola, remates, etc.)
  - Avaliação do árbitro (inclinação visível)

### Formações Suportadas

- 4-4-2 (Clássico)
- 4-3-3 (Ofensivo)
- 3-5-2 (Controlo de bola)
- 5-3-2 (Autocarro)
- 4-5-1 (Catenaccio)
- 3-4-3 (Ataque total)
- 4-2-4 (Avassalador)
- 5-4-1 (Ferrolho)

### Tácticas de Equipa

- **Estilo**: Defensivo / Equilibrado / Ofensivo

### Posições dos Jogadores

```
G — Guarda-Redes
D — Defesas
M — Médios
A — Avançados
```

### Árbitros

Cada partida tem um **árbitro nomeado pelo servidor**. A inclinação do árbitro é **gerada aleatoriamente para cada jogo** — não é uma característica fixa de cada árbitro, é simplesmente um elemento de surpresa por jogo.

- A inclinação é **visível antes da partida** através de uma pequena balança que mostra a tendência para a Equipa A ou Equipa B;
- A inclinação afecta a probabilidade de **cartões (vermelho/amarelo)** e **penaltis**, com variação até ±15% em relação à probabilidade base;
- **Não afecta directamente o resultado do jogo** — é um factor leve, apenas por diversão, que acrescenta imprevisibilidade e conversa entre treinadores;

---

## Gestão de Treinadores

### Entrada no Jogo

Quando um treinador humano entra numa sala nova criada por si, ou através da senha de convite de sala criada por outro treinador humano, é-lhe atribuída uma equipa do **Campeonato de Portugal** escolhida aleatoriamente de entre as disponíveis (sem treinador humano). O treinador não escolhe o clube — é sorteado. Pode entrar em qualquer jornada ou época em que o jogo esteja.

### Despedimento

Um treinador que esteja a fazer uma época claramente abaixo das expectativas pode ser **despedido** pelo clube. O despedimento é avaliado automaticamente pelo servidor com base em:

- Posição na tabela vs. expectativa para o clube;
- Sequência de derrotas consecutivas;
- Estado financeiro do clube (saldo negativo prolongado);

Após ser despedido, o treinador fica **sem clube** durante algumas jornadas, em modo de espera. Durante esse período:

- O clube passa a ser **gerido por IA** até o treinador aceitar um novo convite;
- O treinador pode observar os jogos e o mercado, mas não gere nenhum clube;
- Está elegível para receber **convites de clubes em situação de desespero** (equipas em risco de descida, ou com treinador que acabou de sair);
- Aceitar um convite coloca-o imediatamente à frente desse clube - a IA deixa de o gerir;

### Descida aos Distritais

Quando um clube humano é despromovido do **Campeonato de Portugal** (últimos 2 da divisão 4), o treinador fica **sem clube activo** e entra em modo de **observador apenas**:

- Fica à espera de receber um convite de um clube sem treinador humano que o convide para treinar;
- Durante este período, pode observar todos os jogos e o mercado, mas não pode fazer nenhuma acção de gestão;
- Quando um clube sem humano o convida, o treinador regressa imediatamente com esse novo clube;
- Não há limite de descidas — um treinador pode descer múltiplas vezes;

### Convites para Clubes Mais Fortes

Um treinador que esteja a fazer um trabalho excelente — posição acima do esperado, sequência de vitórias, moral da equipa alta — pode receber **convites de clubes de divisões superiores**. Os convites são avaliados **no final de cada jornada**.

- O convite aparece na interface do treinador em qualquer altura da época;
- O treinador pode aceitar (sobe de divisão com novo clube) ou recusar (mantém o clube actual);
- Recusar um convite não tem penalização;
- Aceitar um convite deixa o clube anterior **sem treinador**, que entra no sistema de convites de desespero.

---

## Multiplayer e Filosofia de Jogo

### Princípio Central: Avanço por Submissão + Transmissão em Directo

O CashBall 26/27 **não tem hora marcada para os jogos**. Não há calendário real, não há notificações de "o teu jogo começa às 20h". O jogo avança quando os treinadores estão disponíveis;

O mecanismo é simples: uma jornada está **pendente** até que todos os treinadores activos submetam a sua táctica para o próximo jogo. Assim que o último treinador submete, **todos os jogos dessa jornada são simulados de imediato** e são **transmitidos em directo via Socket.io** para todos os humanos online. As partidas decorrem e são visíveis em tempo real (evento por evento) para quem esteja a observar.

Isto significa que:

- Num dia em que todos os treinadores estejam online ao mesmo tempo, podem realizar-se **várias jornadas consecutivas** no espaço de horas;
- Num dia em que ninguém aceda ao jogo, **nenhum jogo acontece**;
- Quem está online vê os jogos a decorrer em tempo real; quem não está pode ver os resultados e relatórios quando voltar;
- Não existe penalização automática por demora — o ritmo é ditado colectivamente pelos participantes.

### O que é uma "Submissão de Táctica"

Submeter uma táctica significa o treinador confirmar, para o próximo jogo pendente:

1. **Formação** (ex: 4-3-3)
2. **Onze titular** e **suplentes** (incluindo 3 suplentes predefinidos para potenciais substituições)
3. **Instruções de equipa** (estilo: defensivo/equilibrado/ofensivo)

Após submeter, o treinador pode **alterar a táctica** enquanto a jornada ainda não tiver sido simulada (ou seja, enquanto houver pelo menos outro treinador que ainda não submeteu). Assim que o último treinador submete, as tácticas ficam bloqueadas e a simulação corre.

### Substituições durante a Simulação

As substituições são **predefinidas antes de submeter a táctica**:

- O treinador escolhe **até 3 suplentes** que podem entrar em campo durante o jogo;
- Essas substituições são escolhidas no momento de submeter a táctica, não durante o jogo;
- A IA do servidor decide **quando e se** essas substituições ocorrem durante a simulação, com base em:
  - Esgotamento físico simulado
  - Resultado do jogo
  - Cartões recebidos
  - Lesões simuladas (se aplicável)

**Nota:** O modelo é completamente assíncrono — o treinador não pode fazer acções em tempo real durante o jogo.

### Estados de uma Jornada

```
ABERTA
└── Jornada disponível para submissão de tácticas
└── Cada treinador vê quem já submeteu e quem falta (sem ver a táctica adversária)
└── Treinadores de IA submetem automaticamente no momento em que a jornada abre

COMPLETA (todos submeteram)
└── Simulação decorre — transmissão em directo (evento por evento) via Socket.io
└── 1ª Parte: simulação estatística com descrição de eventos (golos, cartões, etc.)
└── Intervalo: (sem acção de treinadores — substituições já foram predefinidas)
└── 2ª Parte: continuação da simulação
└── Se for uma partida da Taça e estiver empatada ao fim do tempo regulamentar:
    └── Tempo extra: 30 minutos adicionais de simulação
    └── Se continuar empatado, avança-se para simulação de grandes penalidades (uma a uma)
└── Próxima jornada transita para ABERTA automaticamente após simulação
```

### Visibilidade de Submissões

- Cada treinador vê **quem já submeteu** a táctica (lista de clubes: ✅ / ⏳)
- **Não é visível o conteúdo** da táctica antes da simulação — só após os resultados
- Isto cria um elemento estratégico: saber que o adversário já submeteu pode influenciar a decisão de alterar a própria táctica antes de confirmar

### Semanas com Jogo de Taça

Quando uma semana inclui um jogo de campeonato seguido de um jogo de Taça, o treinador submete uma táctica de cada vez para cada jogo, em **ciclos de submissão independentes**:

1. **Ciclo 1:** Submissão para o jogo de campeonato
   - Todos os treinadores submetem tácticas para o campeonato
   - Jogo de campeonato é simulado e transmitido em directo
2. **Ciclo 2:** Submissão para o jogo de Taça
   - Todos os treinadores submetem tácticas para o jogo da Taça
   - Jogo da Taça é simulado e transmitido em directo
   - Próxima jornada transita para ABERTA

- Pode definir formações, titulares e instruções diferentes para cada jogo;
- As tácticas são submetidas em separado — nada obriga a que o jogo da Taça seja simulado no mesmo dia que o campeonato;

### Modos de Jogo

**Principal** - A liga principal do jogo — até 8 clubes humanos nas 4 divisões

### Criação e Entrada numa Sala de Jogo

O primeiro jogador humano a criar uma sala de jogo torna-se o seu **fundador** e recebe uma **senha única** de 6 letras gerada pelo servidor. Esta senha é o único mecanismo de acesso — o fundador partilha-a com quem quiser convidar.

- A senha é uma string curta e legível (ex: `ABCDEF`);
- Qualquer pessoa com a senha pode juntar-se à sala **a qualquer momento** — em qualquer jornada ou época em que o jogo esteja;
- Ao entrar, o novo treinador recebe uma equipa do Campeonato de Portugal sorteada aleatoriamente de entre as disponíveis (sem treinador humano);
- **Máximo de 8 jogadores humanos** por sala — tentativas de entrada após esse limite são recusadas;
- Os restantes clubes sem treinador humano são geridos por IA até alguém se juntar;

### Mercado de Transferências

Há duas formas de vender jogadores:

#### A) Lista de Transferências

- O treinador coloca um jogador à venda com um preço fixo pedido;
- Qualquer clube pode comprá-lo pelo preço pedido, a qualquer momento;
- O jogador fica listado publicamente no mercado até ser comprado ou retirado da lista.

#### B) Leilão Imediato

- O treinador coloca um jogador em leilão imediato com um timeout de **15 segundos de tempo real**;
- **Um pop-up de leilão aparece para todos os 32 treinadores humanos** das 4 divisões principais;
- Cada clube pode dar **uma única licitação** durante os 15 segundos;
- Os clubes de IA licitam respeitando o orçamento disponível de cada um;
- Após os 15 segundos, o leilão encerra:
  - O nome do vencedor (clube que licitou mais alto) aparece num pop-up confirmação;
  - O jogador é transferido automaticamente para o vencedor;
  - O saldo do vencedor é actualizado imediatamente.

### Regras do Plantel

- Mínimo obrigatório: **11 jogadores** (suficiente para formar um onze);
- Mínimo de 1 guarda-redes por plantel - se este se lesionar, joga um jogador de campo na baliza;
- Máximo permitido: **24 jogadores**;
- Não é possível vender ou leiloar um jogador se isso fizer descer o plantel abaixo de 11;

---

## Finanças

| Receita         | Descrição                                   |
| --------------- | ------------------------------------------- |
| Bilheteira      | Depende de resultados recentes e capacidade |
| Prémios de liga | Vencedor da Primeira Liga — 1.000.000€      |
| Prémio da taça  | Vencedor da Taça de Portugal — 500.000€     |
| Transferências  | Venda de jogadores                          |

| Despesa             | Descrição                                 |
| ------------------- | ----------------------------------------- |
| Salários            | Soma dos salários semanais do plantel     |
| Compra de jogadores | Custo de transferências                   |
| Estádio             | Custo de aumento da capacidade do estádio |
| Juros de empréstimo | 5% do valor em dívida por semana          |

### Estádio

Todos os clubes têm um estádio com pelo menos 10.000 lugares.
Podem construir lotes de 5.000 lugares com o custo de 300.000€ cada.
A receita da bilheteira de cada jogo varia consoante a fase boa ou má da equipa.

### Empréstimos Bancários

Os clubes podem solicitar **empréstimos bancários** para cobrir despesas ou financiar contratações.

- O empréstimo é creditado imediatamente no saldo do clube;
- São cobrados **5% de juros por semana** sobre o valor em dívida — taxa deliberadamente elevada para penalizar dependência crónica de crédito;
- O clube pode amortizar o empréstimo parcial ou totalmente a qualquer momento;
- Clube com saldo negativo prolongado entra em **modo de crise** — o treinador tem elevada probabilidade de ser despedido.

---

## Competições

Cada época, todos os clubes participam **simultaneamente em duas competições distintas**: o **Campeonato** e a **Taça de Portugal**. São competições independentes, com formatos e objectivos diferentes, mas que correm em paralelo ao longo da mesma época. Um clube pode vencer as duas, uma, ou nenhuma.

O jogo tem **32 clubes jogáveis** (controlados por jogadores humanos), distribuídos igualmente por 4 divisões de 8 equipas cada. Em vez de uma quinta divisão com simulação, os Distritais, o sistema usa simplesmente um **sorteio de promoção** no final da época.

---

### Competição 1 — Campeonato (Liga por Pontos)

O Campeonato é a competição principal, organizado em **quatro divisões jogáveis** com um total de **32 clubes humanos**. Todas as divisões têm **8 equipas** e jogam em regime de todos-contra-todos com jogos de ida e volta, totalizando **14 jornadas** por época.

#### Estrutura das Divisões

| Divisão                    | Nível | Jogável | Clubes | Jornadas |
| -------------------------- | ----- | ------- | ------ | -------- |
| **Primeira Liga**          | 1     | ✅ Sim  | 8      | 14       |
| **Segunda Liga**           | 2     | ✅ Sim  | 8      | 14       |
| **Liga 3**                 | 3     | ✅ Sim  | 8      | 14       |
| **Campeonato de Portugal** | 4     | ✅ Sim  | 8      | 14       |

#### Formato

- Cada par de clubes joga **dois jogos** por época (casa e fora);
- **Vitória**: 3 pontos · **Empate**: 1 ponto · **Derrota**: 0 pontos;
- Em caso de igualdade de pontos, os critérios de desempate são (por ordem):
  1.  Diferença de golos
  2.  Golos marcados
  3.  Diferença de golos marcados - golos sofridos

#### Calendarização

- As 14 jornadas do campeonato são distribuídas ao longo da época
- Em semanas sem jogo de Taça, o clube joga **exclusivamente** para o campeonato
- Em semanas com jogo de Taça, o turno inclui **dois jogos a gerir** (ver Taça abaixo)

#### Subidas e Descidas

```
Primeira Liga (8 clubes — nível 1)
└── Últimos 2 descem para a Segunda Liga

Segunda Liga (8 clubes — nível 2)
└── Top 2 sobem para a Primeira Liga
└── Últimos 2 descem para a Liga 3

Liga 3 (8 clubes — nível 3)
└── Top 2 sobem para a Segunda Liga
└── Últimos 2 descem para o Campeonato de Portugal

Campeonato de Portugal (8 clubes — nível 4)
└── Top 2 sobem para a Liga 3
└── Últimos 2: treinador perde clube e fica como observador
```

- Novos jogadores entram sempre no **Campeonato de Portugal**. Equipa a treinar é sorteada aleatoriamente;
- Subidas e descidas acontecem no **final de cada época**, após o fim do campeonato e da Taça de Portugal.
- No final da época, 2 clubes são **sorteados aleatoriamente** de entre todos os 32 (incluindo os que desceram) para serem promovidos e regressarem à competição activa na época seguinte, substituindo os 2 que desceram do Campeonato de Portugal;

#### Prémios do Campeonato

| Classificação              | Prémio                                                      |
| -------------------------- | ----------------------------------------------------------- |
| 1.º lugar                  | Campeão da divisão (Registo no Palmarés) + subida garantida |
| 2.º lugar                  | Subida garantida                                            |
| Últimos 2 (níveis 1–3)     | Descida de divisão                                          |
| Últimos 2 (Camp. Portugal) | Descida — jogador perde clube e aguarda regresso            |

---

### Competição 2 — Taça de Portugal (Eliminatórias Knock-out)

A Taça de Portugal é uma competição paralela ao campeonato, de carácter **eliminatório**: perder significa ficar imediatamente fora. Participam **apenas as 32 equipas dos quatro campeonatos principais** (Primeira Liga, Segunda Liga, Liga 3 e Campeonato de Portugal). É a única competição transversal a todas as divisões jogáveis — um clube do Campeonato de Portugal pode eliminar o campeão da Primeira Liga.

#### Calendário da Taça

A Taça tem **5 rondas** distribuídas ao longo da época (Rondas 1–5), intercaladas com jornadas de campeonato. O calendário de datas exactas é gerado no seed e publicado no início da época.

#### Formato Geral

- **32 equipas** participantes — número que produz um quadro perfeitamente limpo por potências de 2;
- Cada eliminatória é disputada a **jogo único**;
- Em caso de empate no tempo regulamentar, o jogo avança para 30 minutos extra;
- Em caso de empate no tempo extra, o resultado é decidido por **grandes penalidades** (simuladas probabilisticamente, uma a uma);
- O vencedor avança; o perdedor está imediatamente eliminado;
- **Não há cabeças-de-série** — o sorteio é completamente aberto em cada ronda;

#### Estrutura das Rondas

```
Ronda 1 (16 avos) — 32 equipas → 16 jogos → 16 apuradas
Ronda 2 (8 avos) — 16 equipas → 8 jogos → 8 apuradas
Quartos-de-final — 8 equipas → 4 jogos → 4 apuradas
Meias-finais — 4 equipas → 2 jogos → 2 apuradas
Final (Jamor) — 2 equipas → 1 jogo → 1 vencedor
```

#### Sorteio

- O sorteio é realizado **antes de cada ronda**, não no início da época;
- Todas as equipas ainda em prova entram num sorteio aberto, sem potes nem restrições geográficas;
- O sorteio é executado pelo servidor de forma transparente, com seed auditável e registado;
- Os treinadores são notificados do adversário assim que o sorteio termina;

#### Submissão de Tácticas na Taça

Os jogos de Taça seguem exactamente o mesmo modelo de submissão do campeonato: **a eliminatória só é simulada quando ambos os treinadores submetem a táctica**. Se o jogo de Taça coincide com uma jornada de campeonato, o treinador submete primeiro a táctica do campeonato; após a simulação do jogo de campeonato, escolhe a táctica para o jogo da Taça (em ciclo de submissão independente).

#### Local da Final — Estádio do Jamor

- A final é sempre disputada em **local neutro: o Estádio do Jamor**;
- Não há equipa da casa nem equipa de fora — factor casa/fora é **0** para ambas;
- O Jamor é um atributo fixo e imutável da final da Taça, independentemente de quem chega.

#### Grandes Penalidades

- Sequência de 5 penaltis por equipa, simulados individualmente;
- Probabilidade de conversão baseada nos atributos de `qualidade` do executante e `qualidade` do guarda-redes adversário;
- Em caso de igualdade após 5 penaltis, é morte súbita (penalti a penalti até haver vencedor).

#### Prémios da Taça de Portugal

| Resultado | Prémio                        |
| --------- | ----------------------------- |
| Vencedor  | Troféu + 500.000€ + prestígio |

> **Nota:** Finalista, meias-finalistas, quartos-de-final e eliminados antes não recebem prémios financeiros nem de prestígio — participam apenas pela competição e pela honra de vencer.

> A Taça não afecta subidas nem descidas — é uma competição de prestígio e financeira, completamente independente do campeonato.

---

### Evolução dos Jogadores

- O elenco de jogadores é **fixo e permanente** — não há jogadores novos criados pelo jogo, nem jogadores que se reformem ou envelheçam;
- Os mesmos jogadores existem desde o início e mantêm-se indefinidamente no universo do jogo;
- A `qualidade` de um jogador pode flutuar ao longo do tempo, com os limites **mínimo 1 e máximo 50**:
  - Qualidade aumenta **+1** se o jogador jogou em **5+ jornadas consecutivas** ao lado de jogadores com qualidade acima da sua qualidade média;
  - Jogadores perdem qualidade se houver muitos maus resultados seguidos;
- A flag `craque` é **permanente** — não muda independentemente da evolução da `qualidade`;
- Moral da equipa flutua com resultados em **ambas as competições**.

---

## Interface e UX

### Princípios de Design

- **Dados em primeiro lugar** — tabelas, números, listas densas;
- **Sem gráficos animados pesados** — máximo: sparklines e barras simples;
- **Modo escuro por defeito** — paleta inspirada em terminais e estatísticas desportivas;
- **Responsivo** — funciona em mobile (acções de turno simples) e desktop (gestão completa).

### Ecrãs Principais

| Ecrã                  | Descrição                                                   |
| --------------------- | ----------------------------------------------------------- |
| **Dashboard**         | Resumo: próxima jornada, saldo, notificações, convites      |
| **Plantel**           | Lista de jogadores com atributos, ordenável e filtrável     |
| **Formação**          | Editor táctico drag-and-drop (campo de futebol esquemático) |
| **Mercado**           | Pesquisa de listas de transferência e leilões               |
| **Campeonato**        | Classificação da divisão, calendário, resultados            |
| **Taça**              | Quadro de eliminatórias, próximo adversário, resultados     |
| **Relatório de Jogo** | Eventos do jogo simulado, árbitro, estatísticas             |
| **Finanças**          | Balanço, receitas, despesas, empréstimos activos            |
| **Configurações**     | Notificações, preferências                                  |

---

## Dados de Base (Seed Data)

- O jogo arranca com **32 clubes** (8 por divisão, nas 4 divisões jogáveis);
- O script `db/seed.js` popula a base de dados inicial;
- O elenco de jogadores é gerado **uma única vez** no seed e nunca é alterado pelo sistema — não há criação de novos jogadores nem remoção de jogadores existentes:
  - Plantel inicial de cada clube gerado a partir de ficheiro JSON (`/db/players.json`) com base em:
    - Divisão de entrada (clubes de divisões superiores têm plantel mais forte)
    - Variância aleatória (para diferenciação entre clubes da mesma divisão)
    - ~10% dos Médios e Avançados gerados com flag `craque = true`
    - Nomes de jogadores lidos de ficheiro JSON (`/db/players.json`)

- A inclinação do árbitro é gerada aleatoriamente no momento de cada jogo — não há pool de árbitros no seed;
- O ficheiro `/db/players.json` contém nomes de jogadores em formato array e será criado durante a inicialização do projecto.

---

## Estados do Jogo

```
PRE_EPOCA — Mercado e preparação activos
JORNADA_ABERTA — À espera de submissões; cada treinador pode submeter/rever táctica
JORNADA_SIMULANDO — Simulação em decurso; transmissão em directo via Socket.io
POS_JORNADA — Resultados visíveis; próxima jornada transita para ABERTA
RONDA_TACA_ABERTA — Sorteio da ronda publicado; equipas a submeter tácticas
RONDA_TACA_SIMULANDO — Simulação em decurso; transmissão em directo
FIM_EPOCA — Apuramento de subidas/descidas, vencedor da Taça, prémios, convites de clubes mais fortes emitidos
ENCERRADA — Época terminada (arquivo)
```

---

## Regras e Restrições para o Assistente

> Estas regras aplicam-se sempre que o Copilot ajudar a desenvolver este projecto.

1. **Manter coerência com as mecânicas acima** — não introduzir sistemas não descritos sem aviso explícito.
2. **Fidelidade ao espírito do Elifoot 98** — simplicidade e dados em primeiro lugar; evitar complexidade desnecessária tipo FIFA Ultimate Team.
3. **O multiplayer avança por submissão e as partidas são transmitidas em directo** — a jornada simula quando todos os treinadores activos submetem a táctica; as partidas decorrem e são visíveis em tempo real (via Socket.io) para todos os humanos online. Nunca sugerir timers de jogo fixos, horas marcadas, ou modelos à Hattrick.
4. **Stack: React 19 + Vite no frontend (JavaScript + JSDoc), Node.js + Express 5 no backend (TypeScript), SQLite como base de dados** — sugerir sempre código nesse contexto. Dependências recomendadas: `socket.io-client` (frontend), `socket.io`, `bcryptjs`, `dotenv`, `express-rate-limit` (backend).
5. **Português de Portugal** em todos os textos de UI, mensagens de sistema e comentários de código.
6. **Sem microtransacções ou mecânicas de monetização** — este é um projecto independente/hobby.
7. **Base de dados SQLite** — modelar com SQL compatível com SQLite (sem tipos PostgreSQL-específicos como `SERIAL`, `JSONB`, etc.).
8. **Socket.io já está implementado** — usar para notificações em tempo real (jornada simulada, sorteio da Taça, transmissão de eventos de jogo, pop-ups de leilão, etc.), nunca para sincronização de estado de jogo que deveria ser tratada por polling/API.
9. A **Taça de Portugal tem 32 participantes** (apenas clubes das 4 divisões principais).
10. **Craques existem apenas nas posições Médios e Avançados** — nunca atribuir flag `craque` a GR ou Defesas. Craques têm +20% chance de marcar um golo decisivo.
11. **Árbitros não têm perfil fixo** — a inclinação é gerada aleatoriamente por jogo, afecta apenas a probabilidade de cartões e penaltis (±15%), não o resultado geral.
12. **Empréstimos bancários têm 5% de juros por semana** — taxa intencional para penalizar má gestão financeira.
13. **Plantel mínimo 11, máximo 24** — nunca permitir venda/leilão que faça descer abaixo de 11.
14. **Leilões incluem todos os 32 clubes das divisões principais** como potenciais licitadores (humanos e IA). Pop-up de leilão aparece para todos; cada clube dá uma única licitação em 15 segundos de tempo real.
15. **O elenco de jogadores é fixo** — nunca sugerir criação de novos jogadores, reformas, ou envelhecimento. Os jogadores do seed são permanentes. A `qualidade` flutua entre 1 e 50; a flag `craque` nunca muda.
16. **Máximo 8 jogadores humanos por sala** — o acesso é feito exclusivamente por senha única gerada no momento da criação da sala.
17. **Sem Distritais com simulação** — usar sorteio simples de promoção no final da época para economizar CPU.
18. **Substituições são predefinidas** — o treinador escolhe até 3 suplentes no momento de submeter a táctica; a IA do servidor decide quando aplicá-las durante a simulação.
19. **Semanas com duplo jogo (Campeonato + Taça) têm ciclos de submissão independentes** — o treinador submete para o campeonato, após simulação submete para a Taça. Podem ocorrer em dias diferentes.
20. **Convites de clubes mais fortes são avaliados no final de cada jornada** — aparece na interface do treinador imediatamente.
21. **Descida aos Distritais deixa o treinador como observador** — fica sem clube até receber um convite de um clube sem humano. Não há limite de descidas.
22. Em caso de dúvida sobre uma mecânica não descrita, **perguntar antes de inventar**.
