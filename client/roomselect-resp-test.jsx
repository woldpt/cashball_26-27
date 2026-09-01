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

function screen(inst, props) {
	return (
		<div data-inst={inst}>
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
		{screen("saved-game", {
			joinMode: "saved-game",
			roomCode: saves[0].code,
		})}
		{/* 2 — new-game: long typed code, join error visible */}
		{screen("new-game", {
			joinMode: "new-game",
			roomCode: "NOMEDADOJOGOMUITOLONGO123",
			joinError:
				"Não foi possível juntar à sala. Verifica o código e tenta novamente.",
		})}
		{/* 3 — friend-room: empty code + disconnected warning */}
		{screen("friend-room", { joinMode: "friend-room", disconnected: true })}
		{/* 4 — no mode selected yet (hint state) */}
		{screen("no-mode", { joinMode: null, isNewAccount: true })}
	</div>
);

function measure() {
	const vw = window.innerWidth;
	const vh = window.innerHeight;
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

	// Vertical fit per instance: the screen is a fixed-height flex column
	// (h-[calc(100dvh-4rem)]); in low-landscape viewports chrome can crush
	// the scrollable body (0px) and push the action bar off the window.
	const insts = ["saved-game", "new-game", "friend-room", "no-mode"].map(
		(name) => {
			const wrap = document.querySelector(`[data-inst="${name}"]`);
			if (!wrap) return { inst: name, missing: true };
			const root = wrap.querySelector('[class*="100dvh-4rem"]');
			const body = root
				? root.querySelector('[class*="overflow-y-auto"]')
				: null;
			const bar = root ? root.lastElementChild : null;
			const r = root ? root.getBoundingClientRect() : null;
			return {
				inst: name,
				rootPx: r ? Math.round(r.height) : null,
				bodyPx: body ? Math.round(body.getBoundingClientRect().height) : null,
				barOverflow:
					r && bar
						? Math.round(bar.getBoundingClientRect().bottom - r.bottom)
						: null,
			};
		}
	);

	const failReasons = [];
	if (pageOverflow > 0) failReasons.push(`page horizontal overflow ${pageOverflow}px`);
	if (clippedRows.length > 0)
		failReasons.push(`${clippedRows.length} clipped row(s)`);
	for (const m of insts) {
		if (m.missing) {
			failReasons.push(`${m.inst}: instance missing`);
			continue;
		}
		if (m.bodyPx == null || m.bodyPx < 100)
			failReasons.push(`${m.inst}: body height ${m.bodyPx}px < 100px`);
		if (m.barOverflow == null || m.barOverflow > 1)
			failReasons.push(
				`${m.inst}: action bar overflows window by ${m.barOverflow}px`
			);
	}

	return {
		viewport: { vw, vh },
		pageOverflowPx: pageOverflow,
		clippedRows,
		clippingElements,
		instances: insts,
		failReasons,
		verdict: failReasons.length === 0 ? "PASS" : "FAIL",
	};
}

setTimeout(async () => {
	// Wait for the Material Symbols font (same Google Fonts link as the app's
	// index.html): tab icons are 24px glyph boxes; without the font they render
	// as literal text and skew the measured layout.
	if (document.fonts && document.fonts.ready) await document.fonts.ready;
	const report = measure();
	const el = document.getElementById("report");
	el.setAttribute("data-status", "done");
	el.textContent = "REPORT:" + JSON.stringify(report, null, 2);
}, 2500);
