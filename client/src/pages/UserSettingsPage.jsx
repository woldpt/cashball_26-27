import { useState, useEffect, useRef } from "react";
import { CoachAvatar } from "../components/shared/CoachAvatar.jsx";
import { ModalShell } from "../components/shared/ModalShell.jsx";
import { processAvatarFile } from "../utils/avatarUpload.js";
import { Panel } from "../components/shared/Panel.jsx";
import { EmptyState } from "../components/shared/EmptyState.jsx";
import { Badge } from "../components/shared/Badge.jsx";
import { Button } from "../components/shared/Button.jsx";

const MIN_PASSWORD_LENGTH = 6;
const MIN_BIRTH_YEAR = 1940;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Helper simples partilhado pelos pedidos desta página: POST/DELETE JSON
// com parse seguro (resposta não-JSON devolve {} em vez de rebentar).
async function sendJSON(url, body, method = "POST") {
	const res = await fetch(url, {
		method,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	const data = await res.json().catch(() => ({}));
	return { res, data };
}

export function UserSettingsPage({
	me,
	teamInfo,
	palmares,
	backendUrl,
	avatarSeed,
	coachAvatars = {},
	setCoachAvatars,
	onAvatarSeedChange,
	onBack,
	onLeaveRoom,
}) {
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [changingPassword, setChangingPassword] = useState(false);
	const [passwordMsg, setPasswordMsg] = useState(null);
	const [rooms, setRooms] = useState([]);
	const [roomsLoading, setRoomsLoading] = useState(true);
	const [deletingAccount, setDeletingAccount] = useState(false);
	const [deleteAccountMsg, setDeleteAccountMsg] = useState(null);
	const [email, setEmail] = useState("");
	const [birthYear, setBirthYear] = useState("");
	const [profileSaving, setProfileSaving] = useState(false);
	const [profileMsg, setProfileMsg] = useState(null);
	const [avatarBusy, setAvatarBusy] = useState(false);
	const [avatarImgMsg, setAvatarImgMsg] = useState(null);
	const fileInputRef = useRef(null);

	// ── Foto de avatar (upload/remoção, processada no cliente p/ 256px) ─────
	const hasAvatarImage = me?.name ? coachAvatars?.[me.name] != null : false;

	async function handleAvatarFilePicked(e) {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file || !me?.name) return;
		setAvatarBusy(true);
		setAvatarImgMsg(null);
		try {
			const { dataBase64, mime } = await processAvatarFile(file);
			const { res, data } = await sendJSON(`${backendUrl}/auth/avatar`, {
				name: me.name,
				token: me.token,
				dataBase64,
				mime,
			});
			if (!res.ok) throw new Error(data?.error || "Erro ao carregar a foto.");
			setCoachAvatars((prev) => ({ ...prev, [me.name]: data.version }));
			setAvatarImgMsg({ type: "success", text: "Foto carregada." });
		} catch (err) {
			setAvatarImgMsg({
				type: "error",
				text: err?.message || "Erro ao carregar a foto.",
			});
		} finally {
			setAvatarBusy(false);
		}
	}

	async function handleRemoveAvatar() {
		if (!me?.name) return;
		try {
			const { res, data } = await sendJSON(
				`${backendUrl}/auth/avatar/delete`,
				{ name: me.name, token: me.token },
			);
			if (!res.ok) throw new Error(data?.error || "Erro ao remover a foto.");
			setCoachAvatars((prev) => {
				const next = { ...prev };
				delete next[me.name];
				return next;
			});
			setAvatarImgMsg({ type: "success", text: "Foto removida." });
		} catch (err) {
			setAvatarImgMsg({
				type: "error",
				text: err?.message || "Erro ao remover a foto.",
			});
		}
	}

	async function handleRegenerateAvatar() {
		if (!me?.name) return;
		const newSeed =
			typeof crypto !== "undefined" &&
			typeof crypto.randomUUID === "function"
				? crypto.randomUUID()
				: Math.random().toString(36).slice(2, 10);
		onAvatarSeedChange(newSeed);
		try {
			const { res } = await sendJSON(`${backendUrl}/auth/avatar-seed`, {
				name: me.name,
				token: me.token,
				seed: newSeed,
			});
			if (!res.ok) throw new Error("Erro ao guardar o avatar.");
		} catch {
			setAvatarImgMsg({
				type: "error",
				text: "Avatar gerado, mas não foi guardado.",
			});
		}
	}
	const [deletingRoom, setDeletingRoom] = useState(null); // null | { roomCode, leaving }
	const [deletingRoomLoading, setDeletingRoomLoading] = useState(false);

	useEffect(() => {
		if (!me?.name) {
			return;
		}
		const controller = new AbortController();
		fetch(
			`${backendUrl}/auth/manager-info?name=${encodeURIComponent(me.name)}`,
			{ signal: controller.signal },
		)
			.then((r) => r.json())
			.then((data) => {
				if (Array.isArray(data?.rooms)) setRooms(data.rooms);
				if (data?.email !== undefined) setEmail(data.email);
				if (data?.birthYear) setBirthYear(String(data.birthYear));
			})
			.catch((err) => {
				if (err?.name !== "AbortError") {
					/* ignorar */
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) setRoomsLoading(false);
			});
		return () => controller.abort();
	}, [me?.name, backendUrl]);

	const handleSaveProfile = async () => {
		setProfileMsg(null);
		const trimmedEmail = email?.trim() || "";
		if (trimmedEmail && !EMAIL_RE.test(trimmedEmail)) {
			setProfileMsg({ type: "error", text: "Email inválido." });
			return;
		}
		let parsedBirthYear;
		if (birthYear) {
			parsedBirthYear = parseInt(birthYear, 10);
			const currentYear = new Date().getFullYear();
			if (
				Number.isNaN(parsedBirthYear) ||
				parsedBirthYear < MIN_BIRTH_YEAR ||
				parsedBirthYear > currentYear
			) {
				setProfileMsg({
					type: "error",
					text: `Ano entre ${MIN_BIRTH_YEAR} e ${currentYear}.`,
				});
				return;
			}
		}
		setProfileSaving(true);
		try {
			const body = { name: me.name, token: me.token };
			if (trimmedEmail) body.email = trimmedEmail;
			if (parsedBirthYear !== undefined) body.birthYear = parsedBirthYear;
			const { data } = await sendJSON(
				`${backendUrl}/auth/update-profile`,
				body,
			);
			if (data.ok) {
				setProfileMsg({ type: "success", text: "Perfil atualizado!" });
			} else {
				setProfileMsg({
					type: "error",
					text: data.error || "Erro ao guardar.",
				});
			}
		} catch {
			setProfileMsg({ type: "error", text: "Erro de ligação." });
		} finally {
			setProfileSaving(false);
		}
	};

	const handleChangePassword = async (e) => {
		e.preventDefault();
		setPasswordMsg(null);

		if (!currentPassword || !newPassword || !confirmPassword) {
			setPasswordMsg({ type: "error", text: "Preenche todos os campos." });
			return;
		}
		if (newPassword.length < MIN_PASSWORD_LENGTH) {
			setPasswordMsg({
				type: "error",
				text: `A nova palavra-passe deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
			});
			return;
		}
		if (newPassword !== confirmPassword) {
			setPasswordMsg({
				type: "error",
				text: "As novas palavras-passe não coincidem.",
			});
			return;
		}

		setChangingPassword(true);
		try {
			const { data } = await sendJSON(
				`${backendUrl}/auth/change-password`,
				{
					name: me.name,
					currentPassword,
					newPassword,
				},
			);
			if (!data.ok) {
				setPasswordMsg({
					type: "error",
					text: data.error || "Erro ao alterar palavra-passe.",
				});
			} else {
				setPasswordMsg({
					type: "success",
					text: "Palavra-passe alterada com sucesso! Vais precisar de voltar a iniciar sessão na próxima vez.",
				});
				setCurrentPassword("");
				setNewPassword("");
				setConfirmPassword("");
			}
		} catch {
			setPasswordMsg({ type: "error", text: "Erro de ligação ao servidor." });
		} finally {
			setChangingPassword(false);
		}
	};

	const handleDeleteRoom = (room) => {
		const roomCode = typeof room === "string" ? room : room?.roomCode;
		const leaving =
			typeof room === "object" &&
			room != null &&
			Boolean(room.isMultiplayer) &&
			!room.isAdmin;
		setDeletingRoom({ roomCode, leaving });
	};

	const confirmDeleteRoom = async () => {
		if (!deletingRoom) return;
		const { roomCode, leaving } = deletingRoom;
		setDeletingRoomLoading(true);
		try {
			const { res, data } = await sendJSON(
				`${backendUrl}/saves/${roomCode}`,
				{ name: me.name, token: me.token },
				"DELETE",
			);
			if (data.ok || res.ok) {
				setRooms((prev) => prev.filter((r) => r.roomCode !== roomCode));
				setDeletingRoom(null);
				if (leaving || data.left) {
					setProfileMsg({
						type: "success",
						text: data.message || "Saíste da sala.",
					});
				}
			} else {
				setProfileMsg({ type: "error", text: data.error || (leaving ? "Erro ao sair da sala." : "Erro ao apagar sala.") });
			}
		} catch {
			setProfileMsg({ type: "error", text: "Erro de ligação ao servidor." });
		} finally {
			setDeletingRoomLoading(false);
		}
	};

	const handleSwitchRoom = (roomCode) => {
		if (typeof window !== "undefined") {
			try {
				window.localStorage.setItem(
					"cashballSession",
					JSON.stringify({
						name: me.name,
						token: me.token,
						roomCode,
					}),
				);
			} catch {
				/* localStorage indisponível: entra na mesma, mas a sessão não persiste */
			}
			window.location.reload();
		}
	};

	const handleDeleteAccount = async () => {
		setDeletingAccount("loading");
		setDeleteAccountMsg(null);
		try {
			const { res, data } = await sendJSON(
				`${backendUrl}/auth/delete-account`,
				{ name: me.name, token: me.token },
			);
			if (res.ok && data.ok) {
				try {
					window.localStorage.removeItem("cashballSession");
				} catch {
					/* ignorar */
				}
				window.location.reload();
			} else {
				setDeletingAccount("confirm");
				setDeleteAccountMsg({
					type: "error",
					text: data?.error || "Erro ao apagar conta.",
				});
			}
		} catch {
			setDeletingAccount("confirm");
			setDeleteAccountMsg({ type: "error", text: "Erro de ligação ao servidor." });
		}
	};

	const trophies = palmares?.trophies || [];

	// Todos os clubes das salas do treinador (deduplicados).
	const trainedTeams = Array.from(
		new Set(rooms.map((r) => r.teamName).filter(Boolean)),
	);

	// Sala pendente de confirmação (sair/apagar). Guard contra
	// ModalShell: children avaliados mesmo com visible={false}, por isso
	// o modal só é montado quando deletingRoom != null e tudo usa ?.
	const pendingRoom =
		deletingRoom != null
			? rooms.find((r) => r.roomCode === deletingRoom.roomCode)
			: undefined;
	const pendingRoomName =
		pendingRoom?.roomName || deletingRoom?.roomCode || "";

	const currentYear = new Date().getFullYear();
	const birthYearOptions = [];
	for (let y = currentYear; y >= MIN_BIRTH_YEAR; y--) birthYearOptions.push(y);

	return (
		<div className="space-y-4 short:space-y-2">
		{/* Back */}
		<button
			onClick={onBack}
			className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors"
		>
			<span className="material-symbols-outlined text-[18px]">
				arrow_back
			</span>
			Voltar
		</button>

		{/* Profile (full width) */}
		<Panel
			title="Perfil"
			meta={me?.name || "—"}
			className="bg-surface-container-low border border-outline-variant/25"
		>
			<div className="flex flex-col sm:flex-row items-center gap-5 short:gap-3">
					<div className="flex flex-col items-center gap-2">
					<CoachAvatar
						name={me?.name ?? "?"}
						seed={`${me?.name || "?"}|${avatarSeed}`}
						size="xl"
						coachAvatars={coachAvatars}
						backendUrl={backendUrl}
					/>
					<div className="flex flex-wrap justify-center gap-1.5">
						<button
							onClick={() => fileInputRef.current?.click()}
							disabled={avatarBusy}
							className="flex items-center gap-1 min-w-[44px] text-[9px] font-black uppercase px-1.5 py-1 rounded bg-primary/20 text-primary border border-primary/30 tracking-widest hover:bg-primary/30 transition-colors disabled:opacity-50"
						>
							<span className="material-symbols-outlined text-[12px] leading-none">
								{avatarBusy ? "hourglass_top" : "photo_camera"}
								</span>
							{avatarBusy
								? "A carregar..."
								: hasAvatarImage
									? "Trocar foto"
									: "Carregar foto"}
						</button>
						{hasAvatarImage ? (
							<button
								onClick={handleRemoveAvatar}
								disabled={avatarBusy}
								aria-label="Remover foto de perfil"
								className="flex items-center gap-1 min-w-[44px] text-[9px] font-black uppercase px-1.5 py-1 rounded bg-error/20 text-error border border-error/30 tracking-widest hover:bg-error/30 transition-colors disabled:opacity-50"
							>
								<span className="material-symbols-outlined text-[12px] leading-none">
									delete
								</span>
								Remover
							</button>
						) : (
							<button
								onClick={handleRegenerateAvatar}
								aria-label="Gerar novo avatar"
								className="flex items-center gap-1 min-w-[44px] text-[9px] font-black uppercase px-1.5 py-1 rounded bg-primary/20 text-primary border border-primary/30 tracking-widest hover:bg-primary/30 transition-colors"
							>
								<span className="material-symbols-outlined text-[12px] leading-none">
									refresh
								</span>
								Gerar avatar
							</button>
						)}
					</div>
					<input
						ref={fileInputRef}
						type="file"
						accept="image/png,image/jpeg,image/webp"
						className="hidden"
						onChange={handleAvatarFilePicked}
					/>
					{avatarImgMsg && (
						<span
							role={avatarImgMsg.type === "success" ? "status" : "alert"}
							className={`text-[9px] font-black uppercase px-1.5 py-px rounded tracking-widest ${
								avatarImgMsg.type === "success"
									? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
									: "bg-error/20 text-error border border-error/30"
							}`}
						>
							{avatarImgMsg.text}
						</span>
					)}
				</div>
					<div className="text-center sm:text-left flex-1">
						<p className="text-sm text-on-surface-variant font-bold">
							{teamInfo?.name || "Sem equipa"}
						</p>
						<p className="text-[8px] text-on-surface-variant/60 font-bold uppercase tracking-widest mt-0.5">
							SALA: {me?.roomName || me?.roomCode || "—"}
						</p>
						<div className="flex flex-wrap gap-3 short:gap-2 mt-3 short:mt-1.5">
							<div className="flex-1 min-w-[200px]">
								<label htmlFor="profile-email" className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant block mb-1">
									Email
								</label>
								<input
									id="profile-email"
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									placeholder="Email (opcional)"
									className="w-full bg-surface border border-outline-variant/30 rounded-md px-3 py-2 text-[10px] font-black uppercase tracking-widest text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/60 transition-colors"
								/>
							</div>
							<div className="w-28">
								<label htmlFor="profile-birth-year" className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant block mb-1">
									Ano nasc.
								</label>
								<select
									id="profile-birth-year"
									value={birthYear}
									onChange={(e) => setBirthYear(e.target.value)}
									className="w-full bg-surface border border-outline-variant/30 rounded-md px-3 py-2 text-[10px] font-black uppercase tracking-widest text-on-surface focus:outline-none focus:border-primary/60 transition-colors"
								>
									<option value="">Ano</option>
									{birthYearOptions.map((y) => (
										<option key={y} value={y}>
											{y}
										</option>
									))}
								</select>
							</div>
						</div>
						<div className="flex items-center gap-2 mt-2">
							<button
								onClick={handleSaveProfile}
								disabled={profileSaving}
								className="text-[9px] font-black uppercase px-1.5 py-px rounded bg-primary/20 text-primary border border-primary/30 tracking-widest hover:bg-primary/30 transition-colors disabled:opacity-50"
							>
								{profileSaving ? "A guardar..." : "Guardar Perfil"}
							</button>
							{profileMsg && (
								<span
									role={profileMsg.type === "success" ? "status" : "alert"}
									className={`text-[9px] font-black uppercase px-1.5 py-px rounded ${
										profileMsg.type === "success"
											? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 tracking-widest"
											: "bg-error/20 text-error border border-error/30 tracking-widest"
									} tracking-widest`}
								>
									{profileMsg.text}
								</span>
							)}
						</div>
					</div>
			</div>
		</Panel>

		{/* 2-column grid on md+ */}
		<div className="md:grid md:grid-cols-2 md:gap-4 short:gap-2">
			{/* Palmarés */}
			<Panel
				title="Conquistas"
				icon="emoji_events"
				meta={`${trophies.length} troféus`}
			>
				{trophies.length === 0 ? (
					<EmptyState emoji="🏆" title="Ainda sem conquistas" />
				) : (
					<div className="space-y-2">
						{trophies.map((t, i) => (
							<div
								key={`${t.season}-${t.achievement}-${i}`}
								className="flex items-center gap-3 py-2 px-3 rounded-md bg-gradient-to-r from-amber-500/4 via-surface-container/70 to-surface/30 border border-outline-variant/10"
							>
								<span className="text-xl">🏆</span>
								<div className="flex-1 min-w-0">
									<p className="text-sm font-black uppercase tracking-tight text-on-surface truncate">
										{t.achievement}
									</p>
									<p className="text-[8px] text-on-surface-variant/60 font-bold uppercase tracking-widest mt-0.5">
										TEMPORADA {t.season} · {t.team_name}
									</p>
								</div>
							</div>
						))}
					</div>
				)}
			</Panel>

			{/* Clubes Treinados */}
			<Panel
				title="Clubes Treinados"
				icon="groups"
				meta={`${trainedTeams.length} clubes`}
			>
				{trainedTeams.length === 0 ? (
					<EmptyState emoji="⚽" title="Ainda sem clubes treinados" />
				) : (
					<div className="space-y-2">
						{trainedTeams.map((team) => (
							<div
								key={team}
								className="flex items-center gap-3 py-2 px-3 rounded-md bg-gradient-to-r from-blue-500/4 via-surface-container/70 to-surface/30 border border-outline-variant/10"
							>
								<span className="text-xl">⚽</span>
								<div className="flex-1 min-w-0">
									<p className="text-sm font-black uppercase tracking-tight text-on-surface truncate">
										{team}
									</p>
								</div>
							</div>
						))}
					</div>
				)}
			</Panel>

			{/* Change Password */}
			<Panel title="Palavra-Passe" icon="lock">
				<div className="p-3 md:p-4 short:p-2 space-y-4 short:space-y-2">
					<div>
						<label htmlFor="pw-current" className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant block mb-1">
							Palavra-passe atual
						</label>
						<input
							id="pw-current"
							type="password"
							value={currentPassword}
							onChange={(e) => setCurrentPassword(e.target.value)}
							className="w-full bg-surface border border-outline-variant/30 rounded-md px-4 short:px-3 py-2.5 short:py-1.5 text-[10px] font-black uppercase tracking-widest text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/60 transition-colors"
							placeholder="••••••••"
						/>
					</div>
					<div>
						<label htmlFor="pw-new" className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant block mb-1">
							Nova palavra-passe (mín. {MIN_PASSWORD_LENGTH} caracteres)
						</label>
						<input
							id="pw-new"
							type="password"
							value={newPassword}
							onChange={(e) => setNewPassword(e.target.value)}
							className="w-full bg-surface border border-outline-variant/30 rounded-md px-4 short:px-3 py-2.5 short:py-1.5 text-[10px] font-black uppercase tracking-widest text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/60 transition-colors"
							placeholder="••••••••"
						/>
					</div>
					<div>
						<label htmlFor="pw-confirm" className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant block mb-1">
							Confirmar nova palavra-passe
						</label>
						<input
							id="pw-confirm"
							type="password"
							value={confirmPassword}
							onChange={(e) => setConfirmPassword(e.target.value)}
							className="w-full bg-surface border border-outline-variant/30 rounded-md px-4 short:px-3 py-2.5 short:py-1.5 text-[10px] font-black uppercase tracking-widest text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/60 transition-colors"
							placeholder="••••••••"
						/>
					</div>

					{passwordMsg && (
						<div
							role={passwordMsg.type === "success" ? "status" : "alert"}
							className={`text-[9px] font-black uppercase px-4 py-2 rounded-md border tracking-widest ${
								passwordMsg.type === "success"
									? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
									: "bg-error/10 text-error border border-error/20"
							}`}
						>
							<span className="material-symbols-outlined text-[14px] align-text-bottom mr-1">
								{passwordMsg.type === "success" ? "check_circle" : "error"}
							</span>
							{passwordMsg.text}
						</div>
					)}

					<Button
						variant="primary"
						size="lg"
						full
						disabled={changingPassword}
						onClick={handleChangePassword}
					>
						{changingPassword ? "A guardar..." : "Guardar"}
					</Button>
				</div>
			</Panel>

			{/* My Rooms */}
			<Panel
				title="Salas"
				icon="meeting_room"
				meta={`${rooms.length} salas`}
			>
				{roomsLoading ? (
					<EmptyState emoji="⏳" title="A carregar..." />
				) : rooms.length === 0 ? (
					<EmptyState emoji="🏠" title="Nenhuma sala encontrada" />
				) : (
					<div className="space-y-2">
						{rooms.map((r) => {
							const isActive = r.roomCode === me?.roomCode;
							// Salas multiplayer só podem ser apagadas pelo Admin;
							// os restantes treinadores apenas saem da sala.
							const canDelete = !r.isMultiplayer || r.isAdmin;
							return (
								<div
									key={r.roomCode}
									className="relative group flex items-center justify-between py-2.5 px-3 rounded-md bg-gradient-to-r from-sky-500/4 via-surface-container/70 to-surface/30 border border-outline-variant/10 transition-all duration-200 hover:-translate-y-px hover:shadow-lg hover:shadow-black/30"
								>
									{/* Faixa lateral */}
									<div className="shrink-0 w-1 bg-gradient-to-b from-sky-300 via-sky-400 to-sky-600 rounded-l-md" />

									<div className="flex items-center gap-3 min-w-0 ml-1 flex-1">
										<span className="material-symbols-outlined text-[18px] text-on-surface-variant shrink-0">
											meeting_room
										</span>
										<div className="min-w-0">
											<p className="text-sm font-black uppercase tracking-tight text-on-surface truncate">
												{r.roomName}
											</p>
											<p className="text-[8px] text-on-surface-variant/50 font-bold uppercase tracking-widest mt-0.5 truncate">
												{r.roomCode}
											</p>
											{r.coaches && r.coaches.length > 0 && (
												<Badge variant="warning" className="hidden sm:inline-block mt-1">
													{r.coaches.join(", ")}
												</Badge>
											)}
										</div>
									</div>
									<div className="flex items-center gap-2 shrink-0">
										{r.teamName && (
											<Badge
												className="hidden sm:inline-block bg-blue-500/20 text-blue-400 border-blue-500/30"
											>
												{r.teamName}
											</Badge>
										)}
										{r.isMultiplayer && (
											<Badge
												variant={r.isAdmin ? "info" : "neutral"}
												className="hidden sm:inline-block"
												title={r.isAdmin ? "És o Admin desta sala" : "Sala multijogador"}
											>
												{r.isAdmin ? "Admin" : `${r.coachCount || 2} treinadores`}
											</Badge>
										)}
										<Button
											variant={isActive ? "secondary" : "primary"}
											size="sm"
											disabled={isActive}
											onClick={() => handleSwitchRoom(r.roomCode)}
										>
											{isActive ? "Atual" : "Entrar"}
										</Button>
										{!isActive && (
											<button
												onClick={() => handleDeleteRoom(r)}
												aria-label={canDelete ? `Eliminar sala ${r.roomName}` : `Sair da sala ${r.roomName}`}
												className="text-[9px] font-black uppercase px-2 py-1 rounded border border-red-500/15 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
												title={canDelete ? "Eliminar sala" : "Sair da sala (multijogador: só o Admin pode apagar)"}
											>
												<span className="material-symbols-outlined text-[16px] leading-none">
													{canDelete ? "delete" : "logout"}
												</span>
											</button>
										)}
									</div>
								</div>
							);
						})}
					</div>
				)}
			</Panel>

			{/* Actions */}
			<Panel title="Acções" icon="settings" className="md:col-span-2">
				<Button
					variant="secondary"
					size="lg"
					full
					onClick={onLeaveRoom}
				>
					<span className="material-symbols-outlined text-[18px]">
						logout
					</span>
					Sair da Sala
				</Button>
					{deletingAccount !== "confirm" ? (
						<Button
							variant="ghost"
							size="lg"
							full
							className="bg-transparent border border-error/15 text-error/60 hover:text-error hover:bg-error/5"
							onClick={() => {
								setDeletingAccount("confirm");
								setDeleteAccountMsg(null);
							}}
						>
							<span className="material-symbols-outlined text-[18px]">
								delete_forever
							</span>
							Apagar Conta
						</Button>
					) : (
						<div className="bg-error/5 border border-error/20 rounded-md p-4 space-y-3">
							<p className="text-[9px] font-black uppercase text-error text-center tracking-widest">
								Tens a certeza? Esta ação é irreversível.
							</p>
							{deleteAccountMsg && (
								<p role="alert" className="text-[9px] font-black uppercase text-error text-center tracking-widest">
									{deleteAccountMsg.text}
								</p>
							)}
							<div className="flex gap-2">
								<Button
									variant="secondary"
									className="flex-1"
									onClick={() => setDeletingAccount(false)}
								>
									Cancelar
								</Button>
								<Button
									variant="dangerSoft"
									className="flex-1"
									disabled={deletingAccount === "loading"}
									onClick={handleDeleteAccount}
								>
									{deletingAccount === "loading"
										? "A apagar..."
										: "Sim, Apagar"}
								</Button>
							</div>
						</div>
					)}
			</Panel>
		</div>

		{/* Confirmar sair/apagar sala (só montado com sala pendente) */}
		{deletingRoom != null && (
			<ModalShell
				visible
				variant="card"
				dismissable
				onClose={() => {
					if (!deletingRoomLoading) setDeletingRoom(null);
				}}
			>
				<div className="p-4 space-y-3">
					<p role="alert" className="text-[10px] font-black uppercase text-red-400 text-center tracking-widest">
						{deletingRoom.leaving ? (
							<>
								Vais sair da sala<br />
								<strong className="text-on-surface">{pendingRoomName}</strong>. A sala continua para os outros treinadores.
							</>
						) : pendingRoom?.isMultiplayer ? (
							<>
								Tem a certeza que deseja eliminar a sala<br />
								<strong className="text-on-surface">{pendingRoomName}</strong>? És o Admin: será apagada para TODOS os treinadores.
							</>
						) : (
							<>
								Tem a certeza que deseja eliminar a sala<br />
								<strong className="text-on-surface">{pendingRoomName}</strong>? Esta ação é irreversível.
							</>
						)}
					</p>
					<div className="flex gap-2">
						<Button
							variant="secondary"
							size="sm"
							className="flex-1"
							disabled={deletingRoomLoading}
							onClick={() => setDeletingRoom(null)}
						>
							Cancelar
						</Button>
						<Button
							variant="dangerSoft"
							size="sm"
							className="flex-1"
							disabled={deletingRoomLoading}
							onClick={confirmDeleteRoom}
						>
							{deletingRoomLoading
								? deletingRoom.leaving
									? "A sair..."
									: "A eliminar..."
								: deletingRoom.leaving
									? "Sim, sair"
									: "Sim, eliminar"}
						</Button>
					</div>
				</div>
			</ModalShell>
		)}
	</div>
);
}
