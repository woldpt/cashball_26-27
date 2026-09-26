import { motion } from "framer-motion";

/**
 * Ecrã de espera enquanto um treinador com sessão guardada volta a entrar na
 * sala (tem `me` mas ainda não tem `teamId`). Oculto atrás do crossfade do
 * `LandingPage`.
 *
 * @param {Object} props
 * @param {{name: string, roomCode: string|null}} props.me - Sessão em reconexão.
 * @returns {JSX.Element}
 */
const ReconnectScreen = ({ me }) => (
	<div className="min-h-screen bg-bg text-on-surface flex flex-col items-center justify-center p-6 pb-24">
		<motion.div
			initial={{ opacity: 0, scale: 0.95 }}
			animate={{ opacity: 1, scale: 1 }}
			className="relative bg-surface-container border border-outline-variant/25 p-8 short:p-5 rounded-md w-full max-w-md text-center"
		>
			<div aria-hidden className="top-light" />
			<div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
				<span
					className="material-symbols-outlined text-primary text-2xl animate-spin"
					style={{ animationDuration: "2s" }}
				>
					autorenew
				</span>
			</div>
			<p className="text-[10px] uppercase tracking-[0.35em] text-primary/70 font-bold mb-2">
				A entrar na sala
			</p>
			<p className="text-2xl font-headline font-black text-on-surface mb-1">
				A reconectar...
			</p>
			<p className="text-xs text-on-surface-variant font-medium tracking-wide">
				{me.name} · {me.roomCode?.toUpperCase()}
			</p>
		</motion.div>
	</div>
);

export default ReconnectScreen;
