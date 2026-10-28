import Link from "next/link";
import { desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { brDate, brl, monthLabel, PROVIDER_LABEL, whatsappNumber } from "@/lib/format";
import { billsForProperty, latestByProvider, unassignedBills, unassignedNotices, type BillSummary } from "@/lib/queries";
import { displayStatus } from "@/lib/status";
import { baseUrl } from "@/lib/url";
import { CopyButton } from "@/components/CopyButton";
import { StatusButtons } from "@/components/StatusButtons";
import { AdminBillRow } from "@/components/AdminBillRow";
import { SubmitButton } from "@/components/SubmitButton";
import { assignBill, assignNotice, createProperty, deleteNotice, logout } from "./actions";
import { UploadForm } from "./UploadForm";
import { PropertyFields } from "@/components/PropertyFields";

export const dynamic = "force-dynamic";
export const metadata = { title: "Painel · Contas do Imóvel" };

function overdueCount(bills: BillSummary[]) {
  return bills.filter((b) => displayStatus(b) === "vencida").length;
}

export default async function AdminPage() {
  await requireAdmin();
  const db = await getDb();
  const [properties, orphanBills, orphanNotices, base] = await Promise.all([
    db.select().from(schema.properties).orderBy(desc(schema.properties.id)),
    unassignedBills(),
    unassignedNotices(),
    baseUrl(),
  ]);
  const withBills = await Promise.all(properties.map(async (p) => ({ property: p, bills: await billsForProperty(p.id) })));
  const awaiting = withBills.flatMap(({ property, bills }) =>
    bills.filter((b) => b.status === "informado").map((b) => ({ property, bill: b })),
  );

  return (
    <main className="container wide">
      <header className="header">
        <div>
          <span className="brand">Contas do imóvel</span>
          <h1>Painel do proprietário</h1>
        </div>
        <form action={logout}>
          <button className="btn sm" type="submit">
            Sair
          </button>
        </form>
      </header>

      {awaiting.length > 0 && (
        <section className="card">
          <h2>Pagamentos informados pelos inquilinos</h2>
          {awaiting.map(({ property, bill }) => (
            <div key={bill.id} className="bill-row">
              <span>
                <strong>{property.name}</strong> · {bill.provider ? PROVIDER_LABEL[bill.provider] : "Conta"} {monthLabel(bill.referenceMonth)} ·{" "}
                {brl(bill.amountCents)} · em {brDate(bill.paidAt)}
                {bill.receiptFilename && (
                  <>
                    {" "}
                    · <a href={`/admin/contas/${bill.id}/comprovante`} target="_blank">comprovante</a>
                  </>
                )}
              </span>
              <StatusButtons id={bill.id} status={bill.status} />
            </div>
          ))}
        </section>
      )}

      {withBills.map(({ property, bills }) => {
        const latest = latestByProvider(bills);
        const link = `${base}/t/${property.accessToken}`;
        const wa = whatsappNumber(property.tenantPhone);
        const waText = `Olá${property.tenantName ? `, ${property.tenantName.split(" ")[0]}` : ""}! Suas contas de água e luz ficam neste link — dá para baixar, copiar o código de barras e ver o histórico: ${link}`;
        return (
          <section key={property.id} className="card">
            <div className="row between">
              <div>
                <h2>
                  <Link href={`/admin/imoveis/${property.id}`}>{property.name}</Link>
                </h2>
                <p className="small muted">{property.tenantName ?? "Sem inquilino cadastrado"}</p>
              </div>
              <div className="row">
                <CopyButton className="btn sm" value={link} label="Copiar link do inquilino" />
                {wa && (
                  <a className="btn sm" href={`https://wa.me/${wa}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noopener noreferrer">
                    Enviar link no WhatsApp
                  </a>
                )}
              </div>
            </div>
            {(["enel", "sabesp"] as const).map((prov) =>
              latest[prov] ? (
                <AdminBillRow key={prov} bill={latest[prov]} />
              ) : (
                <div key={prov} className="bill-row small muted">
                  {PROVIDER_LABEL[prov]}: nenhuma conta ainda
                </div>
              ),
            )}
            {overdueCount(bills) > 0 && (
              <p className="small" style={{ color: "var(--bad)" }}>
                ⚠ {overdueCount(bills)} conta(s) vencida(s) neste imóvel — <Link href={`/admin/imoveis/${property.id}`}>ver todas</Link>
              </p>
            )}
          </section>
        );
      })}

      {orphanBills.length > 0 && (
        <section className="card">
          <h2>Contas sem imóvel</h2>
          <p className="small muted">
            Não foi possível identificar o imóvel pelo nº da instalação / RGI. Confira os códigos no cadastro do imóvel ou atribua aqui.
          </p>
          {orphanBills.map((b) => (
            <div key={b.id} className="row between">
              <Link href={`/admin/contas/${b.id}`}>
                {b.provider ? PROVIDER_LABEL[b.provider] : "Conta"} · {monthLabel(b.referenceMonth)} · {brl(b.amountCents)}
              </Link>
              <form action={assignBill.bind(null, b.id)} className="row">
                <select name="propertyId" required style={{ width: "auto" }}>
                  <option value="">Escolher imóvel…</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <SubmitButton className="btn sm">Atribuir</SubmitButton>
              </form>
            </div>
          ))}
        </section>
      )}

      {orphanNotices.length > 0 && (
        <section className="card">
          <h2>Avisos recebidos sem imóvel</h2>
          {orphanNotices.map((n) => (
            <div key={n.id} className="stack" style={{ gap: 6 }}>
              <strong>
                {n.provider ? `${PROVIDER_LABEL[n.provider]}: ` : ""}
                {n.title}
              </strong>
              {n.body && (
                <details>
                  <summary className="small">Ver texto</summary>
                  <p className="small" style={{ whiteSpace: "pre-line" }}>
                    {n.body}
                  </p>
                </details>
              )}
              <div className="row">
                <form action={assignNotice.bind(null, n.id)} className="row">
                  <select name="propertyId" required style={{ width: "auto" }}>
                    <option value="">Mostrar para…</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <SubmitButton className="btn sm">Publicar</SubmitButton>
                </form>
                <form action={deleteNotice.bind(null, n.id)}>
                  <button className="btn sm danger" type="submit">
                    Descartar
                  </button>
                </form>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="card">
        <h2>Enviar contas manualmente</h2>
        <p className="small muted">
          Baixe o PDF no app da Enel/Sabesp e envie aqui. Com o Gmail configurado (veja o README), isso acontece sozinho.
        </p>
        <UploadForm properties={properties.map((p) => ({ id: p.id, name: p.name }))} />
      </section>

      <section className="card">
        <details>
          <summary>Cadastrar imóvel</summary>
          <form action={createProperty} className="stack">
            <PropertyFields />
            <SubmitButton>Cadastrar</SubmitButton>
          </form>
        </details>
      </section>
    </main>
  );
}
