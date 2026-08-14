/**
 * EmptyState — estado vazio padronizado (STYLE.md §9).
 *
 * Formato canónico: card token-based com emoji + título + descrição.
 * Substitui os estados vazios `text-zinc-500` hardcoded e as variações
 * de card em TransferHub/AuctionsPage.
 */

/**
 * @param {{
 *   emoji?: string,
 *   title: string,
 *   description?: string,
 *   className?: string,
 * }} props
 */
export function EmptyState({ emoji = "📭", title, description, className = "" }) {
  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-lg border border-outline-variant/25 bg-surface-container py-12 ${className}`}
    >
      <span className="text-3xl text-on-surface-variant/40">{emoji}</span>
      <p className="text-on-surface-variant/60 text-xs font-bold text-center">
        {title}
      </p>
      {description && (
        <p className="text-on-surface-variant/40 text-[10px] text-center max-w-[260px]">
          {description}
        </p>
      )}
    </div>
  );
}
