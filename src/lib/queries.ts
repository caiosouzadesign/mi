import { and, desc, eq, isNull } from "drizzle-orm";
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

export async function billsForProperty(propertyId: number): Promise<BillSummary[]> {
  const db = await getDb();
  return db
    .select(billSummary)
    .from(b)
    .where(eq(b.propertyId, propertyId))
    .orderBy(desc(b.referenceMonth), desc(b.dueDate), desc(b.id));
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
