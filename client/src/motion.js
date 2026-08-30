// ─────────────────────────────────────────────────────────────────────────────
// Tokens de movimento partilhados (framer-motion).
//
// Regras do jogo:
//   - Durações curtas (150–280ms): o jogo nunca deve bloquear input.
//   - Apenas transform/opacity (composição GPU) — nunca layout.
//   - prefers-reduced-motion é respeitado globalmente via
//     <MotionConfig reducedMotion="user"> no main.jsx.
// ─────────────────────────────────────────────────────────────────────────────

export const EASE = [0.25, 0.46, 0.45, 0.94];

export const DUR = {
	fast: 0.15,
	base: 0.22,
	slow: 0.28,
};

export const SPRING = {
	card: { type: "spring", stiffness: 340, damping: 28 },
	panel: { type: "spring", stiffness: 380, damping: 34 },
	indicator: { type: "spring", stiffness: 500, damping: 35 },
};

/** Fade + slide vertical — conteúdo de tabs, transições de ecrã. */
export const fadeSlide = {
	initial: { opacity: 0, y: 14 },
	animate: { opacity: 1, y: 0 },
	exit: { opacity: 0, y: -8 },
	transition: { duration: DUR.base, ease: EASE },
};

/** Fade simples — overlays, backdrops, crossfades de ecrã. */
export const fade = {
	initial: { opacity: 0 },
	animate: { opacity: 1 },
	exit: { opacity: 0 },
	transition: { duration: DUR.fast, ease: "easeOut" },
};

/** Painel lateral (chat) — desliza da direita. */
export const panelRight = {
	initial: { opacity: 0, x: 40 },
	animate: { opacity: 1, x: 0 },
	exit: { opacity: 0, x: 40 },
	transition: SPRING.panel,
};

/** Folha inferior (flyups mobile) — sobe com spring. */
export const sheetUp = {
	initial: { opacity: 0, y: 24 },
	animate: { opacity: 1, y: 0 },
	exit: { opacity: 0, y: 24 },
	transition: SPRING.panel,
};

/** Takeover de ecrã inteiro (MatchPage). */
export const takeover = {
	initial: { opacity: 0, y: 24 },
	animate: { opacity: 1, y: 0 },
	exit: { opacity: 0, y: 24 },
	transition: { duration: DUR.slow, ease: EASE },
};

/**
 * Delay de stagger com teto: evita que listas longas demorem a montar.
 * Itens além do `cap` aparecem todos no mesmo instante (último delay).
 */
export const staggerDelay = (index, step = 0.03, cap = 20) =>
	Math.min(index, cap) * step;

/** Props de stagger para itens de lista (fade + y). */
export const staggerItemProps = (index, step = 0.03, cap = 20) => ({
	initial: { opacity: 0, y: 8 },
	animate: { opacity: 1, y: 0 },
	transition: { duration: DUR.base, ease: EASE, delay: staggerDelay(index, step, cap) },
});

/** Props de stagger apenas com opacity (linhas de tabela — transform em <tr> é inseguro). */
export const staggerFadeProps = (index, step = 0.025, cap = 15) => ({
	initial: { opacity: 0 },
	animate: { opacity: 1 },
	transition: { duration: DUR.base, ease: "easeOut", delay: staggerDelay(index, step, cap) },
});
