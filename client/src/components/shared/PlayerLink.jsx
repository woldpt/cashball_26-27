import { socket } from "../../socket.js";

export function PlayerLink({ playerId, children }) {
  if (!playerId) return <>{children}</>;
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
