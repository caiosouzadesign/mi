import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { sendDueContractReminders } from "@/lib/contract-notify";
import { refreshSignature, signatureConfigured } from "@/lib/signature";
import { baseUrl } from "@/lib/url";

/**
 * Rotina diária (Vercel Cron, ver vercel.json): lembretes de fim de contrato e
 * atualização das assinaturas pendentes, caso algum webhook se perca.
 */
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "não autorizado" }, { status: 401 });
  }
  const reminders = await sendDueContractReminders(await baseUrl());
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
  return Response.json({ reminders, signatures });
}
