import { AGG_TIERS } from "../../constants/index.js";
import { aggLabel } from "../../utils/playerHelpers.js";

export function AggBadge({ value }) {
  const key = aggLabel(value);
  const cfg = AGG_TIERS[key] || AGG_TIERS["Fair Play"];
  return <span className={`text-[10px] font-bold ${cfg.color}`}>{key}</span>;
}
