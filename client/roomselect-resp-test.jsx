// RoomSelectScreen mobile responsiveness harness — renders the REAL
// RoomSelectScreen (post-login full-screen room picker) with edge-case
// fixture data and self-reports overflow measurements into #report.
// NOT part of the app; used only for verification.
import { createRoot } from "react-dom/client";
import "./src/index.css";
import RoomSelectScreen from "./src/components/auth/RoomSelectScreen.jsx";

// ── Fixture data: cover edge cases ──────────────────────────────────────────
// Long names/codes, every badge state (last played, coaches list, team/year/
// last match date), selected + unselected cards, empty/new-game/friend modes.
const saves = [
	{
		code: "INVERNO",
		name: "Campeonato Invernal Extremo",
		coaches: ["Cobra", "Amorim", "Pochettino"],
		teamName: "Sporting Clube Desportivo Vila Nova Gaia",
		year: "26/27",
		lastPlayedAt: "2026-01-15T18:30:00.000Z",
	},
	{
		code: "PRIMAVERA2026EXTREMALONGA",
		name: "Primavera 2026",
		coaches: ["Cobra"],
		teamName: "",
		year: "25/26",
		lastPlayedAt: null,
	},
	{
		code: "OUTONO",
		name: "Outono",
		coaches: [],
		teamName: "FC Futebol Clube Do Porto Grande",
		year: "",
		lastPlayedAt: "2025-11-02T20:00:00.000Z",
	},
];

const noop = () => {};

function screen(props) {
	return (
		<div>
			{/* Mimics the sticky h-16 landing header the screen sits below */}
			<div className="h-16" />
			<RoomSelectScreen
				name="Treinador Teste Muito Longo"
				availableSaves={saves}
				setAvailableSaves={noop}
				roomCode=""
				setRoomCode={noop}
				joining={false}
				joinError=""
				disconnected={false}
				resetAuthFlow={noop}
				selectJoinMode={noop}
				handleLogout={noop}
				token="token-teste"
				isNewAccount={false}
				handleJoin={noop}
				backendUrl=""
				{...props}
			/>
		</div>
	);
}

const root = createRoot(document.getElementById("root"));
root.render(
	<div className="min-h-screen bg-[#060b08] text-white">
		{/* 1 — saved-game: full grid, first card selected */}
		{screen({
			joinMode: "saved-game",
			roomCode: saves[0].code,
		})}
		{/* 2 — new-game: long typed code, join error visible */}
		{screen({
			joinMode: "new-game",
			roomCode: "NOMEDADOJOGOMUITOLONGO123",
			joinError:
				"Não foi possível juntar à sala. Verifica o código e tenta novamente.",
		})}
		{/* 3 — friend-room: empty code + disconnected warning */}
		{screen({ joinMode: "friend-room", disconnected: true })}
		{/* 4 — no mode selected yet (hint state) */}
		{screen({ joinMode: null, isNewAccount: true })}
	</div>
);

function measure() {
	const vw = window.innerWidth;
	const doc = document.documentElement;
	const pageOverflow = doc.scrollWidth - vw;

	// Rows/cards with overflow-hidden (content clipping risk)
	const rows = [...document.querySelectorAll("div.flex.overflow-hidden")];
	const clippedRows = rows
		.filter((el) => el.scrollWidth > el.clientWidth + 1)
		.map((el) => ({
			name:
				el.querySelector("p.uppercase")?.textContent ||
				el.className.toString().slice(0, 60),
			scrollW: el.scrollWidth,
			clientW: el.clientWidth,
		}));

	// Any hidden/auto-overflow element clipping content (top 10 by excess)
	const all = [...document.querySelectorAll("*")].filter((el) => {
		const ov = getComputedStyle(el).overflowX;
		return (
			(ov === "hidden" || ov === "auto") && el.scrollWidth > el.clientWidth + 1
		);
	});
	const clippingElements = all
		.map((el) => ({
			cls: (el.className && el.className.toString().slice(0, 80)) || el.tagName,
			scrollW: el.scrollWidth,
			clientW: el.clientWidth,
			excess: el.scrollWidth - el.clientWidth,
		}))
		.sort((a, b) => b.excess - a.excess)
		.slice(0, 10);

	return {
		viewport: vw,
		pageOverflowPx: pageOverflow,
		clippedRows,
		clippingElements,
		verdict: pageOverflow <= 0 && clippedRows.length === 0 ? "PASS" : "FAIL",
	};
}

setTimeout(() => {
	const report = measure();
	const el = document.getElementById("report");
	el.setAttribute("data-status", "done");
	el.textContent = "REPORT:" + JSON.stringify(report, null, 2);
}, 2500);
