/**
 * Stars — classificação 1–5 em estrelas (★★★★☆).
 * Preenchidas a âmbar, vazias esmaecidas na cor do texto envolvente.
 * @param {{ value: number, max?: number, className?: string }} props
 */
export function Stars({ value, max = 5, className = "" }) {
  const v = Math.max(0, Math.min(max, Math.round(Number(value) || 0)));
  return (
    <span
      className={`tracking-tight ${className}`}
      title={`${v} de ${max} estrelas`}
      aria-label={`Classificação: ${v} de ${max} estrelas`}
    >
      {"★".repeat(v)}
      <span className="opacity-25">{"★".repeat(max - v)}</span>
    </span>
  );
}
