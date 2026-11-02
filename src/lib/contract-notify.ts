import { and, eq, isNotNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Property } from "@/db/schema";
import { contractInfo, contractMessage, dueReminder } from "./contract";
import { brDate } from "./format";
import { sendEmail } from "./notify";

/** Avisa o inquilino que o contrato está acabando: aviso no portal + e-mail (se configurado) */
export async function notifyContractEnding(property: Property, portalLink: string) {
  const info = contractInfo(property);
  if (!info || !property.contractEnd) throw new Error("Informe a data de fim do contrato");
  const message = contractMessage({
    tenantName: property.tenantName,
    propertyName: property.name,
    contractEnd: property.contractEnd,
    daysLeft: info.daysLeft,
    link: portalLink,
  });
  const db = await getDb();
  // um aviso de contrato por vez no portal: o novo substitui o anterior
  await db.delete(schema.notices).where(and(eq(schema.notices.propertyId, property.id), eq(schema.notices.source, "contrato")));
  await db.insert(schema.notices).values({
    propertyId: property.id,
    title: info.daysLeft < 0 ? `Seu contrato terminou em ${brDate(property.contractEnd)}` : `Seu contrato termina em ${brDate(property.contractEnd)}`,
    body: "Entre em contato com o proprietário para combinar a renovação ou a desocupação.",
    source: "contrato",
  });
  const email = property.tenantEmail ? await sendEmail(property.tenantEmail, `Contrato de locação — ${property.name}`, message) : false;
  return { email, message };
}

/** Lembretes automáticos (chamado uma vez por dia): 90, 60, 30 dias antes e no dia do fim */
export async function sendDueContractReminders(baseUrl: string) {
  const db = await getDb();
  const list = await db.select().from(schema.properties).where(isNotNull(schema.properties.contractEnd));
  const sent: string[] = [];
  for (const property of list) {
    const info = contractInfo(property);
    if (!info) continue;
    const stage = dueReminder(info.daysLeft, property.contractReminderStage);
    if (stage == null) continue;
    await notifyContractEnding(property, `${baseUrl}/t/${property.accessToken}/imovel`);
    await db.update(schema.properties).set({ contractReminderStage: stage }).where(eq(schema.properties.id, property.id));
    sent.push(`${property.name}: ${stage} dias`);
  }
  return sent;
}
