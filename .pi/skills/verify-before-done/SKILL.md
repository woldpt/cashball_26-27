---
name: verify-before-done
description: "Decide which checks must pass before reporting a task as done or committing"
---

# Verificação Pré-Feito

Corre **antes** de declarar "feito" ou de commitar. Escolhe na matriz só as
linhas da mudança em causa — o resto salta.

## Matriz

| Mudança | Checks obrigatórios |
|---|---|
| Backend `.ts` | `cd server && npm run typecheck` |
| `server/index.ts` (tem `// @ts-nocheck`) | `typecheck` + `cd server && npm run test:connect-smoke` |
| Lógica de jogo ou comunicações socket | `audit:gamestate <SALA>` + `audit:socketio` |
| Presença/congelamento | `test:session-freeze` (+ `audit:session <SALA>` se houver sala viva) |
| Cliente `.jsx`/`.js`/`.css` | `cd client && npm run lint` + `npm run check:types` |
| Layout estrutural (nova view/tab/modal, `GameLayout.jsx`, `App.jsx`, `index.css`, componente partilhado, grid/flex/larguras) | skill `mobile-resp-check` (portrait + landscape) |
| Regressão nova ou alterada (`scripts/*Regression*`, harnesses) | correr o script/harness tocado |

## Regras

1. **Sem saída verificada, sem "feito".** Só conta a saída real do comando,
   nunca a expectativa.
2. **Salto legítimo se registado:** sem sala viva, `audit:gamestate` fica
   para a próxima sala — escreve isso no `NOTES.md` em vez de omitir em
   silêncio. Tweaks pontuais (padding, cores, texto) saltam o mobile sem
   registo.
3. **Falha pré-existente não é carta-branca:** confirma com `git stash` que
   a falha já existia antes da mudança; regista o resultado.
4. **Memória antes do commit:** atualiza o `NOTES.md` com a tarefa e os
   checks corridos; regra permanente sai do `NOTES.md` para os docs
   (`AGENTS.md`, `CLAUDE.md`, `STYLE.md`).
5. **Commit** pela skill `auto-commit` (só ficheiros da tarefa, sem push).
