import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

/** Aceita os nomes do README e os que a integração da Turso na Vercel cria */
export function databaseConfig(env = process.env) {
  const url = env.DATABASE_URL || env.TURSO_DATABASE_URL;
  const authToken = env.DATABASE_AUTH_TOKEN || env.TURSO_AUTH_TOKEN || undefined;
  if (!url && env.VERCEL) {
    // na Vercel o disco é temporário: um arquivo local perderia tudo
    throw new Error("Banco de dados não configurado: conecte a Turso ao projeto na Vercel (Storage) e publique de novo.");
  }
  return { url: url || "file:local.db", authToken };
}

function makeDb() {
  const client = createClient(databaseConfig());
  const db = drizzle(client, { schema });
  const ready = (async () => {
    for (const statement of schema.SCHEMA_SQL) await client.execute(statement);
    for (const { table, column, type } of schema.ADDED_COLUMNS) {
      const info = await client.execute(`PRAGMA table_info(${table})`);
      if (!info.rows.some((r) => r.name === column)) await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    }
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
