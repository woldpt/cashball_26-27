import { Badge } from "../shared/Badge.jsx";

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
        <Badge>A convidar…</Badge>
      );
    case "sent":
      return (
        <Badge variant="info">Enviado</Badge>
      );
    case "accepted":
      return (
        <Badge variant="success">Aceitou ✓</Badge>
      );
    case "declined":
      return (
        <Badge>Recusou</Badge>
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
          className={`shrink-0 rounded border border-sky-500/30 bg-sky-500/15 px-1.5 py-px text-[9px] font-black uppercase tracking-widest text-sky-300 transition-all hover:bg-sky-500/25 active:scale-95 ${
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
