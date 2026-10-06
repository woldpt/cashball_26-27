# Redesign — Scout, Mercado e Leilões

> **Estado: feito** (065483d1 · c099a7d1 · 7c78d6f6). Fase 0 entrou no commit do Mercado.
> Desvios: ordenação do Mercado em 3 opções (Melhores/Baratos/Caros — sai «Qualidade ↑»).
> Base: capturas dos harnesses (`scout-resp-test`, `transfer-resp-test`, `auctions-resp-test`)
> a 390 e 1440px e leitura do código.

## O que está mal hoje

**As três**
- Cada página tem um topo diferente: Scout e Mercado um `Panel` com título (que parte em 2 linhas no telemóvel), Leilões 3 `SummaryWidget` mini. Não parecem a mesma secção.
- O saldo — o número que decide tudo aqui — está escondido no `meta` do Mercado e num widget de 10px nos Leilões; no Scout nem aparece.
- Checkboxes nativas soltas («Mostrar só os meus», «Cabe no saldo»…) em vez de filtros com aspeto de jogo.

**Mercado**
- Telemóvel: cada cromo ocupa ~420px → 1 jogador por ecrã. Repete a nacionalidade («Itália · Itália») e gasta uma linha inteira com Jogos/Golos.
- Nada diz se o preço é bom negócio, nem quanto do saldo leva.
- Desktop: o histórico fica perdido por baixo de uma grelha longa.

**Leilões**
- Mesmo cromo alto (~480px com o form de lance: input e botão empilhados).
- A ordem é a do servidor — o que está a acabar pode estar no fim da lista.
- Não se vê de relance onde estou a ganhar ou fui superado.

**Scout**
- Telemóvel: na linha do resultado o salário sobrepõe-se aos golos (a coluna de ação rouba largura ao `PlayerRow`).
- Pesquisa = 3 `select` empilhados + botão no fundo; a posição é um `select` quando no resto do jogo é um `TabBar`.
- Filtros avançados são 6 inputs sem rótulo (só placeholder).

## Fases

### 0 — Topo comum `TransferHeader`
- Componente novo `components/transfers/TransferHeader.jsx` (usado pelas 3): ícone + «Transferências» em kicker, título da página, **saldo grande** à direita (verde/vermelho), e até 3 chips de contexto passados por prop.
- Fundo com gradiente subtil `primary` + hairline `top-light`, padrão do header do jogo. Uma linha no telemóvel (título à esquerda, saldo à direita), chips por baixo.

### 1 — Mercado (`TransferHub.jsx`)
- Cromo compacto (~190px), mesma linguagem do `PlayerRow`/AuctionCard (faixa e glow da posição):
  ```
  ┌ faixa da posição ───────────────────────┐
  │ (avatar) GIANLUCA PRANDELLI-MORETTI  39 │
  │   ATA    [FC] FC Longoname · ★ · 🩹4J   │
  │ BadgeSkills (FOR · MOR · RES · AGR)     │
  │─────────────────────────────────────────│
  │ 868 500 €            −25% do valor      │
  │ ▓▓▓▓▓▓▓▓▓░░  87% do teu saldo           │
  │ [ COMPRAR ]                             │
  └─────────────────────────────────────────┘
  ```
  - Selo **negócio** = preço vs `value` (já vem no jogador): «−25% do valor» verde, «+20%» âmbar.
  - Barra **% do saldo** (vermelha e «faltam X €» quando não chega).
  - Jogos/Golos passam para uma linha de texto pequena (sem tiles); nacionalidade uma vez só.
- Filtros: `TabBar` de posições + pesquisa + ordenação como chips (Qualidade / Preço ↑ / Preço ↓) + «Os meus à venda» como chip-toggle.
- Desktop `xl`: grelha à esquerda, histórico numa coluna fixa à direita (sticky). Telemóvel: histórico por baixo, como hoje.
- Chips do topo: «N à venda» · «M cabem no saldo».

### 2 — Leilões (`AuctionsTab.jsx` + `AuctionCard.jsx` + `BidForm.jsx`)
- Sai a fila de `SummaryWidget`; entra o `TransferHeader` com chips «N a decorrer» · «A liderar X» (verde) · «Superado Y» (vermelho, via `auction_bid_history`).
- «Em curso» ordenado por fim mais próximo (pausados no fim).
- Cromo com o mesmo esqueleto do Mercado; a contagem decrescente passa a um chip no canto (anel + tempo, pulsa a vermelho nos últimos 15s) e uma barra fina no topo que esvazia no último minuto.
- Estado do treinador em fita no cromo: **A liderar** (contorno verde), **Superado** (contorno vermelho + «licita de novo»), **Teu jogador** (índigo).
- `BidForm` numa linha: `[ valor ][ LICITAR ]`, com o mínimo por baixo e botão rápido «mín.» que repõe o valor mínimo.
- «Mostrar só os meus» → chip-toggle ao lado das posições. Recentes ficam na coluna da direita em `xl` (como o histórico do Mercado).

### 3 — Scout (`ScoutView.jsx` + ajuste no `PlayerRow`)
- Consola de pesquisa: input grande com o botão **Pesquisar** colado (Enter também), `TabBar` de posições por baixo, e chips-toggle «★ Craques» · «Disponível» · «Cabe no saldo».
- Filtros avançados em `<details>` com rótulos: Qualidade / Idade / Preço (mín–máx lado a lado), Divisão, Estado, Ordenar. Contador «3 filtros ativos» no resumo quando há filtros.
- Resultados: `meta` com contagem; estado vazio inicial com sugestões rápidas (botões «Craques baratos», «Jovens ≤21», «Guarda-redes à venda» que preenchem filtros e pesquisam).
- `PlayerRow`: quando recebe `actions`, no telemóvel a ação passa para a linha extra de baixo (à direita) em vez de uma coluna lateral — acaba a sobreposição salário/golos. O resto do `PlayerRow` (Plantel, Equipas, Táticas) não muda porque não usa `actions`.
- Botões de ação com a cor do tipo de negócio: Licitar (âmbar), Comprar (verde), Proposta (primary); «Sem saldo» com o valor que falta no `title`.

## Verificação (por fase)
- `npm run lint` + `npm run check:types`.
- `npm run test:mobile -- <harness>` (320–430) e capturas 390/1440 lidas antes vs depois.

## Fora do âmbito
- Servidor, regras de preço/cláusula/leilão, eventos de socket.
- Sub-navegação Scout · Mercado · Leilões dentro das páginas (a sidebar/bottom-nav já a tem).
