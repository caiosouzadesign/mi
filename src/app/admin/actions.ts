"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import type { BillStatus } from "@/db/schema";
import { checkPassword, endSession, requireAdmin, startSession } from "@/lib/auth";
import { todaySP } from "@/lib/format";
import { ingestBillPdf } from "@/lib/ingest";
import { parseBillText, type Provider } from "@/lib/parser";
import { parseDigitable } from "@/lib/parser/barcode";
import { newToken } from "@/lib/tokens";

function str(fd: FormData, key: string): string | null {
  const v = String(fd.get(key) ?? "").trim();
  return v === "" ? null : v;
}

function provider(fd: FormData, key = "provider"): Provider | null {
  const v = str(fd, key);
  return v === "enel" || v === "sabesp" ? v : null;
}

function intOrNull(v: string | null): number | null {
  return v && /^\d+$/.test(v) ? Number(v) : null;
}

/** "1.234,56" / "1234.56" / "187,35" -> centavos */
function moneyToCents(v: string | null): number | null {
  if (!v) return null;
  const clean = v.replace(/[^\d,.]/g, "");
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function refresh() {
  revalidatePath("/admin", "layout");
  revalidatePath("/t/[token]", "page");
}

// ---------- sessão ----------

export async function login(_: string | null, fd: FormData): Promise<string | null> {
  if (!checkPassword(String(fd.get("password") ?? ""))) return "Senha incorreta";
  await startSession();
  redirect("/admin");
}

export async function logout() {
  await endSession();
  redirect("/admin/login");
}

// ---------- imóveis ----------

function propertyFields(fd: FormData) {
  return {
    name: str(fd, "name") ?? "Imóvel",
    address: str(fd, "address"),
    tenantName: str(fd, "tenantName"),
    tenantPhone: str(fd, "tenantPhone"),
    tenantEmail: str(fd, "tenantEmail"),
    enelInstallation: str(fd, "enelInstallation"),
    sabespCode: str(fd, "sabespCode"),
  };
}

export async function createProperty(fd: FormData) {
  await requireAdmin();
  const db = await getDb();
  const [row] = await db
    .insert(schema.properties)
    .values({ ...propertyFields(fd), accessToken: newToken() })
    .returning({ id: schema.properties.id });
  refresh();
  redirect(`/admin/imoveis/${row.id}`);
}

export async function updateProperty(id: number, fd: FormData) {
  await requireAdmin();
  const db = await getDb();
  await db.update(schema.properties).set(propertyFields(fd)).where(eq(schema.properties.id, id));
  refresh();
}

/** Gera um link novo; o anterior para de funcionar (ex.: troca de inquilino) */
export async function regenerateLink(id: number) {
  await requireAdmin();
  const db = await getDb();
  await db.update(schema.properties).set({ accessToken: newToken() }).where(eq(schema.properties.id, id));
  refresh();
}

export async function deleteProperty(id: number) {
  await requireAdmin();
  const db = await getDb();
  await db.delete(schema.properties).where(eq(schema.properties.id, id));
  refresh();
  redirect("/admin");
}

// ---------- contas ----------

export interface UploadState {
  results: { filename: string; message: string; ok: boolean; billId?: number }[];
}

export async function uploadBills(_: UploadState, fd: FormData): Promise<UploadState> {
  await requireAdmin();
  const propertyId = intOrNull(str(fd, "propertyId"));
  const forcedProvider = provider(fd);
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const results: UploadState["results"] = [];
  for (const file of files) {
    try {
      if (file.type && file.type !== "application/pdf") throw new Error("não é PDF");
      const r = await ingestBillPdf(new Uint8Array(await file.arrayBuffer()), {
        filename: file.name,
        source: "upload",
        propertyId,
        provider: forcedProvider,
      });
      results.push({
        filename: file.name,
        ok: true,
        billId: r.billId,
        message:
          r.status === "duplicate"
            ? "já estava cadastrada"
            : r.propertyId
              ? "importada"
              : "importada, mas sem imóvel identificado — atribua manualmente",
      });
    } catch (err) {
      results.push({ filename: file.name, ok: false, message: err instanceof Error ? err.message : "erro" });
    }
  }
  refresh();
  return { results };
}

export async function updateBill(id: number, fd: FormData) {
  await requireAdmin();
  const digitableInput = str(fd, "digitable");
  const digitable = digitableInput ? digitableInput.replace(/\D/g, "") : null;
  if (digitable && !parseDigitable(digitable)) throw new Error("Linha digitável inválida (confira os 48 dígitos)");
  const consumption = str(fd, "consumption");
  const db = await getDb();
  await db
    .update(schema.bills)
    .set({
      propertyId: intOrNull(str(fd, "propertyId")),
      provider: provider(fd),
      referenceMonth: str(fd, "referenceMonth"),
      dueDate: str(fd, "dueDate"),
      amountCents: moneyToCents(str(fd, "amount")),
      digitable,
      pixCode: str(fd, "pixCode"),
      consumption: consumption ? Number(consumption.replace(",", ".")) : null,
      consumptionUnit: provider(fd) === "enel" ? "kWh" : provider(fd) === "sabesp" ? "m³" : null,
    })
    .where(eq(schema.bills.id, id));
  refresh();
}

export async function setBillStatus(id: number, status: BillStatus) {
  await requireAdmin();
  const db = await getDb();
  await db
    .update(schema.bills)
    .set(status === "pendente" ? { status, paidAt: null } : { status, paidAt: todaySP() })
    .where(eq(schema.bills.id, id));
  refresh();
}

export async function assignBill(id: number, fd: FormData) {
  await requireAdmin();
  const db = await getDb();
  await db.update(schema.bills).set({ propertyId: intOrNull(str(fd, "propertyId")) }).where(eq(schema.bills.id, id));
  refresh();
}

/** Relê o texto guardado com o leitor atual (útil depois de ajustar o leitor) */
export async function reparseBill(id: number) {
  await requireAdmin();
  const db = await getDb();
  const [bill] = await db.select({ rawText: schema.bills.rawText }).from(schema.bills).where(eq(schema.bills.id, id));
  if (!bill?.rawText) return;
  const p = parseBillText(bill.rawText);
  await db
    .update(schema.bills)
    .set({
      provider: p.provider,
      referenceMonth: p.referenceMonth,
      dueDate: p.dueDate,
      amountCents: p.amountCents,
      digitable: p.digitable,
      pixCode: p.pixCode,
      consumption: p.consumption,
      consumptionUnit: p.consumptionUnit,
      notices: JSON.stringify(p.notices),
    })
    .where(eq(schema.bills.id, id));
  refresh();
}

export async function deleteBill(id: number) {
  await requireAdmin();
  const db = await getDb();
  await db.delete(schema.bills).where(eq(schema.bills.id, id));
  refresh();
  redirect("/admin");
}

// ---------- avisos ----------

export async function createNotice(propertyId: number, fd: FormData) {
  await requireAdmin();
  const title = str(fd, "title");
  if (!title) return;
  const db = await getDb();
  await db.insert(schema.notices).values({ propertyId, provider: provider(fd), title, body: str(fd, "body"), source: "manual" });
  refresh();
}

export async function assignNotice(id: number, fd: FormData) {
  await requireAdmin();
  const propertyId = intOrNull(str(fd, "propertyId"));
  const db = await getDb();
  await db.update(schema.notices).set({ propertyId }).where(eq(schema.notices.id, id));
  refresh();
}

export async function deleteNotice(id: number) {
  await requireAdmin();
  const db = await getDb();
  await db.delete(schema.notices).where(eq(schema.notices.id, id));
  refresh();
}
