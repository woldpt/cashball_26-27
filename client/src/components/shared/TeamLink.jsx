import { useContext } from "react";
import { GameContext } from "../../contexts/GameContext.jsx";
import { isSameTeamId } from "../../utils/teamHelpers.js";

/**
 * Nome de clube clicável que abre a página do clube (o próprio vai ao plantel).
 * Sem id/equipa conhecida (ou fora do GameProvider) devolve só o texto.
 * @param {Object} props
 * @param {number|string|null|undefined} props.teamId
 * @param {import("react").ReactNode} props.children
 * @param {() => void} [props.onNavigate] - ex.: fechar o modal antes de navegar
 * @returns {JSX.Element}
 */
export function TeamLink({ teamId, children, onNavigate }) {
  const ctx = useContext(GameContext);
  const team = teamId != null ? ctx?.teams?.find((t) => isSameTeamId(t.id, teamId)) : null;
  if (!team) return <>{children}</>;
  return (
    <button
      type="button"
      className="hover:underline underline-offset-2 cursor-pointer text-left"
      onClick={(e) => {
        e.stopPropagation();
        onNavigate?.();
        if (isSameTeamId(team.id, ctx.me?.teamId)) ctx.navigateTab("players");
        else ctx.handleOpenTeamSquad(team);
      }}
    >
      {children}
    </button>
  );
}
