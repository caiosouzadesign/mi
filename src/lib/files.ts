import { sniffMime } from "./upload-safety";

/** Mesma política de next.config.ts (fileCsp): arquivo de usuário não executa nada */
const FILE_CSP = "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox";

export function billFilename(bill: { provider: string | null; referenceMonth: string | null }) {
  return `conta-${bill.provider ?? "consumo"}-${bill.referenceMonth ?? "sem-data"}.pdf`;
}

/**
 * Entrega um arquivo guardado. O tipo vem dos bytes, não do que foi gravado no
 * upload; o que não for PDF ou imagem conhecida vai como download. Imagens e
 * outros arquivos abrem numa "caixa de areia" (CSP sandbox), sem executar código.
 */
export function fileResponse(bytes: Uint8Array, filename: string, download: boolean, cache = "private, max-age=3600") {
  const sniffed = sniffMime(bytes);
  const svgImage = !sniffed && /^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(Buffer.from(bytes.slice(0, 256)).toString("utf8"));
  const mime = sniffed ?? (svgImage ? "image/svg+xml" : "application/octet-stream");
  const headers: Record<string, string> = {
    "Content-Type": mime,
    // SVG pode conter script: abrindo direto, vira download (em <img> continua aparecendo)
    "Content-Disposition": `${download || mime === "application/octet-stream" || svgImage ? "attachment" : "inline"}; filename="${asciiFilename(filename)}"`,
    "Cache-Control": cache,
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
  };
  // o leitor de PDF do Chrome não abre com sandbox; PDF não executa scripts da página
  if (mime !== "application/pdf") headers["Content-Security-Policy"] = FILE_CSP;
  return new Response(new Uint8Array(bytes), { headers });
}

export function pdfResponse(bytes: Uint8Array, filename: string, download: boolean) {
  return fileResponse(bytes, filename, download);
}

/** Nome de arquivo seguro para o cabeçalho (sem acentos nem aspas) */
function asciiFilename(name: string) {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\- ()]/g, "_");
}
