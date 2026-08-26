import { useCallback, useRef, useState } from "react";
import { adminGetRoomCoaches } from "./adminApi.js";

/**
 * Coaches + equipas livres de uma sala — 100% event-driven (sem effects): a
 * secção chama `load(code)` quando o utilizador interage. Um seq guard descarta
 * respostas obsoletas (troca rápida de salas) e mantém apenas a do último
 * pedido emitido.
 *
 * @returns {{ data: object|null, loading: boolean, error: string, load: (code: string) => void }}
 */
export function useRoomRoster() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const seqRef = useRef(0);

  const load = useCallback((code) => {
    seqRef.current += 1;
    const normalized = typeof code === "string" ? code.trim().toUpperCase() : "";
    if (!normalized) {
      setData(null);
      setLoading(false);
      setError("");
      return;
    }
    const seq = seqRef.current;
    setLoading(true);
    setError("");
    adminGetRoomCoaches(normalized).then((result) => {
      if (seq !== seqRef.current) return; // resposta obsoleta — ignorar
      setLoading(false);
      if (result?.ok) {
        setData({ coaches: result.coaches || [], teams: result.teams || [] });
      } else {
        setData(null);
        setError(result?.error || "Erro ao carregar as equipas da sala.");
      }
    });
  }, []);

  return { data, loading, error, load };
}
