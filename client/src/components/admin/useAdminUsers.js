import { useCallback, useEffect, useState } from "react";
import { socket } from "../../socket.js";
import { useGame } from "../../contexts/GameContext.jsx";
import { adminListUsers } from "./adminApi.js";

/**
 * Estado da lista de utilizadores do painel admin (fonte: GameContext).
 *
 * A subscrição a `adminUsersUpdated` só existe enquanto o painel está aberto
 * e o utilizador é admin — não há polling nem listeners órfãos. O fetch
 * inicial é diferido para pós-commit (regra react-hooks/set-state-in-effect).
 * @param {{open: boolean}} props Aberto/fechado do painel (controla subscrição).
 */
export function useAdminUsers({ open }) {
  const { setAdminUsers } = useGame();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchUsers = useCallback(() => {
    setLoading(true);
    setError("");
    adminListUsers().then((result) => {
      setLoading(false);
      if (result?.ok) {
        setAdminUsers(result.users || []);
      } else {
        setError(result?.error || "Erro ao carregar utilizadores.");
      }
    });
  }, [setAdminUsers]);

  useEffect(() => {
    if (!open) return undefined;
    const handleUpdate = () => fetchUsers();
    socket.on("adminUsersUpdated", handleUpdate);
    // Fetch inicial diferido: evita setState síncrono no corpo do effect.
    const timer = setTimeout(handleUpdate, 0);
    return () => {
      clearTimeout(timer);
      socket.off("adminUsersUpdated", handleUpdate);
    };
  }, [open, fetchUsers]);

  return { loading, error, fetchUsers };
}
