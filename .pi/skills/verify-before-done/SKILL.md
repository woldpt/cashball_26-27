---
name: verify-before-done
description: "Decide which checks must pass before reporting a task as done or committing"
---

# Verificação Pré-Feito

Corre **antes** de declarar "feito" ou de commitar. Escolhe só os checks
da mudança em causa — o resto salta.

## Que checks correr

A lista de checks vive no `AGENTS.md` (§"Antes de feito" / commit) — única
fonte de verdade, não duplicada aqui:

- Servidor e/ou cliente → os checks verdes aplicáveis (incl. o caso especial
  `server/index.ts`, assinalado no `AGENTS.md`).
- Lógica de jogo, comunicações ou presença → os audits indicados.
- Layout estrutural → skill `mobile-resp-check` (portrait + landscape).
- Regressão nova ou alterada (`scripts/*Regression*`, harnesses) → correr o
  script/harness tocado.

## Regras

1. **Sem saída verificada, sem "feito".** Só conta a saída real do comando,
   nunca a expectativa.
2. **Salto legítimo se registado:** sem sala viva, `audit:gamestate` fica
   para a próxima sala — escreve isso no `NOTES.md` em vez de omitir em
   silêncio. Tweaks pontuais (padding, cores, texto) saltam o mobile sem
   registo.
3. **Falha pré-existente não é carta-branca:** confirma com `git stash` que
   a falha já existia antes da mudança; regista o resultado. Vale para
   testes e para harnesses mobile (ex. `journal-resp-test`, falha conhecida
   e fora do âmbito de muitas tarefas).
4. **Memória antes do commit:** atualiza o `NOTES.md` com a tarefa e os
   checks corridos; regra permanente sai do `NOTES.md` para os docs
   (`AGENTS.md`, `CLAUDE.md`, `STYLE.md`).
5. **Commit** pela skill `auto-commit` (só ficheiros da tarefa, sem push).
