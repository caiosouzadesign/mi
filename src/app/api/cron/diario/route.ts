import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { sendDueReminders } from "@/lib/bill-notify";
import { sendDueContractReminders } from "@/lib/contract-notify";
import { refreshSignature, signatureConfigured } from "@/lib/signature";
import { baseUrl } from "@/lib/url";
import { bearerMatches } from "@/lib/crypto";

/**
 * Rotina diária (Vercel Cron, ver vercel.json): lembretes de vencimento das
 * contas, lembretes de fim de contrato e atualização das assinaturas
 * pendentes, caso algum webhook se perca.
 */
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!bearerMatches(request, process.env.CRON_SECRET)) {
    return Response.json({ error: "não autorizado" }, { status: 401 });
  }
  const base = await baseUrl();
  const reminders = await sendDueContractReminders(base);
  const dueReminders = await sendDueReminders(base);
  let signatures = 0;
  if (signatureConfigured()) {
    const db = await getDb();
    const pending = await db.select({ id: schema.documents.id }).from(schema.documents).where(eq(schema.documents.signatureStatus, "pending"));
    for (const doc of pending) {
      try {
        await refreshSignature(doc.id);
        signatures++;
      } catch (err) {
        console.error("Falha ao atualizar assinatura", doc.id, err);
      }
    }
  }
  return Response.json({ reminders, dueReminders, signatures });
}
