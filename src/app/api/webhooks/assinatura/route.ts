import { timingSafeEqual } from "node:crypto";
import { refreshSignatureByRef } from "@/lib/signature";
import { documentRefs } from "@/lib/signature/webhook";

/**
 * Webhook da ZapSign. Configure no painel deles a URL
 * https://SEU-SITE/api/webhooks/assinatura?secret=SIGNATURE_WEBHOOK_SECRET
 *
 * O corpo só é usado para descobrir qual documento mudou; o status oficial é
 * sempre consultado na API da ZapSign, então um aviso falso não altera nada.
 */
function authorized(request: Request) {
  const expected = process.env.SIGNATURE_WEBHOOK_SECRET;
  const got = new URL(request.url).searchParams.get("secret") ?? "";
  if (!expected) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "não autorizado" }, { status: 401 });
  const body = await request.json().catch(() => null);
  let updated = 0;
  for (const ref of documentRefs(body)) {
    try {
      if (await refreshSignatureByRef(ref)) updated++;
    } catch (err) {
      console.error("Falha ao atualizar assinatura", ref, err);
    }
  }
  return Response.json({ updated });
}
