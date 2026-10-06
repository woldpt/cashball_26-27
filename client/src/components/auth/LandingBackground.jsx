import { StadiumIllustration } from "../shared/StadiumIllustration.jsx";
import { SHOWCASE_LIVE } from "./landingShowcase.js";

/**
 * Camadas decorativas fixas do fundo: o estádio em festa da equipa da casa
 * da montra, atenuado e fundido no fundo escuro, mais os brilhos ténues do
 * jogo (primary/tertiary).
 * Puramente visual — `pointer-events-none` e `aria-hidden` para não
 * interferir com conteúdo nem leitores de ecrã.
 *
 * @returns {JSX.Element}
 */
const LandingBackground = () => (
	<div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
		{/* Estádio cheio por trás do hero — atenuado para o texto ler por cima */}
		<div className="absolute inset-x-0 top-0 h-[80vh] [mask-image:linear-gradient(to_bottom,black_45%,transparent)]">
			<StadiumIllustration
				capacity={60000}
				mood={45}
				seed={7}
				primary={SHOWCASE_LIVE.home.color}
				secondary="#1f2937"
				className="h-full w-full opacity-25"
			/>
			<div className="absolute inset-0 bg-gradient-to-r from-bg/70 via-transparent to-transparent" />
		</div>
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
