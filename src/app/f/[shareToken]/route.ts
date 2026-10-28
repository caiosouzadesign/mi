import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { billFilename, pdfResponse } from "@/lib/files";

/** PDF de uma única conta, pelo link compartilhável dela */
export async function GET(request: Request, { params }: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = await params;
  const db = await getDb();
  const [bill] = await db
    .select({ pdf: schema.bills.pdf, provider: schema.bills.provider, referenceMonth: schema.bills.referenceMonth })
    .from(schema.bills)
    .where(eq(schema.bills.shareToken, shareToken))
    .limit(1);
  if (!bill?.pdf) return new Response("Conta não encontrada", { status: 404 });
  const download = new URL(request.url).searchParams.has("download");
  return pdfResponse(bill.pdf, billFilename(bill), download);
}

