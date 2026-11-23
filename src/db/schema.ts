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
  /** YYYY-MM-DD */
  contractStart: text("contract_start"),
  /** YYYY-MM-DD */
  contractEnd: text("contract_end"),
  rentCents: integer("rent_cents"),
  /** último lembrete automático enviado (dias antes do fim: 90, 60, 30, 0) */
  contractReminderStage: integer("contract_reminder_stage"),
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
  /** quando o inquilino foi avisado da conta nova */
  notifiedAt: text("notified_at"),
  /** quando foi enviado o lembrete de vencimento */
  dueRemindedAt: text("due_reminded_at"),
  /** motivos para revisar antes de mostrar ao inquilino (null = liberada) */
  reviewReason: text("review_reason"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const notices = sqliteTable("notices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** null = ainda não publicado para um imóvel */
  propertyId: integer("property_id").references(() => properties.id, { onDelete: "cascade" }),
  /** imóvel sugerido pelo nº da instalação no e-mail (o proprietário confirma) */
  suggestedPropertyId: integer("suggested_property_id"),
  provider: text("provider", { enum: ["enel", "sabesp"] }),
  title: text("title").notNull(),
  body: text("body"),
  source: text("source").notNull().default("manual"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type DocumentKind = "contrato" | "aditivo" | "vistoria" | "outro";
export type SignatureStatus = "none" | "pending" | "signed" | "refused";

export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  propertyId: integer("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["contrato", "aditivo", "vistoria", "outro"] }).notNull().default("outro"),
  title: text("title").notNull(),
  file: blob("file", { mode: "buffer" }).notNull(),
  filename: text("filename"),
  visibleToTenant: integer("visible_to_tenant", { mode: "boolean" }).notNull().default(true),
  /** token do link que dá acesso só a este documento (/d/<token>) */
  shareToken: text("share_token").notNull().unique(),
  signatureStatus: text("signature_status", { enum: ["none", "pending", "signed", "refused"] }).notNull().default("none"),
  signatureProvider: text("signature_provider"),
  /** id do documento no serviço de assinatura */
  signatureRef: text("signature_ref"),
  tenantSignUrl: text("tenant_sign_url"),
  ownerSignUrl: text("owner_sign_url"),
  signedFile: blob("signed_file", { mode: "buffer" }),
  signedAt: text("signed_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const photos = sqliteTable("photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  propertyId: integer("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  image: blob("image", { mode: "buffer" }).notNull(),
  mime: text("mime").notNull(),
  caption: text("caption"),
  width: integer("width"),
  height: integer("height"),
  position: integer("position").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

/** Tentativas de login com erro, para bloquear adivinhação de senha */
export const authAttempts = sqliteTable("auth_attempts", {
  key: text("key").primaryKey(),
  failures: integer("failures").notNull().default(0),
  windowStart: integer("window_start").notNull(),
});

export type Property = typeof properties.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Photo = typeof photos.$inferSelect;
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
    contract_start TEXT,
    contract_end TEXT,
    rent_cents INTEGER,
    contract_reminder_stage INTEGER,
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
    notified_at TEXT,
    due_reminded_at TEXT,
    review_reason TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS bills_property_idx ON bills(property_id, provider, due_date)`,
  `CREATE INDEX IF NOT EXISTS bills_digitable_idx ON bills(digitable)`,
  `CREATE TABLE IF NOT EXISTS notices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
    suggested_property_id INTEGER,
    provider TEXT,
    title TEXT NOT NULL,
    body TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    kind TEXT NOT NULL DEFAULT 'outro',
    title TEXT NOT NULL,
    file BLOB NOT NULL,
    filename TEXT,
    visible_to_tenant INTEGER NOT NULL DEFAULT 1,
    share_token TEXT NOT NULL UNIQUE,
    signature_status TEXT NOT NULL DEFAULT 'none',
    signature_provider TEXT,
    signature_ref TEXT,
    tenant_sign_url TEXT,
    owner_sign_url TEXT,
    signed_file BLOB,
    signed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS documents_property_idx ON documents(property_id)`,
  `CREATE INDEX IF NOT EXISTS documents_signature_idx ON documents(signature_ref)`,
  `CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    image BLOB NOT NULL,
    mime TEXT NOT NULL,
    caption TEXT,
    width INTEGER,
    height INTEGER,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS photos_property_idx ON photos(property_id, position)`,
  `CREATE TABLE IF NOT EXISTS auth_attempts (
    key TEXT PRIMARY KEY,
    failures INTEGER NOT NULL DEFAULT 0,
    window_start INTEGER NOT NULL
  )`,
];

/** Colunas adicionadas depois da primeira versão (bancos já criados recebem via ALTER TABLE) */
export const ADDED_COLUMNS: { table: string; column: string; type: string }[] = [
  { table: "properties", column: "contract_start", type: "TEXT" },
  { table: "properties", column: "contract_end", type: "TEXT" },
  { table: "properties", column: "rent_cents", type: "INTEGER" },
  { table: "properties", column: "contract_reminder_stage", type: "INTEGER" },
  { table: "bills", column: "notified_at", type: "TEXT" },
  { table: "bills", column: "due_reminded_at", type: "TEXT" },
  { table: "bills", column: "review_reason", type: "TEXT" },
  { table: "notices", column: "suggested_property_id", type: "INTEGER" },
];
