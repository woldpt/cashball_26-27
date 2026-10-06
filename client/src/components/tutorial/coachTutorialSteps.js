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
 * @property {Array<string>} targets - seletores data-tour candidatos, por ordem de preferência (vazio = balão final centrado, sem spotlight)
 * @property {string} title
 * @property {string} text
 */

/** @type {Array<TutorialStep>} */
export const COACH_TUTORIAL_STEPS = [
  {
    id: "club",
    tab: "club",
    submenu: "gestao",
    targets: ['[data-tour="nav-club"]', '[data-tour="nav-club-sub"]'],
    title: "O teu Clube",
    text: "Mister, eu mostro-te a casa: aqui vês o emblema, a moral do plantel e o histórico do clube. É o nosso quartel-general — volta cá quando quiseres rever esta visita.",
  },
  {
    id: "staff",
    tab: "club",
    submenu: "gestao",
    targets: ['[data-tour="club-staff"]'],
    title: "Funcionários",
    text: "Mister, o clube não se governa sozinho: aqui contratas quem trabalha para nós. O treinador auxiliar acelera o treino, o preparador físico recupera os rapazes, o médico encurta as lesões e a comunicação enche o estádio. Só tens 3 lugares na equipa técnica — escolhe bem, que o salário sai todas as semanas.",
  },
  {
    id: "jornal",
    tab: "jornal",
    submenu: null,
    targets: ['[data-tour="nav-jornal"]', '[data-tour="nav-jornal-mobile"]'],
    title: "Jornal do Clube",
    text: "Eu trato do correio: renovações, convites, direção, sorteio da taça e lesões. Aviso-te já — as linhas com 🚩 bloqueiam o Jogar até responderes.",
  },
  {
    id: "players",
    tab: "players",
    submenu: "gestao",
    targets: ['[data-tour="nav-players"]', '[data-tour="nav-players-sub"]'],
    title: "O teu Plantel",
    text: "Apresento-te os rapazes: posição, skill e estado físico. Toca num jogador para veres o histórico. Lembra-te do que eu te digo sempre — precisas de 1 guarda-redes e 10 de campo para jogar.",
  },
  {
    id: "skills",
    tab: "players",
    submenu: "gestao",
    targets: ['[data-tour="player-skills"]'],
    title: "Lê as skills",
    text: "Eu leio os números por ti: o dourado é a skill principal — quanto maior, melhor. A seguir vêm Forma, Moral, Resistência e Agressividade. Na semana em que a skill muda, marco a verde (subiu) ou a vermelho (desceu)."
  },
  {
    id: "training",
    tab: "training",
    submenu: "gestao",
    targets: ['[data-tour="nav-training"]', '[data-tour="nav-training-sub"]'],
    title: "Treino semanal",
    text: "Aqui é que eu puxo por eles: escolhe comigo o foco de treino da semana. O treino conta antes de cada jornada — não mo deixes em branco."
  },
  {
    id: "finances",
    tab: "finances",
    submenu: "gestao",
    targets: ['[data-tour="nav-finances"]', '[data-tour="nav-finances-sub"]'],
    title: "Finanças",
    text: "Eu olho pela carteira: orçamento, salários semanais e receitas de bilheteira. Reforços e estádio saem daqui — gasta com cabeça, que eu ralhete."
  },
  {
    id: "market",
    tab: "market",
    submenu: "transferencias",
    targets: ['[data-tour="nav-market"]', '[data-tour="nav-market-sub"]'],
    title: "Mercado e Leilões",
    text: "Se precisares de reforços, eu vou contigo ao Mercado ou aos Leilões contra os outros treinadores. Este passo é opcional — podes avançar sem contratar."
  },
  {
    id: "tactic-lineup",
    tab: "tactic",
    submenu: null,
    targets: ['[data-tour="tactic-titulares"]', '[data-tour="tactic-lineup"]'],
    title: "Monta o teu 11",
    text: "Agora monta o nosso 11: formação, mentalidade e arrasta os jogadores para Titulares. Sem 1 guarda-redes + 10 de campo, o botão de jogar fica bloqueado — eu não te deixo avançar coxo."
  },
  {
    id: "tactic-play",
    tab: "tactic",
    submenu: null,
    targets: ['[data-tour="nav-play"]', '[data-tour="nav-play-mobile"]', '[data-tour="tactic-titulares"]'],
    title: "Confirma a jornada",
    text: "Com o 11 fechado, aparece o botão de jogar — prime-o e eu confirmo a jornada por ti. Em salas com amigos, só avança quando todos confirmarem."
  },
  {
    id: "simulation",
    tab: "tactic",
    submenu: null,
    targets: [],
    title: "Rumo à simulação",
    text: "Confirmada a tática, vemos a jornada ao vivo: golos, lesões e intervenções em direto. Boa sorte, mister — a nossa época começa agora e eu fico aqui ao teu lado!"
  },
];
