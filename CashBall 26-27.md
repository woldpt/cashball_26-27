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

# CashBall 26/27 — Detalhamento Técnico

Este documento complementa a especificação principal e clarifica sistemas críticos para evitar ambiguidades durante a implementação.

---

## 1. MORAL DA EQUIPA

### Range e Escala

- **Range**: 0 a 100 (inteiro)
- **Inicial**: 50 (neutro) para todas as equipas no início da época

### Cálculo de Mudança

Após cada jogo (campeonato ou Taça):

```
if (resultado == VITÓRIA):
  moral += 10
elif (resultado == EMPATE):
  moral += 0
elif (resultado == DERROTA):
  moral -= 15

// Caps
moral = max(0, min(100, moral))
```

**Nota especial:** A moral é **compartilhada entre Campeonato e Taça** — uma derrota em qualquer competição afecta a mesma moral.

### Impacto no Resultado do Jogo

A moral afecta a **probabilidade de golos marcados** (ataque):

```
bónus_moral = (moral - 50) * 0.005
// Se moral = 50: bónus = 0
// Se moral = 100: bónus = +0.5 (50% de aumento na probabilidade de golo)
// Se moral = 0: bónus = -0.5 (-50% na probabilidade de golo)
```

A moral **não afecta defesa** — golos sofridos dependem apenas dos atributos defensivos da equipa adversária e da sua moral.

---

## 2. CÁLCULO DO RESULTADO DO JOGO

### Modelo Base: Força Ofensiva vs. Força Defensiva

A simulação de um jogo calcula:

1. **Força Ofensiva da Equipa A** (ataque)
2. **Força Defensiva da Equipa B** (defesa)
3. Probabilidade de golo da Equipa A
4. Repetir para Equipa B
5. Determinar resultado final

### Cálculo de Força Ofensiva

```
força_ofensiva = (
  qualidade_média_médios * 0.4 +
  qualidade_média_avançados * 0.6
)

// Aplicar factor formação (mais ofensiva = mais golos)
formação_ofensiva_factor = {
  "4-2-4": 1.15,    // Muito ofensiva
  "3-4-3": 1.12,    // Ofensiva
  "4-3-3": 1.08,    // Ligeiramente ofensiva
  "4-4-2": 1.00,    // Neutra
  "4-5-1": 0.90,    // Defensiva
  "5-3-2": 0.85,    // Muito defensiva
  "5-4-1": 0.80     // Defensiva máxima
}

força_ofensiva *= formação_ofensiva_factor

// Aplicar bónus de moral
bónus_moral = (moral_equipa_a - 50) * 0.005
força_ofensiva *= (1 + bónus_moral)

// Aplicar estilo de jogo
estilo_factor = {
  "DEFENSIVO": 0.85,
  "EQUILIBRADO": 1.00,
  "OFENSIVO": 1.15
}
força_ofensiva *= estilo_factor["sua_instrução"]
força_ofensiva *= (1 / estilo_factor[adversário_instrução])  // Penalizar se adversário é defensivo
```

### Cálculo de Força Defensiva

```
força_defensiva = (
  qualidade_média_defesas * 0.6 +
  qualidade_média_guarda_redes * 0.4
)

// Aplicar factor formação (mais defesas = menos golos sofridos)
formação_defensiva_factor = {
  "5-4-1": 1.25,    // Máxima defesa (menos golos sofridos)
  "5-3-2": 1.20,
  "4-5-1": 1.10,
  "4-4-2": 1.00,    // Neutra
  "3-5-2": 0.95,
  "4-3-3": 0.90,
  "3-4-3": 0.85,
  "4-2-4": 0.75     // Mínima defesa (mais golos sofridos)
}

força_defensiva *= formação_defensiva_factor

// Nota: Força defensiva não sofre impacto directo de moral
// (a moral só afecta ataque, não defesa)
```

### Cálculo de Probabilidade de Golo

Para cada minuto de simulação (45 + 45 + potencial 30 extra):

```
// Função base: quanto maior o ataque, mais alta a probabilidade
// quanto maior a defesa, mais baixa

prob_golo_base = força_ofensiva / (força_ofensiva + força_defensiva_adversária * 2)

// Normalizar para intervalo 0-10% por minuto
prob_golo_por_minuto = prob_golo_base * 0.02  // ~2% de chance base por minuto se forças iguais

// Factor casa/fora
if (is_home_team):
  prob_golo_por_minuto *= 1.05  // +5% para equipa de casa
else:
  prob_golo_por_minuto *= 0.95  // -5% para equipa fora

// Factor inclinação árbitro (afecta apenas cartões/penaltis, não golos directos)
// não afecta esta probabilidade

### Cálculo de Probabilidade de Cartão

```

// Probability de cartão amarelo por minuto
prob_cartao_amarelo_base = 0.02 // 2% por minuto com agressividade neutra

// Modificar com base na agressividade média da equipa
agressividade_média_equipa = média(agressividade dos 11 em campo)

prob_cartao_amarelo = prob_cartao_amarelo_base _ (1 + (agressividade_média_equipa - 3) _ 0.1)

// Exemplos:
// - Agressividade média = 1 (Cordeirinho): 1 - 0.2 = 0.8 (20% menos cartões)
// - Agressividade média = 3 (Fair-Play): 1 + 0 = 1.0 (probabilidade base)
// - Agressividade média = 5 (Caceteiro): 1 + 0.2 = 1.2 (20% mais cartões)

// Cartão vermelho é mais raro e geralmente apenas por acumulação ou transgressão grave
prob_cartao_vermelho = prob_cartao_amarelo \* 0.15 // 15% de cartão amarelo vira vermelho

// Determinar se há golo neste minuto
if (random(0, 1) < prob_golo_por_minuto):
golo_marcado = true

// Verificar se é um "golo decisivo" (craque pode influenciar)
if (número*craques_em_campo > 0):
prob_golo_decisivo = 0.2 \* número_craques_em_campo
if (random(0, 1) < prob_golo_decisivo):
golo*é_decisivo = true
// (nota: isto apenas afecta narrativa ou atributo do relatório, não o cálculo)

```

### Resumo de Pesos

| Factor | Descrição | Peso |
|--------|-----------|------|
| Qualidade Médios (Ataque) | Contribuem para golos | 0.4 |
| Qualidade Avançados (Ataque) | Contribuem para golos | 0.6 |
| Qualidade Defesas (Defesa) | Reduzem golos sofridos | 0.6 |
| Qualidade GR (Defesa) | Reduz golos sofridos | 0.4 |
| Formação | Modifica ofensa/defesa | ±15% |
| Estilo | Modifica ofensa/defesa | ±15% |
| Moral (Ataque) | Aumenta probabilidade golo | ±50% max |
| Casa/Fora | Casa +5%, Fora -5% | ±5% |
| Craques | +20% prob golo decisivo | +20% |

**Importante**: Guarda-redes **não contribui** ao ataque — apenas à defesa.

---

## 3. SISTEMA DE CONVITES

### Avaliação

Os convites são avaliados **no final de cada jornada** (após simulação e atualização de tabelas).

### Critérios para Receber Convite

**Convites de Clubes Mais Fortes** (promoção):
- Treinador no topo da sua divisão (dentro dos top 3)
- Sequência de 3+ vitórias consecutivas (em qualquer competição)
- Mora de equipa > 70

**Convites de Clubes em Crise** (fundo/ascensão):
- Treinador em modo observador (sem clube)
- Clube em risco de descida (nos últimos 2 da sua divisão)
- **OU** clube sem treinador (despedido ou promovido)

### Frequência

- Máximo **um convite por treinador por jornada**
- Nem todas as jornadas têm convites — apenas quando critérios são encontrados
- A probabilidade é **rara** — aproximadamente 20-30% de chance numa jornada típica para um treinador elegível

### Múltiplos Convites Simultâneos

Um treinador **nunca recebe mais de um convite numa mesma jornada**. Se vários clubes o querem, apenas o primeiro a cumprir os critérios envia convite.

### IA também Recebe Convites

Sim. Clubes geridos por IA também podem receber convites para trocar de treinador. Quando isto acontece, o servidor aloca um novo "treinador IA" com personalidade e comportamento diferentes (mais conservador, mais ofensivo, etc.). Isto afecta:
- Seleção de tácticas
- Estilo de jogo preferido
- Estratégia de transferências
- Gestão financeira

---

## 4. MERCADO DE TRANSFERÊNCIAS

### Leilão Imediato — Desempate em Caso de Bids Simultâneos

Se dois ou mais clubes licitem com o mesmo valor:

```

vencedor = clube_com_menor_timestamp_de_bid

```

**O desempate é feito pelo timestamp do servidor** (timestamp do momento exacto em que o servidor recebe o bid), não pela ordem de clique no cliente. Isto garante:
- Imparcialidade (clock única de verdade no servidor)
- Impossibilidade de "lag gaming"
- Reprodutibilidade para auditorias

### Lista de Transferências — Venda Simultânea

Se múltiplos clubes tentarem comprar o mesmo jogador à venda por preço fixo no mesmo segundo:

```

comprador = clube_com_menor_timestamp_de_compra

````

Mesma regra: **timestamp do servidor**.

### Limite de Budget para IA em Leilões

Quando um clube de IA participa num leilão:

```typescript
function calculateMaxBidForAiTeam(aiTeam: Team, player: Player): number {
  // Budget disponível = saldo actual
  const budgetAvailable = aiTeam.balance;

  // Threshold: IA não gasta mais de 40% do saldo em um jogador
  const maxSpendThreshold = 0.40;

  // Preço máximo que IA vai oferecer
  const playerMarketValue = player.quality * 50000; // Estimativa: 50k por qualidade

  // IA nunca licita acima do saldo - margem de segurança (5 semanas de salários)
  const safetyMargin = aiTeam.squad
    .reduce((acc, p) => acc + p.salary * 5, 0); // 5 semanas de salários

  const maxBid = Math.min(
    playerMarketValue,
    (budgetAvailable - safetyMargin) * maxSpendThreshold
  );

  // IA só licita se consegue pagar
  if (maxBid < player.salary * 4) {
    return 0; // Não licita
  }

  // Licitação aleatória até ao máximo
  return Math.floor(maxBid * (0.7 + Math.random() * 0.3));
}
````

**Regras:**

- IA respeita **40% do saldo** como limite de gasto por jogador
- IA mantém **5 semanas de salários** como margem de segurança
- IA **não licita** se não conseguir pagar 4 semanas de salário do jogador
- Licitação varia entre 70-100% do máximo calculado (variabilidade)

---

## 5. REGRA DE CRAQUES NA SIMULAÇÃO

### Definição Precisa

Para cada **evento de golo decisivo** durante a simulação:

```
probabilidade_golo_decisivo = 0.2 * número_craques_em_campo_na_equipa

// Exemplo:
// - 0 craques: 0% chance de golo decisivo
// - 1 craque: 20% chance
// - 2 craques: 40% chance
// - 3+ craques: 60% cap máximo (evitar OP)

// Implementação:
probabilidade_golo_decisivo = min(0.6, 0.2 * número_craques)
```

**Efeito do Golo Decisivo:**

- Aumenta dramaticamente a visualização no relatório (descrição épica)
- Afecta narrativa do jogo, não o cálculo de resultado
- Um golo marcado é um golo — seja decisivo ou não, vale 1 ponto
- Serve principalmente para criar tensão e conversa entre treinadores

---

## 6. LOOP PRINCIPAL DO JOGO

```typescript
async function seasonLoop(seasonId: string) {
  let season = await db.getSeason(seasonId);

  while (season.status !== "ENCERRADA") {
    // FASE 1: Abrir submissão
    await openSubmissionPhase(season);
    console.log(
      `[${new Date().toISOString()}] Jornada ${season.currentRound} aberta`,
    );

    // FASE 2: Esperar por submissões
    let allSubmitted = false;
    while (!allSubmitted) {
      await sleep(5000); // Verificar a cada 5 segundos

      const submissions = await db.getSubmissions(
        season.id,
        season.currentRound,
      );
      const activeTrainers = await db.getActiveTrainers(season.id);

      allSubmitted = submissions.length === activeTrainers.length;
    }

    console.log(
      `[${new Date().toISOString()}] Todas as submissões recebidas. Iniciando simulação...`,
    );

    // FASE 3: Simular matches
    season.status = "JORNADA_SIMULANDO";
    await db.updateSeason(season);

    const matches = await db.getMatches(season.id, season.currentRound);
    for (const match of matches) {
      const result = simulateMatch(match, season.seed);
      await db.updateMatchResult(match.id, result);

      // Broadcast evento via Socket.io
      io.to(`season_${season.id}`).emit("match:simulated", {
        matchId: match.id,
        result: result,
        timestamp: new Date(),
      });
    }

    // FASE 4: Atualizar estado
    season.status = "POS_JORNADA";
    season.currentRound += 1;

    // Avaliar convites
    await evaluateInvites(season);

    // Atualizar tabelas
    await updateStandings(season);

    // Verificar se epoch terminou
    if (season.currentRound > season.totalRounds) {
      season.status = "FIM_EPOCA";
      await finalizeEpoch(season);
      season.status = "ENCERRADA";
    }

    await db.updateSeason(season);
    console.log(
      `[${new Date().toISOString()}] Jornada completada. Próxima: ${season.currentRound}`,
    );
  }
}
```

---

## 7. SEED E CONSISTÊNCIA

### Onde é Guardado

```typescript
interface Season {
  id: string;
  year: number;
  seed: string; // Seed global da época
  currentRound: number;
  roundSeeds: Map<number, string>; // Seed específica de cada jornada
}

interface Match {
  id: string;
  seasonId: string;
  round: number;
  roundSeed: string; // Referência à seed da jornada
  homeTeamId: string;
  awayTeamId: string;
  result: {
    homeGoals: number;
    awayGoals: number;
  };
  simulatedAt: Date;
}
```

### Reprodutibilidade

Para recriar exactamente o mesmo jogo:

```typescript
function simulateMatch(match: Match, roundSeed: string): MatchResult {
  // Criar RNG determinístico a partir da seed
  const rng = seededRandom(roundSeed);

  // Usar rng() para todas as decisões
  const homeGoals = calculateGoals(match.homeTeam, match.awayTeam, true, rng);

  const awayGoals = calculateGoals(match.awayTeam, match.homeTeam, false, rng);

  return { homeGoals, awayGoals };
}

// Exemplo: Mesma seed = mesmos resultados
const seed1 = generateSeed(); // "a7f3b2e1c9d0..."
const result1 = simulateMatch(match, seed1);
const result2 = simulateMatch(match, seed1);
// result1 === result2 (idêntico)
```

### Dependência de Ordem de Execução

**Não depende.** A seed é **global por jornada** — não importa a ordem em que os jogos são processados dentro dessa jornada. Cada jogo tem:

```typescript
const match_seed = roundSeed + "_" + match.id;
```

Isto garante que cada jogo é independente e reprodutível.

---

## 8. MÁQUINA DE ESTADOS FORMAL

### Estados e Transições Válidas

```
┌─────────────────────────────────────────────────────────┐
│                      PRE_EPOCA                           │
│  (Mercado aberto, preparação inicial)                    │
│  Treinadores: podem editar formação, mercado activo      │
└─────────────────────┬──────────────────────────────────┘
                      │
                      v
┌─────────────────────────────────────────────────────────┐
│                  JORNADA_ABERTA                          │
│  (Aguardando submissões de tácticas)                     │
│  Treinadores: podem submeter/alterar táctica             │
│  IA: submete automaticamente                             │
└─────────────────────┬──────────────────────────────────┘
                      │
              (todos submeteram)
                      v
┌─────────────────────────────────────────────────────────┐
│                JORNADA_SIMULANDO                         │
│  (Simulação a correr, transmissão em directo)            │
│  Treinadores: apenas observam, podem fazer subs          │
│  ao intervalo (pop-up obrigatório)                       │
└─────────────────────┬──────────────────────────────────┘
                      │
          (45s + intervalo + 45s)
                      v
┌─────────────────────────────────────────────────────────┐
│                  POS_JORNADA                             │
│  (Resultados finais, relatórios disponíveis)             │
│  Treinadores: podem ver resultados, mercado activo       │
└─────────────┬──────────────────┬────────────────────────┘
              │                  │
    (próxima jornada)    (se há jogo de Taça)
              │                  │
              v                  v
     JORNADA_ABERTA   RONDA_TACA_ABERTA
       (campeonato)         (Taça)
```

### Transições Explícitas

```typescript
enum SeasonState {
  PRE_EPOCA = "PRE_EPOCA",
  JORNADA_ABERTA = "JORNADA_ABERTA",
  JORNADA_SIMULANDO = "JORNADA_SIMULANDO",
  POS_JORNADA = "POS_JORNADA",
  RONDA_TACA_ABERTA = "RONDA_TACA_ABERTA",
  RONDA_TACA_SIMULANDO = "RONDA_TACA_SIMULANDO",
  FIM_EPOCA = "FIM_EPOCA",
  ENCERRADA = "ENCERRADA",
}

interface StateTransition {
  from: SeasonState;
  to: SeasonState;
  trigger: string;
  condition?: () => boolean;
}

const validTransitions: StateTransition[] = [
  { from: "PRE_EPOCA", to: "JORNADA_ABERTA", trigger: "epoch_start" },
  { from: "JORNADA_ABERTA", to: "JORNADA_SIMULANDO", trigger: "all_submitted" },
  {
    from: "JORNADA_SIMULANDO",
    to: "POS_JORNADA",
    trigger: "simulation_complete",
  },
  {
    from: "POS_JORNADA",
    to: "JORNADA_ABERTA",
    trigger: "next_round",
    condition: () => hasMoreRounds(),
  },
  {
    from: "POS_JORNADA",
    to: "RONDA_TACA_ABERTA",
    trigger: "cup_round_available",
    condition: () => isCupRound(),
  },
  {
    from: "RONDA_TACA_ABERTA",
    to: "RONDA_TACA_SIMULANDO",
    trigger: "all_submitted_cup",
  },
  {
    from: "RONDA_TACA_SIMULANDO",
    to: "POS_JORNADA",
    trigger: "cup_simulation_complete",
  },
  {
    from: "POS_JORNADA",
    to: "FIM_EPOCA",
    trigger: "epoch_end",
    condition: () => isLastRound(),
  },
  { from: "FIM_EPOCA", to: "ENCERRADA", trigger: "finalize_epoch" },
];

// Validação
function canTransition(from: SeasonState, to: SeasonState): boolean {
  const transition = validTransitions.find(
    (t) => t.from === from && t.to === to,
  );
  return transition && (!transition.condition || transition.condition());
}
```

---

## 9. EVENTOS SOCKET.IO — CONTRATO

### Namespaces

```
/seasons/:seasonId
  └── Todos os eventos relacionados com a época

/matches/:matchId
  └── Eventos relacionados com o jogo específico

/auction/:auctionId
  └── Eventos de leilões
```

### Eventos de Jornada

#### `round:opened`

```typescript
{
  seasonId: string;
  round: number;
  type: "CHAMPIONSHIP" | "CUP";
  deadline?: null; // sem deadline
  timestamp: Date;
}
```

#### `round:all_submitted`

```typescript
{
  seasonId: string;
  round: number;
  type: "CHAMPIONSHIP" | "CUP";
  submissionCount: number;
  timestamp: Date;
}
```

#### `round:simulation_start`

```typescript
{
  seasonId: string;
  round: number;
  type: "CHAMPIONSHIP" | "CUP";
  matchCount: number;
  timestamp: Date;
}
```

#### `round:simulation_complete`

```typescript
{
  seasonId: string;
  round: number;
  type: "CHAMPIONSHIP" | "CUP";
  timestamp: Date;
}
```

### Eventos de Match

#### `match:start`

```typescript
{
  matchId: string;
  seasonId: string;
  round: number;
  homeTeam: {
    id: string;
    name: string;
  }
  awayTeam: {
    id: string;
    name: string;
  }
  homeFormation: string;
  awayFormation: string;
  homeStyle: "DEFENSIVO" | "EQUILIBRADO" | "OFENSIVO";
  awayStyle: "DEFENSIVO" | "EQUILIBRADO" | "OFENSIVO";
  referee: {
    name: string;
    bias: "HOME" | "NEUTRAL" | "AWAY";
  }
  timestamp: Date;
}
```

#### `match:event`

```typescript
{
  matchId: string;
  minute: number;
  part: "1ST_HALF" | "INTERVAL" | "2ND_HALF" | "EXTRA_TIME" | "PENALTIES";
  type: "GOAL" | "YELLOW_CARD" | "RED_CARD" | "SUBSTITUTION";

  // Para GOAL:
  // {
  //   team: "HOME" | "AWAY";
  //   player: { id: string; name: string };
  //   isDecisive: boolean;
  // }

  // Para YELLOW_CARD / RED_CARD:
  // {
  //   team: "HOME" | "AWAY";
  //   player: { id: string; name: string };
  // }

  // Para SUBSTITUTION:
  // {
  //   team: "HOME" | "AWAY";
  //   playerOut: { id: string; name: string };
  //   playerIn: { id: string; name: string };
  // }

  timestamp: Date;
}
```

#### `match:interval_substitutions_available`

```typescript
{
  matchId: string;
  team: "HOME" | "AWAY";
  currentScore: {
    home: number;
    away: number;
  }
  remainingSubstitutions: number;
  minute: number;
  part: "1ST_HALF" | "2ND_HALF" | "EXTRA_TIME";
  timeout: 60000; // 60 segundos em ms para escolher
  timestamp: Date;
}
```

#### `match:end`

```typescript
{
  matchId: string;
  seasonId: string;
  round: number;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
  finalScore: { home: number; away: number };
  result: "HOME_WIN" | "AWAY_WIN" | "DRAW";
  penalties?: {
    homeShots: number;
    awayShots: number;
    homeConverted: number;
    awayConverted: number;
    winner: "HOME" | "AWAY";
  };
  homeTeamMoralChange: number;
  awayTeamMoralChange: number;
  timestamp: Date;
}
```

### Eventos de Leilão

#### `auction:start`

```typescript
{
  auctionId: string;
  seasonId: string;
  player: {
    id: string;
    name: string;
    position: string;
    quality: number;
  }
  sellingTeam: {
    id: string;
    name: string;
  }
  minimumBid: number;
  timeout: 15000; // 15 segundos
  timestamp: Date;
}
```

#### `auction:bid_received`

```typescript
{
  auctionId: string;
  biddingTeam: {
    id: string;
    name: string;
  }
  bidAmount: number;
  timestamp: Date;
  // Nota: Apenas enviado para a equipa que licita, não broadcast
}
```

#### `auction:end`

```typescript
{
  auctionId: string;
  player: {
    id: string;
    name: string;
  }
  sellingTeam: {
    id: string;
    name: string;
  }
  winningTeam: {
    id: string;
    name: string;
  }
  finalPrice: number;
  allBids: {
    team: {
      id: string;
      name: string;
    }
    amount: number;
  }
  [];
  timestamp: Date;
}
```

### Eventos de Sistema

#### `season:invite_received`

```typescript
{
  seasonId: string;
  trainerId: string;
  offeringTeam: { id: string; name: string; division: number };
  currentTeam?: { id: string; name: string }; // se trocando de clube
  reason: "PROMOTION" | "CRISIS" | "FIRED";
  timestamp: Date;
  expiresAt: Date; // 24 horas para responder
}
```

#### `season:standings_updated`

```typescript
{
  seasonId: string;
  round: number;
  type: "CHAMPIONSHIP" | "CUP";
  standings: {
    division: number;
    teams: {
      id: string;
      name: string;
      position: number;
      points: number;
      played: number;
      won: number;
      drawn: number;
      lost: number;
      goalsFor: number;
      goalsAgainst: number;
      goalDifference: number;
    }
    [];
  }
  [];
  timestamp: Date;
}
```

---

## 10. MODELO DE DADOS EXPLÍCITO

### Entidades Principais

```typescript
interface Season {
  id: string;
  year: number;
  status: SeasonState;
  seed: string;
  startedAt: Date;
  currentRound: number;
  totalRounds: number; // 14 para campeonato + 5 para taça = 19 total
  endedAt?: Date;
}

interface Team {
  id: string;
  name: string;
  division: number; // 1-4
  seasonId: string;
  balance: number; // em euros
  stadium: {
    capacity: number;
    expansionCost: number; // 300.000 por 5.000 lugares
  };
  currentTrainerId?: string; // null se gerido por IA
  aiPersonality?: AiPersonality;
  morale: number; // 0-100
  createdAt: Date;
}

interface Player {
  id: string;
  name: string;
  position: "G" | "D" | "M" | "A";
  quality: number; // 1-50
  salary: number; // euros por semana
  aggressiveness: 1 | 2 | 3 | 4 | 5; // 1=calm, 5=aggressive
  isCraque: boolean;
  teamId: string;
  acquiredAt: Date;
  lastQualityChangeRound?: number;
  qualityChangeStreak?: number; // para rastrear 5+ jornadas
}

interface Submission {
  id: string;
  seasonId: string;
  round: number;
  type: "CHAMPIONSHIP" | "CUP";
  trainerId: string;
  teamId: string;
  formation: string; // "4-3-3", etc.
  style: "DEFENSIVO" | "EQUILIBRADO" | "OFENSIVO";
  startingXI: string[]; // array de player IDs
  substitutes: string[]; // array de player IDs (até 5)
  submittedAt: Date;
}

interface Match {
  id: string;
  seasonId: string;
  round: number;
  type: "CHAMPIONSHIP" | "CUP";
  homeTeamId: string;
  awayTeamId: string;
  status: "SCHEDULED" | "SIMULATING" | "COMPLETED";
  roundSeed: string;
  result?: {
    homeGoals: number;
    awayGoals: number;
    resultType: "HOME_WIN" | "AWAY_WIN" | "DRAW";
    events: MatchEvent[];
    penalties?: PenaltyShootout;
    referee: {
      name: string;
      bias: "HOME" | "NEUTRAL" | "AWAY";
    };
  };
  homeSubmission: Submission;
  awaySubmission: Submission;
  simulatedAt?: Date;
}

interface MatchEvent {
  minute: number;
  part: "1ST_HALF" | "INTERVAL" | "2ND_HALF" | "EXTRA_TIME" | "PENALTIES";
  type: "GOAL" | "YELLOW_CARD" | "RED_CARD" | "SUBSTITUTION";
  team: "HOME" | "AWAY";
  player: { id: string; name: string };

  // Se GOAL
  isDecisive?: boolean;

  // Se SUBSTITUTION
  playerOut?: { id: string; name: string };
}

interface PenaltyShootout {
  homeShots: {
    order: number;
    player: { id: string; name: string };
    scored: boolean;
  }[];
  awayShots: {
    order: number;
    player: { id: string; name: string };
    scored: boolean;
  }[];
  winner: "HOME" | "AWAY";
}

interface Auction {
  id: string;
  seasonId: string;
  playerId: string;
  sellingTeamId: string;
  minimumBid: number;
  status: "OPEN" | "CLOSED";
  openedAt: Date;
  closesAt: Date;
  bids: {
    teamId: string;
    amount: number;
    bidAt: Date;
  }[];
  winner?: {
    teamId: string;
    amount: number;
  };
  closedAt?: Date;
}

interface TransferOffer {
  id: string;
  seasonId: string;
  playerId: string;
  sellingTeamId: string;
  requestedPrice: number;
  status: "ACTIVE" | "SOLD" | "WITHDRAWN";
  createdAt: Date;
  soldAt?: Date;
  soldToTeamId?: string;
}

interface Invite {
  id: string;
  seasonId: string;
  fromTeamId: string;
  toTrainerId: string;
  reason: "PROMOTION" | "CRISIS" | "FIRED";
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  sentAt: Date;
  expiresAt: Date;
  respondedAt?: Date;
}

interface AiPersonality {
  name: string;
  tacticalStyle: "DEFENSIVE" | "BALANCED" | "OFFENSIVE";
  riskTolerance: number; // 0-100
  marketAggression: number; // 0-100 (como de agressivo no mercado)
  formationPreference: string[]; // ordenado por preferência
}
```

### Índices Recomendados (Base de Dados)

```sql
-- Performance crítica
CREATE INDEX idx_season_status ON seasons(status);
CREATE INDEX idx_match_season_round ON matches(seasonId, round);
CREATE INDEX idx_submission_season_round_team ON submissions(seasonId, round, teamId);
CREATE INDEX idx_team_season_division ON teams(seasonId, division);
CREATE INDEX idx_player_team ON players(teamId);
CREATE INDEX idx_auction_season_status ON auctions(seasonId, status);
CREATE INDEX idx_invite_trainer_status ON invites(toTrainerId, status);

-- Para queries comuns
CREATE INDEX idx_match_status ON matches(status);
CREATE INDEX idx_submission_team ON submissions(teamId);
```

---

## 11. FLUXO DE SIMULAÇÃO VISUAL

```
┌─────────────────────────────────────────────┐
│    Todas as submissões recebidas             │
│    Estado: JORNADA_SIMULANDO                │
│    Evento: round:simulation_start            │
└────────────────────┬────────────────────────┘
                     │
                     v
     ┌─────────────────────────────────┐
     │   Para cada Match:              │
     │   1. Calcular forças            │
     │   2. Gerar RNG com seed         │
     │   3. Simular 45s (1ª Parte)     │
     └────────────┬────────────────────┘
                  │
        Evento: match:start
        Broadcast: match:event (cada minuto)
                  │
                  v
     ┌─────────────────────────────────┐
     │    Intervalo                    │
     │    Popup: substitutions_available
     │    Treinos: ~60s para escolher  │
     │    Evento: match:interval_..    │
     └────────────┬────────────────────┘
                  │
                  v
     ┌─────────────────────────────────┐
     │   Simular 45s (2ª Parte)        │
     │   Broadcast: match:event        │
     └────────────┬────────────────────┘
                  │
         ┌────────┴────────┐
         │                 │
   (resultado             (Taça +
    definitivo)           Empate)
         │                 │
         v                 v
    match:end      ┌──────────────────┐
                   │ Tempo Extra 30s   │
                   │ Intervalo + Subs  │
                   │ match:event       │
                   └────────┬──────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
        (Resultado                   (Ainda
         definitivo)                  empate)
              │                           │
              v                           v
         match:end            ┌──────────────────┐
                              │ Grandes Penaltis │
                              │ (uma a uma)      │
                              │ match:event      │
                              └────────┬─────────┘
                                       │
                                       v
                                  match:end

│ Após todos os matches completados:
│ Evento: round:simulation_complete
│ Estado: POS_JORNADA
│ Atualizar tabelas
│ Avaliar convites
│ Evento: season:standings_updated
│ Evento: season:invite_received (se houver)
```

---

## CHECKSUM DE IMPLEMENTAÇÃO

Antes de começar o desenvolvimento, valida:

- [ ] Moral usa range 0-100, sobe/desce com resultados, afecta só ataque
- [ ] Cálculo de força inclui pesos por posição, formação, estilo, moral, casa/fora
- [ ] Craques têm +20% prob golo decisivo (não aditivo, capped em 60%)
- [ ] Convites avaliados fim da jornada, máximo 1 por treinador, raros
- [ ] Mercado: timestamp do servidor desempata bids simultâneos
- [ ] Seed é reprodutível e única por jornada + matchId
- [ ] Estados forma máquina formal com transições explícitas
- [ ] Socket.io eventos têm contrato definido
- [ ] Modelo de dados tem todas as entidades e índices
- [ ] Loop semanal: abrir → esperar → simular → atualizar
