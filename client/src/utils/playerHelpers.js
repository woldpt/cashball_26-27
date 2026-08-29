import { AGG_TIERS, MAX_BENCH_SIZE } from "../constants/index.js";

export function getPlayerStat(player, keys, fallback = 0) {
  for (const key of keys) {
    const value = player?.[key];
    if (value !== undefined && value !== null) return value;
  }
  return fallback;
}

export function isPlayerAvailable(player, currentMatchweek = 1) {
  const suspensionUntil = player?.suspension_until_matchweek || 0;
  const injuryUntil = player?.injury_until_matchweek || 0;
  const cooldownUntil = player?.transfer_cooldown_until_matchweek || 0;
  return currentMatchweek > Math.max(suspensionUntil, injuryUntil, cooldownUntil);
}

export function getFormationRequirements(formation = "4-4-2") {
  const formationParts = String(formation || "4-4-2").split("-");
  return {
    GR: 1,
    DEF: parseInt(formationParts[0], 10) || 0,
    MED: parseInt(formationParts[1], 10) || 0,
    ATA: parseInt(formationParts[2], 10) || 0,
  };
}

export function isFormationAvailable(formation, availableCounts) {
  const requiredByPosition = getFormationRequirements(formation);
  return (
    availableCounts.GR >= requiredByPosition.GR &&
    availableCounts.DEF >= requiredByPosition.DEF &&
    availableCounts.MED >= requiredByPosition.MED &&
    availableCounts.ATA >= requiredByPosition.ATA
  );
}

export function buildAutoPositions(
  squad = [],
  formation = "4-4-2",
  currentMatchweek = 1,
) {
  const availablePlayers = squad.filter((player) =>
    isPlayerAvailable(player, currentMatchweek),
  );
  if (!availablePlayers.length) return {};

  const sortedPlayers = [...availablePlayers].sort(
    (a, b) => b.skill - a.skill,
  );

  const requiredByPosition = getFormationRequirements(formation);
  const usedByPosition = { GR: 0, DEF: 0, MED: 0, ATA: 0 };
  const lineup = [];

  // Passe 1: preencher cada slot com jogadores da posição nativa (melhor primeiro)
  for (const player of sortedPlayers) {
    const playerPosition = player.position;
    if (usedByPosition[playerPosition] < requiredByPosition[playerPosition]) {
      lineup.push(player);
      usedByPosition[playerPosition] += 1;
    }
  }

  // Passe 2: se alguma posição obrigatória ficou sem jogadores (ex: todos os GRs
  // suspensos/lesionados), preencher com os melhores restantes de qualquer posição
  for (const pos of ["GR", "DEF", "MED", "ATA"]) {
    while (usedByPosition[pos] < requiredByPosition[pos]) {
      const best = sortedPlayers.find((p) => !lineup.includes(p));
      if (!best) break;
      lineup.push(best);
      usedByPosition[pos] += 1;
    }
  }

  // Passe 3: completar até 11 jogadores com os restantes disponíveis
  if (lineup.length < 11) {
    for (const player of sortedPlayers) {
      if (lineup.includes(player)) continue;
      lineup.push(player);
      if (lineup.length === 11) break;
    }
  }

  const positions = Object.fromEntries(
    lineup.slice(0, 11).map((player) => [player.id, "Titular"]),
  );

  // Pick suplentes: garantir 1 suplente por posição (GR, DEF, MED, ATA) se disponível,
  // depois preencher os restantes slots (máx MAX_BENCH_SIZE) com os melhores restantes.
  // GRs extra podem entrar no banco até ao teto — o coach pode levar 2+ GRs.
  const remaining = sortedPlayers.filter((p) => !lineup.includes(p));
  const subs = [];
  const usedInSubs = new Set();
  for (const pos of ["GR", "DEF", "MED", "ATA"]) {
    if (subs.length >= MAX_BENCH_SIZE) break;
    const candidate = remaining.find(
      (p) => p.position === pos && !usedInSubs.has(p.id),
    );
    if (candidate) {
      subs.push(candidate);
      usedInSubs.add(candidate.id);
    }
  }
  // preencher slots restantes com os melhores ainda não escolhidos
  for (const p of remaining) {
    if (subs.length >= MAX_BENCH_SIZE) break;
    if (!usedInSubs.has(p.id)) {
      subs.push(p);
      usedInSubs.add(p.id);
    }
  }
  subs.forEach((p) => {
    positions[p.id] = "Suplente";
  });

  return positions;
}

export function getMatchLastEventText(
  events = [],
  liveMinute = 90,
  side = null,
) {
  const filtered = side ? events.filter((e) => e.team === side) : events;
  let latest = null;
  filtered.forEach((event, index) => {
    if ((event.minute ?? -1) > liveMinute) return;
    if (
      !latest ||
      (event.minute ?? -1) > (latest.minute ?? -1) ||
      ((event.minute ?? -1) === (latest.minute ?? -1) && index > latest.index)
    ) {
      latest = { ...event, index };
    }
  });

  if (!latest) return "";

  const minuteText = latest.minute != null ? `[${latest.minute}']` : "";
  const playerName = latest.playerName || latest.player_name;
  const emoji = latest.emoji || "";

  if (playerName) {
    return `${minuteText} ${emoji} ${playerName}`.trim();
  }

  if (latest.type === "goal") {
    const nameMatch = latest.text?.match(/GOLO!\s*(.*)$/i);
    return `${minuteText} ⚽ ${nameMatch?.[1] || "Jogador"}`;
  }

  if (latest.type === "red") {
    const name =
      latest.playerName ||
      latest.text?.match(/Vermelho!\s*(.*)$/i)?.[1] ||
      "Jogador";
    return `${minuteText} 🟥 Vermelho! ${name}`;
  }

  return minuteText ? `${minuteText} ${latest.text || ""}` : latest.text || "";
}

export function getAvailablePositionCounts(squad = [], currentMatchweek = 1) {
  const counts = { GR: 0, DEF: 0, MED: 0, ATA: 0 };
  for (const player of squad) {
    if (!isPlayerAvailable(player, currentMatchweek)) continue;
    if (counts[player.position] !== undefined) counts[player.position] += 1;
  }
  return counts;
}

export function aggLabel(value) {
  if (typeof value === "number") {
    const tiers = [
      "Cordeirinho",
      "Cavalheiro",
      "Fair Play",
      "Caneleiro",
      "Caceteiro",
    ];
    const idx = Math.max(0, Math.min(4, Math.round(value) - 1));
    return tiers[idx];
  }
  return AGG_TIERS[value] ? value : "Fair Play";
}
