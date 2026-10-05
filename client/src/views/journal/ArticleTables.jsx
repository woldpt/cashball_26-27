/**
 * Tabelas do Jornal: primitivos partilhados e as 3 tabelas de artigo
 * (classificação final, sorteio da Taça, resumo financeiro semanal).
 */
import { Fragment } from "react";
import { formatCurrency } from "../../utils/formatters.js";
import { LINK_CLS, TABLE_CLS, TABLE_CLS_WIDE, TABLE_WRAP_CLS, THEAD_ROW_CLS } from "./tones.js";
import { teamFromRef, cupDrawRoundPrefix } from "./utils.jsx";

const ALIGN_CLS = { left: "text-left", right: "text-right", center: "text-center" };

/**
 * Primitivos de tabela do Jornal (cabeçalho e célula com o padding padrão).
 * @param {{ children?: React.ReactNode, align?: "left"|"right"|"center", className?: string }} props
 */
export function Th({ children, align = "left", className = "" }) {
  return <th scope="col" className={`px-2 py-1.5 ${ALIGN_CLS[align] || ALIGN_CLS.left} ${className}`}>{children}</th>;
}

/**
 * @param {{ children?: React.ReactNode, align?: "left"|"right"|"center", className?: string, [key: string]: any }} props
 */
export function Td({ children, align = "left", className = "", ...rest }) {
  return <td {...rest} className={`px-2 py-1.5 ${ALIGN_CLS[align] || ALIGN_CLS.left} ${className}`}>{children}</td>;
}

/**
 * Moldura de tabela do Jornal (invólucro + tabela + thead com o estilo único).
 * @param {{ children?: React.ReactNode, caption?: string, wide?: boolean }} props
 */
export function JournalTable({ children, caption, wide = false }) {
  return (
    <div className={TABLE_WRAP_CLS}>
      <table className={wide ? TABLE_CLS_WIDE : TABLE_CLS}>
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

/**
 * Tabela da classificação final (notícia `league_final`, linhas em `rows`).
 * Nomes clicáveis com o mesmo comportamento das entidades do corpo.
 * A equipa do treinador leva tinta dourada; os 2 primeiros (subida) e os
 * 2 últimos (descida) levam barra lateral — a regra do servidor
 * (`applyPromotionsAndRelegations`: 2 sobem, 2 descem).
 * @param {{ rows?: Array, teams: Array, viewerTeamId?: number|string|null, onOpenTeamSquad?: Function }} props
 * @returns {JSX.Element|null}
 */
export function LeagueFinalTable({ rows, teams, viewerTeamId, onOpenTeamSquad }) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const vId = viewerTeamId == null ? null : String(viewerTeamId);
  const zoneBar = (pos) =>
    pos <= 2
      ? "border-l-emerald-400/80"
      : pos > rows.length - 2
        ? "border-l-error/80"
        : "border-l-transparent";
  return (
    <>
      <JournalTable wide caption="Classificação final">
        <thead>
          <tr className={THEAD_ROW_CLS}>
            <Th align="right">#</Th>
            <Th>Equipa</Th>
            <Th align="right">J</Th>
            <Th align="right">V</Th>
            <Th align="right">E</Th>
            <Th align="right">D</Th>
            <Th align="right">GM</Th>
            <Th align="right">GS</Th>
            <Th align="right">Pts</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const team = teamFromRef(teams, { id: r.id, label: r.name });
            const isChampion = i === 0;
            const mine = vId != null && String(r.id) === vId;
            return (
              <tr
                key={r.id ?? r.pos}
                className={`border-t border-outline-variant/15 transition-colors hover:bg-surface-container/20 ${
                  mine
                    ? "bg-tertiary/15 font-black"
                    : isChampion
                      ? "bg-tertiary/10 font-black"
                      : i % 2 === 1
                        ? "bg-surface-container/15"
                        : ""
                }`}
              >
                <Td align="right" className={`border-l-2 ${zoneBar(Number(r.pos) || i + 1)} text-on-surface-variant`}>
                  {isChampion ? (
                    <span className="inline-flex items-center justify-end gap-1">
                      <span role="img" aria-label="Campeão">🏆</span>{r.pos}
                    </span>
                  ) : r.pos}
                </Td>
                <Td className="sticky left-0 bg-inherit">
                  <button
                    type="button"
                    className={`${LINK_CLS} ${
                      mine || isChampion ? "text-tertiary" : ""
                    }`}
                    onClick={() => team?.id && onOpenTeamSquad?.(team)}
                    disabled={!team?.id || !onOpenTeamSquad}
                  >
                    {r.name}
                  </button>
                </Td>
                <Td align="right">{r.j}</Td>
                <Td align="right">{r.v}</Td>
                <Td align="right">{r.e}</Td>
                <Td align="right">{r.d}</Td>
                <Td align="right">{r.gf}</Td>
                <Td align="right">{r.gs}</Td>
                <Td align="right" className="font-black">{r.p}</Td>
              </tr>
            );
          })}
        </tbody>
      </JournalTable>
      <p className="mt-1 text-center text-[10px] font-bold text-on-surface-variant">
        <span className="text-emerald-400">▌</span> subida · <span className="text-error">▌</span> descida
      </p>
    </>
  );
}

/**
 * Tabela do sorteio da Taça: pares por ordem do sorteio, equipas clicáveis,
 * o jogo do treinador marcado com 📍 e tinta dourada.
 * @param {{ fixtures?: Array, viewerTeamId?: number|string|null, teams: Array, onOpenTeamSquad?: Function }} props
 * @returns {JSX.Element|null}
 */
export function CupDrawTable({ fixtures, viewerTeamId, teams, onOpenTeamSquad }) {
  if (!Array.isArray(fixtures) || fixtures.length === 0) return null;
  const vId = viewerTeamId == null ? null : String(viewerTeamId);
  const teamCell = (id, label, mine) => {
    const team = teamFromRef(teams, { id, label });
    return (
      <Td className={mine ? "font-black" : ""}>
        <button
          type="button"
          className={`${LINK_CLS} ${mine ? "text-tertiary" : ""}`}
          onClick={() => team?.id && onOpenTeamSquad?.(team)}
          disabled={!team?.id || !onOpenTeamSquad}
        >
          {label}
        </button>
      </Td>
    );
  };
  return (
    <JournalTable caption="Sorteio da Taça">
      <thead>
        <tr className={THEAD_ROW_CLS}>
          <Th align="center">Jogo</Th>
          <Th>Casa</Th>
          <Th align="center"><span className="sr-only">contra</span><span aria-hidden="true">vs</span></Th>
          <Th>Fora</Th>
        </tr>
      </thead>
      <tbody>
        {fixtures.map((f, i) => {
          const mine =
            vId != null &&
            (String(f.homeTeamId) === vId || String(f.awayTeamId) === vId);
          return (
            <tr
              key={i}
              className={`border-t border-outline-variant/15 transition-colors hover:bg-surface-container/20 ${
                mine
                  ? "bg-tertiary/15"
                  : i % 2 === 1
                    ? "bg-surface-container/15"
                    : ""
              }`}
            >
              <Td align="center" className="text-on-surface-variant">
                {mine ? <span role="img" aria-label="O teu jogo">📍</span> : i + 1}
              </Td>
              {teamCell(f.homeTeamId, f.homeName, mine)}
              <Td align="center" className="text-[10px] font-black text-on-surface-variant">vs</Td>
              {teamCell(f.awayTeamId, f.awayName, mine)}
            </tr>
          );
        })}
      </tbody>
    </JournalTable>
  );
}

/**
 * Parágrafo de abertura do sorteio da Taça: o que nos calhou (adversário
 * + casa/fora, com uma linha de favoritismo pela divisão) antes da tabela
 * completa. Sem jogo próprio (já eliminado), genérico da ronda.
 * @param {{ fixtures?: Array, viewerTeamId?: number|string|null, roundName?: string, titleFallback?: string, teams: Array, onOpenTeamSquad?: Function }} props
 * @returns {JSX.Element}
 */
export function CupDrawIntro({ fixtures, viewerTeamId, roundName, titleFallback, teams, onOpenTeamSquad }) {
  const list = Array.isArray(fixtures) ? fixtures : [];
  const name =
    roundName ||
    String(titleFallback || "").split("Sorteio:")[1]?.trim() ||
    "";
  const prefix = cupDrawRoundPrefix(name);
  const cls =
    "text-base short:text-sm leading-relaxed text-left text-on-surface";
  const vId = viewerTeamId == null ? null : String(viewerTeamId);
  const mine =
    vId == null
      ? null
      : list.find(
          (f) =>
            String(f.homeTeamId) === vId || String(f.awayTeamId) === vId,
        ) || null;
  if (!mine) {
    return (
      <p className={cls}>
        O sorteio {prefix} já ditou os duelos da próxima eliminatória — o
        quadro completo fica abaixo.
      </p>
    );
  }
  const isHome = String(mine.homeTeamId) === vId;
  const oppId = isHome ? mine.awayTeamId : mine.homeTeamId;
  const oppName = isHome ? mine.awayName : mine.homeName;
  const opp = teamFromRef(teams, { id: oppId, label: oppName });
  const myDiv = teamFromRef(teams, {
    id: isHome ? mine.homeTeamId : mine.awayTeamId,
  })?.division;
  const oppDiv = opp?.division;
  const stakes = /^meias/i.test(name)
    ? "Em jogo está um lugar na final."
    : "Em jogo está um lugar na próxima eliminatória.";
  const spice =
    myDiv == null || oppDiv == null
      ? ""
      : myDiv === oppDiv
        ? " Duelo entre equipas do mesmo escalão, sem favorito claro."
        : myDiv < oppDiv
          ? " O favoritismo veste as nossas cores, mas a Taça raramente respeita favoritismos."
          : " O favoritismo sorri ao adversário, mas a Taça vive destas noites.";
  return (
    <p className={cls}>
      O sorteio {prefix} calhou-te{" "}
      {isHome ? (
        <>
          o{" "}
          <button
            type="button"
            className={LINK_CLS}
            onClick={() => opp?.id && onOpenTeamSquad?.(opp)}
            disabled={!opp?.id || !onOpenTeamSquad}
          >
            {oppName}
          </button>{" "}
          em casa
        </>
      ) : (
        <>
          deslocação ao terreno do{" "}
          <button
            type="button"
            className={LINK_CLS}
            onClick={() => opp?.id && onOpenTeamSquad?.(opp)}
            disabled={!opp?.id || !onOpenTeamSquad}
          >
            {oppName}
          </button>
        </>
      )}
      . {stakes}
      {spice}
    </p>
  );
}

/**
 * Tabela do resumo financeiro semanal (notícia `weekly_finance`, valores em
 * `facts`): rendimento, salários e manutenção, mais juros e capital só com
 * empréstimo, com o saldo em destaque. Notícias antigas (sem factos)
 * mostram a descrição em texto e não renderizam tabela.
 * @param {{ facts?: object }} props
 * @returns {JSX.Element|null}
 */
export function WeeklyFinanceTable({ facts }) {
  if (!facts || facts.v !== 1) return null;
  const net = Number(facts.net) || 0;
  const sections = [
    { title: "Receitas", rows: [
        { label: "Rendimento base", value: facts.income },
        ...(Number(facts.sponsor) > 0 ? [{ label: "Patrocínio", value: facts.sponsor }] : []),
      ] },
    {
      title: "Despesas",
      rows: [
        { label: "Salários", value: facts.wages, debit: true },
        ...(Number(facts.staff) > 0
          ? [{ label: "Funcionários", value: facts.staff, debit: true }]
          : []),
        { label: "Manutenção do estádio", value: facts.upkeep, debit: true },
        ...(facts.hasLoan
          ? [
              { label: "Juros do empréstimo", value: facts.interest, debit: true },
              { label: "Capital do empréstimo", value: facts.installment, debit: true },
            ]
          : []),
      ],
    },
  ];
  return (
    <>
      <JournalTable caption="Resumo financeiro da semana">
        <thead>
          <tr className={THEAD_ROW_CLS}>
            <Th>Rubrica</Th>
            <Th align="right">Valor</Th>
          </tr>
        </thead>
        <tbody>
          {sections.map((s) => (
            <Fragment key={s.title}>
              <tr className="border-t border-outline-variant/15 bg-surface-container-high/40">
                <Td colSpan={2} className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                  {s.title}
                </Td>
              </tr>
              {s.rows.map((r) => {
                const v = Number(r.value ?? 0) || 0;
                return (
                  <tr
                    key={r.label}
                    className="border-t border-outline-variant/15 odd:bg-surface-container/15"
                  >
                    <Td>{r.label}</Td>
                    <Td
                      align="right"
                      className={`tabular-nums ${r.debit ? "text-error" : ""}`}
                    >
                      {formatCurrency(r.debit && v > 0 ? -v : v)}
                    </Td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
          <tr className="border-t-2 border-t-tertiary/60 bg-tertiary/10 text-base font-black">
            <Td>Saldo da semana</Td>
            <Td
              align="right"
              className={`tabular-nums ${
                net >= 0 ? "text-tertiary" : "text-error"
              }`}
            >
              {formatCurrency(net)}
            </Td>
          </tr>
        </tbody>
      </JournalTable>
      {facts.loanPaidOff && (
        <p className="px-2 py-1.5 text-[11px] font-bold text-tertiary">
          Empréstimo liquidado esta semana.
        </p>
      )}
    </>
  );
}
