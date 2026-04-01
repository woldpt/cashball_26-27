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

As substituições são escolhidas pelos treinadores **ao intervalo**:

- A simulação decorre em **45 segundos por parte** (1ª Parte e 2ª Parte);
- Ao intervalo entre as partes, aparece um **pop-up de substituições** com a lista de jogadores em campo e suplentes disponíveis;
- O treinador pode escolher **até 3 substituições no total** (distribuídas entre os intervalos disponíveis — intervalo principal entre 1ª e 2ª Parte, e potencial intervalo de tempo extra);
- Em partidas da Taça com tempo extra (30 segundos adicionais), há um novo intervalo após a 2ª Parte, antes do tempo extra;
- O treinador pode usar as suas 3 substituições em qualquer intervalo ou não as usar todas;

**Timings de Simulação:**

- **1ª Parte**: 45 segundos de simulação cronometrada
- **Intervalo**: Pop-up de substituições (o treinador tem tempo suficiente para escolher)
- **2ª Parte**: 45 segundos de simulação cronometrada
- **Se for Taça e empate ao fim do tempo regulamentar:**
  - **Tempo Extra**: 30 segundos adicionais de simulação
  - **Intervalo antes do Extra**: Pop-up de substituições (se ainda houver disponíveis)
  - **Se continuar empatado**: Simulação de grandes penalidades (uma a uma)

### Estados de uma Jornada

```
ABERTA
└── Jornada disponível para submissão de tácticas
└── Cada treinador vê quem já submeteu e quem falta (sem ver a táctica adversária)
└── Treinadores de IA submetem automaticamente no momento em que a jornada abre

COMPLETA (todos submeteram)
└── Simulação decorre — transmissão em directo (evento por evento) via Socket.io
└── 1ª Parte: simulação estatística com descrição de eventos (golos, cartões, etc.)
└── Intervalo: (máximo de 3 substituições por jogo podem ser decididas pelos treinadores humanos e IA)
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
18. **Substituições são escolhidas ao intervalo** — durante a transmissão em directo do jogo, ao intervalo aparece um pop-up permitindo até 3 substituições no total. O treinador decide em tempo real durante os intervalos da partida (intervalo principal e potencial intervalo antes do tempo extra).
19. **Semanas com duplo jogo (Campeonato + Taça) têm ciclos de submissão independentes** — o treinador submete para o campeonato, após simulação submete para a Taça. Podem ocorrer em dias diferentes.
20. **Convites de clubes mais fortes são avaliados no final de cada jornada** — aparece na interface do treinador imediatamente.
21. **Descida aos Distritais deixa o treinador como observador** — fica sem clube até receber um convite de um clube sem humano. Não há limite de descidas.
22. Em caso de dúvida sobre uma mecânica não descrita, **perguntar antes de inventar**.

# CashBall 26/27 — Clarificações Críticas

Este documento resolve ambiguidades que causariam bugs na implementação.

---

## 1. CALENDÁRIO EXATO DA ÉPOCA

### Estrutura Semanal

```
Época = 19 Jornadas Total
├── 14 Jornadas de Campeonato (obrigatórias)
└── 5 Rondas de Taça (até eliminação ou vitória final)

Distribuição ao longo da época:
Semana 1:  Jornada 1 Campeonato (submissão 1)
Semana 2:  Jornada 2 Campeonato (submissão 2)
Semana 3:  Jornada 3 Campeonato (submissão 3) + Ronda 1 Taça (submissão 4)
Semana 4:  Jornada 4 Campeonato (submissão 5)
Semana 5:  Jornada 5 Campeonato (submissão 6)
Semana 6:  Jornada 6 Campeonato (submissão 7) + Ronda 2 Taça (submissão 8)
Semana 7:  Jornada 7 Campeonato (submissão 9)
Semana 8:  Jornada 8 Campeonato (submissão 10)
Semana 9:  Jornada 9 Campeonato (submissão 11) + Quartos-de-Final Taça (submissão 12)
Semana 10: Jornada 10 Campeonato (submissão 13)
Semana 11: Jornada 11 Campeonato (submissão 14)
Semana 12: Jornada 12 Campeonato (submissão 15) + Meias-Finais Taça (submissão 16)
Semana 13: Jornada 13 Campeonato (submissão 17)
Semana 14: Jornada 14 Campeonato (submissão 18) + Final Taça (submissão 19)
```

### Semanas com Duplo Jogo

**Exatamente 5 semanas com 2 submissões**: Semanas 3, 6, 9, 12, 14

### Fluxo Temporal Preciso de uma Semana com Duplo Jogo

```
SEMANA 3 (Exemplo)
├─ Estado: JORNADA_ABERTA (Campeonato, Jornada 3)
├─ Treinadores submetem tácticas para Campeonato
├─ QUANDO TODOS SUBMETEM:
│  └─ Estado: JORNADA_SIMULANDO
│  └─ Simulação decorre (45s + intervalo + 45s)
│  └─ Eventos transmitidos em directo
│  └─ Ao intervalo: pop-up substituições
│  └─ Jogo termina
├─ Após simulação do Campeonato:
│  └─ Estado: RONDA_TACA_ABERTA (Ronda 1 Taça)
│  └─ Sorteio da Ronda 1 Taça publicado
│  └─ Treinadores ainda na Taça (32 inicialmente) vêem seu adversário
│  └─ Treinadores submetem tácticas para Taça
├─ QUANDO TODOS SUBMETEM TAÇA:
│  └─ Estado: RONDA_TACA_SIMULANDO
│  └─ Jogo da Taça simulado (mesmo processo)
├─ Após jogo da Taça:
│  └─ Estado: POS_JORNADA
│  └─ Próxima semana: JORNADA_ABERTA (Semana 4, Campeonato Jornada 4)
```

### Número Total de Fases de Submissão

- **Sem eliminar ninguém da Taça**: 14 (campeonato) + 5 (taça) = **19 fases de submissão**
- **Se um treinador é eliminado na Ronda 1**: fica com 14 (campeonato) + 0 (taça) = **14 fases de submissão**
- **Máximo diferença entre treinadores**: 5 fases (quem vai à final vs quem sai na ronda 1)

---

## 2. SUBMISSÃO EM SEMANAS DE DUPLO JOGO

### Fluxo Exato

```typescript
// FASE 1: CAMPEONATO
async function weekDoubleGameFlow(seasonId: string, week: number) {
  // Estado: JORNADA_ABERTA (Campeonato)
  season.status = "JORNADA_ABERTA";
  season.currentCompetition = "CHAMPIONSHIP";
  season.currentRound = championshipRound;

  // Todos os treinadores submetem TÁTICA DE CAMPEONATO
  await waitForAllSubmissions(seasonId, "CHAMPIONSHIP");

  // Simular campeonato
  season.status = "JORNADA_SIMULANDO";
  await simulateAndBroadcastMatches(seasonId, "CHAMPIONSHIP");

  // Atualizar tabelas de campeonato
  season.status = "POS_JORNADA";
  await updateStandings(seasonId, "CHAMPIONSHIP");

  // ===== INTERVALO ENTRE COMPETIÇÕES =====
  // Sorteio da Taça (se aplicável)
  if (isFirstRoundOfCup(cupRound)) {
    await performCupDrawForRound(seasonId, cupRound);
  }

  // FASE 2: TAÇA
  // Estado: RONDA_TACA_ABERTA
  season.status = "RONDA_TACA_ABERTA";
  season.currentCompetition = "CUP";
  season.currentCupRound = cupRound;

  // Notificar treinadores dos seus adversários (via Socket.io)
  io.to(`season_${seasonId}`).emit('cup:round_draw_complete', {
    round: cupRound,
    matches: [...] // adversários, horários, etc.
  });

  // Todos os treinadores (que ainda estão na Taça) submetem TÁTICA DE TAÇA
  // Treinadores eliminados NÃO submetem, apenas observam
  const activeTeamsInCup = await db.getTeamsStillInCup(seasonId);
  await waitForSubmissions(seasonId, "CUP", activeTeamsInCup.length);

  // Simular taça
  season.status = "RONDA_TACA_SIMULANDO";
  await simulateAndBroadcastMatches(seasonId, "CUP");

  // Atualizar tabelas de taça (quadro de eliminatórias)
  season.status = "POS_JORNADA";
  await updateStandings(seasonId, "CUP");

  // Próxima semana volta a JORNADA_ABERTA (campeonato)
}
```

### Chave: Duas Submissões Independentes

1. **Submissão de Campeonato**: Todos os 32 treinadores (ou quantos estão ativos)
2. **Submissão de Taça**: Apenas treinadores cujas equipas ainda estão em prova

---

## 3. HUMANOS vs IA: CLARIFICAÇÃO

### Estrutura Correcta

```
32 Equipas Totais (sempre)
├─ Máximo 8 Humanos por Sala
└─ 24-32 Controladas por IA (conforme quantos humanos entram)

Exemplo 1: 3 Humanos numa Sala
├─ Humano 1: Campeão de Portugal
├─ Humano 2: Segunda Liga
├─ Humano 3: Liga 3
└─ 29 Equipas: Controladas por IA (Primeira Liga, Segunda Liga x2, Liga 3 x2, Campeonato x4, etc.)

Exemplo 2: 8 Humanos numa Sala
├─ 8 Humanos: Distribuídos pelas 4 divisões
└─ 24 Equipas: Controladas por IA
```

### Eventos Socket.io e o Público

Quando emitimos eventos como:

- **Leilão**: "Pop-up aparece para todos os 32 treinadores"
- **Standings**: "Classificação de todos os 32 clubes"
- **Convites**: "Todos os treinadores podem receber convites"

Significa:

- **Humanos**: Recebem eventos via Socket.io (UI actualiza)
- **IA**: Recebe informação internamente (BD), mas não "UI"

O sistema é **único** — a competição é entre 32 equipas, mas apenas até 8 são humanas.

---

## 4. SIMULAÇÃO EM TEMPO REAL (45 + 45 + 30 segundos)

### Gap na Implementação Anterior

O `seasonLoop` não tinha:

- Atraso de 45 segundos para 1ª Parte
- Pop-up de intervalo com timeout
- Atraso de 45 segundos para 2ª Parte
- Potencial tempo extra (30s) + pop-up + grandes penalidades

### Implementação Correcta

```typescript
async function replayMatchViaSockets(
  io: Server,
  seasonId: string,
  match: Match,
  result: MatchResult, // Resultado já simulado
): Promise<void> {
  const roomId = `season_${seasonId}`;
  const matchRoom = `match_${match.id}`;

  // ===== EMITIR INÍCIO DO JOGO =====
  io.to(roomId).emit("match:start", {
    matchId: match.id,
    homeTeam: { id: match.homeTeamId, name: match.homeTeamName },
    awayTeam: { id: match.awayTeamId, name: match.awayTeamName },
    homeFormation: match.homeSubmission.formation,
    awayFormation: match.awaySubmission.formation,
    homeStyle: match.homeSubmission.style,
    awayStyle: match.awaySubmission.style,
    referee: result.referee,
    timestamp: new Date(),
  });

  // ===== 1ª PARTE: 45 SEGUNDOS =====
  console.log(`[Match ${match.id}] 1ª Parte iniciada`);

  const firstHalfStart = Date.now();
  const firstHalfEvents = result.events.filter((e) => e.minute <= 45);

  // Distribuir eventos ao longo de 45 segundos
  for (const event of firstHalfEvents) {
    // Tempo esperado do evento: (minuto / 45) * 45000ms
    const eventTime = (event.minute / 45) * 45000;
    const now = Date.now() - firstHalfStart;

    if (eventTime > now) {
      await sleep(eventTime - now);
    }

    // Emitir evento
    io.to(roomId).emit("match:event", {
      matchId: match.id,
      minute: event.minute,
      part: "1ST_HALF",
      type: event.type,
      team: event.team,
      player: event.player,
      isDecisive: event.isDecisive,
      timestamp: new Date(),
    });
  }

  // Aguardar que a 1ª Parte complete 45 segundos
  const elapsed = Date.now() - firstHalfStart;
  if (elapsed < 45000) {
    await sleep(45000 - elapsed);
  }

  console.log(`[Match ${match.id}] Intervalo`);

  // ===== INTERVALO: POP-UP SUBSTITUIÇÕES =====
  // Apenas treinadores humanos veem e podem agir

  const homeTeamTrainerId = await db.getTrainerIdForTeam(match.homeTeamId);
  const awayTeamTrainerId = await db.getTrainerIdForTeam(match.awayTeamId);

  // Pop-up para HOME
  if (homeTeamTrainerId && isHumanTrainer(homeTeamTrainerId)) {
    io.to(`trainer_${homeTeamTrainerId}`).emit(
      "match:interval_substitutions_available",
      {
        matchId: match.id,
        team: "HOME",
        currentScore: {
          home: result.events.filter(
            (e) => e.minute <= 45 && e.team === "HOME" && e.type === "GOAL",
          ).length,
          away: result.events.filter(
            (e) => e.minute <= 45 && e.team === "AWAY" && e.type === "GOAL",
          ).length,
        },
        remainingSubstitutions: 3,
        minute: 45,
        part: "1ST_HALF",
        timeout: 60000, // 60 segundos
        timestamp: new Date(),
      },
    );
  }

  // Pop-up para AWAY
  if (awayTeamTrainerId && isHumanTrainer(awayTeamTrainerId)) {
    io.to(`trainer_${awayTeamTrainerId}`).emit(
      "match:interval_substitutions_available",
      {
        matchId: match.id,
        team: "AWAY",
        currentScore: {
          /* ... */
        },
        remainingSubstitutions: 3,
        minute: 45,
        part: "1ST_HALF",
        timeout: 60000,
        timestamp: new Date(),
      },
    );
  }

  // Aguardar 60 segundos para substituições (timeout)
  await sleep(60000);

  // Aplicar substituições (se humanos submeteram)
  // Ou usar defaults da IA
  const homeSubstitutions = await db.getSubstitutionsSubmitted(
    match.id,
    "HOME",
  );
  const awaySubstitutions = await db.getSubstitutionsSubmitted(
    match.id,
    "AWAY",
  );

  // Actualizar events com substituições realizadas
  result.events = applySubstitutions(
    result.events,
    homeSubstitutions,
    awaySubstitutions,
  );

  // ===== 2ª PARTE: 45 SEGUNDOS =====
  console.log(`[Match ${match.id}] 2ª Parte iniciada`);

  const secondHalfStart = Date.now();
  const secondHalfEvents = result.events.filter(
    (e) => e.minute > 45 && e.minute <= 90,
  );

  for (const event of secondHalfEvents) {
    const eventTime = ((event.minute - 45) / 45) * 45000;
    const now = Date.now() - secondHalfStart;

    if (eventTime > now) {
      await sleep(eventTime - now);
    }

    io.to(roomId).emit("match:event", {
      matchId: match.id,
      minute: event.minute,
      part: "2ND_HALF",
      type: event.type,
      team: event.team,
      player: event.player,
      isDecisive: event.isDecisive,
      timestamp: new Date(),
    });
  }

  const elapsedSecondHalf = Date.now() - secondHalfStart;
  if (elapsedSecondHalf < 45000) {
    await sleep(45000 - elapsedSecondHalf);
  }

  // ===== DETERMINAR SE HÁ TEMPO EXTRA (TAÇA) =====
  const isTaça = match.type === "CUP";
  const isEmpatado = result.homeGoals === result.awayGoals;

  if (isTaça && isEmpatado) {
    console.log(`[Match ${match.id}] Tempo Extra (30 segundos)`);

    // Pop-up de intervalo antes do extra
    // ... (similar ao anterior)

    // ===== TEMPO EXTRA: 30 SEGUNDOS =====
    const extraTimeStart = Date.now();
    const extraTimeEvents = result.events.filter(
      (e) => e.minute > 90 && e.minute <= 120,
    );

    for (const event of extraTimeEvents) {
      const eventTime = ((event.minute - 90) / 30) * 30000;
      const now = Date.now() - extraTimeStart;

      if (eventTime > now) {
        await sleep(eventTime - now);
      }

      io.to(roomId).emit("match:event", {
        matchId: match.id,
        minute: event.minute,
        part: "EXTRA_TIME",
        type: event.type,
        team: event.team,
        player: event.player,
        timestamp: new Date(),
      });
    }

    const elapsedExtra = Date.now() - extraTimeStart;
    if (elapsedExtra < 30000) {
      await sleep(30000 - elapsedExtra);
    }

    // Se ainda empatado, grandes penalidades
    if (result.homeGoals === result.awayGoals) {
      console.log(`[Match ${match.id}] Grandes Penalidades`);

      // ===== GRANDES PENALIDADES (uma a uma) =====
      const penalties = result.penalties;

      for (const penalty of penalties.homeShots.concat(penalties.awayShots)) {
        await sleep(3000); // 3 segundos entre penaltis

        io.to(roomId).emit("match:event", {
          matchId: match.id,
          minute: 120 + penalty.order,
          part: "PENALTIES",
          type: penalty.scored ? "GOAL" : "MISS",
          team: penalty.team,
          player: penalty.player,
          timestamp: new Date(),
        });
      }
    }
  }

  // ===== FIM DO JOGO =====
  console.log(`[Match ${match.id}] Fim do jogo`);

  io.to(roomId).emit("match:end", {
    matchId: match.id,
    seasonId: seasonId,
    round: match.round,
    homeTeam: { id: match.homeTeamId, name: match.homeTeamName },
    awayTeam: { id: match.awayTeamId, name: match.awayTeamName },
    finalScore: { home: result.homeGoals, away: result.awayGoals },
    result: result.resultType,
    penalties: result.penalties,
    homeTeamMoralChange: result.homeTeamMoralChange,
    awayTeamMoralChange: result.awayTeamMoralChange,
    timestamp: new Date(),
  });
}
```

---

## 5. CÁLCULOS CORRECTOS (Sem Erros de Sintaxe)

### Probabilidade de Golo (CORRIGIDO)

```typescript
function calculateGoalProbabilityPerMinute(
  attackingTeamQuality: number,
  defendingTeamQuality: number,
  isHome: boolean,
): number {
  // Força ofensiva vs força defensiva
  // Quando forças iguais, probabilidade base é ~0.5%

  const baseRatio =
    attackingTeamQuality / (attackingTeamQuality + defendingTeamQuality * 2);

  // Normalizar para ~0.5% por minuto com forças iguais
  const probGoalPerMinute = baseRatio * 0.01; // 1% de chance base

  // Factor casa/fora
  const homeAwayFactor = isHome ? 1.05 : 0.95;

  return probGoalPerMinute * homeAwayFactor;
}

// Exemplo real:
// Ataque qualidade 30, Defesa qualidade 25
// ratio = 30 / (30 + 25*2) = 30 / 80 = 0.375
// prob = 0.375 * 0.01 = 0.00375 = 0.375% por minuto
// Em 45 minutos: ~16% chance de marcar pelo menos 1 golo
```

### Probabilidade de Cartão (CORRIGIDO)

```typescript
function calculateYellowCardProbabilityPerMinute(
  averageAggressivenessInField: number, // 1-5
): number {
  // Probabilidade base: 2% por minuto com agressividade = 3
  const probCartaoBase = 0.02;

  // Modificar com agressividade
  // Se agressividade = 1: factor = 1 + (1-3)*0.1 = 1 - 0.2 = 0.8
  // Se agressividade = 3: factor = 1 + (3-3)*0.1 = 1.0
  // Se agressividade = 5: factor = 1 + (5-3)*0.1 = 1.2

  const aggressionFactor = 1 + (averageAggressivenessInField - 3) * 0.1;

  return probCartaoBase * aggressionFactor;
}

function calculateRedCardProbability(yellowCardProbability: number): number {
  // 15% de chance de cartão amarelo vira vermelho
  return yellowCardProbability * 0.15;
}
```

### Cálculo de Força Ofensiva (CORRIGIDO)

```typescript
function calculateOffensiveForce(
  team: Team,
  submission: Submission,
  moral: number,
): number {
  // 1. Qualidade base (por posição)
  const midfieldersInField = team.players.filter(
    (p) => p.position === "M" && submission.startingXI.includes(p.id),
  );
  const forwardsInField = team.players.filter(
    (p) => p.position === "A" && submission.startingXI.includes(p.id),
  );

  const avgMidfielderQuality = average(
    midfieldersInField.map((p) => p.quality),
  );
  const avgForwardQuality = average(forwardsInField.map((p) => p.quality));

  const baseOffensiveForce =
    avgMidfielderQuality * 0.4 + avgForwardQuality * 0.6;

  // 2. Factor formação
  const formationOffensiveFactors = {
    "4-2-4": 1.15,
    "3-4-3": 1.12,
    "4-3-3": 1.08,
    "4-4-2": 1.0,
    "4-5-1": 0.9,
    "5-3-2": 0.85,
    "5-4-1": 0.8,
  };
  const formationFactor = formationOffensiveFactors[submission.formation];

  // 3. Factor moral
  const moralFactor = 1 + (moral - 50) * 0.01; // -50% a +50%

  // 4. Factor estilo
  const styleFactors = {
    DEFENSIVO: 0.85,
    EQUILIBRADO: 1.0,
    OFENSIVO: 1.15,
  };
  const styleFactor = styleFactors[submission.style];

  // 5. Factor estilo adversário (penalização)
  // Se adversário é muito defensivo, menos probabilidade de golo
  // Isto é aplicado no cálculo de probabilidade, não aqui

  return baseOffensiveForce * formationFactor * moralFactor * styleFactor;
}
```

### Cálculo de Força Defensiva (CORRIGIDO)

```typescript
function calculateDefensiveForce(team: Team, submission: Submission): number {
  // 1. Qualidade base (por posição)
  const defendersInField = team.players.filter(
    (p) => p.position === "D" && submission.startingXI.includes(p.id),
  );
  const keepersInField = team.players.filter(
    (p) => p.position === "G" && submission.startingXI.includes(p.id),
  );

  const avgDefenderQuality = average(defendersInField.map((p) => p.quality));
  const avgKeeperQuality = average(keepersInField.map((p) => p.quality));

  const baseDefensiveForce = avgDefenderQuality * 0.6 + avgKeeperQuality * 0.4;

  // 2. Factor formação
  const formationDefensiveFactors = {
    "5-4-1": 1.25,
    "5-3-2": 1.2,
    "4-5-1": 1.1,
    "4-4-2": 1.0,
    "3-5-2": 0.95,
    "4-3-3": 0.9,
    "3-4-3": 0.85,
    "4-2-4": 0.75,
  };
  const formationFactor = formationDefensiveFactors[submission.formation];

  // 3. Nota: Moral NÃO afecta defesa, apenas ataque

  // 4. Factor estilo (defesa torna-se mais resistente)
  const styleFactors = {
    DEFENSIVO: 1.15, // +15% defesa
    EQUILIBRADO: 1.0,
    OFENSIVO: 0.85, // -15% defesa
  };
  const styleFactor = styleFactors[submission.style];

  return baseDefensiveForce * formationFactor * styleFactor;
}
```

### Fórmula Final de Probabilidade (CORRIGIDO)

```typescript
function simulateGoalAttempt(
  attackingTeam: Team,
  defendingTeam: Team,
  attackingTeamSubmission: Submission,
  defendingTeamSubmission: Submission,
  attackingTeamMoral: number,
  isHome: boolean,
  rng: SeededRandom,
): MatchEvent | null {
  const offensiveForce = calculateOffensiveForce(
    attackingTeam,
    attackingTeamSubmission,
    attackingTeamMoral,
  );

  const defensiveForce = calculateDefensiveForce(
    defendingTeam,
    defendingTeamSubmission,
  );

  // Probabilidade base
  const ratio = offensiveForce / (offensiveForce + defensiveForce * 2);
  let probGoal = ratio * 0.01; // 1% de chance base

  // Factor casa/fora
  probGoal *= isHome ? 1.05 : 0.95;

  // Factor estilo adversário (penalização extra se é muito defensivo)
  if (defendingTeamSubmission.style === "DEFENSIVO") {
    probGoal *= 0.85; // -15% extra
  } else if (defendingTeamSubmission.style === "OFENSIVO") {
    probGoal *= 1.1; // +10% extra
  }

  // Determinar se há golo
  if (rng.next() < probGoal) {
    // Seleccionar jogador que marca
    const scorer = selectScorerFromTeam(
      attackingTeam,
      attackingTeamSubmission,
      rng,
    );

    // Determinar se é decisivo (craque)
    const craqueCount = countCraquesInField(
      attackingTeam,
      attackingTeamSubmission,
    );
    const craqueFactor = Math.min(0.6, 0.2 * craqueCount); // Cap em 60%
    const isDecisive = rng.next() < craqueFactor;

    return {
      minute: calculateCurrentMinute(), // contexto
      part: calculateCurrentPart(),
      type: "GOAL",
      team: isHome ? "HOME" : "AWAY",
      player: scorer,
      isDecisive: isDecisive,
    };
  }

  return null;
}
```

---

## 6. PROMOÇÃO APÓS DESCIDA (RANDOM PURO)

### Mecanismo

```typescript
async function finalizeSeasonPromotions(seasonId: string) {
  const season = await db.getSeason(seasonId);
  const standings = await db.getStandings(seasonId, "CHAMPIONSHIP");

  // 1. Identificar equipas despromovidas
  const relegated = getLastTwoTeams(standings.division4); // 2 equipas

  // 2. No final da época, sortear 2 de entre TODOS os 32 clubes
  const allTeams = await db.getAllTeamsInSeason(seasonId);
  const randomSelectedTeams = random.shuffle(allTeams).slice(0, 2);

  // 3. Essas 2 são promovidas para divisão 4 (substituindo os 2 que desceram)
  for (const promotedTeam of randomSelectedTeams) {
    await db.setTeamDivision(promotedTeam.id, 4);
  }

  // 4. Os 2 despromovidos perdem seus postos (treinador fica observador)
  for (const relegatedTeam of relegated) {
    await db.setTeamDivision(relegatedTeam.id, null); // "fora de competição"
    const trainer = await db.getTrainerForTeam(relegatedTeam.id);
    if (trainer && isHumanTrainer(trainer.id)) {
      await db.setTrainerStatus(trainer.id, "OBSERVING");
    }
  }

  console.log(
    `Promoção random: ${randomSelectedTeams.map((t) => t.name).join(", ")} => Divisão 4`,
  );
  console.log(
    `Descida: ${relegated.map((t) => t.name).join(", ")} => Observadores`,
  );
}
```

### Clarificação

- **Puro random**: Qualquer uma das 32 equipas tem igual probabilidade
- **Sem critérios**: Não favorece equipas que desceram, equipas em forma, nada
- **Justo**: Cria incerteza e drama na competição

---

## CHECKLIST DE CLARIFICAÇÕES IMPLEMENTADAS

- [ ] Calendário fixo: Semanas 3, 6, 9, 12, 14 com duplo jogo
- [ ] 19 fases de submissão máximo (14 campeonato + 5 taça)
- [ ] Submissões independentes: Campeonato depois Taça na mesma semana
- [ ] 32 equipas totais, max 8 humanas, resto IA
- [ ] Simulação cronometrada: 45s + intervalo (60s) + 45s + potencial 30s + penaltis
- [ ] Pop-up de substituições ao intervalo (timeout 60s)
- [ ] Cálculos sem erros de sintaxe, valores realistas
- [ ] Força ofensiva inclui: qualidade, formação, moral, estilo
- [ ] Força defensiva inclui: qualidade, formação, estilo (não moral)
- [ ] Probabilidade golo ~0.5-1% por minuto (realista)
- [ ] Cartão amarelo: 2% base \* factor agressividade
- [ ] Cartão vermelho: 15% de amarelo vira vermelho
- [ ] Craques: +20% prob golo decisivo, capped em 60%
- [ ] Promoção: random puro de 32 clubes (sem critérios)
- [ ] Árbitro inclinação: gerado random por jogo (±15% em cartões/penaltis)
