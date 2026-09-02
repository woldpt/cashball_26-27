import { useMemo, useState } from "react";
import { isAdminCoach } from "./adminApi.js";

/**
 * Lista de utilizadores do painel admin.
 *
 * Dois modos (mesma lógica de pesquisa/ordenação):
 *  - Desktop: tabela com cabeçalhos ordenáveis (Nome / Salas).
 *  - Mobile (`isMobile`): cartões tocáveis — sem `<table>`, nomes com
 *    `truncate` e chips fixos à direita, para nunca forçar largura. A
 *    ordenação passa a chips «Nome»/«Salas» (cabeçalhos de tabela não têm
 *    espaço útil num cartão).
 *
 * @param {{
 *   users: any[],
 *   loading?: boolean,
 *   selectedName?: string|null,
 *   onSelect?: (user: any) => void,
 *   isMobile?: boolean,
 * }} props
 */
export function UserList({ users, loading = false, selectedName = null, onSelect, isMobile = false }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState(1);

  const visibleUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = users.filter(
      (u) =>
        !q ||
        u.name.toLowerCase().includes(q) ||
        (u.rooms || []).some((r) => r.toLowerCase().includes(q))
    );
    return [...filtered].sort((a, b) => {
      if (sortKey === "rooms") {
        return ((a.rooms?.length || 0) - (b.rooms?.length || 0)) * sortDir;
      }
      return a.name.localeCompare(b.name, "pt") * sortDir;
    });
  }, [users, query, sortKey, sortDir]);

  /** @param {"name"|"rooms"} key Coluna ordenável. */
  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => -d);
    } else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  /** @param {"name"|"rooms"} key Coluna a inspecionar. */
  const sortIndicator = (key) => (sortKey === key ? (sortDir > 0 ? " ▲" : " ▼") : "");

  const searchInput = (
    <input
      type="text"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Pesquisar nome ou sala..."
      aria-label="Pesquisar utilizador"
      className="w-full rounded-md border border-outline-variant/30 bg-surface px-3 py-1.5 text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary transition-colors"
    />
  );

  const loadingBlock = (
    <div className="flex items-center justify-center py-10 text-on-surface-variant">
      <span className="material-symbols-outlined animate-spin mr-2">sync</span>
      <span className="text-xs">A carregar...</span>
    </div>
  );

  const emptyBlock = <p className="text-center text-on-surface-variant/60 text-xs py-10">Nenhum utilizador encontrado.</p>;

  // ── Mobile: cartões ────────────────────────────────────────────────────────
  if (isMobile) {
    const sortChip = (key, label) => (
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border transition-colors ${
          sortKey === key
            ? "bg-primary/15 text-primary border-primary/40"
            : "bg-surface-container-high/40 text-on-surface-variant border-outline-variant/30 hover:text-on-surface"
        }`}
      >
        {label}
        {sortIndicator(key)}
      </button>
    );

    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="px-4 pt-3 pb-2 border-b border-outline-variant/15 shrink-0">
          {searchInput}
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-[9px] uppercase tracking-widest text-on-surface-variant/50 font-bold mr-0.5">Ordenar</span>
            {sortChip("name", "Nome")}
            {sortChip("rooms", "Salas")}
          </div>
        </div>

        {loading ? (
          loadingBlock
        ) : visibleUsers.length === 0 ? (
          emptyBlock
        ) : (
          <div className="flex-1 overflow-y-auto">
            {visibleUsers.map((user) => {
              const n = user.rooms?.length || 0;
              return (
                <div
                  key={user.name}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect?.(user)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSelect?.(user);
                  }}
                  className={`flex items-center gap-2.5 px-4 py-3 border-b border-outline-variant/10 cursor-pointer transition-colors min-w-0 overflow-hidden ${
                    selectedName === user.name ? "bg-primary/10" : "hover:bg-surface-container-high/50"
                  }`}
                >
                  <span
                    className={`shrink-0 w-1.5 h-1.5 rounded-full ${
                      user.online ? "bg-emerald-400" : "bg-on-surface-variant/30"
                    }`}
                    title={user.online ? "Online" : "Offline"}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-on-surface" title={user.name}>
                    {user.name}
                  </span>
                  {isAdminCoach(user.name) && (
                    <span className="shrink-0 text-[9px] font-black uppercase px-1.5 py-px rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 tracking-widest">
                      Admin
                    </span>
                  )}
                  <span className="shrink-0 text-[10px] tabular-nums font-bold px-2 py-0.5 rounded bg-surface-container-high/60 border border-outline-variant/20 text-on-surface-variant">
                    {n} {n === 1 ? "sala" : "salas"}
                  </span>
                  <span className="material-symbols-outlined shrink-0 text-[16px] text-on-surface-variant/40 select-none">chevron_right</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Desktop: tabela com cabeçalhos ordenáveis ──────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-2 border-b border-outline-variant/15 shrink-0">{searchInput}</div>

      {loading ? (
        loadingBlock
      ) : visibleUsers.length === 0 ? (
        emptyBlock
      ) : (
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-container z-0">
              <tr className="text-left text-[10px] uppercase tracking-widest text-on-surface-variant border-b border-outline-variant/15">
                <th
                  className="px-3 py-2 font-black cursor-pointer select-none hover:text-on-surface"
                  onClick={() => toggleSort("name")}
                >
                  Nome{sortIndicator("name")}
                </th>
                <th
                  className="px-3 py-2 font-black cursor-pointer select-none hover:text-on-surface"
                  onClick={() => toggleSort("rooms")}
                >
                  Salas{sortIndicator("rooms")}
                </th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((user) => (
                <tr
                  key={user.name}
                  onClick={() => onSelect?.(user)}
                  className={`border-b border-outline-variant/10 cursor-pointer transition-colors ${
                    selectedName === user.name ? "bg-primary/10" : "hover:bg-surface-container-high/50"
                  }`}
                >
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full mr-2 align-middle ${
                        user.online ? "bg-emerald-400" : "bg-on-surface-variant/30"
                      }`}
                      title={user.online ? "Online" : "Offline"}
                    />
                    <span className="text-on-surface font-bold">{user.name}</span>
                    {isAdminCoach(user.name) && (
                      <span className="ml-1.5 text-[9px] font-black uppercase px-1.5 py-px rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 tracking-widest">
                        Admin
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-on-surface-variant tabular-nums">
                    {user.rooms?.length || 0}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="material-symbols-outlined text-[14px] text-on-surface-variant/40 select-none">chevron_right</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
