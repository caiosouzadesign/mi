import Link from "next/link";
import type { BillSummary } from "@/lib/queries";
import { brDate, formatConsumption, monthLabel } from "@/lib/format";
import { displayStatus, STATUS_LABEL } from "@/lib/status";
import { PROVIDER_META } from "./BillCard";
import { Icon } from "./Icon";
import { Money } from "./Money";
import { StatusButtons } from "./StatusButtons";

/** Linha de conta no painel; quebra em duas linhas no celular */
export function AdminBillRow({
  bill,
  showConsumption = false,
  whatsapp,
}: {
  bill: BillSummary;
  showConsumption?: boolean;
  /** link wa.me com a conta pronta para o inquilino */
  whatsapp?: string | null;
}) {
  const status = displayStatus(bill);
  const meta = bill.provider ? PROVIDER_META[bill.provider] : null;
  return (
    <div className="bill-line">
      <span className={`tile sm ${bill.provider ?? ""}`}>
        <Icon name={meta?.icon ?? "doc"} size={17} />
      </span>
      <div className="meta">
        <Link href={`/admin/contas/${bill.id}`} style={{ color: "var(--text)", fontWeight: 600 }}>
          {meta?.title ?? "Conta"} <span className="light">· {monthLabel(bill.referenceMonth)}</span>
        </Link>
        <span className="tiny">
          Vence {brDate(bill.dueDate)}
          {showConsumption && ` · ${formatConsumption(bill.consumption, bill.consumptionUnit)}`}
        </span>
      </div>
      <div className="end" style={{ display: "grid", justifyItems: "end", gap: 4 }}>
        <Money cents={bill.amountCents} size="sm" />
        {bill.reviewReason ? (
          <span className="chip vencida" title={bill.reviewReason}>
            Em revisão
          </span>
        ) : (
          <span className={`chip ${status}`}>{STATUS_LABEL[status]}</span>
        )}
      </div>
      {whatsapp && bill.status !== "pago" && (
        <a className="icon-btn" href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label="Enviar a conta ao inquilino pelo WhatsApp" title="Enviar ao inquilino pelo WhatsApp">
          <Icon name="chat" size={17} />
        </a>
      )}
      <StatusButtons id={bill.id} status={bill.status} undo={bill.status === "informado"} />
    </div>
  );
}
