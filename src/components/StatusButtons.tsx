import { setBillStatus } from "@/app/admin/actions";
import type { BillStatus } from "@/db/schema";

/** Ações rápidas de pagamento no painel */
export function StatusButtons({ id, status }: { id: number; status: BillStatus }) {
  return (
    <div className="row">
      {status !== "pago" && (
        <form action={setBillStatus.bind(null, id, "pago")}>
          <button className="btn sm" type="submit">
            {status === "informado" ? "Confirmar pagamento" : "Marcar paga"}
          </button>
        </form>
      )}
      {status !== "pendente" && (
        <form action={setBillStatus.bind(null, id, "pendente")}>
          <button className="btn sm" type="submit">
            Voltar p/ a pagar
          </button>
        </form>
      )}
    </div>
  );
}
