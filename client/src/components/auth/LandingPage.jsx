import { AnimatePresence, motion } from "framer-motion";
import RoomSelectScreen from "./RoomSelectScreen.jsx";
import ParticleCanvas from "./ParticleCanvas.jsx";
import LandingBackground from "./LandingBackground.jsx";
import LandingHeader from "./LandingHeader.jsx";
import HeroSection from "./HeroSection.jsx";
import AuthCard from "./AuthCard.jsx";
import LoginForm from "./LoginForm.jsx";
import RegisterForm from "./RegisterForm.jsx";
import ReconnectScreen from "./ReconnectScreen.jsx";
import FeaturesStrip from "./FeaturesStrip.jsx";
import LandingFooter from "./LandingFooter.jsx";

/**
 * @typedef {Object} LandingPageProps
 * @property {string} authPhase - "login" | "register" | "mode"
 * @property {function} setAuthPhase
 * @property {string} name
 * @property {function} setName
 * @property {string} password
 * @property {function} setPassword
 * @property {string} confirmPassword
 * @property {function} setConfirmPassword
 * @property {string} roomCode
 * @property {function} setRoomCode
 * @property {boolean} authSubmitting
 * @property {string} authError
 * @property {function} setAuthError
 * @property {boolean} isNewAccount
 * @property {boolean} joining
 * @property {boolean} disconnected
 * @property {string} joinError
 * @property {function} setJoinError
 * @property {function} handleAuthenticate
 * @property {function} handleJoin
 * @property {function} resetAuthFlow
 * @property {function} selectJoinMode
 * @property {string|null} joinMode
 * @property {function} handleLogout
 * @property {Object|null} me - The user object (to show reconnection status)
 * @property {string|null} token - The session token (used for authenticated API calls)
 * @property {Array} availableSaves - The list of available saves
 * @property {function} setAvailableSaves
 * @property {string} backendUrl
 */

/**
 * Composition root da página de entrada. Sem estado próprio: apenas decide o que
 * mostrar (reconexão, landing com hero + autenticação, ou escolha de sala) e
 * liga os formulários aos handlers de auth do `App`.
 *
 * @param {LandingPageProps} props
 * @returns {JSX.Element}
 */
const LandingPage = ({
	authPhase,
	setAuthPhase,
	name,
	setName,
	password,
	setPassword,
	confirmPassword,
	setConfirmPassword,
	roomCode,
	setRoomCode,
	authSubmitting,
	authError,
	setAuthError,
	isNewAccount,
	joining,
	disconnected,
	joinError,
	setJoinError,
	handleAuthenticate,
	handleJoin,
	resetAuthFlow,
	selectJoinMode,
	joinMode,
	handleLogout,
	me,
	token,
	availableSaves,
	setAvailableSaves,
	backendUrl,
}) => {
	// 1. Reconnecting State
	if (me && !me.teamId) {
		return <ReconnectScreen me={me} />;
	}

	const isMode = authPhase === "mode";

	const clearAuthError = () => setAuthError("");
	const createAccount = () => {
		setConfirmPassword("");
		setAuthError("");
		setJoinError("");
		setAuthPhase("register");
	};

	return (
		<div
			className={`min-h-screen bg-landing-bg text-white flex flex-col relative ${
				isMode ? "" : "pb-16 short:pb-0"
			}`}
		>
			<ParticleCanvas />

			{/* Background layers — relvado de noite + quadro tático */}
			<LandingBackground />

			<LandingHeader />

			<AnimatePresence mode="wait">
				{isMode ? (
					<RoomSelectScreen
						key="room-select"
						name={name}
						availableSaves={availableSaves}
						setAvailableSaves={setAvailableSaves}
						roomCode={roomCode}
						setRoomCode={setRoomCode}
						joining={joining}
						joinError={joinError}
						disconnected={disconnected}
						resetAuthFlow={resetAuthFlow}
						joinMode={joinMode}
						selectJoinMode={selectJoinMode}
						handleLogout={handleLogout}
						token={token}
						isNewAccount={isNewAccount}
						handleJoin={handleJoin}
						backendUrl={backendUrl}
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
										{authPhase === "login" ? (
											<LoginForm
												name={name}
												setName={setName}
												password={password}
												setPassword={setPassword}
												authSubmitting={authSubmitting}
												authError={authError}
												disconnected={disconnected}
												onClearError={clearAuthError}
												onSubmit={() => handleAuthenticate("login")}
												onCreateAccount={createAccount}
											/>
										) : (
											<RegisterForm
												name={name}
												setName={setName}
												password={password}
												setPassword={setPassword}
												confirmPassword={confirmPassword}
												setConfirmPassword={setConfirmPassword}
												authSubmitting={authSubmitting}
												authError={authError}
												disconnected={disconnected}
												onClearError={clearAuthError}
												onSubmit={() => handleAuthenticate("register")}
												onBack={resetAuthFlow}
											/>
										)}
									</AnimatePresence>
								</AuthCard>
							</motion.div>
						</div>

						<FeaturesStrip />
						<LandingFooter />
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
};

export default LandingPage;
