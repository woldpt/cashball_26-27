# 2026-10-09 — Equipa de agentes + carregamento dos docs

**Objetivo:** orquestrador/revisor (sessão principal, Opus médio), coder (Sonnet médio) e scout (Haiku médio, só leitura).

**Feito:**
1. `CLAUDE.md` importa `@AGENTS.md` — o Claude Code só carregava o `CLAUDE.md` sozinho.
2. `.claude/skills` → atalho para `.pi/skills` (skills visíveis ao Claude Code, fonte única).
3. `.claude/agents/scout.md` e `.claude/agents/coder.md` (`model: haiku`/`sonnet` — alias, apanha sempre a versão mais recente).
4. Secção "Equipa de agentes" no `AGENTS.md`.

**Pendente (propostas de 2026-10-09, à espera de OK):** duplicados CLAUDE↔AGENTS; regra de `test:*` por área; arquivar `NOTES.md` (> 30); `STYLE.md` — §16 ao topo, §3/§6 como legado, `text-zinc-500` → token, §11–13 para `docs/`.
