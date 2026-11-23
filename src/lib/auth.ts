import { createHmac } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeEqual } from "./crypto";

const COOKIE = "admin_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

/** Em produção, recusa configurações fracas em vez de funcionar inseguro */
export function configProblem(env = process.env): string | null {
  if (!env.ADMIN_PASSWORD) return "Defina ADMIN_PASSWORD nas variáveis de ambiente";
  if (!env.SESSION_SECRET) return "Defina SESSION_SECRET nas variáveis de ambiente";
  if (env.NODE_ENV === "production") {
    if (env.ADMIN_PASSWORD.length < 12) return "A senha do painel (ADMIN_PASSWORD) precisa ter pelo menos 12 caracteres";
    if (env.SESSION_SECRET.length < 32) return "SESSION_SECRET precisa ter pelo menos 32 caracteres aleatórios";
  }
  return null;
}

/**
 * A chave da sessão depende da senha: trocar ADMIN_PASSWORD (ou SESSION_SECRET)
 * derruba na hora todas as sessões abertas, inclusive de um celular perdido.
 */
function sessionKey(): string {
  const problem = configProblem();
  if (problem) throw new Error(problem);
  return createHmac("sha256", process.env.SESSION_SECRET!).update(`sessao:${process.env.ADMIN_PASSWORD}`).digest("hex");
}

function sign(payload: string): string {
  return createHmac("sha256", sessionKey()).update(payload).digest("base64url");
}

export function checkPassword(password: string): boolean {
  const key = sessionKey();
  // compara os HMACs (mesmo tamanho) para não vazar nada por tempo de resposta
  const mac = (v: string) => createHmac("sha256", key).update(`senha:${v}`).digest("hex");
  return safeEqual(mac(password), mac(process.env.ADMIN_PASSWORD!));
}

/**
 * IP de quem está tentando entrar. Na Vercel esses cabeçalhos são preenchidos
 * pela própria plataforma; fora dela podem ser forjados, mas o limite global
 * de tentativas continua valendo.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconhecido";
}

export async function startSession() {
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `admin.${expires}`;
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value || configProblem()) return false;
  const [role, expires, sig] = value.split(".");
  if (role !== "admin" || !expires || !sig) return false;
  if (!safeEqual(sig, sign(`${role}.${expires}`))) return false;
  return Number(expires) > Date.now() / 1000;
}

export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}
