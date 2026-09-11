/**
 * JournalTab — o jornal da bancada.
 *
 * Landing tab (pós-login e pós-jogo). Uma FOLHA DE PAPEL clara (bege-creme)
 * pousada sobre o fundo escuro da app, com estética que evolui com o clube:
 *   · div 3-4 → .jp-amador: fotocópia de garagem (granulado forte, tapes,
 *     rotações, nódoa de café, dobra ao meio, masthead a preto-e-branco);
 *   · div 2   → .jp-semi: folha clara, caseiro cuidado (menos rotação,
 *     sem nódoas/dobra);
 *   · div 1   → .jp-pro: quase branco, grelha direita — sem tapes nem
 *     rotações, mas a voz de gozão de café mantém-se.
 * A 5.ª divisão não é jogável — irrelevante (cai no amador, nunca acontece).
 *
 * Conteúdo: masthead (nome+slogan por época), manchete gigante do teu jogo
 * com carimbo e cartoon, e tiras em molduras de "recorte-e-cola" (série,
 * classificação, humanos, artilheiros, mercado, bancadas). Voz gerada por
 * utils/journalHeadlines.js (função pura, determinística). A folha de papel
 * vem de .jp-paper/.jp-* no index.css (tokens redefinidos SCOPED, sem tocar
 * no resto da app).
 *
 * Dados: `globalNews` ({news, results} com `attendance`/`homeCapacity` por
 * jogo) + `teams` (com `coach_is_human`, `coach_name`, `division`,
 * `fans_mood`, `ticket_price`) + `topScorers` + `teamForms` + `players`
 * (só para detetar equipas de treinadores humanos), tudo do GameContext.
 */
import { useMemo } from "react";
import { SEASON_CALENDAR } from "../constants/index.js";
import { EmptyState } from "../components/shared/EmptyState.jsx";
import { TeamCrest } from "../components/live/TeamCrest.jsx";
import { formatCurrency } from "../utils/formatters.js";
import { getFansMoodLabel } from "../utils/morale.js";
import { compareStandingsRows } from "../utils/standingsRank.js";
import {
  buildHeadline,
  STAMP_TONE_CLASS,
} from "../utils/journalHeadlines.js";

const CUP_ROUND_LABELS = {
  1: "16 avos de final",
  2: "Oitavos de final",
  3: "Quartos de final",
  4: "Meias-finais",
  5: "Final",
};

const CARTOON_EMOJI = {
  megafone: "📣",
  bota: "👟",
  balde: "🪣",
  muralha: "🧱",
  apito: "📯",
  coroa: "👑",
};

/**
 * Nomes de capa do Jornal — feitos na bancada dos adeptos (banais, sem marca,
 * sem "cashball"). Cada época herda um par nome+slogan determinístico
 * (seed = seasonYear), estável durante toda a temporada e sem Math.random,
 * para a capa não oscilar entre renders.
 */
const MASTHEADS = [
  { name: "A Voz da Bancada", tagline: "a voz do povo que não cala — nem joga" },
  { name: "O Correio da Bancada", tagline: "notícias de cima, do quiosque e da tasca" },
  { name: "Do Alto da Bancada", tagline: "a melhor vista e os piores palpites" },
  { name: "O Grito da Bancada", tagline: "quando calamos é porque perdeu" },
  { name: "O Boletim do Adepto", tagline: "o parecer oficial de quem só assobia" },
  { name: "Notícias da Tasca", tagline: "tudo o que se soube antes do pão com manteiga" },
];

/**
 * Patamar de aspeto da folha a partir da divisão do clube.
 * 1 → profissional (2); 2 → semi (1); 3-4 (e 5/nula, não jogável) → amador (0).
 */
function journalTier(division) {
  const d = Number(division);
  if (d === 1) return 2;
  if (d === 2) return 1;
  return 0;
}

function cupLabel(round) {
  return CUP_ROUND_LABELS[round] || `Ronda ${round}`;
}

/**
 * Chave estável de um resultado. Os IDs vêm do SQLite (números) mas o
 * GameContext pode trazê-los como strings — normalizar com Number() evita
 * chaves duplicadas e jogos escondidos/exibidos no sítio errado.
 */
function gameKey(r) {
  return `${r.competition}|${r.matchweek ?? ""}|${r.round ?? ""}|${Number(r.homeTeamId)}|${Number(r.awayTeamId)}`;
}

/**
 * Tom das bancadas a partir de fans_mood (0-100). Limiares num sítio só —
 * antes estavam repetidos em quatro sítios (emoji, cor, barra, frase).
 */
function fansMoodTone(mood) {
  const m = Number(mood) || 0;
  if (m >= 70)
    return {
      emoji: "🥳",
      textClass: "text-tertiary",
      barClass: "bg-tertiary",
      quote: "A bancada está pelo clube — tragam é golos!",
    };
  if (m >= 45)
    return {
      emoji: "🙂",
      textClass: "text-primary",
      barClass: "bg-primary",
      quote: "Morno. Um bom resultado e isto ferve.",
    };
  if (m >= 25)
    return {
      emoji: "😬",
      textClass: "text-amber-500",
      barClass: "bg-amber-500",
      quote: "Adeptos de sobrolho carregado. Cuidado com os assobios.",
    };
  return {
    emoji: "🤬",
    textClass: "text-error",
    barClass: "bg-error",
    quote: "Lenços brancos na gaveta… por enquanto.",
  };
}

/**
 * Rota de uma notícia de transferência ("vendedor → comprador").
 * O servidor monta o título como
 * "{jogador} · {vendedor} → {comprador}" (socketNewsHandlers) sem colunas
 * separadas para o vendedor — parse defensivo com fallback para o título
 * intacto quando o formato não bate certo.
 */
function transferRoute(n) {
  const title = String(n?.title || "");
  if (!title.includes("→")) return title;
  const parts = title
    .split("·")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length <= 1) return title;
  return parts.slice(1).join(" · ");
}

function crowdLine(r) {
  if (r?.attendance == null) return null;
  const occ =
    r.homeCapacity > 0
      ? ` · ${Math.round((r.attendance / r.homeCapacity) * 100)}%`
      : "";
  return `${Number(r.attendance).toLocaleString("pt-PT")}${occ}`;
}

/**
 * Envoltório da folha de papel. O patamar (jp-amador/semi/pro) decide a cor
 * da folha, o granulado e a tinta (tokens scoped no index.css); os ornamentos
 * de fotocópia crua (nódoas + dobra) só aparecem no amador.
 */
function PaperSheet({ tierCls, amateur, children }) {
  return (
    <div
      className={`jp-paper ${tierCls} relative overflow-hidden rounded-md sm:rounded-lg px-2 sm:px-5 py-4 sm:py-5`}
    >
      {amateur && (
        <>
          <div aria-hidden className="jp-stain jp-stain-a" />
          <div aria-hidden className="jp-stain jp-stain-b" />
          <div aria-hidden className="jp-crease" />
        </>
      )}
      <div className="relative z-[1] space-y-4 short:space-y-2">{children}</div>
      <div aria-hidden className="jp-grain" />
    </div>
  );
}

/* ── Rabiscos: estrela de banda desenhada com emoji lá dentro ──────────── */
function Burst({ emoji, className = "text-tertiary", size = 56 }) {
  return (
    <span
      aria-hidden
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} className="absolute inset-0">
        <path
          d="M50 2 L61 22 L82 12 L80 34 L100 40 L84 54 L96 72 L74 72 L70 94 L54 78 L38 94 L34 72 L12 72 L24 54 L8 40 L28 34 L26 12 L47 22 Z"
          fill="currentColor"
          opacity="0.9"
        />
        <circle cx="50" cy="52" r="26" fill="var(--color-surface-container)" />
      </svg>
      <span className="relative text-2xl leading-none">{emoji}</span>
    </span>
  );
}

/* ── Tira de fita-cola (pura decoração; só nos patamares caseiros) ─────── */
function Tape({ className = "" }) {
  return (
    <div
      aria-hidden
      className={`jp-tape pointer-events-none absolute -top-0 left-10 h-5 w-20 -translate-y-1/2 rotate-[-6deg] ${className}`}
    />
  );
}

/* ── Moldura fanzine: cartão recortado com autocolante de título ───────── */
function FanzineCard({
  sticker,
  stickerClass = "bg-tertiary text-zinc-950",
  meta,
  tilt = "",
  shadowCls = "",
  stickerRot = "",
  craft = true,
  children,
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-md border-2 border-on-surface/15 bg-surface-container ${shadowCls} ${tilt}`}
    >
      {craft && <Tape />}
      <div className="flex items-center justify-between gap-2 px-3 short:px-2 pt-3 short:pt-2">
        <span
          className={`inline-flex ${stickerRot} rounded-sm px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${craft ? "shadow-md shadow-black/50" : "shadow-sm"} ${stickerClass}`}
        >
          {sticker}
        </span>
        {meta && (
          <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
            {meta}
          </span>
        )}
      </div>
      <div className="px-1.5 pb-1.5 pt-1">{children}</div>
    </section>
  );
}

/* ── Resultado em vinheta: recorte com linha de tesoura (caso) / limpo ─── */
function ComicResultRow({ r, teamById, myTeamId, contextLabel, craft = true }) {
  const home = teamById.get(Number(r.homeTeamId));
  const away = teamById.get(Number(r.awayTeamId));
  const moms = [r.momHome?.playerName, r.momAway?.playerName].filter(Boolean);
  return (
    <div
      className={`m-1.5 rounded-sm border bg-surface-container-low px-2 py-1.5 ${
        craft
          ? "border-dashed border-outline-variant/40"
          : "border-outline-variant/30"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <TeamCrest
          team={home || { name: r.homeName }}
          isMine={r.homeTeamId === myTeamId}
          size="sm"
          rotate={craft ? 6 : 0}
        />
        <p className="flex-1 min-w-0 text-right text-xs font-black text-on-surface truncate">
          {r.homeName}
        </p>
        <div className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-container-high border-2 border-on-surface/20">
          <span className="text-xs font-black text-on-surface tabular-nums">{r.homeScore}</span>
          <span className="text-[10px] text-on-surface-variant">–</span>
          <span className="text-xs font-black text-on-surface tabular-nums">{r.awayScore}</span>
        </div>
        <p className="flex-1 min-w-0 text-xs font-black text-on-surface truncate">
          {r.awayName}
        </p>
        <TeamCrest
          team={away || { name: r.awayName }}
          isMine={r.awayTeamId === myTeamId}
          size="sm"
          rotate={craft ? -6 : 0}
        />
      </div>
      {(moms.length > 0 || contextLabel) && (
        <p className="mt-0.5 text-[10px] text-on-surface-variant truncate text-center">
          {moms.length > 0 ? `⭐ ${moms.join(" · ")}` : ""}
          {moms.length > 0 && contextLabel ? " · " : ""}
          {contextLabel || ""}
        </p>
      )}
    </div>
  );
}

/** Pontinhos de forma V/E/D (letra mais recente à direita). Com role="img"
 *  e etiqueta textual — antes eram só cor, ilegíveis para leitores de ecrã. */
function MiniFormDots({ form = "" }) {
  const chars = String(form).split("").slice(-5);
  while (chars.length < 5) chars.unshift(null);
  const words = chars.map((c) =>
    c === "V"
      ? "vitória"
      : c === "E"
        ? "empate"
        : c === "D"
          ? "derrota"
          : "por jogar",
  );
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`Forma recente: ${words.join(", ")}`}
    >
      {chars.map((c, i) => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${
            c === "V"
              ? "bg-emerald-500"
              : c === "E"
                ? "bg-amber-500"
                : c === null
                  ? "bg-surface-container-high"
                  : "bg-red-500"
          }`}
        />
      ))}
    </span>
  );
}

/**
 * @param {{
 *   globalNews: {news: Array, results: Array},
 *   teams: Array,
 *   me: object,
 *   seasonYear: number,
 *   topScorers?: Array,
 *   teamForms?: Object,
 *   players?: Array,
 *   onOpenPlayerHistory?: (player: {id:number}) => void,
 * }} props
 */
export function JournalTab({
  globalNews = { news: [], results: [] },
  teams = [],
  me,
  seasonYear,
  topScorers = [],
  teamForms = {},
  players = [],
  onOpenPlayerHistory,
}) {
  // Masthead da época (nome+slogan) — determinístico por seasonYear.
  const masthead = useMemo(() => {
    const list = MASTHEADS;
    return list[Math.abs(Number(seasonYear) || 0) % list.length];
  }, [seasonYear]);

  const news = useMemo(
    () => (Array.isArray(globalNews?.news) ? globalNews.news : []),
    [globalNews],
  );
  const results = useMemo(
    () => (Array.isArray(globalNews?.results) ? globalNews.results : []),
    [globalNews],
  );

  // ── Último evento: a capa segue o jogo antecedente ─────────────────────
  // Índice de calendário por resultado (liga/taça/amigável). Sem resultados
  // → null (pré-época ou época nova); nesse caso só as tiras de época contam.
  const lastEvent = useMemo(() => {
    let best = -1;
    for (const r of results) {
      let idx = -1;
      if (r.competition === "League") {
        idx = SEASON_CALENDAR.findIndex(
          (e) => e.type === "league" && e.matchweek === r.matchweek,
        );
      } else if (r.competition === "Cup" || r.competition === "Friendly") {
        const round = r.competition === "Friendly" ? 0 : r.round;
        idx = SEASON_CALENDAR.findIndex(
          (e) => (e.type === "cup" || e.type === "friendly") && e.round === round,
        );
      }
      if (idx > best) best = idx;
    }
    return best >= 0 ? (SEASON_CALENDAR[best] ?? null) : null;
  }, [results]);

  // Mapas da jornada numa só passagem sobre teams/players: emblema por
  // equipa, equipas de treinadores humanos e nome do treinador por equipa.
  // Chaves sempre Number() — o servidor manda números, o contexto pode
  // trazer strings.
  const { teamById, humanTeamIds, coachByTeamId } = useMemo(() => {
    const byId = new Map();
    const humans = new Set();
    const coaches = new Map();
    for (const t of teams || []) {
      byId.set(Number(t.id), t);
      if (t.coach_is_human === 1) humans.add(Number(t.id));
      if (t.coach_name) coaches.set(Number(t.id), t.coach_name);
    }
    for (const p of players || [])
      if (p?.teamId != null) humans.add(Number(p.teamId));
    return { teamById: byId, humanTeamIds: humans, coachByTeamId: coaches };
  }, [teams, players]);

  const myTeamId = me?.teamId != null ? Number(me.teamId) : null;
  const myTeam = useMemo(
    () =>
      myTeamId == null
        ? null
        : ((teams || []).find((t) => Number(t.id) === myTeamId) ?? null),
    [teams, myTeamId],
  );
  const myDivision = myTeam?.division ?? null;

  // ── Patamar da folha (1 → pro · 2 → semi · 3-4 → amador) ──────────────
  const tier = journalTier(myDivision);
  const tierCls = tier === 2 ? "jp-pro" : tier === 1 ? "jp-semi" : "jp-amador";
  const amateur = tier === 0; // fotocópia crua (nódoas, dobra, masthead B&W)
  const crafty = tier < 2; // ornamentos caseiros (tapes/rotações/recortes)
  const cardShadow = amateur
    ? "shadow-[5px_5px_0_rgba(0,0,0,0.45)]"
    : crafty
      ? "shadow-[3px_3px_0_rgba(0,0,0,0.28)]"
      : "shadow-sm";
  const stampRot = amateur ? "rotate-[12deg]" : crafty ? "rotate-[6deg]" : "";
  const stickerRot = amateur ? "-rotate-2" : crafty ? "-rotate-1" : "";
  const scoreRot = amateur ? "-rotate-1" : crafty ? "-rotate-[0.5deg]" : "";
  // Inclinações de moldura: par/ímpar alternam o sinal (estáticas no ficheiro
  // para o scanner do Tailwind as gerar; amplitude cai no patamar limpo).
  const tiltPos = amateur
    ? "sm:rotate-[0.4deg]"
    : crafty
      ? "sm:rotate-[0.15deg]"
      : "";
  const tiltNeg = amateur
    ? "sm:rotate-[-0.4deg]"
    : crafty
      ? "sm:rotate-[-0.15deg]"
      : "";

  // ── Jornada anterior (só Liga) ──────────────────────────────────────────
  const leagueResults = useMemo(
    () => results.filter((r) => r.competition === "League"),
    [results],
  );
  const lastWeek = useMemo(
    () =>
      leagueResults.reduce((max, r) => Math.max(max, r.matchweek || 0), 0),
    [leagueResults],
  );
  const lastWeekGames = useMemo(
    () => leagueResults.filter((r) => (r.matchweek || 0) === lastWeek),
    [leagueResults, lastWeek],
  );

  // ── Manchete: o meu jogo da jornada; senão o meu jogo da Taça ──────────
  const myLeagueGame = useMemo(
    () =>
      myTeamId == null
        ? null
        : (lastWeekGames.find(
            (r) =>
              Number(r.homeTeamId) === myTeamId ||
              Number(r.awayTeamId) === myTeamId,
          ) ?? null),
    [lastWeekGames, myTeamId],
  );
  // Última ronda da Taça jogada. O meu jogo da taça é o dessa ronda — se fui
  // eliminado antes, não há jogo meu (cai na liga em vez de manchete velha).
  const lastCupRound = useMemo(
    () =>
      results.reduce(
        (max, r) =>
          r.competition === "Cup" ? Math.max(max, r.round || 0) : max,
        0,
      ),
    [results],
  );
  // Jogos da ronda (só quando a ronda manda na capa).
  const cupRoundGames = useMemo(
    () =>
      lastEvent?.type === "cup"
        ? results.filter(
            (r) => r.competition === "Cup" && (r.round || 0) === lastEvent.round,
          )
        : [],
    [results, lastEvent],
  );
  const myCupGame = useMemo(() => {
    if (myTeamId == null || lastCupRound === 0) return null;
    return (
      results.find(
        (r) =>
          r.competition === "Cup" &&
          (r.round || 0) === lastCupRound &&
          (Number(r.homeTeamId) === myTeamId ||
            Number(r.awayTeamId) === myTeamId),
      ) ?? null
    );
  }, [results, myTeamId, lastCupRound]);
  const headline = useMemo(
    () => myLeagueGame ?? myCupGame,
    [myLeagueGame, myCupGame],
  );

  // ── Pré-época: o amigável (competição própria, ronda 0) ────────────────
  const friendlyResults = useMemo(
    () => results.filter((r) => r.competition === "Friendly"),
    [results],
  );
  const myFriendlyGame = useMemo(
    () =>
      myTeamId == null
        ? null
        : (friendlyResults.find(
            (r) =>
              Number(r.homeTeamId) === myTeamId ||
              Number(r.awayTeamId) === myTeamId,
          ) ?? null),
    [friendlyResults, myTeamId],
  );
  const otherFriendlyGames = useMemo(() => {
    const myKey = myFriendlyGame ? gameKey(myFriendlyGame) : null;
    return friendlyResults
      .filter((r) => gameKey(r) !== myKey)
      .slice(0, 6);
  }, [friendlyResults, myFriendlyGame]);

  // ── Posições na série (para o gozão: tombar gigantes / tropeções) ───────
  const divStandings = useMemo(() => {
    if (myDivision == null) return [];
    return [...(teams || [])]
      .filter((t) => Number(t.division) === Number(myDivision))
      .sort(compareStandingsRows);
  }, [teams, myDivision]);
  const myPos = useMemo(() => {
    if (myTeamId == null) return null;
    const i = divStandings.findIndex((t) => Number(t.id) === myTeamId);
    return i >= 0 ? i + 1 : null;
  }, [divStandings, myTeamId]);
  const oppPos = useMemo(() => {
    if (!headline || headline.competition !== "League") return null;
    const oppId =
      Number(headline.homeTeamId) === myTeamId
        ? Number(headline.awayTeamId)
        : Number(headline.homeTeamId);
    const i = divStandings.findIndex((t) => Number(t.id) === oppId);
    return i >= 0 ? i + 1 : null;
  }, [headline, divStandings, myTeamId]);

  const voice = useMemo(
    () =>
      buildHeadline(headline, {
        myTeamId,
        myPos,
        oppPos,
        totalTeams: divStandings.length || null,
      }),
    [headline, myTeamId, myPos, oppPos, divStandings],
  );
  const stampClass = STAMP_TONE_CLASS[voice.stamp.tone] || STAMP_TONE_CLASS.draw;

  // ── A minha série (jornada, sem o jogo da manchete) ─────────────────────
  const seriesGames = useMemo(() => {
    if (myDivision == null) return [];
    const key = headline ? gameKey(headline) : null;
    return lastWeekGames.filter(
      (r) =>
        (Number(r.homeDivision) === Number(myDivision) ||
          Number(r.awayDivision) === Number(myDivision)) &&
        gameKey(r) !== key,
    );
  }, [lastWeekGames, myDivision, headline]);

  // ── Humanos noutras divisões (jornada) ──────────────────────────────────
  const humanGames = useMemo(() => {
    if (myDivision == null) return [];
    const key = headline ? gameKey(headline) : null;
    return lastWeekGames.filter((r) => {
      if (gameKey(r) === key) return false;
      const inMyDiv =
        Number(r.homeDivision) === Number(myDivision) ||
        Number(r.awayDivision) === Number(myDivision);
      if (inMyDiv) return false;
      return (
        humanTeamIds.has(Number(r.homeTeamId)) ||
        humanTeamIds.has(Number(r.awayTeamId))
      );
    });
  }, [lastWeekGames, myDivision, headline, humanTeamIds]);

  // Jogos de humanos da ronda (a tira da taça; sem o jogo da manchete).
  const roundHumans = useMemo(() => {
    if (lastEvent?.type !== "cup") return [];
    const headKey = headline ? gameKey(headline) : null;
    return cupRoundGames.filter((r) => {
      if (gameKey(r) === headKey) return false;
      return (
        humanTeamIds.has(Number(r.homeTeamId)) ||
        humanTeamIds.has(Number(r.awayTeamId))
      );
    });
  }, [cupRoundGames, headline, humanTeamIds, lastEvent]);

  // Linha de jogo de humanos (tira da ronda + tira de treinadores).
  const renderHumanRow = (r) => {
    const div =
      Number(r.homeDivision) === Number(r.awayDivision)
        ? r.homeDivision
        : null;
    const coachIds = [r.homeTeamId, r.awayTeamId].filter((id) =>
      humanTeamIds.has(Number(id)),
    );
    const coachTxt = coachIds
      .map((id) => coachByTeamId.get(Number(id)))
      .filter(Boolean)
      .join(" · ");
    return (
      <ComicResultRow
        key={gameKey(r)}
        r={r}
        teamById={teamById}
        myTeamId={myTeamId}
        craft={crafty}
        contextLabel={`${div != null ? `Série ${div}` : "Taça"}${coachTxt ? ` · 🧢 ${coachTxt}` : ""}`}
      />
    );
  };

  // ── Mini-classificação da minha divisão ─────────────────────────────────
  const miniTable = useMemo(() => {
    if (myDivision == null) return { rows: [], myPos: -1, total: 0 };
    const divTeams = [...divStandings];
    const pos = divTeams.findIndex((t) => Number(t.id) === myTeamId);
    const want = new Set([0, pos - 1, pos, pos + 1, divTeams.length - 2, divTeams.length - 1]);
    const rows = divTeams
      .map((t, i) => ({ team: t, pos: i + 1 }))
      .filter(({ pos: p }) => want.has(p - 1));
    return { rows, myPos: pos + 1, total: divTeams.length };
  }, [divStandings, myDivision, myTeamId]);

  // ── Bota de Ouro + mercado ────────────────────────────────────────────
  const scorers = useMemo(
    () => (Array.isArray(topScorers) ? topScorers.slice(0, 5) : []),
    [topScorers],
  );
  const topTransfers = useMemo(
    () =>
      news
        .filter((n) => n.source === "transfer")
        .sort((a, b) => (b.amount || 0) - (a.amount || 0))
        .slice(0, 5),
    [news],
  );

  // Tomba-gigantes da Taça (notícias persistentes `cup_upset` gravadas na
  // finalização da ronda). A description vem no formato
  // "{ronda} · {divV} vence {divP} · {resultado}"; parse defensivo com
  // fallback para o título.
  const cupUpsets = useMemo(
    () =>
      news
        .filter((n) => n.type === "cup_upset")
        .map((n) => {
          const parts = String(n.description || "").split(" · ");
          const m = /^Tomba-gigantes:\s*(.+?)\s+elimina\s+(.+?)$/.exec(
            String(n.title || ""),
          );
          return {
            id: n.id,
            title: n.title,
            round: parts[0] || null,
            detail: parts[1] || null,
            score: parts[2] || null,
            winner: n.team_name || m?.[1] || null,
            loser: n.related_team_name || m?.[2] || null,
          };
        })
        .slice(0, 5),
    [news],
  );

  // ── Bancadas ────────────────────────────────────────────────────────────
  const fansMood = myTeam?.fans_mood ?? null;
  const myGameCrowd = headline ? crowdLine(headline) : null;
  const bestHouse = useMemo(() => {
    const eventPool =
      lastEvent?.type === "cup"
        ? cupRoundGames
        : lastEvent?.type === "friendly"
          ? friendlyResults
          : [...seriesGames, ...(myLeagueGame ? [myLeagueGame] : [])];
    const pool = eventPool.filter((r) => r.attendance != null);
    if (pool.length === 0) return null;
    pool.sort((a, b) => (b.attendance || 0) - (a.attendance || 0));
    return pool[0];
  }, [seriesGames, myLeagueGame, cupRoundGames, friendlyResults, lastEvent]);

  const hasAnything =
    headline != null ||
    friendlyResults.length > 0 ||
    cupRoundGames.length > 0 ||
    seriesGames.length > 0 ||
    humanGames.length > 0 ||
    miniTable.rows.length > 0 ||
    scorers.length > 0 ||
    topTransfers.length > 0 ||
    cupUpsets.length > 0;

  if (!hasAnything) {
    return (
      <PaperSheet tierCls={tierCls} amateur={amateur}>
        <EmptyState
          emoji="📰"
          title="Jornal sem manchetes"
          description="Ainda não se jogou nesta época."
        />
      </PaperSheet>
    );
  }

  const headlineHome = headline ? teamById.get(Number(headline.homeTeamId)) : null;
  const headlineAway = headline ? teamById.get(Number(headline.awayTeamId)) : null;
  const mood = fansMood != null ? fansMoodTone(fansMood) : null;

  return (
    <PaperSheet tierCls={tierCls} amateur={amateur}>
      {/* ── MASTHEAD ──────────────────────────────────────────────────── */}
      <div
        className={`relative overflow-hidden rounded-md border-2 border-on-surface/20 bg-surface-container px-4 short:px-3 py-3 short:py-2 ${
          amateur ? "jp-photocopy " : ""
        }${crafty ? cardShadow : "shadow-sm"}`}
      >
        {crafty && <Tape className="left-1/2" />}
        {crafty && <div aria-hidden className="tactical-pattern absolute inset-0" />}
        <div className="relative flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p
              className={`inline-flex ${stickerRot} rounded-sm bg-error px-1.5 py-px text-[9px] font-black uppercase tracking-widest text-zinc-950 shadow-md shadow-black/50`}
            >
              {masthead.tagline}
            </p>
            <h1 className="mt-1 font-headline text-2xl sm:text-4xl short:text-xl font-black uppercase tracking-tight leading-none text-on-surface">
              {masthead.name}
            </h1>
            <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
              {lastWeek > 0 ? `N.º ${lastWeek}` : "N.º 0"} · Época {seasonYear || ""} · Preço: 3 pontos
            </p>
          </div>
          <Burst emoji="📰" className="text-primary hidden sm:inline-flex" size={60} />
        </div>
      </div>

      {/* ── MANCHETE GIGANTE ──────────────────────────────────────────── */}
      {headline && (
        <section
          className={`relative overflow-hidden rounded-md border-2 border-tertiary/40 bg-surface-container ${
            crafty ? cardShadow : "shadow-sm"
          }`}
        >
          {amateur && (
            <>
              <Tape />
              <Tape className="left-auto right-10 rotate-[5deg]" />
            </>
          )}
          {crafty && <div aria-hidden className="tactical-pattern absolute inset-0" />}
          {/* Carimbo rodado: em fluxo ao lado do kicker no telemóvel
              (nunca tapa o título); absoluto sobre a manchete no sm+. */}
          <span
            aria-hidden
            className={`absolute right-4 top-10 hidden sm:inline-block ${stampRot} rounded-sm border-4 px-2 py-0.5 font-headline text-lg font-black uppercase tracking-widest bg-surface/70 ${stampClass}`}
          >
            {voice.stamp.text}
          </span>
          <div className="relative px-4 sm:px-6 short:px-3 pt-4 short:pt-3 pb-3">
            <div className="flex items-start gap-3">
              <Burst emoji={CARTOON_EMOJI[voice.cartoon] || "📣"} className="text-tertiary mt-1" size={64} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p
                    className={`inline-flex ${crafty ? "-rotate-1" : ""} rounded-sm bg-primary px-1.5 py-px text-[9px] font-black uppercase tracking-widest text-zinc-950`}
                  >
                    {voice.kicker}
                  </p>
                  <span
                    className={`sm:hidden inline-flex shrink-0 ${stampRot} rounded-sm border-[3px] px-1.5 py-px font-headline text-[11px] font-black uppercase tracking-widest bg-surface/70 ${stampClass}`}
                  >
                    {voice.stamp.text}
                  </span>
                </div>
                <h2 className="mt-1 font-headline text-2xl sm:text-4xl short:text-xl font-black uppercase tracking-tight leading-[1.02] text-on-surface">
                  {voice.title}
                </h2>
                <p className="mt-1 text-xs sm:text-sm short:text-[11px] text-on-surface-variant italic leading-snug">
                  {voice.subtitle}
                </p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/70">
                  {headline.competition === "League"
                    ? `Liga · Jornada ${headline.matchweek}`
                    : `Taça · ${cupLabel(headline.round)}`}
                </p>
              </div>
            </div>

            {/* Placar */}
            <div className="mt-3 flex items-center gap-2 sm:gap-3 rounded-sm border-2 border-on-surface/20 bg-surface-container-low px-2 sm:px-3 py-3 short:py-2">
              <div className="flex-1 min-w-0 flex flex-col items-center gap-1.5 text-center">
                <TeamCrest
                  team={headlineHome || { name: headline.homeName }}
                  isMine={Number(headline.homeTeamId) === myTeamId}
                  size="lg"
                  rotate={crafty ? 6 : 0}
                />
                <p className="text-sm short:text-xs font-black text-on-surface leading-tight break-words">
                  {headline.homeName}
                </p>
                {headline.momHome && (
                  <p className="text-[10px] text-amber-400/90 truncate max-w-full">
                    ⭐ {headline.momHome.playerName}
                  </p>
                )}
              </div>
              <div className={`shrink-0 flex flex-col items-center gap-1 px-3 py-1.5 rounded bg-surface-container-high border-2 border-tertiary/40 ${scoreRot}`}>
                <div className="flex items-center gap-2">
                  <span className="text-3xl sm:text-5xl short:text-2xl font-black font-headline text-on-surface tabular-nums">
                    {headline.homeScore}
                  </span>
                  <span className="font-headline text-lg text-tertiary">–</span>
                  <span className="text-3xl sm:text-5xl short:text-2xl font-black font-headline text-on-surface tabular-nums">
                    {headline.awayScore}
                  </span>
                </div>
              </div>
              <div className="flex-1 min-w-0 flex flex-col items-center gap-1.5 text-center">
                <TeamCrest
                  team={headlineAway || { name: headline.awayName }}
                  isMine={Number(headline.awayTeamId) === myTeamId}
                  size="lg"
                  rotate={crafty ? -6 : 0}
                />
                <p className="text-sm short:text-xs font-black text-on-surface leading-tight break-words">
                  {headline.awayName}
                </p>
                {headline.momAway && (
                  <p className="text-[10px] text-amber-400/90 truncate max-w-full">
                    ⭐ {headline.momAway.playerName}
                  </p>
                )}
              </div>
            </div>

            {myGameCrowd && (
              <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                🏟️ {myGameCrowd} nas bancadas
              </p>
            )}
          </div>
        </section>
      )}

      {/* ── TIRAS (recortes de moldura) ───────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 short:gap-2 items-start">
        {friendlyResults.length > 0 && lastEvent?.type === "friendly" && (
          <FanzineCard
            sticker="Pré-época"
            meta="Amigável"
            tilt={crafty ? tiltPos : ""}
            shadowCls={cardShadow}
            stickerRot={stickerRot}
            craft={crafty}
          >
            <div>
              {[myFriendlyGame, ...otherFriendlyGames]
                .filter(Boolean)
                .map((r) => (
                  <ComicResultRow
                    key={gameKey(r)}
                    r={r}
                    teamById={teamById}
                    myTeamId={myTeamId}
                    craft={crafty}
                  />
                ))}
            </div>
            <p className="px-2.5 pb-2 text-[10px] italic text-on-surface-variant/70">
              Roda-se a equipa antes da época. Sem cartões, sem lesões.
            </p>
          </FanzineCard>
        )}

        {seriesGames.length > 0 && lastEvent?.type === "league" && (
          <FanzineCard
            sticker="A tua série"
            meta={`Jornada ${lastWeek}`}
            tilt={crafty ? tiltPos : ""}
            shadowCls={cardShadow}
            stickerRot={stickerRot}
            craft={crafty}
          >
            <div>
              {seriesGames.map((r) => (
                <ComicResultRow
                  key={gameKey(r)}
                  r={r}
                  teamById={teamById}
                  myTeamId={myTeamId}
                  craft={crafty}
                />
              ))}
            </div>
            <p className="px-2.5 pb-2 text-[10px] italic text-on-surface-variant/70">
              Recorte e cole no caderno do mister. ✂️
            </p>
          </FanzineCard>
        )}

        {lastEvent?.type === "cup" && roundHumans.length > 0 && (
          <FanzineCard
            sticker="Taça"
            stickerClass="bg-amber-500 text-zinc-950"
            meta={cupLabel(lastEvent.round)}
            tilt={crafty ? tiltPos : ""}
            shadowCls={cardShadow}
            stickerRot={stickerRot}
            craft={crafty}
          >
            <div>{roundHumans.map(renderHumanRow)}</div>
            <p className="px-2.5 pb-2 text-[10px] italic text-on-surface-variant/70">
              A eliminar é que está o ganho.
            </p>
          </FanzineCard>
        )}

        {miniTable.rows.length > 0 && (
          <FanzineCard
            sticker="Classificação"
            stickerClass="bg-primary text-zinc-950"
            meta={miniTable.myPos > 0 ? `${miniTable.myPos}.º` : ""}
            tilt={crafty ? tiltNeg : ""}
            shadowCls={cardShadow}
            stickerRot={stickerRot}
            craft={crafty}
          >
            <ol>
              {miniTable.rows.map(({ team, pos }, i) => {
                const prev = miniTable.rows[i - 1]?.pos ?? null;
                const gap = prev != null && pos - prev > 1;
                const isMe = Number(team.id) === myTeamId;
                const played =
                  (team.wins || 0) + (team.draws || 0) + (team.losses || 0);
                const zone =
                  myDivision > 1 && pos <= 2
                    ? "subida"
                    : pos > miniTable.total - 2
                      ? "descida"
                      : null;
                const marker =
                  zone === "subida"
                    ? "border-l-emerald-500"
                    : zone === "descida"
                      ? "border-l-red-500"
                      : "border-l-transparent";
                return (
                  <li key={team.id}>
                    {gap && (
                      <p className="px-3 text-center text-[10px] text-on-surface-variant/50 leading-none py-0.5">
                        ✂️ - - - - - - - - -
                      </p>
                    )}
                    <div
                      className={`flex items-center gap-2 px-2.5 short:px-2 py-1.5 border-l-2 ${marker} ${
                        isMe
                          ? crafty
                            ? "bg-primary-container/25 -rotate-[0.5deg]"
                            : "bg-primary-container/25"
                          : ""
                      }`}
                    >
                      <span className="w-4 shrink-0 text-[10px] font-black text-on-surface-variant tabular-nums">
                        {pos}
                      </span>
                      <TeamCrest team={team} isMine={isMe} size="sm" />
                      <p className="flex-1 min-w-0 text-xs font-black text-on-surface truncate">
                        {pos === 1 ? "👑 " : ""}{team.name}
                        {isMe ? " · TU" : ""}
                        {zone && (
                          <span className="sr-only">{` (zona de ${zone})`}</span>
                        )}
                      </p>
                      <MiniFormDots form={teamForms[team.id] || ""} />
                      <span className="hidden min-[420px]:inline w-6 shrink-0 text-right text-[10px] text-on-surface-variant tabular-nums">
                        {played}J
                      </span>
                      <span className="w-7 shrink-0 text-right text-xs font-black text-on-surface tabular-nums">
                        {team.points || 0}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </FanzineCard>
        )}

        {humanGames.length > 0 && lastEvent?.type === "league" && (
          <FanzineCard
            sticker="Outros treinadores"
            stickerClass="bg-amber-500 text-zinc-950"
            meta={`${humanGames.length} jogo${humanGames.length !== 1 ? "s" : ""}`}
            tilt={crafty ? tiltPos : ""}
            shadowCls={cardShadow}
            stickerRot={stickerRot}
            craft={crafty}
          >
            <div>{humanGames.map(renderHumanRow)}</div>
            <p className="px-2.5 pb-2 text-[10px] italic text-on-surface-variant/70">
              Espionagem legal: vê como andam os teus rivais de carne e osso. 🕵️
            </p>
          </FanzineCard>
        )}

        {scorers.length > 0 && (
          <FanzineCard
            sticker="Bota de Ouro"
            stickerClass="bg-tertiary text-zinc-950"
            meta="Top 5"
            tilt={crafty ? tiltNeg : ""}
            shadowCls={cardShadow}
            stickerRot={stickerRot}
            craft={crafty}
          >
            <ol>
              {scorers.map((s, i) => (
                <li
                  key={s.id}
                  className={`flex items-center gap-2.5 px-2.5 short:px-2 py-2 short:py-1.5 m-1.5 rounded-sm border ${
                    i === 0
                      ? crafty
                        ? "border-tertiary/50 bg-tertiary/10 -rotate-[0.5deg]"
                        : "border-tertiary/50 bg-tertiary/10"
                      : "border-dashed border-outline-variant/40 bg-surface-container-low"
                  }`}
                >
                  <span
                    className={`shrink-0 w-6 h-6 flex items-center justify-center text-[10px] font-black rounded-sm ${
                      crafty ? "rotate-[-4deg] " : ""
                    }${
                      i === 0
                        ? "bg-tertiary text-zinc-950"
                        : "bg-surface-bright text-on-surface"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      aria-label={`Ver histórico de ${s.name}`}
                      onClick={() =>
                        s.id != null && onOpenPlayerHistory?.({ id: s.id })
                      }
                      className="block max-w-full truncate text-xs font-black text-on-surface hover:text-primary transition-colors text-left"
                    >
                      {i === 0 ? "👑 " : ""}{s.name}
                    </button>
                    <p className="text-[10px] text-on-surface-variant truncate">
                      {s.team_name || ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-sm bg-surface-container-high border border-on-surface/15 px-1.5 py-0.5 text-xs font-black text-on-surface tabular-nums ${
                      crafty ? "rotate-[2deg]" : ""
                    }`}
                  >
                    {s.goals} {s.goals === 1 ? "golo" : "golos"}
                  </span>
                </li>
              ))}
            </ol>
          </FanzineCard>
        )}

        {topTransfers.length > 0 && (
          <FanzineCard
            sticker="Mercado negro… quer dizer, mercado"
            stickerClass="bg-emerald-400 text-zinc-950"
            meta="Top 5"
            tilt={crafty ? tiltPos : ""}
            shadowCls={cardShadow}
            stickerRot={stickerRot}
            craft={crafty}
          >
            <div>
              {topTransfers.map((n) => (
                <div
                  key={`t-${n.id}`}
                  className="flex items-center gap-2.5 px-2.5 short:px-2 py-2 short:py-1.5 m-1.5 rounded-sm border border-dashed border-outline-variant/40 bg-surface-container-low"
                >
                  <span aria-hidden className="shrink-0 text-base">🏷️</span>
                  <div className="flex-1 min-w-0">
                    {n.player_id && n.player_name ? (
                      <button
                        type="button"
                        aria-label={`Ver histórico de ${n.player_name}`}
                        onClick={() =>
                          onOpenPlayerHistory?.({
                            id: n.player_id,
                          })
                        }
                        className="block max-w-full truncate text-xs font-black text-on-surface hover:text-primary transition-colors text-left"
                      >
                        {n.player_name}
                      </button>
                    ) : (
                      <p className="truncate text-xs font-black text-on-surface">
                        {n.title}
                      </p>
                    )}
                    <p className="text-[10px] text-on-surface-variant truncate">
                      {transferRoute(n)}
                      {n.description ? ` · ${n.description}` : ""}
                    </p>
                  </div>
                  {n.amount != null && (
                    <span
                      className={`shrink-0 rounded-sm bg-emerald-400 px-1.5 py-0.5 text-[11px] font-black text-zinc-950 tabular-nums shadow-md shadow-black/50 ${
                        crafty ? "rotate-[2deg]" : ""
                      }`}
                    >
                      {formatCurrency(n.amount)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </FanzineCard>
        )}

        {cupUpsets.length > 0 && (
          <FanzineCard
            sticker="Tomba-gigantes"
            stickerClass="bg-amber-400 text-zinc-950"
            meta="Taça"
            tilt={crafty ? tiltNeg : ""}
            shadowCls={cardShadow}
            stickerRot={stickerRot}
            craft={crafty}
          >
            <div>
              {cupUpsets.map((u) => (
                <div
                  key={`u-${u.id}`}
                  className="flex items-center gap-2.5 px-2.5 short:px-2 py-2 short:py-1.5 m-1.5 rounded-sm border border-dashed border-outline-variant/40 bg-surface-container-low"
                >
                  <span aria-hidden className="shrink-0 text-base">⚡</span>
                  <div className="flex-1 min-w-0">
                    {u.winner && u.loser ? (
                      <p className="truncate text-xs font-black text-on-surface">
                        {u.winner}
                        <span className="font-bold text-on-surface-variant"> elimina </span>
                        {u.loser}
                      </p>
                    ) : (
                      <p className="truncate text-xs font-black text-on-surface">
                        {u.title}
                      </p>
                    )}
                    <p className="text-[10px] text-on-surface-variant truncate">
                      {[u.round, u.detail, u.score].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </FanzineCard>
        )}

        {mood && (
          <FanzineCard
            sticker="Bancadas"
            stickerClass="bg-error text-zinc-950"
            meta="Termómetro"
            tilt={crafty ? tiltNeg : ""}
            shadowCls={cardShadow}
            stickerRot={stickerRot}
            craft={crafty}
          >
            <div className="px-2.5 short:px-2 py-2.5 short:py-1.5">
              <div className="flex items-center gap-2.5">
                <Burst emoji={mood.emoji} className={mood.textClass} size={52} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-black text-on-surface truncate">
                      {getFansMoodLabel(fansMood)}
                    </p>
                    {myTeam?.ticket_price != null && (
                      <p className="shrink-0 text-[10px] text-on-surface-variant">
                        🎟️ {formatCurrency(myTeam.ticket_price)}
                      </p>
                    )}
                  </div>
                  <div
                    className="mt-1.5 h-2.5 rounded-full bg-surface-container-high border border-on-surface/15 overflow-hidden"
                    role="progressbar"
                    aria-valuenow={Math.max(0, Math.min(100, Number(fansMood) || 0))}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Estado de espírito dos adeptos"
                  >
                    <div
                      className={`h-full rounded-full transition-all ${mood.barClass}`}
                      style={{
                        width: `${Math.max(0, Math.min(100, Number(fansMood) || 0))}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] italic text-on-surface-variant/80">
                    {mood.quote}
                  </p>
                </div>
              </div>
              {bestHouse && (
                <p className="mt-1.5 rounded-sm border border-dashed border-outline-variant/40 bg-surface-container-low px-2 py-1 text-[10px] text-on-surface-variant truncate">
                  🏟️ Melhor casa da série: {bestHouse.homeName}{" "}
                  {Number(bestHouse.attendance).toLocaleString("pt-PT")}
                </p>
              )}
            </div>
          </FanzineCard>
        )}
      </div>

      {/* ── RODAPÉ ────────────────────────────────────────────────────── */}
      <p className="text-center text-[10px] italic text-on-surface-variant/60 px-4">
        {tier === 2
          ? "Uma publicação da bancada · Direção de arte: o café · Proibido insultar o árbitro 🗞️"
          : "Impresso na bancada com tinta e suor · Proibido insultar o árbitro · Devolver ao quiosque depois de ler 🗞️"}
      </p>
    </PaperSheet>
  );
}
