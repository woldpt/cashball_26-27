import { useState, useEffect } from "react";
import { PlayerAvatar } from "../components/shared/PlayerAvatar.jsx";

export function UserSettingsPage({
	me,
	teamInfo,
	palmares,
	backendUrl,
	avatarSeed,
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
	const [email, setEmail] = useState("");
	const [birthYear, setBirthYear] = useState("");
	const [profileSaving, setProfileSaving] = useState(false);
	const [profileMsg, setProfileMsg] = useState(null);
	const [deletingRoom, setDeletingRoom] = useState(null); // null | { roomCode, password }
	const [deletingRoomLoading, setDeletingRoomLoading] = useState(false);

	useEffect(() => {
		if (!me?.name) return;
		fetch(`${backendUrl}/auth/manager-info?name=${encodeURIComponent(me.name)}`)
			.then((r) => r.json())
			.then((data) => {
				if (Array.isArray(data?.rooms)) setRooms(data.rooms);
				if (data?.email !== undefined) setEmail(data.email);
				if (data?.birthYear) setBirthYear(String(data.birthYear));
			})
			.catch(() => {
				/* ignorar */
			})
			.finally(() => setRoomsLoading(false));
	}, [me?.name, backendUrl]);

	const handleSaveProfile = async () => {
		setProfileMsg(null);
		setProfileSaving(true);
		try {
			const body = { name: me.name };
			if (email?.trim()) body.email = email.trim();
			if (birthYear) body.birthYear = parseInt(birthYear, 10);
			const res = await fetch(`${backendUrl}/auth/update-profile`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			const data = await res.json();
			if (data.ok) {
				setProfileMsg({ type: "success", text: "Perfil actualizado!" });
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
		if (newPassword.length < 3) {
			setPasswordMsg({
				type: "error",
				text: "A nova palavra-passe deve ter pelo menos 3 caracteres.",
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
			const res = await fetch(`${backendUrl}/auth/change-password`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: me.name,
					currentPassword,
					newPassword,
				}),
			});
			const data = await res.json();
			if (!data.ok) {
				setPasswordMsg({
					type: "error",
					text: data.error || "Erro ao alterar palavra-passe.",
				});
			} else {
				setPasswordMsg({
					type: "success",
					text: "Palavra-passe alterada com sucesso!",
				});
				setCurrentPassword("");
				setNewPassword("");
				setConfirmPassword("");
				try {
					const s = JSON.parse(
						window.localStorage.getItem("cashballSession") || "{}",
					);
					s.password = newPassword;
					window.localStorage.setItem("cashballSession", JSON.stringify(s));
				} catch (_a) {
					_a && undefined; /* ignorar */
				}
			}
		} catch (_b) {
			_b && undefined; /* ignorar */
			setPasswordMsg({ type: "error", text: "Erro de ligação ao servidor." });
		} finally {
			setChangingPassword(false);
		}
	};

	const handleDeleteRoom = (roomCode, password) => {
		setDeletingRoom({ roomCode, password });
	};

	const confirmDeleteRoom = async () => {
		if (!deletingRoom) return;
		const { roomCode, password } = deletingRoom;
		setDeletingRoom(null);
		setDeletingRoomLoading(true);
		try {
			const res = await fetch(`${backendUrl}/saves/${roomCode}`, {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: me.name, password }),
			});
			const data = await res.json();
			if (data.ok) {
				setRooms((prev) => prev.filter((r) => r.roomCode !== roomCode));
			} else {
				setProfileMsg({ type: "error", text: data.error || "Erro ao apagar sala." });
			}
		} catch {
			setProfileMsg({ type: "error", text: "Erro de ligação ao servidor." });
		} finally {
			setDeletingRoomLoading(false);
		}
	};

	const handleSwitchRoom = (roomCode) => {
		if (typeof window !== "undefined") {
			if (me?.roomCode) {
				try {
					window.localStorage.setItem(
						"cashballSession",
						JSON.stringify({
							name: me.name,
							password: me.password,
							roomCode,
						}),
					);
				} catch (_e) {
					_e && undefined; /* ignorar */
				}
			}
			window.location.reload();
		}
	};

	const handleDeleteAccount = async () => {
		setDeletingAccount("loading");
		try {
			const res = await fetch(`${backendUrl}/auth/delete-account`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: me.name }),
			});
			const data = await res.json();
			if (data.ok) {
				try {
					window.localStorage.removeItem("cashballSession");
				} catch {
					/* ignorar */
				}
				window.location.reload();
			} else {
				setDeletingAccount(false);
			}
		} catch {
			setDeletingAccount(false);
		}
	};

	const trophies = palmares?.trophies || [];

	const trainedTeams = Array.from(
		new Set(
			rooms
				.filter((r) => r.roomCode === me?.roomCode)
				.map((r) => r.teamName)
				.filter(Boolean),
		),
	);

	return (
		<div className="space-y-4">
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
		<div className="bg-surface-container-low border border-outline-variant/25 rounded-md overflow-hidden">
			<div className="px-5 py-4 flex items-center justify-between bg-surface-container-high/50">
				<h2 className="text-base font-black font-headline tracking-tight text-tertiary uppercase">
					Perfil
				</h2>
				<span className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">
					{me?.name || "—"}
				</span>
			</div>
			<div className="p-3 md:p-4">
				<div className="flex flex-col sm:flex-row items-center gap-5">
					<div className="relative group shrink-0">
						<PlayerAvatar seed={`${me?.name || "?"}|${avatarSeed}`} size="xl" />
						<button
							onClick={() => {
								const newSeed = Math.random().toString(36).slice(2, 10);
								onAvatarSeedChange(newSeed);
								fetch(`${backendUrl}/auth/avatar-seed`, {
									method: "POST",
									headers: { "Content-Type": "application/json" },
									body: JSON.stringify({ name: me.name, seed: newSeed }),
								}).catch(() => {
									/* ignorar */
								});
							}}
							title="Gerar novo avatar"
							className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant/40 text-on-surface flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-surface-bright"
						>
							<span className="material-symbols-outlined text-[16px] leading-none">
								refresh
							</span>
						</button>
					</div>
					<div className="text-center sm:text-left flex-1">
						<p className="text-sm text-on-surface-variant font-bold">
							{teamInfo?.name || "Sem equipa"}
						</p>
						<p className="text-[8px] text-on-surface-variant/60 font-bold uppercase tracking-widest mt-0.5">
							SALA: {me?.roomName || me?.roomCode || "—"}
						</p>
						<div className="flex flex-wrap gap-3 mt-3">
							<input
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="Email (opcional)"
								className="flex-1 min-w-[200px] bg-surface border border-outline-variant/30 rounded-md px-3 py-2 text-[10px] font-black uppercase tracking-widest text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/60 transition-colors"
							/>
							<select
								value={birthYear}
								onChange={(e) => setBirthYear(e.target.value)}
								className="w-28 bg-surface border border-outline-variant/30 rounded-md px-3 py-2 text-[10px] font-black uppercase tracking-widest text-on-surface focus:outline-none focus:border-primary/60 transition-colors"
							>
								<option value="">Ano</option>
								{Array.from({ length: 71 }, (_, i) => 1940 + i)
									.reverse()
									.map((y) => (
										<option key={y} value={y}>
											{y}
										</option>
									))}
							</select>
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
			</div>
		</div>

		{/* 2-column grid on md+ */}
		<div className="md:grid md:grid-cols-2 md:gap-4">
			{/* Palmarés */}
			<div className="bg-surface-container rounded-md overflow-hidden">
				<div className="px-5 py-4 flex items-center justify-between bg-surface-container-high/50">
					<h2 className="text-base font-black font-headline tracking-tight text-tertiary uppercase flex items-center gap-2">
						<span className="material-symbols-outlined text-[18px]">
							emoji_events
						</span>
						Conquistas
					</h2>
					<span className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">
						{trophies.length} troféus
					</span>
				</div>
				<div className="p-3 md:p-4">
					{trophies.length === 0 ? (
						<div className="py-12 text-center text-zinc-500 text-sm">
							<div className="text-3xl mb-2 opacity-50">🏆</div>
							<p className="font-bold">Ainda sem conquistas</p>
						</div>
					) : (
						<div className="space-y-2">
							{trophies.map((t, i) => (
								<div
									key={i}
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
				</div>
			</div>

			{/* Clubes Treinados */}
			<div className="bg-surface-container rounded-md overflow-hidden">
				<div className="px-5 py-4 flex items-center justify-between bg-surface-container-high/50">
					<h2 className="text-base font-black font-headline tracking-tight text-tertiary uppercase flex items-center gap-2">
						<span className="material-symbols-outlined text-[18px]">
							groups
						</span>
						Clubes Treinados
					</h2>
					<span className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">
						{trainedTeams.length} clubes
					</span>
				</div>
				<div className="p-3 md:p-4">
					{trainedTeams.length === 0 ? (
						<div className="py-12 text-center text-zinc-500 text-sm">
							<div className="text-3xl mb-2 opacity-50">⚽</div>
							<p className="font-bold">Ainda sem clubes treinados</p>
						</div>
					) : (
						<div className="space-y-2">
							{trainedTeams.map((team, i) => (
								<div
									key={i}
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
				</div>
			</div>

			{/* Change Password */}
			<div className="bg-surface-container rounded-md overflow-hidden">
				<div className="px-5 py-4 flex items-center justify-between bg-surface-container-high/50">
					<h2 className="text-base font-black font-headline tracking-tight text-tertiary uppercase flex items-center gap-2">
						<span className="material-symbols-outlined text-[18px]">lock</span>
						Palavra-Passe
					</h2>
				</div>
				<div className="p-3 md:p-4 space-y-4">
					<div>
						<label className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant block mb-1">
							Palavra-passe actual
						</label>
						<input
							type="password"
							value={currentPassword}
							onChange={(e) => setCurrentPassword(e.target.value)}
							className="w-full bg-surface border border-outline-variant/30 rounded-md px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/60 transition-colors"
							placeholder="••••••••"
						/>
					</div>
					<div>
						<label className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant block mb-1">
							Nova palavra-passe
						</label>
						<input
							type="password"
							value={newPassword}
							onChange={(e) => setNewPassword(e.target.value)}
							className="w-full bg-surface border border-outline-variant/30 rounded-md px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/60 transition-colors"
							placeholder="••••••••"
						/>
					</div>
					<div>
						<label className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant block mb-1">
							Confirmar nova palavra-passe
						</label>
						<input
							type="password"
							value={confirmPassword}
							onChange={(e) => setConfirmPassword(e.target.value)}
							className="w-full bg-surface border border-outline-variant/30 rounded-md px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/60 transition-colors"
							placeholder="••••••••"
						/>
					</div>

					{passwordMsg && (
						<div
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

					<button
						type="submit"
						disabled={changingPassword}
						className="w-full bg-primary text-on-primary font-black text-[10px] uppercase tracking-widest rounded-md px-5 py-3 hover:bg-primary/90 transition-colors disabled:opacity-50"
						onClick={handleChangePassword}
					>
						{changingPassword ? "A guardar..." : "Guardar"}
					</button>
				</div>
			</div>

			{/* My Rooms */}
			<div className="bg-surface-container rounded-md overflow-hidden">
				<div className="px-5 py-4 flex items-center justify-between bg-surface-container-high/50">
					<h2 className="text-base font-black font-headline tracking-tight text-tertiary uppercase flex items-center gap-2">
						<span className="material-symbols-outlined text-[18px]">
							meeting_room
						</span>
						Salas
					</h2>
					<span className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">
						{rooms.length} salas
					</span>
				</div>
				<div className="p-3 md:p-4 space-y-2">
					{roomsLoading ? (
						<div className="py-12 text-center text-zinc-500 text-sm">
							<div className="text-3xl mb-2 opacity-50">⏳</div>
							<p className="font-bold">A carregar...</p>
						</div>
					) : rooms.length === 0 ? (
						<div className="py-12 text-center text-zinc-500 text-sm">
							<div className="text-3xl mb-2 opacity-50">🏠</div>
							<p className="font-bold">Nenhuma sala encontrada</p>
						</div>
					) : (
						rooms.map((r) => {
							const isActive = r.roomCode === me?.roomCode;
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
												<span className="text-[9px] font-black uppercase px-1.5 py-px rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 tracking-widest hidden sm:inline-block mt-1">
													{r.coaches.join(", ")}
												</span>
											)}
										</div>
									</div>
									<div className="flex items-center gap-2 shrink-0">
										{r.teamName && (
											<span className="text-[9px] font-black uppercase px-1.5 py-px rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 tracking-widest hidden sm:inline-block">
												{r.teamName}
											</span>
										)}
										<button
											onClick={() => handleSwitchRoom(r.roomCode)}
											disabled={isActive}
											className={`text-[9px] font-black uppercase px-2 py-1 rounded border tracking-widest transition-colors ${
												isActive
													? "text-on-surface-variant/30 bg-surface-container border border-outline-variant/10 cursor-not-allowed"
													: "text-primary bg-primary/20 border border-primary/30 hover:bg-primary/30"
											}`}
										>
											{isActive ? "Actual" : "Entrar"}
										</button>
										{!isActive && (
											<button
												onClick={() => handleDeleteRoom(r.roomCode, me.password)}
												className="text-[9px] font-black uppercase px-2 py-1 rounded border border-red-500/15 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
												title="Eliminar sala"
											>
												<span className="material-symbols-outlined text-[16px] leading-none">
													delete
												</span>
											</button>
										)}
									</div>
									{deletingRoom?.roomCode === r.roomCode && (
										<div className="absolute inset-0 bg-surface/90 backdrop-blur-sm rounded-md flex flex-col items-center justify-center gap-2 z-10">
											<p className="text-[9px] font-black uppercase text-red-400 text-center px-4 tracking-widest">
												Tem a certeza que deseja eliminar a sala<br />
												<strong className="text-on-surface">{r.roomName}</strong>? Esta acção é irreversível.
											</p>
											<div className="flex gap-2">
												<button
													onClick={(e) => {
														e.stopPropagation();
														setDeletingRoom(null);
													}}
													disabled={deletingRoomLoading}
													className="text-[9px] font-black uppercase tracking-widest bg-surface-container-low border border-outline-variant/20 text-on-surface px-3 py-1.5 rounded-md hover:bg-surface-bright transition-colors disabled:opacity-50"
												>
													Cancelar
												</button>
												<button
													onClick={(e) => {
														e.stopPropagation();
														confirmDeleteRoom();
													}}
													disabled={deletingRoomLoading}
													className="text-[9px] font-black uppercase tracking-widest bg-error/20 border border-error/30 text-error px-3 py-1.5 rounded-md hover:bg-error/30 transition-colors disabled:opacity-50"
												>
													{deletingRoomLoading ? "A eliminar..." : "Sim, eliminar"}
												</button>
											</div>
										</div>
									)}
								</div>
							);
						})
					)}
				</div>
			</div>

			{/* Actions */}
			<div className="md:col-span-2 bg-surface-container rounded-md overflow-hidden">
				<div className="px-5 py-4 flex items-center justify-between bg-surface-container-high/50">
					<h2 className="text-base font-black font-headline tracking-tight text-tertiary uppercase flex items-center gap-2">
						<span className="material-symbols-outlined text-[18px]">
							settings
						</span>
						Acções
					</h2>
				</div>
				<div className="p-3 md:p-4 space-y-3">
					<button
						onClick={onLeaveRoom}
						className="w-full flex items-center justify-center gap-2 bg-surface border border-outline-variant/20 text-on-surface font-black text-[10px] uppercase tracking-widest rounded-md px-5 py-3 hover:bg-surface-bright transition-colors"
					>
						<span className="material-symbols-outlined text-[18px]">
							logout
						</span>
						Sair da Sala
					</button>
					{deletingAccount !== "confirm" ? (
						<button
							onClick={() => setDeletingAccount("confirm")}
							className="w-full flex items-center justify-center gap-2 bg-transparent border border-error/15 text-error/60 font-black text-[10px] uppercase tracking-widest rounded-md px-5 py-3 hover:bg-error/5 hover:text-error transition-colors"
						>
							<span className="material-symbols-outlined text-[18px]">
								delete_forever
							</span>
							Apagar Conta
						</button>
					) : (
						<div className="bg-error/5 border border-error/20 rounded-md p-4 space-y-3">
							<p className="text-[9px] font-black uppercase text-error text-center tracking-widest">
								Tens a certeza? Esta acção é irreversível.
							</p>
							<div className="flex gap-2">
								<button
									onClick={() => setDeletingAccount(false)}
									className="flex-1 bg-surface border border-outline-variant/20 text-on-surface font-black text-[10px] uppercase tracking-widest rounded-md px-4 py-2.5 hover:bg-surface-bright transition-colors"
								>
									Cancelar
								</button>
								<button
									onClick={handleDeleteAccount}
									disabled={deletingAccount === "loading"}
									className="flex-1 bg-error/20 border border-error/30 text-error font-black text-[10px] uppercase tracking-widest rounded-md px-4 py-2.5 hover:bg-error/30 transition-colors disabled:opacity-50"
								>
									{deletingAccount === "loading"
										? "A apagar..."
										: "Sim, Apagar"}
								</button>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	</div>
);
}
