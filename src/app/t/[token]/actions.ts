"use server";

import { and, eq, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import { todaySP } from "@/lib/format";
import { getPropertyByToken } from "@/lib/queries";
import { sniffMime } from "@/lib/upload-safety";

const MAX_RECEIPT = 5 * 1024 * 1024;

/** Devolve uma mensagem de erro para o formulário, ou null se deu certo */
export async function informPayment(token: string, billId: number, _: string | null, formData: FormData): Promise<string | null> {
  const property = await getPropertyByToken(token);
  if (!property) return "Link inválido";

  const file = formData.get("receipt");
  const note = String(formData.get("note") ?? "").trim().slice(0, 500) || null;
  let receipt: Buffer | null = null;
  let receiptMime: string | null = null;
  let receiptFilename: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_RECEIPT) return "Comprovante muito grande (máx. 5 MB)";
    receipt = Buffer.from(await file.arrayBuffer());
    // o tipo vem dos bytes do arquivo, não do que o navegador declara
    receiptMime = sniffMime(receipt);
    if (!receiptMime) return "Envie uma foto (JPG, PNG, WEBP, HEIC) ou um PDF";
    receiptFilename = file.name.slice(0, 120);
  }

  const db = await getDb();
  await db
    .update(schema.bills)
    .set({ status: "informado", paidAt: todaySP(), paymentNote: note, receipt, receiptMime, receiptFilename })
    .where(
      and(
        eq(schema.bills.id, Number(billId)),
        eq(schema.bills.propertyId, property.id),
        ne(schema.bills.status, "pago"),
        // conta em revisão anti-fraude não existe para o inquilino
        isNull(schema.bills.reviewReason),
      ),
    );
  revalidatePath(`/t/${token}`);
  return null;
}
