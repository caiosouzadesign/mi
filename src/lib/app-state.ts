import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

export async function getState<T>(key: string): Promise<{ value: T; updatedAt: string } | null> {
  const db = await getDb();
  const [row] = await db.select().from(schema.appState).where(eq(schema.appState.key, key));
  if (!row) return null;
  try {
    return { value: JSON.parse(row.value) as T, updatedAt: row.updatedAt };
  } catch {
    return null;
  }
}

export async function setState(key: string, value: unknown) {
  const db = await getDb();
  const row = { key, value: JSON.stringify(value), updatedAt: new Date().toISOString() };
  await db.insert(schema.appState).values(row).onConflictDoUpdate({ target: schema.appState.key, set: row });
}

/** Resumo de cada rodada do leitor do Gmail */
export interface GmailRun {
  processed: number;
  suspicious: number;
}

export const GMAIL_LAST_SEEN = "gmail.last_seen";
export const GMAIL_LAST_RUN = "gmail.last_run";
