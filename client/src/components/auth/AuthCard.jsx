/**
 * Moldura do cartão de autenticação com a pele do jogo (contentor + fio de
 * luz no topo, como os painéis da app), semi-transparente sobre o estádio,
 * com sombra funda e um brilho primary por trás para saltar do fundo. Só
 * estrutura — o conteúdo (login/registo) entra por `children`, para que a
 * transição entre fases continue a ser gerida pelo `LandingPage`.
 *
 * @param {Object} props
 * @param {import("react").ReactNode} props.children - Formulário em fase `login` ou `register`.
 * @returns {JSX.Element}
 */
const AuthCard = ({ children }) => (
	<div className="relative w-full max-w-md short:max-w-xs">
		{/* Brilho por trás — fora do overflow-hidden do cartão para transbordar */}
		<div
			aria-hidden
			className="pointer-events-none absolute -inset-y-10 inset-x-0 sm:-inset-x-12 -z-10 rounded-full bg-primary/25 blur-3xl"
		/>
		<div className="relative bg-surface-container/90 backdrop-blur-md border border-outline-variant/25 ring-1 ring-primary/15 rounded-md overflow-hidden shadow-2xl shadow-black/50">
			<div aria-hidden className="top-light" />
			{children}
		</div>
	</div>
);

export default AuthCard;
