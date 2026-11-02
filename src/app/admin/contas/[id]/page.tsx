import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { brDate, monthLabel } from "@/lib/format";
import { billSummary, parseNotices } from "@/lib/queries";
import { formatDigitable } from "@/lib/parser/barcode";
import { displayStatus, STATUS_LABEL } from "@/lib/status";
import { AdminTopbar } from "@/components/AdminTopbar";
import { PROVIDER_META } from "@/components/BillCard";
import { Icon } from "@/components/Icon";
import { Money } from "@/components/Money";
import { StatusButtons } from "@/components/StatusButtons";
import { SubmitButton } from "@/components/SubmitButton";
import { deleteBill, reparseBill, updateBill } from "../../actions";

export const dynamic = "force-dynamic";

export default async function BillPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = Number((await params).id);
  const db = await getDb();
  const [bill] = await db.select({ ...billSummary, rawText: schema.bills.rawText }).from(schema.bills).where(eq(schema.bills.id, id));
  if (!bill) notFound();
  const properties = await db.select({ id: schema.properties.id, name: schema.properties.name }).from(schema.properties);
  const status = displayStatus(bill);
  const notices = parseNotices(bill.notices);
  const meta = bill.provider ? PROVIDER_META[bill.provider] : null;

  return (
    <>
      <AdminTopbar />
      <main className="page narrow">
        <section className="intro">
          <Link href={bill.propertyId ? `/admin/imoveis/${bill.propertyId}` : "/admin"} className="eyebrow row" style={{ gap: 4 }}>
            <Icon name="back" size={16} />
            Voltar
          </Link>
        </section>

        <section className="card">
          <header className="bill-head">
            <span className={`tile lg ${bill.provider ?? ""}`}>
              <Icon name={meta?.icon ?? "doc"} size={24} />
            </span>
            <div className="grow">
              <h1 style={{ fontSize: "1.5rem" }}>
                {meta?.title ?? "Conta"} <span className="light">· {monthLabel(bill.referenceMonth)}</span>
              </h1>
              <p className="small faint">
                {meta?.company ?? "Distribuidora não identificada"} · vence {brDate(bill.dueDate)}
              </p>
            </div>
            <span className={`chip ${status}`}>{STATUS_LABEL[status]}</span>
          </header>
          <Money cents={bill.amountCents} size="lg" />
          {bill.paidAt && (
            <div className="inset small muted">
              {bill.status === "pago" ? "Paga" : "Pagamento informado"} em {brDate(bill.paidAt)}
              {bill.paymentNote ? ` — “${bill.paymentNote}”` : ""}
            </div>
          )}
          <div className="row">
            <a className="btn sm" href={`/f/${bill.shareToken}`} target="_blank" rel="noopener noreferrer">
              <Icon name="eye" size={16} />
              Ver PDF
            </a>
            {bill.receiptFilename && (
              <a className="btn sm" href={`/admin/contas/${bill.id}/comprovante`} target="_blank" rel="noopener noreferrer">
                <Icon name="receipt" size={16} />
                Comprovante
              </a>
            )}
            <StatusButtons id={bill.id} status={bill.status} />
          </div>
        </section>

        <section className="card">
          <div className="row between">
            <div className="stack-sm">
              <h2>Dados lidos do PDF</h2>
              <p className="small muted">Confira e corrija se o leitor errou algo.</p>
            </div>
            <form action={reparseBill.bind(null, bill.id)}>
              <button className="btn sm" type="submit">
                <Icon name="refresh" size={16} />
                Ler de novo
              </button>
            </form>
          </div>
          <form action={updateBill.bind(null, bill.id)} className="stack" style={{ gap: 18 }}>
            <div className="form-grid">
              <label className="field">
                Imóvel
                <select name="propertyId" defaultValue={bill.propertyId ?? ""}>
                  <option value="">— sem imóvel —</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Distribuidora
                <select name="provider" defaultValue={bill.provider ?? ""}>
                  <option value="">—</option>
                  <option value="enel">Enel (luz)</option>
                  <option value="sabesp">Sabesp (água)</option>
                </select>
              </label>
              <label className="field">
                Mês de referência
                <input type="month" name="referenceMonth" defaultValue={bill.referenceMonth ?? ""} />
              </label>
              <label className="field">
                Vencimento
                <input type="date" name="dueDate" defaultValue={bill.dueDate ?? ""} />
              </label>
              <label className="field">
                Valor (R$)
                <input name="amount" inputMode="decimal" defaultValue={bill.amountCents != null ? (bill.amountCents / 100).toFixed(2).replace(".", ",") : ""} />
              </label>
              <label className="field">
                Consumo ({bill.consumptionUnit ?? "kWh / m³"})
                <input name="consumption" inputMode="decimal" defaultValue={bill.consumption ?? ""} />
              </label>
            </div>
            <label className="field">
              Linha digitável (48 dígitos)
              <input name="digitable" className="mono" defaultValue={bill.digitable ? formatDigitable(bill.digitable) : ""} />
            </label>
            <label className="field">
              PIX copia e cola
              <textarea name="pixCode" className="mono" defaultValue={bill.pixCode ?? ""} />
            </label>
            <SubmitButton className="btn primary" pendingText="Salvando…">
              Salvar
            </SubmitButton>
          </form>
        </section>

        {notices.length > 0 && (
          <section className="card">
            <h2>Avisos encontrados na conta</h2>
            <div className="list">
              {notices.map((n, i) => (
                <div key={i} className="list-row notice">
                  <span className="tile sm info">
                    <Icon name="bell" size={17} />
                  </span>
                  <span className="text small">{n}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="card">
          <details className="disclosure">
            <summary>
              <Icon name="chevron" size={16} />
              Texto extraído do PDF
            </summary>
            <pre className="inset mono tiny" style={{ whiteSpace: "pre-wrap", margin: 0, maxHeight: 420, overflow: "auto" }}>
              {bill.rawText ?? "(vazio)"}
            </pre>
          </details>
          <form action={deleteBill.bind(null, bill.id)}>
            <button className="btn sm ghost danger" type="submit">
              <Icon name="trash" size={16} />
              Excluir conta
            </button>
          </form>
        </section>
      </main>
    </>
  );
}
