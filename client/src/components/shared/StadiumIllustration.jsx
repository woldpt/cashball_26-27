import { memo, useId } from "react";
import { FANS_MOOD_HIGH, FANS_MOOD_LOW } from "../../constants/index.js";

/**
 * Ilustração paramétrica do estádio ("câmara de transmissão" baixa:
 * vista frontal com o relvado a recuar para as bancadas e a baliza
 * assente na linha frontal).
 *
 * O enquadramento é dinâmico: o `viewBox` começa em `frameTop` (o céu
 * morto é cortado até `SKY_TRIM` unidades) e desce quando a cobertura
 * do colossal precisa de mais ar. Com `preserveAspectRatio`
 * `xMidYMin slice` o corte cai sempre no relvado, nunca no telão — é o
 * que permite a mesma ilustração servir o hero do StadiumTab,
 * o card do ClubTab (3.4) e o `short:h-16` (6.3) sem perder nada.
 * Em `shot="close"` (só o hero do StadiumTab) a câmara desce para a
 * bancada nos estádios sem cobertura e aperta a largura à bancada:
 * o pelado deixava de se ver nos heros largos (70% céu).
 *
 * O número de anéis, a cobertura, os camarotes e o telão crescem
 * com a lotação; os acentos arquitectónicos e a multidão usam
 * as cores da equipa.
 *
 * Escalões:
 * - ≤ 5k: pelado — 1 anel estreito (0.50×), sem cobertura, sem postes
 *   de luz, sem bandeirolas nem portões laterais (só bancada, muro e relvado)
 * - 5–15k: 1 anel, sem cobertura, 2 postes de luz baixos
 * - 15–30k: 1 anel + cobertura + 4 postes de suporte
 * - 30–50k: 2 anéis + faixa de camarotes
 * - ≥ 50k: 3 anéis + cobertura maior + telão
 * - > 80k: presença colossal — o corpo cresce mais íngreme (até ~1.35
 *   aos 120k), cobertura mais alta (o telão cabe dentro do arco),
 *   testeira mais grossa, telão maior e 6 setores em vez de 4
 * Bancadas laterais em perspetiva (`sideTier`): nenhuma no pelado, baixas
 * <15k, completas <50k, com cobertura ≥50k; ondulam e esvaziam com o mood.
 * A largura (`span`) e o corpo (`bulk`) são contínuos em toda a gama:
 * cada obra de +5 000 lugares muda a imagem.
 *
 * Mood: <23 faroeste — esvazia a bancada (mesmo com casa cheia), anoitece
 * (lua, colinas em silhueta, foco quente na bancada e poças de luz no
 * relvado) e põe tumbleweeds a atravessar o campo; 23–37 fica como antes
 * (estático, custo zero); ≥38 agita os anéis, acende tochas na claque e
 * hasteia bandeiras.
 *
 * @param {{
 *   capacity?: number,
 *   primary?: string|null,
 *   secondary?: string|null,
 *   className?: string,
 *   occupancy?: number|null,
 *   mood?: number|null,
 *   shot?: string,
 * }} props
 */

// `occupancy`: 0..1 (fração da lotação ocupada). `null` = bancada cheia.
// `mood`: escala real 1–50. <23 faroeste, 23–37 neutro, ≥38 festa.
// `null` = neutro (comportamento anterior).
// `shot`: "wide" (default, cards) ou "close" (hero do StadiumTab).

// ── Helpers de cor (determinísticos, sem dependências) ──────────────
const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));

/** "#rrggbb" ou "#rgb" → [r, g, b] (ou null se não for parseável). */
const parseColor = (hex) => {
  if (typeof hex !== "string") return null;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

const toHex = (rgb) =>
  `#${rgb.map((v) => clamp255(v).toString(16).padStart(2, "0")).join("")}`;

/** Mistura dois hex (t=0 → a, t=1 → b); devolve `a` se parsing falhar. */
const mix = (a, b, t) => {
  const A = parseColor(a);
  const B = parseColor(b);
  if (!A || !B) return a;
  return toHex(A.map((v, i) => v + (B[i] - v) * t));
};

/** amt > 0 clareia (em branco); amt < 0 escurece (em preto). */
const shade = (hex, amt) =>
  amt >= 0 ? mix(hex, "#ffffff", amt) : mix(hex, "#000000", -amt);

/** Pseudo-aleatório determinístico em [0,1) (multidão estável entre renders). */
const hash01 = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// ── Geometria (viewBox 800 × de `frameTop` a `H`) ───────────────────
const W = 800;
const H = 272;
/** Céu morto que se corta quando a cobertura tem espaço (topo do frame). */
const SKY_TRIM = 40;
const TIER_H = 28;
const BOX_H = 12;
const WALL_TOP = 146;
const PITCH_TOP = 164;
const PITCH_BOT = 260;
const PITCH_H = PITCH_BOT - PITCH_TOP;
const STAND_X0 = 84; // borda esquerda a escala plena (≥50k)
const STAND_X1 = 716; // borda direita a escala plena (≥50k)
const CAP_INSET = 24; // profundidade das faces laterais das bancadas
// (a meia-largura do relvado na linha frontal deriva da bancada: `farHalf`)
const PITCH_NEAR_HALF = 400; // meia-largura na borda próxima
const STRIPES = 8;
const GOAL_TOP = 146;
const GOAL_BOT = 166;
const GOAL_HALF_BOT = 34;
const GOAL_HALF_TOP = 30;
/** Sol/lua: abaixo de `SKY_TRIM` para caber no frame mais apertado. */
const SUN_CY = 68;

export const StadiumIllustration = memo(function StadiumIllustration({
  capacity = 10000,
  primary = null,
  secondary = null,
  className = "",
  occupancy = null,
  mood = null,
  shot = "wide",
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const gid = (n) => `s${uid}-${n}`;
  const url = (n) => `url(#${gid(n)})`;

  // A lotação vem do BD: um valor não numérico tinha de partir a
  // geometria toda (NaN no viewBox) em vez de cair no desenho base.
  const cap = Number.isFinite(capacity) ? Math.max(0, capacity) : 10000;

  const home = parseColor(primary) ? primary : "#4ade80";
  const away = parseColor(secondary) ? secondary : "#f8fafc";

  const tiers = cap >= 50000 ? 3 : cap >= 30000 ? 2 : 1;
  const roofed = cap >= 15000;
  const grandRoof = cap >= 50000;
  const boxes = cap >= 30000;
  const screen = cap >= 50000;
  const bare = cap <= 5000;
  const colossal = cap > 80000;
  // Bancada plana nos pequenos: sem faces laterais e sem avanço lateral
  // do corpo (`capIn`); o do relvado (CAP_INSET) mantém-se para o
  // relvado não encolher mais do que a bancada.
  const noCaps = cap < 15000;
  const capIn = noCaps ? 0 : CAP_INSET;
  // Placas LED na base do muro: a partir de 10k (um pelado de campo não).
  const led = cap >= 10000;

  // ── Escala de largura: os estádios pequenos ocupam menos espaço ──
  // 0.50× no pelado (≤5k) e cresce sem degraus até 1× aos 50k; depois
  // continua a alargar devagar (1.06× aos 120k) para que cada obra de
  // +5 000 se note também no topo da escala.
  const span =
    cap <= 5000
      ? 0.5
      : cap < 15000
        ? 0.5 + ((cap - 5000) / 10000) * 0.2
        : cap < 50000
          ? 0.7 + ((cap - 15000) / 35000) * 0.3
          : 1 + ((Math.min(cap, 120000) - 50000) / 70000) * 0.06;
  const standX0 = 400 - ((STAND_X1 - STAND_X0) / 2) * span;
  const standX1 = 400 + ((STAND_X1 - STAND_X0) / 2) * span;
  const wallX0 = standX0 - capIn;
  const wallX1 = standX1 + capIn;
  const goalHalfBot = GOAL_HALF_BOT * span;
  const goalHalfTop = GOAL_HALF_TOP * span;
  const netHalf = GOAL_HALF_TOP * span;
  // Mastro de luz mais baixo, à escala do estádio (só <15k).
  const poleTop = PITCH_TOP - (PITCH_TOP - 66) * span;
  // Crescimento do corpo: contínuo em toda a gama, íngreme acima dos 80k
  // (até ~1.35 aos 120k). Move a altura da cobertura, a testeira e o telão.
  const bulk =
    cap <= 50000
      ? 1
      : 1 +
          ((Math.min(cap, 80000) - 50000) / 30000) * 0.09 +
          (cap > 80000 ? ((Math.min(cap, 120000) - 80000) / 40000) * 0.26 : 0);
  // Ocupação 0..1 (`null` = bancada cheia, comportamento anterior).
  const occ = occupancy == null ? 1 : Math.max(0, Math.min(1, occupancy));
  // Banda de mood: low esvazia mesmo com casa cheia (decisão do treinador),
  // high enche ligeiramente; mid não mexe (custo zero, como antes).
  const moodBand =
    mood == null ? "mid" : mood < FANS_MOOD_LOW ? "low" : mood >= FANS_MOOD_HIGH ? "high" : "mid";
  const moodOcc =
    moodBand === "low" ? occ * 0.12 : moodBand === "high" ? Math.min(1, occ * 1.2 + 0.1) : occ;
  // O faroeste anoitece: é a leitura de "o estádio vai esvaziar" e dá à
  // cena um estado visual que o de dia não distingue.
  const night = moodBand === "low";
  // Núcleo de claques ao centro (cor do clube, esvazia em último).
  const claqueHalf = ((standX1 - standX0) / 2) * 0.22;
  // O topo do relvado acompanha a largura da bancada (perspetiva).
  const farHalf = (standX1 - standX0) / 2 + CAP_INSET;
  // Bancadas laterais em perspetiva: encostam à linha lateral e saem do
  // enquadramento em primeiro plano. O pelado não tem; crescem por escalão.
  const sideTier = bare ? 0 : cap < 15000 ? 1 : cap < 50000 ? 2 : 3;
  const sideH = [0, 16, 30, 44][sideTier];
  // Com laterais a bancada do fundo fica menos densa (orçamento de pontos).
  const crowdStep = sideTier >= 2 ? 6 : 5;

  // ── Geometria da bancada (vista frontal) ──────────────────────
  /** Topo do anel i (0 = o de baixo). */
  const tierTop = (i) =>
    WALL_TOP - (i + 1) * TIER_H - (boxes && i >= 1 ? BOX_H : 0);
  const topY = tierTop(tiers - 1);
  const roofBaseY = topY - 12;
  const roofEdgeY = roofBaseY - 5; // aresta inferior da cobertura
  // Cobertura: 16 de base, esticada com `bulk` (o colossal precisa de
  // altura para o telão caber dentro do arco) e limitada para nunca sair
  // mais de 8 unidades acima do zero do canvas.
  const canopyH = Math.min(16 + (bulk - 1) * 62, roofEdgeY + 8);
  const roofTopY = roofEdgeY - canopyH;
  // Pala: avança para lá da bancada com o corpo (nos pequeños deixava de
  // cobrir a bancada toda e ficava a flutuar sobre o nada).
  const roofOver = 18 + 26 * (bulk - 1);
  const roofX0 = standX0 - roofOver;
  const roofX1 = standX1 + roofOver;
  // Setores (vomitórios): 6 nos gigantes, 4 nos restantes.
  const aisleCount = tiers >= 3 ? 6 : 4;

  /** Y do arco da cobertura na abcissa x (Bézier quadrática simétrica). */
  const roofY = (x) => {
    const t = (x - roofX0) / (roofX1 - roofX0);
    const h = roofEdgeY - roofTopY;
    return roofEdgeY - 2 * t * (1 - t) * h;
  };

  // O frame começa onde a cobertura deixa de precisar de céu: 40
  // unidades mortas cortadas em condições normais, mais espaço no
  // colossal. O céu é desenhado de 0 a H, por isso nunca há limbo.
  const frameTop = Math.min(SKY_TRIM, roofTopY - 6);
  // Plano aproximado (`shot="close"`): nos estádios sem cobertura o topo
  // desce para as colinas (92 em vez de 40) e a largura aperta-se à
  // bancada; com cobertura mantém o plano largo (o telão precisa de ar).
  // O corte continua a cair em baixo, no relvado — nunca na bancada.
  const close = shot === "close";
  const closeTop = roofed ? frameTop : 92;
  const closeW = roofed ? W : Math.min(W, Math.max(480, standX1 - standX0 + 200));
  const closeX = (W - closeW) / 2;

  /** Meia-largura do relvado na profundidade y (perspectiva em fuga). */
  const pitchHalf = (y) =>
    farHalf + ((y - PITCH_TOP) / PITCH_H) * (PITCH_NEAR_HALF - farHalf);

  /** Topo da faixa de corte s (foreshortening quadrático p/ a linha frontal). */
  const stripeTop = (i) => PITCH_TOP + PITCH_H * Math.pow(i / STRIPES, 2);

  /** Portão arquivado (path d) entre (x, bot) e (x+w, bot). */
  const gatePath = (x, w, top, bot) =>
    `M ${x} ${bot} L ${x} ${top + 4} Q ${x} ${top} ${x + w / 2} ${top} Q ${x + w} ${top} ${x + w} ${top + 4} L ${x + w} ${bot} Z`;

  /** Meia-largura do emolduramento da baliza na altura y. */
  const goalHalf = (y) =>
    goalHalfBot -
    ((GOAL_BOT - y) / (GOAL_BOT - GOAL_TOP)) * (goalHalfBot - goalHalfTop);

  // ── Paleta por variante (dia / noite) ───────────────────────────
  const SKY = night ? ["#0a1020", "#16233c", "#24334f"] : ["#38bdf8", "#bae6fd", "#e0f2fe"];
  const HILL_FAR = night ? "#0d1424" : "#aebfd0";
  const HILL_NEAR = night ? "#0f1a2c" : "#8fa8bf";
  const HILL_GREEN_FAR = night ? "#111c30" : "#a8bda4";
  const HILL_GREEN = night ? "#132032" : "#93a88f";
  const CLOUD = night ? "#334155" : "#ffffff";
  const CLOUD_OP = night ? 0.5 : 0.85;
  const HILL_OP = night ? 0.75 : 0.38;
  const HILL_OP_NEAR = night ? 0.9 : 0.55;
  const CONCRETE_HI = night ? "#7f8fa6" : "#cbd5e1";
  const CONCRETE_LO = night ? "#2b3648" : "#64748b";
  const ROOF_HI = night ? "#5b6b80" : "#f1f5f9";
  const ROOF_LO = night ? "#1b2434" : "#94a3b8";
  const GRASS_A = night ? "#1f7a3d" : "#22c55e";
  const GRASS_B = night ? "#186233" : "#16a34a";
  const GRASS_BASE = night ? "#0b2a16" : "#14532d";
  const HAZE_OP = night ? 0.12 : 0.4;

  // ── Multidão ─────────────────────────────────────────────────────
  /** Cor de um adepto: zona (casa / fora / pele / escuro) + variação h. */
  const crowdFill = (zone, h) =>
    zone < 0.52
      ? h < 0.8
        ? home
        : shade(home, 0.3)
      : zone < 0.74
        ? h < 0.75
          ? away
          : shade(away, -0.25)
        : zone < 0.88
          ? h < 0.5
            ? "#f7d7b6"
            : "#e0b98f"
          : h < 0.5
            ? "#1e293b"
            : "#3b4a61";

  /** Multidão de um anel: manchas de cor (equipa + neutros) com jitter. */
  const crowdDots = (yTop, yBot, seed) => {
    const dots = [];
    // Filas proporcionais à altura útil do anel (o anel de cima dos
    // grandes é mais baixo por causa da faixa de camarotes: 3 filas
    // espremidas ficavam uma banda ilegível).
    const rows = Math.max(2, Math.min(7, Math.round((yBot - yTop - 6) / 8)));
    let k = 0;
    for (let r = 0; r < rows; r += 1) {
      const yBase = yTop + 3 + ((yBot - yTop - 6) * (r + 0.5)) / rows;
      for (let x = standX0 + 4 + (r % 2) * 2.5; x < standX1 - 4; x += crowdStep) {
        // Lugares vazios: thinning determinístico; a claque central esvazia em último.
        const inClaque = Math.abs(x - 400) < claqueHalf;
        const keepP = inClaque ? Math.min(1, moodOcc * 1.5 + 0.2) : moodOcc;
        if (hash01(seed + 999 + k * 4.31) > keepP) {
          k += 1;
          continue;
        }
        const zone = inClaque
          ? hash01(seed + Math.floor(x / 34) * 4.7 + r * 0.8) * 0.5
          : hash01(seed + Math.floor(x / 34) * 4.7 + r * 0.8);
        const fill = crowdFill(zone, hash01(seed + k * 12.9898));
        dots.push(
          <circle
            key={`${seed}-${k}`}
            cx={x + (hash01(seed + k * 3.7) - 0.5) * 2.4}
            cy={yBase + (hash01(seed + k * 9.1) - 0.5) * 1.6}
            r={1.1 + hash01(seed + k * 7.3) * 0.9}
            fill={fill}
            opacity={0.7 + hash01(seed + k * 5.1) * 0.3}
          />,
        );
        k += 1;
      }
    }
    return dots;
  };

  /** Fileiras de assentos (linhas finas) dentro de um anel. */
  const rowLines = (yTop, yBot) => {
    const lines = [];
    for (let y = yTop + 3; y < yBot - 1; y += 3.5) {
      lines.push(
        <line
          key={`row-${y.toFixed(1)}`}
          x1={standX0 + 2}
          x2={standX1 - 2}
          y1={y}
          y2={y}
          stroke="#020617"
          strokeWidth="0.7"
          opacity="0.12"
        />,
      );
    }
    return lines;
  };

  // ── Bancadas laterais ───────────────────────────────────────────
  /** Ganho de perspetiva do fundo (u=0) para a linha de baixo (u=1). */
  const SIDE_NEAR = 3.2;
  /**
   * Ponto da bancada lateral: `sign` −1 esquerda / +1 direita, `u` 0..1 ao
   * longo do campo, `v` 0 (linha lateral) .. 1 (topo; >1 = cobertura).
   */
  const sidePoint = (sign, u, v) => {
    const y = PITCH_TOP + u * PITCH_H;
    const h = sideH * (1 + (SIDE_NEAR - 1) * u);
    return [400 + sign * (pitchHalf(y) + h * 0.45 * v), y - h * v];
  };
  const pts = (list) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const sideRows = sideTier * 2;

  /** Multidão da lateral: filas inclinadas, espaçamento a crescer para a câmara. */
  const sideCrowd = (sign) => {
    const dots = [];
    const seed = sign < 0 ? 5000 : 7000;
    let k = 0;
    for (let r = 0; r < sideRows; r += 1) {
      const v = (r + 0.5) / sideRows;
      for (let u = 0.01 + (r % 2) * 0.01; u < 1; u += 0.022 * (1 + (SIDE_NEAR - 1) * u)) {
        const [x, y] = sidePoint(sign, u, v);
        if (x < -10 || x > W + 10) break;
        if (hash01(seed + 999 + k * 4.31) > moodOcc) {
          k += 1;
          continue;
        }
        const g = 1 + (SIDE_NEAR - 1) * u;
        dots.push(
          <circle
            key={`side-${seed}-${k}`}
            cx={x}
            cy={y}
            r={(1 + hash01(seed + k * 7.3) * 0.8) * g}
            fill={crowdFill(hash01(seed + Math.floor(u * 9) * 4.7 + r * 0.8), hash01(seed + k * 12.9898))}
            opacity={0.7 + hash01(seed + k * 5.1) * 0.3}
          />,
        );
        k += 1;
      }
    }
    return dots;
  };

  // ── Relvado ─────────────────────────────────────────────────────
  const stripePolys = Array.from({ length: STRIPES }, (_, s) => {
    const y0 = stripeTop(s);
    const y1 = stripeTop(s + 1);
    return (
      <path
        key={`stripe-${s}`}
        d={`M ${400 - pitchHalf(y0)} ${y0} L ${400 + pitchHalf(y0)} ${y0} L ${400 + pitchHalf(y1)} ${y1} L ${400 - pitchHalf(y1)} ${y1} Z`}
        fill={s % 2 === 0 ? GRASS_A : GRASS_B}
      />
    );
  });

  const netLines = [];
  for (let dx = -netHalf; dx <= netHalf + 0.001; dx += netHalf / 6) {
    netLines.push(
      <line
        key={`net-v${dx}`}
        x1={400 + dx}
        y1={GOAL_TOP + 3}
        x2={400 + dx}
        y2={GOAL_BOT - 1.5}
        stroke="#f8fafc"
        strokeWidth="0.9"
        opacity="0.35"
      />,
    );
  }
  [153, 159].forEach((y) => {
    netLines.push(
      <line
        key={`net-h${y}`}
        x1={400 - goalHalf(y)}
        y1={y}
        x2={400 + goalHalf(y)}
        y2={y}
        stroke="#f8fafc"
        strokeWidth="0.9"
        opacity="0.3"
      />,
    );
  });

  // ── Cobertura ────────────────────────────────────────────────────
  const canopyD = `M ${roofX0} ${roofBaseY} L ${roofX0} ${roofEdgeY} Q 400 ${roofTopY} ${roofX1} ${roofEdgeY} L ${roofX1} ${roofBaseY} Z`;
  const fasciaD = `M ${roofX0} ${roofEdgeY} Q 400 ${roofTopY} ${roofX1} ${roofEdgeY}`;
  const ribs = Array.from({ length: 9 }, (_, i) =>
    roofX0 + ((i + 0.5) * (roofX1 - roofX0)) / 9,
  ).map((x) => (
    <line
      key={`rib-${Math.round(x)}`}
      x1={x}
      y1={roofBaseY}
      x2={x}
      y2={roofY(x) + 2}
      stroke="#64748b"
      strokeWidth="1.2"
      opacity="0.45"
    />
  ));
  const posts = [0.08, 0.31, 0.69, 0.92].map((f) => standX0 + f * (standX1 - standX0));

  // ── Telão ────────────────────────────────────────────────────────
  // Escala com o corpo e assente dentro do arco da cobertura (o topo
  // acompanha o pico, por isso nos gigantes não o engole).
  const screenW = 128 * bulk;
  const screenH = 26 * bulk;
  const screenX = 400 - screenW / 2;
  const screenTop = roofTopY + 2;
  const screenPadX = 7 * bulk;
  const screenPadTop = 5 * bulk;
  const screenInnerH = 16 * bulk;
  const screenLabel = `${Math.round(cap / 1000)}K`;

  // ── Corrimão e bandeirolas ──────────────────────────────────────
  // As bandeirolas pendem para BAIXO do corrimão, sobre a fila de cima
  // da multidão. Onde há faixa de camarotes (2–3 anéis) descem mais
  // BOX_H: sem isso ficavam desenhadas por cima das janelas.
  const buntY = topY + (boxes && tiers > 1 ? BOX_H : 0);
  const pennants = [];
  if (!bare) {
    for (let x = standX0 + 10; x < standX1 - 8; x += 34) {
      pennants.push(
        <polygon
          key={`pen-${x}`}
          points={`${x},${buntY + 1} ${x + 13},${buntY + 1} ${x + 6.5},${buntY + 8}`}
          fill={Math.round(x / 34) % 2 === 0 ? home : away}
          opacity="0.9"
        />,
      );
    }
  }

  const sideGates = [96, 164, 232, 300, 476, 544, 612, 680].map(
    (x) => 400 + (x - 400) * span,
  );

  // ── Placas LED na base do muro ───────────────────────────────────
  const ledCount = led ? Math.max(8, Math.round((wallX1 - wallX0) / 46)) : 0;
  const ledStep = led ? (wallX1 - wallX0) / ledCount : 0;

  // ── Bandeiras de canto ───────────────────────────────────────────
  const cornerFlags = [400 - farHalf, 400 + farHalf];

  // ── Festa / faroeste (posições determinísticas, estáveis) ────────
  const torches = Array.from({ length: 10 }, (_, t) => ({
    x: Math.max(
      standX0 + 6,
      Math.min(standX1 - 6, 400 + (hash01(t * 3.3 + 5) - 0.5) * claqueHalf * 3.2),
    ),
    y: topY + 14 + hash01(t * 7.7 + 2) * 6,
    dur: 0.28 + hash01(t * 9.4) * 0.3,
    delay: -hash01(t * 4.2) * 0.5,
  }));
  // As bandeiras hasteiam-se à frente da cobertura (o grupo é desenhado
  // depois dela): nos estádios cobertos ficavam escondidas atrás da pala.
  const flags = Array.from({ length: 4 }, (_, f) => ({
    fx: standX0 + ((f + 0.5) / 4) * (standX1 - standX0) + (hash01(f * 6.1 + 1) - 0.5) * 10,
    fy: roofBaseY - 2,
    delay: -hash01(f * 5.5) * 0.9,
    fill: f % 2 === 0 ? home : away,
  }));
  const weedRows = [212, 234];

  const occLabel =
    moodBand === "low"
      ? ", bancada esvaziada"
      : occ >= 0.95
        ? ", bancada cheia"
        : `, ${Math.round(occ * 100)}% de ocupação`;
  const ariaLabel =
    `Estádio com ${cap.toLocaleString("pt-PT")} lugares, ` +
    `${tiers} ${tiers === 1 ? "anel" : "anéis"}${occLabel}` +
    (moodBand === "high" ? ", adeptos em festa" : night ? ", noite de faroeste" : "");

  return (
    <svg
      viewBox={
        close
          ? `${closeX.toFixed(1)} ${closeTop.toFixed(1)} ${closeW.toFixed(1)} ${(H - closeTop).toFixed(1)}`
          : `0 ${frameTop.toFixed(1)} ${W} ${(H - frameTop).toFixed(1)}`
      }
      preserveAspectRatio="xMidYMin slice"
      className={className}
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <linearGradient id={gid("sky")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={SKY[0]} />
          <stop offset="70%" stopColor={SKY[1]} />
          <stop offset="100%" stopColor={SKY[2]} />
        </linearGradient>
        <radialGradient id={gid("sun")}>
          <stop offset="0%" stopColor={night ? "#cbd5e1" : "#fef9c3"} stopOpacity={night ? 0.5 : 0.9} />
          <stop offset="55%" stopColor={night ? "#94a3b8" : "#fde047"} stopOpacity={night ? 0.18 : 0.3} />
          <stop offset="100%" stopColor={night ? "#64748b" : "#fde047"} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={gid("lamp")}>
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={gid("haze")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity={HAZE_OP} />
        </linearGradient>
        <linearGradient id={gid("stand")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={mix(home, night ? "#334155" : "#1b2438", night ? 0.45 : 0.66)} />
          <stop offset="100%" stopColor={mix(home, "#0b1220", 0.9)} />
        </linearGradient>
        <linearGradient id={gid("endcap")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={shade(home, -0.42)} />
          <stop offset="100%" stopColor={shade(home, -0.72)} />
        </linearGradient>
        <linearGradient id={gid("roof")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ROOF_HI} />
          <stop offset="100%" stopColor={ROOF_LO} />
        </linearGradient>
        <linearGradient id={gid("concrete")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={CONCRETE_HI} />
          <stop offset="100%" stopColor={CONCRETE_LO} />
        </linearGradient>
        <linearGradient id={gid("led")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.18" />
        </linearGradient>
        <linearGradient id={gid("pitchDepth")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.2" />
          <stop offset="45%" stopColor="#000000" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={gid("standShadow")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.24" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={gid("sheen")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={gid("screenGlow")}>
          <stop offset="0%" stopColor={home} stopOpacity="0.4" />
          <stop offset="100%" stopColor={home} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={gid("stripShade")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.18" />
        </linearGradient>
        <radialGradient id={gid("vignette")} cx="50%" cy="42%" r="75%">
          <stop offset="55%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity={night ? 0.3 : 0.12} />
        </radialGradient>
        <clipPath id={gid("pitchClip")}>
          <polygon points={`${400 - farHalf},${PITCH_TOP} ${400 + farHalf},${PITCH_TOP} ${W},${PITCH_BOT} 0,${PITCH_BOT}`} />
        </clipPath>
        <filter id={gid("blur")}>
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
      </defs>

      {/* Céu diurno / nocturno */}
      <rect x="0" y="0" width={W} height={H} fill={url("sky")} />
      {/* Sol (ou lua) com halo */}
      <circle cx={688} cy={SUN_CY} r={30} fill={url("sun")} />
      <circle cx={688} cy={SUN_CY} r={12} fill={night ? "#e2e8f0" : "#fde047"} opacity="0.95" />
      {/* Nuvens (suaves) */}
      <g fill={CLOUD} opacity={CLOUD_OP} filter={url("blur")}>
        <ellipse cx={140} cy={66} rx={36} ry={10} />
        <ellipse cx={168} cy={60} rx={24} ry={8} />
        <ellipse cx={430} cy={62} rx={30} ry={8} />
        <ellipse cx={452} cy={57} rx={20} ry={7} />
        <ellipse cx={620} cy={72} rx={26} ry={7} />
      </g>
      {/* Colinas ao longe (silhuetas com base escondida atrás do recinto) + haze */}
      <path d="M -20 164 Q 130 76 280 164 Z" fill={HILL_FAR} opacity={HILL_OP} />
      <path d="M 520 164 Q 690 74 820 164 Z" fill={HILL_GREEN_FAR} opacity={HILL_OP} />
      <path d="M -20 164 Q 130 88 280 164 Z" fill={HILL_NEAR} opacity={HILL_OP_NEAR} />
      <path d="M 520 164 Q 690 88 820 164 Z" fill={HILL_GREEN} opacity={HILL_OP_NEAR} />
      <rect x="0" y="64" width={W} height="32" fill={url("haze")} />

      {/* Torres de luz baixas (só nos pequenos com cobertura por fazer,
          sem o pelado) — mais baixas e junto às bancadas, à escala.
          À noite acendem (o brilho é o que se vê). */}
      {!roofed && !bare &&
        [standX0 - CAP_INSET - 4, standX1 + CAP_INSET + 4].map((x) => (
          <g key={`light-${Math.round(x)}`}>
            <rect x={x - 3} y={poleTop} width={6} height={PITCH_TOP - poleTop} fill="#475569" />
            <rect x={x - 28} y={poleTop - 22} width={56} height={22} rx={3} fill="#1e293b" stroke={away} strokeOpacity="0.5" />
            {[-18, -6, 6, 18].map((dx) => (
              <g key={`lamp-${dx}`}>
                <circle cx={x + dx} cy={poleTop - 11} r={10} fill={url("lamp")} opacity={night ? 0.9 : 0.5} />
                <circle cx={x + dx} cy={poleTop - 11} r={5} fill={night ? "#fef9c3" : "#e2e8f0"} stroke="#64748b" strokeWidth="1" />
              </g>
            ))}
          </g>
        ))}

      {/* Anéis (ondulam em conjunto no mood alto) + tochas da claque */}
      <g
        className={moodBand === "high" ? "stadium-sway" : undefined}
        style={moodBand === "high" ? { animationDuration: "1.15s" } : undefined}
      >
        {Array.from({ length: tiers }).map((_, i) => {
          const boxTop = tierTop(i);
          const seatTop = boxTop + (boxes && i >= 1 ? BOX_H : 0);
          const seatBottom = i === 0 ? WALL_TOP : tierTop(i - 1);
          const boxCount = Math.max(10, Math.round((standX1 - standX0) / 28));
          return (
            <g key={`tier-${i}`}>
              {/* Faces laterais (profundidade; os pequenos são planos) */}
              {!noCaps && (
                <>
                  <polygon
                    points={`${standX0},${seatTop} ${standX0 - CAP_INSET},${seatTop - 6} ${standX0 - CAP_INSET},${seatBottom + 8} ${standX0},${seatBottom}`}
                    fill={url("endcap")}
                  />
                  <polygon
                    points={`${standX1},${seatTop} ${standX1 + CAP_INSET},${seatTop - 6} ${standX1 + CAP_INSET},${seatBottom + 8} ${standX1},${seatBottom}`}
                    fill={url("endcap")}
                  />
                </>
              )}
              {/* Faixa de camarotes por baixo dos anéis superiores */}
              {boxes && i >= 1 && (
                <g>
                  <rect x={standX0} y={boxTop} width={standX1 - standX0} height={BOX_H} fill="#0f172a" stroke={away} strokeOpacity="0.45" />
                  {Array.from({ length: boxCount }).map((__, w) => (
                    <rect
                      key={`box-${i}-${w}`}
                      x={standX0 + 12 + (w * (standX1 - standX0 - 40)) / (boxCount - 1)}
                      y={boxTop + 2}
                      width={16}
                      height={BOX_H - 4}
                      fill="#cfe4f7"
                      stroke="#0f172a"
                      strokeOpacity="0.5"
                      opacity={0.6 + hash01(i * 91 + w * 7) * 0.35}
                    />
                  ))}
                </g>
              )}
              {/* Assentos */}
              <rect
                x={standX0}
                y={seatTop}
                width={standX1 - standX0}
                height={seatBottom - seatTop}
                fill={url("stand")}
                stroke="#020617"
                strokeOpacity="0.35"
                strokeWidth="1.5"
              />
              {rowLines(seatTop, seatBottom)}
              {crowdDots(seatTop, seatBottom, 100 + i * 1000)}
              {/* Vomitórios: escadas que dividem a bancada em setores */}
              {Array.from({ length: aisleCount }, (_, a) => (a + 1) / (aisleCount + 1)).map((f) => {
                const ax = standX0 + f * (standX1 - standX0);
                return (
                  <g key={`aisle-${i}-${f}`}>
                    <rect x={ax - 3.5} y={seatTop} width={7} height={seatBottom - seatTop} fill="#0b1220" opacity="0.9" />
                    <line x1={ax} y1={seatTop + 1} x2={ax} y2={seatBottom - 1} stroke="#475569" strokeWidth="1" strokeDasharray="2 2" opacity="0.8" />
                  </g>
                );
              })}
              {/* Passadeira de betão entre anéis + sombra ambiente */}
              <rect x={standX0 - capIn} y={seatBottom - 3} width={standX1 - standX0 + capIn * 2} height={6} fill={url("concrete")} opacity="0.9" />
              <rect x={standX0 - capIn} y={seatBottom + 1} width={standX1 - standX0 + capIn * 2} height={2.5} fill="#000000" opacity="0.2" />
            </g>
          );
        })}

        {/* Tochas na claque (mood alto) */}
        {moodBand === "high" &&
          torches.map((t, i) => (
            <g
              key={`torch-${i}`}
              className="stadium-flicker"
              style={{ animationDuration: `${t.dur.toFixed(2)}s`, animationDelay: `${t.delay.toFixed(2)}s` }}
            >
              <line x1={t.x} y1={t.y} x2={t.x} y2={t.y + 7} stroke="#713f12" strokeWidth="1.6" />
              <circle cx={t.x} cy={t.y} r={7} fill={home} opacity="0.25" />
              <circle cx={t.x} cy={t.y} r={3} fill="#f97316" opacity="0.9" />
              <circle cx={t.x} cy={t.y - 0.5} r={1.5} fill="#fde047" />
            </g>
          ))}
      </g>

      {/* Corrimão do topo + bandeirolas (o pelado não tem) */}
      {!bare && (
        <g>
          <rect x={wallX0} y={topY - 2} width={wallX1 - wallX0} height={3} fill={away} opacity="0.9" />
          {pennants}
        </g>
      )}

      {/* Muro base com portões */}
      <rect x={wallX0} y={WALL_TOP} width={wallX1 - wallX0} height={PITCH_TOP - WALL_TOP} fill={url("concrete")} />
      <rect x={wallX0} y={WALL_TOP} width={wallX1 - wallX0} height={4} fill={home} opacity="0.95" />
      <path d={gatePath(372, 56, WALL_TOP + 4, PITCH_TOP)} fill="#0f172a" opacity="0.92" stroke="#e2e8f0" strokeOpacity="0.25" />
      {!bare &&
        sideGates.map((x) => (
          <path key={`gate-${Math.round(x)}`} d={gatePath(x, 22, WALL_TOP + 7, PITCH_TOP)} fill="#0f172a" opacity="0.85" />
        ))}

      {/* Placas LED (publicidade de perimeter) na base do muro */}
      {led && (
        <g>
          <rect x={wallX0} y={PITCH_TOP - 11} width={wallX1 - wallX0} height={9} fill="#0b1220" />
          {Array.from({ length: ledCount }).map((_, b) => (
            <rect
              key={`led-${b}`}
              x={wallX0 + b * ledStep + 1.5}
              y={PITCH_TOP - 9.5}
              width={ledStep - 3}
              height={6}
              fill={b % 2 === 0 ? home : away}
              opacity="0.92"
            />
          ))}
          <rect x={wallX0} y={PITCH_TOP - 11} width={wallX1 - wallX0} height={9} fill={url("led")} />
        </g>
      )}

      {/* Cobertura */}
      {roofed && (
        <g>
          {/* postes de suporte (à largura da bancada, não do canvas) */}
          {posts.map((x) => (
            <rect key={`post-${Math.round(x)}`} x={x - 2.5} y={roofBaseY} width={5} height={topY - roofBaseY} fill="#64748b" />
          ))}
          {/* Pala superior curvada */}
          <path d={canopyD} fill={url("roof")} stroke="#64748b" strokeOpacity="0.4" strokeWidth="1.5" />
          {ribs}
          {/* Testeira com a cor do clube, a acompanhar o arco */}
          <path d={fasciaD} fill="none" stroke={home} strokeWidth={colossal ? 12 : grandRoof ? 9 : 7} opacity="0.95" />
          <path d={fasciaD} fill="none" stroke={shade(home, 0.3)} strokeWidth={colossal ? 2.5 : grandRoof ? 2 : 1.5} opacity="0.6" />
        </g>
      )}

      {/* Telão assente na cobertura (só nos grandes) */}
      {screen && (
        <g>
          <ellipse cx={400} cy={screenTop + screenH / 2} rx={95 * bulk} ry={30 * bulk} fill={url("screenGlow")} />
          <rect x={screenX} y={screenTop} width={screenW} height={screenH} rx={4} fill="#0f172a" stroke={away} strokeOpacity="0.7" strokeWidth="2" />
          <rect x={screenX + screenPadX} y={screenTop + screenPadTop} width={screenW - screenPadX * 2} height={screenInnerH} rx={2} fill={home} opacity="0.95" />
          <rect x={screenX + screenPadX} y={screenTop + screenPadTop} width={screenW - screenPadX * 2} height={screenInnerH} rx={2} fill={url("sheen")} />
          <text x={400} y={screenTop + screenPadTop + screenInnerH - 4.5 * bulk} textAnchor="middle" fontSize={11 * bulk} fontWeight="900" fill="#020617">
            {screenLabel}
          </text>
        </g>
      )}

      {/* ── Festa: bandeiras à frente da cobertura (só mood em alta) ── */}
      {moodBand === "high" &&
        flags.map((f, i) => (
          <g key={`flag-${i}`}>
            <line x1={f.fx} y1={f.fy} x2={f.fx} y2={f.fy - 30} stroke="#cbd5e1" strokeWidth="2" />
            <g className="stadium-flag-wave" style={{ animationDelay: `${f.delay.toFixed(2)}s` }}>
              <polygon
                points={`${f.fx},${f.fy - 30} ${f.fx + 24},${f.fy - 25} ${f.fx},${f.fy - 19}`}
                fill={f.fill}
                opacity="0.95"
              />
            </g>
          </g>
        ))}

      {/* Relvado em primeiro plano, a recuar para a linha frontal */}
      <rect x="0" y={PITCH_TOP} width={W} height={PITCH_H} fill={GRASS_BASE} />
      {stripePolys}
      <rect x="0" y={PITCH_TOP} width={W} height={PITCH_H} fill={url("pitchDepth")} />
      {/* Bancadas laterais (mesma ondulação que os anéis no mood alto) */}
      {sideTier > 0 && (
        <g
          className={moodBand === "high" ? "stadium-sway" : undefined}
          style={moodBand === "high" ? { animationDuration: "1.15s" } : undefined}
        >
          {[-1, 1].map((sign) => (
            <g key={`side-${sign}`}>
              <polygon
                points={pts([sidePoint(sign, 0, 0), sidePoint(sign, 1, 0), sidePoint(sign, 1, 1), sidePoint(sign, 0, 1)])}
                fill={url("stand")}
                stroke="#020617"
                strokeOpacity="0.35"
                strokeWidth="1.5"
              />
              {Array.from({ length: sideRows - 1 }, (_, r) => (r + 1) / sideRows).map((v) => (
                <line
                  key={`srow-${v}`}
                  x1={sidePoint(sign, 0, v)[0]}
                  y1={sidePoint(sign, 0, v)[1]}
                  x2={sidePoint(sign, 1, v)[0]}
                  y2={sidePoint(sign, 1, v)[1]}
                  stroke="#020617"
                  strokeWidth="0.8"
                  opacity="0.18"
                />
              ))}
              {sideCrowd(sign)}
              {/* Cobertura lateral nos grandes */}
              {sideTier >= 3 && (
                <polygon
                  points={pts([sidePoint(sign, 0, 1), sidePoint(sign, 1, 1), sidePoint(sign, 1, 1.3), sidePoint(sign, 0, 1.3)])}
                  fill={url("roof")}
                  stroke="#64748b"
                  strokeOpacity="0.4"
                />
              )}
              {/* Corrimão (cor do clube) e muro junto à linha lateral */}
              <line
                x1={sidePoint(sign, 0, 1)[0]}
                y1={sidePoint(sign, 0, 1)[1]}
                x2={sidePoint(sign, 1, 1)[0]}
                y2={sidePoint(sign, 1, 1)[1]}
                stroke={away}
                strokeWidth="2.5"
                opacity="0.9"
              />
              <line
                x1={sidePoint(sign, 0, 0)[0]}
                y1={PITCH_TOP}
                x2={sidePoint(sign, 1, 0)[0]}
                y2={PITCH_BOT}
                stroke={CONCRETE_HI}
                strokeWidth="3"
              />
            </g>
          ))}
        </g>
      )}
      {/* Poças de luz dos focos (só à noite) */}
      {night &&
        [210, 400, 590].map((x) => (
          <ellipse key={`pool-${x}`} cx={x} cy={202} rx={130} ry={40} fill={url("lamp")} opacity="0.45" />
        ))}
      {/* Sombra das bancadas projetada no relvado */}
      <rect x={400 - farHalf} y={PITCH_TOP} width={farHalf * 2} height={18} fill={url("standShadow")} />
      {/* Linha de fundo = bordo real do relvado (nos pequenos o muro é
          mais estreito que o campo; a linha tem de acompanhar o campo) */}
      <line x1={400 - farHalf} y1={PITCH_TOP + 1.5} x2={400 + farHalf} y2={PITCH_TOP + 1.5} stroke="#f8fafc" strokeWidth="1.8" opacity="0.85" />
      {/* Baliza na linha frontal (emolduramento + rede) */}
      <g>
        <polygon
          points={`${400 - goalHalfTop},${GOAL_TOP} ${400 + goalHalfTop},${GOAL_TOP} ${400 + goalHalfBot},${GOAL_BOT} ${400 - goalHalfBot},${GOAL_BOT}`}
          fill="#ffffff"
          opacity="0.07"
        />
        {netLines}
        <line x1={400 - goalHalfBot} y1={GOAL_BOT} x2={400 - goalHalfTop} y2={GOAL_TOP} stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" />
        <line x1={400 + goalHalfBot} y1={GOAL_BOT} x2={400 + goalHalfTop} y2={GOAL_TOP} stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" />
        <line x1={400 - goalHalfTop} y1={GOAL_TOP} x2={400 + goalHalfTop} y2={GOAL_TOP} stroke="#f8fafc" strokeWidth="3.5" strokeLinecap="round" />
      </g>
      {/* Bandeiras de canto */}
      {cornerFlags.map((x) => (
        <g key={`corner-${x}`}>
          <rect x={x - 0.75} y={PITCH_TOP - 15} width={1.5} height={15} fill="#e2e8f0" />
          <polygon
            points={`${x},${PITCH_TOP - 15} ${x + 9},${PITCH_TOP - 11.5} ${x},${PITCH_TOP - 8}`}
            fill={x < 400 ? home : away}
          />
        </g>
      ))}
      {/* ── Faroeste: rolos de palha no relvado (só mood em baixo) ── */}
      {moodBand === "low" && (
        // Recortados ao relvado: não rolam por cima das bancadas laterais.
        <g clipPath={url("pitchClip")}>
        {weedRows.map((wy, w) => (
          <g key={`weed-${w}`} className={`stadium-weed stadium-weed-${w}`}>
            {/* Posição de repouso no meio do relvado: com movimento
                reduzido a animação não corre e o rolo tinha de ficar
                cortado a meio na margem esquerda. */}
            <g transform={`translate(${280 + w * 240} ${wy})`}>
              <circle cx={0} cy={0} r={11} fill="none" stroke="#cbb37e" strokeWidth="2.6" opacity="0.95" />
              <circle cx={0} cy={0} r={7} fill="none" stroke="#e2d3a3" strokeWidth="2" opacity="0.9" />
              <path
                d="M -11 0 H 11 M 0 -11 V 11 M -8 -8 L 8 8 M -8 8 L 8 -8"
                stroke="#a98f5f"
                strokeWidth="1.8"
                opacity="0.85"
              />
            </g>
          </g>
        ))}
        </g>
      )}

      {/* Linha de meio-campo + círculo central */}
      <line x1={400 - pitchHalf(212)} y1="212" x2={400 + pitchHalf(212)} y2="212" stroke="#f8fafc" strokeWidth="1.8" opacity="0.7" />
      <ellipse cx={400} cy={212} rx={52} ry={11} fill="none" stroke="#f8fafc" strokeWidth="1.8" opacity="0.8" />
      <circle cx={400} cy={212} r={2.5} fill="#f8fafc" opacity="0.9" />

      {/* Faixa inferior com as cores do clube */}
      <rect x="0" y={PITCH_BOT} width={W} height={H - PITCH_BOT} fill={home} />
      <rect x="0" y={PITCH_BOT} width={W} height={H - PITCH_BOT} fill={url("stripShade")} />
      <rect x="0" y={PITCH_BOT} width={W} height={4} fill={away} opacity="0.85" />

      {/* Vignette subtil de transmissão */}
      <rect x="0" y="0" width={W} height={H} fill={url("vignette")} />
    </svg>
  );
});
