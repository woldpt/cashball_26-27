// SeasonEndModal mobile responsiveness harness — renders the REAL modal in the
// two extremes: o pior caso (4 divisões de Melhor Marcador com empates, Taça,
// subidas/descidas e o meu clube entre os vencedores) e o mínimo (um vencedor,
// sem Taça nem movimentos). NOT part of the app; used only for mobile
// responsiveness verification (see .pi/skills/mobile-resp-check).
//
// Contract (read by client/scripts/mobileRespCheck.mjs):
//   - render into #root
//   - write "REPORT:<json>" into <pre id="report"> and set data-status="done"
//   - json must include: viewport, pageOverflowPx, clippedRows,
//     clippingElements, verdict ("PASS" | "FAIL")
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { SeasonEndModal } from "./src/components/modals/SeasonEndModal.jsx";

const LONG_PLAYER = "João Maria dos Santos Ferreira Nascimento";
const myTeamId = 10;

// Cores só para o TeamCrest (o modal usa `crestFor(teamId, teamName)`).
const TEAMS = [
	{ id: 10, name: "Sporting Clube Desportivo Vila Nova de Gaia FC", color_primary: "#2d6a4f", color_secondary: "#003824" },
	{ id: 11, name: "Grupo Desportivo Estrela da Amadora Sintra", color_primary: "#c1121f", color_secondary: "#ffffff" },
	{ id: 20, name: "Clube Desportivo de Tondela e Arredores", color_primary: "#ffd60a", color_secondary: "#000000" },
	{ id: 30, name: "Associação Recreativa de Coimbra Sul", color_primary: "#4361ee", color_secondary: "#ffffff" },
	{ id: 40, name: "Futebol Clube de São João da Madeira", color_primary: "#7209b7", color_secondary: "#ffffff" },
];

const WORST = {
	season: 12,
	year: 2030,
	newSeason: 13,
	champion: { id: 11, name: TEAMS[1].name },
	divisionChampions: [
		{ divId: 1, divName: "Primeira Liga", teamId: 11, teamName: TEAMS[1].name, prize: 2000000 },
		{ divId: 2, divName: "Segunda Liga", teamId: 20, teamName: TEAMS[2].name, prize: 1000000 },
		{ divId: 3, divName: "Liga 3", teamId: 30, teamName: TEAMS[3].name, prize: 500000 },
		{ divId: 4, divName: "Campeonato de Portugal", teamId: 40, teamName: TEAMS[4].name, prize: 250000 },
	],
	cupWinner: { teamId: 30, teamName: TEAMS[3].name, prize: 500000 },
	// Pior caso da feature: 4 divisões, com empate na Primeira Liga (2 linhas)
	// e na Liga 3 (3 linhas) → 7 linhas de marcador, o limite realista.
	topScorers: [
		{ divId: 1, divName: "Primeira Liga", name: LONG_PLAYER, teamId: 10, teamName: TEAMS[0].name, goals: 24, prize: 500000 },
		{ divId: 1, divName: "Primeira Liga", name: "Rui Manuel da Conceição Alves", teamId: 11, teamName: TEAMS[1].name, goals: 24, prize: 500000 },
		{ divId: 2, divName: "Segunda Liga", name: "Pedro Miguel Fernandes Rodrigues", teamId: 20, teamName: TEAMS[2].name, goals: 22, prize: 500000 },
		{ divId: 3, divName: "Liga 3", name: "Francisco José Almeida Ramos", teamId: 30, teamName: TEAMS[3].name, goals: 19, prize: 500000 },
		{ divId: 3, divName: "Liga 3", name: "Bernardo da Silva Vasconcelos", teamId: 31, teamName: "Clube Desportivo de Torres Vedras", goals: 19, prize: 500000 },
		{ divId: 3, divName: "Liga 3", name: "Nuno Ricardo Baptista Moreira", teamId: 32, teamName: "Grupo Recreativo de Faro", goals: 19, prize: 500000 },
		{ divId: 4, divName: "Campeonato de Portugal", name: "Alberto Manuel Nunes Patrício", teamId: 40, teamName: TEAMS[4].name, goals: 17, prize: 500000 },
	],
	promotions: [
		{ teamId: 20, teamName: TEAMS[2].name, toDiv: 1, fromDiv: 2 },
		{ teamId: 30, teamName: TEAMS[3].name, toDiv: 2, fromDiv: 3 },
		{ teamId: 40, teamName: TEAMS[4].name, toDiv: 3, fromDiv: 4 },
		{ teamId: 11, teamName: TEAMS[1].name, toDiv: 2, fromDiv: 1 },
		{ teamId: 12, teamName: "Sport Lisboa e Benfica de Alcochete", toDiv: 3, fromDiv: 2 },
		{ teamId: 13, teamName: "Boavista Futebol Clube do Porto", toDiv: 4, fromDiv: 3 },
	],
};

const MINIMAL = {
	season: 1,
	year: 2029,
	newSeason: 2,
	champion: { id: 11, name: TEAMS[1].name },
	divisionChampions: [{ divId: 1, divName: "Primeira Liga", teamId: 11, teamName: TEAMS[1].name, prize: 2000000 }],
	cupWinner: null,
	topScorers: [
		{ divId: 1, divName: "Primeira Liga", name: "Ana", teamId: 11, teamName: TEAMS[1].name, goals: 3, prize: 500000 },
	],
	promotions: [],
};

const CASES = { worst: WORST, minimal: MINIMAL };

export function App() {
	// Começa no caso mínimo e fica no pior caso: o screenshot do runner é tirado
	// no fim da timeline, e é o pior caso (7 linhas de marcador) que interessa ver.
	const [active, setActive] = useState("minimal");
	return (
		<div className="min-h-screen bg-surface">
			<SeasonEndModal
				data={CASES[active]}
				teams={TEAMS}
				me={{ name: "Treinador de Teste", teamId: myTeamId }}
				onClose={() => {}}
			/>
			{/* hidden switcher — the harness timeline drives this */}
			<button
				id="case-switch"
				className="fixed -top-96 left-0 opacity-0 pointer-events-none"
				onClick={() => setActive((a) => (a === "worst" ? "minimal" : "worst"))}
			>
				case: {active}
			</button>
		</div>
	);
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);

// ── Measurement (template contract) ────────────────────────────────────────
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

	// Largura do card (`w-full max-w-lg sm:max-w-xl`) dentro do backdrop `p-4`:
	// o modal é `fullscreen` e rola no backdrop, por isso só a LARGURA é
	// critério — altura fica para o scroll do backdrop.
	const card = document.querySelector(".max-w-lg");
	const cardFit = {
		found: !!card,
		width: card ? card.offsetWidth : 0,
		available: vw - 32,
		fits: !card || card.offsetWidth <= vw - 32 + 1,
	};

	return {
		viewport: vw,
		pageOverflowPx: pageOverflow,
		clippedRows,
		clippingElements,
		cardFit,
		verdict:
			pageOverflow <= 0 && clippedRows.length === 0 && cardFit.fits
				? "PASS"
				: "FAIL",
	};
}

// ── Timeline: measure case A, switch, measure case B, emit combined report ──
window.addEventListener("load", () => {
	setTimeout(() => {
		const minimal = measure();
		document.getElementById("case-switch").click(); // → worst (fica renderizado)
		setTimeout(() => {
			const worst = measure();
			const verdict =
				[worst, minimal].every((c) => c.verdict === "PASS") ? "PASS" : "FAIL";
			const report = {
				viewport: window.innerWidth,
				pageOverflowPx: Math.max(worst.pageOverflowPx, minimal.pageOverflowPx),
				clippedRows: [...worst.clippedRows, ...minimal.clippedRows],
				clippingElements: [...worst.clippingElements, ...minimal.clippingElements],
				cases: { worst, minimal },
				verdict,
			};
			const el = document.getElementById("report");
			el.setAttribute("data-status", "done");
			el.textContent = "REPORT:" + JSON.stringify(report, null, 2);
		}, 1700);
	}, 2500);
});
