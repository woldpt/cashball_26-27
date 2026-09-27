---
name: mobile-resp-check
description: "Verify mobile portrait responsiveness after STRUCTURAL layout changes to the client (new view/tab/modal, GameLayout.jsx, App.jsx, index.css, new shared component, grid/flex/container-width changes). NOT for small tweaks (padding, colors, text size, point className). Single portrait pass (npm run test:mobile) — mobile landscape is blocked by RotateOverlay, so there is no landscape pass. Use after the change passes checks (lint/typecheck) and before reporting the task as finished or committing."
---

# Mobile Responsiveness Check

After a **structural layout change to the client** (see "When to run"), verify
that the app still navigates well on mobile portrait screens (no horizontal
overflow, no clipped content, no JS errors) — before reporting the task as
finished. (Mobile landscape is blocked by `RotateOverlay` — "Roda o
telemóvel" — so there is no landscape pass.)

## When to run

**Run** (structural changes):
- New view, tab, or modal.
- Changes to `GameLayout.jsx`, `App.jsx`, or `index.css`.
- New shared component under `src/components/**`.
- Changes to grid/flex structure or container widths (affects the overall
  layout, not a single element).

**Do not run** (small tweaks and non-layout changes):
- Padding/gap/margin tweaks, colors, text sizes, a single `className` change
  inside an existing container.
- Pure logic with no styling/layout impact (socket handlers, pure utils).

## Portrait pass

```bash
cd client && npm run test:mobile
```

> **Fast:** the runner runs all `*-test.html` harnesses × the 5 widths in
> **parallel** (default `--concurrency 20`). Full 33-harness run takes
> **~45 seconds** (exit 0, RESULT `165/165`). Use a modest bash timeout (e.g.
> `timeout 180s`) — no need for `600s` anymore. Tune with `--concurrency <n>`
> (lower on constrained machines; `1` reproduces the old sequential behaviour).

This starts a throwaway `vite dev` (port 5199, killed afterwards unless one is
already serving), renders every `*-test.html` harness at mobile viewport widths
(`320, 360, 390, 414, 430` — small Android → iPhone SE → 12/13/14 → XR → 15 Pro
Max) in headless Chromium, and reports:

- `overflow` — page-level horizontal overflow (must be `0px`)
- `clippedRows` — `overflow-hidden` rows clipping content (must be `0`)
- `clipEls` — (info) elements clipping content, excluding intentional `truncate`
- `smallTargets` — (info) interactive elements < 44px (dense dashboard; review, don't auto-fail)
- `pageErr` — JS exceptions (must be `0`)
- `resErr` — (info) resource 404s (fonts/favicon; harmless)

**Exit code 0 = PASS, 1 = FAIL.** On FAIL the output lists the exact elements
and pixel excess — fix the CSS, re-run, repeat until PASS.

## Run only the affected harness

```bash
cd client && npm run test:mobile -- mobile-resp-test scout-resp-test
# options: --widths 360,390 --height 844 --port 5199 --screenshots /tmp/shots
```

## Visual verification (always do this)

The numeric check catches overflow/clipping but not ugly-but-fitting layouts.
Generate screenshots and **look at them** (the `read` tool renders PNGs):

```bash
cd client && npm run test:mobile -- --screenshots /tmp/resp-shots
# then read /tmp/resp-shots/<harness>-360.png and <harness>-390.png
```

Check: content fits, no element is cut off, tap targets are usable, the bottom
nav bar (`h-16`) does not cover content (content has `pb-16`), text is legible.

## Harness → component map

| Harness file (client root) | Renders |
| :------------------------- | :------ |
| `auctions-resp-test.html` | `pages/AuctionsPage.jsx` |
| `briefing-resp-test.html` | `components/live/briefing/` (briefing pré-jogo) |
| `calendario-resp-test.html` | `views/CalendarioTab.jsx` |
| `club-resp-test.html` | `views/ClubTab.jsx` |
| `cup-resp-test.html` | `views/CupTab.jsx` |
| `cupfinal-resp-test.html` | `components/live/CupFinalStage.jsx` |
| `finances-resp-test.html` | `views/FinancesTab.jsx` |
| `intervencao-test.html` | `components/match/tabs/IntervencaoView.jsx` |
| `journal-resp-test.html` | `views/JournalTab.jsx` |
| `landing-resp-test.html` | `components/auth/LandingPage.jsx` |
| `livehero-resp-test.html` | `components/live/LiveMatchHero.jsx` |
| `match-spectate-resp-test.html` | `components/match/tabs/MatchView.jsx` |
| `mobile-resp-test.html` | `views/PlayersTab.jsx` |
| `playerhistory-resp-test.html` | `components/modals/PlayerHistoryModal.jsx` |
| `roomhub-resp-test.html` | `components/chat/RoomHub.jsx` |
| `roompause-resp-test.html` | `components/shared/RoomPauseBanner.jsx` |
| `roomselect-resp-test.html` | `components/auth/RoomSelectScreen.jsx` |
| `room-settings-resp-test.html` | `components/room/RoomSettings.jsx` |
| `rotateoverlay-resp-test.html` | `components/shared/RotateOverlay.jsx` (só rende em landscape; em retrato passa com o placeholder) |
| `scout-resp-test.html` | `views/PlayerSearchView.jsx` |
| `settings-resp-test.html` | `pages/UserSettingsPage.jsx` |
| `stadium-resp-test.html` | `components/shared/StadiumIllustration.jsx` |
| `stadiumtab-resp-test.html` | `views/StadiumTab.jsx` |
| `standings-resp-test.html` | `components/ui/LeagueStandings.jsx` |
| `tactics-resp-test.html` | `views/TacticsView.jsx` |
| `teamhistory-resp-test.html` | `views/TeamHistoryView.jsx` |
| `topwidgets-resp-test.html` | widgets de topo (SummaryWidget e irmãos) sobre várias tabs |
| `training-resp-test.html` | `components/ui/TrainingPage.jsx` |
| `transfer-resp-test.html` | `components/ui/TransferHub.jsx` |
| `useradmin-panel-resp-test.html` | `components/admin/AdminPanel.jsx` |
| `useradmin-resp-test.html` | componentes admin (`UserList`/`UserProfileSection`/`UserRoomsSection`/`UserTeamsSection`) |
| `waiting-coaches-test.html` | `components/modals/WaitingCoachesModal.jsx` |
| `welcome-resp-test.html` | `components/modals/WelcomeModal.jsx` |

- Changed file maps to a harness → run that harness.
- Changed file is shared (`GameLayout.jsx`, `src/components/**`, `index.css`,
  `App.jsx`) or maps to **no** harness → run **all** harnesses (default).
- Changed view has **no harness** → create one first (below), then run it.

## Creating a harness for a new view

Copy the templates from this skill's `templates/` dir into the **client root**
and adapt:

1. `templates/harness.html` → `<name>-resp-test.html`
   (set `<title>` and the `<script src="/<name>-resp-test.jsx">`).
2. `templates/harness.jsx` → `<name>-resp-test.jsx`
   - import the **real** component (`import { X } from "./src/views/X.jsx"`).
   - build **edge-case fixture data**: longest realistic names, extreme values,
     every badge/status state (injury, suspension, junior, star, auction,
     pending contract, transfer cooldown…). See `mobile-resp-test.jsx` for the
     field shapes of `PlayersTab`.
   - wrap it to mimic the real mobile container:
     `<div className="min-h-screen bg-surface"><div className="p-4 lg:p-6">…</div></div>`
     (matches `GameLayout`'s `<main> > div.p-4`).
   - keep the `measure()` + `#report` block unchanged (it is the contract the
     runner reads).

The harness contract (do not break): render into `#root`, then after ~2500 ms
write `REPORT:<json>` into `<pre id="report">` and set `data-status="done"`.
The JSON must include `viewport`, `pageOverflowPx`, `clippedRows` (or
`clippedPlayerRows`), `clippingElements`, and `verdict` (`"PASS"`/`"FAIL"`).

## Interpreting failures & typical fixes (see `STYLE.md`)

- `overflow=Npx` → something is wider than the viewport. Find the culprit in
  `clipEls`/`clipping` output. Usual causes: a fixed-width element, a long
  unbreakable string without `truncate`/`break-words`, a table/grid that needs
  `overflow-x-auto` on the container (not on the page), or a missing
  `min-w-0` on a flex child.
- `clippedRows=N` → an `overflow-hidden` row is hiding content. Add `truncate`
  to the text, or `min-w-0`/`flex-1` so the flex child can shrink.
- `pageErr>0` → a JS exception (often a null prop). Fix the code; this is not
  a CSS issue.

## Rules

1. **Never report the task as finished (and never commit) while the portrait
   pass FAILs.** Fix and re-run until PASS.
2. Run the numeric check **and** look at at least one portrait screenshot
   (360 or 390).
3. If you created a new harness, keep it in the commit (it is a regression
   asset, like the other `*-test.html` files).
4. Commit per the `auto-commit` skill (stage only the files you changed).
