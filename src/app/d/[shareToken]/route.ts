import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { pdfResponse } from "@/lib/files";

/** PDF de um documento do imóvel (versão assinada, quando houver) pelo link dele */
export async function GET(request: Request, { params }: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = await params;
  const db = await getDb();
  const [doc] = await db
    .select({ file: schema.documents.file, signedFile: schema.documents.signedFile, title: schema.documents.title })
    .from(schema.documents)
    .where(eq(schema.documents.shareToken, shareToken))
    .limit(1);
  if (!doc) return new Response("Documento não encontrado", { status: 404 });
  const url = new URL(request.url);
  const original = url.searchParams.has("original");
  const bytes = !original && doc.signedFile ? doc.signedFile : doc.file;
  const name = `${doc.title}${!original && doc.signedFile ? " (assinado)" : ""}.pdf`;
  return pdfResponse(bytes, name, url.searchParams.has("download"));
}
