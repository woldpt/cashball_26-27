import { COUNTRY_FLAGS } from "../countryFlags.js";

export const FLAG_TO_COUNTRY = {};
COUNTRY_FLAGS.forEach(({ flag, label }) => {
	FLAG_TO_COUNTRY[flag] = label.replace(/^\S+\s/, "");
});

export const SKIN_REGIONS = {
	europe: [0, 1],
	east_asia: [6, 7],
	latam: [1, 2, 3],
	mediterranean: [1, 2],
	south_asia: [1, 2, 3],
	southeast_asia: [1, 2, 6, 7],
	africa: [3, 4, 5],
	oceania: [0, 1],
};

export const FLAG_TO_SKIN_REGION = {
	"🇵🇹": "europe",
	"🇪🇸": "europe",
	"🇫🇷": "europe",
	"🇬🇧": "europe",
	"🏴󠁧󠁢󠁥󠁮󠁧󠁿": "europe",
	"🏴󠁧󠁢󠁳󠁣󠁴󠁿": "europe",
	"🏴󠁧󠁢󠁷󠁬󠁳󠁿": "europe",
	"🇩🇪": "europe",
	"🇮🇹": "europe",
	"🇳🇱": "europe",
	"🇧🇪": "europe",
	"🇨🇭": "europe",
	"🇦🇹": "europe",
	"🇸🇪": "europe",
	"🇳🇴": "europe",
	"🇩🇰": "europe",
	"🇫🇮": "europe",
	"🇮🇪": "europe",
	"🇬🇷": "europe",
	"🇵🇱": "europe",
	"🇨🇿": "europe",
	"🇭🇺": "europe",
	"🇷🇴": "europe",
	"🇧🇬": "europe",
	"🇷🇸": "europe",
	"🇭🇷": "europe",
	"🇸🇰": "europe",
	"🇸🇮": "europe",
	"🇧🇦": "europe",
	"🇲🇪": "europe",
	"🇦🇱": "europe",
	"🇽🇰": "europe",
	"🇲🇰": "europe",
	"🇱🇹": "europe",
	"🇱🇻": "europe",
	"🇪🇪": "europe",
	"🇮🇸": "europe",
	"🇱🇺": "europe",
	"🇲🇹": "europe",
	"🇲🇨": "europe",
	"🇱🇮": "europe",
	"🇸🇲": "europe",
	"🇻🇦": "europe",
	"🇦🇩": "europe",
	"🇺🇦": "europe",
	"🇧🇾": "europe",
	"🇲🇩": "europe",
	"🇷🇺": "europe",
	"🇬🇪": "europe",
	"🇦🇲": "europe",
	"🇦🇿": "europe",
	"🇰🇿": "europe",
	"🇰🇬": "europe",
	"🇹🇲": "europe",
	"🇺🇿": "europe",
	"🇹🇯": "europe",
	"🇨🇾": "europe",
	"🇹🇷": "mediterranean",
	"🇲🇦": "mediterranean",
	"🇩🇿": "mediterranean",
	"🇹🇳": "mediterranean",
	"🇱🇾": "mediterranean",
	"🇪🇬": "mediterranean",
	"🇸🇾": "mediterranean",
	"🇱🇧": "mediterranean",
	"🇮🇱": "mediterranean",
	"🇵🇸": "mediterranean",
	"🇯🇴": "mediterranean",
	"🇸🇦": "mediterranean",
	"🇾🇪": "mediterranean",
	"🇴🇲": "mediterranean",
	"🇦🇪": "mediterranean",
	"🇶🇦": "mediterranean",
	"🇧🇭": "mediterranean",
	"🇰🇼": "mediterranean",
	"🇮🇶": "mediterranean",
	"🇮🇷": "mediterranean",
	"🇦🇫": "south_asia",
	"🇵🇰": "south_asia",
	"🇮🇳": "south_asia",
	"🇧🇩": "south_asia",
	"🇱🇰": "south_asia",
	"🇳🇵": "south_asia",
	"🇧🇹": "south_asia",
	"🇲🇻": "south_asia",
	"🇨🇳": "east_asia",
	"🇯🇵": "east_asia",
	"🇰🇷": "east_asia",
	"🇰🇵": "east_asia",
	"🇹🇼": "east_asia",
	"🇲🇳": "east_asia",
	"🇵🇭": "southeast_asia",
	"🇮🇩": "southeast_asia",
	"🇲🇾": "southeast_asia",
	"🇸🇬": "southeast_asia",
	"🇹🇭": "southeast_asia",
	"🇻🇳": "southeast_asia",
	"🇰🇭": "southeast_asia",
	"🇱🇦": "southeast_asia",
	"🇲🇲": "southeast_asia",
	"🇧🇳": "southeast_asia",
	"🇹🇱": "southeast_asia",
	"🇧🇷": "latam",
	"🇦🇷": "latam",
	"🇺🇾": "latam",
	"🇨🇱": "latam",
	"🇵🇾": "latam",
	"🇧🇴": "latam",
	"🇵🇪": "latam",
	"🇪🇨": "latam",
	"🇨🇴": "latam",
	"🇻🇪": "latam",
	"🇵🇦": "latam",
	"🇨🇷": "latam",
	"🇳🇮": "latam",
	"🇭🇳": "latam",
	"🇸🇻": "latam",
	"🇬🇹": "latam",
	"🇲🇽": "latam",
	"🇨🇺": "latam",
	"🇩🇴": "latam",
	"🇵🇷": "latam",
	"🇭🇹": "latam",
	"🇯🇲": "latam",
	"🇹🇹": "latam",
	"🇧🇧": "latam",
	"🇧🇸": "latam",
	"🇧🇿": "latam",
	"🇬🇾": "latam",
	"🇸🇷": "latam",
	"🇩🇲": "latam",
	"🇬🇩": "latam",
	"🇰🇳": "latam",
	"🇱🇨": "latam",
	"🇻🇨": "latam",
	"🇦🇬": "latam",
	"🇳🇬": "africa",
	"🇿🇦": "africa",
	"🇰🇪": "africa",
	"🇪🇹": "africa",
	"🇬🇭": "africa",
	"🇨🇮": "africa",
	"🇸🇳": "africa",
	"🇨🇲": "africa",
	"🇨🇩": "africa",
	"🇦🇴": "africa",
	"🇲🇿": "africa",
	"🇿🇲": "africa",
	"🇿🇼": "africa",
	"🇲🇬": "africa",
	"🇲🇼": "africa",
	"🇹🇿": "africa",
	"🇺🇬": "africa",
	"🇷🇼": "africa",
	"🇧🇮": "africa",
	"🇸🇩": "africa",
	"🇸🇸": "africa",
	"🇪🇷": "africa",
	"🇩🇯": "africa",
	"🇸🇴": "africa",
	"🇧🇫": "africa",
	"🇲🇱": "africa",
	"🇳🇪": "africa",
	"🇹🇩": "africa",
	"🇨🇫": "africa",
	"🇬🇦": "africa",
	"🇨🇬": "africa",
	"🇬🇶": "africa",
	"🇸🇹": "africa",
	"🇬🇼": "africa",
	"🇬🇳": "africa",
	"🇸🇱": "africa",
	"🇱🇷": "africa",
	"🇹🇬": "africa",
	"🇧🇯": "africa",
	"🇳🇦": "africa",
	"🇧🇼": "africa",
	"🇱🇸": "africa",
	"🇸🇿": "africa",
	"🇰🇲": "africa",
	"🇲🇷": "africa",
	"🇸🇨": "africa",
	"🇲🇺": "africa",
	"🇦🇺": "oceania",
	"🇳🇿": "oceania",
	"🇫🇯": "oceania",
	"🇵🇬": "oceania",
	"🇸🇧": "oceania",
	"🇻🇺": "oceania",
	"🇼🇸": "oceania",
	"🇹🇴": "oceania",
	"🇰🇮": "oceania",
	"🇫🇲": "oceania",
	"🇲🇭": "oceania",
	"🇵🇼": "oceania",
	"🇳🇷": "oceania",
	"🇹🇻": "oceania",
};

export const DIVISION_NAMES = {
	1: "Primeira Liga",
	2: "Segunda Liga",
	3: "Liga 3",
	4: "Campeonato de Portugal",
	5: "Distritais",
};

export const POSITION_SHORT_LABELS = {
	GR: "G",
	DEF: "D",
	MED: "M",
	ATA: "A",
};

// Enable row background color per position
export const ENABLE_ROW_BG = true;

// ── POSITION VISUAL SYSTEM (única fonte de verdade) ─────────────────────
// Todas as variações visuais por posição derivam destas constantes.
// Cor base por posição (STYLE.md §1): GR amber-400, DEF blue-400,
// MED emerald-400, ATA rose-400.

// Text color classes for each position (soft palette)
export const POSITION_TEXT_CLASS = {
	GR: "text-amber-400",
	DEF: "text-blue-400",
	MED: "text-emerald-400",
	ATA: "text-rose-400",
};

export const POSITION_BORDER_CLASS = {
	GR: "border-amber-400",
	DEF: "border-blue-400",
	MED: "border-emerald-400",
	ATA: "border-rose-400",
};

// Faixa lateral (w-1 gradient) das linhas de jogador
export const POSITION_BAR_CLASS = {
	GR: "from-amber-300 via-amber-400 to-amber-600",
	DEF: "from-blue-300 via-blue-400 to-blue-600",
	MED: "from-emerald-300 via-emerald-400 to-emerald-600",
	ATA: "from-rose-300 via-rose-400 to-rose-600",
};

// Glow no hover de cards por posição
export const POSITION_GLOW_CLASS = {
	GR: "hover:border-amber-400/70 hover:shadow-amber-400/30",
	DEF: "hover:border-blue-400/70 hover:shadow-blue-400/30",
	MED: "hover:border-emerald-400/70 hover:shadow-emerald-400/30",
	ATA: "hover:border-rose-400/70 hover:shadow-rose-400/30",
};

// Gradiente de fundo dos cards por posição (opacidade baixa)
export const POSITION_BG_GRADIENT_CLASS = {
	GR: "from-amber-500/8",
	DEF: "from-blue-500/8",
	MED: "from-emerald-500/8",
	ATA: "from-rose-500/8",
};

// Ring + borda dos flip cards (mercado/leilões)
export const POSITION_RING_CLASS = {
	GR: "ring-amber-400/60 border-amber-400/35",
	DEF: "ring-blue-400/60 border-blue-400/35",
	MED: "ring-emerald-400/60 border-emerald-400/35",
	ATA: "ring-rose-400/60 border-rose-400/35",
};

// Badges de posição (bg / text / border separados para recombinação)
export const POSITION_BADGE_BG_CLASS = {
	GR: "bg-amber-400/20",
	DEF: "bg-blue-400/20",
	MED: "bg-emerald-400/20",
	ATA: "bg-rose-400/20",
};

export const POSITION_BADGE_TEXT_CLASS = {
	GR: "text-amber-400",
	DEF: "text-blue-400",
	MED: "text-emerald-400",
	ATA: "text-rose-400",
};

export const POSITION_BADGE_BORDER_CLASS = {
	GR: "border-amber-400/30",
	DEF: "border-blue-400/30",
	MED: "border-emerald-400/30",
	ATA: "border-rose-400/30",
};

// Hex de accent por posição (gráficos, barras, texto inline)
export const POSITION_ACCENT_HEX = {
	GR: "#eab308",
	DEF: "#3b82f6",
	MED: "#10b981",
	ATA: "#f43f5e",
};

export const POSITION_LABEL_MAP = {
	GR: "GR",
	DEF: "DEF",
	MED: "MED",
	ATA: "ATA",
};

// Background color classes for each position (soft, subtle)
export const POSITION_BG_CLASS = {
	GR: "bg-yellow-500/8",
	DEF: "bg-blue-500/8",
	MED: "bg-emerald-500/8",
	ATA: "bg-rose-500/8",
};

export const MAX_MATCH_SUBS = 3;
/** Número máximo de jogadores no banco de suplentes (pré-jogo) */
export const MAX_BENCH_SIZE = 7;
export const ADMIN_SESSION_KEY = "cashballAdminSession";

// ── MODAL Z-INDEX (camadas centralizadas) ────────────────────────────────
export const MODAL_Z = {
	teamSquad: 120,
	transferProposal: 130,
	cupDraw: 140,
	waitingCoaches: 150,
	penalty: 150,
	coachMarket: 160,
	signing: 190,
	postMatch: 210,
	default: 200,
	admin: 300,
	adminDialog: 310,
	dismissal: 9999,
};

// ── CUP FINAL VENUE ──────────────────────────────────────────────────────────
export const CUP_FINAL_STADIUM = "Estádio do Jamor";

// ── SEASON CALENDAR ───────────────────────────────────────────────────────────
export const SEASON_CALENDAR = [
	{ type: "league", matchweek: 1, calendarIndex: 0 },
	{ type: "league", matchweek: 2, calendarIndex: 1 },
	{ type: "league", matchweek: 3, calendarIndex: 2 },
	{ type: "cup", round: 1, roundName: "16 avos de final", calendarIndex: 3 },
	{ type: "league", matchweek: 4, calendarIndex: 4 },
	{ type: "league", matchweek: 5, calendarIndex: 5 },
	{ type: "league", matchweek: 6, calendarIndex: 6 },
	{ type: "cup", round: 2, roundName: "Oitavos de final", calendarIndex: 7 },
	{ type: "league", matchweek: 7, calendarIndex: 8 },
	{ type: "league", matchweek: 8, calendarIndex: 9 },
	{ type: "league", matchweek: 9, calendarIndex: 10 },
	{ type: "cup", round: 3, roundName: "Quartos de final", calendarIndex: 11 },
	{ type: "league", matchweek: 10, calendarIndex: 12 },
	{ type: "league", matchweek: 11, calendarIndex: 13 },
	{ type: "cup", round: 4, roundName: "Meias-finais", calendarIndex: 14 },
	{ type: "league", matchweek: 12, calendarIndex: 15 },
	{ type: "league", matchweek: 13, calendarIndex: 16 },
	{ type: "league", matchweek: 14, calendarIndex: 17 },
	{ type: "cup", round: 5, roundName: "Final", calendarIndex: 18 },
];

export const TACTIC_FORMATIONS = [
	{ value: "4-4-2", label: "4-4-2" },
	{ value: "4-3-3", label: "4-3-3" },
	{ value: "3-5-2", label: "3-5-2" },
	{ value: "5-3-2", label: "5-3-2" },
	{ value: "4-5-1", label: "4-5-1" },
	{ value: "3-4-3", label: "3-4-3" },
	{ value: "4-2-4", label: "4-2-4" },
	{ value: "5-4-1", label: "5-4-1" },
];

export const DEFAULT_TACTIC = {
	formation: "4-4-2",
	style: "Balanced",
	positions: {},
};

// ── AGGRESSIVENESS TIERS ──────────────────────────────────────────────────────
export const AGG_TIERS = {
	Santinho: { color: "text-emerald-400" },
	Escuteiro: { color: "text-sky-400" },
	Zen: { color: "text-zinc-400" },
	Lenhador: { color: "text-orange-400" },
	Triturador: { color: "text-red-400" },
};

export const TICKER_TEAM_COLORS = [
	"#f87171",
	"#fb923c",
	"#facc15",
	"#4ade80",
	"#34d399",
	"#22d3ee",
	"#60a5fa",
	"#a78bfa",
	"#e879f9",
	"#f472b6",
	"#94a3b8",
	"#fbbf24",
	"#86efac",
	"#67e8f9",
	"#c4b5fd",
	"#fda4af",
	"#6ee7b7",
	"#93c5fd",
];

/**
 * Incremento mínimo entre lances num leilão.
 * Deve espelhar AUCTION_BID_STEP no servidor (server/gameConstants.ts).
 */
export const AUCTION_BID_STEP = 10000;

// ── FINANCE / EMPRÉSTIMOS / ESTÁDIO ───────────────────────────────────────────
/** Dívida máxima de empréstimo bancário. */
export const LOAN_MAX = 2500000;
/** Incremento de cada operação de empréstimo/pagamento. */
export const LOAN_STEP = 500000;
/** Taxa de juros semanal (por jornada) sobre a dívida. */
export const LOAN_INTEREST_RATE = 0.015;
/** Custo de cada obra de expansão do estádio. */
export const STADIUM_EXPANSION_COST = 300000;
/** Total de jornadas de liga por época. */
export const SEASON_JORNADAS = 14;
/** Jogos em casa por época (metade das jornadas). */
export const SEASON_HOME_MATCHES = 7;
/** Factor de ocupação estimado para projetar bilheteiras sem histórico. */
export const TICKET_ESTIMATE_FACTOR = 0.8;
/** Multiplicador do valor do jogador para a cláusula (preço de proposta a jogadores não listados). */
export const TRANSFER_CLAUSE_MULT = 1.35;
/** Multiplicador do valor do jogador para o preço de lista por omissão (leilão/venda). */
export const TRANSFER_LISTED_PRICE_MULT = 0.8;
