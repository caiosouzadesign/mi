/**
 * Arquivos enviados por usuários: o tipo é descoberto pelos primeiros bytes
 * (assinatura do formato), nunca pelo que o navegador declara. Assim um HTML
 * ou SVG com script não entra disfarçado de "imagem".
 */

export type SafeImageMime = "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "image/heic";
export type SafeMime = SafeImageMime | "application/pdf";

function startsWith(bytes: Uint8Array, signature: number[], offset = 0) {
  return signature.every((b, i) => bytes[offset + i] === b);
}

function ascii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.slice(start, end));
}

export function sniffMime(bytes: Uint8Array): SafeMime | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "image/webp";
  if (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a") return "image/gif";
  if (ascii(bytes, 4, 8) === "ftyp" && /^(heic|heix|mif1|msf1|hevc)$/.test(ascii(bytes, 8, 12))) return "image/heic";
  return null;
}

export function sniffImage(bytes: Uint8Array): SafeImageMime | null {
  const mime = sniffMime(bytes);
  return mime && mime !== "application/pdf" ? mime : null;
}

export function isPdf(bytes: Uint8Array): boolean {
  return sniffMime(bytes) === "application/pdf";
}

/** Só aceita links https (ou caminhos internos do próprio site) vindos de serviços externos */
export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}
