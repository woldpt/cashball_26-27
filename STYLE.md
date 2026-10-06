# STYLE.md — CashBall · Design System

> Referência única de estilo. Componentes partilhados: §10 (usá-los sempre). Exemplo completo: `client/src/views/MySquadTab.jsx`.

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
| Nomes de jogador | `text-sm uppercase tracking-tight` (exceção: nomes de juniores em case mista) |
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

Paddings: `p-3 md:p-4`; widgets: `grid-cols-1 sm:grid-cols-3`. Navegação: grupos canónicos em `constants/navigation.js` (Clube/Gestão/Competição/Transferências); layout do shell em §14.

**Armadilha do tema:** no CSS gerado, o bloco `@media (width >= 40rem)` (`sm`) sai **depois** de `md` (768) e `lg` (1024) — o `@theme` em `index.css` redefine `--breakpoint-md`/`--breakpoint-lg` e muda a ordem. Como a especificidade é igual, **`sm:*` ganha sempre a `md:*`/`lg:*`** para a mesma propriedade: `max-w-22 sm:max-w-32 md:max-w-none` fica preso em 32 (era o que truncava os nomes na classificação). Só `xl`/`2xl` saem depois de `sm` — uma escala crescente tem de ficar em `base → sm → xl` (nunca desfazer em `md`/`lg`).

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
- Estado vazio: `EmptyState` (ícone Material via `icon` + título + descrição) ou `py-12 text-center text-zinc-500`.

## 10. Componentes partilhados (fonte única — não re-criar receitas)

| Componente | Uso |
|---|---|
| `Badge` | Chip de estado (§5). Variantes: `junior`, `renovado`, `sold`, `cooldown`, `suspended`, `injured`, `error`, `info`, `warning`, `neutral`; sizes `sm`/`md` |
| `PlayerStatusBadges` | Badges de um jogador derivadas do objeto `player` |
| `StarMark` | Estrela "Craque" junto ao nome |
| `PlayerRow` | Card de jogador. Props: `onOpenPlayerHistory`, `dim`, `showContractBadges`, `showProposalCol`/`myBudget`/`onProposal` |
| `BadgeSkills` (alias `SkillBadge`) | Badge único de skills: SKILL dourado (verde/vermelho na semana em que muda, via `prevSkill`) \| FORMA verde \| MOR violeta \| RES azul. Props: `skill`, `resistance`, `form`, `morale`, `prevSkill`, `skillLast` (Intervenção em vertical: só FORMA·MOR·SKILL, SKILL em último), `hideResForm`, `size` |
| `SummaryWidget` | §3. `flat` (sem accent) · `accentClass`/`accentStyle` |
| `Panel` | §3. `icon`, `meta`, `padded={false}`, `headerClassName`/`titleClassName` |
| `EmptyState` | Estado vazio token-based |
| `TabBar` | Filtros/tabs (`size="sm"|"md"`) |
| `Button` | Variantes: `primary`, `success`, `secondary`, `danger`, `dangerSoft`, `ghost`, `accent`; sizes `sm`/`md`/`lg`; `full`, `uppercase` |
| `ModalShell` | Moldura de modais (backdrop + z-index + animação). Variants: `card`, `md`, `lg`, `wide`, `xl`, `fullscreen`, `transparent` |
| `TrophyCabinet` | Sala de troféus agrupada por conquista (`×N` + anos + treinador). Props: `trophies`, `onOpenPlayer?(playerId)` |
| `GameDialog` | Confirm/prompt (`ModalShell` + `Button`) |
| `SponsorLogo` | Marca do patrocinador (§12). `brand` com `sponsorId`/`name`; sem marca cai no monograma geométrico |

**Paleta de posição** — toda a variação vive em `constants/index.js`: `POSITION_TEXT_CLASS`, `POSITION_BORDER_CLASS`, `POSITION_BAR_CLASS`, `POSITION_GLOW_CLASS`, `POSITION_BG_GRADIENT_CLASS`, `POSITION_RING_CLASS`, `POSITION_BADGE_*_CLASS`, `POSITION_ACCENT_HEX`, `POSITION_LABEL_MAP`. `matchConstants.POS_STYLES` e `colorHelpers.posRingClass` derivam daqui — nunca maps locais.

**Z-index** — `MODAL_Z` (`constants/index.js`): `teamSquad` 120, `transferProposal` 130, `cupDraw` 140, `waitingCoaches`/`penalty` 150, `default` 200, `dismissal` 9999. Nunca valores mágicos inline.

**Utilitários:** `formatCurrency`, `getPlayerStat` · `FLAG_TO_COUNTRY`.

## 11. Jornal — caixa de entrada (JournalTab)

A tab Jornal é a **caixa de entrada do treinador** (hub estilo CM2001):
tópicos à esquerda e detalhe à direita no desktop, uma só linha de filtros
(Todas, O Meu Clube, Competições, Plantel, Mercado). O detalhe segue registo
de imprensa clássica: manchete em tinta forte, entrada com capitular
(só a partir de 140 caracteres) e filetes a separar corpo e ações.
As cores por categoria vivem em `FILTER_TONES` no `JournalTab.jsx`.

**Pendências (redFlag):** a urgência vive só no booleano `redFlag` —
nunca emojis nos títulos. Linha da lista com faixa lateral `error`, `Badge`
`error` «Ação necessária» e linha secundária com dado útil por tipo
(`flagSummary`: salário exigido / clube + classificação / patrocínio /
orçamento). Detalhe com faixa `error`, selo «Ação necessária» +
«Bloqueia o Pronto» e painel de ação rico antes do corpo
(`FlagActionPanel` + `InboxActions` partilhado, botões `md`).

## 12. Marcas de patrocinador

Símbolo transparente, `viewBox="0 0 100 100"`, em `client/public/sponsors/<id>.svg`
(o id vem de `sponsors.ts`) — **nunca editado à mão em bruto**: o gerador é que
normaliza e cose a silhueta branca. `npm run sponsor:marks` reescreve os 60
(idempotente; `-- --check` deteta deriva). O nome da marca **não** vive no SVG:
é texto no `SponsorLogo` e no patch da camisola, com o nome curto do catálogo.

O tamanho-alvo é o remendo no peito da camisola (**22 unidades**, `TeamKit.jsx`);
o mesmo desenho é visto a 44–48px nas listas.

| Regra | Limite |
|---|---|
| Caixa / normalização | lado maior 74 em 100, centrado, `data-art` + `data-halo` (gerador) |
| Formas | ≤ 5 por marca |
| Espessura mínima | ≥ 6 unidades no espaço final — abaixo disto desaparece a 22px |
| Cor | 2 cores de marca + 1 acento, tiradas do `bg`/`fg` de `sponsors.ts` |
| Contraste | nenhuma marca só com cores claras (≥ 1 forma com luminância ≤ 0,8): a silhueta branca não salva um corpo branco em camisola clara |
| Semântica | a silhueta diz o setor sem o nome (teste a 22px) |
| Proibido | `clipPath` (regra do projeto), `<text>` desenhado, `<image>` embutida |

**Aceite:** `npm run sponsor:sheet` → folha com as 60 a 22px (tamanho do remendo)
e 44px (listas) sobre claro/creme/navy/escuro. A leitura a 22px decide; o craft
vê-se a 96px.

## 13. Camisolas

Molde único (`clipPath id="k"`), `viewBox="0 0 100 100"`, em
`client/public/kits/<slug>.svg` a partir de `server/db/fixtures/kits.json`
(cores classificadas das fotos do zerozero) — **nunca editado à mão**: o
gerador reescreve as 120 (casa + fora). `cd server && npm run generate:kits`
(`-- --check` deteta deriva); `npm run test:kit` exige as 120 válidas e fora ≠ casa.

A de fora (`<slug>_away.svg`, cores trocadas, mesmo padrão) só se usa quando
as duas de casa empatam: o `useKitClash` compara os SVGs e a equipa de fora
veste a de fora (placar do `LiveMatchHero`, `DuelHero`). Em 404 da camisola,
o `TeamKit` cai para o `TeamCrest` em vez de deixar vazio.

## 14. Shell do jogo (GameLayout)

- **Grelha `.game-shell`** (`index.css`): áreas `top` (header) · `nav` (sidebar, só `lg`) · `main` · `ticker` (rodapé CM) · `bottom` (bottom-nav mobile). Peças novas do chrome entram com `[grid-area:…]`, nunca `fixed` + margens. `data-collapsed` / `data-match` mudam a coluna da sidebar. Overlays ficam fora da grelha.
- **Geometria:** `--header-h`, `--mobile-nav-h`, `--sidebar-w(-collapsed)` — elementos `fixed` que se alinham com o shell usam estas vars.
- **Camadas:** `z-(--z-header)`, `z-(--z-mobile-nav)`, `z-(--z-ticker)`… em `:root`; modais em `MODAL_Z`.
- **Header = barra da jornada:** fundo na cor primária do clube, texto em `color_secondary` (`ink`); chips sobre a cor com `bg-black/25`. JOGAR via `usePlayCta` (mesmo estado no header e no bottom-nav).
- **Badges de contagem:** alerta/não-lidas `bg-red-500 text-white`; contagem neutra `bg-primary text-on-primary`.
- **Exceção intencional:** o balão de chat do header (branco, borda preta) é uma fala de banda desenhada — não alinhar com as superfícies escuras.

## 15. Vista ao vivo (LiveView)

- **Texto mínimo:** 11px para conteúdo (nomes, lances, tabela), 10px para labels, 9px só em badges.
- **Hero:** marcador → golos/vermelhos por lado → cronómetro → posse · remates · cansaço → botão Substituições (a ação principal nunca vive só num clique escondido) → feed de lances (mais recente em cima).
- **Efeitos:** flash de golo, aura de liderança e meteo; sem marcas de água no hero (ficam para o palco da final).
- **Marcador fixo:** `sticky` de altura 0 no topo do contentor (`overflow-clip`, nunca `overflow-hidden`, que parte o sticky), visível quando o marcador do hero sai do ecrã.
