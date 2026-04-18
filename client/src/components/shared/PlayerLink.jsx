import { socket } from "../../socket.js";

export function PlayerLink({ playerId, children }) {
  // Negative IDs belong to ephemeral junior GRs — they have no history to display.
  if (!playerId || playerId < 0) return <>{children}</>;
  return (
    <button
      type="button"
      className="hover:underline underline-offset-2 cursor-pointer"
      onClick={() => socket.emit("requestPlayerHistory", { playerId })}
    >
      {children}
    </button>
  );
}
