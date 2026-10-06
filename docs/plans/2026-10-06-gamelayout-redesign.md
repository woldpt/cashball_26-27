# Redesign do shell do jogo (`GameLayout`)

> **Estado (2026-10-06):** 1, 2 e 6 feitos; 3, 4 e 5 adiados (ver "Execução").
> Proposta original baseada em leitura de código (`GameLayout.jsx`,
> `GameHeader.jsx`, `Sidebar.jsx`, `MobileNav.jsx`, `GroupBackdrop.jsx`,
> `index.css`, `constants/navigation.js`), sem capturas do ecrã real.

## Problema

O shell trata o jogo como um site com menu: marca no header, 12 tabs em 4
grupos, CTA "JOGAR" no fundo da sidebar. Mas o ciclo central do jogo é
**preparar → ficar pronto → ver a jornada → reagir**, e esse estado não está
visível em lado nenhum de forma permanente.

No código, o modo "jogo ao vivo" e o modo "gestão" são o mesmo layout com
`isMatchInProgress` espalhado (margens do `<main>`, sidebar `hidden`, ticker,
tutorial), e o posicionamento é `fixed` + margens calculadas
(`pt-[var(--header-h)]`, `ml-[var(--rail-w)]`, `pb-16`) — a origem de bugs
como a faixa órfã da rail.

## 1. Shell em CSS grid (código, invisível ao utilizador)

Trocar header/sidebar/bottom-nav `fixed` + margens por um grid com áreas:

```css
.shell {
  display: grid;
  height: 100dvh;
  grid-template: "top top" auto "nav main" 1fr "nav ticker" auto / var(--nav-w) 1fr;
}
.shell[data-mode="match"] { --nav-w: 0px; }
@media (max-width: 1023px) {
  .shell { grid-template: "top" auto "main" 1fr "nav" auto / 1fr; }
}
```

- Colapsar a sidebar = mudar `--nav-w`. Landscape mobile = outro template.
- Desaparecem os ternários de margens (`GameLayout.jsx:121-128`) e a classe de
  bugs "margem sem rail".
- `fullBleed: true` passa a metadado da tab em `navigation.js` em vez da lista
  `["squad", "leiloes"]` no layout.
- Escala de z-index em tokens (`--z-header`, `--z-menu`, `--z-modal`) em vez
  de `z-160/170/180`.

## 2. Header → barra da jornada

O header gasta espaço com marca ("CashBall 26/27") e código da sala. Passa a
mostrar o que um treinador precisa sempre:

| Esquerda | Centro | Direita |
|---|---|---|
| Emblema + nome da equipa (mantém o gradiente da cor do clube) | Próximo jogo: adversário, casa/fora, competição · ao vivo: relógio + resultado | Orçamento, posição na liga, treinadores prontos (`3/4`), menu |

O CTA principal sai do fundo da sidebar e passa a viver aqui, com estados:
`Preparar tática` → `Pronto · à espera de 2` → `AO VIVO`. Um único botão que
reflete a máquina de fases, igual em desktop e mobile.

## 3. Fundo → hero por tab

Hoje: foto com `brightness(0.4)` + véu de 55–84% de `surface` + camada
`.ambient` — a foto quase não se vê e há 17 imagens a carregar.

Proposta: a foto vira um **hero** de ~160px no topo de cada tab (título da
tab por cima, fade para `surface`), visível de verdade; o resto do ecrã fica
em `surface` limpo com o `.ambient`. Mais identidade, menos composição, melhor
leitura.

## 4. Navegação mobile

Hoje: 4 grupos com fly-ups → quase tudo custa 2 toques.

Proposta: 5 destinos diretos no bottom-nav — **Jornal · Plantel · [JOGAR] ·
Liga · Mercado** — com o botão central elevado (estado da jornada), e o resto
(Finanças, Estádio, Treino, Taça, Scout, Leilões, Clube) num "Mais" em grelha.
Validar com uso real quais são as tabs mais visitadas antes de fixar a lista.

## 5. Uma voz de cada vez

Competem pelo ecrã: `OfflineBanner`, `RoomPauseBanner`, `GameNoticeBar`,
`SystemOverlays`, `GameOverlays`, `WelcomeModal`, `CoachTutorial`,
`AssistantCoach`, `CmTicker`. Já existe a regra ad hoc "adjunto cala o
ticker". Generalizar para uma prioridade explícita (sistema > modal >
tutorial > adjunto > ticker) num só sítio.

## 6. Coerência visual

- Badges com tokens semânticos (`error`) em vez de `red-500`/`rose-500`
  misturados entre header e sidebar.
- Balão do header (branco com borda preta) documentado no `STYLE.md` como
  "fala do adjunto" ou alinhado com as superfícies escuras.

## Ordem sugerida

1. Shell em grid + `fullBleed` em metadados + z-index em tokens (sem mudança visual, só risco de regressão de layout — validar desktop, mobile, landscape, jogo ao vivo).
2. Barra da jornada + CTA único com estados.
3. Hero por tab no lugar do fundo de ecrã inteiro.
4. Bottom-nav mobile com destinos diretos.
5. Prioridade de overlays.


## Execução (2026-10-06)

- **1 — feito** (`6564fcf5`): grelha `.game-shell`; ramo landscape removido (o `RotateOverlay` bloqueia-o).
- **2 — feito** (`e34d1036`): barra da jornada + `usePlayCta`. Revelou um bug antigo: o `requestResync` não reenviava `teamsData` (orçamento 0 € nos Leilões) — corrigido em `5941ade1`.
- **3 — adiado:** as capturas reais desmentem a premissa — a foto vê-se bem nas páginas sem painéis (Leilões, Jornal mobile). Trocar por hero tirava ambiente sem ganho claro.
- **4 — adiado:** sem dados de uso para escolher os 5 destinos diretos; mexe no tutorial (submenus/`data-tour`). Retomar com números.
- **5 — adiado:** não há colisões concretas observadas; a regra ad hoc (adjunto cala o ticker) chega. YAGNI até aparecer um caso.
- **6 — feito:** badges unificados (red-500 / primary), balão e shell documentados no `STYLE.md` §14.
