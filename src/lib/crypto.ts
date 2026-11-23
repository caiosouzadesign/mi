import { timingSafeEqual } from "node:crypto";

/** Comparação de segredos em tempo constante (não vaza o tamanho do acerto por timing) */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Confere um cabeçalho "Authorization: Bearer <segredo>" */
export function bearerMatches(request: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  return safeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`);
}
