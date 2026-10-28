import Link from "next/link";
import type { BillSummary } from "@/lib/queries";
import { brDate, brl, formatConsumption, monthLabel, PROVIDER_LABEL } from "@/lib/format";
import { displayStatus, STATUS_LABEL } from "@/lib/status";
import { StatusButtons } from "./StatusButtons";

/** Linha de conta no painel; quebra em duas linhas no celular */
export function AdminBillRow({ bill, showConsumption = false }: { bill: BillSummary; showConsumption?: boolean }) {
  const status = displayStatus(bill);
  return (
    <div className="bill-row">
      <div className="stack" style={{ gap: 2 }}>
        <div className="row">
          <Link href={`/admin/contas/${bill.id}`}>
            <strong>{bill.provider ? PROVIDER_LABEL[bill.provider] : "Conta"}</strong> · {monthLabel(bill.referenceMonth)}
          </Link>
          <span className={`chip ${status}`}>{STATUS_LABEL[status]}</span>
        </div>
        <span className="small muted">
          {brl(bill.amountCents)} · vence {brDate(bill.dueDate)}
          {showConsumption && ` · ${formatConsumption(bill.consumption, bill.consumptionUnit)}`}
        </span>
      </div>
      <StatusButtons id={bill.id} status={bill.status} />
    </div>
  );
}
