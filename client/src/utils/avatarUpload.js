/**
 * Processamento do avatar carregado pelo coach, no cliente.
 *
 * Antes de enviar para o backend: valida tipo/tamanho original, faz crop
 * quadrado centrado e redimensiona para 256x256 via canvas — sem dependências
 * no servidor (sem `sharp`). O resultado é base64 + mime para a REST POST.
 */

export const AVATAR_TARGET_SIZE = 256;
export const MAX_AVATAR_FILE_BYTES = 4 * 1024 * 1024; // ~4MB original
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Imagem inválida ou corrompida."));
    };
    img.src = url;
  });
}

/**
 * @param {File} file Ficheiro escolhido pelo utilizador (PNG/JPEG/WebP, ~4MB)
 * @returns {Promise<{dataBase64: string, mime: string}>} base64 sem o prefixo data: + mime de saída
 */
export async function processAvatarFile(file) {
  if (!file || !ACCEPTED_TYPES.includes(file.type)) {
    throw new Error("Formato não suportado. Usa PNG, JPEG ou WebP.");
  }
  if (file.size > MAX_AVATAR_FILE_BYTES) {
    throw new Error("Imagem demasiado grande (máx. ~4MB).");
  }

  const img = await loadImageFromFile(file);
  const srcSize = Math.min(img.naturalWidth, img.naturalHeight);
  if (srcSize <= 0) throw new Error("Imagem inválida ou corrompida.");

  // Crop quadrado centrado + resize para 256x256
  const sx = (img.naturalWidth - srcSize) / 2;
  const sy = (img.naturalHeight - srcSize) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_TARGET_SIZE;
  canvas.height = AVATAR_TARGET_SIZE;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(
    img,
    sx,
    sy,
    srcSize,
    srcSize,
    0,
    0,
    AVATAR_TARGET_SIZE,
    AVATAR_TARGET_SIZE,
  );

  // Mantém a família do original: PNG→PNG (transparência), resto→JPEG q0.9
  const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), mime, 0.9),
  );
  if (!blob) throw new Error("Falha ao processar a imagem.");

  const dataBase64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(String(reader.result).split(",").slice(1).join(","));
    reader.onerror = () => reject(new Error("Falha ao ler a imagem."));
    reader.readAsDataURL(blob);
  });

  return { dataBase64, mime };
}
