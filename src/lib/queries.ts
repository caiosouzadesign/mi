import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";

const b = schema.bills;

/** Colunas da conta sem os arquivos (PDF/comprovante), para listagens */
export const billSummary = {
  id: b.id,
  propertyId: b.propertyId,
  provider: b.provider,
  referenceMonth: b.referenceMonth,
  dueDate: b.dueDate,
  amountCents: b.amountCents,
  digitable: b.digitable,
  pixCode: b.pixCode,
  consumption: b.consumption,
  consumptionUnit: b.consumptionUnit,
  notices: b.notices,
  shareToken: b.shareToken,
  status: b.status,
  paidAt: b.paidAt,
  paymentNote: b.paymentNote,
  receiptFilename: b.receiptFilename,
  source: b.source,
  reviewReason: b.reviewReason,
  createdAt: b.createdAt,
};

export type BillSummary = {
  [K in keyof typeof billSummary]: (typeof schema.bills.$inferSelect)[K];
};

export async function getPropertyByToken(token: string) {
  const db = await getDb();
  const [property] = await db.select().from(schema.properties).where(eq(schema.properties.accessToken, token)).limit(1);
  return property ?? null;
}

/** Contas do imóvel; para o inquilino, só as liberadas (fora da revisão anti-fraude) */
export async function billsForProperty(propertyId: number, opts: { tenant?: boolean } = {}): Promise<BillSummary[]> {
  const db = await getDb();
  return db
    .select(billSummary)
    .from(b)
    .where(opts.tenant ? and(eq(b.propertyId, propertyId), isNull(b.reviewReason)) : eq(b.propertyId, propertyId))
    .orderBy(desc(b.referenceMonth), desc(b.dueDate), desc(b.id));
}

/** Contas que chegaram por e-mail com algum sinal de alerta */
export async function billsInReview() {
  const db = await getDb();
  return db
    .select({ ...billSummary, propertyName: schema.properties.name })
    .from(b)
    .innerJoin(schema.properties, eq(b.propertyId, schema.properties.id))
    .where(isNotNull(b.reviewReason))
    .orderBy(desc(b.id));
}

export async function unassignedBills(): Promise<BillSummary[]> {
  const db = await getDb();
  return db.select(billSummary).from(b).where(isNull(b.propertyId)).orderBy(desc(b.id));
}

export async function noticesForProperty(propertyId: number) {
  const db = await getDb();
  return db
    .select()
    .from(schema.notices)
    .where(eq(schema.notices.propertyId, propertyId))
    .orderBy(desc(schema.notices.createdAt))
    .limit(20);
}

export async function unassignedNotices() {
  const db = await getDb();
  return db.select().from(schema.notices).where(isNull(schema.notices.propertyId)).orderBy(desc(schema.notices.createdAt));
}

export async function billForProperty(billId: number, propertyId: number) {
  const db = await getDb();
  const [bill] = await db.select().from(b).where(and(eq(b.id, billId), eq(b.propertyId, propertyId))).limit(1);
  return bill ?? null;
}

export function parseNotices(json: string): string[] {
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? value.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** Conta mais recente de cada distribuidora */
export function latestByProvider(bills: BillSummary[]) {
  return {
    enel: bills.find((x) => x.provider === "enel") ?? null,
    sabesp: bills.find((x) => x.provider === "sabesp") ?? null,
  };
}

const d = schema.documents;

/** Documentos do imóvel sem os arquivos */
export async function documentsForProperty(propertyId: number, opts: { tenantOnly?: boolean } = {}) {
  const db = await getDb();
  const rows = await db
    .select({
      id: d.id,
      kind: d.kind,
      title: d.title,
      filename: d.filename,
      visibleToTenant: d.visibleToTenant,
      shareToken: d.shareToken,
      signatureStatus: d.signatureStatus,
      signatureProvider: d.signatureProvider,
      tenantSignUrl: d.tenantSignUrl,
      ownerSignUrl: d.ownerSignUrl,
      signedAt: d.signedAt,
      hasSignedFile: sql<number>`${d.signedFile} IS NOT NULL`,
      createdAt: d.createdAt,
    })
    .from(d)
    .where(eq(d.propertyId, propertyId))
    .orderBy(desc(d.createdAt), desc(d.id));
  return opts.tenantOnly ? rows.filter((r) => r.visibleToTenant) : rows;
}

export type DocumentSummary = Awaited<ReturnType<typeof documentsForProperty>>[number];

/** Fotos do imóvel sem a imagem em si */
export async function photosForProperty(propertyId: number) {
  const db = await getDb();
  return db
    .select({ id: schema.photos.id, caption: schema.photos.caption, width: schema.photos.width, height: schema.photos.height })
    .from(schema.photos)
    .where(eq(schema.photos.propertyId, propertyId))
    .orderBy(asc(schema.photos.position), asc(schema.photos.id));
}

/** Avisos de e-mail já publicados para algum imóvel (histórico das notificações) */
export async function publishedEmailNotices(limit = 15) {
  const db = await getDb();
  return db
    .select({ notice: schema.notices, propertyName: schema.properties.name })
    .from(schema.notices)
    .innerJoin(schema.properties, eq(schema.notices.propertyId, schema.properties.id))
    .where(eq(schema.notices.source, "email"))
    .orderBy(desc(schema.notices.createdAt))
    .limit(limit);
}

/** Contagem do sino do painel: o que espera uma ação do proprietário */
export async function pendingCounts() {
  const db = await getDb();
  const count = sql<number>`COUNT(*)`;
  const [[notices], [review], [payments]] = await Promise.all([
    db.select({ c: count }).from(schema.notices).where(isNull(schema.notices.propertyId)),
    db.select({ c: count }).from(b).where(and(isNotNull(b.reviewReason), isNotNull(b.propertyId))),
    db.select({ c: count }).from(b).where(eq(b.status, "informado")),
  ]);
  return { notices: notices.c, review: review.c, payments: payments.c, total: notices.c + review.c + payments.c };
}
