/**
 * Conteúdo estático da página de entrada: frases do hero, tamanho do título e
 * cartões da faixa de funcionalidades. Mantido fora do JSX para que a
 * composição em `LandingPage.jsx` fique só com estrutura.
 */

/**
 * Frases do hero em ciclo (3 tempos, imperativo pt-PT). A primeira e a última
 * frases são as de marca — o ciclo abre e fecha no ponto de partida. O 2.º
 * tempo é verde em todas as frases (consistência visual).
 *
 * @type {Array<[string, string, string]>}
 */
export const HERO_PHRASES = [
	["TREINA.", "PROSPERA.", "REPETE."],
	["GERE.", "VENCE.", "REINA."],
	["TREINA.", "COMANDA.", "VENCE."],
	["PLANEIA.", "DECIDE.", "DOMINA."],
	["GERE.", "PROSPERA.", "DOMINA."],
	["CONSTRÓI.", "VENCE.", "LEGENDA."],
];

/** Intervalo entre frases do hero (ms). 3.5s — legível sem ser apressado. */
export const HERO_PHRASE_INTERVAL = 3500;

/**
 * Tamanho do título do hero (partilhado pelas 3 linhas). A base faz clamp ao
 * viewport para que "PROSPERA." nunca transborde em ecrãs de 320px; a partir
 * dos 360px o clamp resolve exatamente para 3.75rem.
 */
export const HERO_TITLE_SIZE =
	"text-[min(3.75rem,calc((100vw-3rem)/5.2))] sm:text-7xl lg:text-[5.5rem] short:text-[clamp(1.4rem,4.5vw,2.2rem)]";

/**
 * Cartões da faixa de funcionalidades.
 *
 * @type {Array<{icon: string, label: string, desc: string}>}
 */
export const LANDING_FEATURES = [
	{
		icon: "stadium",
		label: "4 Divisões",
		desc: "Primeira Liga, Segunda, Liga 3 e Campeonato de Portugal com promoção e descida.",
	},
	{
		icon: "group",
		label: "Até 8 Treinadores",
		desc: "Multiplayer assíncrono — submete as táticas quando quiseres, simula em grupo.",
	},
	{
		icon: "payments",
		label: "Finanças & Contratos",
		desc: "Gere o orçamento, renegocia contratos e evita a falência do clube.",
	},
	{
		icon: "live_tv",
		label: "Simulação ao Vivo",
		desc: "Eventos em tempo real. Acompanhe os jogos e notícias à medida que acontecem.",
	},
];
