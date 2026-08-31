import { socket } from "../socket.js";
import { CupBracketPage } from "../components/ui/CupBracketPage.jsx";

export function BracketTab({ bracketData, me, players, onOpenTeamSquad }) {
  return (
    <CupBracketPage
      bracketData={bracketData}
      me={me}
      players={players}
      onRequestRefresh={() => socket.emit("requestCupBracket")}
      onOpenTeamSquad={onOpenTeamSquad}
    />
  );
}
