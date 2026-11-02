import { brDate, todaySP } from "./format";
import { daysUntil } from "./status";

export type ContractStage = "ativo" | "atencao" | "urgente" | "vencido";

export interface ContractInfo {
  stage: ContractStage;
  /** dias até o fim (negativo = já terminou) */
  daysLeft: number;
  /** % do prazo já decorrido, se houver data de início */
  progress: number | null;
  label: string;
}

/** Lembretes automáticos: quantos dias antes do fim avisar o inquilino */
export const REMINDER_DAYS = [90, 60, 30, 0] as const;

export function contractInfo(
  contract: { contractStart: string | null; contractEnd: string | null },
  today = todaySP(),
): ContractInfo | null {
  if (!contract.contractEnd) return null;
  const daysLeft = daysUntil(contract.contractEnd, today);
  const stage: ContractStage = daysLeft < 0 ? "vencido" : daysLeft <= 30 ? "urgente" : daysLeft <= 90 ? "atencao" : "ativo";
  let progress: number | null = null;
  if (contract.contractStart) {
    const total = daysUntil(contract.contractEnd, contract.contractStart);
    if (total > 0) progress = Math.min(100, Math.max(0, Math.round(((total - daysLeft) / total) * 100)));
  }
  const label =
    daysLeft < 0
      ? `Terminou em ${brDate(contract.contractEnd)}`
      : daysLeft === 0
        ? "Termina hoje"
        : `Termina em ${brDate(contract.contractEnd)}`;
  return { stage, daysLeft, progress, label };
}

/**
 * Qual lembrete enviar agora, se algum: o menor limite já atingido que ainda
 * não foi avisado. Evita repetir o mesmo lembrete todo dia.
 */
export function dueReminder(daysLeft: number, lastStage: number | null): number | null {
  const reached = REMINDER_DAYS.filter((d) => daysLeft <= d);
  if (reached.length === 0) return null;
  const current = Math.min(...reached);
  if (lastStage != null && lastStage <= current) return null;
  return current;
}

export function contractMessage(input: { tenantName: string | null; propertyName: string; contractEnd: string; daysLeft: number; link?: string }) {
  const first = input.tenantName?.split(" ")[0];
  const when =
    input.daysLeft < 0
      ? `terminou em ${brDate(input.contractEnd)}`
      : input.daysLeft === 0
        ? "termina hoje"
        : `termina em ${brDate(input.contractEnd)} (daqui a ${input.daysLeft} dias)`;
  return [
    `Olá${first ? `, ${first}` : ""}! O contrato de locação do imóvel ${input.propertyName} ${when}.`,
    "Vamos conversar sobre a renovação ou a desocupação?",
    input.link ? `Contrato e documentos: ${input.link}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
