# Design System: The Tactical Editorial

## 1. Overview & Creative North Star: "The Digital Pitchside"
This design system is a sophisticated evolution of the classic football manager aesthetic—specifically the nostalgic precision of Elifoot 98—reimagined as a premium, high-performance Single Page Application (SPA). 

**The Creative North Star: The Digital Pitchside.** 
We are moving away from the "clunky spreadsheet" look of the 90s and toward a "Broadcast Command Center" feel. The system breaks the traditional rigid grid through **modular layering** and **asymmetric data density**. We leverage deep, atmospheric greens and trophy-gold accents to create an environment that feels authoritative, cinematic, and tactically precise.

---

## 2. Colors: Tonal Depth & The "No-Line" Rule
The palette is rooted in the "Deep Pitch" and "Stadium Grey" spectrum. We use color shifts, not lines, to define the field of play.

### The "No-Line" Rule
**Explicit Instruction:** Do not use `1px` solid borders to section off content. 
Structure is created through background shifts. A `surface-container-low` component should sit directly on a `surface` background. If you need to separate two modules, use a `2.5` (0.5rem) spacing gap to let the background bleed through, creating a "natural" divider.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers.
*   **Base:** `surface` (#131313) is the "floor" of the stadium.
*   **Secondary Zones:** `surface-container-low` (#1C1B1B) for sidebar or navigation regions.
*   **Active Modules:** `surface-container` (#201F1F) for the main data cards.
*   **Interactive Overlays:** `surface-bright` (#393939) for hover states or active selections.

### Signature Textures: The Golden Ratio
To provide "visual soul," use a subtle linear gradient on primary action buttons or "Golden Moment" stats:
*   **CTA Gradient:** `from-tertiary (gold) to-tertiary-container (burnished gold)`.
*   **The Pitch Glow:** Use a radial gradient of `primary-container` (#00412B) at 15% opacity in the background of hero sections to mimic stadium floodlights hitting the grass.

---

## 3. Typography: Broadcast Precision
We pair the utilitarian clarity of **Inter** with the aggressive, condensed personality of **Space Grotesk** to mimic sports broadcast overlays.

*   **Display & Headlines (Space Grotesk):** These should be used for scores, player names, and "big data" moments. Use `headline-lg` for section headers to evoke the feel of a stadium scoreboard.
*   **Body & Labels (Inter):** All tactical data, player stats, and descriptions use Inter. The `label-md` and `label-sm` tokens are critical here; in a data-heavy manager, these must remain legible at small sizes.
*   **Hierarchy Tip:** Use `tracking-tighter` on Space Grotesk headers to enhance the "broadcast" feel, contrasted against `tracking-normal` for Inter body text to ensure maximum data readability.

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are too "web-standard." We use **Ambient Depth**.

*   **The Layering Principle:** Depth is achieved by stacking. A player profile card (`surface-container-highest`) sitting atop a team roster list (`surface-container-low`) creates a natural lift.
*   **The Ghost Border Fallback:** If accessibility requires a border (e.g., in high-contrast modes), use `outline-variant` (#424843) at **15% opacity**. It should feel like a suggestion of an edge, not a hard stop.
*   **Glassmorphism:** For mobile navigation bars or floating "Quick-Tactics" menus, use:
    *   `bg-surface/80`
    *   `backdrop-blur-xl`
    *   This keeps the "Pitch Green" visible beneath the UI, maintaining immersion.

---

## 5. Components: Modular Tactical Units

### Tactical Cards (The Modern Modular)
Cards are the "cells" of this system. 
*   **Style:** No borders. Use `rounded-md` (0.375rem) for a sharp, professional look. 
*   **Padding:** Use `spacing-4` (0.9rem) for standard cards; `spacing-2` for dense data-miniatures.
*   **Separation:** Instead of divider lines between card sections, use a background shift to `surface-container-lowest`.

### Data-Heavy Tables (The Manager’s Grid)
*   **Header:** `bg-surface-container-high` with `text-tertiary` (gold) labels in `label-sm`.
*   **Rows:** Alternating rows are forbidden. Use a `1px` transparent gap between rows to let the `surface-dim` background act as a "ghost divider."
*   **Hover State:** Rows should transition to `bg-primary-container/20` on hover, highlighting the active tactical line.

### Buttons (The Match-Day Action)
*   **Primary:** `bg-primary` (#95D4B3) with `text-on-primary` (#003824). High contrast, high visibility.
*   **Secondary (The Stadium Button):** `bg-secondary-container` (#494949). Blends into the "Stadium Grey" until needed.
*   **Tertiary (The Trophy Action):** `text-tertiary` (#E9C349) with no background. Reserved for league-winning actions or "Pro" features.

### Match-Status Chips
*   Used for player positions (GK, DEF, MID, STR). 
*   **Style:** `rounded-sm`, `bg-surface-bright`, `text-on-surface`. Use a 2px left-border of `primary` (green) or `error` (red) to indicate fitness/status without coloring the whole chip.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** embrace "Density." Football managers need data. Use the `spacing-1` and `spacing-2` tokens to keep information compact but organized via clear typography scales.
*   **Do** use `tertiary` (Gold) sparingly. It is a reward color. Use it for "Top Scorer" icons, "League Leader" highlights, or "Promotion" buttons.
*   **Do** use asymmetric layouts. A large tactical pitch on the left (2/3 width) balanced by a dense list of stats on the right (1/3 width) creates a pro-tier feel.

### Don’t:
*   **Don’t** use pure white (#FFFFFF). All "white" text should be `on-surface` (#E5E2E1) to reduce eye strain during long "scouting" sessions.
*   **Don’t** use `rounded-full` for buttons unless they are circular icon buttons. We want the UI to feel structured and "architectural," not "bubbly."
*   **Don’t** use standard `border-b` dividers in lists. Use `margin-bottom` and background color differentiation to define the end of an item.