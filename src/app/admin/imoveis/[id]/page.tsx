import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { brDate, whatsappNumber } from "@/lib/format";
import { billsForProperty, noticesForProperty } from "@/lib/queries";
import { baseUrl } from "@/lib/url";
import { billWhatsappLink } from "@/lib/whatsapp";
import { AdminBillRow } from "@/components/AdminBillRow";
import { PROVIDER_META } from "@/components/BillCard";
import { CopyButton } from "@/components/CopyButton";
import { Icon } from "@/components/Icon";
import { PropertyFields } from "@/components/PropertyFields";
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
    <div className="layout">
      <div className="col">
        <section className="hero">
          <div className="stack-sm">
            <span className="eyebrow">Link do inquilino</span>
            <span className="mono" style={{ color: "#fff", opacity: 0.9 }}>
              {link}
            </span>
          </div>
          <div className="btn-row">
            <CopyButton className="btn primary" value={link} label="Copiar link" icon="link" />
            {wa && (
              <a className="btn" href={`https://wa.me/${wa}?text=${encodeURIComponent(`Suas contas de água e luz: ${link}`)}`} target="_blank" rel="noopener noreferrer">
                <Icon name="chat" size={18} />
                WhatsApp
              </a>
            )}
            <a className="btn" href={link} target="_blank" rel="noopener noreferrer">
              <Icon name="eye" size={18} />
              Abrir
            </a>
          </div>
        </section>

        <section className="card">
          <div className="row between">
            <h2>Contas</h2>
            <span className="tiny">{bills.length}</span>
          </div>
          {bills.length === 0 ? (
            <p className="muted small">Nenhuma conta ainda.</p>
          ) : (
            <div className="list">
              {bills.map((b) => (
                <AdminBillRow key={b.id} bill={b} showConsumption whatsapp={billWhatsappLink(b, property, base)} />
              ))}
            </div>
          )}
        </section>
      </div>

      <aside className="col side">
        <section className="card">
          <h2>Avisos para o inquilino</h2>
          {notices.length > 0 && (
            <div className="list">
              {notices.map((n) => (
                <div key={n.id} className="list-row">
                  <span className={`tile sm ${n.provider ?? "info"}`}>
                    <Icon name={n.provider ? PROVIDER_META[n.provider].icon : "bell"} size={17} />
                  </span>
                  <div className="meta">
                    <span className="title">{n.title}</span>
                    <span className="tiny">
                      {brDate(n.createdAt)} · {n.source === "email" ? "e-mail" : "manual"}
                    </span>
                  </div>
                  <form action={deleteNotice.bind(null, n.id)}>
                    <button className="icon-btn" type="submit" aria-label="Remover aviso" title="Remover">
                      <Icon name="trash" size={17} />
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
          <details className="disclosure">
            <summary className="small">
              <Icon name="chevron" size={16} />
              Novo aviso
            </summary>
            <form action={createNotice.bind(null, id)} className="stack" style={{ gap: 14 }}>
              <label className="field">
                Título
                <input name="title" required placeholder="Ex.: Falta de água programada dia 12" />
              </label>
              <label className="field">
                Distribuidora
                <select name="provider" defaultValue="">
                  <option value="">Nenhuma</option>
                  <option value="enel">Enel</option>
                  <option value="sabesp">Sabesp</option>
                </select>
              </label>
              <label className="field">
                Detalhes
                <textarea name="body" />
              </label>
              <SubmitButton className="btn primary">Publicar aviso</SubmitButton>
            </form>
          </details>
        </section>

        <section className="card">
          <h2>Dados do imóvel</h2>
          <form action={updateProperty.bind(null, id)} className="stack" style={{ gap: 18 }}>
            <PropertyFields values={property} />
            <SubmitButton className="btn primary" pendingText="Salvando…">
              Salvar alterações
            </SubmitButton>
          </form>
          <hr className="divider" />
          <div className="stack-sm">
            <form action={regenerateLink.bind(null, id)}>
              <button className="btn sm ghost" type="submit">
                <Icon name="refresh" size={16} />
                Gerar novo link (invalida o atual e os PDFs já enviados)
              </button>
            </form>
            <form action={deleteProperty.bind(null, id)}>
              <button className="btn sm ghost danger" type="submit">
                <Icon name="trash" size={16} />
                Excluir imóvel
              </button>
            </form>
          </div>
        </section>
      </aside>
    </div>
  );
}
