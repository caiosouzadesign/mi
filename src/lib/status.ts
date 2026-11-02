import type { BillStatus } from "@/db/schema";
import { todaySP } from "./format";

export type DisplayStatus = BillStatus | "vencida";

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  pendente: "A pagar",
  vencida: "Vencida",
  informado: "Em análise",
  pago: "Paga",
};

export function displayStatus(bill: { status: BillStatus; dueDate: string | null }, today = todaySP()): DisplayStatus {
  if (bill.status === "pendente" && bill.dueDate && bill.dueDate < today) return "vencida";
  return bill.status;
}

/** dias até o vencimento (negativo = atrasada) */
export function daysUntil(dueDate: string, today = todaySP()): number {
  const ms = Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}
