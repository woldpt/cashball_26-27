/**
 * Moldura visual do cartão de autenticação (glow exterior, vidro, linha de giz e
 * cantos). Só estrutura — o conteúdo (login/registo) entra por `children`, para
 * que a transição entre fases continue a ser gerida pelo `LandingPage`.
 *
 * @param {Object} props
 * @param {import("react").ReactNode} props.children - Formulário em fase `login` ou `register`.
 * @returns {JSX.Element}
 */
const AuthCard = ({ children }) => (
	<div className="relative w-full max-w-md short:max-w-xs">
		{/* Outer glow */}
		<div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-landing-accent-strong/20 via-transparent to-landing-accent-strong/5 blur-sm pointer-events-none" />
		<div className="relative bg-landing-panel/90 border border-white/[0.08] backdrop-blur-2xl rounded-2xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.6),0_0_0_1px_rgba(52,211,153,0.08)]">
			{/* Linha de giz do quadro tático */}
			<div
				aria-hidden="true"
				className="absolute top-0 inset-x-0 h-[2px] opacity-50"
				style={{
					background:
						"repeating-linear-gradient(90deg, rgba(255,255,255,0.3) 0 10px, transparent 10px 20px)",
				}}
			/>
			{/* Corner accents — 4/4: cantos assimétricos liam-se como esquecimento */}
			<div className="absolute top-3 right-3 w-10 h-10 border-t border-r border-landing-accent-strong/20 rounded-tr-xl pointer-events-none" />
			<div className="absolute top-3 left-3 w-10 h-10 border-t border-l border-landing-accent-strong/20 rounded-tl-xl pointer-events-none" />
			<div className="absolute bottom-3 left-3 w-10 h-10 border-b border-l border-landing-accent-strong/20 rounded-bl-xl pointer-events-none" />
			<div className="absolute bottom-3 right-3 w-10 h-10 border-b border-r border-landing-accent-strong/20 rounded-br-xl pointer-events-none" />
			{children}
		</div>
	</div>
);

export default AuthCard;
