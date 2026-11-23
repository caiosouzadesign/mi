import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

/**
 * Limite de tentativas de login guardado no banco (funciona mesmo com várias
 * instâncias na Vercel). Por IP e também no total, contra ataques distribuídos.
 */
export const LIMITS = [
  { scope: "ip", max: 5, windowMs: 15 * 60_000 },
  { scope: "global", max: 50, windowMs: 60 * 60_000 },
] as const;

/** Decide se a tentativa é permitida, dado o histórico de erros (pura, testável) */
export function evaluate(
  rows: { failures: number; windowStart: number }[],
  limits: { max: number; windowMs: number }[],
  now: number,
): { allowed: boolean; retryAfterMs: number } {
  let retryAfterMs = 0;
  rows.forEach((row, i) => {
    const limit = limits[i];
    if (!row || now - row.windowStart >= limit.windowMs) return;
    if (row.failures >= limit.max) retryAfterMs = Math.max(retryAfterMs, row.windowStart + limit.windowMs - now);
  });
  return { allowed: retryAfterMs === 0, retryAfterMs };
}

function keysFor(ip: string) {
  // o IP é guardado só como hash
  const hashed = createHash("sha256").update(`${process.env.SESSION_SECRET ?? ""}:${ip}`).digest("hex").slice(0, 32);
  return [`ip:${hashed}`, "global"];
}

async function load(keys: string[]) {
  const db = await getDb();
  return Promise.all(
    keys.map(async (key) => (await db.select().from(schema.authAttempts).where(eq(schema.authAttempts.key, key)))[0] ?? null),
  );
}

export async function loginAllowed(ip: string, now = Date.now()) {
  const rows = await load(keysFor(ip));
  return evaluate(
    rows.map((r) => r ?? { failures: 0, windowStart: 0 }),
    LIMITS.map((l) => ({ max: l.max, windowMs: l.windowMs })),
    now,
  );
}

export async function recordLoginFailure(ip: string, now = Date.now()) {
  const db = await getDb();
  const keys = keysFor(ip);
  const rows = await load(keys);
  for (const [i, key] of keys.entries()) {
    const row = rows[i];
    const expired = !row || now - row.windowStart >= LIMITS[i].windowMs;
    await db
      .insert(schema.authAttempts)
      .values({ key, failures: 1, windowStart: now })
      .onConflictDoUpdate({
        target: schema.authAttempts.key,
        set: expired ? { failures: 1, windowStart: now } : { failures: (row?.failures ?? 0) + 1 },
      });
  }
}

export async function clearLoginFailures(ip: string) {
  const db = await getDb();
  await db.delete(schema.authAttempts).where(eq(schema.authAttempts.key, keysFor(ip)[0]));
}
