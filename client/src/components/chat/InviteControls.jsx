/**
 * Controlos de convite (estado + botão). O chamador envolve-os no contentor flex da linha/pill.
 * @param {Object} props
 * @param {string} props.coachName - Coach a convidar.
 * @param {{status: string, msg?: string}} [props.invite] - Estado atual do convite.
 * @param {function(string): void} props.onInvite - Envia o convite.
 * @returns {JSX.Element}
 */
export function InviteControls({ coachName, invite: inv, onInvite }) {
  const busy =
    inv && ["sending", "sent", "accepted", "declined"].includes(inv.status);
  return (
    <>
      {inv?.status === "sending" && (
        <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-on-surface-variant/60">
          A convidar…
        </span>
      )}
      {inv?.status === "sent" && (
        <span className="shrink-0 rounded border border-primary/30 bg-primary/15 px-1 py-px text-[9px] font-black uppercase tracking-widest text-primary">
          Convite enviado
        </span>
      )}
      {inv?.status === "accepted" && (
        <span className="shrink-0 rounded border border-primary/40 bg-primary/20 px-1 py-px text-[9px] font-black uppercase tracking-widest text-primary">
          Aceitou ✓
        </span>
      )}
      {inv?.status === "declined" && (
        <span className="shrink-0 rounded border border-outline-variant/25 bg-surface-container-low px-1 py-px text-[9px] font-black uppercase tracking-widest text-on-surface-variant/60">
          Recusou
        </span>
      )}
      {inv?.status === "error" && (
        <span className="shrink-0 max-w-full truncate text-[9px] font-bold text-error/90">
          {inv.msg || "Erro"}
        </span>
      )}
      {!busy && (
        <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-amber-400/90">
          Noutra Sala
        </span>
      )}
      {!busy && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onInvite(coachName);
          }}
          title={`Convidar ${coachName} para esta sala`}
          className="shrink-0 rounded-md border border-sky-500/30 bg-sky-500/15 px-1.5 py-px text-[9px] font-black uppercase tracking-widest text-sky-300 transition-colors hover:bg-sky-500/25 active:scale-95"
        >
          Convidar
        </button>
      )}
    </>
  );
}
