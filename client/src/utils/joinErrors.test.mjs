/**
 * Regression — classificação dos erros de join (joinErrors).
 *
 * Contrato codificado:
 *   R1 — credencial inválida (4 frases, maiúsculas incluídas) → isAuthError;
 *   R2 — falha transitória de verificação → isTransientError, nunca auth;
 *   R3 — sala inexistente/expulsão (3 frases) → isRoomUnavailable, nunca auth;
 *   R4 — erros transitórios de rede/lotação → nenhum dos três (mantêm a
 *        sessão para o retry recuperar sem desmontar o jogo);
 *   R5 — null/undefined/vazio → nenhum dos três (sem crash).
 *
 * Run: cd client && npm run test:joinerrors
 */
import {
	isAuthError,
	isRoomUnavailable,
	isTransientError,
} from "./joinErrors.js";

let failures = 0;
function check(cond, msg) {
	if (!cond) {
		failures++;
		console.error(`  ✗ ${msg}`);
	} else {
		console.log(`  ✓ ${msg}`);
	}
}

// R1 — auth (case-insensitive)
check(isAuthError("Palavra-passe incorreta."), "R1: palavra-passe → auth");
check(isAuthError("CREDENCIAIS INVÁLIDAS"), "R1: maiúsculas → auth");
check(isAuthError("Sessão inválida."), "R1: sessão inválida → auth");
check(isAuthError("Sessão expirada."), "R1: sessão expirada → auth");

// R2 — transitório (e só transitório)
check(
	isTransientError("Sessão temporariamente indisponível, tenta de novo."),
	"R2: verificação transitória → transient",
);
check(
	!isAuthError("Sessão temporariamente indisponível, tenta de novo."),
	"R2: transitório nunca é auth",
);

// R3 — sala indisponível (e só isso)
check(
	isRoomUnavailable("Sala não encontrada."),
	"R3: sala não encontrada → room",
);
check(
	isRoomUnavailable("A sala já não existe."),
	"R3: sala já não existe → room",
);
check(
	isRoomUnavailable("Foste expulso desta sala."),
	"R3: expulsão → room",
);
check(
	!isAuthError("Sala não encontrada."),
	"R3: sala indisponível nunca é auth",
);

// R4 — rede/lotação mantêm a sessão (nenhum ramo)
for (const msg of [
	"Sala cheia.",
	"Sem resposta do servidor.",
	"A ligar à sala… (tentativa 1/5)",
]) {
	check(
		!isAuthError(msg) && !isTransientError(msg) && !isRoomUnavailable(msg),
		`R4: "${msg}" não limpa nada`,
	);
}

// R5 — entradas vazias
for (const msg of [null, undefined, ""]) {
	check(
		!isAuthError(msg) && !isTransientError(msg) && !isRoomUnavailable(msg),
		`R5: ${String(msg)} sem crash e sem ramo`,
	);
}

if (failures > 0) {
	console.error(`\n${failures} falha(s).`);
	process.exit(1);
}
console.log("\nOK: classificação de erros de join.");
