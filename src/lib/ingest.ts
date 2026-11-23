import { createHash } from "node:crypto";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Property } from "@/db/schema";
import { normalize, parseBillText, textContainsCode, type Provider } from "./parser";
import { pdfToText } from "./pdf";
import { newToken } from "./tokens";
import { reviewReasons } from "./fraud";
import { summarizeNotice } from "./summarize";

export interface IngestResult {
  status: "created" | "duplicate";
  billId: number;
  propertyId: number | null;
  provider: Provider | null;
  /** motivos para revisar antes de liberar ao inquilino (vazio = liberada) */
  review: string[];
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
    return { status: "duplicate", billId: existing.id, propertyId: existing.propertyId, provider: existing.provider, review: [] };
  }

  let propertyId = opts.propertyId ?? null;
  if (!propertyId) {
    const all = await db
      .select({ id: schema.properties.id, enelInstallation: schema.properties.enelInstallation, sabespCode: schema.properties.sabespCode })
      .from(schema.properties);
    propertyId = matchProperty(text, provider, all);
  }

  // contas que chegam por e-mail passam pela checagem de boleto falso; o upload
  // manual é do próprio proprietário
  let review: string[] = [];
  if (opts.source === "email" && propertyId) {
    const history = await db
      .select({ digitable: schema.bills.digitable, amountCents: schema.bills.amountCents })
      .from(schema.bills)
      .where(
        and(
          eq(schema.bills.propertyId, propertyId),
          provider ? eq(schema.bills.provider, provider) : isNull(schema.bills.provider),
          isNull(schema.bills.reviewReason),
        ),
      )
      .orderBy(desc(schema.bills.id))
      .limit(6);
    review = reviewReasons({ provider, digitable: parsed.digitable, amountCents: parsed.amountCents }, history);
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
      reviewReason: review.length ? review.join(" · ") : null,
    })
    .returning({ id: schema.bills.id });

  return { status: "created", billId: row.id, propertyId, provider, review };
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
  const suggestedPropertyId = matchProperty(`${input.subject}\n${body}`, provider, all);
  const summary = await summarizeNotice({ subject: input.subject, body, provider });
  // avisos de e-mail nunca aparecem direto para o inquilino: o proprietário publica
  const [row] = await db
    .insert(schema.notices)
    .values({
      propertyId: null,
      suggestedPropertyId,
      provider,
      title: summary.title || input.subject.slice(0, 200),
      body,
      summary: summary.summary,
      eventInfo: summary.eventInfo,
      summarySource: summary.source,
      source: "email",
    })
    .returning({ id: schema.notices.id });
  return { noticeId: row.id, suggestedPropertyId, provider, summary: summary.source };
}
