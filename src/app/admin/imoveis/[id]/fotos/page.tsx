import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { Icon } from "@/components/Icon";
import { SubmitButton } from "@/components/SubmitButton";
import { requireAdmin } from "@/lib/auth";
import { photosForProperty } from "@/lib/queries";
import { deletePhoto, setCoverPhoto, updatePhotoCaption, uploadPhotos } from "../../../actions";
import { PhotoUploader } from "../../PhotoUploader";

export const dynamic = "force-dynamic";

export default async function PhotosPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = Number((await params).id);
  const db = await getDb();
  const [property] = await db.select({ token: schema.properties.accessToken }).from(schema.properties).where(eq(schema.properties.id, id));
  if (!property) notFound();
  const photos = await photosForProperty(id);

  return (
    <div className="layout">
      <section className="card">
        <div className="row between">
          <h2>Fotos do imóvel</h2>
          <span className="tiny">{photos.length}</span>
        </div>
        {photos.length === 0 ? (
          <p className="small muted">Nenhuma foto ainda. A primeira aparece em destaque para o inquilino.</p>
        ) : (
          <div className="photo-admin">
            {photos.map((p, i) => (
              <div key={p.id} className="panel item">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/t/${property.token}/fotos/${p.id}`} alt={p.caption ?? ""} loading="lazy" />
                <form action={updatePhotoCaption.bind(null, p.id)} className="row" style={{ flexWrap: "nowrap", gap: 6 }}>
                  <input name="caption" defaultValue={p.caption ?? ""} placeholder="Legenda" style={{ minHeight: 36, padding: "6px 10px" }} />
                  <SubmitButton className="btn sm" pendingText="…">
                    <Icon name="check" size={16} />
                  </SubmitButton>
                </form>
                <div className="row between">
                  {i === 0 ? (
                    <span className="chip plain">Capa</span>
                  ) : (
                    <form action={setCoverPhoto.bind(null, p.id)}>
                      <button className="btn sm ghost" type="submit">
                        Usar como capa
                      </button>
                    </form>
                  )}
                  <form action={deletePhoto.bind(null, p.id)}>
                    <button className="icon-btn" type="submit" aria-label="Excluir foto" title="Excluir">
                      <Icon name="trash" size={17} />
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <aside className="col side">
        <section className="card">
          <h2>Adicionar fotos</h2>
          <PhotoUploader action={uploadPhotos.bind(null, id)} />
        </section>
      </aside>
    </div>
  );
}
