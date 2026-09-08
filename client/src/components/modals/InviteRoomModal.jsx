import { motion } from "framer-motion";
import { useGame } from "../../contexts/GameContext.jsx";
import { socket } from "../../socket.js";

/**
 * Modal de convite de sala recebido enquanto jogamos noutra sala.
 * Um colega (que nos tem como membro duma sala) pede para nos juntarmos à
 * sala dele. Aceitar sai da sala actual e entra na convidada (reutilizando o
 * fluxo de join do App); Recusar apenas responde ao emissor.
 *
 * Totalmente autónomo: lê o estado do GameContext (pendingRoomInvite) e não
 * precisa de props — só é montado a partir do GameLayout.
 */
export function InviteRoomModal() {
	const { pendingRoomInvite, setPendingRoomInvite, onAcceptRoomInvite } =
		useGame();

	if (!pendingRoomInvite) return null;

	const { inviteId, fromName, roomCode, roomName } = pendingRoomInvite;

	const respond = (accepted) => {
		if (inviteId) {
			socket.emit("respondRoomInvite", { inviteId, accepted });
		}
		setPendingRoomInvite(null);
		if (accepted) {
			onAcceptRoomInvite?.(roomCode);
		}
	};

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-4 pb-6 backdrop-blur-sm sm:items-center"
		>
			<motion.div
				initial={{ opacity: 0, y: 24, scale: 0.97 }}
				animate={{ opacity: 1, y: 0, scale: 1 }}
				transition={{ duration: 0.25, ease: "easeOut" }}
				className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-sky-500/25 bg-[#0a1410] shadow-[0_32px_80px_rgba(0,0,0,0.6)]"
			>
				<div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-sky-400/70 to-transparent" />
				<div className="p-6">
					<div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/15">
						<span className="material-symbols-outlined text-sky-300">
							groups
						</span>
					</div>
					<p className="text-[10px] font-black uppercase tracking-[0.35em] text-sky-400/80">
						Convite de sala
					</p>
					<h3 className="mt-1 font-headline text-xl font-black text-white">
						{fromName} convida-te
					</h3>
					<p className="mt-2 text-sm leading-relaxed text-white/60">
						Quer que te juntes à sala{" "}
						<span className="font-headline font-black uppercase tracking-tight text-white">
							{roomName || roomCode}
						</span>
						<span className="font-mono text-white/40"> ({roomCode})</span>. Ao
						aceitares sais da sala onde estás.
					</p>
				</div>
				<div className="flex gap-2 border-t border-white/[0.06] p-4">
					<button
						onClick={() => respond(false)}
						className="flex-1 rounded-xl border border-white/[0.1] bg-white/[0.03] py-3 text-xs font-black uppercase tracking-[0.18em] text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white"
					>
						Recusar
					</button>
					<button
						onClick={() => respond(true)}
						className="flex-1 rounded-xl bg-sky-500 py-3 text-xs font-black uppercase tracking-[0.18em] text-black shadow-[0_4px_20px_rgba(14,165,233,0.3)] transition-all hover:bg-sky-400 active:scale-[0.98]"
					>
						Aceitar
					</button>
				</div>
			</motion.div>
		</motion.div>
	);
}
