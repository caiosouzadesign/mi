import { and, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Bill, Property } from "@/db/schema";
import { brDate, brl, monthLabel, PROVIDER_LABEL, todaySP } from "./format";
import { emailConfigured, sendEmail } from "./notify";
import { formatDigitable } from "./parser/barcode";
import { daysUntil } from "./status";

/** Quantos dias antes do vencimento lembrar o inquilino */
export const DUE_REMINDER_DAYS = 3;

type BillInfo = Pick<Bill, "provider" | "referenceMonth" | "amountCents" | "dueDate" | "digitable">;

export function billTitle(bill: Pick<Bill, "provider" | "referenceMonth">) {
  return `${bill.provider ? PROVIDER_LABEL[bill.provider] : "Conta"} — ${monthLabel(bill.referenceMonth)}`;
}

/** Texto do aviso de conta nova ou do lembrete de vencimento (e-mail e WhatsApp) */
export function billMessage(bill: BillInfo, opts: { tenantName: string | null; link: string; kind: "nova" | "lembrete" }) {
  const first = opts.tenantName?.split(" ")[0];
  const days = bill.dueDate ? daysUntil(bill.dueDate) : null;
  const intro =
    opts.kind === "nova"
      ? `chegou a conta ${billTitle(bill)}.`
      : `a conta ${billTitle(bill)} vence ${days === 0 ? "hoje" : days === 1 ? "amanhã" : `em ${days} dias`}.`;
  return [
    `Olá${first ? `, ${first}` : ""}! ${intro.charAt(0).toUpperCase()}${intro.slice(1)}`,
    `Valor: ${brl(bill.amountCents)}`,
    `Vencimento: ${brDate(bill.dueDate)}`,
    bill.digitable ? `Código de barras: ${formatDigitable(bill.digitable)}` : null,
    "",
    `PDF, código e histórico: ${opts.link}`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

/** A conta deve receber lembrete hoje? (pendente, vence nos próximos dias, ainda sem lembrete) */
export function needsDueReminder(bill: Pick<Bill, "status" | "dueDate" | "dueRemindedAt">, today = todaySP()) {
  if (bill.status !== "pendente" || !bill.dueDate || bill.dueRemindedAt) return false;
  const days = daysUntil(bill.dueDate, today);
  return days >= 0 && days <= DUE_REMINDER_DAYS;
}

async function loadBill(billId: number) {
  const db = await getDb();
  const [row] = await db
    .select({ bill: schema.bills, property: schema.properties })
    .from(schema.bills)
    .innerJoin(schema.properties, eq(schema.bills.propertyId, schema.properties.id))
    .where(eq(schema.bills.id, billId));
  return row ?? null;
}

function portalLink(baseUrl: string, property: Property) {
  return `${baseUrl}/t/${property.accessToken}`;
}

/** Avisa o inquilino por e-mail que a conta chegou (uma vez por conta) */
export async function notifyNewBill(billId: number, baseUrl: string): Promise<boolean> {
  if (!emailConfigured()) return false;
  const row = await loadBill(billId);
  if (!row || row.bill.notifiedAt || row.bill.reviewReason || !row.property.tenantEmail) return false;
  const text = billMessage(row.bill, { tenantName: row.property.tenantName, link: portalLink(baseUrl, row.property), kind: "nova" });
  const ok = await sendEmail(row.property.tenantEmail, `Conta nova: ${billTitle(row.bill)}`, text);
  if (ok) {
    const db = await getDb();
    await db.update(schema.bills).set({ notifiedAt: todaySP() }).where(eq(schema.bills.id, billId));
  }
  return ok;
}

/** Lembretes de vencimento (rotina diária) */
export async function sendDueReminders(baseUrl: string) {
  if (!emailConfigured()) return [];
  const db = await getDb();
  const rows = await db
    .select({ bill: schema.bills, property: schema.properties })
    .from(schema.bills)
    .innerJoin(schema.properties, eq(schema.bills.propertyId, schema.properties.id))
    .where(and(eq(schema.bills.status, "pendente"), isNull(schema.bills.dueRemindedAt), isNull(schema.bills.reviewReason)));
  const sent: string[] = [];
  for (const { bill, property } of rows) {
    if (!needsDueReminder(bill) || !property.tenantEmail) continue;
    const text = billMessage(bill, { tenantName: property.tenantName, link: portalLink(baseUrl, property), kind: "lembrete" });
    if (await sendEmail(property.tenantEmail, `Lembrete: ${billTitle(bill)} vence ${brDate(bill.dueDate)}`, text)) {
      await db.update(schema.bills).set({ dueRemindedAt: todaySP() }).where(eq(schema.bills.id, bill.id));
      sent.push(`${property.name}: ${billTitle(bill)}`);
    }
  }
  return sent;
}
