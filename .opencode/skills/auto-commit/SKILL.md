---
name: auto-commit
description: Always create a git commit after code changes are complete and verified. Use whenever source files are edited, created, or deleted in this project — after the change passes checks (typecheck/lint/build) and before reporting the task as finished.
---

# Auto-Commit

After every code change, create a git commit — do not leave verified work
uncommitted. **Never push** unless the user explicitly asks.

## When to commit

- Immediately after a code change is finished **and verified** (run the
  checks from AGENTS.md: `npm run typecheck` / `npm run lint` /
  `npm run check:types` as applicable to the files touched).
- If checks fail, fix the code first — never commit a broken state.
- If the working tree has no changes from this task, skip and say so.

## Rules

1. **Stage only the files you changed in this task** — use explicit paths
   (`git add <path>`), never `git add -A` or `git add .`. Untracked files
   (e.g. `PLAN.md`) stay out unless the user asks for them.
2. **One commit per logical change.** If one task produced several unrelated
   changes, make one commit per concern.
3. **Commit message focuses on the "why"** (see AGENTS.md → Commit
   Workflow), with a conventional-commit prefix:
   - Subject: `fix: prevent duplicate NPC bids in auctions`
   - Body (optional, 1–3 lines): root cause or motivation.
4. **Verify after committing:** `git status --short` should show only
   intended leftovers (untracked files are fine).
5. **Do not push.** Push only when the user asks.

## Example

```bash
git add client/src/components/chat/RoomHub.jsx
git commit -m "fix: fetch chat history on RoomHub open so chat is not empty mid-game

WaitingCoachesModal was the only place emitting getChatHistory (lobby
only), so the panel stayed empty during the game."
```
