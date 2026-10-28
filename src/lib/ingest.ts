import { createHash } from "node:crypto";
import { eq, or } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Property } from "@/db/schema";
import { normalize, parseBillText, textContainsCode, type Provider } from "./parser";
import { pdfToText } from "./pdf";
import { newToken } from "./tokens";

export interface IngestResult {
  status: "created" | "duplicate";
  billId: number;
  propertyId: number | null;
  provider: Provider | null;
}

/** Descobre a qual imóvel a conta pertence pelo nº da instalação (Enel) ou RGI/fornecimento (Sabesp). */
export function matchProperty(
  text: string,
  provider: Provider | null,
  candidates: Pick<Property, "id" | "enelInstallation" | "sabespCode">[],
): number | null {
  for (const p of candidates) {
    const codes =
      provider === "enel" ? [p.enelInstallation] : provider === "sabesp" ? [p.sabespCode] : [p.enelInstallation, p.sabespCode];
    if (codes.some((c) => c && textContainsCode(text, c))) return p.id;
  }
  return null;
}

export async function ingestBillPdf(
  bytes: Uint8Array,
  opts: { filename?: string | null; source: "email" | "upload"; propertyId?: number | null; provider?: Provider | null },
): Promise<IngestResult> {
  const db = await getDb();
  const pdfHash = createHash("sha256").update(bytes).digest("hex");

  const text = await pdfToText(bytes);
  const parsed = parseBillText(text);
  const provider = opts.provider ?? parsed.provider;

  // a mesma conta pode chegar duas vezes (e-mail reenviado, upload manual + e-mail)
  const [existing] = await db
    .select({ id: schema.bills.id, propertyId: schema.bills.propertyId, provider: schema.bills.provider })
    .from(schema.bills)
    .where(
      parsed.digitable
        ? or(eq(schema.bills.pdfHash, pdfHash), eq(schema.bills.digitable, parsed.digitable))
        : eq(schema.bills.pdfHash, pdfHash),
    )
    .limit(1);
  if (existing) {
    return { status: "duplicate", billId: existing.id, propertyId: existing.propertyId, provider: existing.provider };
  }

  let propertyId = opts.propertyId ?? null;
  if (!propertyId) {
    const all = await db
      .select({ id: schema.properties.id, enelInstallation: schema.properties.enelInstallation, sabespCode: schema.properties.sabespCode })
      .from(schema.properties);
    propertyId = matchProperty(text, provider, all);
  }

  const [row] = await db
    .insert(schema.bills)
    .values({
      propertyId,
      provider,
      referenceMonth: parsed.referenceMonth,
      dueDate: parsed.dueDate,
      amountCents: parsed.amountCents,
      digitable: parsed.digitable,
      pixCode: parsed.pixCode,
      consumption: parsed.consumption,
      consumptionUnit: parsed.consumptionUnit,
      notices: JSON.stringify(parsed.notices),
      pdf: Buffer.from(bytes),
      pdfHash,
      pdfFilename: opts.filename ?? null,
      shareToken: newToken(),
      source: opts.source,
      rawText: text.slice(0, 50_000),
    })
    .returning({ id: schema.bills.id });

  return { status: "created", billId: row.id, propertyId, provider };
}

export function providerFromSender(...parts: (string | null | undefined)[]): Provider | null {
  const norm = normalize(parts.filter(Boolean).join(" "));
  if (/enel|eletropaulo/.test(norm)) return "enel";
  if (/sabesp/.test(norm)) return "sabesp";
  return null;
}

/** Aviso recebido por e-mail das distribuidoras (interrupção programada, reajuste, etc.) */
export async function ingestNotice(input: { from?: string; subject: string; body?: string }) {
  const db = await getDb();
  const provider = providerFromSender(input.from, input.subject);
  const body = (input.body ?? "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 4000);
  const all = await db
    .select({ id: schema.properties.id, enelInstallation: schema.properties.enelInstallation, sabespCode: schema.properties.sabespCode })
    .from(schema.properties);
  const propertyId = matchProperty(`${input.subject}\n${body}`, provider, all);
  const [row] = await db
    .insert(schema.notices)
    .values({ propertyId, provider, title: input.subject.slice(0, 200), body, source: "email" })
    .returning({ id: schema.notices.id });
  return { noticeId: row.id, propertyId, provider };
}
