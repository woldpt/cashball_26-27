import { useCallback, useState } from "react";
import { MAX_MATCH_SUBS } from "../../../constants/index.js";

/**
 * Regras de estado dos cartões de substituição — fonte única usada pelas
 * três vistas (desktop, landscape e stack vertical mobile).
 *
 * Antes viviam copiadas em três sítios (`TitularesColumn`, `SuplentesColumn`
 * e os mapas inline do landscape); qualquer mudança de regra tinha de ser
 * feita nos três. Agora cada vista chama `getPitchCardState` /
 * `getBenchCardState` com o mesmo `cardCtx` construído no `SubsPanel`.
 *
 * @typedef {object} SwapCardCtx
 * @property {boolean} isHalftime - Estamos no intervalo?
 * @property {boolean} isForcedSwap - Substituição obrigatória a decorrer?
 * @property {boolean} isGkRedCard - Obrigatória por vermelho ao GR?
 * @property {boolean} isEmergencyGk - Escolha única de GR improvisado?
 * @property {object|null} forceOutPlayer - Jogador que tem de sair (se houver).
 * @property {number} subsMade - Substituições já feitas/planeadas.
 * @property {number[]} subbedOut - Ids de quem já saiu.
 * @property {boolean} grAvailableOnBench - Há GR disponível no banco?
 * @property {number|string|null} effectiveOutId - Id de quem sai (seleção + forçado).
 * @property {number|string|null} selectedInId - Id de quem entra.
 * @property {Map|null} playerMatchStats - Golos/amarelos por jogador.
 *
 * @typedef {object} PitchCardState
 * @property {boolean} disabled - Cartão não selecionável.
 * @property {boolean} selected - Cartão selecionado (quem sai / vai à baliza).
 * @property {boolean} forcedOut - Saída obrigatória (destaque vermelho).
 * @property {object|undefined} stats - Golos e amarelos no jogo.
 */

/**
 * Estado de um cartão de titular. Regra única para desktop, landscape e mobile.
 *
 * @param {object} p - Jogador em campo.
 * @param {SwapCardCtx} ctx - Contexto partilhado do painel.
 * @returns {PitchCardState} Estado do cartão.
 */
export function getPitchCardState(p, ctx) {
  const {
    isHalftime,
    isForcedSwap,
    isGkRedCard,
    isEmergencyGk,
    forceOutPlayer,
    subsMade,
    grAvailableOnBench,
    effectiveOutId,
    selectedInId,
    playerMatchStats,
  } = ctx;
  const noGrReplacement =
    isHalftime && p.position === "GR" && !grAvailableOnBench;
  const isLockedForced =
    isForcedSwap &&
    !isGkRedCard &&
    !isEmergencyGk &&
    !!forceOutPlayer &&
    p.id !== forceOutPlayer.id;
  return {
    disabled:
      noGrReplacement ||
      isLockedForced ||
      (isHalftime && subsMade >= MAX_MATCH_SUBS),
    selected: isEmergencyGk
      ? selectedInId === p.id
      : effectiveOutId === p.id,
    forcedOut:
      isForcedSwap &&
      !isEmergencyGk &&
      !!forceOutPlayer &&
      p.id === forceOutPlayer.id,
    stats: playerMatchStats?.get(p.id),
  };
}

/**
 * Estado de um cartão de suplente. Regra única para desktop, landscape e mobile.
 *
 * @param {object} p - Jogador do banco.
 * @param {SwapCardCtx} ctx - Contexto partilhado do painel.
 * @returns {{disabled: boolean, selected: boolean, stats: object|undefined}} Estado do cartão.
 */
export function getBenchCardState(p, ctx) {
  const {
    isHalftime,
    isEmergencyGk,
    forceOutPlayer,
    subsMade,
    subbedOut,
    selectedInId,
    playerMatchStats,
  } = ctx;
  const alreadyUsed = isHalftime && subbedOut.includes(p.id);
  const positionMismatch =
    !!forceOutPlayer &&
    (forceOutPlayer.position === "GR") !== (p.position === "GR");
  return {
    disabled:
      isEmergencyGk ||
      alreadyUsed ||
      positionMismatch ||
      (isHalftime && subsMade >= MAX_MATCH_SUBS),
    selected: selectedInId === p.id,
    stats: playerMatchStats?.get(p.id),
  };
}

/**
 * Arrastar-largar entre colunas (HTML5 DnD, sem biblioteca). Só faz sentido
 * com rato — em toque continua tudo por seleção. As largadas só resolvem
 * entre colunas (campo ⇄ banco).
 *
 * @param {object} args - Callbacks de seleção.
 * @param {Function} args.handlePickOut - Seleciona quem sai.
 * @param {Function} args.handlePickIn - Seleciona quem entra.
 * @returns {{dragFrom: object|null, dragOverSide: string|null, handleDragStart: Function, handleDragEnd: Function, handleDragOver: Function, handleDropOnPitch: Function, handleDropOnBench: Function}} Estado e handlers de DnD.
 */
export function useSubsDrag({ handlePickOut, handlePickIn }) {
  const [dragFrom, setDragFrom] = useState(null);
  const [dragOverSide, setDragOverSide] = useState(null);

  const handleDragStart = useCallback(
    (p, side) => (e) => {
      setDragFrom({ player: p, side });
      if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    },
    [],
  );
  const handleDragEnd = useCallback(() => {
    setDragFrom(null);
    setDragOverSide(null);
  }, []);
  const handleDragOver = useCallback(
    (side) => (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      setDragOverSide(side);
    },
    [],
  );
  const handleDropOnPitch = useCallback(
    (target) => (e) => {
      e.preventDefault();
      const src = dragFrom;
      setDragFrom(null);
      setDragOverSide(null);
      if (!src || src.side !== "bench") return;
      handlePickOut(target);
      handlePickIn(src.player);
    },
    [dragFrom, handlePickOut, handlePickIn],
  );
  const handleDropOnBench = useCallback(
    (target) => (e) => {
      e.preventDefault();
      const src = dragFrom;
      setDragFrom(null);
      setDragOverSide(null);
      if (!src || src.side !== "pitch") return;
      handlePickOut(src.player);
      handlePickIn(target);
    },
    [dragFrom, handlePickOut, handlePickIn],
  );

  return {
    dragFrom,
    dragOverSide,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDropOnPitch,
    handleDropOnBench,
  };
}
