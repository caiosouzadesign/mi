import { timingSafeEqual } from "node:crypto";
import { ingestBillPdf, ingestNotice, providerFromSender } from "@/lib/ingest";

/**
 * Recebe contas e avisos do Google Apps Script que lê o Gmail do proprietário
 * (scripts/gmail-apps-script.gs).
 */
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.INGEST_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

type Payload =
  | { type: "bill"; filename?: string; contentBase64: string; from?: string; subject?: string }
  | { type: "notice"; from?: string; subject: string; body?: string };

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "não autorizado" }, { status: 401 });

  let payload: Payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  try {
    if (payload.type === "bill") {
      const bytes = new Uint8Array(Buffer.from(payload.contentBase64, "base64"));
      const result = await ingestBillPdf(bytes, {
        filename: payload.filename,
        source: "email",
        provider: providerFromSender(payload.from, payload.subject),
      });
      return Response.json(result);
    }
    if (payload.type === "notice" && payload.subject) {
      return Response.json(await ingestNotice(payload));
    }
    return Response.json({ error: "tipo desconhecido" }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "erro" }, { status: 422 });
  }
}
