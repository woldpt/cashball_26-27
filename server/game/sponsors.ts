/**
 * sponsors.ts — catálogo de marcas patrocinadoras e geração de ofertas.
 *
 * 60 marcas de humor nacional, 12 por escalão (tier 1 = Primeira Liga com
 * bancos/companhias aéreas/casas de apostas; tier 5 = Distrital com tascas
 * e mercearias). Funções puras: sem BD, sem sockets.
 *
 * Perfis de pagamento (sobre a base da divisão):
 *   A "Tudo já"      → 100% no dia 1 (liquidez imediata para o mercado)
 *   B "Pinga-pinga"  → 120% em 20 semanas (6%/semana, melhor total)
 *   C "Meio-meio"    → 55% no dia 1 + 55% na semana 10 (total 110%)
 *
 * Logotipos: gerados por `sponsorLogo()` a partir de formas geométricas
 * puras (sem `clipPath`, regra do projeto) — o cliente renderiza a partir
 * dos mesmos parâmetros, sem duplicar o catálogo.
 */
import { SPONSOR_REVENUE_BY_DIVISION } from "../gameConstants";

export type SponsorProfile = "A" | "B" | "C";

export interface Sponsor {
	id: string;
	name: string;
	/** Escalão 1–5: só sai a equipas dessa divisão. */
	tier: 1 | 2 | 3 | 4 | 5;
	sector: string;
	bg: string;
	fg: string;
	/** 1–2 letras para o monograma. */
	glyph: string;
	/** Variante de forma 0–3 (círculo, cantos, faixa, diamante). */
	shape: 0 | 1 | 2 | 3;
}

export interface SponsorOffer {
	sponsorId: string;
	name: string;
	sector: string;
	tier: number;
	bg: string;
	fg: string;
	glyph: string;
	shape: number;
	profile: SponsorProfile;
	upfront: number;
	weekly: number;
	secondHalf: number;
	total: number;
}

/** Semana do calendário (0-based) em que cai a 2.ª tranche do perfil C. */
export const SPONSOR_SECOND_TRANCHE_SLOT = 9;
/** N.º de semanas de pagamento do perfil B. */
export const SPONSOR_WEEKS = 20;

const S = (
	id: string,
	name: string,
	tier: 1 | 2 | 3 | 4 | 5,
	sector: string,
	bg: string,
	fg: string,
	glyph: string,
	shape: 0 | 1 | 2 | 3,
): Sponsor => ({ id, name, tier, sector, bg, fg, glyph, shape });

export const SPONSORS: Sponsor[] = [
	// ── Tier 1 · Primeira Liga (grandes) ──────────────────────────────
	S("banco-litoral", "Banco Litoral", 1, "Banca", "#0b3d91", "#ffd23f", "BL", 0),
	S("voanorte", "VoaNorte", 1, "Aviação", "#0ea5e9", "#ffffff", "VN", 1),
	S("betestrela", "BetEstrela", 1, "Apostas", "#166534", "#fde047", "BE", 2),
	S("telerede", "TeleRede", 1, "Telecomunicações", "#7c3aed", "#ffffff", "TR", 3),
	S("seguros-confianca", "Seguros Confiança", 1, "Seguros", "#1e3a8a", "#93c5fd", "SC", 0),
	S("malte-imperial", "Malte Imperial", 1, "Cerveja", "#92400e", "#fcd34d", "MI", 1),
	S("bompreco", "BomPreço", 1, "Supermercados", "#dc2626", "#ffffff", "BP", 2),
	S("luz-atlantica", "Luz Atlântica", 1, "Energia", "#f59e0b", "#1c1917", "LA", 3),
	S("rodalivre", "RodaLivre", 1, "Automóveis", "#111827", "#e5e7eb", "RL", 0),
	S("alianca-ourives", "Ourivesaria Aliança", 1, "Ourivesaria", "#713f12", "#fde68a", "AL", 1),
	S("santa-esperanca", "Santa Esperança", 1, "Saúde", "#ffffff", "#dc2626", "SE", 2),
	S("rochaforte", "RochaForte", 1, "Cimentos", "#57534e", "#fef3c7", "RF", 3),
	// ── Tier 2 · Segunda Liga (regionais fortes) ───────────────────────
	S("aguas-caldas", "Águas das Caldas", 2, "Águas", "#0284c7", "#ffffff", "AC", 0),
	S("serra-alta", "Queijaria Serra Alta", 2, "Lacticínios", "#ca8a04", "#422006", "SA", 1),
	S("rapido-minho", "Rápido do Minho", 2, "Transportes", "#059669", "#ffffff", "RM", 2),
	S("visao-clara", "Óticas Visão Clara", 2, "Óticas", "#0d9488", "#ffffff", "VC", 3),
	S("quinta-vale", "Quinta do Vale", 2, "Vinhos", "#7f1d1d", "#fecdd3", "QV", 0),
	S("sorriso", "Clínica Sorriso", 2, "Dentária", "#0891b2", "#ffffff", "SO", 1),
	S("horizonte", "Construções Horizonte", 2, "Construção", "#b45309", "#ffffff", "HO", 2),
	S("o-lagar", "Restaurante O Lagar", 2, "Restauração", "#65a30d", "#1a2e05", "OL", 3),
	S("papelaria-central", "Papelaria Central", 2, "Papelaria", "#4d7c0f", "#fefce8", "PC", 0),
	S("movel-nordico", "Móvel Nórdico", 2, "Mobiliário", "#9a3412", "#ffedd5", "MN", 1),
	S("farmacia-avenida", "Farmácia da Avenida", 2, "Farmácia", "#16a34a", "#ffffff", "FA", 2),
	S("hotel-miradouro", "Hotel Miradouro", 2, "Hotelaria", "#1d4ed8", "#dbeafe", "HM", 3),
	// ── Tier 3 · Terceira (comércio local) ────────────────────────────
	S("doce-fado", "Pastelaria Doce Fado", 3, "Pastelaria", "#db2777", "#ffffff", "DF", 0),
	S("irmaos-unidos", "Serralharia Irmãos Unidos", 3, "Serralharia", "#475569", "#f8fafc", "IU", 1),
	S("carne-boa", "Talhos Carne Boa", 3, "Talho", "#b91c1c", "#fee2e2", "CB", 2),
	S("branca-espuma", "Lavandaria Branca Espuma", 3, "Lavandaria", "#38bdf8", "#082f49", "BE", 3),
	S("corpo-sao", "Ginásio Corpo São", 3, "Desporto", "#ea580c", "#ffffff", "CS", 0),
	S("pagina-aberta", "Livraria Página Aberta", 3, "Livraria", "#854d0e", "#fef9c3", "PA", 1),
	S("forno-lenha", "Pizzaria Forno a Lenha", 3, "Pizzaria", "#c2410c", "#ffedd5", "FL", 2),
	S("eletro-luz", "Eletro Luz", 3, "Eletricidade", "#eab308", "#422006", "EL", 3),
	S("foto-instantanea", "Foto Instantânea", 3, "Fotografia", "#6d28d9", "#ede9fe", "FI", 0),
	S("jardim-florido", "Jardim Florido", 3, "Florista", "#16a34a", "#f0fdf4", "JF", 1),
	S("auto-pronta", "Oficina Auto Pronta", 3, "Oficina", "#334155", "#fbbf24", "AP", 2),
	S("sapataria-estrela", "Sapataria Estrela", 3, "Calçado", "#78350f", "#fde68a", "SE", 3),
	// ── Tier 4 · Quarta (bairro) ───────────────────────────────────────
	S("cafe-central", "Café Central", 4, "Café", "#573214", "#f5deb3", "CC", 0),
	S("farmacia-estacao", "Farmácia da Estação", 4, "Farmácia", "#15803d", "#ffffff", "FE", 1),
	S("corte-fino", "Barbearia Corte Fino", 4, "Barbearia", "#1f2937", "#f9fafb", "CF", 2),
	S("mercearia-esquina", "Mercearia da Esquina", 4, "Mercearia", "#0f766e", "#ccfbf1", "ME", 3),
	S("passo-certo", "Sapataria Passo Certo", 4, "Sapataria", "#92400e", "#fef3c7", "PC", 0),
	S("margarida", "Florista Margarida", 4, "Flores", "#be185d", "#fce7f3", "MA", 1),
	S("pao-quente", "Padaria Pão Quente", 4, "Padaria", "#d97706", "#451a03", "PQ", 2),
	S("quiosque-largo", "Quiosque do Largo", 4, "Quiosque", "#0369a1", "#e0f2fe", "QL", 3),
	S("tesoura-ouro", "Tesoura de Ouro", 4, "Cabeleireiro", "#a21caf", "#fae8ff", "TO", 0),
	S("drogaria-sol", "Drogaria Sol Nascente", 4, "Drogaria", "#f97316", "#431407", "DS", 1),
	S("chave-mestra", "Chave Mestra", 4, "Chaves", "#57534e", "#fefce8", "CM", 2),
	S("vidraria-transparente", "Vidraria Transparente", 4, "Vidros", "#0ea5e9", "#f0f9ff", "VT", 3),
	// ── Tier 5 · Distrital (tascos e vendas) ───────────────────────────
	S("cafe-aires", "Café do Aires", 5, "Café", "#6b3f12", "#ffe9c4", "CA", 0),
	S("tasca-ze-manel", "Tasca do Zé Manel", 5, "Tasca", "#7c2d12", "#ffedd5", "ZM", 1),
	S("venda-lurdes", "Venda da Dona Lurdes", 5, "Venda", "#3f6212", "#ecfccb", "DL", 2),
	S("frango-ouro", "Frango d'Ouro", 5, "Churrasqueira", "#ef4444", "#450a0a", "FO", 3),
	S("preco-minimo", "Minimercado Preço Mínimo", 5, "Minimercado", "#65a30d", "#ffffff", "PM", 0),
	S("copo-sujo", "Cervejaria O Copo Sujo", 5, "Cervejaria", "#a16207", "#fef9c3", "CS", 1),
	S("remendo-certo", "Alfaiate Remendo Certo", 5, "Alfaiate", "#44403c", "#fef3c7", "RC", 2),
	S("mare-viva", "Peixaria Maré Viva", 5, "Peixaria", "#0e7490", "#cffafe", "MV", 3),
	S("sorte-grande", "Kiosque Sorte Grande", 5, "Jogos", "#15803d", "#bbf7d0", "SG", 0),
	S("tres-coroas", "Pastelaria Três Coroas", 5, "Pastelaria", "#c026d3", "#fae8ff", "TC", 1),
	S("campo-verde", "Agro Campo Verde", 5, "Agricultura", "#4d7c0f", "#f7fee7", "CV", 2),
	S("lenha-seca", "Lenha Seca & Carvão", 5, "Lenha", "#451a03", "#fdba74", "LS", 3),
];

export function sponsorById(id: string): Sponsor | undefined {
	return SPONSORS.find((s) => s.id === id);
}

export function sponsorsByTier(tier: number): Sponsor[] {
	return SPONSORS.filter((s) => s.tier === tier);
}

export function sponsorBaseFor(division: number): number {
	return SPONSOR_REVENUE_BY_DIVISION[division] ?? SPONSOR_REVENUE_BY_DIVISION[4] ?? 0;
}

/**
 * Logotipo SVG inline (formas geométricas puras, sem clipPath).
 * O cliente usa esta mesma receita a partir dos parâmetros da oferta.
 */
export function sponsorLogo(s: Pick<Sponsor, "bg" | "fg" | "glyph" | "shape">): string {
	const bg = s.bg;
	const fg = s.fg;
	const t = `<text x="50" y="62" font-size="38" font-weight="900" text-anchor="middle" fill="${fg}" font-family="system-ui,sans-serif">${s.glyph}</text>`;
	const body =
		s.shape === 0
			? `<rect width="100" height="100" fill="${bg}"/><circle cx="50" cy="50" r="30" fill="none" stroke="${fg}" stroke-width="6"/>`
			: s.shape === 1
				? `<rect width="100" height="100" fill="${bg}"/><rect x="14" y="14" width="72" height="72" fill="none" stroke="${fg}" stroke-width="6"/>`
				: s.shape === 2
					? `<rect width="100" height="100" fill="${bg}"/><rect y="38" width="100" height="24" fill="${fg}" opacity="0.85"/>`
					: `<rect width="100" height="100" fill="${bg}"/><rect x="22" y="22" width="56" height="56" fill="none" stroke="${fg}" stroke-width="6" transform="rotate(45 50 50)"/>`;
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${body}${t}</svg>`;
}

function shuffle<T>(arr: T[]): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

/** Monta a oferta de um patrocinador para uma base e um perfil. */
export function buildOffer(sponsor: Sponsor, base: number, profile: SponsorProfile): SponsorOffer {
	const b = Math.max(0, Math.round(base));
	if (profile === "A") {
		return { ...pickBrand(sponsor), profile, upfront: b, weekly: 0, secondHalf: 0, total: b };
	}
	if (profile === "B") {
		const weekly = Math.round((b * 1.2) / SPONSOR_WEEKS);
		return { ...pickBrand(sponsor), profile, upfront: 0, weekly, secondHalf: 0, total: weekly * SPONSOR_WEEKS };
	}
	const half = Math.round(b * 0.55);
	return { ...pickBrand(sponsor), profile, upfront: half, weekly: 0, secondHalf: half, total: half * 2 };
}

function pickBrand(s: Sponsor) {
	return { sponsorId: s.id, name: s.name, sector: s.sector, tier: s.tier, bg: s.bg, fg: s.fg, glyph: s.glyph, shape: s.shape };
}

/**
 * Sorteia até 3 ofertas distintas de um escalão, excluindo as já
 * atribuídas (`takenIds`), uma com cada perfil A/B/C baralhado.
 * Se o pote tiver menos de 3, devolve as que houver (efeito draft nas
 * divisões com muitos humanos).
 */
export function drawOffers(division: number, takenIds: Set<string> = new Set(), count = 3): SponsorOffer[] {
	const base = sponsorBaseFor(division);
	const pool = shuffle(sponsorsByTier(division).filter((s) => !takenIds.has(s.id)));
	const profiles = shuffle<SponsorProfile>(["A", "B", "C"]);
	return pool.slice(0, count).map((s, i) => buildOffer(s, base, profiles[i % profiles.length]));
}

/**
 * Distribuição de exibição (época 1, só visual): 1 marca por equipa,
 * única dentro do escalão. Salas reais têm 8 equipas/divisão para 12
 * marcas; se algum dia houver mais equipas que marcas, o pote roda
 * (só aí com repetição).
 */
export function dealDisplaySponsors(teams: Array<{ id: number; division: number }>): Array<{ teamId: number; sponsorId: string }> {
	const out: Array<{ teamId: number; sponsorId: string }> = [];
	const byDiv = new Map<number, number[]>();
	for (const t of teams) {
		const list = byDiv.get(t.division) ?? [];
		list.push(t.id);
		byDiv.set(t.division, list);
	}
	for (const [division, ids] of byDiv) {
		const pool = shuffle(sponsorsByTier(division));
		const loose = pool.length > 0 ? pool : shuffle(SPONSORS);
		ids.forEach((teamId, i) => {
			out.push({ teamId, sponsorId: loose[i % loose.length].id });
		});
	}
	return out;
}

/** Escolha aleatória direta (NPC): patrocinador + perfil ao acaso. */
export function drawNpcChoice(division: number, takenIds: Set<string> = new Set()): SponsorOffer | null {
	const offers = drawOffers(division, takenIds, 1);
	return offers[0] ?? null;
}

/**
 * Fallback sem escalão (divisão inesperada ou pote esgotado): nunca
 * deixar uma equipa sem opções — uma 🚩 sem saída congelava a sala.
 */
export function drawOffersAny(takenIds: Set<string> = new Set(), count = 3): SponsorOffer[] {
	const base = sponsorBaseFor(4);
	const pool = shuffle(SPONSORS.filter((s) => !takenIds.has(s.id)));
	const profiles = shuffle<SponsorProfile>(["A", "B", "C"]);
	return pool.slice(0, count).map((s, i) => buildOffer(s, base, profiles[i % profiles.length]));
}
