# Redesign — Clube, Finanças e Treino

> **Estado (2026-10-06): feito** — fases 0–3 (`2b0f8e65` treino, `2b07374c` finanças, clube no commit seguinte).
> Desvio: nas Finanças os botões do empréstimo ficaram em 2+1 (3 numa linha não cabe a 320px nem na coluna lateral a 1024px).
> Base: capturas dos harnesses (`finances-resp-test`, `training-resp-test`) a 390 e 1440px
> e leitura do código. O harness do Clube está partido (ver 0).

## O que está mal hoje

**Finanças**
- Telemóvel: os 3 cartões do topo espremidos em 3 colunas — o texto corta («6 / 25 SEM CON…»), valores a 15px.
- Decoração sem informação: ícones gigantes em marca-d'água e um mini-gráfico de barras falso no «Saldo Actual».
- Desktop: buraco vazio por baixo do gráfico (a coluna da direita é mais alta).
- Receitas/Despesas são caixas feitas à mão (não `Panel`), as setas de expandir têm 10px e as linhas não se ligam à barra de cores.

**Treino**
- Telemóvel: cartões de foco em 2 colunas com o ícone ao lado do título → o texto rebenta o cartão (+91px cortados no «Guarda-redes»).
- Cartão «Foco Atual»: o ícone redondo tapa o título.
- 3 cartões do topo em grelha de 2 → o terceiro fica sozinho numa linha.
- «Como funciona?» ocupa meio ecrã no telemóvel, sempre aberto.

**Clube**
- O cartão «Saldo Disponível» repete as Finanças; «Divisão» aparece 3 vezes (selo do hero, cartão do estádio, `DIVISION_NAMES`).
- «Foco em Transferências» no histórico não quer dizer nada.
- O `ClubTab` lê o `TacticsContext` diretamente → o harness rebenta e não há capturas.

## Fases

### 0 — Clube testável
- `ClubTab` recebe `homeWeather` por prop (o `GameRoutes` já tem `nextMatchSummary`); sai o `useTactics` da view. O harness volta a funcionar.

### 1 — Treino
- Topo: 3 cartões sempre lado a lado (`mini` no telemóvel); ícone do foco fora do título.
- Cartões de foco: ícone por cima do título (cabe a 320px), selecionado com contorno + visto no canto; dois grupos com legenda: **Posições** (GR/DEF/MED/ATA) e **Físico** (Forma/Resistência).
- «Como funciona?» em `<details>` nativo, fechado por defeito; funcionários como chips.

### 2 — Finanças
- Topo: «Saldo» grande em largura total + «Resultado» e «Previsão» lado a lado por baixo no telemóvel; 3 colunas a partir de `sm`. Sai a decoração falsa.
- Desktop: gráfico estica até à altura da coluna da direita (sem buraco).
- Receitas e Despesas em `Panel`, com uma linha única por rubrica: ponto da cor da barra · nome + detalhe · % do total · valor. Expandir com seta à direita, alvo de toque de 44px.
- Empréstimos: mantém o cartão bancário; os 3 botões numa só linha com o motivo de estarem desligados no `title`.

### 3 — Clube
- Hero em largura total: escudo, nome, divisão, época, treinador, moral, e uma faixa de 4 números (Capacidade · Adeptos (`getFansMoodLabel`) · Salários/sem. · Saldo). Sai o cartão de saldo à parte.
- Estádio · Equipamento · Palmarés com a mesma altura; o cartão do estádio deixa de repetir a divisão.
- Funcionários: lugares ocupados como pontos (●●○) no cabeçalho; cartões vazios com o nível em estrelas.
- Histórico: sai «Foco em Transferências»; valores alinhados numa coluna.

## Verificação (por fase)
- `npm run lint` + `npm run check:types`.
- `npm run test:mobile -- <harness>` e capturas 390/1440 lidas (antes vs depois).

## Fora do âmbito
- Servidor, cálculos das finanças, regras do treino/funcionários.
