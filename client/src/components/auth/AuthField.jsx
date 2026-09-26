import { useState } from "react";

/**
 * Campo de formulário da página de entrada (label + input + hint de validação).
 * Quando `secret` é true, acrescenta o botão de mostrar/ocultar a palavra-passe.
 * O botão é focável e tem nome acessível (`aria-label` + `aria-pressed`) —
 * retirá-lo da ordem de tabulação impedia quem só usa teclado de ver a password.
 *
 * @param {Object} props
 * @param {string} props.id - id do input, ligado ao label via htmlFor.
 * @param {import("react").ReactNode} props.label - Rótulo do campo.
 * @param {string} props.value - Valor atual.
 * @param {(value: string) => void} props.onChange - Recebe o novo valor.
 * @param {string} [props.placeholder] - Placeholder do input.
 * @param {string} [props.autoComplete] - Valor de autoComplete (password managers).
 * @param {boolean} [props.secret] - true para input de palavra-passe com toggle.
 * @param {boolean} [props.invalid] - true para pintar a borda de erro.
 * @param {import("react").ReactNode} [props.hint] - Mensagem de validação sob o campo.
 * @param {import("react").ReactNode} [props.placeholderComponent] - Placeholder
 *   personalizado (ex: carrossel animado). Quando existe, substitui o
 *   `placeholder` nativo e esconde-se automaticamente quando o input tem valor.
 * @returns {JSX.Element}
 */
const AuthField = ({
	id,
	label,
	value,
	onChange,
	placeholder,
	autoComplete,
	secret = false,
	invalid = false,
	hint = null,
	placeholderComponent = null,
}) => {
	const [visible, setVisible] = useState(false);
	const type = secret && visible ? "text" : secret ? "password" : "text";

	const stateClass = invalid
		? "border border-error/60 focus:border-error/60"
		: "border border-outline-variant/25 focus:border-primary/50 focus:bg-primary/[0.03]";

	return (
		<div>
			<label
				htmlFor={id}
				className="block text-[10px] uppercase text-on-surface-variant mb-2 font-bold tracking-wider"
			>
				{label}
			</label>
			<div className="relative">
				<input
					id={id}
					type={type}
					autoComplete={autoComplete}
					className={`w-full bg-surface-bright/50 p-4 short:py-1 rounded-md text-on-surface text-lg font-black outline-none transition-all placeholder:text-on-surface/20 ${stateClass} ${secret ? "pr-12" : ""}`}
					value={value}
					placeholder={placeholderComponent ? "" : placeholder}
					onChange={(e) => onChange(e.target.value)}
				/>
				{placeholderComponent && value === "" && (
					<div className="absolute inset-0 pointer-events-none flex items-center p-4 short:py-1">
						{placeholderComponent}
					</div>
				)}
				{secret && (
					<button
						type="button"
						onClick={() => setVisible((s) => !s)}
						aria-label={visible ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
						aria-pressed={visible}
						className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 hover:text-on-surface transition-colors p-1"
						title={visible ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
					>
						<span className="material-symbols-outlined text-[18px] leading-none">
							{visible ? "visibility_off" : "visibility"}
						</span>
					</button>
				)}
			</div>
			{hint}
		</div>
	);
};

export default AuthField;

/**
 * Aviso de erro sob os formulários de entrada (login e registo partilham o
 * mesmo bloco). Mostra o erro de autenticação ou, na falta dele, o aviso de
 * ligação perdida.
 *
 * @param {Object} props
 * @param {string} props.authError - Erro de autenticação (vazio = sem erro).
 * @param {boolean} props.disconnected - true quando há perda de ligação.
 * @returns {JSX.Element|null}
 */
export const AuthErrorHint = ({ authError, disconnected }) => {
	if (authError) {
		return <p className="text-error text-sm text-center font-bold">⚠️ {authError}</p>;
	}
	if (disconnected) {
		return (
			<p className="text-error text-sm text-center font-bold">
				⚠️ Sem ligação ao servidor. Tenta novamente.
			</p>
		);
	}
	return null;
};
