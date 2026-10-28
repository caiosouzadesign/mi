import type { BillSummary } from "@/lib/queries";
import { formatDigitable } from "@/lib/parser/barcode";
import { brDate, brl, formatConsumption, monthLabel, PROVIDER_LABEL } from "@/lib/format";
import { billFilename } from "@/lib/files";
import { displayStatus, STATUS_LABEL } from "@/lib/status";
import { CopyButton } from "./CopyButton";
import { ShareButtons } from "./ShareButtons";
import { SubmitButton } from "./SubmitButton";

interface Props {
  bill: BillSummary;
  baseUrl: string;
  /** server action já vinculada a esta conta; ausente = sem botão "Já paguei" */
  onInformPayment?: (formData: FormData) => Promise<void>;
}

export function BillCard({ bill, baseUrl, onInformPayment }: Props) {
  const status = displayStatus(bill);
  const providerLabel = bill.provider ? PROVIDER_LABEL[bill.provider] : "Conta";
  const pdfUrl = `${baseUrl}/f/${bill.shareToken}`;
  const digitable = bill.digitable ? formatDigitable(bill.digitable) : null;
  const shareText = [
    `${providerLabel} — ${monthLabel(bill.referenceMonth)}`,
    `Valor: ${brl(bill.amountCents)}`,
    `Vencimento: ${brDate(bill.dueDate)}`,
    digitable ? `Código de barras: ${digitable}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <article className={`card ${bill.provider ?? ""}`}>
      <div className="row between">
        <div>
          <h2>{providerLabel}</h2>
          <p className="small muted">Referência {monthLabel(bill.referenceMonth)}</p>
        </div>
        <span className={`chip ${status}`}>{STATUS_LABEL[status]}</span>
      </div>

      <div className="amount">{brl(bill.amountCents)}</div>
      <dl className="kv" style={{ margin: 0 }}>
        <div>
          <dt>Vencimento</dt>
          <dd>{brDate(bill.dueDate)}</dd>
        </div>
        <div>
          <dt>Consumo</dt>
          <dd>{formatConsumption(bill.consumption, bill.consumptionUnit)}</dd>
        </div>
        {bill.paidAt && (
          <div>
            <dt>{bill.status === "pago" ? "Pago em" : "Informado em"}</dt>
            <dd>{brDate(bill.paidAt)}</dd>
          </div>
        )}
      </dl>

      {digitable && (
        <div className="stack" style={{ gap: 4 }}>
          <span className="tiny">Código de barras</span>
          <span className="mono small">{digitable}</span>
        </div>
      )}

      <div className="btn-grid">
        {bill.digitable && <CopyButton className="btn primary full" value={bill.digitable} label="Copiar código de barras" />}
        {bill.pixCode && <CopyButton className="btn full" value={bill.pixCode} label="Copiar PIX copia e cola" />}
        <a className="btn" href={`/f/${bill.shareToken}?download=1`}>
          Baixar PDF
        </a>
        <a className="btn" href={`/f/${bill.shareToken}`} target="_blank" rel="noopener noreferrer">
          Ver PDF
        </a>
        <ShareButtons title={`${providerLabel} ${monthLabel(bill.referenceMonth)}`} text={shareText} pdfUrl={pdfUrl} filename={billFilename(bill)} />
      </div>

      {bill.status === "informado" && (
        <p className="small muted">Pagamento informado — aguardando confirmação do proprietário.</p>
      )}

      {onInformPayment && bill.status === "pendente" && (
        <details>
          <summary>Já paguei esta conta</summary>
          <form action={onInformPayment} className="stack">
            <label>
              Comprovante (opcional)
              <input type="file" name="receipt" accept="image/*,application/pdf" />
            </label>
            <label>
              Observação (opcional)
              <input type="text" name="note" maxLength={500} placeholder="Ex.: pago pelo app do banco" />
            </label>
            <SubmitButton>Informar pagamento</SubmitButton>
          </form>
        </details>
      )}
    </article>
  );
}
