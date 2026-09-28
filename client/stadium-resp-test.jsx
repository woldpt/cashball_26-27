// StadiumIllustration mobile responsiveness harness — renders the REAL
// StadiumIllustration across the capacity tiers (incl. extreme team colors)
// and self-reports overflow measurements into #report.
// NOT part of the app; used only for verification.
//
// Contract (read by client/scripts/mobileRespCheck.mjs):
//   - render into #root
//   - after ~2500 ms write "REPORT:<json>" into <pre id="report"> and set
//     data-status="done"
//   - json must include: viewport, pageOverflowPx, clippedRows,
//     clippingElements, verdict ("PASS" | "FAIL")
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { StadiumIllustration } from "./src/components/shared/StadiumIllustration.jsx";

// ── Fixture data: os escalões de lotação + cores extremas ───────────────────
// (4k pelado ≤5k · 8k pequeno com luz · 20k/40k intermédios · 100k colossal)
const cases = [
  { capacity: 4000, primary: "#166534", secondary: "#f8fafc", label: "4k (pelado)" },
  { capacity: 8000, primary: "#111827", secondary: "#f8fafc", label: "8k (equipa escura)" },
  { capacity: 20000, primary: "#f8fafc", secondary: "#111827", label: "20k (mood baixo)", mood: 10 },
  { capacity: 40000, primary: "#e11d48", secondary: "#fbbf24", label: "40k (mood alto)", mood: 44 },
  { capacity: 100000, primary: "#2563eb", secondary: "#0f172a", label: "100k (colossal)" },
];

// ── Contentores reais (as classes que as views usam de facto) ─────────────
// O `slice` só cropa o topo em contentores BAIXOS e LARGOS: o bloco antigo
// (h-32 sm:h-56, aspeto 2.6–3.4) nunca cropava e por isso o telão em falta
// nos cards reais passou despercebido. Aqui reproduz-se o ClubTab (h-24 → 3.4,
// short:h-16 → 6.3) e o hero do StadiumTab (h-28 → 3.2, short:h-20 → 14).
const cards = [
  { cls: "h-24 sm:h-28 short:h-16", label: "ClubTab h-24", cap: 100000, mood: null },
  { cls: "h-24 sm:h-28 short:h-16", label: "ClubTab h-24 · faroeste", cap: 100000, mood: 12 },
  { cls: "h-24 sm:h-28 short:h-16", label: "ClubTab h-24 · 22k", cap: 22000, mood: null },
  { cls: "h-28 sm:h-40 lg:h-44 short:h-20", label: "StadiumTab h-28", cap: 100000, mood: 44 },
  { cls: "h-28 sm:h-40 lg:h-44 short:h-20", label: "StadiumTab h-28 · 50k", cap: 50000, mood: null },
];

const root = createRoot(document.getElementById("root"));
root.render(
  <div className="min-h-screen bg-surface">
    {/* Contentores reais — ClubTab é `grid-cols-1 md:grid-cols-3` */}
    <div className="p-4 lg:p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-md border border-outline-variant/25 overflow-hidden flex flex-col bg-surface-container"
        >
          <div className={`${c.cls} relative flex items-end overflow-hidden`}>
            <StadiumIllustration
              capacity={c.cap}
              primary="#e11d48"
              secondary="#fde68a"
              mood={c.mood ?? null}
              className="absolute inset-0 h-full w-full"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            <div className="relative px-4 pb-3 w-full">
              <p className="text-white text-sm font-black drop-shadow">{c.label}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
    {/* Bloco antigo: h-32 sm:h-56 (aspeto 2.6–3.4) */}
    <div className="p-4 lg:p-6 space-y-4">
      {cases.map((c) => (
        <div
          key={c.label}
          className="rounded-lg border border-outline-variant/25 overflow-hidden relative bg-surface-container"
        >
          <div className="h-32 sm:h-56 relative flex items-end overflow-hidden">
            <StadiumIllustration
              capacity={c.capacity}
              primary={c.primary}
              secondary={c.secondary}
              mood={c.mood ?? null}
              className="absolute inset-0 h-full w-full"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
            <div className="relative px-5 pb-4 w-full">
              <p className="text-white text-sm font-black uppercase tracking-widest drop-shadow">{c.label}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>,
);

function measure() {
  const vw = window.innerWidth;
  const doc = document.documentElement;
  const pageOverflow = doc.scrollWidth - vw;

  // Rows/cards with overflow-hidden (content clipping risk)
  const rows = [...document.querySelectorAll("div.flex.overflow-hidden")];
  const clippedRows = rows
    .filter((el) => el.scrollWidth > el.clientWidth + 1)
    .map((el) => ({
      name:
        el.querySelector("p.uppercase")?.textContent ||
        el.className.toString().slice(0, 60),
      scrollW: el.scrollWidth,
      clientW: el.clientWidth,
    }));

  // Any hidden/auto-overflow element clipping content (top 10 by excess)
  const all = [...document.querySelectorAll("*")].filter((el) => {
    const ov = getComputedStyle(el).overflowX;
    return (
      (ov === "hidden" || ov === "auto") && el.scrollWidth > el.clientWidth + 1
    );
  });
  const clippingElements = all
    .map((el) => ({
      cls: (el.className && el.className.toString().slice(0, 80)) || el.tagName,
      scrollW: el.scrollWidth,
      clientW: el.clientWidth,
      excess: el.scrollWidth - el.clientWidth,
    }))
    .sort((a, b) => b.excess - a.excess)
    .slice(0, 10);

  return {
    viewport: vw,
    pageOverflowPx: pageOverflow,
    clippedRows,
    clippingElements,
    verdict: pageOverflow <= 0 && clippedRows.length === 0 ? "PASS" : "FAIL",
  };
}

setTimeout(() => {
  const report = measure();
  const el = document.getElementById("report");
  el.setAttribute("data-status", "done");
  el.textContent = "REPORT:" + JSON.stringify(report, null, 2);
}, 2500);
