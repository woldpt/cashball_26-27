/**
 * inboxItems — mapeamento puro da caixa de entrada (hub estilo CM2001).
 *
 * Sem estado nem JSX: recebe linhas de notícias + estados locais e devolve
 * itens `{ id, cat, date, title, body, redFlag, kind, ref }`. As ações
 * (responder, aceitar, …) vivem no hook `useInbox`, que interpreta `kind`.
 *
 * Um evento = uma notícia: as linhas gémeas de um negócio (transfer_in /
 * transfer_out + histórico global) fundem-se num só item de Mercado.
 */
import { formatCurrency } from "./formatters.js";
import { computeMoodVariant } from "./moodVariant.js";

/** Separadores da janela, centrados no treinador (tudo numa só linha). */
export const INBOX_CATS = [
  { id: "all", label: "Todas" },
  { id: "club", label: "O Meu Clube" },
  { id: "competitions", label: "Competições" },
  { id: "squad", label: "Plantel" },
  { id: "market", label: "Mercado" },
];

/**
 * Id do aviso da direção: inclui época + semana para que um aviso novo não
 * herde o «lido» de outro com o mesmo nível/sequência noutra altura da época.
 * @param {number|string} seasonYear época (ex. 2026)
 * @param {number|string} weekIdx índice da semana (calendarIndex)
 * @param {number} level nível do aviso
 * @param {number} streak semanas seguidas no vermelho
 * @returns {string}
 */
export function boardNewsId(seasonYear, weekIdx, level, streak) {
  return `board-${seasonYear ?? "?"}-${weekIdx ?? "?"}-${level}-${streak ?? 1}`;
}

/** Títulos do humor pós-jogo (espelho mínimo do antigo modal de adeptos). */
export const MOOD_TITLES = {
  win: "Vitória!",
  win_big: "Vitória Épica!",
  win_upset: "Vitória Épica!",
  loss: "Adeptos Descontentes",
  loss_shameful: "Derrota Vergonhosa",
  loss_expected: "Derrota Esperada",
  draw: "Empate",
  draw_honorable: "Empate Honroso",
  draw_bitter: "Empate Amargo",
};

const MOOD_COPY = {
  win: [
    "A vitória devolve tranquilidade à bancada e confirma que o grupo soube responder quando era preciso. Não foi apenas uma linha no resultado: foi uma noite em que o clube voltou a sentir que o trabalho da semana tem uma recompensa concreta.",
    "Entre aplausos e comentários à saída, os adeptos deixam um pedido simples: mais noites assim. O triunfo dá margem para preparar a próxima jornada com confiança, sem apagar a exigência que acompanha cada camisola.",
  ],
  win_big: [
    "A bancada recebeu o resultado como uma declaração de força. Vencer um adversário do topo transforma três pontos numa mensagem para toda a divisão e dá ao balneário uma memória capaz de alimentar a confiança durante várias jornadas.",
    "A euforia não vem apenas do marcador: vem da sensação de que o clube esteve à altura de um teste grande. Os adeptos saem a discutir esta noite como uma possível viragem na época, embora saibam que a consistência será agora a prova seguinte.",
  ],
  win_upset: [
    "Foi uma daquelas vitórias que fazem a cidade parar para olhar. O favoritismo estava do outro lado, mas a bancada encontrou razões para acreditar e acabou por festejar uma noite que pode ficar entre as melhores recordações desta época.",
    "Os adeptos já transformaram o triunfo numa história para contar: um clube menos cotado bateu a porta grande e entrou sem pedir licença. A direção ganha entusiasmo, o balneário ganha crédito e a próxima jornada será disputada sob uma expectativa renovada.",
  ],
  loss: [
    "A derrota deixa desilusão, mas não provoca uma rutura com a equipa. A bancada reconhece que o resultado ficou aquém do desejado e espera uma resposta rápida, sobretudo na forma como o grupo vai reagir ao primeiro obstáculo da próxima semana.",
    "À saída do estádio, o ambiente é de silêncio e análise. Os adeptos não querem dramatizar uma noite isolada, mas também não escondem que a camisola exige mais: a próxima jornada terá de mostrar se este foi apenas um tropeção ou o início de um problema.",
  ],
  loss_shameful: [
    "A bancada não esconde a revolta. Perder já seria difícil de aceitar; sair com este resultado frente a um adversário que estava ao alcance transforma a noite numa ferida aberta e aumenta a pressão sobre todos os que têm de explicar o que aconteceu.",
    "Os assobios no final dizem mais do que qualquer comunicado. Os adeptos esperavam atitude, concentração e respeito pelo emblema, e agora exigem uma resposta à altura. O próximo jogo deixou de ser apenas mais uma jornada: tornou-se a primeira oportunidade para reparar a confiança perdida.",
  ],
  loss_expected: [
    "A derrota custa, mas a bancada sabe reconhecer o tamanho do desafio. O adversário confirmou o seu estatuto e os adeptos não confundem um resultado difícil com falta de ambição: esperam antes que a equipa retire lições e volte a discutir pontos com os rivais directos.",
    "O ambiente é de frustração controlada. Ninguém gosta de perder, mas a expectativa estava condicionada pela força do adversário. A exigência mantém-se intacta e passa agora por recuperar o foco, proteger a confiança do grupo e não deixar que uma noite complicada defina a época.",
  ],
  draw: [
    "O empate deixa a bancada dividida entre o ponto conquistado e a sensação de que havia espaço para mais. A equipa evita a derrota, mas os adeptos querem ver maior coragem e clareza quando chegar a próxima oportunidade para fechar um jogo.",
    "No final, as conversas prolongam-se porque o resultado não oferece uma resposta simples. Há motivos para aceitar o ponto, mas também a convicção de que o clube precisa de transformar boas intenções em vitórias se quiser subir na tabela.",
  ],
  draw_honorable: [
    "A bancada recebe o empate com respeito. Travar um adversário de topo confirma que a equipa pode competir ao mais alto nível e dá aos adeptos uma razão séria para acreditar, mesmo que a vitória tenha escapado nos detalhes.",
    "O ponto sabe a prova superada. Não há festa de vitória, mas há aplausos para uma equipa que não se escondeu perante um teste exigente. O desafio passa agora por repetir esta personalidade contra adversários de todas as dimensões.",
  ],
  draw_bitter: [
    "O empate é recebido como uma oportunidade desperdiçada. Contra um adversário que a bancada esperava vergar, deixar escapar a vitória pesa quase como uma derrota e reacende a discussão sobre a capacidade do clube para assumir os jogos que tem obrigação de controlar.",
    "As bancadas saem inquietas, não por falta de luta, mas porque o calendário oferecia uma ocasião importante. O ponto entra nas contas, mas não apaga a sensação de que a equipa precisava de mais e terá de provar isso já na próxima jornada.",
  ],
};

/**
 * Cria o corpo editorial da reação pós-jogo sem inventar estatísticas.
 * @param {object} mood contexto final do jogo
 * @returns {string}
 */
export function buildMoodNewsBody(mood) {
  const variant = mood?.variant || mood?.outcome || "draw";
  const copy = MOOD_COPY[variant] || MOOD_COPY.draw;
  const score = `${mood?.myGoals ?? 0}–${mood?.oppGoals ?? 0}`;
  const opponent = mood?.opponentName || "o adversário";
  const round = mood?.roundLabel || "O último jogo";
  const revenue =
    mood?.ticketRevenue != null
      ? ` A bilheteira rendeu ${formatCurrency(mood.ticketRevenue)}, uma ajuda concreta para preparar a próxima jornada.`
      : " A tesouraria fica agora com a responsabilidade de transformar este resultado em margem para o trabalho da próxima jornada.";

  return [
    `${round} terminou com um ${score} frente a ${opponent}. ${copy[0]}`,
    copy[1],
    `O Jornal regista o estado de espírito da massa adepta depois do apito final. A reacção não desaparece com o fim do jogo: vai acompanhar os treinos, as decisões do treinador e a expectativa em torno do próximo desafio.${revenue}`,
  ].join("\n\n");
}

/**
 * Divide um texto na primeira menção de uma entidade, para a tornar clicável.
 * @param {string} text texto corrido
 * @param {object} entityPart parte `player`/`team` já construída
 * @returns {Array} partes (texto puro se a etiqueta não ocorrer)
 */
export function linkFirstMention(text, entityPart) {
  const value = String(text ?? "");
  const label = entityPart?.label;
  const idx = label ? value.indexOf(label) : -1;
  if (idx < 0) return [partText(value)];
  return [
    ...(idx > 0 ? [partText(value.slice(0, idx))] : []),
    entityPart,
    ...(idx + label.length < value.length
      ? [partText(value.slice(idx + label.length))]
      : []),
  ];
}

/**
 * Lê um rescaldo persistido (`club_news` tipo `postmatch`, factos em JSON)
 * e reconstrói o contexto do apito final, com a variante recalculada da
 * foto guardada — igual à que o cliente calculou no momento do jogo.
 * @param {object} n linha do globalNews
 * @returns {{ mood: object, key: string }|null}
 */
export function parsePostMatchRecap(n) {
  try {
    const r = JSON.parse(String(n?.description || ""));
    if (!r || r.v !== 1 || !r.key || !r.outcome) return null;
    const mood = {
      variant: computeMoodVariant({
        outcome: r.outcome,
        source: r.source,
        myDivision: r.myDivision,
        opponentDivision: r.opponentDivision,
        opponentRank: r.opponentRank,
        opponentTeamCount: r.opponentTeamCount,
      }),
      outcome: r.outcome,
      opponentTeamId: r.opponentTeamId,
      opponentName: r.opponentName,
      myGoals: r.myGoals,
      oppGoals: r.oppGoals,
      roundLabel: r.roundLabel,
      ticketRevenue: r.ticketRevenue,
    };
    return { mood, key: r.key };
  } catch {
    return null;
  }
}

/**
 * Chaves dos rescaldos já persistidos (para esconder o item transitório
 * duplicado do último jogo).
 * @param {Array} rows linhas do globalNews
 * @returns {Set<string>}
 */
export function persistedMoodKeys(rows) {
  const keys = new Set();
  for (const n of Array.isArray(rows) ? rows : []) {
    if (String(n?.type || "") !== "postmatch") continue;
    const parsed = parsePostMatchRecap(n);
    if (parsed) keys.add(parsed.key);
  }
  return keys;
}

/**
 * Artigo da reação pós-jogo com o adversário clicável (título e corpo).
 * @param {object} mood contexto final do jogo
 * @returns {object} `{ title, body, titleParts, bodyParts, media }`
 */
export function buildMoodNewsArticle(mood) {
  const headline =
    MOOD_TITLES[mood?.variant] || MOOD_TITLES[mood?.outcome] || "Resultado";
  const score = `${mood?.myGoals ?? ""}–${mood?.oppGoals ?? ""}`;
  const title = `${headline} ${score} ${mood?.opponentName || ""}`.trim();
  const body = buildMoodNewsBody(mood);
  const opponent =
    mood?.opponentTeamId != null && mood?.opponentName
      ? { id: mood.opponentTeamId, label: mood.opponentName }
      : null;
  return {
    title,
    body,
    titleParts: opponent
      ? linkFirstMention(title, partTeam(opponent))
      : [partText(title)],
    bodyParts: opponent
      ? linkFirstMention(body, partTeam(opponent))
      : [partText(body)],
    media: { player: null, teams: opponent ? [opponent] : [] },
  };
}

/**
 * Categoria de uma linha do `globalNews` (club_news ou transfer_history).
 * @param {object} n linha com `source`/`type`
 * @returns {string} id de categoria
 */
export function newsCategory(n) {
  if (!n) return "competitions";
  if (n.source === "transfer") return "market";
  const t = String(n.type || "");
  if (
    t === "transfer_in" ||
    t === "transfer_out" ||
    t === "auction_won" ||
    t === "auction_failed" ||
    t.includes("transfer") ||
    t.includes("auction")
  )
    return "market";
  if (
    t === "welcome" ||
    t === "ticket_revenue" ||
    t === "stadium_build" ||
    t === "cost_cut" ||
    t === "postmatch" ||
    t === "job_offer" ||
    t === "board_warning"
  )
    return "club";
  if (t === "cup_draw") return "competitions";
  if (
    t === "academy" ||
    t === "injury" ||
    t === "suspension" ||
    t === "renegotiation" ||
    t === "contract_request"
  )
    return "squad";
  return "competitions";
}

/**
 * Formata o marcador temporal usado nas linhas do Jornal.
 * @param {number} week semana do item
 * @param {number} year ano da época
 * @returns {string}
 */
export function formatInboxDate(week, year) {
  return `S${Math.max(1, Number(week) || 1)}/${Number(year) || 2026}`;
}

function formatNewsDate(news, fallbackDate) {
  // Data fixa da linha: a semana do calendário (`slot`, 1..20) — o `matchweek`
  // só existe nas linhas anteriores a essa coluna e repete-se nas semanas de
  // Taça (não identifica uma semana).
  if (news?.slot != null && Number(news.year) > 0) {
    return formatInboxDate(news.slot, news.year);
  }
  return news?.matchweek != null && Number(news.year) > 0
    ? formatInboxDate(news.matchweek, news.year)
    : fallbackDate || formatInboxDate();
}

export const partText = (value, opts) => ({ type: "text", value: String(value ?? ""), ...(opts?.bold ? { bold: true } : {}) });
export const partPlayer = (player) => ({ type: "player", ...player });
export const partTeam = (team) => ({ type: "team", ...team });

function plainParts(parts) {
  return parts
    .map((part) => (part.type === "text" ? part.value : part.label))
    .join("");
}

function newsPlayer(n) {
  return n?.player_id && n.player_name
    ? {
        id: n.player_id,
        label: n.player_name,
        photo: n.player_photo || n.photo || null,
        position: n.player_position || n.position || "ATA",
      }
    : null;
}

function newsTeam(id, name) {
  return id && name ? { id, label: name } : null;
}

function uniqueTeams(...teams) {
  return teams.filter(
    (team, index, all) =>
      team && all.findIndex((candidate) => candidate?.id === team.id) === index,
  );
}

function newsVariant(n, count) {
  const seed = Number(n?.id) || String(n?.title || "").length;
  return Math.abs(seed) % count;
}

function makeArticle(titleParts, bodyParts, player, teams, transfer) {
  return {
    title: plainParts(titleParts),
    body: plainParts(bodyParts),
    titleParts,
    bodyParts,
    media: { player, teams: uniqueTeams(...teams), transfer },
  };
}

/**
 * Artigo de um rescaldo persistido: editorial reconstruído do JSON ou
 * corpo genérico se os factos vierem estragados.
 * @param {object} n linha do globalNews com `type === "postmatch"`
 */
function postmatchArticle(n) {
  const parsed = parsePostMatchRecap(n);
  if (parsed) return buildMoodNewsArticle(parsed.mood);
  const owner = newsTeam(n?.team_id, n?.team_name);
  const related = newsTeam(n?.related_team_id, n?.related_team_name);
  return makeArticle(
    [partText(n?.title || "Rescaldo")],
    [partText(String(n?.description || ""))],
    null,
    [owner, related],
    null,
  );
}

/**
 * Factos de uma notícia persistida nova (JSON `v: 1` na descrição).
 * @param {object} n linha do globalNews
 * @returns {object|null}
 */
export function parseNewsFacts(n) {
  try {
    const r = JSON.parse(String(n?.description || ""));
    return r && r.v === 1 ? r : null;
  } catch {
    return null;
  }
}

/**
 * Artigo de um pedido de renovação persistido (factos em JSON).
 * @param {object} n linha `contract_request`
 */
function contractRequestArticle(n) {
  const facts = parseNewsFacts(n) || {};
  const player = newsPlayer(n) || {
    id: n?.player_id,
    label: n?.player_name || "O jogador",
    photo: n?.player_photo || null,
    position: facts.position || "ATA",
  };
  const p = partPlayer(player);
  const demand =
    facts.requestedWage != null
      ? formatCurrency(facts.requestedWage)
      : "um valor não divulgado";
  const title = `Agente do Jogador — ${player.label}`;
  const end = facts.contractEndLabel ? ` Contrato até ${facts.contractEndLabel}.` : "";
  const body = facts.isRenegotiation
    ? `${facts.agent || "O agente"} viu o plantel no Excel: ${player.label} vale muito mais do que recebe. Exige ${demand}/sem.${end} A direção espera uma resposta antes que as conversas com outros clubes avancem.`
    : `${facts.agent || "O agente"} ligou em pânico: ${player.label} anda a olhar para vitrinas de troféus que não são as tuas. Exige ${demand}/sem.${end} Responde antes do próximo jogo.`;
  return {
    ...makeArticle([partText("Agente do Jogador — "), p], linkFirstMention(body, p), player, [], null),
    title,
    facts,
  };
}

/**
 * Artigo de um convite de clube persistido (factos em JSON).
 * @param {object} n linha `job_offer`
 */
function jobOfferArticle(n) {
  const facts = parseNewsFacts(n) || {};
  const to = newsTeam(n?.related_team_id, n?.related_team_name) || {
    id: n?.related_team_id,
    label: n?.related_team_name || "Um clube",
  };
  const from = newsTeam(n?.team_id, n?.team_name);
  const record = `${facts.wins ?? 0}V ${facts.draws ?? 0}E ${facts.losses ?? 0}D`;
  const title = `Convite: ${to.label}`;
  const body = `${to.label} quer-te como treinador. Responde antes do próximo jogo.`;
  return {
    ...makeArticle(
      [partText("Convite: "), partTeam(to)],
      linkFirstMention(body, partTeam(to)),
      null,
      [to, from],
      null,
    ),
    title,
    facts: { ...facts, record },
  };
}

/**
 * Artigo de um aviso da direção persistido (factos em JSON).
 * @param {object} n linha `board_warning`
 */
function boardWarningArticle(n) {
  const facts = parseNewsFacts(n) || {};
  const final = Number(facts.level) === 3;
  const title = final ? "Último aviso da direção" : "Aviso da direção";
  const owner = newsTeam(n?.team_id, n?.team_name);
  const body = `Orçamento negativo (${formatCurrency(facts.budget ?? 0)}): ${facts.streak ?? 1} semana${facts.streak === 1 ? "" : "s"} no vermelho. Carrega em Ok para confirmar leitura.`;
  return {
    ...makeArticle(
      [partText(title)],
      owner ? [partTeam(owner), partText(`: ${body.charAt(0).toLowerCase()}${body.slice(1)}`)] : [partText(body)],
      null,
      owner ? [owner] : [],
      null,
    ),
    title,
    facts: { ...facts, final },
  };
}

/**
 * Listagem do sorteio: o jogo do treinador em destaque no topo, os
 * restantes pares por ordem do sorteio (cada equipa clicável).
 * @param {Array} pairs pares `{ homeId, homeName, awayId, awayName }`
 * @param {number|string|null} viewerTeamId equipa do treinador
 * @returns {{ mine: object|null, body: string, bodyParts: Array }} 
 */
export function cupDrawListParts(pairs, viewerTeamId) {
  const list = Array.isArray(pairs) ? pairs : [];
  const mine =
    viewerTeamId != null
      ? list.find(
          (f) =>
            String(f.homeId) === String(viewerTeamId) ||
            String(f.awayId) === String(viewerTeamId),
        ) || null
      : null;
  const ordered = mine ? [mine, ...list.filter((f) => f !== mine)] : list;
  const bodyParts = [];
  ordered.forEach((f, idx) => {
    const home = { id: f.homeId, label: f.homeName || "?" };
    const away = { id: f.awayId, label: f.awayName || "?" };
    if (idx > 0) bodyParts.push(partText("\n"));
    if (idx === 0 && mine) bodyParts.push(partText("O seu jogo: ", { bold: true }));
    bodyParts.push(partTeam(home), partText(" – "), partTeam(away));
  });
  if (ordered.length === 0) bodyParts.push(partText("Sorteio por anunciar."));
  return { mine, body: plainParts(bodyParts), bodyParts };
}

/**
 * Artigo de um sorteio da Taça persistido (pares em JSON).
 * @param {object} n linha `cup_draw`
 * @param {number|string|null} viewerTeamId equipa do treinador
 */
function cupDrawArticle(n, viewerTeamId) {
  const facts = parseNewsFacts(n) || {};
  const fixtures = Array.isArray(facts.fixtures) ? facts.fixtures : [];
  const { mine, body, bodyParts } = cupDrawListParts(
    fixtures.map((f) => ({
      homeId: f.homeTeamId,
      homeName: f.homeName,
      awayId: f.awayTeamId,
      awayName: f.awayName,
    })),
    viewerTeamId,
  );
  const roundName = facts.roundName || "Taça";
  const title = `🏆 Sorteio: ${roundName}`;
  const home =
    mine ? { id: mine.homeId, label: mine.homeName || "?" } : null;
  const away =
    mine ? { id: mine.awayId, label: mine.awayName || "?" } : null;
  return {
    ...makeArticle(
      home && away
        ? [partText(`${title} — `), partTeam(home), partText(" – "), partTeam(away)]
        : [partText(title)],
      bodyParts,
      null,
      [],
      null,
    ),
    title,
    body,
    facts,
  };
}

/**
 * Artigo da classificação final da liga (tabela em JSON nos factos).
 * A tabela secca desenha-se no detalhe do Jornal; aqui ficam título, corpo
 * pesquisável e o campeão clicável.
 * @param {object} n linha `league_final`
 */
function leagueFinalArticle(n) {
  const facts = parseNewsFacts(n) || {};
  const rows = Array.isArray(facts.rows) ? facts.rows : [];
  const divName = facts.divName || "liga";
  const champion = facts.champion || rows[0]?.name || "?";
  const title = `📊 Classificação final — ${divName}`;
  const lines = rows.map(
    (r) => `${r.pos}.º ${r.name} — ${r.p} pts (${r.v}V ${r.e}E ${r.d}D)`,
  );
  const body =
    `A liga terminou e ${champion} sagrou-se campeão da ${divName}. ` +
    `A tabela final fica registada nesta edição para consulta futura, mesmo depois do arranque da nova época.\n` +
    lines.join("\n");
  const champ = rows[0] ? { id: rows[0].id, label: rows[0].name } : null;
  return {
    ...makeArticle(
      [partText(title)],
      champ ? linkFirstMention(body, partTeam(champ)) : [partText(body)],
      null,
      champ ? [champ] : [],
      null,
    ),
    title,
    body,
    facts,
  };
}
/**
 * Artigo de lesão/castigo persistido (factos em JSON, `amount` = until).
 * @param {object} n linha `injury`/`suspension`
 */
function medicalArticle(n) {
  const facts = parseNewsFacts(n) || {};
  const until = Number(n?.amount ?? facts.until) || 0;
  const kind = String(n?.type || "") === "suspension" ? "suspension" : "injury";
  const player = newsPlayer(n) || {
    id: n?.player_id,
    label: n?.player_name || "O jogador",
    photo: n?.player_photo || null,
    position: facts.position || "ATA",
  };
  const p = partPlayer(player);
  const profile = [facts.position || player.position, facts.skill != null ? `skill ${facts.skill}` : null]
    .filter(Boolean)
    .join(" · ");
  const detail = profile ? ` (${profile})` : "";
  const title =
    kind === "injury" ? `🩹 ${player.label} lesionado` : `🟥 ${player.label} castigado`;
  const body =
    kind === "injury"
      ? `${player.label}${detail} de fora até à jornada ${until + 1}. O departamento médico acompanha a recuperação e o treinador terá de reorganizar o plantel.`
      : `${player.label}${detail} suspenso até à jornada ${until + 1}. O castigo obriga o treinador a mexer nas contas da próxima convocatória.`;
  return {
    ...makeArticle(
      linkFirstMention(title, p),
      linkFirstMention(body, p),
      player,
      [],
      null,
    ),
    title,
    facts: { ...facts, until },
  };
}

function newsArticle(n, { owner, related, seller, buyer, viewerTeamId } = {}) {
  if (String(n?.type || "") === "postmatch") return postmatchArticle(n);
  if (String(n?.type || "") === "contract_request") return contractRequestArticle(n);
  if (String(n?.type || "") === "job_offer") return jobOfferArticle(n);
  if (String(n?.type || "") === "board_warning") return boardWarningArticle(n);
  if (String(n?.type || "") === "cup_draw") return cupDrawArticle(n, viewerTeamId);
  if (String(n?.type || "") === "league_final") return leagueFinalArticle(n);
  if (String(n?.type || "") === "injury" || String(n?.type || "") === "suspension")
    return medicalArticle(n);
  const player = newsPlayer(n);
  const type = String(n?.type || "");
  const amount = n?.amount ? formatCurrency(n.amount) : null;
  const description = String(n?.description || "").trim();
  const teams = [owner, related, seller, buyer];
  const transfer =
    type === "transfer_out"
      ? { from: owner, to: related }
      : type === "transfer_in" || type === "auction_won" || n?.source === "transfer"
        ? { from: seller || related, to: buyer || owner || related }
        : null;
  const p = player ? partPlayer(player) : partText(n?.player_name || "O jogador");
  const o = owner ? partTeam(owner) : partText(n?.team_name || "o clube");
  const r = related ? partTeam(related) : partText(n?.related_team_name || "o novo clube");
  const b = buyer ? partTeam(buyer) : owner ? partTeam(owner) : r;
  const s = seller ? partTeam(seller) : related ? partTeam(related) : null;
  const value = amount || "um valor não divulgado";
  const transferVariant = newsVariant(n, 4);
  let titleParts;
  let bodyParts;

  if (type === "transfer_in" || type === "auction_won" || n?.source === "transfer") {
    titleParts =
      transferVariant === 0
        ? [p, partText(" reforça "), b]
        : transferVariant === 1
          ? [b, partText(" aposta em "), p]
          : transferVariant === 2
            ? [p, partText(" chega ao "), b]
            : [partText("Novo rosto no "), b, partText(": "), p];
    bodyParts =
      transferVariant === 0
        ? [
            p,
            partText(" chega a "),
            b,
            partText(" vindo de "),
            s || partText("outro clube"),
            partText(` por ${value}. `),
            partText("A contratação acrescenta uma nova solução ao plantel e abre mais uma porta para o treinador mexer na equipa ao longo da época."),
          ]
        : transferVariant === 1
          ? [
              partText("O mercado mexeu: "),
              p,
              partText(" é a nova aposta de "),
              b,
              partText(` numa operação de ${value}. `),
              partText("A direcção fechou o negócio a pensar no presente, mas também na margem de crescimento que o jogador pode trazer ao clube."),
            ]
          : transferVariant === 2
            ? [
                p,
                partText(" muda-se para "),
                b,
                partText(` por ${value}. `),
                partText("A chegada aumenta a concorrência interna e oferece ao treinador mais uma combinação para os jogos em que o calendário apertar."),
              ]
            : [
                partText("O novo rosto de "),
                b,
                partText(" é "),
                p,
                partText(`, numa operação avaliada em ${value}. `),
                partText("Agora começa a parte menos visível do negócio: adaptar-se ao balneário, conquistar minutos e transformar a expectativa em rendimento."),
              ];
  } else if (type === "transfer_out") {
    titleParts = [p, partText(" deixa "), o];
    bodyParts =
      newsVariant(n, 3) === 0
        ? [
            p,
            partText(" segue para "),
            r,
            partText(` numa transferência de ${value}. `),
            partText("A saída fecha um capítulo no clube e deixa espaço para o treinador reorganizar o plantel e redistribuir minutos."),
          ]
        : newsVariant(n, 3) === 1
          ? [
              partText("O ciclo de "),
              p,
              partText(" termina em "),
              o,
              partText(". O jogador junta-se a "),
              r,
              partText(` por ${value}, enquanto o clube transforma uma despedida numa oportunidade para abrir espaço a novas soluções.`),
            ]
          : [
              p,
              partText(" muda de camisola e passa a representar "),
              r,
              partText(`. A operação de ${value} fica registada nas contas e na história recente do plantel, que terá agora de encontrar o seu substituto.`),
            ];
  } else if (type === "auction_failed") {
    titleParts = [partText("Leilão sem negócio: "), p];
    bodyParts =
      newsVariant(n, 2) === 0
        ? [
            partText("A licitação de "),
            p,
            partText(" terminou sem comprador. "),
            partText(description || "O jogador continua disponível para uma próxima oportunidade."),
            partText(" O mercado ainda pode voltar a abrir a porta, mas a próxima proposta terá de encontrar melhor resposta."),
          ]
        : [
            partText("Houve interesse, mas não houve acordo por "),
            p,
            partText(". A ausência de uma proposta vencedora mantém o jogador no circuito e deixa o próximo movimento entregue ao mercado."),
          ];
  } else if (type === "ticket_revenue") {
    titleParts = [partText("Bilheteira de "), o];
    bodyParts = [
      o,
      partText(` abriu as portas e arrecadou ${value}. `),
      partText(description || "A receita ajuda a financiar a próxima jornada."),
      partText(" Cada jogo em casa é mais do que noventa minutos: é uma oportunidade para aproximar a bancada e dar fôlego à tesouraria."),
    ];
  } else if (type === "weekly_income") {
    titleParts = [partText("Rendimento de "), o];
    bodyParts = [
      o,
      partText(` recebeu ${value} de rendimento base. `),
      partText("Não é uma manchete de mercado, mas é este fluxo regular que mantém o clube a trabalhar entre jornadas e dá margem para preparar o próximo desafio."),
    ];
  } else if (type === "wages") {
    titleParts = [partText("Folha salarial: "), o];
    bodyParts = [
      partText("A semana fecha com "),
      o,
      partText(` a pagar ${value} em salários. `),
      partText("É o preço de manter um balneário competitivo, mas também um lembrete de que cada decisão no mercado tem consequências para as contas do clube."),
    ];
  } else if (type === "stadium_upkeep") {
    titleParts = [partText("Manutenção em "), o];
    bodyParts = [
      o,
      partText(` investiu ${value} na manutenção do estádio. `),
      partText("A bancada raramente vê este trabalho, mas sente a diferença quando a casa está pronta para receber mais uma jornada e proteger a receita do clube."),
    ];
  } else if (
    type === "loan_interest" ||
    type === "loan_principal" ||
    type === "loan_take" ||
    type === "loan_pay"
  ) {
    titleParts = [partText("Contas bancárias: "), o];
    bodyParts =
      type === "loan_take"
        ? [
            o,
            partText(` assegurou ${value} através de um novo empréstimo. `),
            partText(description || "O dinheiro entra agora, mas a dívida passa a fazer parte do orçamento semanal."),
            partText(" É oxigénio imediato para o clube, não dinheiro grátis: cada prestação futura vai condicionar a margem para investir no plantel."),
          ]
        : type === "loan_pay"
          ? [
              o,
              partText(` reduziu a dívida em ${value}. `),
              partText(description || "O pagamento devolve algum controlo à tesouraria."),
              partText(" A factura ainda pode não estar fechada, mas o clube fica um passo mais perto de respirar sem a pressão do banco."),
            ]
          : [
              o,
              partText(` pagou ${value} em ${type === "loan_interest" ? "juros" : "capital do empréstimo"}. `),
              partText(description || "A dívida continua a pesar no orçamento semanal."),
              partText(" A tesouraria ganha tempo, mas o compromisso fica registado e terá de ser acomodado nas próximas decisões."),
            ];
  } else if (type === "stadium_build") {
    titleParts = [partText("A casa cresce: "), o];
    bodyParts = [
      o,
      partText(` ganhou mais lugares com um investimento de ${value}. `),
      partText(description || "Mais bancadas significam mais margem para a receita de bilheteira."),
      partText(" É uma aposta para os dias grandes, quando a ambição do clube precisar de mais vozes nas bancadas e de uma receita à altura."),
    ];
  } else if (type === "academy") {
    titleParts = [partText("Nova aposta: "), p];
    bodyParts = [
      p,
      partText(" sobe da academia de "),
      o,
      partText(` e chega com margem para crescer${amount ? ` após um investimento de ${value}` : ""}. `),
      partText("É o primeiro passo de um percurso que vai exigir paciência, minutos certos e espaço para o talento se transformar em rendimento pela equipa principal."),
    ];
  } else if (type === "renegotiation") {
    titleParts = [p, partText(" renova com "), o];
    bodyParts = [
      p,
      partText(" prolonga a ligação a "),
      o,
      partText(". O agente conseguiu melhores condições para manter o jogador focado e o clube protegeu uma peça que continua a fazer parte dos seus planos."),
    ];
  } else if (type === "cost_cut") {
    titleParts = [partText("Corte no plantel: "), p];
    bodyParts = [
      o,
      partText(" libertou "),
      p,
      partText(" para aliviar a folha salarial. "),
      partText(description || "A tesouraria falou mais alto."),
      partText(" É uma decisão fria, tomada para devolver margem de manobra ao clube antes que o desequilíbrio passe a pesar no balneário."),
    ];
  } else if (type === "cup_upset") {
    titleParts = [o, partText(" elimina "), r];
    bodyParts = [
      o,
      partText(" assinou a surpresa da ronda frente a "),
      r,
      partText(description ? `. ${description}. ` : ". O favoritismo ficou pelo caminho. "),
      partText("Durante uma noite, a diferença de estatuto deixou de contar e a competição ganhou uma história que a bancada vai repetir durante muito tempo."),
    ];
  } else if (type === "prize") {
    titleParts = [partText("Prémio para "), o];
    bodyParts = [
      o,
      partText(` recebe ${value}. `),
      partText(description || "O mérito desportivo também se sente nas contas do clube."),
      partText(" A recompensa chega depois do trabalho feito e dá ao clube mais espaço para preparar o que vem a seguir."),
    ];
  } else if (type === "welcome") {
    titleParts = [partText(n?.title || "Bem-vindo ao clube")];
    bodyParts = [
      o,
      partText(" abre as portas ao novo treinador. "),
      partText(description || "A sala está pronta, o plantel espera e a época começa agora."),
      partText(" Este é o primeiro capítulo de uma história que será escrita jornada a jornada, dentro e fora do campo."),
    ];
  } else {
    titleParts = player && owner ? [p, partText(" — "), o] : [partText(n?.title || "Notícia")];
    bodyParts = [
      owner ? o : player ? p : partText("O clube"),
      partText(description ? `: ${description}. ` : ". "),
      partText("O Jornal regista o acontecimento e deixa a próxima palavra entregue ao trabalho da equipa."),
    ];
  }

  return makeArticle(titleParts, bodyParts, player, teams, transfer);
}

/**
 * Converte linhas do `globalNews.news` em itens informativos (só leitura).
 * Negócios fundidos: transfer_in/transfer_out + linha do histórico global
 * com o mesmo jogador e jornada viram UM item de Mercado (um evento =
 * uma notícia). A ordem do servidor é preservada.
 * @param {Array} rows linhas `{id, source, type, title, description, amount, matchweek}`
 * @param {string} fallbackDate data da semana actual para linhas antigas/incompletas
 * @returns {Array} itens de inbox
 */
/**
 * Diz se um item transitório já tem par persistido (para o esconder e
 * mostrar só a linha da BD, com data fixa). Cobertura, não leitura.
 */
export function contractCovered(rows, playerId) {
  return (Array.isArray(rows) ? rows : []).some(
    (n) =>
      String(n?.type || "") === "contract_request" &&
      Number(n?.player_id) === Number(playerId),
  );
}
export function jobCovered(rows, toTeamId) {
  return (Array.isArray(rows) ? rows : []).some(
    (n) =>
      String(n?.type || "") === "job_offer" &&
      String(n?.related_team_id) === String(toTeamId),
  );
}
export function boardCovered(rows, teamId, level, streak) {
  return (Array.isArray(rows) ? rows : []).some((n) => {
    if (String(n?.type || "") !== "board_warning") return false;
    if (String(n?.team_id) !== String(teamId)) return false;
    const f = parseNewsFacts(n);
    return Number(f?.level) === Number(level) && Number(f?.streak) === Number(streak);
  });
}
export function cupDrawCovered(rows, season, round) {
  return (Array.isArray(rows) ? rows : []).some((n) => {
    if (String(n?.type || "") !== "cup_draw") return false;
    const f = parseNewsFacts(n);
    return Number(f?.season) === Number(season) && Number(f?.round) === Number(round);
  });
}
export function medicalCovered(rows, kind, playerId, until, year = null) {
  return (Array.isArray(rows) ? rows : []).some((n) => {
    if (String(n?.type || "") !== kind) return false;
    if (Number(n?.player_id) !== Number(playerId)) return false;
    if (Number(n?.amount) !== Number(until)) return false;
    // Só a época corrente cobre (linhas de épocas antigas não escondem o
    // transitório atual; year 0/null de BDs antigas conta como coringa).
    const rowYear = Number(n?.year) || 0;
    return rowYear === 0 || year == null || rowYear === Number(year);
  });
}

export function newsRowsToItems(rows, fallbackDate, viewerTeamId = null) {
  const list = Array.isArray(rows) ? rows : [];
  const groups = new Map();
  for (const n of list) {
    const key = dealKey(n);
    if (!key) continue;
    const g = groups.get(key) || { transfer: null, clubs: [] };
    if (n.source === "transfer") g.transfer = n;
    else g.clubs.push(n);
    groups.set(key, g);
  }
  const done = new Set();
  const items = [];
  for (const n of list) {
    const key = dealKey(n);
    if (key) {
      if (done.has(key)) continue;
      done.add(key);
      const g = groups.get(key);
      if (g.transfer) items.push(dealToItem(g.transfer, fallbackDate));
      else for (const c of g.clubs) items.push(clubDealToItem(c, fallbackDate));
    } else {
      items.push(rowToItem(n, fallbackDate, viewerTeamId));
    }
  }
  return items;
}

/** Tipos de club_news que descrevem o MESMO negócio da linha de transfer_history. */
const DEAL_CLUB_TYPES = new Set([
  "transfer_in",
  "transfer_out",
  "auction_won",
]);

/**
 * Chave de desduplicação de um negócio (jogador + jornada) ou null.
 * @param {object} n linha do globalNews
 * @returns {string|null}
 */
function dealKey(n) {
  if (!n) return null;
  const isDeal =
    n.source === "transfer" ||
    DEAL_CLUB_TYPES.has(String(n.type || ""));
  if (!isDeal) return null;
  if (n.player_id == null || n.matchweek == null) return null;
  return `${n.player_id}|${n.year ?? "?"}|${n.matchweek}`;
}

/**
 * Corpo rico de um negócio a partir da linha de transfer_history:
 * perfil + rota + valor + via.
 * @param {object} t linha com `source === "transfer"`
 * @returns {string}
 */
/**
 * Item único de um negócio concluído.
 * @param {object} t linha com `source === "transfer"`
 */
function dealToItem(t, fallbackDate) {
  const buyer = newsTeam(t.buyer_team_id || t.related_team_id, t.buyer_team_name || t.related_team_name);
  const seller = newsTeam(t.seller_team_id, t.seller_team_name);
  const article = newsArticle(t, {
    owner: buyer,
    buyer,
    seller,
    related: seller,
  });
  return {
    id: `deal-${t.player_id}-${t.year ?? "?"}-${t.matchweek}`,
    cat: "market",
    date: formatNewsDate(t, fallbackDate),
    ...article,
    redFlag: false,
    kind: "info",
    ref: null,
  };
}

/**
 * Linha órfã de negócio (transfer_in/out sem par no histórico): corpo
 * reconstruído da rota + valor em vez da descrição crua.
 * @param {object} c linha de club_news
 */
function clubDealToItem(c, fallbackDate) {
  const owner = newsTeam(c.team_id, c.team_name);
  const related = newsTeam(c.related_team_id, c.related_team_name);
  const article = newsArticle(c, { owner, related });
  return {
    id: `news-${c.source || "club"}-${c.id}`,
    cat: "market",
    date: formatNewsDate(c, fallbackDate),
    ...article,
    redFlag: false,
    kind: "info",
    ref: null,
  };
}

/**
 * Item genérico de notícia (só leitura, corpo enriquecido).
 * @param {object} n linha do globalNews
 */
function rowToItem(n, fallbackDate, viewerTeamId = null) {
  const owner = newsTeam(n.team_id, n.team_name);
  const related = newsTeam(n.related_team_id, n.related_team_name);
  const article = newsArticle(n, { owner, related, viewerTeamId });
  return {
    id: `news-${n.source || "club"}-${n.id}`,
    cat: newsCategory(n),
    date: formatNewsDate(n, fallbackDate),
    ...article,
    newsType: n?.type || null,
    redFlag: false,
    kind: "info",
    ref: null,
  };
}

/**
 * Itens de lesões e castigos a partir do plantel do treinador.
 * @param {Array} squad jogadores com `injury_until_matchweek` / `suspension_until_matchweek`
 * @param {number} nowIdx relógio atual (calendarIndex)
 * @param {string} dateLabel data da semana actual
 * @returns {Array} itens de inbox
 */
export function squadToMedicalItems(squad, nowIdx, dateLabel) {
  const items = [];
  for (const p of Array.isArray(squad) ? squad : []) {
    const inj = Number(p?.injury_until_matchweek) || 0;
    const sus = Number(p?.suspension_until_matchweek) || 0;
    const profile = [p?.position, p?.skill != null ? `skill ${p.skill}` : null]
      .filter(Boolean)
      .join(" · ");
    const detail = profile ? ` (${profile})` : "";
    const player = {
      id: p.id,
      label: p.name,
      photo: p.photo ?? null,
      position: p.position,
    };
    if (inj > nowIdx) {
      const title = `🩹 ${p.name} lesionado`;
      const body = `${p.name}${detail} de fora até à jornada ${inj + 1}.`;
      items.push({
        id: `inj-${p.id}-${inj}`,
        cat: "squad",
        date: dateLabel,
        title,
        body,
        titleParts: linkFirstMention(title, partPlayer(player)),
        bodyParts: linkFirstMention(body, partPlayer(player)),
        media: { player, teams: [] },
        redFlag: false,
        kind: "info",
        ref: null,
      });
    }
    if (sus > nowIdx) {
      const title = `🟥 ${p.name} castigado`;
      const body = `${p.name}${detail} suspenso até à jornada ${sus + 1}.`;
      items.push({
        id: `sus-${p.id}-${sus}`,
        cat: "squad",
        date: dateLabel,
        title,
        body,
        titleParts: linkFirstMention(title, partPlayer(player)),
        bodyParts: linkFirstMention(body, partPlayer(player)),
        media: { player, teams: [] },
        redFlag: false,
        kind: "info",
        ref: null,
      });
    }
  }
  return items;
}
