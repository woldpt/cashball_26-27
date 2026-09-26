/**
 * Camadas decorativas fixas do fundo: os mesmos brilhos ténues do jogo
 * (primary/tertiary sobre o fundo escuro) mais a linha de meio-campo em giz.
 * Puramente visual — `pointer-events-none` e `aria-hidden` para não
 * interferir com conteúdo nem leitores de ecrã.
 *
 * @returns {JSX.Element}
 */
const LandingBackground = () => (
	<div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
		{/* Linha de meio-campo + círculo central em giz */}
		<div className="absolute inset-y-[-10%] left-1/2 w-px bg-on-surface/[0.04]" />
		<div className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-on-surface/[0.04]" />
		<div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-on-surface/[0.06]" />
		{/* Brilhos do jogo: contentor primário em cima, terciário num canto */}
		<div
			className="absolute inset-0"
			style={{
				background: `
					radial-gradient(45% 35% at 50% 0%, color-mix(in srgb, var(--color-primary-container) 55%, transparent), transparent 72%),
					radial-gradient(38% 28% at 100% 100%, color-mix(in srgb, var(--color-tertiary-container) 22%, transparent), transparent 70%)
				`,
			}}
		/>
		{/* Vignette */}
		<div className="absolute inset-0 bg-gradient-to-b from-bg/60 via-transparent to-bg/80" />
	</div>
);

export default LandingBackground;
