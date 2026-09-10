import { motion } from "framer-motion";
import AuthField from "./AuthField.jsx";

/**
 * Formulário de criação de conta (fase `register`). Valida no cliente o
 * comprimento mínimo e a confirmação da palavra-passe antes de submeter.
 *
 * @param {Object} props
 * @param {string} props.name
 * @param {(value: string) => void} props.setName
 * @param {string} props.password
 * @param {(value: string) => void} props.setPassword
 * @param {string} props.confirmPassword
 * @param {(value: string) => void} props.setConfirmPassword
 * @param {boolean} props.authSubmitting
 * @param {string} props.authError
 * @param {boolean} props.disconnected
 * @param {() => void} props.onClearError - Limpa o erro ao editar um campo.
 * @param {() => void} props.onSubmit - Submete o registo.
 * @param {() => void} props.onBack - Volta à fase de login.
 * @returns {JSX.Element}
 */
const RegisterForm = ({
	name,
	setName,
	password,
	setPassword,
	confirmPassword,
	setConfirmPassword,
	authSubmitting,
	authError,
	disconnected,
	onClearError,
	onSubmit,
	onBack,
}) => {
	const registerPasswordMismatch =
		confirmPassword !== "" && password !== confirmPassword;
	const passwordTooShort = password !== "" && password.length < 3;

	return (
		<motion.div
			key="register"
			initial={{ opacity: 0, x: 20 }}
			animate={{ opacity: 1, x: 0 }}
			exit={{ opacity: 0, x: -20 }}
			transition={{ duration: 0.25 }}
			className="p-8 space-y-5 short:p-2.5 short:space-y-1"
		>
			{/* Landscape: título e "Voltar" na mesma linha — o bloco de header
			    ocupava 3 linhas e empurrava o CTA para além do ecrã em ~375px de altura */}
			<div className="flex items-center justify-between gap-2">
				<button
					type="button"
					onClick={onBack}
					className="text-xs text-white/30 hover:text-white/70 font-black uppercase tracking-widest flex items-center gap-1 transition-colors short:order-2 short:shrink-0"
				>
					← Voltar
				</button>
				<h2 className="hidden short:block min-w-0 truncate short:text-base font-headline font-black text-white tracking-tight">
					Cria a tua conta de treinador
				</h2>
			</div>
			<div className="space-y-1 text-center short:hidden">
				<p className="flex items-center justify-center gap-1.5 text-[10px] text-green-400/60 uppercase font-black tracking-[0.4em]">
					<span className="material-symbols-outlined text-[14px] leading-none">badge</span>
					Nova conta
				</p>
				<h2 className="text-2xl font-headline font-black text-white tracking-tight">
					Cria a tua conta de treinador
				</h2>
			</div>

			<form
				className="space-y-5 short:space-y-1"
				noValidate
				onSubmit={(e) => {
					e.preventDefault();
					onSubmit();
				}}
			>
				{/* short: password + confirmar lado a lado (poupa uma linha) */}
				<div className="space-y-3 short:grid short:grid-cols-2 short:gap-3">
					<AuthField
						id="register-name"
						label="Nome de Treinador"
						autoComplete="username"
						placeholder="Ex: Amorim"
						value={name}
						onChange={(v) => {
							setName(v);
							onClearError();
						}}
					/>
					<AuthField
						id="register-password"
						label="Palavra-passe"
						secret
						autoComplete="new-password"
						placeholder="••••••••"
						value={password}
						onChange={(v) => {
							setPassword(v);
							onClearError();
						}}
						hint={
							passwordTooShort ? (
								<p className="text-amber-400 text-xs mt-1 font-bold">
									A palavra-passe deve ter pelo menos 3 caracteres.
								</p>
							) : null
						}
					/>
					<AuthField
						id="register-confirm"
						label={
							<>
								<span className="short:hidden">Confirmar Palavra-passe</span>
								<span className="hidden short:inline">Confirmar</span>
							</>
						}
						secret
						invalid={registerPasswordMismatch}
						autoComplete="new-password"
						placeholder="••••••••"
						value={confirmPassword}
						onChange={(v) => {
							setConfirmPassword(v);
							onClearError();
						}}
						hint={
							registerPasswordMismatch ? (
								<p className="text-red-400 text-xs mt-1 font-bold">
									As palavras-passe não coincidem.
								</p>
							) : null
						}
					/>
				</div>
				<button
					type="submit"
					disabled={
						!name.trim() ||
						password.length < 3 ||
						!confirmPassword ||
						authSubmitting ||
						registerPasswordMismatch
					}
					className="w-full relative overflow-hidden bg-green-500 hover:bg-green-400 disabled:bg-white/[0.06] disabled:text-white/30 text-black py-4 short:py-1.5 rounded-xl font-black text-base uppercase tracking-[0.2em] transition-all active:scale-[0.98] shadow-[0_4px_20px_rgba(74,222,128,0.25)] hover:shadow-[0_4px_30px_rgba(74,222,128,0.4)] group"
				>
					<span className="relative z-10">
						{authSubmitting ? "A CRIAR CONTA..." : "CRIAR CONTA"}
					</span>
					<div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
				</button>
			</form>

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
};

export default RegisterForm;
