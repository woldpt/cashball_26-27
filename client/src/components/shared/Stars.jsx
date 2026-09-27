/**
 * Stars — só as estrelas reais da classificação 0–10, com meias (★★★★★★★ + meia).
 * Sem enchimento apagado nem valor numérico ao lado; o valor exato
 * (com meias, vírgula pt-PT) vive no `title`/`aria-label`.
 * `0`/ausente mostra "—". `hideValue` mantido por compatibilidade.
 * Notícias antigas do Jornal (escala 1–5) são snapshot histórico: mostram
 * menos glifos, sem conversão.
 * @param {{ value: number, max?: number, hideValue?: boolean, className?: string }} props
 */
export function Stars({ value, max = 10, hideValue = false, className = "" }) {
  void hideValue;
  const num = Number(value);
  const v = Number.isFinite(num)
    ? Math.max(0, Math.min(max, Math.round(num * 2) / 2))
    : 0;
  const label = String(v).replace(".", ",");
  if (!(v > 0)) {
    return (
      <span
        className={`tracking-tight opacity-60 ${className}`}
        title={`${label} de ${max} estrelas`}
        aria-label={`Classificação: ${label} de ${max} estrelas`}
      >
        —
      </span>
    );
  }
  const full = Math.floor(v);
  const half = v - full >= 0.5;
  return (
    <span
      className={`tracking-tight ${className}`}
      title={`${label} de ${max} estrelas`}
      aria-label={`Classificação: ${label} de ${max} estrelas`}
    >
      {"★".repeat(full)}
      {half ? (
        <span className="relative inline-block" aria-hidden="true">
          <span className="opacity-40">★</span>
          <span className="absolute inset-0 overflow-hidden w-1/2">★</span>
        </span>
      ) : ""}
    </span>
  );
}
