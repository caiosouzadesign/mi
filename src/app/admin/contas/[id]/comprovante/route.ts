import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { isAdmin } from "@/lib/auth";
import { fileResponse } from "@/lib/files";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new Response("Não autorizado", { status: 401 });
  const db = await getDb();
  const [bill] = await db
    .select({ receipt: schema.bills.receipt, mime: schema.bills.receiptMime, filename: schema.bills.receiptFilename })
    .from(schema.bills)
    .where(eq(schema.bills.id, Number((await params).id)));
  if (!bill?.receipt) return new Response("Sem comprovante", { status: 404 });
  return fileResponse(bill.receipt, bill.mime ?? "application/octet-stream", bill.filename ?? "comprovante", false);
}
