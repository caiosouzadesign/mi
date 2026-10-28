import { sql } from "drizzle-orm";
import { blob, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const properties = sqliteTable("properties", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  address: text("address"),
  tenantName: text("tenant_name"),
  tenantPhone: text("tenant_phone"),
  tenantEmail: text("tenant_email"),
  /** token do link do inquilino (/t/<token>) */
  accessToken: text("access_token").notNull().unique(),
  /** número da instalação Enel */
  enelInstallation: text("enel_installation"),
  /** RGI / código de fornecimento Sabesp */
  sabespCode: text("sabesp_code"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type BillStatus = "pendente" | "informado" | "pago";

export const bills = sqliteTable("bills", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  propertyId: integer("property_id").references(() => properties.id, { onDelete: "set null" }),
  provider: text("provider", { enum: ["enel", "sabesp"] }),
  referenceMonth: text("reference_month"),
  dueDate: text("due_date"),
  amountCents: integer("amount_cents"),
  digitable: text("digitable"),
  pixCode: text("pix_code"),
  consumption: real("consumption"),
  consumptionUnit: text("consumption_unit"),
  /** JSON: string[] */
  notices: text("notices").notNull().default("[]"),
  pdf: blob("pdf", { mode: "buffer" }),
  pdfHash: text("pdf_hash").unique(),
  pdfFilename: text("pdf_filename"),
  /** token do link público só deste PDF (/f/<token>) */
  shareToken: text("share_token").notNull().unique(),
  status: text("status", { enum: ["pendente", "informado", "pago"] }).notNull().default("pendente"),
  paidAt: text("paid_at"),
  paymentNote: text("payment_note"),
  receipt: blob("receipt", { mode: "buffer" }),
  receiptMime: text("receipt_mime"),
  receiptFilename: text("receipt_filename"),
  source: text("source").notNull().default("upload"),
  rawText: text("raw_text"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const notices = sqliteTable("notices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** null = ainda não atribuído a um imóvel */
  propertyId: integer("property_id").references(() => properties.id, { onDelete: "cascade" }),
  provider: text("provider", { enum: ["enel", "sabesp"] }),
  title: text("title").notNull(),
  body: text("body"),
  source: text("source").notNull().default("manual"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type Property = typeof properties.$inferSelect;
export type Bill = typeof bills.$inferSelect;
export type Notice = typeof notices.$inferSelect;

/** Mantido em sincronia com as tabelas acima; criado automaticamente na primeira conexão. */
export const SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    tenant_name TEXT,
    tenant_phone TEXT,
    tenant_email TEXT,
    access_token TEXT NOT NULL UNIQUE,
    enel_installation TEXT,
    sabesp_code TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
    provider TEXT,
    reference_month TEXT,
    due_date TEXT,
    amount_cents INTEGER,
    digitable TEXT,
    pix_code TEXT,
    consumption REAL,
    consumption_unit TEXT,
    notices TEXT NOT NULL DEFAULT '[]',
    pdf BLOB,
    pdf_hash TEXT UNIQUE,
    pdf_filename TEXT,
    share_token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pendente',
    paid_at TEXT,
    payment_note TEXT,
    receipt BLOB,
    receipt_mime TEXT,
    receipt_filename TEXT,
    source TEXT NOT NULL DEFAULT 'upload',
    raw_text TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS bills_property_idx ON bills(property_id, provider, due_date)`,
  `CREATE INDEX IF NOT EXISTS bills_digitable_idx ON bills(digitable)`,
  `CREATE TABLE IF NOT EXISTS notices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
    provider TEXT,
    title TEXT NOT NULL,
    body TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
];
