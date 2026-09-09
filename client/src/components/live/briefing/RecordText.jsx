import { memo } from "react";

/**
 * Registo V/E/D a duas cores (vitórias verdes, derrotas vermelhas).
 * @param {{ v?: number, e?: number, d?: number }} props
 * @returns {JSX.Element}
 */
export const RecordText = memo(function RecordText({ v = 0, e = 0, d = 0 }) {
  return (
    <span
      className="flex items-center gap-1.5 text-[11px] font-black tabular-nums leading-none"
      aria-label={`${v} vitórias, ${e} empates, ${d} derrotas`}
    >
      <span aria-hidden className="text-green-400">{v}</span>
      <span aria-hidden className="text-gray-300">{e}</span>
      <span aria-hidden className="text-red-400">{d}</span>
    </span>
  );
});
