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
      className={`empty-aurora flex flex-col items-center gap-2.5 rounded-lg border border-outline-variant/25 bg-surface-container px-4 py-10 ${className}`}
    >
      <div
        aria-hidden
        className="empty-float flex h-14 w-14 items-center justify-center rounded-full bg-surface-bright shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-inset ring-outline-variant/30"
      >
        <span className="text-2xl leading-none drop-shadow-sm">{emoji}</span>
      </div>
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
