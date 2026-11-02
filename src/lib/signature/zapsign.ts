/**
 * Assinatura eletrônica via ZapSign (https://zapsign.com.br) — válida no Brasil
 * (MP 2.200-2/2001, Lei 14.063/2020). Mesmo fluxo de um DocuSign: o documento é
 * enviado, cada signatário recebe um link e o PDF assinado volta para cá.
 */

export interface Signer {
  name: string;
  email?: string | null;
  phone?: string | null;
  /** se true, a ZapSign manda o link de assinatura por e-mail */
  notifyByEmail?: boolean;
}

export interface RemoteDoc {
  ref: string;
  status: "pending" | "signed" | "refused";
  signers: { name: string; email: string | null; status: string; signUrl: string | null }[];
  signedFileUrl: string | null;
}

export function zapsignConfigured(): boolean {
  return !!process.env.ZAPSIGN_API_TOKEN;
}

function sandbox() {
  return process.env.ZAPSIGN_SANDBOX === "true";
}

function apiBase() {
  return sandbox() ? "https://sandbox.api.zapsign.com.br" : "https://api.zapsign.com.br";
}

async function request(path: string, init: RequestInit = {}) {
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.ZAPSIGN_API_TOKEN}`, "Content-Type": "application/json", ...init.headers },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`ZapSign respondeu ${res.status}: ${body.slice(0, 300)}`);
  return JSON.parse(body) as Record<string, unknown>;
}

/** Interpreta a resposta da ZapSign de forma tolerante (campos opcionais podem faltar) */
export function parseRemoteDoc(raw: Record<string, unknown>): RemoteDoc {
  const signers = Array.isArray(raw.signers) ? (raw.signers as Record<string, unknown>[]) : [];
  const status = String(raw.status ?? "pending");
  return {
    ref: String(raw.token ?? raw.document_token ?? ""),
    status: status === "signed" ? "signed" : status === "refused" ? "refused" : "pending",
    signers: signers.map((s) => ({
      name: String(s.name ?? ""),
      email: s.email ? String(s.email) : null,
      status: String(s.status ?? "new"),
      signUrl: s.sign_url
        ? String(s.sign_url)
        : s.token
          ? `https://${sandbox() ? "sandbox." : ""}app.zapsign.com.br/verificar/${s.token}`
          : null,
    })),
    signedFileUrl: raw.signed_file ? String(raw.signed_file) : null,
  };
}

export async function createDocument(input: { name: string; pdf: Uint8Array; signers: Signer[]; externalId: string }): Promise<RemoteDoc> {
  const raw = await request("/api/v1/docs/", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      base64_pdf: Buffer.from(input.pdf).toString("base64"),
      lang: "pt-br",
      external_id: input.externalId,
      signers: input.signers.map((s) => {
        const phone = (s.phone ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
        return {
          name: s.name,
          ...(s.email ? { email: s.email } : {}),
          ...(phone ? { phone_country: "55", phone_number: phone } : {}),
          auth_mode: "assinaturaTela",
          send_automatic_email: !!(s.notifyByEmail && s.email),
        };
      }),
    }),
  });
  return parseRemoteDoc(raw);
}

export async function getDocument(ref: string): Promise<RemoteDoc> {
  return parseRemoteDoc(await request(`/api/v1/docs/${encodeURIComponent(ref)}/`));
}
