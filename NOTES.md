# NOTES.md — Estado corrente do projeto

> **Regra (1 ficheiro, nunca um por sessão):**
> - Atualizar no fim de cada tarefa/funcionalidade — e antes de fechar a sessão.
> - Bullets curtos em pt-PT. Blocos antigos (> ~2 semanas) já refletidos em commits: apagar.
> - Regra permanente descoberta → mover para `AGENTS.md`/`CLAUDE.md`/`STYLE.md` e remover daqui.
> - Ao iniciar uma sessão nova: ler este ficheiro + `git log --oneline -10`.

## Em curso

- (nada)

## Último estado

- (nada)

## Decisões recentes

- Skill `mobile-resp-check`: gatilho reduzido a **mudanças estruturais** de layout (nova view/tab/modal, `GameLayout.jsx`, `index.css`, novo componente partilhado, grid/flex/larguras) — tweaks pequenos (padding/cores/texto) não disparam. Adicionada **landscape pass obrigatória**: `cd client && npm run test:mobile:landscape` (widths 568–1023, height 375); a verificação só está completa com portrait + landscape em PASS.

## Armadilhas / "não fazer"

- (nada)

## Próximos passos

- (nada)
