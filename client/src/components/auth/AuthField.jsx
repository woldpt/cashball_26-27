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
}) => {
	const [visible, setVisible] = useState(false);
	const type = secret && visible ? "text" : secret ? "password" : "text";

	const stateClass = invalid
		? "border border-red-500/60 focus:border-red-500/60 focus:ring-red-500/30"
		: "border border-white/[0.08] focus:border-green-500/50 focus:ring-green-500/30 focus:bg-green-500/[0.03]";

	return (
		<div>
			<label
				htmlFor={id}
				className="block text-[10px] uppercase text-white/40 mb-2 font-bold tracking-wider"
			>
				{label}
			</label>
			<div className="relative">
				<input
					id={id}
					type={type}
					autoComplete={autoComplete}
					className={`w-full bg-white/[0.04] p-4 short:py-1 rounded-xl text-white text-lg font-black outline-none transition-all placeholder:text-white/20 focus:ring-1 ${stateClass} ${secret ? "pr-12" : ""}`}
					value={value}
					placeholder={placeholder}
					onChange={(e) => onChange(e.target.value)}
				/>
				{secret && (
					<button
						type="button"
						onClick={() => setVisible((s) => !s)}
						aria-label={visible ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
						aria-pressed={visible}
						className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors p-1"
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
