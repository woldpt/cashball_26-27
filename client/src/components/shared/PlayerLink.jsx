import { socket } from "../../socket.js";

export function PlayerLink({ playerId, children }) {
  // Negative IDs belong to ephemeral junior GRs — they have no history to display.
  if (!playerId || playerId < 0) return <>{children}</>;
  return (
    <button
      type="button"
      className="underline decoration-dotted decoration-current/30 underline-offset-2 hover:decoration-solid hover:decoration-primary/60 hover:text-primary transition-colors cursor-pointer"
      onClick={() => socket.emit("requestPlayerHistory", { playerId })}
    >
      {children}
    </button>
  );
}
