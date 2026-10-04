import { useEffect, useState } from "react";

/** Margem (px) do anel de destaque à volta do alvo. */
export const SPOTLIGHT_PAD = 6;
/** Diferença (px) tolerada entre frames para o rect estar "assente". */
const STABLE_PX = 1;
/** Frames iguais seguidos antes de publicar o rect (evita o salto inicial). */
const STABLE_FRAMES = 2;
/**
 * Janela de re-medição por frame depois de navegar. Tem de cobrir a saída da
 * tab antiga (~0,22s), a montagem da nova e o spring do fly-up (~0,4s) — o
 * alvo continua a mexer-se depois do primeiro frame em que existe.
 */
const POLL_MS = 800;
/** Teto do polling enquanto o alvo ainda não existe (tab lenta a montar). */
const POLL_WAIT_MS = 3000;
/** Teto do polling com alvo: nunca fica preso num alvo sempre a mexer. */
const POLL_MAX_MS = 4000;
/** Frames seguidos sem mexer para o alvo estar dado como assente. */
const SETTLED_FRAMES = 3;

/** Tamanho do viewport (muda com a barra do browser no telemóvel). */
const viewportSize = () => ({
	w: window.innerWidth,
	h: window.innerHeight,
});

/**
 * @typedef {Object} TargetRect
 * @property {number} x Posição X no viewport.
 * @property {number} y Posição Y no viewport.
 * @property {number} w Largura.
 * @property {number} h Altura.
 */

/**
 * Igualdade de rects com a tolerância de estabilidade.
 * @param {TargetRect|null} a
 * @param {TargetRect|null} b
 * @returns {boolean}
 */
function sameRect(a, b) {
	if (!a || !b) return a === b;
	return (
		Math.abs(a.x - b.x) <= STABLE_PX &&
		Math.abs(a.y - b.y) <= STABLE_PX &&
		Math.abs(a.w - b.w) <= STABLE_PX &&
		Math.abs(a.h - b.h) <= STABLE_PX
	);
}

/**
 * Primeiro alvo RENDERIZADO e dentro do viewport; se nenhum estiver visível,
 * o primeiro renderizado (fica abaixo da dobra — quem chama traz para o ecrã).
 * `player-skills` existe uma vez por linha e `tactic-play` no botão e no FAB:
 * a ordem dos seletores é a preferência (desktop → mobile), a visibilidade
 * decide a instância.
 * @param {Array<string>} selectors Seletores `data-tour`, por ordem de preferência.
 * @returns {Element|null}
 */
function findTarget(selectors) {
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	let fallback = null;
	for (const sel of selectors) {
		for (const el of document.querySelectorAll(sel)) {
			const r = el.getBoundingClientRect();
			if (r.width === 0 || r.height === 0) continue; // display:none
			if (r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw) return el;
			if (!fallback) fallback = el;
		}
	}
	return fallback;
}

/**
 * Rect do alvo do passo, sempre assente e colado ao viewport.
 * Mede por frame na primeira ~0,8s (o alvo monta e anima depois de navegar),
 * em `instant` no scroll, e mantém-se preso a `ResizeObserver`, `scroll`,
 * `resize` e `visualViewport`. Alvo sem rect (desmontado) devolve `null`.
 * @param {{targets?: Array<string>}|null} step Passo do tutorial atual.
 * @returns {{rect: TargetRect|null, viewport: {w: number, h: number}}}
 */
export function useTargetRect(step) {
	/** Rect publicado + passo a que pertence (nunca o rect de outro passo). */
	const [published, setPublished] = useState(() => ({ step, rect: null }));
	const [viewport, setViewport] = useState(viewportSize);

	useEffect(() => {
		const selectors = step?.targets ?? [];
		if (selectors.length === 0) return undefined; // passo final: balão centrado
		/** @type {Element|null} */
		let el = null;
		/** @type {Element|null} */
		let scrolled = null;
		let observed = null;
		let raf = 0;
		const startedAt = performance.now();
		/** @type {TargetRect|null} */
		let prev = null;
		let stable = 0;

		/** Mede e publica (só quando o rect se repete em `STABLE_FRAMES`). */
		const measure = () => {
			if (!el || !el.isConnected) el = findTarget(selectors);
			if (el !== observed) {
				if (observed) ro.unobserve(observed);
				observed = el;
				if (el) ro.observe(el);
			}
			if (!el) {
				prev = null;
				stable = 0;
				setPublished((cur) =>
					cur.step === step && cur.rect === null ? cur : { step, rect: null },
				);
				return;
			}
			// Trazer o alvo ao ecrã UMA vez, sem animação: com `smooth` o rect
			// medido no frame seguinte ainda é o de partida, e repetir a chamada a
			// cada scroll puxava o ecrã de volta (o tour briga com o dedo).
			if (el !== scrolled) {
				scrolled = el;
				el.scrollIntoView({ block: "nearest", behavior: "instant" });
			}
			const r = el.getBoundingClientRect();
			/** @type {TargetRect} */
			const next = { x: r.x, y: r.y, w: r.width, h: r.height };
			stable = sameRect(prev, next) ? stable + 1 : 0;
			prev = next;
			if (stable >= STABLE_FRAMES)
				setPublished((cur) =>
					cur.step === step && sameRect(cur.rect, next)
						? cur
						: { step, rect: next },
				);
		};

		const frame = () => {
			measure();
			const elapsed = performance.now() - startedAt;
			// Continua sempre a janela das animações e, depois dela, só enquanto o
			// alvo não assentar — um spring lento demora mais do que o primeiro
			// frame estável e o anel ficaria a meio caminho.
			const waiting = el
				? elapsed < POLL_MS || stable < SETTLED_FRAMES
				: elapsed < POLL_WAIT_MS;
			if (waiting && elapsed < POLL_MAX_MS) raf = requestAnimationFrame(frame);
		};

		const ro = new ResizeObserver(measure);
		const onViewportChange = () => {
			setViewport(viewportSize());
			measure();
		};

		raf = requestAnimationFrame(frame);
		window.addEventListener("resize", onViewportChange);
		window.addEventListener("scroll", measure, true);
		window.visualViewport?.addEventListener("resize", onViewportChange);
		window.visualViewport?.addEventListener("scroll", measure);
		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
			window.removeEventListener("resize", onViewportChange);
			window.removeEventListener("scroll", measure, true);
			window.visualViewport?.removeEventListener("resize", onViewportChange);
			window.visualViewport?.removeEventListener("scroll", measure);
		};
	}, [step]);

	return {
		rect: published.step === step ? published.rect : null,
		viewport,
	};
}
