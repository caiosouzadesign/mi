"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import { todaySP } from "@/lib/format";
import { getPropertyByToken } from "@/lib/queries";

const MAX_RECEIPT = 5 * 1024 * 1024;

export async function informPayment(token: string, billId: number, formData: FormData) {
  const property = await getPropertyByToken(token);
  if (!property) throw new Error("Link inválido");

  const file = formData.get("receipt");
  const note = String(formData.get("note") ?? "").trim().slice(0, 500) || null;
  let receipt: Buffer | null = null;
  let receiptMime: string | null = null;
  let receiptFilename: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_RECEIPT) throw new Error("Comprovante muito grande (máx. 5 MB)");
    if (!/^(image\/|application\/pdf)/.test(file.type)) throw new Error("Envie uma imagem ou PDF");
    receipt = Buffer.from(await file.arrayBuffer());
    receiptMime = file.type;
    receiptFilename = file.name;
  }

  const db = await getDb();
  await db
    .update(schema.bills)
    .set({ status: "informado", paidAt: todaySP(), paymentNote: note, receipt, receiptMime, receiptFilename })
    .where(and(eq(schema.bills.id, billId), eq(schema.bills.propertyId, property.id), ne(schema.bills.status, "pago")));
  revalidatePath(`/t/${token}`);
}
