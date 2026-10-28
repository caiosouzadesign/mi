import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

function makeDb() {
  const client = createClient({
    url: process.env.DATABASE_URL ?? "file:local.db",
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  });
  const db = drizzle(client, { schema });
  const ready = (async () => {
    for (const statement of schema.SCHEMA_SQL) await client.execute(statement);
    await client.execute("PRAGMA foreign_keys = ON");
  })();
  return { db, ready };
}

type Holder = ReturnType<typeof makeDb>;
const globalForDb = globalThis as unknown as { __contasDb?: Holder };

/** Conexão única por processo; garante que as tabelas existam antes do primeiro uso. */
export async function getDb() {
  globalForDb.__contasDb ??= makeDb();
  await globalForDb.__contasDb.ready;
  return globalForDb.__contasDb.db;
}

export type Db = Awaited<ReturnType<typeof getDb>>;
export { schema };
