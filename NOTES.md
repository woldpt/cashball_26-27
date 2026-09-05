# NOTES.md — Estado corrente do projeto

> **Regra (1 ficheiro, nunca um por sessão):**
> - Atualizar no fim de cada tarefa/funcionalidade — e antes de fechar a sessão.
> - Bullets curtos em pt-PT. Blocos antigos (> ~2 semanas) já refletidos em commits: apagar.
> - Regra permanente descoberta → mover para `AGENTS.md`/`CLAUDE.md`/`STYLE.md` e remover daqui.
> - Ao iniciar uma sessão nova: ler este ficheiro + `git log --oneline -10`.

## Em curso

- (nada)

## Último estado

- 3 defeitos de landscape corrigidos (detectados pela nova landscape pass — código do app nunca testado em landscape antes): (1) `RoomHub.jsx` — lista de players `max-h-40` (160px fixos) + coluna mobile `flex-col` deixava o input fora do ecrã em h=375; agora `max-h-[16dvh]` (proporcional, `sm:max-h-none` mantém desktop). (2) `UserList.jsx` (tabela desktop) — nome sem espaços forçava `min-content` 460px > coluna `w-1/2` (clip em 844/926); agora `table-fixed` + `truncate` na coluna Nome, Salas `w-24`, chevron `w-12`. (3) `welcome-resp-test.jsx` — bug de medição do harness: comparava `scrollHeight` com o disponível; o card em `short:` é deliberadamente capado+scrollable (`max-h-[calc(100dvh-2rem)]`), passou a medir `offsetHeight` (renderizado) — um card clipado continua a dar FAIL. Verificação: portrait 125/125 + landscape 150/150 PASS, screenshots ok.

## Decisões recentes

- Skill `mobile-resp-check`: gatilho reduzido a **mudanças estruturais** de layout (nova view/tab/modal, `GameLayout.jsx`, `index.css`, novo componente partilhado, grid/flex/larguras) — tweaks pequenos (padding/cores/texto) não disparam. Adicionada **landscape pass obrigatória**: `cd client && npm run test:mobile:landscape` (widths 568–1023, height 375); a verificação só está completa com portrait + landscape em PASS.

## Armadilhas / "não fazer"

- Frontmatter YAML de skills (`description`): scalar plain não pode conter `:` seguido de espaço (ex. "passes: portrait") — o parser `yaml` do pi falha com `BLOCK_AS_IMPLICIT_KEY`. Sempre entre aspas duplas quando há colones internos.

## Próximos passos

- (nada)
