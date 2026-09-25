/**
 * Stars — classificação 0–10 com meias (★★★★★★★☆☆☆ 7,5).
 * Preenchidas a âmbar, vazias esmaecidas na cor do texto envolvente.
 * Os glifos arredondam ao inteiro; o valor exato (com meias, vírgula
 * pt-PT) segue ao lado, salvo `hideValue` (marcadores apertados do pitch).
 * Notícias antigas do Jornal (escala 1–5) são snapshot histórico: mostram
 * menos glifos, sem conversão.
 * @param {{ value: number, max?: number, hideValue?: boolean, className?: string }} props
 */
export function Stars({ value, max = 10, hideValue = false, className = "" }) {
  const num = Number(value);
  const v = Number.isFinite(num)
    ? Math.max(0, Math.min(max, Math.round(num * 2) / 2))
    : 0;
  const full = Math.round(v);
  const label = String(v).replace(".", ",");
  return (
    <span
      className={`tracking-tight ${className}`}
      title={`${label} de ${max} estrelas`}
      aria-label={`Classificação: ${label} de ${max} estrelas`}
    >
      {"★".repeat(full)}
      <span className="opacity-25">{"★".repeat(max - full)}</span>
      {!hideValue && (
        <span className="ml-1 tabular-nums opacity-80">{label}</span>
      )}
    </span>
  );
}
