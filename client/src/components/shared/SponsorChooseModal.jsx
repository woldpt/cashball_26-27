/**
 * SponsorChooseModal — as 3 ofertas do patrocinador da época.
 * A conta é mostrada (upfront, semanal, 2.ª tranche, total); o clique
 * reserva a marca por sala/época. Em colisão (`taken`), o servidor
 * regenera a oferta e o modal refresca com aviso.
 */
import { SEASON_WEEKS } from "../../constants/index.js";
import { useId, useState } from "react";
import { useGame } from "../../contexts/GameContext.jsx";
import { queueEmit } from "../../socket.js";
import { formatCurrency } from "../../utils/formatters.js";
import { Button } from "./Button.jsx";
import { ModalShell } from "./ModalShell.jsx";
import { SponsorLogo } from "./SponsorLogo.jsx";

const PROFILE_BLURB = {
  A: "Tudo já — liquidez imediata para o mercado",
  B: "Pinga-pinga — 120% numa época",
  C: "Meio-meio — 55% já + 55% na semana 10",
};

/**
 * @param {{ open: boolean, onClose: () => void }} props
 */
export function SponsorChooseModal({ open, onClose }) {
  const { me, sponsorState } = useGame();
  const [busyId, setBusyId] = useState(null);
  const [lastOffers, setLastOffers] = useState(null);
  const titleId = useId();
  const pending = !!sponsorState?.pending;
  const offers = Array.isArray(sponsorState?.offers) ? sponsorState.offers : [];
  const takenNote = !!sponsorState?.taken;
  // Ajuste de estado no render (padrão documentado): ofertas novas
  // (ex. regeneração após colisão) libertam os botões sem efeito.
  if (open && lastOffers !== offers) {
    setLastOffers(offers);
    if (busyId != null) setBusyId(null);
  }

  if (!open) return null;
  const teamId = me?.teamId;
  const showOffers = pending ? offers : [];

  const choose = (sponsorId) => {
    if (!teamId || !sponsorId || busyId) return;
    setBusyId(sponsorId);
    queueEmit("chooseSponsor", { teamId, sponsorId });
  };

  const close = () => {
    setBusyId(null);
    setLastOffers(null);
    onClose();
  };

  return (
    <ModalShell
      visible={open}
      onClose={close}
      labelledBy={titleId}
      variant="lg"
    >
      <div className="p-4">
        <h2 id={titleId} className="font-headline text-lg font-black text-on-surface">
          🚩 Patrocinador da época
        </h2>
        <p className="mt-1 text-xs text-on-surface-variant">
          Sem escolha não há Pronto. A marca é única por sala e época — quem
          clicar primeiro fica com ela.
        </p>
        {takenNote && (
          <p className="mt-2 rounded-md bg-error/10 px-2 py-1 text-xs font-bold text-error">
            Essa marca acabou de ser escolhida por outro clube — eis uma
            alternativa fresca do mesmo escalão.
          </p>
        )}
        {!pending && (
          <p className="mt-3 text-sm text-on-surface-variant">
            {sponsorState?.chosen
              ? `Patrocinador fechado: ${sponsorState.chosen.name} (perfil ${sponsorState.chosen.profile}, total ${formatCurrency(sponsorState.chosen.total)}).`
              : "Sem escolha pendente."}
          </p>
        )}
        {pending && showOffers.length === 0 && (
          <p className="mt-3 text-sm text-on-surface-variant">
            A carregar ofertas…
          </p>
        )}
        <div className="mt-3 space-y-2">
          {showOffers.map((o, idx) => (
            <div
              key={o?.sponsorId || `sponsor-${idx}`}
              className="flex items-center gap-3 rounded-xl border border-outline-variant/25 bg-surface-container-low p-2"
            >
              <SponsorLogo brand={o} className="h-12 w-12 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-on-surface">
                  {o?.name || "—"}
                </p>
                <p className="text-[11px] text-on-surface-variant">
                  Perfil {o?.profile} · {PROFILE_BLURB[o?.profile] || ""}
                </p>
                <p className="text-[11px] tabular-nums text-on-surface-variant">
                  {o?.profile === "A" && <>{formatCurrency(o?.upfront)} já</>}
                  {o?.profile === "B" && (
                    <>{formatCurrency(o?.weekly)}/sem × {SEASON_WEEKS} = {formatCurrency(o?.total)}</>
                  )}
                  {o?.profile === "C" && (
                    <>
                      {formatCurrency(o?.upfront)} já + {formatCurrency(o?.secondHalf)} na
                      semana 10 = {formatCurrency(o?.total)}
                    </>
                  )}
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                disabled={busyId != null}
                onClick={() => choose(o?.sponsorId)}
              >
                {busyId === o?.sponsorId ? "A fechar…" : "Escolher"}
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="secondary" size="sm" onClick={close}>
            Fechar
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
