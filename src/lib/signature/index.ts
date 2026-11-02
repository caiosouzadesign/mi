import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { todaySP } from "../format";
import { createDocument, getDocument, zapsignConfigured, type RemoteDoc } from "./zapsign";

export { zapsignConfigured as signatureConfigured };

/** Envia um documento do imóvel para assinatura do inquilino (e do proprietário, se configurado) */
export async function requestSignature(documentId: number) {
  const db = await getDb();
  const [doc] = await db.select().from(schema.documents).where(eq(schema.documents.id, documentId));
  if (!doc) throw new Error("Documento não encontrado");
  const [property] = await db.select().from(schema.properties).where(eq(schema.properties.id, doc.propertyId));
  if (!property?.tenantName) throw new Error("Cadastre o nome do inquilino antes de enviar para assinatura");
  if (!property.tenantEmail && !property.tenantPhone) throw new Error("Cadastre o e-mail ou WhatsApp do inquilino");

  const signers = [{ name: property.tenantName, email: property.tenantEmail, phone: property.tenantPhone, notifyByEmail: true }];
  if (process.env.OWNER_NAME) {
    signers.push({ name: process.env.OWNER_NAME, email: process.env.OWNER_EMAIL ?? null, phone: process.env.OWNER_PHONE ?? null, notifyByEmail: true });
  }
  const remote = await createDocument({ name: `${doc.title} — ${property.name}`, pdf: doc.file, signers, externalId: `doc-${doc.id}` });
  await applyRemote(doc.id, remote, property.tenantName);
}

async function applyRemote(documentId: number, remote: RemoteDoc, tenantName: string | null) {
  const db = await getDb();
  const tenant = remote.signers.find((s) => s.name === tenantName) ?? remote.signers[0];
  const owner = remote.signers.find((s) => s !== tenant);
  let signedFile: Buffer | null = null;
  if (remote.status === "signed" && remote.signedFileUrl) {
    const res = await fetch(remote.signedFileUrl);
    if (res.ok) signedFile = Buffer.from(await res.arrayBuffer());
  }
  await db
    .update(schema.documents)
    .set({
      signatureProvider: "zapsign",
      signatureRef: remote.ref,
      signatureStatus: remote.status,
      tenantSignUrl: tenant?.signUrl ?? null,
      ownerSignUrl: owner?.signUrl ?? null,
      ...(remote.status === "signed" ? { signedAt: todaySP() } : {}),
      ...(signedFile ? { signedFile } : {}),
    })
    .where(eq(schema.documents.id, documentId));
}

/** Atualiza o status consultando a ZapSign (usado pelo webhook, pelo lembrete diário e pelo botão no painel) */
export async function refreshSignature(documentId: number) {
  const db = await getDb();
  const [doc] = await db
    .select({ id: schema.documents.id, ref: schema.documents.signatureRef, propertyId: schema.documents.propertyId, status: schema.documents.signatureStatus })
    .from(schema.documents)
    .where(eq(schema.documents.id, documentId));
  if (!doc?.ref || doc.status === "signed") return;
  const [property] = await db.select({ tenantName: schema.properties.tenantName }).from(schema.properties).where(eq(schema.properties.id, doc.propertyId));
  await applyRemote(doc.id, await getDocument(doc.ref), property?.tenantName ?? null);
}

export async function refreshSignatureByRef(ref: string) {
  const db = await getDb();
  const [doc] = await db.select({ id: schema.documents.id }).from(schema.documents).where(eq(schema.documents.signatureRef, ref));
  if (doc) await refreshSignature(doc.id);
  return !!doc;
}
