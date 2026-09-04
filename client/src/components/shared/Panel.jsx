/**
 * Panel — painel de conteúdo com header padronizado (STYLE.md §3).
 *
 * Container canónico: `bg-surface-container rounded-md overflow-hidden`
 * com header `px-5 py-4 bg-surface-container-high/50` e título
 * `text-base font-black font-headline tracking-tight text-tertiary uppercase`.
 */

/**
 * @param {{
 *   title: string,
 *   icon?: string,
 *   meta?: import("react").ReactNode,
 *   className?: string,
 *   headerClassName?: string,
 *   titleClassName?: string,
 *   bodyClassName?: string,
 *   padded?: boolean,
 *   children: import("react").ReactNode,
 * }} props
 */
export function Panel({
  title,
  icon,
  meta,
  className = "",
  headerClassName = "",
  titleClassName = "",
  bodyClassName = "",
  padded = true,
  children,
}) {
  return (
    <section className={`bg-surface-container rounded-md overflow-hidden ${className}`}>
      {/* Header compacto em telemóvel: painéis repetem-se em todas as tabs e
          ~16px por cabeçalho somam scroll desnecessário no phone. */}
      <div
        className={`px-3.5 sm:px-5 py-2.5 sm:py-4 flex items-center justify-between bg-surface-container-high/50 ${headerClassName}`}
      >
        <h2
          className={`text-sm sm:text-base font-black font-headline tracking-tight text-tertiary uppercase flex items-center gap-2 ${titleClassName}`}
        >
          {icon && (
            <span className="material-symbols-outlined text-[16px] sm:text-[18px] text-tertiary">
              {icon}
            </span>
          )}
          {title}
        </h2>
        {meta && (
          <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
            {meta}
          </span>
        )}
      </div>
      <div className={`${padded ? "p-2.5 sm:p-3 md:p-4" : ""} ${bodyClassName}`}>
        {children}
      </div>
    </section>
  );
}
