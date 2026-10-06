const CHIP =
  "shrink-0 rounded border px-1.5 py-px text-[9px] font-black uppercase tracking-widest";

/**
 * Controlos de convite: um só elemento por estado (botão → A convidar → Enviado → Aceitou/Recusou).
 * O chamador envolve-os no contentor flex da linha/pill.
 * @param {Object} props
 * @param {string} props.coachName - Coach a convidar.
 * @param {{status: string, msg?: string}} [props.invite] - Estado atual do convite.
 * @param {function(string): void} props.onInvite - Envia o convite.
 * @param {boolean} [props.hoverReveal] - Botão só visível em hover/foco (desktop); o pai tem de ser `group`.
 * @returns {JSX.Element}
 */
export function InviteControls({
  coachName,
  invite: inv,
  onInvite,
  hoverReveal = false,
}) {
  switch (inv?.status) {
    case "sending":
      return (
        <span className={`${CHIP} border-transparent text-on-surface-variant/60`}>
          A convidar…
        </span>
      );
    case "sent":
      return (
        <span className={`${CHIP} border-primary/30 bg-primary/15 text-primary`}>
          Enviado
        </span>
      );
    case "accepted":
      return (
        <span className={`${CHIP} border-primary/40 bg-primary/20 text-primary`}>
          Aceitou ✓
        </span>
      );
    case "declined":
      return (
        <span
          className={`${CHIP} border-outline-variant/25 bg-surface-container-low text-on-surface-variant/60`}
        >
          Recusou
        </span>
      );
    case "error":
      return (
        <span className="shrink-0 max-w-full truncate text-[10px] font-bold text-error/90">
          {inv.msg || "Erro"}
        </span>
      );
    default:
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onInvite(coachName);
          }}
          title={`${coachName} está noutra sala — convidar para esta`}
          className={`${CHIP} border-sky-500/30 bg-sky-500/15 text-sky-300 transition-all hover:bg-sky-500/25 active:scale-95 ${
            hoverReveal
              ? "sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              : ""
          }`}
        >
          Convidar
        </button>
      );
  }
}
