# Plano: melhorias ao Jornal do Clube (`client/src/views/JournalTab.jsx`)

Baseado na leitura do `JournalTab.jsx`. O `useInbox.js` ainda não foi lido; os pontos que dependem do hook estão marcados como **a verificar** na Fase 0.

## Diagnóstico

### Comportamento
1. **Teclado:** só há Enter para a próxima não lida. Não há ↑/↓ nem j/k na lista, e a lista não tem foco gerido.
2. **Seleção fora do filtro:** ao mudar de filtro ou pesquisa, o `selected` pode não estar em `visible`. O detalhe mostra então uma notícia que a lista não mostra.
3. **Contadores:** os filtros não mostram nº de não lidas por categoria. A pesquisa limpa-se ao trocar de filtro, sem aviso.
4. **Mobile:** o detalhe fica abaixo da lista e o scroll é automático. O "Ler próxima" está na coluna da lista, longe do artigo. Não há "Anterior/Seguinte" no fim do detalhe.
5. **Sem seleção:** a coluna direita fica vazia, sem estado vazio.
6. **Animação:** `AnimatePresence mode="wait"` com 180 ms de saída atrasa a navegação rápida e ignora `prefers-reduced-motion`.
7. **Pesquisa:** destaca só na lista, não no corpo do artigo. Não pesquisa o `flagSummary`.
8. **Duplicação do "Ação necessária" / "Bloqueia o Pronto":** aparece no `ArticleMeta` e outra vez no `FlagActionPanel`.
9. **Resumos duplicados:** o resumo de job, board e contract existe em `flagSummary` e em `InboxActions`, com texto ligeiramente diferente.
10. **Ações em notícias já respondidas (a verificar):** o bloco `!redFlag && kind in [...]` mostra `InboxActions`. É preciso confirmar o que aparece depois de responder.

### Formatação do texto
1. **Justificado:** `text-justify` sem `hyphens` cria "rios" de espaço em colunas estreitas (mobile).
2. **Capitular:** `first-letter` não funciona quando o parágrafo começa por um `<button>` de entidade. A medição do `LEAD_MIN_CHARS` usa `join(" ")`, que conta espaços que não existem.
3. **Links de entidade:** a pílula com `font-black` em cada nome torna o corpo pesado. Não há distinção visual entre jogador e equipa.
4. **Sem blocos além de parágrafo:** não há listas, citações nem linha de "factos-chave". Só existe `part.bold`.
5. **Código:** há `noLead` redundante, JSDoc fora do sítio (o de `InboxActions` está em cima de `FlagActionPanel`) e a constante `LEAD_MIN_CHARS` entre o JSDoc e a função. O ficheiro tem 1288 linhas.

### Tabelas
1. **Classificação:** só o campeão é destacado. A equipa do treinador não, e não há zonas de subida/descida. Com 9 colunas em `max-w-md`, o mobile faz scroll horizontal sem coluna fixa.
2. **Acessibilidade:** não há `caption`, `scope="col"`, nem texto alternativo para 🏆/📍. O 🏆 substitui o número da posição.
3. **Taça:** o cabeçalho "Jogo" alinhado à direita sobre números é estranho. Falta separador "vs" entre casa e fora.
4. **Repetição:** as classes de `th`/`td` repetem-se nas 3 tabelas.
5. **Finanças:** não há separação visual entre receitas e despesas, e o "Saldo" não tem destaque de total (borda dupla).

### Botões de ação
1. **Posição inconsistente:** os botões de pendência ficam antes do corpo. Os de `cupdraw`, `sponsor` e outros ficam depois das tabelas, no fim do scroll. No mobile é fácil não os ver.
2. **Consequência pouco visível:** "Recusar" no contrato manda o jogador a leilão. A consequência é só texto pequeno (`text-[11px]`) e não há confirmação.
3. **Feedback incompleto:** só o contrato tem estado `busy`. Job e board não têm.
4. **Poucas ações contextuais:** transferências, rescaldo, classificação final e finanças não têm atalhos como "Ver jogador", "Ver classificação" ou "Ver finanças". Dependem de links no texto.

## Plano de implementação

### Fase 0 — Verificações (sem código)
- Ler `hooks/useInbox.js` e confirmar:
  - como `select` e `markRead` funcionam;
  - o que acontece ao `selected` depois de `answerContract`, `answerJobOffer` e `ackBoard`;
  - a ordem dos itens (redFlags primeiro?).
- Confirmar a forma dos `bodyParts` e dos `facts` no servidor, para saber o que dá para estender sem mexer no backend.
- Ver `STYLE.md` para tokens e pesos tipográficos, e `AGENTS.md` para as regressões.

### Fase 1 — Refactor sem mudança visual
- Dividir em `client/src/views/journal/`: `ArticleBody.jsx`, `ArticleTables.jsx`, `ArticleActions.jsx`, `NewsMedia.jsx`, `TopicList.jsx`, `tones.js`. O `JournalTab.jsx` fica como orquestrador.
- Criar primitivos de tabela (`JournalTable`, `Th`, `Td`) e usá-los nas 3 tabelas.
- Centralizar o resumo de pendências numa função `flagSummary` única, usada pela lista e pelo painel.
- Limpar JSDoc, `noLead` e a constante mal colocada.
- **Validar:** `npm run check:types` e `client/scripts/mobileRespCheck.mjs`, sem diferenças visuais.

### Fase 2 — Comportamento
- **Navegação por teclado:** ↑/↓ (e j/k) na lista, com `aria-activedescendant` ou roving tabindex. Manter o Enter e respeitar o guard de modais.
- **Seleção coerente:** ao mudar filtro ou pesquisa, se o `selected` sair de `visible`, escolher o primeiro visível sem o marcar como lido. Manter a regra existente de "só o clique marca como lido".
- **Contadores:** mostrar o nº de não lidas em cada filtro.
- **Detalhe:** adicionar rodapé com "‹ Anterior · Seguinte ›" e "Ler próxima", visível também no mobile. Adicionar estado vazio quando não há seleção.
- **Pesquisa:** destacar no título e corpo do detalhe, e incluir o `flagSummary` no texto pesquisável.
- **Animação:** trocar `mode="wait"` por transição curta sem espera e respeitar `prefers-reduced-motion`.
- **Duplicação:** deixar o selo "Ação necessária" só no `FlagActionPanel`. O `ArticleMeta` mostra só categoria e data.

### Fase 3 — Texto
- **Justificação:** passar para `text-left`, ou `text-justify hyphens-auto` com `lang="pt"` e só a partir de `sm`. Decidir após comparar nos dois tamanhos.
- **Capitular:** aplicar só quando o parágrafo começa por texto (não por entidade). Medir o comprimento sem separadores.
- **Entidades:** links mais leves (`font-bold`, sublinhado ténue ou pílula só no hover). Mini-crest inline para equipas e talvez cor distinta para jogadores.
- **Blocos novos:** aceitar em `bodyParts` os tipos `list`, `quote` e `keyfacts` (linha de chips tipo "Resultado · Público · MOM"). Se o servidor não os emitir, começar pelo `keyfacts` a partir dos `facts` já existentes.
- **Hierarquia:** reforçar o espaçamento entre entrada, corpo e ações (os filetes já existem).

### Fase 4 — Tabelas
- **Classificação:**
  - destacar a equipa do treinador (`viewerTeamId` hoje só vem em `cupdraw`, pelo que pode ser preciso acrescentá-lo aos `facts`);
  - marcar zonas de subida e descida com uma barra lateral;
  - manter o nº da posição ao lado do 🏆;
  - fixar a coluna "Equipa" com `sticky left-0` no mobile.
- **Acessibilidade em todas:** `caption` (`sr-only`), `scope="col"` e `aria-label` nos emojis.
- **Taça:** alinhar "Jogo" ao centro e acrescentar separador "vs" entre as equipas.
- **Finanças:** agrupar receitas e despesas, e dar ao "Saldo" borda superior forte e tipografia maior.
- **Largura:** `max-w-md` só nas tabelas curtas. A classificação ocupa a largura toda da coluna.

### Fase 5 — Botões de ação
- **Barra de ações única** (`ArticleActions`), **sticky no fundo** do painel de detalhe para qualquer tipo de notícia. Fica sempre visível no mobile e as pendências deixam de ter dois locais.
- **Consequência visível:** texto de consequência mais legível (≥ `text-xs`) ao lado do "Recusar". Confirmação em dois passos para ações destrutivas (contrato → leilão), sem `confirm()`.
- **Estado de carregamento** (`busy`) em job e board, como no contrato.
- **Notícias já respondidas:** mostrar "Respondido: aceitaste/recusaste" em vez de voltar a mostrar os botões (depende da Fase 0).
- **Ações contextuais por `newsType`:** "Ver jogador", "Ver equipa", "Ver classificação", "Ver finanças". Exigem callbacks de navegação novos (`onNavigate(tab)`), passados pelo `GameRoutes.jsx`.

## Ordem e esforço
| Fase | Esforço | Risco |
|---|---|---|
| 1 Refactor | médio | baixo (sem mudança visual) |
| 2 Comportamento | médio | médio (seleção e leitura) |
| 3 Texto | pequeno | baixo |
| 4 Tabelas | médio | baixo, mas pode exigir `facts` novos no servidor |
| 5 Ações | médio-grande | médio (navegação e estados do inbox) |

Cada fase pode ser um commit separado. Fazer as fases 1 e 2 primeiro, porque resolvem os problemas mais visíveis de uso.

## Decisões em aberto
1. **Texto:** justificado com hifenização, ou alinhado à esquerda?
2. **Ações por tipo de notícia:** vale a pena criar navegação (Fase 5) ou ficam só os botões de pendência?
3. **Backend:** pode alterar-se o servidor para emitir `viewerTeamId` na classificação e blocos `keyfacts`, ou o plano fica só no cliente?
