import { useCallback, useEffect, useState } from "react";
import { socket } from "../socket.js";

/**
 * Estado da equipa técnica (funcionários) da minha equipa.
 *
 * Vai por **ack** — não há listener de socket: só o meu clube muda o meu
 * staff, por isso não há broadcast para escutar. O `reload` corre a cada
 * montagem (as tabs desmontam ao trocar), o que mantém o estado fresco.
 *
 * @returns {{
 *   staff: object|null,
 *   loading: boolean,
 *   pending: boolean,
 *   hire: (role: string, level: number) => Promise<object|null>,
 *   fire: (role: string) => Promise<object|null>,
 *   reload: () => void,
 * }}
 */
export function useStaffState() {
	const [staff, setStaff] = useState(null);
	const [loading, setLoading] = useState(true);
	const [pending, setPending] = useState(false);

	const reload = useCallback(() => {
		// Sem resposta (socket em baixo), o estado fica a null e a secção
		// mostra o esqueleto — melhor do que ficar "a carregar" para sempre.
		const timer = setTimeout(() => setLoading(false), 5000);
		socket.emit("requestStaff", (state) => {
			clearTimeout(timer);
			if (state) setStaff(state);
			setLoading(false);
		});
	}, []);

	useEffect(() => {
		reload();
	}, [reload]);

	/** Fecha um pedido de contratação/despedimento com o estado novo. */
	const settle = useCallback((res) => {
		if (res?.state) setStaff(res.state);
		setPending(false);
		return res ?? null;
	}, []);

	// Emits literais (não por variável): o `audit:socketio` lê os nomes dos
	// eventos no cliente e um emit dinâmico aparecia como "nunca emitido".
	const hire = useCallback(
		(role, level) => {
			setPending(true);
			return new Promise((resolve) => {
				socket.emit("hireStaff", { role, level }, (res) => resolve(settle(res)));
			});
		},
		[settle],
	);

	const fire = useCallback(
		(role) => {
			setPending(true);
			return new Promise((resolve) => {
				socket.emit("fireStaff", { role }, (res) => resolve(settle(res)));
			});
		},
		[settle],
	);

	return { staff, loading, pending, hire, fire, reload };
}
