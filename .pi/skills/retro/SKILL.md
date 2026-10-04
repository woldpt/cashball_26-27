---
name: retro
description: "Retrospetiva de uma sessão: propõe melhorias ao ambiente de trabalho do agente (AGENTS.md, checks, navegação, ferramentas). Só por invocação explícita."
disable-model-invocation: true
---

# Retro

Corre só quando a invocas (`/skill:retro [sessão]`). O objeto da retrospetiva é
o **ambiente do agente**, não o código: o que tornou esta sessão mais lenta,
mais cara ou mais sujeita a erro do que devia.

## 1. Fontes primárias

Lê a sessão antes de opinar: transcript (`recall`), `git log --oneline` e o
`NOTES.md` (a retro anterior costuma explicar a sessão atual). Se algo de
importante não está registado em lado nenhum, isso já é um candidato.

## 2. Caçar candidatos

| Categoria | Pergunta | Quando conta |
|---|---|---|
| **Navegação** | custou a achar o ficheiro certo? há dependências escondidas? | falta um ponteiro em `AGENTS.md`/`CLAUDE.md` |
| **Checks automáticos** | um erro que um check apanhava? um check que existe mas está desligado? | novo harness/hook, ou ligar o que já existe |
| **Padrões** | a regra é mecânica (padrão fixo, API proibida, sítio de ficheiro) ou julgamento? | mecânica → vira **check**, não prosa; julgamento → `AGENTS.md`/`STYLE.md` |
| **Tamanho do `AGENTS.md`** | instruções que deviam ser check? linhas que não mudam nada? | cortar ou mudar para doc atrás de ponteiro |
| **Regressões proibidas** | o bug desta sessão merece linha na lista? a lista passou de ~10? | acrescentar; arquivar as estáveis em `NOTES_arquivo.md` |
| **Economia de ferramentas** | chamadas caras a repetir o que um comando dava? | comando/script novo |
| **No-ops** | linhas que o agente já cumpre por defeito? | apagar a frase inteira, não a afinar |
| **Acesso à informação** | faltou um log, um save, um `ROOM_CODE`, leitura de terceiros? | expor no harness/servidor |

## 3. Apresentar

Lista curta, **ordenada por gravidade** (pior primeiro). Cada candidato: onde
(ficheiro/linha), a **prova** da sessão (o que realmente aconteceu) e a proposta
numa linha. Zero candidatos = dize-lo; não inventes trabalho para justificar a
retro.

## 4. Aplicar

Só depois do OK do utilizador, pela via normal (`AGENTS.md`, `CLAUDE.md`,
`STYLE.md`, `NOTES.md`, skill ou script), com `verify-before-done` no que tocar
em código. Regista a decisão no `NOTES.md` e commita pela `auto-commit`.

## Referência

- **Implementação vs revisão:** quem implementa tem pressão de contexto; a
  revisão recebe um diff e tem folga — por isso a revisão é que impõe padrões.
- **`AGENTS.md` é para ponteiros de navegação**, gasto com parcimónia; o detalhe
  vive em docs atrás de ponteiro (`CLAUDE.md`, `STYLE.md`, `docs/`).
- **Doc vs skill:** a `description` de uma skill ocupa contexto em cada turno; o
  corpo só quando dispara. Regra nova entra num doc — só vira skill se precisar
  de gatilho próprio.
- **`NOTES.md` tem teto de 30 apontamentos** (máx. 5 linhas cada); cheio, os mais
  antigos passam para `NOTES_arquivo.md`.
