import { AnimatePresence, motion } from "framer-motion";
import RoomSelectScreen from "./RoomSelectScreen.jsx";
import LandingBackground from "./LandingBackground.jsx";
import LandingHeader from "./LandingHeader.jsx";
import HeroSection from "./HeroSection.jsx";
import AuthCard from "./AuthCard.jsx";
import LoginForm from "./LoginForm.jsx";
import RegisterForm from "./RegisterForm.jsx";
import ReconnectScreen from "./ReconnectScreen.jsx";
import ShowcaseSections from "./ShowcaseSections.jsx";
import LandingFooter from "./LandingFooter.jsx";

/**
 * Composition root da página de entrada. Sem estado próprio: apenas decide o que
 * mostrar (reconexão, landing com hero + autenticação, ou escolha de sala) e
 * liga os formulários aos handlers de auth do `App`.
 *
 * @param {Object} props
 * @param {string} props.authPhase - "login" | "register" | "mode"
 * @param {(v: string) => void} props.setAuthPhase
 * @param {() => void} props.resetAuthFlow
 * @param {(mode: string) => void} props.handleAuthenticate
 * @param {Object|null} props.me - O utilizador (para mostrar reconexão)
 * @param {(v: string) => void} props.setJoinError
 * @param {boolean} [props.disconnected] - Sempre undefined na landing (vive no GameContext, em jogo)
 * @param {Object} props.form - name, setName, password, setPassword, confirmPassword, setConfirmPassword, authSubmitting, authError, setAuthError
 * @param {Object} props.room - Tudo o que é só do RoomSelectScreen (roomCode, setRoomCode, joining, joinError, joinMode, selectJoinMode, handleLogout, handleJoin, token, isNewAccount, availableSaves, setAvailableSaves, backendUrl)
 * @returns {JSX.Element}
 */
const LandingPage = ({
	authPhase,
	setAuthPhase,
	resetAuthFlow,
	handleAuthenticate,
	me,
	setJoinError,
	disconnected,
	form,
	room,
}) => {
	// 1. Reconnecting State
	if (me && !me.teamId) {
		return <ReconnectScreen me={me} />;
	}

	const isMode = authPhase === "mode";

	const clearAuthError = () => form.setAuthError("");
	const createAccount = () => {
		form.setConfirmPassword("");
		form.setAuthError("");
		setJoinError("");
		setAuthPhase("register");
	};

	return (
		<div className="min-h-screen bg-bg text-on-surface flex flex-col relative overflow-x-clip">
			{/* Fundo do jogo — brilhos primary/tertiary + giz */}
			<LandingBackground />

			<LandingHeader />

			<AnimatePresence mode="wait">
				{isMode ? (
					<RoomSelectScreen
						key="room-select"
						{...room}
						name={form.name}
						disconnected={disconnected}
						resetAuthFlow={resetAuthFlow}
					/>
				) : (
					<motion.div
						key="landing"
						initial={false}
						exit={{
							opacity: 0,
							y: -12,
							transition: { duration: 0.35, ease: "easeIn" },
						}}
						className="flex flex-1 flex-col min-h-0"
					>
						{/* Hero + Auth card */}
						<div className="relative z-10 flex-1 flex flex-col short:flex-row lg:flex-row items-center justify-center gap-12 lg:gap-16 px-6 sm:px-10 lg:px-16 py-14 short:gap-8 short:py-4 max-w-7xl mx-auto w-full">
							<HeroSection />

							{/* Right: Auth glass card */}
							<motion.div
								initial={{ opacity: 0, x: 30 }}
								animate={{ opacity: 1, x: 0 }}
								transition={{ duration: 0.6, ease: "easeOut" }}
								className="w-full short:w-[60%] lg:w-1/2 flex justify-center lg:justify-end"
							>
								<AuthCard>
									<AnimatePresence mode="wait">
										{authPhase === "register" ? (
											<RegisterForm
												form={form}
												disconnected={disconnected}
												onClearError={clearAuthError}
												onSubmit={() => handleAuthenticate("register")}
												onBack={resetAuthFlow}
											/>
										) : (
											<LoginForm
												form={form}
												disconnected={disconnected}
												onClearError={clearAuthError}
												onSubmit={() => handleAuthenticate("login")}
												onCreateAccount={createAccount}
											/>
										)}
									</AnimatePresence>
								</AuthCard>
							</motion.div>
						</div>

						<ShowcaseSections />
						<LandingFooter />
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
};

export default LandingPage;
