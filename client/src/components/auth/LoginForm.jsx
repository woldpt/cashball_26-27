import { motion } from "framer-motion";
import AuthField from "./AuthField.jsx";

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
}) => (
	<motion.div
		key="login"
		initial={{ opacity: 0, x: -20 }}
		animate={{ opacity: 1, x: 0 }}
		exit={{ opacity: 0, x: 20 }}
		transition={{ duration: 0.25 }}
		className="p-8 space-y-5 short:p-2.5 short:space-y-1"
	>
		<div className="space-y-1 text-center mb-4 short:mb-1">
			<p className="flex items-center justify-center gap-1.5 text-[10px] text-green-400/60 uppercase font-black tracking-[0.4em]">
				<span className="material-symbols-outlined text-[14px] leading-none">badge</span>
				Painel do Treinador
			</p>
			<h2 className="text-2xl font-headline font-black text-white tracking-tight short:text-base">
				Acede à tua conta
			</h2>
			<p className="text-xs text-white/40 short:hidden">
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
					placeholder="Ex: Cobra"
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
				className="w-full relative overflow-hidden bg-green-500 hover:bg-green-400 disabled:bg-white/[0.06] disabled:text-white/30 text-black py-4 short:py-1.5 rounded-xl font-black text-base uppercase tracking-[0.2em] transition-all active:scale-[0.98] shadow-[0_4px_20px_rgba(74,222,128,0.25)] hover:shadow-[0_4px_30px_rgba(74,222,128,0.4)] group"
			>
				<span className="relative z-10">{authSubmitting ? "A VALIDAR..." : "ENTRAR"}</span>
				<div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
			</button>
		</form>

		<button
			type="button"
			onClick={onCreateAccount}
			className="w-full border border-white/[0.08] bg-white/[0.02] hover:border-green-500/30 hover:bg-green-500/[0.04] text-white/70 hover:text-white py-3 short:py-1 rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all"
		>
			Criar conta
		</button>

		{authError && (
			<p className="text-red-400 text-sm text-center font-bold">⚠️ {authError}</p>
		)}
		{!authError && disconnected && (
			<p className="text-red-400 text-sm text-center font-bold">
				⚠️ Sem ligação ao servidor. Tenta novamente.
			</p>
		)}
	</motion.div>
);

export default LoginForm;
