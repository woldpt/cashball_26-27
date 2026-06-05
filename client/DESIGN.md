# DESIGN.md — Diretrizes de Estilo

> **Princípio:** Todas as tabelas, cards e painéis devem seguir o mesmo padrão visual.
> Referência principal: `FinancesTab.jsx` (página de Finanças).
> Referência secundária: `MatchTabs.jsx` (tabs de jogo/intervenção).

---

## 📐 Hierarquia de Bordas Arredondadas

| Componente | `rounded-*` |
|------------|-------------|
| **Hero / Grid principal** | `rounded-xl` |
| **Painéis / Cards** | `rounded-lg` |
| **Sub-painéis / Cards de dados** | `rounded-md` |
| **Barras de progresso** | `rounded-full` |
| **Botões** | `rounded` |
| **Elementos internos (barras, badges)** | `rounded-sm` |

---

## 🎴 Cards e Painéis

### Fundo e Borda

```
bg-zinc-950/40 border border-zinc-800/20
```

### Estados

| Estado | Fundo | Borda |
|--------|-------|-------|
| **Normal** | `bg-zinc-950/40` | `border border-zinc-800/20` |
| **Selecionado (saída)** | `bg-rose-500/10` | `border border-rose-500/20` |
| **Selecionado (entrada)** | `bg-emerald-500/10` | `border border-emerald-500/20` |
| **Disabled** | `bg-zinc-950/40` | `border border-zinc-800/20 opacity-40` |

### Padding

| Tipo | Padding |
|------|---------|
| **Cards de jogador** | `px-4 py-3 gap-3` |
| **Cards de painel** | `p-5` ou `p-6` |
| **Cards pequenos** | `px-3 py-2` |

### Espaçamento entre linhas

- **Cada linha é um card individual** — nunca `border-b` entre linhas
- Usar `mb-1 last:mb-0` para separar cards
- Ou `space-y-1.5` / `space-y-2` dentro de containers com padding

---

## 📊 Tabelas e Listas

### Estrutura padrão

```jsx
<ul className="space-y-2">
  <li>
    <div className="flex items-center gap-3 px-4 py-3 rounded-md bg-zinc-950/40 border border-zinc-800/20">
      {/* conteúdo */}
    </div>
  </li>
</ul>
```

### Cabeçalhos de painel

```jsx
<div className="flex justify-between items-center pb-2 border-b border-outline-variant/15">
  <h3 className="font-headline text-base uppercase tracking-tight flex items-center gap-2">
    <span className="material-symbols-outlined text-primary text-base">icon</span>
    Título
  </h3>
  <span className="font-headline text-primary font-bold text-sm">valor</span>
</div>
```

### Labels de dados

```jsx
<p className="text-[10px] opacity-40 uppercase flex items-center gap-1">
  <span className="material-symbols-outlined" style={{ fontSize: "10px" }}>
    expand_more
  </span>
  Subtexto
</p>
```

### Sub-listas expansíveis

```jsx
<ul className="pl-3 space-y-1 border-l-2 border-primary/20 ml-1 mt-1">
  <li>
    <div className="flex justify-between items-center">
      <div>
        <p className="text-xs text-on-surface-variant/80">Principal</p>
        <p className="text-[10px] opacity-30 uppercase">Detalhe</p>
      </div>
      <span className="text-xs font-bold">valor</span>
    </div>
  </li>
</ul>
```

---

## 🏷️ Badges e Tags

### Posição (jogadores)

```jsx
<span className="shrink-0 px-2 py-1 rounded-md text-[9px] font-black border"
      style={{
        color: accent,
        borderColor: `${accent}35`,
        background: `${accent}12`,
      }}>
  {label}
</span>
```

### Qualidade (skill)

```jsx
<span className={`text-[16px] font-black tabular-nums leading-none px-2.5 py-1 rounded-lg border ${
  skill >= 40 ? "bg-green-500/15 text-green-300 border-green-500/30"
  : skill >= 25 ? "bg-yellow-500/15 text-yellow-300 border-yellow-500/30"
  : "bg-red-500/15 text-red-300 border-red-500/30"
}`}
style={{ textShadow: "0 0 12px rgba(34,197,94,0.35)" }}>
  {skill}
</span>
```

### Labels de stats (RES, FORMA)

```jsx
<div className="flex flex-col items-end gap-0.5">
  <span className="text-[8px] uppercase tracking-widest text-zinc-500 font-black leading-none">
    RES
  </span>
  <span className="text-[14px] font-black tabular-nums leading-none">valor</span>
</div>
```

---

## 🔘 Botões

### Botões padrão

```jsx
<button className="bg-surface-bright py-2 text-xs font-headline font-bold uppercase tracking-wider rounded hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all border border-outline-variant/30">
  Texto
</button>
```

### Botões de ação

```jsx
<button className="bg-primary hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-on-primary font-headline font-bold py-3 rounded text-sm transition-all uppercase tracking-wide">
  Ação
</button>
```

### Botões de confirmação

```jsx
<button className="bg-emerald-600/90 border-emerald-400/40 text-white shadow-[0_0_16px_rgba(16,185,129,0.25)] hover:bg-emerald-500/90">
  Substituir
</button>
```

---

## 🎨 Cores e Semântica

| Contexto | Cor |
|----------|-----|
| **Positivo / Sucesso** | `green-400`, `emerald-500` |
| **Alerta / Médio** | `yellow-400`, `amber-400` |
| **Erro / Negativo** | `red-400`, `rose-500` |
| **Primário** | `primary` (via tema) |
| **Terciário** | `tertiary` |
| **Texto secundário** | `text-zinc-500`, `text-zinc-400` |
| **Texto principal** | `text-zinc-100`, `text-white` |

### Barra de progresso

```jsx
<div className="h-2 w-full bg-surface-bright rounded-full overflow-hidden">
  <div className={`h-full rounded-full transition-all ${
    value > 75 ? "bg-error" : value > 50 ? "bg-tertiary" : "bg-primary"
  }`} style={{ width: `${value}%` }} />
</div>
```

---

## ✏️ Tipografia

| Elemento | Classe |
|----------|--------|
| **Labels de seção** | `text-[8px] uppercase tracking-[0.25em] font-black` |
| **Labels de dados** | `text-[9px] uppercase tracking-widest font-black` |
| **Labels de stats** | `text-[10px] uppercase tracking-widest font-bold` |
| **Nomes de jogador** | `text-[12px] font-black` |
| **Valores de stat** | `text-[14px]` a `text-[16px] font-black` |
| **Títulos de painel** | `font-headline text-base uppercase tracking-tight` |
| **Valores de título** | `font-headline text-sm font-bold` |

---

## 📋 Checklist de Implementação

Antes de finalizar um componente novo, verifica:

- [ ] **Bordas arredondadas** consistentes (`rounded-xl` > `rounded-lg` > `rounded-md`)
- [ ] **Cards individuais** em vez de `border-b` entre linhas
- [ ] **Padding generoso** (`px-4 py-3` mínimo para interativos)
- [ ] **Gaps consistentes** (`gap-2` ou `gap-3`)
- [ ] **Labels em uppercase** com `tracking-widest` ou `tracking-[0.25em]`
- [ ] **Fontes `font-black`** para ênfade
- [ ] **Opacidade 40%** para textos secundários
- [ ] **Borders sutis** (`border-zinc-800/20` ou `border-zinc-800/30`)
