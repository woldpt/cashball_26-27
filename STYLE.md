# STYLE.md — CashBall · Design System

> Referência única de estilo. Componentes partilhados: §10 (usá-los sempre). Exemplo completo: `client/src/views/PlayersTab.jsx`.

## 1. Cores semânticas (tokens CSS)

Sempre tokens, nunca hex hardcoded (exceto paleta de posição §10). Nota: `outline` **não** está no `@theme` — `border-outline` é no-op silencioso; usar `outline-variant`.

| Token | Uso |
|---|---|
| `bg` | Fundo da página |
| `surface` / `-container-low` / `-container` / `-container-high` | Superfícies elevadas (cards, painéis) |
| `on-surface` / `on-surface-variant` | Texto principal / secundário, labels |
| `primary` / `tertiary` | Destaque principal / secundário (orçamento, valores) |
| `error` / `error-container` | Erros, estados críticos |
| `outline-variant` | Bordas e divisores |

### Posições

| Posição | Hex | Tailwind |
|---|---|---|
| GR | `#eab308` | `amber-400` |
| DEF | `#3b82f6` | `blue-400` |
| MED | `#10b981` | `emerald-400` |
| ATA | `#f43f5e` | `rose-400` |

## 2. Tipografia

| Contexto | Classe |
|---|---|
| Valores grandes (orçamento, skill) | `text-3xl`/`text-2xl` + `font-headline font-black` |
| Títulos de secção | `text-base font-black font-headline tracking-tight` |
| Nomes de jogador | `text-sm uppercase tracking-tight` |
| Labels de coluna / metadados | `text-[10px]` / `text-[8px]` |
| Badges inline | `text-[9px]` |
| Números | `tabular-nums` sempre |

Labels pequenos: `font-black uppercase tracking-widest text-on-surface-variant`.

## 3. Cards & widgets

**SummaryWidget** (topo de página):

```jsx
<div className="bg-surface-container-low p-5 rounded-md flex flex-col justify-between h-28 border-l-4 border-primary">
  <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">LABEL</span>
  <span className="text-3xl font-black font-headline tracking-tighter text-on-surface">VALUE</span>
</div>
```

Altura fixa `h-28`; `border-l-4` com cor semântica; label em cima, valor em baixo; grid `grid-cols-1 sm:grid-cols-3 gap-4`.

**Panel** (conteúdo):

```jsx
<div className="bg-surface-container rounded-md overflow-hidden">
  <div className="px-5 py-4 flex items-center justify-between bg-surface-container-high/50">
    <h2 className="text-base font-black font-headline tracking-tight text-tertiary uppercase">TÍTULO</h2>
    <span className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">METADATA</span>
  </div>
  <div className="p-3 md:p-4">{/* conteúdo */}</div>
</div>
```

## 4. Linhas de jogador (PlayerRow)

Card horizontal: `faixa posição | avatar+pos | nome+badges | skill+delta | attrs (md) | stats (xl)`.

| Elemento | Classe |
|---|---|
| Container | `relative group flex items-stretch rounded-lg overflow-hidden border border-outline-variant/25 bg-gradient-to-r {bgGrad} via-surface-container/70 to-surface/30 transition-all duration-200 hover:-translate-y-px hover:shadow-lg {glow} shadow-sm shadow-black/30 cursor-pointer` |
| Faixa lateral | `shrink-0 w-1 bg-gradient-to-b {bar}` |
| Hover glow | `hover:border-{pos}-400/70 hover:shadow-{pos}-400/30` |
| Separadores | `border-l border-outline-variant/15 ml-1` |
| Indisponível | `opacity-65 saturate-50` |
| Glow do skill | `style={{ textShadow: "0 0 10px currentColor" }}` |

Gradientes por posição (bar = `from-{pos}-300 via-{pos}-400 to-{pos}-600`; bgGrad = `from-{pos}-500/8`; glow = `{pos}-400`).

## 5. Badges inline

Formato: `text-[9px] font-black uppercase px-1.5 py-px rounded bg-{color}/20 text-{color} border border-{color}/30 tracking-widest`

| Badge | Cor | Condição |
|---|---|---|
| 🎓 Jr | `indigo-500` | `player.isJunior` |
| ✓ Renovado | `amber-500` (gradient) | Renovado esta época |
| À venda | `emerald-500` | `transfer_status !== "none"` |
| ✈️ 1J | `sky-500` | Cooldown de transferência |
| 🟥 NJ / 🩹 NJ | `error` / `amber` | Suspenso / lesionado N jornadas |
| ★ | `amber-400` | Craque (`is_star`) |

## 6. Barras de distribuição salarial

Colunas por posição (`flex items-end`, altura 80px): trilho `bg-primary/10 rounded-t-sm` + preenchimento `absolute inset-x-0 bottom-0` com `height: ${pct}%`, `backgroundColor: posColor`, `opacity: 0.75`, `transition-all duration-700`; label `{pos}` e valor `text-[9px] tabular-nums`.

## 7. Responsividade

| Breakpoint | Colunas |
|---|---|
| Sempre | Faixa, avatar, nome, badges, skill |
| `md` (`hidden md:flex`) | Atributos (Agr/Res/For), Ordenado + Valor |
| `xl` (`hidden xl:flex`) | Stats (Jogos, Golos, Vermelhos, Lesões) |

Paddings: `p-3 md:p-4`; widgets: `grid-cols-1 sm:grid-cols-3`.

## 8. Efeitos

| Efeito | Classe |
|---|---|
| Hover elevation | `hover:-translate-y-px hover:shadow-lg` |
| Transições | `transition-all duration-200` (UI) / `duration-700` (gráficos) |

## 9. Convenções

- Espaçamento: `space-y-4` entre secções; `gap-1.5` entre rows de jogador.
- Bordas: `border-outline-variant/25` (cards) · `/15` (separadores internos).
- Sombras: `shadow-sm shadow-black/30` (cards) · `shadow-md shadow-black/50` (chips).
- Gradientes de fundo: opacidade baixa (`/8`).
- Estado vazio: `EmptyState` (emoji + título + descrição) ou `py-12 text-center text-zinc-500`.

## 10. Componentes partilhados (fonte única — não re-criar receitas)

| Componente | Uso |
|---|---|
| `Badge` | Chip de estado (§5). Variantes: `junior`, `renovado`, `sold`, `cooldown`, `suspended`, `injured`, `error`, `info`, `warning`, `neutral`; sizes `sm`/`md` |
| `PlayerStatusBadges` | Badges de um jogador derivadas do objeto `player` |
| `StarMark` | Estrela "Craque" junto ao nome |
| `PlayerRow` | Card de jogador. Props: `onOpenPlayerHistory`, `dim`, `showContractBadges`, `showProposalCol`/`myBudget`/`onProposal` |
| `SummaryWidget` | §3. `flat` (sem accent) · `accentClass`/`accentStyle` |
| `Panel` | §3. `icon`, `meta`, `padded={false}`, `headerClassName`/`titleClassName` |
| `EmptyState` | Estado vazio token-based |
| `TabBar` | Filtros/tabs (`size="sm"|"md"`) |
| `Button` | Variantes: `primary`, `success`, `secondary`, `danger`, `dangerSoft`, `ghost`, `accent`; sizes `sm`/`md`/`lg`; `full`, `uppercase` |
| `ModalShell` | Moldura de modais (backdrop + z-index + animação). Variants: `card`, `md`, `lg`, `wide`, `xl`, `fullscreen`, `transparent` |
| `GameDialog` | Confirm/prompt (`ModalShell` + `Button`) |

**Paleta de posição** — toda a variação vive em `constants/index.js`: `POSITION_TEXT_CLASS`, `POSITION_BORDER_CLASS`, `POSITION_BAR_CLASS`, `POSITION_GLOW_CLASS`, `POSITION_BG_GRADIENT_CLASS`, `POSITION_RING_CLASS`, `POSITION_BADGE_*_CLASS`, `POSITION_ACCENT_HEX`, `POSITION_LABEL_MAP`. `matchConstants.POS_STYLES` e `colorHelpers.posRingClass` derivam daqui — nunca maps locais.

**Z-index** — `MODAL_Z` (`constants/index.js`): `teamSquad` 120, `transferProposal` 130, `cupDraw` 140, `waitingCoaches`/`penalty` 150, `default` 200, `dismissal` 9999. Nunca valores mágicos inline.

**Utilitários:** `formatCurrency`, `getPlayerStat` · `FLAG_TO_COUNTRY`.
