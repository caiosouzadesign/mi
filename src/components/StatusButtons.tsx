import { setBillStatus } from "@/app/admin/actions";
import type { BillStatus } from "@/db/schema";
import { Icon } from "./Icon";

/** Ações rápidas de pagamento no painel */
export function StatusButtons({ id, status, undo = true }: { id: number; status: BillStatus; undo?: boolean }) {
  return (
    <div className="row" style={{ gap: 6 }}>
      {status !== "pago" && (
        <form action={setBillStatus.bind(null, id, "pago")}>
          <button className={`btn sm${status === "informado" ? " primary" : ""}`} type="submit">
            <Icon name="check" size={16} />
            {status === "informado" ? "Confirmar" : "Marcar paga"}
          </button>
        </form>
      )}
      {undo && status !== "pendente" && (
        <form action={setBillStatus.bind(null, id, "pendente")}>
          <button className="btn sm ghost" type="submit" title="Voltar para a pagar">
            <Icon name="refresh" size={16} />
            Desfazer
          </button>
        </form>
      )}
    </div>
  );
}
