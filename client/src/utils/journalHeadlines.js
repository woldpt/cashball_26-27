/**
 * journalHeadlines — voz do Jornal (gozão de café, pt-PT).
 *
 * Funções puras: recebem o jogo da manchete + contexto e devolvem
 * kicker/título/subtítulo/carimbo/cartoon. Determinísticas (sem
 * Math.random) para a capa ser estável entre renders.
 */

/**
 * @typedef {object} HeadlineGame
 * @property {string} [competition]
 * @property {number} [matchweek]
 * @property {number} [round]
 * @property {number|string} homeTeamId
 * @property {number|string} awayTeamId
 * @property {string} [homeName]
 * @property {string} [awayName]
 * @property {number} [homeScore]
 * @property {number} [awayScore]
 * @property {{ playerName?: string }|null} [momHome]
 * @property {{ playerName?: string }|null} [momAway]
 * @property {number} [attendance]
 */

/**
 * @typedef {object} HeadlineContext
 * @property {number|null} [myTeamId]
 * @property {number|null} [myPos]
 * @property {number|null} [oppPos]
 * @property {number|null} [totalTeams]
 * @property {boolean} [isCup]
 */

/**
 * @typedef {object} HeadlineOut
 * @property {string} kicker
 * @property {string} title
 * @property {string} subtitle
 * @property {{ text: string, tone: "win"|"party"|"ouch"|"shame"|"draw" }} stamp
 * @property {"megafone"|"bota"|"balde"|"muralha"|"apito"|"coroa"} cartoon
 */

function pick(list, seed) {
  if (!list.length) return "";
  const n = Math.abs(Number(seed) || 0);
  return list[n % list.length];
}

/**
 * Constrói a manchete do teu jogo. Nunca deita abaixo: fallback neutro
 * quando faltam dados.
 *
 * @param {HeadlineGame|null} game
 * @param {HeadlineContext} [ctx]
 * @returns {HeadlineOut}
 */
export function buildHeadline(game, ctx = {}) {
  const fallback = {
    kicker: "O jornal da bola",
    title: "Sem manchete para já",
    subtitle: "Ainda não há jogo teu nesta jornada.",
    stamp: { text: "A SEGUIR", tone: "draw" },
    cartoon: "apito",
  };
  if (!game) return fallback;

  const myTeamId = ctx.myTeamId != null ? Number(ctx.myTeamId) : null;
  const mine = myTeamId == null
    ? "home"
    : Number(game.homeTeamId) === myTeamId
      ? "home"
      : "away";
  const gf = Number(mine === "home" ? game.homeScore : game.awayScore) || 0;
  const ga = Number(mine === "home" ? game.awayScore : game.homeScore) || 0;
  const margin = gf - ga;
  const oppName = mine === "home" ? game.awayName : game.homeName;
  const atHome = mine === "home";
  const where = atHome ? "em casa" : "fora";
  const mom = mine === "home" ? game.momHome : game.momAway;
  const momName = mom?.playerName || null;
  const isCup = ctx.isCup ?? game.competition === "Cup";
  const seed = (Number(game.homeScore) || 0) * 7 +
    (Number(game.awayScore) || 0) * 13 +
    (Number(game.matchweek) || Number(game.round) || 0) * 3;

  const myPos = ctx.myPos ?? null;
  const oppPos = ctx.oppPos ?? null;
  const giantKiller = myPos != null && oppPos != null && oppPos <= 2 && myPos >= oppPos + 3 && margin > 0;
  const underdogLoss = myPos != null && oppPos != null && myPos <= 2 && oppPos >= myPos + 3 && margin < 0;

  // ── Vitória ──────────────────────────────────────────────────────────
  if (margin >= 4) {
    return {
      kicker: pick(
        ["Cabazada", "Festival de golos", "Noite de gala", "Enchente e cabaz"],
        seed,
      ),
      title: pick(
        [`Cabazada ${where}: ${gf}-${ga}`, `Encheram o cabaz à ${oppName}`, `Festival! ${gf}-${ga} ${where}`],
        seed + 1,
      ),
      subtitle: momName
        ? `${momName} deu espetáculo e a bancada pediu mais um.`
        : `Quatro ou mais e nem foi preciso pedir licença à ${oppName}.`,
      stamp: { text: "CABAZADA", tone: "party" },
      cartoon: "bota",
    };
  }
  if (margin === 3) {
    return {
      kicker: giantKiller ? "Tomba-gigantes" : "Noite de gala",
      title: giantKiller
        ? `Tombaram o gigante: ${gf}-${ga}`
        : pick([`Gala ${where}: ${gf}-${ga}`, `Três sem resposta à ${oppName}`], seed),
      subtitle: momName
        ? `${momName} assinou a festa e o povo rendeu-se.`
        : "Exibição de encher o olho — nem deu para assobiar.",
      stamp: { text: "GALA", tone: "party" },
      cartoon: "megafone",
    };
  }
  if (margin === 2) {
    return {
      kicker: ga === 0 ? "Muralha atrás, festa à frente" : "Jogo de gente grande",
      title: ga === 0
        ? pick([`Muralha! ${gf}-${ga} ${where}`, `Sem sofrer, sem stress: ${gf}-${ga}`], seed)
        : pick([`Bis ${where}: ${gf}-${ga}`, `Controlo total frente à ${oppName}`], seed),
      subtitle: momName
        ? `${momName} foi o patrão do relvado.`
        : "Vitória de quem manda no jogo do primeiro ao último minuto.",
      stamp: { text: "VITÓRIA", tone: "win" },
      cartoon: "coroa",
    };
  }
  if (margin === 1) {
    return {
      kicker: giantKiller ? "Tomba-gigantes" : pick(["Sofrido mas vale três", "Até ao apito final", "Pela mínima"], seed),
      title: pick([`Arrancado a ferros: ${gf}-${ga}`, `Vale três! ${gf}-${ga} ${where}`], seed + 2),
      subtitle: underdogLoss
        ? "Doeu, mas ninguém pode dizer que não lutaram."
        : `Contra a ${oppName}, o que conta é que a bola entrou uma vez mais.`,
      stamp: { text: "VALE 3", tone: "win" },
      cartoon: "apito",
    };
  }

  // ── Empate ───────────────────────────────────────────────────────────
  if (margin === 0) {
    const golos = gf + ga;
    if (golos >= 4) {
      return {
        kicker: "Feira de golos",
        title: `Loucos: ${gf}-${ga} e ninguém ganhou`,
        subtitle: "Quem foi à casa de banho perdeu um golo. Quem ficou rouco ganhou o dia.",
        stamp: { text: "FEIRA", tone: "draw" },
        cartoon: "megafone",
      };
    }
    if (golos === 0) {
      return {
        kicker: "Jogo de paciência",
        title: "Zero a zero e muita unha roída",
        subtitle: momName
          ? `${momName} ainda tentou acordar o jogo.`
          : "Defesas felizes, avançados a pedir desculpa no balneário.",
        stamp: { text: "SECA?", tone: "draw" },
        cartoon: "muralha",
      };
    }
    return {
      kicker: "Divididos os pontos",
      title: `Empate ${where}: ${gf}-${ga}`,
      subtitle: `Nem para a ${oppName} nem para nós — fica a conversa para o café.`,
      stamp: { text: "EMPATE", tone: "draw" },
      cartoon: "apito",
    };
  }

  // ── Derrota ──────────────────────────────────────────────────────────
  if (margin === -1) {
    return {
      kicker: underdogLoss ? "Tropeção de líder" : "Derrota amarga",
      title: pick([`Dor de cabeça: ${gf}-${ga}`, `Faltou um bocadinho assim: ${gf}-${ga}`], seed),
      subtitle: `A ${oppName} levou os três pontos ${atHome ? "da nossa casa" : "em casa dela"} — e nem festejou muito.`,
      stamp: { text: "AMARGA", tone: "ouch" },
      cartoon: "balde",
    };
  }
  if (margin === -2) {
    return {
      kicker: "Noite para esquecer",
      title: `Puxão de orelhas: ${gf}-${ga}`,
      subtitle: momName
        ? `Nem ${momName} safou a mobília.`
        : "O mister vai ter conversa séria no treino de amanhã.",
      stamp: { text: "AI AI AI", tone: "ouch" },
      cartoon: "balde",
    };
  }
  return {
    kicker: underdogLoss ? "Vergonha na liderança" : "Noite negra",
    title: pick([`Vergonha ${where}: ${gf}-${ga}`, `Para esquecer: ${gf}-${ga} frente à ${oppName}`], seed + 1),
    subtitle: isCup
      ? "Na Taça não há segunda mão para emendar — é engolir e seguir."
      : "A bancada assobiou, o balneário calou-se e o café hoje está amargo.",
    stamp: { text: "VERGONHA", tone: "shame" },
    cartoon: "balde",
  };
}

/** Cor do carimbo por tom (tokens, nunca hex). */
export const STAMP_TONE_CLASS = {
  win: "text-emerald-400 border-emerald-400/70",
  party: "text-tertiary border-tertiary/70",
  ouch: "text-amber-400 border-amber-400/70",
  shame: "text-error border-error/70",
  draw: "text-on-surface-variant border-outline-variant",
};
