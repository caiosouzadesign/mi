import { randomBytes } from "node:crypto";

/** Token difícil de adivinhar, seguro para URL */
export function newToken(bytes = 18): string {
  return randomBytes(bytes).toString("base64url");
}
