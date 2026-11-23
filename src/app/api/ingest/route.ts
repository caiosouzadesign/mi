import { notifyNewBill } from "@/lib/bill-notify";
import { ingestBillPdf, ingestNotice, providerFromSender } from "@/lib/ingest";
import { baseUrl } from "@/lib/url";
import { bearerMatches } from "@/lib/crypto";
import { isPdf } from "@/lib/upload-safety";

/**
 * Recebe contas e avisos do Google Apps Script que lê o Gmail do proprietário
 * (scripts/gmail-apps-script.gs).
 */
export const maxDuration = 60;

/** PDFs de conta têm poucas centenas de KB; acima disso é erro ou abuso */
const MAX_BODY = 15 * 1024 * 1024;

type Payload =
  | { type: "bill"; filename?: string; contentBase64: string; from?: string; subject?: string }
  | { type: "notice"; from?: string; subject: string; body?: string };

export async function POST(request: Request) {
  if (!bearerMatches(request, process.env.INGEST_SECRET)) return Response.json({ error: "não autorizado" }, { status: 401 });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) return Response.json({ error: "arquivo grande demais" }, { status: 413 });

  let payload: Payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  try {
    if (payload.type === "bill") {
      const bytes = new Uint8Array(Buffer.from(String(payload.contentBase64 ?? ""), "base64"));
      if (bytes.length > MAX_BODY || !isPdf(bytes)) return Response.json({ error: "o anexo não é um PDF válido" }, { status: 422 });
      const result = await ingestBillPdf(bytes, {
        filename: payload.filename,
        source: "email",
        provider: providerFromSender(payload.from, payload.subject),
      });
      const notified =
        result.status === "created" && result.propertyId && result.review.length === 0 ? await notifyNewBill(result.billId, await baseUrl()) : false;
      return Response.json({ ...result, notified });
    }
    if (payload.type === "notice" && payload.subject) {
      return Response.json(await ingestNotice(payload));
    }
    return Response.json({ error: "tipo desconhecido" }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "erro" }, { status: 422 });
  }
}
