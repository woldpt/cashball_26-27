/**
 * Regression test — "O botão voltar dos jogadores do nosso plantel tem a
 * acção de voltar para a última página de outra equipa visualizada."
 *
 * Root cause (confirmed): `handleOpenTeamSquad` empurra entries
 * `{ teamSquad, teamId }` para o histórico do browser. Se o utilizador sair
 * do plantel de OUTRA equipa pelos separadores da sidebar/nav móvel
 * (`setActiveTab` directo, sem fechar o plantel), o entry `{ teamSquad }`
 * fica obsoleto EM CIMA da pilha, com `selectedTeam` ainda preenchido. A
 * partir daí, qualquer voltar — o botão "← Voltar" do modal de historial de
 * jogador (faz `history.back()`) ou o back do browser — faz pop desse entry
 * obsoleto e o `onPopState` do GameContext restaurou a última equipa
 * visualizada, atirando o utilizador para o plantel de OUTRA equipa quando
 * estava no plantel do próprio clube.
 *
 * Este test codifica o contrato de navegação:
 *   1. popstate num entry `{ teamSquad }` com o utilizador FORA do fluxo de
 *      plantel (separador normal) → NUNCA restaura a equipa (era o bug).
 *   2. popstate num entry `{ teamSquad }` DENTRO do fluxo de plantel
 *      (cadeia A → B → C) → restaura a equipa anterior.
 *   3. popstate num entry normal com plantel activo → sai do plantel.
 *   4. Trocar de separador a partir da UI dentro do plantel → fecha o
 *      plantel e anula o entry `{ teamSquad }` no topo do histórico.
 *   5. Abrir uma equipa a partir de outro separador quando há um entry
 *      `{ teamSquad }` obsoleto no topo → substitui-o em vez de empilhar.
 *
 * Run: cd client && npm run test:squadnav
 */
import {
  computePopStateAction,
  computeNavigateTabAction,
  computeOpenSquadHistoryAction,
} from "../src/utils/squadNavigation.js";

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`ok  - ${msg}`);
}

// ── 1. O BUG REPORTADO ────────────────────────────────────────────────────
// O utilizador viu a equipa A (entry {teamSquad, A} obsoleto no topo),
// navegou via sidebar para o "Plantel" do próprio clube e o "Voltar"
// acontece aí — o pop desse entry obsoleto NÃO pode repor a equipa A.
{
  const action = computePopStateAction({
    state: { teamSquad: true, teamId: 11 },
    activeTab: "players",
    selectedTeam: { id: 11 },
  });
  assert(
    action.type === "ignore",
    "popstate teamSquad com separador normal → ignora (não repõe equipa antiga)",
  );
}

// Mesma situação quando o voltar vem do modal de historial de jogador
// (PlayerHistoryModal → history.back() → entry obsoleto por baixo).
{
  const action = computePopStateAction({
    state: { teamSquad: true, teamId: 11 },
    activeTab: "players",
    selectedTeam: null,
  });
  assert(
    action.type === "ignore",
    "popstate teamSquad fora do plantel (modal fechado) → ignora",
  );
}

// ── 2. Cadeia A → B → C (volume legítimo de drill-down) ───────────────────
{
  const action = computePopStateAction({
    state: { teamSquad: true, teamId: 11 },
    activeTab: "squad",
    selectedTeam: { id: 22 },
  });
  assert(
    action.type === "restore" && action.teamId === 11,
    "popstate teamSquad dentro do plantel → restaura a equipa anterior",
  );
}

// ── 3. Saída completa do plantel ──────────────────────────────────────────
{
  const action = computePopStateAction({
    state: {},
    activeTab: "squad",
    selectedTeam: { id: 11 },
  });
  assert(
    action.type === "exit",
    "popstate normal dentro do plantel → sai do plantel",
  );
}

{
  const action = computePopStateAction({
    state: {},
    activeTab: "players",
    selectedTeam: null,
  });
  assert(
    action.type === "ignore",
    "popstate normal fora do plantel → ignora",
  );
}

// ── 4. Troca de separador (sidebar/nav móvel) dentro do plantel ────────────
{
  const action = computeNavigateTabAction({
    activeTab: "squad",
    historyState: { teamSquad: true, teamId: 11 },
  });
  assert(
    action.closeSquad === true && action.neutralizeHistory === true,
    "trocar de separador dentro do plantel → fecha plantel e anula entry teamSquad",
  );
}

{
  const action = computeNavigateTabAction({
    activeTab: "players",
    historyState: {},
  });
  assert(
    action.closeSquad === false && action.neutralizeHistory === false,
    "troca de separador fora do plantel → nada a fechar",
  );
}

// ── 5. Abertura de equipa: substituir entry obsoleto ───────────────────────
{
  const action = computeOpenSquadHistoryAction({
    activeTab: "standings",
    historyState: { teamSquad: true, teamId: 11 },
    teamId: 33,
  });
  assert(
    action.useReplace === true && action.state.teamId === 33,
    "abrir equipa de outro separador com entry obsoleto no topo → substitui",
  );
}

{
  const action = computeOpenSquadHistoryAction({
    activeTab: "squad",
    historyState: { teamSquad: true, teamId: 11 },
    teamId: 22,
  });
  assert(
    action.useReplace === false,
    "abrir equipa a partir do plantel (cadeia) → empurra",
  );
}

{
  const action = computeOpenSquadHistoryAction({
    activeTab: "standings",
    historyState: {},
    teamId: 33,
  });
  assert(
    action.useReplace === false,
    "abrir equipa de outro separador com histórico limpo → empurra",
  );
}

console.log("\n✅ Todos os contratos de navegação do plantel verificados.");
