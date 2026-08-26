import { useMemo, useState } from "react";
import { isAdminCoach } from "./adminApi.js";

/**
 * Coluna esquerda do painel admin: lista de utilizadores com pesquisa (nome
 * ou código de sala), ordenação por nome/salas e indicador de online.
 *
 * @param {{
 *   users: any[],
 *   loading?: boolean,
 *   selectedName?: string|null,
 *   onSelect?: (user: any) => void,
 * }} props
 */
export function UserList({ users, loading = false, selectedName = null, onSelect }) {
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

  /** @param {string} key Coluna ordenável ("nome" | "rooms"). */
  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => -d);
    } else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  /** @param {string} key Coluna a inspecionar ("nome" | "rooms"). */
  const sortIndicator = (key) => (sortKey === key ? (sortDir > 0 ? " ▲" : " ▼") : "");

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-2 border-b border-outline-variant/15 shrink-0">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pesquisar nome ou sala..."
          aria-label="Pesquisar utilizador"
          className="w-full rounded-md border border-outline-variant/30 bg-surface px-3 py-1.5 text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin mr-2">sync</span>
          <span className="text-xs">A carregar...</span>
        </div>
      ) : visibleUsers.length === 0 ? (
        <p className="text-center text-on-surface-variant/60 text-xs py-10">Nenhum utilizador encontrado.</p>
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
