import { useEffect, useRef } from "react";
import { MODAL_Z } from "../../constants/index.js";
import { useGame } from "../../contexts/GameContext.jsx";
import { socket } from "../../socket.js";
import { ModalShell } from "../shared/ModalShell.jsx";

/**
 * Modal de convite de sala recebido enquanto jogamos noutra sala.
 * Um colega (que nos tem como membro duma sala) pede para nos juntarmos à
 * sala dele. Aceitar sai da sala actual e entra na convidada (reutilizando o
 * fluxo de join do App); Recusar (ou Escape) apenas responde ao emissor.
 *
 * Moldura via ModalShell (variante "card"); sem props — só é montado a
 * partir do GameLayout e lê o GameContext (pendingRoomInvite).
 */
export function InviteRoomModal() {
	const { pendingRoomInvite, setPendingRoomInvite, onAcceptRoomInvite } =
		useGame();
	// Guarda anti-duplo-clique por convite (o `respondRoomInvite` do servidor
	// não tem guarda anti-duplo): o segundo clique no mesmo inviteId é nulo.
	const respondedRef = useRef(null);

	const inviteId = pendingRoomInvite?.inviteId;
	const fromName = pendingRoomInvite?.fromName || "Um colega";
	const roomCode = pendingRoomInvite?.roomCode || "";
	const roomName = pendingRoomInvite?.roomName || roomCode || "sala";

	const respond = (accepted) => {
		if (!pendingRoomInvite || respondedRef.current === inviteId) return;
		respondedRef.current = inviteId;
		if (inviteId) {
			socket.emit("respondRoomInvite", { inviteId, accepted });
		}
		setPendingRoomInvite(null);
		if (accepted && roomCode) {
			onAcceptRoomInvite?.(roomCode);
		}
	};

	// Escape = recusar (o convite exige resposta explícita; nunca fecha mudo).
	useEffect(() => {
		if (!pendingRoomInvite) return undefined;
		const onKey = (e) => {
			if (e.key === "Escape") respond(false);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	return (
		<ModalShell
			visible={!!pendingRoomInvite}
			z={MODAL_Z.default}
			variant="card"
		>
			{pendingRoomInvite && (
				<>
					<div className="p-6">
						<div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-primary/30 bg-primary/15">
							<span
								aria-hidden
								className="material-symbols-outlined text-primary"
							>
								groups
							</span>
						</div>
						<p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
							Convite de sala
						</p>
						<h3
							id="invite-room-title"
							className="mt-1 font-headline text-xl font-black text-on-surface"
						>
							{fromName} convida-te
						</h3>
						<p
							id="invite-room-desc"
							className="mt-2 text-sm leading-relaxed text-on-surface-variant"
						>
							Quer que te juntes à sala{" "}
							<span className="font-headline font-black uppercase tracking-tight text-on-surface">
								{roomName}
							</span>
							{roomCode && (
								<span className="font-mono text-on-surface-variant/60">
									{" "}
									({roomCode})
								</span>
							)}
							. Ao aceitares sais da sala onde estás.
						</p>
					</div>
					<div className="flex gap-2 border-t border-outline-variant/20 p-4">
						<button
							type="button"
							onClick={() => respond(false)}
							className="flex-1 rounded-xl border border-outline-variant/25 bg-surface-container-high/50 py-3 text-xs font-black uppercase tracking-widest text-on-surface-variant transition-colors hover:text-on-surface"
						>
							Recusar
						</button>
						<button
							type="button"
							autoFocus
							onClick={() => respond(true)}
							className="flex-1 rounded-xl bg-primary py-3 text-xs font-black uppercase tracking-widest text-on-primary transition-all hover:brightness-110 active:scale-[0.98]"
						>
							Aceitar
						</button>
					</div>
				</>
			)}
		</ModalShell>
	);
}
