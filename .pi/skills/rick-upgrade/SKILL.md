---
name: rick-upgrade
description: "Deploy completo no servidor de produção rick: push para origin, tag de versão e rebuild com docker compose. Usar quando o utilizador pede upgrade no rick, deploy no rick ou tag e rebuild."
---

# Rick-Upgrade

Deploy completo em produção, direto e sem perguntas: `push` → `tag` →
`pull` + rebuild no rick → registo no `NOTES.md`.

## Triggers

"upgrade no rick", "deploy no rick", "tag e rebuild", "atualiza o rick".

## Passos

1. **Verificar a árvore:** `git status --short`. Só untracked
   (`server/saves/*`, `*.bak`, `docs/plans/`) é OK — nunca seguem no push.
   Se houver modificações tracked por commitar, abortar e reportar
   (não commitar trabalho de outra sessão).
2. **Push:** `git push origin master`. Se falhar (ex. origin andou),
   fazer `git pull --rebase` primeiro e repetir; nunca `--force`.
3. **Tag:** última tag `vAA.MM.*` (`git tag --sort=-v:refname | head -1`).
   Se `AA.MM` = ano.mês atual, incrementa N; senão recomeça em 1
   (ex. `v26.09.9` → `v26.10.1`). Criar e publicar:
   `git tag <tag> && git push origin <tag>`.
4. **Rick:** `ssh rick 'cd /srv/docker/cashball && git pull &&
   docker compose up --build -d'`. Confirmar `backend Healthy` na saída;
   se falhar, abortar e reportar o erro sem tocar em mais nada.
   (Produção: o seed só recria `base.db` se o esquema/fixtures mudarem;
   as salas nunca são tocadas.)
5. **Memória:** acrescentar entrada curta no `NOTES.md`
   (`## Deploy <tag> no rick (AAAA-MM-DD)` + 3 linhas) e commit local
   (`docs: registar deploy <tag> no rick`), **sem push** — o rick fica
   exatamente na tag.

## Regras

- Nunca `git add -A` / `git add .` — só `NOTES.md` no passo 5.
- Nunca `--force` nem rebase de commits já publicados.
- Qualquer passo que falhe pára tudo e reporta; nada de tentativas criativas.
