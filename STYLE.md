# STYLE.md — Design System & Styling Guidelines

> **Referência única de estilo visual.** Todas as páginas e componentes do CashBall devem seguir estas convenções. Referência: `client/src/views/PlayersTab.jsx`.

---

## 🎨 1. Cores Semânticas (Material Design Tokens)

Use **tokens CSS** em vez de cores hardcoded. Os tokens seguem a nomenclatura Material Design 3:

| Token | Uso |
|-------|-----|
| `bg` | Fundo principal da página |
| `surface` / `surface-container-low` / `surface-container` / `surface-container-high` | Superfícies elevadas (cards, painéis) |
| `on-surface` | Texto principal sobre superfície |
| `on-surface-variant` | Texto secundário, labels, metadados |
| `primary` | Cor de destaque principal |
| `tertiary` | Cor de destaque secundária (orçamento, valores) |
| `error` / `error-container` | Erros, estados críticos |
| `outline` / `outline-variant` | Bordas e divisores |

### Cores por Posição

| Posição | Cor Hex | Tailwind | Uso |
|---------|---------|----------|-----|
| **GR** | `#eab308` | `amber-400` | Guarda-redes |
| **DEF** | `#3b82f6` | `blue-400` | Defesas |
| **MED** | `#10b981` | `emerald-400` | Médios |
| **ATA** | `#f43f5e` | `rose-400` | Avançados |

---

## 📐 2. Tipografia

### Fontes

| Classe | Fonte | Uso |
|--------|-------|-----|
| `font-headline` | Fonte de headlines (display) | Números grandes, títulos, valores monetários |
| `font-bold` / `font-black` | Fonte padrão bold/black | Texto de interface, labels |

### Tamanhos Padrão

| Contexto | Tamanho | Classe |
|----------|---------|--------|
| **Valores grandes** (orçamento, skill) | `text-3xl` / `text-2xl` | Números de destaque |
| **Títulos de secção** | `text-base` | Headers de painel |
| **Nomes de jogador** | `text-sm` | Identificadores |
| **Labels de coluna** | `text-[10px]` / `text-[8px]` | Headers de tabela, badges |
| **Badges inline** | `text-[9px]` | Status, tags |
| **Metadados** | `text-[8px]` | Sub-labels, tracking |

### Pesos e Tracking

- **Títulos e labels:** `font-black uppercase tracking-widest` (labels pequenos) ou `tracking-tight` (títulos grandes)
- **Números:** `tabular-nums` sempre para alinhar dígitos
- **Nomes:** `uppercase tracking-tight`

---

## 🃏 3. Cards e Widgets

> Componentes: `SummaryWidget`, `Panel`, `EmptyState`, `TabBar` (ver §10).

### Widget de Summary (topo de página)

```jsx
<div className="bg-surface-container-low p-5 rounded-md flex flex-col justify-between h-28 border-l-4 border-primary">
  <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
    LABEL
  </span>
  <span className="text-3xl font-black font-headline tracking-tighter text-on-surface">
    VALUE
  </span>
</div>
```

**Regras:**
- Altura fixa: `h-28`
- Bordas laterais coloridas: `border-l-4` com cor semântica
- Label pequeno em cima, valor grande em baixo
- Grid responsivo: `grid-cols-1 sm:grid-cols-3 gap-4`

### Painel de Conteúdo

```jsx
<div className="bg-surface-container rounded-md overflow-hidden">
  <div className="px-5 py-4 flex items-center justify-between bg-surface-container-high/50">
    <h2 className="text-base font-black font-headline tracking-tight text-tertiary uppercase">
      TÍTULO
    </h2>
    <span className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">
      METADATA
    </span>
  </div>
  <div className="p-3 md:p-4">
    {/* conteúdo */}
  </div>
</div>
```

---

## 📋 4. Linhas de Jogador (Card-based Row)

> Componente: `PlayerRow` (ver §10). Resultado da fusão de `SquadRow`
> (PlayersTab) e `TeamSquadCard` (TeamSquadView/TeamSquadModal).

### Estrutura do `<SquadRow>`

Cada jogador é renderizado como um **card horizontal** com:

```
┌───┬──────────┬─────┬──────────┬──────────┬──────────┐
│bar│ avatar   │nome │ skill    │ attrs    │ stats    │
│   │ + pos    │+bad │ +delta   │(md)     │(xl)      │
└───┴──────────┴─────┴──────────┴──────────┴──────────┘
```

### Padrões visuais

| Elemento | Classe |
|----------|--------|
| **Card container** | `relative group flex items-stretch rounded-lg overflow-hidden border border-outline-variant/25 bg-gradient-to-r {bgGrad} via-surface-container/70 to-surface/30 transition-all duration-200 hover:-translate-y-px hover:shadow-lg {glow} shadow-sm shadow-black/30 cursor-pointer` |
| **Faixa lateral** | `shrink-0 w-1 bg-gradient-to-b {bar}` |
| **Hover glow** | `hover:border-{pos}-400/70 hover:shadow-{pos}-400/30` |
| **Separadores** | `border-l border-outline-variant/15 ml-1` |

### Gradientes por posição

| Posição | Faixa (`bar`) | Glow | BG gradient |
|---------|---------------|------|-------------|
| GR | `from-amber-300 via-amber-400 to-amber-600` | `amber-400` | `from-amber-500/8` |
| DEF | `from-blue-300 via-blue-400 to-blue-600` | `blue-400` | `from-blue-500/8` |
| MED | `from-emerald-300 via-emerald-400 to-emerald-600` | `emerald-400` | `from-emerald-500/8` |
| ATA | `from-rose-300 via-rose-400 to-rose-600` | `rose-400` | `from-rose-500/8` |

---

## 🏷️ 5. Badges Inline

> Componente: `Badge` + `PlayerStatusBadges` (ver §10).

### Formato padrão

```jsx
<span className="text-[9px] font-black uppercase px-1.5 py-px rounded bg-{color}/20 text-{color} border border-{color}/30 tracking-widest">
  LABEL
</span>
```

### Badges existentes

| Badge | Cor | Condição |
|-------|-----|----------|
| 🎓 Jr | `indigo-500` | `player.isJunior` |
| ✓ Renovado | `amber-500` (gradient) | Contrato renovado esta época |
| À venda | `emerald-500` | `player.transfer_status !== "none"` |
| ✈️ 1J | `sky-500` | Cooldown de transferência |
| 🟥 NJ | `error` | Suspenso N jornadas |
| 🩹 NJ | `amber` | Lesionado N jornadas |
| ★ | `amber-400` | Craque (`is_star`) |

---

## 📊 6. Gráficos e Visualizações

### Barras de Distribuição Salarial

```jsx
<div className="flex items-end gap-3" style={{ height: "80px" }}>
  {positions.map((pos) => (
    <div key={pos} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
      <div className="w-full bg-primary/10 rounded-t-sm relative" style={{ height: "60px" }}>
        <div className="absolute inset-x-0 bottom-0 rounded-t-sm transition-all duration-700"
          style={{ height: `${pct}%`, backgroundColor: posColor, opacity: 0.75 }} />
      </div>
      <span className="text-[10px] font-black uppercase text-{pos}">{pos}</span>
      <span className="text-[9px] text-on-surface-variant tabular-nums">{value}</span>
    </div>
  ))}
</div>
```

---

## 📱 7. Responsividade

### Breakpoints de colunas

| Breakpoint | Adicionado |
|------------|-----------|
| **Sempre** | Faixa posição, avatar, nome, badges, skill |
| **`md`** (`hidden md:flex`) | Atributos (Agr/Res/For), Ordenado + Valor |
| **`xl`** (`hidden xl:flex`) | Stats (Jogos, Golos, Vermelhos, Lesões) |

### Grid responsivo

- Summary widgets: `grid-cols-1 sm:grid-cols-3`
- Padding: `p-3 md:p-4`

---

## ✨ 8. Efeitos e Interatividade

| Efeito | Classe | Uso |
|--------|--------|-----|
| Hover elevation | `hover:-translate-y-px hover:shadow-lg` | Cards de jogador |
| Hover glow | `hover:border-{color}/70 hover:shadow-{color}/30` | Bordas por posição |
| Text glow | `style={{ textShadow: "0 0 10px currentColor" }}` | Números de skill |
| Dim unavailable | `opacity-65 saturate-50` | Jogadores indisponíveis |
| Transitions | `transition-all duration-200` (UI) / `duration-700` (gráficos) | Animações |

---

## 🧩 9. Convenções Gerais

1. **Espaçamento:** `space-y-4` entre secções de página; `gap-1.5` entre rows de jogador
2. **Bordas:** `border-outline-variant/25` para cards; `/15` para separadores internos
3. **Sombreamento:** `shadow-sm shadow-black/30` para cards; `shadow-md shadow-black/50` para chips
4. **Gradientes de fundo:** sempre com baixa opacidade (`/8`) para não ofuscar conteúdo
5. **Estado vazio:** `py-12 text-center text-zinc-500` com emoji + texto
6. **JSDoc:** todos os componentes e funções recebem documentação JSDoc com tipos de props
7. **Língua:** todos os textos de UI em **Português (PT)**

---

## 🧱 10. Componentes Partilhados (fonte única de verdade)

> Estes componentes unificam padrões que antes eram duplicados inline.
> **Usá-los sempre**; não re-criar receitas próprias.

| Componente | Uso |
|-----------|-----|
| `Badge` | Chip de estado (STYLE.md §5). Variantes: `junior`, `renovado`, `sold`, `cooldown`, `suspended`, `injured`, `error`, `info`, `warning`, `neutral`. Sizes: `sm` (padrão), `md` |
| `PlayerStatusBadges` | Conjunto de badges de um jogador (Jr/Renovado/À venda/Cooldown/Susp/Lesão) derivado do objeto `player` |
| `StarMark` | Estrela "Craque" junto ao nome |
| `PlayerRow` | Linha/card de jogador (fusão de SquadRow + TeamSquadCard). Props: `onOpenPlayerHistory`, `dim`, `showContractBadges`, `showProposalCol`/`myBudget`/`onProposal` |
| `SummaryWidget` | Widget de resumo de topo (§3). `flat` para células de hero sem accent; `accentClass`/`accentStyle` para cor da borda |
| `Panel` | Painel com header canónico. `icon`, `meta`, `padded={false}`, `headerClassName`/`titleClassName` |
| `EmptyState` | Estado vazio token-based (emoji + título + descrição) |
| `TabBar` | Filtros/tabs de página (`size="sm"|"md"`) |
| `Button` | Botão unificado. Variants: `primary`, `success`, `secondary`, `danger`, `dangerSoft`, `ghost`, `accent`. Sizes: `sm`/`md`/`lg`; `full`, `uppercase` |
| `ModalShell` | Moldura de modais: backdrop + z-index + animação. Variants: `card`, `md`, `lg`, `wide`, `xl`, `fullscreen`, `transparent`. z-index via `MODAL_Z` |
| `GameDialog` | Diálogo confirm/prompt (usa `ModalShell` + `Button`) |

### Paleta de posições

Toda a variação visual por posição vive em `constants/index.js`:
`POSITION_TEXT_CLASS`, `POSITION_BORDER_CLASS`, `POSITION_BAR_CLASS`,
`POSITION_GLOW_CLASS`, `POSITION_BG_GRADIENT_CLASS`, `POSITION_RING_CLASS`,
`POSITION_BADGE_*_CLASS`, `POSITION_ACCENT_HEX`. `matchConstants.POS_STYLES`
e `colorHelpers.posRingClass` derivam desta fonte — nunca criar maps locais.

### Z-index de modais

Centralizado em `MODAL_Z` (`constants/index.js`): `teamSquad` 120,
`transferProposal` 130, `cupDraw` 140, `waitingCoaches`/`penalty` 150,
`default` 200, `dismissal` 9999. Não usar valores mágicos inline.

---

## 🔗 Referência

- **Exemplo completo:** `client/src/views/PlayersTab.jsx`
- **Componentes reutilizáveis:** `PlayerAvatar`, `PlayerLink`, `AggBadge`, `PlayerRow`, `Badge`, `Panel`, `SummaryWidget`, `EmptyState`, `TabBar`, `Button`, `ModalShell`
- **Constantes:** `POSITION_TEXT_CLASS`, `POSITION_BORDER_CLASS`, `POSITION_LABEL_MAP`, `FLAG_TO_COUNTRY`, `MODAL_Z`
- **Utilitários:** `formatCurrency`, `getPlayerStat`
