import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { brDate, monthLabel, PROVIDER_LABEL } from "@/lib/format";
import { billSummary, parseNotices } from "@/lib/queries";
import { formatDigitable } from "@/lib/parser/barcode";
import { displayStatus, STATUS_LABEL } from "@/lib/status";
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

  return (
    <main className="container">
      <p className="small">
        <Link href={bill.propertyId ? `/admin/imoveis/${bill.propertyId}` : "/admin"}>← Voltar</Link>
      </p>
      <div className="row between">
        <h1>
          {bill.provider ? PROVIDER_LABEL[bill.provider] : "Conta"} · {monthLabel(bill.referenceMonth)}
        </h1>
        <span className={`chip ${status}`}>{STATUS_LABEL[status]}</span>
      </div>

      <section className="card">
        <div className="row">
          <a className="btn sm" href={`/f/${bill.shareToken}`} target="_blank" rel="noopener noreferrer">
            Ver PDF
          </a>
          {bill.receiptFilename && (
            <a className="btn sm" href={`/admin/contas/${bill.id}/comprovante`} target="_blank" rel="noopener noreferrer">
              Ver comprovante
            </a>
          )}
          <StatusButtons id={bill.id} status={bill.status} />
        </div>
        {bill.paidAt && (
          <p className="small muted">
            {bill.status === "pago" ? "Paga" : "Pagamento informado"} em {brDate(bill.paidAt)}
            {bill.paymentNote ? ` — “${bill.paymentNote}”` : ""}
          </p>
        )}
      </section>

      <section className="card">
        <h2>Dados lidos do PDF</h2>
        <p className="small muted">Confira e corrija se o leitor errou algo.</p>
        <form action={updateBill.bind(null, bill.id)} className="stack">
          <div className="form-grid">
            <label>
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
            <label>
              Distribuidora
              <select name="provider" defaultValue={bill.provider ?? ""}>
                <option value="">—</option>
                <option value="enel">Enel (luz)</option>
                <option value="sabesp">Sabesp (água)</option>
              </select>
            </label>
            <label>
              Mês de referência
              <input type="month" name="referenceMonth" defaultValue={bill.referenceMonth ?? ""} />
            </label>
            <label>
              Vencimento
              <input type="date" name="dueDate" defaultValue={bill.dueDate ?? ""} />
            </label>
            <label>
              Valor (R$)
              <input name="amount" inputMode="decimal" defaultValue={bill.amountCents != null ? (bill.amountCents / 100).toFixed(2).replace(".", ",") : ""} />
            </label>
            <label>
              Consumo ({bill.consumptionUnit ?? "kWh / m³"})
              <input name="consumption" inputMode="decimal" defaultValue={bill.consumption ?? ""} />
            </label>
          </div>
          <label>
            Linha digitável (48 dígitos)
            <input name="digitable" className="mono" defaultValue={bill.digitable ? formatDigitable(bill.digitable) : ""} />
          </label>
          <label>
            PIX copia e cola
            <textarea name="pixCode" className="mono" defaultValue={bill.pixCode ?? ""} />
          </label>
          <SubmitButton pendingText="Salvando…">Salvar</SubmitButton>
        </form>
        <form action={reparseBill.bind(null, bill.id)}>
          <button className="btn sm" type="submit">
            Ler o PDF de novo
          </button>
        </form>
      </section>

      {notices.length > 0 && (
        <section className="card">
          <h2>Avisos encontrados na conta</h2>
          <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
            {notices.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <details>
          <summary>Texto extraído do PDF</summary>
          <pre className="mono tiny" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
            {bill.rawText ?? "(vazio)"}
          </pre>
        </details>
        <form action={deleteBill.bind(null, bill.id)}>
          <button className="btn sm danger" type="submit">
            Excluir conta
          </button>
        </form>
      </section>
    </main>
  );
}
