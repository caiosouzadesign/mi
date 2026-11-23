"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import type { BillStatus } from "@/db/schema";
import { checkPassword, clientIp, configProblem, endSession, requireAdmin, startSession } from "@/lib/auth";
import { clearLoginFailures, loginAllowed, recordLoginFailure } from "@/lib/rate-limit";
import { todaySP } from "@/lib/format";
import { ingestBillPdf } from "@/lib/ingest";
import { parseBillText, type Provider } from "@/lib/parser";
import { parseDigitable } from "@/lib/parser/barcode";
import { newToken } from "@/lib/tokens";
import { isPdf, sniffImage } from "@/lib/upload-safety";
import { notifyContractEnding } from "@/lib/contract-notify";
import { notifyNewBill } from "@/lib/bill-notify";
import { refreshSignature, requestSignature } from "@/lib/signature";
import { baseUrl } from "@/lib/url";

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
  revalidatePath("/t/[token]", "layout");
}

// ---------- sessão ----------

export async function login(_: string | null, fd: FormData): Promise<string | null> {
  const problem = configProblem();
  if (problem) return problem;
  const ip = await clientIp();
  const gate = await loginAllowed(ip);
  if (!gate.allowed) return `Muitas tentativas. Tente de novo em ${Math.ceil(gate.retryAfterMs / 60_000)} min.`;
  if (!checkPassword(String(fd.get("password") ?? "").slice(0, 256))) {
    await recordLoginFailure(ip);
    return "Senha incorreta";
  }
  await clearLoginFailures(ip);
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

/**
 * Gera um link novo (ex.: troca de inquilino). O link anterior do portal e todos
 * os links de PDF já compartilhados (contas e documentos) param de funcionar.
 */
export async function regenerateLink(id: number) {
  await requireAdmin();
  const db = await getDb();
  await db.update(schema.properties).set({ accessToken: newToken() }).where(eq(schema.properties.id, id));
  const bills = await db.select({ id: schema.bills.id }).from(schema.bills).where(eq(schema.bills.propertyId, id));
  for (const b of bills) await db.update(schema.bills).set({ shareToken: newToken() }).where(eq(schema.bills.id, b.id));
  const docs = await db.select({ id: schema.documents.id }).from(schema.documents).where(eq(schema.documents.propertyId, id));
  for (const d of docs) await db.update(schema.documents).set({ shareToken: newToken() }).where(eq(schema.documents.id, d.id));
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
  const notify = fd.get("notify") === "on";
  const base = await baseUrl();
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const results: UploadState["results"] = [];
  for (const file of files) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!isPdf(bytes)) throw new Error("não é PDF");
      const r = await ingestBillPdf(bytes, {
        filename: file.name,
        source: "upload",
        propertyId,
        provider: forcedProvider,
      });
      const emailed = notify && r.status === "created" && r.propertyId ? await notifyNewBill(r.billId, base) : false;
      results.push({
        filename: file.name,
        ok: true,
        billId: r.billId,
        message:
          r.status === "duplicate"
            ? "já estava cadastrada"
            : r.propertyId
              ? `importada${emailed ? " e inquilino avisado por e-mail" : ""}`
              : "importada, mas sem imóvel identificado — atribua manualmente",
      });
    } catch (err) {
      results.push({ filename: file.name, ok: false, message: err instanceof Error ? err.message : "erro" });
    }
  }
  refresh();
  return { results };
}

export async function updateBill(id: number, _: string | null, fd: FormData): Promise<string | null> {
  await requireAdmin();
  const digitableInput = str(fd, "digitable");
  const digitable = digitableInput ? digitableInput.replace(/\D/g, "") : null;
  if (digitable && !parseDigitable(digitable)) return "Linha digitável inválida (confira os 48 dígitos)";
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
  return null;
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
  const propertyId = intOrNull(str(fd, "propertyId"));
  // atribuir manualmente é a conferência do proprietário: a conta fica liberada
  await db.update(schema.bills).set({ propertyId, reviewReason: null }).where(eq(schema.bills.id, id));
  if (propertyId) await notifyNewBill(id, await baseUrl());
  refresh();
}

/** Libera para o inquilino uma conta que estava em revisão anti-fraude */
export async function approveBill(id: number) {
  await requireAdmin();
  const db = await getDb();
  await db.update(schema.bills).set({ reviewReason: null }).where(eq(schema.bills.id, id));
  await notifyNewBill(id, await baseUrl());
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

// ---------- contrato ----------

export async function updateContract(id: number, fd: FormData) {
  await requireAdmin();
  const db = await getDb();
  const [current] = await db.select({ end: schema.properties.contractEnd }).from(schema.properties).where(eq(schema.properties.id, id));
  const contractEnd = str(fd, "contractEnd");
  await db
    .update(schema.properties)
    .set({
      contractStart: str(fd, "contractStart"),
      contractEnd,
      rentCents: moneyToCents(str(fd, "rent")),
      // nova data de fim (ex.: renovação) recomeça os lembretes automáticos
      ...(current?.end !== contractEnd ? { contractReminderStage: null } : {}),
    })
    .where(eq(schema.properties.id, id));
  refresh();
}

export interface NotifyState {
  done: boolean;
  email?: boolean;
  error?: string;
}

export async function notifyContract(id: number, _: NotifyState, fd: FormData): Promise<NotifyState> {
  void fd;
  await requireAdmin();
  const db = await getDb();
  const [property] = await db.select().from(schema.properties).where(eq(schema.properties.id, id));
  if (!property) return { done: false, error: "Imóvel não encontrado" };
  try {
    const { email } = await notifyContractEnding(property, `${await baseUrl()}/t/${property.accessToken}/imovel`);
    refresh();
    return { done: true, email };
  } catch (err) {
    return { done: false, error: err instanceof Error ? err.message : "Erro ao notificar" };
  }
}

// ---------- documentos e assinatura ----------

const MAX_PDF = 10 * 1024 * 1024;

export type ActionResult = string | null;

export async function uploadDocument(propertyId: number, _: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return "Escolha um PDF";
  if (file.size > MAX_PDF) return "PDF muito grande (máx. 10 MB)";
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!isPdf(bytes)) return "Envie um arquivo PDF";
  const kind = str(fd, "kind");
  const db = await getDb();
  const [row] = await db
    .insert(schema.documents)
    .values({
      propertyId,
      kind: kind === "contrato" || kind === "aditivo" || kind === "vistoria" ? kind : "outro",
      title: str(fd, "title") ?? file.name.replace(/\.pdf$/i, ""),
      file: bytes,
      filename: file.name.slice(0, 120),
      visibleToTenant: fd.get("visibleToTenant") === "on",
      shareToken: newToken(),
    })
    .returning({ id: schema.documents.id });
  let error: ActionResult = null;
  if (fd.get("sign") === "on") {
    try {
      await requestSignature(row.id);
    } catch (err) {
      error = `Documento salvo, mas não foi enviado para assinatura: ${err instanceof Error ? err.message : err}`;
    }
  }
  refresh();
  return error;
}

export async function sendForSignature(documentId: number): Promise<ActionResult> {
  await requireAdmin();
  try {
    await requestSignature(documentId);
    refresh();
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "Erro ao enviar para assinatura";
  }
}

export async function refreshDocument(documentId: number): Promise<ActionResult> {
  await requireAdmin();
  try {
    await refreshSignature(documentId);
    refresh();
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "Erro ao consultar a assinatura";
  }
}

/** Para documentos assinados fora do sistema (papel ou outro serviço) */
export async function markDocumentSigned(documentId: number, _: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const file = fd.get("signedFile");
  const signedFile = file instanceof File && file.size > 0 ? Buffer.from(await file.arrayBuffer()) : undefined;
  if (signedFile && (signedFile.length > MAX_PDF || !isPdf(signedFile))) return "Envie o documento assinado em PDF (máx. 10 MB)";
  const db = await getDb();
  await db
    .update(schema.documents)
    .set({ signatureStatus: "signed", signedAt: todaySP(), signatureProvider: "manual", ...(signedFile ? { signedFile } : {}) })
    .where(eq(schema.documents.id, documentId));
  refresh();
  return null;
}

export async function toggleDocumentVisibility(documentId: number) {
  await requireAdmin();
  const db = await getDb();
  const [doc] = await db.select({ v: schema.documents.visibleToTenant }).from(schema.documents).where(eq(schema.documents.id, documentId));
  if (doc) await db.update(schema.documents).set({ visibleToTenant: !doc.v }).where(eq(schema.documents.id, documentId));
  refresh();
}

export async function deleteDocument(documentId: number) {
  await requireAdmin();
  const db = await getDb();
  await db.delete(schema.documents).where(eq(schema.documents.id, documentId));
  refresh();
}

// ---------- fotos ----------

const MAX_PHOTO = 4 * 1024 * 1024;

export async function uploadPhotos(propertyId: number, _: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const files = fd.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return "Escolha ao menos uma foto";
  const dims: { w?: number; h?: number }[] = JSON.parse(String(fd.get("dims") ?? "[]"));
  const caption = str(fd, "caption");
  const db = await getDb();
  const [last] = await db
    .select({ max: sql<number>`COALESCE(MAX(${schema.photos.position}), 0)` })
    .from(schema.photos)
    .where(eq(schema.photos.propertyId, propertyId));
  let position = last?.max ?? 0;
  const skipped: string[] = [];
  for (const [i, file] of files.entries()) {
    const image = Buffer.from(await file.arrayBuffer());
    const mime = file.size <= MAX_PHOTO ? sniffImage(image) : null;
    if (!mime) {
      skipped.push(file.name);
      continue;
    }
    await db.insert(schema.photos).values({
      propertyId,
      image,
      mime,
      caption,
      width: dims[i]?.w ?? null,
      height: dims[i]?.h ?? null,
      position: ++position,
    });
  }
  refresh();
  return skipped.length ? `Não foram enviadas (não são imagens ou passam de 4 MB): ${skipped.join(", ")}` : null;
}

export async function updatePhotoCaption(photoId: number, fd: FormData) {
  await requireAdmin();
  const db = await getDb();
  await db.update(schema.photos).set({ caption: str(fd, "caption") }).where(eq(schema.photos.id, photoId));
  refresh();
}

/** Coloca a foto em primeiro (ela aparece em destaque para o inquilino) */
export async function setCoverPhoto(photoId: number) {
  await requireAdmin();
  const db = await getDb();
  const [photo] = await db.select({ propertyId: schema.photos.propertyId }).from(schema.photos).where(eq(schema.photos.id, photoId));
  if (!photo) return;
  const [first] = await db
    .select({ min: sql<number>`COALESCE(MIN(${schema.photos.position}), 0)` })
    .from(schema.photos)
    .where(eq(schema.photos.propertyId, photo.propertyId));
  await db.update(schema.photos).set({ position: (first?.min ?? 0) - 1 }).where(eq(schema.photos.id, photoId));
  refresh();
}

export async function deletePhoto(photoId: number) {
  await requireAdmin();
  const db = await getDb();
  await db.delete(schema.photos).where(eq(schema.photos.id, photoId));
  refresh();
}
