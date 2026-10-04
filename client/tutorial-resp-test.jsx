/* eslint-disable react-refresh/only-export-components -- harness de teste sem exports */
// Harness do tutorial do adjunto (`CoachTutorial`). Rende o overlay REAL sobre
// um stub do shell (header, rail desktop, fly-up mobile, painéis das tabs,
// FAB) e percorre os 11 passos medindo, em cada um:
//   1. alinhamento do anel de destaque com o alvo do passo (centro a centro);
//   2. balão sem tapar o centro do destaque;
//   3. anel dentro do viewport (clamp).
//
// O stub imita o que desalinhava o anel na app: a tab nova só monta 250ms
// depois de navegar (AnimatePresence mode="wait") e o fly-up entra com o
// spring do `sheetUp` — o alvo mexe-se DEPOIS do primeiro frame em que existe.
// Contract (read by client/scripts/mobileRespCheck.mjs):
//   - render into #root
//   - after ~2500 ms write "REPORT:<json>" into <pre id="report"> and set
//     data-status="done"
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { AnimatePresence, motion } from "framer-motion";
import "./src/index.css";
import { sheetUp } from "./src/motion.js";
import { CoachTutorial } from "./src/components/tutorial/CoachTutorial.jsx";
import { COACH_TUTORIAL_STEPS } from "./src/components/tutorial/coachTutorialSteps.js";
import { SPOTLIGHT_PAD } from "./src/hooks/useTargetRect.js";

/** Promise que resolve no próximo frame de animação. */
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
/** Tolerância (px) do alinhamento anel↔alvo. */
const TOL = 2;
/** Frames seguidos sem nada a mexer-se para o ecrã estar dado como assente. */
const IDLE_FRAMES = 5;

/** Caixa do stub; `tour` marca o alvo (`data-tour`, como na app). */
function Box({ tour, className = "", children }) {
  return (
    <div
      data-tour={tour}
      className={`rounded-xl bg-surface-container border border-outline-variant/30 ${className}`}
    >
      {children}
    </div>
  );
}

/** Alvos reais do passo, por tab. Alturas plausíveis (painel, linha, 11). */
function StubContent({ tab }) {
  if (tab === "club")
    return (
      <>
        <Box className="h-[220px]" />
        <Box className="h-[220px] mt-3" />
        {/* 20px abaixo da dobra: obriga a `scrollIntoView` antes de medir. */}
        <Box tour="club-staff" className="h-[320px] mt-3" />
      </>
    );
  if (tab === "players")
    return (
      <>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Box key={i} tour="player-skills" className="h-[52px] mt-2" />
        ))}
      </>
    );
  if (tab === "tactic")
    return (
      <>
        <Box tour="tactic-titulares" className="h-[420px]" />
        <Box tour="tactic-lineup" className="h-[180px] mt-3" />
        <Box
          tour="tactic-play"
          className="hidden xl:block h-[56px] mt-3 w-72"
        />
      </>
    );
  return (
    <>
      <Box className="h-[180px]" />
      <Box className="h-[220px] mt-3" />
    </>
  );
}

/** Rail de navegação desktop (lg+) — alvos `nav-*`. */
function StubRail() {
  return (
    <div className="hidden lg:flex fixed left-0 top-16 bottom-0 w-16 flex-col items-center gap-1 py-2 bg-surface-container-high/95">
      {["club", "players", "training", "finances", "market", "jornal"].map(
        (key) => (
          <div
            key={key}
            data-tour={`nav-${key}`}
            className="h-16 w-full flex items-center justify-center text-[10px] uppercase"
          >
            {key}
          </div>
        ),
      )}
    </div>
  );
}

/** Barra inferior mobile (<lg): jornal + grupos + FAB de jogar. */
function StubBottomNav() {
  return (
    <>
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-container-high/95 z-40 flex items-stretch">
        <div
          data-tour="nav-jornal-mobile"
          className="flex-1 flex items-center justify-center text-[10px]"
        >
          Jornal
        </div>
        <div
          data-tour="nav-gestao"
          className="flex-1 flex items-center justify-center text-[10px]"
        >
          Gestão
        </div>
        <div
          data-tour="nav-transferencias"
          className="flex-1 flex items-center justify-center text-[10px]"
        >
          Transfer.
        </div>
      </div>
      {/* Rodapé Notícias CM (`bottom-16 h-8`), como na app. */}
      <div className="lg:hidden fixed bottom-16 left-0 right-0 h-8 bg-black/80 z-30" />
      <button
        data-tour="tactic-play-fab"
        className="xl:hidden fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full bg-green-500"
      />
    </>
  );
}

/** Fly-up do menu mobile (entra com `sheetUp`, como na app). */
function StubFlyUp({ group }) {
  const keys =
    group === "transferencias" ? ["market", "leiloes"] : ["club", "players", "training", "finances"];
  return (
    <div className="lg:hidden fixed bottom-16 left-0 right-0 z-39 px-3">
      <div className="flex bg-surface-container-high border border-outline-variant/30 rounded-xl overflow-hidden">
        {keys.map((key) => (
          <div
            key={key}
            data-tour={`nav-${key}-sub`}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-4 text-[10px] uppercase"
          >
            <span className="text-[24px] leading-none">•</span>
            {key}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Shell do stub: tabs só montam depois de navegar; fly-up abre com o passo. */
function StubShell({ step }) {
  const [tab, setTab] = useState(step?.tab ?? "club");
  const [group, setGroup] = useState(step?.submenu ?? null);
  useEffect(() => {
    // Saída da tab antiga (~220ms) antes de a nova montar, e o fly-up abre
    // por `setMobileSubMenu` — como no `handleTutorialNavigate`.
    const id = setTimeout(() => {
      setTab(step?.tab ?? "club");
      setGroup(step?.submenu ?? null);
    }, 250);
    return () => clearTimeout(id);
  }, [step]);

  return (
    <div className="h-dvh overflow-hidden bg-surface text-on-surface">
      <header className="fixed top-0 left-0 right-0 h-16 bg-surface-container-high z-40" />
      <StubRail />
      <main className="h-full pt-16 pb-24 lg:pl-16">
        <div className="h-full overflow-y-auto p-4 lg:p-6">
          <StubContent tab={tab} />
        </div>
      </main>
      <StubBottomNav />
      <AnimatePresence initial={false}>
        {group && (
          <motion.div
            key="flyup"
            initial={sheetUp.initial}
            animate={sheetUp.animate}
            exit={sheetUp.exit}
            transition={sheetUp.transition}
          >
            <StubFlyUp group={group} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Anel de destaque (com ou sem `data-tour`, antes/depois da correcção). */
function findRing() {
  return (
    document.querySelector('[data-tour="tutorial-ring"]') ||
    document.querySelector('[data-tour="tutorial-overlay"] .border-primary')
  );
}

/**
 * Assinatura dos rects do passo (anel + alvos): muda enquanto algo anima.
 * @param {number} index Índice do passo.
 * @returns {string}
 */
function signature(index) {
  const parts = [];
  const ring = findRing();
  const r = ring?.getBoundingClientRect();
  parts.push(r ? [r.left, r.top, r.width, r.height].map(Math.round).join(",") : "-");
  for (const sel of COACH_TUTORIAL_STEPS[index].targets) {
    for (const el of document.querySelectorAll(sel)) {
      const t = el.getBoundingClientRect();
      if (t.width === 0 || t.height === 0) continue;
      parts.push([t.left, t.top, t.width, t.height].map(Math.round).join(","));
    }
  }
  return parts.join("|");
}

/** Nº do passo que a UI está a mostrar (o balão traz «passo N de 11»). */
function shownStep() {
  const label = document
    .querySelector('[data-tour="tutorial-balloon"]')
    ?.getAttribute("aria-label");
  return Number((label?.match(/passo (\d+)/) || [])[1]);
}

/**
 * Espera que o ecrã assente antes de medir, contando FRAMES (não relógio): a
 * tab nova só monta aos 250ms e o fly-up entra com spring — com a máquina
 * carregada o browser larga frames e uma espera em ms media a meio da
 * animação (falha de medição, não de posicionamento). Mede quando a UI já
 * mostra o passo pedido e nada (anel nem alvos) mexeu em 5 frames seguidos.
 * @param {number} index Índice do passo.
 * @param {number} [capMs] Teto da espera (ms) antes de medir à mesma.
 * @returns {Promise<void>}
 */
async function settleRing(index, capMs = 4000) {
  const t0 = Date.now();
  let last = null;
  let same = 0;
  const semAlvo = COACH_TUTORIAL_STEPS[index].targets.length === 0;
  while (Date.now() - t0 < capMs) {
    await nextFrame();
    const cur = signature(index);
    same = cur === last ? same + 1 : 0;
    last = cur;
    if (
      same >= IDLE_FRAMES - 1 &&
      shownStep() === index + 1 &&
      (semAlvo || findRing())
    )
      return;
  }
}

/** Centro de um rect. */
const centre = (r) => [r.left + r.width / 2, r.top + r.height / 2];

/** Caixa esperada do anel: alvo + margem, clampada ao viewport. */
function expectedBox(t) {
  const left = Math.max(0, t.left - SPOTLIGHT_PAD);
  const top = Math.max(0, t.top - SPOTLIGHT_PAD);
  const right = Math.min(window.innerWidth, t.right + SPOTLIGHT_PAD);
  const bottom = Math.min(window.innerHeight, t.bottom + SPOTLIGHT_PAD);
  return {
    left,
    top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

/** Distância entre centros. */
function gap(a, b) {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
}

/** Mede um passo: anel↔alvo, balão↔destaque, clamp ao viewport. */
function checkStep(index) {
  const step = COACH_TUTORIAL_STEPS[index];
  const ring = findRing();
  const balloon = document.querySelector('[data-tour="tutorial-balloon"]');
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const out = { step: index, id: step.id, fail: [] };
  if (step.targets.length === 0) {
    if (ring) {
      const rr = ring.getBoundingClientRect();
      out.ring = { x: Math.round(rr.left), y: Math.round(rr.top), w: Math.round(rr.width), h: Math.round(rr.height) };
      out.fail.push(`anel inesperado no passo sem alvo (${JSON.stringify(out.ring)})`);
    }
    return out;
  }
  if (!ring) {
    out.fail.push("sem anel de destaque");
    return out;
  }
  const r = ring.getBoundingClientRect();
  const rc = centre(r);
  out.ring = { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
  let delta = Infinity;
  for (const sel of step.targets) {
    for (const el of document.querySelectorAll(sel)) {
      const t = el.getBoundingClientRect();
      if (t.width === 0 || t.height === 0) continue;
      delta = Math.min(delta, gap(rc, centre(expectedBox(t))));
    }
  }
  out.delta = Number.isFinite(delta) ? Math.round(delta * 10) / 10 : null;
  if (delta > TOL) out.fail.push(`anel desalinhado do alvo (${out.delta}px)`);
  if (r.left < -0.5 || r.top < -0.5 || r.right > vw + 0.5 || r.bottom > vh + 0.5)
    out.fail.push("anel fora do viewport (sem clamp)");
  if (balloon) {
    const b = balloon.getBoundingClientRect();
    out.balloonCovers = rc[1] > b.top && rc[1] < b.bottom && rc[0] > b.left && rc[0] < b.right;
    if (out.balloonCovers) out.fail.push("balão por cima do destaque");
    if (b.left < -0.5 || b.top < -0.5 || b.right > vw + 0.5 || b.bottom > vh + 0.5)
      out.fail.push("balão fora do viewport");
  }
  return out;
}

function Harness() {
  const [index, setIndex] = useState(0);
  const steps = useRef([]);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let alive = true;
    (async () => {
      const sweep = async (order) => {
        for (const i of order) {
          if (!alive) return;
          setIndex(i);
          await settleRing(i);
          steps.current.push(checkStep(i));
        }
      };
      // Ida (Seguinte) e volta (Voltar) — o anel não pode saltar em nenhum sentido.
      await sweep(COACH_TUTORIAL_STEPS.map((_, i) => i));
      await sweep([10, 9, 8, 7]);

      const failed = steps.current.filter((s) => s.fail.length > 0);
      const worst = failed[0] ?? steps.current[0];
      // Fica no pior passo: é o que a captura de ecrã mostra. `?step=N` na URL
      // prende o ecrã num passo concreto, para revisão visual.
      const focus = Number(new URLSearchParams(window.location.search).get("step"));
      const landing =
        Number.isInteger(focus) && focus >= 0 && focus < COACH_TUTORIAL_STEPS.length
          ? focus
          : (worst?.step ?? 0);
      setIndex(landing);
      await settleRing(landing);

      const vw = window.innerWidth;
      const doc = document.documentElement;
      const clippingElements = [...document.querySelectorAll("*")]
        .filter((el) => {
          if (el.classList?.contains?.("truncate")) return false;
          const ov = getComputedStyle(el).overflowX;
          return (ov === "hidden" || ov === "auto") && el.scrollWidth > el.clientWidth + 1;
        })
        .map((el) => ({
          cls: (el.className && el.className.toString().slice(0, 80)) || el.tagName,
          scrollW: el.scrollWidth,
          clientW: el.clientWidth,
        }))
        .sort((a, b) => b.scrollW - b.clientW - (a.scrollW - a.clientW))
        .slice(0, 10);
      const report = {
        viewport: vw,
        pageOverflowPx: doc.scrollWidth - vw,
        clippedRows: [],
        clippingElements,
        measured: steps.current.length,
        steps: steps.current,
        worst: worst?.id ?? null,
        verdict: failed.length === 0 && doc.scrollWidth - vw <= 0 ? "PASS" : "FAIL",
      };
      const el = document.getElementById("report");
      el.setAttribute("data-status", "done");
      el.textContent = "REPORT:" + JSON.stringify(report, null, 2);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const step = COACH_TUTORIAL_STEPS[index];
  return (
    <>
      <StubShell step={step} />
      <CoachTutorial
        stepIndex={index}
        onNavigate={() => {}}
        onNext={() => setIndex((i) => Math.min(COACH_TUTORIAL_STEPS.length - 1, i + 1))}
        onBack={() => setIndex((i) => Math.max(0, i - 1))}
        onSkip={() => {}}
      />
    </>
  );
}

createRoot(document.getElementById("root")).render(<Harness />);
