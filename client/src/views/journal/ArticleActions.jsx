/**
 * Botões de ação das notícias: barra única sticky no fim do artigo e
 * botões por tipo de notícia. Reutilizam os fluxos existentes.
 */
import { useState } from "react";
import { Button } from "../../components/shared/Button.jsx";
import { Badge } from "../../components/shared/Badge.jsx";
import { formatCurrency } from "../../utils/formatters.js";

/** Tipos com botões (pendentes ou informativos, ex. Taça). */
const ACTION_KINDS = ["contract", "job", "board", "cupdraw", "sponsor"];
/** Notícias que já foram pendência: sem botões, mostram «Resolvido». */
const ACTION_NEWS = ["contract_request", "job_offer", "board_warning", "sponsor_offer"];

/**
 * Barra de ação única do artigo, sticky no fundo: selo da pendência (se
 * houver), botões do tipo de notícia ou nota «Resolvido» nas já
 * respondidas. Nada a mostrar nas notícias comuns → null.
 * @param {{ item: object, inbox: object, onOpenCupBracket?: Function, onOpenSponsor?: Function }} props
 * @returns {JSX.Element|null}
 */
export function ArticleActionBar({ item, inbox, onOpenCupBracket, onOpenSponsor }) {
  if (!item) return null;
  const actionable = ACTION_KINDS.includes(item.kind);
  const resolved =
    !item.redFlag && !actionable && ACTION_NEWS.includes(item.newsType);
  if (!item.redFlag && !actionable && !resolved) return null;
  return (
    <div className="sticky bottom-0 mt-5 border-t border-outline-variant/25 bg-surface-container-high/95 pt-3 pb-1 backdrop-blur">
      {item.redFlag && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant="error" size="sm">
            Ação necessária
          </Badge>
          <span className="text-[10px] font-black uppercase tracking-widest text-error">
            Bloqueia o Pronto
          </span>
        </div>
      )}
      {actionable ? (
        <InboxActions
          item={item}
          inbox={inbox}
          onOpenCupBracket={onOpenCupBracket}
          onOpenSponsor={onOpenSponsor}
        />
      ) : (
        <p className="text-xs font-bold text-on-surface-variant">
          ✓ Resolvido — sem ação pendente.
        </p>
      )}
    </div>
  );
}

/**
 * Botões de ação por tipo de notícia.
 * @param {{ item: object, inbox: object, onOpenCupBracket?: Function, onOpenSponsor?: Function }} props
 * @returns {JSX.Element|null}
 */
export function InboxActions({ item, inbox, onOpenCupBracket, onOpenSponsor }) {
  // Anti-duplo-clique e confirmação em dois passos, com chave por notícia
  // (a instância é partilhada entre artigos). Sem temporizador: o segundo
  // clique confirma, trocar de notícia desarma.
  const [busyId, setBusyId] = useState(null);
  const [refuseArmedId, setRefuseArmedId] = useState(null);
  const busy = busyId === item.id;
  const refuseArmed = refuseArmedId === item.id;
  if (item.kind === "sponsor") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="w-full text-[11px] text-on-surface-variant">
          Sem escolha não há Pronto. A marca é única por sala e época.
        </p>
        <Button variant="primary" size="md" onClick={() => onOpenSponsor?.()}>
          Escolher patrocinador
        </Button>
      </div>
    );
  }
  if (item.kind === "contract") {
    const answering = !!item.extra?.answering;
    const locked = answering || busy;
    const wage = item.extra?.requestedWage != null
      ? formatCurrency(item.extra.requestedWage)
      : null;
    return (
      <div className="flex flex-wrap items-center gap-2">
        {wage && (
          <p className="w-full text-xs font-bold text-on-surface">
            Exige {wage}/sem
          </p>
        )}
        <p className="w-full text-xs text-on-surface-variant">
          {answering
            ? "A falar com o agente…"
            : refuseArmed
              ? "Confirmar a recusa manda o jogador para leilão. Carrega outra vez."
              : "Se recusares, o jogador vai a leilão."}
        </p>
        <Button
          variant="success"
          size="md"
          disabled={locked}
          onClick={() => {
            setRefuseArmedId(null);
            inbox.answerContract(item.ref, true);
          }}
        >
          Aceitar
        </Button>
        <Button
          variant={refuseArmed ? "danger" : "secondary"}
          size="md"
          disabled={locked}
          title="Se recusares, o jogador vai a leilão"
          onClick={() => {
            if (!refuseArmed) {
              setRefuseArmedId(item.id);
              return;
            }
            setRefuseArmedId(null);
            setBusyId(item.id);
            inbox.answerContract(item.ref, false);
          }}
        >
          {refuseArmed ? "Confirmar: vai a leilão" : "Recusar"}
        </Button>
      </div>
    );
  }
  if (item.kind === "job") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {item.extra && (
          <p className="w-full text-[11px] text-on-surface-variant">
            {item.extra.position}.º · {item.extra.points} pts ·{" "}
            {item.extra.record}
          </p>
        )}
        <Button
          variant="success"
          size="md"
          disabled={busy}
          onClick={() => {
            setBusyId(item.id);
            inbox.answerJobOffer(true);
          }}
        >
          Aceitar
        </Button>
        <Button
          variant="secondary"
          size="md"
          disabled={busy}
          onClick={() => {
            setBusyId(item.id);
            inbox.answerJobOffer(false);
          }}
        >
          Recusar
        </Button>
      </div>
    );
  }
  if (item.kind === "board") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        {item.extra && (
          <p className="w-full text-[11px] text-on-surface-variant">
            Orçamento: {formatCurrency(item.extra.budget)} ·{" "}
            {item.extra.streak} semana
            {item.extra.streak === 1 ? "" : "s"} no vermelho
          </p>
        )}
        <Button
          variant="primary"
          size="md"
          disabled={busy}
          onClick={() => {
            setBusyId(item.id);
            inbox.ackBoard();
          }}
        >
          Ok, lido
        </Button>
      </div>
    );
  }
  if (item.kind === "cupdraw") {
    return (
      <Button variant="accent" size="sm" onClick={() => onOpenCupBracket?.()}>
        Ver quadro da Taça
      </Button>
    );
  }
  return null;
}
