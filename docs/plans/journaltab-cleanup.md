# Plano — limpeza do `client/src/views/JournalTab.jsx`

> Plano aprovado pelo utilizador. Executar tal como está; algo fora do plano → parar e perguntar.

## Contexto para o executor

- Ler antes: `AGENTS.md`, `STYLE.md`, `NOTES.md`. pt-PT sempre; frontend só JS (tipos via JSDoc).
- Consumidor único do ficheiro: `client/src/GameRoutes.jsx:465`. A API pública (props de `JournalTab`) **não muda**.
- **Não mexer** em `useInbox.js`, `inboxItems.js` nem no servidor.
- Decisão tomada: o §11 do STYLE.md e o CSS `jp-*` são para apagar — o commit `5d90290e` substituiu a folha de jornal pela caixa de entrada CM2001 de propósito, e `NOTES.md:278` já regista esse CSS como morto.
- Fora do âmbito: dividir o ficheiro em `components/journal/` (depois dos cortes fica com ~850 linhas).

## Passos

### 1. Remover funcionalidades a mais (`JournalTab.jsx`)

- Apagar `estimateReadTime`. Em `ArticleMeta`, remover `readTime` e os emojis 📅/⏱ (a data fica como texto simples).
- Apagar o componente `ReadingProgressBar` e o sítio onde é usado (o `detailRef` passa para o passo 5).
- Na linha da lista, remover `animate-pulse` do ponto de "não lida".
- Remover `aria-live="polite"` do `motion.section`.

### 2. Remover duplicação e sobras

- Criar `const LINK_CLS = "font-black text-primary underline decoration-primary/40 underline-offset-2 hover:text-on-surface transition-colors";` e usá-la nos 5 sítios: `RichNewsText` ×2, `LeagueFinalTable` e `CupDrawTable` (onde há extra: `${LINK_CLS} ${mine ? "text-tertiary" : ""}`).
- Criar `const TABLE_WRAP_CLS`, `TABLE_CLS` e `THEAD_ROW_CLS` com as classes repetidas nas duas tabelas. **Não** criar um componente genérico de tabela.
- `RichNewsText`, caso "player": remover o `const content` e fazer `return <button key={key} …>` diretamente.
- `RichParagraphs`: calcular `paragraphs` antes e juntar os dois ramos de fallback duplicados num único early-return.
- `getSnippet`: remover o corte aos 80 caracteres (o `truncate` do CSS já corta) — devolver `body.replace(/\n/g, " ")`. Atualizar o JSDoc.
- `InboxActions`: remover `if (!item) return null;` (nunca é verdadeiro).
- No `JournalTab`, usar sempre `selected` (já desestruturado) em vez de misturar com `inbox.selected`.

### 3. Acessibilidade dos filtros

- No contentor dos filtros, trocar `role="tablist"` por `role="group"`; manter `aria-label` e o `aria-pressed` dos botões.
- **Não** usar o `TabBar` partilhado: perdia as cores por categoria (`FILTER_TONES.idle/active`).

### 4. Atalho de teclado

- `client/src/components/shared/ModalShell.jsx`: acrescentar `role="dialog" aria-modal="true"` ao `motion.div` do backdrop (cobre os 13 modais que o usam).
- `handleKeyDown`: no início, `if (document.querySelector('[aria-modal="true"]')) return;`.
- O atalho passa a ser **só Enter**; o Espaço volta ao scroll nativo (remover `|| e.key === " "`).
- Atualizar o comentário no topo do ficheiro: onde diz «Enter/Espaço», passa a dizer «Enter».
- Verificar com grep se o `InviteRoomModal` (não usa `ModalShell`) pode abrir por cima do Jornal. Se puder, dar-lhe `aria-modal="true"`; se não, ignorar.

### 5. Mobile: levar ao detalhe ao tocar numa notícia

- Pôr `ref={detailRef}` na `<section aria-label="Corpo da notícia">` exterior (é estática) e removê-lo do `motion.section`.
- No `onClick` da linha, depois de `inbox.select(it.id)`:
  ```js
  if (!window.matchMedia("(min-width: 1024px)").matches)
    detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  ```
- Só no clique na linha; o «Ler próxima» fica como está.

### 6. Código morto da folha de jornal

- Confirmar primeiro que não há ocorrências: `grep -rn "jp-" client/src --include=*.jsx`.
- `client/src/index.css`: apagar a secção inteira `JORNAL — "quadro-negro" (JP)` (cerca das linhas 522–625): `.jp-paper`, `.jp-amador/semi/pro`, `.jp-grain`, `.jp-tape`, `.jp-photocopy` e respetivos comentários.
- `STYLE.md`: substituir o §11 por um parágrafo curto — o Jornal é uma caixa de entrada estilo CM2001, com tópicos à esquerda e detalhe à direita, em registo de imprensa (capitular a partir de 140 caracteres); as cores por categoria estão em `FILTER_TONES` no `JournalTab.jsx`.
- `NOTES.md`: apagar a linha 278 (a que regista o CSS `jp-*` como morto).

## Verificação (tudo verde antes de dar como feito)

- `cd client && npm run lint && npm run check:types` (só são aceitáveis os 2 erros de lint pré-existentes).
- `cd client && npm run test:journaldb`.
- `cd client && npm run test:mobile && npm run test:mobile:landscape` — ambos obrigatórios (o passo 6 mexe no `index.css`).
- Teste manual em `npm run dev`:
  - Enter salta para a próxima notícia; com o histórico de um jogador aberto, Enter não faz nada.
  - Espaço faz scroll.
  - Em mobile, tocar numa notícia leva ao detalhe.
  - A pesquisa com acentos continua a destacar o termo.
  - As tabelas da Taça e da classificação final continuam a aparecer.

## Fecho

- Atualizar `NOTES.md` com um resumo curto.
- Um commit, seguindo a skill `.pi/skills/auto-commit/SKILL.md`:
  `refactor: trim JournalTab bloat, fix keyboard shortcut under modals and remove dead jp-* CSS`
- Sem push.
