/**
 * Passos do tutorial guiado para contas novas de Coach.
 * Cada passo indica a tab a mostrar, o submenu mobile a abrir e uma lista de
 * seletores `data-tour` candidatos (desktop primeiro, fallback mobile).
 * Textos sempre em pt-PT.
 */

/**
 * @typedef {Object} TutorialStep
 * @property {string} id
 * @property {string} tab - tab do GameLayout a navegar ao entrar no passo
 * @property {string|null} submenu - submenu mobile a abrir ("gestao" | "transferencias" | null)
 * @property {Array<string>} targets - seletores data-tour candidatos, por ordem de preferência
 * @property {string} title
 * @property {string} text
 */

/** @type {Array<TutorialStep>} */
export const COACH_TUTORIAL_STEPS = [
  {
    id: "club",
    tab: "club",
    submenu: null,
    targets: ['[data-tour="nav-club"]', '[data-tour="nav-club-mobile"]'],
    title: "O teu Clube",
    text: "Aqui vês o emblema, a moral do plantel e o jornal do clube. É o teu quartel-general — volta cá quando precisares de rever o tutorial.",
  },
  {
    id: "players",
    tab: "players",
    submenu: "gestao",
    targets: ['[data-tour="nav-players"]', '[data-tour="nav-players-sub"]'],
    title: "O teu Plantel",
    text: "Conhece os teus jogadores: posição, skill e estado físico. Toca num jogador para ver o histórico. Precisas de 1 guarda-redes e 10 de campo para jogar.",
  },
  {
    id: "training",
    tab: "training",
    submenu: "gestao",
    targets: ['[data-tour="nav-training"]', '[data-tour="nav-training-sub"]'],
    title: "Treino semanal",
    text: "Escolhe o foco de treino da semana para evoluir o plantel. O treino conta antes de cada jornada — não o ignores.",
  },
  {
    id: "finances",
    tab: "finances",
    submenu: "gestao",
    targets: ['[data-tour="nav-finances"]', '[data-tour="nav-finances-sub"]'],
    title: "Finanças",
    text: "Controla o orçamento, os salários semanais e as receitas de bilheteira. Reforços e estádio saem daqui — gasta com cabeça.",
  },
  {
    id: "market",
    tab: "market",
    submenu: "transferencias",
    targets: ['[data-tour="nav-market"]', '[data-tour="nav-market-sub"]'],
    title: "Mercado e Leilões",
    text: "Reforça a equipa no Mercado ou disputa Leilões contra outros treinadores. Este passo é opcional — podes avançar sem contratar.",
  },
  {
    id: "tactic-lineup",
    tab: "tactic",
    submenu: null,
    targets: ['[data-tour="tactic-lineup"]'],
    title: "Monta o teu 11",
    text: "Escolhe a formação, a mentalidade e arrasta os jogadores para Titulares. Sem 1 guarda-redes + 10 de campo, o botão de jogar fica bloqueado.",
  },
  {
    id: "tactic-play",
    tab: "tactic",
    submenu: null,
    targets: ['[data-tour="tactic-play"]'],
    title: "Confirma a jornada",
    text: "Quando o 11 estiver pronto, prime este botão. Em salas com amigos, a jornada só avança quando todos confirmarem.",
  },
  {
    id: "simulation",
    tab: "tactic",
    submenu: null,
    targets: ['[data-tour="nav-play"]', '[data-tour="nav-play-mobile"]'],
    title: "Rumo à simulação",
    text: "Confirmada a tática, a jornada é simulada ao vivo: golos, lesões e intervenções em direto. Boa sorte, mister — a tua época começa agora!",
  },
];
