/* eslint-disable react-refresh/only-export-components -- harness de teste sem exports */
// Harness do treinador-adjunto: rende a vista pura sobre o shell real
// (header, bottom-nav h-16, rodapé Notícias CM h-8) e reporta overflow e
// COLISÕES do balão com o chrome mobile. NOT part of the app.
//
// Duas passagens, como na app:
//   A — menu fechado: o balão não pode tapar a faixa do rodapé CM.
//   B — fly-up aberto: o balão cala-se (`menuOpen`) e a última linha do
//       menu tem de continuar clicável (era o bug: o balão, com z maior,
//       ficava por cima do fly-up e roubava-lhe os toques).
//
// A dica medida é o PIOR CASO do catálogo real (`assistantTips.js`): texto
// mais longo + CTA mais longa. Um fixture à mão já ficou desactualizado uma
// vez — o PASS passou a medir um balão mais pequeno do que a produção.
//
// Contract (read by client/scripts/mobileRespCheck.mjs):
//   - render into #root
//   - after ~2500 ms write "REPORT:<json>" into <pre id="report"> and set
//     data-status="done"
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./src/index.css";
// Módulo puro de propósito: importar `AssistantCoach.jsx` puxava o hook →
// `socket.js` e o harness abria (e falhava) uma ligação socket.io por run.
import { AssistantCoachView } from "./src/components/shared/AssistantCoachView.jsx";
import {
  ASSISTANT_TIP_IDS,
  buildAssistantTips,
} from "./src/utils/assistantTips.js";

const squad = (n, extra = {}) =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    form: 32,
    resistance: 26,
    ...extra,
  }));

// Estado em que TODAS as 7 dicas disparam (foco em "Resistência": a palavra
// mais longa do catálogo, logo o texto do teto também no pior caso). Plantel
// no teto das DUAS escalas — senão a dica do teto não acende e a medição
// deixa de ser o pior caso (é o `catalogueComplete` a travar isso).
const worstCaseState = {
  squad: [
    ...squad(7, { form: 50, resistance: 50 }),
    ...squad(3, { form: 44, injury_until_matchweek: 9 }),
  ],
  matchweek: 3,
  hasRedFlag: true,
  hasTraining: false,
  focusName: "Resistência",
  fansMood: 10,
  currentBudget: 1000,
  totalWeeklyWage: 200000,
  isLineupComplete: false,
  lineupEligible: true,
};

const allTips = buildAssistantTips(worstCaseState);
const longest = (key) =>
  allTips.reduce((a, b) => (b[key].length > a[key].length ? b : a));

// Pior caso tem de trazer o catálogo inteiro: com uma dica por acender a
// medição seria menor do que a produção (foi o que aconteceu ao fixture à mão).
const catalogueComplete = allTips.length === ASSISTANT_TIP_IDS.length;

// Limite superior: maior texto + maior CTA (podem vir de dicas diferentes).
const tip = { ...longest("text"), cta: longest("cta").cta };

/**
 * Quantos pontos do alvo têm o balão por cima (colisão).
 * @param {string} name Nome do alvo no relatório.
 * @param {Element|null} el Alvo (rodapé, linha do fly-up).
 */
function collisionsWith(name, el) {
  const assistant = document.querySelector('[data-tour="assistant-coach"]');
  if (!assistant || !el) return [];
  const r = el.getBoundingClientRect();
  const xs = [r.left + 24, r.left + r.width / 2, r.right - 24];
  const ys = [r.top + r.height / 2, r.bottom - 6];
  let covered = 0;
  let samples = 0;
  for (const y of ys) {
    for (const x of xs) {
      if (y < 0 || y > window.innerHeight || x < 0 || x > window.innerWidth)
        continue;
      samples++;
      const hit = document.elementFromPoint(x, y);
      if (hit && assistant.contains(hit)) covered++;
    }
  }
  return covered > 0 ? [{ target: name, covered, samples }] : [];
}

/**
 * Overflow/clipping/colisões do balão contra um alvo do shell.
 * @param {string} pass "A" (menu fechado) | "B" (fly-up aberto).
 * @param {string} target Nome do alvo a amostrar.
 * @param {string} selector Selector do alvo.
 */
function measure(pass, target, selector) {
  const vw = window.innerWidth;
  const doc = document.documentElement;
  const pageOverflow = doc.scrollWidth - vw;

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
    pass,
    pageOverflowPx: pageOverflow,
    clippingElements,
    collisions: collisionsWith(target, document.querySelector(selector)),
  };
}

/** Junta as duas passagens — qualquer colisão (ou overflow) reprova. */
function merge(a, b) {
  const collisions = [...(a?.collisions || []), ...(b?.collisions || [])];
  const pageOverflowPx = Math.max(a?.pageOverflowPx ?? 0, b?.pageOverflowPx ?? 0);
  const ok =
    pageOverflowPx <= 0 && collisions.length === 0 && catalogueComplete;
  return {
    viewport: window.innerWidth,
    pageOverflowPx,
    clippedRows: [],
    clippingElements: b?.clippingElements || [],
    collisions,
    tips: allTips.map((t) => t.id),
    measure: { id: tip.id, text: tip.text.length, cta: tip.cta },
    passes: [a, b].filter(Boolean),
    verdict: ok ? "PASS" : "FAIL",
  };
}

function Harness() {
  const [menuOpen, setMenuOpen] = useState(false);
  const passA = useRef(null);
  const passB = useRef(null);

  useEffect(() => {
    const t1 = setTimeout(() => {
      passA.current = measure(
        "A",
        "rodape-cm",
        '[data-collision="ticker"]',
      );
      setMenuOpen(true);
    }, 1200);
    const t2 = setTimeout(() => {
      passB.current = measure("B", "flyup-ultima-linha", '[data-collision-row="last"]');
      const el = document.getElementById("report");
      el.setAttribute("data-status", "done");
      el.textContent =
        "REPORT:" + JSON.stringify(merge(passA.current, passB.current), null, 2);
      // Fecha o menu após medir: o screenshot (tirado depois do report) fica
      // no estado normal da app, com o balão visível.
      setMenuOpen(false);
    }, 2100);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div className="h-dvh overflow-hidden bg-surface text-on-surface">
      <div className="p-4 lg:p-6">
        <div className="h-40 rounded-xl bg-surface-container" />
      </div>
      {/* Barra do bottom-nav mobile (h-16), como no GameLayout. */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-container-high/95" />
      {/* Rodapé Notícias CM (`bottom-16 h-8 z-30`), como no CmTicker. */}
      <div
        data-collision="ticker"
        className="lg:hidden fixed bottom-16 left-0 right-0 h-8 z-30 bg-black"
      />
      {/* Fly-up do menu mobile (`bottom-16 z-39`), só enquanto está aberto. */}
      {menuOpen && (
        <div
          data-collision="flyup"
          className="lg:hidden fixed bottom-16 left-0 right-0 z-39 px-3"
        >
          <div className="bg-surface-container-high border border-outline-variant/30 rounded-xl shadow-2xl overflow-hidden">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                data-collision-row={i === 2 ? "last" : String(i)}
                className="flex flex-col items-center justify-center gap-1 py-4 text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[24px] leading-none">
                  group
                </span>
                <span className="text-[11px]">Linha {i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <AssistantCoachView
        tip={tip}
        menuOpen={menuOpen}
        onGo={() => {}}
        onDismiss={() => {}}
      />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Harness />);
