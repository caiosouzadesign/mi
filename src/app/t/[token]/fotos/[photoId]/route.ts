import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { fileResponse } from "@/lib/files";
import { getPropertyByToken } from "@/lib/queries";

/** Foto do imóvel; só abre com o link do inquilino daquele imóvel */
export async function GET(_: Request, { params }: { params: Promise<{ token: string; photoId: string }> }) {
  const { token, photoId } = await params;
  const property = await getPropertyByToken(token);
  if (!property) return new Response("Não encontrado", { status: 404 });
  const db = await getDb();
  const [photo] = await db
    .select({ image: schema.photos.image, caption: schema.photos.caption })
    .from(schema.photos)
    .where(and(eq(schema.photos.id, Number(photoId)), eq(schema.photos.propertyId, property.id)));
  if (!photo) return new Response("Não encontrado", { status: 404 });
  return fileResponse(photo.image, `${photo.caption ?? "foto"}`, false, "private, max-age=86400");
}
