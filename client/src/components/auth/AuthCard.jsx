/**
 * Moldura do cartão de autenticação com a pele do jogo (contentor + fio de
 * luz no topo, como os painéis da app). Só estrutura — o conteúdo
 * (login/registo) entra por `children`, para que a transição entre fases
 * continue a ser gerida pelo `LandingPage`.
 *
 * @param {Object} props
 * @param {import("react").ReactNode} props.children - Formulário em fase `login` ou `register`.
 * @returns {JSX.Element}
 */
const AuthCard = ({ children }) => (
	<div className="relative w-full max-w-md short:max-w-xs bg-surface-container border border-outline-variant/25 rounded-md overflow-hidden">
		<div aria-hidden className="top-light" />
		{children}
	</div>
);

export default AuthCard;
