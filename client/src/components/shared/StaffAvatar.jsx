import { memo } from "react";
import { AVATAR_SIZE_MAP } from "./avatarSizes.js";

/**
 * StaffAvatar.jsx — caricaturas dos funcionários do clube.
 *
 * Linha do treinador-adjunto (`docs/jj1.png` → `public/coaches/jj-*.webp`):
 * traço fino escuro, cores planas sem gradientes, olhos ovais brancos enormes
 * com pupila pequena, busto de braços cruzados. Sem RNG: cada papel tem sempre
 * a mesma cara (pele, cabelo e cor de roupa fixos), para o jogador reconhecer
 * o médico dele de uma semana para a outra.
 *
 * O nível dá o ADEREÇO (escalões 1-2 / 3-4 / 5) — a cara é do papel, os
 * adereços contam a subida de nível. Papel que o servidor acrescente antes de
 * o cliente o conhecer cai no boneco genérico «Funcionário».
 */

const OUTLINE = "#151a24";
const OW = 1.6;

const SKIN = {
  light: { base: "#f3c9a4", shadow: "#d09b78" },
  tan: { base: "#dca877", shadow: "#b0784a" },
  mid: { base: "#b57a4e", shadow: "#8a5530" },
  dark: { base: "#8a5a3a", shadow: "#5f3a22" },
};

const HAIR = {
  darkBrown: { base: "#3a2318", shine: "#5c3a26" },
  black: { base: "#1a1614", shine: "#3a3230" },
  blond: { base: "#c9a85a", shine: "#e6d08e" },
  grey: { base: "#b9bec6", shine: "#d8dce2" },
  curly: { base: "#1d1718", shine: "#3c302c" },
};

const ROLE_LOOK = {
  auxiliar: {
    bg: "#14251d",
    accent: "#3f8f63",
    skin: SKIN.tan,
    hair: HAIR.darkBrown,
    cloth: { base: "#1f5c46", dark: "#17452f", light: "#2a7355" },
    collar: "zip",
  },
  fisico: {
    bg: "#2a2115",
    accent: "#e08a3c",
    skin: SKIN.mid,
    hair: HAIR.black,
    cloth: { base: "#c96a22", dark: "#a04f14", light: "#e08434" },
    collar: "crew",
    beard: "stubble",
  },
  comunicacao: {
    bg: "#16202f",
    accent: "#5b8fd6",
    skin: SKIN.light,
    hair: HAIR.blond,
    cloth: { base: "#3b6ea5", dark: "#2a527c", light: "#4f83bb" },
    collar: "shirt",
  },
  medico: {
    bg: "#14262b",
    accent: "#4fb3c4",
    skin: SKIN.dark,
    hair: HAIR.curly,
    cloth: { base: "#eef2f7", dark: "#c6d1dd", light: "#ffffff" },
    collar: "coat",
    scrub: "#2b7f8e",
    beard: "short",
  },
  _default: {
    bg: "#1d2129",
    accent: "#8b93a1",
    skin: SKIN.mid,
    hair: HAIR.grey,
    cloth: { base: "#6b7280", dark: "#4d545e", light: "#7d8593" },
    collar: "polo",
  },
};

/**
 * Escalão do funcionário a partir do nível (1-2 / 3-4 / 5) — o que decide os
 * adereços. Nível fora dos limites conta como 1.
 * @param {number} level Nível 1..5
 * @returns {1|2|3} Escalão
 */
function staffTier(level) {
  const n = Number(level) || 1;
  if (n >= 5) return 3;
  if (n >= 3) return 2;
  return 1;
}

/* ── Cabeça e cara (iguais em todos os papéis; muda pele, cabelo e barba) ── */

// Cabeça: oval alto com bochechas largas e queixo redondo (8 → 72 de altura).
const HEAD =
  "M60 8 C47 8 39 15 37 26 C35 37 34 46 36 54 C38 64 47 72 60 72 C73 72 82 64 84 54 C86 46 85 37 83 26 C81 15 73 8 60 8 Z";

function Face({ skin, hair }) {
  return (
    <g>
      {/* Pescoço (o tronco cobre-o depois) */}
      <path
        d="M50 64 L50 78 L70 78 L70 64 Z"
        fill={skin.shadow}
        stroke={OUTLINE}
        strokeWidth={OW}
      />
      <path d={HEAD} fill={skin.base} stroke={OUTLINE} strokeWidth={OW + 0.2} />
      {/* Orelhas */}
      <path
        d="M38 37 C33 35 31 41 32 46 C33 51 36 53 39 52"
        fill={skin.base}
        stroke={OUTLINE}
        strokeWidth={OW}
      />
      <path d="M34 42 C36 43 37 45 37 47" fill="none" stroke={skin.shadow} strokeWidth="1.1" />
      <path
        d="M82 37 C87 35 89 41 88 46 C87 51 84 53 81 52"
        fill={skin.base}
        stroke={OUTLINE}
        strokeWidth={OW}
      />
      <path d="M86 42 C84 43 83 45 83 47" fill="none" stroke={skin.shadow} strokeWidth="1.1" />
      {/* Olhos: dois ovais brancos enormes com pupila pequena */}
      <ellipse cx="49.5" cy="36.5" rx="8" ry="9.2" fill="#fdfdfd" stroke={OUTLINE} strokeWidth={OW} />
      <ellipse cx="70.5" cy="36.5" rx="8" ry="9.2" fill="#fdfdfd" stroke={OUTLINE} strokeWidth={OW} />
      <circle cx="50.7" cy="39" r="2.3" fill={OUTLINE} />
      <circle cx="69.3" cy="39" r="2.3" fill={OUTLINE} />
      {/* Pálpebras carregadas (a marca do estilo) */}
      <path
        d="M42 30.4 C45.6 27.2 52.6 26.4 56.6 28.8"
        fill="none"
        stroke={OUTLINE}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M78 30.4 C74.4 27.2 67.4 26.4 63.4 28.8"
        fill="none"
        stroke={OUTLINE}
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Olheiras */}
      <path
        d="M42.8 45.2 C46.6 48.2 52.8 48.2 56.2 45.2"
        fill="none"
        stroke={skin.shadow}
        strokeWidth="1.2"
      />
      <path
        d="M77.2 45.2 C73.4 48.2 67.2 48.2 63.8 45.2"
        fill="none"
        stroke={skin.shadow}
        strokeWidth="1.2"
      />
      {/* Sobrancelhas (cor do cabelo) */}
      <path
        d="M41.6 23.6 C46.4 20.4 53.2 20.2 57.4 22.4"
        fill="none"
        stroke={hair.base}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M78.4 23.6 C73.6 20.4 66.8 20.2 62.6 22.4"
        fill="none"
        stroke={hair.base}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      {/* Nariz: linha longa com gancho */}
      <path
        d="M60 29 L60 49 C60 53 58 55 55 55"
        fill="none"
        stroke={OUTLINE}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M52.8 54.4 C54.8 55.6 57.4 55.4 59 54.2"
        fill="none"
        stroke={OUTLINE}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {/* Sulcos do nariz para a boca (cara de mau) */}
      <path
        d="M47.8 50.4 C46.8 55.6 48.2 60 50.8 62.6"
        fill="none"
        stroke={skin.shadow}
        strokeWidth="1.1"
      />
      <path
        d="M72.2 50.4 C73.2 55.6 71.8 60 69.2 62.6"
        fill="none"
        stroke={skin.shadow}
        strokeWidth="1.1"
      />
      {/* Boca (∩ = carranca) */}
      <path
        d="M50.4 64.4 C55 60.8 65 60.8 69.6 64.4"
        fill="none"
        stroke={OUTLINE}
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M54.4 69.8 C57.6 72.4 62.4 72.4 65.6 69.8"
        fill="none"
        stroke={skin.shadow}
        strokeWidth="1.1"
      />
    </g>
  );
}

/* ── Cabelo ─────────────────────────────────────────────────────────────── */

// Capa base: cobre o crânio e desce até às têmporas.
const CAP =
  "M36 28 C34 12 46 2 60 2 C74 2 86 12 84 28 C83 20 79 14 73 12 C67 16 53 16 47 12 C41 14 37 20 36 28 Z";

function Hair({ look }) {
  const { hair, skin } = look;
  if (look.hair === HAIR.blond) {
    // Risco ao lado: uma onda sobre a testa e o cabelo atrás da orelha
    return (
      <g>
        <path d={CAP} fill={hair.base} stroke={OUTLINE} strokeWidth={OW} />
        <path
          d="M38 30 C36 20 42 10 54 6 C50 12 48 20 49 27 C46 30 41 31 38 30 Z"
          fill={hair.base}
          stroke={OUTLINE}
          strokeWidth="1.3"
        />
        <path
          d="M64 6 C74 10 84 20 85 32 C86 38 85 42 84 46 C82 38 79 30 74 24 Z"
          fill={hair.base}
          stroke={OUTLINE}
          strokeWidth="1.3"
        />
        <path
          d="M44 12 C50 7 58 6 65 7 C58 9 50 11 46 15 Z"
          fill={hair.shine}
          stroke="none"
        />
      </g>
    );
  }
  if (look.hair === HAIR.curly) {
    // Carapinha: caracóis em círculos no contorno do crânio
    return (
      <g>
        <path d={CAP} fill={hair.base} stroke={OUTLINE} strokeWidth={OW} />
        {[
          [43, 11, 7],
          [55, 6, 7.4],
          [68, 7, 6.8],
          [79, 14, 6.4],
          [37, 21, 6],
          [84, 22, 5.8],
        ].map(([cx, cy, r]) => (
          <circle
            key={`${cx}-${cy}`}
            cx={cx}
            cy={cy}
            r={r}
            fill={hair.base}
            stroke={OUTLINE}
            strokeWidth="1.3"
          />
        ))}
        <path
          d="M48 9 C54 5 62 4 68 6 C61 7 54 8 50 11 Z"
          fill={hair.shine}
          stroke="none"
        />
      </g>
    );
  }
  if (look.hair === HAIR.grey) {
    // Grisalho: capa lisa com um tufo ao lado
    return (
      <g>
        <path d={CAP} fill={hair.base} stroke={OUTLINE} strokeWidth={OW} />
        <path
          d="M40 26 C36 18 40 8 50 4 C46 10 45 17 47 23 Z"
          fill={hair.base}
          stroke={OUTLINE}
          strokeWidth="1.3"
        />
        <path
          d="M46 10 C52 6 60 5 67 7 C59 8 52 10 48 13 Z"
          fill={hair.shine}
          stroke="none"
        />
      </g>
    );
  }
  if (look.hair === HAIR.black) {
    // Curto e rente, com risco ao lado
    return (
      <g>
        <path d={CAP} fill={hair.base} stroke={OUTLINE} strokeWidth={OW} />
        <path
          d="M38 28 C37 17 45 8 60 8 C75 8 84 17 83 28 C81 20 77 15 71 13 C63 16 51 16 45 14 C40 16 39 22 38 28 Z"
          fill={hair.base}
          stroke={OUTLINE}
          strokeWidth="1.3"
        />
        <path d="M60 9 C68 10 76 15 79 22" fill="none" stroke={hair.shine} strokeWidth="1.6" />
      </g>
    );
  }
  // Escuro despenteado (auxiliar): capa + três tufos
  return (
    <g>
      <path d={CAP} fill={hair.base} stroke={OUTLINE} strokeWidth={OW} />
      <path
        d="M40 22 C35 14 38 5 45 1 C44 8 46 14 49 17 Z"
        fill={hair.base}
        stroke={OUTLINE}
        strokeWidth="1.3"
      />
      <path
        d="M58 3 C60 -3 67 -4 71 0 C67 3 64 8 63 12 Z"
        fill={hair.base}
        stroke={OUTLINE}
        strokeWidth="1.3"
      />
      <path
        d="M78 10 C84 6 90 11 89 17 C85 15 81 16 79 19 Z"
        fill={hair.base}
        stroke={OUTLINE}
        strokeWidth="1.3"
      />
      <path d="M45 12 C51 6 60 4 68 6 C60 7 52 9 47 14 Z" fill={hair.shine} stroke="none" />
      <path d="M38 26 C42 29 44 33 44 37" fill="none" stroke={OUTLINE} strokeWidth="1.2" />
      <path d="M82 26 C78 29 76 33 76 37" fill="none" stroke={OUTLINE} strokeWidth="1.2" />
      <path d="M60 12 L60 18" fill="none" stroke={skin.shadow} strokeWidth="1" />
    </g>
  );
}

/* ── Barba ──────────────────────────────────────────────────────────────── */

function Beard({ look }) {
  const { hair } = look;
  if (look.beard === "short") {
    // Barba curta: faixa ao longo do maxilar (mais clara que o cabelo, para
    // não tapar a boca nem o queixo) + bigode fino por cima da boca.
    return (
      <g>
        <path
          d="M48.6 48 C47 58 53 66 60 66 C67 66 73 58 71.4 48"
          fill="none"
          stroke="#3d2c26"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M53.6 57.4 C56 55.8 64 55.8 66.4 57.4 C64 59.2 56 59.2 53.6 57.4 Z"
          fill="#3d2c26"
          stroke={OUTLINE}
          strokeWidth="0.9"
        />
      </g>
    );
  }
  if (look.beard === "stubble") {
    return (
      <path
        d="M48 47 C46 58 52 67 60 67 C68 67 74 58 72 47"
        fill="none"
        stroke={hair.base}
        strokeWidth="4.4"
        strokeLinecap="round"
        opacity="0.2"
      />
    );
  }
  return null;
}

/* ── Tronco, gola e roupa ───────────────────────────────────────────────── */

const TORSO =
  "M50 66 C38 70 24 77 18 87 C14 94 12 102 12 121 L108 121 C108 102 106 94 102 87 C96 77 82 70 70 66 Z";

function Clothing({ look, tier }) {
  const { cloth, collar, skin } = look;
  return (
    <g>
      <path d={TORSO} fill={cloth.base} stroke={OUTLINE} strokeWidth={OW + 0.2} />
      {collar === "zip" && (
        <g>
          <path
            d="M50 65 C50 74 53 79 60 83 C67 79 70 74 70 65"
            fill={cloth.dark}
            stroke={OUTLINE}
            strokeWidth={OW}
          />
          <path d="M60 83 L60 121" fill="none" stroke={OUTLINE} strokeWidth="1.3" />
          <rect
            x="57.6"
            y="85"
            width="4.8"
            height="6"
            rx="1.4"
            fill="#9aa3ad"
            stroke={OUTLINE}
            strokeWidth="1"
          />
        </g>
      )}
      {collar === "crew" && (
        <g>
          <path d="M49 65 C53 75 67 75 71 65" fill={skin.shadow} stroke={OUTLINE} strokeWidth="1.4" />
          <path d="M45 67 C51 79 69 79 75 67" fill="none" stroke={OUTLINE} strokeWidth="1.3" />
        </g>
      )}
      {collar === "shirt" && (
        <g>
          <path d="M50 65 L60 83 L52 92 L43 74 Z" fill={cloth.light} stroke={OUTLINE} strokeWidth="1.3" />
          <path d="M70 65 L60 83 L68 92 L77 74 Z" fill={cloth.light} stroke={OUTLINE} strokeWidth="1.3" />
          <path d="M56.6 79 L63.4 79 L62.4 85 L57.6 85 Z" fill="#8f2320" stroke={OUTLINE} strokeWidth="1.2" />
          <path d="M60 85 L64.4 89 L60 105 L55.6 89 Z" fill="#b32b2b" stroke={OUTLINE} strokeWidth="1.2" />
        </g>
      )}
      {collar === "coat" && (
        <g>
          <path d="M50 65 L60 82 L50 94 L41 72 Z" fill={cloth.light} stroke={OUTLINE} strokeWidth="1.3" />
          <path d="M70 65 L60 82 L70 94 L79 72 Z" fill={cloth.light} stroke={OUTLINE} strokeWidth="1.3" />
          <path
            d="M48 66 C52 78 68 78 72 66 L68 92 L52 92 Z"
            fill={look.scrub}
            stroke={OUTLINE}
            strokeWidth="1.2"
          />
          <path d="M60 82 L60 121" fill="none" stroke={OUTLINE} strokeWidth="1" opacity="0.45" />
        </g>
      )}
      {collar === "polo" && (
        <g>
          <path d="M50 65 L60 77 L70 65 L74 70 L60 83 L46 70 Z" fill={cloth.dark} stroke={OUTLINE} strokeWidth="1.2" />
        </g>
      )}
      {/* Colete do preparador físico (escalão 3) — por baixo dos braços */}
      {look.collar === "crew" && tier >= 3 && (
        <g>
          <path
            d="M44 68 L39 121 L81 121 L76 68 C70 77 50 77 44 68 Z"
            fill="#2f3a46"
            stroke={OUTLINE}
            strokeWidth={OW}
          />
          <path d="M44 68 C50 77 70 77 76 68" fill="none" stroke="#c8d2dd" strokeWidth="1.4" />
          <path d="M41 92 L79 92" fill="none" stroke="#c8d2dd" strokeWidth="3" opacity="0.7" />
        </g>
      )}
      {/* Toalha ao pescoço (preparador físico, escalão 2+) — fica SOB os braços
          cruzados: as pontas caem no peito e o cruzamento tapa-lhes o resto. */}
      {look.collar === "crew" && tier >= 2 && (
        <g>
          <path
            d="M40 68 C48 82 72 82 80 68 C83 75 81 82 75 86 L45 86 C39 82 37 75 40 68 Z"
            fill="#eef1f5"
            stroke={OUTLINE}
            strokeWidth="1.4"
          />
          <path d="M40 74 C48 88 72 88 80 74" fill="none" stroke="#9aa3ad" strokeWidth="1.5" />
          <path d="M47 84 L43 106 L54 108 L54 84 Z" fill="#dde2e8" stroke={OUTLINE} strokeWidth="1.3" />
          <path d="M73 84 L77 106 L66 108 L66 84 Z" fill="#dde2e8" stroke={OUTLINE} strokeWidth="1.3" />
        </g>
      )}
    </g>
  );
}

/* ── Braços cruzados (a pose do adjunto) ────────────────────────────────── */

function CrossedArms({ look }) {
  const { cloth, skin } = look;
  return (
    <g>
      <rect
        x="8"
        y="95"
        width="84"
        height="17"
        rx="8"
        fill={cloth.base}
        stroke={OUTLINE}
        strokeWidth={OW}
        transform="rotate(-5 50 103)"
      />
      <rect
        x="30"
        y="93"
        width="84"
        height="18"
        rx="8"
        fill={cloth.dark}
        stroke={OUTLINE}
        strokeWidth={OW}
        transform="rotate(4 72 102)"
      />
      {/* Sombra do braço da frente: sem ela o cruzamento desaparece em roupa
          clara (bata do médico) — as duas barras ficam do mesmo branco. */}
      <rect
        x="30"
        y="93"
        width="84"
        height="18"
        rx="8"
        fill="#000000"
        opacity="0.14"
        transform="rotate(4 72 102)"
      />
      <rect
        x="28"
        y="95"
        width="18"
        height="15"
        rx="7"
        fill={skin.base}
        stroke={OUTLINE}
        strokeWidth={OW}
        transform="rotate(4 37 102)"
      />
    </g>
  );
}

/* ── Adereços por papel e escalão ───────────────────────────────────────── */

function Whistle() {
  return (
    <g>
      <path d="M50 66 C54 78 66 78 70 66" fill="none" stroke="#2a2f38" strokeWidth="1.6" />
      <rect
        x="55.6"
        y="81"
        width="11"
        height="7.4"
        rx="3.4"
        fill="#e8b73c"
        stroke={OUTLINE}
        strokeWidth="1.3"
      />
      <circle cx="59.6" cy="84.7" r="1.3" fill={OUTLINE} />
    </g>
  );
}

function Clipboard() {
  return (
    <g transform="rotate(-6 54 96)">
      <rect x="33" y="83" width="42" height="29" rx="2.4" fill="#d9c9a3" stroke={OUTLINE} strokeWidth="1.5" />
      <rect x="48" y="79" width="13" height="7" rx="2.2" fill="#98a0aa" stroke={OUTLINE} strokeWidth="1.2" />
      <path d="M40 92 H68 M40 97.6 H62" fill="none" stroke="#8b7a56" strokeWidth="1.2" />
    </g>
  );
}

function Glasses() {
  return (
    <g>
      <rect x="41" y="25.6" width="17.4" height="21.4" rx="8.6" fill="none" stroke={OUTLINE} strokeWidth="1.7" />
      <rect x="61.6" y="25.6" width="17.4" height="21.4" rx="8.6" fill="none" stroke={OUTLINE} strokeWidth="1.7" />
      <path d="M58.4 34 H61.6" fill="none" stroke={OUTLINE} strokeWidth="1.6" />
      <path d="M41 34 L37 32" fill="none" stroke={OUTLINE} strokeWidth="1.5" />
      <path d="M79 34 L83 32" fill="none" stroke={OUTLINE} strokeWidth="1.5" />
    </g>
  );
}

function Megaphone() {
  return (
    <g transform="translate(0 8)">
      <path d="M32 70 L6 80 C3 81 3 85 6 86 L32 96 Z" fill="#d8452f" stroke={OUTLINE} strokeWidth={OW} />
      <ellipse cx="32" cy="83" rx="4.4" ry="13" fill="#f2f4f7" stroke={OUTLINE} strokeWidth={OW} />
      <path d="M32 74 L36 75.6 L36 90.4 L32 92" fill="#b93824" stroke={OUTLINE} strokeWidth="1.3" />
      <path d="M14 84.6 C20 85.4 26 85.4 32 85" fill="none" stroke="#f7f9fb" strokeWidth="1.4" />
    </g>
  );
}

function PressBadge() {
  return (
    <g>
      <path d="M52 66 C54 76 66 76 68 66" fill="none" stroke="#2a2f38" strokeWidth="1.4" />
      <rect x="56" y="79" width="9" height="12.4" rx="1.6" fill="#f2f4f7" stroke={OUTLINE} strokeWidth="1.2" />
      <circle cx="60.5" cy="83" r="2.1" fill="#9aa3ad" stroke={OUTLINE} strokeWidth="0.9" />
      <path d="M57.6 88.4 H63.4" fill="none" stroke="#8b939c" strokeWidth="1.2" />
    </g>
  );
}

function Stethoscope() {
  return (
    <g>
      <path
        d="M50 66 C48 79 54 87 60 91 C66 87 72 79 70 66"
        fill="none"
        stroke="#39424e"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M50 66 L48.6 62.4 M70 66 L71.4 62.4"
        fill="none"
        stroke="#39424e"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path d="M60 91 L66 94" fill="none" stroke="#39424e" strokeWidth="2.2" />
      <circle cx="68.4" cy="95.4" r="4.6" fill="#b9c2cc" stroke={OUTLINE} strokeWidth="1.3" />
    </g>
  );
}

function MedCase() {
  return (
    <g>
      <path d="M66 101 C66 97 70 95 74 95 C78 95 82 97 82 101" fill="none" stroke={OUTLINE} strokeWidth="1.6" />
      <rect x="62" y="100" width="30" height="21" rx="3.4" fill="#c2362f" stroke={OUTLINE} strokeWidth={OW} />
      <path d="M77 104 L77 116 M71 110 L83 110" fill="none" stroke="#f5f7fa" strokeWidth="3.4" />
    </g>
  );
}

function Extras({ role, tier }) {
  if (role === "auxiliar") {
    return (
      <g>
        <Whistle />
        {tier >= 2 && <Clipboard />}
        {tier >= 3 && <Glasses />}
      </g>
    );
  }
  if (role === "fisico") {
    return null;
  }
  if (role === "comunicacao") {
    return (
      <g>
        {tier >= 2 && <Megaphone />}
        {tier >= 3 && <PressBadge />}
      </g>
    );
  }
  if (role === "medico") {
    return (
      <g>
        {tier >= 2 && <Stethoscope />}
        {tier >= 3 && <Glasses />}
        {tier >= 3 && <MedCase />}
      </g>
    );
  }
  return null;
}

/**
 * Avatar de um funcionário do clube (caricatura, linha do adjunto).
 * @param {object} props
 * @param {string} props.role Papel (`auxiliar` | `fisico` | `comunicacao` | `medico`)
 * @param {number} [props.level] Nível 1..5 — decide os adereços (escalão)
 * @param {string} [props.size] Chave de `AVATAR_SIZE_MAP` ou classes próprias
 * @param {string} [props.className] Classes extra (o chamador pode passar `opacity-*`)
 * @returns {JSX.Element}
 */
function StaffAvatarInner({ role, level = 1, size = "md", className = "" }) {
  const look = ROLE_LOOK[role] || ROLE_LOOK._default;
  const tier = staffTier(level);
  const box = AVATAR_SIZE_MAP[size] ?? size;
  return (
    <svg
      viewBox="0 0 120 120"
      className={`${box} rounded-full shrink-0 ${className}`.trim()}
      style={{ backgroundColor: look.bg }}
      shapeRendering="geometricPrecision"
      strokeLinejoin="round"
      role="img"
      aria-label={role}
    >
      <circle cx="60" cy="60" r="56" fill={look.bg} />
      <circle
        cx="60"
        cy="60"
        r="52"
        fill="none"
        stroke={look.accent}
        strokeWidth="1.4"
        opacity="0.4"
      />
      <Clothing look={look} tier={tier} />
      <CrossedArms look={look} />
      <Face skin={look.skin} hair={look.hair} />
      <Beard look={look} />
      <Hair look={look} />
      <Extras role={role} tier={tier} />
    </svg>
  );
}

export const StaffAvatar = memo(
  StaffAvatarInner,
  (prev, next) =>
    prev.role === next.role &&
    prev.level === next.level &&
    prev.size === next.size &&
    prev.className === next.className,
);
