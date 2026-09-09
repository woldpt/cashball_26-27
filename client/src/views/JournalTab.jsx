/**
 * JournalTab — Jornal Global.
 *
 * Landing tab (pós-login e pós-jogo). Duas secções:
 *  - "Resultados da época": Liga agrupada por jornada + Taça por ronda,
 *    com o "Jogador do Jogo" (MOM) de cada equipa em cada partida.
 *  - "Jornal": linha do tempo da época — notícias de todos os clubes
 *    (club_news) + transferências (transfer_history), agrupadas por jornada
 *    (mais recente primeiro).
 *
 * Dados: `globalNews` ({news, results}) do GameContext (socket
 * `getGlobalNews`, atualizado via `globalNewsUpdated`). `teams` do
 * GameContext para os crests (cores/crest do TeamCrest).
 */
import { useMemo, useState } from "react";
import { Panel } from "../components/shared/Panel.jsx";
import { EmptyState } from "../components/shared/EmptyState.jsx";
import { TeamCrest } from "../components/live/TeamCrest.jsx";
import { formatCurrency } from "../utils/formatters.js";

const CUP_ROUND_LABELS = {
  1: "16 avos de final",
  2: "Oitavos de final",
  3: "Quartos de final",
  4: "Meias-finais",
  5: "Final",
};

const TRANSFER_SOURCE_LABELS = {
  market: "Mercado",
  auction: "Leilão",
  clause: "Cláusula",
  npc: "Transf.",
};

const NEWS_TYPE_STYLE = {
  transfer: { icon: "swap_horiz", tone: "text-primary bg-primary/12" },
  wages: { icon: "payments", tone: "text-on-surface-variant bg-surface-container-high" },
  weekly_income: { icon: "payments", tone: "text-emerald-400 bg-emerald-500/12" },
  ticket_revenue: { icon: "stadium", tone: "text-emerald-400 bg-emerald-500/12" },
  prize: { icon: "emoji_events", tone: "text-amber-400 bg-amber-500/12" },
  renegotiation: { icon: "handshake", tone: "text-on-surface-variant bg-surface-container-high" },
  cost_cut: { icon: "trending_down", tone: "text-error bg-error/12" },
  loan_take: { icon: "account_balance", tone: "text-amber-400 bg-amber-500/12" },
  loan_pay: { icon: "account_balance", tone: "text-amber-400 bg-amber-500/12" },
  loan_principal: { icon: "account_balance", tone: "text-amber-400 bg-amber-500/12" },
  loan_interest: { icon: "account_balance", tone: "text-amber-400 bg-amber-500/12" },
};

function NewsRow({ item, onOpenPlayerHistory }) {
  const style = NEWS_TYPE_STYLE[item.source === "transfer" ? "transfer" : item.type] ||
    NEWS_TYPE_STYLE.wages;
  const subtitleParts = [];
  if (item.team_name) subtitleParts.push(item.team_name);
  if (item.matchweek) subtitleParts.push(`Jornada ${item.matchweek}`);
  if (item.amount) subtitleParts.push(formatCurrency(item.amount));
  const player =
    item.player_id && item.player_name
      ? { id: item.player_id, name: item.player_name }
      : null;

  return (
    <div className="px-4 short:px-3 py-2.5 short:py-1.5 flex items-center gap-3 short:gap-2 hover:bg-white/[0.03] transition-colors">
      <div
        className={`w-8 h-8 short:w-6 short:h-6 rounded flex items-center justify-center shrink-0 ${style.tone}`}
      >
        <span className="material-symbols-outlined text-sm">{style.icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black text-on-surface truncate">
          {player ? (
            <button
              type="button"
              onClick={() => onOpenPlayerHistory?.(player)}
              className="truncate hover:text-primary transition-colors"
            >
              {item.title}
            </button>
          ) : (
            item.title
          )}
        </p>
        <p className="text-[10px] text-on-surface-variant truncate">
          {subtitleParts.join(" · ")}
          {item.source === "transfer" && item.type
            ? ` · ${TRANSFER_SOURCE_LABELS[item.type] || item.type}`
            : ""}
        </p>
      </div>
    </div>
  );
}

function ResultRow({ r, teamById, myTeamId }) {
  const home = teamById.get(r.homeTeamId);
  const away = teamById.get(r.awayTeamId);
  return (
    <div className="px-3 sm:px-4 short:px-2 py-2.5 short:py-1.5 flex items-center gap-2.5 short:gap-2">
      <TeamCrest
        team={home || { name: r.homeName }}
        isMine={r.homeTeamId === myTeamId}
        size="sm"
        rotate={8}
      />
      <div className="flex-1 min-w-0 text-right">
        <p className="text-xs font-black text-on-surface truncate">
          {r.homeName}
        </p>
        {r.momHome && (
          <p className="text-[10px] text-amber-400/90 truncate">
            ⭐ {r.momHome.playerName}
          </p>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-1.5 px-2 py-1 rounded bg-surface-container-high border border-outline-variant/20">
        <span className="text-sm font-black text-on-surface">{r.homeScore}</span>
        <span className="text-[10px] text-on-surface-variant">–</span>
        <span className="text-sm font-black text-on-surface">{r.awayScore}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black text-on-surface truncate">
          {r.awayName}
        </p>
        {r.momAway && (
          <p className="text-[10px] text-amber-400/90 truncate">
            ⭐ {r.momAway.playerName}
          </p>
        )}
      </div>
      <TeamCrest
        team={away || { name: r.awayName }}
        isMine={r.awayTeamId === myTeamId}
        size="sm"
        rotate={-8}
      />
    </div>
  );
}

/**
 * Segmented control Relevante/Tudo do Jornal.
 *
 * @param {{filter: string, onChange: (f: string) => void}} props
 */
function FilterChips({ filter, onChange }) {
  const base =
    "px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-full transition-colors";
  return (
    <div
      className="flex items-center gap-1 self-start rounded-full bg-surface-container-high/60 border border-outline-variant/20 p-0.5"
      role="group"
      aria-label="Filtro do jornal"
    >
      <button
        type="button"
        onClick={() => onChange("relevant")}
        aria-pressed={filter === "relevant"}
        className={`${base} ${filter === "relevant" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface"}`}
      >
        Relevante
      </button>
      <button
        type="button"
        onClick={() => onChange("all")}
        aria-pressed={filter === "all"}
        className={`${base} ${filter === "all" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface"}`}
      >
        Tudo
      </button>
    </div>
  );
}

/**
 * @param {{
 *   globalNews: {news: Array, results: Array},
 *   teams: Array,
 *   me: object,
 *   seasonYear: number,
 *   onOpenPlayerHistory?: (player: {id:number}) => void,
 * }} props
 */
export function JournalTab({
  globalNews = { news: [], results: [] },
  teams = [],
  me,
  seasonYear,
  onOpenPlayerHistory,
}) {
  const news = useMemo(
    () => (Array.isArray(globalNews?.news) ? globalNews.news : []),
    [globalNews],
  );
  const results = useMemo(
    () => (Array.isArray(globalNews?.results) ? globalNews.results : []),
    [globalNews],
  );

  const teamById = useMemo(() => {
    const map = new Map();
    for (const t of teams || []) map.set(t.id, t);
    return map;
  }, [teams]);

  // Filtro de relevância: por defeito mostra só o que interessa ao treinador
  // (notícias do próprio clube + transferências de todos + resultados da
  // própria divisão e Taça completa); "Tudo" repõe o jornal global.
  const [filter, setFilter] = useState("relevant");
  const myTeam =
    me?.teamId != null
      ? (teamById.get(me.teamId) ?? teamById.get(Number(me.teamId)) ?? null)
      : null;
  const myDivision = myTeam?.division ?? null;
  const myTeamName = myTeam?.name ?? null;
  const hasIdentity = myTeamName != null && myDivision != null;

  const visibleNews = useMemo(() => {
    if (filter === "all" || !hasIdentity) return news;
    return news.filter(
      (n) => n.source === "transfer" || n.team_name === myTeamName,
    );
  }, [news, filter, hasIdentity, myTeamName]);

  const visibleResults = useMemo(() => {
    if (filter === "all" || !hasIdentity) return results;
    return results.filter((r) => {
      if (r.competition !== "League") return true;
      return r.homeDivision === myDivision || r.awayDivision === myDivision;
    });
  }, [results, filter, hasIdentity, myDivision]);

  // Resultados da Liga agrupados por jornada (mais recente primeiro)
  const leagueGroups = useMemo(() => {
    const map = new Map();
    for (const r of visibleResults) {
      if (r.competition !== "League") continue;
      const key = r.matchweek;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [visibleResults]);

  // Rondas da Taça (mais recente primeiro)
  const cupGroups = useMemo(() => {
    const map = new Map();
    for (const r of visibleResults) {
      if (r.competition !== "Cup") continue;
      const key = r.round;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [visibleResults]);

  // Notícias agrupadas por jornada (mais recente primeiro)
  const newsGroups = useMemo(() => {
    const map = new Map();
    for (const n of visibleNews) {
      const key = Number(n.matchweek) || 0;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(n);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [visibleNews]);

  const hasContent = newsGroups.length > 0 || leagueGroups.length > 0 || cupGroups.length > 0;
  const hasAnyContent = news.length > 0 || results.length > 0;

  if (!hasContent) {
    return (
      <div className="space-y-4 short:space-y-2">
        <FilterChips filter={filter} onChange={setFilter} />
        <EmptyState
          emoji="📰"
          title="Jornal sem notícias"
          description={
            hasAnyContent
              ? "Nada relevante para o teu clube — muda para «Tudo» para veres os outros clubes."
              : "Ainda não houve resultados nem notícias nesta época."
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 short:space-y-2">
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-1 short:px-0">
        <h1 className="font-headline text-lg sm:text-2xl short:text-base font-black tracking-tight leading-none text-on-surface">
          Jornal
        </h1>
        <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
          Época {seasonYear || ""}
        </span>
      </div>

      {/* ── FILTRO DE RELEVÂNCIA ─────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-1 short:px-0">
        <FilterChips filter={filter} onChange={setFilter} />
        <span className="ml-auto text-[10px] text-on-surface-variant truncate">
          {filter === "relevant"
            ? "Teu clube · transferências · tua divisão"
            : "Todos os clubes e divisões"}
        </span>
      </div>

      {/* ── RESULTADOS DA ÉPOCA ─────────────────────────────────────── */}
      <Panel
        title="Resultados"
        icon="leaderboard"
        meta={`${visibleResults.length} jogo${visibleResults.length !== 1 ? "s" : ""}`}
        padded={false}
      >
        {leagueGroups.length === 0 && cupGroups.length === 0 ? (
          <div className="p-3 sm:p-4 short:p-2">
            <p className="text-xs text-on-surface-variant">
              Ainda não há resultados nesta época.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/10">
            {leagueGroups.map(([matchweek, rows]) => (
              <div key={`lg-${matchweek}`}>
                <div className="px-3 sm:px-4 short:px-2 py-1.5 bg-surface-container-high/40">
                  <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                    Liga · Jornada {matchweek}
                  </span>
                </div>
                {rows.map((r) => (
                  <ResultRow
                    key={`lg-${matchweek}-${r.homeTeamId}-${r.awayTeamId}`}
                    r={r}
                    teamById={teamById}
                    myTeamId={me?.teamId}
                  />
                ))}
              </div>
            ))}
            {cupGroups.map(([round, rows]) => (
              <div key={`cup-${round}`}>
                <div className="px-3 sm:px-4 short:px-2 py-1.5 bg-surface-container-high/40">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                    Taça · {CUP_ROUND_LABELS[round] || `Ronda ${round}`}
                  </span>
                </div>
                {rows.map((r) => (
                  <ResultRow
                    key={`cup-${round}-${r.homeTeamId}-${r.awayTeamId}`}
                    r={r}
                    teamById={teamById}
                    myTeamId={me?.teamId}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* ── JORNAL (LINHA DO TEMPO) ────────────────────────────────── */}
      <Panel
        title="Jornal da época"
        icon="newspaper"
        meta={`${visibleNews.length} notícia${visibleNews.length !== 1 ? "s" : ""}`}
        padded={false}
      >
        {newsGroups.length === 0 ? (
          <div className="p-3 sm:p-4 short:p-2">
            <p className="text-xs text-on-surface-variant">
              Ainda não há notícias nesta época.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/10">
            {newsGroups.map(([matchweek, rows]) => (
              <div key={`nw-${matchweek}`}>
                <div className="px-3 sm:px-4 short:px-2 py-1.5 bg-surface-container-high/40">
                  <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                    {matchweek > 0 ? `Jornada ${matchweek}` : "Pré-época"}
                  </span>
                </div>
                {rows.map((n) => (
                  <NewsRow
                    key={`n-${n.id}`}
                    item={n}
                    onOpenPlayerHistory={onOpenPlayerHistory}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
