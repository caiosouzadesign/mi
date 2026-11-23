import type { BillSummary } from "@/lib/queries";
import { formatDigitable } from "@/lib/parser/barcode";
import { brDate, brl, monthLabel } from "@/lib/format";
import { billFilename } from "@/lib/files";
import { daysUntil, displayStatus, STATUS_LABEL } from "@/lib/status";
import { BillActions } from "./BillActions";
import { CopyButton, CopyIconButton } from "./CopyButton";
import { Icon } from "./Icon";
import { Money } from "./Money";
import { PaymentForm } from "./PaymentForm";

export const PROVIDER_META = {
  enel: { title: "Luz", company: "Enel", icon: "bolt" },
  sabesp: { title: "Água", company: "Sabesp", icon: "drop" },
} as const;

interface Props {
  bill: BillSummary;
  baseUrl: string;
  /** variação do consumo em relação à média dos meses anteriores, em % */
  consumptionDelta?: number | null;
  /** server action já vinculada a esta conta; ausente = sem botão "Já paguei" */
  onInformPayment?: (prev: string | null, formData: FormData) => Promise<string | null>;
}

function dueInfo(bill: BillSummary) {
  if (bill.status !== "pendente" || !bill.dueDate) return null;
  const days = daysUntil(bill.dueDate);
  const label =
    days < 0 ? `Venceu há ${-days} dia${days === -1 ? "" : "s"}` : days === 0 ? "Vence hoje" : days === 1 ? "Vence amanhã" : `Vence em ${days} dias`;
  const tone = days < 0 ? "bad" : days <= 3 ? "warn" : "";
  // a barra enche ao longo dos 30 dias antes do vencimento
  const progress = Math.min(100, Math.max(6, ((30 - days) / 30) * 100));
  return { label, tone, progress };
}

export function BillCard({ bill, baseUrl, consumptionDelta, onInformPayment }: Props) {
  const status = displayStatus(bill);
  const meta = bill.provider ? PROVIDER_META[bill.provider] : null;
  const pdfPath = `/f/${bill.shareToken}`;
  const digitable = bill.digitable ? formatDigitable(bill.digitable) : null;
  const due = dueInfo(bill);
  const title = meta ? `${meta.title} · ${meta.company}` : "Conta";
  const shareText = [
    `${title} — ${monthLabel(bill.referenceMonth)}`,
    `Valor: ${brl(bill.amountCents)}`,
    `Vencimento: ${brDate(bill.dueDate)}`,
    digitable ? `Código de barras: ${digitable}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <article className="card">
      <header className="bill-head">
        <span className={`tile ${bill.provider ?? ""}`}>
          <Icon name={meta?.icon ?? "doc"} size={22} />
        </span>
        <div className="grow">
          <h3>{meta?.title ?? "Conta"}</h3>
          <p className="small faint">
            {meta?.company ?? "—"} · {monthLabel(bill.referenceMonth)}
          </p>
        </div>
        <span className={`chip ${status}`}>{STATUS_LABEL[status]}</span>
      </header>

      <div className="bill-amount">
        <Money cents={bill.amountCents} size="lg" />
        {due && (
          <span className={`due-note ${due.tone}`}>
            <Icon name={due.tone === "bad" ? "alert" : "clock"} size={16} />
            {due.label}
          </span>
        )}
        {bill.status === "pago" && (
          <span className="due-note" style={{ color: "var(--good)" }}>
            <Icon name="checkCircle" size={16} />
            Paga{bill.paidAt ? ` em ${brDate(bill.paidAt)}` : ""}
          </span>
        )}
      </div>
      {due && (
        <div className={`progress ${due.tone}`} aria-hidden>
          <span style={{ width: `${due.progress}%` }} />
        </div>
      )}

      <dl className="inset stats">
        <div className="stat">
          <dt>Vencimento</dt>
          <dd>{brDate(bill.dueDate)}</dd>
        </div>
        <div className="stat">
          <dt>Consumo</dt>
          <dd>
            {bill.consumption != null ? `${bill.consumption.toLocaleString("pt-BR")} ${bill.consumptionUnit ?? ""}` : "—"}
            {consumptionDelta != null && consumptionDelta !== 0 && (
              <span className={`delta ${consumptionDelta > 0 ? "up" : "down"}`}>
                {consumptionDelta > 0 ? "↑" : "↓"} {Math.abs(consumptionDelta)}%
              </span>
            )}
          </dd>
        </div>
      </dl>

      {digitable && (
        <div className="stack-sm">
          <span className="eyebrow">Código de barras</span>
          <div className="code-well">
            <span className="mono">{digitable}</span>
            <CopyIconButton value={bill.digitable!} label="Copiar código de barras" />
          </div>
        </div>
      )}

      {(bill.digitable || bill.pixCode) && (
        <div className="btn-row">
          {bill.digitable && <CopyButton className="btn primary" value={bill.digitable} label="Copiar código" />}
          {bill.pixCode && <CopyButton className="btn" value={bill.pixCode} label="Copiar PIX" />}
        </div>
      )}

      <BillActions title={`${title} ${monthLabel(bill.referenceMonth)}`} text={shareText} pdfUrl={`${baseUrl}${pdfPath}`} pdfPath={pdfPath} filename={billFilename(bill)} />

      {bill.status === "informado" && (
        <div className="inset row small" style={{ gap: 10 }}>
          <Icon name="clock" size={18} />
          <span className="grow muted">Pagamento informado em {brDate(bill.paidAt)} — aguardando confirmação do proprietário.</span>
        </div>
      )}
      {onInformPayment && bill.status === "pendente" && <PaymentForm action={onInformPayment} />}
    </article>
  );
}
