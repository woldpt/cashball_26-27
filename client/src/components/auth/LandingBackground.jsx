/**
 * Camadas decorativas fixas do fundo: relvado de noite aparado, linhas de giz do
 * quadro tático, halos de luz e vignette. Puramente visual — `pointer-events-none`
 * e `aria-hidden` para não interferir com conteúdo nem leitores de ecrã.
 *
 * @returns {JSX.Element}
 */
const LandingBackground = () => (
	<div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
		{/* Faixas de relva aparada */}
		<div
			className="absolute inset-0 opacity-60"
			style={{
				background:
					"repeating-linear-gradient(90deg, rgba(74,222,128,0.028) 0 120px, transparent 120px 240px)",
			}}
		/>
		{/* Linha lateral + círculo central em giz */}
		<div aria-hidden="true" className="absolute inset-y-[-10%] left-1/2 w-px bg-white/[0.05]" />
		<div
			aria-hidden="true"
			className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.05]"
		/>
		<div
			aria-hidden="true"
			className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.07]"
		/>
		{/* Grelha de giz do quadro tático */}
		<div
			className="absolute inset-0 opacity-[0.05]"
			style={{
				backgroundImage: `
					linear-gradient(rgba(255,255,255,1) 1px, transparent 1px),
					linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)
				`,
				backgroundSize: "28px 28px",
			}}
		/>
		{/* Glow halos as background gradients: clipped to this layer, no scroll overflow */}
		<div
			className="absolute inset-0"
			style={{
				background: `
					radial-gradient(circle 350px at 50% 50%, rgba(74,222,128,0.04), transparent 70%),
					radial-gradient(circle 250px at calc(100% - 90px) 90px, rgba(52,211,153,0.06), transparent 70%),
					radial-gradient(circle 200px at 40px calc(100% - 40px), rgba(22,163,74,0.05), transparent 70%)
				`,
			}}
		/>
		{/* Vignette */}
		<div className="absolute inset-0 bg-gradient-to-b from-landing-bg/60 via-transparent to-landing-bg/80" />
	</div>
);

export default LandingBackground;
