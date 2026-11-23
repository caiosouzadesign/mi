import type { Property } from "@/db/schema";
import { billMessage } from "./bill-notify";
import { whatsappNumber } from "./format";
import type { BillSummary } from "./queries";

/** Link wa.me com a mensagem da conta pronta para o inquilino */
export function billWhatsappLink(bill: BillSummary, property: Property, baseUrl: string): string | null {
  const number = whatsappNumber(property.tenantPhone);
  if (!number) return null;
  const text = billMessage(bill, { tenantName: property.tenantName, link: `${baseUrl}/t/${property.accessToken}`, kind: "nova" });
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
