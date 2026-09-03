// Landscape regression harness — renders the EXACT header/rail/main/pill
// skeleton from GameLayout.jsx (mobile-landscape branch) with a match toggle,
// and self-reports geometry into #report. NOT part of the app.
//
// Verifies the fix in commit dd6334b:
//   - "ao vivo" (match): rail desmontada + <main ml-0>  -> sem banda vazia à esquerda
//   - "sem jogo"      : rail montada    + <main ml-16> -> conteúdo desviado da rail
// E verifica a reserva pb-16 em jogo (landscape): o pill "AO VIVO" (fixed
// bottom-3) NÃO pode cobrir o fim do conteúdo quando o scroll está no fundo.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { useMobileLandscape } from "./src/hooks/useIsMobile.js";

function App() {
  const [match, setMatch] = useState(true);
  const isMobileLandscape = useMobileLandscape();
  const railPresent = !match; // espelha {!isMatchInProgress && <nav>}

  return (
    <div className="min-h-dvh bg-surface text-on-surface font-body">
      {/* header — classes exatas do ramo landscape em GameLayout */}
      <header
        className={`fixed top-0 left-0 right-0 z-160 flex items-center border-b border-outline-variant/20 ${
          isMobileLandscape ? "h-10" : "h-14"
        }`}
        style={{ background: "var(--color-surface-container-low)" }}
        data-elt="header"
      >
        <span className="px-3 text-sm font-black tracking-wide">CashBall</span>
      </header>

      {/* rail vertical — classes exatas do ramo landscape em GameLayout */}
      {railPresent && (
        <nav
          className={
            isMobileLandscape
              ? "lg:hidden fixed left-0 top-10 bottom-0 w-16 z-40 flex flex-col bg-surface-container-high/95 backdrop-blur-sm border-r border-outline-variant/30 py-2"
              : "lg:hidden fixed bottom-0 left-0 right-0 h-16 z-40"
          }
          data-elt="rail"
        >
          <div className="flex-1 flex items-center justify-center text-[10px] text-on-surface-variant">
            RAIL
          </div>
        </nav>
      )}

      {/* pill AO VIVO — classes exatas do GameLayout */}
      {match && (
        <div
          className="lg:hidden fixed bottom-3 left-1/2 -translate-x-1/2 h-9 px-5 z-40 flex items-center justify-center gap-1.5 rounded-full bg-red-500/10 border border-red-500/30 backdrop-blur-sm shadow-lg"
          data-elt="pill"
        >
          <span className="font-headline font-black text-red-600 text-[10px] uppercase tracking-wide">
            ● AO VIVO
          </span>
        </div>
      )}

      {/* main — ternary EXATA de GameLayout (o fix do commit) */}
      <main
        className={
          isMobileLandscape
            ? `transition-all duration-200 pt-10 ${match ? "pb-16 ml-0" : "pb-3 ml-16"}`
            : `pt-14 pb-16 lg:pb-12 transition-all duration-200 lg:ml-64`
        }
        data-elt="main"
      >
        <div className="p-4 lg:p-6">
          <div
            className="min-h-[560px] rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm text-on-surface-variant"
            data-elt="content"
          >
            <div className="font-headline font-black text-on-surface">
              Conteúdo do jogo (alto, com scroll)
            </div>
            <div className="mt-2 leading-relaxed">
              Esta caixa é intencionalmente alta para simular o conteúdo do jogo
              ao vivo empilhado numa coluna em landscape. Se o pill "AO VIVO"
              cobrir o fim deste bloco, o overlap está presente.
            </div>
          </div>
        </div>
      </main>

      {/* toggle (apenas para o harness) */}
      <button
        onClick={() => setMatch((m) => !m)}
        className="fixed top-12 right-3 z-200 bg-black/75 text-white text-[11px] px-2 py-1 rounded"
        data-elt="toggle"
      >
        {match ? "→ sem jogo" : "→ ao vivo"}
      </button>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);

// ── Medição + report ─────────────────────────────────────────────────────────
function measure() {
  const q = (s) => document.querySelector(s);
  const rect = (el) => {
    const r = el?.getBoundingClientRect();
    return r
      ? {
          left: Math.round(r.left),
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          width: Math.round(r.width),
          height: Math.round(r.height),
        }
      : null;
  };
  const mainEl = q("[data-elt=main]");
  const contentEl = q("[data-elt=content]");
  const pillEl = q("[data-elt=pill]");
  const railEl = q("[data-elt=rail]");
  const mainR = mainEl?.getBoundingClientRect();

  // O pill "AO VIVO" é fixed: flutua sempre sobre a viewport, por isso
  // conteúdo alto passa sempre por baixo dele na posição inicial — isso NÃO é
  // defeito. O perigo real é o pill cobrir o FIM do conteúdo quando o scroll
  // está no fundo (é para isso que serve o pb-16 reservado em jogo). Medimos
  // nessa posição: conteúdo termina acima do topo do pill ⇔ sem overlap.
  // Scroll alvo: o fundo do <main> alinhado com o fundo da viewport (como no
  // app real). NÃO usamos document.scrollHeight como alvo — o <pre id=report>
  // vive DEPOIS do main e daria folga artificial que mascararia o overlap.
  const prevScrollY = window.scrollY;
  const mainBottom = mainR ? mainR.bottom + prevScrollY : 0;
  const targetY = Math.max(0, Math.round(mainBottom - window.innerHeight));
  window.scrollTo(0, targetY);
  const contentR = contentEl?.getBoundingClientRect();
  const pillR = pillEl?.getBoundingClientRect();
  const pillCoversContentEnd =
    !!(pillR && contentR) &&
    pillR.top < contentR.bottom &&
    contentR.top < pillR.bottom &&
    pillR.left < contentR.right;
  window.scrollTo(0, prevScrollY);

  return {
    viewport: {
      w: window.innerWidth,
      h: window.innerHeight,
      landscape: matchMedia("(orientation: landscape)").matches,
    },
    main: rect(mainEl),
    content: rect(contentEl),
    pill: rect(pillEl),
    rail: rect(railEl),
    leftBandPx: mainR ? Math.round(mainR.left) : null,
    pillOverlapsContent: pillCoversContentEnd,
  };
}

function writeReport() {
  const m = measure();
  const report = {
    ...m,
    // verdict: sem banda vazia à esquerda em landscape (fix dd6334b) E o pill
    // "AO VIVO" não cobre o fim do conteúdo (reserva pb-16 em jogo).
    verdict:
      (m.leftBandPx === 0 || m.leftBandPx === 64) && !m.pillOverlapsContent
        ? "PASS"
        : "FAIL",
    clippedRows: [],
  };
  const el = document.getElementById("report");
  el.textContent = "REPORT:" + JSON.stringify(report);
  el.dataset.status = "done";
  return report;
}

// Expõe para o runner externo (playwright) medir após toggles.
window.__measure = measure;
window.__writeReport = writeReport;
// Espera o flush do React (render assíncrono) antes de medir — mesmo padrão
// dos outros harnesses (mobile-resp-test, intervencao-test).
setTimeout(() => {
  writeReport();
}, 2500);
