/**
 * Montra estática da página de entrada: plantel, classificação, direto
 * simulado e manchetes — tudo fictício, só para a landing provar o jogo
 * antes do login (sem backend nem conta).
 *
 * Os jogadores usam IDs negativos: o `PlayerLink` dentro do `PlayerRow`
 * desativa-se sozinho para IDs < 0, por isso a montra é só leitura e nunca
 * dispara `requestPlayerHistory`.
 */

/** Minuto inicial do direto simulado. */
export const SHOWCASE_START_MINUTE = 63;

/** Relógio do direto simulado: de quanto em quanto o minuto avança (ms). */
export const SHOWCASE_MINUTE_TICK = 4000;

/**
 * Plantel fictício para as `PlayerRow` da montra (um por posição-chave).
 * Campos espelham o objeto real de jogador (só o que o `PlayerRow` lê).
 *
 * @type {Array<object>}
 */
export const SHOWCASE_SQUAD = [
	{
		id: -1,
		name: "RUI CALADO",
		position: "GR",
		nationality: "🇵🇹",
		is_star: false,
		skill: 71,
		prev_skill: 70,
		resistance: 82,
		form: 15,
		morale: 30,
		aggressiveness: "Tranquilo",
		wage: 45000,
		value: 820000,
		games_played: 9,
		career_games: 41,
		goals: 0,
		career_goals: 0,
		red_cards: 0,
		career_reds: 0,
		injuries: 0,
		career_injuries: 1,
	},
	{
		id: -2,
		name: "NUNO PEDREIRA",
		position: "DEF",
		nationality: "🇵🇹",
		is_star: false,
		skill: 74,
		prev_skill: 74,
		resistance: 77,
		form: 12,
		morale: 28,
		aggressiveness: "Lenhador",
		wage: 52000,
		value: 1100000,
		games_played: 9,
		career_games: 58,
		goals: 1,
		career_goals: 3,
		red_cards: 1,
		career_reds: 2,
		injuries: 0,
		career_injuries: 0,
	},
	{
		id: -3,
		name: "TIAGO LUME",
		position: "MED",
		nationality: "🇧🇷",
		is_star: true,
		skill: 81,
		prev_skill: 79,
		resistance: 74,
		form: 18,
		morale: 36,
		aggressiveness: "Zen",
		wage: 88000,
		value: 2400000,
		games_played: 9,
		career_games: 77,
		goals: 4,
		career_goals: 19,
		red_cards: 0,
		career_reds: 1,
		injuries: 0,
		career_injuries: 2,
	},
	{
		id: -4,
		name: "DIOGO FAGULHA",
		position: "ATA",
		nationality: "🇦🇴",
		is_star: true,
		skill: 83,
		prev_skill: 83,
		resistance: 69,
		form: 17,
		morale: 41,
		aggressiveness: "Tranquilo",
		wage: 96000,
		value: 3100000,
		games_played: 9,
		career_games: 64,
		goals: 8,
		career_goals: 37,
		red_cards: 0,
		career_reds: 0,
		injuries: 1,
		career_injuries: 1,
	},
];

/**
 * Jogo em direto da montra (teatro com temporizador — não é simulação).
 *
 * @type {{ home: { short: string, name: string, color: string }, away: { short: string, name: string, color: string }, homeGoals: number, awayGoals: number, events: Array<{ minute: number, text: string }> }}
 */
export const SHOWCASE_LIVE = {
	home: { short: "EST", name: "Estrela do Vale", color: "#e9c349" },
	away: { short: "CAR", name: "UD Carvalhal", color: "#3b82f6" },
	homeGoals: 2,
	awayGoals: 1,
	events: [
		{ minute: 23, text: "Golo! Fagulha abre o marcador de cabeça." },
		{ minute: 55, text: "Empata o Carvalhal na sequência de um canto." },
		{ minute: 64, text: "Golo! Lume vira o jogo de fora da área." },
	],
};

/**
 * Mini-classificação fictícia (ordenada por pontos).
 *
 * @type {Array<{ name: string, color: string, played: number, goalDiff: number, points: number, form: string }>}
 */
export const SHOWCASE_TABLE = [
	{ name: "Estrela do Vale", color: "#e9c349", played: 9, goalDiff: 11, points: 21, form: "VVEVV" },
	{ name: "UD Carvalhal", color: "#3b82f6", played: 9, goalDiff: 8, points: 19, form: "VVDVE" },
	{ name: "SC Litoral", color: "#10b981", played: 9, goalDiff: 5, points: 17, form: "EVVDE" },
	{ name: "Atlético Pedreira", color: "#f43f5e", played: 9, goalDiff: -1, points: 12, form: "DEVED" },
	{ name: "GD Fontelha", color: "#a78bfa", played: 9, goalDiff: -6, points: 8, form: "DDEVD" },
	{ name: "Real Montemor", color: "#94a3b8", played: 9, goalDiff: -12, points: 4, form: "DDDED" },
];

/**
 * Manchetes fictícias do jornal da jornada.
 *
 * @type {Array<{ kicker: string, title: string }>}
 */
export const SHOWCASE_HEADLINES = [
	{ kicker: "Jornada 9", title: "Vale vira o jogo e cola-se à liderança" },
	{ kicker: "Mercado", title: "Fagulha renova até 2029 e cala os rumores" },
	{ kicker: "Taça", title: "Sorteio dita clássico nos oitavos de final" },
];

/**
 * Widgets do topo da montra (rótulo, valor, subtexto).
 *
 * @type {Array<{ label: string, value: string, sub: string, accentClass: string }>}
 */
export const SHOWCASE_WIDGETS = [
	{ label: "Orçamento", value: "€4,2M", sub: "para gerir", accentClass: "border-primary" },
	{ label: "Jornada", value: "9/14", sub: "época em curso", accentClass: "border-tertiary" },
	{ label: "Treinadores", value: "8", sub: "na tua liga", accentClass: "border-blue-400" },
];
