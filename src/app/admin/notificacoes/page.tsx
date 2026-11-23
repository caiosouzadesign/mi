import Link from "next/link";
import { getDb, schema } from "@/db";
import { AdminTopbar } from "@/components/AdminTopbar";
import { Icon } from "@/components/Icon";
import { NoticeNotification } from "@/components/NoticeNotification";
import { GMAIL_LAST_SEEN, getState } from "@/lib/app-state";
import { requireAdmin } from "@/lib/auth";
import { pendingCounts, publishedEmailNotices, unassignedNotices } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notificações · Contas do Imóvel" };

export default async function NotificationsPage() {
  await requireAdmin();
  const db = await getDb();
  const [pending, published, counts, properties, gmail] = await Promise.all([
    unassignedNotices(),
    publishedEmailNotices(),
    pendingCounts(),
    db.select({ id: schema.properties.id, name: schema.properties.name }).from(schema.properties),
    getState<boolean>(GMAIL_LAST_SEEN),
  ]);

  return (
    <>
      <AdminTopbar />
      <main className="page narrow">
        <section className="intro">
          <Link href="/admin" className="eyebrow row" style={{ gap: 4 }}>
            <Icon name="back" size={16} />
            Painel
          </Link>
          <h1>
            <span className="light">Suas</span> notificações
          </h1>
          <p className="muted">Avisos que a Enel e a Sabesp mandaram por e-mail, resumidos. Publique os que o inquilino precisa ver.</p>
        </section>

        {(counts.review > 0 || counts.payments > 0) && (
          <section className="stack" aria-label="Outras pendências">
            {counts.review > 0 && (
              <Link href="/admin" className="alert-card bad" style={{ color: "inherit", textDecoration: "none" }}>
                <span className="tile sm bad">
                  <Icon name="alert" size={18} />
                </span>
                <div className="body grow">
                  <span className="title">
                    {counts.review} conta{counts.review > 1 ? "s" : ""} para conferir
                  </span>
                  <span className="text">Chegaram por e-mail com sinal de alerta e estão escondidas do inquilino.</span>
                </div>
                <Icon name="chevron" size={18} />
              </Link>
            )}
            {counts.payments > 0 && (
              <Link href="/admin" className="alert-card" style={{ color: "inherit", textDecoration: "none" }}>
                <span className="tile sm info">
                  <Icon name="receipt" size={18} />
                </span>
                <div className="body grow">
                  <span className="title">
                    {counts.payments} pagamento{counts.payments > 1 ? "s" : ""} para confirmar
                  </span>
                  <span className="text">O inquilino informou que pagou.</span>
                </div>
                <Icon name="chevron" size={18} />
              </Link>
            )}
          </section>
        )}

        <section className="stack" aria-label="Avisos novos">
          <div className="section-title">
            <h2>Novos</h2>
            <span className="tiny">{pending.length}</span>
          </div>
          {pending.length === 0 ? (
            <div className="card flat" style={{ justifyItems: "center", textAlign: "center", padding: "28px 20px" }}>
              <span className="tile lg good">
                <Icon name="checkCircle" size={24} />
              </span>
              <div className="stack-sm">
                <h3>Nenhum aviso novo</h3>
                <p className="small muted">
                  {gmail ? "Quando chegar um aviso por e-mail, ele aparece aqui resumido." : "Conecte seu Gmail para os avisos chegarem sozinhos."}
                </p>
              </div>
              {!gmail && (
                <Link className="btn primary" href="/admin/conectar-gmail">
                  <Icon name="mail" size={18} />
                  Conectar Gmail
                </Link>
              )}
            </div>
          ) : (
            <div className="notif-stack">
              {pending.map((n) => (
                <NoticeNotification key={n.id} notice={n} properties={properties} />
              ))}
            </div>
          )}
        </section>

        {published.length > 0 && (
          <section className="stack" aria-label="Publicados">
            <div className="section-title">
              <h2>Publicados</h2>
            </div>
            <div className="notif-stack">
              {published.map(({ notice, propertyName }) => (
                <NoticeNotification key={notice.id} notice={notice} properties={properties} publishedTo={propertyName} />
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
