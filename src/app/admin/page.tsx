import Link from "next/link";
import { desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { brDate, monthLabel, whatsappNumber } from "@/lib/format";
import { billsForProperty, latestByProvider, unassignedBills, unassignedNotices } from "@/lib/queries";
import { displayStatus } from "@/lib/status";
import { contractInfo } from "@/lib/contract";
import { STAGE_LABEL } from "@/lib/documents";
import { baseUrl } from "@/lib/url";
import { AdminBillRow } from "@/components/AdminBillRow";
import { AdminTopbar } from "@/components/AdminTopbar";
import { PROVIDER_META } from "@/components/BillCard";
import { CopyButton } from "@/components/CopyButton";
import { Icon } from "@/components/Icon";
import { Money } from "@/components/Money";
import { PropertyFields } from "@/components/PropertyFields";
import { StatusButtons } from "@/components/StatusButtons";
import { SubmitButton } from "@/components/SubmitButton";
import { assignBill, assignNotice, createProperty, deleteNotice } from "./actions";
import { UploadForm } from "./UploadForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Painel · Contas do Imóvel" };

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
  const allBills = withBills.flatMap((w) => w.bills);
  const awaiting = withBills.flatMap(({ property, bills }) => bills.filter((b) => b.status === "informado").map((b) => ({ property, bill: b })));
  const openCents = allBills.filter((b) => b.status === "pendente").reduce((s, b) => s + (b.amountCents ?? 0), 0);
  const overdueCount = allBills.filter((b) => displayStatus(b) === "vencida").length;
  const endingCount = properties.filter((p) => {
    const c = contractInfo(p);
    return c && c.stage !== "ativo";
  }).length;

  const kpis = [
    { label: "Em aberto", value: <Money cents={openCents} size="md" />, icon: "receipt" as const, tone: "info" },
    { label: "Vencidas", value: overdueCount, icon: "alert" as const, tone: overdueCount ? "bad" : "" },
    { label: "A confirmar", value: awaiting.length, icon: "clock" as const, tone: awaiting.length ? "warn" : "" },
    { label: "Contratos a vencer", value: endingCount, icon: "calendar" as const, tone: endingCount ? "warn" : "" },
  ];

  return (
    <>
      <AdminTopbar />
      <main className="page">
        <section className="intro">
          <span className="eyebrow">Visão geral</span>
          <h1>
            <span className="light">Seus</span> imóveis
          </h1>
        </section>

        <section className="kpis" aria-label="Resumo">
          {kpis.map((k) => (
            <div key={k.label} className="card flat kpi">
              <span className={`tile ${k.tone}`}>
                <Icon name={k.icon} />
              </span>
              <div>
                <div className="value">{k.value}</div>
                <div className="label">{k.label}</div>
              </div>
            </div>
          ))}
        </section>

        {awaiting.length > 0 && (
          <section className="card">
            <div className="row between">
              <h2>Pagamentos informados</h2>
              <span className="chip informado">{awaiting.length} a confirmar</span>
            </div>
            <div className="list">
              {awaiting.map(({ property, bill }) => (
                <div key={bill.id} className="bill-line">
                  <span className={`tile sm ${bill.provider ?? ""}`}>
                    <Icon name={bill.provider ? PROVIDER_META[bill.provider].icon : "doc"} size={17} />
                  </span>
                  <div className="meta">
                    <span style={{ fontWeight: 600 }}>
                      {property.name} <span className="light">· {bill.provider ? PROVIDER_META[bill.provider].title : "Conta"} {monthLabel(bill.referenceMonth)}</span>
                    </span>
                    <span className="tiny">
                      Informado em {brDate(bill.paidAt)}
                      {bill.paymentNote ? ` · “${bill.paymentNote}”` : ""}
                    </span>
                  </div>
                  <Money cents={bill.amountCents} size="sm" />
                  {bill.receiptFilename && (
                    <a className="btn sm" href={`/admin/contas/${bill.id}/comprovante`} target="_blank" rel="noopener noreferrer">
                      <Icon name="receipt" size={16} />
                      Comprovante
                    </a>
                  )}
                  <StatusButtons id={bill.id} status={bill.status} />
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="props" aria-label="Imóveis">
          {withBills.map(({ property, bills }) => {
            const latest = latestByProvider(bills);
            const link = `${base}/t/${property.accessToken}`;
            const wa = whatsappNumber(property.tenantPhone);
            const waText = `Olá${property.tenantName ? `, ${property.tenantName.split(" ")[0]}` : ""}! Suas contas de água e luz ficam neste link — dá para baixar, copiar o código de barras e ver o histórico: ${link}`;
            const overdue = bills.filter((b) => displayStatus(b) === "vencida").length;
            const contract = contractInfo(property);
            return (
              <article key={property.id} className="card">
                <header className="bill-head">
                  <span className="tile">
                    <Icon name="home" size={21} />
                  </span>
                  <div className="grow">
                    <h3>
                      <Link href={`/admin/imoveis/${property.id}`} style={{ color: "var(--text)" }}>
                        {property.name}
                      </Link>
                    </h3>
                    <p className="small faint">{property.tenantName ?? "Sem inquilino cadastrado"}</p>
                  </div>
                  {contract && (
                    <Link href={`/admin/imoveis/${property.id}/contrato`} className={`chip ${contract.stage}`} title={contract.label}>
                      {contract.stage === "ativo" ? `Contrato até ${brDate(property.contractEnd)}` : contract.daysLeft < 0 ? STAGE_LABEL.vencido : `Contrato: ${contract.daysLeft} dias`}
                    </Link>
                  )}
                  <Link className="icon-btn" href={`/admin/imoveis/${property.id}`} aria-label="Detalhes do imóvel">
                    <Icon name="chevron" size={18} />
                  </Link>
                </header>

                <div className="list">
                  {(["enel", "sabesp"] as const).map((prov) =>
                    latest[prov] ? (
                      <AdminBillRow key={prov} bill={latest[prov]} />
                    ) : (
                      <div key={prov} className="bill-line">
                        <span className={`tile sm ${prov}`}>
                          <Icon name={PROVIDER_META[prov].icon} size={17} />
                        </span>
                        <span className="small faint">{PROVIDER_META[prov].title}: nenhuma conta ainda</span>
                      </div>
                    ),
                  )}
                </div>

                {overdue > 0 && (
                  <Link href={`/admin/imoveis/${property.id}`} className="alert-card bad small" style={{ color: "var(--bad)", fontWeight: 500 }}>
                    <Icon name="alert" size={18} />
                    {overdue} conta{overdue > 1 ? "s" : ""} vencida{overdue > 1 ? "s" : ""} neste imóvel
                  </Link>
                )}

                <div className="btn-row">
                  <CopyButton className="btn sm" value={link} label="Copiar link" icon="link" />
                  {wa && (
                    <a className="btn sm" href={`https://wa.me/${wa}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noopener noreferrer">
                      <Icon name="chat" size={16} />
                      WhatsApp
                    </a>
                  )}
                </div>
              </article>
            );
          })}
          {properties.length === 0 && (
            <div className="card" style={{ justifyItems: "center", textAlign: "center", padding: "36px 20px" }}>
              <span className="tile lg info">
                <Icon name="home" size={24} />
              </span>
              <div className="stack-sm">
                <h3>Nenhum imóvel cadastrado</h3>
                <p className="small muted">Cadastre o primeiro imóvel lá embaixo.</p>
              </div>
            </div>
          )}
        </section>

        {orphanBills.length > 0 && (
          <section className="card">
            <div className="stack-sm">
              <h2>Contas sem imóvel</h2>
              <p className="small muted">
                Não foi possível identificar o imóvel pelo nº da instalação / RGI. Confira os códigos no cadastro do imóvel ou atribua aqui.
              </p>
            </div>
            <div className="list">
              {orphanBills.map((b) => (
                <div key={b.id} className="bill-line">
                  <span className={`tile sm ${b.provider ?? ""}`}>
                    <Icon name={b.provider ? PROVIDER_META[b.provider].icon : "doc"} size={17} />
                  </span>
                  <div className="meta">
                    <Link href={`/admin/contas/${b.id}`} style={{ color: "var(--text)", fontWeight: 600 }}>
                      {b.provider ? PROVIDER_META[b.provider].title : "Conta"} <span className="light">· {monthLabel(b.referenceMonth)}</span>
                    </Link>
                    <span className="tiny">Vence {brDate(b.dueDate)}</span>
                  </div>
                  <Money cents={b.amountCents} size="sm" />
                  <form action={assignBill.bind(null, b.id)} className="row" style={{ flexWrap: "nowrap" }}>
                    <select name="propertyId" required style={{ minWidth: 170, minHeight: 36, padding: "6px 34px 6px 12px" }}>
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
            </div>
          </section>
        )}

        {orphanNotices.length > 0 && (
          <section className="card">
            <h2>Avisos recebidos por e-mail</h2>
            <div className="list">
              {orphanNotices.map((n) => (
                <div key={n.id} className="list-row" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
                  <span className={`tile sm ${n.provider ?? "info"}`}>
                    <Icon name={n.provider ? PROVIDER_META[n.provider].icon : "bell"} size={17} />
                  </span>
                  <div className="meta" style={{ flexBasis: 220 }}>
                    <span className="title">{n.title}</span>
                    {n.body && <span className="small muted" style={{ whiteSpace: "pre-line" }}>{n.body}</span>}
                    <span className="tiny">{brDate(n.createdAt)}</span>
                  </div>
                  <div className="row" style={{ flexWrap: "nowrap" }}>
                    <form action={assignNotice.bind(null, n.id)} className="row" style={{ flexWrap: "nowrap" }}>
                      <select name="propertyId" required style={{ minWidth: 150, minHeight: 36, padding: "6px 34px 6px 12px" }}>
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
                      <button className="icon-btn" type="submit" aria-label="Descartar aviso" title="Descartar">
                        <Icon name="x" size={17} />
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="props">
          <section className="card">
            <div className="stack-sm">
              <h2>Enviar contas</h2>
              <p className="small muted">Com o Gmail configurado (veja o README) as contas chegam sozinhas. Use aqui para importar manualmente.</p>
            </div>
            <UploadForm properties={properties.map((p) => ({ id: p.id, name: p.name }))} />
          </section>

          <section className="card">
            <div className="stack-sm">
              <h2>Cadastrar imóvel</h2>
              <p className="small muted">O nº da instalação e o RGI ligam cada conta ao imóvel certo.</p>
            </div>
            <form action={createProperty} className="stack" style={{ gap: 18 }}>
              <PropertyFields />
              <SubmitButton className="btn primary">
                <Icon name="plus" size={18} />
                Cadastrar imóvel
              </SubmitButton>
            </form>
          </section>
        </div>
      </main>
    </>
  );
}
