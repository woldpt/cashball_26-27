---
name: mobile-resp-check
description: Verify mobile responsiveness after STRUCTURAL layout changes to the client (new view/tab/modal, GameLayout.jsx, App.jsx, index.css, new shared component, grid/flex/container-width changes). NOT for small tweaks (padding, colors, text size, point className). Two mandatory passes: portrait (npm run test:mobile) + landscape (npm run test:mobile:landscape). Use after the change passes checks (lint/typecheck) and before reporting the task as finished or committing.
---

# Mobile Responsiveness Check

After a **structural layout change to the client** (see "When to run"), verify
that the app still navigates well on mobile screens — portrait **and**
landscape (no horizontal overflow, no clipped content, no JS errors) — before
reporting the task as finished.

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

## Landscape pass (mandatory)

The app is played in landscape (mobile-landscape branch of `GameLayout`).
After the portrait pass, run the landscape pass over all harnesses:

```bash
cd client && npm run test:mobile:landscape
# = node scripts/mobileRespCheck.mjs --widths 568,667,736,844,926,1023 --height 375
# affected harness only: npm run test:mobile:landscape -- mobile-resp-test
```

The check is only complete when **both passes PASS** (exit code 0 each).

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
cd client && npm run test:mobile:landscape -- --screenshots /tmp/resp-shots-land
# then read /tmp/resp-shots/<harness>-360.png and <harness>-390.png
# and one landscape shot, e.g. /tmp/resp-shots-land/<harness>-667.png
```

Check: content fits, no element is cut off, tap targets are usable, the bottom
nav bar (`h-16`) does not cover content (content has `pb-16`), text is legible.

## Harness → component map

| Harness file (client root) | Renders |
| :------------------------- | :------ |
| `mobile-resp-test.html`    | `views/PlayersTab.jsx` |
| `scout-resp-test.html`     | `views/PlayerSearchView.jsx` |
| `intervencao-test.html`    | `components/match/tabs/IntervencaoView.jsx` |
| `game-landscape-test.html` | `GameLayout.jsx` — skeleton do ramo mobile-landscape (banda vazia à esquerda + pill "AO VIVO" a cobrir o fim do conteúdo). Já corre na landscape pass (`npm run test:mobile:landscape`). |

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

1. **Never report the task as finished (and never commit) while either pass
   (portrait or landscape) FAILs.** Fix and re-run until both PASS.
2. Run the numeric check **and** look at at least one portrait screenshot
   (360 or 390) and one landscape screenshot (e.g. 667).
3. If you created a new harness, keep it in the commit (it is a regression
   asset, like the other `*-test.html` files).
4. Commit per the `auto-commit` skill (stage only the files you changed).
