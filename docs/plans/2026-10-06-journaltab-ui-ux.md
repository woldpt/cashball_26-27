# Plano — melhoria de UI/UX do Jornal (`JournalTab`)

> Proposta para aprovação. Executar por fases; cada fase é um commit.

## Contexto

- Ficheiros: `client/src/views/JournalTab.jsx` + `client/src/views/journal/` (`TopicList`, `ArticleBody`, `ArticleActions`, `NewsMedia`, `ArticleTables`, `tones.js`).
- Referência visual: `client/src/views/MySquadTab.jsx` e `STYLE.md` (§3 cards, §10 componentes partilhados, §11 Jornal).
- **Não mexer** em `useInbox.js`, `inboxItems.js` nem no servidor. A API de props do `JournalTab` não muda.

## Diagnóstico (o que torna a página pobre)

1. **Lista "arco-íris":** cada linha não selecionada leva o fundo da categoria (`tone.row`, `bg-*-500/10`). Com 20 notícias fica ruído de cor e nada sobressai — nem as não lidas.
2. **Hierarquia fraca na linha:** a data ocupa uma coluna fixa de 80px à esquerda (o elemento mais largo e menos importante); título a `text-xs`, snippet a `10px`. Não há ícone de categoria, só uma barra de 1px que só aparece na seleção.
3. **Sem agrupamento:** lista plana; não se percebe onde acaba uma jornada/semana e começa outra.
4. **Emojis em vez de ícones:** 🚩 no cabeçalho e no aviso, fora do design system (Material Symbols).
5. **Avisos duplicados:** contador 🚩 no cabeçalho + faixa de aviso + badge «Ação necessária» em cada linha dizem a mesma coisa três vezes.
6. **Botões repetidos:** «Ler próxima» aparece na lista **e** no rodapé do artigo; «Anterior/Seguinte» invertem a intuição (Anterior = mais recente).
7. **Detalhe sem "capa":** meta a 10px, manchete logo a seguir, media pequena e centrada; o artigo parece um card genérico, não uma notícia.
8. **Mobile:** lista presa a `max-h-64` com scroll interno + detalhe por baixo → dois scrolls aninhados.

## Fases

### Fase 1 — Lista limpa e legível (`TopicList.jsx`, `tones.js`)

- Linhas não selecionadas com fundo neutro (`hover:bg-surface-container-high`); a cor da categoria passa só para um **ícone** de categoria (Material Symbols, cor `tone.cap`) à esquerda. Seleção mantém `tone.selected`.
- Acrescentar `icon` a cada entrada de `FILTER_TONES` (ex.: `club`→`shield`, `competitions`→`emoji_events`, `squad`→`groups`, `market`→`swap_horiz`, `all`→`newspaper`).
- Layout da linha: ícone · [título (`text-sm`, black se não lida) / snippet `text-xs`] · data curta à direita (`text-[10px]`, tabular). Remove a coluna de 80px.
- Não lida: ponto + título a negrito; lida: título `font-medium` e opacidade reduzida. Pendência: ícone `flag` a vermelho em vez do badge longo (o `flagLine` em vermelho já explica).

### Fase 2 — Agrupamento por data

- Inserir cabeçalhos sticky dentro do `<ol>` quando `it.date` muda (ou por jornada, se o item tiver esse campo — confirmar em `inboxItems.js` sem o alterar). Só derivação no render; sem estado novo.
- O roving tabindex (`querySelectorAll("button")`) não é afetado porque os cabeçalhos não são botões.

### Fase 3 — Cabeçalho e avisos (`JournalTab.jsx`)

- Cabeçalho com ícone `newspaper` + título; contadores como `Badge` partilhado (`error` para pendências com ícone `flag`, `neutral` para novas).
- A faixa de aviso fica, mas com ícone Material e um botão «Ver» que seleciona a primeira pendência; remover o contador duplicado do cabeçalho quando a faixa está visível.

### Fase 4 — Artigo com "capa" (`JournalTab.jsx`, `ArticleBody.jsx`, `NewsMedia.jsx`)

- Bloco de topo: kicker da categoria (ícone + label na cor `tone.cap`, `text-xs` uppercase) + data; manchete `text-3xl`/`text-2xl` mobile.
- `NewsMedia` alinhado à esquerda, logo abaixo da manchete, cartões maiores (escudo/rosto em 48px) — deixa de parecer um botão solto ao centro.
- Corpo: subir o texto base para `text-sm`/`leading-relaxed` se estiver abaixo; manter capitular.

### Fase 5 — Navegação sem redundância

- Rodapé do artigo: só «‹ Mais recente» / «Mais antiga ›» (rótulos explícitos) + «Ler próxima» como botão primário **apenas** aqui. Na lista fica só «Marcar tudo como lido».
- Mostrar `n / total` entre as setas.

### Fase 6 — Mobile

- Abaixo de `lg`: lista sem `max-h` (scroll da página) e detalhe em vista própria — ao selecionar, esconder a lista e mostrar botão «‹ Notícias» no topo do artigo (estado local `mobileDetail`, booleano). Substitui o `scrollIntoView` atual.

## Verificação

- `npm run check:types` e `npm run lint` no cliente.
- Ver no browser (desktop e 390px): lista com 0 / 1 / muitas notícias, pesquisa com destaque, pendência de renovação, sorteio da Taça, classificação final, resumo financeiro, modo `short:`.
- Teclado: setas/j/k na lista, Enter = próxima, Tab entra no item ativo.

## Fora do âmbito

- Filtros por categoria (removidos de propósito), mudanças de conteúdo/servidor, novas animações.
