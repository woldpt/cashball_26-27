import { motion } from "framer-motion";
import ParticleCanvas from "./ParticleCanvas.jsx";

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
	<div className="min-h-screen bg-landing-surface text-white flex flex-col items-center justify-center p-6 pb-24">
		<ParticleCanvas />
		<motion.div
			initial={{ opacity: 0, scale: 0.95 }}
			animate={{ opacity: 1, scale: 1 }}
			className="relative bg-landing-panel-alt/80 border border-landing-accent-strong/20 backdrop-blur-xl p-8 short:p-5 rounded-2xl w-full max-w-md shadow-[0_0_60px_rgba(52,211,153,0.08)] text-center"
		>
			<div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-landing-accent/60 to-transparent rounded-t-2xl" />
			<div className="w-12 h-12 mx-auto mb-4 rounded-full bg-landing-accent-strong/10 border border-landing-accent-strong/30 flex items-center justify-center">
				<span
					className="material-symbols-outlined text-landing-accent text-2xl animate-spin"
					style={{ animationDuration: "2s" }}
				>
					autorenew
				</span>
			</div>
			<p className="text-[10px] uppercase tracking-[0.35em] text-landing-accent/70 font-bold mb-2">
				A entrar na sala
			</p>
			<p className="text-2xl font-headline font-black text-white mb-1">
				A reconectar...
			</p>
			<p className="text-xs text-white/40 font-medium tracking-wide">
				{me.name} · {me.roomCode?.toUpperCase()}
			</p>
		</motion.div>
	</div>
);

export default ReconnectScreen;
