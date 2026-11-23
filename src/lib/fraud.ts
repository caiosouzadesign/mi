import type { Provider } from "./parser";
import { parseDigitable } from "./parser/barcode";

/**
 * Proteção contra boleto falso: uma conta que chega por e-mail só aparece para o
 * inquilino se parecer legítima. Qualquer sinal estranho a manda para revisão do
 * proprietário.
 */

/** Código da empresa/convênio no código de barras (posições 16 a 19, padrão FEBRABAN) */
export function companyCode(digitable: string | null): string | null {
  if (!digitable) return null;
  return parseDigitable(digitable)?.barcode.slice(15, 19) ?? null;
}

interface Candidate {
  provider: Provider | null;
  digitable: string | null;
  amountCents: number | null;
}

export function reviewReasons(bill: Candidate, history: { digitable: string | null; amountCents: number | null }[]): string[] {
  const reasons: string[] = [];
  const parsed = bill.digitable ? parseDigitable(bill.digitable) : null;
  if (!parsed) {
    reasons.push("Sem código de barras de concessionária no PDF");
  } else if (
    (bill.provider === "enel" && parsed.segment !== "energia") ||
    (bill.provider === "sabesp" && parsed.segment !== "saneamento") ||
    !bill.provider
  ) {
    reasons.push("O código de barras não é de conta de luz/água desta distribuidora");
  }

  const codes = new Set(history.map((h) => companyCode(h.digitable)).filter(Boolean));
  if (history.length === 0) {
    reasons.push("Primeira conta desta distribuidora neste imóvel");
  } else if (parsed && codes.size > 0 && !codes.has(companyCode(bill.digitable))) {
    reasons.push("Código da empresa no boleto diferente das contas anteriores (possível boleto falso)");
  }

  const amounts = history.map((h) => h.amountCents).filter((v): v is number => v != null && v > 0);
  if (bill.amountCents != null && amounts.length >= 2) {
    const average = amounts.reduce((s, v) => s + v, 0) / amounts.length;
    if (bill.amountCents > average * 3) reasons.push("Valor muito acima do normal");
  }
  return reasons;
}
