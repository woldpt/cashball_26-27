import { motion } from "framer-motion";
import AuthField, { AuthErrorHint } from "./AuthField.jsx";
import { exampleNames } from "./exampleNames.js";
import useNameCarousel from "./useNameCarousel.js";

/**
 * Formulário de entrada na conta (fase `login`). Usa `<form onSubmit>` para que
 * o Enter funcione em qualquer campo, os password managers reconheçam o par e o
 * teclado mobile mostre a tecla de submissão.
 *
 * @param {Object} props
 * @param {string} props.name
 * @param {(value: string) => void} props.setName
 * @param {string} props.password
 * @param {(value: string) => void} props.setPassword
 * @param {boolean} props.authSubmitting
 * @param {string} props.authError
 * @param {boolean} props.disconnected
 * @param {() => void} props.onClearError - Limpa o erro ao editar um campo.
 * @param {() => void} props.onSubmit - Submete o login.
 * @param {() => void} props.onCreateAccount - Muda para a fase de registo.
 * @returns {JSX.Element}
 */
const LoginForm = ({
	name,
	setName,
	password,
	setPassword,
	authSubmitting,
	authError,
	disconnected,
	onClearError,
	onSubmit,
	onCreateAccount,
}) => {
	const { current: exampleName } = useNameCarousel(exampleNames);

	return (
	<motion.div
		key="login"
		initial={{ opacity: 0, x: -20 }}
		animate={{ opacity: 1, x: 0 }}
		exit={{ opacity: 0, x: 20 }}
		transition={{ duration: 0.25 }}
		className="p-8 space-y-5 short:p-2.5 short:space-y-1"
	>
		<div className="space-y-1 text-center mb-4 short:mb-1">
			<p className="flex items-center justify-center gap-1.5 text-[10px] text-primary/70 uppercase font-black tracking-[0.4em]">
				<span className="material-symbols-outlined text-[14px] leading-none">badge</span>
				Painel do Treinador
			</p>
			<h2 className="text-2xl font-headline font-black text-on-surface tracking-tight short:text-base">
				Acede à tua conta
			</h2>
			<p className="text-xs text-on-surface-variant short:hidden">
				Depois escolhes novo jogo, época guardada ou amigos.
			</p>
		</div>

		<form
			className="space-y-5 short:space-y-1"
			noValidate
			onSubmit={(e) => {
				e.preventDefault();
				onSubmit();
			}}
		>
			<div className="space-y-3">
				<AuthField
					id="login-name"
					label="Nome de Treinador"
					autoComplete="username"
					placeholderComponent={
						<motion.span
							key={exampleName}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ duration: 0.3 }}
							className="text-on-surface/20 text-lg font-black truncate"
						>
							Ex: {exampleName}
						</motion.span>
					}
					value={name}
					onChange={(v) => {
						setName(v);
						onClearError();
					}}
				/>
				<AuthField
					id="login-password"
					label="Palavra-passe"
					secret
					autoComplete="current-password"
					placeholder="••••••••"
					value={password}
					onChange={(v) => {
						setPassword(v);
						onClearError();
					}}
				/>
			</div>
			<button
				type="submit"
				disabled={!name.trim() || !password || authSubmitting}
				className="w-full relative overflow-hidden bg-primary hover:brightness-110 disabled:bg-surface-bright disabled:text-on-surface-variant/40 text-on-primary py-4 short:py-1.5 rounded-md font-black text-base uppercase tracking-[0.2em] transition-all active:scale-[0.98] group"
			>
				<span className="relative z-10">{authSubmitting ? "A VALIDAR..." : "ENTRAR"}</span>
				<div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
			</button>
		</form>

		<button
			type="button"
			onClick={onCreateAccount}
			className="w-full border border-primary/30 bg-primary/[0.05] hover:border-primary/60 hover:bg-primary/[0.1] text-primary/90 hover:text-primary py-3 short:py-1 rounded-md font-black text-xs uppercase tracking-[0.2em] transition-all"
		>
			Criar conta
		</button>

		<AuthErrorHint authError={authError} disconnected={disconnected} />
	</motion.div>
	);
};

export default LoginForm;
