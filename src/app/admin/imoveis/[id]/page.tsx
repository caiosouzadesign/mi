import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { brDate, whatsappNumber } from "@/lib/format";
import { billsForProperty, noticesForProperty } from "@/lib/queries";
import { baseUrl } from "@/lib/url";
import { CopyButton } from "@/components/CopyButton";
import { PropertyFields } from "@/components/PropertyFields";
import { AdminBillRow } from "@/components/AdminBillRow";
import { SubmitButton } from "@/components/SubmitButton";
import { createNotice, deleteNotice, deleteProperty, regenerateLink, updateProperty } from "../../actions";

export const dynamic = "force-dynamic";

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = Number((await params).id);
  const db = await getDb();
  const [property] = await db.select().from(schema.properties).where(eq(schema.properties.id, id));
  if (!property) notFound();
  const [bills, notices, base] = await Promise.all([billsForProperty(id), noticesForProperty(id), baseUrl()]);
  const link = `${base}/t/${property.accessToken}`;
  const wa = whatsappNumber(property.tenantPhone);

  return (
    <main className="container wide">
      <p className="small">
        <Link href="/admin">← Painel</Link>
      </p>
      <h1>{property.name}</h1>

      <section className="card">
        <h2>Link do inquilino</h2>
        <p className="mono small">{link}</p>
        <div className="row">
          <CopyButton className="btn sm" value={link} label="Copiar link" />
          <a className="btn sm" href={link} target="_blank" rel="noopener noreferrer">
            Abrir como inquilino
          </a>
          {wa && (
            <a
              className="btn sm"
              href={`https://wa.me/${wa}?text=${encodeURIComponent(`Suas contas de água e luz: ${link}`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Enviar no WhatsApp
            </a>
          )}
          <form action={regenerateLink.bind(null, id)}>
            <button className="btn sm danger" type="submit">
              Gerar novo link (invalida o atual)
            </button>
          </form>
        </div>
      </section>

      <section className="card">
        <h2>Contas</h2>
        {bills.length === 0 && <p className="muted small">Nenhuma conta ainda.</p>}
        {bills.map((b) => (
          <AdminBillRow key={b.id} bill={b} showConsumption />
        ))}
      </section>

      <section className="card">
        <h2>Avisos para o inquilino</h2>
        {notices.map((n) => (
          <div key={n.id} className="row between">
            <span>
              <strong>{n.title}</strong> <span className="tiny">{brDate(n.createdAt)} · {n.source === "email" ? "e-mail" : "manual"}</span>
            </span>
            <form action={deleteNotice.bind(null, n.id)}>
              <button className="btn sm danger" type="submit">
                Remover
              </button>
            </form>
          </div>
        ))}
        <details>
          <summary>Novo aviso</summary>
          <form action={createNotice.bind(null, id)} className="stack">
            <div className="form-grid">
              <label>
                Título
                <input name="title" required placeholder="Ex.: Falta de água programada dia 12" />
              </label>
              <label>
                Distribuidora
                <select name="provider" defaultValue="">
                  <option value="">Nenhuma</option>
                  <option value="enel">Enel</option>
                  <option value="sabesp">Sabesp</option>
                </select>
              </label>
            </div>
            <label>
              Detalhes
              <textarea name="body" />
            </label>
            <SubmitButton>Publicar aviso</SubmitButton>
          </form>
        </details>
      </section>

      <section className="card">
        <h2>Dados do imóvel</h2>
        <form action={updateProperty.bind(null, id)} className="stack">
          <PropertyFields values={property} />
          <SubmitButton pendingText="Salvando…">Salvar</SubmitButton>
        </form>
        <form action={deleteProperty.bind(null, id)}>
          <button className="btn sm danger" type="submit">
            Excluir imóvel
          </button>
        </form>
      </section>
    </main>
  );
}
