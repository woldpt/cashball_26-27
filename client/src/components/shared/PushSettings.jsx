import { useEffect, useState } from "react";
import { Panel } from "./Panel.jsx";
import { Button } from "./Button.jsx";

/**
 * Converte a chave pública VAPID (base64url) para o formato do PushManager.
 * @param {string} base64 Chave pública em base64url.
 * @returns {Uint8Array} Chave como bytes.
 */
function urlBase64ToUint8Array(base64) {
	const padding = "=".repeat((4 - (base64.length % 4)) % 4);
	const raw = window.atob(base64.replace(/-/g, "+").replace(/_/g, "/") + padding);
	const out = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
	return out;
}

/**
 * Painel "Avisos" das definições: activar/desactivar notificações push
 * (aviso quando se é o último treinador em falta no lobby).
 * @param {Object} props Props do painel.
 * @param {{name?: string, token?: string}} props.me Treinador autenticado.
 * @param {string} props.backendUrl Base do backend (ex. http://localhost:3000).
 * @returns {JSX.Element} Painel de avisos push.
 */
export function PushSettings({ me, backendUrl }) {
	const [status, setStatus] = useState("unknown");
	const [msg, setMsg] = useState(null);

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

	return (
		<Panel title="Avisos" icon="notifications" meta={status === "on" ? "Ligados" : "Desligados"}>
			<div className="p-3 md:p-4 short:p-2 space-y-3">
				<p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
					Avisa-te quando fores o último em falta no lobby.
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
				{msg && (
					<p role="status" className="text-[10px] text-error font-bold uppercase tracking-widest">
						{msg}
					</p>
				)}
			</div>
		</Panel>
	);
}
