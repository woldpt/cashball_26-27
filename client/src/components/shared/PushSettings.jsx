import { useEffect, useState } from "react";
import { Panel } from "./Panel.jsx";
import { Button } from "./Button.jsx";
import { urlBase64ToUint8Array } from "../../services/pushNotifications.js";

/**
 * Painel "Avisos" das definições: activar/desactivar notificações push
 * (aviso quando se é o último treinador em falta no lobby).
 * @param {Object} props Props do painel.
 * @param {{name?: string, token?: string}} props.me Treinador autenticado.
 * @param {string} props.backendUrl Base do backend (ex. http://localhost:3000).
 * @returns {JSX.Element} Painel de avisos push.
 */
// Avisos por tipo: o interruptor geral é deste browser; estes são do treinador
// (valem em todos os dispositivos) e vivem no servidor.
const PUSH_PREF_ITEMS = [
	{
		type: "waiting",
		label: "Sala à espera de ti",
		hint: "A ronda só anda quando voltares (tática, lesão, decisão pendente).",
	},
	{
		type: "auction",
		label: "Leilões",
		hint: "Quando alguém te ultrapassa num leilão.",
	},
	{
		type: "matchday",
		label: "Fim de jornada",
		hint: "Resultado e posição na tabela quando não vês o jogo.",
	},
	{
		type: "invite",
		label: "Convites de sala",
		hint: "Quando um colega te convida e estás offline.",
	},
];

export function PushSettings({ me, backendUrl }) {
	const [status, setStatus] = useState("unknown");
	const [msg, setMsg] = useState(null);
	const [prefs, setPrefs] = useState(null);
	const [prefsMsg, setPrefsMsg] = useState(null);

	const supported =
		typeof window !== "undefined" &&
		"serviceWorker" in navigator &&
		"PushManager" in window &&
		"Notification" in window;
	const isIOS =
		typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);
	const isStandalone =
		typeof window !== "undefined" &&
		typeof window.matchMedia === "function" &&
		window.matchMedia("(display-mode: standalone)").matches;

	useEffect(() => {
		let dead = false;
		(async () => {
			if (!supported) {
				if (!dead) setStatus("unsupported");
				return;
			}
			try {
				const reg = await navigator.serviceWorker.ready;
				const sub = await reg.pushManager.getSubscription();
				if (!dead) setStatus(sub ? "on" : "off");
			} catch {
				if (!dead) setStatus("unsupported");
			}
		})();
		return () => {
			dead = true;
		};
	}, [supported]);

	/**
	 * Pede permissão, subscreve no browser e regista no servidor.
	 * @returns {Promise<void>}
	 */
	async function handleEnable() {
		setStatus("busy");
		setMsg(null);
		let sub = null;
		try {
			const perm = await Notification.requestPermission();
			if (perm !== "granted") {
				setStatus("off");
				setMsg("Permissão recusada no browser.");
				return;
			}
			const keyRes = await fetch(`${backendUrl}/api/push/key`);
			if (!keyRes.ok) {
				setStatus("off");
				setMsg("Avisos indisponíveis de momento.");
				return;
			}
			const { key } = await keyRes.json();
			const reg = await navigator.serviceWorker.ready;
			sub = await reg.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(key),
			});
			const json = sub.toJSON();
			const res = await fetch(`${backendUrl}/api/push/subscribe`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: me?.name,
					token: me?.token,
					endpoint: json.endpoint,
					keys: json.keys,
				}),
			});
			if (!res.ok) throw new Error("register");
			setStatus("on");
		} catch {
			await sub?.unsubscribe().catch(() => {});
			setStatus("off");
			setMsg("Não foi possível activar os avisos.");
		}
	}

	/**
	 * Remove a subscrição do servidor e do browser.
	 * @returns {Promise<void>}
	 */
	async function handleDisable() {
		setStatus("busy");
		setMsg(null);
		try {
			const reg = await navigator.serviceWorker.ready;
			const sub = await reg.pushManager.getSubscription();
			if (sub) {
				await fetch(`${backendUrl}/api/push/unsubscribe`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						name: me?.name,
						token: me?.token,
						endpoint: sub.endpoint,
					}),
				}).catch(() => {});
				await sub.unsubscribe().catch(() => {});
			}
			setStatus("off");
		} catch {
			setStatus("on");
			setMsg("Não foi possível desactivar os avisos.");
		}
	}

	/**
	 * Carrega as preferências por tipo (só fazem sentido com os avisos ligados
	 * neste browser; o nome vem da sessão, não do corpo).
	 * @returns {void}
	 */
	useEffect(() => {
		if (status !== "on" || !me?.token) return;
		let dead = false;
		(async () => {
			try {
				const res = await fetch(`${backendUrl}/api/push/prefs`, {
					headers: { Authorization: `Bearer ${me.token}` },
				});
				if (!res.ok) return;
				const data = await res.json();
				if (!dead && data?.prefs) setPrefs(data.prefs);
			} catch {
				// Sem prefs os interruptores não aparecem: o servidor envia tudo.
			}
		})();
		return () => {
			dead = true;
		};
	}, [status, me?.token, backendUrl]);

	/**
	 * Liga/desliga um tipo de aviso (optimista: volta atrás se o servidor falhar).
	 * @param {string} type Tipo de aviso.
	 * @param {boolean} enabled Novo estado.
	 * @returns {Promise<void>}
	 */
	async function togglePref(type, enabled) {
		setPrefs((prev) => ({ ...prev, [type]: enabled }));
		setPrefsMsg(null);
		try {
			const res = await fetch(`${backendUrl}/api/push/prefs`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${me?.token}`,
				},
				body: JSON.stringify({ type, enabled }),
			});
			if (!res.ok) throw new Error("save");
			const data = await res.json();
			if (data?.prefs) setPrefs(data.prefs);
		} catch {
			setPrefs((prev) => ({ ...prev, [type]: !enabled }));
			setPrefsMsg("Não foi possível guardar. Tenta novamente.");
		}
	}

	return (
		<Panel title="Avisos" icon="notifications" meta={status === "on" ? "Ligados" : "Desligados"}>
			<div className="p-3 md:p-4 short:p-2 space-y-3">
				<p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
					No telemóvel, quando não estás a ver o jogo.
				</p>
				{status === "unsupported" || !supported ? (
					<p role="status" className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
						Este browser não suporta avisos.
					</p>
				) : status === "unknown" ? (
					<p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
						A verificar…
					</p>
				) : status === "on" ? (
					<Button variant="secondary" size="md" full onClick={handleDisable}>
						Desactivar Avisos
					</Button>
				) : (
					<Button
						variant="primary"
						size="md"
						full
						onClick={handleEnable}
						disabled={status === "busy"}
					>
						{status === "busy" ? "A activar…" : "Activar Avisos"}
					</Button>
				)}
				{isIOS && !isStandalone && supported && (
					<p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
						No iPhone: Partilhar › Adicionar ao ecrã inicial — só aí chegam avisos.
					</p>
				)}
				{status === "on" && prefs && (
					<div className="space-y-0.5 border-t border-outline-variant/20 pt-3">
						<p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
							Que avisos queres receber
						</p>
						{PUSH_PREF_ITEMS.map((item) => (
							<label
								key={item.type}
								className="flex items-start gap-2 py-1.5 cursor-pointer select-none"
							>
								<input
									type="checkbox"
									checked={prefs[item.type] !== false}
									onChange={(e) => togglePref(item.type, e.target.checked)}
									className="mt-0.5 w-4 h-4 accent-emerald-500"
								/>
								<span className="min-w-0">
									<span className="block text-[11px] font-bold text-on-surface">
										{item.label}
									</span>
									<span className="block text-[10px] text-on-surface-variant/70">
										{item.hint}
									</span>
								</span>
							</label>
						))}
						{prefsMsg && (
							<p role="status" className="text-[10px] text-error font-bold uppercase tracking-widest">
								{prefsMsg}
							</p>
						)}
					</div>
				)}
				{msg && (
					<p role="status" className="text-[10px] text-error font-bold uppercase tracking-widest">
						{msg}
					</p>
				)}
			</div>
		</Panel>
	);
}
